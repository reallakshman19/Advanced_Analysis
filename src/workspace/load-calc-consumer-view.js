/**
 * Builds the empirical Load Calc workbench shell. Engineering values shown by
 * this module are read from immutable empirical result and receipt contracts.
 */
import { renderLoadCalcExceptionReview } from './load-calc-exception-review.js';
import { gravitySourceAxisLabel, renderLoadCalcQuantityScope } from './load-calc-quantity-scope.js';
import { bindEmpiricalScreeningPreview, renderEmpiricalScreeningPreview } from './load-calc-empirical-screening.js';
import {
  TOPOLOGY_EDIT_DEFAULT_AUTOFIX_GAP_MM,
  TOPOLOGY_EDIT_MAXIMUM_AUTOFIX_GAP_MM,
} from './topology-edit/topology-edit-gap-autofix-policy.js';

export function renderLoadCalcConsumer(documentRef, state) {
  const section = documentRef.createElement('section');
  section.className = 'load-calc-consumer empirical-load-calc';
  section.dataset.role = 'load-calc-consumer';
  section.innerHTML = `${headerMarkup(state)}<div data-load-calc-pane class="empirical-load-calc__pane"></div>`;
  return section;
}

function runReasonText(snap, authState) {
  const code = snap?.reasonCode || authState?.reasonCode || '';
  const MAP = {
    'EMPIRICAL_SCENARIO_REQUIRED': 'Configure a scenario in the Methods tab',
    'EMPIRICAL_SCENARIO_BLOCKED':  'Scenario has blockers — check Methods tab',
    'EMPIRICAL_SCENARIO_NOT_READY': 'Scenario not ready — authorize first',
    'EMPIRICAL_SCENARIO_AUTHORIZATION_REQUIRED': 'Authorize the scenario first',
    'EMPIRICAL_SCENARIO_AUTHORIZATION_STALE': 'Authorization is stale — re-authorize',
    'NO_ACTIVE_DATASET': 'No dataset loaded — import SJSON first',
    'EMPIRICAL_RUNTIME_ACTIVE_MODEL_MISSING': 'Load a dataset first',
    'EMPIRICAL_INPUT_NOT_READY': 'Check Verify & Run tab — some inputs are missing',
    'EMPIRICAL_MODELS_NOT_READY': 'Topology models not ready',
  };
  return MAP[code] || (code ? code.replace(/_/g, ' ').toLowerCase() : 'Not ready');
}

function resolveRunAction(state) {
  const snap = state.empiricalScenarioState;
  const authState = state.authorizationState;
  if (snap?.calculationEligible) {
    return { label: 'Run Load Calc', eligible: true, reason: 'Execute configured empirical scenario', action: 'empirical' };
  }
  if (authState?.calculationEligible) {
    return { label: 'Run Load Calc — Gravity', eligible: true, reason: 'Execute authorized gravity load calc', action: 'gravity' };
  }
  return { label: 'Run Load Calc', eligible: false, reason: runReasonText(snap, authState), action: 'none' };
}

function headerMarkup(state) {
  if (state.activeTab === 'workbench') return `<header class="empirical-load-calc__header"><div><span class="panel-eyebrow">INPUTS · CALCULATION · RESULTS</span><h1>Support Load Workbench</h1></div><span role="status" data-engineering-load-status>${escapeHtml(state.message || '')}</span><button type="button" data-load-calc-tab="legacy">Advanced / legacy workflow</button></header>`;
  const freshness = state.distribution?.freshness?.status || 'NOT_CALCULATED';
  const authorization = state.authorizationState || {};
  const commonInput = state.commonInputState || {};
  const commonSeal = commonInput.commonInput
    ? (commonInput.staleness?.stale ? 'STALE' : 'CURRENT')
    : 'NOT_SEALED';
  const runAction = resolveRunAction(state);

  const sealStatus = commonSeal === 'CURRENT' ? 'ok' : (commonSeal === 'NOT_SEALED' ? 'warn' : 'fail');
  const authSt = authorization.state || 'NOT_CONFIGURED';
  const authStatus = (authSt === 'EXECUTED_CURRENT' || authSt === 'AUTHORIZED_CURRENT') ? 'ok' : (authSt.includes('AWAITING') || authSt === 'DRAFT_READY' ? 'warn' : 'fail');
  const resultStatus = freshness === 'CURRENT' ? 'ok' : (freshness === 'NOT_CALCULATED' ? 'warn' : 'fail');

  const SEAL_LABELS = { CURRENT: 'Sealed ✓', STALE: 'Seal stale ⚠', NOT_SEALED: 'Not sealed' };
  const AUTH_LABELS = {
    EXECUTED_CURRENT: 'Authorized ✓', AUTHORIZED_CURRENT: 'Authorized ✓',
    DRAFT_READY: 'Ready to authorize', DRAFT_BLOCKED: 'Scenario blocked',
    AUTHORIZED_STALE: 'Stale — re-authorize', EXECUTED_STALE: 'Results stale',
    NOT_CONFIGURED: 'No scenario', AWAITING_AUTHORIZATION: 'Awaiting auth',
  };
  const RESULT_LABELS = { CURRENT: 'Results ready ✓', NOT_CALCULATED: 'Not run yet', STALE: 'Results stale' };
  const sealLabel  = SEAL_LABELS[commonSeal]   || commonSeal;
  const authLabel  = AUTH_LABELS[authSt]        || authSt;
  const resultLabel = RESULT_LABELS[freshness]  || freshness;

  return `<header class="empirical-load-calc__header">
    <div><span class="panel-eyebrow">GUIDED WORKFLOW</span><h1>Support Load Calculation</h1></div>
    <div class="empirical-load-calc__facts">
      <span data-pill-status="${sealStatus}">${escapeHtml(sealLabel)}</span>
      <span data-pill-status="${authStatus}">${escapeHtml(authLabel)}</span>
      <span data-pill-status="${resultStatus}">${escapeHtml(resultLabel)}</span>
    </div>
    ${workflowMarkup(state, runAction)}
    <div class="empirical-load-calc__actions">
      <button type="button" data-load-calc-tab="preview" aria-current="${state.activeTab === 'preview' ? 'page' : 'false'}">Preview</button>
      <button type="button" data-load-calc-tab="workbench">Open load workbench</button>
      <button type="button" class="button button--primary" 
        ${runAction.eligible ? '' : 'disabled'}
        data-load-calc-run
        title="${escapeHtml(runAction.reason)}">
        ▶ ${escapeHtml(runAction.label)}
      </button>
      <output data-engineering-load-status aria-live="polite">${escapeHtml(state.message || (!runAction.eligible ? runAction.reason : ''))}</output>
    </div>
  </header>`;
}

