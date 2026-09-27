import { describe, it, expect } from 'vitest';
import { renderStepCard, renderEmptyState } from '../src/sidepanel/ui-renderer';
import { createTestStep } from '../src/types/model';

describe('Side Panel UI Renderer', () => {
  it('renders empty state placeholder when no steps recorded', () => {
    const html = renderEmptyState();
    expect(html).toContain('No actions recorded yet');
    expect(html).toContain('Click "Record" to start capturing interactions');
  });

  it('renders a formatted step card with action badge and locators', () => {
    const step = createTestStep({
      stepNumber: 1,
      action: 'type',
      target: {
        tagName: 'input',
        locators: [
          { strategy: 'id', value: 'username', isUnique: true, matchCount: 1, score: 100 },
          { strategy: 'name', value: 'user', isUnique: true, matchCount: 1, score: 90 },
        ],
        selectedLocatorIndex: 0,
        text: '',
      },
      value: 'admin_test',
      waitCondition: 'visible',
    });

    const html = renderStepCard(step);

    expect(html).toContain('step-card');
    expect(html).toContain('TYPE');
    expect(html).toContain('&lt;input&gt;');
    expect(html).toContain('admin_test');
    expect(html).toContain('id: username');
    expect(html).toContain('delete-step-btn');
  });

  it('renders warning badge for non-unique or dynamic locators', () => {
    const step = createTestStep({
      stepNumber: 2,
      action: 'click',
      target: {
        tagName: 'button',
        locators: [
          {
            strategy: 'css',
            value: '.btn',
            isUnique: false,
            matchCount: 3,
            score: 30,
            warning: 'multiple_matches',
          },
        ],
        selectedLocatorIndex: 0,
      },
    });

    const html = renderStepCard(step);
    expect(html).toContain('warning-badge');
    expect(html).toContain('3 matches');
  });
});
