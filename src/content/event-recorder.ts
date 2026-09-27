import { ActionNormalizer } from './action-normalizer';
import { ExtensionMessage } from '../types/messages';
import { generateLocators } from './locator-engine';

export class EventRecorder {
  private normalizer: ActionNormalizer;
  private isRecording = false;
  private isInspecting = false;
  private highlightOverlay: HTMLDivElement | null = null;
  private floatingTooltip: HTMLDivElement | null = null;

  constructor() {
    this.normalizer = new ActionNormalizer((step) => {
      if (!this.isRecording) return;
      this.sendToBackground({
        type: 'RECORDED_STEP',
        payload: { step, url: window.location.href },
      });
    });

    this.bindEvents();
    this.initMessageListener();
  }

  public start(): void {
    this.isRecording = true;
    this.createHighlightOverlay();
  }

  public stop(): void {
    this.normalizer.flushInput();
    this.isRecording = false;
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
        const path = (e.composedPath ? e.composedPath() : []) as HTMLElement[];
        let target = (path[0] as HTMLElement) || (e.target as HTMLElement);
        if (!target || target === this.highlightOverlay || target === this.floatingTooltip) return;

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

        // If clicked on an SVG, icon, or inline wrapper inside an interactive element, resolve to the interactive element
        const interactive = target.closest(
          'button, a, [role="button"], [role="menuitem"], [role="tab"], input, select, textarea'
        ) as HTMLElement | null;

        if (interactive && target !== interactive) {
          target = interactive;
        }

        this.normalizer.recordClick(target);
      },
      true
    );

    // Input Listener
    document.addEventListener(
      'input',
      (e: Event) => {
        if (!this.isRecording) return;
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (!target || !('value' in target)) return;
        this.normalizer.recordInput(target, target.value);
      },
      true
    );

    // Blur / Change Listener (flushes typing buffer or captures select changes)
    document.addEventListener(
      'blur',
      () => {
        if (!this.isRecording) return;
        this.normalizer.flushInput();
      },
      true
    );

    document.addEventListener(
      'change',
      (e: Event) => {
        if (!this.isRecording) return;
        const target = e.target as HTMLElement;
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
        if (!this.isRecording && !this.isInspecting) return;
        const target = e.target as HTMLElement;
        if (!target || target === this.highlightOverlay || target === this.floatingTooltip) return;

        const tag = (target.tagName || '').toLowerCase();
        if (tag === 'html' || tag === 'body') return;

        this.highlight(target);
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
  }

  private highlight(element: HTMLElement): void {
    if (!this.highlightOverlay) return;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    this.highlightOverlay.style.display = 'block';
    this.highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
    this.highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
    this.highlightOverlay.style.width = `${rect.width}px`;
    this.highlightOverlay.style.height = `${rect.height}px`;

    const locators = generateLocators(element);
    const topLocator = locators[0];
    const matchCountStr = topLocator ? (topLocator.isUnique ? '✓ 1 match' : `${topLocator.matchCount} matches`) : '';

    if (this.floatingTooltip) {
      this.floatingTooltip.style.display = 'block';
      const tooltipY = Math.max(0, rect.top + window.scrollY - 28);
      this.floatingTooltip.style.top = `${tooltipY}px`;
      this.floatingTooltip.style.left = `${rect.left + window.scrollX}px`;
      const tagName = element.tagName.toLowerCase();
      const val = topLocator ? topLocator.value : '';
      this.floatingTooltip.innerHTML = `<span style="color:#60a5fa">&lt;${tagName}&gt;</span> ${val} <span style="color:#34d399;font-weight:bold">${matchCountStr}</span>`;
    }

    // Send inspected element metadata to sidepanel
    this.sendToBackground({
      type: 'HOVER_ELEMENT_INSPECTED',
      payload: {
        tagName: element.tagName.toLowerCase(),
        locators,
        text: (element.textContent || '').trim().substring(0, 40),
      },
    });
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

    chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
      if (message.type === 'START_RECORDING') {
        this.start();
      } else if (message.type === 'STOP_RECORDING') {
        this.stop();
      } else if (message.type === 'START_INSPECTING') {
        this.startInspecting();
      } else if (message.type === 'STOP_INSPECTING') {
        this.stopInspecting();
      }
    });
  }
}

