import { LocatorCandidate, ElementFingerprint } from '../types/model';
import { validateLocator } from './locator-validator';
import { escapeCss, escapeXPath } from '../utils/dom';

const DYNAMIC_ATTRIBUTE_PATTERNS = [
  /^:r[0-9a-z]+:$/i, // React 18+ useId format (e.g., :r0:, :r1:, :ra:)
  /\breact-[a-z0-9_-]+\b/i, // react-select-4-input, react-aria-...
  /\bng-(star-inserted|tns-|trigger|animating|version|valid|invalid|dirty|pristine|touched|untouched|submitted|reflect)/i,
  /\b_ng(content|host)-[a-z0-9_-]+\b/i,
  /\bv-[a-z0-9_-]+\b/i, // Vue v- attributes / classes
  /\bdata-v-[a-f0-9]{6,}\b/i, // Vue scoped styles
  /\bcss-[0-9a-z]{5,}\b/i, // Emotion / styled-components hashes (css-19bb58m)
  /\bsc-[a-z0-9_-]{5,}\b/i, // Stencil / styled-components
  /\bember\d+\b/i, // Ember IDs
  /\bmat-(input|select|form-field|focused|ripple|mdc-focus-indicator)-[0-9a-z-]+\b/i, // Angular Material dynamic
  /\bcdk-(focused|focus-trap|overlay|visual-focused|describedby|[a-z0-9_-]+)\b/i, // Angular CDK dynamic
  /\bngb-[a-z0-9_-]+\b/i, // ng-bootstrap IDs
  /\binput-\d{3,}\b/i, // Generic generated numeric IDs with 3+ digits
  /\bbtn-[a-z0-9]{4,}\b/i, // Generated button hashes
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // UUID v4
  /\b[0-9a-f]{8,}\b/i, // 8+ character hex string
  /^[a-z0-9_-]+__[a-z0-9_-]{5,}$/i, // CSS module hashes
];

