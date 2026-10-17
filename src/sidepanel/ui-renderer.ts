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
  const currentLocatorStrategy = currentLocator ? currentLocator.strategy : 'css';
  const isAssertion = step.action.startsWith('assert');
  const isPrint = step.action === 'print_value';
  const isTabSwitch = step.action === 'switch_tab';

  const actionOptions = [
    { value: 'click', label: '👆 Click' },
    { value: 'type', label: '⌨️ Type' },
    { value: 'hover', label: '🎯 Hover' },
    { value: 'assert_visible', label: '👁️ Assert Visible' },
    { value: 'assert_text', label: '🔤 Assert Text' },
    { value: 'print_value', label: '🖨️ Print Value' },
  ];

  const actionSelector = !isTabSwitch
    ? `
      <select class="step-action-select" data-step-id="${step.id}" title="Click to customize step action">
        ${actionOptions
          .map(
            (opt) =>
              `<option value="${opt.value}" ${step.action === opt.value ? 'selected' : ''}>${opt.label}</option>`
          )
          .join('')}
      </select>
    `
    : `<span class="step-badge badge-switch_tab">🗂️ TAB</span>`;

  const isType = step.action === 'type';

  return `
    <div class="step-card${isAssertion ? ' assertion' : ''}${isPrint ? ' print-value' : ''}${isTabSwitch ? ' tab-switch' : ''}" data-step-id="${step.id}">
      <div class="step-header">
        <span class="step-number">#${step.stepNumber}</span>
        ${step.target.componentType ? `<span class="badge-component ${step.target.componentType}">${step.target.componentType}</span>` : ''}
        ${actionSelector}
        <span class="step-tag">${tagName}</span>
        ${statusBadge}
        <div class="step-controls">
          <button class="reorder-step-btn btn-up" data-step-id="${step.id}" data-dir="up" title="Move Step Up">▲</button>
          <button class="reorder-step-btn btn-down" data-step-id="${step.id}" data-dir="down" title="Move Step Down">▼</button>
          <button class="delete-step-btn" data-step-id="${step.id}" title="Remove Step">×</button>
        </div>
      </div>

      ${step.target.componentHierarchy ? `<div class="step-hierarchy">${escapeHtml(step.target.componentHierarchy)}</div>` : ''}
      ${isTabSwitch ? `<div class="step-details"><span class="tab-switch-details">🗂️ SWITCH TAB: index ${step.tabIndex ?? -1} ${step.tabTitle ? `(${escapeHtml(step.tabTitle)})` : ''}</span></div>` : ''}
      ${isType ? `<div class="step-details"><span class="step-label">INPUT:</span> <input class="step-edit-input" data-step-id="${step.id}" data-field="value" value="${escapeHtml(step.value || '')}" placeholder="Text to type..."></div>` : ''}
      ${valueDisplay && !isPrint && !isTabSwitch && !isType ? `<div class="step-details">${valueDisplay}</div>` : ''}
      ${isPrint ? `<div class="step-details"><span class="print-label">🖨️ EXTRACT:</span> ${step.value ? `"${escapeHtml(step.value)}"` : '(runtime value)'}</div>` : ''}
      ${step.action === 'assert_text' ? `<div class="step-details"><span class="assert-label">EXPECT:</span> <input class="step-edit-input" data-step-id="${step.id}" data-field="assertExpected" value="${escapeHtml(step.assertExpected || '')}" placeholder="Expected text in element..."></div>` : (step.assertExpected ? `<div class="step-details"><span class="assert-label">EXPECT:</span> "${escapeHtml(step.assertExpected)}"</div>` : '')}
      ${step.keyCombo ? `<div class="step-details"><span class="step-value">Key: ${escapeHtml(step.keyCombo)}</span></div>` : ''}
      ${step.waitDuration ? `<div class="step-details"><span class="step-value">Duration: ${step.waitDuration}s</span></div>` : ''}

      ${step.target.locators && step.target.locators.length > 0 ? `
      <div class="step-locator-row">
        <div class="locator-header-row">
          <label class="locator-label">LOCATOR</label>
          <div class="locator-actions">
            <button class="btn-test-locator" data-step-id="${step.id}" data-strategy="${currentLocatorStrategy}" data-val="${currentLocatorVal}" title="Test & Highlight locator on live tab">
              <span>⚡ Test</span>
            </button>
            <button class="btn-copy-locator" data-copy="${currentLocatorVal}" title="Copy Locator Value">
              <span>📋 Copy</span>
            </button>
          </div>
        </div>
        <select class="locator-select" data-step-id="${step.id}" title="${currentLocatorVal}">
          ${locatorOptions}
        </select>
      </div>` : ''}
    </div>
  `;
}
