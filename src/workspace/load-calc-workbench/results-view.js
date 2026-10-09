import { renderEngineeringLoadPane } from '../load-calc-current-system-view.js';
import { renderEmpiricalScenarioResults } from '../engineering-loads/empirical-load-calc-scenario-view.js';
import { requireEmpiricalResultOverlay } from '../engineering-loads/empirical-result-overlay.js';
import { esc } from '../load-calc-preview-table.js';
import { requireCurrentGravityReceipt, unallocatedGravityPaths } from './result-evidence.js';

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
  let exportable = false;
  try { requireCurrentGravityReceipt(bundle); exportable = true; } catch { /* Withhold stale export. */ }
  container.innerHTML = `<section class="panel workbench-results"><h2>Calculated loads & separate estimates</h2>
    <p>Gravity, empirical screening and configured beam/contact results are separate evidence families.
      Missing projections are not zero. Preview edits do not change the calculation receipt.</p>
    <button type="button" data-load-calc-tab="seal-export">Export current input evidence</button>
    <button type="button" data-workbench-gravity-export ${exportable ? '' : 'disabled'}>Download calculated gravity JSON</button>
    <button type="button" data-workbench-loads-to-draft ${exportable || scenarioResultsDisplayable(bundle) ? '' : 'disabled'}>Loads to 3D Draft</button>
    <button type="button" data-load-calc-support-mapping>Review missing support mappings · SVG</button>
    ${gravitySummary(bundle.distribution)}
    ${unallocatedMarkup(bundle.distribution)}
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
      <button type="button" data-load-calc-tab="scenario-setup">Set up calculation scenario</button>
      <button type="button" data-load-calc-tab="methods">Open existing scenario method & authorization</button>`;
  }
}

function unallocatedMarkup(distribution) {
  const rows = unallocatedGravityPaths(distribution);
  if (!rows.length) return '';
  return `<details><summary>Unallocated gravity paths · ${rows.length} case/route entries</summary>
    <p>The existing method found no qualified route-local vertical support for these contributions.
    A bearing on another branch is not automatically a load-transfer path. Loads remain in the receipt, not discarded.</p>
    <button type="button" data-load-calc-tab="topology">Inspect supports & topology</button>
    <div class="table-scroll"><table><thead><tr><th>Case</th><th>Route</th><th>Unallocated N</th><th>Source components</th></tr></thead><tbody>
    ${rows.map(row => `<tr><td>${esc(row.loadCaseId)}</td><td>${esc(row.routeId)}</td><td>${displayNumber(row.forceN)}</td>
    <td>${row.entityIds.map(id => `<button type="button" data-load-support-entity-id="${esc(id)}">${esc(id)}</button>`).join(' ')}</td></tr>`).join('')}</tbody></table></div></details>`;
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
