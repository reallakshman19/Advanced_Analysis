export const TOPOLOGY_EDIT_PIPE_GEOMETRY_OPERATIONS = Object.freeze([
  ['EXTEND_EDGE', 'Extend open edge'],
  ['SHORTEN_EDGE', 'Shorten open edge'],
  ['SPLIT_EDGE_FROM_DISTANCE', 'Split edge by distance'],
  ['MOVE_CONNECTED_RUN', 'Move connected run'],
  ['CREATE_ORTHOGONAL_OFFSET', 'Create orthogonal offset'],
  ['APPLY_DECLARED_SLOPE', 'Apply declared slope'],
]);

export const TOPOLOGY_EDIT_CONTEXTUAL_OPERATION_MIGRATIONS = Object.freeze({
  INSERT_INLINE_COMPONENT: Object.freeze({
    label: 'Insert inline component',
    destination: 'Place component',
    guidance: 'Use Place component for flange, reducer, valve assembly, branch, or blind-flange placement.',
  }),
  RECONNECT_ENDPOINTS: Object.freeze({
    label: 'Reconnect open endpoints',
    destination: 'Connect ends',
    guidance: 'Use Connect ends to select two graph-open endpoints in the viewport and qualify the route.',
  }),
});

const PIPE_GEOMETRY_OPERATION_IDS = new Set(
  TOPOLOGY_EDIT_PIPE_GEOMETRY_OPERATIONS.map(([id]) => id),
);

export function topologyEditProfessionalOperationUiDisposition(operationType) {
  const normalized = String(operationType || 'EXTEND_EDGE').trim().toUpperCase();
  const migration = TOPOLOGY_EDIT_CONTEXTUAL_OPERATION_MIGRATIONS[normalized] ?? null;
  return Object.freeze({
    operationType: normalized,
    selectable: PIPE_GEOMETRY_OPERATION_IDS.has(normalized),
    migration,
  });
}

