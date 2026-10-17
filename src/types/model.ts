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
  shadowHostPath?: string[];
  isShadowDom?: boolean;
}

export type ActionType =
  | 'click'
  | 'type'
  | 'clear'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'hover'
  | 'assert_visible'
  | 'assert_text'
  | 'assert_attribute'
  | 'print_value'
  | 'navigate'
  | 'switch_tab'
  | 'close_tab'
  | 'switch_iframe'
  | 'press_key'
  | 'scroll'
  | 'upload_file'
  | 'drag_drop'
  | 'wait';

export type ComponentType =
  | 'header'
  | 'navbar'
  | 'footer'
  | 'sidebar'
  | 'modal'
  | 'dialog'
  | 'drawer'
  | 'dropdown'
  | 'menu'
  | 'table'
  | 'tab'
  | 'card'
  | 'form'
  | 'button'
  | 'link'
  | 'input'
  | 'image'
  | 'iframe'
  | 'hero'
  | 'accordion'
  | 'tooltip'
  | 'breadcrumb'
  | 'pagination'
  | 'generic';

export interface TargetElementModel {
  tagName: string;
  locators: LocatorCandidate[];
  selectedLocatorIndex: number;
  text?: string;
  isSensitive?: boolean;
  semanticType?: string;
  labelText?: string;
  shadowHostSelector?: string;
  shadowHostPath?: string[];
  isShadowDom?: boolean;
  componentType?: ComponentType;
  componentHierarchy?: string;
  dataFeedType?: string;
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
  assertExpected?: string;
  assertAttribute?: string;
  keyCombo?: string;
  dragTarget?: TargetElementModel;
  iframePath?: string;
  waitDuration?: number;
  tabIndex?: number;
  tabTitle?: string;
  tabUrl?: string;
}

export interface TestCaseSettings {
  timeout: number;
  useExplicitWait: boolean;
  maskSensitiveData: boolean;
  codeStyle: 'simple' | 'enterprise' | 'pytest';
  engine?: 'selenium' | 'playwright';
  selfHealing?: boolean;
  stealthMode?: boolean;
  autoWaitStabilization?: boolean;
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
      codeStyle: 'simple',
      engine: 'selenium',
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createTestStep(params: {
  stepNumber: number;
  action: ActionType;
  target?: TargetElementModel;
  value?: string;
  isSensitive?: boolean;
  variableName?: string;
  waitCondition?: 'clickable' | 'visible' | 'presence';
  assertExpected?: string;
  assertAttribute?: string;
  keyCombo?: string;
  dragTarget?: TargetElementModel;
  iframePath?: string;
  waitDuration?: number;
  tabIndex?: number;
  tabTitle?: string;
  tabUrl?: string;
}): TestStep {
  const defaultTarget: TargetElementModel = {
    tagName: params.action === 'switch_tab' ? 'tab' : 'element',
    locators: [],
    selectedLocatorIndex: 0,
  };

  return {
    id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    stepNumber: params.stepNumber,
    action: params.action,
    target: params.target || defaultTarget,
    value: params.value,
    isSensitive: params.isSensitive ?? false,
    variableName: params.variableName,
    waitCondition: params.waitCondition ?? (params.action === 'click' ? 'clickable' : 'visible'),
    timestamp: Date.now(),
    assertExpected: params.assertExpected,
    assertAttribute: params.assertAttribute,
    keyCombo: params.keyCombo,
    dragTarget: params.dragTarget,
    iframePath: params.iframePath,
    waitDuration: params.waitDuration,
    tabIndex: params.tabIndex,
    tabTitle: params.tabTitle,
    tabUrl: params.tabUrl,
  };
}
