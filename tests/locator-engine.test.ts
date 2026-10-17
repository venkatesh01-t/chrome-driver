import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateLocators,
  isDynamicId,
  isDynamicAttribute,
  detectFieldSemantics,
  calculateShannonEntropy,
  extractElementFingerprint,
} from '../src/content/locator-engine';
import { validateLocator, scoreElementSimilarity } from '../src/content/locator-validator';

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

  it('detects and rejects unstable auto-generated dynamic attributes (Entropy & Noise Filter)', () => {
    // React 18 useId format
    expect(isDynamicAttribute(':r0:')).toBe(true);
    expect(isDynamicAttribute(':r1:')).toBe(true);
    expect(isDynamicAttribute(':ra:')).toBe(true);

    // Framework dynamic tokens
    expect(isDynamicAttribute('react-select-4-input')).toBe(true);
    expect(isDynamicAttribute('css-19bb58m')).toBe(true);
    expect(isDynamicAttribute('ng-tns-c123-4')).toBe(true);
    expect(isDynamicAttribute('sc-bdVaJa')).toBe(true);

    // UUIDs and long hex hashes
    expect(isDynamicAttribute('c0a80101-0000-0000-0000-000000000000')).toBe(true);
    expect(isDynamicAttribute('1a2b3c4d5e')).toBe(true);

    // 3+ consecutive digits
    expect(isDynamicAttribute('field_12345')).toBe(true);
    expect(isDynamicAttribute('btn-9876')).toBe(true);

    // Stable attributes should be accepted
    expect(isDynamicAttribute('email')).toBe(false);
    expect(isDynamicAttribute('user_login')).toBe(false);
    expect(isDynamicAttribute('submit-button')).toBe(false);
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

  it('generates anchor-relative contextual XPath for inputs anchored to preceding label', () => {
    document.body.innerHTML = `
      <form>
        <div class="form-group">
          <label>Email Address</label>
          <input type="text" class="form-control" />
        </div>
      </form>
    `;
    const input = document.querySelector('input') as HTMLInputElement;
    const candidates = generateLocators(input, document);

    const labelCandidate = candidates.find(
      (c) => c.strategy === 'xpath' && c.value.includes('normalize-space()=\'Email Address\'')
    );
    expect(labelCandidate).toBeDefined();
    expect(labelCandidate?.value).toContain('/following::input[1]');
    expect(labelCandidate?.isUnique).toBe(true);
    expect(labelCandidate?.matchCount).toBe(1);
    expect(labelCandidate?.score).toBeGreaterThanOrEqual(90);
  });

  it('generates table/row-anchored contextual XPath with semantic action button', () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>User 1</td>
            <td><button>Edit</button></td>
          </tr>
          <tr>
            <td>Admin User</td>
            <td><button>Delete</button></td>
          </tr>
        </tbody>
      </table>
    `;
    const deleteBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    ) as HTMLButtonElement;

    const candidates = generateLocators(deleteBtn, document);
    const rowCandidate = candidates.find(
      (c) => c.strategy === 'xpath' && c.value.includes('contains(normalize-space(), \'Admin User\')')
    );

    expect(rowCandidate).toBeDefined();
    expect(rowCandidate?.value).toContain('button[normalize-space()=\'Delete\']');
    expect(rowCandidate?.isUnique).toBe(true);
    expect(rowCandidate?.matchCount).toBe(1);
    expect(rowCandidate?.score).toBeGreaterThanOrEqual(88);
  });

  it('penalizes positional indices unless anchored to unique text', () => {
    document.body.innerHTML = `
      <div>
        <label>Name</label>
        <input type="text" />
        <input type="text" />
      </div>
    `;
    // Raw positional XPath without text anchor
    const unanchoredResult = validateLocator(
      { strategy: 'xpath', value: '(//input)[1]', isUnique: false, matchCount: 0, score: 75 },
      document
    );
    expect(unanchoredResult.score).toBeLessThanOrEqual(40);
    expect(unanchoredResult.warning).toBe('dom_dependent');

    // Contextual text-anchored XPath retains high confidence
    const anchoredResult = validateLocator(
      {
        strategy: 'xpath',
        value: '//label[normalize-space()="Name"]/following::input[1]',
        isUnique: false,
        matchCount: 0,
        score: 92,
      },
      document
    );
    // Should NOT be penalized down to 40 because it is text-anchored
    expect(anchoredResult.score).toBeGreaterThan(80);
  });

  it('calculates Shannon entropy correctly for deterministic filtering', () => {
    // English words have lower entropy
    const lowEntropy = calculateShannonEntropy('button');
    expect(lowEntropy).toBeLessThan(3.0);

    // Highly randomized tokens have higher entropy
    const highEntropy = calculateShannonEntropy('x8f9q2m1k4p7z3');
    expect(highEntropy).toBeGreaterThan(3.2);

    // Dynamic attribute check rejects high entropy / randomized framework tokens
    expect(isDynamicAttribute(':r4f:-input-894723')).toBe(true);
    expect(isDynamicAttribute('cost-center-code')).toBe(false);
    expect(isDynamicAttribute('notifications-btn')).toBe(false);
  });

  it('extracts multi-attribute element fingerprints and computes similarity scores accurately', () => {
    document.body.innerHTML = `
      <table>
        <tr>
          <td>Alice Johnson</td>
          <td><button class="btn approve-btn" aria-label="Approve Alice">Approve</button></td>
        </tr>
      </table>
    `;
    const btn = document.querySelector('button') as HTMLButtonElement;
    const fingerprint = extractElementFingerprint(btn);

    expect(fingerprint.tagName).toBe('button');
    expect(fingerprint.text).toBe('Approve');
    expect(fingerprint.ariaLabel).toBe('Approve Alice');
    expect(fingerprint.rowContext).toContain('Alice Johnson');

    // Perfect similarity against itself
    const exactScore = scoreElementSimilarity(fingerprint, btn);
    expect(exactScore).toBe(1.0);

    // Slightly modified element (e.g. class changed, aria-label missing) still gets high similarity
    const modifiedBtn = document.createElement('button');
    modifiedBtn.textContent = 'Approve';
    const similarScore = scoreElementSimilarity(fingerprint, modifiedBtn);
    expect(similarScore).toBeGreaterThan(0.5);

    // Completely different element gets low similarity
    const unrelatedDiv = document.createElement('div');
    unrelatedDiv.textContent = 'Cancel';
    const unrelatedScore = scoreElementSimilarity(fingerprint, unrelatedDiv);
    expect(unrelatedScore).toBeLessThan(0.3);
  });
});




