import { TestCaseModel, TestStep, createTestCase } from '../types/model';

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  clear(): Promise<void>;
}

export class ChromeStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return null;
    }
    const result = await chrome.storage.local.get(key);
    return (result[key] as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    await chrome.storage.local.set({ [key]: value });
  }

  async clear(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    await chrome.storage.local.clear();
  }
}

export class SessionManager {
  private _isRecording = false;
  private _activeTestCase: TestCaseModel | null = null;
  private storage: StorageAdapter;
  private listeners: Array<() => void> = [];

  constructor(storage: StorageAdapter = new ChromeStorageAdapter()) {
    this.storage = storage;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  get activeTestCase(): TestCaseModel | null {
    return this._activeTestCase;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('SessionManager listener error:', err);
      }
    }
  }

  public async restore(): Promise<void> {
    const savedState = await this.storage.get<{ isRecording: boolean; activeTestCase: TestCaseModel | null }>('sessionState');
    if (savedState) {
      this._isRecording = savedState.isRecording;
      this._activeTestCase = savedState.activeTestCase;
      this.notify();
    }
  }

  public async startRecording(params?: { url?: string; name?: string }): Promise<TestCaseModel> {
    this._isRecording = true;
    if (!this._activeTestCase) {
      this._activeTestCase = createTestCase(
        params?.name || 'Automated Test',
        params?.url || ''
      );
    } else if (params?.url && !this._activeTestCase.url) {
      this._activeTestCase.url = params.url;
    }
    await this.persist();
    return this._activeTestCase;
  }

  public async stopRecording(): Promise<void> {
    this._isRecording = false;
    await this.persist();
  }

  public async addStep(step: TestStep): Promise<void> {
    if (!this._activeTestCase) {
      this._activeTestCase = createTestCase('Automated Test');
    }
    // Update step numbers sequentially
    step.stepNumber = this._activeTestCase.steps.length + 1;
    this._activeTestCase.steps.push(step);
    this._activeTestCase.updatedAt = Date.now();
    await this.persist();
  }

  public async deleteStep(stepId: string): Promise<void> {
    if (!this._activeTestCase) return;
    this._activeTestCase.steps = this._activeTestCase.steps.filter((s) => s.id !== stepId);
    // Re-index steps
    this._activeTestCase.steps.forEach((s, idx) => {
      s.stepNumber = idx + 1;
    });
    this._activeTestCase.updatedAt = Date.now();
    await this.persist();
  }

  public async updateStepLocator(stepId: string, locatorIndex: number): Promise<void> {
    if (!this._activeTestCase) return;
    const step = this._activeTestCase.steps.find((s) => s.id === stepId);
    if (step && step.target.locators[locatorIndex]) {
      step.target.selectedLocatorIndex = locatorIndex;
      this._activeTestCase.updatedAt = Date.now();
      await this.persist();
    }
  }

  public async clearSession(): Promise<void> {
    this._isRecording = false;
    this._activeTestCase = null;
    await this.storage.clear();
    this.notify();
  }

  private async persist(): Promise<void> {
    await this.storage.set('sessionState', {
      isRecording: this._isRecording,
      activeTestCase: this._activeTestCase,
    });
    await this.storage.set('activeTestCase', this._activeTestCase);
    this.notify();
  }
}
