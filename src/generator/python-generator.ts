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

export function getFallbackLocatorTuples(step: TestStep, max = 3): string[] {
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

  // 1. Top validated unique locators (matchCount === 1)
  for (let i = 0; i < locs.length && tuples.length < max; i++) {
    if (i !== selectedIndex && locs[i] && locs[i].matchCount === 1) {
      const key = `${locs[i].strategy}:${locs[i].value}`;
      if (!seenValues.has(key)) {
        seenValues.add(key);
        tuples.push(formatLocatorTuple(locs[i]));
      }
    }
  }

  // 2. Additional valid candidates (matchCount > 0)
  for (let i = 0; i < locs.length && tuples.length < max; i++) {
    if (i !== selectedIndex && locs[i] && locs[i].matchCount !== 0) {
      const key = `${locs[i].strategy}:${locs[i].value}`;
      if (!seenValues.has(key)) {
        seenValues.add(key);
        tuples.push(formatLocatorTuple(locs[i]));
      }
    }
  }

  if (tuples.length === 0) {
    tuples.push(`(By.TAG_NAME, "${step.target?.tagName || 'body'}")`);
  }

  return tuples;
}

function sanitizeCommentText(text?: string, maxLength = 60): string {
  if (!text) return '';
  const clean = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > maxLength ? clean.substring(0, maxLength - 3) + '...' : clean;
}

function buildStepComment(step: TestStep, index: number): string {
  const componentInfo = step.target?.componentType ? ` in ${step.target.componentType.toUpperCase()}` : '';
  const cleanLabel = sanitizeCommentText(step.target?.labelText);
  const cleanText = sanitizeCommentText(step.target?.text);
  const labelInfo = cleanLabel ? ` "${cleanLabel.replace(/"/g, '\\"')}"` : '';
  const textInfo = cleanText ? ` "${cleanText.replace(/"/g, '\\"')}"` : '';
  const desc = labelInfo || textInfo || `<${step.target?.tagName || 'element'}>`;

  switch (step.action) {
    case 'click':
      return `# Step ${index + 1}: Click${labelInfo || textInfo}${componentInfo}`;
    case 'type':
      return `# Step ${index + 1}: Type into${desc}${componentInfo}`;
    case 'select':
      return `# Step ${index + 1}: Select "${sanitizeCommentText(step.value)}" from${desc}${componentInfo}`;
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
      return `# Step ${index + 1}: Assert text "${sanitizeCommentText(step.assertExpected)}" in${desc}${componentInfo}`;
    case 'assert_attribute':
      return `# Step ${index + 1}: Assert attribute "${sanitizeCommentText(step.assertAttribute)}" on${desc}${componentInfo}`;
    case 'print_value':
      return `# Step ${index + 1}: Extract & Print value from${desc}${componentInfo}`;
    case 'navigate':
      return `# Step ${index + 1}: Navigate to ${sanitizeCommentText(step.value) || 'target URL'}`;
    case 'switch_tab':
      return `# Step ${index + 1}: Switch to latest browser tab`;
    case 'close_tab':
      return `# Step ${index + 1}: Close active tab and switch back`;
    case 'switch_iframe':
      return `# Step ${index + 1}: Switch to iframe ${sanitizeCommentText(step.iframePath) || ''}`;
    case 'press_key':
      return `# Step ${index + 1}: Press key "${sanitizeCommentText(step.keyCombo)}" on${desc}`;
    case 'scroll':
      return `# Step ${index + 1}: Scroll page to ${sanitizeCommentText(step.value) || 'position'}`;
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

export function isPasswordStep(step: TestStep): boolean {
  if (step.isSensitive) return true;
  const fp = step.fingerprint || step.target?.fingerprint;
  const inputType = (fp as any)?.type || (step.target as any)?.type;
  if (inputType === 'password') return true;
  const locVals = (step.target?.locators || []).map((l) => l.value.toLowerCase()).join(' ');
  const text = (fp?.text || step.target?.text || '').toLowerCase();
  const label = (fp?.labelText || step.target?.labelText || '').toLowerCase();
  const name = (fp?.name || '').toLowerCase();
  return (
    locVals.includes('password') ||
    locVals.includes('pass') ||
    label.includes('password') ||
    text.includes('password') ||
    name.includes('password')
  );
}

export function collectTestData(steps: TestStep[]): Record<string, string> {
  const data: Record<string, string> = {};
  const seenKeys = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.action === 'type' && !isPasswordStep(step) && step.value !== undefined) {
      const fp = step.fingerprint || step.target?.fingerprint;
      const keyBase = (
        fp?.labelText ||
        step.target?.labelText ||
        fp?.name ||
        (step.target as any)?.name ||
        step.target?.attributes?.name ||
        fp?.placeholder ||
        fp?.text ||
        step.target?.text ||
        `field_${i + 1}`
      )
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || `field_${i + 1}`;
      let key = keyBase;
      let counter = 2;
      while (seenKeys.has(key)) {
        key = `${keyBase}_${counter++}`;
      }
      seenKeys.add(key);
      data[key] = step.value;
    }
  }
  return data;
}

