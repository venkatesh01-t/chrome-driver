/**
 * Generates an automated GitHub Actions CI/CD workflow (.github/workflows/e2e-tests.yml)
 */
export function generateGitHubActionsWorkflow(
  projectName = 'E2E Automated Tests',
  framework: 'pytest' | 'playwright-ts' = 'pytest'
): string {
  if (framework === 'playwright-ts') {
    return `name: ${projectName}

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  schedule:
    - cron: '0 6 * * *' # Daily Nightly Run

jobs:
  test:
    name: Run Playwright E2E Suite
    timeout-minutes: 30
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox]

    steps:
      - name: Checkout Codebase
        uses: actions/checkout@v4

      - name: Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Install Playwright Browsers with OS Dependencies
        run: npx playwright install --with-deps \${{ matrix.browser }}

      - name: Run Playwright E2E Tests
        run: npx playwright test --project=\${{ matrix.browser }}
        env:
          CI: true
          HEADLESS: true

      - name: Upload Test Report & Traces
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-\${{ matrix.browser }}
          path: playwright-report/
          retention-days: 14
`;
  }

  // Default: Python Selenium 4 / Pytest workflow
  return `name: ${projectName}

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  schedule:
    - cron: '0 6 * * *'

jobs:
  test:
    name: Run Selenium 4 Pytest Suite
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout Codebase
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install Google Chrome Stable
        run: |
          sudo apt-get update
          sudo apt-get install -y wget curl unzip
          wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
          echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
          sudo apt-get update
          sudo apt-get install -y google-chrome-stable

      - name: Install Python Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install pytest selenium webdriver-manager faker

      - name: Run Pytest Headless E2E Suite
        run: |
          pytest -v -s --junitxml=reports/junit-results.xml
        env:
          HEADLESS: "true"

      - name: Publish Test Results Artifact
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: selenium-test-reports
          path: reports/
          retention-days: 14
`;
}

/**
 * Generates production-ready Dockerfile for containerized headless testing
 */
export function generateDockerfile(framework: 'pytest' | 'playwright-ts' = 'pytest'): string {
  if (framework === 'playwright-ts') {
    return `# Playwright Official Microsoft Container Image
FROM mcr.microsoft.com/playwright:v1.49.0-noble

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ENV CI=true
ENV HEADLESS=true

CMD ["npx", "playwright", "test"]
`;
  }

  return `# Python 3.11 with Headless Chrome & Selenium 4
FROM python:3.11-slim-bullseye

WORKDIR /app

# Install Chrome and necessary shared libraries
RUN apt-get update && apt-get install -y --no-install-recommends \\
    wget \\
    gnupg \\
    unzip \\
    curl \\
    ca-certificates \\
    fonts-liberation \\
    libappindicator3-1 \\
    libasound2 \\
    libatk-bridge2.0-0 \\
    libgtk-3-0 \\
    libnspr4 \\
    libnss3 \\
    libxss1 \\
    xdg-utils \\
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \\
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \\
    && apt-get update \\
    && apt-get install -y google-chrome-stable \\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV HEADLESS=true

CMD ["pytest", "-v"]
`;
}

/**
 * Generates Cloud Grid configuration (BrowserStack / SauceLabs)
 */
export function generateCloudGridConfig(provider: 'browserstack' | 'saucelabs' = 'browserstack'): string {
  if (provider === 'browserstack') {
    return `{
  "auth": {
    "username": "BROWSERSTACK_USERNAME",
    "access_key": "BROWSERSTACK_ACCESS_KEY"
  },
  "browsers": [
    {
      "browser": "chrome",
      "os": "Windows",
      "os_version": "11",
      "browser_version": "latest"
    },
    {
      "browser": "safari",
      "os": "OS X",
      "os_version": "Ventura",
      "browser_version": "latest"
    }
  ],
  "run_settings": {
    "cypress_config_file": "cypress.config.ts",
    "project_name": "Recorded E2E Smoke Suite",
    "build_name": "build-\${BUILD_NUMBER}",
    "parallels": "5"
  }
}`;
  }

  return `{
  "sauce": {
    "region": "us-west-1"
  },
  "suites": [
    {
      "name": "Chrome Latest on Windows 11",
      "platformName": "Windows 11",
      "browserName": "chrome",
      "browserVersion": "latest"
    }
  ]
}`;
}
