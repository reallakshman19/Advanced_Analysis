import { projectEngineeringLoadSources } from '../core/model-loads/load-source-projection.js';
import { buildPipingPortTopologyGraph } from '../core/piping-topology/index.js';
import { projectDataEntry } from './project-data/project-data-contract.js';
import { WorkspaceState } from './workspace-state.js';
import { nonFeaEnrichmentStore } from './enrichment/non-fea-enrichment-store.js';
import { evaluateCurrentNonFeaInputCheckStatus } from './non-fea-common-input-check-adapter.js';
import { createCurrentNonFeaEnrichmentInputCheckState } from './enrichment/non-fea-enrichment-input-check-adapter.js';
import { buildLoadCalcPreview } from './load-calc-preview-model.js';
import { previewRowMarkup, esc } from './load-calc-preview-table.js';
import { applyPreviewInsulationThickness } from './load-calc-insulation-input.js';

/** Mirrors the reference Preview workflow using this application's governed preparation path. */
export function renderLoadCalcPreview(container) {
  createCurrentNonFeaEnrichmentInputCheckState();
  const { snapshot, status } = evaluateCurrentNonFeaInputCheckStatus();
  const workspace = WorkspaceState.getSnapshot();
  const enrichment = nonFeaEnrichmentStore.getSnapshot();
  const model = snapshot.request?.enrichedProjection?.enrichedModel;
  if (!model) {
    container.innerHTML = `<section class="lcp"><h2>Preview</h2><p>${esc(snapshot.error || 'Import a dataset and prepare current input before previewing.')}</p><button type="button" data-load-calc-tab="preflight">Open Input Check</button></section>`;
    return;
  }
  const projection = projectEngineeringLoadSources(model, buildPipingPortTopologyGraph(model), {
    lengthUnitFallback: projectDataEntry(snapshot.request.projectDataProfile, 'sourcesAndUnits.lengthUnit'),
  });
  const stale = enrichment.stale || snapshot.staleness?.stale;
  const rows = buildLoadCalcPreview({ components: projection.components, entities: workspace.dataset.entities,
    proposals: enrichment.proposals, methodRows: status.commonInput.methodRows, stale });
  container.innerHTML = previewShell(rows, snapshot, enrichment, stale);
  bindPreviewFilters(container, rows);
  bindInsulationInputs(container, workspace.dataset.sharedModel);
}

function previewShell(rows, snapshot, enrichment, stale) {
  const branches = [...new Set(rows.map((row) => row.branchId))].filter(Boolean).sort();
  return `${styles()}<section class="lcp" data-role="load-calc-preview">
    <header><div><small>SOURCE → EFFECTIVE INPUT → PROPOSED MATCH</small><h2>Preview</h2><p>Consolidated review · patterned on XML→CII 2019 “4 Preview”</p></div>
      <div class="lcp-actions"><button type="button" data-load-calc-weight-review>Weights & contents…</button><button type="button" data-load-calc-tab="enrichment">Review proposed matches</button><button type="button" data-load-calc-tab="preflight">Input Check</button></div></header>
    <div class="lcp-metrics"><span><b>${rows.length}</b> components</span><span><b>${rows.filter((row) => row.needsReview).length}</b> need review</span><span><b>${enrichment.proposals.length}</b> proposed fields</span><span><b>${enrichment.acceptedRecords.length}</b> accepted records</span><span><b>${stale ? 'Stale' : 'Current'}</b> input evidence</span></div>
    <p class="lcp-boundary">Insulation thickness is editable in the effective-input column. Missing thickness uses an explicit 0 mm fallback (uninsulated), not a blocker. Positive thickness needs density. Source/master/entered values retain their governed precedence. Apply updates current input and invalidates the previous seal; it does not calculate support loads. Weight-review skips do not supply zero.</p>
    <div class="lcp-tools"><label>Search<input data-preview-search type="search" placeholder="Entity, branch, line, description"></label><label>Branch<select data-preview-branch><option value="">All branches</option>${branches.map((id) => `<option>${esc(id)}</option>`).join('')}</select></label><label>Show<select data-preview-filter><option value="all">All components</option><option value="review">Needs review</option><option value="proposed">Proposed matches</option><option value="fittings">Fittings</option><option value="pipes">Pipes</option></select></label><label>Weight case<select data-preview-case><option>EMPTY</option><option>OPE</option><option>HYD</option></select></label></div>
    <p data-preview-count role="status" aria-live="polite"></p><div class="lcp-table" tabindex="0" role="region" aria-label="Source and weight comparison"><table><thead><tr><th>Entity / branch</th><th>Source basis</th><th>Effective section</th><th>Proposed master · not applied</th><th>Weight evidence · kg</th><th>Review status / trace</th></tr></thead><tbody data-preview-rows></tbody></table></div>
    <details class="lcp-binding"><summary>Current input binding</summary><p>Request ${esc(snapshot.request.semanticHash)}<br>Report ${esc(snapshot.report?.semanticHash || 'Not evaluated')}<br>Source ${esc(enrichment.currentSourceSemanticHash)}</p></details>
  </section>`;
}

