import { TestCaseModel } from '../types/model';
import { renderEmptyState, renderStepCard } from './ui-renderer';
import { generateSeleniumScript } from '../generator/python-generator';
import { ExtensionMessage, ElementSelectedPayload } from '../types/messages';

let isRecording = false;
let isInspecting = false;
let activeTestCase: TestCaseModel | null = null;

// DOM Elements
const toggleRecordBtn = document.getElementById('toggleRecordBtn') as HTMLButtonElement;
const toggleInspectBtn = document.getElementById('toggleInspectBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const statusIndicator = document.getElementById('statusIndicator') as HTMLDivElement;
const stepsList = document.getElementById('stepsList') as HTMLDivElement;
const stepsCount = document.getElementById('stepsCount') as HTMLSpanElement;
const tabStepsBtn = document.getElementById('tabStepsBtn') as HTMLButtonElement;
const tabCodeBtn = document.getElementById('tabCodeBtn') as HTMLButtonElement;
const stepsView = document.getElementById('stepsView') as HTMLDivElement;
const codeView = document.getElementById('codeView') as HTMLDivElement;
const pythonCodeOutput = document.getElementById('pythonCodeOutput') as HTMLElement;
const copyCodeBtn = document.getElementById('copyCodeBtn') as HTMLButtonElement;
const inspectionBar = document.getElementById('inspectionBar') as HTMLDivElement;
const inspectedTag = document.getElementById('inspectedTag') as HTMLSpanElement;
const inspectedSelector = document.getElementById('inspectedSelector') as HTMLSpanElement;

// Inspector Drawer Elements
const inspectorDetailsCard = document.getElementById('inspectorDetailsCard') as HTMLDivElement;
const closeInspectCardBtn = document.getElementById('closeInspectCardBtn') as HTMLButtonElement;
const inspectDetailTag = document.getElementById('inspectDetailTag') as HTMLSpanElement;
const inspectMatchBadge = document.getElementById('inspectMatchBadge') as HTMLSpanElement;
const inspectCssVal = document.getElementById('inspectCssVal') as HTMLDivElement;
const inspectXpathVal = document.getElementById('inspectXpathVal') as HTMLDivElement;
const inspectHtmlVal = document.getElementById('inspectHtmlVal') as HTMLElement;
const copyCssBtn = document.getElementById('copyCssBtn') as HTMLButtonElement;
const copyXpathBtn = document.getElementById('copyXpathBtn') as HTMLButtonElement;
const copyHtmlBtn = document.getElementById('copyHtmlBtn') as HTMLButtonElement;
const scrollToBottomBtn = document.getElementById('scrollToBottomBtn') as HTMLButtonElement;
const tabsContent = document.querySelector('.tabs-content') as HTMLElement;

let prevStepCount = 0;

// Initialize Session State
function refreshState(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;

  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATE' }, (response) => {
    if (response) {
      isRecording = response.isRecording;
      activeTestCase = response.activeTestCase;
      updateUI();
    }
  });
}

function setInspectMode(active: boolean): void {
  isInspecting = active;
  if (!toggleInspectBtn) return;

  if (active) {
    toggleInspectBtn.classList.add('inspecting');
    const label = toggleInspectBtn.querySelector('.btn-label');
    if (label) label.textContent = 'Exit Inspect';
    if (statusIndicator) {
      statusIndicator.className = 'status-pill recording';
      const text = statusIndicator.querySelector('.status-text');
      if (text) text.textContent = 'INSPECTING';
    }
  } else {
    toggleInspectBtn.classList.remove('inspecting');
    const label = toggleInspectBtn.querySelector('.btn-label');
    if (label) label.textContent = 'Inspect';
    if (statusIndicator) {
      if (isRecording) {
        statusIndicator.className = 'status-pill recording';
        statusIndicator.querySelector('.status-text')!.textContent = 'RECORDING';
      } else {
        statusIndicator.className = 'status-pill idle';
        statusIndicator.querySelector('.status-text')!.textContent = 'IDLE';
      }
    }
  }
}

