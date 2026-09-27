export type LocatorStrategy =
  | 'id'
  | 'data-testid'
  | 'name'
  | 'aria-label'
  | 'css'
  | 'xpath'
  | 'absolute-xpath';

export interface LocatorCandidate {
  strategy: LocatorStrategy;
  value: string;
  isUnique: boolean;
  matchCount: number;
  score: number;
  warning?: 'multiple_matches' | 'dynamic_id' | 'dom_dependent' | 'no_matches';
  shadowHostSelector?: string;
  isShadowDom?: boolean;
}

export type ActionType =
  | 'click'
  | 'type'
  | 'clear'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'hover';

export interface TargetElementModel {
  tagName: string;
  locators: LocatorCandidate[];
  selectedLocatorIndex: number;
  text?: string;
  isSensitive?: boolean;
  semanticType?: string;
  labelText?: string;
  shadowHostSelector?: string;
  isShadowDom?: boolean;
}

export interface TestStep {
  id: string;
  stepNumber: number;
  action: ActionType;
  target: TargetElementModel;
  value?: string;
  isSensitive?: boolean;
  variableName?: string;
  waitCondition: 'clickable' | 'visible' | 'presence';
  timestamp: number;
}

export interface TestCaseSettings {
  timeout: number;
  useExplicitWait: boolean;
  maskSensitiveData: boolean;
}

export interface TestCaseModel {
  id: string;
  name: string;
  url: string;
  steps: TestStep[];
  settings: TestCaseSettings;
  createdAt: number;
  updatedAt: number;
}

export function createTestCase(name: string, url: string = ''): TestCaseModel {
  const now = Date.now();
  return {
    id: `tc_${now}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    url,
    steps: [],
    settings: {
      timeout: 10,
      useExplicitWait: true,
      maskSensitiveData: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createTestStep(params: {
  stepNumber: number;
  action: ActionType;
  target: TargetElementModel;
  value?: string;
  isSensitive?: boolean;
  variableName?: string;
  waitCondition?: 'clickable' | 'visible' | 'presence';
}): TestStep {
  return {
    id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    stepNumber: params.stepNumber,
    action: params.action,
    target: params.target,
    value: params.value,
    isSensitive: params.isSensitive ?? false,
    variableName: params.variableName,
    waitCondition: params.waitCondition ?? (params.action === 'click' ? 'clickable' : 'visible'),
    timestamp: Date.now(),
  };
}
