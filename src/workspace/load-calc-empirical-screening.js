import { calculateSupportLoadScreeningTerms, DEFAULT_SUPPORT_LOAD_PROFILE,
  SUPPORT_LOAD_FORMULA_TEXT } from '../calc-workspace/supportLoadEngine.js';
import { buildAutomaticEmpiricalScreening } from './load-calc-empirical-screening-binding.js';

/** Read-only candidate references. Never replace a missing OPE row with EMPTY/HYD. */
export function empiricalScreeningReferences(distribution) {
  if (distribution?.freshness?.status !== 'CURRENT'
    || !['CHAINAGE_TRIBUTARY_SPAN_V2', 'CHAINAGE_TRIBUTARY_SPAN_V3_COG'].includes(distribution.method)) return [];
  const cases = (distribution.loadCases || []).filter(row => row.loadCaseId === 'OPE');
  if (cases.length !== 1 || !publishable(cases[0].status)) return [];
  const rows = cases[0].supportResults || [];
  const ids = rows.map(row => row.supportSiteId);
  return rows.filter(row => typeof row.supportSiteId === 'string' && row.supportSiteId
    && ids.filter(id => id === row.supportSiteId).length === 1
    && publishable(row.status) && Number.isFinite(row.verticalForceN) && row.verticalForceN >= 0)
    .map(row => ({ supportSiteId: row.supportSiteId, tags: row.tags || [], opeVerticalN: row.verticalForceN }));
}

export function renderEmpiricalScreeningPreview(distribution, context) {
  if (!distribution?.loadCases?.length) return '';
  const refs = empiricalScreeningReferences(distribution);
  const automatic = context ? buildAutomaticEmpiricalScreening(refs, distribution, context) : null;
  const initial = automatic?.rows.find(row => row.status === 'SCREENING_ESTIMATE');
  return `<style>.empirical-screen{padding:14px;border:1px solid #334155;border-radius:8px;margin:14px 0;background:#101c2f}
    .empirical-screen summary{cursor:pointer;color:#7dd3fc}.empirical-screen p{line-height:1.5}
    .empirical-screen .screen-inputs,.empirical-screen .screen-profile{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
    .empirical-screen label{display:grid;gap:4px;font-size:12px}.empirical-screen input,.empirical-screen select{background:#0b1424;color:#e2e8f0;border:1px solid #475569;padding:7px;border-radius:4px;max-width:100%}
    .empirical-screen input{width:150px}.empirical-screen pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}
    .empirical-screen output{display:block;padding:10px;border-left:3px solid #38bdf8;background:#0b1424;line-height:1.6}
    .empirical-screen :focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
    .empirical-screen .screen-table{overflow:auto;max-height:38vh}.empirical-screen table{border-collapse:collapse;min-width:760px;width:100%;font-size:11px}
    .empirical-screen th,.empirical-screen td{padding:8px;border-bottom:1px solid #334155;text-align:left;vertical-align:top}
    .empirical-screen th{position:sticky;top:0;background:#17243a}.empirical-screen td{overflow-wrap:anywhere;max-width:280px}
    .empirical-screen button{background:#17243a;color:#e2e8f0;border:1px solid #475569;padding:7px;border-radius:4px;cursor:pointer}</style>
    <details class="empirical-screen" data-empirical-screen><summary>Fh / line-stop — existing empirical screening preview</summary>
      <p>Reuse the existing temperature/wall-weighted formula. Exact current pipe and operating-temperature inputs
        populate automatically where unambiguous. Editable inputs below are local what-if values. This selection is a reference, not an automatic
        guide-to-rest assignment. Local what-if inputs do not change the source, seal, gravity receipt or solver.
        Estimates are unsigned; not global FX/FY, Fa/Fl projections, friction reactions or code compliance.</p>
      ${automatic ? automaticTable(automatic) : ''}
      <div class="screen-inputs">
        <label>OPE reference demand<select data-screen-reference aria-label="OPE reference demand"><option value="">Select a current OPE row</option>
          ${refs.map(row => `<option value="${esc(row.supportSiteId)}"${initial?.supportSiteId === row.supportSiteId ? ' selected' : ''}>${esc(row.tags.join(', ') || row.supportSiteId)} · ${row.opeVerticalN.toFixed(3)} N</option>`).join('')}</select></label>
        <label>Outside diameter (mm)<input type="number" step="any" min="0" data-screen-input="outsideDiameterMm" aria-label="Screening outside diameter in millimetres"></label>
        <label>Wall thickness (mm)<input type="number" step="any" min="0" data-screen-input="wallThicknessMm" aria-label="Screening wall thickness in millimetres"></label>
        <label>Operating temperature (°C)<input type="number" step="any" data-screen-input="temperatureC" aria-label="Screening operating temperature in Celsius"></label>
      </div>
      ${automatic ? '<button type="button" data-screen-restore>Restore automatic pipe inputs</button><p data-screen-provenance aria-live="polite"></p>' : ''}
      <details><summary>Existing formula profile — visible, editable what-if values</summary>
        <p>Profile ACCESS_TEMP_WALL_WEIGHTED_V1. The existing carbon-steel temperature-ratio table is retained;
          this preview does not approve a material grade or qualify that table for the selected line.</p>
        <div class="screen-profile">${Object.entries(DEFAULT_SUPPORT_LOAD_PROFILE).filter(([, value]) => typeof value === 'number')
          .map(([key, value]) => `<label>${esc(key)}<input type="number" min="0" step="any" value="${value}" data-screen-profile="${key}" aria-label="Screening profile ${key}"></label>`).join('')}
          <label>Rounding<select data-screen-profile="roundMode" aria-label="Screening rounding mode"><option value="up">up</option><option value="nearest">nearest</option><option value="down">down</option></select></label>
          <label>Inside diameter expression<select data-screen-profile="lineStopIdExpression" aria-label="Screening inside diameter expression"><option value="D_MINUS_2WT">D − 2 × wall (existing)</option><option value="D_MINUS_WT">D − wall (what-if)</option></select></label>
        </div><pre>${esc(SUPPORT_LOAD_FORMULA_TEXT)}</pre>
        <p>Profile edits use the equation's parameterized coefficients; the displayed equation above documents the existing default values.</p>
      </details>
      <output data-screen-result aria-live="polite">${refs.length ? 'Select an OPE reference and enter the section / temperature. Missing screening inputs do not block gravity.'
        : 'No current, publishable OPE reference is available. Historical/failed or lift-off rows cannot supply this preview; gravity is unchanged.'}</output>
      <small>Source: docs/pre-review_non FEA_prority1_implementation_plan.md · src/calc-workspace/supportLoadEngine.js.
        Preview is discarded whenever Results is refreshed; it is not exported as a calculated reaction.</small>
    </details>`;
}

