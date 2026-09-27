# Architectural Design Specification: Selenium Python Test Recorder (Chrome MV3)

**Date**: 2026-09-27  
**Status**: Approved for Implementation Planning  
**Target Repository**: `venkatesh01-t/chrome-driver`

---

## 1. Objective & Product Scope

Build a high-reliability, production-grade Chrome Manifest V3 Extension that records user browser interactions and generates clean, flake-free, PEP 8-compliant Python Selenium test automation scripts.

### Key Tenets
1. **Zero Flakiness**: Strict elimination of default `time.sleep()`. Every action uses explicit `WebDriverWait` with matching `expected_conditions`.
2. **Smart Locator Hierarchy**: Multi-strategy candidate generation (ID, `data-testid`, name, ARIA, CSS, relative XPath) with dynamic ID detection and real-time DOM uniqueness validation.
3. **Decoupled Architecture**: Browser events normalize into an Intermediate Representation (IR `TestCaseModel`) before code generation.
4. **Test-Driven Revalidation**: Every module (Locators, Actions, Code Gen) is backed by automated unit and integration test suites that run and revalidate continuously.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Target Webpage                        │
│                                                             │
│   DOM Events ──► [ Event Recorder ]                         │
│                         │                                   │
│                         ▼                                   │
│                  [ Inspector & UI ] ◄── Hover Highlight     │
│                         │                                   │
│                         ▼                                   │
│           [ Smart Locator Engine & Validator ]              │
│                         │ (candidate locators + uniqueness) │
│                         ▼                                   │
│         [ Content Script Message Dispatcher ]               │
└─────────────────────────┬───────────────────────────────────┘
                          │ chrome.runtime.sendMessage
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 Background Service Worker                   │
│                                                             │
│   • Single Source of Truth for RecordingSession             │
│   • Persists state to chrome.storage.local                  │
│   • Deduplicates & normalizes actions into TestCaseModel    │
│   • Handles tab navigation / refresh continuity             │
└─────────────────────────┬───────────────────────────────────┘
                          │ chrome.runtime.onConnect / port
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Side Panel UI                     │
│                                                             │
│   • Live Step Feed (Action type, target badge, status)      │
│   • Locator Inspector & Strategy Switcher                   │
│   • Live Python Selenium Code Preview                       │
│   • Copy / Export Actions & Session Reset                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Core Modules & Data Models

### 3.1 Data Models (Intermediate Representation)

```typescript
// src/types/model.ts

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
  warning?: 'multiple_matches' | 'dynamic_id' | 'dom_dependent';
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

export interface TestCaseModel {
  id: string;
  name: string;
  url: string;
  steps: TestStep[];
  settings: {
    timeout: number;
    useExplicitWait: boolean;
    maskSensitiveData: boolean;
  };
  createdAt: number;
  updatedAt: number;
}
```

---

## 4. Smart Locator Engine Specification

### 4.1 Candidate Generation & Heuristics
1. **ID Heuristic**:
   - Check `element.id`.
   - Run dynamic pattern check: Regex `/\b([0-9a-f]{6,}|input-\d+|btn-[a-z0-9]{4,}|ember\d+|react-[a-z0-9-]+)\b/i`.
   - If dynamic, mark with warning `dynamic_id` and demote score.
2. **Test Attributes**:
   - Check `data-testid`, `data-cy`, `data-test`, `data-qa`.
   - High confidence score (95).
3. **Name & ARIA**:
   - `[name="..."]`, `[aria-label="..."]`.
4. **Semantic CSS**:
   - Tag + specific attributes (e.g., `button[type="submit"]`).
5. **Relative XPath**:
   - Text-based: `//button[normalize-space()='Login']` or attribute-based: `//input[@placeholder='Username']`.
6. **Absolute XPath**:
   - Strict fallback only if no unique alternative exists.

### 4.2 In-DOM Validator
- Directly executes `document.querySelectorAll(css)` or `document.evaluate(xpath, document, ...)`.
- Computes `matchCount`.
- Sets `isUnique = (matchCount === 1)`.

---

## 5. Event Recorder & Action Normalizer

### 5.1 Noise Filtering
- **Debouncing**: Duplicate clicks on identical target elements within 350ms are collapsed into a single step.
- **Scroll & Move Suppression**: Raw mousemove and minor page scrolls are discarded.
- **Input Aggregation**: Keystrokes are buffered on `input` and committed when `change`, `blur`, or `Enter` is fired, generating a single clean `type` action rather than character-by-character events.
- **Sensitive Field Detection**: Elements with `type="password"` or matching sensitive patterns (`credit-card`, `cvv`, `otp`) are flagged with `isSensitive: true`. Their value is masked and generated as `os.getenv("TEST_PASSWORD")`.

---

## 6. Python Selenium Code Generator

### 6.1 Code Generation Rules
1. PEP 8 compliant, well-indented (4 spaces), organized imports:
   ```python
   from selenium import webdriver
   from selenium.webdriver.common.by import By
   from selenium.webdriver.support.ui import WebDriverWait
   from selenium.webdriver.support import expected_conditions as EC
   ```
2. Dynamic locator mapping:
   - `id` → `(By.ID, "...")`
   - `name` → `(By.NAME, "...")`
   - `css` → `(By.CSS_SELECTOR, "...")`
   - `xpath` → `(By.XPATH, "...")`
3. Explicit wait template:
   - Click:
     ```python
     WebDriverWait(driver, 10).until(
         EC.element_to_be_clickable((By.ID, "login-btn"))
     ).click()
     ```
   - Type:
     ```python
     element = WebDriverWait(driver, 10).until(
         EC.visibility_of_element_located((By.ID, "username"))
     )
     element.clear()
     element.send_keys("admin")
     ```

---

## 7. Testing & Continuous Revalidation Framework

To satisfy the core requirement of **"make test cases to apply it, again and again to revalidate it, make best output"**, the project incorporates:

1. **Unit Test Suite (Vitest + JSDOM)**:
   - `locator-engine.test.ts`: Tests locator generation on standard inputs, buttons, dynamic IDs, duplicate IDs, missing attributes, and text-based buttons.
   - `locator-validator.test.ts`: Verifies uniqueness calculation and fallback handling across complex mocked DOM trees.
   - `action-normalizer.test.ts`: Verifies debouncing, sensitive data masking, and input buffering.
   - `python-generator.test.ts`: Verifies generated Python syntax against reference fixtures, validating no `time.sleep()`, correct EC mapping, and PEP 8 conformity.

2. **Integration / E2E Verification Page**:
   - A dedicated `test-pages/demo-app.html` containing:
     - Standard login form.
     - Dynamic ID elements.
     - Ambiguous classes with identical styling.
     - Modals and delayed elements.
   - Used for manual and automated browser-testing.

---

## 8. Development Phasing

- **Milestone 1**: Project Scaffolding (Vite + TypeScript + Vitest + Manifest V3 configs).
- **Milestone 2**: Smart Locator Engine & DOM Validator with extensive unit tests.
- **Milestone 3**: Event Recorder & Action Normalizer with debouncing & sensitive field masking.
- **Milestone 4**: Background Service Worker & State Synchronization with `chrome.storage.local`.
- **Milestone 5**: Python Selenium Code Generator with PEP 8 outputs and test fixtures.
- **Milestone 6**: Chrome Side Panel UI (Vibrant modern dark theme, live step list, preview, copy).
- **Milestone 7**: End-to-End Revalidation & Testing on complex demo web pages.
