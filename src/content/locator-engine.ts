import { LocatorCandidate } from '../types/model';
import { validateLocator } from './locator-validator';
import { escapeCss, escapeXPath } from '../utils/dom';

const DYNAMIC_ID_PATTERNS = [
  /\binput-\d+\b/i,
  /\bbtn-[a-z0-9]{4,}\b/i,
  /\bember\d+\b/i,
  /\breact-[a-z0-9-]+\b/i,
  /\bmat-input-\d+\b/i,
  /\bcdk-[a-z0-9-]+\b/i,
  /\bngb-[a-z0-9-]+\b/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // UUID
  /\b[a-z0-9_-]+[0-9]{5,}\b/i, // Suffix with 5+ digits
  /\b[0-9a-f]{8,}\b/i, // Long hex string
];

export function isDynamicId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return DYNAMIC_ID_PATTERNS.some((pattern) => pattern.test(id));
}

const UNSTABLE_CLASS_PATTERNS = [
  /^ng-(star-inserted|tns-|trigger|animating|version|valid|invalid|dirty|pristine|touched|untouched|submitted)/i,
  /^hydrated$/i,
  /^sc-[a-z0-9-]+$/i, // Stencil scoped class
  /^cdk-(focused|focus-trap|overlay|visual-focused|describedby)/i,
  /^mat-(focused|ripple|mdc-focus-indicator)/i,
  /^(active|focus|focus-visible|focus-within|hover|visited|disabled|enabled|selected|open|opened|closed|show|fade|in|collapse|collapsing|collapsed)$/i,
  /^(is-|has-)/i,
  /^[a-z0-9_-]+__[a-z0-9_-]{5,}$/i, // CSS module hashes
  /^css-[a-z0-9]{5,}$/i, // Emotion / styled-components
];

