import { SessionManager } from './session-manager';
import { ExtensionMessage } from '../types/messages';
import { createTestStep } from '../types/model';

const sessionManager = new SessionManager();
sessionManager.restore();

// Do NOT force side-by-side open on action click.
// Instead, let action click toggle the floating in-page HUD toolbar across all tabs without squashing viewports.
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error) => console.error('Error setting panel behavior:', error));
}

if (typeof chrome !== 'undefined' && chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_HUD' }).catch(() => {});
    }
  });
}

// Handle messages from content scripts and side panel
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, sender, sendResponse) => {
      (async () => {
        switch (message.type) {
          case 'GET_SESSION_STATE': {
            sendResponse({
              isRecording: sessionManager.isRecording,
              activeTestCase: sessionManager.activeTestCase,
            });
            break;
          }

          case 'START_RECORDING': {
            let targetUrl = message.payload?.url;
            if (!targetUrl || targetUrl.startsWith('chrome-extension://') || targetUrl.startsWith('chrome://')) {
              const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
              const validTab = activeTabs.find((t) => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
              if (validTab?.url) {
                targetUrl = validTab.url;
              }
            }
            await sessionManager.startRecording({ url: targetUrl });
            // Notify active tab to start recording
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
              const tab = tabs.find((t) => t.url && !t.url.startsWith('chrome-extension://'));
              if (tab?.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' }).catch(() => {});
              }
            });
            sendResponse({ success: true, activeTestCase: sessionManager.activeTestCase });
            break;
          }

          case 'STOP_RECORDING': {
            await sessionManager.stopRecording();
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_RECORDING' }).catch(() => {});
              }
            });
            sendResponse({ success: true });
            break;
          }

          case 'RECORDED_STEP': {
            if (sessionManager.isRecording && message.payload?.step) {
              const stepUrl = message.payload.url || sender.tab?.url;
              await sessionManager.addStep(message.payload.step, stepUrl);
            }
            sendResponse({ success: true });
            break;
          }

          case 'DELETE_STEP': {
            if (message.payload?.stepId) {
              await sessionManager.deleteStep(message.payload.stepId);
            }
            sendResponse({ success: true });
            break;
          }

          case 'UPDATE_STEP_LOCATOR': {
            if (message.payload?.stepId && typeof message.payload.locatorIndex === 'number') {
              await sessionManager.updateStepLocator(
                message.payload.stepId,
                message.payload.locatorIndex
              );
            }
            sendResponse({ success: true });
            break;
          }

          case 'UPDATE_STEP_ACTION': {
            if (message.payload?.stepId && message.payload?.action) {
              await sessionManager.updateStepAction(
                message.payload.stepId,
                message.payload.action
              );
            }
            sendResponse({ success: true });
            break;
          }

          case 'REORDER_STEP': {
            if (message.payload?.stepId && message.payload?.direction) {
              await sessionManager.reorderStep(
                message.payload.stepId,
                message.payload.direction
              );
            }
            sendResponse({ success: true });
            break;
          }

          case 'UPDATE_STEP_VALUE': {
            if (message.payload?.stepId) {
              await sessionManager.updateStepValue(
                message.payload.stepId,
                message.payload.value,
                message.payload.assertExpected
              );
            }
            sendResponse({ success: true });
            break;
          }

          case 'TEST_LOCATOR': {
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
              const tab = tabs.find((t) => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://')) || tabs[0];
              if (tab?.id) {
                chrome.tabs.sendMessage(tab.id, message, (response) => {
                  sendResponse(response || { success: false, matchCount: 0 });
                });
              } else {
                sendResponse({ success: false, matchCount: 0 });
              }
            });
            return true;
          }

          case 'CLEAR_SESSION': {
            await sessionManager.clearSession();
            sendResponse({ success: true });
            break;
          }

          case 'START_INSPECTING': {
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
              const tab = tabs.find((t) => t.url && !t.url.startsWith('chrome-extension://'));
              if (tab?.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'START_INSPECTING' }).catch(() => {});
              }
            });
            sendResponse({ success: true });
            break;
          }

          case 'STOP_INSPECTING': {
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
              const tab = tabs.find((t) => t.url && !t.url.startsWith('chrome-extension://'));
              if (tab?.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'STOP_INSPECTING' }).catch(() => {});
              }
            });
            sendResponse({ success: true });
            break;
          }

          case 'UPDATE_CODE_STYLE': {
            if (message.payload?.codeStyle) {
              await sessionManager.updateCodeStyle(message.payload.codeStyle);
            }
            sendResponse({ success: true });
            break;
          }

          case 'UPDATE_ENGINE': {
            if (message.payload?.engine) {
              await sessionManager.updateEngine(message.payload.engine);
            }
            sendResponse({ success: true });
            break;
          }

          case 'ADD_NAVIGATE_STEP': {
            if (message.payload?.url) {
              const step = createTestStep({
                stepNumber: 0,
                action: 'navigate',
                target: { tagName: 'window', locators: [], selectedLocatorIndex: 0, componentType: 'generic' },
                value: message.payload.url,
                waitCondition: 'presence',
              });
              await sessionManager.addStep(step, message.payload.url);
            }
            sendResponse({ success: true });
            break;
          }

          case 'ADD_WAIT_STEP': {
            const seconds = message.payload?.seconds || 2;
            const step = createTestStep({
              stepNumber: 0,
              action: 'wait',
              target: { tagName: 'page', locators: [], selectedLocatorIndex: 0, componentType: 'generic' },
              waitCondition: 'presence',
              waitDuration: seconds,
            });
            await sessionManager.addStep(step);
            sendResponse({ success: true });
            break;
          }

          case 'ADD_TAB_STEP': {
            const action = message.payload?.action || 'switch_tab';
            const step = createTestStep({
              stepNumber: 0,
              action,
              target: {
                tagName: 'window',
                locators: [],
                selectedLocatorIndex: 0,
                componentType: 'tab',
                text: action === 'switch_tab' ? 'Switch to latest tab' : 'Close active tab',
              },
              value: message.payload?.url || '',
              waitCondition: 'presence',
            });
            await sessionManager.addStep(step);
            sendResponse({ success: true });
            break;
          }

          case 'LOAD_SESSION': {
            if (message.payload?.testCase) {
              await sessionManager.loadTestCase(message.payload.testCase);
            }
            sendResponse({ success: true, activeTestCase: sessionManager.activeTestCase });
            break;
          }

          default:
            sendResponse({ unknown: true });
        }
      })();

      return true; // Keep message channel open for async response
    }
  );
}

// Keep multi-tab recording synchronized across all tabs and navigations
if (typeof chrome !== 'undefined' && chrome.tabs) {
  let lastRecordedTabId: number | null = null;

  if (chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (
        sessionManager.isRecording &&
        changeInfo.status === 'complete' &&
        tab.url &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('chrome-extension://')
      ) {
        chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' }).catch(() => {});
      }
    });
  }

  if (chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      if (sessionManager.isRecording) {
        if (lastRecordedTabId !== null && lastRecordedTabId !== activeInfo.tabId) {
          // Automatic cross-tab switch detection while recording
          const step = createTestStep({
            stepNumber: 0,
            action: 'switch_tab',
            target: { tagName: 'window', locators: [], selectedLocatorIndex: 0, componentType: 'tab', text: 'Switch to new tab' },
            waitCondition: 'presence',
          });
          await sessionManager.addStep(step);
        }
        lastRecordedTabId = activeInfo.tabId;
        chrome.tabs.sendMessage(activeInfo.tabId, { type: 'START_RECORDING' }).catch(() => {});
      } else {
        lastRecordedTabId = activeInfo.tabId;
      }
    });
  }
}