const PRIMARY_TABS = new Set(['topology', 'project-data', 'masters', 'preview', 'workbench', 'preflight', 'verify', 'loads']);

const WORKFLOW_STEPS = Object.freeze([
  Object.freeze({ id: 'import', label: 'Import JSON', tab: null }),
  Object.freeze({ id: 'topology', label: 'Topology Fix', tab: 'topology' }),
  Object.freeze({ id: 'project-data', label: 'Project Data', tab: 'project-data' }),
  Object.freeze({ id: 'masters', label: 'Import Masters', tab: 'masters' }),
  Object.freeze({ id: 'preflight', label: 'Validate Input', tab: 'preflight' }),
  Object.freeze({ id: 'verify', label: 'Run Calc', tab: 'verify' }),
  Object.freeze({ id: 'loads', label: 'View Loads', tab: 'loads' }),
]);

function workflowMarkup(state, runAction) {
  return `<nav class="empirical-load-calc__workflow" aria-label="Load calculation process">
    ${WORKFLOW_STEPS.map((step, index) => workflowStep(step, index, state, runAction)).join('')}
    ${advancedToolsTileMarkup(state)}
  </nav>`;
}

/**
 * Every view the 7 numbered steps don't cover (scenario configuration,
 * diagnostics, export, 3D) lives behind one 8th tile instead of a permanently
 * open strip underneath the guided row. It renders as a <details>/<summary>
 * pair -- not a styled button -- so the disclosure semantics (and the e2e
 * helper that opens it via `summary`) are unchanged; only its position and
 * visual treatment move to match tiles 1-7.
 *
 * Five of its former entries (Verify & Run, Project Data, Masters, Load
 * Evaluation, Input Check) pointed at tabs already reachable from the
 * numbered row above -- same tab id, second button, no second view. They are
 * intentionally not reproduced here; ADVANCED_TAB_GROUPS lists only tabs
 * with no other entry point.
 */
// Keep in sync with the tabGroup(...) calls in advancedToolsTileMarkup()
// below: one entry per tab rendered there, same id, same label. Used only to
// show which advanced view is active in the tile-8 status line.
const ADVANCED_TAB_LABELS = Object.freeze({
  overview: 'Overview',
  enrichment: 'Enrichment & Overrides',
  restraints: 'Restraints',
  'load-cases': 'Load Cases',
  methods: 'Methods',
  results: 'Results',
  evidence: 'Evidence',
  'method-basis': 'Method Basis',
  'seal-export': 'Seal & Export',
  'json-trace': 'JSON Trace',
  '3d': 'Model / 3D',
});
const ADVANCED_TAB_COUNT = Object.keys(ADVANCED_TAB_LABELS).length;

function advancedToolsTileMarkup(state) {
  const advancedOpen = !PRIMARY_TABS.has(state.activeTab);
  const statusLabel = advancedOpen ? (ADVANCED_TAB_LABELS[state.activeTab] || 'Open') : `${ADVANCED_TAB_COUNT} views`;
  return `<details class="empirical-load-calc__advanced" ${advancedOpen ? 'open' : ''}>
    <summary class="empirical-load-calc__workflow-step ${advancedOpen ? 'is-active' : ''}" data-step-state="${advancedOpen ? 'current' : 'pending'}">
      <span class="empirical-load-calc__workflow-index">8</span>
      <span class="empirical-load-calc__workflow-label">Advanced Tools</span>
      <span class="empirical-load-calc__workflow-status">${escapeHtml(statusLabel)}</span>
    </summary>
    <nav class="empirical-load-calc__tabs" aria-label="Advanced load calculation views">
      ${tabGroup('Setup', [
        ['overview', 'Overview'],
        ['enrichment', 'Enrichment & Overrides'],
      ], state.activeTab)}
      ${tabGroup('Scenario', [
        ['restraints', 'Restraints'],
        ['load-cases', 'Load Cases'],
        ['methods', 'Methods'],
      ], state.activeTab)}
      ${tabGroup('Output', [
        ['results', 'Results'],
        ['evidence', 'Evidence'],
      ], state.activeTab)}
      ${tabGroup('Diagnostics', [
        ['method-basis', 'Method Basis'],
        ['seal-export', 'Seal & Export'],
        ['json-trace', 'JSON Trace'],
      ], state.activeTab)}
      ${tabGroup('Model', [
        ['3d', 'Model / 3D'],
      ], state.activeTab)}
    </nav>
  </details>`;
}

function workflowStep(step, index, state, runAction) {
  const activeStepId = state.currentWorkflowStepId || 'import';
  const active = step.id === activeStepId;
  const stepState = workflowStepState(step.id, index, activeStepId, state, runAction);
  const action = step.id === 'import'
    ? 'data-load-calc-import'
    : `data-load-calc-tab="${escapeHtml(step.tab)}"`;
  return `<button type="button" class="empirical-load-calc__workflow-step ${active ? 'is-active' : ''}" ${action}
    data-step-state="${escapeHtml(stepState.state)}" aria-current="${active ? 'step' : 'false'}">
    <span class="empirical-load-calc__workflow-index">${index + 1}</span>
    <span class="empirical-load-calc__workflow-label">${escapeHtml(step.label)}</span>
    <span class="empirical-load-calc__workflow-status">${escapeHtml(stepState.label)}</span>
  </button>`;
}

