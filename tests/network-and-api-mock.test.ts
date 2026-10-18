import { describe, it, expect } from 'vitest';
import { filterApiNetworkCalls, generatePlaywrightRouteMocks, generatePythonResponsesMocks, generateApiIntegrationSuite } from '../src/generator/api-mock-generator';
import { RecordedNetworkCall } from '../src/types/network';

describe('Pillar 4: Network, API Capture & Mocking Suite', () => {
  const mockCalls: RecordedNetworkCall[] = [
    {
      id: 'net_1',
      url: 'https://cdn.example.com/assets/logo.png',
      method: 'GET',
      status: 200,
      responseHeaders: { 'content-type': 'image/png' },
      durationMs: 40,
      timestamp: Date.now(),
    },
    {
      id: 'net_2',
      url: 'https://api.example.com/v1/auth/login',
      method: 'POST',
      status: 200,
      requestBody: { username: 'demo', password: 'password123' },
      responseBody: { token: 'jwt_abc123', userId: 'usr_99' },
      responseHeaders: { 'content-type': 'application/json' },
      durationMs: 120,
      timestamp: Date.now(),
    },
    {
      id: 'net_3',
      url: 'https://api.example.com/v1/cart/items',
      method: 'GET',
      status: 200,
      responseBody: { items: [{ id: 1, name: 'Pro Keyboard' }] },
      responseHeaders: { 'content-type': 'application/json' },
      durationMs: 65,
      timestamp: Date.now(),
    },
  ];

  it('filters out binary and static assets, preserving API endpoints', () => {
    const apiCalls = filterApiNetworkCalls(mockCalls);
    expect(apiCalls.length).toBe(2);
    expect(apiCalls.some((c) => c.url.includes('logo.png'))).toBe(false);
    expect(apiCalls.some((c) => c.url.includes('/auth/login'))).toBe(true);
  });

  it('generates Playwright page.route() mock fulfillment fixtures', () => {
    const mocks = generatePlaywrightRouteMocks(mockCalls);
    expect(mocks).toContain('page.route');
    expect(mocks).toContain('**/v1/auth/login*');
    expect(mocks).toContain('status: 200');
    expect(mocks).toContain('contentType: \'application/json\'');
    expect(mocks).toContain('jwt_abc123');
  });

  it('generates Python responses mocking blocks', () => {
    const pyMocks = generatePythonResponsesMocks(mockCalls);
    expect(pyMocks).toContain('responses.add(');
    expect(pyMocks).toContain('responses.POST');
    expect(pyMocks).toContain('https://api.example.com/v1/auth/login');
    expect(pyMocks).toContain('status=200');
  });

  it('generates a standalone Python requests API Integration test suite', () => {
    const suite = generateApiIntegrationSuite(mockCalls, 'CheckoutAPI');
    expect(suite).toContain('class TestCheckoutAPI:');
    expect(suite).toContain('requests.post');
    expect(suite).toContain('payload = {"username":"demo","password":"password123"}');
    expect(suite).toContain('assert response.status_code == 200');
    expect(suite).toContain('assert "token" in data');
  });
});
