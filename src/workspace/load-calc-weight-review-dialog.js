import { projectEngineeringLoadSources } from '../core/model-loads/load-source-projection.js';
import { evidenceNumber } from '../core/model-loads/units.js';
import { buildPipingPortTopologyGraph } from '../core/piping-topology/index.js';
import { projectDataEntry } from './project-data/project-data-contract.js';
import { buildWeightReviewRows, weightReviewMassValues, WeightReviewSession } from './load-calc-weight-review-model.js';
import { readWeightReviewPolicy } from './load-calc-weight-review-scope.js';
import { openWeightReviewSettings } from './load-calc-weight-review-settings.js';
import { WorkspaceState } from './workspace-state.js';

const session = new WeightReviewSession();
const value = (evidence) => evidenceNumber(evidence);
const number = (n) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 3 }) : '—';
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);

export function openWeightReviewDialog({ documentRef, snapshot, status, getSnapshot }) {
  documentRef.querySelector('[data-role="weight-review-dialog"]')?.close();
  const request = snapshot.request;
  if (!request) throw new Error('Open Input Check to prepare the current mass evidence first.');
  const model = request.enrichedProjection.enrichedModel;
  const projection = projectEngineeringLoadSources(model, buildPipingPortTopologyGraph(model), {
    lengthUnitFallback: projectDataEntry(request.projectDataProfile, 'sourcesAndUnits.lengthUnit'),
  });
  const rows = buildWeightReviewRows({ components: projection.components,
    entities: WorkspaceState.getSnapshot().dataset?.entities || [],
    methodRows: status.commonInput.methodRows, loadCaseIds: ['EMPTY', 'OPE', 'HYD'] })
    .filter((row) => row.manualReviewRequired);
  const binding = `${request.semanticHash}:${snapshot.report?.semanticHash}:${JSON.stringify(readWeightReviewPolicy())}`;
  session.bind(binding);
  const previousFocus = documentRef.activeElement;
  const dialog = documentRef.createElement('dialog');
  dialog.dataset.role = 'weight-review-dialog';
  dialog.className = 'lcwr';
  dialog.setAttribute('aria-labelledby', 'lcwr-title');
  const missingRows = rows.filter((row) => row.missing.length);
  const counts = Object.entries(missingRows.reduce((result, row) => {
    result[row.type] = (result[row.type] || 0) + 1; return result;
  }, {})).map(([type, count]) => `${count} ${type}`).join(' · ');
  dialog.innerHTML = `${styles()}<header><div><small>WEIGHT & CONTENTS · CURRENT INPUT</small><h2 id="lcwr-title">Weight review</h2></div><button type="button" data-close aria-label="Close weight review">✕</button></header>
    <p class="lcwr-banner">Equipment review uses your selected families; instrument bore must be above ${readWeightReviewPolicy().instrumentAboveMm} mm (unknown bore stays visible). ${missingRows.length} unresolved review items${counts ? `: ${escape(counts)}` : ''}. Standard fittings use the existing automatic weight path; missing gasket weight defaults to 0 kg.</p><button type="button" data-weight-settings>Weight review settings…</button>
    <div class="lcwr-tools"><label>Find entity / branch<input data-search type="search" placeholder="Entity ID, type or branch"></label><label>Show<select data-filter><option value="all">All review items</option><option value="unresolved">Unresolved review items</option><option value="skipped">Skipped review</option></select></label><label>Load case<select data-case><option>EMPTY</option><option>OPE</option><option>HYD</option></select></label></div>
    <p class="lcwr-progress" data-progress></p><div class="lcwr-items" data-weight-items></div>
    <section class="lcwr-detail" data-detail><strong>Inspect a row to see its section, densities and derivation basis.</strong></section>
    <p class="lcwr-note" role="status" aria-live="polite" data-note></p>
    <footer><span>Skips defer review only. They do not exclude mass, supply zero, accept a section, seal inputs or unblock Run. Retained for this candidate in this session.</span><button type="button" data-close>Close</button></footer>`;
  documentRef.body.appendChild(dialog);
  let caseId = 'EMPTY';
  let selectedId = null;
  const current = () => {
    const live = getSnapshot();
    return binding === `${live.request?.semanticHash}:${live.report?.semanticHash}:${JSON.stringify(readWeightReviewPolicy())}`;
  };
  const note = (text) => { dialog.querySelector('[data-note]').textContent = text; };
  function renderRows() {
    const search = dialog.querySelector('[data-search]').value.trim().toLowerCase();
    const filter = dialog.querySelector('[data-filter]').value;
    const shown = rows.filter((row) => (filter === 'all' || (filter === 'skipped' ? session.skipped.has(row.entityId) : row.missing.length))
      && `${row.entityId} ${row.type} ${row.branchId}`.toLowerCase().includes(search));
    dialog.querySelector('[data-progress]').textContent = `${shown.length} review items shown · ${missingRows.length} unresolved review items · ${session.skipped.size} skipped review · ${request.requestedLoadCases.join(', ')} requested. Displayed case is an observational preview, not execution.`;
    const openIds = new Set([...dialog.querySelectorAll('[data-weight-item][open]')].map((item) => item.dataset.weightItem));
    dialog.querySelector('[data-weight-items]').innerHTML = shown.map((row) => collapsedWeightRowMarkup(row, caseId, session.skipped.get(row.entityId), openIds.has(row.entityId))).join('') || '<p>No matching entities.</p>';
    if (selectedId && !shown.some((row) => row.entityId === selectedId)) {
      selectedId = null;
      dialog.querySelector('[data-detail]').textContent = 'Inspect a row to see its section, densities and derivation basis.';
    }
    if (selectedId) renderDetail(rows.find((row) => row.entityId === selectedId));
  }
  function renderDetail(row) {
    if (!row) return;
    const p = row.component.engineeringProperties;
    const fields = [['OD mm', 'outerDiameterMm'], ['Wall mm', 'wallThicknessMm'], ['Metal density kg/m³', 'materialDensityKgM3'], ['OPE fluid density kg/m³', 'fluidDensityOpeKgM3'], ['HYD fluid density kg/m³', 'fluidDensityHydKgM3'], ['Insulation thickness mm', 'insulationThicknessMm'], ['Insulation density kg/m³', 'insulationDensityKgM3']];
    dialog.querySelector('[data-detail]').innerHTML = `<strong>${escape(row.entityId)} · ${escape(row.type)}</strong><div class="lcwr-facts">${fields.map(([label, key]) => { const own = value(p[key]); const inherited = own === null ? row.derived?.derivation?.[key] : null; return `<span>${label}<b>${number(own ?? inherited)}</b>${inherited != null ? '<small>Derivation section</small>' : ''}</span>`; }).join('')}<span>Source length m<b>${number(row.component.geometry.sourceLengthM)}</b></span></div><p>${row.type === 'PIPE' ? 'Existing pipe resolver: section/density or direct kg/m, plus case fluid and insulation, multiplied by source length.' : row.derived ? `Existing dry-metal derivation: ${escape(row.derived.derivation.sourceComponentKey)} · effective length ${number(row.derived.derivation.developedLengthM)} m · factor ${row.derived.derivation.developedLengthFactor} × OD${row.derived.derivation.developedLengthFactorAssumed ? ' (ASSUMED — not standards-qualified)' : ''}.` : 'No derived dry mass available. Pipe-like fitting derivation requires a resolved pipe section on the same branch; caps have no automatic derivation.'}</p>${row.type !== 'PIPE' ? '<p>Fitting core mass is dry point mass only. Explicit contained-fluid evidence is shown separately and added later by Common projection. Fitting insulation is not derived here. A point application location is still required.</p>' : ''}`;
  }
  dialog.addEventListener('input', (event) => { if (event.target.matches('[data-search]')) renderRows(); });
  dialog.addEventListener('change', (event) => {
    if (event.target.matches('[data-case]')) caseId = event.target.value;
    if (event.target.matches('[data-case], [data-filter]')) renderRows();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-weight-settings]')) {
      openWeightReviewSettings({ documentRef, onApplied: () => { dialog.close(); openWeightReviewDialog({ documentRef, snapshot: getSnapshot(), status, getSnapshot }); } }); return;
    }
    const summary = event.target.closest('[data-weight-item] > summary');
    if (summary) { selectedId = summary.parentElement.dataset.weightItem; renderDetail(rows.find((row) => row.entityId === selectedId)); }
    if (event.target.closest('[data-close]')) return dialog.close();
    const inspect = event.target.closest('[data-inspect]');
    if (inspect) { selectedId = inspect.dataset.inspect; renderDetail(rows.find((row) => row.entityId === selectedId)); return; }
    const action = event.target.closest('[data-skip], [data-restore]');
    if (!action) return;
    if (!current()) { note('Current input changed. Close and reopen this review; no skip was recorded.'); return; }
    try {
      if (action.dataset.restore) session.restore(action.dataset.restore);
      else session.skip(binding, action.dataset.skip, action.closest('tr').querySelector('[data-reason]').value, rows);
      note('Review updated. Engineering inputs and calculation readiness are unchanged.'); renderRows();
    } catch (error) { note(error.message); }
  });
  dialog.addEventListener('close', () => { dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus(); }, { once: true });
  renderRows();
  dialog.showModal();
  return dialog;
}

