import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { projectDataStore } from './project-data-store.js';
import { renderNonFeaProjectDataViewV2 } from './non-fea-project-data-view-v2.js';
import {
  createBasicCalculationDefaultReset,
  createBasicCalculationDefaultUpdate,
  createBasicCalculationDefaultsModel,
  listCalculationProductDefaults,
} from './non-fea-calculation-defaults-model.js';
import {
  createScopedCalculationDefaultDelete,
  createScopedCalculationDefaultUpsert,
  createScopedCalculationDefaultsModel,
} from './non-fea-scoped-calculation-defaults-model.js';
import { LOAD_CALC_STANDARD_DEFAULTS_V1 } from './non-fea-product-default-profile.js';

/** Normal Load Calc Step-3 surface: Basic screening defaults + Advanced authority. */
export function renderNonFeaCalculationDefaultsView(container, onChanged) {
  if (!container) throw new TypeError('Calculation Defaults requires a container.');
  projectDataStore.applyProductDefaults();
  const profile = projectDataStore.getProfile();
  const basicModel = createBasicCalculationDefaultsModel(profile);
  const scopedModel = createScopedCalculationDefaultsModel(profile);
  container.innerHTML = `${styles()}${markup(profile, basicModel, scopedModel)}`;
  bindBasicActions(container, onChanged);
  bindScopedActions(container, onChanged, scopedModel);
  bindAdvancedAuthority(container, onChanged);
}

function markup(profile, model, scopedModel) {
  const policyEntry = profile?.qualificationPolicy?.configuredDefaults;
  const configuredCount = scopedModel.rows.length;
  const productRows = listCalculationProductDefaults();
  const productHash = semanticHash(LOAD_CALC_STANDARD_DEFAULTS_V1);
  return `<section class="calculation-defaults" data-role="non-fea-calculation-defaults">
    <header class="calculation-defaults__header">
      <div><span class="eyebrow">STEP 3 · LOAD CALC</span><h2>Calculation Defaults</h2>
        <p>Review the screening assumptions that Load Calc will use when higher-authority source, master or project values are absent. Defaults remain visible assumptions; they never become source evidence.</p></div>
      <div class="calculation-defaults__identity"><span>Project revision ${escape(profile.revision)}</span><code>${escape(projectDataStore.getSemanticHash())}</code></div>
    </header>

    <section class="calculation-defaults__rule"><strong>Authority order:</strong> source / inherited / exact master / derivation remain above project and Product defaults. Basic editing can replace a governed Product default or a prior Basic project default; it cannot overwrite independent higher authority. Scoped defaults are lower-authority Project Data policies resolved only through the existing exact-scope provider.</section>

    <section class="defaults-panel" data-role="calculation-defaults-basic">
      <header><div><span class="eyebrow">BASIC</span><h3>Normal screening defaults</h3></div><span>${model.rows.length} settings</span></header>
      <div class="defaults-table-wrap"><table>
        <thead><tr><th>Setting</th><th>Value</th><th>Unit</th><th>Scope</th><th>Effective authority</th><th>Basis</th><th>Reset</th></tr></thead>
        <tbody>${model.rows.map(rowMarkup).join('')}</tbody>
      </table></div>
      <p class="defaults-note">Length unit and vertical-axis choices are intentionally limited to the currently qualified Load Calc basis. Unsupported conventions are not exposed as if the mechanics already implement them. If a row is protected by higher authority or contains additional keyed values, use Advanced authority editing rather than overwriting its custody.</p>
    </section>

    <details class="defaults-panel defaults-panel--advanced" data-role="calculation-defaults-advanced">
      <summary><div><span class="eyebrow">ADVANCED</span><strong>Advanced defaults and authority</strong></div><span>${configuredCount} scoped project defaults · ${productRows.length} Product defaults</span></summary>
      <div class="advanced-defaults">
        <section class="advanced-defaults__summary">
          <article><span>Product profile</span><strong>${escape(LOAD_CALC_STANDARD_DEFAULTS_V1.profileId)}@${escape(LOAD_CALC_STANDARD_DEFAULTS_V1.version)}</strong><code>${escape(compact(productHash))}</code></article>
          <article><span>Scoped project defaults</span><strong>${configuredCount}</strong><code>${escape(scopedModel.policyState)}${scopedModel.policySource ? ` · ${escape(scopedModel.policySource)}` : ''}</code></article>
          <article><span>Scope precedence</span><strong>Canonical D2 editor</strong><code>${escape(scopedModel.scopePrecedence)}</code></article>
        </section>
        ${scopedDefaultsMarkup(scopedModel)}
        <section class="product-default-catalog"><h4>Built-in Product-default profile</h4><p>Read-only catalog. Each row is versioned and semantic-hash bound; project/source authority may shadow it without modifying this catalog.</p>
          <div class="defaults-table-wrap"><table><thead><tr><th>ID</th><th>Project Data path</th><th>Value</th><th>Unit</th><th>Basis</th><th>Hash</th></tr></thead><tbody>${productRows.map((row) => `<tr><td><strong>${escape(row.defaultId)}</strong></td><td><code>${escape(row.projectDataPath)}</code></td><td>${escape(valueText(row.value))}</td><td>${escape(row.unit)}</td><td>${escape(row.basis)}</td><td><code>${escape(compact(row.semanticHash))}</code></td></tr>`).join('')}</tbody></table></div>
        </section>
        <details class="advanced-authority" data-role="calculation-defaults-authority-drawer">
          <summary><strong>Open full Project Data / configured-default authority editor</strong><span>Advanced evidence, approvals, raw/custom configured-default policy and ownership matrix</span></summary>
          <div data-calculation-defaults-authority-host></div>
        </details>
      </div>
    </details>
  </section>`;
}

