import { semanticHash } from '../../core/shared-piping-model/index.js';

export function requiresApproximateMatchReview(proposal) {
  const evidence = proposal?.record?.evidence;
  return evidence?.matchMode === 'APPROXIMATE_CLASS_MATCH' || evidence?.classMatchNeedsReview === true;
}

/** Read-only grouping; scores are the existing resolver's output, not approval. */
export function buildApproximateMatchPreview(proposals = []) {
  const groups = new Map();
  for (const proposal of proposals.filter(requiresApproximateMatchReview)) {
    const evidence = proposal.record.evidence;
    const basis = {
      requested: evidence.requestedPipingClass, resolved: evidence.resolvedPipingClass,
      boreMm: evidence.boreMm, line: evidence.lineKey,
      masterHash: evidence.pipingClassSourceHash, lineListHash: evidence.lineListSourceHash,
    };
    const key = semanticHash(basis);
    const group = groups.get(key) || { key, ...basis, evidence, proposals: [] };
    group.proposals.push(proposal);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    targetCount: new Set(group.proposals.map((proposal) => proposal.record.selectorKey)).size,
    fields: [...new Set(group.proposals.map((proposal) => proposal.record.fieldId))].sort(),
  })).sort((a, b) => String(a.line).localeCompare(String(b.line)) || Number(a.boreMm) - Number(b.boreMm));
}

export function approximateMatchPreviewMarkup(proposals) {
  const groups = buildApproximateMatchPreview(proposals);
  const count = groups.reduce((sum, group) => sum + group.proposals.length, 0);
  return `<section class="nfe-panel amp" data-role="approximate-match-preview" style="margin-top:12px">
    <header><div><span class="panel-eyebrow">MASTER MATCH REVIEW</span><h3>Approximate match preview</h3></div><span class="chip warning">${count} fields pending</span></header>
    <p>Compare source class with the suggested master before applying. Confidence is a ranking signal, not engineering approval. Source geometry is unchanged.</p>
    <label>Search matches <input type="search" data-approx-filter placeholder="Class, line or bore" aria-label="Search approximate matches"></label>
    <p data-approx-count aria-live="polite">${groups.length} match groups</p>
    ${groups.map(groupMarkup).join('') || '<p class="empty">No approximate class matches are waiting for review.</p>'}
  </section>${previewStyles()}`;
}

function groupMarkup(group) {
  const evidence = group.evidence;
  const values = [...new Set(group.proposals.map(({ record }) => `${record.fieldId}: ${record.value} ${record.unit}`))];
  const classRows = evidence.classCandidates || [];
  const rowRows = evidence.rowCandidates || [];
  return `<details class="amp-group" data-approx-group="${esc(group.key)}" data-approx-search="${esc(`${group.requested} ${group.resolved} ${group.line} DN${group.boreMm}`.toLowerCase())}">
    <summary><strong>${esc(group.requested)} → ${esc(group.resolved)}</strong><span>DN${esc(group.boreMm)} · ${esc(group.line)} · ${group.targetCount} pipes</span><span class="amp-score">${confidence(evidence.classMatchConfidence)} confidence · Review required</span></summary>
    <div class="amp-body"><dl><dt>Source class</dt><dd>${esc(group.requested)}</dd><dt>Suggested class</dt><dd>${esc(group.resolved)}</dd><dt>Match method</dt><dd>${esc(evidence.classMatchMethod)}</dd><dt>Reasons</dt><dd>${esc((evidence.classMatchReasons || []).join(', ') || 'See proposal rationale')}</dd><dt>Master revision</dt><dd><code>${esc(group.masterHash || 'NOT_AVAILABLE')}</code></dd></dl>
    <h4>Ranked class candidates</h4>${candidateTable(['Class', 'Score', 'Confidence', 'Reason'], classRows.map(row => [row.candidate, row.score, confidence(row.confidence), (row.reasons || []).join(', ')]))}
    <h4>Ranked section rows</h4>${candidateTable(['Wall (mm)', 'Rating', 'Schedule', 'Score', 'Reason'], rowRows.map(row => [row.wallThickness, row.rating, row.schedule, row.score, (row.reasons || []).join(', ')]))}
    <h4>Proposed field changes</h4><ul>${values.map(value => `<li>${esc(value)}</li>`).join('')}</ul>
    <details><summary>Exact affected pipe selectors (${group.targetCount})</summary><ul>${[...new Set(group.proposals.map(proposal => proposal.record.selectorKey))].map(key => `<li><code>${esc(key)}</code></li>`).join('')}</ul></details>
    <label class="amp-confirm"><input type="checkbox" data-approx-confirm="${esc(group.key)}"> I confirm this master match and the proposed section values for these exact pipes.</label>
    <div class="amp-actions"><button type="button" data-approx-apply="${esc(group.key)}" disabled>Apply reviewed match (${group.proposals.length} fields)</button><button type="button" data-approx-reject="${esc(group.key)}">Reject this match</button></div></div>
  </details>`;
}

export function bindApproximateMatchPreview(container, { proposals, onApply, onReject }) {
  const groups = buildApproximateMatchPreview(proposals);
  container.querySelector('[data-approx-filter]')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    let visible = 0;
    container.querySelectorAll('[data-approx-group]').forEach((element) => {
      element.hidden = !element.dataset.approxSearch.includes(query);
      if (!element.hidden) visible += 1;
    });
    container.querySelector('[data-approx-count]').textContent = `${visible} of ${groups.length} match groups`;
  });
  container.querySelectorAll('[data-approx-confirm]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      checkbox.closest('[data-approx-group]').querySelector('[data-approx-apply]').disabled = !checkbox.checked;
    });
  });
  container.querySelectorAll('[data-approx-apply], [data-approx-reject]').forEach((button) => {
    button.addEventListener('click', () => {
      const applying = button.hasAttribute('data-approx-apply');
      const key = applying ? button.dataset.approxApply : button.dataset.approxReject;
      const group = groups.find(row => row.key === key);
      if (!group) return;
      if (applying && !button.closest('[data-approx-group]').querySelector('[data-approx-confirm]').checked) return;
      (applying ? onApply : onReject)(group);
    });
  });
}

function candidateTable(headers, rows) {
  return rows.length ? `<div class="table-wrap"><table><thead><tr>${headers.map(value => `<th>${esc(value)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${esc(value ?? 'Not supplied')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p>No ranked alternatives were retained. No candidates are invented.</p>';
}
function confidence(value) { return Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'Not supplied'; }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]); }
function previewStyles() {
  return `<style>.amp>header{align-items:center}.amp input[type=search]{width:min(100%,380px);box-sizing:border-box}.amp-group{border:1px solid #475569;border-radius:6px;margin:10px 0;overflow:hidden}.amp-group>summary{cursor:pointer;padding:12px;background:#142036;display:flex;flex-wrap:wrap;gap:8px 16px}.amp-group>summary strong{color:#e2e8f0}.amp-group>summary span{color:#94a3b8;font-size:12px}.amp-group>summary .amp-score{color:#fbbf24;margin-left:auto}.amp-body{padding:12px}.amp-body h4{margin:14px 0 8px}.amp-body dl{grid-template-columns:140px minmax(0,1fr)}.amp-confirm{display:flex;align-items:flex-start;gap:8px;padding:12px;background:#251f13;border:1px solid #854d0e;color:#fde68a;margin:12px 0}.amp-actions{display:flex;flex-wrap:wrap;gap:8px}.amp button:focus-visible,.amp input:focus-visible,.amp summary:focus-visible{outline:2px solid #38bdf8;outline-offset:3px}.amp [hidden]{display:none!important}</style>`;
}
