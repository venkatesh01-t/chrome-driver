import { TestCaseModel } from '../types/model';
import { renderEmptyState, renderStepCard } from './ui-renderer';
import { generateAutomationScript } from '../generator/python-generator';
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
const downloadCodeBtn = document.getElementById('downloadCodeBtn') as HTMLButtonElement;
const codeLangLabel = document.getElementById('codeLangLabel') as HTMLDivElement;
const addTabBtn = document.getElementById('addTabBtn') as HTMLButtonElement;
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

  // Update Engine and Code Style
  const activeEngine = activeTestCase?.settings?.engine || 'selenium';
  const activeStyle = activeTestCase?.settings?.codeStyle || 'simple';
  const styleTitle = activeStyle.charAt(0).toUpperCase() + activeStyle.slice(1);

  if (codeLangLabel) {
    codeLangLabel.textContent = activeEngine === 'playwright'
      ? `Python (Playwright - ${styleTitle})`
      : `Python (Selenium 4 - ${styleTitle})`;
  }

  // Update Python Code Output
  if (activeTestCase && steps.length > 0) {
    pythonCodeOutput.textContent = generateAutomationScript(activeTestCase);
  } else {
    pythonCodeOutput.textContent = `# Click Record to start capturing actions and generating ${activeEngine === 'playwright' ? 'Playwright' : 'Selenium'} tests...`;
  }

  // Update Engine Selector Buttons
  document.querySelectorAll<HTMLButtonElement>('.engine-btn').forEach((btn) => {
    if (btn.getAttribute('data-engine') === activeEngine) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update Code Style Selector Buttons
  document.querySelectorAll<HTMLButtonElement>('.style-btn').forEach((btn) => {
    if (btn.getAttribute('data-style') === activeStyle) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
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

  // Step Action Selector Change
  document.querySelectorAll<HTMLSelectElement>('.step-action-select').forEach((select) => {
    select.addEventListener('change', () => {
      const stepId = select.getAttribute('data-step-id');
      const action = select.value as import('../types/model').ActionType;
      if (stepId && action && typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(
          { type: 'UPDATE_STEP_ACTION', payload: { stepId, action } },
          () => refreshState()
        );
      }
    });
  });

  // Live Test Locator Button
  document.querySelectorAll<HTMLButtonElement>('.btn-test-locator').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const strategy = btn.getAttribute('data-strategy') || 'css';
      const value = btn.getAttribute('data-val') || '';
      if (!value || typeof chrome === 'undefined' || !chrome.runtime) return;

      const origHtml = btn.innerHTML;
      btn.innerHTML = '<span>⏳ Testing</span>';

      chrome.runtime.sendMessage(
        { type: 'TEST_LOCATOR', payload: { strategy, value } },
        (res) => {
          if (res && res.matchCount > 0) {
            btn.className = 'btn-test-locator success';
            btn.innerHTML = `<span>✓ ${res.matchCount} Found</span>`;
          } else {
            btn.className = 'btn-test-locator fail';
            btn.innerHTML = '<span>✖ 0 Found</span>';
          }
          setTimeout(() => {
            btn.className = 'btn-test-locator';
            btn.innerHTML = origHtml;
          }, 2500);
        }
      );
    });
  });

  // Reorder Step Buttons (Move Up / Down)
  document.querySelectorAll<HTMLButtonElement>('.reorder-step-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const stepId = btn.getAttribute('data-step-id');
      const direction = btn.getAttribute('data-dir') as 'up' | 'down';
      if (stepId && direction && typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(
          { type: 'REORDER_STEP', payload: { stepId, direction } },
          () => refreshState()
        );
      }
    });
  });

  // Editable Step Inputs (Value / Assertion text)
  document.querySelectorAll<HTMLInputElement>('.step-edit-input').forEach((input) => {
    const handleUpdate = () => {
      const stepId = input.getAttribute('data-step-id');
      const field = input.getAttribute('data-field');
      const val = input.value;
      if (stepId && typeof chrome !== 'undefined' && chrome.runtime) {
        const payload: { stepId: string; value?: string; assertExpected?: string } = { stepId };
        if (field === 'value') payload.value = val;
        if (field === 'assertExpected') payload.assertExpected = val;
        chrome.runtime.sendMessage(
          { type: 'UPDATE_STEP_VALUE', payload },
          () => refreshState()
        );
      }
    };
    input.addEventListener('change', handleUpdate);
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

// Download Python Script Button
if (downloadCodeBtn) {
  downloadCodeBtn.addEventListener('click', () => {
    const code = pythonCodeOutput?.textContent || '';
    if (!code || code.startsWith('# Click Record')) {
      alert('Please record some steps first to generate Python code!');
      return;
    }
    const engine = activeTestCase?.settings?.engine || 'selenium';
    const style = activeTestCase?.settings?.codeStyle || 'simple';
    const filename = `test_${engine}_${style}.py`;

    const blob = new Blob([code], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// Export & Import JSON Handlers
function exportSessionJson(): void {
  if (!activeTestCase || (activeTestCase.steps || []).length === 0) {
    alert('No recorded steps found to export!');
    return;
  }
  const jsonStr = JSON.stringify(activeTestCase, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (activeTestCase.name || 'session').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  a.download = `${safeName}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const exportJsonBtn = document.getElementById('exportJsonBtn') as HTMLButtonElement;
const exportJsonCodeBtn = document.getElementById('exportJsonCodeBtn') as HTMLButtonElement;
const importJsonBtn = document.getElementById('importJsonBtn') as HTMLButtonElement;
const importJsonInput = document.getElementById('importJsonInput') as HTMLInputElement;

if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', exportSessionJson);
}
if (exportJsonCodeBtn) {
  exportJsonCodeBtn.addEventListener('click', exportSessionJson);
}
if (importJsonBtn && importJsonInput) {
  importJsonBtn.addEventListener('click', () => {
    importJsonInput.value = '';
    importJsonInput.click();
  });

  importJsonInput.addEventListener('change', () => {
    const file = importJsonInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.steps)) {
          alert('Invalid session JSON format: Missing "steps" array.');
          return;
        }
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage(
            { type: 'LOAD_SESSION', payload: { testCase: parsed } },
            () => {
              refreshState();
              alert(`Successfully loaded session "${parsed.name || 'Untitled'}" with ${parsed.steps.length} steps!`);
            }
          );
        }
      } catch (err) {
        alert('Failed to parse JSON file: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
  });
}

// Engine Switching (Selenium 4 vs Playwright)
document.querySelectorAll<HTMLButtonElement>('.engine-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const engine = btn.getAttribute('data-engine') as 'selenium' | 'playwright';
    if (!engine) return;
    document.querySelectorAll('.engine-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE', payload: { engine } }, () => refreshState());
    }
  });
});

// Code Style Switching
document.querySelectorAll<HTMLButtonElement>('.style-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const style = btn.getAttribute('data-style') as 'simple' | 'enterprise' | 'pytest' | 'pom';
    if (!style) return;
    document.querySelectorAll('.style-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'UPDATE_CODE_STYLE', payload: { codeStyle: style } }, () => refreshState());
    }
  });
});

// Quick Action: Add Tab Switch Step
if (addTabBtn) {
  addTabBtn.addEventListener('click', () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const tabIndexStr = prompt('Enter target tab index (e.g. -1 for latest opened tab, 0 for first tab):', '-1');
      if (tabIndexStr !== null && chrome.runtime) {
        const parsedIdx = parseInt(tabIndexStr, 10);
        chrome.runtime.sendMessage(
          {
            type: 'ADD_TAB_STEP',
            payload: {
              tabIndex: isNaN(parsedIdx) ? -1 : parsedIdx,
              tabTitle: currentTab?.title || 'Browser Tab',
              tabUrl: currentTab?.url || '',
            },
          },
          () => refreshState()
        );
      }
    });
  });
}

// Quick Action: Add Navigate Step
document.getElementById('addNavigateBtn')?.addEventListener('click', () => {
  const url = prompt('Enter URL to navigate to:');
  if (url && typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'ADD_NAVIGATE_STEP', payload: { url } }, () => refreshState());
  }
});

// Quick Action: Add Wait Step
document.getElementById('addWaitBtn')?.addEventListener('click', () => {
  const secs = prompt('Wait duration in seconds:', '2');
  if (secs && typeof chrome !== 'undefined' && chrome.runtime) {
    const seconds = parseInt(secs, 10) || 2;
    chrome.runtime.sendMessage({ type: 'ADD_WAIT_STEP', payload: { seconds } }, () => refreshState());
  }
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