export function renderTopologyEditProfessionalOperationPanel(element, state = {}) {
  if (!element) throw new TypeError('TopologyEditProfessionalOperationPanel: element is required.');
  syncPipeGeometryShell(element);
  const values = state.values ?? {};
  const plan = state.plan;
  const candidate = state.candidate;
  const validation = state.validation;
  const transaction = state.transaction;
  const capability = state.capability;
  const disposition = topologyEditProfessionalOperationUiDisposition(values.operationType);
  const operationOptions = renderOperationOptions(state, disposition);
  const unresolved = plan?.unresolvedEvidence?.map((row) => row.code).join(', ') || '';
  const blocking = Number(state.blockingIssueCount ?? 0);
  const planBlocked = !disposition.selectable
    || ['BLOCKED', 'UNREPRESENTABLE'].includes(capability?.status);

  element.innerHTML = `
    <header class="topology-edit-professional-operation__header">
      <div>
        <strong>Pipe geometry</strong>
        <p>Advanced pipe-shape operations remain here. Component placement and endpoint connection use their contextual authoring workflows.</p>
      </div>
      <output aria-live="polite">${html(state.error || state.message || 'Ready.')}</output>
    </header>
    ${contextualMigrationCallout(disposition)}
    ${componentHud(
      state.componentContext,
      state.catalogue?.records ?? [],
      values.catalogueRecordId,
    )}
    ${capabilityCallout(capability)}
    <div class="topology-edit-professional-operation__grid">
      ${field('Operation', select('professional-operation-type', operationOptions))}
      ${field('Selected target', `<output data-role="professional-human-target">${html(humanTarget(state.componentContext))}</output>`)}
      ${field('Endpoint', select('professional-endpoint', options(['FROM', 'TO'], values.endpoint ?? 'TO')))}
      ${field('Distance (mm)', input('professional-distance-mm', values.distanceMm ?? 100, 'number'))}
      ${field('Diameter (mm)', input('professional-diameter-mm', values.diameterMm ?? 100, 'number'))}
      ${field('Entity type', input('professional-entity-type', values.entityType ?? 'PIPE'))}
      ${field('Delta X (mm)', input('professional-delta-x', values.deltaX ?? 0, 'number'))}
      ${field('Delta Y (mm)', input('professional-delta-y', values.deltaY ?? 0, 'number'))}
      ${field('Delta Z (mm)', input('professional-delta-z', values.deltaZ ?? 0, 'number'))}
      ${field('Slope rise (mm)', input('professional-rise-mm', values.riseMm ?? 1, 'number'))}
      ${field('Slope run (mm)', input('professional-run-mm', values.runMm ?? 100, 'number'))}
      ${field('Slope direction', select('professional-direction', options(['ASCENDING', 'DESCENDING'], values.direction ?? 'ASCENDING')))}
    </div>
    <details class="topology-edit-professional-operation__advanced" data-role="professional-canonical-evidence">
      <summary>Advanced canonical evidence / fallback</summary>
      <p>Normal workflows should select visible engineering targets. These exact IDs remain secondary fallback and custody evidence.</p>
      <div class="topology-edit-professional-operation__grid">
        ${field('Edge ID', input('professional-edge-id', values.edgeId))}
        ${field('Node IDs', input('professional-node-ids', values.nodeIds, 'text', 'exact canonical node IDs'))}
        ${field('Boundary node IDs', input('professional-boundary-node-ids', values.boundaryNodeIds, 'text', 'exact canonical boundary nodes'))}
        ${field('From node ID', input('professional-from-node-id', values.fromNodeId))}
        ${field('Corner node ID', input('professional-corner-node-id', values.cornerNodeId))}
        ${field('To node ID', input('professional-to-node-id', values.toNodeId))}
        ${field('Ordered slope node IDs', input('professional-ordered-node-ids', values.orderedNodeIds, 'text', 'exact ordered canonical nodes'))}
      </div>
    </details>
    <div class="topology-edit-professional-operation__actions" role="toolbar" aria-label="Pipe geometry operation actions">
      <button type="button" data-action="plan-professional-operation"${planBlocked ? ' disabled' : ''}>Plan</button>
      <button type="button" data-action="validate-professional-operation"${candidate && !unresolved && !state.validationPending ? '' : ' disabled'}>Validate candidate</button>
      <button type="button" data-action="cancel-professional-validation"${state.validationPending ? '' : ' disabled'}>Cancel validation</button>
      <button type="button" data-action="apply-professional-operation"${validation && !blocking && state.transactionPreview ? '' : ' disabled'}>Apply atomically</button>
      <button type="button" data-action="clear-professional-operation"${plan || validation ? '' : ' disabled'}>Clear</button>
      <button type="button" data-action="undo-professional-operation"${state.canUndoTransaction ? '' : ' disabled'}>Undo operation</button>
      <button type="button" data-action="redo-professional-operation"${state.canRedoTransaction ? '' : ' disabled'}>Redo operation</button>
    </div>
    <dl class="topology-edit-professional-operation__evidence">
      <div><dt>Capability</dt><dd>${html(capability?.status ?? 'unavailable')}</dd></div>
      <div><dt>Capability reason</dt><dd>${html(capability?.reasonCode ?? 'none')}</dd></div>
      <div><dt>Capability receipt</dt><dd>${html(capability?.capabilityHash ?? 'none')}</dd></div>
      <div><dt>Catalogue</dt><dd>${html(state.catalogue?.catalogueHash ?? 'unavailable')}</dd></div>
      <div><dt>Component context</dt><dd>${html(state.componentContext?.contextHash ?? 'none')}</dd></div>
      <div><dt>Plan</dt><dd>${html(plan?.planHash ?? plan?.resultHash ?? 'none')}</dd></div>
      <div><dt>Unresolved</dt><dd>${html(unresolved || 'none')}</dd></div>
      <div><dt>Certified candidate</dt><dd>${html(candidate?.candidateHash ?? 'none')}</dd></div>
      <div><dt>Candidate topology</dt><dd>${html(candidate?.resultingCanonicalHash ?? 'none')}</dd></div>
      <div><dt>Validation</dt><dd>${html(validation?.validationHash ?? (state.validationPending ? 'running' : 'none'))}</dd></div>
      <div><dt>Validation status</dt><dd>${html(validation?.status ?? 'none')}</dd></div>
      <div><dt>In-scope blocking findings</dt><dd>${blocking}</dd></div>
      <div><dt>Transaction preview</dt><dd>${html(state.transactionPreview?.previewHash ?? 'none')}</dd></div>
      <div><dt>Transaction</dt><dd>${html(transaction?.transactionHash ?? 'none')}</dd></div>
    </dl>`;
}