function rowMarkup(row, caseId, skippedReason) {
  const result = row.cases[caseId];
  const mass = weightReviewMassValues(row, caseId);
  return `<tr class="${skippedReason ? 'lcwr-skipped' : ''}"><td><button type="button" data-inspect="${escape(row.entityId)}">${escape(row.entityId)}</button><small>${escape(row.branchId || 'No branch')}</small></td><td>${escape(row.type)}</td><td>${number(mass.metalKg)}</td><td>${number(mass.fluidKg)}</td><td>${number(mass.insulationKg)}</td><td>${number(mass.coreMassKg)}${mass.dryOnly ? '<small>dry only</small>' : ''}</td><td>${escape(row.missing.join(', ') || 'Coverage satisfied')}<small>${escape(result.ok ? 'Resolver available · not execution' : result.blockers.join(', '))}</small></td><td>${row.missing.length ? skippedReason ? `<strong>Skipped review</strong><small>${escape(skippedReason)}</small><button type="button" data-restore="${escape(row.entityId)}" aria-label="Restore ${escape(row.entityId)}">Restore</button>` : `<input data-reason placeholder="Reason for deferral" aria-label="Skip reason ${escape(row.entityId)}"><button type="button" data-skip="${escape(row.entityId)}" aria-label="Skip ${escape(row.entityId)}">Skip review</button>` : 'No mass-coverage deferral needed'}</td></tr>`;
}

