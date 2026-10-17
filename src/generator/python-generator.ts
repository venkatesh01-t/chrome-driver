import { TestCaseModel, TestStep, LocatorCandidate } from '../types/model';

export function formatLocatorTuple(candidate: LocatorCandidate): string {
  const { strategy, value } = candidate;
  const hasBackslash = value.includes('\\');
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const rawPrefix = hasBackslash ? 'r' : '';
  const formattedVal = hasBackslash ? `${rawPrefix}"${value.replace(/"/g, '\\"')}"` : `"${escaped}"`;

  switch (strategy) {
    case 'id':
      return `(By.ID, ${formattedVal})`;
    case 'name':
      return `(By.NAME, ${formattedVal})`;
    case 'css':
      return `(By.CSS_SELECTOR, ${formattedVal})`;
    case 'xpath':
    case 'absolute-xpath':
      return `(By.XPATH, ${formattedVal})`;
    case 'data-testid':
      return `(By.CSS_SELECTOR, "[data-testid=\\"${escaped}\\"]")`;
    case 'aria-label':
      return `(By.CSS_SELECTOR, "[aria-label=\\"${escaped}\\"]")`;
    default:
      return `(By.CSS_SELECTOR, ${formattedVal})`;
  }
}

function getStepLocator(step: TestStep): { tuple: string; candidate?: LocatorCandidate } {
  const selectedIndex = step.target.selectedLocatorIndex ?? 0;
  const candidate = step.target.locators[selectedIndex] || step.target.locators[0];
  if (!candidate) {
    return { tuple: `(By.TAG_NAME, "${step.target.tagName || 'body'}")` };
  }
  return { tuple: formatLocatorTuple(candidate), candidate };
}

export function getFallbackLocatorTuples(step: TestStep): string[] {
  const locs = step.target?.locators || [];
  const selectedIndex = step.target?.selectedLocatorIndex ?? 0;
  const tuples: string[] = [];
  const seenValues = new Set<string>();

  const primary = locs[selectedIndex] || locs[0];
  if (primary) {
    const formatted = formatLocatorTuple(primary);
    tuples.push(formatted);
    seenValues.add(`${primary.strategy}:${primary.value}`);
  }

  for (let i = 0; i < locs.length && tuples.length < 4; i++) {
    if (i !== selectedIndex && locs[i] && locs[i].matchCount !== 0) {
      const key = `${locs[i].strategy}:${locs[i].value}`;
      if (!seenValues.has(key)) {
        seenValues.add(key);
        tuples.push(formatLocatorTuple(locs[i]));
      }
    }
  }

  return tuples;
}

function buildStepComment(step: TestStep, index: number): string {
  const componentInfo = step.target.componentType ? ` in ${step.target.componentType.toUpperCase()}` : '';
  const labelInfo = step.target.labelText ? ` "${step.target.labelText}"` : '';
  const textInfo = step.target.text ? ` "${step.target.text}"` : '';
  const desc = labelInfo || textInfo || `<${step.target.tagName}>`;

  switch (step.action) {
    case 'click':
      return `# Step ${index + 1}: Click${labelInfo || textInfo}${componentInfo}`;
    case 'type':
      return `# Step ${index + 1}: Type into${desc}${componentInfo}`;
    case 'select':
      return `# Step ${index + 1}: Select "${step.value}" from${desc}${componentInfo}`;
    case 'checkbox':
      return `# Step ${index + 1}: Toggle checkbox${desc}${componentInfo}`;
    case 'radio':
      return `# Step ${index + 1}: Select radio${desc}${componentInfo}`;
    case 'clear':
      return `# Step ${index + 1}: Clear field${desc}${componentInfo}`;
    case 'hover':
      return `# Step ${index + 1}: Hover over${desc}${componentInfo}`;
    case 'assert_visible':
      return `# Step ${index + 1}: Assert${desc} is visible${componentInfo}`;
    case 'assert_text':
      return `# Step ${index + 1}: Assert text "${step.assertExpected}" in${desc}${componentInfo}`;
    case 'assert_attribute':
      return `# Step ${index + 1}: Assert attribute "${step.assertAttribute}" on${desc}${componentInfo}`;
    case 'print_value':
      return `# Step ${index + 1}: Extract & Print value from${desc}${componentInfo}`;
    case 'navigate':
      return `# Step ${index + 1}: Navigate to ${step.value || 'target URL'}`;
    case 'switch_tab':
      return `# Step ${index + 1}: Switch to latest browser tab`;
    case 'close_tab':
      return `# Step ${index + 1}: Close active tab and switch back`;
    case 'switch_iframe':
      return `# Step ${index + 1}: Switch to iframe ${step.iframePath || ''}`;
    case 'press_key':
      return `# Step ${index + 1}: Press key "${step.keyCombo}" on${desc}`;
    case 'scroll':
      return `# Step ${index + 1}: Scroll page to ${step.value || 'position'}`;
    case 'upload_file':
      return `# Step ${index + 1}: Upload file to${desc}`;
    case 'drag_drop':
      return `# Step ${index + 1}: Drag and drop${desc}`;
    case 'wait':
      return `# Step ${index + 1}: Wait for ${step.waitDuration || 2} seconds`;
    default:
      return `# Step ${index + 1}: ${step.action} on ${desc}`;
  }
}

