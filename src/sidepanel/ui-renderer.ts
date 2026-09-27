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
      const uniqueFlag = loc.isUnique
        ? '✓ (1)'
        : loc.matchCount === 0
        ? '✖ (0)'
        : `⚠ (${loc.matchCount})`;
      return `<option value="${idx}" ${isSelected}>${loc.strategy}: ${escapeHtml(loc.value)} ${uniqueFlag}</option>`;
    })
    .join('');

  // Status/Warning badge
  let statusBadge = '';
  if (currentLocator) {
    if (currentLocator.isUnique) {
      statusBadge = `<span class="badge-match match-unique" title="1 unique match in DOM">✓ 1 match</span>`;
    } else if (currentLocator.matchCount === 0) {
      statusBadge = `<span class="warning-badge badge-match match-none" title="No elements found with this locator">✖ 0 matches</span>`;
    } else {
      statusBadge = `<span class="warning-badge badge-match match-multiple" title="Multiple elements match this locator in DOM">⚠ ${currentLocator.matchCount} matches</span>`;
    }
  }

  if (currentLocator?.warning === 'dynamic_id') {
    statusBadge += ` <span class="warning-badge warning-dynamic" title="Potentially unstable dynamic ID">⚠ dynamic id</span>`;
  }

  if (step.target.isShadowDom || currentLocator?.isShadowDom) {
    const host = step.target.shadowHostSelector || currentLocator?.shadowHostSelector || 'shadow-root';
    statusBadge += ` <span class="badge-shadow" title="Element lives inside Shadow Root (<${escapeHtml(host)}>)">⚡ SHADOW (${escapeHtml(host)})</span>`;
  }

  const currentLocatorVal = currentLocator ? escapeHtml(currentLocator.value) : '';

  return `
    <div class="step-card" data-step-id="${step.id}">
      <div class="step-header">
        <span class="step-number">#${step.stepNumber}</span>
        <span class="step-badge ${actionClass}">${step.action.toUpperCase()}</span>
        <span class="step-tag">${tagName}</span>
        ${statusBadge}
        <button class="delete-step-btn" data-step-id="${step.id}" title="Remove Step">×</button>
      </div>

      ${valueDisplay ? `<div class="step-details">${valueDisplay}</div>` : ''}

      <div class="step-locator-row">
        <div class="locator-header-row">
          <label class="locator-label">LOCATOR</label>
          <button class="btn-copy-locator" data-copy="${currentLocatorVal}" title="Copy Locator Value">
            <span>📋 Copy</span>
          </button>
        </div>
        <select class="locator-select" data-step-id="${step.id}" title="${currentLocatorVal}">
          ${locatorOptions}
        </select>
      </div>
    </div>
  `;
}
