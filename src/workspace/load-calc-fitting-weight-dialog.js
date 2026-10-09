import {
  buildFittingWeightReviewRows,
  fittingWeightRecordFor,
  canPrefillFittingWeight,
} from './load-calc-fitting-weight-review.js';
import { readWeightReviewPolicy } from './load-calc-weight-review-scope.js';
import { openWeightReviewSettings } from './load-calc-weight-review-settings.js';

/**
 * Review table for catalogue fitting weights, styled on the XML->CII
 * standalone Weight Match phase (weight-match-renderer.js): a chip per
 * candidate showing its weight and rank reason, an editable weight input
 * pre-filled only for a clear dimension/family match, and a guarded bulk
 * fill action. Unsupported suggestions remain blank for explicit review.
 *
 * Ported the interaction model, not the file: the original renders inline
 * inside its own workflow shell and depends on XML/Branch/Node concepts this
 * dataset does not have (Preview Rating snapshot, DTXR-rating toggle,
 * in->mm length conversion, editable keyword-rule tables). This keeps the
 * part that matters for a review decision -- ranked chips, an editable
 * weight, and visibility into why a candidate ranked where it did.
 */
export function openFittingWeightDialog({ documentRef, dataset, masters, sidecar = null, onAccept, getBinding = null, drafts = new Map() }) {
  const openingBinding = getBinding?.();
  const openingPolicy = JSON.stringify(readWeightReviewPolicy());
  const review = buildFittingWeightReviewRows({ dataset, masters, sidecar });
  const host = documentRef.createElement('div');
  host.className = 'lcfw-backdrop';
  host.dataset.role = 'load-calc-fitting-weight-dialog';
  host.innerHTML = `${styles()}${markup(review)}`;
  documentRef.body.appendChild(host);

  const close = () => host.remove();
  const inputFor = (targetId) => host.querySelector(`[data-lcfw-weight="${cssEscape(targetId)}"]`);
  let search = '';
  const shownRows = () => review.rows.filter(row => `${row.targetId} ${row.description} ${row.type} ${row.boreMm} ${row.rating}`.toLowerCase().includes(search));
  const note = text => { const element = host.querySelector('[data-lcfw-note]'); if (element) element.textContent = text; };
  const draftStatus = (targetId) => {
    const input = inputFor(targetId), label = host.querySelector(`[data-lcfw-status="${cssEscape(targetId)}"]`);
    if (!input || !label) return;
    const value = String(input.value).trim(), row = review.rows.find(row => row.targetId === targetId);
    const candidate = row?.candidates[Number(input.dataset.lcfwSelectedIndex)];
    label.textContent = !value ? 'Enter weight or Skip' : Number(value) === 0 ? 'Zero assumption · not applied'
      : candidate && Number(candidate.weightKg) === Number(value) ? 'Suggested · not applied' : 'Entered weight · not applied';
  };
  const zeroDraft = row => {
    const input = inputFor(row.targetId);
    if (!input) return;
    input.value = '0'; input.dataset.lcfwSelectedIndex = '-1';
    draftStatus(row.targetId);
    host.querySelectorAll(`[data-lcfw-chip="${cssEscape(row.targetId)}"]`).forEach(chip => chip.classList.remove('lcfw-chip--active'));
    note('Skip sets a draft 0 kg assumption. Press Apply weights shown to save it.');
  };
  for (const row of review.rows) if (drafts.has(row.targetId)) {
    const input = inputFor(row.targetId), draft = drafts.get(row.targetId);
    if (input) { input.value = draft.value; input.dataset.lcfwSelectedIndex = draft.index; }
    draftStatus(row.targetId);
    host.querySelectorAll(`[data-lcfw-chip="${cssEscape(row.targetId)}"]`).forEach(chip =>
      chip.classList.toggle('lcfw-chip--active', chip.dataset.lcfwIndex === draft.index && Number(draft.value) === Number(chip.dataset.lcfwWeight)));
  }
  host.addEventListener('input', event => {
    if (event.target.matches?.('[data-lcfw-weight]')) { draftStatus(event.target.dataset.lcfwWeight); return; }
    if (!event.target.matches?.('[data-lcfw-search]')) return;
    search = event.target.value.trim().toLowerCase();
    const shown = new Set(shownRows().map(row => row.targetId));
    host.querySelectorAll('[data-lcfw-row]').forEach(row => { row.hidden = !shown.has(row.dataset.lcfwRow); });
    const count = host.querySelector('[data-lcfw-count]');
    if (count) count.textContent = `${shown.size} of ${review.rows.length} items shown`;
  });

  host.addEventListener('click', (event) => {
    if (event.target === host || event.target.closest('[data-lcfw-close]')) return close();
    if (event.target.closest('[data-lcfw-settings]')) {
      return openWeightReviewSettings({ documentRef, onApplied: () => {
        if (getBinding && getBinding() !== openingBinding) { note('Inputs changed. Close and reopen weight review.'); return; }
        const retained = new Map(review.rows.map(row => { const input = inputFor(row.targetId);
          return [row.targetId, { value: input?.value || '', index: input?.dataset.lcfwSelectedIndex || '-1' }]; }));
        close(); openFittingWeightDialog({ documentRef, dataset, masters, sidecar, onAccept, getBinding, drafts: retained });
      } });
    }
    const skip = event.target.closest('[data-lcfw-skip]');
    if (skip) { const row = review.rows.find(row => row.targetId === skip.dataset.lcfwSkip); if (row) zeroDraft(row); return; }
    if (event.target.closest('[data-lcfw-skip-shown]')) { shownRows().forEach(zeroDraft); return; }

    const chip = event.target.closest('[data-lcfw-chip]');
    if (chip) {
      const input = inputFor(chip.dataset.lcfwChip);
      if (input) {
        input.value = chip.dataset.lcfwWeight;
        input.dataset.lcfwSelectedIndex = chip.dataset.lcfwIndex;
        draftStatus(chip.dataset.lcfwChip);
        host.querySelectorAll(`[data-lcfw-chip="${cssEscape(chip.dataset.lcfwChip)}"]`)
          .forEach((row) => row.classList.toggle('lcfw-chip--active', row === chip));
      }
      return;
    }

    if (event.target.closest('[data-lcfw-apply-clear-winners]')) {
      shownRows().filter(canPrefillFittingWeight).forEach((row) => {
        const input = inputFor(row.targetId);
        if (input) { input.value = row.candidates[0].weightKg; input.dataset.lcfwSelectedIndex = '0'; }
        draftStatus(row.targetId);
      });
      host.querySelectorAll('[data-lcfw-chip]').forEach((row) => {
        const reviewRow = shownRows().find((entry) => entry.targetId === row.dataset.lcfwChip);
        if (!reviewRow) return;
        row.classList.toggle('lcfw-chip--active', row.dataset.lcfwIndex === '0' && canPrefillFittingWeight(reviewRow));
      });
      return;
    }

    if (event.target.closest('[data-lcfw-apply]')) {
      if ((getBinding && getBinding() !== openingBinding) || JSON.stringify(readWeightReviewPolicy()) !== openingPolicy) {
        host.querySelector('[data-lcfw-note]').textContent = 'Source or weight master changed. Close and reopen this review; no selections were applied.';
        return;
      }
      const records = [];
      const visible = shownRows();
      if (visible.some(row => { const value = String(inputFor(row.targetId)?.value ?? '').trim();
        return value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0); })) {
        note('Use a finite weight of 0 kg or more. Nothing was applied.'); return;
      }
      visible.forEach((row) => {
        const input = inputFor(row.targetId);
        if (!input) return;
        // An empty field is not a reviewed zero-weight assumption.
        if (String(input.value).trim() === '') return;
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < 0) return;
        const index = Number(input.dataset.lcfwSelectedIndex ?? row.bestCandidateIndex ?? -1);
        const selected = row.candidates[index];
        const candidate = value > 0 && selected && Number(selected.weightKg) === value ? selected
          : { weightKg: value, typeDesc: 'MANUAL', manualEntry: true, lengthQualified: false,
            reason: 'Reviewer-entered mass; catalogue suggestions are not the source of this value.' };
        records.push(fittingWeightRecordFor(row, candidate, candidate.manualEntry ? -1 : index, masters));
      });
      if (records.length === 0) {
        const note = host.querySelector('[data-lcfw-note]');
        if (note) note.textContent = 'Enter or select at least one weight before applying.';
        return;
      }
      try { onAccept?.(records); close(); }
      catch (error) { note(`Nothing applied: ${error.message}`); }
    }
  });
  return host;
}