export function bindEmpiricalScreeningPreview(container, distribution, context) {
  const root = container.querySelector?.('[data-empirical-screen]');
  if (!root) return;
  const refs = new Map(empiricalScreeningReferences(distribution).map(row => [row.supportSiteId, row]));
  const automatic = context ? buildAutomaticEmpiricalScreening([...refs.values()], distribution, context) : null;
  const reference = root.querySelector('[data-screen-reference]');
  const restore = () => {
    const row = automatic?.rows.find(item => item.supportSiteId === reference.value);
    root.querySelectorAll('[data-screen-input]').forEach(field => { field.value = row?.inputs[field.dataset.screenInput] ?? ''; });
  };
  const update = () => {
    const output = root.querySelector('[data-screen-result]');
    const ref = refs.get(reference.value);
    const provenance = automatic ? root.querySelector('[data-screen-provenance]') : null;
    if (provenance) provenance.textContent = '';
    if (!ref) { output.textContent = 'Select a current OPE reference. No screening magnitude evaluated.'; return; }
    const input = { opeVerticalN: ref.opeVerticalN };
    root.querySelectorAll('[data-screen-input]').forEach(field => { input[field.dataset.screenInput] = numeric(field.value); });
    if (provenance) {
      const row = automatic.rows.find(item => item.supportSiteId === ref.supportSiteId);
      const matches = row && Object.keys(row.inputs).every(key => row.inputs[key] === input[key]);
      provenance.textContent = matches ? bindingText(row)
        : 'LOCAL WHAT-IF — values differ from automatic inputs. No source/master/receipt is updated. Restore automatic pipe inputs to discard these edits.';
    }
    const profile = { ...DEFAULT_SUPPORT_LOAD_PROFILE, configSource: 'VISIBLE_LOCAL_WHAT_IF_NOT_PROJECT_AUTHORITY' };
    root.querySelectorAll('[data-screen-profile]').forEach(field => {
      const key = field.dataset.screenProfile;
      profile[key] = typeof DEFAULT_SUPPORT_LOAD_PROFILE[key] === 'number' ? numeric(field.value) : field.value;
    });
    try {
      const result = calculateSupportLoadScreeningTerms(input, profile);
      output.textContent = `Reference: ${ref.supportSiteId} · OPE ${ref.opeVerticalN.toFixed(3)} N. `
        + (result.guide ? `Fh guide estimate ${result.guide.guideH.toFixed(3)} N; raw wall/temperature term ${result.guide.rawN.toFixed(3)} N; rounded term ${result.guide.roundedGuideH.toFixed(3)} N; minimum ${result.guide.minimumOpeVerticalN.toFixed(3)} N. `
          : 'Fh not evaluated — finite temperature, positive wall and a valid section are required. ')
        + (result.lineStopN !== null ? `Line-stop estimate ${result.lineStopN.toFixed(3)} N. `
          : 'Line-stop not evaluated — outside diameter, wall and temperature are required. ')
        + (result.temperatureClamped ? 'Temperature lies outside 0–500 °C; existing table endpoint clamping was used. ' : '')
        + `Inputs: OD ${input.outsideDiameterMm ?? 'missing'} mm; wall ${input.wallThicknessMm ?? 'missing'} mm; T ${input.temperatureC ?? 'missing'} °C. Screening only — not solved reactions.`;
    } catch (error) { output.textContent = `Screening not evaluated: ${error.message} Gravity results are unchanged.`; }
  };
  root.addEventListener('input', update);
  root.addEventListener('change', event => { if (automatic && event?.target === reference) restore(); update(); });
  if (automatic) {
    root.querySelector('[data-screen-restore]')?.addEventListener('click', () => { restore(); update(); });
    restore(); update();
  }
}

