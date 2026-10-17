import { TestCaseModel, TestStep, LocatorCandidate } from '../types/model';

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

function buildStepComment(step: TestStep, index: number): string {
  const componentInfo = step.target?.componentType ? ` in ${step.target.componentType.toUpperCase()}` : '';
  const labelInfo = step.target?.labelText ? ` "${step.target.labelText}"` : '';
  const textInfo = step.target?.text ? ` "${step.target.text}"` : '';
  const desc = labelInfo || textInfo || `<${step.target?.tagName || 'element'}>`;

  switch (step.action) {
    case 'switch_tab':
      return `# Step ${index + 1}: Switch to Tab index ${step.tabIndex ?? -1}${step.tabTitle ? ` (${step.tabTitle})` : ''}`;
    case 'navigate':
      return `# Step ${index + 1}: Navigate to ${step.value || 'target URL'}`;
    case 'wait':
      return `# Step ${index + 1}: Wait for ${step.waitDuration ?? 2} seconds`;
    case 'click':
      return `# Step ${index + 1}: Click${labelInfo || textInfo}${componentInfo}`;
    case 'type':
      return `# Step ${index + 1}: Type into${desc}${componentInfo}`;
    case 'select':
      return `# Step ${index + 1}: Select "${step.value}" from${desc}${componentInfo}`;
    case 'checkbox':
      return `# Step ${index + 1}: Toggle checkbox${desc}${componentInfo}`;
    case 'radio':
      return `# Step ${index + 1}: Select radio option${desc}${componentInfo}`;
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
  lines.push('');
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
    lines.push(`        ${buildStepComment(step, i)}`);

    switch (step.action) {
      case 'click':
        lines.push(`        page.locator(${selector}).click()`);
        break;
      case 'type': {
        const val = JSON.stringify(step.value ?? '');
        lines.push(`        page.locator(${selector}).fill(${val})`);
        break;
      }
      case 'clear':
        lines.push(`        page.locator(${selector}).clear()`);
        break;
      case 'checkbox':
        if (step.value === 'false') {
          lines.push(`        page.locator(${selector}).uncheck()`);
        } else {
          lines.push(`        page.locator(${selector}).check()`);
        }
        break;
      case 'radio':
        lines.push(`        page.locator(${selector}).check()`);
        break;
      case 'select':
        lines.push(`        page.locator(${selector}).select_option(label=${JSON.stringify(step.value ?? '')})`);
        break;
      case 'hover':
        lines.push(`        page.locator(${selector}).hover()`);
        break;
      case 'assert_visible':
        lines.push(`        assert page.locator(${selector}).is_visible(), "Element should be visible"`);
        break;
      case 'assert_text':
        lines.push(`        assert ${JSON.stringify(step.assertExpected || '')} in page.locator(${selector}).inner_text()`);
        break;
      case 'assert_attribute':
        lines.push(`        assert page.locator(${selector}).get_attribute("${step.assertAttribute || 'value'}") == ${JSON.stringify(step.assertExpected || '')}`);
        break;
      case 'print_value': {
        const label = (step.target.text || step.target.labelText || 'Value').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').trim();
        lines.push(`        el = page.locator(${selector})`);
        lines.push(`        try:`);
        lines.push(`            val = el.input_value()`);
        lines.push(`        except Exception:`);
        lines.push(`            val = el.inner_text()`);
        lines.push(`        print(f"[EXTRACTED] ${label}: {val}")`);
        break;
      }
      case 'press_key':
        lines.push(`        page.locator(${selector}).press("${step.keyCombo || 'Enter'}")`);
        break;
      case 'scroll': {
        const coords = step.value ? step.value.split(',') : ['0', '500'];
        lines.push(`        page.evaluate("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
        break;
      }
      case 'upload_file':
        lines.push(`        page.locator(${selector}).set_input_files(${JSON.stringify(step.value || '/path/to/upload_file.ext')})`);
        break;
      case 'drag_drop':
        if (step.dragTarget && step.dragTarget.locators[0]) {
          const targetSelector = formatPlaywrightLocator(step.dragTarget.locators[0]);
          lines.push(`        page.locator(${selector}).drag_to(page.locator(${targetSelector}))`);
        } else {
          lines.push(`        page.locator(${selector}).click()`);
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
        lines.push(`        page.locator(${selector}).click()`);
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
  lines.push('        browser = p.chromium.launch(headless=is_headless)');
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
    lines.push(`            ${buildStepComment(step, i)}`);

    switch (step.action) {
      case 'click':
        lines.push(`            page.locator(${selector}).click()`);
        break;
      case 'type': {
        const valExpression = step.isSensitive && step.variableName ? step.variableName : JSON.stringify(step.value ?? '');
        lines.push(`            page.locator(${selector}).fill(${valExpression})`);
        break;
      }
      case 'clear':
        lines.push(`            page.locator(${selector}).clear()`);
        break;
      case 'checkbox':
        if (step.value === 'false') {
          lines.push(`            page.locator(${selector}).uncheck()`);
        } else {
          lines.push(`            page.locator(${selector}).check()`);
        }
        break;
      case 'radio':
        lines.push(`            page.locator(${selector}).check()`);
        break;
      case 'select':
        lines.push(`            page.locator(${selector}).select_option(label=${JSON.stringify(step.value ?? '')})`);
        break;
      case 'hover':
        lines.push(`            page.locator(${selector}).hover()`);
        break;
      case 'assert_visible':
        lines.push(`            expect(page.locator(${selector})).to_be_visible()`);
        break;
      case 'assert_text':
        lines.push(`            expect(page.locator(${selector})).to_contain_text(${JSON.stringify(step.assertExpected || '')})`);
        break;
      case 'assert_attribute':
        lines.push(`            expect(page.locator(${selector})).to_have_attribute("${step.assertAttribute || 'value'}", ${JSON.stringify(step.assertExpected || '')})`);
        break;
      case 'print_value': {
        const label = (step.target.text || step.target.labelText || 'Value').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').trim();
        lines.push(`            el = page.locator(${selector})`);
        lines.push(`            try:`);
        lines.push(`                val = el.input_value()`);
        lines.push(`            except Exception:`);
        lines.push(`                val = el.inner_text()`);
        lines.push(`            print(f"[EXTRACTED] ${label}: {val}")`);
        break;
      }
      case 'press_key':
        lines.push(`            page.locator(${selector}).press("${step.keyCombo || 'Enter'}")`);
        break;
      case 'scroll': {
        const coords = step.value ? step.value.split(',') : ['0', '500'];
        lines.push(`            page.evaluate("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
        break;
      }
      case 'upload_file':
        lines.push(`            page.locator(${selector}).set_input_files(${JSON.stringify(step.value || '/path/to/upload_file.ext')})`);
        break;
      case 'drag_drop':
        if (step.dragTarget && step.dragTarget.locators[0]) {
          const targetSelector = formatPlaywrightLocator(step.dragTarget.locators[0]);
          lines.push(`            page.locator(${selector}).drag_to(page.locator(${targetSelector}))`);
        } else {
          lines.push(`            page.locator(${selector}).click()`);
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
        lines.push(`            page.locator(${selector}).click()`);
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
    lines.push(`    ${buildStepComment(step, i)}`);

    switch (step.action) {
      case 'click':
        lines.push(`    page.locator(${selector}).click()`);
        break;
      case 'type':
        lines.push(`    page.locator(${selector}).fill(${JSON.stringify(step.value ?? '')})`);
        break;
      case 'clear':
        lines.push(`    page.locator(${selector}).clear()`);
        break;
      case 'checkbox':
        if (step.value === 'false') {
          lines.push(`    page.locator(${selector}).uncheck()`);
        } else {
          lines.push(`    page.locator(${selector}).check()`);
        }
        break;
      case 'radio':
        lines.push(`    page.locator(${selector}).check()`);
        break;
      case 'select':
        lines.push(`    page.locator(${selector}).select_option(label=${JSON.stringify(step.value ?? '')})`);
        break;
      case 'hover':
        lines.push(`    page.locator(${selector}).hover()`);
        break;
      case 'assert_visible':
        lines.push(`    expect(page.locator(${selector})).to_be_visible()`);
        break;
      case 'assert_text':
        lines.push(`    expect(page.locator(${selector})).to_contain_text(${JSON.stringify(step.assertExpected || '')})`);
        break;
      case 'assert_attribute':
        lines.push(`    expect(page.locator(${selector})).to_have_attribute("${step.assertAttribute || 'value'}", ${JSON.stringify(step.assertExpected || '')})`);
        break;
      case 'print_value': {
        const label = (step.target.text || step.target.labelText || 'Value').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').trim();
        lines.push(`    el = page.locator(${selector})`);
        lines.push(`    try:`);
        lines.push(`        val = el.input_value()`);
        lines.push(`    except Exception:`);
        lines.push(`        val = el.inner_text()`);
        lines.push(`    print(f"[EXTRACTED] ${label}: {val}")`);
        break;
      }
      case 'press_key':
        lines.push(`    page.locator(${selector}).press("${step.keyCombo || 'Enter'}")`);
        break;
      case 'scroll': {
        const coords = step.value ? step.value.split(',') : ['0', '500'];
        lines.push(`    page.evaluate("window.scrollBy(${coords[0] || '0'}, ${coords[1] || '500'})")`);
        break;
      }
      case 'upload_file':
        lines.push(`    page.locator(${selector}).set_input_files(${JSON.stringify(step.value || '/path/to/upload_file.ext')})`);
        break;
      case 'drag_drop':
        if (step.dragTarget && step.dragTarget.locators[0]) {
          const targetSelector = formatPlaywrightLocator(step.dragTarget.locators[0]);
          lines.push(`    page.locator(${selector}).drag_to(page.locator(${targetSelector}))`);
        } else {
          lines.push(`    page.locator(${selector}).click()`);
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
        lines.push(`    page.locator(${selector}).click()`);
    }
    lines.push('');
  }

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
    case 'enterprise':
    default:
      return generatePlaywrightEnterpriseScript(testCase);
  }
}
