import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ActionNormalizer } from '../src/content/action-normalizer';
import { SessionManager, StorageAdapter } from '../src/background/session-manager';
import { generateSeleniumScript } from '../src/generator/python-generator';

class MemoryStorage implements StorageAdapter {
  private data = new Map<string, any>();
  async get<T>(k: string): Promise<T | null> { return this.data.get(k) ?? null; }
  async set<T>(k: string, v: T): Promise<void> { this.data.set(k, v); }
  async clear(): Promise<void> { this.data.clear(); }
}

describe('End-to-End Recording & Python Revalidation Suite', () => {
  let sessionManager: SessionManager;
  let normalizer: ActionNormalizer;

  beforeEach(async () => {
    // 1. Load HTML fixture
    const htmlPath = path.resolve(__dirname, '../test-pages/demo-app.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    document.body.innerHTML = html;

    // 2. Initialize Session and Action Normalizer
    const storage = new MemoryStorage();
    sessionManager = new SessionManager(storage);
    await sessionManager.startRecording({
      name: 'E2E Demo Authentication & Sync Test',
      url: 'https://demo.example.com/app',
    });

    normalizer = new ActionNormalizer(async (step) => {
      await sessionManager.addStep(step, 'https://demo.example.com/app');
    });
  });

  it('records full user journey including dropdowns, semantic inputs, and scrolling', async () => {
    // Step 1: User types username
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    normalizer.recordInput(usernameInput, 'qa_engineer');
    normalizer.flushInput();

    // Step 2: User clicks email without typing -> smart prefill
    const emailInput = document.getElementById('email') as HTMLInputElement;
    normalizer.recordClick(emailInput);
    normalizer.flushInput();

    // Step 3: User types sensitive password
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    normalizer.recordInput(passwordInput, 'MyTopSecretP@ss999!');
    normalizer.flushInput();

    // Step 4: User selects dropdown option
    const planSelect = document.getElementById('plan-selection') as HTMLSelectElement;
    planSelect.selectedIndex = 2; // Enterprise Custom
    normalizer.recordSelect(planSelect);

    // Step 5: User checks "Remember Me"
    const rememberCheckbox = document.getElementById('remember-me') as HTMLInputElement;
    rememberCheckbox.checked = true;
    normalizer.recordClick(rememberCheckbox);

    // Step 6: User clicks button with dynamic ID (should select data-testid or name)
    const dynamicBtn = document.querySelector('[data-testid="sync-now-btn"]') as HTMLButtonElement;
    normalizer.recordClick(dynamicBtn);

    // Step 7: User scrolls to bottom and clicks deep scroll button
    const scrollBtn = document.getElementById('deep-scroll-btn') as HTMLButtonElement;
    normalizer.recordClick(scrollBtn);

    // Verify Session State
    expect(sessionManager.activeTestCase).not.toBeNull();
    const steps = sessionManager.activeTestCase!.steps;
    expect(steps.length).toBe(7);

    // Step 1: Username
    expect(steps[0].action).toBe('type');
    expect(steps[0].value).toBe('qa_engineer');

    // Step 2: Email smart prefill
    expect(steps[1].action).toBe('type');
    expect(steps[1].value).toBe('user@example.com');
    expect(steps[1].target.semanticType).toBe('email');

    // Step 3: Password Masking
    expect(steps[2].action).toBe('type');
    expect(steps[2].isSensitive).toBe(true);
    expect(steps[2].value).toBe('••••••••');
    expect(steps[2].variableName).toBe('TEST_PASSWORD');

    // Step 4: Dropdown Select
    expect(steps[3].action).toBe('select');
    expect(steps[3].value).toContain('Enterprise Custom');

    // Step 5: Checkbox
    expect(steps[4].action).toBe('checkbox');
    expect(steps[4].value).toBe('true');

    // Step 6: Dynamic ID Demotion
    const step6SelectedLocator = steps[5].target.locators[steps[5].target.selectedLocatorIndex];
    expect(step6SelectedLocator.strategy).not.toBe('id');
    expect(['data-testid', 'name']).toContain(step6SelectedLocator.strategy);

    // Step 7: Scrolled Button
    expect(steps[6].action).toBe('click');
    expect(steps[6].target.locators[0].value).toBe('deep-scroll-btn');

    // Generate Enterprise Python Selenium Script
    sessionManager.activeTestCase!.settings.codeStyle = 'enterprise';
    const pythonCode = generateSeleniumScript(sessionManager.activeTestCase!);

    // Revalidation Assertions on the Generated Python Code
    expect(pythonCode).toContain('from selenium import webdriver');
    expect(pythonCode).toContain('from selenium.webdriver.common.by import By');
    expect(pythonCode).toContain('from selenium.webdriver.support.ui import WebDriverWait');
    expect(pythonCode).toContain('from selenium.webdriver.support import expected_conditions as EC');
    expect(pythonCode).toContain('from selenium.webdriver.support.ui import Select');
    expect(pythonCode).toContain('import os');

    // Verify Password never appears in generated code
    expect(pythonCode).not.toContain('MyTopSecretP@ss999!');
    expect(pythonCode).not.toContain('••••••••');
    expect(pythonCode).toContain('TEST_PASSWORD = os.getenv("TEST_PASSWORD", "CHANGE_ME")');
    expect(pythonCode).toContain('.send_keys(TEST_PASSWORD)');

    // Verify Select code
    expect(pythonCode).toContain('select_elem = Select(wait.until(');
    expect(pythonCode).toContain('select_elem.select_by_visible_text(');

    // Verify Auto-Scroll before actions
    expect(pythonCode).toContain('scrollIntoView({block: \'center\', inline: \'nearest\'});');

    // Verify Checkbox logic
    expect(pythonCode).toContain('if not checkbox.is_selected():');
    expect(pythonCode).toContain('checkbox.click()');

    // Verify Dynamic ID is avoided in code
    expect(pythonCode).not.toContain('input-948271');

    // Verify ZERO time.sleep() policy
    expect(pythonCode).not.toContain('time.sleep');

    // Verify Driver Lifecycle
    expect(pythonCode).toContain('driver = webdriver.Chrome(options=options)');
    expect(pythonCode).toContain('driver.get("https://demo.example.com/app")');
    expect(pythonCode).toContain('driver.quit()');

    // Also verify Simple mode generation works seamlessly on the same session
    sessionManager.activeTestCase!.settings.codeStyle = 'simple';
    const simpleCode = generateSeleniumScript(sessionManager.activeTestCase!);
    expect(simpleCode).toContain('def find(driver, by, value, timeout=10):');
    expect(simpleCode).toContain('driver.maximize_window()');
    expect(simpleCode).toContain('driver.quit()');
  });

  it('accurately records and revalidates all complex UI torture cases from demo-app.html', async () => {
    await sessionManager.startRecording({
      name: 'Torture Testbed Suite',
      url: 'https://demo.example.com/app',
    });

    // 1. SVG Click Normalization (Clicks on <path> inside <button>)
    const svgPath = document.querySelector('header button[aria-label="Notifications"] svg path') as SVGElement;
    expect(svgPath).not.toBeNull();
    const parentBtn = svgPath.closest('button') as HTMLButtonElement;
    normalizer.recordClick(parentBtn);

    // 2. Table Row Contextual Anchoring (Approve button for Bob Smith)
    const bobRow = Array.from(document.querySelectorAll('#users-table tbody tr')).find((tr) =>
      tr.textContent?.includes('Bob Smith')
    ) as HTMLTableRowElement;
    expect(bobRow).not.toBeNull();
    const approveBtn = bobRow.querySelectorAll('button')[0] as HTMLButtonElement;
    normalizer.recordClick(approveBtn);

    // 3. Dynamic Entropy ID Input
    const entropyInput = document.querySelector('#entropy-container input') as HTMLInputElement;
    expect(entropyInput).not.toBeNull();
    normalizer.recordInput(entropyInput, 'CC-9900');
    normalizer.flushInput();

    // 4. Custom Combobox and Option
    const comboboxTrigger = document.querySelector('[role="combobox"]') as HTMLElement;
    normalizer.recordClick(comboboxTrigger);
    const optionBlue = Array.from(document.querySelectorAll('[role="option"]')).find(
      (el) => el.textContent?.includes('Production Blue')
    ) as HTMLElement;
    normalizer.recordClick(optionBlue);

    // 5. ContentEditable Rich Text Entry
    const richEditor = document.querySelector('.rich-editor[contenteditable="true"]') as HTMLElement;
    normalizer.recordInput(richEditor, 'Release 3.0 Production Deployment Summary');
    normalizer.flushInput();

    const steps = sessionManager.activeTestCase!.steps;
    expect(steps.length).toBe(6);

    // Step 1: SVG button resolved to button
    expect(steps[0].action).toBe('click');
    expect(steps[0].target.tagName).toBe('button');
    expect(steps[0].target.locators[0].value).toContain('Notifications');

    // Step 2: Row Contextual Anchoring for Bob Smith's Approve button
    expect(steps[1].action).toBe('click');
    const topRowLocator = steps[1].target.locators[0];
    expect(topRowLocator.strategy).toBe('xpath');
    expect(topRowLocator.value).toContain('Bob Smith');
    expect(topRowLocator.value).toContain('Approve');
    expect(topRowLocator.score).toBeGreaterThanOrEqual(95);

    // Step 3: Dynamic Entropy Input
    expect(steps[2].action).toBe('type');
    expect(steps[2].value).toBe('CC-9900');
    expect(steps[2].target.labelText).toBe('Cost Center Code');
    const dynamicIdCandidate = steps[2].target.locators.find((l) => l.strategy === 'id');
    if (dynamicIdCandidate) {
      expect(dynamicIdCandidate.score).toBeLessThanOrEqual(20);
      expect(dynamicIdCandidate.warning).toBe('dynamic_id');
    }
    const topEntropyLocator = steps[2].target.locators[0];
    expect(topEntropyLocator.value).toContain('Cost Center Code');

    // Step 4: Combobox
    expect(steps[3].action).toBe('click');
    expect(steps[3].target.locators.some((l) => l.value.includes('role="combobox"'))).toBe(true);

    // Step 5: Option
    expect(steps[4].action).toBe('click');
    expect(steps[4].target.locators.some((l) => l.value.includes('Production Blue'))).toBe(true);

    // Step 6: ContentEditable
    expect(steps[5].action).toBe('type');
    expect(steps[5].value).toBe('Release 3.0 Production Deployment Summary');
    expect(steps[5].target.semanticType).toBe('contenteditable');

    // 7. Embedded Payment Iframe
    const paymentIframe = document.getElementById('payment-iframe') as HTMLIFrameElement;
    expect(paymentIframe).not.toBeNull();
    normalizer.recordIframeSwitch(paymentIframe);
    expect(steps[6].action).toBe('switch_iframe');
    expect(steps[6].iframePath).toContain('payment-iframe');

    // Generate Enterprise script and verify locators & iframe switching
    sessionManager.activeTestCase!.settings.codeStyle = 'enterprise';
    const enterpriseCode = generateSeleniumScript(sessionManager.activeTestCase!);
    expect(enterpriseCode).toContain('Bob Smith');
    expect(enterpriseCode).toContain('Cost Center Code');
    expect(enterpriseCode).toContain('Production Blue');
    expect(enterpriseCode).toContain('driver.switch_to.frame');
  });
});