function automaticTable(automatic) {
  return `<h4>Automatic per-support screening estimates</h4><p data-screen-auto-summary>${automatic.summary.estimated} of ${automatic.summary.total} OPE references estimated · ${automatic.summary.unresolved} unresolved.
    Missing matches are row-local and do not block gravity. These are hypothetical guide/stop demands, not assigned restraints.
    Table uses the existing default profile displayed below; profile edits affect only the selected local preview.
    Sealed OD/wall evidence does not approve material grade or thermal properties.</p>
    <div class="screen-table" role="region" tabindex="0" aria-label="Automatic empirical screening estimates"><table><thead><tr><th>Support / OPE (N)</th><th>Pipe / line</th><th>OD / wall (mm) / operating °C</th><th>Fh estimate (N)</th><th>Line-stop estimate (N)</th><th>Source / unresolved reason</th></tr></thead>
    <tbody>${automatic.rows.map(row => `<tr data-screen-auto-row="${esc(row.supportSiteId)}"><td>${esc(row.tags.join(', ') || row.supportSiteId)}<br>${row.opeVerticalN.toFixed(3)}</td>
      <td>${esc(row.pipeId || (row.matchMethod === 'EXACT_STRAIGHT_JOIN_SHARED_INPUTS' && row.status === 'SCREENING_ESTIMATE' ? 'Shared straight-join section (2 pipes)' : 'Unresolved'))}<br>${esc(row.lineKey || '')}</td>
      <td>${esc(row.inputs.outsideDiameterMm ?? '—')} / ${esc(row.inputs.wallThicknessMm ?? '—')} / ${esc(row.inputs.temperatureC ?? '—')}</td>
      <td>${row.terms?.guide ? row.terms.guide.guideH.toFixed(3) : 'Not evaluated'}</td><td>${row.terms?.lineStopN != null ? row.terms.lineStopN.toFixed(3) : 'Not evaluated'}</td>
      <td>${esc(row.status)}<details><summary>Input sources / match details</summary><p>${esc(bindingText(row))}</p><pre>${esc(JSON.stringify({ provenance: row.provenance, candidatePipeIds: row.candidatePipeIds }, null, 2))}</pre></details></td></tr>`).join('')}</tbody></table></div>`;
}

function bindingText(row) {
  if (!row) return 'No automatic binding for this reference.';
  const temperature = row.provenance.temperatureC;
  return `${row.matchMethod === 'EXACT_STRAIGHT_JOIN_SHARED_INPUTS' ? `Shared straight-join inputs from ${row.candidatePipeIds.join(' and ')}; no unique pipe host selected` : `Pipe ${row.pipeId || 'unresolved'}`}; full line ${row.lineKey || 'unresolved'}. `
    + (row.provenance.outsideDiameterMm && row.provenance.wallThicknessMm
      ? 'OD/wall: exact current sealed enriched model, screening reuse only. '
      : 'OD/wall evidence is incomplete. ')
    + (temperature?.header ? `Operating temperature: ${temperature.fileName} · ${temperature.sheet} row ${temperature.rowNumber ?? 'unknown'} · ${temperature.header}; source ${temperature.sourceHash}. Current mapped source, not sealed thermal authority. `
      : temperature?.basis === 'SOURCE_EXPLICIT_OPERATING_CELSIUS' ? `Explicit source Celsius temperature: ${temperature.paths.join(', ')}. ` : '')
    + row.reasons.join(' ');
}

function numeric(text) { return String(text).trim() && Number.isFinite(Number(text)) ? Number(text) : null; }
function publishable(status) { return ['CALCULATED', 'CALCULATED_WITH_EXCEPTIONS'].includes(status); }
function esc(value) { return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]); }
