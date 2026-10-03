import { draftSupportLoadsModel } from './draft-support-loads.js';
import { esc } from '../load-calc-preview-table.js';
import { APPLICATION_EVENTS, EVENT_TOPICS } from '../event-topics.js';
import { ENGINEERING_MODEL_EVENTS } from '../engineering-model-controller.js';
import { EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS } from '../engineering-loads/empirical-load-calc-scenario-controller.js';
import { nonFeaCommonInputStore } from '../non-fea-common-input-store.js';

const mounted = new WeakMap();

/** Disposable inspector. Never serializes loads into the draft/journal/source. */
export function mountDraftLoadsInspector(controller, getResults) {
  const existing = mounted.get(controller);
  if (existing?.element.isConnected) { existing.render(); return existing; }
  existing?.destroy();
  const host = controller.hostElement?.querySelector('[data-role="topology-edit-sidecar"]');
  if (!host || !controller.editorStore) throw new Error('3D Draft property panel is not available.');
  const element = host.ownerDocument.createElement('section');
  element.dataset.role = 'draft-calculated-support-loads';
  element.setAttribute('aria-label', 'Calculated support loads');
  element.className = 'draft-support-load-card';
  element.style.cssText = 'padding:12px;border:1px solid #25638d;border-radius:8px;background:#0d2134;color:#e2e8f0;margin-bottom:10px;font-size:12px;';
  host.prepend(element);
  let loadCaseId = 'OPE', destroyed = false;
  function render() {
    if (destroyed) return;
    const model = draftSupportLoadsModel(getResults(), { dataset: controller.workspaceDataset,
      canonical: controller.session?.currentTopology(), baseCanonical: controller.session?.baseCanonicalTopology,
      staleReason: controller.session?.staleReason }, controller.editorStore.getState().selection.canonicalIds);
    const cases = [...new Set(model.supports.flatMap(s => [...s.gravity, ...s.scenario].map(r => r.loadCaseId)))];
    if (!cases.includes(loadCaseId)) loadCaseId = cases.includes('OPE') ? 'OPE' : cases[0];
    element.innerHTML = `<h3 style="margin:0 0 6px;color:#7dd3fc">Calculated support loads</h3><p role="status">${esc(model.message)}</p>
      ${model.state === 'CURRENT' ? `<label>Case <select data-draft-load-case aria-label="Support load case">${cases.map(c => `<option ${c === loadCaseId ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      ${model.supports.map(s => supportMarkup(s, loadCaseId, model)).join('')}` : ''}
      <button type="button" data-draft-loads-back>Back to results</button>`;
  }
  const onChange = event => { if (event.target.matches('[data-draft-load-case]')) { loadCaseId = event.target.value; render(); } };
  const onClick = event => { if (event.target.closest('[data-draft-loads-back]')) controller.eventBus.publish(EVENT_TOPICS.LOAD_CALC_SUBTAB_REQUESTED, { tab: 'workbench' }); };
  element.addEventListener('change', onChange); element.addEventListener('click', onClick);
  const unsubscribers = [controller.editorStore.subscribe(render), nonFeaCommonInputStore.subscribe(render),
    ...[APPLICATION_EVENTS.CONTEXT_CHANGED, ENGINEERING_MODEL_EVENTS.CHANGED,
      EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS.CHANGED, EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS.RESULT_OVERLAY_CHANGED]
      .map(topic => controller.eventBus.subscribe(topic, render))];
  const runtime = { element, render, destroy() {
    if (destroyed) return; destroyed = true;
    unsubscribers.forEach(unsubscribe => unsubscribe());
    element.removeEventListener('change', onChange); element.removeEventListener('click', onClick);
    element.remove(); mounted.delete(controller);
  } };
  controller.unsubscribers.push(() => runtime.destroy());
  mounted.set(controller, runtime); render(); return runtime;
}

export function supportMarkup(support, caseId, model) {
  const row = support.gravity.find(r => r.loadCaseId === caseId);
  const vectors = support.scenario.filter(r => r.loadCaseId === caseId);
  return `<article style="margin:10px 0;padding-top:8px;border-top:1px solid #334155"><strong>${esc(support.label)}</strong>
    <small style="display:block;overflow-wrap:anywhere;color:#94a3b8">${esc(support.siteId)}</small>
    <h4 style="margin:8px 0">Gravity · ${esc(caseId || 'No case')}</h4>
    <p style="font-size:18px;margin:5px 0">Vertical: <strong>${number(row?.verticalForceN)} N</strong></p>
    <small>${esc(row?.status || 'Not available for this case')} · ${row?.contributors == null ? 'No current contributor data' : `${row.contributors} contributors`}</small>
    <table aria-label="Gravity loads for ${esc(support.label)}" style="width:100%;margin:8px 0;border-collapse:collapse"><thead><tr><th>Case</th><th>Vertical (N)</th></tr></thead><tbody>${support.gravity.map(r => `<tr><td>${esc(r.loadCaseId)}</td><td style="text-align:right">${number(r.verticalForceN)}</td></tr>`).join('')}</tbody></table>
    <p style="color:#94a3b8">${esc(model.sourceAxisBasis || 'Gravity unavailable')} · Gravity is separate from a solved force/moment vector.</p>
    <h4 style="margin:8px 0">Scenario forces & moments</h4>${vectors.length ? vectors.map(r => `<p>${esc(r.restraintId)} · ${esc(r.resultClass)} · ${esc(r.contactState)}</p>
      <table aria-label="Scenario loads for ${esc(support.label)}" style="width:100%"><tbody>
      ${[['Fv · rest', r.Fv, 'N'], ['Fa · line stop', r.Fa, 'N'], ['Fl · guide', r.Fl, 'N'],
        ['Fx', r.forceN.x, 'N'], ['Fy', r.forceN.y, 'N'], ['Fz', r.forceN.z, 'N'],
        ['Mx', r.momentNm.x, 'N·m'], ['My', r.momentNm.y, 'N·m'], ['Mz', r.momentNm.z, 'N·m']]
        .map(([label, value, unit]) => `<tr><td>${label}</td><td style="text-align:right">${number(value)} ${unit}</td></tr>`).join('')}</tbody></table>`).join('')
      : '<p>Fa, Fl and global moments: not calculated for this support/case.</p>'}
    ${caseId === 'OPE' && support.screening?.status === 'SCREENING_ESTIMATE'
      ? `<h4>OPE screening estimates — not reactions</h4><p>Fh · guide: <strong>${number(support.screening.terms.guide.guideH)} N</strong></p>
        <p>Line-stop estimate: <strong>${number(support.screening.terms.lineStopN)} N</strong></p>
        <small>${esc(support.screening.matchMethod)} · OD ${number(support.screening.inputs.outsideDiameterMm)} mm · wall ${number(support.screening.inputs.wallThicknessMm)} mm · ${number(support.screening.inputs.temperatureC)} °C.
        No support type or force direction is assigned.</small>`
      : `<p>Fh: separate screening estimate, not supplied as a calculated reaction here.</p>
        ${caseId === 'OPE' && support.screening?.reasons?.length ? `<small>${esc(support.screening.reasons.join(' '))}</small>` : ''}`}
    <details><summary>Load basis</summary><p>Source members: ${esc(support.memberEntityIds.join(', '))}</p>
    <p>Gravity transfer moment: ${number(row?.transferMomentNmm)} N·mm (chainage demand, not a solved global moment).</p>
    <p>Gravity receipt: ${esc(model.gravityExecutionHash || 'Unavailable')}</p><p>Scenario receipt: ${esc(model.scenarioExecutionHash || 'Unavailable')}</p>
    ${model.forceConvention ? `<p>Scenario signs: ${esc(model.forceConvention)} / ${esc(model.momentConvention)}</p>` : ''}</details></article>`;
}

function number(value) { return Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 3 }) : 'Unavailable'; }
