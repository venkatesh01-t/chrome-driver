import { describe, it, expect, beforeEach } from 'vitest';
import { auditAccessibility, generateA11yAssertionCode } from '../src/content/a11y-auditor';

describe('Pillar 5: Enterprise A11y (WCAG 2.2) & Visual Regression', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects missing alt attributes on images and calculates violation severity', () => {
    document.body.innerHTML = `
      <div>
        <img id="valid-logo" src="logo.png" alt="Company Logo" />
        <img id="broken-banner" src="banner.jpg" />
      </div>
    `;

    const audit = auditAccessibility();
    expect(audit.totalViolations).toBeGreaterThanOrEqual(1);
    const imgViolation = audit.violations.find((v) => v.id === 'image-alt');
    expect(imgViolation).toBeDefined();
    expect(imgViolation?.impact).toBe('critical');
    expect(imgViolation?.targetElement).toBe('#broken-banner');
  });

  it('detects unlabelled buttons and missing form input labels', () => {
    document.body.innerHTML = `
      <form>
        <button id="bad-btn"></button>
        <button id="good-btn">Save Changes</button>
        <input type="text" id="unlabelled-email" />
        <label for="labelled-name">Full Name</label>
        <input type="text" id="labelled-name" />
      </form>
    `;

    const audit = auditAccessibility();
    const btnViolation = audit.violations.find((v) => v.id === 'button-name');
    const inputViolation = audit.violations.find((v) => v.id === 'label-missing');

    expect(btnViolation).toBeDefined();
    expect(btnViolation?.targetElement).toBe('#bad-btn');
    expect(inputViolation).toBeDefined();
    expect(inputViolation?.targetElement).toBe('#unlabelled-email');
  });

  it('returns perfect 100 score for a fully accessible DOM structure', () => {
    document.body.innerHTML = `
      <main>
        <img src="avatar.png" alt="User Avatar" />
        <button aria-label="Close modal">X</button>
        <label for="search-box">Search Catalog</label>
        <input type="search" id="search-box" />
        <a href="/pricing">View Pricing Plans</a>
      </main>
    `;

    const audit = auditAccessibility();
    expect(audit.totalViolations).toBe(0);
    expect(audit.score).toBe(100);
  });

  it('generates automated axe accessibility assertion blocks for Playwright and Selenium', () => {
    const pwCode = generateA11yAssertionCode('playwright-ts');
    expect(pwCode).toContain('AxeBuilder');
    expect(pwCode).toContain('axeResults.violations');

    const pyCode = generateA11yAssertionCode('pytest');
    expect(pyCode).toContain('Axe(driver)');
    expect(pyCode).toContain('axe.inject()');
    expect(pyCode).toContain('assert len(results["violations"]) == 0');
  });
});