function scopedDefaultsMarkup(model) {
  return `<section class="scoped-defaults" data-role="calculation-defaults-scoped">
    <header><div><span class="eyebrow">SCOPED PROJECT DEFAULTS</span><h4>Exact-scope authoring</h4><p>Author lower-priority project defaults for exact governed identities. The form only emits canonical Issue #1321 scope tiers and provider-native units; source/master values still win in the common resolver.</p></div><code>${escape(model.policySemanticHash || 'NO POLICY YET')}</code></header>
    <div class="defaults-table-wrap"><table class="scoped-defaults__table"><thead><tr><th>ID</th><th>Field</th><th>Value</th><th>Scope</th><th>Methods</th><th>Basis</th><th>Actions</th></tr></thead><tbody>
      ${model.rows.length ? model.rows.map(scopedRowMarkup).join('') : '<tr><td colspan="7"><span class="panel-empty">No scoped project defaults configured.</span></td></tr>'}
    </tbody></table></div>
    <form class="scoped-defaults__form" data-scoped-default-form>
      <label>Default ID<input type="text" data-scoped-default-id placeholder="e.g. VALVE-MASS-CLASS150"></label>
      <label>Engineering field<select data-scoped-field>${model.authorableFields.map((row) => `<option value="${escape(row.fieldId)}">${escape(row.label)}</option>`).join('')}</select></label>
      <label>Value<input type="number" step="any" data-scoped-value></label>
      <label>Unit<output data-scoped-unit></output></label>
      <label class="scoped-defaults__basis">Basis<textarea rows="2" data-scoped-basis placeholder="Engineering basis for this screening default"></textarea></label>
      <label>Scope<select data-scoped-scope-kind>${model.scopeKinds.map((row) => `<option value="${escape(row.scopeKind)}">${escape(row.label)}</option>`).join('')}</select></label>
      <label data-scoped-values-wrap>Exact identifiers<input type="text" data-scoped-values placeholder="Comma-separated exact IDs"></label>
      <label data-scoped-nb-wrap>Nominal bore (mm)<input type="text" data-scoped-nb placeholder="e.g. 100, 150"></label>
      <label class="scoped-defaults__methods">Methods <small>Leave none selected to bind all methods applicable to the selected field.</small><select multiple size="5" data-scoped-methods>${allMethodOptions(model)}</select></label>
      <div class="scoped-defaults__form-actions"><button type="submit" class="button button--primary">Save scoped default</button><button type="button" class="button" data-scoped-clear>Clear form</button><output data-scoped-status aria-live="polite"></output></div>
    </form>
    <p class="defaults-note">Custom multi-scope rows or rows with unexpected units remain protected here and are editable only in the full Advanced authority editor. Equal-priority unequal-value conflicts are not resolved by this form; the existing provider continues to fail them closed.</p>
  </section>`;
}

function allMethodOptions(model) {
  const methods = [...new Set(model.authorableFields.flatMap((row) => row.allowedMethods))].sort();
  return methods.map((methodId) => `<option value="${escape(methodId)}">${escape(methodId)}</option>`).join('');
}

