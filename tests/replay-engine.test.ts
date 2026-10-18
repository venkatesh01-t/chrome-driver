import { describe, it, expect, beforeEach } from 'vitest';
import { ReplayEngine, resolveElement } from '../src/content/replay-engine';
import { TestStep, createTestStep } from '../src/types/model';

describe('Pillar 1: In-Browser Replay & Dry-Run Engine', () => {
  let engine: ReplayEngine;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="test-container">
        <h1 id="main-heading">Automation Dashboard</h1>
        <button id="submit-btn" data-testid="submit-action" class="primary-btn">Submit Order</button>
        <input type="text" id="username" name="user_field" placeholder="Enter username" />
        <input type="checkbox" id="terms-check" />
        <select id="country-select">
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
          <option value="in">India</option>
        </select>
        <div id="status-toast" style="display: block;" data-status="ready">Order Placed Successfully</div>
      </div>
    `;
    engine = new ReplayEngine();
  });

  it('correctly resolves element using primary locator', () => {
    const target = {
      tagName: 'button',
      selectedLocatorIndex: 0,
      locators: [
        { strategy: 'id' as const, value: 'submit-btn', isUnique: true, matchCount: 1, score: 100 },
      ],
    };
    const { element, usedLocator, isFallback } = resolveElement(target);
    expect(element).not.toBeNull();
    expect(element?.id).toBe('submit-btn');
    expect(usedLocator).toBe('id=submit-btn');
    expect(isFallback).toBe(false);
  });

  it('self-heals using fallback locator candidate when primary locator is broken', () => {
    const target = {
      tagName: 'button',
      selectedLocatorIndex: 0,
      locators: [
        { strategy: 'id' as const, value: 'non-existent-broken-id', isUnique: false, matchCount: 0, score: 10 },
        { strategy: 'data-testid' as const, value: 'submit-action', isUnique: true, matchCount: 1, score: 90 },
      ],
    };
    const { element, usedLocator, isFallback } = resolveElement(target);
    expect(element).not.toBeNull();
    expect(element?.id).toBe('submit-btn');
    expect(usedLocator).toBe('data-testid=submit-action');
    expect(isFallback).toBe(true);
  });

  it('replays a click action successfully', async () => {
    const btn = document.getElementById('submit-btn')!;
    let clicked = false;
    btn.addEventListener('click', () => {
      clicked = true;
    });

    const step: TestStep = createTestStep({
      stepNumber: 1,
      action: 'click',
      target: {
        tagName: 'button',
        selectedLocatorIndex: 0,
        locators: [{ strategy: 'id', value: 'submit-btn', isUnique: true, matchCount: 1, score: 100 }],
      },
    });

    const result = await engine.executeStep(step);
    expect(result.status).toBe('passed');
    expect(clicked).toBe(true);
  });

  it('replays typing input and dispatches input/change events', async () => {
    const input = document.getElementById('username') as HTMLInputElement;
    let inputFired = false;
    input.addEventListener('input', () => {
      inputFired = true;
    });

    const step: TestStep = createTestStep({
      stepNumber: 2,
      action: 'type',
      value: 'AntigravityUser',
      target: {
        tagName: 'input',
        selectedLocatorIndex: 0,
        locators: [{ strategy: 'id', value: 'username', isUnique: true, matchCount: 1, score: 100 }],
      },
    });

    const result = await engine.executeStep(step);
    expect(result.status).toBe('passed');
    expect(input.value).toBe('AntigravityUser');
    expect(inputFired).toBe(true);
  });

  it('replays dropdown select change', async () => {
    const select = document.getElementById('country-select') as HTMLSelectElement;

    const step: TestStep = createTestStep({
      stepNumber: 3,
      action: 'select',
      value: 'in',
      target: {
        tagName: 'select',
        selectedLocatorIndex: 0,
        locators: [{ strategy: 'id', value: 'country-select', isUnique: true, matchCount: 1, score: 100 }],
      },
    });

    const result = await engine.executeStep(step);
    expect(result.status).toBe('passed');
    expect(select.value).toBe('in');
  });

  it('validates assert_text and assert_attribute passing and failing conditions', async () => {
    const passStep: TestStep = createTestStep({
      stepNumber: 4,
      action: 'assert_text',
      assertExpected: 'Order Placed',
      target: {
        tagName: 'div',
        selectedLocatorIndex: 0,
        locators: [{ strategy: 'id', value: 'status-toast', isUnique: true, matchCount: 1, score: 100 }],
      },
    });

    const passRes = await engine.executeStep(passStep);
    expect(passRes.status).toBe('passed');
    expect(passRes.actualValue).toContain('Order Placed');

    const failStep: TestStep = createTestStep({
      stepNumber: 5,
      action: 'assert_attribute',
      assertAttribute: 'data-status',
      assertExpected: 'completed',
      target: {
        tagName: 'div',
        selectedLocatorIndex: 0,
        locators: [{ strategy: 'id', value: 'status-toast', isUnique: true, matchCount: 1, score: 100 }],
      },
    });

    const failRes = await engine.executeStep(failStep);
    expect(failRes.status).toBe('failed');
    expect(failRes.error).toContain('data-status');
  });

  it('replays sequential full flow and reports step progression', async () => {
    const steps: TestStep[] = [
      createTestStep({
        stepNumber: 1,
        action: 'type',
        value: 'Jane Doe',
        target: {
          tagName: 'input',
          selectedLocatorIndex: 0,
          locators: [{ strategy: 'id', value: 'username', isUnique: true, matchCount: 1, score: 100 }],
        },
      }),
      createTestStep({
        stepNumber: 2,
        action: 'checkbox',
        value: 'true',
        target: {
          tagName: 'input',
          selectedLocatorIndex: 0,
          locators: [{ strategy: 'id', value: 'terms-check', isUnique: true, matchCount: 1, score: 100 }],
        },
      }),
      createTestStep({
        stepNumber: 3,
        action: 'wait',
        waitDuration: 0.05,
      }),
    ];

    const started: number[] = [];
    const completed: number[] = [];

    const results = await engine.replayFlow(steps, {
      stepDelayMs: 10,
      onStepStart: (s) => started.push(s.stepNumber),
      onStepComplete: (r) => completed.push(r.stepNumber),
    });

    expect(results.length).toBe(3);
    expect(results.every((r) => r.status === 'passed')).toBe(true);
    expect(started).toEqual([1, 2, 3]);
    expect(completed).toEqual([1, 2, 3]);

    const check = document.getElementById('terms-check') as HTMLInputElement;
    expect(check.checked).toBe(true);
  });
});
