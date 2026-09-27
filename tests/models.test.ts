import { describe, it, expect } from 'vitest';
import { createTestCase, createTestStep, TestCaseModel, TestStep } from '../src/types/model';
import { ExtensionMessage } from '../src/types/messages';

describe('Core Data Models', () => {
  it('creates a valid TestCaseModel with defaults', () => {
    const testCase: TestCaseModel = createTestCase('Login Flow Test', 'https://example.com/login');

    expect(testCase.id).toBeDefined();
    expect(testCase.name).toBe('Login Flow Test');
    expect(testCase.url).toBe('https://example.com/login');
    expect(testCase.steps).toEqual([]);
    expect(testCase.settings.timeout).toBe(10);
    expect(testCase.settings.useExplicitWait).toBe(true);
    expect(testCase.settings.maskSensitiveData).toBe(true);
    expect(testCase.createdAt).toBeGreaterThan(0);
    expect(testCase.updatedAt).toBeGreaterThan(0);
  });

  it('creates a valid TestStep with locator candidates', () => {
    const step: TestStep = createTestStep({
      stepNumber: 1,
      action: 'click',
      target: {
        tagName: 'button',
        locators: [
          { strategy: 'id', value: 'submit-btn', isUnique: true, matchCount: 1, score: 100 },
          { strategy: 'css', value: '#submit-btn', isUnique: true, matchCount: 1, score: 85 }
        ],
        selectedLocatorIndex: 0,
        text: 'Sign In'
      },
      waitCondition: 'clickable'
    });

    expect(step.id).toBeDefined();
    expect(step.action).toBe('click');
    expect(step.target.locators.length).toBe(2);
    expect(step.target.selectedLocatorIndex).toBe(0);
    expect(step.waitCondition).toBe('clickable');
  });

  it('validates extension message structures', () => {
    const startMsg: ExtensionMessage = {
      type: 'START_RECORDING',
      payload: { tabId: 101, url: 'https://example.com' }
    };
    expect(startMsg.type).toBe('START_RECORDING');

    const stepMsg: ExtensionMessage = {
      type: 'RECORDED_STEP',
      payload: {
        step: createTestStep({
          stepNumber: 1,
          action: 'type',
          target: {
            tagName: 'input',
            locators: [{ strategy: 'name', value: 'username', isUnique: true, matchCount: 1, score: 90 }],
            selectedLocatorIndex: 0
          },
          value: 'admin_user',
          waitCondition: 'visible'
        })
      }
    };
    expect(stepMsg.type).toBe('RECORDED_STEP');
  });
});
