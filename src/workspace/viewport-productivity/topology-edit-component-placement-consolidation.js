export const TOPOLOGY_EDIT_COMPONENT_PLACEMENT_TOOLS = Object.freeze([
  'VALVE_ASSEMBLY',
  'FLANGE',
  'REDUCER',
  'BRANCH',
  'BLIND_FLANGE',
]);

const COMPONENT_ACTIONS = Object.freeze([
  'activate-authoring-valve-assembly',
  'activate-authoring-flange',
  'activate-authoring-reducer',
  'activate-authoring-branch',
  'activate-authoring-blind-flange',
]);

const TOOL_LABELS = Object.freeze({
  VALVE_ASSEMBLY: 'Valve assembly',
  FLANGE: 'Flange',
  REDUCER: 'Reducer',
  BRANCH: 'Tee / Olet branch',
  BLIND_FLANGE: 'Blind flange',
});

export function componentPlacementWorkflowActive(runtime) {
  return TOPOLOGY_EDIT_COMPONENT_PLACEMENT_TOOLS.includes(runtime?.state?.tool);
}

export function componentPlacementTargetReady(runtime) {
  return componentPlacementWorkflowActive(runtime)
    && Boolean(runtime?.state?.target)
    && Boolean(runtime?.catalogue?.());
}

export function renderComponentPlacementConsolidation(runtime) {
  const hud = runtime.element?.querySelector('.topology-edit-authoring-hud');
  if (!hud) return;
  groupComponentFamilyActions(hud, runtime.state?.tool);
  if (!componentPlacementWorkflowActive(runtime)) return;
  renderPlacementTarget(hud, runtime.state.tool);
  consolidatePlacementActions(hud, runtime.state.tool);
}

function groupComponentFamilyActions(hud, activeTool) {
  const tools = hud.querySelector('.topology-edit-authoring-hud__tools');
  if (!tools) return;
  let details = tools.querySelector('[data-role="component-placement-family-picker"]');
  if (!details) {
    details = hud.ownerDocument.createElement('details');
    details.dataset.role = 'component-placement-family-picker';
    details.className = 'topology-edit-authoring-hud__details';
    const summary = hud.ownerDocument.createElement('summary');
    summary.dataset.role = 'component-placement-family-summary';
    details.append(summary);
    tools.append(details);
  }
  const summary = details.querySelector('[data-role="component-placement-family-summary"]');
  const activeLabel = TOOL_LABELS[activeTool];
  if (summary) summary.textContent = activeLabel
    ? `Place component · ${activeLabel}`
    : 'Place component';
  details.open = false;
  for (const action of COMPONENT_ACTIONS) {
    const button = tools.querySelector(`[data-action="${action}"]`);
    if (button && button.parentElement !== details) details.append(button);
  }
}

function renderPlacementTarget(hud, tool) {
  const target = hud.querySelector('.topology-edit-authoring-hud__target');
  if (!target) return;
  const label = TOOL_LABELS[tool] ?? 'Component';
  const guidance = tool === 'BLIND_FLANGE'
    ? 'Select one graph-open pipe endpoint, choose an exact catalogue record, inspect the governed ghost, then apply.'
    : 'Select one compatible straight pipe edge, choose exact placement and catalogue evidence, inspect the governed ghost, then apply.';
  let span = target.querySelector('span');
  if (!span) {
    span = target.ownerDocument.createElement('span');
    target.append(span);
  }
  span.textContent = guidance;
  const strong = target.querySelector('strong');
  if (strong) strong.textContent = `PLACE ${label.toUpperCase()}`;
}

function consolidatePlacementActions(hud, tool) {
  hud.querySelector('[data-role="component-placement-engineering-evidence"]')?.remove();
  const actions = hud.querySelector('.topology-edit-authoring-hud__actions');
  const evidence = hud.querySelector('.topology-edit-authoring-hud__evidence');
  if (!actions) return;
  const apply = actions.querySelector('[data-action="apply-authoring-operation"]');
  const cancel = actions.querySelector('[data-action="cancel-authoring-operation"]');
  if (apply) apply.textContent = applyLabel(tool);
  if (cancel) cancel.textContent = 'Cancel';

  const details = hud.ownerDocument.createElement('details');
  details.dataset.role = 'component-placement-engineering-evidence';
  details.className = 'topology-edit-authoring-hud__details';
  const summary = hud.ownerDocument.createElement('summary');
  summary.textContent = 'Engineering evidence';
  details.append(summary);

  const recovery = hud.ownerDocument.createElement('div');
  recovery.className = 'topology-edit-authoring-hud__recovery-actions';
  for (const action of ['preview-authoring-operation', 'validate-authoring-operation']) {
    const button = actions.querySelector(`[data-action="${action}"]`);
    if (button) recovery.append(button);
  }
  if (recovery.children.length) details.append(recovery);
  if (evidence) details.append(evidence);
  actions.after(details);
}

function applyLabel(tool) {
  if (tool === 'VALVE_ASSEMBLY') return 'Apply valve assembly';
  if (tool === 'BRANCH') return 'Apply branch';
  if (tool === 'BLIND_FLANGE') return 'Apply blind flange';
  return `Apply ${String(TOOL_LABELS[tool] ?? 'component').toLowerCase()}`;
}