function actionRequiredState(state, count) {
  return { state, label: `${count} action${count === 1 ? '' : 's'} required` };
}

function workflowStepState(stepId, stepIndex, activeStepId, state, runAction) {
  const readiness = state.workflowReadiness || {};
  const activeIndex = WORKFLOW_STEPS.findIndex((step) => step.id === activeStepId);
  const completed = {
    import: readiness.datasetReady,
    topology: readiness.topologyCheckReady,
    'project-data': readiness.projectDataReady,
    masters: readiness.masterDataReady,
    preflight: readiness.validationReady,
    verify: readiness.resultsCurrent,
    loads: readiness.resultsCurrent,
  }[stepId] === true;

  if (stepId === activeStepId) {
    if (stepId === 'import' && !readiness.datasetReady) {
      return { state: 'blocked', label: 'Import required' };
    }
    if (stepId === 'topology' && readiness.topologyBlockerCount > 0) {
      return actionRequiredState('blocked', readiness.topologyBlockerCount);
    }
    if (stepId === 'topology' && readiness.topologyReviewIssueCount > 0) {
      return actionRequiredState('review', readiness.topologyReviewIssueCount);
    }
    if (stepId === 'verify' && runAction.eligible) return { state: 'ready', label: 'Ready' };
    if (stepId === 'preflight' && !readiness.validationEvaluated) {
      return { state: 'blocked', label: 'Check required' };
    }
    if (stepId === 'preflight' && readiness.validationBlockerCount > 0) {
      return actionRequiredState('blocked', readiness.validationBlockerCount);
    }
    if (stepId === 'preflight' && readiness.validationState && readiness.validationState !== 'NOT_EVALUATED') {
      return { state: 'blocked', label: 'Review' };
    }
    if (stepId === 'project-data' && readiness.projectDataActionCount > 0) {
      return actionRequiredState('blocked', readiness.projectDataActionCount);
    }
    if (stepId === 'masters' && readiness.masterDataActionCount > 0) {
      return actionRequiredState('blocked', readiness.masterDataActionCount);
    }
    if ((stepId === 'verify' || stepId === 'loads') && !readiness.resultsCurrent) {
      return { state: 'blocked', label: 'Action required' };
    }
    return { state: 'current', label: 'Current' };
  }
  if (activeIndex >= 0 && stepIndex < activeIndex) {
    return completed
      ? { state: 'complete', label: 'Done' }
      : { state: 'blocked', label: 'Required' };
  }
  if (activeIndex < 0 && completed) return { state: 'complete', label: 'Done' };
  return { state: 'pending', label: 'Next' };
}

function tabGroup(label, tabs, activeTab) {
  return `<span class="empirical-load-calc__tab-group" role="group" aria-label="${escapeHtml(label)}">
    <span class="panel-eyebrow">${escapeHtml(label)}</span>
    ${tabs.map(([id, tabLabel]) => tab(id, tabLabel, activeTab)).join('')}
  </span>`;
}

function tab(id, label, activeTab) {
  const selected = id === activeTab;
  return `<button type="button" data-load-calc-tab="${id}" aria-selected="${selected}" class="${selected ? 'is-active' : ''}">${label}</button>`;
}

export function renderEngineeringLoadPane(
  container,
  distribution,
  supportSiteModel,
  routePartitionModel,
  authorizedExecution = null,
  authorizationState = null,
  screeningContext = undefined,
) {
  if (!container) return;
  container.innerHTML = `${contractSummary(
    distribution,
    supportSiteModel,
    routePartitionModel,
    authorizedExecution,
    authorizationState,
  )}${renderLoadCalcQuantityScope(distribution)}${renderEmpiricalScreeningPreview(distribution, screeningContext)}${caseMarkup(distribution, supportSiteModel)}`;
  bindEmpiricalScreeningPreview(container, distribution, screeningContext);
}