export function inferSemanticStepName(step: TestStep): string {
  const actionPrefixMap: Record<string, string> = {
    click: 'click',
    type: 'fill',
    select: 'select',
    checkbox: 'toggle',
    radio: 'select_radio',
    clear: 'clear',
    hover: 'hover',
    assert_visible: 'assert_visible',
    assert_text: 'assert_text',
    assert_attribute: 'assert_attr',
    print_value: 'get_value',
    switch_tab: 'switch_to_tab',
    close_tab: 'close_current_tab',
    navigate: 'navigate_to',
    wait: 'wait_seconds',
    scroll: 'scroll_page',
    upload_file: 'upload_to',
    drag_drop: 'drag_and_drop',
    press_key: 'press_key',
  };

  const prefix = actionPrefixMap[step.action] || step.action;

  let descriptor = '';
  const fp = step.fingerprint || step.target?.fingerprint;
  const rowContext = fp?.rowContext || '';
  const label = fp?.labelText || step.target?.labelText || '';
  const text = fp?.text || step.target?.text || '';
  const name = fp?.name || (step.target as any)?.name || step.target?.attributes?.name || step.target?.locators?.find((l) => l.strategy === 'name')?.value || '';
  const placeholder = fp?.placeholder || '';
  const aria = fp?.ariaLabel || '';

  if (rowContext && text) {
    descriptor = `${rowContext}_${text}`;
  } else if (label) {
    descriptor = label;
  } else if (aria) {
    descriptor = aria;
  } else if (name) {
    descriptor = name;
  } else if (placeholder) {
    descriptor = placeholder;
  } else if (text) {
    descriptor = text;
  } else {
    descriptor = step.target?.tagName || 'element';
  }

  const cleanDescriptor = descriptor
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 35);

  return cleanDescriptor ? `${prefix}_${cleanDescriptor}` : `${prefix}_element`;
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
  const hasPassword = steps.some((s) => isPasswordStep(s));

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

  if (hasPassword) {
    lines.push('# Password Hoisted from Environment');
    lines.push('TEST_PASSWORD = os.getenv("TEST_PASSWORD", "CHANGE_ME")');
    lines.push('');
  }

  lines.push('def smart_find(driver, locators, condition=None, timeout=10):');
  lines.push('    """Iterate through top locator tuples with 2-attempt retry on StaleElementReferenceException."""');
  lines.push('    from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('    from selenium.webdriver.support import expected_conditions as EC');
  lines.push('    from selenium.common.exceptions import StaleElementReferenceException, TimeoutException');
  lines.push('    if not isinstance(locators, list):');
  lines.push('        locators = [locators]');
  lines.push('    last_exc = None');
  lines.push('    for attempt in range(2):');
  lines.push('        for idx, (by, val) in enumerate(locators):');
  lines.push('            try:');
  lines.push('                cond = condition(by, val) if condition else EC.presence_of_element_located((by, val))');
  lines.push('                t = timeout if idx == 0 else min(timeout, 3)');
  lines.push('                el = WebDriverWait(driver, t).until(cond)');
  lines.push('                try:');
  lines.push('                    driver.execute_script("arguments[0].scrollIntoView({block: \'center\', inline: \'nearest\'});", el)');
  lines.push('                except Exception:');
  lines.push('                    pass');
  lines.push('                return el');
  lines.push('            except (TimeoutException, StaleElementReferenceException, Exception) as exc:');
  lines.push('                last_exc = exc');
  lines.push('                continue');
  lines.push('    if last_exc:');
  lines.push('        raise last_exc');
  lines.push('    raise TimeoutException(f"None of the locators matched within {timeout}s: {locators}")');
  lines.push('');
  lines.push('def smart_click(driver, locators, timeout=10):');
  lines.push('    """Click element with multi-locator fallback, automatic scroll, 2-attempt retry, and JS click fallback."""');
  lines.push('    from selenium.webdriver.support import expected_conditions as EC');
  lines.push('    from selenium.common.exceptions import StaleElementReferenceException, ElementClickInterceptedException');
  lines.push('    from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('    # Overlay Guard: wait for transient blocking overlays to disappear');
  lines.push('    for overlay_selector in [\'[aria-busy="true"]\', \'.loading-overlay\', \'#loading-overlay\', \'.spinner\', \'#spinner\']:');
  lines.push('        try:');
  lines.push('            WebDriverWait(driver, 2).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, overlay_selector)))');
  lines.push('        except Exception:');
  lines.push('            pass');
  lines.push('    if not isinstance(locators, list):');
  lines.push('        locators = [locators]');
  lines.push('    last_exc = None');
  lines.push('    for attempt in range(2):');
  lines.push('        try:');
  lines.push('            el = smart_find(driver, locators, condition=lambda b, v: EC.element_to_be_clickable((b, v)), timeout=timeout)');
  lines.push('            try:');
  lines.push('                el.click()');
  lines.push('                return el');
  lines.push('            except (StaleElementReferenceException, ElementClickInterceptedException) as exc:');
  lines.push('                last_exc = exc');
  lines.push('                try:');
  lines.push('                    driver.execute_script("arguments[0].click();", el)');
  lines.push('                    return el');
  lines.push('                except Exception:');
  lines.push('                    pass');
  lines.push('        except Exception as exc:');
  lines.push('            last_exc = exc');
  lines.push('    if last_exc:');
  lines.push('        raise last_exc');
  lines.push('');
  lines.push('def find(driver, by, value, timeout=10):');
  lines.push('    """Wait for element, scroll it into view, and return it."""');
  lines.push('    return smart_find(driver, [(by, value)], timeout=timeout)');
  lines.push('');
  lines.push('def click(driver, by, value, timeout=10):');
  lines.push('    """Click element with automatic scroll and JavaScript click fallback if intercepted."""');
  lines.push('    return smart_click(driver, [(by, value)], timeout=timeout)');
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

  let currentFrame: string | null = null;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepFrame = step.iframePath || null;
    if (stepFrame !== currentFrame) {
      if (currentFrame !== null && stepFrame === null) {
        lines.push('    # Return to top-level content from iframe');
        lines.push('    driver.switch_to.default_content()');
        currentFrame = null;
      } else if (stepFrame !== null) {
        if (currentFrame !== null) {
          lines.push('    driver.switch_to.default_content()');
        }
        lines.push(`    # Switch to iframe: ${stepFrame}`);
        lines.push(`    driver.switch_to.frame(find(driver, By.CSS_SELECTOR, "${stepFrame}"))`);
        currentFrame = stepFrame;
      }
    }
    const { tuple, candidate } = getStepLocator(step);
    lines.push(`    ${buildStepComment(step, i)}`);

    switch (step.action) {
      case 'navigate':
        lines.push(`    driver.get("${step.value || startUrl}")`);
        break;
      case 'click':
        if (step.target.isShadowDom && step.target.shadowHostPath && step.target.shadowHostPath.length > 0) {
          const shadowPath = step.target.shadowHostPath;
          const cssFallback = step.target.locators.find((l) => l.strategy === 'css');
          const cssVal = cssFallback ? cssFallback.value : candidate?.value || '';
          lines.push(`    el = driver.execute_script(`);
          lines.push(`        "let curr = document; const hosts = arguments[0]; for (let h of hosts) { const hostEl = curr.querySelector(h); if (!hostEl || !hostEl.shadowRoot) return null; curr = hostEl.shadowRoot; } return curr.querySelector ? (curr.querySelector(arguments[1]) || Array.from(curr.querySelectorAll('a, button, span, li')).find(e => (e.textContent || '').trim().includes(arguments[2]))) : null;",`);
          lines.push(`        ${JSON.stringify(shadowPath)}, ${JSON.stringify(cssVal)}, ${JSON.stringify(step.target.text || '')}`);
          lines.push(`    )`);
          lines.push(`    smart_click(driver, [el])`);
        } else {
          lines.push(`    click(driver, *${tuple})`);
        }
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
        const rawLabel = (step.target.text || step.target.labelText || 'Value')
          .replace(/[\r\n]+/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/"/g, '\\"')
          .replace(/\{/g, '{{')
          .replace(/\}/g, '}}')
          .trim();
        const label = rawLabel.length > 50 ? rawLabel.substring(0, 47) + '...' : rawLabel;
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
        lines.push(`    # Wait for new browser tab/window to open and switch focus`);
        lines.push(`    try:`);
        lines.push(`        wait.until(lambda d: len(d.window_handles) > 1)`);
        lines.push(`    except Exception:`);
        lines.push(`        pass`);
        lines.push(`    driver.switch_to.window(driver.window_handles[-1])`);
        lines.push(`    try:`);
        lines.push(`        wait.until(lambda d: d.execute_script("return document.readyState") == "complete")`);
        lines.push(`    except Exception:`);
        lines.push(`        pass`);
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
    if (isPasswordStep(step)) {
      const varName = step.variableName || 'TEST_PASSWORD';
      sensitiveVars.set(varName, varName);
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
  lines.push('import sys');
  lines.push('import time');
  lines.push('from datetime import datetime');
  lines.push('from pathlib import Path');
  lines.push('from selenium import webdriver');
  lines.push('from selenium.webdriver.common.by import By');
  lines.push('from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('from selenium.webdriver.support import expected_conditions as EC');
  lines.push('');
  lines.push('if hasattr(sys.stdout, "reconfigure"):');
  lines.push('    sys.stdout.reconfigure(encoding="utf-8", errors="replace")');
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

  const testData = collectTestData(steps);
  if (Object.keys(testData).length > 0) {
    lines.push('# Hoisted Test Data Dictionary');
    lines.push('TEST_DATA = {');
    for (const [k, v] of Object.entries(testData)) {
      lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    }
    lines.push('}');
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
  lines.push('    options.add_argument("--disable-popup-blocking")');
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
  lines.push('        for attempt in range(2):');
  lines.push('            for idx, (by, val) in enumerate(locators):');
  lines.push('                try:');
  lines.push('                    wait_t = timeout if idx == 0 else min(timeout, 3)');
  lines.push('                    w = WebDriverWait(d, wait_t)');
  lines.push('                    if condition == "clickable":');
  lines.push('                        el = w.until(EC.element_to_be_clickable((by, val)))');
  lines.push('                    elif condition == "visible":');
  lines.push('                        el = w.until(EC.visibility_of_element_located((by, val)))');
  lines.push('                    else:');
  lines.push('                        el = w.until(EC.presence_of_element_located((by, val)))');
  lines.push('                    try:');
  lines.push('                        d.execute_script("arguments[0].scrollIntoView({block: \'center\', inline: \'nearest\'});", el)');
  lines.push('                    except Exception:');
  lines.push('                        pass');
  lines.push('                    if idx > 0:');
  lines.push('                        print(f"[SELF-HEALED] Step locator failed; automatically healed using backup: ({by}, \'{val}\')")');
  lines.push('                    return el');
  lines.push('                except Exception as e:');
  lines.push('                    last_exc = e');
  lines.push('        raise last_exc');
  lines.push('');
  lines.push('    smart_find = find_resilient');
  lines.push('');
  lines.push('    def smart_click(d, locators, timeout=10):');
  lines.push('        # Overlay Guard: wait for transient blocking overlays to disappear');
  lines.push('        for overlay_selector in [\'[aria-busy="true"]\', \'.loading-overlay\', \'#loading-overlay\', \'.spinner\', \'#spinner\']:');
  lines.push('            try:');
  lines.push('                WebDriverWait(d, 2).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, overlay_selector)))');
  lines.push('            except Exception:');
  lines.push('                pass');
  lines.push('        last_exc = None');
  lines.push('        for attempt in range(2):');
  lines.push('            try:');
  lines.push('                el = find_resilient(d, locators, timeout=timeout, condition="clickable")');
  lines.push('                try:');
  lines.push('                    el.click()');
  lines.push('                    return el');
  lines.push('                except Exception as e:');
  lines.push('                    last_exc = e');
  lines.push('                    try:');
  lines.push('                        d.execute_script("arguments[0].click();", el)');
  lines.push('                        return el');
  lines.push('                    except Exception:');
  lines.push('                        pass');
  lines.push('            except Exception as e:');
  lines.push('                last_exc = e');
  lines.push('        if last_exc:');
  lines.push('            raise last_exc');
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
    let currentFrame: string | null = null;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepFrame = step.iframeSelector || step.iframePath || null;
      if (stepFrame !== currentFrame) {
        if (currentFrame !== null && stepFrame === null) {
          lines.push('        # Return to main page from iframe');
          lines.push('        driver.switch_to.default_content()');
          currentFrame = null;
        } else if (stepFrame !== null) {
          if (currentFrame !== null) {
            lines.push('        driver.switch_to.default_content()');
          }
          lines.push(`        # Switch into iframe: ${stepFrame}`);
          lines.push(`        iframe_elem = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${stepFrame}")))`);
          lines.push(`        driver.switch_to.frame(iframe_elem)`);
          currentFrame = stepFrame;
        }
      }
      const { tuple, candidate } = getStepLocator(step);
      lines.push(`        ${buildStepComment(step, i)}`);

      const shadowHost = step.target.shadowHostSelector || candidate?.shadowHostSelector;
      const shadowHosts = step.shadowHosts || (step.target.shadowHostPath && step.target.shadowHostPath.length > 0 ? step.target.shadowHostPath : (shadowHost ? [shadowHost] : undefined));

      if (step.action === 'click') {
        if (shadowHosts && shadowHosts.length > 0) {
          const cssFallback = step.target.locators.find((l) => l.strategy === 'css');
          const shadowLocatorTuple = cssFallback ? formatLocatorTuple(cssFallback) : tuple;
          const cssVal = cssFallback ? cssFallback.value : candidate?.value || '';

          const primaryHost = shadowHosts[0];
          lines.push(`        shadow_host = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${primaryHost}")))`);
          lines.push(`        shadow_hosts = ${JSON.stringify(shadowHosts)}`);
          lines.push(`        try:`);
          lines.push(`            curr_root = driver`);
          lines.push(`            for h_sel in shadow_hosts:`);
          lines.push(`                h_el = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, h_sel)))`);
          lines.push(`                curr_root = h_el.shadow_root`);
          lines.push(`            element = curr_root.find_element(*${shadowLocatorTuple})`);
          lines.push(`        except Exception:`);
          lines.push(`            element = driver.execute_script(`);
          lines.push(`                "let curr = arguments[0]; const hosts = arguments[3]; if (hosts && hosts.length > 1) { curr = document; for (let h of hosts) { const hostEl = curr.querySelector(h); if (!hostEl || !hostEl.shadowRoot) break; curr = hostEl.shadowRoot; } } else if (curr.shadowRoot) { curr = curr.shadowRoot; } return curr.querySelector ? (curr.querySelector(arguments[1]) || Array.from(curr.querySelectorAll('a, button, span, li')).find(e => (e.textContent || '').trim().includes(arguments[2]))) : null;",`);
          lines.push(`                shadow_host, ${JSON.stringify(cssVal)}, ${JSON.stringify(step.target.text || '')}, shadow_hosts`);
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
        const isPwd = isPasswordStep(step);
        const valExpression = isPwd
          ? (step.variableName || 'TEST_PASSWORD')
          : JSON.stringify(step.value ?? '');
        lines.push(`        try:`);
        lines.push(`            element = wait.until(EC.visibility_of_element_located(${tuple}))`);
        lines.push(`        except Exception:`);
        const fallbackTuples = getFallbackLocatorTuples(step);
        lines.push(`            # Self-Healing Fallback across ranked locators`);
        lines.push(`            element = find_resilient(driver, [${fallbackTuples.join(', ')}], timeout=5, condition="visible")`);
        lines.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)`);
        lines.push('        try:');
        lines.push('            element.clear()');
        lines.push('        except Exception:');
        lines.push('            driver.execute_script("arguments[0].innerText = \'\';", element)');
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
        const rawLabel = (step.target.text || step.target.labelText || 'Value')
          .replace(/[\r\n]+/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/"/g, '\\"')
          .replace(/\{/g, '{{')
          .replace(/\}/g, '}}')
          .trim();
        const label = rawLabel.length > 50 ? rawLabel.substring(0, 47) + '...' : rawLabel;
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
        lines.push(`        # Wait for new browser tab/window to open and switch focus`);
        lines.push(`        try:`);
        lines.push(`            wait.until(lambda d: len(d.window_handles) > 1)`);
        lines.push(`        except Exception:`);
        lines.push(`            pass`);
        lines.push(`        driver.switch_to.window(driver.window_handles[-1])`);
        lines.push(`        try:`);
        lines.push(`            wait.until(lambda d: d.execute_script("return document.readyState") == "complete")`);
        lines.push(`        except Exception:`);
        lines.push(`            pass`);
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
  lines.push('import os');
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

  const hasPassword = steps.some((s) => isPasswordStep(s));
  if (hasPassword) {
    lines.push('TEST_PASSWORD = os.getenv("TEST_PASSWORD", "CHANGE_ME")');
    lines.push('');
  }

  const testData = collectTestData(steps);
  if (Object.keys(testData).length > 0) {
    lines.push('TEST_DATA = {');
    for (const [k, v] of Object.entries(testData)) {
      lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    }
    lines.push('}');
    lines.push('');
  }

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
  lines.push('def smart_find(driver, locators, condition=None, timeout=10):');
  lines.push('    """Wait for element across top locators with 2-attempt self-healing retry."""');
  lines.push('    from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('    from selenium.webdriver.support import expected_conditions as EC');
  lines.push('    from selenium.common.exceptions import StaleElementReferenceException, TimeoutException');
  lines.push('    if not isinstance(locators, list):');
  lines.push('        locators = [locators]');
  lines.push('    last_exc = None');
  lines.push('    for attempt in range(2):');
  lines.push('        for idx, (by, val) in enumerate(locators):');
  lines.push('            try:');
  lines.push('                cond = condition(by, val) if condition else EC.presence_of_element_located((by, val))');
  lines.push('                t = timeout if idx == 0 else min(timeout, 3)');
  lines.push('                el = WebDriverWait(driver, t).until(cond)');
  lines.push('                try:');
  lines.push('                    driver.execute_script("arguments[0].scrollIntoView({block: \'center\', inline: \'nearest\'});", el)');
  lines.push('                except Exception:');
  lines.push('                    pass');
  lines.push('                return el');
  lines.push('            except (TimeoutException, StaleElementReferenceException, Exception) as exc:');
  lines.push('                last_exc = exc');
  lines.push('                continue');
  lines.push('    if last_exc:');
  lines.push('        raise last_exc');
  lines.push('    raise TimeoutException(f"None of the locators matched within {timeout}s: {locators}")');
  lines.push('');
  lines.push('def smart_click(driver, locators, timeout=10):');
  lines.push('    """Click element with multi-locator fallback, 2-attempt retry on Stale/Intercepted, and JS click fallback."""');
  lines.push('    from selenium.webdriver.support import expected_conditions as EC');
  lines.push('    from selenium.common.exceptions import StaleElementReferenceException, ElementClickInterceptedException');
  lines.push('    from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('    # Overlay Guard: wait for transient blocking overlays to disappear');
  lines.push('    for overlay_selector in [\'[aria-busy="true"]\', \'.loading-overlay\', \'#loading-overlay\', \'.spinner\', \'#spinner\']:');
  lines.push('        try:');
  lines.push('            WebDriverWait(driver, 2).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, overlay_selector)))');
  lines.push('        except Exception:');
  lines.push('            pass');
  lines.push('    if not isinstance(locators, list):');
  lines.push('        locators = [locators]');
  lines.push('    last_exc = None');
  lines.push('    for attempt in range(2):');
  lines.push('        try:');
  lines.push('            el = smart_find(driver, locators, condition=lambda b, v: EC.element_to_be_clickable((b, v)), timeout=timeout)');
  lines.push('            try:');
  lines.push('                el.click()');
  lines.push('                return el');
  lines.push('            except (StaleElementReferenceException, ElementClickInterceptedException) as exc:');
  lines.push('                last_exc = exc');
  lines.push('                try:');
  lines.push('                    driver.execute_script("arguments[0].click();", el)');
  lines.push('                    return el');
  lines.push('                except Exception:');
  lines.push('                    pass');
  lines.push('        except Exception as exc:');
  lines.push('            last_exc = exc');
  lines.push('    if last_exc:');
  lines.push('        raise last_exc');
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
    let currentFrame: string | null = null;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepFrame = step.iframePath || null;
      if (stepFrame !== currentFrame) {
        if (currentFrame !== null && stepFrame === null) {
          lines.push('    # Return to default content from iframe');
          lines.push('    driver.switch_to.default_content()');
          currentFrame = null;
        } else if (stepFrame !== null) {
          if (currentFrame !== null) {
            lines.push('    driver.switch_to.default_content()');
          }
          lines.push(`    # Switch to iframe: ${stepFrame}`);
          lines.push(`    driver.switch_to.frame(wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${stepFrame}"))))`);
          currentFrame = stepFrame;
        }
      }
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
          const rawLabel = (step.target.text || step.target.labelText || 'Value')
            .replace(/[\r\n]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/"/g, '\\"')
            .replace(/\{/g, '{{')
            .replace(/\}/g, '}}')
            .trim();
          const label = rawLabel.length > 50 ? rawLabel.substring(0, 47) + '...' : rawLabel;
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
          lines.push(`    # Wait for new browser tab/window to open and switch focus`);
          lines.push(`    try:`);
          lines.push(`        wait.until(lambda d: len(d.window_handles) > 1)`);
          lines.push(`    except Exception:`);
          lines.push(`        pass`);
          lines.push(`    driver.switch_to.window(driver.window_handles[-1])`);
          lines.push(`    try:`);
          lines.push(`        wait.until(lambda d: d.execute_script("return document.readyState") == "complete")`);
          lines.push(`    except Exception:`);
          lines.push(`        pass`);
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
// 4. PAGE OBJECT MODEL (POM) GENERATOR (Encapsulated class + test runner)
// ---------------------------------------------------------------------------
function toPascalCase(text: string): string {
  const cleaned = text.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) return 'AutomatedTestPage';
  const words = cleaned.split(/\s+/);
  const base = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  return base.endsWith('Page') ? base : `${base}Page`;
}

function sanitizeMethodSuffix(step: TestStep): string {
  const label = step.target?.text || step.target?.labelText || step.target?.tagName || 'element';
  const clean = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 25);
  return clean || 'element';
}

export function generatePomScript(testCase: TestCaseModel): string {
  const timeout = testCase.settings?.timeout || 10;
  const steps = testCase.steps || [];
  const className = toPascalCase(testCase.name || 'Automated Test');
  const startUrl = testCase.url || 'https://example.com';

  const hasHover = steps.some((s) => s.action === 'hover' || s.action === 'drag_drop');
  const hasKeys = steps.some((s) => s.action === 'press_key');
  const hasSelect = steps.some((s) => s.action === 'select');
  const hasIframes = steps.some((s) => !!s.iframePath || s.action === 'switch_iframe');

  const lines: string[] = [];

  lines.push('"""');
  lines.push(`Page Object Model (POM): ${testCase.name || 'Automated Test'}`);
  lines.push('Encapsulates web elements and interactions into a clean Page Object.');
  lines.push('"""');
  lines.push('import os');
  lines.push('import time');
  lines.push('from selenium import webdriver');
  lines.push('from selenium.webdriver.common.by import By');
  lines.push('from selenium.webdriver.support.ui import WebDriverWait');
  lines.push('from selenium.webdriver.support import expected_conditions as EC');
  if (hasKeys) lines.push('from selenium.webdriver.common.keys import Keys');
  if (hasHover) lines.push('from selenium.webdriver.common.action_chains import ActionChains');
  if (hasSelect) lines.push('from selenium.webdriver.support.ui import Select');
  lines.push('');
  lines.push(`class ${className}:`);
  lines.push(`    """Page Object for ${testCase.name || 'Application'}."""`);
  lines.push('');

  // Class Locators
  lines.push('    # --- Locators ---');
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (['navigate', 'wait', 'switch_tab', 'close_tab', 'scroll'].includes(step.action)) {
      continue;
    }
    const { tuple } = getStepLocator(step);
    const fallbacks = getFallbackLocatorTuples(step);
    const semanticName = inferSemanticStepName(step);
    const semanticUpper = semanticName.toUpperCase();
    lines.push(`    LOCATOR_STEP_${i + 1} = ${tuple}`);
    lines.push(`    LOCATORS_STEP_${i + 1} = [${fallbacks.join(', ')}]`);
    lines.push(`    LOCATOR_${semanticUpper} = LOCATOR_STEP_${i + 1}`);
    lines.push(`    LOCATORS_${semanticUpper} = LOCATORS_STEP_${i + 1}`);
    if (step.action === 'drag_drop' && step.dragTarget?.locators?.[0]) {
      lines.push(`    LOCATOR_STEP_${i + 1}_TARGET = ${formatLocatorTuple(step.dragTarget.locators[0])}`);
    }
  }
  lines.push('');

  // Class Init
  lines.push('    def __init__(self, driver, timeout=10):');
  lines.push('        self.driver = driver');
  lines.push('        self.timeout = timeout');
  lines.push('        self.wait = WebDriverWait(driver, timeout)');
  lines.push('        self._current_frame = None');
  lines.push('');
  lines.push('    def smart_find(self, locators, condition="presence", timeout=None):');
  lines.push('        """Self-healing locator finder iterating top candidate tuples with 2-attempt retry."""');
  lines.push('        t = timeout or self.timeout');
  lines.push('        if not isinstance(locators, list):');
  lines.push('            locators = [locators]');
  lines.push('        last_exc = None');
  lines.push('        for attempt in range(2):');
  lines.push('            for idx, (by, val) in enumerate(locators):');
  lines.push('                try:');
  lines.push('                    w = WebDriverWait(self.driver, t if idx == 0 else min(t, 3))');
  lines.push('                    if condition == "clickable":');
  lines.push('                        el = w.until(EC.element_to_be_clickable((by, val)))');
  lines.push('                    elif condition == "visible":');
  lines.push('                        el = w.until(EC.visibility_of_element_located((by, val)))');
  lines.push('                    else:');
  lines.push('                        el = w.until(EC.presence_of_element_located((by, val)))');
  lines.push('                    try:');
  lines.push('                        self.driver.execute_script("arguments[0].scrollIntoView({block: \'center\', inline: \'nearest\'});", el)');
  lines.push('                    except Exception:');
  lines.push('                        pass');
  lines.push('                    return el');
  lines.push('                except Exception as exc:');
  lines.push('                    last_exc = exc');
  lines.push('        if last_exc:');
  lines.push('            raise last_exc');
  lines.push('');
  lines.push('    def smart_click(self, locators, timeout=None):');
  lines.push('        """Self-healing click with automatic scroll, overlay guard, 2-attempt retry, and JS click fallback."""');
  lines.push('        t = timeout or self.timeout');
  lines.push('        # Overlay Guard: wait for transient blocking overlays to disappear');
  lines.push('        for overlay_selector in [\'[aria-busy="true"]\', \'.loading-overlay\', \'#loading-overlay\', \'.spinner\', \'#spinner\']:');
  lines.push('            try:');
  lines.push('                WebDriverWait(self.driver, 2).until(');
  lines.push('                    EC.invisibility_of_element_located((By.CSS_SELECTOR, overlay_selector))');
  lines.push('                )');
  lines.push('            except Exception:');
  lines.push('                pass');
  lines.push('        last_exc = None');
  lines.push('        for attempt in range(2):');
  lines.push('            try:');
  lines.push('                el = self.smart_find(locators, condition="clickable", timeout=t)');
  lines.push('                try:');
  lines.push('                    el.click()');
  lines.push('                    return el');
  lines.push('                except Exception as exc:');
  lines.push('                    last_exc = exc');
  lines.push('                    try:');
  lines.push('                        self.driver.execute_script("arguments[0].click();", el)');
  lines.push('                        return el');
  lines.push('                    except Exception:');
  lines.push('                        pass');
  lines.push('            except Exception as exc:');
  lines.push('                last_exc = exc');
  lines.push('        if last_exc:');
  lines.push('            raise last_exc');
  lines.push('');

  // Base methods
  lines.push(`    def open(self, url="${startUrl}"):`);
  lines.push('        """Navigate to page URL."""');
  lines.push('        self.driver.get(url)');
  lines.push('        return self');
  lines.push('');

  if (hasIframes) {
    lines.push('    def _ensure_frame(self, frame_selector=None):');
    lines.push('        """Switch to target iframe context or default content."""');
    lines.push('        if frame_selector:');
    lines.push('            if self._current_frame != frame_selector:');
    lines.push('                self.driver.switch_to.default_content()');
    lines.push('                frame_el = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, frame_selector)))');
    lines.push('                self.driver.switch_to.frame(frame_el)');
    lines.push('                self._current_frame = frame_selector');
    lines.push('        else:');
    lines.push('            if self._current_frame is not None:');
    lines.push('                self.driver.switch_to.default_content()');
    lines.push('                self._current_frame = None');
    lines.push('        return self');
    lines.push('');
  }

  // Action methods
  lines.push('    # --- Action Methods ---');
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const locName = `self.LOCATOR_STEP_${i + 1}`;
    const suffix = sanitizeMethodSuffix(step);
    const methodName = `step_${i + 1}_${step.action}_${suffix}`;
    const semanticName = inferSemanticStepName(step);
    const frameArg = step.iframeSelector || step.iframePath ? `"${step.iframeSelector || step.iframePath}"` : 'None';

    switch (step.action) {
      case 'click':
        lines.push(`    def ${methodName}(self):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        try:`);
        lines.push(`            el = self.wait.until(EC.element_to_be_clickable(${locName}))`);
        lines.push('            try:');
        lines.push('                el.click()');
        lines.push('            except Exception:');
        lines.push('                self.driver.execute_script("arguments[0].click();", el)');
        lines.push(`        except Exception:`);
        lines.push(`            self.smart_click(self.LOCATORS_STEP_${i + 1})`);
        lines.push('        return self');
        lines.push(`    ${semanticName} = ${methodName}`);
        break;

      case 'type':
        lines.push(`    def ${methodName}(self, value=${JSON.stringify(step.value ?? '')}):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        try:`);
        lines.push(`            el = self.wait.until(EC.visibility_of_element_located(${locName}))`);
        lines.push(`        except Exception:`);
        lines.push(`            el = self.smart_find(self.LOCATORS_STEP_${i + 1}, condition="visible")`);
        lines.push('        try:');
        lines.push('            el.clear()');
        lines.push('        except Exception:');
        lines.push('            self.driver.execute_script("arguments[0].innerText = \'\';", el)');
        lines.push('        el.send_keys(value)');
        lines.push('        return self');
        break;

      case 'clear':
        lines.push(`    def ${methodName}(self):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        self.wait.until(EC.visibility_of_element_located(${locName})).clear()`);
        lines.push('        return self');
        break;

      case 'select':
        lines.push(`    def ${methodName}(self, value=${JSON.stringify(step.value ?? '')}):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        select_el = Select(self.wait.until(EC.presence_of_element_located(${locName})))`);
        lines.push('        select_el.select_by_visible_text(value)');
        lines.push('        return self');
        break;

      case 'checkbox':
        lines.push(`    def ${methodName}(self, checked=${step.value !== 'false'}):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        cb = self.wait.until(EC.element_to_be_clickable(${locName}))`);
        lines.push('        if cb.is_selected() != checked:');
        lines.push('            cb.click()');
        lines.push('        return self');
        break;

      case 'radio':
        lines.push(`    def ${methodName}(self):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        rd = self.wait.until(EC.element_to_be_clickable(${locName}))`);
        lines.push('        if not rd.is_selected():');
        lines.push('            rd.click()');
        lines.push('        return self');
        break;

      case 'hover':
        lines.push(`    def ${methodName}(self):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        el = self.wait.until(EC.visibility_of_element_located(${locName}))`);
        lines.push('        ActionChains(self.driver).move_to_element(el).perform()');
        lines.push('        return self');
        break;

      case 'assert_visible':
        lines.push(`    def ${methodName}(self):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        assert self.wait.until(EC.visibility_of_element_located(${locName})).is_displayed()`);
        lines.push('        return self');
        break;

      case 'assert_text':
        lines.push(`    def ${methodName}(self, expected=${JSON.stringify(step.assertExpected || '')}):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        assert self.wait.until(EC.text_to_be_present_in_element(${locName}, expected))`);
        lines.push('        return self');
        break;

      case 'assert_attribute':
        lines.push(`    def ${methodName}(self, attribute="${step.assertAttribute || 'value'}", expected=${JSON.stringify(step.assertExpected || '')}):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        el = self.wait.until(EC.presence_of_element_located(${locName}))`);
        lines.push('        assert el.get_attribute(attribute) == expected');
        lines.push('        return self');
        break;

      case 'print_value':
        lines.push(`    def ${methodName}(self):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        el = self.wait.until(EC.presence_of_element_located(${locName}))`);
        lines.push('        val = el.get_attribute("value") if el.tag_name in ["input", "textarea", "select"] else el.text');
        lines.push('        print(f"[EXTRACTED] {val}")');
        lines.push('        return val');
        break;

      case 'press_key':
        lines.push(`    def ${methodName}(self):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        el = self.wait.until(EC.visibility_of_element_located(${locName}))`);
        lines.push(`        el.send_keys(${mapKeyConstant(step.keyCombo)})`);
        lines.push('        return self');
        break;

      case 'upload_file':
        lines.push(`    def ${methodName}(self, file_path=${JSON.stringify(step.value || '/path/to/upload_file.ext')}):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        self.wait.until(EC.presence_of_element_located(${locName})).send_keys(file_path)`);
        lines.push('        return self');
        break;

      case 'drag_drop':
        lines.push(`    def ${methodName}(self):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        src = self.wait.until(EC.visibility_of_element_located(${locName}))`);
        if (step.dragTarget?.locators?.[0]) {
          lines.push(`        tgt = self.wait.until(EC.visibility_of_element_located(self.LOCATOR_STEP_${i + 1}_TARGET))`);
          lines.push('        ActionChains(self.driver).drag_and_drop(src, tgt).perform()');
        } else {
          lines.push('        ActionChains(self.driver).click_and_hold(src).release().perform()');
        }
        lines.push('        return self');
        break;

      case 'scroll': {
        const coords = step.value ? step.value.split(',') : ['0', '500'];
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        self.driver.execute_script("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
        lines.push('        return self');
        break;
      }

      case 'wait':
        lines.push(`    def ${methodName}(self, seconds=${step.waitDuration || 2}):`);
        lines.push('        time.sleep(seconds)');
        lines.push('        return self');
        break;

      case 'navigate':
        lines.push(`    def ${methodName}(self, url="${step.value || startUrl}"):`);
        lines.push('        self.driver.get(url)');
        lines.push('        return self');
        break;

      case 'switch_tab':
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        # Wait for new browser tab/window to open and switch focus`);
        lines.push(`        try:`);
        lines.push(`            WebDriverWait(self.driver, 10).until(lambda d: len(d.window_handles) > 1)`);
        lines.push(`        except Exception:`);
        lines.push(`            pass`);
        lines.push('        self.driver.switch_to.window(self.driver.window_handles[-1])');
        lines.push(`        try:`);
        lines.push(`            WebDriverWait(self.driver, 10).until(lambda d: d.execute_script("return document.readyState") == "complete")`);
        lines.push(`        except Exception:`);
        lines.push(`            pass`);
        lines.push('        return self');
        break;

      case 'close_tab':
        lines.push(`    def ${methodName}(self):`);
        lines.push('        self.driver.close()');
        lines.push('        self.driver.switch_to.window(self.driver.window_handles[0])');
        lines.push('        return self');
        break;

      case 'switch_iframe':
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        self._ensure_frame("${step.iframePath || 'iframe'}")`);
        lines.push('        return self');
        break;

      default:
        lines.push(`    def ${methodName}(self):`);
        if (hasIframes) lines.push(`        self._ensure_frame(${frameArg})`);
        lines.push(`        self.wait.until(EC.element_to_be_clickable(${locName})).click()`);
        lines.push('        return self');
    }
    if (semanticName && semanticName !== methodName) {
      lines.push(`    ${semanticName} = ${methodName}`);
    }
    lines.push('');
  }

  // Test Runner function
  lines.push('def run_test():');
  lines.push('    is_headless = os.getenv("HEADLESS", "false").lower() == "true"');
  lines.push('    options = webdriver.ChromeOptions()');
  lines.push('    if is_headless:');
  lines.push('        options.add_argument("--headless=new")');
  lines.push('    options.add_argument("--start-maximized")');
  lines.push('    options.add_argument("--disable-blink-features=AutomationControlled")');
  lines.push('    driver = webdriver.Chrome(options=options)');
  lines.push('    try:');
  lines.push(`        page = ${className}(driver, timeout=${timeout})`);
  lines.push('        page.open()');
  lines.push('');

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const suffix = sanitizeMethodSuffix(step);
    const methodName = `step_${i + 1}_${step.action}_${suffix}`;

    if (step.action === 'type') {
      const val = JSON.stringify(step.value ?? '');
      lines.push(`        page.${methodName}(${val})`);
    } else if (step.action === 'select') {
      const val = JSON.stringify(step.value ?? '');
      lines.push(`        page.${methodName}(${val})`);
    } else if (step.action === 'assert_text') {
      const val = JSON.stringify(step.assertExpected || '');
      lines.push(`        page.${methodName}(${val})`);
    } else if (step.action === 'navigate') {
      const val = JSON.stringify(step.value || startUrl);
      lines.push(`        page.${methodName}(${val})`);
    } else {
      lines.push(`        page.${methodName}()`);
    }
  }

  lines.push('');
  lines.push('        print("[SUCCESS] Page Object Model test passed successfully!")');
  lines.push('    finally:');
  lines.push('        driver.quit()');
  lines.push('');
  lines.push('if __name__ == "__main__":');
  lines.push('    run_test()');
  lines.push('');

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
    case 'pom':
      return generatePomScript(testCase);
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
