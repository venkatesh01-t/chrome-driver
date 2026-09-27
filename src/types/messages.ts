import { TestCaseModel, TestStep, LocatorCandidate } from './model';

export type MessageType =
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'RECORDED_STEP'
  | 'DELETE_STEP'
  | 'UPDATE_STEP_LOCATOR'
  | 'CLEAR_SESSION'
  | 'GET_SESSION_STATE'
  | 'SESSION_STATE_UPDATE'
  | 'HOVER_ELEMENT_INSPECTED';

export interface StartRecordingPayload {
  tabId?: number;
  url?: string;
}

export interface StopRecordingPayload {
  tabId?: number;
}

export interface RecordedStepPayload {
  step: TestStep;
  url?: string;
}

export interface DeleteStepPayload {
  stepId: string;
}

export interface UpdateStepLocatorPayload {
  stepId: string;
  locatorIndex: number;
}

export interface SessionStateUpdatePayload {
  isRecording: boolean;
  activeTestCase: TestCaseModel | null;
}

export interface HoverElementInspectedPayload {
  tagName: string;
  locators: LocatorCandidate[];
  text?: string;
}

export type ExtensionMessage =
  | { type: 'START_RECORDING'; payload?: StartRecordingPayload }
  | { type: 'STOP_RECORDING'; payload?: StopRecordingPayload }
  | { type: 'RECORDED_STEP'; payload: RecordedStepPayload }
  | { type: 'DELETE_STEP'; payload: DeleteStepPayload }
  | { type: 'UPDATE_STEP_LOCATOR'; payload: UpdateStepLocatorPayload }
  | { type: 'CLEAR_SESSION' }
  | { type: 'GET_SESSION_STATE' }
  | { type: 'SESSION_STATE_UPDATE'; payload: SessionStateUpdatePayload }
  | { type: 'HOVER_ELEMENT_INSPECTED'; payload: HoverElementInspectedPayload };
