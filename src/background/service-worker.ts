import { SessionManager } from './session-manager';
import { ExtensionMessage } from '../types/messages';

const sessionManager = new SessionManager();
sessionManager.restore();

// Handle Side Panel open on extension action click
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Error setting panel behavior:', error));
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

          case 'CLEAR_SESSION': {
            await sessionManager.clearSession();
            sendResponse({ success: true });
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