export function renderLoadCalcTopologyPane(
  container,
  supportSiteModel,
  routePartitionModel,
  topologyCheck,
  policyFeedback,
  skipError = null,
) {
  if (!container) throw new TypeError('Load Calc Topology Fix requires a container.');
  const modelBlockers = loadModelTopologyBlockers(supportSiteModel, routePartitionModel);
  const blockingFindings = topologyCheck?.blockingFindings || [];
  const reviewFindings = topologyCheck?.reviewFindings || [];
  const findings = topologyCheck?.findings || [];
  const geometryFindings = findings.filter((finding) => !isSupportSemanticFinding(finding));
  const semanticFindings = findings.filter(isSupportSemanticFinding);
  const topologyReady = supportSiteModel?.status === 'READY' && routePartitionModel?.status === 'READY';
  const requiresFix = !topologyReady || modelBlockers.length > 0 || blockingFindings.length > 0;
  const reviewRequired = !requiresFix
    && (reviewFindings.length > 0 || (topologyCheck?.skippedIssueCount || 0) > 0);
  const status = requiresFix ? 'BLOCKED' : reviewRequired ? 'REVIEW_REQUIRED' : 'READY';
  const exactFixCount = topologyCheck?.autoFix?.certifiedExactGapCount || 0;
  const gapToleranceMm = topologyCheck?.autoFix?.exactToleranceMm
    || TOPOLOGY_EDIT_DEFAULT_AUTOFIX_GAP_MM;
  const continueLabel = reviewRequired
    ? 'Acknowledge review & continue'
    : 'Continue to Project Data';
  const actionMarkup = `<div class="load-calc-error-check__actions">
    ${findings.length ? '<button type="button" class="button" data-load-calc-tab="3d">Review findings in 3D</button>' : ''}
    ${requiresFix ? '' : `<button type="button" class="button button--primary" data-load-calc-tab="project-data">${continueLabel}</button>`}
  </div>`;
  container.innerHTML = `<section class="load-calc-error-check load-calc-topology" data-role="load-calc-topology" data-status="${status}">
    <header>
      <div><span class="panel-eyebrow">STEP 2</span><h2>Topology Fix</h2>
        <p>${topologyStatusMessage(status, topologyCheck)}</p></div>
      ${actionMarkup}
    </header>
    ${topologyAutofixPolicyMarkup(gapToleranceMm, exactFixCount, policyFeedback)}
    <div class="load-calc-error-check__summary">
      ${diagnosticCard('Support locations', supportSiteModel?.status || 'NOT_AVAILABLE', supportSiteModel?.summary?.physicalLocationCount)}
      ${diagnosticCard('Routes', routePartitionModel?.status || 'NOT_AVAILABLE', routePartitionModel?.summary?.routeCount)}
      ${diagnosticCard('Geometry findings', findingSetStatus(geometryFindings), geometryFindings.length)}
      ${diagnosticCard('Support semantic reviews', findingSetStatus(semanticFindings), semanticFindings.length)}
      ${diagnosticCard('Certified gap auto-fixes', exactFixCount ? 'REVIEW_REQUIRED' : 'READY', exactFixCount)}
      ${diagnosticCard('Skipped findings', topologyCheck?.skippedIssueCount ? 'REVIEW_REQUIRED' : 'READY', topologyCheck?.skippedIssueCount || 0)}
    </div>
    ${modelBlockerMarkup(modelBlockers)}
    ${topologyFindingsMarkup(findings, topologyCheck, skipError)}
    ${topologyDispositionMarkup(status, topologyCheck)}
  </section>`;
}

function diagnosticCard(label, status, value) {
  const presentationStatus = status === 'READY'
    ? 'ready'
    : status === 'REVIEW_REQUIRED'
      ? 'review'
      : 'blocked';
  return `<article data-status="${presentationStatus}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(Number.isInteger(value) ? value : status)}</strong><small>${escapeHtml(status)}</small></article>`;
}

function findingSetStatus(findings) {
  if (findings.some((finding) => finding.disposition === 'BLOCK' && finding.reviewDisposition !== 'SKIPPED')) {
    return 'BLOCKED';
  }
  return findings.length ? 'REVIEW_REQUIRED' : 'READY';
}

function loadModelTopologyBlockers(supportSiteModel, routePartitionModel) {
  return [
    ...(supportSiteModel?.blockers || []),
    ...(routePartitionModel?.blockers || []),
  ];
}

function modelBlockerMarkup(blockers) {
  if (!blockers.length) return '';
  return `<section class="load-calc-error-check__group"><h3>Load-model blockers</h3>
    <ul class="load-calc-error-check__issues">${blockers.map((row) => `<li><strong>${escapeHtml(row.code || 'TOPOLOGY_BLOCKED')}</strong><span>${escapeHtml(row.message || row.path || row.routeId || row.projectDataPath || 'Topology evidence is incomplete.')}</span></li>`).join('')}</ul>
  </section>`;
}

function topologyAutofixPolicyMarkup(gapToleranceMm, exactFixCount, policyFeedback) {
  const candidateMessage = exactFixCount > 0
    ? `${exactFixCount} certified source-backed endpoint gap(s) are eligible. Select Prepare auto-fix to create a 3D draft.`
    : 'No certified source-backed endpoint gaps are eligible. Changing the limit does not make other finding types auto-fixable.';
  const autoFixTitle = exactFixCount > 0
    ? `Prepare ${exactFixCount} certified gap fix candidate(s) in 3D Edit.`
    : 'No certified source-backed endpoint gap is available at the active limit.';
  return `<section class="load-calc-topology-policy" aria-label="Automatic topology fix policy" data-topology-review-section="geometry-autofix">
    <div><strong>Automatic gap fix</strong><span>Geometry only. Set the limit first, then prepare an eligible certified 3D draft.</span></div>
    <label>Fix gaps strictly below
      <input type="number" min="0.1" max="${TOPOLOGY_EDIT_MAXIMUM_AUTOFIX_GAP_MM}" step="0.1" value="${escapeHtml(gapToleranceMm)}" data-load-calc-topology-gap-mm aria-label="Automatic gap fix tolerance in millimetres">
      mm
    </label>
    <button type="button" class="button" data-load-calc-topology-gap-apply>Set limit</button>
    <button type="button" class="button button--primary" data-load-calc-topology-autofix
      ${exactFixCount > 0 ? '' : 'disabled'} title="${escapeHtml(autoFixTitle)}">Prepare auto-fix (${escapeHtml(exactFixCount)})</button>
    <output class="load-calc-topology-policy__status" data-load-calc-topology-policy-status aria-live="polite">${escapeHtml(policyFeedback || candidateMessage)}</output>
    <small>Maximum setting: ${TOPOLOGY_EDIT_MAXIMUM_AUTOFIX_GAP_MM} mm. Gaps equal to the limit are excluded. Explicit Commit draft remains required. Support-semantic reviews are never made auto-fixable by changing this limit.</small>
  </section>`;
}

function topologyFindingsMarkup(findings, topologyCheck, skipError) {
  if (!findings.length) return '';
  const geometryFindings = findings.filter((finding) => !isSupportSemanticFinding(finding));
  const semanticFindings = findings.filter(isSupportSemanticFinding);
  return `<div class="load-calc-topology-review-sections">
    ${topologyFindingSectionMarkup({
      title: 'Geometry & gap findings',
      description: 'Geometric findings are reviewed here. Only certified source-backed positive SNAP_GAP findings below the active limit can enter AutoFix.',
      findings: geometryFindings,
      topologyCheck,
      sectionId: 'geometry',
      skipError,
    })}
    ${topologyFindingSectionMarkup({
      title: 'Support semantics — engineering review',
      description: 'These are source/classification questions. Gap tolerance and AutoFix do not apply to this section; resolve them only from source or approved master evidence.',
      findings: semanticFindings,
      topologyCheck,
      sectionId: 'support-semantics',
      skipError,
    })}
    <button type="button" class="button" data-load-calc-topology-review-download>Download review record</button>
  </div>`;
}

