/** Presentation only: never synthesize vectors/projections from scalar gravity. */
export function gravitySourceAxisLabel(distribution) {
  const basis = distribution?.sourceAxisBasis;
  return /^[XYZ]_UP$/.test(basis || '') ? `${basis[0]}-up` : 'axis unavailable';
}

export function renderLoadCalcQuantityScope(distribution) {
  if (!distribution?.loadCases?.length) return '';
  const current = distribution.freshness?.status === 'CURRENT';
  const knownMethod = ['CHAINAGE_TRIBUTARY_SPAN_V2', 'CHAINAGE_TRIBUTARY_SPAN_V3_COG']
    .includes(distribution.method);
  const cases = distribution.loadCases.map(loadCase => {
    const rows = loadCase.supportResults || [];
    const count = rows.filter(row => knownMethod && publishable(loadCase.status)
      && publishable(row.status) && Number.isFinite(row.verticalForceN)).length;
    return `${escapeHtml(loadCase.loadCaseId)}: ${count} / ${rows.length} ${current ? 'current' : 'historical'} rows`;
  }).join(' · ');
  return `<details open data-load-quantity-scope class="load-quantity-scope">
    <summary>Load quantities — gravity is not a full vector result</summary>
    <p>Method: ${escapeHtml(distribution.method || 'Unavailable')} · source ${gravitySourceAxisLabel(distribution)}.
      ${current ? 'Current gravity evidence' : 'Historical only — rerun required'}.
      Counts below describe available support rows, not complete system load coverage.</p>
    <table><thead><tr><th>Quantity</th><th>This run / required basis</th></tr></thead><tbody>
      <tr><th scope="row">Vertical gravity reaction (N)</th><td>${cases}.
        Positive reaction opposes source-axis gravity; signed values remain in the support table.</td></tr>
      <tr><th scope="row">Fv · rest-axis projection (N)</th><td>Not produced by scalar gravity.
        Requires the method-owned restraint rest basis; verticalForceN is not silently relabelled Fv.</td></tr>
      <tr><th scope="row">Fh · empirical guide magnitude (N)</th><td>Existing ACCESS_TEMP_WALL_WEIGHTED_V1 screening:
        max(rounded temperature/wall term, 0.30 × OPE vertical demand) with the existing profile.
        Use the separate screening preview below. This is an unsigned estimate, not a solved horizontal vector;
        this gravity run does not produce it. Not evaluated is not zero.</td></tr>
      <tr><th scope="row">Fa · line-stop projection (N)</th><td>Not produced by scalar gravity. Requires method-owned line-stop basis and reaction.</td></tr>
      <tr><th scope="row">Fl · guide projection (N)</th><td>Not produced by scalar gravity. Requires method-owned guide basis and reaction.</td></tr>
      <tr><th scope="row">MX / MY / MZ · global reactions (N·m)</th><td>Not produced by scalar gravity.
        Route-chainage transfer demands (N·mm) are not recovered support moments.</td></tr>
    </tbody></table>
    <p>Configured scenario results have a separate method/authorization and expose existing globalReaction and anchorDecomposition fields within their qualified scope.
      Imported reference loads are not calculated reactions. No missing quantity is supplied as zero.</p>
  </details>`;
}

function publishable(status) {
  return status === 'CALCULATED' || status === 'CALCULATED_WITH_EXCEPTIONS';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[char]);
}
