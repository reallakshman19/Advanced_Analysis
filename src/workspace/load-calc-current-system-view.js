import {
  renderEngineeringLoadPane as renderLegacyEngineeringLoadPane,
  renderLoadCalcConsumer as renderLegacyLoadCalcConsumer,
  renderLoadCalcTopologyPane as renderLegacyLoadCalcTopologyPane,
} from './load-calc-consumer-view.js';
import { classifyLoadCalcResultPresentation } from './load-calc-result-presentation.js';

const CURRENT_SYSTEM_AUTHORITY = 'CURRENT_COMMON_INPUT_SYSTEM_RUN';
const PRODUCT_PRIMARY_TABS = new Set(['topology', 'project-data', 'masters', 'enrichment', 'preflight', 'verify', 'loads']);
const LEGACY_ADVANCED_VIEW_COUNT = 11;

export const LOAD_CALC_PRIMARY_WORKFLOW_V1 = Object.freeze([
  Object.freeze({ id: 'import',     label: 'Import',                 selector: '[data-load-calc-import]',              tab: null }),
  Object.freeze({ id: 'topology',   label: 'Check Topology',         selector: '[data-load-calc-tab="topology"]',      tab: 'topology' }),
  Object.freeze({ id: 'defaults',   label: 'Calculation Defaults',   selector: '[data-load-calc-tab="project-data"]',  tab: 'project-data' }),
  Object.freeze({ id: 'masters',    label: 'Master Data',            selector: '[data-load-calc-tab="masters"]',       tab: 'masters' }),
  Object.freeze({ id: 'enrichment', label: 'Enrichment & Overrides', selector: '[data-load-calc-tab="enrichment"]',    tab: 'enrichment' }),
  Object.freeze({ id: 'preflight',  label: 'Input Check',            selector: '[data-load-calc-tab="preflight"]',     tab: 'preflight' }),
  Object.freeze({ id: 'run',        label: 'Run',                    selector: '[data-load-calc-tab="verify"]',        tab: 'verify' }),
  Object.freeze({ id: 'results',    label: 'Results',                selector: '[data-load-calc-tab="loads"]',         tab: 'loads' }),
]);

/** Tabs moved into the primary workflow bar; ADV no longer promotes them. */
export const LOAD_CALC_PROMOTED_ADVANCED_TABS_V1 = Object.freeze([]);

export function renderLoadCalcConsumer(documentRef, state) {
  const routineReady = isRoutineRunReady(state?.commonInputState);
  const currentExecution = state?.currentCommonInputExecution || null;
  const scenarioReady = state?.empiricalScenarioState?.calculationEligible === true;
  const routineAttemptAvailable = !scenarioReady && isRoutineRunAttemptAvailable(state);
  const projectedAuthorization = !scenarioReady && routineReady
    ? {
        ...(state?.authorizationState || {}),
        state: currentExecution ? 'EXECUTED_CURRENT_SYSTEM' : 'ROUTINE_SYSTEM_READY',
        calculationEligible: true,
        reasonCode: null,
        authorizationFreshness: 'CURRENT',
        executionFreshness: currentExecution ? 'CURRENT' : 'NOT_APPLICABLE',
      }
    : state?.authorizationState;
  const section = renderLegacyLoadCalcConsumer(documentRef, {
    ...state,
    authorizationState: projectedAuthorization,
  });

  if (!scenarioReady && routineAttemptAvailable && typeof section?.querySelector === 'function') {
    const button = section.querySelector('[data-load-calc-run]');
    if (button) {
      button.disabled = false;
      button.removeAttribute?.('disabled');
      button.title = routineReady
        ? 'Execute the current governed gravity calculation from READY Common Input.'
        : 'Build and validate current effective inputs, create the READY-only system seal and Run authorization, then execute. Non-READY input fails closed.';
      button.textContent = '▶ Run Load Calc — Gravity';
    }
    const facts = section.querySelectorAll?.('.empirical-load-calc__facts [data-pill-status]') || [];
    const authorityPill = facts[1];
    if (authorityPill) {
      authorityPill.dataset.pillStatus = routineReady ? 'ok' : 'warn';
      authorityPill.textContent = currentExecution
        ? 'System run current ✓'
        : routineReady
          ? 'Routine run ready ✓'
          : 'Run will validate & authorize';
    }
    if (!state?.message && !routineReady) {
      const output = section.querySelector('[data-engineering-load-status]');
      if (output) {
        output.textContent = 'Run will resolve current effective values, validate READY, system-seal, authorize and execute automatically.';
      }
    }
  }
  applyCurrentSystemResultPresentation(section, state, currentExecution);
  convergeFiveStepWorkflow(section, state);
  return section;
}

