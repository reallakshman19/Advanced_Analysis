import {
  buildFittingWeightReviewRows,
  fittingWeightRecordFor,
} from './load-calc-fitting-weight-review.js';
import { zeroMassWaiverSuggested } from './engineering-loads/non-fea-zero-mass-waiver.js';

/**
 * Review table for catalogue fitting weights, styled on the XML->CII
 * standalone Weight Match phase (weight-match-renderer.js): a chip per
 * candidate showing its weight and rank reason, an editable weight input
 * pre-filled with the top-ranked candidate, and a bulk "apply all clear
 * winners" action -- rather than a single-choice picker.
 *
 * Ported the interaction model, not the file: the original renders inline
 * inside its own workflow shell and depends on XML/Branch/Node concepts this
 * dataset does not have (Preview Rating snapshot, DTXR-rating toggle,
 * in->mm length conversion, editable keyword-rule tables). This keeps the
 * part that matters for a review decision -- ranked chips, an editable
 * weight, and visibility into why a candidate ranked where it did.
 */
export function openFittingWeightDialog({ documentRef, dataset, masters, onAccept }) {
  const review = buildFittingWeightReviewRows({ dataset, masters });
  const host = documentRef.createElement('div');
  host.className = 'lcfw-backdrop';
  host.dataset.role = 'load-calc-fitting-weight-dialog';
  host.innerHTML = `${styles()}${markup(review)}`;
  documentRef.body.appendChild(host);

  const close = () => host.remove();
  const inputFor = (targetId) => host.querySelector(`[data-lcfw-weight="${cssEscape(targetId)}"]`);

  host.addEventListener('click', (event) => {
    if (event.target === host || event.target.closest('[data-lcfw-close]')) return close();

    const chip = event.target.closest('[data-lcfw-chip]');
    if (chip) {
      const input = inputFor(chip.dataset.lcfwChip);
      if (input) {
        input.value = chip.dataset.lcfwWeight;
        input.dataset.lcfwSelectedIndex = chip.dataset.lcfwIndex;
        host.querySelectorAll(`[data-lcfw-chip="${cssEscape(chip.dataset.lcfwChip)}"]`)
          .forEach((row) => row.classList.toggle('lcfw-chip--active', row === chip));
      }
      return;
    }

    if (event.target.closest('[data-lcfw-apply-clear-winners]')) {
      review.rows.filter((row) => row.clearWinner).forEach((row) => {
        const input = inputFor(row.targetId);
        if (input) { input.value = row.candidates[0].weightKg; input.dataset.lcfwSelectedIndex = '0'; }
      });
      host.querySelectorAll('[data-lcfw-chip]').forEach((row) => {
        row.classList.toggle('lcfw-chip--active', row.dataset.lcfwIndex === '0');
      });
      return;
    }

    if (event.target.closest('[data-lcfw-apply]')) {
      const records = [];
      const waivers = [];
      let waiverMissingReason = null;
      host.querySelectorAll('[data-lcfw-waive]:checked').forEach((box) => {
        const entityId = box.dataset.lcfwWaive;
        const justification = host
          .querySelector(`[data-lcfw-waive-reason="${cssEscape(entityId)}"]`)?.value?.trim() || '';
        if (!justification) { waiverMissingReason = entityId; return; }
        waivers.push({ entityId, justification });
      });
      if (waiverMissingReason) {
        const note = host.querySelector('[data-lcfw-note]');
        if (note) note.textContent = `Enter a reason for the zero-mass waiver on ${waiverMissingReason}.`;
        return;
      }
      review.rows.forEach((row) => {
        const input = inputFor(row.targetId);
        if (!input || input.value.trim() === '') return;
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < 0) return;
        const index = Number(input.dataset.lcfwSelectedIndex ?? row.bestCandidateIndex ?? -1);
        const candidate = row.candidates[index] || { weightKg: value, typeDesc: 'MANUAL', lengthQualified: false, reason: 'Manually entered' };
        records.push(fittingWeightRecordFor(row, { ...candidate, weightKg: value }, index, masters));
      });
      if (records.length === 0 && waivers.length === 0) {
        const note = host.querySelector('[data-lcfw-note]');
        if (note) note.textContent = 'Enter or select at least one weight, or waive a component, before applying.';
        return;
      }
      close();
      onAccept?.(records, waivers);
    }
  });
  return host;
}

