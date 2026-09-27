import { TestStep, createTestStep } from '../types/model';
import { generateLocators } from './locator-engine';

interface InputBuffer {
  element: HTMLInputElement | HTMLTextAreaElement;
  value: string;
  timestamp: number;
}

export class ActionNormalizer {
  private onStep: (step: TestStep) => void;
  private stepCounter = 1;
  private lastClickElement: HTMLElement | null = null;
  private lastClickTime = 0;
  private currentInputBuffer: InputBuffer | null = null;

  constructor(onStep: (step: TestStep) => void) {
    this.onStep = onStep;
  }

  public recordClick(element: HTMLElement): void {
    // 1. Flush any pending typing actions before recording click
    this.flushInput();

    // 2. Debounce duplicate clicks on identical element within 300ms
    const now = Date.now();
    if (this.lastClickElement === element && now - this.lastClickTime < 300) {
      return;
    }
    this.lastClickElement = element;
    this.lastClickTime = now;

    const tagName = element.tagName.toLowerCase();
    const locators = generateLocators(element);

    let action: TestStep['action'] = 'click';
    let value: string | undefined;

    if (tagName === 'input') {
      const input = element as HTMLInputElement;
      if (input.type === 'checkbox') {
        action = 'checkbox';
        value = input.checked ? 'true' : 'false';
      } else if (input.type === 'radio') {
        action = 'radio';
        value = input.value;
      }
    }

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action,
      target: {
        tagName,
        locators,
        selectedLocatorIndex: 0,
        text: (element.textContent || '').trim().substring(0, 50),
      },
      value,
      waitCondition: 'clickable',
    });

    this.onStep(step);
  }

  public recordInput(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    this.currentInputBuffer = {
      element,
      value,
      timestamp: Date.now(),
    };
  }

  public flushInput(): void {
    if (!this.currentInputBuffer) return;

    const { element, value } = this.currentInputBuffer;
    this.currentInputBuffer = null;

    if (!value && value !== '') return;

    const tagName = element.tagName.toLowerCase();
    const locators = generateLocators(element);
    const isSensitive = this.detectSensitiveField(element);

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'type',
      target: {
        tagName,
        locators,
        selectedLocatorIndex: 0,
        isSensitive,
      },
      value: isSensitive ? '••••••••' : value,
      isSensitive,
      variableName: isSensitive ? this.deriveVariableName(element) : undefined,
      waitCondition: 'visible',
    });

    this.onStep(step);
  }

  private detectSensitiveField(element: HTMLInputElement | HTMLTextAreaElement): boolean {
    if (element instanceof HTMLInputElement && element.type === 'password') {
      return true;
    }
    const name = (element.getAttribute('name') || '').toLowerCase();
    const id = (element.getAttribute('id') || '').toLowerCase();
    const sensitiveKeywords = ['password', 'passwd', 'token', 'cvv', 'otp', 'secret', 'creditcard'];
    return sensitiveKeywords.some((kw) => name.includes(kw) || id.includes(kw));
  }

  private deriveVariableName(element: HTMLElement): string {
    const id = (element.getAttribute('id') || '').toLowerCase();
    const name = (element.getAttribute('name') || '').toLowerCase();

    if (id.includes('pass') || name.includes('pass')) return 'TEST_PASSWORD';
    if (id.includes('token') || name.includes('token')) return 'TEST_TOKEN';
    if (id.includes('otp') || name.includes('otp')) return 'TEST_OTP';
    return 'TEST_SECRET';
  }
}
