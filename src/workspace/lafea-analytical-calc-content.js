/** EMP.1 analytical presentation over retained LAFEA.1/LAFEA.2 calculators. */
import { actionButton, card, element } from './lafea-workbench-dom.js';
import { renderDocumentTableEditor } from './lafea-document-table.js';
import { renderLafeaAnalysisSettings } from './lafea-analysis-settings-view.js';
import { renderLafeaEvidence } from './lafea-results-view.js';
import { renderLafeaLifecyclePanel } from './lafea-lifecycle-panel.js';
import { renderLafeaCorrelationAvailability } from './lafea-correlation-availability-view.js';
import {
  renderEmp1BoundedCorrelationEvidence,
  renderEmp1CorrelationResultEvidence,
  renderEmp1StageEngineeringEvidence,
} from './emp1-engineering-evidence-view.js';
import {
  renderEmp1WorkbenchExecutionSummary,
  renderEmp1WorkbenchRunConfiguration,
} from './emp1-workbench-run-view.js';
import { createEmp1BSourceCustodyCard } from './lafea-guided-workflow-view.js';
import { projectEmp1BenchmarkEvidenceWorkspace } from './emp1-benchmark-evidence-workspace.js';
import { renderEmp1BenchmarkEvidencePanel } from './emp1-benchmark-view.js';
import { renderEmp1ProfessionalWorkflow } from './emp1-professional-workflow-view.js';
import { composeEmp1AnalyticalLayout } from './emp1-analytical-layout.js';
import { lafeaDocumentDigest } from './lafea-edit-command.js';
import {
  projectLafea1PressureRadiusRefit,
  projectLafea1PressureRadiusValidation,
} from './lafea-1-pressure-radius-validation.js';
import {
  EMP1_B_SOURCE_CUSTODY_STATES,
  EMP1_PUBLIC_PRODUCT,
  buildEmp1ProductProjection,
  emp1StepForBackingStage,
  evaluateEmp1BSourceRefresh,
  isEmp1BackingStage,
} from './emp1-product-projection.js';
import {
  PRESSURE_THRUST_BASIS_OPTIONS,
  pressureThrustCaseView,
  unresolvedEmp1BPressureThrustCases,
} from './lafea-pressure-thrust-custody-view-model.js';
import {
  applyLafeaScreeningPressureThrustBasisCommand,
  createLafeaScreeningPressureThrustBasisCommand,
} from './lafea-screening-pressure-thrust-edit.js';
import {
  applyLafeaScreeningTermFactorCommand,
  createLafeaScreeningTermFactorCommand,
} from './lafea-screening-term-edit.js';

