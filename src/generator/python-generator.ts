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
  const timeout = testCase.settings.timeout || 15;
  const steps = testCase.steps || [];

  // Identify all sensitive variables
  const sensitiveVars = new Map<string, string>();
  let hasSelect = false;

  for (const step of steps) {
    if (step.isSensitive && step.variableName) {
      sensitiveVars.set(step.variableName, step.variableName);
    }
    if (step.action === 'select') {
      hasSelect = true;
    }
  }

  const lines: string[] = [];

  // File header
  lines.push('"""');
  lines.push(`Automated Selenium Python Test: ${testCase.name}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('"""');
  lines.push('');

  // Core Imports
  lines.push('import os');
  lines.push('import time');
  lines.push('from datetime import datetime');
  lines.push('from pathlib import Path');
  lines.push('from selenium import webdriver');
  lines.push('from selenium.webdriver.common.by import By');
  lines.push('from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('from selenium.webdriver.support import expected_conditions as EC');
  if (hasSelect) {
    lines.push('from selenium.webdriver.support.ui import Select');
  }
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
  lines.push('    start_time = time.perf_counter()');
  lines.push('    options = webdriver.ChromeOptions()');
  lines.push('');
  lines.push('    # 1. Environment & Options Configuration');
  lines.push('    is_headless = os.getenv("HEADLESS", "false").lower() == "true"');
  lines.push('    if is_headless:');
  lines.push('        options.add_argument("--headless=new")');
  lines.push('    options.add_argument("--start-maximized")');
  lines.push('    options.add_argument("--window-size=1920,1080")');
  lines.push('    options.add_argument("--disable-search-engine-choice-screen")');
  lines.push('');
  lines.push('    # Optional Proxy Configuration');
  lines.push('    proxy = os.getenv("PROXY_SERVER", "").strip()');
  lines.push('    if proxy:');
  lines.push('        options.add_argument(f"--proxy-server={proxy}")');
  lines.push('');
  lines.push('    # Automated Downloads Directory Configuration');
  lines.push('    download_dir = Path(os.getenv("DOWNLOAD_DIR", "downloads")).resolve()');
  lines.push('    download_dir.mkdir(parents=True, exist_ok=True)');
  lines.push('    options.add_experimental_option("prefs", {');
  lines.push('        "download.default_directory": str(download_dir),');
  lines.push('        "download.prompt_for_download": False,');
  lines.push('        "directory_upgrade": True,');
  lines.push('        "safebrowsing.enabled": True,');
  lines.push('    })');
  lines.push('');
  lines.push('    # 2. Driver Initialization');
  lines.push('    driver = webdriver.Chrome(options=options)');
  lines.push('    if not is_headless:');
  lines.push('        driver.maximize_window()');
  lines.push(`    wait = WebDriverWait(driver, ${timeout})`);
  lines.push('');
  lines.push('    # Optional Timezone Emulation via CDP');
  lines.push('    browser_tz = os.getenv("TIMEZONE", "").strip()');
  lines.push('    if browser_tz:');
  lines.push('        driver.execute_cdp_cmd("Emulation.setTimezoneOverride", {"timezoneId": browser_tz})');
  lines.push('');
  lines.push('    try:');

  // Navigation
  if (testCase.url) {
    lines.push(`        # Navigate to target page`);
    lines.push(`        driver.get("${testCase.url}")`);
    lines.push('');
  } else {
    lines.push(`        # Set target URL`);
    lines.push(`        driver.get("https://example.com")`);
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

      // Build descriptive comment
      let descPart = '';
      if (step.action === 'select' && step.value) {
        const labelStr = step.target.labelText ? ` in "${step.target.labelText}"` : '';
        descPart = `SELECT "${step.value}"${labelStr}`;
      } else if (step.target.labelText) {
        descPart = `${step.action.toUpperCase()} into "${step.target.labelText}"`;
      } else if (step.target.text) {
        descPart = `${step.action.toUpperCase()} on "${step.target.text}"`;
      } else {
        descPart = `${step.action.toUpperCase()}`;
      }
      lines.push(`        # Step ${i + 1}: ${descPart} <${step.target.tagName}>`);

      const shadowHost = step.target.shadowHostSelector || candidate?.shadowHostSelector;

      if (step.action === 'click') {
        if (shadowHost) {
          // If candidate is XPath, find a CSS fallback for native shadow_root.find_element
          const cssFallback = step.target.locators.find((l) => l.strategy === 'css');
          const shadowLocatorTuple = cssFallback
            ? formatLocatorTuple(cssFallback)
            : locatorTuple;
          const cssVal = cssFallback ? cssFallback.value : candidate?.value || '';

          lines.push(`        # Locate inside Shadow Root <${shadowHost}>`);
          lines.push(`        shadow_host = wait.until(`);
          lines.push(`            EC.presence_of_element_located((By.CSS_SELECTOR, "${shadowHost}"))`);
          lines.push(`        )`);
          lines.push(`        try:`);
          lines.push(`            element = shadow_host.shadow_root.find_element(${shadowLocatorTuple})`);
          lines.push(`        except Exception:`);
          lines.push(`            element = driver.execute_script(`);
          lines.push(`                "return arguments[0].shadowRoot ? (arguments[0].shadowRoot.querySelector(arguments[1]) || Array.from(arguments[0].shadowRoot.querySelectorAll('a, button, span, li')).find(e => (e.textContent || '').trim().includes(arguments[2]))) : null;",`);
          lines.push(`                shadow_host, ${JSON.stringify(cssVal)}, ${JSON.stringify(step.target.text || '')}`);
          lines.push(`            )`);
          lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)`);
          lines.push(`        try:`);
          lines.push(`            element.click()`);
          lines.push(`        except Exception:`);
          lines.push(`            driver.execute_script("arguments[0].click();", element)`);
        } else {
          lines.push(`        element = wait.until(`);
          lines.push(`            EC.element_to_be_clickable(${locatorTuple})`);
          lines.push(`        )`);
          lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)`);
          lines.push(`        try:`);
          lines.push(`            element.click()`);
          lines.push(`        except Exception:`);
          lines.push(`            driver.execute_script("arguments[0].click();", element)`);
        }
      } else if (step.action === 'type') {
        const valExpression = step.isSensitive && step.variableName
          ? step.variableName
          : JSON.stringify(step.value ?? '');

        lines.push(`        element = wait.until(`);
        lines.push(`            EC.visibility_of_element_located(${locatorTuple})`);
        lines.push(`        )`);
        lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)`);
        lines.push(`        element.clear()`);
        lines.push(`        element.send_keys(${valExpression})`);
      } else if (step.action === 'select') {
        lines.push(`        select_elem = Select(wait.until(`);
        lines.push(`            EC.presence_of_element_located(${locatorTuple})`);
        lines.push(`        ))`);
        lines.push(`        select_elem.select_by_visible_text(${JSON.stringify(step.value ?? '')})`);
      } else if (step.action === 'checkbox') {
        lines.push(`        checkbox = wait.until(`);
        lines.push(`            EC.element_to_be_clickable(${locatorTuple})`);
        lines.push(`        )`);
        lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", checkbox)`);
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
        lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", radio)`);
        lines.push(`        if not radio.is_selected():`);
        lines.push(`            radio.click()`);
      } else if (step.action === 'clear') {
        lines.push(`        element = wait.until(`);
        lines.push(`            EC.visibility_of_element_located(${locatorTuple})`);
        lines.push(`        )`);
        lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)`);
        lines.push(`        element.clear()`);
      }
      lines.push('');
    }
  }

  // Performance output
  lines.push('        elapsed = time.perf_counter() - start_time');
  lines.push('        print(f"[PERF] Test completed successfully in {elapsed:.2f}s")');
  lines.push('');

  // Error & Failure Artifact capture
  lines.push('    except Exception as e:');
  lines.push('        artifact_dir = Path("artifacts")');
  lines.push('        artifact_dir.mkdir(parents=True, exist_ok=True)');
  lines.push('        ts = datetime.now().strftime("%Y%m%d_%H%M%S")');
  lines.push('        screenshot_path = artifact_dir / f"failure_{ts}.png"');
  lines.push('        dom_path = artifact_dir / f"failure_{ts}.html"');
  lines.push('        driver.save_screenshot(str(screenshot_path))');
  lines.push('        dom_path.write_text(driver.page_source, encoding="utf-8", errors="replace")');
  lines.push('        print(f"[ERROR] Test execution failed: {e}")');
  lines.push('        print(f"[DEBUG] Failure screenshot captured: {screenshot_path}")');
  lines.push('        print(f"[DEBUG] DOM snapshot saved: {dom_path}")');
  lines.push('        raise');

  // Teardown
  lines.push('    finally:');
  lines.push('        driver.quit()');
  lines.push('');
  lines.push('if __name__ == "__main__":');
  lines.push('    run_test()');
  lines.push('');

  return lines.join('\n');
}
