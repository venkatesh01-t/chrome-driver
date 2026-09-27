import { LocatorCandidate } from '../types/model';
import { validateLocator } from './locator-validator';
import { escapeCss, escapeXPath } from '../utils/dom';

const DYNAMIC_ID_PATTERNS = [
  /\binput-\d+\b/i,
  /\bbtn-[a-z0-9]{4,}\b/i,
  /\bember\d+\b/i,
  /\breact-[a-z0-9-]+\b/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // UUID
  /\b[a-z0-9_-]+[0-9]{5,}\b/i, // Suffix with 5+ digits
  /\b[0-9a-f]{8,}\b/i, // Long hex string
];

export function isDynamicId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return DYNAMIC_ID_PATTERNS.some((pattern) => pattern.test(id));
}

export interface FieldSemantics {
  semanticType: string;
  defaultValue: string;
  labelText?: string;
}

export function detectFieldSemantics(
  element: HTMLElement,
  doc: Document = document
): FieldSemantics {
  const tagName = element.tagName.toLowerCase();
  const inputType = (element.getAttribute('type') || 'text').toLowerCase();
  const name = (element.getAttribute('name') || '').toLowerCase();
  const id = (element.getAttribute('id') || '').toLowerCase();
  const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();
  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();

  // Find associated label
  let labelText: string | undefined;
  if (id) {
    try {
      const label = doc.querySelector(`label[for="${escapeCss(id)}"]`);
      if (label && label.textContent) {
        labelText = label.textContent.trim();
      }
    } catch {
      // ignore
    }
  }
  if (!labelText) {
    const parentLabel = element.closest('label');
    if (parentLabel && parentLabel.textContent) {
      labelText = parentLabel.textContent.trim();
    }
  }

  const combinedHints = `${name} ${id} ${placeholder} ${ariaLabel} ${autocomplete} ${labelText || ''}`.toLowerCase();

  // Checkbox / Radio
  if (inputType === 'checkbox') {
    return { semanticType: 'checkbox', defaultValue: 'true', labelText };
  }
  if (inputType === 'radio') {
    return { semanticType: 'radio', defaultValue: element.getAttribute('value') || 'selected', labelText };
  }

  // Dropdown
  if (tagName === 'select') {
    return { semanticType: 'dropdown', defaultValue: '', labelText };
  }

  // Textarea
  if (tagName === 'textarea') {
    return { semanticType: 'textarea', defaultValue: 'Sample detailed feedback or text.', labelText };
  }

  // Password / Sensitive
  if (inputType === 'password' || combinedHints.includes('password') || combinedHints.includes('passwd') || combinedHints.includes('otp') || combinedHints.includes('cvv')) {
    return { semanticType: 'password', defaultValue: '••••••••', labelText };
  }

  // Email
  if (inputType === 'email' || combinedHints.includes('email') || combinedHints.includes('mail')) {
    return { semanticType: 'email', defaultValue: 'user@example.com', labelText };
  }

  // Phone / Tel
  if (inputType === 'tel' || combinedHints.includes('phone') || combinedHints.includes('mobile') || combinedHints.includes('tel')) {
    return { semanticType: 'phone', defaultValue: '+1234567890', labelText };
  }

  // Search
  if (inputType === 'search' || combinedHints.includes('search') || combinedHints.includes('query')) {
    return { semanticType: 'search', defaultValue: 'Test query', labelText };
  }

  // Number / Quantity
  if (inputType === 'number' || combinedHints.includes('quantity') || combinedHints.includes('qty') || combinedHints.includes('age') || combinedHints.includes('count')) {
    return { semanticType: 'number', defaultValue: '1', labelText };
  }

  // Date
  if (inputType === 'date' || combinedHints.includes('date') || combinedHints.includes('birth') || combinedHints.includes('dob')) {
    return { semanticType: 'date', defaultValue: '2026-01-01', labelText };
  }

  // URL
  if (inputType === 'url' || combinedHints.includes('website') || combinedHints.includes('url')) {
    return { semanticType: 'url', defaultValue: 'https://example.com', labelText };
  }

  // Username
  if (combinedHints.includes('username') || combinedHints.includes('user') || combinedHints.includes('login')) {
    return { semanticType: 'username', defaultValue: 'test_user', labelText };
  }

  // Name / Full name
  if (combinedHints.includes('name') || combinedHints.includes('fullname') || combinedHints.includes('firstname')) {
    return { semanticType: 'name', defaultValue: 'John Doe', labelText };
  }

  return { semanticType: 'text', defaultValue: 'Sample text', labelText };
}