export function renderLafeaAnalyticalCalcContent(root, state, stage, options) {
  const stageId = stage?.stageId;
  if (!isEmp1BackingStage(stageId)) throw new TypeError(`EMP1_BACKING_ROUTE_UNSUPPORTED:${stageId}`);
  const foundation = stageId === 'LAFEA.1';
  const step = emp1StepForBackingStage(stageId);
  const projection = options.emp1Projection ?? buildEmp1ProductProjection(state);
  const inputCurrentProductExecution = options.emp1ExecutionCurrentness?.inputCurrent === true
    ? options.emp1Execution
    : null;
  const productStageExecution = foundation
    ? inputCurrentProductExecution?.stageExecutions?.loadTransfer
    : inputCurrentProductExecution?.stageExecutions?.sectionScreening;
  const productionLocalCorrelation = options.emp1CState?.reportableResult ?? null;
  const presentedStage = productStageExecution
    ? {
      ...stage,
      document: productStageExecution.source ?? stage.document,
      execution: productStageExecution,
    }
    : stage;
  const shell = element(root, 'div', 'lafea-analytical-calc');
  shell.dataset.role = 'lafea-analytical-calc';
  shell.dataset.productId = EMP1_PUBLIC_PRODUCT.productId;
  shell.dataset.backingStageId = stageId;
  shell.dataset.emp1Step = step.shortId;
  shell.dataset.routeFamily = 'ANALYTICAL';

  const engineeringReview = options.handlers.getEmp1EngineeringReviewWorkspace?.() ?? null;
  const benchmarkEvidence = projectEmp1BenchmarkEvidenceWorkspace();
  const workflow = renderEmp1ProfessionalWorkflow(root, projection, options.onSelectRoute, {
    runFailure: options.emp1RunFailure,
    reviewWorkspace: engineeringReview,
    onReview: options.handlers.onEmp1EngineeringReview,
  });
  const benchmarkEvidencePanel = renderEmp1BenchmarkEvidencePanel(root, benchmarkEvidence);

  const route = card(root, 'Active EMP.1 step');
  route.section.dataset.guidedTarget = 'analytical-route';
  const scopeStatus = element(
    root,
    'strong',
    'lafea-result-highlights__status',
    `${step.stepId} ${step.label.toUpperCase()} · ${engineeringStatus(state.status)}`,
  );
  scopeStatus.dataset.role = 'lafea-analytical-scope-status';
  scopeStatus.dataset.rawStatus = String(state.status ?? 'UNKNOWN');
  const heading = element(root, 'h3', null, foundation
    ? 'EMP.1.A — load transfer & pressure baseline'
    : 'EMP.1.B — nominal section screening');
  heading.dataset.role = 'lafea-analytical-route-heading';
  heading.dataset.emp1Step = step.shortId;
  const scopeBoundary = element(
    root,
    'p',
    'lafea-workbench__authority',
    foundation
      ? 'Authority: load/reference transfer and elastic pressure baseline only. It does not calculate WRC 107/537 local-attachment stress or establish code compliance.'
      : 'Authority: nominal pipe-section screening only. The wired EMP.1.C transaction may prepare source-bound A/B custody, but production WRC execution remains separately governed and may be suspended.',
  );
  scopeBoundary.dataset.role = 'lafea-analytical-scope-boundary';
  route.body.append(
    scopeStatus,
    heading,
    element(root, 'p', 'lafea-workbench__section-intro',
      `Retained backing engine: ${stageId}. EMP.1 is analytical; registered FE routes begin at LAFEA.3.`),
    scopeBoundary,
  );

  const source = card(root, `${step.stepId} inputs`);
  source.section.dataset.guidedTarget = 'source';
  const radiusRecovery = renderPressureRadiusRecovery(
    source.body,
    stageId,
    stage.document,
    options.handlers.onSetScalarBatch,
  );
  if (radiusRecovery) source.body.append(radiusRecovery);
  source.body.append(renderDocumentTableEditor(source.body, stageId, stage.document, {
    onSetScalar: options.handlers.onSetScalar,
    onSetScalarBatch: options.handlers.onSetScalarBatch,
    onApplyJson: options.handlers.onApplyJson,
  }));

  const engineeringEvidence = renderEmp1StageEngineeringEvidence(root, stageId, presentedStage, projection);
  const screeningCustody = foundation ? null : screeningLoadCustody(
    root,
    state,
    stage.document,
    projection,
    options.handlers.onApplyJson,
  );
  const correlationAvailability = foundation
    ? null
    : renderLafeaCorrelationAvailability(root, presentedStage);
  const boundedCorrelation = renderEmp1BoundedCorrelationEvidence(root, projection);
  const runConfiguration = renderEmp1WorkbenchRunConfiguration(root, {
    state,
    projection,
    runInput: options.emp1RunInput,
    currentness: options.emp1ExecutionCurrentness,
    cState: options.emp1CState,
    runFailure: options.emp1RunFailure,
    onApply: options.handlers.onEmp1RunInput,
  });
  const transactionSummary = renderEmp1WorkbenchExecutionSummary(
    root,
    options.emp1Execution,
    options.emp1ExecutionCurrentness,
    options.emp1CState,
  );
  const correlationResult = renderEmp1CorrelationResultEvidence(
    root,
    productionLocalCorrelation,
  );

  const settings = card(root, `${step.stepId} calculation contract and settings`);
  settings.section.dataset.guidedTarget = 'profile';
  settings.body.append(renderLafeaAnalysisSettings(settings.body, stage, options.registryEntry));

  const bSourceCurrent = foundation
    || projection.custody.bSourceEvidenceState === EMP1_B_SOURCE_CUSTODY_STATES.CURRENT
    || Boolean(inputCurrentProductExecution?.stageExecutions?.sectionScreening);
  const results = card(root, `${step.stepId} results`);
  results.section.dataset.guidedTarget = 'results';
  results.body.append(element(root, 'p', 'lafea-workbench__section-intro', foundation
    ? 'EMP.1.A evidence only; local attachment correlation is not implied by this result.'
    : 'EMP.1.B nominal screening evidence only; any C production stress result remains a separately governed local-correlation layer and is absent while C authority is suspended.'));
  if (!bSourceCurrent && stage.execution) {
    const stale = element(root, 'p', 'lafea-workbench__authority',
      `Retained B result is excluded from current EMP.1 evidence. ${projection.custody.userAction}`);
    stale.dataset.role = 'emp1-b-stale-result-blocker';
    results.body.append(stale);
  }
  results.body.append(renderLafeaEvidence(
    root,
    stageId,
    presentedStage.document,
    state,
    bSourceCurrent ? presentedStage.execution : null,
  ));

  const lineage = card(root, `${step.stepId} evidence and lineage`);
  lineage.section.dataset.guidedTarget = 'lineage';
  lineage.body.append(renderLafeaLifecyclePanel(lineage.body, stageId, stage));

  let benchmark = null;
  if (options.benchmarkHost) {
    const benchmarkCard = card(root, `${step.stepId} verification output`);
    benchmarkCard.body.append(options.benchmarkHost);
    benchmark = benchmarkCard.section;
  }

  composeEmp1AnalyticalLayout(shell, {
    workflow,
    route: route.section,
    source: source.section,
    engineeringEvidence,
    screeningCustody,
    correlationAvailability,
    boundedCorrelation,
    runConfiguration,
    transactionSummary,
    correlationResult,
    settings: settings.section,
    results: results.section,
    lineage: lineage.section,
    benchmarkEvidence: benchmarkEvidencePanel,
    benchmark,
  });

  applyEmp1BCurrentnessRunGate(root, step, projection);
  applyEmp1BPressureThrustRunGate(root, step, stage.document);
  return Object.freeze({ element: shell, viewport: null, viewportElement: null,
    viewportReused: false, workflow: null, discretization: null });
}