export function readTopologyEditProfessionalOperationValues(element) {
  const value = (role) => element?.querySelector(`[data-role="${role}"]`)?.value ?? '';
  return Object.freeze({
    operationType: value('professional-operation-type'),
    edgeId: value('professional-edge-id'),
    endpoint: value('professional-endpoint'),
    distanceMm: value('professional-distance-mm'),
    centerDistanceMm: value('professional-center-distance-mm'),
    insertionLengthMm: value('professional-insertion-length-mm'),
    inlineDirection: value('professional-inline-direction'),
    nodeIds: value('professional-node-ids'),
    boundaryNodeIds: value('professional-boundary-node-ids'),
    fromNodeId: value('professional-from-node-id'),
    cornerNodeId: value('professional-corner-node-id'),
    toNodeId: value('professional-to-node-id'),
    diameterMm: value('professional-diameter-mm'),
    entityType: value('professional-entity-type'),
    deltaX: value('professional-delta-x'),
    deltaY: value('professional-delta-y'),
    deltaZ: value('professional-delta-z'),
    orderedNodeIds: value('professional-ordered-node-ids'),
    riseMm: value('professional-rise-mm'),
    runMm: value('professional-run-mm'),
    direction: value('professional-direction'),
    catalogueRecordId: value('professional-catalogue-record'),
  });
}

function syncPipeGeometryShell(element) {
  element?.setAttribute?.('aria-label', 'Advanced pipe geometry operation');
  const wrapper = element?.closest?.('details[data-panel-kind="topology-edit-professional-operation"]');
  const summary = wrapper?.querySelector?.(':scope > summary');
  if (summary) summary.textContent = 'Pipe geometry';
}

function renderOperationOptions(state, disposition) {
  const migrated = disposition.migration
    ? `<option value="${attr(disposition.operationType)}" selected disabled>${html(`${disposition.migration.label} — moved to ${disposition.migration.destination}`)}</option>`
    : !disposition.selectable
      ? `<option value="${attr(disposition.operationType)}" selected disabled>${html(`${disposition.operationType || 'Unknown operation'} — unavailable in Pipe geometry`)}</option>`
      : '';
  const normal = TOPOLOGY_EDIT_PIPE_GEOMETRY_OPERATIONS.map(([value, label]) => {
    const optionCapability = state.operationCapabilities?.[value];
    const suffix = optionCapability ? ` — ${optionCapability.status}` : '';
    return `<option value="${value}" data-capability-status="${attr(optionCapability?.status)}"${value === disposition.operationType ? ' selected' : ''}>${html(label + suffix)}</option>`;
  }).join('');
  return migrated + normal;
}

function contextualMigrationCallout(disposition) {
  if (!disposition.migration) return '';
  return `<section class="topology-edit-professional-operation__capability" data-role="professional-contextual-migration" data-operation-type="${attr(disposition.operationType)}" aria-live="polite">
    <strong>${html(`Moved to ${disposition.migration.destination}`)}</strong>
    <span>${html(disposition.migration.guidance)} Choose a Pipe geometry operation here to leave the retired saved view state.</span>
  </section>`;
}

