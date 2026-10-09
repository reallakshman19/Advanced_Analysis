/**
 * Toolbar, node-draft, and result panels for the LFEA workbench.
 *
 * Panels consume immutable state and retained evidence. They do not mutate the
 * package or calculate any engineering quantity.
 */
import {
  workbenchButton,
  workbenchElement,
  workbenchJsonBlock,
} from './workbench-dom.js';
import { lfeaResultTable } from './lfea-workbench-tables.js';
import { qualityEvidenceRows } from './lfea-quality-adapter.js';

const AUTHORITY_POLICY_LABELS = Object.freeze({
  AUTHORITATIVE_RAW_ELEMENT_OR_INTEGRATION_POINT_STRESS:
    'Raw element/integration-point stress is the qualified stress authority.',
  NON_AUTHORITATIVE_REVIEW_PROJECTION:
    'Projected nodal stress is a non-authoritative review projection.',
  NOT_GENERATED:
    'Projected stress was not generated for this run.',
  PROHIBITED:
    'Projected stress is prohibited for convergence evidence.',
});

const PREFLIGHT_STATUS_LABELS = Object.freeze({
  WITHIN_CAPACITY: 'Within declared capacity',
  EXPORT_LIKELY_TO_EXCEED_BYTE_CAPACITY: 'Capacity warning',
  BLOCKED_BY_DECLARED_CAPACITY: 'Capacity blocked',
});

const PROGRESS_STAGE_LABELS = Object.freeze({
  QUEUED: 'Queued for analysis',
  VALIDATE: 'Validating mesh package',
  PREFLIGHT: 'Checking declared capacity',
  ADAPT: 'Building qualified FEA model',
  SOLVE: 'Solving continuum model',
  PROJECT: 'Preparing review stress projection',
  REVIEW: 'Running engineering review',
  EXPORT: 'Preparing evidence export',
  COMPLETE: 'Analysis complete',
});