/**
 * Recovery for pressure evaluation radii stranded outside the current wall.
 *
 * A geometry edit can leave the declared radii outside the pipe wall, which
 * fails the qualified LAFEA.1 preflight. The radii are ordinary governed inputs
 * under Loads; this offers the common repair beside the failure instead of
 * leaving Undo as the only way out. The edits run through the same descriptor
 * batch a hand edit uses, so nothing bypasses custody or invalidation.
 */
function renderPressureRadiusRecovery(root, stageId, documentValue, onSetScalarBatch) {
  if (stageId !== 'LAFEA.1' || typeof onSetScalarBatch !== 'function') return null;
  const validation = projectLafea1PressureRadiusValidation(documentValue);
  if (validation.state !== 'OUTSIDE_WALL') return null;
  const refit = projectLafea1PressureRadiusRefit(documentValue);

  const notice = element(root, 'div', 'lafea-workbench__authority');
  notice.dataset.role = 'lafea-1-pressure-radius-recovery';
  notice.dataset.refitState = refit.state;
  notice.append(
    element(root, 'strong', null, 'Pressure evaluation radii are outside the current pipe wall'),
    element(root, 'p', null, validation.message),
    element(root, 'p', null, validation.recoveryAction),
  );
  if (refit.state === 'AVAILABLE') {
    const unitSuffix = refit.unit ? ` ${refit.unit}` : '';
    const action = actionButton(root, 'Set radii to current wall', () => onSetScalarBatch(refit.edits));
    action.dataset.role = 'lafea-1-pressure-radius-refit';
    action.title = `Sets the declared evaluation radii to ${refit.innerRadius}${unitSuffix} (bore) and ${refit.outerRadius}${unitSuffix} (outer surface).`;
    notice.append(action);
  }
  if (refit.unaddressed.length) {
    notice.append(element(root, 'p', null,
      `${refit.unaddressed.length} further requested radius/radii sit outside the declared editable pair and must be corrected through the source document.`));
  }
  return notice;
}

function screeningLoadCustody(root, state, documentValue, projection, onApplyJson) {
  const hasDocument = Boolean(documentValue && typeof documentValue === 'object');
  const custody = createEmp1BSourceCustodyCard(root, projection, hasDocument, () => {
    const aStage = state?.stages?.['LAFEA.1'];
    const refreshResult = evaluateEmp1BSourceRefresh({
      aDocument: aStage?.document,
      aExecution: aStage?.execution,
      bDocument: documentValue,
    });
    if (refreshResult.status === 'READY') onApplyJson(JSON.stringify(refreshResult.document));
  });
  if (!hasDocument) return custody.section;

  const sourceResult = documentValue.sourceEvidence?.foundationResult;
  const loadCases = Array.isArray(sourceResult?.transformedLoadCases)
    ? sourceResult.transformedLoadCases
    : [];
  const screeningCases = Array.isArray(documentValue.screeningCases)
    ? documentValue.screeningCases
    : [];
  const canonicalUnits = documentValue.sourceEvidence?.foundationModel?.units?.canonical ?? {};
  const forceUnit = canonicalUnits.force ?? 'force';
  const momentUnit = canonicalUnits.moment ?? 'moment';

  custody.body.append(
    resultantsTable(root, loadCases, forceUnit, momentUnit),
    screeningTermsTable(root, documentValue, screeningCases, onApplyJson),
    pressureThrustCustodyTable(root, documentValue, onApplyJson),
  );
  return custody.section;
}