function capabilityCallout(capability) {
  if (!capability) return '';
  return `<section class="topology-edit-professional-operation__capability" data-role="topology-edit-professional-capability" data-capability-status="${attr(capability.status)}" data-capability-reason="${attr(capability.reasonCode)}" aria-live="polite">
    <strong>${html(capability.status)}</strong>
    <span>${html(capability.reason)}</span>
  </section>`;
}

function componentHud(context, catalogueRecords, selectedRecordId) {
  if (!context || context.status === 'NO_SELECTION') return '';
  const fields = (context.fieldSchema ?? []).map((row) => `
    <div data-field-key="${attr(row.key)}">
      <dt>${html(row.label)}</dt>
      <dd>${html(formatFieldValue(row.value, row.unit))}<small>${html(row.source)}</small></dd>
    </div>`).join('');
  const diagnostic = context.diagnostics?.[0]?.message ?? '';
  const candidates = componentCatalogueRecords(catalogueRecords, context);
  const catalogueOptions = candidates.map((record) => (
    `<option value="${attr(record.recordId)}"${record.recordId === selectedRecordId ? ' selected' : ''}>${html(catalogueRecordLabel(record))}</option>`
  )).join('');
  return `
    <section class="topology-edit-component-hud" data-role="topology-edit-component-hud" data-component-type="${attr(context.componentType)}" data-context-status="${attr(context.status)}" aria-label="Selected component engineering context">
      <header>
        <div><strong>${html(context.workspaceEntityId || context.componentType)}</strong><span>${html(context.componentType)}</span></div>
        <output>${html(context.status)}</output>
      </header>
      <p>${html(diagnostic)}</p>
      <dl>${fields}</dl>
      <label><span>Governed catalogue candidates</span><select data-role="professional-catalogue-record" disabled aria-readonly="true"><option value="">${candidates.length ? 'No exact record selected' : 'No exact record for current context'}</option>${catalogueOptions}</select></label>
      <small>${context.candidateRecordIds.length} governed catalogue candidate(s)</small>
      <details><summary>Canonical custody evidence</summary><code>${html(context.selectedCanonicalId)}</code></details>
    </section>`;
}

function componentCatalogueRecords(records, context) {
  const ids = new Set(context?.candidateRecordIds ?? []);
  return records.filter((record) => ids.has(record.recordId));
}

function catalogueRecordLabel(record) {
  const details = {
    FLANGE: [record.flangeClass, record.flangeFacing],
    VALVE: [record.valveType, `${record.valveFaceToFaceMm} mm F2F`],
    REDUCER: [
      `${record.nominalSizeMm}→${record.secondaryNominalSizeMm} mm`,
      record.reducerOrientation,
    ],
  }[record.componentType] ?? [record.componentType];
  return [record.recordId, ...details.filter(Boolean)].join(' · ');
}

function humanTarget(context) {
  if (context?.workspaceEntityId) return `${context.workspaceEntityId} · ${context.componentType || 'component'}`;
  return 'Select a visible edge, endpoint, or run in the viewport/Object Tree.';
}

function formatFieldValue(value, unit) {
  if (value === null || value === undefined || value === '') return 'Unresolved';
  return unit ? `${value} ${unit}` : String(value);
}

function field(label, control) {
  return `<label><span>${html(label)}</span>${control}</label>`;
}
function input(role, value = '', type = 'text', placeholder = '') {
  return `<input data-role="${role}" type="${type}" value="${attr(value)}"${placeholder ? ` placeholder="${attr(placeholder)}"` : ''}>`;
}
function select(role, optionMarkup) {
  return `<select data-role="${role}">${optionMarkup}</select>`;
}
function options(values, selected) {
  return values.map((value) => `<option value="${attr(value)}"${value === selected ? ' selected' : ''}>${html(value)}</option>`).join('');
}
function html(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
function attr(value) { return html(value); }
