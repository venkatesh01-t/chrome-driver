import { ActionNormalizer } from './action-normalizer';
import { ExtensionMessage } from '../types/messages';
import { generateLocators } from './locator-engine';
import { classifyComponent, COMPONENT_BADGE_COLORS } from './component-classifier';

function getHostSelector(host: HTMLElement): string {
  if (host.id) return `#${host.id}`;
  const testId = host.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;
  const tag = host.tagName.toLowerCase();
  const cls = typeof host.className === 'string' && host.className.trim()
    ? `.${host.className.trim().split(/\s+/)[0]}`
    : '';
  return `${tag}${cls}`;
}

export function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;
  if (el.hasAttribute && (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true')) return false;
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    } catch {
      // ignore in mock environments
    }
  }
  if (typeof el.getBoundingClientRect === 'function') {
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
    } catch {
      // ignore in mock environments
    }
  }
  return true;
}

export function resolveInteractiveTarget(e: Event): { target: HTMLElement; shadowHosts: string[] } {
  const path = (e.composedPath ? e.composedPath() : []) as Node[];
  let leaf = (path[0] as HTMLElement) || (e.target as HTMLElement);
  if (!leaf) return { target: leaf, shadowHosts: [] };

  if ((leaf as any).nodeType === 3 && (leaf as any).parentElement) {
    leaf = (leaf as any).parentElement;
  }

  const decorativeTags = new Set([
    'svg', 'path', 'rect', 'circle', 'use', 'g', 'polygon', 'line', 'polyline',
    'i', 'span', 'strong', 'em', 'img', 'b', 'small', 'mark'
  ]);
  const interactiveSelector = 'button, a, input, select, textarea, summary, [role="button"], [role="menuitem"], [role="option"], [role="tab"], [role="combobox"], [contenteditable="true"], [contenteditable=""]';

  let resolvedTarget = leaf;
  const leafTag = (leaf.tagName || '').toLowerCase();

  if (decorativeTags.has(leafTag) || !(leaf.matches && leaf.matches(interactiveSelector))) {
    for (const node of path) {
      if (node instanceof HTMLElement && typeof node.matches === 'function' && node.matches(interactiveSelector)) {
        if (isElementVisible(node)) {
          resolvedTarget = node;
          break;
        }
      }
    }
  }

  const shadowHosts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    if (typeof ShadowRoot !== 'undefined' && node instanceof ShadowRoot && (node as any).host) {
      const host = (node as any).host as HTMLElement;
      shadowHosts.unshift(getHostSelector(host));
    }
  }

  return { target: resolvedTarget, shadowHosts };
}

export class EventRecorder {
  private normalizer: ActionNormalizer;
  private isRecording = false;
  private isInspecting = false;
  private highlightOverlay: HTMLDivElement | null = null;
  private floatingTooltip: HTMLDivElement | null = null;
  private feedbackToast: HTMLDivElement | null = null;
  private lastHoveredElement: HTMLElement | null = null;
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastActionTimestamp = 0;
  private lastAssertedText = '';
  private autoAssertionObserver: MutationObserver | null = null;
  private activeAssertMode: 'assert_text' | 'assert_visible' | 'print_value' | null = null;
  private stepRecordedCallback?: (step: any) => void;

  constructor() {
    this.normalizer = new ActionNormalizer((step) => {
      if (!this.isRecording) return;
      this.stepRecordedCallback?.(step);
      this.sendToBackground({
        type: 'RECORDED_STEP',
        payload: { step, url: window.location.href },
      });
    });

    this.bindEvents();
    this.initMessageListener();
  }