export function isStableClass(className: string): boolean {
  if (!className || typeof className !== 'string') return false;
  const trimmed = className.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith(':') || trimmed.includes('[') || trimmed.includes('(')) return false;
  return !UNSTABLE_CLASS_PATTERNS.some((pattern) => pattern.test(trimmed));
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

  // Detect if element resides inside an open Shadow DOM
  const rootNode = element.getRootNode ? element.getRootNode() : null;
  const isInsideShadow = !!(
    rootNode &&
    typeof ShadowRoot !== 'undefined' &&
    rootNode instanceof ShadowRoot &&
    rootNode.host
  );
  let hostSelector: string | undefined;
  if (isInsideShadow) {
    const host = (rootNode as ShadowRoot).host as HTMLElement;
    const hostTag = host.tagName.toLowerCase();
    hostSelector = host.id ? `${hostTag}#${host.id}` : hostTag;
  }

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
      score: 87,
    });
  }

  // 5. Title Strategy
  const titleAttr = element.getAttribute('title');
  if (titleAttr && titleAttr.trim()) {
    candidates.push({
      strategy: 'css',
      value: `${tagName}[title="${escapeCss(titleAttr.trim())}"]`,
      isUnique: false,
      matchCount: 0,
      score: 86,
    });
  }

  // 6. Placeholder Strategy
  const placeholderAttr = element.getAttribute('placeholder');
  if (placeholderAttr && placeholderAttr.trim()) {
    candidates.push({
      strategy: 'css',
      value: `${tagName}[placeholder="${escapeCss(placeholderAttr.trim())}"]`,
      isUnique: false,
      matchCount: 0,
      score: 85,
    });
  }

  // 7. Custom Component / Semantic Attributes (menu-title, item-title, data-title, date, day)
  const customAttrs = ['menu-title', 'item-title', 'data-title', 'data-name', 'data-id', 'date', 'day'];
  for (const attr of customAttrs) {
    const val = element.getAttribute(attr);
    if (val && val.trim()) {
      candidates.push({
        strategy: 'css',
        value: `${tagName}[${attr}="${escapeCss(val.trim())}"]`,
        isUnique: false,
        matchCount: 0,
        score: 84,
      });
    }
  }

  // 8. Meaningful href on Anchor tags
  if (tagName === 'a') {
    const href = element.getAttribute('href');
    if (href && href.trim() && !href.startsWith('#') && !href.startsWith('javascript:')) {
      const cleanHref = href.trim();
      candidates.push({
        strategy: 'css',
        value: `a[href="${escapeCss(cleanHref)}"]`,
        isUnique: false,
        matchCount: 0,
        score: 84,
      });

      // Also add path keyword if informative (e.g. href="/v3/portal/ess/attendance" -> a[href*="attendance"])
      const segments = cleanHref.split('/').filter((s) => s.length > 3 && !s.includes('?'));
      const lastSegment = segments[segments.length - 1];
      if (lastSegment && lastSegment !== cleanHref) {
        candidates.push({
          strategy: 'css',
          value: `a[href*="${escapeCss(lastSegment)}"]`,
          isUnique: false,
          matchCount: 0,
          score: 83,
        });
      }
    }
  }

  // 9. Semantic Relative XPath (Text based for buttons/links/headings/custom web components)
  const isCustomElement = tagName.includes('-');
  const isTextSupportedTag = [
    'button', 'a', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'label', 'p', 'li', 'td', 'th', 'b', 'strong', 'i', 'em', 'summary'
  ].includes(tagName) || isCustomElement;

  const rawText = (element.textContent || '').replace(/\s+/g, ' ').trim();
  if (rawText && rawText.length > 0 && isTextSupportedTag) {
    // 1. Exact match if short
    if (rawText.length <= 50) {
      const safeText = escapeXPath(rawText);
      candidates.push({
        strategy: 'xpath',
        value: `//${tagName}[normalize-space()=${safeText}]`,
        isUnique: false,
        matchCount: 0,
        score: isCustomElement ? 88 : 85,
      });

      // 2. Contains context node text (resilient against surrounding icon text/ligatures)
      candidates.push({
        strategy: 'xpath',
        value: `//${tagName}[contains(., ${safeText})]`,
        isUnique: false,
        matchCount: 0,
        score: isCustomElement ? 86 : 82,
      });
    }

    // 3. Substring match
    if (rawText.length > 2 && rawText.length <= 100) {
      const snippet = rawText.substring(0, 40).trim();
      const safeSnippet = escapeXPath(snippet);
      candidates.push({
        strategy: 'xpath',
        value: `//${tagName}[contains(normalize-space(), ${safeSnippet})]`,
        isUnique: false,
        matchCount: 0,
        score: isCustomElement ? 83 : 80,
      });
    }

    // 4. Targeted child span/link text
    const innerTextElem = element.querySelector('span, a, button, div, p');
    if (innerTextElem && innerTextElem.textContent) {
      const innerText = innerTextElem.textContent.replace(/\s+/g, ' ').trim();
      if (innerText && innerText.length <= 40 && innerText !== rawText) {
        const safeInner = escapeXPath(innerText);
        candidates.push({
          strategy: 'xpath',
          value: `//${tagName}[.//span[contains(normalize-space(), ${safeInner})] or .//a[contains(normalize-space(), ${safeInner})]]`,
          isUnique: false,
          matchCount: 0,
          score: 84,
        });
      }
    }
  }

  // If element is inside a Shadow Root, also add Shadow Host locator in light DOM
  if (isInsideShadow && rootNode instanceof ShadowRoot && rootNode.host) {
    const host = rootNode.host as HTMLElement;
    const hostTag = host.tagName.toLowerCase();
    const hostText = (host.textContent || '').replace(/\s+/g, ' ').trim();
    if (hostText && hostText.length <= 50) {
      candidates.push({
        strategy: 'xpath',
        value: `//${hostTag}[contains(., ${escapeXPath(hostText)})]`,
        isUnique: false,
        matchCount: 0,
        score: 89,
      });
    }
  }

  // 10. CSS Strategy (tag + stable classes, excluding framework and transient classes)
  if (element.classList && element.classList.length > 0) {
    const stableClasses = Array.from(element.classList).filter(isStableClass);
    if (stableClasses.length > 0) {
      const classSelector = `.${stableClasses.slice(0, 2).map((c) => escapeCss(c)).join('.')}`;
      candidates.push({
        strategy: 'css',
        value: `${tagName}${classSelector}`,
        isUnique: false,
        matchCount: 0,
        score: 70,
      });
    }
  }

  // 11. Fallback True Document-Wide Index XPath
  const allSameTags = Array.from(doc.getElementsByTagName(tagName));
  const docIndex = allSameTags.indexOf(element) + 1;
  if (docIndex > 0 && allSameTags.length > 1) {
    candidates.push({
      strategy: 'xpath',
      value: `(//${tagName})[${docIndex}]`,
      isUnique: false,
      matchCount: 0,
      score: 45,
      warning: 'dom_dependent',
    });
  }

  // Attach shadow DOM properties if applicable
  const candidatesWithShadow = candidates.map((c) => ({
    ...c,
    shadowHostSelector: isInsideShadow ? hostSelector : undefined,
    isShadowDom: isInsideShadow,
  }));

  // Validate all candidates against the live DOM (or ShadowRoot if encapsulated)
  const validated = candidatesWithShadow.map((candidate) =>
    validateLocator(candidate, doc, isInsideShadow ? (rootNode as ShadowRoot) : undefined)
  );

  // Strict sorting:
  // 1. Elements with matchCount > 0 ALWAYS rank ahead of matchCount === 0
  // 2. Unique locators (matchCount === 1) rank ahead of multiple matches
  // 3. Higher score first
  validated.sort((a, b) => {
    const aValid = a.matchCount > 0 ? 1 : 0;
    const bValid = b.matchCount > 0 ? 1 : 0;
    if (aValid !== bValid) {
      return bValid - aValid;
    }
    if (a.isUnique !== b.isUnique) {
      return a.isUnique ? -1 : 1;
    }
    return b.score - a.score;
  });

  return validated;
}