export function collapsedWeightRowMarkup(row, caseId, skippedReason, open = false) {
  const mass = weightReviewMassValues(row, caseId);
  const amount = (n) => Number.isFinite(n) ? `${number(n)} kg` : 'Pending';
  const sectionNote = fittingSectionReviewNote(row);
  return `<details class="lcwr-item" data-weight-item="${escape(row.entityId)}" ${open ? 'open' : ''}><summary><strong>${escape(row.entityId)}</strong><span>${escape(row.type)}</span><span>Dry/metal: ${amount(mass.metalKg)}${row.derived?.derivation.developedLengthFactorAssumed ? ' (estimate)' : ''}</span><span>Fluid: ${amount(mass.fluidKg)}</span><span>Insulation: ${row.type === 'PIPE' ? amount(mass.insulationKg) : 'Not derived'}</span><span>${escape(caseId)} core${mass.dryOnly ? ' (dry)' : ''}: ${amount(mass.coreMassKg)}</span><small>${escape(skippedReason ? 'Skipped review · still unresolved' : row.cases[caseId].ok ? 'Resolver available · not execution' : row.cases[caseId].blockers.join(', '))}${sectionNote ? ` · ${escape(sectionNote)}` : ''}</small></summary><div class="lcwr-table"><table><thead><tr><th>Entity / branch</th><th>Type</th><th>Dry/metal kg</th><th>Fluid kg</th><th>Insulation kg</th><th>Core mass kg</th><th>Missing / resolver status</th><th>Review action</th></tr></thead><tbody>${rowMarkup(row, caseId, skippedReason)}</tbody></table></div></details>`;
}

