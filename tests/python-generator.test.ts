import { describe, it, expect } from 'vitest';
import {
  generateSeleniumScript,
  generateSimpleScript,
  generatePytestScript,
} from '../src/generator/python-generator';
import { createTestCase, createTestStep } from '../src/types/model';

describe('Python Selenium Code Generator', () => {
  describe('Enterprise Mode', () => {
    it('generates a complete, flake-free Selenium script with explicit waits', () => {
      const testCase = createTestCase('Login Test', 'https://example.com/login');
      testCase.settings.codeStyle = 'enterprise';
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
      testCase.settings.codeStyle = 'enterprise';
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
      testCase.settings.codeStyle = 'enterprise';
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

    it('generates Select dropdown interaction code with Select import', () => {
      const testCase = createTestCase('Dropdown Test', 'https://example.com/form');
      testCase.settings.codeStyle = 'enterprise';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'select',
          target: {
            tagName: 'select',
            locators: [{ strategy: 'id', value: 'country-select', isUnique: true, matchCount: 1, score: 100 }],
            selectedLocatorIndex: 0,
            labelText: 'Country of Residence',
          },
          value: 'Germany',
          waitCondition: 'presence',
        })
      );

      const code = generateSeleniumScript(testCase);

      expect(code).toContain('from selenium.webdriver.support.ui import Select');
      expect(code).toContain('select_elem = Select(wait.until(');
      expect(code).toContain('EC.presence_of_element_located((By.ID, "country-select"))');
      expect(code).toContain('select_elem.select_by_visible_text("Germany")');
      expect(code).toContain('# Step 1: Select "Germany" from "Country of Residence"');
    });

    it('generates scrollIntoView script before interactions for flake-free clicks on long pages', () => {
      const testCase = createTestCase('Scroll Click Test', 'https://example.com');
      testCase.settings.codeStyle = 'enterprise';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'click',
          target: {
            tagName: 'button',
            locators: [{ strategy: 'id', value: 'deep-footer-btn', isUnique: true, matchCount: 1, score: 100 }],
            selectedLocatorIndex: 0,
            text: 'Subscribe',
          },
          waitCondition: 'clickable',
        })
      );

      const code = generateSeleniumScript(testCase);

      expect(code).toContain('scrollIntoView({block: \'center\'');
      expect(code).toContain('element.click()');
    });
  });

  describe('Simple Mode', () => {
    it('generates minimal, runnable Python with find() helper function', () => {
      const testCase = createTestCase('Simple Login', 'https://example.com/login');
      testCase.settings.codeStyle = 'simple';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'type',
          target: {
            tagName: 'input',
            locators: [{ strategy: 'id', value: 'username', isUnique: true, matchCount: 1, score: 100 }],
            selectedLocatorIndex: 0,
            labelText: 'Username',
            componentType: 'input',
          },
          value: 'jane_doe',
        }),
        createTestStep({
          stepNumber: 2,
          action: 'click',
          target: {
            tagName: 'button',
            locators: [{ strategy: 'css', value: 'button[type="submit"]', isUnique: true, matchCount: 1, score: 90 }],
            selectedLocatorIndex: 0,
            text: 'Sign In',
            componentType: 'button',
          },
        })
      );

      const code = generateSimpleScript(testCase);

      expect(code).toContain('def find(driver, by, value, timeout=10):');
      expect(code).toContain('driver = webdriver.Chrome()');
      expect(code).toContain('driver.maximize_window()');
      expect(code).toContain('find(driver, *(By.ID, "username"))');
      expect(code).toContain('click(driver, *(By.CSS_SELECTOR, "button[type=\\"submit\\"]"))');
      expect(code).toContain('finally:');
      expect(code).toContain('driver.quit()');
      expect(code).toContain('# Step 1: Type into "Username" in INPUT');
      expect(code).toContain('# Step 2: Click "Sign In" in BUTTON');
    });

    it('generates assertions for assert_visible and assert_text in Simple mode', () => {
      const testCase = createTestCase('Assertion Flow', 'https://example.com');
      testCase.settings.codeStyle = 'simple';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'assert_visible',
          target: {
            tagName: 'div',
            locators: [{ strategy: 'css', value: '.welcome-banner', isUnique: true, matchCount: 1, score: 90 }],
            selectedLocatorIndex: 0,
            componentType: 'card',
          },
        }),
        createTestStep({
          stepNumber: 2,
          action: 'assert_text',
          target: {
            tagName: 'h1',
            locators: [{ strategy: 'css', value: 'h1.title', isUnique: true, matchCount: 1, score: 90 }],
            selectedLocatorIndex: 0,
            componentType: 'header',
          },
          assertExpected: 'Dashboard Overview',
        })
      );

      const code = generateSimpleScript(testCase);

      expect(code).toContain('assert find(driver, *(By.CSS_SELECTOR, ".welcome-banner")).is_displayed()');
      expect(code).toContain('assert "Dashboard Overview" in find(driver, *(By.CSS_SELECTOR, "h1.title")).text');
    });

    it('generates print_value extraction and print statement in Simple mode', () => {
      const testCase = createTestCase('Extract Data', 'https://example.com');
      testCase.settings.codeStyle = 'simple';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'print_value',
          target: {
            tagName: 'h2',
            locators: [{ strategy: 'xpath', value: '//h2', isUnique: true, matchCount: 1, score: 90 }],
            selectedLocatorIndex: 0,
            text: 'User Summary',
            componentType: 'header',
          },
        })
      );

      const code = generateSimpleScript(testCase);
      expect(code).toContain('val = el.get_attribute("value") if el.tag_name in ["input", "textarea", "select"] else el.text');
      expect(code).toContain('print(f"[EXTRACTED] User Summary: {val}")');
    });

    it('generates ActionChains for hover action', () => {
      const testCase = createTestCase('Hover Menu', 'https://example.com');
      testCase.settings.codeStyle = 'simple';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'hover',
          target: {
            tagName: 'a',
            locators: [{ strategy: 'css', value: '.nav-dropdown-toggle', isUnique: true, matchCount: 1, score: 90 }],
            selectedLocatorIndex: 0,
            componentType: 'navbar',
          },
        })
      );

      const code = generateSimpleScript(testCase);

      expect(code).toContain('from selenium.webdriver.common.action_chains import ActionChains');
      expect(code).toContain('ActionChains(driver).move_to_element(find(driver, *(By.CSS_SELECTOR, ".nav-dropdown-toggle"))).perform()');
    });

    it('generates Keys for press_key action', () => {
      const testCase = createTestCase('Keyboard Enter', 'https://example.com');
      testCase.settings.codeStyle = 'simple';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'press_key',
          target: {
            tagName: 'input',
            locators: [{ strategy: 'id', value: 'search', isUnique: true, matchCount: 1, score: 90 }],
            selectedLocatorIndex: 0,
          },
          keyCombo: 'Enter',
        })
      );

      const code = generateSimpleScript(testCase);

      expect(code).toContain('from selenium.webdriver.common.keys import Keys');
      expect(code).toContain('find(driver, *(By.ID, "search")).send_keys(Keys.ENTER)');
    });
  });

  describe('Pytest Mode', () => {
    it('generates Pytest fixtures and def test_* function', () => {
      const testCase = createTestCase('Shopping Cart Flow', 'https://example.com/shop');
      testCase.settings.codeStyle = 'pytest';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'click',
          target: {
            tagName: 'button',
            locators: [{ strategy: 'id', value: 'add-to-cart', isUnique: true, matchCount: 1, score: 95 }],
            selectedLocatorIndex: 0,
            text: 'Add to Cart',
            componentType: 'button',
          },
        }),
        createTestStep({
          stepNumber: 2,
          action: 'assert_visible',
          target: {
            tagName: 'div',
            locators: [{ strategy: 'css', value: '.cart-count', isUnique: true, matchCount: 1, score: 90 }],
            selectedLocatorIndex: 0,
            componentType: 'navbar',
          },
        })
      );

      const code = generatePytestScript(testCase);

      expect(code).toContain('import pytest');
      expect(code).toContain('@pytest.fixture');
      expect(code).toContain('def driver():');
      expect(code).toContain('def wait(driver):');
      expect(code).toContain('def test_shopping_cart_flow(driver, wait):');
      expect(code).toContain('wait.until(EC.element_to_be_clickable((By.ID, "add-to-cart"))).click()');
      expect(code).toContain('assert wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".cart-count"))).is_displayed()');
    });
  });
});
