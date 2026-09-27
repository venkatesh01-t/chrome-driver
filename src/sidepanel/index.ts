import { TestCaseModel } from '../types/model';
import { renderEmptyState, renderStepCard } from './ui-renderer';
import { generateSeleniumScript } from '../generator/python-generator';
import { ExtensionMessage } from '../types/messages';

let isRecording = false;
let activeTestCase: TestCaseModel | null = null;

// DOM Elements
const toggleRecordBtn = document.getElementById('toggleRecordBtn') as HTMLButtonElement;
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

function updateUI(): void {
  // Update Recording Button & Status Pill
  if (isRecording) {
    statusIndicator.className = 'status-pill recording';
    statusIndicator.querySelector('.status-text')!.textContent = 'RECORDING';
    toggleRecordBtn.className = 'btn btn-record recording';
    toggleRecordBtn.querySelector('.btn-label')!.textContent = 'Stop Recording';
    toggleRecordBtn.querySelector('.btn-icon')!.textContent = '⏹';
  } else {
    statusIndicator.className = 'status-pill idle';
    statusIndicator.querySelector('.status-text')!.textContent = 'IDLE';
    toggleRecordBtn.className = 'btn btn-record';
    toggleRecordBtn.querySelector('.btn-label')!.textContent = 'Start Recording';
    toggleRecordBtn.querySelector('.btn-icon')!.textContent = '⏺';
  }

  // Update Steps List
  const steps = activeTestCase?.steps || [];
  stepsCount.textContent = steps.length.toString();

  if (steps.length === 0) {
    stepsList.innerHTML = renderEmptyState();
  } else {
    stepsList.innerHTML = steps.map((step) => renderStepCard(step)).join('');
    attachStepEventListeners();
  }

  // Update Python Code Output
  if (activeTestCase && steps.length > 0) {
    pythonCodeOutput.textContent = generateSeleniumScript(activeTestCase);
  } else {
    pythonCodeOutput.textContent = '# Click Record to start capturing actions and generating Python tests...';
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
copyCodeBtn.addEventListener('click', () => {
  const code = pythonCodeOutput.textContent || '';
  navigator.clipboard.writeText(code).then(() => {
    const originalText = copyCodeBtn.innerHTML;
    copyCodeBtn.innerHTML = '<span>✓ Copied!</span>';
    setTimeout(() => {
      copyCodeBtn.innerHTML = originalText;
    }, 1800);
  });
});

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

// Message Listener for hover inspection bar updates
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message.type === 'HOVER_ELEMENT_INSPECTED') {
      const { tagName, locators } = message.payload;
      inspectionBar.classList.remove('hidden');
      inspectedTag.textContent = `<${tagName}>`;
      inspectedSelector.textContent = locators[0]?.value || '';
    }
  });
}

// Initial State Fetch
refreshState();
