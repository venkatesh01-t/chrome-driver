import { LocatorCandidate } from '../types/model';
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
  if (matchCount === 0) {
    warning = 'no_matches';
  } else if (matchCount > 1) {
    warning = 'multiple_matches';
  }

  let finalScore = candidate.score;
  if (matchCount === 0) {
    finalScore = -100;
  } else if (!isUnique) {
    finalScore = Math.max(1, candidate.score - 40);
  }

  return {
    ...candidate,
    matchCount,
    isUnique,
    warning,
    score: finalScore,
  };
}