function markup(review) {
  const { rows, summary } = review;
  if (rows.length === 0) {
    return panel(`
      <p class="lcfw-empty">No equipment in your review settings is missing a weight. ${summary.omittedResolvedCount} applied weights retained.</p>
      <div class="lcfw-actions"><button type="button" data-lcfw-settings>Weight review settings…</button></div>
      <div class="lcfw-actions"><button type="button" data-lcfw-close>Close</button></div>`);
  }
  return panel(`
    <p class="lcfw-lead">${summary.fittingCount} unresolved manual item(s) · ${summary.omittedResolvedCount} current resolved weights retained. Suggested weights are drafts, not applied.
      Edit a weight or choose a candidate; <strong>Skip → 0 kg</strong> records an explicit zero-weight assumption when you Apply. Blank stays pending. Cancel saves nothing.</p>
    <div class="lcfw-actions"><label>Find component <input type="search" data-lcfw-search aria-label="Find component" placeholder="Description, ID, type or bore"></label><span data-lcfw-count>${rows.length} of ${rows.length} items shown</span><button type="button" data-lcfw-settings>Weight review settings…</button></div>
    <details><summary>How suggestions are matched</summary><p class="lcfw-meta">
      Suggestions are ranked by bore, rating, measured
      face-to-face length and description keyword (e.g. GATE, GLOBE, BALL) against
      ${summary.weightMasterRowCount} Weights master rows.
      ${summary.singleCandidate} match one row outright, ${summary.clearWinner} have a clear ranked winner among several,
      ${summary.needsChoice} are genuinely tied, and ${summary.unresolvable} have no candidate at all.
      Only clear dimension/family matches are prefilled. Factor, interpolation and bore/rating-only suggestions stay blank until explicitly reviewed.
      ${summary.weightMasterRowCount === 0 ? 'No weight master is loaded; manual entry and Skip are still available.' : ''}</p></details>
    <div class="lcfw-table-wrap">
      <table class="lcfw-table">
        <thead><tr>
          <th>Description</th><th>Type</th><th>Bore</th><th>Rating</th><th>Length</th>
          <th>Keyword</th><th>Weight (kg)</th><th>Candidates</th><th>Action</th>
        </tr></thead>
        <tbody>${rows.map(rowMarkup).join('')}</tbody>
      </table>
    </div>
    <p class="lcfw-note" data-lcfw-note></p>
    <div class="lcfw-actions">
      <button type="button" data-lcfw-apply-clear-winners ${rows.some(canPrefillFittingWeight) ? '' : 'disabled'}>Fill clear dimension / family matches (${rows.filter(canPrefillFittingWeight).length})</button>
      <button type="button" data-lcfw-skip-shown>Skip shown → 0 kg</button>
      <button type="button" data-lcfw-apply class="lcfw-primary">Apply weights shown</button>
      <button type="button" data-lcfw-close>Cancel</button>
    </div>`);
}

