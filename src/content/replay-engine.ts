import { TestStep, LocatorCandidate, TargetElementModel } from '../types/model';
import { escapeCss } from '../utils/dom';

export interface StepExecutionResult {
  stepId: string;
  stepNumber: number;
  action: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
  actualValue?: string;
  usedLocator?: string;
  healedWithFallback?: boolean;
}

export interface ReplayOptions {
  stepDelayMs?: number;
  timeoutMs?: number;
  highlightDurationMs?: number;
  onStepStart?: (step: TestStep) => void;
  onStepComplete?: (result: StepExecutionResult) => void;
}

/**
 * Resolves a TargetElementModel to an actual DOM Element using its candidate locators.
 * Gracefully iterates through fallback locators if the primary candidate fails.
 */
export function resolveElement(target: TargetElementModel, root: Document | Element = document): { element: HTMLElement | null; usedLocator: string; isFallback: boolean } {
  if (!target || !target.locators || target.locators.length === 0) {
    if (target?.tagName) {
      const el = root.querySelector(target.tagName) as HTMLElement | null;
      return { element: el, usedLocator: target.tagName, isFallback: false };
    }
    return { element: null, usedLocator: '', isFallback: false };
  }

  const selectedIndex = target.selectedLocatorIndex ?? 0;
  const primary = target.locators[selectedIndex] || target.locators[0];

  // Try primary candidate
  let el = findElementByCandidate(primary, root);
  if (el) {
    return { element: el, usedLocator: `${primary.strategy}=${primary.value}`, isFallback: false };
  }

  // Fallback to other candidates if primary fails (Self-Healing)
  for (let i = 0; i < target.locators.length; i++) {
    if (i === selectedIndex) continue;
    const cand = target.locators[i];
    el = findElementByCandidate(cand, root);
    if (el) {
      return { element: el, usedLocator: `${cand.strategy}=${cand.value}`, isFallback: true };
    }
  }

  return { element: null, usedLocator: `${primary.strategy}=${primary.value}`, isFallback: false };
}

/**
 * Query DOM element using a single LocatorCandidate
 */
export function findElementByCandidate(candidate: LocatorCandidate, root: Document | Element = document): HTMLElement | null {
  try {
    const { strategy, value } = candidate;
    switch (strategy) {
      case 'id': {
        const doc = (root as any).getElementById ? (root as Document) : (root.ownerDocument || document);
        return doc.getElementById(value) || root.querySelector(`#${escapeCss(value)}`);
      }
      case 'data-testid':
        return root.querySelector(`[data-testid="${escapeCss(value)}"]`);
      case 'name':
        return root.querySelector(`[name="${escapeCss(value)}"]`);
      case 'aria-label':
        return root.querySelector(`[aria-label="${escapeCss(value)}"]`);
      case 'css':
        return root.querySelector(value);
      case 'xpath':
      case 'absolute-xpath': {
        const doc = (root as any).evaluate ? (root as Document) : (root.ownerDocument || document);
        const result = doc.evaluate(value, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue as HTMLElement | null;
      }
      default:
        return root.querySelector(value);
    }
  } catch {
    return null;
  }
}

/**
 * Highlights an element with an animated HUD glow ring during playback
 */
export function highlightReplayElement(element: HTMLElement, durationMs = 400): Promise<void> {
  const originalOutline = element.style.outline;
  const originalBoxShadow = element.style.boxShadow;
  const originalTransition = element.style.transition;

  element.style.transition = 'all 0.15s ease-in-out';
  element.style.outline = '2px solid #10b981';
  element.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.7)';

  return new Promise((resolve) => {
    setTimeout(() => {
      element.style.outline = originalOutline;
      element.style.boxShadow = originalBoxShadow;
      element.style.transition = originalTransition;
      resolve();
    }, durationMs);
  });
}

/**
 * In-Browser Replay Engine for dry-running recorded steps
 */
export class ReplayEngine {
  private isAborted = false;

  public abort(): void {
    this.isAborted = true;
  }

