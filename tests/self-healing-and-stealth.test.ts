import { describe, it, expect } from 'vitest';
import {
  generateSeleniumScript,
  generateSimpleScript,
  generatePytestScript,
  getFallbackLocatorTuples,
} from '../src/generator/python-generator';
import { generatePlaywrightEnterpriseScript } from '../src/generator/playwright-generator';
import { createTestCase, createTestStep } from '../src/types/model';
import { generateLocators } from '../src/content/locator-engine';

describe('Resilience, Performance & Stealth Capabilities', () => {
  describe('Self-Healing Multi-Locator Resilience', () => {
    it('extracts ranked fallback locator tuples with uniqueness guarantee', () => {
      const step = createTestStep({
        stepNumber: 1,
        action: 'click',
        target: {
          tagName: 'button',
          locators: [
            { strategy: 'id', value: 'btn-dynamic-999', isUnique: true, matchCount: 1, score: 95 },
            { strategy: 'data-testid', value: 'login-submit', isUnique: true, matchCount: 1, score: 90 },
            { strategy: 'xpath', value: "//button[normalize-space()='Submit']", isUnique: true, matchCount: 1, score: 85 },
            { strategy: 'css', value: 'button.btn-primary', isUnique: true, matchCount: 1, score: 80 },
          ],
          selectedLocatorIndex: 0,
        },
      });

      const tuples = getFallbackLocatorTuples(step);
      expect(tuples.length).toBeGreaterThanOrEqual(3);
      expect(tuples[0]).toContain('(By.ID, "btn-dynamic-999")');
      expect(tuples[1]).toContain('[data-testid=\\"login-submit\\"]');
      expect(tuples[2]).toContain('//button[normalize-space()=\'Submit\']');
    });

    it('generates self-healing try/except fallback blocks in Enterprise Selenium script', () => {
      const testCase = createTestCase('Resilient Flow', 'https://example.com');
      testCase.settings.codeStyle = 'enterprise';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'click',
          target: {
            tagName: 'button',
            locators: [
              { strategy: 'id', value: 'primary-btn', isUnique: true, matchCount: 1, score: 100 },
              { strategy: 'data-testid', value: 'backup-btn', isUnique: true, matchCount: 1, score: 90 },
              { strategy: 'xpath', value: "//button[contains(., 'Click Me')]", isUnique: true, matchCount: 1, score: 80 },
            ],
            selectedLocatorIndex: 0,
          },
        }),
        createTestStep({
          stepNumber: 2,
          action: 'type',
          target: {
            tagName: 'input',
            locators: [
              { strategy: 'id', value: 'user-field', isUnique: true, matchCount: 1, score: 100 },
              { strategy: 'name', value: 'username', isUnique: true, matchCount: 1, score: 90 },
            ],
            selectedLocatorIndex: 0,
          },
          value: 'test_pilot',
        })
      );

      const code = generateSeleniumScript(testCase);

      // Verify self-healing helper definition
      expect(code).toContain('def find_resilient(d, locators, timeout=10, condition="presence"):');
      expect(code).toContain('[SELF-HEALED]');

      // Verify click step has self-healing fallback
      expect(code).toContain('element = wait.until(EC.element_to_be_clickable((By.ID, "primary-btn")))');
      expect(code).toContain('# Self-Healing Fallback across ranked locators');
      expect(code).toContain('element = find_resilient(driver,');
      expect(code).toContain('(By.CSS_SELECTOR, "[data-testid=\\"backup-btn\\"]")');

      // Verify type step has self-healing fallback
      expect(code).toContain('element = wait.until(EC.visibility_of_element_located((By.ID, "user-field")))');
      expect(code).toContain('condition="visible"');
    });
  });

  describe('Anti-Bot Stealth & Automation Masking', () => {
    it('injects automation controlled flags and CDP navigator.webdriver override in Enterprise mode', () => {
      const testCase = createTestCase('Stealth Test', 'https://protected-site.com');
      testCase.settings.codeStyle = 'enterprise';
      const code = generateSeleniumScript(testCase);

      expect(code).toContain('options.add_argument("--disable-blink-features=AutomationControlled")');
      expect(code).toContain('options.add_experimental_option("excludeSwitches", ["enable-automation"])');
      expect(code).toContain('options.add_experimental_option("useAutomationExtension", False)');
      expect(code).toContain('Page.addScriptToEvaluateOnNewDocument');
      expect(code).toContain("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");
    });

    it('injects stealth flags into Pytest driver fixture', () => {
      const testCase = createTestCase('Stealth Pytest', 'https://protected-site.com');
      testCase.settings.codeStyle = 'pytest';
      const code = generatePytestScript(testCase);

      expect(code).toContain('options.add_argument("--disable-blink-features=AutomationControlled")');
      expect(code).toContain('options.add_experimental_option("excludeSwitches", ["enable-automation"])');
      expect(code).toContain('Page.addScriptToEvaluateOnNewDocument');
    });

    it('injects stealth flags into Playwright Enterprise launch arguments', () => {
      const testCase = createTestCase('Stealth Playwright', 'https://protected-site.com');
      const code = generatePlaywrightEnterpriseScript(testCase);

      expect(code).toContain('args=["--disable-blink-features=AutomationControlled"]');
    });
  });

  describe('Multi-Level Deep Shadow DOM Piercing', () => {
    it('extracts multi-level shadow root hierarchy in locator engine', () => {
      // Mocking nested shadow DOM hierarchy
      const outerHost = document.createElement('app-shell');
      outerHost.id = 'main-shell';
      document.body.appendChild(outerHost);

      const outerShadow = outerHost.attachShadow({ mode: 'open' });
      const innerHost = document.createElement('nav-drawer');
      innerHost.setAttribute('data-testid', 'sidebar-drawer');
      outerShadow.appendChild(innerHost);

      const innerShadow = innerHost.attachShadow({ mode: 'open' });
      const targetBtn = document.createElement('button');
      targetBtn.id = 'logout-btn';
      targetBtn.textContent = 'Sign Out';
      innerShadow.appendChild(targetBtn);

      const candidates = generateLocators(targetBtn, document);
      expect(candidates.length).toBeGreaterThan(0);

      const firstCandidate = candidates[0];
      expect(firstCandidate.isShadowDom).toBe(true);
      expect(firstCandidate.shadowHostPath).toBeDefined();
      expect(firstCandidate.shadowHostPath?.length).toBe(2);
      expect(firstCandidate.shadowHostPath![0]).toContain('app-shell#main-shell');
      expect(firstCandidate.shadowHostPath![1]).toContain('nav-drawer[data-testid="sidebar-drawer"]');
    });

    it('generates recursive shadow DOM traversal in Enterprise Selenium script', () => {
      const testCase = createTestCase('Deep Shadow Test', 'https://example.com');
      testCase.settings.codeStyle = 'enterprise';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'click',
          target: {
            tagName: 'button',
            locators: [{ strategy: 'css', value: '#logout-btn', isUnique: true, matchCount: 1, score: 95 }],
            selectedLocatorIndex: 0,
            isShadowDom: true,
            shadowHostSelector: 'nav-drawer',
            shadowHostPath: ['app-shell#main-shell', 'nav-drawer[data-testid="sidebar-drawer"]'],
            text: 'Sign Out',
          },
        })
      );

      const code = generateSeleniumScript(testCase);
      expect(code).toContain('shadow_host = wait.until(');
      expect(code).toContain('let curr = arguments[0]; const hosts = arguments[3];');
      expect(code).toContain('app-shell#main-shell');
      expect(code).toContain('nav-drawer[data-testid=\\"sidebar-drawer\\"]');
    });
  });

  describe('Page Stabilization & Headless Support', () => {
    it('generates wait_for_page_stable helper in Enterprise Selenium', () => {
      const testCase = createTestCase('Stabilization Test', 'https://example.com');
      testCase.settings.codeStyle = 'enterprise';
      const code = generateSeleniumScript(testCase);

      expect(code).toContain('def wait_for_page_stable(d, timeout=5):');
      expect(code).toContain("document.readyState === 'complete'");
    });

    it('supports HEADLESS env toggle in Simple Selenium script', () => {
      const testCase = createTestCase('Simple Headless Test', 'https://example.com');
      testCase.settings.codeStyle = 'simple';
      const code = generateSimpleScript(testCase);

      expect(code).toContain('is_headless = os.getenv("HEADLESS", "false").lower() == "true"');
      expect(code).toContain('options.add_argument("--headless=new")');
      expect(code).toContain('driver = webdriver.Chrome()');
    });
  });
});