function resultantsTable(root, loadCases, forceUnit, momentUnit) {
  const wrapper = element(root, 'div', 'lafea-screening-custody__resultants');
  wrapper.append(element(root, 'h4', null, 'Retained EMP.1.A transformed resultants'));
  if (!loadCases.length) {
    wrapper.append(element(root, 'p', 'lafea-workbench-svg__empty',
      'No retained EMP.1.A transformed load cases are available.'));
    return wrapper;
  }
  const table = element(root, 'table', 'lafea-result-table');
  const head = element(root, 'tr');
  ['Load case', `Fx (${forceUnit})`, `Fy (${forceUnit})`, `Fz (${forceUnit})`,
    `Mx (${momentUnit})`, `My (${momentUnit})`, `Mz (${momentUnit})`]
    .forEach((label) => {
      const cell = element(root, 'th', null, label);
      cell.scope = 'col';
      head.append(cell);
    });
  table.append(head);
  loadCases.forEach((loadCase) => {
    const force = Array.isArray(loadCase?.transformedForceLocal)
      ? loadCase.transformedForceLocal
      : [];
    const moment = Array.isArray(loadCase?.transformedMomentLocal)
      ? loadCase.transformedMomentLocal
      : [];
    const row = element(root, 'tr');
    const identity = element(root, 'th', null, String(loadCase?.identity ?? 'UNRESOLVED_LOAD_CASE'));
    identity.scope = 'row';
    row.append(identity);
    [...force.slice(0, 3), ...moment.slice(0, 3)].forEach((value) => {
      row.append(element(root, 'td', null, engineeringNumber(value)));
    });
    table.append(row);
  });
  wrapper.append(table);
  return wrapper;
}