function fittingSectionReviewNote(row) {
  if (row.derived || row.sectionReview?.code === 'NOT_APPLICABLE'
      || row.sectionReview?.code === 'EXPLICIT_COMPONENT_WEIGHT') return '';
  const labels = {
    CONFLICTING_BRANCH_PIPE_SECTIONS: 'Conflicting pipe sections on this branch; no fitting weight borrowed',
    INCOMPLETE_BRANCH_PIPE_SECTION: 'Incomplete pipe section on this branch; fitting weight unresolved',
    INVALID_BRANCH_PIPE_SECTION: 'Invalid pipe section on this branch; fitting weight unresolved',
    MISSING_PIPE_BRANCH: 'No branch evidence for fitting section reuse',
    MISSING_BRANCH_PIPE_SECTION: 'No pipe section on this branch',
    MISSING_MATCHING_PIPE_BORE_SECTION: 'No resolved pipe section matching the source fitting bore',
    INVALID_SOURCE_PIPE_BORE: 'Invalid source fitting bore; no pipe weight borrowed',
    CONFLICTING_SOURCE_PIPE_BORES: 'Conflicting source port bores; no pipe weight borrowed',
  };
  return labels[row.sectionReview?.code] || '';
}

function styles() {
  return `<style>.lcwr-items{max-height:40vh;overflow:auto}.lcwr-item{border:1px solid #293548;border-radius:7px;margin:7px 0}.lcwr-item>summary{cursor:pointer;display:flex;align-items:center;flex-wrap:wrap;gap:7px 12px;padding:11px;background:#101b2d}.lcwr-item>summary:before{content:'▸';color:#38bdf8}.lcwr-item[open]>summary:before{content:'▾'}.lcwr-item>summary strong{flex:1 1 200px;overflow-wrap:anywhere}.lcwr-item>summary span{font-size:12px;color:#bae6fd}.lcwr-item>summary small{flex-basis:100%;color:#fbbf24}.lcwr-item>summary:focus-visible{outline:2px solid #38bdf8;outline-offset:-2px}.lcwr{width:min(1320px,94vw);max-height:90vh;overflow:auto;box-sizing:border-box;background:#0b1424;color:#e2e8f0;border:1px solid #334155;border-radius:12px;padding:18px;font:13px system-ui;box-shadow:0 24px 70px #0009}.lcwr::backdrop{background:#020610bf}.lcwr header,.lcwr footer,.lcwr-tools{display:flex;gap:12px;align-items:center;justify-content:space-between}.lcwr h2{margin:3px 0;font-size:22px}.lcwr small{display:block;color:#94a3b8;font-size:11px;overflow-wrap:anywhere}.lcwr header small{color:#38bdf8;letter-spacing:1px}.lcwr button,.lcwr input,.lcwr select{border:1px solid #334155;border-radius:5px;background:#111c2f;color:#e2e8f0;padding:7px;box-sizing:border-box;font:inherit}.lcwr button{cursor:pointer}.lcwr button:hover{border-color:#38bdf8}.lcwr button:focus-visible,.lcwr input:focus-visible,.lcwr select:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}.lcwr-banner{background:#082f49;border:1px solid #155e75;border-radius:7px;padding:10px;line-height:1.5}.lcwr-tools{justify-content:flex-start;flex-wrap:wrap}.lcwr-tools label{display:grid;gap:4px;color:#94a3b8}.lcwr-tools input{width:240px}.lcwr-progress{color:#94a3b8}.lcwr-table{overflow:auto;border:1px solid #293548;border-radius:7px}.lcwr table{width:100%;border-collapse:collapse;min-width:950px;font-size:12px}.lcwr th{background:#101b2d;color:#94a3b8;text-align:left;padding:9px}.lcwr td{padding:9px;border-top:1px solid #26354a;vertical-align:top}.lcwr td:first-child button{border:0;color:#7dd3fc;padding:0;background:none;text-align:left}.lcwr td:last-child{min-width:150px}.lcwr td:last-child input{width:160px;display:block;margin-bottom:4px}.lcwr-skipped{background:#261e10}.lcwr-skipped strong,.lcwr-note{color:#fbbf24}.lcwr-detail{margin-top:12px;padding:10px;background:#101b2d;border-radius:7px}.lcwr-detail p{color:#94a3b8;font-size:12px;margin:7px 0 0}.lcwr-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px;color:#94a3b8;font-size:11px}.lcwr-facts b{display:block;color:#e2e8f0;font-size:13px}.lcwr-note{min-height:16px}.lcwr footer{font-size:11px;color:#94a3b8}.lcwr footer span{max-width:1000px}@media(max-width:650px){.lcwr{padding:12px;max-height:94vh;width:96vw}.lcwr-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.lcwr-items{max-height:30vh}.lcwr-tools input{width:210px}.lcwr header h2{font-size:19px}}</style>`;
}
