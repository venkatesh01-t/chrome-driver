import { TestCaseModel, TestStep, LocatorCandidate, ActionType } from './model';

export type MessageType =
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'RECORDED_STEP'
  | 'DELETE_STEP'
  | 'UPDATE_STEP_LOCATOR'
  | 'UPDATE_STEP_ACTION'
  | 'REORDER_STEP'
  | 'UPDATE_STEP_VALUE'
  | 'CLEAR_SESSION'
  | 'GET_SESSION_STATE'
  | 'SESSION_STATE_UPDATE'
  | 'HOVER_ELEMENT_INSPECTED'
  | 'START_INSPECTING'
  | 'STOP_INSPECTING'
  | 'ELEMENT_SELECTED'
  | 'UPDATE_CODE_STYLE'
  | 'UPDATE_ENGINE'
  | 'ADD_NAVIGATE_STEP'
  | 'ADD_WAIT_STEP'
  | 'ADD_TAB_STEP'
  | 'TEST_LOCATOR'
  | 'TEST_LOCATOR_RESULT'
  | 'LOAD_SESSION'
  | 'TOGGLE_HUD'
  | 'START_REPLAY'
  | 'STOP_REPLAY'
  | 'REPLAY_STEP_UPDATE'
  | 'REPLAY_COMPLETE';

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

export interface UpdateStepActionPayload {
  stepId: string;
  action: ActionType;
}

export interface ReorderStepPayload {
  stepId: string;
  direction: 'up' | 'down';
}

export interface UpdateStepValuePayload {
  stepId: string;
  value?: string;
  assertExpected?: string;
}

export interface TestLocatorPayload {
  strategy: string;
  value: string;
}

export interface TestLocatorResultPayload {
  success: boolean;
  matchCount: number;
  tagName?: string;
  text?: string;
}

export interface SessionStateUpdatePayload {
  isRecording: boolean;
  activeTestCase: TestCaseModel | null;
}

export interface HoverElementInspectedPayload {
  tagName: string;
  locators: LocatorCandidate[];
  text?: string;
  componentType?: string;
  componentHierarchy?: string;
}

export interface ElementSelectedPayload {
  tagName: string;
  locators: LocatorCandidate[];
  text?: string;
  htmlSnippet: string;
  cssSelector: string;
  xpath: string;
  matchCount?: number;
  outerHtml?: string;
}

export type ExtensionMessage =
  | { type: 'START_RECORDING'; payload?: StartRecordingPayload }
  | { type: 'STOP_RECORDING'; payload?: StopRecordingPayload }
  | { type: 'RECORDED_STEP'; payload: RecordedStepPayload }
  | { type: 'DELETE_STEP'; payload: DeleteStepPayload }
  | { type: 'UPDATE_STEP_LOCATOR'; payload: UpdateStepLocatorPayload }
  | { type: 'UPDATE_STEP_ACTION'; payload: UpdateStepActionPayload }
  | { type: 'REORDER_STEP'; payload: ReorderStepPayload }
  | { type: 'UPDATE_STEP_VALUE'; payload: UpdateStepValuePayload }
  | { type: 'CLEAR_SESSION' }
  | { type: 'GET_SESSION_STATE' }
  | { type: 'SESSION_STATE_UPDATE'; payload: SessionStateUpdatePayload }
  | { type: 'HOVER_ELEMENT_INSPECTED'; payload: HoverElementInspectedPayload }
  | { type: 'START_INSPECTING' }
  | { type: 'STOP_INSPECTING' }
  | { type: 'ELEMENT_SELECTED'; payload: ElementSelectedPayload }
  | { type: 'UPDATE_CODE_STYLE'; payload: { codeStyle: 'simple' | 'enterprise' | 'pytest' | 'pom' } }
  | { type: 'UPDATE_ENGINE'; payload: { engine: 'selenium' | 'playwright' } }
  | { type: 'ADD_NAVIGATE_STEP'; payload: { url: string } }
  | { type: 'ADD_WAIT_STEP'; payload: { seconds: number } }
  | { type: 'ADD_TAB_STEP'; payload: { tabIndex?: number; tabTitle?: string; tabUrl?: string; url?: string; action?: 'switch_tab' | 'close_tab' } }
  | { type: 'TEST_LOCATOR'; payload: TestLocatorPayload }
  | { type: 'TEST_LOCATOR_RESULT'; payload: TestLocatorResultPayload }
  | { type: 'LOAD_SESSION'; payload: { testCase: TestCaseModel } }
  | { type: 'TOGGLE_HUD' }
  | { type: 'START_REPLAY'; payload?: { stepDelayMs?: number } }
  | { type: 'STOP_REPLAY' }
  | { type: 'REPLAY_STEP_UPDATE'; payload: { stepId: string; stepNumber: number; status: 'running' | 'passed' | 'failed' | 'skipped'; durationMs?: number; error?: string } }
  | { type: 'REPLAY_COMPLETE'; payload: { totalPassed: number; totalFailed: number; totalSteps: number } };

