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
      await sessionManager.addStep(step);
    });
  });

  it('records full user journey and generates valid, verified Python Selenium script', async () => {
    // Step 1: User types username
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    normalizer.recordInput(usernameInput, 'qa_engineer');
    normalizer.flushInput();

    // Step 2: User types sensitive password
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    normalizer.recordInput(passwordInput, 'MyTopSecretP@ss999!');
    normalizer.flushInput();

    // Step 3: User checks "Remember Me"
    const rememberCheckbox = document.getElementById('remember-me') as HTMLInputElement;
    rememberCheckbox.checked = true;
    normalizer.recordClick(rememberCheckbox);

    // Step 4: User clicks button with dynamic ID (should select data-testid or name)
    const dynamicBtn = document.querySelector('[data-testid="sync-now-btn"]') as HTMLButtonElement;
    normalizer.recordClick(dynamicBtn);

    // Step 5: User clicks Submit
    const loginBtn = document.getElementById('login-button') as HTMLButtonElement;
    normalizer.recordClick(loginBtn);

    // Verify Session State
    expect(sessionManager.activeTestCase).not.toBeNull();
    const steps = sessionManager.activeTestCase!.steps;
    expect(steps.length).toBe(5);

    // Verify Step Actions
    expect(steps[0].action).toBe('type');
    expect(steps[0].value).toBe('qa_engineer');

    // Verify Password Masking
    expect(steps[1].action).toBe('type');
    expect(steps[1].isSensitive).toBe(true);
    expect(steps[1].value).toBe('••••••••');
    expect(steps[1].variableName).toBe('TEST_PASSWORD');

    // Verify Checkbox
    expect(steps[2].action).toBe('checkbox');
    expect(steps[2].value).toBe('true');

    // Verify Dynamic ID Demotion
    const step4SelectedLocator = steps[3].target.locators[steps[3].target.selectedLocatorIndex];
    expect(step4SelectedLocator.strategy).not.toBe('id');
    expect(['data-testid', 'name']).toContain(step4SelectedLocator.strategy);

    // Generate Python Selenium Script
    const pythonCode = generateSeleniumScript(sessionManager.activeTestCase!);

    // Revalidation Assertions on the Generated Python Code
    expect(pythonCode).toContain('from selenium import webdriver');
    expect(pythonCode).toContain('from selenium.webdriver.common.by import By');
    expect(pythonCode).toContain('from selenium.webdriver.support.ui import WebDriverWait');
    expect(pythonCode).toContain('from selenium.webdriver.support import expected_conditions as EC');
    expect(pythonCode).toContain('import os');

    // Verify Password never appears in generated code
    expect(pythonCode).not.toContain('MyTopSecretP@ss999!');
    expect(pythonCode).not.toContain('••••••••');
    expect(pythonCode).toContain('TEST_PASSWORD = os.getenv("TEST_PASSWORD", "CHANGE_ME")');
    expect(pythonCode).toContain('.send_keys(TEST_PASSWORD)');

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
  });
});