function applyCurrentSystemResultPresentation(section, state, currentExecution) {
  if (!currentExecution || typeof section?.querySelector !== 'function') return;
  const rawPresentation = classifyLoadCalcResultPresentation(state?.distribution);
  const overallPresentation = classifyLoadCalcResultPresentation(
    state?.distribution,
    currentExecution,
  );
  if (rawPresentation === overallPresentation) return;
  const output = section.querySelector('[data-engineering-load-status]');
  if (output && (!state?.message || state.message === rawPresentation.message)) {
    output.textContent = overallPresentation.message;
  }
}

export function renderLoadCalcTopologyPane(
  container,
  supportSiteModel,
  routePartitionModel,
  topologyCheck,
  policyFeedback,
  skipError = null,
) {
  renderLegacyLoadCalcTopologyPane(
    container,
    supportSiteModel,
    routePartitionModel,
    topologyCheck,
    policyFeedback,
    skipError,
  );
  if (typeof container?.innerHTML !== 'string') return;
  container.innerHTML = container.innerHTML
    .replace('<h2>Topology Fix</h2>', '<h2>Check Topology</h2>')
    .replaceAll('Continue to Project Data', 'Continue to Calculation Defaults');
}

export function renderEngineeringLoadPane(
  container,
  distribution,
  supportSiteModel,
  routePartitionModel,
  authorizedExecution = null,
  authorizationState = null,
  currentCommonInputExecution = null,
) {
  if (!currentCommonInputExecution) {
    renderLegacyEngineeringLoadPane(
      container,
      distribution,
      supportSiteModel,
      routePartitionModel,
      authorizedExecution,
      authorizationState,
    );
    return;
  }

  const systemState = {
    ...(authorizationState || {}),
    state: 'EXECUTED_CURRENT_SYSTEM',
    calculationEligible: true,
    reasonCode: null,
    authorizationFreshness: 'CURRENT',
    executionFreshness: 'CURRENT',
    packageSemanticHash: null,
  };
  renderLegacyEngineeringLoadPane(
    container,
    distribution,
    supportSiteModel,
    routePartitionModel,
    null,
    systemState,
  );
  const legacyAuthority = /<p data-empirical-authority="UNAUTHORIZED_LEGACY_RESULT">[\s\S]*?<\/p>/u;
  if (!legacyAuthority.test(container.innerHTML)) {
    throw codedError(
      'Current-system Load Calc presentation could not locate the legacy authority placeholder.',
      'CURRENT_COMMON_INPUT_SYSTEM_PRESENTATION_PLACEHOLDER_MISSING',
    );
  }
  container.innerHTML = container.innerHTML.replace(
    legacyAuthority,
    currentSystemExecutionMarkup(currentCommonInputExecution, distribution),
  );
}

/**
 * Fully validated routine readiness. This is intentionally stricter than
 * isRoutineRunAttemptAvailable(): READY status may only come from the checker
 * report or a current READY seal.
 */
export function isRoutineRunReady(commonState) {
  if (commonState?.error) return false;
  const commonInput = commonState?.commonInput;
  const currentReadySeal = commonInput
    && commonState?.staleness?.stale === false
    && commonInput.packageState === 'READY'
    && nonemptyArray(commonInput.sealedMethodIds)
    && emptyArray(commonInput.blockedMethodIds);
  if (currentReadySeal) return true;

  const report = commonState?.report;
  return report?.packageState === 'READY'
    && nonemptyArray(report.readyMethodIds)
    && emptyArray(report.blockedMethodIds);
}

/**
 * Product one-click availability. Once a dataset and its canonical topology are
 * structurally ready, the user may request Run without first visiting Input
 * Check / Seal / Authorize. The runtime still builds/evaluates Common Input and
 * requires a fully READY system seal before authorization or numerical work.
 */
export function isRoutineRunAttemptAvailable(state) {
  const readiness = state?.workflowReadiness || {};
  return readiness.datasetReady === true && readiness.topologyCheckReady === true;
}

