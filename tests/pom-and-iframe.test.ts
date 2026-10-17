import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCase, createTestStep, TestCaseModel } from '../src/types/model';
import { generateSeleniumScript, generatePomScript } from '../src/generator/python-generator';
import { generatePlaywrightScript, generatePlaywrightPomScript } from '../src/generator/playwright-generator';
import { detectIframeLocator } from '../src/content/locator-engine';
import { ActionNormalizer } from '../src/content/action-normalizer';
import { SessionManager } from '../src/background/session-manager';

class MemoryStorageAdapter {
  private store = new Map<string, any>();
  async get<T>(key: string): Promise<T | null> {
    return this.store.get(key) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async clear(): Promise<void> {
    this.store.clear();
  }
}

describe('Iframe Detection Engine', () => {
  it('returns undefined when window is top-level (window.self === window.top)', () => {
    const mockTopWindow = {
      self: {} as any,
      top: {} as any,
    };
    mockTopWindow.self = mockTopWindow;
    mockTopWindow.top = mockTopWindow;

    const result = detectIframeLocator(mockTopWindow as any);
    expect(result).toBeUndefined();
  });

  it('detects iframe with stable ID', () => {
    const mockFrameEl = {
      tagName: 'IFRAME',
      id: 'checkout-frame',
      getAttribute: (attr: string) => (attr === 'id' ? 'checkout-frame' : null),
      querySelectorAll: () => [],
    };
    const mockWindow = {
      self: {} as any,
      top: {} as any,
      frameElement: mockFrameEl,
    };
    mockWindow.self = mockWindow;

    const result = detectIframeLocator(mockWindow as any);
    expect(result).toBe('#checkout-frame');
  });

  it('detects iframe with data-testid attribute', () => {
    const mockFrameEl = {
      tagName: 'IFRAME',
      id: '',
      getAttribute: (attr: string) => (attr === 'data-testid' ? 'stripe-payment-frame' : null),
      querySelectorAll: () => [],
    };
    const mockWindow = {
      self: {} as any,
      top: {} as any,
      frameElement: mockFrameEl,
    };
    mockWindow.self = mockWindow;

    const result = detectIframeLocator(mockWindow as any);
    expect(result).toBe('iframe[data-testid="stripe-payment-frame"]');
  });

  it('detects iframe with name attribute', () => {
    const mockFrameEl = {
      tagName: 'IFRAME',
      id: '',
      getAttribute: (attr: string) => (attr === 'name' ? 'embedded-app' : null),
      querySelectorAll: () => [],
    };
    const mockWindow = {
      self: {} as any,
      top: {} as any,
      frameElement: mockFrameEl,
    };
    mockWindow.self = mockWindow;

    const result = detectIframeLocator(mockWindow as any);
    expect(result).toBe('iframe[name="embedded-app"]');
  });

  it('falls back to window.name or pathname when cross-origin frameElement is blocked', () => {
    const mockWindow = {
      self: {} as any,
      top: {} as any,
      get frameElement() {
        throw new Error('SecurityError: Blocked a frame with origin from accessing a cross-origin frame.');
      },
      name: 'cross-origin-frame',
    };
    mockWindow.self = mockWindow;

    const result = detectIframeLocator(mockWindow as any);
    expect(result).toBe('iframe[name="cross-origin-frame"]');
  });
});

describe('ActionNormalizer with Iframe Detection', () => {
  it('automatically sets step.iframePath when inside an iframe', () => {
    const recordedSteps: any[] = [];
    const normalizer = new ActionNormalizer(
      (step) => recordedSteps.push(step),
      () => '#sub-frame'
    );

    const btn = document.createElement('button');
    btn.id = 'submit-btn';
    btn.textContent = 'Submit';
    document.body.appendChild(btn);

    normalizer.recordClick(btn);

    expect(recordedSteps.length).toBe(1);
    expect(recordedSteps[0].iframePath).toBe('#sub-frame');
    expect(recordedSteps[0].target.locators[0].value).toBe('submit-btn');

    btn.remove();
  });

  it('leaves step.iframePath undefined when on top-level page', () => {
    const recordedSteps: any[] = [];
    const normalizer = new ActionNormalizer(
      (step) => recordedSteps.push(step),
      () => undefined
    );

    const input = document.createElement('input');
    input.id = 'user-input';
    document.body.appendChild(input);

    normalizer.recordInput(input, 'test-user');
    normalizer.flushInput();

    expect(recordedSteps.length).toBe(1);
    expect(recordedSteps[0].iframePath).toBeUndefined();

    input.remove();
  });
});

describe('Python Page Object Model (POM) Generator', () => {
  let testCase: TestCaseModel;

  beforeEach(() => {
    testCase = createTestCase('User Login Flow', 'https://example.com/login');
    testCase.settings.codeStyle = 'pom';

    testCase.steps.push(
      createTestStep({
        stepNumber: 1,
        action: 'type',
        target: {
          tagName: 'input',
          locators: [{ strategy: 'id', value: 'username', isUnique: true, matchCount: 1, score: 100 }],
          selectedLocatorIndex: 0,
          text: 'Username',
        },
        value: 'testadmin',
      }),
      createTestStep({
        stepNumber: 2,
        action: 'click',
        target: {
          tagName: 'button',
          locators: [{ strategy: 'css', value: 'button[type="submit"]', isUnique: true, matchCount: 1, score: 95 }],
          selectedLocatorIndex: 0,
          text: 'Login',
        },
      }),
      createTestStep({
        stepNumber: 3,
        action: 'assert_visible',
        target: {
          tagName: 'div',
          locators: [{ strategy: 'id', value: 'welcome-banner', isUnique: true, matchCount: 1, score: 90 }],
          selectedLocatorIndex: 0,
          text: 'Welcome',
        },
      })
    );
  });

  it('generates a clean Page Object class with class-level locators and action methods', () => {
    const code = generatePomScript(testCase);

    expect(code).toContain('class UserLoginFlowPage:');
    expect(code).toContain('LOCATOR_STEP_1 = (By.ID, "username")');
    expect(code).toContain('LOCATOR_STEP_2 = (By.CSS_SELECTOR, "button[type=\\"submit\\"]")');
    expect(code).toContain('def __init__(self, driver, timeout=10):');
    expect(code).toContain('def open(self, url="https://example.com/login"):');
    expect(code).toContain('def step_1_type_');
    expect(code).toContain('def step_2_click_');
    expect(code).toContain('def step_3_assert_visible_');
    expect(code).toContain('def run_test():');
    expect(code).toContain('page = UserLoginFlowPage(driver');
    expect(code).toContain('page.open()');
    expect(code).toContain('page.step_1_type_');
  });

  it('generates POM script through main generateSeleniumScript dispatcher', () => {
    const code = generateSeleniumScript(testCase);
    expect(code).toContain('class UserLoginFlowPage:');
  });

  it('handles steps inside iframes within the Page Object Model', () => {
    testCase.steps[1].iframePath = '#payment-iframe';
    const code = generatePomScript(testCase);

    expect(code).toContain('def _ensure_frame(self, frame_selector=None):');
    expect(code).toContain('self._ensure_frame("#payment-iframe")');
  });
});

describe('Selenium Iframe Context Switching', () => {
  let iframeTestCase: TestCaseModel;

  beforeEach(() => {
    iframeTestCase = createTestCase('Iframe Flow Test', 'https://example.com');
    iframeTestCase.steps.push(
      // Step 1: Main page
      createTestStep({
        stepNumber: 1,
        action: 'click',
        target: {
          tagName: 'button',
          locators: [{ strategy: 'id', value: 'open-dialog', isUnique: true, matchCount: 1, score: 90 }],
          selectedLocatorIndex: 0,
        },
      }),
      // Step 2: Inside iframe
      createTestStep({
        stepNumber: 2,
        action: 'type',
        iframePath: '#dialog-frame',
        target: {
          tagName: 'input',
          locators: [{ strategy: 'id', value: 'card-number', isUnique: true, matchCount: 1, score: 90 }],
          selectedLocatorIndex: 0,
        },
        value: '4111222233334444',
      }),
      // Step 3: Back on main page
      createTestStep({
        stepNumber: 3,
        action: 'click',
        target: {
          tagName: 'button',
          locators: [{ strategy: 'id', value: 'confirm-order', isUnique: true, matchCount: 1, score: 90 }],
          selectedLocatorIndex: 0,
        },
      })
    );
  });

  it('emits switch_to.frame and switch_to.default_content in Simple script', () => {
    iframeTestCase.settings.codeStyle = 'simple';
    const code = generateSeleniumScript(iframeTestCase);

    expect(code).toContain('driver.switch_to.frame(find(driver, By.CSS_SELECTOR, "#dialog-frame"))');
    expect(code).toContain('driver.switch_to.default_content()');
  });

  it('emits switch_to.frame and switch_to.default_content in Enterprise script', () => {
    iframeTestCase.settings.codeStyle = 'enterprise';
    const code = generateSeleniumScript(iframeTestCase);

    expect(code).toContain('driver.switch_to.frame(iframe_elem)');
    expect(code).toContain('driver.switch_to.default_content()');
  });

  it('emits switch_to.frame and switch_to.default_content in Pytest script', () => {
    iframeTestCase.settings.codeStyle = 'pytest';
    const code = generateSeleniumScript(iframeTestCase);

    expect(code).toContain('driver.switch_to.frame(wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#dialog-frame"))))');
    expect(code).toContain('driver.switch_to.default_content()');
  });
});

describe('Playwright POM and Iframe Code Generation', () => {
  let pwTestCase: TestCaseModel;

  beforeEach(() => {
    pwTestCase = createTestCase('Playwright Checkout', 'https://shop.example.com');
    pwTestCase.settings.engine = 'playwright';
    pwTestCase.settings.codeStyle = 'pom';

    pwTestCase.steps.push(
      createTestStep({
        stepNumber: 1,
        action: 'type',
        target: {
          tagName: 'input',
          locators: [{ strategy: 'id', value: 'search', isUnique: true, matchCount: 1, score: 90 }],
          selectedLocatorIndex: 0,
        },
        value: 'laptop',
      }),
      createTestStep({
        stepNumber: 2,
        action: 'click',
        iframePath: '#cart-iframe',
        target: {
          tagName: 'button',
          locators: [{ strategy: 'css', value: '.checkout-btn', isUnique: true, matchCount: 1, score: 90 }],
          selectedLocatorIndex: 0,
        },
      })
    );
  });

  it('generates a clean Playwright POM class and test runner', () => {
    const code = generatePlaywrightPomScript(pwTestCase);

    expect(code).toContain('class PlaywrightCheckoutPage:');
    expect(code).toContain('def __init__(self, page: Page):');
    expect(code).toContain('def open(self, url="https://shop.example.com"):');
    expect(code).toContain('def step_1_type_');
    expect(code).toContain('def step_2_click_');
    expect(code).toContain('self.page.frame_locator("#cart-iframe").locator(".checkout-btn").click()');
    expect(code).toContain('def run_test():');
    expect(code).toContain('app = PlaywrightCheckoutPage(page)');
  });

  it('routes to Playwright POM through generatePlaywrightScript dispatcher', () => {
    const code = generatePlaywrightScript(pwTestCase);
    expect(code).toContain('class PlaywrightCheckoutPage:');
  });

  it('emits page.frame_locator in Playwright simple, enterprise, and pytest scripts', () => {
    pwTestCase.settings.codeStyle = 'simple';
    const simpleCode = generatePlaywrightScript(pwTestCase);
    expect(simpleCode).toContain('page.frame_locator("#cart-iframe").locator(".checkout-btn").click()');

    pwTestCase.settings.codeStyle = 'enterprise';
    const entCode = generatePlaywrightScript(pwTestCase);
    expect(entCode).toContain('page.frame_locator("#cart-iframe").locator(".checkout-btn").click()');

    pwTestCase.settings.codeStyle = 'pytest';
    const pytestCode = generatePlaywrightScript(pwTestCase);
    expect(pytestCode).toContain('page.frame_locator("#cart-iframe").locator(".checkout-btn").click()');
  });
});

describe('SessionManager JSON Load and Export', () => {
  it('loads test case session state and updates subscribers', async () => {
    const storage = new MemoryStorageAdapter();
    const manager = new SessionManager(storage);

    let notifyCalls = 0;
    manager.subscribe(() => {
      notifyCalls++;
    });

    const mockTestCase = createTestCase('Imported Session', 'https://imported.example.com');
    mockTestCase.steps.push(
      createTestStep({
        stepNumber: 1,
        action: 'click',
        target: { tagName: 'button', locators: [{ strategy: 'id', value: 'btn-1', isUnique: true, matchCount: 1, score: 90 }], selectedLocatorIndex: 0 },
      })
    );

    await manager.loadTestCase(mockTestCase);

    expect(manager.isRecording).toBe(false);
    expect(manager.activeTestCase).not.toBeNull();
    expect(manager.activeTestCase?.name).toBe('Imported Session');
    expect(manager.activeTestCase?.steps.length).toBe(1);
    expect(notifyCalls).toBeGreaterThan(0);

    // Verify persistence
    const saved = await storage.get<{ activeTestCase: TestCaseModel }>('sessionState');
    expect(saved?.activeTestCase?.name).toBe('Imported Session');
  });

  it('supports round-trip JSON serialization and deserialization', async () => {
    const original = createTestCase('Full Roundtrip Test', 'https://test.com');
    original.settings.codeStyle = 'pom';
    original.settings.engine = 'playwright';
    original.steps.push(
      createTestStep({
        stepNumber: 1,
        action: 'click',
        iframePath: '#main-frame',
        target: {
          tagName: 'button',
          locators: [{ strategy: 'data-testid', value: 'submit-action', isUnique: true, matchCount: 1, score: 95 }],
          selectedLocatorIndex: 0,
        },
      })
    );

    const jsonString = JSON.stringify(original, null, 2);
    const parsed: TestCaseModel = JSON.parse(jsonString);

    expect(parsed.id).toBe(original.id);
    expect(parsed.settings.codeStyle).toBe('pom');
    expect(parsed.settings.engine).toBe('playwright');
    expect(parsed.steps[0].iframePath).toBe('#main-frame');
    expect(parsed.steps[0].target.locators[0].value).toBe('submit-action');
  });
});
