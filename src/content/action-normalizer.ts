import { TestStep, createTestStep } from '../types/model';
import { generateLocators, detectFieldSemantics } from './locator-engine';
import { classifyComponent } from './component-classifier';

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
  private lastTypedElement: HTMLElement | null = null;

  constructor(onStep: (step: TestStep) => void) {
    this.onStep = onStep;
  }

  public recordClick(element: HTMLElement): void {
    // 1. Flush any pending typing actions before recording click
    this.flushInput();

    // 2. Debounce duplicate clicks on identical element within 300ms or on element just typed into
    const now = Date.now();
    if (this.lastClickElement === element && now - this.lastClickTime < 300) {
      return;
    }
    if (this.lastTypedElement === element) {
      this.lastTypedElement = null;
      return;
    }
    this.lastTypedElement = null;
    this.lastClickElement = element;
    this.lastClickTime = now;

    const tagName = element.tagName.toLowerCase();
    const locators = generateLocators(element);
    const semantics = detectFieldSemantics(element);
    const component = classifyComponent(element);

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
      } else if (type === 'file') {
        this.recordFileUpload(input);
        return;
      } else if (['text', 'email', 'password', 'tel', 'number', 'search', 'url', 'date', 'range'].includes(type)) {
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
    const shadowHostPath = locators.find((l) => l.shadowHostPath)?.shadowHostPath;

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
        shadowHostPath,
        isShadowDom: isInsideShadow,
        componentType: component.type,
        componentHierarchy: component.hierarchy,
        dataFeedType: component.dataFeed,
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
    const component = classifyComponent(element);

    const selectedOption = element.options[element.selectedIndex];
    const value = selectedOption ? (selectedOption.text.trim() || selectedOption.value) : element.value;

    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;
    const shadowHostPath = locators.find((l) => l.shadowHostPath)?.shadowHostPath;

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
        shadowHostPath,
        isShadowDom: isInsideShadow,
        componentType: component.type,
        componentHierarchy: component.hierarchy,
        dataFeedType: component.dataFeed,
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
    const component = classifyComponent(element);
    const isSensitive = semantics.semanticType === 'password' || this.detectSensitiveField(element);

    // If user clicked but left empty, use smart semantic default value
    const effectiveValue = (value && value.trim()) ? value : semantics.defaultValue;

    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;
    const shadowHostPath = locators.find((l) => l.shadowHostPath)?.shadowHostPath;

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
        shadowHostPath,
        isShadowDom: isInsideShadow,
        componentType: component.type,
        componentHierarchy: component.hierarchy,
        dataFeedType: component.dataFeed,
      },
      value: isSensitive ? '••••••••' : effectiveValue,
      isSensitive,
      variableName: isSensitive ? this.deriveVariableName(element) : undefined,
      waitCondition: 'visible',
    });

    this.lastTypedElement = element;
    this.onStep(step);
  }

  public recordAssertion(element: HTMLElement, assertType: 'assert_visible' | 'assert_text' | 'assert_attribute', attributeName?: string): void {
    this.flushInput();
    const locators = generateLocators(element);
    const component = classifyComponent(element);
    const text = (element.textContent || '').trim().substring(0, 100);
    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;
    const shadowHostPath = locators.find((l) => l.shadowHostPath)?.shadowHostPath;

    let assertExpected = text;
    if (assertType === 'assert_attribute' && attributeName) {
      assertExpected = element.getAttribute(attributeName) || '';
    }

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: assertType,
      target: {
        tagName: element.tagName.toLowerCase(),
        locators,
        selectedLocatorIndex: 0,
        text,
        shadowHostSelector,
        shadowHostPath,
        isShadowDom: isInsideShadow,
        componentType: component.type,
        componentHierarchy: component.hierarchy,
      },
      assertExpected,
      assertAttribute: attributeName,
      waitCondition: 'visible',
    });

    this.onStep(step);
  }

  public recordPrintValue(element: HTMLElement): void {
    this.flushInput();
    const locators = generateLocators(element);
    const component = classifyComponent(element);
    const tagName = element.tagName.toLowerCase();

    let extractedValue = (element.textContent || '').trim().substring(0, 100);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      extractedValue = element.value;
    } else if (element instanceof HTMLSelectElement) {
      const selectedOption = element.options[element.selectedIndex];
      extractedValue = selectedOption ? (selectedOption.text.trim() || selectedOption.value) : element.value;
    }

    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;
    const shadowHostPath = locators.find((l) => l.shadowHostPath)?.shadowHostPath;

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'print_value',
      target: {
        tagName,
        locators,
        selectedLocatorIndex: 0,
        text: (element.textContent || '').trim().substring(0, 50),
        shadowHostSelector,
        shadowHostPath,
        isShadowDom: isInsideShadow,
        componentType: component.type,
        componentHierarchy: component.hierarchy,
      },
      value: extractedValue,
      waitCondition: 'visible',
    });

    this.onStep(step);
  }

  public recordHover(element: HTMLElement): void {
    this.flushInput();
    const locators = generateLocators(element);
    const component = classifyComponent(element);
    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;
    const shadowHostPath = locators.find((l) => l.shadowHostPath)?.shadowHostPath;

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'hover',
      target: {
        tagName: element.tagName.toLowerCase(),
        locators,
        selectedLocatorIndex: 0,
        text: (element.textContent || '').trim().substring(0, 50),
        shadowHostSelector,
        shadowHostPath,
        isShadowDom: isInsideShadow,
        componentType: component.type,
        componentHierarchy: component.hierarchy,
      },
      waitCondition: 'visible',
    });

    this.onStep(step);
  }

  public recordKeyPress(keyCombo: string, element: HTMLElement): void {
    this.flushInput();
    const locators = generateLocators(element);
    const component = classifyComponent(element);
    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'press_key',
      target: {
        tagName: element.tagName.toLowerCase(),
        locators,
        selectedLocatorIndex: 0,
        shadowHostSelector,
        isShadowDom: isInsideShadow,
        componentType: component.type,
        componentHierarchy: component.hierarchy,
      },
      keyCombo,
      waitCondition: 'visible',
    });

    this.onStep(step);
  }

  public recordScroll(scrollX: number, scrollY: number): void {
    this.flushInput();
    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'scroll',
      target: {
        tagName: 'window',
        locators: [{ strategy: 'css', value: 'body', isUnique: true, matchCount: 1, score: 100 }],
        selectedLocatorIndex: 0,
        componentType: 'generic',
      },
      value: `${scrollX},${scrollY}`,
      waitCondition: 'presence',
    });

    this.onStep(step);
  }

  public recordFileUpload(element: HTMLInputElement, filePath = '/path/to/upload_file.ext'): void {
    this.flushInput();
    const locators = generateLocators(element);
    const component = classifyComponent(element);
    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'upload_file',
      target: {
        tagName: 'input',
        locators,
        selectedLocatorIndex: 0,
        shadowHostSelector,
        isShadowDom: isInsideShadow,
        componentType: component.type,
        componentHierarchy: component.hierarchy,
        dataFeedType: 'file_upload',
      },
      value: filePath,
      waitCondition: 'presence',
    });

    this.onStep(step);
  }

  public recordDragDrop(source: HTMLElement, target: HTMLElement): void {
    this.flushInput();
    const sourceLocators = generateLocators(source);
    const targetLocators = generateLocators(target);
    const sourceComponent = classifyComponent(source);
    const targetComponent = classifyComponent(target);

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'drag_drop',
      target: {
        tagName: source.tagName.toLowerCase(),
        locators: sourceLocators,
        selectedLocatorIndex: 0,
        componentType: sourceComponent.type,
        componentHierarchy: sourceComponent.hierarchy,
      },
      dragTarget: {
        tagName: target.tagName.toLowerCase(),
        locators: targetLocators,
        selectedLocatorIndex: 0,
        componentType: targetComponent.type,
        componentHierarchy: targetComponent.hierarchy,
      },
      waitCondition: 'visible',
    });

    this.onStep(step);
  }

  public recordIframeSwitch(iframeElement: HTMLIFrameElement): void {
    this.flushInput();
    const locators = generateLocators(iframeElement);
    const component = classifyComponent(iframeElement);

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'switch_iframe',
      target: {
        tagName: 'iframe',
        locators,
        selectedLocatorIndex: 0,
        componentType: component.type,
        componentHierarchy: component.hierarchy,
      },
      iframePath: locators[0]?.value || 'iframe',
      waitCondition: 'presence',
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

