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
            const url = message.payload?.url || sender.tab?.url;
            await sessionManager.startRecording({ url });
            // Notify active tab to start recording
            if (sender.tab?.id) {
              chrome.tabs.sendMessage(sender.tab.id, { type: 'START_RECORDING' }).catch(() => {});
            } else {
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                  chrome.tabs.sendMessage(tabs[0].id, { type: 'START_RECORDING' }).catch(() => {});
                }
              });
            }
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
              await sessionManager.addStep(message.payload.step);
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
