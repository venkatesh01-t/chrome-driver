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

  it('records dropdown select with visible option text', () => {
    document.body.innerHTML = `
      <select id="country">
        <option value="us">United States</option>
        <option value="in" selected>India</option>
        <option value="uk">United Kingdom</option>
      </select>
    `;
    const select = document.getElementById('country') as HTMLSelectElement;

    normalizer.recordSelect(select);

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('select');
    expect(emittedSteps[0].value).toBe('India');
    expect(emittedSteps[0].waitCondition).toBe('presence');
  });

  it('provides smart semantic prefill when clicking an input without typing', () => {
    document.body.innerHTML = `
      <label for="work-email">Email Address</label>
      <input id="work-email" type="email" />
    `;
    const input = document.getElementById('work-email') as HTMLInputElement;

    // User clicks input but does not manually type
    normalizer.recordClick(input);
    normalizer.flushInput();

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('type');
    expect(emittedSteps[0].value).toBe('user@example.com');
    expect(emittedSteps[0].target.semanticType).toBe('email');
    expect(emittedSteps[0].target.labelText).toBe('Email Address');
  });

  it('records assertions for assert_visible and assert_text with component tagging', () => {
    document.body.innerHTML = '<header><h1 id="title">Dashboard</h1></header>';
    const title = document.getElementById('title') as HTMLElement;

    normalizer.recordAssertion(title, 'assert_visible');
    normalizer.recordAssertion(title, 'assert_text');

    expect(emittedSteps.length).toBe(2);
    expect(emittedSteps[0].action).toBe('assert_visible');
    expect(emittedSteps[0].target.componentType).toBe('header');
    expect(emittedSteps[0].assertExpected).toBe('Dashboard');

    expect(emittedSteps[1].action).toBe('assert_text');
    expect(emittedSteps[1].assertExpected).toBe('Dashboard');
  });

  it('records hover action', () => {
    document.body.innerHTML = '<nav><a id="menu" href="#">Menu</a></nav>';
    const menu = document.getElementById('menu') as HTMLElement;

    normalizer.recordHover(menu);

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('hover');
    expect(emittedSteps[0].target.componentType).toBe('link');
  });

  it('records keypress action', () => {
    document.body.innerHTML = '<input id="search-box" type="search" />';
    const input = document.getElementById('search-box') as HTMLElement;

    normalizer.recordKeyPress('Enter', input);

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('press_key');
    expect(emittedSteps[0].keyCombo).toBe('Enter');
  });

  it('records scroll action', () => {
    normalizer.recordScroll(0, 500);

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('scroll');
    expect(emittedSteps[0].value).toBe('0,500');
  });

  it('records file upload action', () => {
    document.body.innerHTML = '<input id="file-in" type="file" />';
    const fileInput = document.getElementById('file-in') as HTMLInputElement;

    normalizer.recordFileUpload(fileInput, '/path/to/test.csv');

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('upload_file');
    expect(emittedSteps[0].value).toBe('/path/to/test.csv');
  });

  it('records drag and drop action', () => {
    document.body.innerHTML = `
      <div id="drag-src">Source Card</div>
      <div id="drag-tgt">Target Column</div>
    `;
    const src = document.getElementById('drag-src') as HTMLElement;
    const tgt = document.getElementById('drag-tgt') as HTMLElement;

    normalizer.recordDragDrop(src, tgt);

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('drag_drop');
    expect(emittedSteps[0].dragTarget).toBeDefined();
    expect(emittedSteps[0].dragTarget?.locators[0].value).toBe('drag-tgt');
  });

  it('records iframe switch action', () => {
    document.body.innerHTML = '<iframe id="payment-frame" src="about:blank"></iframe>';
    const iframe = document.getElementById('payment-frame') as HTMLIFrameElement;

    normalizer.recordIframeSwitch(iframe);

    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('switch_iframe');
    expect(emittedSteps[0].iframePath).toBe('payment-frame');
  });

  it('records print_value action extracting text or input value', () => {
    document.body.innerHTML = `
      <h2 id="heading">Total Balance: $4,500</h2>
      <input id="acc-num" type="text" value="987654321" />
    `;
    const heading = document.getElementById('heading') as HTMLElement;
    const input = document.getElementById('acc-num') as HTMLInputElement;

    normalizer.recordPrintValue(heading);
    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('print_value');
    expect(emittedSteps[0].value).toBe('Total Balance: $4,500');

    normalizer.recordPrintValue(input);
    expect(emittedSteps.length).toBe(2);
    expect(emittedSteps[1].action).toBe('print_value');
    expect(emittedSteps[1].value).toBe('987654321');
  });

  it('strictly coalesces consecutive input and change events on the same element into a single atomic step', () => {
    document.body.innerHTML = `<input id="search-input" type="text" />`;
    const input = document.getElementById('search-input') as HTMLInputElement;

    // Simulate typing initial chunk
    normalizer.recordInput(input, 'sel');
    normalizer.flushInput();
    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].action).toBe('type');
    expect(emittedSteps[0].value).toBe('sel');

    // Simulate subsequent input and change events without intervening clicks
    input.value = 'selenium';
    normalizer.recordInput(input, 'selenium');
    normalizer.recordChange(input);

    // Must strictly coalesce into single atomic step rather than creating duplicate steps
    expect(emittedSteps.length).toBe(1);
    expect(emittedSteps[0].value).toBe('selenium');
  });

  it('captures Enter key submissions immediately following input fields as explicit press_key Enter steps', () => {
    document.body.innerHTML = `<input id="email-field" type="email" />`;
    const input = document.getElementById('email-field') as HTMLInputElement;

    normalizer.recordInput(input, 'user@domain.com');
    normalizer.recordKeyPress('Enter', input);

    // Step 1: type action
    // Step 2: explicit press_key Enter action on the input field
    expect(emittedSteps.length).toBe(2);
    expect(emittedSteps[0].action).toBe('type');
    expect(emittedSteps[0].value).toBe('user@domain.com');
    expect(emittedSteps[1].action).toBe('press_key');
    expect(emittedSteps[1].keyCombo).toBe('Enter');
    expect(emittedSteps[1].target.componentType).toBe('form');
  });
});