function convergeFiveStepWorkflow(section, state) {
  if (typeof section?.querySelector !== 'function') return;
  const workflow = section.querySelector('.empirical-load-calc__workflow');
  if (!workflow) {
    throw codedError('Load Calc product workflow root is missing.', 'LOAD_CALC_FIVE_STEP_WORKFLOW_ROOT_MISSING');
  }

  // Masters and preflight are now in the primary bar, so no buttons are removed.
  // LOAD_CALC_PROMOTED_ADVANCED_TABS_V1 is empty; this loop is intentionally a no-op.
  for (const row of LOAD_CALC_PROMOTED_ADVANCED_TABS_V1) {
    const legacyButton = workflow.querySelector(
      `button.empirical-load-calc__workflow-step[data-load-calc-tab="${row.tab}"]`,
    );
    if (!legacyButton) {
      throw codedError(
        `Load Calc legacy ${row.tab} workflow entry is missing.`,
        'LOAD_CALC_FIVE_STEP_PROMOTION_SOURCE_MISSING',
      );
    }
    legacyButton.remove();
  }

  // Inject the Enrichment & Overrides step before preflight — it has no legacy
  // button in the 7-step render so we create one and insert it in order.
  const preflightButton = workflow.querySelector(
    'button.empirical-load-calc__workflow-step[data-load-calc-tab="preflight"]',
  );
  if (!preflightButton) {
    throw codedError(
      'Load Calc legacy preflight workflow entry is missing.',
      'LOAD_CALC_EIGHT_STEP_PREFLIGHT_MISSING',
    );
  }
  if (!workflow.querySelector('button.empirical-load-calc__workflow-step[data-load-calc-tab="enrichment"]')) {
    preflightButton.insertAdjacentHTML(
      'beforebegin',
      '<button type="button" class="empirical-load-calc__workflow-step" ' +
      'data-load-calc-tab="enrichment" data-step-state="pending" aria-current="false">' +
      '<span class="empirical-load-calc__workflow-index">?</span>' +
      '<span class="empirical-load-calc__workflow-label">Enrichment &amp; Overrides</span>' +
      '<span class="empirical-load-calc__workflow-status">Available</span>' +
      '</button>',
    );
  }

  LOAD_CALC_PRIMARY_WORKFLOW_V1.forEach((step, index) => {
    const button = workflow.querySelector(`button.empirical-load-calc__workflow-step${step.selector}`);
    if (!button) {
      throw codedError(
        `Load Calc primary workflow entry is missing: ${step.id}.`,
        'LOAD_CALC_FIVE_STEP_PRIMARY_ENTRY_MISSING',
      );
    }
    const indexNode = button.querySelector('.empirical-load-calc__workflow-index');
    const labelNode = button.querySelector('.empirical-load-calc__workflow-label');
    if (!indexNode || !labelNode) {
      throw codedError(
        `Load Calc primary workflow markup is incomplete: ${step.id}.`,
        'LOAD_CALC_FIVE_STEP_PRIMARY_MARKUP_INVALID',
      );
    }
    indexNode.textContent = String(index + 1);
    labelNode.textContent = step.label;
  });
  normalizeTopologyStatus(workflow, state);
  normalizeCalculationDefaultsStatus(workflow, state);
  normalizeEnrichmentStatus(workflow, state);
  normalizeOneClickRunStatus(workflow, state);

  const advanced = workflow.querySelector('details.empirical-load-calc__advanced');
  const summary = advanced?.querySelector('summary.empirical-load-calc__workflow-step');
  const advancedNav = advanced?.querySelector('nav.empirical-load-calc__tabs');
  if (!advanced || !summary || !advancedNav || typeof advancedNav.insertAdjacentHTML !== 'function') {
    throw codedError(
      'Load Calc Advanced tools markup is unavailable for secondary diagnostics.',
      'LOAD_CALC_FIVE_STEP_ADVANCED_MARKUP_INVALID',
    );
  }
  // Engineering-inputs group (masters, preflight) now lives in the primary bar —
  // do not re-insert it into ADV. The Setup group (overview, enrichment) remains.

  const advancedActive = Boolean(state?.activeTab) && !PRODUCT_PRIMARY_TABS.has(state.activeTab);
  advanced.open = advancedActive;
  summary.classList.toggle('is-active', advancedActive);
  summary.dataset.stepState = advancedActive ? 'current' : 'pending';
  const advancedIndex = summary.querySelector('.empirical-load-calc__workflow-index');
  const advancedLabel = summary.querySelector('.empirical-load-calc__workflow-label');
  const advancedStatus = summary.querySelector('.empirical-load-calc__workflow-status');
  if (advancedIndex) advancedIndex.textContent = 'ADV';
  if (advancedLabel) advancedLabel.textContent = 'Advanced tools';
  if (advancedStatus && !advancedActive) {
    advancedStatus.textContent = `${LEGACY_ADVANCED_VIEW_COUNT} views`;
  }

  const runButton = section.querySelector('[data-load-calc-run]');
  const output = section.querySelector('[data-engineering-load-status]');
  if (runButton?.title === 'Check Verify & Run tab — some inputs are missing') {
    runButton.title = 'Open Input Check (step 6) or Run tab — some inputs are missing';
  }
  if (output?.textContent === 'Check Verify & Run tab — some inputs are missing') {
    output.textContent = 'Open Input Check (step 6) or Run tab — some inputs are missing';
  }
}

