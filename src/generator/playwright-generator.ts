import { TestCaseModel, TestStep, LocatorCandidate } from '../types/model';
import { inferSemanticStepName, isPasswordStep } from './python-generator';

/**
 * Formats a LocatorCandidate into a clean Playwright locator selector string.
 */
export function formatPlaywrightLocator(candidate: LocatorCandidate): string {
  const { strategy, value } = candidate;
  const hasBackslash = value.includes('\\');
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const rawPrefix = hasBackslash ? 'r' : '';
  const formattedVal = hasBackslash ? `${rawPrefix}"${value.replace(/"/g, '\\"')}"` : `"${escaped}"`;

  switch (strategy) {
    case 'id':
      return `"#${escaped}"`;
    case 'data-testid':
      return `"[data-testid=\\"${escaped}\\"]"`;
    case 'aria-label':
      return `"[aria-label=\\"${escaped}\\"]"`;
    case 'xpath':
    case 'absolute-xpath':
      return `"xpath=${escaped}"`;
    case 'css':
    default:
      return formattedVal;
  }
}

function getStepLocator(step: TestStep): { selector: string; candidate?: LocatorCandidate } {
  if (!step.target || !step.target.locators || step.target.locators.length === 0) {
    return { selector: `"${step.target?.tagName || 'body'}"` };
  }
  const selectedIndex = step.target.selectedLocatorIndex ?? 0;
  const candidate = step.target.locators[selectedIndex] || step.target.locators[0];
  if (!candidate) {
    return { selector: `"${step.target?.tagName || 'body'}"` };
  }
  return { selector: formatPlaywrightLocator(candidate), candidate };
}

export function getStepPlaywrightLocators(step: TestStep, max = 3): string[] {
  if (!step.target || !step.target.locators || step.target.locators.length === 0) {
    return [`"${step.target?.tagName || 'body'}"`];
  }
  const locs = step.target.locators;
  const selectedIndex = step.target.selectedLocatorIndex ?? 0;
  const selectors: string[] = [];
  const seen = new Set<string>();

  const primary = locs[selectedIndex] || locs[0];
  if (primary) {
    const sel = formatPlaywrightLocator(primary);
    selectors.push(sel);
    seen.add(sel);
  }

  // 1. Top unique candidates (matchCount === 1)
  for (let i = 0; i < locs.length && selectors.length < max; i++) {
    if (i !== selectedIndex && locs[i] && locs[i].matchCount === 1) {
      const sel = formatPlaywrightLocator(locs[i]);
      if (!seen.has(sel)) {
        seen.add(sel);
        selectors.push(sel);
      }
    }
  }

  // 2. Additional valid candidates (matchCount !== 0)
  for (let i = 0; i < locs.length && selectors.length < max; i++) {
    if (i !== selectedIndex && locs[i] && locs[i].matchCount !== 0) {
      const sel = formatPlaywrightLocator(locs[i]);
      if (!seen.has(sel)) {
        seen.add(sel);
        selectors.push(sel);
      }
    }
  }

  return selectors;
}

export function buildPlaywrightLocatorExpr(base: string, step: TestStep): string {
  const selectors = getStepPlaywrightLocators(step, 3);
  if (selectors.length <= 1) {
    return `${base}.locator(${selectors[0]})`;
  }
  let expr = `${base}.locator(${selectors[0]})`;
  for (let i = 1; i < selectors.length; i++) {
    expr += `.or_(${base}.locator(${selectors[i]}))`;
  }
  return expr;
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
    case 'switch_tab':
      return `# Step ${index + 1}: Switch to Tab index ${step.tabIndex ?? -1}${step.tabTitle ? ` (${sanitizeCommentText(step.tabTitle)})` : ''}`;
    case 'navigate':
      return `# Step ${index + 1}: Navigate to ${sanitizeCommentText(step.value) || 'target URL'}`;
    case 'wait':
      return `# Step ${index + 1}: Wait for ${step.waitDuration ?? 2} seconds`;
    case 'click':
      return `# Step ${index + 1}: Click${labelInfo || textInfo}${componentInfo}`;
    case 'type':
      return `# Step ${index + 1}: Type into${desc}${componentInfo}`;
    case 'select':
      return `# Step ${index + 1}: Select "${sanitizeCommentText(step.value)}" from${desc}${componentInfo}`;
    case 'checkbox':
      return `# Step ${index + 1}: Toggle checkbox${desc}${componentInfo}`;
    case 'radio':
      return `# Step ${index + 1}: Select radio option${desc}${componentInfo}`;
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
    default:
      return `# Step ${index + 1}: ${step.action} on ${desc}`;
  }
}

