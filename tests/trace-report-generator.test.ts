import { describe, it, expect } from 'vitest';
import { generateVisualHtmlReport } from '../src/generator/trace-report-generator';
import { TestCaseModel, createTestCase, createTestStep } from '../src/types/model';
import { StepExecutionResult } from '../src/content/replay-engine';
import { A11yAuditResult } from '../src/content/a11y-auditor';

describe('Feature 1: Visual HTML Time-Travel Report Generator', () => {
  const createMockTestCase = (): TestCaseModel => {
    const tc = createTestCase('E-Commerce Checkout', 'https://shop.example.com');
    tc.steps = [
      createTestStep({
        stepNumber: 1,
        action: 'click',
        target: {
          tagName: 'button',
          selectedLocatorIndex: 0,
          text: 'Add to Cart',
          locators: [{ strategy: 'data-testid', value: 'add-cart-btn', isUnique: true, matchCount: 1, score: 95 }],
        },
      }),
      createTestStep({
        stepNumber: 2,
        action: 'type',
        value: 'customer@test.com',
        target: {
          tagName: 'input',
          selectedLocatorIndex: 0,
          labelText: 'Email Address',
          locators: [{ strategy: 'id', value: 'email-input', isUnique: true, matchCount: 1, score: 100 }],
        },
      }),
      createTestStep({
        stepNumber: 3,
        action: 'assert_text',
        assertExpected: 'Order Confirmed',
        target: {
          tagName: 'div',
          selectedLocatorIndex: 0,
          locators: [{ strategy: 'css', value: '.status-badge', isUnique: true, matchCount: 1, score: 90 }],
        },
      }),
    ];
    return tc;
  };

  const mockReplayResults: StepExecutionResult[] = [
    {
      stepId: 'step_1',
      stepNumber: 1,
      action: 'click',
      status: 'passed',
      durationMs: 140,
      usedLocator: 'data-testid=add-cart-btn',
    },
    {
      stepId: 'step_2',
      stepNumber: 2,
      action: 'type',
      status: 'passed',
      durationMs: 95,
      usedLocator: 'id=email-input',
    },
    {
      stepId: 'step_3',
      stepNumber: 3,
      action: 'assert_text',
      status: 'passed',
      durationMs: 40,
      usedLocator: 'css=.status-badge',
    },
  ];

  const mockA11y: A11yAuditResult = {
    score: 96,
    totalViolations: 1,
    criticalCount: 0,
    passedChecks: 24,
    violations: [],
  };

  it('generates a complete, self-contained HTML document with dark mode styles and metadata', () => {
    const tc = createMockTestCase();
    const html = generateVisualHtmlReport(tc, {
      projectName: 'Checkout Smoke Suite',
      replayResults: mockReplayResults,
      a11yResult: mockA11y,
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Trace Report - Checkout Smoke Suite');
    expect(html).toContain('https://shop.example.com');
    expect(html).toContain('3/3 Steps Passed');
    expect(html).toContain('WCAG 2.2 Score: 96/100');
    expect(html).toContain('timelineScrubber');
    expect(html).toContain('stepsData');
  });

  it('embeds polyglot code representations for every step in the trace client script', () => {
    const tc = createMockTestCase();
    const html = generateVisualHtmlReport(tc, { replayResults: mockReplayResults });

    expect(html).toContain('playwrightTsCode');
    expect(html).toContain('pythonCode');
    expect(html).toContain('cypressCode');
    expect(html).toContain('function switchCodeLang');
    expect(html).toContain('function renderScrubber');
  });
});
