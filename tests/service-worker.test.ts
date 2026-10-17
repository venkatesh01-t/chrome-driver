import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager, StorageAdapter } from '../src/background/session-manager';
import { createTestStep } from '../src/types/model';

class MockStorageAdapter implements StorageAdapter {
  private store = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.store.get(key) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

describe('SessionManager (Background Core)', () => {
  let storage: MockStorageAdapter;
  let sessionManager: SessionManager;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    sessionManager = new SessionManager(storage);
  });

  it('starts a recording session and persists test case model', async () => {
    expect(sessionManager.isRecording).toBe(false);

    await sessionManager.startRecording({ url: 'https://example.com/checkout' });

    expect(sessionManager.isRecording).toBe(true);
    expect(sessionManager.activeTestCase).not.toBeNull();
    expect(sessionManager.activeTestCase?.url).toBe('https://example.com/checkout');

    const persisted = await storage.get<any>('activeTestCase');
    expect(persisted).not.toBeNull();
    expect(persisted.url).toBe('https://example.com/checkout');
  });

  it('appends recorded steps sequentially', async () => {
    await sessionManager.startRecording({ url: 'https://example.com' });

    const step1 = createTestStep({
      stepNumber: 1,
      action: 'click',
      target: {
        tagName: 'button',
        locators: [{ strategy: 'id', value: 'add-cart', isUnique: true, matchCount: 1, score: 100 }],
        selectedLocatorIndex: 0,
      },
    });

    const step2 = createTestStep({
      stepNumber: 2,
      action: 'type',
      target: {
        tagName: 'input',
        locators: [{ strategy: 'name', value: 'quantity', isUnique: true, matchCount: 1, score: 90 }],
        selectedLocatorIndex: 0,
      },
      value: '3',
    });

    await sessionManager.addStep(step1);
    await sessionManager.addStep(step2);

    expect(sessionManager.activeTestCase?.steps.length).toBe(2);
    expect(sessionManager.activeTestCase?.steps[0].action).toBe('click');
    expect(sessionManager.activeTestCase?.steps[1].action).toBe('type');
    expect(sessionManager.activeTestCase?.steps[1].value).toBe('3');
  });

  it('allows deleting a step and switching locator strategies', async () => {
    await sessionManager.startRecording({ url: 'https://example.com' });

    const step = createTestStep({
      stepNumber: 1,
      action: 'click',
      target: {
        tagName: 'button',
        locators: [
          { strategy: 'id', value: 'dynamic-123', isUnique: false, matchCount: 2, score: 40 },
          { strategy: 'css', value: '.btn-submit', isUnique: true, matchCount: 1, score: 80 },
        ],
        selectedLocatorIndex: 0,
      },
    });

    await sessionManager.addStep(step);
    expect(sessionManager.activeTestCase?.steps[0].target.selectedLocatorIndex).toBe(0);

    // Switch locator to index 1 (.btn-submit)
    await sessionManager.updateStepLocator(step.id, 1);
    expect(sessionManager.activeTestCase?.steps[0].target.selectedLocatorIndex).toBe(1);

    // Delete step
    await sessionManager.deleteStep(step.id);
    expect(sessionManager.activeTestCase?.steps.length).toBe(0);
  });

  it('supports reordering steps up and down with automatic step numbering', async () => {
    await sessionManager.startRecording({ url: 'https://example.com' });

    const stepA = createTestStep({
      stepNumber: 1,
      action: 'click',
      target: { tagName: 'button', locators: [], selectedLocatorIndex: 0 },
    });
    const stepB = createTestStep({
      stepNumber: 2,
      action: 'type',
      target: { tagName: 'input', locators: [], selectedLocatorIndex: 0 },
      value: 'hello',
    });

    await sessionManager.addStep(stepA);
    await sessionManager.addStep(stepB);

    expect(sessionManager.activeTestCase?.steps[0].action).toBe('click');
    expect(sessionManager.activeTestCase?.steps[1].action).toBe('type');

    // Move step B up
    await sessionManager.reorderStep(stepB.id, 'up');
    expect(sessionManager.activeTestCase?.steps[0].id).toBe(stepB.id);
    expect(sessionManager.activeTestCase?.steps[0].stepNumber).toBe(1);
    expect(sessionManager.activeTestCase?.steps[1].id).toBe(stepA.id);
    expect(sessionManager.activeTestCase?.steps[1].stepNumber).toBe(2);

    // Move step B down
    await sessionManager.reorderStep(stepB.id, 'down');
    expect(sessionManager.activeTestCase?.steps[0].id).toBe(stepA.id);
    expect(sessionManager.activeTestCase?.steps[1].id).toBe(stepB.id);
  });

  it('allows customizing action type and updating step values on the fly', async () => {
    await sessionManager.startRecording({ url: 'https://example.com' });

    const step = createTestStep({
      stepNumber: 1,
      action: 'click',
      target: { tagName: 'h1', text: 'Dashboard', locators: [], selectedLocatorIndex: 0 },
    });
    await sessionManager.addStep(step);

    // Change action to assert_text
    await sessionManager.updateStepAction(step.id, 'assert_text');
    expect(sessionManager.activeTestCase?.steps[0].action).toBe('assert_text');
    expect(sessionManager.activeTestCase?.steps[0].assertExpected).toBe('Dashboard');

    // Update expected value
    await sessionManager.updateStepValue(step.id, undefined, 'Welcome to Dashboard');
    expect(sessionManager.activeTestCase?.steps[0].assertExpected).toBe('Welcome to Dashboard');
  });
});