function normalizeTopologyStatus(workflow, state) {
  const button = workflow.querySelector(
    'button.empirical-load-calc__workflow-step[data-load-calc-tab="topology"]',
  );
  const status = button?.querySelector('.empirical-load-calc__workflow-status');
  if (!button || !status) return;
  const readiness = state?.workflowReadiness || {};
  if (readiness.datasetReady !== true) {
    button.dataset.stepState = 'pending';
    status.textContent = 'After import';
    return;
  }
  const blockers = readiness.topologyBlockerCount ?? 0;
  const openReview = readiness.topologyOpenReviewCount ?? 0;
  const skipped = readiness.topologySkippedCount ?? 0;
  // Blockers = hard failures (structural topology not valid)
  if (blockers > 0) {
    button.dataset.stepState = 'ready';
    status.textContent = `${blockers} blocker${blockers === 1 ? '' : 's'}`;
    return;
  }
  // Open (unreviewed, unskipped) semantic reviews — user must act
  if (openReview > 0) {
    button.dataset.stepState = 'ready';
    status.textContent = `${openReview} to review`;
    return;
  }
  // Only skipped findings — not blocking, just acknowledged
  if (skipped > 0) {
    button.dataset.stepState = 'complete';
    status.textContent = `${skipped} skipped`;
    return;
  }
  // All clear
  button.dataset.stepState = 'complete';
  status.textContent = 'Done';
}

function normalizeCalculationDefaultsStatus(workflow, state) {
  const button = workflow.querySelector(
    'button.empirical-load-calc__workflow-step[data-load-calc-tab="project-data"]',
  );
  const status = button?.querySelector('.empirical-load-calc__workflow-status');
  if (!button || !status) return;
  const readiness = state?.workflowReadiness || {};
  if (readiness.datasetReady !== true) {
    button.dataset.stepState = 'pending';
    status.textContent = 'After import';
    return;
  }
  if (readiness.topologyCheckReady !== true) {
    button.dataset.stepState = 'pending';
    status.textContent = 'After topology';
    return;
  }
  // Use projectDataBlockerCodes (live projection, real hashes) so STALE_SOURCE_HASH
  // is correctly detected. Falls back to the null-hash count before checker has run.
  const pdCodes = readiness.projectDataBlockerCodes ?? [];
  const hasCodes = pdCodes.length > 0;
  // Pre-checker: fall back to projectDataActionCount (null-hash validation)
  const preCheckerIssues = !readiness.validationEvaluated && (readiness.projectDataActionCount ?? 0);
  const allClear = !hasCodes && !preCheckerIssues;

  const active = state?.activeTab === 'project-data';
  if (allClear) {
    button.dataset.stepState = active ? 'current' : 'complete';
    status.textContent = 'Done';
    return;
  }

  button.dataset.stepState = active ? 'current' : 'ready';
  if (hasCodes) {
    const hasMissing = pdCodes.includes('MISSING_VALUE');
    const hasStale = pdCodes.includes('STALE_SOURCE_HASH');
    if (hasMissing && hasStale) {
      status.textContent = `${pdCodes.length} issues`;
    } else if (hasStale) {
      status.textContent = 'Source stale';
    } else if (hasMissing) {
      status.textContent = 'Fields missing';
    } else {
      status.textContent = `${pdCodes.length} issue${pdCodes.length === 1 ? '' : 's'}`;
    }
  } else {
    const n = preCheckerIssues || 0;
    status.textContent = n > 0 ? `${n} issue${n === 1 ? '' : 's'}` : 'Issues';
  }
}

function normalizeEnrichmentStatus(workflow, state) {
  const button = workflow.querySelector(
    'button.empirical-load-calc__workflow-step[data-load-calc-tab="enrichment"]',
  );
  const status = button?.querySelector('.empirical-load-calc__workflow-status');
  if (!button || !status) return;
  const readiness = state?.workflowReadiness || {};
  if (readiness.datasetReady !== true) {
    button.dataset.stepState = 'pending';
    status.textContent = 'After import';
    return;
  }
  if (readiness.masterDataReady !== true) {
    button.dataset.stepState = 'pending';
    status.textContent = 'After masters';
    return;
  }

  // enrichmentUnresolvedCount is null when clear; a number when MASS_COVERAGE is blocked.
  const unresolved = readiness.enrichmentUnresolvedCount ?? null;
  const active = state?.activeTab === 'enrichment';

  if (unresolved === null) {
    button.dataset.stepState = active ? 'current' : 'complete';
    status.textContent = 'Done';
    return;
  }

  button.dataset.stepState = active ? 'current' : 'ready';
  status.textContent = `${unresolved} unresolved`;
}