function bindPreviewFilters(container, rows) {
  const render = () => {
    const query = container.querySelector('[data-preview-search]').value.trim().toLowerCase();
    const branch = container.querySelector('[data-preview-branch]').value;
    const filter = container.querySelector('[data-preview-filter]').value;
    const caseId = container.querySelector('[data-preview-case]').value;
    const shown = rows.filter((row) => (!branch || row.branchId === branch)
      && `${row.entityId} ${row.branchId} ${row.component.identity?.lineId} ${row.type} ${row.description}`.toLowerCase().includes(query)
      && (filter === 'all' || (filter === 'review' && row.needsReview) || (filter === 'proposed' && row.proposed.length)
        || (filter === 'pipes' && row.type === 'PIPE') || (filter === 'fittings' && row.type !== 'PIPE')));
    container.querySelector('[data-preview-count]').textContent = `${shown.length} of ${rows.length} components · ${caseId} weight evidence · support loads not calculated here`;
    container.querySelector('[data-preview-rows]').innerHTML = shown.map((row) => previewRowMarkup(row, caseId)).join('') || '<tr><td colspan="6">No matching components.</td></tr>';
  };
  container.querySelector('[data-preview-search]').addEventListener('input', render);
  container.querySelectorAll('.lcp-tools select').forEach((select) => select.addEventListener('change', render));
  render();
}

function bindInsulationInputs(container, sourceModel) {
  const rows = container.querySelector('[data-preview-rows]');
  const apply = (form, text) => {
    const filters = [...container.querySelectorAll('.lcp-tools input,.lcp-tools select')].map((input) => input.value);
    try {
      applyPreviewInsulationThickness({ store: nonFeaEnrichmentStore, sourceModel,
        entityId: form.dataset.previewInsulation, text });
      renderLoadCalcPreview(container);
      [...container.querySelectorAll('.lcp-tools input,.lcp-tools select')].forEach((input, index) => { input.value = filters[index]; });
      container.querySelector('[data-preview-search]').dispatchEvent(new Event('input'));
    } catch (error) {
      form.querySelector('[data-insulation-status]').textContent = error.message;
    }
  };
  rows.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-preview-insulation]');
    if (!form) return;
    event.preventDefault();
    apply(form, form.elements.thickness.value);
  });
  rows.addEventListener('click', (event) => {
    const reset = event.target.closest('[data-preview-insulation-reset]');
    if (reset) apply(reset.closest('form'), '');
  });
}

function styles() {
  // Constrain the implicit shell grid track only while this narrow preview is open.
  const narrowShell = '<style>@media(max-width:760px){.application-shell:has([data-role="load-calc-preview"]){grid-template-columns:minmax(0,1fr)}}</style>';
  return `${narrowShell}<style>.lcp{padding:16px;color:#e2e8f0;font:12px system-ui;min-width:0}.lcp header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.lcp h2{font-size:24px;margin:4px 0}.lcp header small{color:#38bdf8;letter-spacing:.8px}.lcp p{line-height:1.5}.lcp-actions,.lcp-tools,.lcp-metrics{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.lcp button,.lcp input,.lcp select{background:#101c2f;color:#e2e8f0;border:1px solid #334155;border-radius:5px;padding:7px;font:inherit}.lcp button,.lcp summary{cursor:pointer}.lcp button:focus-visible,.lcp input:focus-visible,.lcp select:focus-visible,.lcp summary:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}.lcp-metrics{margin:12px 0}.lcp-metrics>span{padding:10px;background:#101c2f;border:1px solid #334155;border-radius:6px}.lcp-metrics b{color:#7dd3fc;font-size:16px;margin-right:5px}.lcp-boundary{padding:10px;background:#102b40;border-left:3px solid #38bdf8;color:#bae6fd}.lcp-tools label{display:grid;gap:4px;color:#94a3b8}.lcp-tools input{width:210px}.lcp-tools select{max-width:260px}.lcp-table{overflow:auto;max-height:58vh;border:1px solid #334155;border-radius:7px}.lcp table{border-collapse:collapse;width:100%;min-width:1040px;font-size:11px}.lcp th{position:sticky;top:0;background:#142036;text-align:left;padding:10px;color:#93c5fd;z-index:1}.lcp td{padding:10px;vertical-align:top;border-top:1px solid #26354a;max-width:260px;overflow-wrap:anywhere}.lcp td:nth-child(1){min-width:160px}.lcp td:nth-child(2){min-width:155px}.lcp td span{display:block;margin-bottom:5px}.lcp td small{display:block;color:#94a3b8;margin:5px 0;line-height:1.5}.lcp td details{margin-top:10px}.lcp td details p{font-size:10px;color:#94a3b8}.lcp-warn{color:#fbbf24}.lcp-ok{color:#34d399}.lcp-binding{margin-top:12px;overflow-wrap:anywhere}.lcp-binding p{color:#94a3b8}.lcp [data-preview-count]{color:#94a3b8}@media(max-width:760px){.workspace-shell:has([data-role="load-calc-preview"]){grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr);height:100%;min-height:0;overflow:hidden}.workspace-shell:has([data-role="load-calc-preview"])>.tree-panel,.workspace-shell:has([data-role="load-calc-preview"])>.properties-panel,.workspace-shell:has([data-role="load-calc-preview"])>.panel-resizer{display:none}.application-view--workspace:has([data-role="load-calc-preview"]){min-width:0;width:100%}.lcp-table:focus-visible{outline:2px solid #38bdf8;outline-offset:-2px}}@media(max-width:650px){.lcp{padding:10px}.lcp-table{max-height:45vh}.lcp-tools select{max-width:220px}}</style>`;
}