function scopedRowMarkup(row) {
  return `<tr data-scoped-row="${escape(row.defaultId)}" data-editable="${row.editable ? 'true' : 'false'}">
    <td><strong>${escape(row.defaultId)}</strong>${row.editBlockedReason ? `<small>${escape(row.editBlockedReason)}</small>` : ''}</td>
    <td>${escape(row.fieldLabel)}<code>${escape(row.fieldId)}</code></td>
    <td>${escape(row.value)} <small>${escape(row.unit)}</small></td>
    <td><span class="scope-chip">${escape(row.scopeLabel)}</span>${row.scopePriority ? `<code>${escape(row.scopePriority.join('·'))}</code>` : ''}</td>
    <td>${escape(row.allowedMethods.join(', '))}</td>
    <td>${escape(row.basis)}</td>
    <td><div class="row-actions"><button type="button" data-scoped-edit="${escape(row.defaultId)}" ${row.editable ? '' : 'disabled'}>Edit</button><button type="button" data-scoped-delete="${escape(row.defaultId)}" ${row.editable ? '' : 'disabled'}>Delete</button></div></td>
  </tr>`;
}

function rowMarkup(row) {
  const editTitle = row.editable ? 'Apply project screening default' : row.editBlockedReason;
  return `<tr data-calculation-default-row="${escape(row.fieldId)}" data-editable="${row.editable ? 'true' : 'false'}">
    <td><strong>${escape(row.label)}</strong><code>${escape(row.projectDataPath)}</code></td>
    <td><div class="value-editor">${inputMarkup(row)}<button type="button" data-default-apply="${escape(row.fieldId)}" ${row.editable ? '' : 'disabled'} title="${escape(editTitle || '')}">Apply</button></div>${row.editBlockedReason ? `<small class="authority-note">${escape(row.editBlockedReason)}</small>` : ''}</td>
    <td>${escape(row.unit)}</td>
    <td><span class="scope-chip">PROJECT GLOBAL</span></td>
    <td>${authorityMarkup(row)}</td>
    <td><span title="${escape(row.basis || row.builtInBasis || 'No basis available')}">${escape(row.basis || row.builtInBasis || 'NOT AVAILABLE')}</span></td>
    <td><button type="button" data-default-reset="${escape(row.fieldId)}" ${row.resetAvailable ? '' : 'disabled'} title="${row.resetAvailable ? 'Remove Basic-owned project override and restore governed Product default' : 'No Basic-owned project override is safe to reset'}">Reset</button></td>
  </tr>`;
}

function inputMarkup(row) {
  if (row.kind === 'choice') {
    return `<select data-default-input="${escape(row.fieldId)}" ${row.editable ? '' : 'disabled'}>${row.options.map((option) => `<option value="${escape(option)}" ${row.value === option ? 'selected' : ''}>${escape(option)}</option>`).join('')}</select>`;
  }
  if (row.kind === 'case-set') {
    return `<div class="case-set">${row.options.map((option) => `<label><input type="checkbox" data-default-case="${escape(row.fieldId)}" value="${escape(option)}" ${row.value?.includes?.(option) ? 'checked' : ''} ${row.editable ? '' : 'disabled'}>${escape(option)}</label>`).join('')}</div>`;
  }
  if (row.kind === 'elastic-thermal') {
    return `<div class="paired-input"><label>E <input type="number" step="any" data-default-elastic="${escape(row.fieldId)}" value="${escape(row.value?.elasticModulusPa ?? '')}" ${row.editable ? '' : 'disabled'}></label><label>α <input type="number" step="any" data-default-alpha="${escape(row.fieldId)}" value="${escape(row.value?.thermalExpansionPerK ?? '')}" ${row.editable ? '' : 'disabled'}></label></div>`;
  }
  return `<input type="number" step="any" data-default-input="${escape(row.fieldId)}" value="${escape(row.value ?? '')}" ${row.editable ? '' : 'disabled'}>`;
}

function authorityMarkup(row) {
  const detail = row.defaultId
    ? `${row.defaultId}${row.productProfileId ? ` · ${row.productProfileId}@${row.productProfileVersion}` : ''}`
    : row.source || '';
  return `<span class="authority-chip" data-authority="${escape(row.effectiveAuthority)}">${escape(row.effectiveAuthority)}</span>${detail ? `<small>${escape(detail)}</small>` : ''}`;
}