  public isHudEvent(e: Event): boolean {
    const path = (e.composedPath ? e.composedPath() : []) as Node[];
    return path.some((n: any) => n.nodeName === 'AUTOMATEX-RECORDER-HUD' || (n.classList && n.classList.contains && n.classList.contains('automatex-hud-root')));
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public setAssertMode(mode: 'assert_text' | 'assert_visible' | 'print_value' | null): void {
    this.activeAssertMode = mode;
  }

  public setStepRecordedCallback(cb: (step: any) => void): void {
    this.stepRecordedCallback = cb;
  }

  public start(): void {
    this.isRecording = true;
    this.createHighlightOverlay();
    this.setupAutoAssertionObserver();
  }

  public stop(): void {
    this.normalizer.flushInput();
    this.isRecording = false;
    if (this.autoAssertionObserver) {
      this.autoAssertionObserver.disconnect();
      this.autoAssertionObserver = null;
    }
    if (!this.isInspecting) {
      this.removeHighlightOverlay();
    }
  }

  public startInspecting(): void {
    this.isInspecting = true;
    this.createHighlightOverlay();
    document.body.style.cursor = 'crosshair';
  }

  public stopInspecting(): void {
    this.isInspecting = false;
    document.body.style.cursor = '';
    if (!this.isRecording) {
      this.removeHighlightOverlay();
    }
  }

  private bindEvents(): void {
    // Click Listener (capture phase)
    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        if (this.isHudEvent(e)) return;
        const { target, shadowHosts } = resolveInteractiveTarget(e);
        if (!target || target === this.highlightOverlay || target === this.floatingTooltip) return;

        this.lastActionTimestamp = Date.now();

        // 1-Click HUD Assert Mode
        if (this.activeAssertMode) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (this.activeAssertMode === 'assert_text') {
            const expectedText = (target.textContent || '').trim();
            this.normalizer.recordAssertion(target, 'assert_text', expectedText);
            this.showFlashFeedback(target, `💬 Assert Text "${expectedText.substring(0, 25)}" Recorded`);
          } else if (this.activeAssertMode === 'assert_visible') {
            this.normalizer.recordAssertion(target, 'assert_visible');
            this.showFlashFeedback(target, '👁️ Assert Visible Recorded');
          } else if (this.activeAssertMode === 'print_value') {
            this.normalizer.recordPrintValue(target);
            this.showFlashFeedback(target, '🖨️ Print Value Recorded');
          }
          this.activeAssertMode = null;
          return;
        }

        // If inspecting, capture full element details and stop inspection
        if (this.isInspecting) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          const locators = generateLocators(target);
          const topLocator = locators[0];
          const cssCandidate = locators.find((l) => l.strategy === 'css' || l.strategy === 'id') || topLocator;
          const xpathCandidate = locators.find((l) => l.strategy === 'xpath') || topLocator;

          this.sendToBackground({
            type: 'ELEMENT_SELECTED',
            payload: {
              tagName: target.tagName.toLowerCase(),
              locators,
              text: (target.textContent || '').trim().substring(0, 80),
              htmlSnippet: target.outerHTML ? target.outerHTML.substring(0, 300) : '',
              outerHtml: target.outerHTML || '',
              cssSelector: cssCandidate ? cssCandidate.value : target.tagName.toLowerCase(),
              xpath: xpathCandidate ? xpathCandidate.value : `//${target.tagName.toLowerCase()}`,
              matchCount: topLocator ? topLocator.matchCount : 1,
            },
          });

          this.stopInspecting();
          return;
        }

        if (!this.isRecording) return;