// ---------------------------------------------------------------------------
// 1. PLAYWRIGHT SIMPLE SCRIPT (~25-40 lines, beginner-friendly, sync API)
// ---------------------------------------------------------------------------
export function generatePlaywrightSimpleScript(testCase: TestCaseModel): string {
  const steps = testCase.steps || [];
  const lines: string[] = [];
  const startUrl = testCase.url || 'https://example.com';

  lines.push(`"""`);
  lines.push(`Playwright Python Test: ${testCase.name || 'Automated Test'}`);
  lines.push(`Target URL: ${startUrl}`);
  lines.push(`"""`);
  lines.push('from playwright.sync_api import sync_playwright');
  lines.push('import time');
  lines.push('import os');
  lines.push('');

  const hasPassword = steps.some((s) => isPasswordStep(s));
  if (hasPassword) {
    lines.push('TEST_PASSWORD = os.getenv("TEST_PASSWORD", "CHANGE_ME")');
    lines.push('');
  }

  lines.push('with sync_playwright() as p:');
  lines.push('    browser = p.chromium.launch(headless=False)');
  lines.push('    context = browser.new_context(viewport={"width": 1920, "height": 1080})');
  lines.push('    page = context.new_page()');
  lines.push('');
  lines.push('    try:');
  lines.push(`        # Open target URL`);
  lines.push(`        page.goto("${startUrl}")`);
  lines.push('');

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const { selector } = getStepLocator(step);
    const base = step.iframeSelector || step.iframePath ? `page.frame_locator("${step.iframeSelector || step.iframePath}")` : 'page';
    const locExpr = buildPlaywrightLocatorExpr(base, step);
    lines.push(`        ${buildStepComment(step, i)}`);

    switch (step.action) {
      case 'click':
        lines.push(`        ${locExpr}.click()`);
        break;
      case 'type': {
        const isPwd = isPasswordStep(step);
        const val = isPwd ? (step.variableName || 'TEST_PASSWORD') : JSON.stringify(step.value ?? '');
        lines.push(`        ${locExpr}.fill(${val})`);
        break;
      }
      case 'clear':
        lines.push(`        ${locExpr}.clear()`);
        break;
      case 'checkbox':
        if (step.value === 'false') {
          lines.push(`        ${locExpr}.uncheck()`);
        } else {
          lines.push(`        ${locExpr}.check()`);
        }
        break;
      case 'radio':
        lines.push(`        ${locExpr}.check()`);
        break;
      case 'select':
        lines.push(`        ${locExpr}.select_option(label=${JSON.stringify(step.value ?? '')})`);
        break;
      case 'hover':
        lines.push(`        ${locExpr}.hover()`);
        break;
      case 'assert_visible':
        lines.push(`        assert ${locExpr}.is_visible(), "Element should be visible"`);
        break;
      case 'assert_text':
        lines.push(`        assert ${JSON.stringify(step.assertExpected || '')} in ${locExpr}.inner_text()`);
        break;
      case 'assert_attribute':
        lines.push(`        assert ${locExpr}.get_attribute("${step.assertAttribute || 'value'}") == ${JSON.stringify(step.assertExpected || '')}`);
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
        lines.push(`        el = ${locExpr}`);
        lines.push(`        try:`);
        lines.push(`            val = el.input_value()`);
        lines.push(`        except Exception:`);
        lines.push(`            val = el.inner_text()`);
        lines.push(`        print(f"[EXTRACTED] ${label}: {val}")`);
        break;
      }
      case 'press_key':
        lines.push(`        ${locExpr}.press("${step.keyCombo || 'Enter'}")`);
        break;
      case 'scroll': {
        const coords = step.value ? step.value.split(',') : ['0', '500'];
        lines.push(`        page.evaluate("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
        break;
      }
      case 'upload_file':
        lines.push(`        ${locExpr}.set_input_files(${JSON.stringify(step.value || '/path/to/upload_file.ext')})`);
        break;
      case 'drag_drop':
        if (step.dragTarget && step.dragTarget.locators[0]) {
          const targetSelector = formatPlaywrightLocator(step.dragTarget.locators[0]);
          lines.push(`        ${locExpr}.drag_to(page.locator(${targetSelector}))`);
        } else {
          lines.push(`        ${locExpr}.click()`);
        }
        break;
      case 'switch_tab':
        lines.push(`        page = context.pages[-1]`);
        lines.push(`        page.bring_to_front()`);
        break;
      case 'close_tab':
        lines.push(`        page.close()`);
        lines.push(`        page = context.pages[0]`);
        lines.push(`        page.bring_to_front()`);
        break;
      case 'switch_iframe':
        lines.push(`        frame = page.frame_locator(${selector})`);
        break;
      case 'wait':
        lines.push(`        time.sleep(${step.waitDuration || 2})`);
        break;
      case 'navigate':
        lines.push(`        page.goto("${step.value || startUrl}")`);
        break;
      default:
        lines.push(`        ${base}.locator(${selector}).click()`);
    }
    lines.push('');
  }

  lines.push('        print("[SUCCESS] Playwright test passed successfully!")');
  lines.push('');
  lines.push('    finally:');
  lines.push('        browser.close()');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 2. PLAYWRIGHT ENTERPRISE SCRIPT (Tracing, failure screenshots, video, env)
// ---------------------------------------------------------------------------
export function generatePlaywrightEnterpriseScript(testCase: TestCaseModel): string {
  const timeoutMs = (testCase.settings?.timeout || 15) * 1000;
  const steps = testCase.steps || [];
  const startUrl = testCase.url || 'https://example.com';

  const sensitiveVars = new Map<string, string>();
  for (const step of steps) {
    if (step.isSensitive && step.variableName) {
      sensitiveVars.set(step.variableName, step.variableName);
    }
  }

  const lines: string[] = [];

  lines.push('"""');
  lines.push(`Enterprise Playwright Test: ${testCase.name || 'Automated Test'}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('"""');
  lines.push('');
  lines.push('import os');
  lines.push('import time');
  lines.push('from datetime import datetime');
  lines.push('from pathlib import Path');
  lines.push('from playwright.sync_api import sync_playwright, expect');
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
  lines.push('    is_headless = os.getenv("HEADLESS", "false").lower() == "true"');
  lines.push('    artifact_dir = Path("artifacts")');
  lines.push('    artifact_dir.mkdir(parents=True, exist_ok=True)');
  lines.push('');
  lines.push('    with sync_playwright() as p:');
  lines.push('        browser = p.chromium.launch(headless=is_headless, args=["--disable-blink-features=AutomationControlled"])');
  lines.push('        context = browser.new_context(');
  lines.push('            viewport={"width": 1920, "height": 1080},');
  lines.push('            record_video_dir=str(artifact_dir / "videos") if os.getenv("RECORD_VIDEO") == "true" else None');
  lines.push('        )');
  lines.push('        context.tracing.start(screenshots=True, snapshots=True, sources=True)');
  lines.push('        page = context.new_page()');
  lines.push(`        page.set_default_timeout(${timeoutMs})`);
  lines.push('');
  lines.push('        try:');
  lines.push(`            # Navigate to target page`);
  lines.push(`            page.goto("${startUrl}")`);
  lines.push('');

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const { selector } = getStepLocator(step);
    const base = step.iframePath ? `page.frame_locator("${step.iframePath}")` : 'page';
    const locExpr = buildPlaywrightLocatorExpr(base, step);
    lines.push(`            ${buildStepComment(step, i)}`);

    switch (step.action) {
      case 'click':
        lines.push(`            ${locExpr}.click()`);
        break;
      case 'type': {
        const valExpression = step.isSensitive && step.variableName ? step.variableName : JSON.stringify(step.value ?? '');
        lines.push(`            ${locExpr}.fill(${valExpression})`);
        break;
      }
      case 'clear':
        lines.push(`            ${locExpr}.clear()`);
        break;
      case 'checkbox':
        if (step.value === 'false') {
          lines.push(`            ${locExpr}.uncheck()`);
        } else {
          lines.push(`            ${locExpr}.check()`);
        }
        break;
      case 'radio':
        lines.push(`            ${locExpr}.check()`);
        break;
      case 'select':
        lines.push(`            ${locExpr}.select_option(label=${JSON.stringify(step.value ?? '')})`);
        break;
      case 'hover':
        lines.push(`            ${locExpr}.hover()`);
        break;
      case 'assert_visible':
        lines.push(`            expect(${locExpr}).to_be_visible()`);
        break;
      case 'assert_text':
        lines.push(`            expect(${locExpr}).to_contain_text(${JSON.stringify(step.assertExpected || '')})`);
        break;
      case 'assert_attribute':
        lines.push(`            expect(${locExpr}).to_have_attribute("${step.assertAttribute || 'value'}", ${JSON.stringify(step.assertExpected || '')})`);
        break;
      case 'print_value': {
        const label = (step.target.text || step.target.labelText || 'Value').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').trim();
        lines.push(`            el = ${locExpr}`);
        lines.push(`            try:`);
        lines.push(`                val = el.input_value()`);
        lines.push(`            except Exception:`);
        lines.push(`                val = el.inner_text()`);
        lines.push(`            print(f"[EXTRACTED] ${label}: {val}")`);
        break;
      }
      case 'press_key':
        lines.push(`            ${locExpr}.press("${step.keyCombo || 'Enter'}")`);
        break;
      case 'scroll': {
        const coords = step.value ? step.value.split(',') : ['0', '500'];
        lines.push(`            page.evaluate("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
        break;
      }
      case 'upload_file':
        lines.push(`            ${locExpr}.set_input_files(${JSON.stringify(step.value || '/path/to/upload_file.ext')})`);
        break;
      case 'drag_drop':
        if (step.dragTarget && step.dragTarget.locators[0]) {
          const targetSelector = formatPlaywrightLocator(step.dragTarget.locators[0]);
          lines.push(`            ${locExpr}.drag_to(page.locator(${targetSelector}))`);
        } else {
          lines.push(`            ${locExpr}.click()`);
        }
        break;
      case 'switch_tab':
        lines.push(`            page = context.pages[-1]`);
        lines.push(`            page.bring_to_front()`);
        break;
      case 'close_tab':
        lines.push(`            page.close()`);
        lines.push(`            page = context.pages[0]`);
        lines.push(`            page.bring_to_front()`);
        break;
      case 'switch_iframe':
        lines.push(`            frame = page.frame_locator(${selector})`);
        break;
      case 'wait':
        lines.push(`            time.sleep(${step.waitDuration || 2})`);
        break;
      case 'navigate':
        lines.push(`            page.goto("${step.value || startUrl}")`);
        break;
      default:
        lines.push(`            ${base}.locator(${selector}).click()`);
    }
    lines.push('');
  }

  lines.push('            context.tracing.stop(path=str(artifact_dir / "trace.zip"))');
  lines.push('            elapsed = time.perf_counter() - start_time');
  lines.push('            print(f"[PERF] Test completed successfully in {elapsed:.2f}s")');
  lines.push('');
  lines.push('        except Exception as e:');
  lines.push('            ts = datetime.now().strftime("%Y%m%d_%H%M%S")');
  lines.push('            failure_screenshot = artifact_dir / f"failure_{ts}.png"');
  lines.push('            failure_trace = artifact_dir / f"failure_trace_{ts}.zip"');
  lines.push('            page.screenshot(path=str(failure_screenshot), full_page=True)');
  lines.push('            context.tracing.stop(path=str(failure_trace))');
  lines.push('            print(f"[ERROR] Playwright execution failed: {e}")');
  lines.push('            print(f"[DEBUG] Failure screenshot captured: {failure_screenshot}")');
  lines.push('            print(f"[DEBUG] Tracing snapshot saved: {failure_trace}")');
  lines.push('            raise');
  lines.push('');
  lines.push('        finally:');
  lines.push('            browser.close()');
  lines.push('');
  lines.push('if __name__ == "__main__":');
  lines.push('    run_test()');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 3. PLAYWRIGHT PYTEST SCRIPT (Native fixtures, expect() assertions)
// ---------------------------------------------------------------------------
export function generatePlaywrightPytestScript(testCase: TestCaseModel): string {
  const steps = testCase.steps || [];
  const startUrl = testCase.url || 'https://example.com';
  const functionName = (testCase.name || 'test_automated_flow')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+/, '');

  const validFuncName = functionName.startsWith('test_') ? functionName : `test_${functionName}`;

  const lines: string[] = [];

  lines.push('"""');
  lines.push(`Pytest Playwright Suite: ${testCase.name || 'Automated Test'}`);
  lines.push('Run with: pytest -v --headed');
  lines.push('"""');
  lines.push('import pytest');
  lines.push('import time');
  lines.push('from playwright.sync_api import Page, expect');
  lines.push('');
  lines.push(`def ${validFuncName}(page: Page) -> None:`);
  lines.push(`    # Step 0: Navigate to target URL`);
  lines.push(`    page.goto("${startUrl}")`);
  lines.push('');

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const { selector } = getStepLocator(step);
    const base = step.iframePath ? `page.frame_locator("${step.iframePath}")` : 'page';
    const locExpr = buildPlaywrightLocatorExpr(base, step);
    lines.push(`    ${buildStepComment(step, i)}`);

    switch (step.action) {
      case 'click':
        lines.push(`    ${locExpr}.click()`);
        break;
      case 'type':
        lines.push(`    ${locExpr}.fill(${JSON.stringify(step.value ?? '')})`);
        break;
      case 'clear':
        lines.push(`    ${locExpr}.clear()`);
        break;
      case 'checkbox':
        if (step.value === 'false') {
          lines.push(`    ${locExpr}.uncheck()`);
        } else {
          lines.push(`    ${locExpr}.check()`);
        }
        break;
      case 'radio':
        lines.push(`    ${locExpr}.check()`);
        break;
      case 'select':
        lines.push(`    ${locExpr}.select_option(label=${JSON.stringify(step.value ?? '')})`);
        break;
      case 'hover':
        lines.push(`    ${locExpr}.hover()`);
        break;
      case 'assert_visible':
        lines.push(`    expect(${locExpr}).to_be_visible()`);
        break;
      case 'assert_text':
        lines.push(`    expect(${locExpr}).to_contain_text(${JSON.stringify(step.assertExpected || '')})`);
        break;
      case 'assert_attribute':
        lines.push(`    expect(${locExpr}).to_have_attribute("${step.assertAttribute || 'value'}", ${JSON.stringify(step.assertExpected || '')})`);
        break;
      case 'print_value': {
        const label = (step.target.text || step.target.labelText || 'Value').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').trim();
        lines.push(`    el = ${locExpr}`);
        lines.push(`    try:`);
        lines.push(`        val = el.input_value()`);
        lines.push(`    except Exception:`);
        lines.push(`        val = el.inner_text()`);
        lines.push(`    print(f"[EXTRACTED] ${label}: {val}")`);
        break;
      }
      case 'press_key':
        lines.push(`    ${locExpr}.press("${step.keyCombo || 'Enter'}")`);
        break;
      case 'scroll': {
        const coords = step.value ? step.value.split(',') : ['0', '500'];
        lines.push(`    page.evaluate("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
        break;
      }
      case 'upload_file':
        lines.push(`    ${locExpr}.set_input_files(${JSON.stringify(step.value || '/path/to/upload_file.ext')})`);
        break;
      case 'drag_drop':
        if (step.dragTarget && step.dragTarget.locators[0]) {
          const targetSelector = formatPlaywrightLocator(step.dragTarget.locators[0]);
          lines.push(`    ${locExpr}.drag_to(page.locator(${targetSelector}))`);
        } else {
          lines.push(`    ${locExpr}.click()`);
        }
        break;
      case 'switch_tab':
        lines.push(`    page = page.context.pages[-1]`);
        lines.push(`    page.bring_to_front()`);
        break;
      case 'close_tab':
        lines.push(`    page.close()`);
        lines.push(`    page = page.context.pages[0]`);
        lines.push(`    page.bring_to_front()`);
        break;
      case 'switch_iframe':
        lines.push(`    frame = page.frame_locator(${selector})`);
        break;
      case 'wait':
        lines.push(`    time.sleep(${step.waitDuration || 2})`);
        break;
      case 'navigate':
        lines.push(`    page.goto("${step.value || startUrl}")`);
        break;
      default:
        lines.push(`    ${locExpr}.click()`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 4. PLAYWRIGHT PAGE OBJECT MODEL (POM) GENERATOR
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

export function generatePlaywrightPomScript(testCase: TestCaseModel): string {
  const steps = testCase.steps || [];
  const startUrl = testCase.url || 'https://example.com';
  const className = toPascalCase(testCase.name || 'Automated Test');

  const lines: string[] = [];

  lines.push('"""');
  lines.push(`Playwright Page Object Model (POM): ${testCase.name || 'Automated Test'}`);
  lines.push('Generated by AutomateX Studio');
  lines.push('"""');
  lines.push('import os');
  lines.push('import time');
  lines.push('from playwright.sync_api import sync_playwright, Page, expect');
  lines.push('');
  lines.push(`class ${className}:`);
  lines.push(`    """Page Object encapsulating elements and actions for ${testCase.name || 'Application'}."""`);
  lines.push('');
  lines.push('    def __init__(self, page: Page):');
  lines.push('        self.page = page');
  lines.push('');

  lines.push(`    def open(self, url="${startUrl}"):`);
  lines.push('        """Navigate to target page."""');
  lines.push('        self.page.goto(url)');
  lines.push('        return self');
  lines.push('');

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const { selector } = getStepLocator(step);
    const suffix = sanitizeMethodSuffix(step);
    const methodName = `step_${i + 1}_${step.action}_${suffix}`;
    const semanticName = inferSemanticStepName(step);
    const base = step.iframeSelector || step.iframePath ? `self.page.frame_locator("${step.iframeSelector || step.iframePath}")` : 'self.page';

    switch (step.action) {
      case 'click':
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        ${base}.locator(${selector}).click()`);
        lines.push('        return self');
        break;

      case 'type':
        lines.push(`    def ${methodName}(self, value=${JSON.stringify(step.value ?? '')}):`);
        lines.push(`        ${base}.locator(${selector}).fill(value)`);
        lines.push('        return self');
        break;

      case 'clear':
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        ${base}.locator(${selector}).clear()`);
        lines.push('        return self');
        break;

      case 'checkbox':
        lines.push(`    def ${methodName}(self, checked=${step.value !== 'false'}):`);
        lines.push('        if checked:');
        lines.push(`            ${base}.locator(${selector}).check()`);
        lines.push('        else:');
        lines.push(`            ${base}.locator(${selector}).uncheck()`);
        lines.push('        return self');
        break;

      case 'radio':
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        ${base}.locator(${selector}).check()`);
        lines.push('        return self');
        break;

      case 'select':
        lines.push(`    def ${methodName}(self, value=${JSON.stringify(step.value ?? '')}):`);
        lines.push(`        ${base}.locator(${selector}).select_option(label=value)`);
        lines.push('        return self');
        break;

      case 'hover':
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        ${base}.locator(${selector}).hover()`);
        lines.push('        return self');
        break;

      case 'assert_visible':
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        expect(${base}.locator(${selector})).to_be_visible()`);
        lines.push('        return self');
        break;

      case 'assert_text':
        lines.push(`    def ${methodName}(self, expected=${JSON.stringify(step.assertExpected || '')}):`);
        lines.push(`        expect(${base}.locator(${selector})).to_contain_text(expected)`);
        lines.push('        return self');
        break;

      case 'assert_attribute':
        lines.push(`    def ${methodName}(self, attribute="${step.assertAttribute || 'value'}", expected=${JSON.stringify(step.assertExpected || '')}):`);
        lines.push(`        expect(${base}.locator(${selector})).to_have_attribute(attribute, expected)`);
        lines.push('        return self');
        break;

      case 'print_value':
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        el = ${base}.locator(${selector})`);
        lines.push('        try:');
        lines.push('            val = el.input_value()');
        lines.push('        except Exception:');
        lines.push('            val = el.inner_text()');
        lines.push('        return val');
        break;

      case 'press_key':
        lines.push(`    def ${methodName}(self, key="${step.keyCombo || 'Enter'}"):`);
        lines.push(`        ${base}.locator(${selector}).press(key)`);
        lines.push('        return self');
        break;

      case 'upload_file':
        lines.push(`    def ${methodName}(self, file_path=${JSON.stringify(step.value || '/path/to/upload_file.ext')}):`);
        lines.push(`        ${base}.locator(${selector}).set_input_files(file_path)`);
        lines.push('        return self');
        break;

      case 'drag_drop':
        lines.push(`    def ${methodName}(self):`);
        if (step.dragTarget && step.dragTarget.locators[0]) {
          const targetSelector = formatPlaywrightLocator(step.dragTarget.locators[0]);
          lines.push(`        ${base}.locator(${selector}).drag_to(self.page.locator(${targetSelector}))`);
        } else {
          lines.push(`        ${base}.locator(${selector}).click()`);
        }
        lines.push('        return self');
        break;

      case 'scroll': {
        const coords = step.value ? step.value.split(',') : ['0', '500'];
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        self.page.evaluate("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
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
        lines.push('        self.page.goto(url)');
        lines.push('        return self');
        break;

      case 'switch_tab':
        lines.push(`    def ${methodName}(self):`);
        lines.push('        self.page = self.page.context.pages[-1]');
        lines.push('        self.page.bring_to_front()');
        lines.push('        return self');
        break;

      case 'close_tab':
        lines.push(`    def ${methodName}(self):`);
        lines.push('        self.page.close()');
        lines.push('        self.page = self.page.context.pages[0]');
        lines.push('        self.page.bring_to_front()');
        lines.push('        return self');
        break;

      default:
        lines.push(`    def ${methodName}(self):`);
        lines.push(`        ${base}.locator(${selector}).click()`);
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
  lines.push('    with sync_playwright() as p:');
  lines.push('        browser = p.chromium.launch(headless=is_headless)');
  lines.push('        context = browser.new_context(viewport={"width": 1920, "height": 1080})');
  lines.push('        page = context.new_page()');
  lines.push('        try:');
  lines.push(`            app = ${className}(page)`);
  lines.push('            app.open()');
  lines.push('');

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const suffix = sanitizeMethodSuffix(step);
    const methodName = `step_${i + 1}_${step.action}_${suffix}`;

    if (step.action === 'type') {
      const val = JSON.stringify(step.value ?? '');
      lines.push(`            app.${methodName}(${val})`);
    } else if (step.action === 'select') {
      const val = JSON.stringify(step.value ?? '');
      lines.push(`            app.${methodName}(${val})`);
    } else if (step.action === 'assert_text') {
      const val = JSON.stringify(step.assertExpected || '');
      lines.push(`            app.${methodName}(${val})`);
    } else if (step.action === 'navigate') {
      const val = JSON.stringify(step.value || startUrl);
      lines.push(`            app.${methodName}(${val})`);
    } else {
      lines.push(`            app.${methodName}()`);
    }
  }

  lines.push('');
  lines.push('            print("[SUCCESS] Playwright POM test passed successfully!")');
  lines.push('        finally:');
  lines.push('            browser.close()');
  lines.push('');
  lines.push('if __name__ == "__main__":');
  lines.push('    run_test()');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Unified Playwright Dispatcher
// ---------------------------------------------------------------------------
export function generatePlaywrightScript(testCase: TestCaseModel): string {
  const style = testCase.settings?.codeStyle || 'simple';
  switch (style) {
    case 'simple':
      return generatePlaywrightSimpleScript(testCase);
    case 'pytest':
      return generatePlaywrightPytestScript(testCase);
    case 'pom':
      return generatePlaywrightPomScript(testCase);
    case 'enterprise':
    default:
      return generatePlaywrightEnterpriseScript(testCase);
  }
}