function topologyFindingSectionMarkup({ title, description, findings, topologyCheck, sectionId, skipError }) {
  if (!findings.length) return '';
  const exactFixIds = new Set(topologyCheck?.autoFix?.exactGapIssueIds || []);
  const groups = groupTopologyFindings(findings);
  return `<section class="load-calc-error-check__group" data-topology-review-section="${escapeHtml(sectionId)}"><h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(description)} ${findings.length} finding(s) grouped into ${groups.length} similar type(s).</p>
    <div class="load-calc-topology-groups">${groups.map((group) => topologyFindingGroupMarkup(
      group,
      exactFixIds,
      skipError,
    )).join('')}</div>
  </section>`;
}

function isSupportSemanticFinding(finding) {
  return finding?.reviewCategory === 'SUPPORT_SEMANTICS'
    || finding?.kind === 'UNKNOWN_RESTRAINT_FAMILY';
}

function groupTopologyFindings(findings) {
  const grouped = findings.reduce((groups, finding) => {
    const key = `${finding.severity}:${finding.kind}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(finding);
    return groups;
  }, new Map());
  return [...grouped.entries()]
    .map(([key, rows]) => ({ key, rows }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function topologyFindingGroupMarkup(group, exactFixIds, skipError) {
  const first = group.rows[0];
  const openCount = group.rows.filter((finding) => finding.reviewDisposition !== 'SKIPPED').length;
  const blockingCount = group.rows.filter((finding) => (
    finding.disposition === 'BLOCK' && finding.reviewDisposition !== 'SKIPPED'
  )).length;
  const skippedCount = group.rows.filter((finding) => finding.reviewDisposition === 'SKIPPED').length;
  const status = blockingCount > 0 ? 'blocked' : openCount > 0 || skippedCount > 0 ? 'review' : 'ready';
  return `<details class="load-calc-topology-group" data-status="${status}"${openCount > 0 ? ' open' : ''}>
    <summary><strong>${escapeHtml(`${first.severity} ${first.kind}`)}</strong><span>${group.rows.length} finding(s) · ${openCount} open${skippedCount ? ` · ${skippedCount} skipped` : ''}</span></summary>
    <ul class="load-calc-error-check__issues">${group.rows.map((finding) => topologyFindingRowMarkup(
      finding,
      exactFixIds.has(finding.id),
      skipError,
    )).join('')}</ul>
  </details>`;
}

const PLAIN_FINDING_GUIDANCE = Object.freeze({
  REVIEW_CERTIFIED_GAP_FIX: {
    summary: 'Two pipe ends are slightly apart. Use the certified auto-fix if one is available, or review it manually.',
    fix: 'If a certified auto-fix is listed above, apply it. Otherwise, correct the pipe endpoints in the source model so they meet within the gap tolerance, then re-import the dataset.',
  },
  CLASSIFY_RESTRAINT_FAMILY: {
    summary: "This support's type (guide, spring, hanger, anchor, etc.) isn't stated in the source data, so it needs to be classified before it can be used in the load calculation.",
    fix: 'Edit this support in the source model so one of its fields (Support Type, Support Kind, MDSSUPPTYPE, or CMPSUPTYPE) clearly states its type — e.g. Guide, Anchor, Spring, Hanger, Line Stop, or Rest — then re-import. If you already know the correct type from engineering judgment or approved master data, use Skip below to record that decision and continue.',
  },
  ENGINEERING_REVIEW: {
    summary: 'This needs an engineer to look at it.',
    fix: 'Have an engineer review this finding. If it is acceptable as-is, use Skip below to record the decision and continue.',
  },
});

function topologyFindingGuidance(finding) {
  return PLAIN_FINDING_GUIDANCE[finding.userAction] || {
    summary: finding.disposition === 'BLOCK'
      ? 'This must be resolved before you can continue.'
      : 'This needs review, but it will not stop you from continuing.',
    fix: finding.disposition === 'BLOCK'
      ? 'Resolve the underlying issue in the source model, then re-import the dataset.'
      : 'Review the finding. If it is acceptable as-is, use Skip below to record the decision and continue.',
  };
}

function topologyFindingPlainSummary(finding) {
  const { summary } = topologyFindingGuidance(finding);
  const stakes = finding.disposition === 'BLOCK'
    ? 'Blocks progress until it is resolved.'
    : 'Does not block progress, but is kept in the review record.';
  return `${summary} ${stakes}`;
}

function topologyFindingRowMarkup(finding, exactFixAvailable, skipError) {
  const scope = topologyFindingScope(finding);
  const fix = exactFixAvailable
    ? `Auto-fix candidate at ${Number(finding.distanceMm).toFixed(3)} mm`
    : finding.kind === 'SNAP_GAP'
      ? 'No certified gap fix below the current limit'
      : finding.kind === 'UNKNOWN_RESTRAINT_FAMILY'
        ? 'Source or approved master classification required; the gap limit does not apply'
        : 'Engineering review required; the gap limit does not apply';
  const disposition = finding.reviewDisposition === 'SKIPPED'
    ? `SKIPPED · ${finding.skipReason} · receipt ${finding.skipReceiptId}`
    : `${finding.disposition} · ${fix}`;
  const sourceEvidence = finding.sourceLabel
    ? `<small class="load-calc-topology-source-label">Source evidence: ${escapeHtml(finding.sourceLabel)}</small>`
    : '';
  const possibleFix = finding.reviewDisposition === 'SKIPPED'
    ? ''
    : `<p class="load-calc-topology-possible-fix"><strong>Possible fix:</strong> ${escapeHtml(topologyFindingGuidance(finding).fix)}</p>`;
  return `<li data-topology-finding-id="${escapeHtml(finding.id)}">
    <span><strong>${escapeHtml(scope)}</strong>${sourceEvidence}<p class="load-calc-topology-plain-summary">${escapeHtml(topologyFindingPlainSummary(finding))}</p>${possibleFix}<small class="load-calc-topology-technical-detail">${escapeHtml(finding.message)}</small><small>${escapeHtml(disposition)}</small></span>
    ${topologyFindingActionMarkup(finding, exactFixAvailable, skipError)}
  </li>`;
}

function topologyFindingActionMarkup(finding, exactFixAvailable, skipError) {
  if (!['BLOCK', 'REVIEW'].includes(finding.disposition) || finding.id.startsWith('system:')) return '';
  if (finding.reviewDisposition === 'SKIPPED') {
    const restoreLabel = finding.disposition === 'BLOCK' ? 'Restore blocker' : 'Restore for review';
    return `<button type="button" class="button" data-load-calc-topology-restore="${escapeHtml(finding.id)}">${restoreLabel}</button>`;
  }
  if (exactFixAvailable) return '<span class="load-calc-topology-fix-label">Use certified AutoFix above</span>';
  const error = skipError && skipError.findingId === finding.id
    ? `<p class="load-calc-topology-skip-error" role="alert">${escapeHtml(skipError.message)}</p>`
    : '';
  return `<div class="load-calc-topology-skip">
    ${error}
    <select data-load-calc-topology-skip-reason aria-label="Reason for skipping this finding">
      <option value="">Pick a reason first (required)…</option>
      <option value="CONFIRMED_VALID_SOURCE_GEOMETRY">Confirmed valid source geometry</option>
      <option value="INTENTIONAL_INDEPENDENT_SYSTEM">Intentional independent system</option>
      <option value="KNOWN_SOURCE_DATA_LIMITATION">Known source-data limitation</option>
      <option value="ACCEPTED_FOR_CURRENT_CALCULATION">Accepted for current calculation</option>
      <option value="CONFIRMED_BY_ENGINEER_OUTSIDE_TOOL">Confirmed by engineer using source or approved master data</option>
    </select>
    <button type="button" class="button" data-load-calc-topology-skip="${escapeHtml(finding.id)}">Skip</button>
  </div>`;
}

function topologyFindingScope(finding) {
  const branches = finding.sourceScope?.branchIds || [];
  const lines = finding.sourceScope?.lineKeys || [];
  if (branches.length) return `Branch ${branches.join(', ')}`;
  if (lines.length) return `Line ${lines.join(', ')}`;
  return 'Model scope';
}

function topologyStatusMessage(status, topologyCheck) {
  const skipped = topologyCheck?.skippedIssueCount || 0;
  const skippedNote = skipped ? ` ${skipped} finding(s) have been marked as reviewed and skipped.` : '';
  if (status === 'BLOCKED') {
    const count = topologyCheck?.blockingIssueCount || 0;
    return `${count} issue${count === 1 ? '' : 's'} must be fixed before you can continue.${skippedNote}`;
  }
  if (status === 'REVIEW_REQUIRED') {
    const count = topologyCheck?.reviewIssueCount || 0;
    const base = count > 0
      ? `${count} item${count === 1 ? '' : 's'} need review, but you can continue for now.`
      : 'You can continue for now.';
    return `${base}${skippedNote}`;
  }
  return 'No issues found. You can continue to the next step.';
}

function topologyDispositionMarkup(status, topologyCheck) {
  if (status === 'BLOCKED') {
    const exactFixCount = topologyCheck?.autoFix?.certifiedExactGapCount || 0;
    const gapToleranceMm = topologyCheck?.autoFix?.exactToleranceMm
      || TOPOLOGY_EDIT_DEFAULT_AUTOFIX_GAP_MM;
    const fixMessage = exactFixCount
      ? ` ${exactFixCount} source-backed gap fix(es) strictly below ${escapeHtml(gapToleranceMm)} mm can be prepared automatically.`
      : ' No source-backed automatic fix is available for the current findings.';
    const plainFix = exactFixCount
      ? ' You can use the certified auto-fix below to resolve some of them automatically.'
      : ' None of them can be fixed automatically, so they need manual attention.';
    return `<p class="load-calc-error-check__blocked-plain">Some findings must be resolved before you can continue.${plainFix}</p>`
      + `<p class="load-calc-error-check__blocked">Topology is blocked. Resolve HIGH findings and load-model prerequisites before continuing.${fixMessage}</p>`;
  }
  if (status === 'REVIEW_REQUIRED') {
    const reviewCount = topologyCheck?.reviewIssueCount || 0;
    const kindSummary = Object.entries(topologyCheck?.countsByKind || {})
      .filter(([, count]) => Number(count) > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([kind, count]) => `${count} ${kind}`)
      .join(', ');
    const gapToleranceMm = topologyCheck?.autoFix?.exactToleranceMm
      || TOPOLOGY_EDIT_DEFAULT_AUTOFIX_GAP_MM;
    const findingDetail = kindSummary ? ` (${escapeHtml(kindSummary)})` : '';
    return `<p class="load-calc-error-check__review-plain">These findings only need a review — they will not stop you from continuing. The tool cannot fix them automatically (the ${escapeHtml(gapToleranceMm)} mm gap limit does not apply to them), so each one is either corrected in the source data or signed off by you. To sign one off, open a finding below, pick a reason and press "Skip". To move on without deciding yet, press "Acknowledge review &amp; continue".</p>`
      + `<details class="load-calc-error-check__review-detail"><summary>Why these are flagged (technical)</summary>`
      + `<p class="load-calc-error-check__review">Review required: ${reviewCount} unresolved topology finding(s)${findingDetail}; ${topologyCheck?.skippedIssueCount || 0} recorded skip(s). Geometry findings remain governed by source-backed TopoFix policy. Support-semantic reviews require source or approved-master evidence and are never made repairable by changing the ${escapeHtml(gapToleranceMm)} mm gap limit. TopoFix only prepares certified positive SNAP_GAP merges strictly below that limit and never joins separate routes by inference.</p>`
      + `</details>`;
  }
  return '<p class="load-calc-error-check__passed">Topology check passed. Continue to the next step.</p>';
}

function contractSummary(distribution, supportSiteModel, routePartitionModel, authorizedExecution, authorizationState) {
  const siteStatus = supportSiteModel?.status || 'NOT_AVAILABLE';
  const routeStatus = routePartitionModel?.status || 'NOT_AVAILABLE';
  const status = distribution?.status || 'NOT_CALCULATED';
  return `<section class="load-contract-summary"><h2>Calculation authority</h2>
    <dl><dt>Support sites</dt><dd>${escapeHtml(siteStatus)}</dd><dt>Route partitions</dt><dd>${escapeHtml(routeStatus)}</dd><dt>Distribution</dt><dd>${escapeHtml(status)}</dd><dt>Authorization</dt><dd>${escapeHtml(authorizationState?.state || 'NOT_CONFIGURED')}</dd><dt>Authorization freshness</dt><dd>${escapeHtml(authorizationState?.authorizationFreshness || 'NOT_APPLICABLE')}</dd><dt>Execution freshness</dt><dd>${escapeHtml(authorizationState?.executionFreshness || 'NOT_APPLICABLE')}</dd></dl>
    ${authorizationMarkup(authorizedExecution, distribution, authorizationState)}
    ${blockerMarkup(distribution?.blockers || [...(supportSiteModel?.blockers || []), ...(routePartitionModel?.blockers || [])])}
  </section>`;
}

function authorizationMarkup(execution, distribution, authorizationState) {
  if (!execution) {
    const authority = authorizationState?.packageSemanticHash
      ? 'AUTHORIZED_HANDOFF_NOT_EXECUTED'
      : distribution ? 'UNAUTHORIZED_LEGACY_RESULT' : 'NOT_CALCULATED';
    return `<p data-empirical-authority="${authority}">Authority: ${authority}. ${escapeHtml(authorizationReason(authorizationState))}</p>${authorizationDetails(authorizationState)}`;
  }
  return `<details open data-empirical-authority="AUTHORIZED_HANDOFF">
    <summary>Authorized execution receipt: ${escapeHtml(execution.executionId)}</summary>
    <dl>
      <dt>Authorization state</dt><dd>${escapeHtml(authorizationState?.state || 'UNKNOWN')}</dd>
      <dt>Freshness</dt><dd>${escapeHtml(distribution?.freshness?.status || 'UNKNOWN')}</dd>
      <dt>Status</dt><dd>${escapeHtml(execution.status)}</dd>
      <dt>Executed</dt><dd>${escapeHtml(execution.executedAt)}</dd>
      <dt>Project</dt><dd>${escapeHtml(execution.projectId)}</dd>
      <dt>Baseline</dt><dd><code>${escapeHtml(execution.baselineSemanticHash)}</code></dd>
      <dt>Handoff</dt><dd><code>${escapeHtml(execution.handoffSemanticHash)}</code></dd>
      <dt>Projection</dt><dd><code>${escapeHtml(execution.projectionPayloadSemanticHash)}</code></dd>
      <dt>Input</dt><dd><code>${escapeHtml(execution.authorizedInputSemanticHash)}</code></dd>
      <dt>Distribution</dt><dd><code>${escapeHtml(execution.distributionSemanticHash)}</code></dd>
      <dt>Receipt</dt><dd><code>${escapeHtml(execution.semanticHash)}</code></dd>
    </dl>
    ${authorizationDetails(authorizationState)}
  </details>`;
}

function authorizationDetails(state) {
  if (!state) return '';
  const details = state.details?.length ? `<pre>${escapeHtml(JSON.stringify(state.details, null, 2))}</pre>` : '';
  return `<details ${state.calculationEligible ? '' : 'open'} class="empirical-authorization-state"><summary>${escapeHtml(state.state)}${state.reasonCode ? ` — ${escapeHtml(state.reasonCode)}` : ''}</summary>${details}</details>`;
}

function caseMarkup(distribution, supportSiteModel) {
  if (!distribution?.loadCases?.length) return '<p class="panel-empty">A current authorized empirical package is required before calculation.</p>';
  const primaryBySite = new Map((supportSiteModel?.sites || []).map((site) => [site.siteId, site.primaryEntityId]));
  const current = distribution.freshness?.status === 'CURRENT';
  return distribution.loadCases.map((loadCase) => {
    const acceptedCurrent = current && isPublishableCaseStatus(loadCase.status);
    return `<section class="load-case-evidence" data-load-case-status="${escapeHtml(loadCase.status)}">
    <h2>${escapeHtml(loadCase.loadCaseId)} <span>${escapeHtml(loadCase.status)}${current ? '' : ' / STALE'}</span></h2>
    ${completenessMarkup(loadCase.completenessAudit, loadCase.status, current)}
    ${blockerMarkup(loadCase.blockers)}
    <table><thead><tr><th>Support site</th><th>Status</th><th>Vertical force (N, source ${gravitySourceAxisLabel(distribution)})</th><th>Transfer moment demand (N·mm)</th><th>Contributors</th></tr></thead>
    <tbody>${loadCase.supportResults.map((row) => `<tr><td><button type="button" data-load-support-entity-id="${escapeHtml(primaryBySite.get(row.supportSiteId) || '')}">${escapeHtml(row.supportSiteId)}</button></td><td>${escapeHtml(row.status)}${current ? '' : ' / STALE'}</td><td>${force(row.verticalForceN, acceptedCurrent && isPublishableCaseStatus(row.status))}</td><td>${moment(row.cantileverMomentDemandNmm, acceptedCurrent && isPublishableCaseStatus(row.status))}</td><td>${integer(row.contributorIds?.length)}</td></tr>`).join('')}</tbody></table>
    <details ${loadCase.status === 'CALCULATED_WITH_EXCEPTIONS' ? 'open' : ''}><summary>Exceptions (${integer(loadCase.exceptionLedger?.length)})</summary>
      ${renderLoadCalcExceptionReview(loadCase, current, supportSiteModel)}
      <details><summary>Exact exception ledger · JSON</summary><pre>${escapeHtml(JSON.stringify(loadCase.exceptionLedger || [], null, 2))}</pre></details>
    </details>
    <details><summary>Contribution ledger (${integer(loadCase.contributionLedger?.length)})</summary><pre>${escapeHtml(JSON.stringify(loadCase.contributionLedger || [], null, 2))}</pre></details>
    <details><summary>Excluded inputs (${integer(loadCase.excludedInputs?.length)})</summary><pre>${escapeHtml(JSON.stringify(loadCase.excludedInputs || [], null, 2))}</pre></details>
    <details><summary>Equilibrium / route closure</summary><pre>${escapeHtml(JSON.stringify(loadCase.equilibrium || null, null, 2))}</pre></details>
  </section>`;
  }).join('');
}

function completenessMarkup(audit, status, current) {
  if (!audit) return '';
  const state = status === 'CALCULATED_WITH_EXCEPTIONS'
    ? 'exceptions'
    : status === 'CALCULATED'
      ? 'complete'
      : 'failed';
  return `<section class="load-case-completeness" data-completeness-state="${state}">
    <strong>${current ? 'Current result' : 'Historical result'} · ${escapeHtml(status)}</strong>
    <dl>
      <dt>Evaluated force</dt><dd>${engineeringNumber(audit.evaluatedForceN, 'N')}</dd>
      <dt>Allocated force</dt><dd>${engineeringNumber(audit.allocatedForceN, 'N')}</dd>
      <dt>Unallocated force</dt><dd>${engineeringNumber(audit.unallocatedForceN, 'N')}</dd>
      <dt>Coverage</dt><dd>${percentage(audit.coverageRatio)}</dd>
      <dt>Boundary-transfer moment</dt><dd>${engineeringNumber(audit.boundaryTransferMomentNmm, 'N·mm')}</dd>
      <dt>Unallocated first moment</dt><dd>${engineeringNumber(audit.unallocatedFirstMomentNmm, 'N·mm')}</dd>
      <dt>Exceptions</dt><dd>${integer(audit.exceptionCount)}</dd>
      <dt>Excluded inputs</dt><dd>${integer(audit.excludedContributionCount)}</dd>
    </dl>
  </section>`;
}

function blockerMarkup(blockers) {
  if (!blockers?.length) return '';
  return `<details open class="load-blockers"><summary>Blocking failures (${blockers.length})</summary><ul>${blockers.map((row) => `<li><strong>${escapeHtml(row.code || 'BLOCKED')}</strong> ${escapeHtml(row.path || row.routeId || '')} ${escapeHtml(row.message || '')}</li>`).join('')}</ul></details>`;
}

function authorizationReason(state) {
  if (!state) return 'Authorized empirical package is not configured.';
  const messages = {
    NO_ACTIVE_DATASET: 'An active normalized dataset is required.',
    EMPIRICAL_PACKAGE_REQUIRED: 'An explicitly authorized empirical package is required.',
    AUTHORIZATION_BINDINGS_CHANGED: 'The retained authorization is stale against current mechanical or authority inputs.',
    PROJECT_DATA_CHANGED: 'Project Data changed after authorization.',
    MASTER_DATA_CHANGED: 'Master data changed after authorization.',
    DATASET_EDITED: 'The active dataset changed after authorization.',
    DATASET_REBUILT: 'The active dataset model was rebuilt after authorization.',
    DATASET_REPLACED: 'A different dataset is active.',
  };
  if (messages[state.reasonCode]) return messages[state.reasonCode];
  if (state.state === 'NOT_CONFIGURED' || state.state === 'AWAITING_AUTHORIZATION') {
    return 'An explicitly authorized empirical package is required.';
  }
  if (state.state === 'BLOCKED_NOT_READY') {
    return 'The current empirical inputs are not readiness-qualified.';
  }
  if (state.state === 'AUTHORIZED_STALE' || state.state === 'EXECUTED_STALE') {
    return 'The retained authorized empirical evidence is stale.';
  }
  return state.calculationEligible === true
    ? 'Authorized empirical calculation is available.'
    : 'Authorized empirical calculation is disabled.';
}

function isPublishableCaseStatus(value) {
  return value === 'CALCULATED' || value === 'CALCULATED_WITH_EXCEPTIONS';
}

function force(value, acceptedCurrent) {
  if (!acceptedCurrent) return Number.isFinite(value) ? `${value.toFixed(3)} (HISTORICAL)` : 'FAILED';
  return Number.isFinite(value) ? value.toFixed(3) : '—';
}

function moment(value, acceptedCurrent) {
  if (!acceptedCurrent) return Number.isFinite(value) ? `${value.toFixed(3)} (HISTORICAL)` : '—';
  return Number.isFinite(value) ? value.toFixed(3) : '—';
}

function engineeringNumber(value, unit) {
  return Number.isFinite(value) ? `${value.toFixed(3)} ${unit}` : '—';
}

function percentage(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)} %` : '—';
}

function integer(value) { return Number.isInteger(value) ? String(value) : '—'; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[character]);
}
