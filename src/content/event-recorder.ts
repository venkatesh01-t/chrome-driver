import { ActionNormalizer } from './action-normalizer';
import { ExtensionMessage } from '../types/messages';
import { generateLocators } from './locator-engine';

export class EventRecorder {
  private normalizer: ActionNormalizer;
  private isRecording = false;
  private highlightedElement: HTMLElement | null = null;
  private highlightOverlay: HTMLDivElement | null = null;

  constructor() {
    this.normalizer = new ActionNormalizer((step) => {
      if (!this.isRecording) return;
      this.sendToBackground({
        type: 'RECORDED_STEP',
        payload: { step },
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
    this.removeHighlightOverlay();
  }

  private bindEvents(): void {
    // Click Listener (capture phase)
    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        if (!this.isRecording) return;
        const target = e.target as HTMLElement;
        if (!target || target === this.highlightOverlay) return;
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

    // Blur / Change Listener (flushes typing buffer)
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
      () => {
        if (!this.isRecording) return;
        this.normalizer.flushInput();
      },
      true
    );

    // Mouseover Inspector Highlighter
    document.addEventListener('mouseover', (e: MouseEvent) => {
      if (!this.isRecording) return;
      const target = e.target as HTMLElement;
      if (!target || target === this.highlightOverlay) return;
      this.highlight(target);
    });
  }

  private createHighlightOverlay(): void {
    if (this.highlightOverlay) return;
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = '__selenium_recorder_highlight';
    Object.assign(this.highlightOverlay.style, {
      position: 'absolute',
      pointerEvents: 'none',
      border: '2px solid #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      zIndex: '2147483647',
      transition: 'all 0.1s ease',
      display: 'none',
      borderRadius: '3px',
    });
    document.documentElement.appendChild(this.highlightOverlay);
  }

  private removeHighlightOverlay(): void {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
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

    this.highlightedElement = element;

    // Send inspected element metadata
    const locators = generateLocators(element);
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
      }
    });
  }
}