function mapKeyConstant(keyCombo?: string): string {
  if (!keyCombo) return 'Keys.ENTER';
  const parts = keyCombo.split('+');
  const mainKey = parts[parts.length - 1];
  switch (mainKey) {
    case 'Enter': return 'Keys.ENTER';
    case 'Escape': return 'Keys.ESCAPE';
    case 'Tab': return 'Keys.TAB';
    case 'Backspace': return 'Keys.BACKSPACE';
    case 'ArrowDown': return 'Keys.ARROW_DOWN';
    case 'ArrowUp': return 'Keys.ARROW_UP';
    case 'Space': return 'Keys.SPACE';
    default:
      if (parts.length > 1 && parts[0] === 'Control') {
        return `Keys.CONTROL, "${mainKey.toLowerCase()}"`;
      }
      return `"${mainKey}"`;
  }
}

// ---------------------------------------------------------------------------
// 1. SIMPLE GENERATOR (~30-50 lines, beginner-friendly, zero boilerplate)
// ---------------------------------------------------------------------------
export function generateSimpleScript(testCase: TestCaseModel): string {
  const steps = testCase.steps || [];
  const lines: string[] = [];

  const hasHover = steps.some((s) => s.action === 'hover' || s.action === 'drag_drop');
  const hasKeys = steps.some((s) => s.action === 'press_key');
  const hasSelect = steps.some((s) => s.action === 'select');

  lines.push(`"""`);
  lines.push(`Test: ${testCase.name || 'Automated Test'}`);
  lines.push(`Target URL: ${testCase.url || 'https://example.com'}`);
  lines.push(`"""`);
  lines.push('from selenium import webdriver');
  lines.push('from selenium.webdriver.common.by import By');
  if (hasKeys) lines.push('from selenium.webdriver.common.keys import Keys');
  if (hasHover) lines.push('from selenium.webdriver.common.action_chains import ActionChains');
  if (hasSelect) lines.push('from selenium.webdriver.support.ui import Select');
  lines.push('import os');
  lines.push('import time');
  lines.push('');
  lines.push('def find(driver, by, value, timeout=10):');
  lines.push('    """Wait for element, scroll it into view, and return it."""');
  lines.push('    from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('    from selenium.webdriver.support import expected_conditions as EC');
  lines.push('    el = WebDriverWait(driver, timeout).until(EC.presence_of_element_located((by, value)))');
  lines.push('    try:');
  lines.push('        driver.execute_script("arguments[0].scrollIntoView({block: \'center\', inline: \'nearest\'});", el)');
  lines.push('    except Exception:');
  lines.push('        pass');
  lines.push('    return el');
  lines.push('');
  lines.push('def click(driver, by, value, timeout=10):');
  lines.push('    """Click element with automatic scroll and JavaScript click fallback if intercepted."""');
  lines.push('    el = find(driver, by, value, timeout)');
  lines.push('    try:');
  lines.push('        el.click()');
  lines.push('    except Exception:');
  lines.push('        driver.execute_script("arguments[0].click();", el)');
  lines.push('    return el');
  lines.push('');
  lines.push('is_headless = os.getenv("HEADLESS", "false").lower() == "true"');
  lines.push('if is_headless:');
  lines.push('    options = webdriver.ChromeOptions()');
  lines.push('    options.add_argument("--headless=new")');
  lines.push('    driver = webdriver.Chrome(options=options)');
  lines.push('else:');
  lines.push('    driver = webdriver.Chrome()');
  lines.push('driver.maximize_window()');
  lines.push('');
  lines.push('try:');

  const startUrl = testCase.url || 'https://example.com';
  lines.push(`    # Open target URL`);
  lines.push(`    driver.get("${startUrl}")`);
  lines.push('');

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const { tuple } = getStepLocator(step);
    lines.push(`    ${buildStepComment(step, i)}`);

    switch (step.action) {
      case 'navigate':
        lines.push(`    driver.get("${step.value || startUrl}")`);
        break;
      case 'click':
        lines.push(`    click(driver, *${tuple})`);
        break;
      case 'type': {
        const val = JSON.stringify(step.value ?? '');
        lines.push(`    el = find(driver, *${tuple})`);
        lines.push('    try:');
        lines.push('        el.clear()');
        lines.push('    except Exception:');
        lines.push('        pass');
        lines.push(`    el.send_keys(${val})`);
        break;
      }
      case 'select':
        lines.push(`    Select(find(driver, *${tuple})).select_by_visible_text(${JSON.stringify(step.value ?? '')})`);
        break;
      case 'checkbox':
        lines.push(`    cb = find(driver, *${tuple})`);
        if (step.value === 'false') {
          lines.push(`    if cb.is_selected(): cb.click()`);
        } else {
          lines.push(`    if not cb.is_selected(): cb.click()`);
        }
        break;
      case 'radio':
        lines.push(`    rd = find(driver, *${tuple})`);
        lines.push(`    if not rd.is_selected(): rd.click()`);
        break;
      case 'clear':
        lines.push(`    find(driver, *${tuple}).clear()`);
        break;
      case 'hover':
        lines.push(`    ActionChains(driver).move_to_element(find(driver, *${tuple})).perform()`);
        break;
      case 'assert_visible':
        lines.push(`    assert find(driver, *${tuple}).is_displayed(), "Element should be visible"`);
        break;
      case 'assert_text':
        lines.push(`    assert ${JSON.stringify(step.assertExpected || '')} in find(driver, *${tuple}).text`);
        break;
      case 'assert_attribute':
        lines.push(`    assert find(driver, *${tuple}).get_attribute("${step.assertAttribute || 'value'}") == ${JSON.stringify(step.assertExpected || '')}`);
        break;
      case 'print_value': {
        const label = (step.target.text || step.target.labelText || 'Value').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').trim();
        lines.push(`    el = find(driver, *${tuple})`);
        lines.push(`    val = el.get_attribute("value") if el.tag_name in ["input", "textarea", "select"] else el.text`);
        lines.push(`    print(f"[EXTRACTED] ${label}: {val}")`);
        break;
      }
      case 'press_key':
        lines.push(`    find(driver, *${tuple}).send_keys(${mapKeyConstant(step.keyCombo)})`);
        break;
      case 'scroll': {
        const coords = step.value ? step.value.split(',') : ['0', '500'];
        lines.push(`    driver.execute_script("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
        break;
      }
      case 'upload_file':
        lines.push(`    find(driver, *${tuple}).send_keys(${JSON.stringify(step.value || '/path/to/upload_file.ext')})`);
        break;
      case 'drag_drop':
        if (step.dragTarget && step.dragTarget.locators[0]) {
          const targetTuple = formatLocatorTuple(step.dragTarget.locators[0]);
          lines.push(`    ActionChains(driver).drag_and_drop(find(driver, *${tuple}), find(driver, *${targetTuple})).perform()`);
        } else {
          lines.push(`    ActionChains(driver).click_and_hold(find(driver, *${tuple})).release().perform()`);
        }
        break;
      case 'switch_iframe':
        lines.push(`    driver.switch_to.frame(find(driver, *${tuple}))`);
        break;
      case 'switch_tab':
        lines.push(`    driver.switch_to.window(driver.window_handles[-1])`);
        break;
      case 'close_tab':
        lines.push(`    driver.close()`);
        lines.push(`    driver.switch_to.window(driver.window_handles[0])`);
        break;
      case 'wait':
        lines.push(`    time.sleep(${step.waitDuration || 2})`);
        break;
      default:
        lines.push(`    find(driver, *${tuple}).click()`);
    }
    lines.push('');
  }

  lines.push('    print("[SUCCESS] Test passed successfully!")');
  lines.push('');
  lines.push('finally:');
  lines.push('    driver.quit()');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 2. ENTERPRISE GENERATOR (Robust, CI/CD-ready, explicit waits, screenshots)
// ---------------------------------------------------------------------------
export function generateEnterpriseScript(testCase: TestCaseModel): string {
  const timeout = testCase.settings?.timeout || 15;
  const steps = testCase.steps || [];

  const sensitiveVars = new Map<string, string>();
  let hasSelect = false;
  let hasActions = false;
  let hasKeys = false;

  for (const step of steps) {
    if (step.isSensitive && step.variableName) {
      sensitiveVars.set(step.variableName, step.variableName);
    }
    if (step.action === 'select') hasSelect = true;
    if (step.action === 'hover' || step.action === 'drag_drop') hasActions = true;
    if (step.action === 'press_key') hasKeys = true;
  }

  const lines: string[] = [];

  lines.push('"""');
  lines.push(`Enterprise Selenium Test: ${testCase.name || 'Automated Test'}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('"""');
  lines.push('');
  lines.push('import os');
  lines.push('import time');
  lines.push('from datetime import datetime');
  lines.push('from pathlib import Path');
  lines.push('from selenium import webdriver');
  lines.push('from selenium.webdriver.common.by import By');
  lines.push('from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('from selenium.webdriver.support import expected_conditions as EC');
  if (hasKeys) lines.push('from selenium.webdriver.common.keys import Keys');
  if (hasActions) lines.push('from selenium.webdriver.common.action_chains import ActionChains');
  if (hasSelect) lines.push('from selenium.webdriver.support.ui import Select');
  lines.push('');

  if (sensitiveVars.size > 0) {
    lines.push('# Sensitive configuration from environment variables');
    for (const [varName] of sensitiveVars) {
      lines.push(`${varName} = os.getenv("${varName}", "CHANGE_ME")`);
    }
    lines.push('');
  }

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
  lines.push('    # Anti-Bot & Automation Masking');
  lines.push('    options.add_argument("--disable-blink-features=AutomationControlled")');
  lines.push('    options.add_experimental_option("excludeSwitches", ["enable-automation"])');
  lines.push('    options.add_experimental_option("useAutomationExtension", False)');
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
  lines.push('    # Mask navigator.webdriver fingerprint via CDP');
  lines.push('    try:');
  lines.push('        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {');
  lines.push('            "source": "Object.defineProperty(navigator, \'webdriver\', {get: () => undefined})"');
  lines.push('        })');
  lines.push('    except Exception:');
  lines.push('        pass');
  lines.push('');
  lines.push('    # Optional Timezone Emulation via CDP');
  lines.push('    browser_tz = os.getenv("TIMEZONE", "").strip()');
  lines.push('    if browser_tz:');
  lines.push('        driver.execute_cdp_cmd("Emulation.setTimezoneOverride", {"timezoneId": browser_tz})');
  lines.push('');
  lines.push('    # Self-Healing Element Finder Helper');
  lines.push('    def find_resilient(d, locators, timeout=10, condition="presence"):');
  lines.push('        last_exc = None');
  lines.push('        for idx, (by, val) in enumerate(locators):');
  lines.push('            try:');
  lines.push('                wait_t = timeout if idx == 0 else min(timeout, 3)');
  lines.push('                w = WebDriverWait(d, wait_t)');
  lines.push('                if condition == "clickable":');
  lines.push('                    el = w.until(EC.element_to_be_clickable((by, val)))');
  lines.push('                elif condition == "visible":');
  lines.push('                    el = w.until(EC.visibility_of_element_located((by, val)))');
  lines.push('                else:');
  lines.push('                    el = w.until(EC.presence_of_element_located((by, val)))');
  lines.push('                if idx > 0:');
  lines.push('                    print(f"[SELF-HEALED] Step locator failed; automatically healed using backup: ({by}, \'{val}\')")');
  lines.push('                return el');
  lines.push('            except Exception as e:');
  lines.push('                last_exc = e');
  lines.push('        raise last_exc');
  lines.push('');
  lines.push('    # Network & DOM Idle Stabilization Helper');
  lines.push('    def wait_for_page_stable(d, timeout=5):');
  lines.push('        try:');
  lines.push('            WebDriverWait(d, timeout).until(');
  lines.push('                lambda drv: drv.execute_script("return document.readyState === \'complete\'")');
  lines.push('            )');
  lines.push('        except Exception:');
  lines.push('            pass');
  lines.push('');
  lines.push('    try:');

  const startUrl = testCase.url || 'https://example.com';
  lines.push(`        # Navigate to target page`);
  lines.push(`        driver.get("${startUrl}")`);
  lines.push('');

  if (steps.length === 0) {
    lines.push('        pass');
  } else {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const { tuple, candidate } = getStepLocator(step);
      lines.push(`        ${buildStepComment(step, i)}`);

      const shadowHost = step.target.shadowHostSelector || candidate?.shadowHostSelector;

      if (step.action === 'click') {
        if (shadowHost) {
          const cssFallback = step.target.locators.find((l) => l.strategy === 'css');
          const shadowLocatorTuple = cssFallback ? formatLocatorTuple(cssFallback) : tuple;
          const cssVal = cssFallback ? cssFallback.value : candidate?.value || '';
          const shadowPath = step.target.shadowHostPath && step.target.shadowHostPath.length > 0 ? step.target.shadowHostPath : [shadowHost];

          lines.push(`        shadow_host = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${shadowHost}")))`);
          lines.push(`        try:`);
          lines.push(`            element = shadow_host.shadow_root.find_element(*${shadowLocatorTuple})`);
          lines.push(`        except Exception:`);
          lines.push(`            element = driver.execute_script(`);
          lines.push(`                "let curr = arguments[0]; const hosts = arguments[3]; if (hosts && hosts.length > 1) { curr = document; for (let h of hosts) { const hostEl = curr.querySelector(h); if (!hostEl || !hostEl.shadowRoot) break; curr = hostEl.shadowRoot; } } else if (curr.shadowRoot) { curr = curr.shadowRoot; } return curr.querySelector ? (curr.querySelector(arguments[1]) || Array.from(curr.querySelectorAll('a, button, span, li')).find(e => (e.textContent || '').trim().includes(arguments[2]))) : null;",`);
          lines.push(`                shadow_host, ${JSON.stringify(cssVal)}, ${JSON.stringify(step.target.text || '')}, ${JSON.stringify(shadowPath)}`);
          lines.push(`            )`);
          lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)`);
          lines.push(`        try:`);
          lines.push(`            element.click()`);
          lines.push(`        except Exception:`);
          lines.push(`            driver.execute_script("arguments[0].click();", element)`);
        } else {
          lines.push(`        try:`);
          lines.push(`            element = wait.until(EC.element_to_be_clickable(${tuple}))`);
          lines.push(`        except Exception:`);
          const fallbackTuples = getFallbackLocatorTuples(step);
          lines.push(`            # Self-Healing Fallback across ranked locators`);
          lines.push(`            element = find_resilient(driver, [${fallbackTuples.join(', ')}], timeout=5, condition="clickable")`);
          lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)`);
          lines.push(`        try:`);
          lines.push(`            element.click()`);
          lines.push(`        except Exception:`);
          lines.push(`            driver.execute_script("arguments[0].click();", element)`);
        }
      } else if (step.action === 'type') {
        const valExpression = step.isSensitive && step.variableName ? step.variableName : JSON.stringify(step.value ?? '');
        lines.push(`        try:`);
        lines.push(`            element = wait.until(EC.visibility_of_element_located(${tuple}))`);
        lines.push(`        except Exception:`);
        const fallbackTuples = getFallbackLocatorTuples(step);
        lines.push(`            # Self-Healing Fallback across ranked locators`);
        lines.push(`            element = find_resilient(driver, [${fallbackTuples.join(', ')}], timeout=5, condition="visible")`);
        lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)`);
        lines.push(`        element.clear()`);
        lines.push(`        element.send_keys(${valExpression})`);
      } else if (step.action === 'select') {
        lines.push(`        select_elem = Select(wait.until(EC.presence_of_element_located(${tuple})))`);
        lines.push(`        select_elem.select_by_visible_text(${JSON.stringify(step.value ?? '')})`);
      } else if (step.action === 'checkbox') {
        lines.push(`        checkbox = wait.until(EC.element_to_be_clickable(${tuple}))`);
        lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", checkbox)`);
        if (step.value === 'false') {
          lines.push(`        if checkbox.is_selected(): checkbox.click()`);
        } else {
          lines.push(`        if not checkbox.is_selected(): checkbox.click()`);
        }
      } else if (step.action === 'radio') {
        lines.push(`        radio = wait.until(EC.element_to_be_clickable(${tuple}))`);
        lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", radio)`);
        lines.push(`        if not radio.is_selected(): radio.click()`);
      } else if (step.action === 'clear') {
        lines.push(`        element = wait.until(EC.visibility_of_element_located(${tuple}))`);
        lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)`);
        lines.push(`        element.clear()`);
      } else if (step.action === 'hover') {
        lines.push(`        element = wait.until(EC.visibility_of_element_located(${tuple}))`);
        lines.push(`        ActionChains(driver).move_to_element(element).perform()`);
      } else if (step.action === 'assert_visible') {
        lines.push(`        assert wait.until(EC.visibility_of_element_located(${tuple})).is_displayed()`);
      } else if (step.action === 'assert_text') {
        lines.push(`        assert wait.until(EC.text_to_be_present_in_element(${tuple}, ${JSON.stringify(step.assertExpected || '')}))`);
      } else if (step.action === 'assert_attribute') {
        lines.push(`        element = wait.until(EC.presence_of_element_located(${tuple}))`);
        lines.push(`        assert element.get_attribute("${step.assertAttribute || 'value'}") == ${JSON.stringify(step.assertExpected || '')}`);
      } else if (step.action === 'print_value') {
        const label = (step.target.text || step.target.labelText || 'Value').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').trim();
        lines.push(`        element = wait.until(EC.presence_of_element_located(${tuple}))`);
        lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)`);
        lines.push(`        val = element.get_attribute("value") if element.tag_name in ["input", "textarea", "select"] else element.text`);
        lines.push(`        print(f"[EXTRACTED] ${label}: {val}")`);
      } else if (step.action === 'press_key') {
        lines.push(`        element = wait.until(EC.visibility_of_element_located(${tuple}))`);
        lines.push(`        element.send_keys(${mapKeyConstant(step.keyCombo)})`);
      } else if (step.action === 'scroll') {
        const coords = step.value ? step.value.split(',') : ['0', '500'];
        lines.push(`        driver.execute_script("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
      } else if (step.action === 'upload_file') {
        lines.push(`        element = wait.until(EC.presence_of_element_located(${tuple}))`);
        lines.push(`        element.send_keys(${JSON.stringify(step.value || '/path/to/upload_file.ext')})`);
      } else if (step.action === 'drag_drop') {
        if (step.dragTarget && step.dragTarget.locators[0]) {
          const targetTuple = formatLocatorTuple(step.dragTarget.locators[0]);
          lines.push(`        src = wait.until(EC.visibility_of_element_located(${tuple}))`);
          lines.push(`        tgt = wait.until(EC.visibility_of_element_located(${targetTuple}))`);
          lines.push(`        ActionChains(driver).drag_and_drop(src, tgt).perform()`);
        }
      } else if (step.action === 'switch_iframe') {
        lines.push(`        iframe = wait.until(EC.presence_of_element_located(${tuple}))`);
        lines.push(`        driver.switch_to.frame(iframe)`);
      } else if (step.action === 'switch_tab') {
        lines.push(`        driver.switch_to.window(driver.window_handles[-1])`);
      } else if (step.action === 'close_tab') {
        lines.push(`        driver.close()`);
        lines.push(`        driver.switch_to.window(driver.window_handles[0])`);
      } else if (step.action === 'wait') {
        lines.push(`        time.sleep(${step.waitDuration || 2})`);
      } else if (step.action === 'navigate') {
        lines.push(`        driver.get("${step.value || startUrl}")`);
      }
      lines.push('');
    }
  }

  lines.push('        elapsed = time.perf_counter() - start_time');
  lines.push('        print(f"[PERF] Test completed successfully in {elapsed:.2f}s")');
  lines.push('');
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
  lines.push('');
  lines.push('    finally:');
  lines.push('        driver.quit()');
  lines.push('');
  lines.push('if __name__ == "__main__":');
  lines.push('    run_test()');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 3. PYTEST GENERATOR (Clean fixtures + def test_* functions + assertions)
// ---------------------------------------------------------------------------
export function generatePytestScript(testCase: TestCaseModel): string {
  const timeout = testCase.settings?.timeout || 10;
  const steps = testCase.steps || [];
  const testFunctionName = `test_${(testCase.name || 'recorded_flow').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

  const hasHover = steps.some((s) => s.action === 'hover' || s.action === 'drag_drop');
  const hasKeys = steps.some((s) => s.action === 'press_key');
  const hasSelect = steps.some((s) => s.action === 'select');

  const lines: string[] = [];

  lines.push(`"""Pytest Suite: ${testCase.name || 'Automated Test'}`);
  lines.push('Generated by Chrome Selenium Recorder');
  lines.push('"""');
  lines.push('import pytest');
  lines.push('import time');
  lines.push('from selenium import webdriver');
  lines.push('from selenium.webdriver.common.by import By');
  lines.push('from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('from selenium.webdriver.support import expected_conditions as EC');
  if (hasKeys) lines.push('from selenium.webdriver.common.keys import Keys');
  if (hasHover) lines.push('from selenium.webdriver.common.action_chains import ActionChains');
  if (hasSelect) lines.push('from selenium.webdriver.support.ui import Select');
  lines.push('');
  lines.push('@pytest.fixture');
  lines.push('def driver():');
  lines.push('    options = webdriver.ChromeOptions()');
  lines.push('    is_headless = os.getenv("HEADLESS", "false").lower() == "true"');
  lines.push('    if is_headless:');
  lines.push('        options.add_argument("--headless=new")');
  lines.push('    options.add_argument("--start-maximized")');
  lines.push('    options.add_argument("--disable-blink-features=AutomationControlled")');
  lines.push('    options.add_experimental_option("excludeSwitches", ["enable-automation"])');
  lines.push('    options.add_experimental_option("useAutomationExtension", False)');
  lines.push('    d = webdriver.Chrome(options=options)');
  lines.push('    try:');
  lines.push('        d.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {');
  lines.push('            "source": "Object.defineProperty(navigator, \'webdriver\', {get: () => undefined})"');
  lines.push('        })');
  lines.push('    except Exception:');
  lines.push('        pass');
  lines.push('    yield d');
  lines.push('    d.quit()');
  lines.push('');
  lines.push('@pytest.fixture');
  lines.push('def wait(driver):');
  lines.push(`    return WebDriverWait(driver, ${timeout})`);
  lines.push('');
  lines.push(`def ${testFunctionName}(driver, wait):`);
  lines.push(`    """Test: ${testCase.name || 'Automated Test'}"""`);

  const startUrl = testCase.url || 'https://example.com';
  lines.push(`    # Step 0: Open target URL`);
  lines.push(`    driver.get("${startUrl}")`);
  lines.push('');

  if (steps.length === 0) {
    lines.push('    pass');
  } else {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const { tuple } = getStepLocator(step);
      lines.push(`    ${buildStepComment(step, i)}`);

      switch (step.action) {
        case 'navigate':
          lines.push(`    driver.get("${step.value || startUrl}")`);
          break;
        case 'click':
          lines.push(`    wait.until(EC.element_to_be_clickable(${tuple})).click()`);
          break;
        case 'type':
          lines.push(`    el = wait.until(EC.visibility_of_element_located(${tuple}))`);
          lines.push(`    el.clear()`);
          lines.push(`    el.send_keys(${JSON.stringify(step.value ?? '')})`);
          break;
        case 'select':
          lines.push(`    Select(wait.until(EC.presence_of_element_located(${tuple}))).select_by_visible_text(${JSON.stringify(step.value ?? '')})`);
          break;
        case 'checkbox':
          lines.push(`    cb = wait.until(EC.element_to_be_clickable(${tuple}))`);
          if (step.value === 'false') {
            lines.push(`    if cb.is_selected(): cb.click()`);
          } else {
            lines.push(`    if not cb.is_selected(): cb.click()`);
          }
          break;
        case 'radio':
          lines.push(`    rd = wait.until(EC.element_to_be_clickable(${tuple}))`);
          lines.push(`    if not rd.is_selected(): rd.click()`);
          break;
        case 'clear':
          lines.push(`    wait.until(EC.visibility_of_element_located(${tuple})).clear()`);
          break;
        case 'hover':
          lines.push(`    el = wait.until(EC.visibility_of_element_located(${tuple}))`);
          lines.push(`    ActionChains(driver).move_to_element(el).perform()`);
          break;
        case 'assert_visible':
          lines.push(`    assert wait.until(EC.visibility_of_element_located(${tuple})).is_displayed()`);
          break;
        case 'assert_text':
          lines.push(`    assert wait.until(EC.text_to_be_present_in_element(${tuple}, ${JSON.stringify(step.assertExpected || '')}))`);
          break;
        case 'assert_attribute':
          lines.push(`    el = wait.until(EC.presence_of_element_located(${tuple}))`);
          lines.push(`    assert el.get_attribute("${step.assertAttribute || 'value'}") == ${JSON.stringify(step.assertExpected || '')}`);
          break;
        case 'print_value': {
          const label = (step.target.text || step.target.labelText || 'Value').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').trim();
          lines.push(`    el = wait.until(EC.presence_of_element_located(${tuple}))`);
          lines.push(`    val = el.get_attribute("value") if el.tag_name in ["input", "textarea", "select"] else el.text`);
          lines.push(`    print(f"[EXTRACTED] ${label}: {val}")`);
          break;
        }
        case 'press_key':
          lines.push(`    wait.until(EC.visibility_of_element_located(${tuple})).send_keys(${mapKeyConstant(step.keyCombo)})`);
          break;
        case 'scroll': {
          const coords = step.value ? step.value.split(',') : ['0', '500'];
          lines.push(`    driver.execute_script("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
          break;
        }
        case 'upload_file':
          lines.push(`    wait.until(EC.presence_of_element_located(${tuple})).send_keys(${JSON.stringify(step.value || '/path/to/upload_file.ext')})`);
          break;
        case 'drag_drop':
          if (step.dragTarget && step.dragTarget.locators[0]) {
            const targetTuple = formatLocatorTuple(step.dragTarget.locators[0]);
            lines.push(`    src = wait.until(EC.visibility_of_element_located(${tuple}))`);
            lines.push(`    tgt = wait.until(EC.visibility_of_element_located(${targetTuple}))`);
            lines.push(`    ActionChains(driver).drag_and_drop(src, tgt).perform()`);
          }
          break;
        case 'switch_iframe':
          lines.push(`    driver.switch_to.frame(wait.until(EC.presence_of_element_located(${tuple})))`);
          break;
        case 'switch_tab':
          lines.push(`    driver.switch_to.window(driver.window_handles[-1])`);
          break;
        case 'close_tab':
          lines.push(`    driver.close()`);
          lines.push(`    driver.switch_to.window(driver.window_handles[0])`);
          break;
        case 'wait':
          lines.push(`    time.sleep(${step.waitDuration || 2})`);
          break;
        default:
          lines.push(`    wait.until(EC.element_to_be_clickable(${tuple})).click()`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main Exported Entry Point
// ---------------------------------------------------------------------------
import { generatePlaywrightScript } from './playwright-generator';
export { generatePlaywrightScript };

export function generateSeleniumScript(testCase: TestCaseModel): string {
  const style = testCase.settings?.codeStyle || 'simple';
  switch (style) {
    case 'simple':
      return generateSimpleScript(testCase);
    case 'pytest':
      return generatePytestScript(testCase);
    case 'enterprise':
    default:
      return generateEnterpriseScript(testCase);
  }
}

export function generateAutomationScript(testCase: TestCaseModel): string {
  if (testCase.settings?.engine === 'playwright') {
    return generatePlaywrightScript(testCase);
  }
  return generateSeleniumScript(testCase);
}