function bindBasicActions(container, onChanged) {
  const applyField = (fieldId) => {
    try {
      const profile = projectDataStore.getProfile();
      const plan = createBasicCalculationDefaultUpdate(profile, fieldId, readInput(container, fieldId));
      projectDataStore.update(plan.projectDataPath, plan.value, plan.evidence, plan.approved);
      refresh(container, onChanged);
    } catch (error) {
      showRowError(container, `[data-calculation-default-row="${cssEscape(fieldId)}"]`, error);
    }
  };

  container.addEventListener('change', (event) => {
    const row = event.target.closest('[data-calculation-default-row]');
    if (!row) return;
    const fieldId = row.dataset.calculationDefaultRow;
    if (fieldId) applyField(fieldId);
  });

  container.addEventListener('click', (event) => {
    const apply = event.target.closest('[data-default-apply]');
    const reset = event.target.closest('[data-default-reset]');
    if (!apply && !reset) return;
    const fieldId = apply?.dataset.defaultApply || reset?.dataset.defaultReset;
    if (apply) {
      applyField(fieldId);
      return;
    }
    if (reset) {
      try {
        const profile = projectDataStore.getProfile();
        const plan = createBasicCalculationDefaultReset(profile, fieldId);
        projectDataStore.update(plan.projectDataPath, plan.value, plan.evidence, plan.approved);
        refresh(container, onChanged);
      } catch (error) {
        showRowError(container, `[data-calculation-default-row="${cssEscape(fieldId)}"]`, error);
      }
    }
  });
}

function bindScopedActions(container, onChanged, model) {
  const form = container.querySelector('[data-scoped-default-form]');
  if (!form) return;
  const fieldSelect = form.querySelector('[data-scoped-field]');
  const scopeSelect = form.querySelector('[data-scoped-scope-kind]');
  fieldSelect.addEventListener('change', () => syncScopedForm(form, model));
  scopeSelect.addEventListener('change', () => syncScopedForm(form, model));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const plan = createScopedCalculationDefaultUpsert(projectDataStore.getProfile(), readScopedDraft(form));
      projectDataStore.update(plan.projectDataPath, plan.value, plan.evidence, plan.approved);
      refresh(container, onChanged);
    } catch (error) {
      showScopedError(form, error);
    }
  });
  container.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-scoped-edit]');
    const remove = event.target.closest('[data-scoped-delete]');
    const clear = event.target.closest('[data-scoped-clear]');
    if (clear) return resetScopedForm(form, model);
    if (edit) {
      const row = model.rows.find((candidate) => candidate.defaultId === edit.dataset.scopedEdit);
      if (row?.editable) populateScopedForm(form, model, row);
      return;
    }
    if (!remove) return;
    try {
      const plan = createScopedCalculationDefaultDelete(projectDataStore.getProfile(), remove.dataset.scopedDelete);
      projectDataStore.update(plan.projectDataPath, plan.value, plan.evidence, plan.approved);
      refresh(container, onChanged);
    } catch (error) {
      showScopedError(form, error);
    }
  });
  syncScopedForm(form, model);
}

function readScopedDraft(form) {
  return {
    defaultId: form.querySelector('[data-scoped-default-id]').value,
    fieldId: form.querySelector('[data-scoped-field]').value,
    value: form.querySelector('[data-scoped-value]').value,
    basis: form.querySelector('[data-scoped-basis]').value,
    scopeKind: form.querySelector('[data-scoped-scope-kind]').value,
    scopeValues: form.querySelector('[data-scoped-values]').value,
    nominalBoreMm: form.querySelector('[data-scoped-nb]').value,
    allowedMethods: [...form.querySelector('[data-scoped-methods]').selectedOptions].map((option) => option.value),
  };
}

function populateScopedForm(form, model, row) {
  form.querySelector('[data-scoped-default-id]').value = row.defaultId;
  form.querySelector('[data-scoped-field]').value = row.fieldId;
  form.querySelector('[data-scoped-value]').value = row.value;
  form.querySelector('[data-scoped-basis]').value = row.basis;
  form.querySelector('[data-scoped-scope-kind]').value = row.scopeKind;
  const valuesKey = scopeValueKey(row.scopeKind);
  form.querySelector('[data-scoped-values]').value = valuesKey ? (row.scope[valuesKey] || []).join(', ') : '';
  form.querySelector('[data-scoped-nb]').value = (row.scope.nominalBoreMm || []).join(', ');
  [...form.querySelector('[data-scoped-methods]').options].forEach((option) => { option.selected = row.allowedMethods.includes(option.value); });
  syncScopedForm(form, model);
}

