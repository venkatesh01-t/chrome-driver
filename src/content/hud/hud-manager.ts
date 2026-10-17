/**
 * AutomateX Floating In-Page HUD & Hover Pill Manager
 * Completely encapsulated in Shadow DOM - Zero side-by-side split, 100% full desktop viewport.
 */

import hudStyles from './hud.css?raw';
import { TestCaseModel, createTestCase } from '../../types/model';
import { generateSeleniumScript } from '../../generator/python-generator';
import { generatePlaywrightScript } from '../../generator/playwright-generator';

export class HudManager {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private rootEl: HTMLElement | null = null;

  private isRecording = false;
  private isPaused = false;
  private stepCount = 0;
  private lastActionText = 'Ready to record';
  private activeTestCase: TestCaseModel | null = null;

  // View state
  private isExpanded = false;
  private isPinned = false;
  private isDrawerOpen = false;
  private collapseTimeout: any = null;

  // Code drawer options
  private currentEngine: 'selenium' | 'playwright' = 'selenium';
  private currentStyle: 'enterprise' | 'simple' | 'pytest' | 'pom' = 'enterprise';

  // Timer
  private startTime = 0;
  private timerInterval: any = null;
  private elapsedSeconds = 0;

  // Dragging state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialLeft = 0;
  private initialTop = 0;

  // Callback to parent recorder
  private onRecordToggle?: () => void;
  private onAssertModeToggle?: (mode: 'assert_text' | 'assert_visible' | 'print_value' | null) => void;
  private activeAssertMode: 'assert_text' | 'assert_visible' | 'print_value' | null = null;

  constructor() {
    this.mount();
    this.restorePosition();
  }

  public setCallbacks(callbacks: {
    onRecordToggle?: () => void;
    onAssertModeToggle?: (mode: 'assert_text' | 'assert_visible' | 'print_value' | null) => void;
  }): void {
    this.onRecordToggle = callbacks.onRecordToggle;
    this.onAssertModeToggle = callbacks.onAssertModeToggle;
  }

  private mount(): void {
    if (document.querySelector('automatex-recorder-hud')) return;

    this.host = document.createElement('automatex-recorder-hud');
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = hudStyles;
    this.shadow.appendChild(styleEl);

    // Root element
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'automatex-hud-root';
    this.shadow.appendChild(this.rootEl);

    document.documentElement.appendChild(this.host);
    this.render();
    this.setupHoverListeners();
  }

  public updateState(state: {
    isRecording?: boolean;
    isPaused?: boolean;
    stepCount?: number;
    lastActionText?: string;
    activeTestCase?: TestCaseModel | null;
  }): void {
    if (state.isRecording !== undefined) {
      this.isRecording = state.isRecording;
      if (this.isRecording && !this.timerInterval) {
        this.startTimer();
      } else if (!this.isRecording && this.timerInterval) {
        this.stopTimer();
      }
    }
    if (state.isPaused !== undefined) this.isPaused = state.isPaused;
    if (state.stepCount !== undefined) this.stepCount = state.stepCount;
    if (state.lastActionText !== undefined) this.lastActionText = state.lastActionText;
    if (state.activeTestCase !== undefined) this.activeTestCase = state.activeTestCase;

    this.render();
  }

