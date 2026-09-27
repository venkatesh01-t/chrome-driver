import { describe, it, expect, beforeEach } from 'vitest';
import { generateLocators, isDynamicId } from '../src/content/locator-engine';
import { validateLocator } from '../src/content/locator-validator';

describe('Smart Locator Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects dynamic IDs correctly', () => {
    expect(isDynamicId('input-948271')).toBe(true);
    expect(isDynamicId('ember182')).toBe(true);
    expect(isDynamicId('btn-a9f8b7c6')).toBe(true);
    expect(isDynamicId('react-19a8f-28')).toBe(true);

    expect(isDynamicId('username')).toBe(false);
    expect(isDynamicId('login-btn')).toBe(false);
    expect(isDynamicId('password_field')).toBe(false);
  });

  it('generates high-confidence ID locator for stable unique ID', () => {
    document.body.innerHTML = `
      <form>
        <input id="username" name="user" type="text" />
      </form>
    `;
    const input = document.getElementById('username') as HTMLInputElement;
    const candidates = generateLocators(input, document);

    expect(candidates.length).toBeGreaterThan(0);
    const topCandidate = candidates[0];
    expect(topCandidate.strategy).toBe('id');
    expect(topCandidate.value).toBe('username');
    expect(topCandidate.isUnique).toBe(true);
    expect(topCandidate.matchCount).toBe(1);
    expect(topCandidate.score).toBe(100);
  });

  it('demotes dynamic ID and prioritizes stable attribute like name or data-testid', () => {
    document.body.innerHTML = `
      <input id="input-928374" name="email_address" data-testid="user-email" />
    `;
    const input = document.getElementById('input-928374') as HTMLInputElement;
    const candidates = generateLocators(input, document);

    const testIdCandidate = candidates.find(c => c.strategy === 'data-testid');
    const idCandidate = candidates.find(c => c.strategy === 'id');

    expect(testIdCandidate).toBeDefined();
    expect(testIdCandidate?.value).toBe('user-email');
    expect(testIdCandidate?.isUnique).toBe(true);

    expect(idCandidate).toBeDefined();
    expect(idCandidate?.warning).toBe('dynamic_id');
    expect(idCandidate?.score).toBeLessThan(testIdCandidate!.score);

    // The top candidate should NOT be the dynamic ID
    expect(candidates[0].strategy).not.toBe('id');
  });

  it('generates semantic relative XPath for buttons with text', () => {
    document.body.innerHTML = `
      <div class="actions">
        <button type="submit">Log In</button>
      </div>
    `;
    const button = document.querySelector('button') as HTMLButtonElement;
    const candidates = generateLocators(button, document);

    const xpathCandidate = candidates.find(c => c.strategy === 'xpath');
    expect(xpathCandidate).toBeDefined();
    expect(xpathCandidate?.value).toContain("normalize-space()='Log In'");
    expect(xpathCandidate?.isUnique).toBe(true);
  });

  it('validates uniqueness accurately when multiple elements match', () => {
    document.body.innerHTML = `
      <button class="action-btn">First</button>
      <button class="action-btn">Second</button>
      <button class="action-btn">Third</button>
    `;
    const buttons = document.querySelectorAll('button');
    const firstButton = buttons[0];

    const result = validateLocator({
      strategy: 'css',
      value: '.action-btn',
      isUnique: false,
      matchCount: 0,
      score: 50
    }, document);

    expect(result.isUnique).toBe(false);
    expect(result.matchCount).toBe(3);
    expect(result.warning).toBe('multiple_matches');

    const candidates = generateLocators(firstButton, document);
    // Should have a unique locator generated via text or index
    const uniqueCandidate = candidates.find(c => c.isUnique);
    expect(uniqueCandidate).toBeDefined();
  });
});
