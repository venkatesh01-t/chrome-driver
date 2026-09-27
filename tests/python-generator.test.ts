import { describe, it, expect } from 'vitest';
import { generateSeleniumScript } from '../src/generator/python-generator';
import { createTestCase, createTestStep } from '../src/types/model';

describe('Python Selenium Code Generator', () => {
  it('generates a complete, flake-free Selenium script with explicit waits', () => {
    const testCase = createTestCase('Login Test', 'https://example.com/login');
    testCase.steps.push(
      createTestStep({
        stepNumber: 1,
        action: 'type',
        target: {
          tagName: 'input',
          locators: [{ strategy: 'id', value: 'username', isUnique: true, matchCount: 1, score: 100 }],
          selectedLocatorIndex: 0,
        },
        value: 'test_user',
        waitCondition: 'visible',
      }),
      createTestStep({
        stepNumber: 2,
        action: 'click',
        target: {
          tagName: 'button',
          locators: [{ strategy: 'css', value: 'button[type="submit"]', isUnique: true, matchCount: 1, score: 85 }],
          selectedLocatorIndex: 0,
        },
        waitCondition: 'clickable',
      })
    );

    const code = generateSeleniumScript(testCase);

    // Verify core imports
    expect(code).toContain('from selenium import webdriver');
    expect(code).toContain('from selenium.webdriver.common.by import By');
    expect(code).toContain('from selenium.webdriver.support.ui import WebDriverWait');
    expect(code).toContain('from selenium.webdriver.support import expected_conditions as EC');

    // Verify driver setup and navigation
    expect(code).toContain('driver = webdriver.Chrome(options=options)');
    expect(code).toContain('driver.get("https://example.com/login")');

    // Verify explicit waits without any time.sleep
    expect(code).toContain('EC.visibility_of_element_located((By.ID, "username"))');
    expect(code).toContain('.clear()');
    expect(code).toContain('.send_keys("test_user")');

    expect(code).toContain('EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type=\\"submit\\"]"))');
    expect(code).toContain('.click()');

    // Verify strict policy: NEVER time.sleep
    expect(code).not.toContain('time.sleep');

    // Verify cleanup
    expect(code).toContain('driver.quit()');
  });

  it('safely parameterizes sensitive fields using os.getenv without exposing secrets', () => {
    const testCase = createTestCase('Secure Login', 'https://example.com/login');
    testCase.steps.push(
      createTestStep({
        stepNumber: 1,
        action: 'type',
        target: {
          tagName: 'input',
          locators: [{ strategy: 'name', value: 'password', isUnique: true, matchCount: 1, score: 90 }],
          selectedLocatorIndex: 0,
          isSensitive: true,
        },
        value: '••••••••',
        isSensitive: true,
        variableName: 'TEST_PASSWORD',
        waitCondition: 'visible',
      })
    );

    const code = generateSeleniumScript(testCase);

    expect(code).toContain('import os');
    expect(code).toContain('TEST_PASSWORD = os.getenv("TEST_PASSWORD"');
    expect(code).toContain('.send_keys(TEST_PASSWORD)');
    expect(code).not.toContain('••••••••');
  });

  it('generates state-aware code for checkboxes', () => {
    const testCase = createTestCase('Checkbox Test', 'https://example.com');
    testCase.steps.push(
      createTestStep({
        stepNumber: 1,
        action: 'checkbox',
        target: {
          tagName: 'input',
          locators: [{ strategy: 'id', value: 'agree-terms', isUnique: true, matchCount: 1, score: 100 }],
          selectedLocatorIndex: 0,
        },
        value: 'true',
        waitCondition: 'clickable',
      })
    );

    const code = generateSeleniumScript(testCase);

    expect(code).toContain('checkbox = wait.until(');
    expect(code).toContain('if not checkbox.is_selected():');
    expect(code).toContain('checkbox.click()');
  });
});