function resetScopedForm(form, model) {
  form.reset();
  form.querySelector('[data-scoped-status]').textContent = '';
  syncScopedForm(form, model);
}

function syncScopedForm(form, model) {
  const field = model.authorableFields.find((row) => row.fieldId === form.querySelector('[data-scoped-field]').value) || model.authorableFields[0];
  const scope = model.scopeKinds.find((row) => row.scopeKind === form.querySelector('[data-scoped-scope-kind]').value) || model.scopeKinds[0];
  form.querySelector('[data-scoped-unit]').textContent = field?.inputUnit || '';
  const methodSelect = form.querySelector('[data-scoped-methods]');
  [...methodSelect.options].forEach((option) => {
    const allowed = field?.allowedMethods.includes(option.value) === true;
    option.disabled = !allowed;
    if (!allowed) option.selected = false;
  });
  const needsText = scope?.keys.some((key) => key !== 'nominalBoreMm');
  const needsNb = scope?.keys.includes('nominalBoreMm');
  form.querySelector('[data-scoped-values-wrap]').hidden = !needsText;
  form.querySelector('[data-scoped-nb-wrap]').hidden = !needsNb;
}

function scopeValueKey(scopeKind) {
  return ({
    ENTITY: 'entityIds', POS: 'posIds', LINE: 'lineIds', BRANCH: 'branchIds',
    PIPING_CLASS_NB: 'pipingClasses', COMPONENT_TYPE_NB: 'componentTypes',
    PIPING_CLASS: 'pipingClasses', COMPONENT_TYPE: 'componentTypes',
    SUPPORT_KIND: 'supportKinds', SYSTEM: 'systemIds', ZONE: 'zoneIds',
  })[scopeKind] || null;
}

function showScopedError(form, error) {
  const message = error instanceof Error ? error.message : String(error);
  form.querySelector('[data-scoped-status]').textContent = message;
  const firstInput = form.querySelector('input,select,textarea');
  firstInput?.setCustomValidity(message);
  firstInput?.reportValidity();
  queueMicrotask(() => firstInput?.setCustomValidity(''));
}

function showRowError(container, selector, error) {
  const row = container.querySelector(selector);
  const message = error instanceof Error ? error.message : String(error);
  row?.setAttribute('data-error', message);
  const firstInput = row?.querySelector('input,select');
  firstInput?.setCustomValidity(message);
  firstInput?.reportValidity();
}

function bindAdvancedAuthority(container, onChanged) {
  const drawer = container.querySelector('[data-role="calculation-defaults-authority-drawer"]');
  if (!drawer) return;
  let rendered = false;
  drawer.addEventListener('toggle', () => {
    if (!drawer.open || rendered) return;
    const host = drawer.querySelector('[data-calculation-defaults-authority-host]');
    renderNonFeaProjectDataViewV2(host, () => refresh(container, onChanged));
    rendered = true;
  });
}

function readInput(container, fieldId) {
  const row = container.querySelector(`[data-calculation-default-row="${cssEscape(fieldId)}"]`);
  if (!row) throw new RangeError(`Missing Calculation Default row: ${fieldId}.`);
  const cases = [...row.querySelectorAll('[data-default-case]')];
  if (cases.length) return cases.filter((input) => input.checked).map((input) => input.value);
  const elastic = row.querySelector('[data-default-elastic]');
  const alpha = row.querySelector('[data-default-alpha]');
  if (elastic || alpha) return {
    elasticModulusPa: elastic?.value,
    thermalExpansionPerK: alpha?.value,
  };
  return row.querySelector('[data-default-input]')?.value;
}