function markup(review) {
  const { rows, summary } = review;
  if (summary.weightMasterRowCount === 0) {
    return panel(`
      <p class="lcfw-empty">The Weights master has no rows. Import it in Import Masters before reviewing fitting weights.</p>
      <div class="lcfw-actions"><button type="button" data-lcfw-close>Close</button></div>`);
  }
  if (rows.length === 0) {
    return panel(`
      <p class="lcfw-empty">No catalogue fitting is currently missing a component weight.</p>
      <div class="lcfw-actions"><button type="button" data-lcfw-close>Close</button></div>`);
  }
  return panel(`
    <p class="lcfw-lead">${summary.fittingCount} fitting(s) need a catalogue weight, ranked by bore, rating, measured
      face-to-face length and description keyword (e.g. GATE, GLOBE, BALL) against
      ${summary.weightMasterRowCount} Weights master rows.
      ${summary.singleCandidate} match one row outright, ${summary.clearWinner} have a clear ranked winner among several,
      ${summary.needsChoice} are genuinely tied, and ${summary.unresolvable} have no candidate at all.
      Every weight below is editable before applying.</p>
    <div class="lcfw-table-wrap">
      <table class="lcfw-table">
        <thead><tr>
          <th>Description</th><th>Type</th><th>Bore</th><th>Rating</th><th>Length</th>
          <th>Keyword</th><th>Weight (kg)</th><th>Candidates</th>
        </tr></thead>
        <tbody>${rows.map(rowMarkup).join('')}</tbody>
      </table>
    </div>
    <p class="lcfw-note" data-lcfw-note></p>
    <div class="lcfw-actions">
      <button type="button" data-lcfw-apply-clear-winners>Fill all clear winners (${summary.singleCandidate + summary.clearWinner})</button>
      <button type="button" data-lcfw-apply class="lcfw-primary">Apply weights shown</button>
      <button type="button" data-lcfw-close>Cancel</button>
    </div>`);
}

function rowMarkup(row) {
  const best = row.candidates[0] || { weightKg: '' };
  const rowClass = row.unresolvable ? 'lcfw-status--tied lcfw-row--blocked' : (row.clearWinner ? 'lcfw-status--clear' : 'lcfw-status--tied');
  
  let candidatesMarkup = '';
  if (row.unresolvable) {
    candidatesMarkup = `<p class="lcfw-blocked-note" style="margin:0">${escapeHtml(unresolvableText(row.unresolvable))}</p>
      ${waiverMarkup(row)}`;
  } else {
    candidatesMarkup = row.candidates.map((candidate, index) => chipMarkup(row.targetId, candidate, index)).join('');
  }

  return `<tr class="${rowClass}">
    <td><strong>${escapeHtml(row.description || row.targetId)}</strong></td>
    <td>${escapeHtml(row.type)}</td>
    <td>${row.boreMm ? `DN${escapeHtml(row.boreMm)}` : '—'}</td>
    <td>${row.rating ? `${escapeHtml(row.rating)}#` : '—'}</td>
    <td>${row.lengthMm != null ? `${escapeHtml(row.lengthMm)} mm` : '—'}</td>
    <td>${row.valveHint ? `<span class="lcfw-hint">${escapeHtml(row.valveHint)}</span>` : '—'}</td>
    <td><input type="number" min="0" step="any" class="lcfw-weight-input" data-lcfw-weight="${escapeHtml(row.targetId)}" data-lcfw-selected-index="0" value="${escapeHtml(best.weightKg)}"></td>
    <td class="lcfw-chips">${candidatesMarkup}</td>
  </tr>`;
}

/**
 * The zero-mass waiver control, offered only where the catalogue genuinely
 * cannot answer.
 *
 * The checkbox defaults to suggested-only (a pressure gauge, a temperature
 * instrument) and the reason is required, because a waiver without a stated
 * reason is exactly the unexplained zero this control exists to replace. The
 * suggestion is drawn from the description, never the component type: this
 * dataset types a 900# angle control valve as INST, and a type rule would
 * silently zero it.
 */
function waiverMarkup(row) {
  const suggested = zeroMassWaiverSuggested(row.description);
  const reason = suggested
    ? `${row.description || 'Instrument'} carries no weighable mass for support-load purposes.`
    : '';
  return `<label class="lcfw-waiver">
      <input type="checkbox" data-lcfw-waive="${escapeHtml(row.targetId)}" ${suggested ? 'checked' : ''}>
      <span>Waive as zero mass</span>
    </label>
    <input type="text" class="lcfw-waiver-reason" data-lcfw-waive-reason="${escapeHtml(row.targetId)}"
      placeholder="Reason for the waiver (required)" value="${escapeHtml(reason)}">`;
}

function chipMarkup(targetId, candidate, index) {
  const marker = index === 0 && !candidate.rejected ? '★ ' : (candidate.rejected ? '× ' : '');
  const classes = ['lcfw-chip'];
  if (index === 0 && !candidate.rejected) classes.push('lcfw-chip--best', 'lcfw-chip--active');
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
  if (code === 'NO_BORE_OR_LENGTH') return 'This fitting has no bore or no measurable face-to-face length, so no catalogue row can be matched to it.';
  if (code === 'NO_CANDIDATE') return 'No Weights master row shares this bore and rating.';
  return 'Candidate ranking failed for this fitting.';
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
    .lcfw-waiver{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;color:#cbd5f5}
    .lcfw-waiver-reason{width:100%;margin-top:4px;padding:4px 6px;border:1px solid #334155;border-radius:4px;background:#0b1526;color:#e2e8f0;font-size:12px}
    .lcfw-primary{border-color:#0ea5e9;background:#0c4a6e;color:#e0f2fe}
  </style>`;
}
