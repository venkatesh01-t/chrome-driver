import { EventRecorder } from './event-recorder';

// Instantiate recorder on page injection
const recorder = new EventRecorder();

// Check if recording is already active in background session
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATE' }, (response) => {
    if (response && response.isRecording) {
      recorder.start();
    }
  });
}
