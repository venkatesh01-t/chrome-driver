import { describe, it, expect, beforeEach } from 'vitest';
import {
  stringSimilarity,
  matchElementBySemanticFingerprint,
  synthesizeSmartAssertionsFromMutations,
} from '../src/content/smart-assertions';
import { ElementFingerprint } from '../src/types/model';

describe('Pillar 6: AI Semantic Healing & Smart Assertion Synthesizer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('calculates string similarity with normalized distance', () => {
    expect(stringSimilarity('Submit', 'Submit')).toBe(1);
    expect(stringSimilarity('Submit Order', 'Submit')).toBe(0.85);
    expect(stringSimilarity('Checkout Now', 'Checkout Now')).toBe(1);
    expect(stringSimilarity('apple', 'banana')).toBeLessThan(0.3);
  });

  it('heals and matches target element using semantic fingerprint when CSS classes change', () => {
    document.body.innerHTML = `
      <div class="wrapper">
        <button id="btn-scrambled-xyz" class="scrambled-react-cls-994" aria-label="Confirm Purchase">
          Confirm Order
        </button>
        <button class="cancel-btn">Cancel</button>
      </div>
    `;

    const targetButton = document.getElementById('btn-scrambled-xyz')!;
    const cancelButton = document.querySelector('.cancel-btn') as HTMLElement;

    const recordedFingerprint: ElementFingerprint = {
      tagName: 'button',
      text: 'Confirm Order',
      ariaLabel: 'Confirm Purchase',
    };

    const matchScoreTarget = matchElementBySemanticFingerprint(recordedFingerprint, targetButton);
    const matchScoreCancel = matchElementBySemanticFingerprint(recordedFingerprint, cancelButton);

    expect(matchScoreTarget).toBeGreaterThan(0.9);
    expect(matchScoreCancel).toBeLessThan(0.4);
  });

  it('synthesizes smart assertions when DOM mutations introduce a toast or alert', () => {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success notification';
    toast.setAttribute('role', 'alert');
    toast.textContent = 'Payment Completed Successfully!';

    const mockMutation: MutationRecord = {
      type: 'childList',
      target: document.body,
      addedNodes: [toast] as any,
      removedNodes: [] as any,
      previousSibling: null,
      nextSibling: null,
      attributeName: null,
      attributeNamespace: null,
      oldValue: null,
    };

    const suggestions = synthesizeSmartAssertionsFromMutations([mockMutation]);

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].action).toBe('assert_text');
    expect(suggestions[0].assertExpected).toBe('Payment Completed Successfully!');
    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(suggestions[0].reason).toContain('alert toast appeared');
  });
});
