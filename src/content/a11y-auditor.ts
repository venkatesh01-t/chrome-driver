import { escapeCss } from '../utils/dom';

export type A11yImpact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface A11yViolation {
  id: string;
  impact: A11yImpact;
  description: string;
  helpUrl: string;
  targetElement: string;
  suggestedFix: string;
}

export interface A11yAuditResult {
  score: number; // 0 - 100
  totalViolations: number;
  criticalCount: number;
  violations: A11yViolation[];
  passedChecks: number;
}

/**
 * Runs a client-side WCAG 2.2 Level AA accessibility audit on the target DOM root
 */
export function auditAccessibility(root: Document | HTMLElement = document): A11yAuditResult {
  const violations: A11yViolation[] = [];
  let passed = 0;

  const doc = (root as Document).body ? (root as Document) : root.ownerDocument || document;

  // 1. Image alternative text (WCAG 1.1.1 Non-text Content)
  const images = doc.querySelectorAll('img');
  images.forEach((img, idx) => {
    const hasAlt = img.hasAttribute('alt');
    const ariaHidden = img.getAttribute('aria-hidden') === 'true';
    if (!hasAlt && !ariaHidden) {
      violations.push({
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text or aria-hidden="true" for decorative images.',
        helpUrl: 'https://www.w3.org/WAI/WCAG22/quickref/#non-text-content',
        targetElement: img.id ? `#${img.id}` : `img:nth-of-type(${idx + 1})`,
        suggestedFix: 'Add alt="meaningful description" or alt="" if purely decorative.',
      });
    } else {
      passed++;
    }
  });

  // 2. Buttons with accessible name (WCAG 4.1.2 Name, Role, Value)
  const buttons = doc.querySelectorAll('button, [role="button"]');
  buttons.forEach((btn, idx) => {
    const text = (btn.textContent || '').trim();
    const ariaLabel = btn.getAttribute('aria-label') || btn.getAttribute('aria-labelledby');
    const title = btn.getAttribute('title');

    if (!text && !ariaLabel && !title) {
      violations.push({
        id: 'button-name',
        impact: 'critical',
        description: 'Buttons must have discernible, accessible text content.',
        helpUrl: 'https://www.w3.org/WAI/WCAG22/quickref/#name-role-value',
        targetElement: btn.id ? `#${btn.id}` : `button:nth-of-type(${idx + 1})`,
        suggestedFix: 'Provide visible text inside the button or add an aria-label attribute.',
      });
    } else {
      passed++;
    }
  });

  // 3. Form input labels (WCAG 1.3.1 Info and Relationships)
  const inputs = doc.querySelectorAll('input:not([type="hidden"]), select, textarea');
  inputs.forEach((input, idx) => {
    const id = input.id;
    const hasLabel = id ? !!doc.querySelector(`label[for="${escapeCss(id)}"]`) : false;
    const hasAriaLabel = !!(input.getAttribute('aria-label') || input.getAttribute('aria-labelledby'));
    const isWrappedInLabel = !!input.closest('label');

    if (!hasLabel && !hasAriaLabel && !isWrappedInLabel) {
      violations.push({
        id: 'label-missing',
        impact: 'serious',
        description: 'Form inputs must have an associated <label> or aria-label.',
        helpUrl: 'https://www.w3.org/WAI/WCAG22/quickref/#info-and-relationships',
        targetElement: id ? `#${id}` : `input:nth-of-type(${idx + 1})`,
        suggestedFix: 'Add a <label for="inputId"> or aria-label="Descriptive Name".',
      });
    } else {
      passed++;
    }
  });

  // 4. Anchor links with valid href and discernible text (WCAG 2.4.4 Link Purpose)
  const links = doc.querySelectorAll('a');
  links.forEach((a, idx) => {
    const text = (a.textContent || '').trim();
    const ariaLabel = a.getAttribute('aria-label');
    const href = a.getAttribute('href');

    if (!text && !ariaLabel) {
      violations.push({
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text so screen readers can describe the destination.',
        helpUrl: 'https://www.w3.org/WAI/WCAG22/quickref/#link-purpose-in-context',
        targetElement: a.id ? `#${a.id}` : `a:nth-of-type(${idx + 1})`,
        suggestedFix: 'Add descriptive anchor text or an aria-label attribute.',
      });
    } else if (href === '#' || href === 'javascript:void(0)') {
      violations.push({
        id: 'link-href-invalid',
        impact: 'moderate',
        description: 'Links should not use placeholder href="#" or javascript pseudo-protocols.',
        helpUrl: 'https://www.w3.org/WAI/WCAG22/quickref/#keyboard',
        targetElement: a.id ? `#${a.id}` : `a:nth-of-type(${idx + 1})`,
        suggestedFix: 'Use a <button> element instead if triggering in-page JavaScript actions.',
      });
    } else {
      passed++;
    }
  });

  const totalEvaluated = violations.length + passed;
  const criticalCount = violations.filter((v) => v.impact === 'critical').length;
  const score = totalEvaluated === 0 ? 100 : Math.max(0, Math.round(((passed) / totalEvaluated) * 100));

  return {
    score,
    totalViolations: violations.length,
    criticalCount,
    violations,
    passedChecks: passed,
  };
}

/**
 * Generates an automated accessibility assertion step for Playwright or Selenium
 */
export function generateA11yAssertionCode(framework: 'playwright-ts' | 'pytest'): string {
  if (framework === 'playwright-ts') {
    return `    // WCAG 2.2 Automated Accessibility Scan\n    const axeResults = await new AxeBuilder({ page }).analyze();\n    expect(axeResults.violations).toEqual([]);`;
  }
  return `    # WCAG 2.2 Automated Accessibility Scan via axe-selenium-python\n    axe = Axe(driver)\n    axe.inject()\n    results = axe.run()\n    assert len(results["violations"]) == 0, f"A11y violations detected: {results['violations']}"`;
}
