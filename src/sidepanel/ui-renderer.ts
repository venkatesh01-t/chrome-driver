import { TestStep } from '../types/model';

export function renderEmptyState(): string {
  return `
    <div class="empty-state">
      <div class="empty-icon">🔴</div>
      <div class="empty-title">No actions recorded yet</div>
      <div class="empty-desc">Click "Record" to start capturing interactions on the active webpage.</div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderStepCard(step: TestStep): string {
  const selectedIndex = step.target.selectedLocatorIndex ?? 0;
  const currentLocator = step.target.locators[selectedIndex] || step.target.locators[0];

  const actionClass = `badge-${step.action}`;
  const tagName = escapeHtml(`<${step.target.tagName}>`);
  const valueDisplay = step.value ? `<span class="step-value">"${escapeHtml(step.value)}"</span>` : '';

  // Options for locator switcher dropdown
  const locatorOptions = step.target.locators
    .map((loc, idx) => {
      const isSelected = idx === selectedIndex ? 'selected' : '';
      const uniqueFlag = loc.isUnique ? '✓' : `⚠ (${loc.matchCount})`;
      return `<option value="${idx}" ${isSelected}>${loc.strategy}: ${escapeHtml(loc.value)} ${uniqueFlag}</option>`;
    })
    .join('');

  // Warning badge
  let warningBadge = '';
  if (currentLocator && !currentLocator.isUnique) {
    warningBadge = `<span class="warning-badge" title="This locator is ambiguous in the DOM">⚠ ${currentLocator.matchCount} matches</span>`;
  } else if (currentLocator?.warning === 'dynamic_id') {
    warningBadge = `<span class="warning-badge warning-dynamic" title="Potentially unstable dynamic ID">⚠ dynamic id</span>`;
  }

  return `
    <div class="step-card" data-step-id="${step.id}">
      <div class="step-header">
        <span class="step-number">#${step.stepNumber}</span>
        <span class="step-badge ${actionClass}">${step.action.toUpperCase()}</span>
        <span class="step-tag">${tagName}</span>
        ${warningBadge}
        <button class="delete-step-btn" data-step-id="${step.id}" title="Remove Step">×</button>
      </div>

      ${valueDisplay ? `<div class="step-details">${valueDisplay}</div>` : ''}

      <div class="step-locator-row">
        <label class="locator-label">Locator:</label>
        <select class="locator-select" data-step-id="${step.id}">
          ${locatorOptions}
        </select>
      </div>
    </div>
  `;
}
