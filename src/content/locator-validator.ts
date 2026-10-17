import { LocatorCandidate, ElementFingerprint } from '../types/model';
import { escapeCss } from '../utils/dom';

export function validateLocator(
  candidate: LocatorCandidate,
  doc: Document = document,
  rootNode?: Document | ShadowRoot | Element
): LocatorCandidate {
  let matchCount = 0;
  const isInsideShadow = rootNode && typeof ShadowRoot !== 'undefined' && rootNode instanceof ShadowRoot;

  try {
    if (candidate.strategy === 'xpath' || candidate.strategy === 'absolute-xpath') {
      if (isInsideShadow) {
        // XPath cannot run directly on ShadowRoot in browser DOM.
        // Check semantic matching within the shadow root:
        const hrefMatch = candidate.value.match(/@href,\s*['"]([^'"]+)['"]/);
        if (hrefMatch) {
          const seg = hrefMatch[1];
          matchCount = Array.from((rootNode as ShadowRoot).querySelectorAll('a')).filter(
            (a) => (a.getAttribute('href') || '').includes(seg)
          ).length;
        } else {
          const textMatch = candidate.value.match(
            /\[(?:contains\(\.,\s*['"]|normalize-space\(\)=\s*['"]|contains\(normalize-space\(\),\s*['"])([^'"]+)['"]\)/
          );
          if (textMatch) {
            const expected = textMatch[1].trim().toLowerCase();
            const items = Array.from(
              (rootNode as ShadowRoot).querySelectorAll('a, button, span, div, p, li, gt-icon')
            );
            matchCount = items.filter((el) =>
              (el.textContent || '').trim().toLowerCase().includes(expected)
            ).length;
          } else {
            matchCount = 0;
          }
        }
      } else {
        const result = doc.evaluate(
          candidate.value,
          doc,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        matchCount = result.snapshotLength;
      }
    } else if (candidate.strategy === 'id') {
      const scope = (rootNode as ShadowRoot) || doc;
      matchCount = scope.querySelectorAll(`[id="${escapeCss(candidate.value)}"]`).length;
    } else {
      let selector = candidate.value;
      if (candidate.strategy === 'name') {
        selector = `[name="${escapeCss(candidate.value)}"]`;
      } else if (candidate.strategy === 'data-testid') {
        selector = `[data-testid="${escapeCss(candidate.value)}"]`;
      } else if (candidate.strategy === 'aria-label') {
        selector = `[aria-label="${escapeCss(candidate.value)}"]`;
      }
      const scope = (rootNode as ShadowRoot) || doc;
      matchCount = scope.querySelectorAll(selector).length;
    }
  } catch {
    matchCount = 0;
  }

  const isUnique = matchCount === 1;
  let warning = candidate.warning;
  if (!warning) {
    if (matchCount === 0) {
      warning = 'no_matches';
    } else if (matchCount > 1) {
      warning = 'multiple_matches';
    }
  }

  let finalScore = candidate.score;
  if (matchCount === 0) {
    finalScore = -100;
  } else if (!isUnique) {
    finalScore = Math.max(1, candidate.score - 40);
  }

  // Penalize any locator that relies on positional indices unless anchored to unique text
  const hasPositionalIndex = /\[\d+\]|:nth-child|:nth-of-type/i.test(candidate.value);
  const hasTextAnchor = /normalize-space|contains\(|@text/i.test(candidate.value);
  if (hasPositionalIndex && !hasTextAnchor) {
    finalScore = Math.min(finalScore, 40);
    if (!warning) warning = 'dom_dependent';
  }

  return {
    ...candidate,
    matchCount,
    isUnique,
    warning,
    score: finalScore,
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

  // Tag match is guaranteed
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
    let candLabel: string | undefined;
    if (candidate.id && (candidate as any).ownerDocument) {
      try {
        const lbl = (candidate as any).ownerDocument.querySelector(`label[for="${CSS.escape(candidate.id)}"]`);
        if (lbl && lbl.textContent) candLabel = lbl.textContent.replace(/\s+/g, ' ').trim();
      } catch {}
    }
    if (!candLabel) {
      const parentLbl = candidate.closest('label');
      if (parentLbl && parentLbl.textContent) candLabel = parentLbl.textContent.replace(/\s+/g, ' ').trim();
    }
    if (candLabel === fingerprint.labelText) {
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

export function findBestHealedElement(
  fingerprint: ElementFingerprint,
  doc: Document = document,
  threshold = 0.6
): { element: Element; similarity: number } | null {
  if (!fingerprint || !fingerprint.tagName) return null;
  const candidates = Array.from(doc.getElementsByTagName(fingerprint.tagName));
  let bestMatch: Element | null = null;
  let bestScore = 0;

  for (const cand of candidates) {
    const sim = scoreElementSimilarity(fingerprint, cand);
    if (sim > bestScore) {
      bestScore = sim;
      bestMatch = cand;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return { element: bestMatch, similarity: bestScore };
  }
  return null;
}