function screeningTermsTable(root, documentValue, screeningCases, onApplyJson) {
  const wrapper = element(root, 'div', 'lafea-screening-custody__terms');
  wrapper.append(element(root, 'h4', null, 'Screening-case mechanical terms'));
  if (!screeningCases.length) {
    wrapper.append(element(root, 'p', 'lafea-workbench-svg__empty',
      'No screening cases are available.'));
    return wrapper;
  }
  const table = element(root, 'table', 'lafea-result-table');
  const head = element(root, 'tr');
  ['Screening case', 'Load case', 'Factor', 'Pressure definition', 'Pressure factor', 'Action']
    .forEach((label) => {
      const cell = element(root, 'th', null, label);
      cell.scope = 'col';
      head.append(cell);
    });
  table.append(head);

  screeningCases.forEach((screeningCase) => {
    const screeningCaseId = String(screeningCase?.screeningCaseId ?? '');
    const terms = Array.isArray(screeningCase?.mechanicalTerms)
      ? screeningCase.mechanicalTerms
      : [];
    if (!terms.length) {
      const row = element(root, 'tr');
      const identity = element(root, 'th', null, screeningCaseId || 'UNRESOLVED_SCREENING_CASE');
      identity.scope = 'row';
      row.append(
        identity,
        element(root, 'td', null, 'No mechanical terms'),
        element(root, 'td', null, '—'),
        element(root, 'td', null, String(screeningCase?.pressureDefinitionId ?? '—')),
        element(root, 'td', null, engineeringNumber(screeningCase?.pressureFactor)),
        element(root, 'td', null, '—'),
      );
      table.append(row);
      return;
    }

    terms.forEach((term) => {
      const loadCaseId = String(term?.loadCaseId ?? '');
      const row = element(root, 'tr');
      row.dataset.screeningCaseId = screeningCaseId;
      row.dataset.loadCaseId = loadCaseId;
      const identity = element(root, 'th', null, screeningCaseId || 'UNRESOLVED_SCREENING_CASE');
      identity.scope = 'row';
      const factorCell = element(root, 'td');
      const factor = element(root, 'input');
      factor.type = 'text';
      factor.inputMode = 'decimal';
      factor.autocomplete = 'off';
      factor.value = engineeringNumber(term?.factor);
      factor.dataset.role = 'lafea-screening-term-factor';
      factor.dataset.screeningCaseId = screeningCaseId;
      factor.dataset.loadCaseId = loadCaseId;
      factor.setAttribute('aria-label', `Mechanical factor ${screeningCaseId} ${loadCaseId}`);
      factorCell.append(factor);

      const actionCell = element(root, 'td');
      const apply = actionButton(root, 'Apply factor', () => {
        factor.setCustomValidity('');
        const command = createLafeaScreeningTermFactorCommand({
          commandId: screeningTermCommandId(documentValue, screeningCaseId, loadCaseId),
          expectedDocumentDigest: lafeaDocumentDigest(documentValue),
          screeningCaseId,
          loadCaseId,
          rawText: factor.value,
          origin: {
            surface: 'LAFEA2_SCREENING_TERM_FORM',
            sessionId: 'LAFEA_WORKBENCH_SESSION',
            sequence: 0,
          },
        });
        const editResult = applyLafeaScreeningTermFactorCommand(documentValue, command);
        if (!['APPLIED', 'NO_CHANGE'].includes(editResult.status)) {
          const diagnostic = editResult.diagnostics?.[0];
          factor.setCustomValidity(diagnostic?.message ?? 'Mechanical-term factor edit was rejected.');
          factor.reportValidity();
          return;
        }
        if (editResult.status === 'APPLIED') onApplyJson(JSON.stringify(editResult.document));
      });
      apply.dataset.role = 'lafea-apply-screening-term-factor';
      apply.dataset.screeningCaseId = screeningCaseId;
      apply.dataset.loadCaseId = loadCaseId;
      actionCell.append(apply);

      row.append(
        identity,
        element(root, 'td', null, loadCaseId || 'UNRESOLVED_LOAD_CASE'),
        factorCell,
        element(root, 'td', null, String(screeningCase?.pressureDefinitionId ?? '—')),
        element(root, 'td', null, engineeringNumber(screeningCase?.pressureFactor)),
        actionCell,
      );
      table.append(row);
    });
  });
  wrapper.append(table);
  return wrapper;
}