export function renderLfeaToolbar(root, state, modes, handlers) {
  const toolbar = workbenchElement(root, 'div', 'lfea-workbench__toolbar');
  const mock = workbenchButton(root, '[SIMULATED] Load Mock Data', handlers.onMock);
  mock.dataset.role = 'lfea-mock';
  mock.dataset.mockData = 'true';
  mock.title = 'Load sample demonstration mesh package';
  const fileLabel = workbenchElement(root, 'label', null, 'Import mesh package ');
  const file = workbenchElement(root, 'input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.dataset.role = 'lfea-import';
  file.addEventListener('change', () => handlers.onFile(file.files?.[0] ?? null));
  fileLabel.append(file);
  const run = workbenchButton(root, 'Validate, adapt & solve', handlers.onRun);
  run.dataset.role = 'lfea-run';
  run.disabled = !state.packageValue || state.status === 'RUNNING';
  if (run.disabled) {
    run.title = state.status === 'RUNNING'
      ? 'Analysis is currently running'
      : 'Requires an imported or sample mesh package';
  }
  const cancel = workbenchButton(root, 'Cancel run', handlers.onCancelRun);
  cancel.hidden = state.status !== 'RUNNING';
  const benchmark = workbenchButton(root, 'Run Benchmark', handlers.onBenchmark);
  benchmark.dataset.role = 'lfea-benchmark';
  // No handler means this instance's QA panels are composed elsewhere
  // (the LFEA pipeline shell's Verification drawer) -- hide the button
  // rather than leave a click that runs real work nowhere visible.
  benchmark.hidden = !handlers.onBenchmark;
  const exportDocument = workbenchButton(
    root,
    'Export mesh package',
    handlers.onExportDocument,
  );
  exportDocument.disabled = !state.packageValue;
  if (exportDocument.disabled) {
    exportDocument.title = 'Requires a loaded mesh package to export';
  }
  const exportEvidence = workbenchButton(
    root,
    'Export evidence bundle',
    handlers.onExportEvidence,
  );
  exportEvidence.dataset.role = 'lfea-export-evidence';
  exportEvidence.disabled = !isCurrentExecution(state)
    || state.execution?.evidenceExport?.status !== 'QUALIFIED_EXPORT';
  if (exportEvidence.disabled) {
    exportEvidence.title = 'Requires a completed qualified analysis run to export evidence';
  }
  const undo = workbenchButton(root, 'Undo', handlers.onUndo);
  undo.disabled = !state.past.length;
  if (undo.disabled) {
    undo.title = 'No actions available to undo';
  }
  const redo = workbenchButton(root, 'Redo', handlers.onRedo);
  redo.disabled = !state.future.length;
  if (redo.disabled) {
    redo.title = 'No actions available to redo';
  }
  const mode = resultModeSelect(root, state, modes, handlers);
  toolbar.append(
    mock,
    fileLabel,
    run,
    cancel,
    benchmark,
    exportDocument,
    exportEvidence,
    undo,
    redo,
    mode,
  );
  if (hasQualifiedDisplacements(state.execution)) {
    toolbar.append(deformationScaleInput(root, state, handlers));
  }
  if (state.progress) toolbar.append(progressOutput(root, state.progress));
  return toolbar;
}

export function renderLfeaAnalysisSettings(root, packageValue) {
  const wrapper = workbenchElement(root, 'div', 'lfea-workbench__analysis-settings');
  wrapper.dataset.role = 'lfea-analysis-settings';
  if (!packageValue) {
    wrapper.append(workbenchElement(
      root,
      'p',
      null,
      'No committed mesh package is loaded; analysis authority is not available.',
    ));
    return wrapper;
  }

  const profile = packageValue.analysisDefinition?.solverProfile ?? {};
  const units = profile.units ?? {};
  const elementFamilies = [...new Set((packageValue.elements ?? [])
    .map((row) => row?.elementType)
    .filter((value) => typeof value === 'string' && value))]
    .sort();
  const list = workbenchElement(root, 'dl', 'lfea-workbench__analysis-settings-list');
  appendSetting(root, list, 'Package', packageValue.packageIdentity);
  appendSetting(root, list, 'Units identity', packageValue.unitsIdentity);
  appendSetting(root, list, 'Coordinate system', packageValue.coordinateSystem);
  appendSetting(root, list, 'Element families', elementFamilies.join(', '));
  appendSetting(root, list, 'Formulation', packageValue.analysisDefinition?.formulation);
  appendSetting(root, list, 'Solver profile', profile.profileIdentity);
  appendSetting(root, list, 'Profile version', profile.profileVersion);
  appendSetting(root, list, 'Solver backend', profile.backendIdentity);
  appendSetting(root, list, 'Length unit', units.length);
  appendSetting(root, list, 'Force unit', units.force);
  appendSetting(root, list, 'Stress unit', units.stress);
  appendSetting(root, list, 'DOF order', Array.isArray(profile.dofOrder) ? profile.dofOrder.join(', ') : null);
  appendSetting(root, list, 'Constraint method', profile.constraintMethod);
  wrapper.append(list);
  return wrapper;
}

export function renderLfeaNodeDraftEditor(root, nodeDraft, handlers) {
  const form = workbenchElement(root, 'div', 'lfea-workbench__node-draft');
  if (!nodeDraft) {
    form.append(workbenchElement(
      root,
      'p',
      null,
      'Select or drag a node to preview coordinates before committing.',
    ));
    return form;
  }
  const x = coordinateInput(root, 'X', nodeDraft.x);
  const y = coordinateInput(root, 'Y', nodeDraft.y);
  const preview = () => handlers.onPreviewNode(
    nodeDraft.nodeId,
    Number(x.input.value),
    Number(y.input.value),
  );
  x.input.addEventListener('change', preview);
  y.input.addEventListener('change', preview);
  form.append(
    workbenchElement(root, 'strong', null, nodeDraft.nodeId),
    x.label,
    y.label,
    workbenchButton(root, `Apply ${nodeDraft.nodeId}`, handlers.onCommitNode),
    workbenchButton(root, 'Revert preview', handlers.onCancelNode),
  );
  return form;
}

export function renderLfeaResults(root, state) {
  const wrapper = workbenchElement(root, 'div', 'lfea-workbench__results');
  if (state.diagnostics?.length) {
    wrapper.append(diagnosticsBlock(root, state.diagnostics));
  }
  const execution = state.execution;
  if (!execution) {
    wrapper.append(workbenchElement(
      root,
      'p',
      null,
      'No solve has been run for this mesh package.',
    ));
    return wrapper;
  }
  wrapper.append(authorityPolicy(root, execution), preflight(root, execution));
  if (execution.result) {
    wrapper.append(
      lfeaResultTable(root, 'Displacements', execution.result.nodalDisplacements ?? []),
      lfeaResultTable(root, 'Reactions', execution.result.reactions ?? []),
      lfeaResultTable(root, 'Raw stress', rawStressRows(execution.result)),
      meshQualityAuthority(root, state.packageValue),
      lfeaResultTable(
        root,
        'Mesh quality evidence',
        qualityEvidenceRows(execution.result),
      ),
    );
  }
  if (execution.stressProjection) {
    wrapper.append(
      workbenchElement(
        root,
        'h3',
        null,
        'Projected stress — NON-AUTHORITATIVE REVIEW PROJECTION',
      ),
      lfeaResultTable(
        root,
        'Projected nodal stress',
        execution.stressProjection.nodalValues ?? [],
      ),
    );
  }
  wrapper.append(workbenchJsonBlock(
    root,
    reviewSummary(execution),
    'lfea-review-summary',
  ));
  return wrapper;
}

function resultModeSelect(root, state, modes, handlers) {
  const select = workbenchElement(root, 'select');
  select.dataset.role = 'lfea-result-mode';
  for (const value of modes) {
    const option = workbenchElement(root, 'option', null, value.replaceAll('_', ' '));
    option.value = value;
    option.selected = value === state.display.resultMode;
    option.disabled = value === 'DEFORMED'
      ? !hasQualifiedDisplacements(state.execution)
      : value === 'PROJECTED_STRESS' && !state.execution?.stressProjection;
    select.append(option);
  }
  select.addEventListener('change', () => handlers.onResultMode(select.value));
  return select;
}

function deformationScaleInput(root, state, handlers) {
  const displacementUnit = state.packageValue?.analysisDefinition?.solverProfile?.units?.length
    ?? 'not declared';
  const label = workbenchElement(
    root,
    'label',
    'lfea-workbench__deformation-scale',
    `Displayed displacement multiplier (${state.display.deformationScaleSource}; `
      + `dimensionless; 1× = true displacement; displacement unit ${displacementUnit}) `,
  );
  const input = workbenchElement(root, 'input');
  input.type = 'number';
  input.step = 'any';
  input.min = '0';
  input.value = String(state.display.deformationScale);
  input.dataset.role = 'lfea-deformation-scale';
  input.dataset.quantity = 'DIMENSIONLESS_DISPLAY_MULTIPLIER';
  input.title = `Display-only multiplier. Calculated displacement values remain in ${displacementUnit}.`;
  input.addEventListener('change', () => handlers.onDeformationScale(input.value));
  label.append(input);
  return label;
}

function progressOutput(root, progress) {
  const rawStage = typeof progress.stage === 'string' ? progress.stage : 'UNKNOWN';
  const output = workbenchElement(
    root,
    'output',
    'lfea-workbench__progress',
    `${progressStageLabel(rawStage)} — step ${progress.index}/${progress.total}`,
  );
  output.dataset.stage = rawStage;
  output.title = `Pipeline stage: ${rawStage}`;
  output.setAttribute('role', 'status');
  output.setAttribute('aria-live', 'polite');
  return output;
}

function coordinateInput(root, name, value) {
  const label = workbenchElement(root, 'label', null, `${name} `);
  const input = workbenchElement(root, 'input');
  input.type = 'number';
  input.step = 'any';
  input.value = String(value);
  input.setAttribute('aria-label', `${name} coordinate`);
  label.append(input);
  return { label, input };
}

function diagnosticsBlock(root, diagnostics) {
  const block = workbenchJsonBlock(root, diagnostics, 'lfea-diagnostics');
  const hasError = diagnostics.some((row) => row.severity === 'ERROR');
  block.setAttribute('role', hasError ? 'alert' : 'status');
  block.setAttribute('aria-live', hasError ? 'assertive' : 'polite');
  return block;
}

function authorityPolicy(root, execution) {
  const policy = execution.authorityPolicy ?? {};
  const rawCode = policy.rawStress ?? 'NOT_DECLARED';
  const projectedCode = policy.projectedStress ?? 'NOT_DECLARED';
  const convergenceCode = policy.projectedStressForConvergence ?? 'NOT_DECLARED';
  const value = workbenchElement(
    root,
    'p',
    'lfea-workbench__authority',
    `Raw stress: ${authorityPolicyLabel(rawCode)} `
      + `Projected stress: ${authorityPolicyLabel(projectedCode)} `
      + `Convergence use: ${authorityPolicyLabel(convergenceCode)}`,
  );
  value.dataset.rawStressPolicy = rawCode;
  value.dataset.projectedStressPolicy = projectedCode;
  value.dataset.projectedStressConvergencePolicy = convergenceCode;
  value.title = `Raw=${rawCode}; Projected=${projectedCode}; ProjectedForConvergence=${convergenceCode}`;
  return value;
}

function preflight(root, execution) {
  if (!execution.preflight) return workbenchElement(root, 'span');
  const status = execution.preflight.status;
  const value = workbenchElement(
    root,
    'p',
    'lfea-workbench__preflight',
    `Preflight ${preflightStatusLabel(status)} — `
      + `${execution.preflight.nodeCount} nodes, `
      + `${execution.preflight.elementCount} elements, `
      + `${execution.preflight.dofCount} DOF. `
      + execution.preflight.advice,
  );
  value.dataset.role = 'lfea-preflight';
  value.dataset.status = status;
  value.title = `Preflight status: ${status}`;
  return value;
}

function meshQualityAuthority(root, packageValue) {
  const tolerance = packageValue?.analysisDefinition?.solverProfile?.tolerances?.geometryArea;
  const toleranceText = Number.isFinite(tolerance) ? String(tolerance) : 'not declared';
  const value = workbenchElement(
    root,
    'p',
    'lfea-workbench__preflight',
    `Geometry validity was qualified upstream using solverProfile.tolerances.geometryArea = ${toleranceText}. `
      + 'This panel adds no separate acceptance threshold to the displayed Jacobian ratio, edge-length ratio, or corner-cosine metrics; signed-area/Jacobian validity remains governed by upstream model qualification.',
  );
  value.dataset.role = 'lfea-quality-authority';
  value.dataset.geometryTolerance = toleranceText;
  value.title = 'Geometry gate source: analysisDefinition.solverProfile.tolerances.geometryArea';
  return value;
}

function appendSetting(root, list, label, value) {
  list.append(
    workbenchElement(root, 'dt', null, label),
    workbenchElement(root, 'dd', null, displaySetting(value)),
  );
}

function displaySetting(value) {
  if (typeof value === 'string' && value.trim()) return value;
  if (Number.isFinite(value)) return String(value);
  return 'Not declared';
}

function authorityPolicyLabel(code) {
  return AUTHORITY_POLICY_LABELS[code] ?? 'Policy not recognized in this UI.';
}

function preflightStatusLabel(status) {
  return PREFLIGHT_STATUS_LABELS[status] ?? 'Preflight status not recognized';
}

function progressStageLabel(stage) {
  return PROGRESS_STAGE_LABELS[stage] ?? stage;
}

function rawStressRows(result) {
  return Array.isArray(result.integrationPointResults)
    ? result.integrationPointResults
    : result.elementStresses ?? [];
}

function reviewSummary(execution) {
  return {
    pipelineStatus: execution.status,
    failedStage: execution.failedStage,
    solverStatus: execution.result?.status ?? null,
    reviewStatus: execution.review?.status ?? null,
    evidenceExportStatus: execution.evidenceExport?.status ?? null,
    authorityPolicy: execution.authorityPolicy,
    equilibriumTotals: execution.result?.equilibriumTotals ?? null,
    energyConsistency: execution.result?.energyConsistency ?? null,
  };
}

function hasQualifiedDisplacements(execution) {
  return execution?.result?.status === 'QUALIFIED'
    && Array.isArray(execution.result.nodalDisplacements)
    && execution.result.nodalDisplacements.length > 0;
}

function isCurrentExecution(state) {
  return Boolean(state.execution)
    && state.execution.inputSemanticHash === state.packageValue?.semanticHash
    && state.execution.inputModelVersion === state.modelVersion;
}
