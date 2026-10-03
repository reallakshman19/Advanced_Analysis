import { buildSupportMappingReview, applySupportMappingReview, supportMappingSvg, defaultSupportMappingChoices, bulkSupportMappingChoices, SUPPORT_MAPPING_CHOICES, escapeHtml as esc } from './support-mapping-review.js';

export function openSupportMappingDialog({ documentRef, getContext, store, onApplied, onSkipped, onSelect }) {
  documentRef.querySelector('[data-support-mapping-dialog]')?.close();
  const context = getContext(), review = buildSupportMappingReview(context);
  if (!context.dataset?.sharedModel || !context.supportSiteModel) throw new Error('Import a source and prepare support sites first.');
  const previousFocus = documentRef.activeElement;
  const dialog = documentRef.createElement('dialog');
  dialog.dataset.supportMappingDialog = '';
  dialog.className = 'lcsm';
  dialog.setAttribute('aria-labelledby', 'lcsm-title');
  const options = value => SUPPORT_MAPPING_CHOICES.map(c => `<option value="${c.value}" ${c.value === value ? 'selected' : ''}>${c.label}</option>`).join('');
  dialog.innerHTML = `${styles()}<header><div><h2 id="lcsm-title">Support types</h2><p>${review.rows.length} items · ${review.rows.filter(r => r.fallbackEligible).length} editable. Pick a type, or leave it as Skip for now.</p></div><button type="button" data-close aria-label="Close support mapping">✕</button></header>
    <div class="lcsm-tools"><label>Find support / branch<input type="search" data-search placeholder="Search tag, ID or branch"></label>
    <label>Show<select data-filter><option value="all">All items</option><option value="pending">Editable only</option></select></label><button type="button" data-reset>Set all to Skip</button></div>
    <div class="lcsm-bulk"><span data-selection-count role="status"></span><label>Set selected to <select data-bulk-type>${options('REST')}</select></label><button type="button" data-bulk-apply disabled>Set selected</button><button type="button" data-clear-selection disabled>Clear selection</button></div>
    <div class="lcsm-layout"><div class="lcsm-table-wrap"><table aria-label="Support types"><thead><tr>
    <th scope="col"><input type="checkbox" data-select-visible aria-label="Select visible editable rows"></th><th scope="col">Support</th><th scope="col">Branch</th><th scope="col">Current</th><th scope="col">Your choice</th><th scope="col">View</th></tr></thead><tbody data-items></tbody></table></div>
    <section class="lcsm-locator"><h3 data-locator-title>Location</h3><div data-locator></div><p data-location-evidence></p><small>Location only — not a solved restraint.</small></section></div>
    <details class="lcsm-extra"><summary>Branches with unallocated load (${review.branches.length})</summary><p>These stay visible when skipped. No new supports are added.</p>
    ${review.branches.map(b => `<article><button type="button" data-locate-branch="${esc(b.branchId)}">${esc(b.branchId)}</button><p>${b.members.length ? `${b.members.length} support record(s)` : 'No support record in the source'} · ${b.paths.map(p => `${esc(p.loadCaseId)} ${p.forceN.toFixed(3)} N`).join(' · ')}</p></article>`).join('') || '<p>No current unallocated branch results.</p>'}</details>
    <details class="lcsm-extra"><summary>Technical details</summary><p>Skip leaves weights and existing supports unchanged. Type changes use the existing scalar-gravity capability rules, not a new solver restraint. After applying, recheck inputs and rerun. Guide/stop direction, stiffness, friction and host attachment are not supplied here.</p><div data-diagnostics></div></details>
    <div data-confirm-panel class="lcsm-confirm" hidden><strong>Apply these support types?</strong><p data-confirm-summary></p><label>Note (optional)<input data-reason placeholder="Add a note if useful"></label><button type="button" data-confirm-apply>Yes, apply changes</button><button type="button" data-back>Keep editing</button></div>
    <p data-note role="status" aria-live="polite"></p>
    <footer><span data-choice-summary role="status"></span><div><button type="button" data-close>Cancel</button><button type="button" data-skip>Continue with Skip</button><button type="button" data-apply hidden>Apply changes</button></div></footer>`;
  documentRef.body.appendChild(dialog);
  let choices = new Map(defaultSupportMappingChoices(review).map(c => [c.entityId, c.type]));
  const selected = new Set(); let applied = false, confirming = false;
  const note = text => { dialog.querySelector('[data-note]').textContent = text; };
  const selections = () => [...choices].map(([entityId, type]) => ({ entityId, type }));
  const changed = () => selections().filter(c => c.type !== 'SKIP');
  function visibleRows() {
    const search = dialog.querySelector('[data-search]').value.toLowerCase().trim();
    const pending = dialog.querySelector('[data-filter]').value === 'pending';
    return review.rows.filter(r => (!pending || r.fallbackEligible) && `${r.entityId} ${r.tag} ${r.branchId}`.toLowerCase().includes(search));
  }
  function endConfirmation() { confirming = false; dialog.querySelector('[data-confirm-panel]').hidden = true; }
  function enable() {
    const changes = changed(), editable = visibleRows().filter(r => r.fallbackEligible);
    const visibleSelected = editable.filter(r => selected.has(r.entityId)).length;
    const selectAll = dialog.querySelector('[data-select-visible]');
    selectAll.disabled = applied || !editable.length;
    selectAll.checked = editable.length > 0 && visibleSelected === editable.length;
    selectAll.indeterminate = visibleSelected > 0 && visibleSelected < editable.length;
    dialog.querySelector('[data-selection-count]').textContent = `${selected.size} selected${selected.size > visibleSelected ? ` (${selected.size - visibleSelected} hidden by filter)` : ''}`;
    dialog.querySelector('[data-bulk-apply]').disabled = applied || !selected.size;
    dialog.querySelector('[data-clear-selection]').disabled = applied || !selected.size;
    dialog.querySelector('[data-bulk-type]').disabled = applied;
    dialog.querySelector('[data-reset]').disabled = applied;
    dialog.querySelector('[data-apply]').hidden = !changes.length || applied;
    dialog.querySelector('[data-apply]').disabled = confirming;
    dialog.querySelector('[data-apply]').textContent = `Apply ${changes.length} change${changes.length === 1 ? '' : 's'}`;
    dialog.querySelector('[data-skip]').hidden = changes.length > 0;
    dialog.querySelector('[data-choice-summary]').textContent = `${choices.size - changes.length} Skip · ${changes.length} changed${applied ? ' · recheck and rerun' : ''}`;
  }
  function rows() {
    dialog.querySelector('[data-items]').innerHTML = visibleRows().map(r => {
      const editable = r.fallbackEligible && !applied;
      const branch = r.branchId?.split('/').filter(Boolean).at(-1) || '—';
      const current = r.effectiveKind || r.inheritedKinds.join(', ') || 'Missing';
      return `<tr data-support-row="${esc(r.entityId)}"><td><input type="checkbox" data-select-id="${esc(r.entityId)}" aria-label="Select ${esc(r.entityId)}" ${selected.has(r.entityId) ? 'checked' : ''} ${editable ? '' : 'disabled'}></td>
      <th scope="row"><strong>${esc(r.tag)}</strong>${r.tag !== r.entityId ? `<small>${esc(r.entityId)}</small>` : ''}</th>
      <td title="${esc(r.branchId)}">${esc(branch)}</td><td>${esc(current)}${editable ? '' : '<small>Already mapped · kept</small>'}</td>
      <td><select aria-label="Support type ${esc(r.entityId)}" data-mapping-id="${esc(r.entityId)}" ${editable ? '' : 'disabled'}>${options(choices.get(r.entityId))}</select></td>
      <td><button type="button" data-locate-support="${esc(r.entityId)}" aria-label="Locate ${esc(r.entityId)}">SVG</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">No matching items.</td></tr>';
    enable();
  }
  function locate(branchId, ids = []) {
    dialog.querySelector('[data-locator-title]').textContent = branchId;
    dialog.querySelector('[data-locator]').innerHTML = supportMappingSvg(context.dataset, branchId, ids);
    const row = review.rows.find(r => ids.includes(r.entityId));
    dialog.querySelector('[data-location-evidence]').textContent = row ? `${row.entityId} · X ${row.positionMm.x}, Y ${row.positionMm.y}, Z ${row.positionMm.z} mm` : 'Source branch geometry';
    if (ids.length) onSelect?.(ids[0]);
  }
  const diagnostics = [...(context.attachmentModel?.attachments || []), ...(context.restraintModel?.restraints || [])]
    .filter(r => (r.diagnostics || []).length || ['UNRESOLVED', 'BLOCKED', 'CONFLICTED'].includes(r.qualification || r.status));
  dialog.querySelector('[data-diagnostics]').innerHTML = diagnostics.map(r => `<p>${esc(r.supportKey || r.supportId || r.restraintId || r.attachmentId)}: ${esc(r.qualification || r.status)} ${esc((r.diagnostics || []).map(d => d.code).join(', '))}</p>`).join('');
  dialog.addEventListener('input', e => { if (e.target.matches('[data-search]')) rows(); });
  dialog.addEventListener('change', e => {
    if (e.target.matches('[data-filter]')) rows();
    if (e.target.matches('[data-select-visible]')) {
      for (const r of visibleRows().filter(r => r.fallbackEligible)) e.target.checked ? selected.add(r.entityId) : selected.delete(r.entityId);
      rows();
    }
    if (e.target.matches('[data-select-id]')) e.target.checked ? selected.add(e.target.dataset.selectId) : selected.delete(e.target.dataset.selectId);
    if (e.target.matches('[data-mapping-id]') && !applied) {
      choices = new Map(bulkSupportMappingChoices(review, selections(), [e.target.dataset.mappingId], e.target.value).map(c => [c.entityId, c.type]));
      endConfirmation(); note('');
    }
    enable();
  });
  dialog.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return dialog.close();
    if (e.target.closest('[data-clear-selection]')) { selected.clear(); rows(); return; }
    if (e.target.closest('[data-reset]') && !applied) {
      for (const id of choices.keys()) choices.set(id, 'SKIP');
      selected.clear(); endConfirmation(); note(''); rows(); return;
    }
    if (e.target.closest('[data-bulk-apply]') && !applied) {
      choices = new Map(bulkSupportMappingChoices(review, selections(), [...selected], dialog.querySelector('[data-bulk-type]').value).map(c => [c.entityId, c.type]));
      endConfirmation(); note('Draft updated — apply when ready.'); rows(); return;
    }
    if (e.target.closest('[data-skip]') && !applied && !changed().length) { onSkipped?.(choices.size); dialog.close(); return; }
    const id = e.target.closest('[data-locate-support]')?.dataset.locateSupport;
    if (id) { const row = review.rows.find(r => r.entityId === id); locate(row.branchId, [id]); return; }
    const branch = e.target.closest('[data-locate-branch]')?.dataset.locateBranch;
    if (branch) { locate(branch); return; }
    if (e.target.closest('[data-back]')) { endConfirmation(); enable(); return; }
    if (e.target.closest('[data-apply]') && !applied && changed().length) {
      confirming = true;
      dialog.querySelector('[data-confirm-panel]').hidden = false;
      dialog.querySelector('[data-confirm-summary]').textContent = changed().map(c => `${c.entityId} → ${SUPPORT_MAPPING_CHOICES.find(t => t.value === c.type).label}`).join('; ');
      enable(); dialog.querySelector('[data-confirm-apply]').focus(); return;
    }
    if (!e.target.closest('[data-confirm-apply]') || !confirming || applied) return;
    try {
      const basis = `Confirmed in support table: ${changed().map(c => `${c.entityId} → ${c.type}`).join('; ')}.${dialog.querySelector('[data-reason]').value.trim() ? ' Note: ' + dialog.querySelector('[data-reason]').value.trim() : ''}`;
      const count = applySupportMappingReview(store, review, buildSupportMappingReview(getContext()), selections(), { confirmed: true, basis });
      applied = true; endConfirmation(); rows();
      note(`Saved ${count} support type${count === 1 ? '' : 's'}. Recheck inputs and rerun to update loads.`);
      onApplied?.(count);
    } catch (error) { note(error.message); }
  });
  dialog.addEventListener('close', () => { dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus(); }, { once: true });
  rows();
  const first = review.rows.find(r => r.fallbackEligible && review.branches.some(b => b.branchId === r.branchId)) || review.rows.find(r => r.fallbackEligible) || review.rows[0];
  if (first) locate(first.branchId, [first.entityId]); else if (review.branches[0]) locate(review.branches[0].branchId);
  dialog.showModal(); return dialog;
}

function styles() { return `<style>
.lcsm{width:min(1280px,96vw);max-height:92vh;overflow:auto;box-sizing:border-box;padding:18px;border:1px solid #334155;border-radius:12px;background:#0b1424;color:#e2e8f0;font:13px system-ui}.lcsm::backdrop{background:#020617ba}.lcsm [hidden]{display:none!important}.lcsm header,.lcsm-tools,.lcsm-bulk,.lcsm footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.lcsm header,.lcsm footer{justify-content:space-between}.lcsm h2{margin:0;font-size:22px}.lcsm p{color:#aebcd0;line-height:1.45;overflow-wrap:anywhere;margin:7px 0}.lcsm button,.lcsm input,.lcsm select{background:#111e31;color:#e2e8f0;border:1px solid #41516a;border-radius:5px;padding:7px;font:inherit}.lcsm button{cursor:pointer}.lcsm button:disabled,.lcsm select:disabled{opacity:.5;cursor:default}.lcsm label{display:flex;align-items:center;gap:8px}.lcsm button:focus-visible,.lcsm input:focus-visible,.lcsm select:focus-visible{outline:2px solid #38bdf8}.lcsm-tools{margin:12px 0}.lcsm-tools [data-search]{width:220px}.lcsm-bulk{padding:8px 10px;background:#152339;border-radius:6px;margin-bottom:12px}.lcsm-bulk [data-selection-count]{min-width:90px}.lcsm-layout{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(280px,1fr);gap:16px}.lcsm-table-wrap{max-height:42vh;overflow:auto;border:1px solid #293b55;border-radius:6px}.lcsm table{width:100%;border-collapse:collapse;font-size:12px}.lcsm th,.lcsm td{padding:8px;border-bottom:1px solid #25354d;text-align:left;vertical-align:middle}.lcsm thead th{position:sticky;top:0;background:#18263c;z-index:1;white-space:nowrap}.lcsm tbody th{font-weight:400}.lcsm tbody tr:hover{background:#13223a}.lcsm small{display:block;color:#94a3b8;font-size:11px;margin-top:3px}.lcsm td select{min-width:95px;width:100%;padding:5px}.lcsm th input,.lcsm td input{accent-color:#38bdf8}.lcsm strong{overflow-wrap:anywhere}.lcsm svg{width:100%;border:1px solid #26364c;border-radius:7px}.lcsm-locator{min-width:0}.lcsm-locator h3{overflow-wrap:anywhere;font-size:12px;margin:0 0 8px}.lcsm-extra{margin:10px 0;color:#aebcd0}.lcsm summary{cursor:pointer;padding:4px 0}.lcsm-extra article{padding:6px 0}.lcsm-confirm{border:1px solid #446f97;border-radius:7px;padding:12px;margin-top:10px;background:#11233a}.lcsm-confirm label{margin:8px 0}.lcsm-confirm input{flex:1;max-width:450px}.lcsm-confirm button{margin-right:8px}.lcsm [data-note]:empty{display:none}.lcsm [data-note]{color:#7dd3fc}.lcsm footer{position:sticky;bottom:-18px;background:#0b1424;padding:12px 0 6px;border-top:1px solid #293b55;margin-top:10px}.lcsm footer>div{display:flex;gap:8px}.lcsm [data-apply],.lcsm [data-confirm-apply],.lcsm [data-skip]{background:#075985;border-color:#0284c7}@media(max-width:850px){.lcsm-layout{grid-template-columns:1fr}.lcsm-locator svg{max-height:170px}.lcsm-table-wrap{max-height:38vh}.lcsm{padding:12px}.lcsm-tools label{flex-wrap:wrap}.lcsm footer{bottom:-12px}.lcsm-table-wrap table{min-width:560px}}
</style>`; }
