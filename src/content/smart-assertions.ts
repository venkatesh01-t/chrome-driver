import { ElementFingerprint, TargetElementModel } from '../types/model';

export interface SmartAssertionCandidate {
  action: 'assert_visible' | 'assert_text' | 'assert_attribute';
  target: TargetElementModel;
  assertExpected?: string;
  assertAttribute?: string;
  confidence: number; // 0.0 - 1.0
  reason: string;
}

/**
 * Calculates string similarity using Levenshtein distance normalized (0.0 to 1.0)
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const s1 = a.trim().toLowerCase();
  const s2 = b.trim().toLowerCase();
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const track = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const distance = track[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

/**
 * Evaluates semantic match score between a recorded element fingerprint and a candidate DOM element
 */
export function matchElementBySemanticFingerprint(
  recorded: ElementFingerprint,
  candidate: HTMLElement
): number {
  let score = 0;
  let weightTotal = 0;

  // 1. Tag name match (weight 20)
  weightTotal += 20;
  if (candidate.tagName.toLowerCase() === (recorded.tagName || '').toLowerCase()) {
    score += 20;
  }

  // 2. Visible text match (weight 40)
  if (recorded.text) {
    weightTotal += 40;
    const candText = (candidate.textContent || '').trim();
    const sim = stringSimilarity(recorded.text, candText);
    score += sim * 40;
  }

  // 3. ARIA Label or Title (weight 20)
  if (recorded.ariaLabel) {
    weightTotal += 20;
    const candAria = candidate.getAttribute('aria-label') || candidate.getAttribute('title') || '';
    const sim = stringSimilarity(recorded.ariaLabel, candAria);
    score += sim * 20;
  }

  // 4. Input name or placeholder (weight 20)
  if (recorded.name || recorded.placeholder) {
    weightTotal += 20;
    const candName = candidate.getAttribute('name') || '';
    const candPl = candidate.getAttribute('placeholder') || '';
    const nameSim = recorded.name ? stringSimilarity(recorded.name, candName) : 0;
    const plSim = recorded.placeholder ? stringSimilarity(recorded.placeholder, candPl) : 0;
    score += Math.max(nameSim, plSim) * 20;
  }

  return weightTotal > 0 ? score / weightTotal : 0;
}

/**
 * Detects newly spawned alert, toast, or badge elements and synthesizes smart assertions
 */
export function synthesizeSmartAssertionsFromMutations(
  mutations: MutationRecord[],
  _root: Document | HTMLElement = document
): SmartAssertionCandidate[] {
  const suggestions: SmartAssertionCandidate[] = [];
  const seenElements = new Set<HTMLElement>();

  for (const mut of mutations) {
    mut.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (seenElements.has(el)) return;
        seenElements.add(el);

        // Check if element is a toast, alert, badge, or notification
        const isAlertRole = el.getAttribute('role') === 'alert' || el.getAttribute('role') === 'status';
        const classNames = (el.className || '').toString().toLowerCase();
        const isToastClass = /toast|alert|notification|badge|success|message|banner/.test(classNames);

        if (isAlertRole || isToastClass) {
          const text = (el.textContent || '').trim();

          const target: TargetElementModel = {
            tagName: el.tagName.toLowerCase(),
            selectedLocatorIndex: 0,
            locators: [
              ...(el.id ? [{ strategy: 'id' as const, value: el.id, isUnique: true, matchCount: 1, score: 95 }] : []),
              ...(el.getAttribute('data-testid')
                ? [{ strategy: 'data-testid' as const, value: el.getAttribute('data-testid')!, isUnique: true, matchCount: 1, score: 90 }]
                : []),
              { strategy: 'css' as const, value: el.id ? `#${el.id}` : `.${el.className.split(' ')[0]}`, isUnique: false, matchCount: 1, score: 70 },
            ],
            text,
          };

          if (text) {
            suggestions.push({
              action: 'assert_text',
              target,
              assertExpected: text,
              confidence: 0.95,
              reason: 'Dynamic confirmation message or alert toast appeared after action',
            });
          } else {
            suggestions.push({
              action: 'assert_visible',
              target,
              confidence: 0.85,
              reason: 'Dynamic status element appeared in the DOM',
            });
          }
        }
      }
    });
  }

  return suggestions;
}