function rowMarkup(row) {
  const best = row.candidates[0];
  const prefill = canPrefillFittingWeight(row);
  const rowClass = prefill ? 'lcfw-status--clear' : 'lcfw-status--tied';
  return `<tr class="${rowClass}" data-lcfw-row="${escapeHtml(row.targetId)}">
    <td><strong>${escapeHtml(row.description || row.targetId)}</strong><small class="lcfw-meta">${escapeHtml(row.targetId)}</small></td>
    <td>${escapeHtml(row.type)}</td>
    <td>${row.boreMm ? `DN${escapeHtml(row.boreMm)}` : '—'}</td>
    <td>${row.rating ? `${escapeHtml(row.rating)}#` : '—'}</td>
    <td>${row.lengthMm ? `${escapeHtml(row.lengthMm)} mm` : '—'}</td>
    <td>${row.valveHint ? `<span class="lcfw-hint">${escapeHtml(row.valveHint)}</span>` : '—'}</td>
    <td><input aria-label="Reviewed weight for ${escapeHtml(row.targetId)} in kg" type="number" min="0" step="0.001" class="lcfw-weight-input" data-lcfw-weight="${escapeHtml(row.targetId)}" data-lcfw-selected-index="${prefill ? '0' : '-1'}" value="${prefill ? escapeHtml(best.weightKg) : ''}"><span class="lcfw-meta" data-lcfw-status="${escapeHtml(row.targetId)}">${prefill ? 'Suggested · not applied' : 'Enter weight or Skip'}</span></td>
    <td class="lcfw-chips">${row.candidates.map((candidate, index) => chipMarkup(row.targetId, candidate, index, prefill)).join('') || `<span class="lcfw-meta">${escapeHtml(unresolvableText(row.unresolvable))}</span>`}</td>
    <td><button type="button" data-lcfw-skip="${escapeHtml(row.targetId)}" aria-label="Skip ${escapeHtml(row.targetId)} weight → 0 kg">Skip → 0 kg</button></td>
  </tr>`;
}

function chipMarkup(targetId, candidate, index, prefill) {
  const marker = index === 0 && prefill ? '★ ' : (candidate.rejected ? '× ' : '');
  const classes = ['lcfw-chip'];
  if (index === 0 && prefill) classes.push('lcfw-chip--best', 'lcfw-chip--active');
  if (candidate.rejected) classes.push('lcfw-chip--rejected');
  const title = [
    candidate.typeDesc,
    `${candidate.weightKg} kg`,
    `F/F ${candidate.rowLengthMm} mm (Δ${round(candidate.lengthDeltaMm)} mm)`,
    candidate.reason || '',
  ].filter(Boolean).join(' · ');
  return `<button type="button" class="${classes.join(' ')}" data-lcfw-chip="${escapeHtml(targetId)}" data-lcfw-index="${index}" data-lcfw-weight="${escapeHtml(candidate.weightKg)}" title="${escapeHtml(title)}">${marker}${escapeHtml(candidate.typeDesc)} · ${escapeHtml(candidate.weightKg)}kg</button>`;
}

function unresolvableText(code) {
  if (code === 'NO_BORE') return 'Bore missing — enter a weight or Skip.';
  if (code === 'NO_BORE_OR_LENGTH') return 'This fitting has no bore or no measurable face-to-face length, so no catalogue row can be matched to it.';
  if (code === 'NO_CANDIDATE') return 'No Weights master row shares this bore and rating.';
  return 'No match — enter a weight or Skip.';
}

function panel(body) {
  return `<div class="lcfw-panel" role="dialog" aria-modal="true" aria-label="Component weight review">
    <header class="lcfw-head"><h2>Component weight review</h2><button type="button" data-lcfw-close aria-label="Close">✕</button></header>
    ${body}
  </div>`;
}

function round(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) / 100 : value;
}

function cssEscape(value) {
  return String(value ?? '').replace(/["\\]/gu, '\\$&');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

function styles() {
  return `<style>
    .lcfw-backdrop{position:fixed;inset:0;z-index:9000;background:rgba(2,6,16,.72);display:flex;align-items:center;justify-content:center;padding:24px}
    .lcfw-panel{display:flex;flex-direction:column;gap:10px;max-width:1280px;width:100%;max-height:88vh;overflow:auto;padding:16px 18px;border:1px solid #334155;border-radius:9px;background:#0b1424;color:#e2e8f0;box-shadow:0 18px 48px rgba(0,0,0,.55)}
    .lcfw-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .lcfw-head h2{margin:0;font-size:17px}
    .lcfw-head button{border:1px solid #334155;border-radius:5px;background:#111c2f;color:#e2e8f0;padding:5px 9px;cursor:pointer}
    .lcfw-lead{margin:0;color:#bae6fd;font-size:12px;line-height:1.5;padding:9px 11px;border:1px solid #155e75;border-radius:6px;background:#082f49}
    .lcfw-empty{margin:0;color:#94a3b8}
    .lcfw-table-wrap{overflow:auto;max-height:56vh;border:1px solid #293548;border-radius:7px}
    .lcfw-table{width:100%;border-collapse:collapse;font-size:12px}
    .lcfw-table th{position:sticky;top:0;text-align:left;color:#94a3b8;font-size:10px;text-transform:uppercase;padding:7px 8px;background:#101b2d;border-bottom:1px solid #26354a;white-space:nowrap}
    .lcfw-table td{padding:7px 8px;border-bottom:1px solid #1b2839;vertical-align:top}
    .lcfw-table tr[hidden]{display:none}
    .lcfw-table td button:not(.lcfw-chip),.lcfw-actions input{border:1px solid #334155;border-radius:5px;background:#111c2f;color:#e2e8f0;padding:7px 9px}
    .lcfw-actions{align-items:center}
    .lcfw-table tr.lcfw-status--clear{background:#0d1728}
    .lcfw-table tr.lcfw-status--tied{background:#1c1207}
    .lcfw-table tr.lcfw-row--blocked{background:#1a0e0e}
    .lcfw-meta{display:block;color:#94a3b8;font-size:11px;margin-top:2px}
    .lcfw-blocked-note{margin:4px 0 0;color:#fca5a5;font-size:11px}
    .lcfw-hint{padding:2px 6px;border-radius:999px;border:1px solid #334155;background:#111c2f;color:#c4b5fd;font-size:10px;white-space:nowrap}
    .lcfw-weight-input{width:90px;padding:5px 6px;border:1px solid #334155;border-radius:4px;background:#07101e;color:#e2e8f0}
    .lcfw-chips{display:flex;flex-wrap:wrap;gap:4px;max-width:420px}
    .lcfw-chip{font-size:10px;line-height:1.1;padding:4px 7px;border-radius:999px;border:1px solid #334155;background:#111c2f;color:#cbd5e1;cursor:pointer;white-space:nowrap}
    .lcfw-chip--best{border-color:#166534;color:#86efac}
    .lcfw-chip--active{outline:2px solid #0ea5e9;outline-offset:1px}
    .lcfw-chip--rejected{border-style:dashed;opacity:.65}
    .lcfw-note{margin:0;min-height:16px;color:#fbbf24;font-size:11px}
    .lcfw-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
    .lcfw-actions button{border:1px solid #334155;border-radius:5px;background:#111c2f;color:#e2e8f0;padding:7px 12px;cursor:pointer}
    .lcfw-primary{border-color:#0ea5e9;background:#0c4a6e;color:#e0f2fe}
  </style>`;
}