function refresh(container, onChanged) {
  if (typeof onChanged === 'function') onChanged();
  else renderNonFeaCalculationDefaultsView(container, onChanged);
}
function valueText(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
function compact(value) {
  const text = String(value || '');
  return text.length > 24 ? `${text.slice(0, 12)}…${text.slice(-8)}` : text;
}
function cssEscape(value) { return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replace(/[.]/g, '\\.'); }
function escape(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]); }
function styles() {
  return `<style>
    .calculation-defaults{height:100%;overflow:auto;padding:16px;box-sizing:border-box;background:#07101e;color:#e2e8f0}.calculation-defaults__header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.calculation-defaults h2,.calculation-defaults h3,.calculation-defaults h4{margin:4px 0}.calculation-defaults p{color:#94a3b8}.calculation-defaults__identity{display:flex;flex-direction:column;gap:4px;max-width:380px;text-align:right}.calculation-defaults__identity code{color:#64748b;overflow-wrap:anywhere}.eyebrow{display:block;color:#38bdf8;font-size:10px;font-weight:800;letter-spacing:.1em}.calculation-defaults__rule{margin:12px 0;padding:10px 12px;border:1px solid #155e75;border-radius:6px;background:#082f49;color:#bae6fd}.defaults-panel{margin-top:10px;border:1px solid #334155;border-radius:7px;background:#0b1424;overflow:hidden}.defaults-panel>header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:12px}.defaults-table-wrap{overflow:auto}.calculation-defaults table{width:100%;border-collapse:collapse}.calculation-defaults th,.calculation-defaults td{padding:8px;text-align:left;vertical-align:top;border-top:1px solid #223047}.calculation-defaults th{color:#7dd3fc;font-size:10px;text-transform:uppercase}.calculation-defaults td>code{display:block;margin-top:3px;color:#64748b;font-size:9px}.calculation-defaults input,.calculation-defaults select,.calculation-defaults textarea,.calculation-defaults button{background:#07101e;color:#e2e8f0;border:1px solid #475569;border-radius:4px;padding:6px;box-sizing:border-box}.calculation-defaults input[type="number"]{width:130px}.value-editor{display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap}.case-set{display:flex;gap:8px;flex-wrap:wrap}.case-set label,.paired-input label{display:flex;align-items:center;gap:4px}.paired-input{display:flex;gap:7px;flex-wrap:wrap}.scope-chip,.authority-chip{display:inline-block;padding:3px 7px;border:1px solid #475569;border-radius:999px;font-size:9px}.authority-chip[data-authority="PRODUCT_DEFAULT"]{color:#7dd3fc;border-color:#155e75}.authority-chip[data-authority="PROJECT_POLICY"]{color:#4ade80;border-color:#166534}.calculation-defaults td small{display:block;margin-top:3px;color:#64748b}.authority-note{max-width:320px}.calculation-defaults button:disabled,.calculation-defaults input:disabled,.calculation-defaults select:disabled{opacity:.5;cursor:not-allowed}.defaults-note{padding:0 12px 10px;font-size:11px}.defaults-panel--advanced>summary,.advanced-authority>summary{display:flex;justify-content:space-between;gap:12px;padding:12px;cursor:pointer}.advanced-defaults{padding:0 12px 12px}.advanced-defaults__summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.advanced-defaults__summary article{padding:9px;border:1px solid #293548;border-radius:5px}.advanced-defaults__summary span,.advanced-defaults__summary code{display:block;color:#64748b;font-size:10px}.product-default-catalog,.advanced-authority,.scoped-defaults{margin-top:10px;border:1px solid #293548;border-radius:6px;padding:10px}.scoped-defaults>header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.scoped-defaults>header code{color:#64748b;overflow-wrap:anywhere;max-width:340px}.scoped-defaults__form{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:9px;margin-top:12px;padding:10px;border:1px solid #223047;border-radius:6px}.scoped-defaults__form label{display:flex;flex-direction:column;gap:4px;color:#94a3b8;font-size:10px}.scoped-defaults__form input,.scoped-defaults__form select,.scoped-defaults__form textarea{width:100%}.scoped-defaults__basis,.scoped-defaults__methods{grid-column:span 2}.scoped-defaults__form-actions{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.scoped-defaults__form-actions output{color:#fbbf24}.scoped-defaults__table td:nth-child(5){max-width:280px;overflow-wrap:anywhere}.row-actions{display:flex;gap:5px}.advanced-authority{padding:0;overflow:hidden}.advanced-authority>summary span{color:#64748b;font-size:10px}.advanced-authority [data-calculation-defaults-authority-host]{min-height:120px}.calculation-defaults [data-error]{outline:1px solid #dc2626}@media(max-width:1100px){.scoped-defaults__form{grid-template-columns:repeat(2,minmax(160px,1fr))}}@media(max-width:700px){.scoped-defaults__form{grid-template-columns:1fr}.scoped-defaults__basis,.scoped-defaults__methods{grid-column:span 1}}@media(max-width:1000px){.advanced-defaults__summary{grid-template-columns:1fr}.calculation-defaults__header{flex-direction:column}.calculation-defaults__identity{text-align:left}}
  </style>`;
}
