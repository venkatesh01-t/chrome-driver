import { describe, it, expect, beforeEach } from 'vitest';
import { ActionNormalizer } from '../src/content/action-normalizer';
import { TestStep } from '../src/types/model';

describe('Action Normalizer', () => {
  let emittedSteps: TestStep[];
  let normalizer: ActionNormalizer;

  beforeEach(() => {
    document.body.innerHTML = '';
    emittedSteps = [];
    normalizer = new ActionNormalizer((step) => {
      emittedSteps.push(step);
    });
  });

  it('normalizes single click on a button', () => {
    document.body.innerHTML = `<button id="login-btn">Log In</button>`;
    const btn = document.getElementById('login-btn') as HTMLButtonElement;

    normalizer.recordClick(btn);

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('click');
    expect(emittedSteps[0].target.locators[0].value).toBe('login-btn');
    expect(emittedSteps[0].waitCondition).toBe('clickable');
  });

  it('debounces rapid accidental clicks on the same element within 300ms', () => {
    document.body.innerHTML = `<button id="submit">Submit</button>`;
    const btn = document.getElementById('submit') as HTMLButtonElement;

    normalizer.recordClick(btn);
    normalizer.recordClick(btn);
    normalizer.recordClick(btn);

    // Only 1 click should be recorded
    expect(emittedSteps.length).toBe(1);
  });

  it('buffers typing keystrokes and flushes a single type action', () => {
    document.body.innerHTML = `<input id="username" type="text" />`;
    const input = document.getElementById('username') as HTMLInputElement;

    normalizer.recordInput(input, 'a');
    normalizer.recordInput(input, 'ad');
    normalizer.recordInput(input, 'adm');
    normalizer.recordInput(input, 'admin');

    expect(emittedSteps.length).toBe(0); // Not flushed yet

    normalizer.flushInput();

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('type');
    expect(emittedSteps[0].value).toBe('admin');
    expect(emittedSteps[0].isSensitive).toBe(false);
  });

  it('detects sensitive password field, masks value and assigns variable name', () => {
    document.body.innerHTML = `<input id="user-password" type="password" name="password" />`;
    const input = document.getElementById('user-password') as HTMLInputElement;

    normalizer.recordInput(input, 'SecretP@ss123');
    normalizer.flushInput();

    expect(emittedSteps.length).toBe(1);
    const step = emittedSteps[0];
    expect(step.action).toBe('type');
    expect(step.isSensitive).toBe(true);
    expect(step.value).not.toBe('SecretP@ss123'); // MUST NOT be plain text
    expect(step.variableName).toBe('TEST_PASSWORD');
  });

  it('records checkbox with correct state', () => {
    document.body.innerHTML = `<input id="remember" type="checkbox" />`;
    const checkbox = document.getElementById('remember') as HTMLInputElement;
    checkbox.checked = true;

    normalizer.recordClick(checkbox);

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('checkbox');
    expect(emittedSteps[0].value).toBe('true');
  });
});