function pressureThrustCustodyTable(root, documentValue, onApplyJson) {
  const wrapper = element(root, 'div', 'lafea-screening-custody__pressure-thrust');
  wrapper.append(
    element(root, 'h4', null, 'Axial pressure-thrust custody'),
    element(root, 'p', 'lafea-workbench__section-intro',
      'For closed-end pressure, declare whether the supplied Fx already contains pressure end-cap thrust. This cannot be inferred safely from the combined result.'),
  );
  const cases = pressureThrustCaseView(documentValue);
  if (!cases.length) {
    wrapper.append(element(root, 'p', 'lafea-workbench-svg__empty',
      'No screening cases are available for pressure-thrust custody.'));
    return wrapper;
  }

  const unresolved = cases.filter((row) => row.unresolved);
  if (unresolved.length) {
    const blocker = element(root, 'p', 'lafea-workbench__authority',
      `Run blocked: declare whether Fx includes closed-end pressure thrust for ${unresolved.map((row) => row.screeningCaseId).join(', ')}.`);
    blocker.dataset.role = 'emp1-pressure-thrust-blocker';
    wrapper.append(blocker);
  }

  const table = element(root, 'table', 'lafea-result-table');
  const head = element(root, 'tr');
  ['Screening case', 'Pressure definition', 'Pressure factor', 'Axial thrust in Fx', 'Engineering treatment', 'Action']
    .forEach((label) => {
      const cell = element(root, 'th', null, label);
      cell.scope = 'col';
      head.append(cell);
    });
  table.append(head);

  cases.forEach((caseView) => {
    const row = element(root, 'tr');
    row.dataset.screeningCaseId = caseView.screeningCaseId;
    row.dataset.pressureThrustUnresolved = caseView.unresolved ? 'true' : 'false';
    const identity = element(root, 'th', null, caseView.screeningCaseId);
    identity.scope = 'row';

    const basisCell = element(root, 'td');
    const select = element(root, 'select');
    select.dataset.role = 'lafea-pressure-thrust-basis';
    select.dataset.screeningCaseId = caseView.screeningCaseId;
    select.setAttribute('aria-label', `Axial pressure-thrust basis ${caseView.screeningCaseId}`);
    const placeholder = element(root, 'option', null, 'Select pressure-thrust basis');
    placeholder.value = '';
    select.append(placeholder);
    PRESSURE_THRUST_BASIS_OPTIONS.forEach((option) => {
      const item = element(root, 'option', null, option.label);
      item.value = option.value;
      select.append(item);
    });
    if (PRESSURE_THRUST_BASIS_OPTIONS.some((option) => option.value === caseView.basis)) {
      select.value = caseView.basis;
    } else {
      select.value = '';
    }
    basisCell.append(select);

    const actionCell = element(root, 'td');
    const apply = actionButton(root, 'Apply basis', () => {
      select.setCustomValidity('');
      if (!select.value) {
        select.setCustomValidity('Select whether Fx includes or excludes closed-end pressure thrust.');
        select.reportValidity();
        return;
      }
      const command = createLafeaScreeningPressureThrustBasisCommand({
        commandId: pressureThrustCommandId(documentValue, caseView.screeningCaseId),
        expectedDocumentDigest: lafeaDocumentDigest(documentValue),
        screeningCaseId: caseView.screeningCaseId,
        basis: select.value,
        origin: {
          surface: 'LAFEA2_PRESSURE_THRUST_FORM',
          sessionId: 'LAFEA_WORKBENCH_SESSION',
          sequence: 0,
        },
      });
      const editResult = applyLafeaScreeningPressureThrustBasisCommand(documentValue, command);
      if (!['APPLIED', 'NO_CHANGE'].includes(editResult.status)) {
        const diagnostic = editResult.diagnostics?.[0];
        select.setCustomValidity(diagnostic?.message ?? 'Pressure-thrust basis edit was rejected.');
        select.reportValidity();
        return;
      }
      if (editResult.status === 'APPLIED') onApplyJson(JSON.stringify(editResult.document));
    });
    apply.dataset.role = 'lafea-apply-pressure-thrust-basis';
    apply.dataset.screeningCaseId = caseView.screeningCaseId;
    actionCell.append(apply);

    row.append(
      identity,
      element(root, 'td', null, caseView.pressureDefinitionId),
      element(root, 'td', null, engineeringNumber(caseView.pressureFactor)),
      basisCell,
      element(root, 'td', null, caseView.meaning),
      actionCell,
    );
    table.append(row);
  });
  wrapper.append(table);
  return wrapper;
}

function applyEmp1BCurrentnessRunGate(root, step, projection) {
  if (step.shortId !== 'B'
    || projection.custody.bSourceEvidenceState === EMP1_B_SOURCE_CUSTODY_STATES.CURRENT) return;
  const workbench = root.closest?.('[data-role="lafea-workbench"]') ?? root;
  const run = workbench.querySelector?.('[data-role="lafea-run"]');
  if (!run) return;
  run.disabled = true;
  run.dataset.emp1CurrentnessGate = 'BLOCKED';
  run.title = projection.custody.userAction;
}

function applyEmp1BPressureThrustRunGate(root, step, documentValue) {
  if (step.shortId !== 'B') return;
  const unresolved = unresolvedEmp1BPressureThrustCases(documentValue);
  if (!unresolved.length) return;
  const workbench = root.closest?.('[data-role="lafea-workbench"]') ?? root;
  const run = workbench.querySelector?.('[data-role="lafea-run"]');
  if (!run) return;
  const message = `Declare whether Fx includes closed-end pressure thrust for ${unresolved.join(', ')} before running nominal section screening.`;
  run.disabled = true;
  run.dataset.emp1PressureThrustGate = 'BLOCKED';
  run.title = run.title ? `${run.title} ${message}` : message;
}

function screeningTermCommandId(documentValue, screeningCaseId, loadCaseId) {
  const revision = lafeaDocumentDigest(documentValue).replace(/[^a-zA-Z0-9]/gu, '').slice(-12);
  return `LAFEA2-TERM-${screeningCaseId}-${loadCaseId}-${revision}`;
}

function pressureThrustCommandId(documentValue, screeningCaseId) {
  const revision = lafeaDocumentDigest(documentValue).replace(/[^a-zA-Z0-9]/gu, '').slice(-12);
  return `LAFEA2-THRUST-${screeningCaseId}-${revision}`;
}

function engineeringNumber(value) {
  if (!Number.isFinite(value)) return '—';
  return Number(value.toPrecision(8)).toString();
}

function engineeringStatus(value) {
  return String(value ?? 'UNKNOWN').replaceAll('_', ' ');
}