  private startTimer(): void {
    this.startTime = Date.now() - this.elapsedSeconds * 1000;
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      this.updateTimerDisplay();
    }, 1000);
  }

  private stopTimer(): void {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.elapsedSeconds = 0;
  }

  private formatTimer(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private updateTimerDisplay(): void {
    if (!this.shadow) return;
    const timerEl = this.shadow.querySelector('.timer-text');
    if (timerEl) {
      timerEl.textContent = this.formatTimer(this.elapsedSeconds);
    }
  }

  private setupHoverListeners(): void {
    if (!this.rootEl) return;

    this.rootEl.addEventListener('mouseenter', () => {
      if (this.collapseTimeout) {
        clearTimeout(this.collapseTimeout);
        this.collapseTimeout = null;
      }
      if (!this.isExpanded && !this.isDragging) {
        this.isExpanded = true;
        this.render();
      }
    });

    this.rootEl.addEventListener('mouseleave', () => {
      if (this.isPinned || this.isDrawerOpen || this.isDragging) return;
      this.collapseTimeout = setTimeout(() => {
        this.isExpanded = false;
        this.render();
      }, 500); // 500ms grace period so user can move freely
    });
  }

  public render(): void {
    if (!this.rootEl) return;

    const timerFormatted = this.formatTimer(this.elapsedSeconds);
    const pulseClass = this.isRecording ? (this.isPaused ? 'pulse-dot paused' : 'pulse-dot recording') : 'pulse-dot';
    const pillClass = this.isRecording ? 'hud-pill hud-glass is-recording' : 'hud-pill hud-glass';
    const statusText = this.isRecording ? (this.isPaused ? 'PAUSED' : 'REC') : 'AutomateX';

    let html = '';

    if (!this.isExpanded) {
      // ----------------------------------------------------------------------
      // 1. MINIMIZED HOVER PILL VIEW
      // ----------------------------------------------------------------------
      html = `
        <div class="${pillClass}" id="hud-pill-handle" title="Hover to expand controls">
          <span class="${pulseClass}"></span>
          <span class="pill-label">
            ${statusText}
            <span class="pill-badge">${this.stepCount}</span>
          </span>
          <span class="pill-expand-icon">↔</span>
        </div>
      `;
    } else {
      // ----------------------------------------------------------------------
      // 2. EXPANDED FLOATING DOCK BAR
      // ----------------------------------------------------------------------
      html = `
        <div class="hud-bar" id="hud-bar-container">
          <!-- Header Bar -->
          <div class="bar-header" id="hud-bar-handle">
            <div class="brand-section">
              <span class="${pulseClass}"></span>
              <div class="brand-title">
                AutomateX Studio
                <span class="pill-badge">${this.stepCount} steps</span>
              </div>
            </div>
            <div class="header-actions">
              <button class="icon-btn ${this.isPinned ? 'active' : ''}" id="btn-pin" title="${this.isPinned ? 'Unpin (Auto-minimize)' : 'Pin expanded'}">
                📌
              </button>
              <button class="icon-btn" id="btn-minimize" title="Minimize to Hover Pill">
                ➖
              </button>
              <button class="icon-btn" id="btn-close-hud" title="Hide HUD">
                ✕
              </button>
            </div>
          </div>

          <!-- Controls Row -->
          <div class="bar-controls-row">
            <button class="btn-rec ${this.isRecording ? 'stop' : 'start'}" id="btn-record-toggle">
              ${this.isRecording ? '⏹ Stop Recording' : '🔴 Start Recording'}
            </button>
            <div class="btn-action" style="cursor: default;" title="Recording Duration">
              ⏱ <span class="timer-text">${timerFormatted}</span>
            </div>
            <button class="btn-action" id="btn-quick-copy" title="Quick Copy Generated Python Script">
              ⚡ Copy .py
            </button>
            <button class="btn-action" id="btn-view-code" title="Slide-Over Code Drawer">
              📋 Code
            </button>
          </div>

          <!-- Quick QA Tools Row -->
          <div class="tools-row">
            <button class="tool-chip ${this.activeAssertMode === 'assert_text' ? 'selected' : ''}" id="tool-assert-text" title="Click an element to record Assert Text">
              💬 Text
            </button>
            <button class="tool-chip ${this.activeAssertMode === 'assert_visible' ? 'selected' : ''}" id="tool-assert-visible" title="Click an element to record Assert Visible">
              👁 Visible
            </button>
            <button class="tool-chip ${this.activeAssertMode === 'print_value' ? 'selected' : ''}" id="tool-print-value" title="Click an element to Extract & Print value">
              🖨 Print Val
            </button>
          </div>

          <!-- Live Status Feed -->
          <div class="status-row">
            <div class="status-left">
              <span class="status-badge">Last:</span>
              <span title="${this.lastActionText}">${this.lastActionText}</span>
            </div>
            <div style="font-size: 10px; color: #64748b;">Full Viewport: 100%</div>
          </div>
        </div>
      `;
    }

    // ------------------------------------------------------------------------
    // 3. SLIDE-OVER CODE DRAWER (OVERLAY)
    // ------------------------------------------------------------------------
    html += `
      <div class="code-drawer-overlay ${this.isDrawerOpen ? 'open' : ''}" id="code-drawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <span>💻 Generated Test Automation Script</span>
          </div>
          <button class="icon-btn" id="btn-close-drawer" title="Close Drawer">✕</button>
        </div>

        <div class="drawer-selectors">
          <div style="display: flex; gap: 4px;">
            <button class="tab-pill ${this.currentEngine === 'selenium' ? 'active' : ''}" id="tab-engine-selenium">Selenium 4</button>
            <button class="tab-pill ${this.currentEngine === 'playwright' ? 'active' : ''}" id="tab-engine-playwright">Playwright</button>
          </div>
          <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
          <div style="display: flex; gap: 4px;">
            <button class="tab-pill ${this.currentStyle === 'enterprise' ? 'active' : ''}" id="tab-style-enterprise">Enterprise</button>
            <button class="tab-pill ${this.currentStyle === 'simple' ? 'active' : ''}" id="tab-style-simple">Simple</button>
            <button class="tab-pill ${this.currentStyle === 'pytest' ? 'active' : ''}" id="tab-style-pytest">Pytest</button>
            <button class="tab-pill ${this.currentStyle === 'pom' ? 'active' : ''}" id="tab-style-pom">POM</button>
          </div>
        </div>

        <textarea class="code-editor-area" id="drawer-code-area" readonly></textarea>

        <div class="drawer-footer">
          <div style="font-size: 11px; color: #94a3b8;">
            Zero side-by-side split • Flake-free explicit waits
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-primary" id="btn-drawer-copy">📋 Copy Code</button>
            <button class="btn-action" id="btn-drawer-download">💾 Download .py</button>
          </div>
        </div>
      </div>

      <div class="toast-msg" id="hud-toast">Copied to Clipboard!</div>
    `;

    this.rootEl.innerHTML = html;
    this.attachDomEvents();
    if (this.isDrawerOpen) {
      this.updateDrawerCode();
    }
  }

  private attachDomEvents(): void {
    if (!this.shadow) return;

    // Drag handle
    const handle = this.shadow.querySelector('#hud-pill-handle') || this.shadow.querySelector('#hud-bar-handle');
    if (handle) {
      handle.addEventListener('mousedown', (e: any) => this.onDragStart(e));
    }

    // Record toggle
    const recBtn = this.shadow.querySelector('#btn-record-toggle');
    if (recBtn) {
      recBtn.addEventListener('click', () => {
        if (this.onRecordToggle) this.onRecordToggle();
      });
    }

    // Pin toggle
    const pinBtn = this.shadow.querySelector('#btn-pin');
    if (pinBtn) {
      pinBtn.addEventListener('click', () => {
        this.isPinned = !this.isPinned;
        this.render();
      });
    }

    // Minimize button
    const minBtn = this.shadow.querySelector('#btn-minimize');
    if (minBtn) {
      minBtn.addEventListener('click', () => {
        this.isExpanded = false;
        this.render();
      });
    }

    // Close HUD button
    const closeBtn = this.shadow.querySelector('#btn-close-hud');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this.host) this.host.style.display = 'none';
      });
    }

    // Quick Copy button
    const quickCopyBtn = this.shadow.querySelector('#btn-quick-copy');
    if (quickCopyBtn) {
      quickCopyBtn.addEventListener('click', () => {
        const code = this.getGeneratedCode();
        navigator.clipboard.writeText(code).then(() => this.showToast('Python Script Copied!'));
      });
    }

    // View Code button
    const viewCodeBtn = this.shadow.querySelector('#btn-view-code');
    if (viewCodeBtn) {
      viewCodeBtn.addEventListener('click', () => {
        this.isDrawerOpen = true;
        this.render();
      });
    }

    // Close drawer
    const closeDrawerBtn = this.shadow.querySelector('#btn-close-drawer');
    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', () => {
        this.isDrawerOpen = false;
        this.render();
      });
    }

    // QA Tools
    const setupTool = (id: string, mode: 'assert_text' | 'assert_visible' | 'print_value') => {
      const el = this.shadow?.querySelector(`#${id}`);
      if (el) {
        el.addEventListener('click', () => {
          this.activeAssertMode = this.activeAssertMode === mode ? null : mode;
          if (this.onAssertModeToggle) this.onAssertModeToggle(this.activeAssertMode);
          this.render();
          if (this.activeAssertMode) {
            this.showToast(`Click any element to record ${mode.replace('_', ' ')}`);
          }
        });
      }
    };
    setupTool('tool-assert-text', 'assert_text');
    setupTool('tool-assert-visible', 'assert_visible');
    setupTool('tool-print-value', 'print_value');

    // Engine tabs
    const engineSel = this.shadow.querySelector('#tab-engine-selenium');
    if (engineSel) {
      engineSel.addEventListener('click', () => {
        this.currentEngine = 'selenium';
        this.render();
      });
    }
    const enginePw = this.shadow.querySelector('#tab-engine-playwright');
    if (enginePw) {
      enginePw.addEventListener('click', () => {
        this.currentEngine = 'playwright';
        this.render();
      });
    }

    // Style tabs
    const setStyle = (id: string, style: 'enterprise' | 'simple' | 'pytest' | 'pom') => {
      const el = this.shadow?.querySelector(`#${id}`);
      if (el) {
        el.addEventListener('click', () => {
          this.currentStyle = style;
          this.render();
        });
      }
    };
    setStyle('tab-style-enterprise', 'enterprise');
    setStyle('tab-style-simple', 'simple');
    setStyle('tab-style-pytest', 'pytest');
    setStyle('tab-style-pom', 'pom');

    // Drawer Copy
    const drawerCopy = this.shadow.querySelector('#btn-drawer-copy');
    if (drawerCopy) {
      drawerCopy.addEventListener('click', () => {
        const code = this.getGeneratedCode();
        navigator.clipboard.writeText(code).then(() => this.showToast('Copied to Clipboard!'));
      });
    }

    // Drawer Download
    const drawerDownload = this.shadow.querySelector('#btn-drawer-download');
    if (drawerDownload) {
      drawerDownload.addEventListener('click', () => {
        const code = this.getGeneratedCode();
        const ext = this.currentEngine === 'playwright' ? '.py' : '.py';
        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test_${this.currentStyle}_${Date.now()}${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  private getGeneratedCode(): string {
    const fallbackTestCase: TestCaseModel = this.activeTestCase || createTestCase('Automated Test', window.location.href);

    const targetTestCase = {
      ...fallbackTestCase,
      settings: {
        ...fallbackTestCase.settings,
        codeStyle: this.currentStyle,
        engine: this.currentEngine,
      },
    };

    if (this.currentEngine === 'playwright') {
      return generatePlaywrightScript(targetTestCase);
    }
    return generateSeleniumScript(targetTestCase);
  }

  private updateDrawerCode(): void {
    if (!this.shadow) return;
    const area = this.shadow.querySelector('#drawer-code-area') as HTMLTextAreaElement;
    if (area) {
      area.value = this.getGeneratedCode();
    }
  }

  private showToast(msg: string): void {
    if (!this.shadow) return;
    const toast = this.shadow.querySelector('#hud-toast') as HTMLElement;
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2400);
    }
  }

  // --------------------------------------------------------------------------
  // DRAG & DROP POSITIONING
  // --------------------------------------------------------------------------
  private onDragStart(e: MouseEvent): void {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    if (this.rootEl) {
      const rect = this.rootEl.getBoundingClientRect();
      this.initialLeft = rect.left;
      this.initialTop = rect.top;
      this.rootEl.style.left = `${this.initialLeft}px`;
      this.rootEl.style.top = `${this.initialTop}px`;
      this.rootEl.style.right = 'auto';
    }

    const onMouseMove = (ev: MouseEvent) => {
      if (!this.isDragging || !this.rootEl) return;
      const dx = ev.clientX - this.dragStartX;
      const dy = ev.clientY - this.dragStartY;
      const newLeft = Math.max(10, Math.min(window.innerWidth - 120, this.initialLeft + dx));
      const newTop = Math.max(10, Math.min(window.innerHeight - 60, this.initialTop + dy));
      this.rootEl.style.left = `${newLeft}px`;
      this.rootEl.style.top = `${newTop}px`;
    };

    const onMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.savePosition();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private savePosition(): void {
    if (!this.rootEl) return;
    const rect = this.rootEl.getBoundingClientRect();
    try {
      sessionStorage.setItem('automatex_hud_pos', JSON.stringify({ top: rect.top, left: rect.left }));
    } catch {
      // ignore
    }
  }

  private restorePosition(): void {
    try {
      const saved = sessionStorage.getItem('automatex_hud_pos');
      if (saved && this.rootEl) {
        const { top, left } = JSON.parse(saved);
        if (top >= 0 && left >= 0 && left < window.innerWidth && top < window.innerHeight) {
          this.rootEl.style.left = `${left}px`;
          this.rootEl.style.top = `${top}px`;
          this.rootEl.style.right = 'auto';
        }
      }
    } catch {
      // ignore
    }
  }

  public show(): void {
    if (this.host) this.host.style.display = 'block';
  }

  public hide(): void {
    if (this.host) this.host.style.display = 'none';
  }

  public toggle(): void {
    if (!this.host) return;
    this.host.style.display = this.host.style.display === 'none' ? 'block' : 'none';
  }
}
