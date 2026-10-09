/** Read-only presentation of the existing allocation ledger; no statics here. */
export function renderLoadCalcExceptionReview(loadCase, current, supportSiteModel) {
  const records = loadCase.exceptionLedger || [];
  if (!records.length) return '<p>No allocation exceptions recorded.</p>';
  const sites = new Map((supportSiteModel?.sites || []).map((site) => [site.siteId, site]));
  const groups = new Map();
  for (const row of records) {
    const key = JSON.stringify([row.code, row.routeId]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return `<section aria-label="Allocation exception review" data-load-exception-review>
    <p>${current ? 'Current' : 'Historical / STALE'} allocation evidence only.
      Unallocated demand has no qualified route-local bearing path. Overhang force
      is allocated, but its signed member-transfer moment remains a separate demand,
      not a solved global support moment. Selecting an entity does not approve a support.</p>
    ${[...groups.values()].map((rows) => groupMarkup(rows, current, sites)).join('')}
  </section>`;
}

function groupMarkup(rows, current, sites) {
  const { code, routeId } = rows[0];
  const unallocated = code === 'UNALLOCATED_FORCE_NO_QUALIFIED_VERTICAL_SUPPORT';
  const overhang = code === 'OVERHANG_CANTILEVER_TRANSFER';
  const label = unallocated ? 'Unallocated load' : overhang ? 'Overhang transfer' : String(code || 'Unknown exception');
  const momentField = overhang ? 'momentDemandNmm' : unallocated ? 'firstMomentNmm' : null;
  const momentLabel = overhang ? 'Transfer demand' : unallocated ? 'Unallocated first moment' : 'Moment not classified';
  return `<details ${unallocated ? 'open' : ''} data-load-exception-code="${escapeHtml(code)}">
    <summary>${escapeHtml(label)} · ${escapeHtml(routeId || 'Route not supplied')} ·
      ${rows.length} records · ${quantityTotal(rows, 'verticalForceN', 'N')}
      ${momentField ? ` · ${quantityTotal(rows, momentField, 'N·mm')}` : ''}${current ? '' : ' · STALE'}</summary>
    <p>${unallocated ? 'Review actual attachment and vertical support-type authority; no reaction path is invented.'
      : overhang ? 'Review the member/cantilever transfer path; this is not a moment-resisting support approval.'
        : 'Unrecognized exception retained without numerical interpretation.'}</p>
    <table><thead><tr><th>Entity</th><th>Vertical demand (N)</th><th>${escapeHtml(momentLabel)} (N·mm)</th>
      <th>${overhang ? 'Eccentricity' : 'Application chainage'} (mm)</th><th>Receiving support</th></tr></thead>
      <tbody>${rows.map((row) => recordMarkup(row, momentField, overhang, sites)).join('')}</tbody>
    </table>
  </details>`;
}

function recordMarkup(row, momentField, overhang, sites) {
  const site = sites.get(row.supportSiteId);
  const siteText = site?.tags?.length ? site.tags.join(', ') : row.supportSiteId;
  // Reuse the existing result-table exact-entity selection handler. It only
  // selects workspace entities; it never writes capability or approval inputs.
  const entity = row.entityId
    ? `<button type="button" data-load-support-entity-id="${escapeHtml(row.entityId)}">${escapeHtml(row.entityId)}</button>`
    : 'Entity not supplied';
  return `<tr><td>${entity}</td><td>${quantity(row.verticalForceN)}</td>
    <td>${momentField ? quantity(row[momentField]) : '—'}</td>
    <td>${quantity(row[overhang ? 'eccentricityMm' : 'applicationChainageMm'])}</td>
    <td>${escapeHtml(siteText || 'Not allocated')}</td></tr>`;
}

function quantityTotal(rows, field, unit) {
  if (!rows.every((row) => Number.isFinite(row[field]))) return `Unavailable ${unit}`;
  return `${quantity(rows.reduce((sum, row) => sum + row[field], 0))} ${unit}`;
}

function quantity(value) {
  return Number.isFinite(value) ? value.toFixed(3) : '—';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