export function calculateShannonEntropy(str: string): number {
  if (!str) return 0;
  const len = str.length;
  const frequencies = new Map<string, number>();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function hasHighTransitionFrequency(str: string): boolean {
  if (str.length < 5) return false;
  let transitions = 0;
  for (let i = 0; i < str.length - 1; i++) {
    const c1 = str[i];
    const c2 = str[i + 1];
    const isAlpha1 = /[a-zA-Z]/.test(c1);
    const isDigit1 = /[0-9]/.test(c1);
    const isAlpha2 = /[a-zA-Z]/.test(c2);
    const isDigit2 = /[0-9]/.test(c2);
    if ((isAlpha1 && isDigit2) || (isDigit1 && isAlpha2)) {
      transitions++;
    }
  }
  return transitions / (str.length - 1) >= 0.35;
}

export function isDynamicAttribute(value: string): boolean {
  if (!value || typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;

  // React useId format check (:r0:, :r1:, :r2:, :r4f:-input-894723)
  if (/^:r[0-9a-z]+:$/i.test(trimmed) || /^:r[0-9a-z]+:.*$/i.test(trimmed)) {
    return true;
  }

  // Known framework patterns
  if (DYNAMIC_ATTRIBUTE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  // Token / segment checks (split by hyphens, underscores, or colons)
  const segments = trimmed.split(/[-_:]/).filter(Boolean);
  for (const seg of segments) {
    // 3+ consecutive digits in any segment (e.g. "input123", "row-456", "btn98471", "894723")
    if (/\d{3,}/.test(seg)) {
      return true;
    }
    // Shannon entropy & character-class transition check for obfuscated/random tokens
    if (seg.length >= 6 && /[0-9]/.test(seg)) {
      const entropy = calculateShannonEntropy(seg);
      if (entropy > 3.0 && hasHighTransitionFrequency(seg)) {
        return true;
      }
      if (entropy > 3.3 && /[a-z]/i.test(seg) && /[0-9]/.test(seg)) {
        return true;
      }
    }
    // Mixed hex/alphanumeric hash-like token (e.g. 5+ chars with both letters and numbers, like "1a2b3c", "19bb58m")
    if (seg.length >= 5 && /[a-z]/i.test(seg) && /[0-9]/.test(seg)) {
      const digitCount = (seg.match(/\d/g) || []).length;
      if (digitCount >= 2) {
        return true;
      }
    }
  }

  return false;
}

export function isDynamicId(id: string): boolean {
  return isDynamicAttribute(id);
}

export function extractElementFingerprint(element: Element): ElementFingerprint {
  const tagName = element.tagName.toLowerCase();
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 100);
  const ariaRole = element.getAttribute('role') || undefined;
  const ariaLabel = element.getAttribute('aria-label') || undefined;
  const name = element.getAttribute('name') || undefined;
  const placeholder = element.getAttribute('placeholder') || undefined;

  let rowContext: string | undefined;
  const tr = element.closest('tr');
  if (tr) {
    rowContext = (tr.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 80);
  }

  let labelText: string | undefined;
  if (element.id && (element as any).ownerDocument) {
    try {
      const lbl = (element as any).ownerDocument.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (lbl && lbl.textContent) {
        labelText = lbl.textContent.replace(/\s+/g, ' ').trim();
      }
    } catch {}
  }
  if (!labelText) {
    const parentLbl = element.closest('label');
    if (parentLbl && parentLbl.textContent) {
      labelText = parentLbl.textContent.replace(/\s+/g, ' ').trim();
    }
  }

  return {
    tagName,
    text: text || undefined,
    ariaRole: ariaRole || undefined,
    ariaLabel: ariaLabel || undefined,
    name: name || undefined,
    placeholder: placeholder || undefined,
    rowContext,
    labelText,
  };
}

export function scoreElementSimilarity(fingerprint: ElementFingerprint, candidate: Element): number {
  if (!fingerprint || !candidate) return 0;
  const candTag = candidate.tagName.toLowerCase();
  if (candTag !== fingerprint.tagName.toLowerCase()) {
    return 0;
  }

  let totalWeight = 0;
  let earnedScore = 0;

  // Tag match is guaranteed here
  totalWeight += 0.20;
  earnedScore += 0.20;

  // Text match
  if (fingerprint.text) {
    totalWeight += 0.20;
    const candText = (candidate.textContent || '').replace(/\s+/g, ' ').trim();
    if (candText === fingerprint.text) {
      earnedScore += 0.20;
    } else if (candText.includes(fingerprint.text) || fingerprint.text.includes(candText)) {
      earnedScore += 0.12;
    }
  }

  // Aria Role
  if (fingerprint.ariaRole) {
    totalWeight += 0.10;
    if (candidate.getAttribute('role') === fingerprint.ariaRole) {
      earnedScore += 0.10;
    }
  }

  // Aria Label
  if (fingerprint.ariaLabel) {
    totalWeight += 0.15;
    if (candidate.getAttribute('aria-label') === fingerprint.ariaLabel) {
      earnedScore += 0.15;
    }
  }

  // Name
  if (fingerprint.name) {
    totalWeight += 0.15;
    if (candidate.getAttribute('name') === fingerprint.name) {
      earnedScore += 0.15;
    }
  }

  // Placeholder
  if (fingerprint.placeholder) {
    totalWeight += 0.10;
    if (candidate.getAttribute('placeholder') === fingerprint.placeholder) {
      earnedScore += 0.10;
    }
  }

  // Label text
  if (fingerprint.labelText) {
    totalWeight += 0.15;
    const candFp = extractElementFingerprint(candidate);
    if (candFp.labelText === fingerprint.labelText) {
      earnedScore += 0.15;
    }
  }

  // Row context
  if (fingerprint.rowContext) {
    totalWeight += 0.10;
    const candTr = candidate.closest('tr');
    if (candTr) {
      const candRow = (candTr.textContent || '').replace(/\s+/g, ' ').trim();
      if (candRow.includes(fingerprint.rowContext) || fingerprint.rowContext.includes(candRow)) {
        earnedScore += 0.10;
      }
    }
  }

  return totalWeight > 0 ? Math.min(1.0, Math.round((earnedScore / totalWeight) * 100) / 100) : 0;
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
  if (UNSTABLE_CLASS_PATTERNS.some((pattern) => pattern.test(trimmed))) return false;
  return !isDynamicAttribute(trimmed);
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
  if (!labelText) {
    let prev = element.previousElementSibling;
    while (prev) {
      if (prev.tagName.toLowerCase() === 'label' && prev.textContent) {
        labelText = prev.textContent.trim();
        break;
      }
      prev = prev.previousElementSibling;
    }
  }
  if (!labelText && element.parentElement) {
    const siblingLabel = element.parentElement.querySelector('label');
    if (siblingLabel && siblingLabel.textContent) {
      labelText = siblingLabel.textContent.trim();
    }
  }

  // ContentEditable elements
  if ((element as any).isContentEditable || element.getAttribute('contenteditable') === 'true') {
    return { semanticType: 'contenteditable', defaultValue: 'Sample text content', labelText };
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

export function generateContextualAnchorLocators(
  element: HTMLElement,
  doc: Document = document
): LocatorCandidate[] {
  const candidates: LocatorCandidate[] = [];
  const tagName = element.tagName.toLowerCase();

  // 1. Label-anchored contextual locators
  // 1a. Explicit label via `for` attribute matching element id
  const elementId = element.getAttribute('id');
  if (elementId && elementId.trim()) {
    const rawId = elementId.trim();
    try {
      const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(rawId) : rawId.replace(/["\\]/g, '\\$&');
      const label = doc.querySelector(`label[for="${escapedId}"]`);
      if (label && label.textContent) {
        const labelText = label.textContent.replace(/\s+/g, ' ').trim();
        if (labelText && labelText.length <= 60 && !isDynamicAttribute(labelText)) {
          const safeText = escapeXPath(labelText);
          candidates.push({
            strategy: 'xpath',
            value: `//label[normalize-space()=${safeText}]/following::${tagName}[1]`,
            isUnique: false,
            matchCount: 0,
            score: 92,
          });
        }
      }
    } catch {
      // Ignore querySelector error
    }
  }

  // 1b. Wrapping label (element is inside <label>)
  const wrappingLabel = element.closest ? element.closest('label') : null;
  if (wrappingLabel && wrappingLabel.textContent) {
    try {
      const labelClone = wrappingLabel.cloneNode(true) as HTMLElement;
      const selfInClone = labelClone.querySelector(tagName);
      if (selfInClone) selfInClone.remove();
      const labelText = (labelClone.textContent || wrappingLabel.textContent).replace(/\s+/g, ' ').trim();
      if (labelText && labelText.length <= 60 && !isDynamicAttribute(labelText)) {
        const safeText = escapeXPath(labelText);
        candidates.push({
          strategy: 'xpath',
          value: `//label[contains(normalize-space(), ${safeText})]//${tagName}`,
          isUnique: false,
          matchCount: 0,
          score: 92,
        });
      }
    } catch {
      // Ignore
    }
  }

  // 1c. Preceding sibling label or semantic text element (<label>, <span>, <th>, <td>, <dt>, <strong>)
  let prev = element.previousElementSibling;
  while (prev) {
    const prevTag = prev.tagName.toLowerCase();
    const prevText = (prev.textContent || '').replace(/\s+/g, ' ').trim();
    if (
      ['label', 'span', 'strong', 'b', 'th', 'td', 'dt'].includes(prevTag) &&
      prevText &&
      prevText.length >= 2 &&
      prevText.length <= 60 &&
      !isDynamicAttribute(prevText)
    ) {
      const safeText = escapeXPath(prevText);
      candidates.push({
        strategy: 'xpath',
        value: `//${prevTag}[normalize-space()=${safeText}]/following::${tagName}[1]`,
        isUnique: false,
        matchCount: 0,
        score: 93,
      });
      if (prevTag === 'label') {
        candidates.push({
          strategy: 'xpath',
          value: `//label[normalize-space()=${safeText}]/following-sibling::${tagName}`,
          isUnique: false,
          matchCount: 0,
          score: 92,
        });
      }
      break;
    }
    prev = prev.previousElementSibling;
  }

  // 1d. Parent container with internal <label> (e.g. div.form-group > label + input)
  if (element.parentElement) {
    const parentTag = element.parentElement.tagName.toLowerCase();
    const pLabel = element.parentElement.querySelector('label');
    if (pLabel && !pLabel.contains(element)) {
      const pText = (pLabel.textContent || '').replace(/\s+/g, ' ').trim();
      if (pText && pText.length >= 2 && pText.length <= 60 && !isDynamicAttribute(pText)) {
        const safeText = escapeXPath(pText);
        candidates.push({
          strategy: 'xpath',
          value: `//${parentTag}[.//label[normalize-space()=${safeText}]]//${tagName}`,
          isUnique: false,
          matchCount: 0,
          score: 92,
        });
        candidates.push({
          strategy: 'xpath',
          value: `//label[normalize-space()=${safeText}]/following-sibling::${tagName}`,
          isUnique: false,
          matchCount: 0,
          score: 93,
        });
      }
    }
  }

  // 2. Table / Row-anchored locators (<tr>)
  const row = element.closest ? element.closest('tr') : null;
  if (row) {
    // Find identifying text in the row (e.g. from <th> or <td> that does not contain this element)
    const cells = Array.from(row.querySelectorAll('th, td'));
    let rowAnchorText = '';
    for (const cell of cells) {
      if (!cell.contains(element)) {
        const text = (cell.textContent || '').replace(/\s+/g, ' ').trim();
        if (text && text.length >= 2 && text.length <= 50 && !isDynamicAttribute(text)) {
          rowAnchorText = text;
          break;
        }
      }
    }

    if (rowAnchorText) {
      const safeRowText = escapeXPath(rowAnchorText);
      const elemText = (element.textContent || '').replace(/\s+/g, ' ').trim();
      const ariaLabel = element.getAttribute('aria-label');
      const nameAttr = element.getAttribute('name');
      const table = row.closest ? row.closest('table') : null;

      if (['button', 'a'].includes(tagName) && elemText && elemText.length <= 30 && !isDynamicAttribute(elemText)) {
        if (table && table.id && !isDynamicAttribute(table.id)) {
          candidates.push({
            strategy: 'xpath',
            value: `//table[@id="${escapeCss(table.id)}"]//tr[contains(normalize-space(), ${safeRowText})]//${tagName}[normalize-space()=${escapeXPath(elemText)}]`,
            isUnique: false,
            matchCount: 0,
            score: 97,
          });
        }
        candidates.push({
          strategy: 'xpath',
          value: `//tr[contains(normalize-space(), ${safeRowText})]//${tagName}[normalize-space()=${escapeXPath(elemText)}]`,
          isUnique: false,
          matchCount: 0,
          score: 96,
        });
        candidates.push({
          strategy: 'xpath',
          value: `//tr[contains(., ${safeRowText})]//${tagName}[normalize-space()=${escapeXPath(elemText)}]`,
          isUnique: false,
          matchCount: 0,
          score: 95,
        });
      } else if (ariaLabel && !isDynamicAttribute(ariaLabel)) {
        candidates.push({
          strategy: 'xpath',
          value: `//tr[contains(normalize-space(), ${safeRowText})]//${tagName}[@aria-label=${escapeXPath(ariaLabel)}]`,
          isUnique: false,
          matchCount: 0,
          score: 91,
        });
      } else if (nameAttr && !isDynamicAttribute(nameAttr)) {
        candidates.push({
          strategy: 'xpath',
          value: `//tr[contains(normalize-space(), ${safeRowText})]//${tagName}[@name=${escapeXPath(nameAttr)}]`,
          isUnique: false,
          matchCount: 0,
          score: 90,
        });
      } else {
        candidates.push({
          strategy: 'xpath',
          value: `//tr[contains(normalize-space(), ${safeRowText})]//${tagName}`,
          isUnique: false,
          matchCount: 0,
          score: 89,
        });
      }
    }
  }

  // 3. Parent / Ancestor container with Heading / Legend / Fieldset (up to 4 levels)
  let parent = element.parentElement;
  for (let depth = 0; depth < 4 && parent && parent !== doc.body; depth++) {
    // Check for legend in fieldset
    if (parent.tagName.toLowerCase() === 'fieldset') {
      const legend = parent.querySelector('legend');
      if (legend && legend.textContent) {
        const legendText = legend.textContent.replace(/\s+/g, ' ').trim();
        if (legendText && legendText.length <= 50 && !isDynamicAttribute(legendText)) {
          const safeText = escapeXPath(legendText);
          const nameAttr = element.getAttribute('name');
          const typeAttr = element.getAttribute('type');
          if (nameAttr && !isDynamicAttribute(nameAttr)) {
            candidates.push({
              strategy: 'xpath',
              value: `//fieldset[legend[normalize-space()=${safeText}]]//${tagName}[@name=${escapeXPath(nameAttr)}]`,
              isUnique: false,
              matchCount: 0,
              score: 89,
            });
          } else {
            candidates.push({
              strategy: 'xpath',
              value: `//fieldset[legend[normalize-space()=${safeText}]]//${tagName}${typeAttr ? `[@type="${typeAttr}"]` : ''}`,
              isUnique: false,
              matchCount: 0,
              score: 88,
            });
          }
          break;
        }
      }
    }

    // Check for section heading (h1, h2, h3, h4, h5, h6, [role="heading"])
    const heading = parent.querySelector ? parent.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > [role="heading"]') : null;
    if (heading && heading.textContent) {
      const headTag = heading.tagName.toLowerCase();
      const headText = heading.textContent.replace(/\s+/g, ' ').trim();
      if (headText && headText.length <= 50 && !isDynamicAttribute(headText)) {
        const safeText = escapeXPath(headText);
        const nameAttr = element.getAttribute('name');
        const parentTag = parent.tagName.toLowerCase();
        if (nameAttr && !isDynamicAttribute(nameAttr)) {
          candidates.push({
            strategy: 'xpath',
            value: `//${parentTag}[.//${headTag}[normalize-space()=${safeText}]]//${tagName}[@name=${escapeXPath(nameAttr)}]`,
            isUnique: false,
            matchCount: 0,
            score: 88,
          });
        } else {
          candidates.push({
            strategy: 'xpath',
            value: `//${parentTag}[.//${headTag}[normalize-space()=${safeText}]]//${tagName}`,
            isUnique: false,
            matchCount: 0,
            score: 86,
          });
        }
        break;
      }
    }
    parent = parent.parentElement;
  }

  return candidates;
}

export function generateLocators(
  element: HTMLElement,
  doc: Document = document
): LocatorCandidate[] {
  const candidates: LocatorCandidate[] = [];
  const tagName = element.tagName.toLowerCase();

  // Detect if element resides inside one or more open Shadow DOMs (multi-level deep piercing)
  const shadowHostPath: string[] = [];
  let currRoot: Node | null = element.getRootNode ? element.getRootNode() : null;
  while (
    currRoot &&
    typeof ShadowRoot !== 'undefined' &&
    currRoot instanceof ShadowRoot &&
    currRoot.host
  ) {
    const host = currRoot.host as HTMLElement;
    const hostTag = host.tagName.toLowerCase();
    const hostTestId = host.getAttribute('data-testid') || host.getAttribute('data-test') || host.getAttribute('data-cy');
    const sel = host.id
      ? `${hostTag}#${escapeCss(host.id)}`
      : hostTestId
      ? `${hostTag}[data-testid="${escapeCss(hostTestId)}"]`
      : hostTag;
    shadowHostPath.unshift(sel);
    currRoot = host.getRootNode ? host.getRootNode() : null;
  }

  const isInsideShadow = shadowHostPath.length > 0;
  const hostSelector = isInsideShadow ? shadowHostPath[0] : undefined;
  const primaryRootNode = isInsideShadow && element.getRootNode ? (element.getRootNode() as ShadowRoot) : undefined;

  // 1. ID Strategy
  const rawId = element.getAttribute('id');
  if (rawId && rawId.trim()) {
    const id = rawId.trim();
    const dynamic = isDynamicAttribute(id);
    candidates.push({
      strategy: 'id',
      value: id,
      isUnique: false,
      matchCount: 0,
      score: dynamic ? 15 : 100,
      warning: dynamic ? 'dynamic_id' : undefined,
    });
  }

  // 2. Test ID Strategy (data-testid, data-cy, data-test, data-qa, data-test-id, data-automation-id)
  const testAttr =
    element.getAttribute('data-testid') ||
    element.getAttribute('data-cy') ||
    element.getAttribute('data-test') ||
    element.getAttribute('data-qa') ||
    element.getAttribute('data-test-id') ||
    element.getAttribute('data-automation-id') ||
    element.getAttribute('data-qa-id');

  if (testAttr && testAttr.trim()) {
    const cleanTest = testAttr.trim();
    const dynamic = isDynamicAttribute(cleanTest);
    candidates.push({
      strategy: 'data-testid',
      value: cleanTest,
      isUnique: false,
      matchCount: 0,
      score: dynamic ? 25 : 95,
      warning: dynamic ? 'dynamic_id' : undefined,
    });
  }

  // 3. Anchor-Relative Contextual XPath Generation (Label, Table Row, Container Anchor)
  const contextualCandidates = generateContextualAnchorLocators(element, doc);
  candidates.push(...contextualCandidates);

  // 4. Name Strategy
  const nameAttr = element.getAttribute('name');
  if (nameAttr && nameAttr.trim()) {
    const cleanName = nameAttr.trim();
    const dynamic = isDynamicAttribute(cleanName);
    candidates.push({
      strategy: 'name',
      value: cleanName,
      isUnique: false,
      matchCount: 0,
      score: dynamic ? 20 : 90,
      warning: dynamic ? 'dynamic_id' : undefined,
    });
  }

  // 5. ARIA Label Strategy
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

  // 6. ARIA Role Strategy (combobox, option, tab, button, textbox, menuitem)
  const roleAttr = element.getAttribute('role');
  if (roleAttr && roleAttr.trim()) {
    const role = roleAttr.trim();
    const rawRoleText = (element.textContent || '').replace(/\s+/g, ' ').trim();
    const ariaLabelledBy = element.getAttribute('aria-labelledby');

    // Role + text (e.g. //*[@role="option"][normalize-space()="Production Blue"])
    if (rawRoleText && rawRoleText.length <= 50 && !isDynamicAttribute(rawRoleText)) {
      candidates.push({
        strategy: 'xpath',
        value: `//*[@role="${escapeCss(role)}"][normalize-space()=${escapeXPath(rawRoleText)}]`,
        isUnique: false,
        matchCount: 0,
        score: 95,
      });
      candidates.push({
        strategy: 'xpath',
        value: `//${tagName}[@role="${escapeCss(role)}"][normalize-space()=${escapeXPath(rawRoleText)}]`,
        isUnique: false,
        matchCount: 0,
        score: 94,
      });
    }

    // Role + aria-labelledby
    if (ariaLabelledBy) {
      try {
        const refLabel = doc.getElementById(ariaLabelledBy);
        if (refLabel && refLabel.textContent) {
          const lText = refLabel.textContent.replace(/\s+/g, ' ').trim();
          if (lText && lText.length <= 60 && !isDynamicAttribute(lText)) {
            candidates.push({
              strategy: 'xpath',
              value: `//label[@id="${escapeCss(ariaLabelledBy)}"]/following::*[@role="${escapeCss(role)}"][1]`,
              isUnique: false,
              matchCount: 0,
              score: 94,
            });
            candidates.push({
              strategy: 'xpath',
              value: `//label[normalize-space()=${escapeXPath(lText)}]/following::*[@role="${escapeCss(role)}"][1]`,
              isUnique: false,
              matchCount: 0,
              score: 93,
            });
          }
        }
      } catch {}
    }

    // Role + aria-label
    if (ariaLabel && !isDynamicAttribute(ariaLabel)) {
      candidates.push({
        strategy: 'css',
        value: `[role="${escapeCss(role)}"][aria-label="${escapeCss(ariaLabel.trim())}"]`,
        isUnique: false,
        matchCount: 0,
        score: 93,
      });
    }

    candidates.push({
      strategy: 'css',
      value: `[role="${escapeCss(role)}"]`,
      isUnique: false,
      matchCount: 0,
      score: 87,
    });
  }

  // 7. ContentEditable Strategy
  const isContentEditable = (element as any).isContentEditable || element.getAttribute('contenteditable') === 'true';
  if (isContentEditable) {
    const pLabel = element.parentElement?.querySelector('label');
    if (pLabel && pLabel.textContent) {
      const lText = pLabel.textContent.replace(/\s+/g, ' ').trim();
      if (lText && lText.length <= 60 && !isDynamicAttribute(lText)) {
        candidates.push({
          strategy: 'xpath',
          value: `//label[normalize-space()=${escapeXPath(lText)}]/following-sibling::*[@contenteditable="true"]`,
          isUnique: false,
          matchCount: 0,
          score: 94,
        });
        candidates.push({
          strategy: 'xpath',
          value: `//div[.//label[normalize-space()=${escapeXPath(lText)}]]//*[@contenteditable="true"]`,
          isUnique: false,
          matchCount: 0,
          score: 93,
        });
      }
    }
    candidates.push({
      strategy: 'css',
      value: `${tagName}[contenteditable="true"]`,
      isUnique: false,
      matchCount: 0,
      score: 88,
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
  ].includes(tagName) || isCustomElement || (tagName === 'div' && (element.textContent || '').trim().length <= 50);

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
  if (isInsideShadow && primaryRootNode instanceof ShadowRoot && primaryRootNode.host) {
    const host = primaryRootNode.host as HTMLElement;
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
    shadowHostPath: isInsideShadow ? [...shadowHostPath] : undefined,
    isShadowDom: isInsideShadow,
  }));

  // Validate all candidates against the live DOM (or ShadowRoot if encapsulated)
  const validated = candidatesWithShadow.map((candidate) =>
    validateLocator(candidate, doc, isInsideShadow ? primaryRootNode : undefined)
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

/**
 * Detects if the current execution context or window is inside an iframe,
 * and extracts a resilient locator string for the containing iframe.
 */
export function detectIframeLocator(targetWindow: Window = typeof window !== 'undefined' ? window : ({} as Window)): string | undefined {
  if (!targetWindow || typeof targetWindow !== 'object') return undefined;

  try {
    // If window.self === window.top, we are in the main top-level frame
    if (targetWindow.self === targetWindow.top) {
      return undefined;
    }
  } catch {
    // Cross-origin top access blocked: means we are definitely inside an iframe!
  }

  // 1. Try same-origin frameElement
  try {
    if (targetWindow.frameElement) {
      const frameEl = targetWindow.frameElement as HTMLElement;
      if (frameEl.id && !isDynamicId(frameEl.id)) {
        return `#${frameEl.id}`;
      }
      const testId = frameEl.getAttribute('data-testid');
      if (testId) {
        return `iframe[data-testid="${testId}"]`;
      }
      const nameAttr = frameEl.getAttribute('name');
      if (nameAttr) {
        return `iframe[name="${nameAttr}"]`;
      }
      const titleAttr = frameEl.getAttribute('title');
      if (titleAttr) {
        return `iframe[title="${titleAttr}"]`;
      }
      const srcAttr = frameEl.getAttribute('src');
      if (srcAttr) {
        try {
          const parsed = new URL(srcAttr, targetWindow.location.href);
          if (parsed.pathname && parsed.pathname !== '/') {
            return `iframe[src*="${parsed.pathname}"]`;
          }
        } catch {
          return `iframe[src*="${srcAttr}"]`;
        }
      }
      const locators = generateLocators(frameEl);
      if (locators.length > 0) {
        return locators[0].value;
      }
    }
  } catch {
    // Cross-origin security barrier
  }

  // 2. Check window name
  try {
    if (targetWindow.name) {
      return `iframe[name="${targetWindow.name}"]`;
    }
  } catch {}

  // 3. Check window pathname
  try {
    if (targetWindow.location?.pathname && targetWindow.location.pathname !== '/') {
      return `iframe[src*="${targetWindow.location.pathname}"]`;
    }
  } catch {}

  return 'iframe';
}