export function generateLocators(
  element: HTMLElement,
  doc: Document = document
): LocatorCandidate[] {
  const candidates: LocatorCandidate[] = [];
  const tagName = element.tagName.toLowerCase();

  // 1. ID Strategy
  const rawId = element.getAttribute('id');
  if (rawId && rawId.trim()) {
    const id = rawId.trim();
    const dynamic = isDynamicId(id);
    candidates.push({
      strategy: 'id',
      value: id,
      isUnique: false,
      matchCount: 0,
      score: dynamic ? 40 : 100,
      warning: dynamic ? 'dynamic_id' : undefined,
    });
  }

  // 2. Test ID Strategy (data-testid, data-cy, data-test, data-qa)
  const testAttr =
    element.getAttribute('data-testid') ||
    element.getAttribute('data-cy') ||
    element.getAttribute('data-test') ||
    element.getAttribute('data-qa');

  if (testAttr && testAttr.trim()) {
    candidates.push({
      strategy: 'data-testid',
      value: testAttr.trim(),
      isUnique: false,
      matchCount: 0,
      score: 95,
    });
  }

  // 3. Name Strategy
  const nameAttr = element.getAttribute('name');
  if (nameAttr && nameAttr.trim()) {
    candidates.push({
      strategy: 'name',
      value: nameAttr.trim(),
      isUnique: false,
      matchCount: 0,
      score: 90,
    });
  }

  // 4. ARIA Label Strategy
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    candidates.push({
      strategy: 'aria-label',
      value: ariaLabel.trim(),
      isUnique: false,
      matchCount: 0,
      score: 85,
    });
  }

  // 5. Semantic Relative XPath (Text based for buttons/links/headings)
  const textContent = (element.textContent || '').trim();
  if (
    textContent &&
    textContent.length <= 40 &&
    ['button', 'a', 'span', 'h1', 'h2', 'h3', 'h4', 'label'].includes(tagName)
  ) {
    const safeText = escapeXPath(textContent);
    const xpath = `//${tagName}[normalize-space()=${safeText}]`;
    candidates.push({
      strategy: 'xpath',
      value: xpath,
      isUnique: false,
      matchCount: 0,
      score: 80,
    });
  }

  // 6. CSS Strategy (tag + class)
  if (element.classList && element.classList.length > 0) {
    const classList = Array.from(element.classList).filter(
      (c) => !c.startsWith('hover') && !c.startsWith('active') && !c.includes(':')
    );
    if (classList.length > 0) {
      const classSelector = `.${classList.slice(0, 2).map((c) => escapeCss(c)).join('.')}`;
      candidates.push({
        strategy: 'css',
        value: `${tagName}${classSelector}`,
        isUnique: false,
        matchCount: 0,
        score: 70,
      });
    }
  }

  // 7. Fallback Relative XPath / Nth-of-type if needed
  if (element.parentElement) {
    const siblings = Array.from(element.parentElement.children).filter(
      (c) => c.tagName.toLowerCase() === tagName
    );
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      candidates.push({
        strategy: 'xpath',
        value: `(//${tagName})[${index}]`,
        isUnique: false,
        matchCount: 0,
        score: 45,
        warning: 'dom_dependent',
      });
    }
  }

  // Validate all candidates against the live DOM
  const validated = candidates.map((candidate) => validateLocator(candidate, doc));

  // Sort candidates by uniqueness, then by score descending
  validated.sort((a, b) => {
    if (a.isUnique !== b.isUnique) {
      return a.isUnique ? -1 : 1;
    }
    return b.score - a.score;
  });

  return validated;
}
