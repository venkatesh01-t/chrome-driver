# 🚀 Selenium & Playwright Python Test Recorder

[![Chrome MV3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Bundler-Vite%206-purple.svg)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Tests-80%2B%20Passing-success.svg)](https://vitest.dev/)

A Chrome Manifest V3 side panel extension that records browser interactions and automatically generates robust, flake-free Python automation scripts (**Selenium 4** and **Playwright**) with explicit waits, live locator testing, self-healing fallbacks, and Shadow DOM piercing.

---

## ✨ Key Features

- **Flake-Free Code Generation:** Generates Python code using explicit `WebDriverWait` conditions—never brittle `time.sleep()` or global `implicitly_wait()`.
- **Self-Healing Multi-Locator Resilience:** If dynamic IDs change or DOM elements update in newer deployments, the generated tests automatically evaluate ranked fallback locators (`data-testid`, `name`, `aria-label`, relative XPath), heal the test execution on-the-fly, and log `[SELF-HEALED]`.
- **Anti-Bot & Automation Masking:** Automatically configures `--disable-blink-features=AutomationControlled`, excludes automation flags, and masks `navigator.webdriver` via Chrome DevTools Protocol (CDP).
- **Multi-Level Deep Shadow DOM Piercing:** Accurately traverses nested custom Web Components (`<app-shell> -> <nav-bar> -> <custom-button>`) through deep shadow root hierarchy traversal.
- **Dual Automation Engines:** Generates both **Selenium 4** and **Playwright** Python code.
- **Three Code Flavors:**
  - `Simple`: Clean, minimal script with auto-scrolling and JS click fallback.
  - `Enterprise`: Production CI/CD script with headless toggle (`HEADLESS=true`), download directory handling, and timestamped failure screenshot + DOM snapshot capture.
  - `Pytest`: Idiomatic fixtures (`@pytest.fixture def driver(): ...`) and assertions.
- **Live In-Browser Verification:** Test and highlight any locator live on the active page before exporting.

---

## 🛠️ Quickstart

### 1. Build Extension
```bash
npm install
npm run build
```

### 2. Load Extension in Chrome
1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked** and select the `dist/` folder
4. Click the extension icon to launch the **Side Panel**

### 3. Run Automated Tests
```bash
# Run unit test suites
npm test

# Run live Google Chrome end-to-end verification
pip install -r requirements.txt
python tests/live_chrome_test.py
```

---

## 🏗️ Architecture

```
chrome-driver/
├── manifest.json              # Chrome Manifest V3 definition
├── package.json               # Node dependencies & build scripts
├── requirements.txt           # Python dependencies for generated scripts
├── src/
│   ├── background/            # Service worker & session state manager
│   ├── content/               # Event recorder, action normalizer, locator engine & validator
│   ├── generator/             # Python Selenium & Playwright code generators
│   ├── sidepanel/             # Side panel dark-mode UI & controller
│   ├── types/                 # Type-safe model & message schemas
│   └── utils/                 # DOM & escaping utilities
├── tests/                     # Unit test suites and live browser verification
└── test-pages/                # Testbed with forms, shadow roots, and custom components
```

---

## 📄 License
MIT License
