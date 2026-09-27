import { TestCaseModel, LocatorCandidate } from '../types/model';

function formatLocatorTuple(candidate: LocatorCandidate): string {
  const { strategy, value } = candidate;
  const escaped = value.replace(/"/g, '\\"');

  switch (strategy) {
    case 'id':
      return `(By.ID, "${escaped}")`;
    case 'name':
      return `(By.NAME, "${escaped}")`;
    case 'css':
      return `(By.CSS_SELECTOR, "${escaped}")`;
    case 'xpath':
    case 'absolute-xpath':
      return `(By.XPATH, "${escaped}")`;
    case 'data-testid':
      return `(By.CSS_SELECTOR, "[data-testid=\\"${escaped}\\"]")`;
    case 'aria-label':
      return `(By.CSS_SELECTOR, "[aria-label=\\"${escaped}\\"]")`;
    default:
      return `(By.CSS_SELECTOR, "${escaped}")`;
  }
}

export function generateSeleniumScript(testCase: TestCaseModel): string {
  const timeout = testCase.settings.timeout || 10;
  const steps = testCase.steps || [];

  // Identify all sensitive variables
  const sensitiveVars = new Map<string, string>();
  for (const step of steps) {
    if (step.isSensitive && step.variableName) {
      sensitiveVars.set(step.variableName, step.variableName);
    }
  }

  const lines: string[] = [];

  // File header
  lines.push('"""');
  lines.push(`Automated Selenium Python Test: ${testCase.name}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('"""');
  lines.push('');

  // Imports
  if (sensitiveVars.size > 0) {
    lines.push('import os');
  }
  lines.push('from selenium import webdriver');
  lines.push('from selenium.webdriver.common.by import By');
  lines.push('from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('from selenium.webdriver.support import expected_conditions as EC');
  lines.push('');

  // Environment variables initialization
  if (sensitiveVars.size > 0) {
    lines.push('# Sensitive configuration from environment variables');
    for (const [varName] of sensitiveVars) {
      lines.push(`${varName} = os.getenv("${varName}", "CHANGE_ME")`);
    }
    lines.push('');
  }

  // Test Function Definition
  lines.push('def run_test():');
  lines.push('    options = webdriver.ChromeOptions()');
  lines.push('    # options.add_argument("--headless")');
  lines.push('    driver = webdriver.Chrome(options=options)');
  lines.push(`    wait = WebDriverWait(driver, ${timeout})`);
  lines.push('');
  lines.push('    try:');

  // Navigation
  if (testCase.url) {
    lines.push(`        # Navigate to target page`);
    lines.push(`        driver.get("${testCase.url}")`);
    lines.push('');
  }

  // Steps
  if (steps.length === 0) {
    lines.push('        pass');
  } else {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const selectedIndex = step.target.selectedLocatorIndex ?? 0;
      const candidate = step.target.locators[selectedIndex] || step.target.locators[0];
      const locatorTuple = candidate
        ? formatLocatorTuple(candidate)
        : `(By.TAG_NAME, "${step.target.tagName}")`;

      lines.push(`        # Step ${i + 1}: ${step.action.toUpperCase()} on <${step.target.tagName}>`);

      if (step.action === 'click') {
        lines.push(`        wait.until(`);
        lines.push(`            EC.element_to_be_clickable(${locatorTuple})`);
        lines.push(`        ).click()`);
      } else if (step.action === 'type') {
        const valExpression = step.isSensitive && step.variableName
          ? step.variableName
          : JSON.stringify(step.value ?? '');

        lines.push(`        element = wait.until(`);
        lines.push(`            EC.visibility_of_element_located(${locatorTuple})`);
        lines.push(`        )`);
        lines.push(`        element.clear()`);
        lines.push(`        element.send_keys(${valExpression})`);
      } else if (step.action === 'checkbox') {
        lines.push(`        checkbox = wait.until(`);
        lines.push(`            EC.element_to_be_clickable(${locatorTuple})`);
        lines.push(`        )`);
        if (step.value === 'false') {
          lines.push(`        if checkbox.is_selected():`);
          lines.push(`            checkbox.click()`);
        } else {
          lines.push(`        if not checkbox.is_selected():`);
          lines.push(`            checkbox.click()`);
        }
      } else if (step.action === 'radio') {
        lines.push(`        radio = wait.until(`);
        lines.push(`            EC.element_to_be_clickable(${locatorTuple})`);
        lines.push(`        )`);
        lines.push(`        if not radio.is_selected():`);
        lines.push(`            radio.click()`);
      } else if (step.action === 'clear') {
        lines.push(`        wait.until(`);
        lines.push(`            EC.visibility_of_element_located(${locatorTuple})`);
        lines.push(`        ).clear()`);
      }
      lines.push('');
    }
  }

  // Teardown
  lines.push('    finally:');
  lines.push('        driver.quit()');
  lines.push('');
  lines.push('if __name__ == "__main__":');
  lines.push('    run_test()');
  lines.push('');

  return lines.join('\n');
}
