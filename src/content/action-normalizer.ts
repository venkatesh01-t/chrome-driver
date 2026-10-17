import { TestStep, createTestStep } from '../types/model';
import { generateLocators, detectFieldSemantics, detectIframeLocator, extractElementFingerprint } from './locator-engine';
import { classifyComponent } from './component-classifier';

interface InputBuffer {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement;
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
  private lastRecordedTypeStep: TestStep | null = null;
  private iframeDetector: () => string | undefined;

  constructor(
    onStep: (step: TestStep) => void,
    iframeDetector: () => string | undefined = detectIframeLocator
  ) {
    this.onStep = onStep;
    this.iframeDetector = iframeDetector;
  }

  private getIframePath(explicit?: string): string | undefined {
    return explicit !== undefined ? explicit : this.iframeDetector();
  }

  public recordClick(element: HTMLElement, shadowHosts?: string[]): void {
    // 1. Flush any pending typing actions before recording click
    this.flushInput();
    this.lastRecordedTypeStep = null;

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

    const fingerprint = extractElementFingerprint(element);
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
        shadowHostPath: shadowHosts || shadowHostPath,
        isShadowDom: isInsideShadow,
        componentType: component.type,
        componentHierarchy: component.hierarchy,
        dataFeedType: component.dataFeed,
        fingerprint,
      },
      value,
      shadowHosts: shadowHosts || shadowHostPath,
      iframeSelector: this.getIframePath(),
      iframePath: this.getIframePath(),
      fingerprint,
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
      iframePath: this.getIframePath(),
      waitCondition: 'presence',
    });

    this.onStep(step);
  }

  public recordInput(element: HTMLInputElement | HTMLTextAreaElement | HTMLElement, value: string): void {
    if (this.lastRecordedTypeStep && this.lastTypedElement === element) {
      const isSensitive = this.lastRecordedTypeStep.isSensitive;
      this.lastRecordedTypeStep.value = isSensitive ? '••••••••' : value;
      this.currentInputBuffer = null;
      return;
    }

    this.currentInputBuffer = {
      element,
      value,
      timestamp: Date.now(),
    };
  }

  public recordChange(element: HTMLInputElement | HTMLTextAreaElement | HTMLElement): void {
    const rawVal = 'value' in element ? (element as HTMLInputElement).value : (element.innerText || element.textContent || '');
    const effectiveVal = (rawVal && rawVal.trim()) ? rawVal : (this.lastRecordedTypeStep?.value || '');
    if (this.lastRecordedTypeStep && this.lastTypedElement === element) {
      const isSensitive = this.lastRecordedTypeStep.isSensitive;
      this.lastRecordedTypeStep.value = isSensitive ? '••••••••' : (effectiveVal || this.lastRecordedTypeStep.value);
      return;
    }
    this.recordInput(element, effectiveVal);
    this.flushInput();
  }

  public flushInput(): void {
    if (!this.currentInputBuffer) return;

    const { element, value } = this.currentInputBuffer;
    this.currentInputBuffer = null;

    const tagName = element.tagName.toLowerCase();
    const isContentEditable = (element as HTMLElement).isContentEditable || element.getAttribute('contenteditable') === 'true';
    const locators = generateLocators(element);
    const semantics = detectFieldSemantics(element);
    const component = classifyComponent(element);
    const isSensitive = !isContentEditable && (semantics.semanticType === 'password' || this.detectSensitiveField(element as HTMLElement));

    // If user clicked but left empty, use smart semantic default value
    const effectiveValue = (value && value.trim()) ? value : (isContentEditable ? 'Sample content' : semantics.defaultValue);

    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;
    const shadowHostPath = locators.find((l) => l.shadowHostPath)?.shadowHostPath;

    const fingerprint = extractElementFingerprint(element);
    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'type',
      target: {
        tagName,
        locators,
        selectedLocatorIndex: 0,
        isSensitive,
        semanticType: isContentEditable ? 'contenteditable' : semantics.semanticType,
        labelText: semantics.labelText,
        shadowHostSelector,
        shadowHostPath,
        isShadowDom: isInsideShadow,
        componentType: isContentEditable ? 'input' : component.type,
        componentHierarchy: component.hierarchy,
        dataFeedType: component.dataFeed,
        fingerprint,
      },
      value: isSensitive ? '••••••••' : effectiveValue,
      isSensitive,
      variableName: isSensitive ? this.deriveVariableName(element) : undefined,
      shadowHosts: shadowHostPath,
      iframeSelector: this.getIframePath(),
      iframePath: this.getIframePath(),
      fingerprint,
      waitCondition: 'visible',
    });

    this.lastTypedElement = element;
    this.lastRecordedTypeStep = step;
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

    const fingerprint = extractElementFingerprint(element);
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
        fingerprint,
      },
      assertExpected,
      assertAttribute: attributeName,
      shadowHosts: shadowHostPath,
      iframeSelector: this.getIframePath(),
      iframePath: this.getIframePath(),
      fingerprint,
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
      iframePath: this.getIframePath(),
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
      iframePath: this.getIframePath(),
      waitCondition: 'visible',
    });

    this.onStep(step);
  }

  public recordKeyPress(keyCombo: string, element: HTMLElement): void {
    this.flushInput();
    this.lastRecordedTypeStep = null;
    const locators = generateLocators(element);
    const component = classifyComponent(element);
    const isInsideShadow = locators.some((l) => l.isShadowDom);
    const shadowHostSelector = locators.find((l) => l.shadowHostSelector)?.shadowHostSelector;

    const isInputElement = ['input', 'textarea'].includes(element.tagName.toLowerCase());
    const isEnterSubmission = keyCombo.toLowerCase() === 'enter' && isInputElement;

    const step = createTestStep({
      stepNumber: this.stepCounter++,
      action: 'press_key',
      target: {
        tagName: element.tagName.toLowerCase(),
        locators,
        selectedLocatorIndex: 0,
        shadowHostSelector,
        isShadowDom: isInsideShadow,
        componentType: isEnterSubmission ? 'form' : component.type,
        componentHierarchy: component.hierarchy,
      },
      keyCombo: isEnterSubmission ? 'Enter' : keyCombo,
      iframePath: this.getIframePath(),
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
      iframePath: this.getIframePath(),
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
      iframePath: this.getIframePath(),
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

  private detectSensitiveField(element: HTMLElement): boolean {
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

