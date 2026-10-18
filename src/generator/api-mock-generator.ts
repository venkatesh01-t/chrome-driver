import { RecordedNetworkCall } from '../types/network';

/**
 * Filter out static assets (images, fonts, stylesheets) and keep only relevant API calls (JSON, XML, Fetch, XHR)
 */
export function filterApiNetworkCalls(calls: RecordedNetworkCall[]): RecordedNetworkCall[] {
  return calls.filter((c) => {
    const url = c.url.toLowerCase();
    if (url.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js)$/)) {
      return false;
    }
    const ct = (c.responseHeaders?.['content-type'] || '').toLowerCase();
    return ct.includes('json') || ct.includes('xml') || url.includes('/api/') || c.method !== 'GET';
  });
}

/**
 * Generates Playwright page.route() mock definitions
 */
export function generatePlaywrightRouteMocks(calls: RecordedNetworkCall[]): string {
  const filtered = filterApiNetworkCalls(calls);
  if (filtered.length === 0) return '';

  const lines: string[] = [];
  lines.push('    // --- Network API Mocking Fixtures (Auto-Generated) ---');

  filtered.forEach((call, i) => {
    try {
      const urlObj = new URL(call.url);
      const pathname = urlObj.pathname;
      const globPattern = `**${pathname}*`;
      const bodyStr = call.responseBody ? JSON.stringify(call.responseBody) : '"{}"';

      lines.push(`    // Mock #${i + 1}: ${call.method} ${pathname} (${call.status})`);
      lines.push(`    await page.route('${globPattern}', async (route) => {`);
      lines.push(`      if (route.request().method() === '${call.method}') {`);
      lines.push(`        await route.fulfill({`);
      lines.push(`          status: ${call.status},`);
      lines.push(`          contentType: 'application/json',`);
      lines.push(`          body: JSON.stringify(${bodyStr}),`);
      lines.push(`        });`);
      lines.push(`      } else {`);
      lines.push(`        await route.continue();`);
      lines.push(`      }`);
      lines.push(`    });`);
      lines.push('');
    } catch {
      // Ignore malformed URLs
    }
  });

  return lines.join('\n');
}

/**
 * Generates Python `responses` mock decorators and assertions
 */
export function generatePythonResponsesMocks(calls: RecordedNetworkCall[]): string {
  const filtered = filterApiNetworkCalls(calls);
  if (filtered.length === 0) return '';

  const lines: string[] = [];
  lines.push('    # --- Python Responses Mock Fixtures ---');

  filtered.forEach((call, i) => {
    const jsonStr = call.responseBody ? JSON.stringify(call.responseBody) : '{}';
    lines.push(`    # Mock #${i + 1}: ${call.method} ${call.url}`);
    lines.push(`    responses.add(`);
    lines.push(`        responses.${call.method},`);
    lines.push(`        "${call.url}",`);
    lines.push(`        json=${jsonStr},`);
    lines.push(`        status=${call.status}`);
    lines.push(`    )`);
  });

  return lines.join('\n');
}

/**
 * Generates a standalone REST API Integration Test file from recorded network traffic
 */
export function generateApiIntegrationSuite(calls: RecordedNetworkCall[], suiteName = 'API Regression Suite'): string {
  const filtered = filterApiNetworkCalls(calls);
  const lines: string[] = [];

  lines.push(`"""`);
  lines.push(`Standalone API Integration Tests: ${suiteName}`);
  lines.push(`Auto-generated from recorded live HTTP traffic`);
  lines.push(`"""`);
  lines.push(`import requests`);
  lines.push(`import pytest`);
  lines.push(``);
  lines.push(`class Test${suiteName.replace(/[^a-zA-Z0-9]/g, '')}:`);

  if (filtered.length === 0) {
    lines.push(`    def test_placeholder(self):`);
    lines.push(`        assert True`);
    return lines.join('\n');
  }

  filtered.forEach((call, i) => {
    const fnName = `test_endpoint_${i + 1}_${call.method.toLowerCase()}`;
    lines.push(`    def ${fnName}(self):`);
    lines.push(`        url = "${call.url}"`);

    if (call.requestBody && call.method !== 'GET') {
      lines.push(`        payload = ${JSON.stringify(call.requestBody)}`);
      lines.push(`        response = requests.${call.method.toLowerCase()}(url, json=payload, timeout=10)`);
    } else {
      lines.push(`        response = requests.${call.method.toLowerCase()}(url, timeout=10)`);
    }

    lines.push(`        assert response.status_code == ${call.status}, f"Expected status ${call.status} but got {response.status_code}"`);
    if (call.responseBody && typeof call.responseBody === 'object') {
      const firstKey = Object.keys(call.responseBody)[0];
      if (firstKey) {
        lines.push(`        data = response.json()`);
        lines.push(`        assert "${firstKey}" in data`);
      }
    }
    lines.push(``);
  });

  return lines.join('\n');
}
