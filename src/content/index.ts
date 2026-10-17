import { EventRecorder } from './event-recorder';
import { HudManager } from './hud/hud-manager';

// Instantiate recorder on page injection
const recorder = new EventRecorder();
let hud: HudManager | null = null;

// Only mount in-page floating HUD on the top window frame (prevent duplicate nested HUDs in iframes)
if (typeof window !== 'undefined' && window === window.top) {
  hud = new HudManager();

  // Connect recorder steps directly to HUD status and badge
  recorder.setStepRecordedCallback((step) => {
    if (hud) {
      const desc = step.target?.text || step.target?.labelText || step.value || `<${step.target?.tagName || 'el'}>`;
      hud.updateState({
        stepCount: ((hud as any).stepCount || 0) + 1,
        lastActionText: `${step.action.toUpperCase()}: ${desc.substring(0, 32)}`,
      });
    }
  });

  // Connect HUD buttons to recorder and background session
  hud.setCallbacks({
    onRecordToggle: () => {
      if (recorder.getIsRecording()) {
        chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, () => {
          recorder.stop();
          hud?.updateState({ isRecording: false });
        });
      } else {
        chrome.runtime.sendMessage({ type: 'START_RECORDING', payload: { url: window.location.href } }, () => {
          recorder.start();
          hud?.updateState({ isRecording: true, stepCount: 0 });
        });
      }
    },
    onAssertModeToggle: (mode) => {
      recorder.setAssertMode(mode);
    },
  });
}

// Check session state on load
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATE' }, (response) => {
    if (response) {
      if (response.isRecording) {
        recorder.start();
      }
      if (hud) {
        const stepCount = response.activeTestCase?.steps?.length || 0;
        hud.updateState({
          isRecording: response.isRecording,
          stepCount,
          activeTestCase: response.activeTestCase,
        });
      }
    }
  });

  // Listen for broadcast session state updates from background or side panel
  if (chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg: any) => {
      if (msg.type === 'SESSION_STATE_UPDATE') {
        const isRec = msg.payload?.isRecording;
        const stepCount = msg.payload?.activeTestCase?.steps?.length || 0;
        hud?.updateState({
          isRecording: isRec,
          stepCount,
          activeTestCase: msg.payload?.activeTestCase,
        });
        if (isRec) {
          recorder.start();
        } else {
          recorder.stop();
        }
      } else if (msg.type === 'START_RECORDING') {
        recorder.start();
        hud?.updateState({ isRecording: true });
      } else if (msg.type === 'STOP_RECORDING') {
        recorder.stop();
        hud?.updateState({ isRecording: false });
      } else if (msg.type === 'TOGGLE_HUD') {
        hud?.toggle();
      }
    });
  }
}