function updateUI(): void {
  // Update Recording Button & Status Pill
  if (isRecording) {
    statusIndicator.className = 'status-pill recording';
    statusIndicator.querySelector('.status-text')!.textContent = 'RECORDING';
    toggleRecordBtn.className = 'btn btn-record recording';
    toggleRecordBtn.querySelector('.btn-label')!.textContent = 'Stop Recording';
    toggleRecordBtn.querySelector('.btn-icon')!.textContent = '⏹';
  } else if (!isInspecting) {
    statusIndicator.className = 'status-pill idle';
    statusIndicator.querySelector('.status-text')!.textContent = 'IDLE';
    toggleRecordBtn.className = 'btn btn-record';
    toggleRecordBtn.querySelector('.btn-label')!.textContent = 'Start Recording';
    toggleRecordBtn.querySelector('.btn-icon')!.textContent = '⏺';
  }

  // Update Steps List
  const steps = activeTestCase?.steps || [];
  stepsCount.textContent = steps.length.toString();

  const isNewStepAdded = steps.length > prevStepCount;
  prevStepCount = steps.length;

  if (steps.length === 0) {
    stepsList.innerHTML = renderEmptyState();
    if (scrollToBottomBtn) scrollToBottomBtn.classList.add('hidden');
  } else {
    stepsList.innerHTML = steps.map((step) => renderStepCard(step)).join('');
    attachStepEventListeners();

    // Auto-scroll down to the latest recorded step
    if (isNewStepAdded) {
      setTimeout(() => {
        scrollToLatestStep();
      }, 50);
    }
  }

  // Update Python Code Output
  if (activeTestCase && steps.length > 0) {
    pythonCodeOutput.textContent = generateSeleniumScript(activeTestCase);
  } else {
    pythonCodeOutput.textContent = '# Click Record to start capturing actions and generating Python tests...';
  }
}

function scrollToLatestStep(): void {
  if (tabsContent) {
    tabsContent.scrollTo({
      top: tabsContent.scrollHeight,
      behavior: 'smooth',
    });
  }
  if (scrollToBottomBtn) {
    scrollToBottomBtn.classList.add('hidden');
  }
}

function attachStepEventListeners(): void {
  // Delete Step Buttons
  document.querySelectorAll<HTMLButtonElement>('.delete-step-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const stepId = btn.getAttribute('data-step-id');
      if (stepId && chrome.runtime) {
        chrome.runtime.sendMessage(
          { type: 'DELETE_STEP', payload: { stepId } },
          () => refreshState()
        );
      }
    });
  });

  // Locator Dropdown Change
  document.querySelectorAll<HTMLSelectElement>('.locator-select').forEach((select) => {
    select.addEventListener('change', () => {
      const stepId = select.getAttribute('data-step-id');
      const locatorIndex = parseInt(select.value, 10);
      if (stepId && !isNaN(locatorIndex) && chrome.runtime) {
        chrome.runtime.sendMessage(
          { type: 'UPDATE_STEP_LOCATOR', payload: { stepId, locatorIndex } },
          () => refreshState()
        );
      }
    });
  });

  // Quick Copy Locator Button
  document.querySelectorAll<HTMLButtonElement>('.btn-copy-locator').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const copyVal = btn.getAttribute('data-copy') || '';
      if (!copyVal) return;
      navigator.clipboard.writeText(copyVal).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>✓ Copied</span>';
        setTimeout(() => {
          btn.innerHTML = orig;
        }, 1500);
      });
    });
  });
}

// Toggle Recording Handler
toggleRecordBtn.addEventListener('click', () => {
  if (typeof chrome === 'undefined' || !chrome.runtime) return;

  if (!isRecording) {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const currentTab = tabs.find((t) => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://')) || tabs[0];
      chrome.runtime.sendMessage(
        {
          type: 'START_RECORDING',
          payload: { tabId: currentTab?.id, url: currentTab?.url },
        },
        () => refreshState()
      );
    });
  } else {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, () => refreshState());
  }
});

// Toggle Element Inspector Handler
if (toggleInspectBtn) {
  toggleInspectBtn.addEventListener('click', () => {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;

    if (!isInspecting) {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const currentTab = tabs.find((t) => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://')) || tabs[0];
        if (currentTab?.id) {
          chrome.tabs.sendMessage(currentTab.id, { type: 'START_INSPECTING' }, () => {
            if (chrome.runtime.lastError) {
              // fallback
            }
          });
        }
        chrome.runtime.sendMessage({ type: 'START_INSPECTING', payload: { tabId: currentTab?.id } });
        setInspectMode(true);
      });
    } else {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const currentTab = tabs.find((t) => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://')) || tabs[0];
        if (currentTab?.id) {
          chrome.tabs.sendMessage(currentTab.id, { type: 'STOP_INSPECTING' }, () => {
            if (chrome.runtime.lastError) {
              // fallback
            }
          });
        }
        chrome.runtime.sendMessage({ type: 'STOP_INSPECTING', payload: { tabId: currentTab?.id } });
        setInspectMode(false);
      });
    }
  });
}