function normalizeOneClickRunStatus(workflow, state) {
  if (state?.empiricalScenarioState?.calculationEligible === true) return;
  if (!isRoutineRunAttemptAvailable(state)) return;
  if (state?.workflowReadiness?.resultsCurrent === true) return;
  const button = workflow.querySelector(
    'button.empirical-load-calc__workflow-step[data-load-calc-tab="verify"]',
  );
  const status = button?.querySelector('.empirical-load-calc__workflow-status');
  if (!button || !status) return;
  const active = state?.activeTab === 'verify';
  button.dataset.stepState = active ? 'current' : 'ready';
  status.textContent = isRoutineRunReady(state?.commonInputState) ? 'Ready' : 'One-click';
}


function currentSystemExecutionMarkup(execution, distribution) {
  const retention = execution?.explicitMomentRetention || null;
  const retainedMoments = Array.isArray(retention?.records) ? retention.records : [];
  const overallStatus = execution?.resultStatus || distribution?.status || 'UNKNOWN';
  const verticalStatus = distribution?.status || 'UNKNOWN';
  return `<details open data-empirical-authority="${CURRENT_SYSTEM_AUTHORITY}">
    <summary>Current Common Input system-run receipt</summary>
    <dl>
      <dt>Authority</dt><dd>${CURRENT_SYSTEM_AUTHORITY}</dd>
      <dt>Freshness</dt><dd>${escapeHtml(distribution?.freshness?.status || 'UNKNOWN')}</dd>
      <dt>Overall result</dt><dd>${escapeHtml(overallStatus)}</dd>
      <dt>Vertical reaction distribution</dt><dd>${escapeHtml(verticalStatus)}</dd>
      <dt>Method</dt><dd>${escapeHtml(execution.executedMethod || execution.requestedMethod || distribution?.method || 'UNKNOWN')}</dd>
      <dt>Project</dt><dd>${escapeHtml(execution.projectId || 'NOT_SET')}</dd>
      <dt>Dataset</dt><dd>${escapeHtml(execution.datasetId || 'UNKNOWN')}</dd>
      <dt>Separate source-moment demands</dt><dd>${retainedMoments.length}</dd>
      <dt>Moment retention</dt><dd><code>${escapeHtml(execution.explicitMomentRetentionSemanticHash || 'NOT_APPLICABLE')}</code></dd>
      <dt>Common Input</dt><dd><code>${escapeHtml(execution.commonInputSemanticHash)}</code></dd>
      <dt>Common Input seal</dt><dd><code>${escapeHtml(execution.commonInputSealSemanticHash)}</code></dd>
      <dt>Run authorization</dt><dd><code>${escapeHtml(execution.runAuthorizationSemanticHash)}</code></dd>
      <dt>Mass projection</dt><dd><code>${escapeHtml(execution.massProjectionSemanticHash)}</code></dd>
      <dt>Distribution</dt><dd><code>${escapeHtml(execution.distributionSemanticHash)}</code></dd>
      <dt>Receipt</dt><dd><code>${escapeHtml(execution.semanticHash)}</code></dd>
    </dl>
    ${explicitMomentDemandMarkup(retainedMoments)}
    <p>System-generated routine Run evidence. Retained source-explicit component moments are separate support/civil demands and are not distributed into vertical reactions. No legacy published baseline, handoff, or human approval is asserted.</p>
  </details>`;
}

function explicitMomentDemandMarkup(records) {
  if (!records.length) return '';
  return `<section data-current-system-explicit-moment-demands>
    <h4>Retained source-explicit component moments</h4>
    <table>
      <thead><tr><th>Entity</th><th>Route</th><th>Chainage</th><th>Axis</th><th>Moment</th><th>Reaction treatment</th></tr></thead>
      <tbody>${records.map((row) => `<tr>
        <td>${escapeHtml(row.entityId)}</td>
        <td>${escapeHtml(row.routeId)}</td>
        <td>${escapeHtml(row.applicationChainageMm)} mm</td>
        <td>${escapeHtml(row.axis)}</td>
        <td>${escapeHtml(row.magnitudeNm)} N·m</td>
        <td>${escapeHtml(row.verticalReactionDistribution || 'NOT_PERFORMED')}</td>
      </tr>`).join('')}</tbody>
    </table>
  </section>`;
}

function nonemptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function emptyArray(value) {
  return Array.isArray(value) && value.length === 0;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[character]);
}

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}