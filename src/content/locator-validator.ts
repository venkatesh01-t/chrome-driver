import { LocatorCandidate } from '../types/model';
import { escapeCss } from '../utils/dom';

export function validateLocator(
  candidate: LocatorCandidate,
  doc: Document = document
): LocatorCandidate {
  let matchCount = 0;

  try {
    if (candidate.strategy === 'xpath' || candidate.strategy === 'absolute-xpath') {
      const result = doc.evaluate(
        candidate.value,
        doc,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      matchCount = result.snapshotLength;
    } else if (candidate.strategy === 'id') {
      matchCount = doc.querySelectorAll(`[id="${escapeCss(candidate.value)}"]`).length;
    } else {
      let selector = candidate.value;
      if (candidate.strategy === 'name') {
        selector = `[name="${escapeCss(candidate.value)}"]`;
      } else if (candidate.strategy === 'data-testid') {
        selector = `[data-testid="${escapeCss(candidate.value)}"]`;
      } else if (candidate.strategy === 'aria-label') {
        selector = `[aria-label="${escapeCss(candidate.value)}"]`;
      }
      matchCount = doc.querySelectorAll(selector).length;
    }
  } catch {
    matchCount = 0;
  }

  const isUnique = matchCount === 1;
  const warning = !isUnique && matchCount > 1 ? 'multiple_matches' : candidate.warning;

  return {
    ...candidate,
    matchCount,
    isUnique,
    warning,
    score: isUnique ? candidate.score : Math.max(0, candidate.score - 40),
  };
}