        // Print/Extract Value Mode: Ctrl + Click (or Cmd + Click) captures element text/value to print
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.normalizer.recordPrintValue(target);
          this.showFlashFeedback(target, '🖨️ Print Value Recorded');
          return;
        }

        // Assertion Recording Mode: Alt + Click creates an assertion step
        if (e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.normalizer.recordAssertion(target, 'assert_visible');
          this.showFlashFeedback(target, '✓ Assert Visible Recorded');
          return;
        }

        this.normalizer.recordClick(target, shadowHosts);
      },
      true
    );

    // Double-Click with Ctrl / Cmd to extract & print value
    document.addEventListener(
      'dblclick',
      (e: MouseEvent) => {
        if (this.isHudEvent(e)) return;
        if (!this.isRecording) return;
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          const path = (e.composedPath ? e.composedPath() : []) as HTMLElement[];
          const target = (path[0] as HTMLElement) || (e.target as HTMLElement);
          if (target) {
            this.normalizer.recordPrintValue(target);
            this.showFlashFeedback(target, '🖨️ Print Value Recorded');
          }
        }
      },
      true
    );

    // Hover Recording via Shift + Right Click
    document.addEventListener(
      'contextmenu',
      (e: MouseEvent) => {
        if (this.isHudEvent(e)) return;
        if (!this.isRecording) return;
        if (!e.shiftKey) return;
        e.preventDefault();
        e.stopPropagation();
        const target = (e.composedPath ? e.composedPath()[0] : e.target) as HTMLElement;
        if (target) {
          this.normalizer.recordHover(target);
        }
      },
      true
    );

    // Keyboard Shortcuts (Escape, Enter, Tab, and modifier combos + 'p' print hotkey)
    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (this.isHudEvent(e)) return;
        if (!this.isRecording) return;
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

        // Quick 'p' or 'P' hotkey while hovering over an element (when not typing in an input)
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        const isActivelyTyping = ['input', 'textarea'].includes(activeTag);
        if ((e.key === 'p' || e.key === 'P') && !isActivelyTyping && this.lastHoveredElement) {
          e.preventDefault();
          this.normalizer.recordPrintValue(this.lastHoveredElement);
          this.showFlashFeedback(this.lastHoveredElement, '🖨️ Print Value Recorded (Hot-key)');
          return;
        }

        const capturedKeys = ['Escape', 'Enter', 'Tab'];
        if (capturedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
          const target = (e.target || document.body) as HTMLElement;
          const isInput = ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase());
          if (isInput && !['Enter', 'Escape'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
            return;
          }
          const combo = [
            e.ctrlKey ? 'Control' : '',
            e.shiftKey ? 'Shift' : '',
            e.altKey ? 'Alt' : '',
            e.key,
          ]
            .filter(Boolean)
            .join('+');

          this.normalizer.recordKeyPress(combo, target);
        }
      },
      true
    );

    // Scroll Listener
    window.addEventListener(
      'scroll',
      () => {
        if (!this.isRecording) return;
        if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
          this.normalizer.recordScroll(window.scrollX, window.scrollY);
        }, 500);
      },
      { passive: true }
    );

    // Input Listener (for text inputs, textareas, and contenteditable elements)
    document.addEventListener(
      'input',
      (e: Event) => {
        if (this.isHudEvent(e)) return;
        if (!this.isRecording) return;
        const path = (e.composedPath ? e.composedPath() : []) as HTMLElement[];
        const target = (path[0] as HTMLElement) || (e.target as HTMLElement);
        if (!target) return;

        // ContentEditable elements (e.g. div[contenteditable="true"])
        if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
          const val = (target.innerText || target.textContent || '').trim();
          this.normalizer.recordInput(target, val);
          return;
        }

        if ('value' in target) {
          const inputEl = target as HTMLInputElement | HTMLTextAreaElement;
          const type = (inputEl.getAttribute('type') || 'text').toLowerCase();
          if (['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image'].includes(type)) {
            return;
          }
          this.normalizer.recordInput(inputEl, inputEl.value);
        }
      },
      true
    );

    // Blur / Change Listener (flushes typing buffer or captures select/contenteditable changes)
    document.addEventListener(
      'blur',
      (e: FocusEvent) => {
        if (this.isHudEvent(e)) return;
        if (!this.isRecording) return;
        const path = (e.composedPath ? e.composedPath() : []) as HTMLElement[];
        const target = (path[0] as HTMLElement) || (e.target as HTMLElement);
        if (target && (target.isContentEditable || target.getAttribute('contenteditable') === 'true')) {
          const val = (target.innerText || target.textContent || '').trim();
          this.normalizer.recordInput(target, val);
        }
        this.normalizer.flushInput();
      },
      true
    );

    document.addEventListener(
      'change',
      (e: Event) => {
        if (this.isHudEvent(e)) return;
        if (!this.isRecording) return;
        const path = (e.composedPath ? e.composedPath() : []) as HTMLElement[];
        const target = (path[0] as HTMLElement) || (e.target as HTMLElement);
        if (target && target.tagName.toLowerCase() === 'select') {
          this.normalizer.recordSelect(target as HTMLSelectElement);
          return;
        }
        this.normalizer.flushInput();
      },
      true
    );

    // Mouseover Inspector Highlighter
    document.addEventListener(
      'mouseover',
      (e: MouseEvent) => {
        if (this.isHudEvent(e)) return;
        if (!this.isRecording && !this.isInspecting) return;
        const target = e.target as HTMLElement;
        if (!target || target === this.highlightOverlay || target === this.floatingTooltip || target === this.feedbackToast) return;

        const tag = (target.tagName || '').toLowerCase();
        if (tag === 'html' || tag === 'body') return;

        this.lastHoveredElement = target;
        this.highlight(target, e.ctrlKey || e.metaKey);
      },
      true
    );
  }

  private createHighlightOverlay(): void {
    if (!this.highlightOverlay) {
      this.highlightOverlay = document.createElement('div');
      this.highlightOverlay.id = '__selenium_recorder_highlight';
      Object.assign(this.highlightOverlay.style, {
        position: 'absolute',
        pointerEvents: 'none',
        border: '2px solid #3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        zIndex: '2147483646',
        transition: 'all 0.08s ease',
        display: 'none',
        borderRadius: '3px',
      });
      document.documentElement.appendChild(this.highlightOverlay);
    }

    if (!this.floatingTooltip) {
      this.floatingTooltip = document.createElement('div');
      this.floatingTooltip.id = '__selenium_recorder_tooltip';
      Object.assign(this.floatingTooltip.style, {
        position: 'absolute',
        pointerEvents: 'none',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        border: '1px solid #3b82f6',
        borderRadius: '4px',
        padding: '3px 8px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: '2147483647',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        display: 'none',
        maxWidth: '380px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      });
      document.documentElement.appendChild(this.floatingTooltip);
    }
  }

  private removeHighlightOverlay(): void {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
    if (this.floatingTooltip) {
      this.floatingTooltip.remove();
      this.floatingTooltip = null;
    }
    if (this.feedbackToast) {
      this.feedbackToast.remove();
      this.feedbackToast = null;
    }
  }

  private highlight(element: HTMLElement, isCtrlPressed = false): void {
    if (!this.highlightOverlay) return;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    this.highlightOverlay.style.display = 'block';
    this.highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
    this.highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
    this.highlightOverlay.style.width = `${rect.width}px`;
    this.highlightOverlay.style.height = `${rect.height}px`;

    if (isCtrlPressed) {
      this.highlightOverlay.style.borderColor = '#10b981';
      this.highlightOverlay.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
    } else {
      this.highlightOverlay.style.borderColor = '#3b82f6';
      this.highlightOverlay.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
    }

    const locators = generateLocators(element);
    const topLocator = locators[0];
    const matchCountStr = topLocator ? (topLocator.isUnique ? '✓ 1 match' : `${topLocator.matchCount} matches`) : '';
    const componentInfo = classifyComponent(element);

    if (this.floatingTooltip) {
      this.floatingTooltip.style.display = 'block';
      const tooltipY = Math.max(0, rect.top + window.scrollY - 28);
      this.floatingTooltip.style.top = `${tooltipY}px`;
      this.floatingTooltip.style.left = `${rect.left + window.scrollX}px`;
      const tagName = element.tagName.toLowerCase();
      const val = topLocator ? topLocator.value : '';
      const badgeColor = COMPONENT_BADGE_COLORS[componentInfo.type] || '#94a3b8';
      const printHint = isCtrlPressed
        ? `<span style="background:#10b981;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;margin-left:4px;font-weight:bold">🖨️ CTRL+CLICK TO PRINT</span>`
        : '';

      this.floatingTooltip.innerHTML =
        `<span style="background:${badgeColor};color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;margin-right:4px;font-weight:bold">${componentInfo.type.toUpperCase()}</span>` +
        `<span style="color:#60a5fa">&lt;${tagName}&gt;</span> ${val} ` +
        `<span style="color:#34d399;font-weight:bold">${matchCountStr}</span>` +
        printHint;
    }

    // Send inspected element metadata to sidepanel
    this.sendToBackground({
      type: 'HOVER_ELEMENT_INSPECTED',
      payload: {
        tagName: element.tagName.toLowerCase(),
        locators,
        text: (element.textContent || '').trim().substring(0, 40),
        componentType: componentInfo.type,
        componentHierarchy: componentInfo.hierarchy,
      },
    });
  }

  private showFlashFeedback(element: HTMLElement, message: string): void {
    if (!this.feedbackToast) {
      this.feedbackToast = document.createElement('div');
      this.feedbackToast.id = '__selenium_recorder_toast';
      Object.assign(this.feedbackToast.style, {
        position: 'absolute',
        pointerEvents: 'none',
        backgroundColor: '#064e3b',
        color: '#6ee7b7',
        border: '1px solid #10b981',
        borderRadius: '6px',
        padding: '6px 12px',
        fontSize: '12px',
        fontWeight: 'bold',
        fontFamily: 'sans-serif',
        zIndex: '2147483647',
        boxShadow: '0 6px 16px rgba(0,0,0,0.6)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        opacity: '0',
        transform: 'translateY(5px)',
      });
      document.documentElement.appendChild(this.feedbackToast);
    }

    const rect = element.getBoundingClientRect();
    const toastY = Math.max(10, rect.top + window.scrollY - 36);
    this.feedbackToast.style.top = `${toastY}px`;
    this.feedbackToast.style.left = `${rect.left + window.scrollX}px`;
    this.feedbackToast.textContent = message;
    this.feedbackToast.style.opacity = '1';
    this.feedbackToast.style.transform = 'translateY(0)';

    setTimeout(() => {
      if (this.feedbackToast) {
        this.feedbackToast.style.opacity = '0';
        this.feedbackToast.style.transform = 'translateY(5px)';
      }
    }, 1500);
  }

  private sendToBackground(msg: ExtensionMessage): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(msg);
      }
    } catch {
      // In tests or non-extension contexts, silently ignore
    }
  }

  private initMessageListener(): void {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;

    chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      if (message.type === 'START_RECORDING') {
        this.start();
      } else if (message.type === 'STOP_RECORDING') {
        this.stop();
      } else if (message.type === 'START_INSPECTING') {
        this.startInspecting();
      } else if (message.type === 'STOP_INSPECTING') {
        this.stopInspecting();
      } else if (message.type === 'TEST_LOCATOR') {
        const { strategy, value } = message.payload;
        let matchCount = 0;
        let matchedElem: HTMLElement | null = null;

        try {
          if (strategy === 'xpath' || strategy === 'absolute-xpath') {
            const result = document.evaluate(
              value,
              document,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null
            );
            matchCount = result.snapshotLength;
            if (matchCount > 0) {
              matchedElem = result.snapshotItem(0) as HTMLElement;
            }
          } else {
            const matches = document.querySelectorAll(value);
            matchCount = matches.length;
            if (matchCount > 0) {
              matchedElem = matches[0] as HTMLElement;
            }
          }

          if (matchedElem) {
            this.createHighlightOverlay();
            matchedElem.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            this.highlight(matchedElem);
            this.showFlashFeedback(matchedElem, `✓ ${matchCount} match${matchCount > 1 ? 'es' : ''} found`);
            setTimeout(() => {
              if (!this.isInspecting && !this.isRecording) {
                this.removeHighlightOverlay();
              } else if (this.highlightOverlay) {
                this.highlightOverlay.style.display = 'none';
              }
            }, 3000);
          }

          sendResponse({
            success: matchCount > 0,
            matchCount,
            tagName: matchedElem ? matchedElem.tagName.toLowerCase() : undefined,
            text: matchedElem ? (matchedElem.textContent || '').trim().substring(0, 50) : undefined,
          });
        } catch {
          sendResponse({
            success: false,
            matchCount: 0,
          });
        }
        return true;
      }
    });
  }

  private setupAutoAssertionObserver(): void {
    if (this.autoAssertionObserver || typeof MutationObserver === 'undefined') return;

    try {
      this.autoAssertionObserver = new MutationObserver((mutations) => {
        if (!this.isRecording) return;
        const now = Date.now();
        if (now - this.lastActionTimestamp > 1200) return;

        for (const mutation of mutations) {
          const candidates: HTMLElement[] = [];

          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) {
                if (node.matches('dialog[open], [role="alert"], [role="status"], #last-action-text, .toast, .alert')) {
                  candidates.push(node);
                }
                const matches = node.querySelectorAll<HTMLElement>('dialog[open], [role="alert"], [role="status"], #last-action-text, .toast, .alert');
                matches.forEach((m) => candidates.push(m));
              }
            });
          } else if (mutation.type === 'attributes' || mutation.type === 'characterData') {
            const target = mutation.target instanceof HTMLElement ? mutation.target : mutation.target.parentElement;
            if (target && target.matches && target.matches('dialog[open], [role="alert"], [role="status"], #last-action-text, .toast, .alert')) {
              candidates.push(target);
            }
          }

          for (const candidate of candidates) {
            const text = (candidate.textContent || '').trim();
            if (text && text.length > 1 && text !== this.lastAssertedText) {
              this.lastAssertedText = text;
              this.normalizer.recordAssertion(candidate, 'assert_text', text);
              this.showFlashFeedback(candidate, `✓ Auto-Assert: "${text.substring(0, 25)}"`);
              break;
            }
          }
        }
      });

      const root = document.body || document.documentElement;
      if (root) {
        this.autoAssertionObserver.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
          attributeFilter: ['open', 'class', 'style', 'hidden', 'aria-hidden'],
        });
      }
    } catch {
      // In constrained testing environments, silently skip
    }
  }
}