  /**
   * Executes a single TestStep against the live DOM
   */
  public async executeStep(step: TestStep, timeoutMs = 3000): Promise<StepExecutionResult> {
    const startTime = performance.now();
    const result: StepExecutionResult = {
      stepId: step.id,
      stepNumber: step.stepNumber,
      action: step.action,
      status: 'passed',
      durationMs: 0,
    };

    try {
      // 1. Actions not requiring a target element
      if (step.action === 'wait') {
        const duration = (step.waitDuration ?? 1) * 1000;
        await new Promise((r) => setTimeout(r, Math.min(duration, timeoutMs)));
        result.durationMs = Math.round(performance.now() - startTime);
        return result;
      }

      if (step.action === 'navigate') {
        if (typeof window !== 'undefined' && step.value && window.location.href !== step.value) {
          // If in real browser environment
          result.actualValue = step.value;
        }
        result.durationMs = Math.round(performance.now() - startTime);
        return result;
      }

      // 2. Resolve element
      const { element, usedLocator, isFallback } = resolveElement(step.target);
      result.usedLocator = usedLocator;
      result.healedWithFallback = isFallback;

      if (!element) {
        throw new Error(`Element not found in DOM using locators: ${usedLocator}`);
      }

      // Visual pulse
      if (typeof window !== 'undefined' && element.style) {
        element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        await highlightReplayElement(element, 150);
      }

      // 3. Dispatch specific actions
      switch (step.action) {
        case 'click': {
          element.focus?.();
          element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          element.click();
          break;
        }

        case 'type': {
          element.focus?.();
          const inputEl = element as HTMLInputElement;
          const val = step.value ?? '';
          if ('value' in inputEl) {
            inputEl.value = val;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
          break;
        }

        case 'clear': {
          element.focus?.();
          const inputEl = element as HTMLInputElement;
          if ('value' in inputEl) {
            inputEl.value = '';
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
          break;
        }

        case 'checkbox':
        case 'radio': {
          const checkEl = element as HTMLInputElement;
          if (step.action === 'radio') {
            checkEl.checked = true;
          } else {
            checkEl.checked = step.value ? step.value === 'true' : !checkEl.checked;
          }
          checkEl.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }

        case 'select': {
          const selectEl = element as HTMLSelectElement;
          if ('value' in selectEl && step.value) {
            selectEl.value = step.value;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
          break;
        }

        case 'hover': {
          element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          break;
        }

        case 'scroll': {
          element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          break;
        }

        case 'assert_visible': {
          const isVisible = !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
          if (!isVisible) {
            throw new Error(`Assertion failed: element [${usedLocator}] is not visible in DOM.`);
          }
          break;
        }

        case 'assert_text': {
          const actualText = (element.textContent || '').trim();
          result.actualValue = actualText;
          const expected = (step.assertExpected || '').trim();
          if (expected && !actualText.includes(expected)) {
            throw new Error(`Assertion failed: expected text "${expected}" but found "${actualText}".`);
          }
          break;
        }

        case 'assert_attribute': {
          const attr = step.assertAttribute || '';
          const actualVal = element.getAttribute(attr);
          result.actualValue = actualVal || '';
          if (step.assertExpected && actualVal !== step.assertExpected) {
            throw new Error(`Assertion failed: attribute "${attr}" expected "${step.assertExpected}" but was "${actualVal}".`);
          }
          break;
        }

        default:
          break;
      }
    } catch (err: any) {
      result.status = 'failed';
      result.error = err.message || String(err);
    } finally {
      result.durationMs = Math.round(performance.now() - startTime);
    }

    return result;
  }

  /**
   * Replays an entire array of TestSteps sequentially
   */
  public async replayFlow(steps: TestStep[], options: ReplayOptions = {}): Promise<StepExecutionResult[]> {
    this.isAborted = false;
    const results: StepExecutionResult[] = [];
    const delay = options.stepDelayMs ?? 200;

    for (const step of steps) {
      if (this.isAborted) {
        results.push({
          stepId: step.id,
          stepNumber: step.stepNumber,
          action: step.action,
          status: 'skipped',
          durationMs: 0,
          error: 'Replay aborted by user',
        });
        continue;
      }

      options.onStepStart?.(step);
      const res = await this.executeStep(step, options.timeoutMs);
      results.push(res);
      options.onStepComplete?.(res);

      if (res.status === 'failed') {
        // Break on failure
        break;
      }

      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    return results;
  }
}
