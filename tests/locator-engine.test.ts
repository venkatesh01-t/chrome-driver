import { describe, it, expect, beforeEach } from 'vitest';
import { generateLocators, isDynamicId, detectFieldSemantics } from '../src/content/locator-engine';
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

  it('detects input semantics and default realistic sample data', () => {
    document.body.innerHTML = `
      <form>
        <label for="user-email">Work Email</label>
        <input id="user-email" type="email" placeholder="name@company.com" />

        <label for="contact-phone">Phone Number</label>
        <input id="contact-phone" type="tel" name="phone_number" />

        <label for="site-search">Search query</label>
        <input id="site-search" type="search" />
      </form>
    `;

    const emailInput = document.getElementById('user-email') as HTMLInputElement;
    const phoneInput = document.getElementById('contact-phone') as HTMLInputElement;
    const searchInput = document.getElementById('site-search') as HTMLInputElement;

    const emailSemantics = detectFieldSemantics(emailInput, document);
    expect(emailSemantics.semanticType).toBe('email');
    expect(emailSemantics.defaultValue).toBe('user@example.com');
    expect(emailSemantics.labelText).toBe('Work Email');

    const phoneSemantics = detectFieldSemantics(phoneInput, document);
    expect(phoneSemantics.semanticType).toBe('phone');
    expect(phoneSemantics.defaultValue).toBe('+1234567890');
    expect(phoneSemantics.labelText).toBe('Phone Number');

    const searchSemantics = detectFieldSemantics(searchInput, document);
    expect(searchSemantics.semanticType).toBe('search');
    expect(searchSemantics.defaultValue).toBe('Test query');
  });

  it('filters out unstable framework classes (Angular/Stencil) and prevents fragile selectors', () => {
    document.body.innerHTML = `
      <gt-ess-menu class="ng-star-inserted hydrated">
        <span>Attendance</span>
      </gt-ess-menu>
    `;
    const menu = document.querySelector('gt-ess-menu') as HTMLElement;
    const candidates = generateLocators(menu, document);

    // Should NOT have a css candidate with ng-star-inserted or hydrated
    const fragileCss = candidates.find(
      (c) => c.strategy === 'css' && (c.value.includes('ng-star-inserted') || c.value.includes('hydrated'))
    );
    expect(fragileCss).toBeUndefined();

    // Should generate a semantic XPath using the custom element text or inner text
    const textXpath = candidates.find((c) => c.strategy === 'xpath');
    expect(textXpath).toBeDefined();
    expect(textXpath?.value).toContain('Attendance');
    expect(textXpath?.isUnique).toBe(true);
  });

  it('generates accurate text-based locators for custom calendar cells', () => {
    document.body.innerHTML = `
      <div class="calendar-grid">
        <gt-attendance-calendar-cell class="ng-star-inserted">21P1300</gt-attendance-calendar-cell>
        <gt-attendance-calendar-cell class="ng-star-inserted">22P1322</gt-attendance-calendar-cell>
        <gt-attendance-calendar-cell class="ng-star-inserted">23P1310</gt-attendance-calendar-cell>
      </div>
    `;
    const targetCell = document.querySelectorAll('gt-attendance-calendar-cell')[1] as HTMLElement;
    const candidates = generateLocators(targetCell, document);

    const xpathCandidate = candidates.find(
      (c) => c.strategy === 'xpath' && c.value.includes('22P1322')
    );
    expect(xpathCandidate).toBeDefined();
    expect(xpathCandidate?.isUnique).toBe(true);
  });

  it('generates accurate locator for link containing nested icon element', () => {
    document.body.innerHTML = `
      <nav class="sidebar">
        <a href="/v3/portal/ess/attendance" class="menu-item">
          <gt-icon class="icon">event</gt-icon>
          <span class="title">Attendance</span>
        </a>
        <a href="/v3/portal/ess/leaves" class="menu-item">
          <gt-icon class="icon">flight</gt-icon>
          <span class="title">Leave</span>
        </a>
      </nav>
    `;
    const attendanceLink = document.querySelector('a[href*="attendance"]') as HTMLElement;
    const candidates = generateLocators(attendanceLink, document);

    // Candidates with matchCount > 0 must be ranked before any 0-match candidates
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].matchCount).toBeGreaterThan(0);
    expect(candidates[0].isUnique).toBe(true);

    const matchCandidate = candidates.find(c => c.value.includes('Attendance') && c.isUnique);
    expect(matchCandidate).toBeDefined();
    expect(matchCandidate?.matchCount).toBe(1);
  });
});



