import { renderEngineeringLoadPane } from '../load-calc-current-system-view.js';
import { renderEmpiricalScenarioResults } from '../engineering-loads/empirical-load-calc-scenario-view.js';
import { requireEmpiricalResultOverlay } from '../engineering-loads/empirical-result-overlay.js';
import { esc } from '../load-calc-preview-table.js';

/** Additional display guard; existing owners still determine engineering currentness. */
export function scenarioResultsDisplayable({ datasetId, scenario, overlay, authorizationCurrent }) {
  const { snapshot, proposal, authorization, execution, overlaySnapshot } = scenario || {};
  if (!authorizationCurrent || !datasetId || snapshot?.state !== 'EXECUTED_CURRENT'
      || !proposal?.semanticHash || !authorization?.semanticHash || !execution?.semanticHash
      || snapshot.proposalSemanticHash !== proposal.semanticHash
      || snapshot.authorizationSemanticHash !== authorization.semanticHash
      || snapshot.executionSemanticHash !== execution.semanticHash
      || proposal.adaptedRequest?.datasetId !== datasetId
      || !overlaySnapshot?.current || overlaySnapshot.state !== 'CURRENT'
      || overlaySnapshot.projectionSemanticHash !== overlay?.semanticHash
      || overlaySnapshot.executionId !== execution.executionId) return false;
  try {
    const checked = requireEmpiricalResultOverlay(overlay);
    return checked.datasetId === datasetId
      && checked.sourceBindings.proposalSemanticHash === proposal.semanticHash
      && checked.sourceBindings.authorizationSemanticHash === authorization.semanticHash
      && checked.sourceBindings.executionSemanticHash === execution.semanticHash;
  } catch { return false; }
}

/** Delegates unchanged result values/controls to their existing presentation owners. */
export function renderWorkbenchResults(container, bundle, renderers = {}) {
  container.innerHTML = `<section class="panel workbench-results"><h2>Calculated loads & separate estimates</h2>
    <p>Gravity, empirical screening and configured beam/contact results are separate evidence families.
      Missing projections are not zero. Preview edits do not change the calculation receipt.</p>
    <button type="button" data-load-calc-tab="loads">Open existing results & exception export</button>
    ${gravitySummary(bundle.distribution)}
    <details data-workbench-scenario><summary>Fv / Fa / Fl & moments — configured beam/contact scenario</summary>
      <div data-workbench-scenario-results></div></details>
    <div data-workbench-gravity></div></section>`;
  (renderers.gravity || renderEngineeringLoadPane)(container.querySelector('[data-workbench-gravity]'),
    bundle.distribution, bundle.supportSiteModel, bundle.routePartitionModel,
    bundle.authorizedExecution, bundle.authorizationState, bundle.execution, bundle.screeningContext);
  // Presentation-only folding; the full existing receipt, scope and tables stay available.
  const gravity = container.querySelector('[data-workbench-gravity]');
  for (const details of gravity.querySelectorAll?.('[data-empirical-authority], [data-load-quantity-scope]') || []) {
    details.removeAttribute('open');
  }
  const contract = gravity.querySelector('.load-contract-summary');
  if (contract && gravity.ownerDocument) {
    const fold = gravity.ownerDocument.createElement('details');
    const summary = gravity.ownerDocument.createElement('summary');
    summary.textContent = 'Gravity calculation authority & exact receipt';
    contract.replaceWith(fold); fold.append(summary, contract);
  }
  const target = container.querySelector('[data-workbench-scenario-results]');
  if (scenarioResultsDisplayable(bundle)) {
    (renderers.scenario || renderEmpiricalScenarioResults)(target, bundle.scenario);
  } else {
    target.innerHTML = `<p data-workbench-scenario-unavailable>No current configured beam/contact execution for this source.
      Scenario state: ${esc(bundle.scenario?.snapshot?.state || 'NOT_CONFIGURED')}.
      Fv (rest), Fa (line-stop), Fl (guide) and global moments require the existing method-owned restraint basis and execution;
      scalar gravity and unsigned Fh/line-stop estimates do not supply them.</p>
      <button type="button" data-load-calc-tab="restraints">Inspect existing scenario restraints</button>
      <button type="button" data-load-calc-tab="methods">Open existing scenario method & authorization</button>`;
  }
}

function gravitySummary(distribution) {
  const current = distribution?.freshness?.status === 'CURRENT';
  const cases = distribution?.loadCases || [];
  if (!cases.length) return '<p>No gravity execution is available yet. Use the existing governed Run.</p>';
  return `<section class="workbench-case-summary" aria-label="Gravity case summaries">${cases.map(row => {
    const available = current && ['CALCULATED', 'CALCULATED_WITH_EXCEPTIONS'].includes(row.status);
    const audit = available ? row.completenessAudit : null;
    return `<article><h3>${esc(row.loadCaseId)}</h3><p>${current ? 'Current' : 'Historical — rerun required'} · ${esc(row.status)}</p>
      <dl><dt>Allocated gravity</dt><dd>${displayNumber(audit?.allocatedForceN)} N</dd>
      <dt>Unallocated gravity</dt><dd>${displayNumber(audit?.unallocatedForceN)} N</dd>
      <dt>Support rows</dt><dd>${available ? (row.supportResults || []).length : 'Unavailable'}</dd>
      <dt>Exceptions</dt><dd>${displayNumber(audit?.exceptionCount, 0)}</dd></dl></article>`;
  }).join('')}</section>`;
}

function displayNumber(value, digits = 3) {
  return Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : 'Unavailable';
}