// Close Inspector Card
if (closeInspectCardBtn) {
  closeInspectCardBtn.addEventListener('click', () => {
    if (inspectorDetailsCard) {
      inspectorDetailsCard.classList.add('hidden');
    }
  });
}

// Helper to bind copy buttons
function bindCopy(btn: HTMLButtonElement | null, getText: () => string): void {
  if (!btn) return;
  btn.addEventListener('click', () => {
    const val = getText();
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => {
      const orig = btn.innerHTML;
      btn.innerHTML = '<span>✓ Copied!</span>';
      setTimeout(() => {
        btn.innerHTML = orig;
      }, 1500);
    });
  });
}

bindCopy(copyCssBtn, () => inspectCssVal?.textContent || '');
bindCopy(copyXpathBtn, () => inspectXpathVal?.textContent || '');
bindCopy(copyHtmlBtn, () => inspectHtmlVal?.textContent || '');

// Floating Scroll to Bottom Handler & Scroll Detection
if (scrollToBottomBtn) {
  scrollToBottomBtn.addEventListener('click', () => {
    scrollToLatestStep();
  });
}

if (tabsContent) {
  tabsContent.addEventListener('scroll', () => {
    if (!scrollToBottomBtn) return;
    const isScrolledUp = tabsContent.scrollHeight - tabsContent.scrollTop - tabsContent.clientHeight > 80;
    const hasSteps = (activeTestCase?.steps || []).length > 2;
    if (isScrolledUp && hasSteps && !stepsView.classList.contains('hidden')) {
      scrollToBottomBtn.classList.remove('hidden');
    } else {
      scrollToBottomBtn.classList.add('hidden');
    }
  });
}

// Clear Session Handler
clearBtn.addEventListener('click', () => {
  if (typeof chrome === 'undefined' || !chrome.runtime) return;
  chrome.runtime.sendMessage({ type: 'CLEAR_SESSION' }, () => refreshState());
});

// Tab Navigation
tabStepsBtn.addEventListener('click', () => {
  tabStepsBtn.classList.add('active');
  tabCodeBtn.classList.remove('active');
  stepsView.classList.remove('hidden');
  codeView.classList.add('hidden');
});

tabCodeBtn.addEventListener('click', () => {
  tabCodeBtn.classList.add('active');
  tabStepsBtn.classList.remove('active');
  codeView.classList.remove('hidden');
  stepsView.classList.add('hidden');
});

// Copy Code Button
bindCopy(copyCodeBtn, () => pythonCodeOutput?.textContent || '');

// Storage Change Listener for real-time reactivity
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.sessionState || changes.activeTestCase) {
        refreshState();
      }
    }
  });
}

// Message Listener
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message.type === 'HOVER_ELEMENT_INSPECTED') {
      const { tagName, locators } = message.payload;
      if (inspectionBar) {
        inspectionBar.classList.remove('hidden');
        if (inspectedTag) inspectedTag.textContent = `<${tagName}>`;
        if (inspectedSelector) inspectedSelector.textContent = locators[0]?.value || '';
      }
    } else if (message.type === 'ELEMENT_SELECTED') {
      setInspectMode(false);
      const payload: ElementSelectedPayload = message.payload;
      if (inspectorDetailsCard) {
        inspectorDetailsCard.classList.remove('hidden');
        if (inspectDetailTag) inspectDetailTag.textContent = `<${payload.tagName}>`;
        if (inspectMatchBadge) {
          if (payload.matchCount === 1) {
            inspectMatchBadge.className = 'badge-match match-unique';
            inspectMatchBadge.textContent = '✓ 1 match';
          } else if (payload.matchCount === 0) {
            inspectMatchBadge.className = 'badge-match match-none';
            inspectMatchBadge.textContent = '✖ 0 matches';
          } else {
            inspectMatchBadge.className = 'badge-match match-multiple';
            inspectMatchBadge.textContent = `⚠ ${payload.matchCount} matches`;
          }
        }
        if (inspectCssVal) inspectCssVal.textContent = payload.cssSelector;
        if (inspectXpathVal) inspectXpathVal.textContent = payload.xpath;
        if (inspectHtmlVal) inspectHtmlVal.textContent = payload.outerHtml || payload.htmlSnippet || '';
      }
    }
  });
}

// Initial State Fetch
refreshState();
