import { TestStep, createTestStep } from '../types/model';
import { generateLocators, detectFieldSemantics } from './locator-engine';

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
    const semantics = detectFieldSemantics(element);

    let action: TestStep['action'] = 'click';
    let value: string | undefined;

    if (tagName === 'input') {
      const input = element as HTMLInputElement;
      const type = (input.type || 'text').toLowerCase();

      if (type === 'checkbox') {
        action = 'checkbox';
        value = input.checked ? 'true' : 'false';
      } else if (type === 'radio') {
        action = 'radio';
        value = input.value;
      } else if (['text', 'email', 'password', 'tel', 'number', 'search', 'url', 'date'].includes(type)) {
        // Clicking an editable input buffers it so it captures either typed or smart prefill
        this.recordInput(input, input.value);
        return;
      }
    } else if (tagName === 'textarea') {
      this.recordInput(element as HTMLTextAreaElement, (element as HTMLTextAreaElement).value);
      return;
    }

    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action,
      target: {
        tagName,
        locators,
        selectedLocatorIndex: 0,
        text: (element.textContent || '').trim().substring(0, 50),
        semanticType: semantics.semanticType,
        labelText: semantics.labelText,
        shadowHostSelector,
        isShadowDom: isInsideShadow,
      },
      value,
      waitCondition: 'clickable',
    });

    this.onStep(step);
  }

  public recordSelect(element: HTMLSelectElement): void {
    this.flushInput();
    const tagName = 'select';
    const locators = generateLocators(element);
    const semantics = detectFieldSemantics(element);

    const selectedOption = element.options[element.selectedIndex];
    const value = selectedOption ? (selectedOption.text.trim() || selectedOption.value) : element.value;

    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'select',
      target: {
        tagName,
        locators,
        selectedLocatorIndex: 0,
        text: (element.textContent || '').trim().substring(0, 50),
        semanticType: 'dropdown',
        labelText: semantics.labelText,
        shadowHostSelector,
        isShadowDom: isInsideShadow,
      },
      value,
      waitCondition: 'presence',
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

    const tagName = element.tagName.toLowerCase();
    const locators = generateLocators(element);
    const semantics = detectFieldSemantics(element);
    const isSensitive = semantics.semanticType === 'password' || this.detectSensitiveField(element);

    // If user clicked but left empty, use smart semantic default value
    const effectiveValue = (value && value.trim()) ? value : semantics.defaultValue;

    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'type',
      target: {
        tagName,
        locators,
        selectedLocatorIndex: 0,
        isSensitive,
        semanticType: semantics.semanticType,
        labelText: semantics.labelText,
        shadowHostSelector,
        isShadowDom: isInsideShadow,
      },
      value: isSensitive ? '••••••••' : effectiveValue,
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
