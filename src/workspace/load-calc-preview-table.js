import { effectivePreviewFields, previewWeightStatus } from './load-calc-preview-model.js';
import { isManualWeightReviewType } from './load-calc-weight-review-scope.js';
import { fittingPipeDependency } from './load-calc-workbench/pipe-section-review.js';

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
export const num = (value) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 4 }) : 'Pending';

export function previewRowMarkup(row, caseId, allRows = []) {
  const fields = effectivePreviewFields(row);
  const mass = row.mass[caseId];
  const weight = previewWeightStatus(row, caseId);
  const dependency = fittingPipeDependency(row, allRows);
  const proposed = row.proposed.map(({ record }) => `<span>${esc(record.fieldId)}: <b>${esc(record.value)} ${esc(record.unit)}</b></span>`).join('');
  const match = row.proposed.find(({ record }) => record.evidence?.rowCandidates?.length)?.record.evidence;
  const suggestions = [...new Set((match?.rowCandidates || []).filter((candidate) => candidate.score === match.rowCandidates[0].score).map((candidate) => candidate.schedule).filter((value) => value != null))];
  const section = dependency ? `<span>Uses branch pipe section${dependency.boreMm == null ? '' : ` · DN${num(dependency.boreMm)}`}</span><small>No separate fitting OD/wall/density review.</small>${dependency.pipes.length ? `<button type="button" data-pipe-section-branch="${esc(dependency.branchId)}" data-pipe-section-bore="${dependency.boreMm}">Review pipe basis</button>` : '<small>Matching pipe basis unresolved; inspect source/master mapping.</small>'}`
    : weight.sectionNotRequired ? '<span>Point-weight basis</span><small>OD, wall and metal density are not required for this dry weight.</small>'
    : fields.slice(0, 3).map((field) => `<span>${esc(field.label)}: <b>${num(field.value ?? field.borrowedValue)}</b>${field.borrowedValue !== null ? '<small>Pipe derivation basis — not own section</small>' : ''}</span>`).join('');
  const status = [...row.notes, ...row.missing, ...(row.cases[caseId].ok ? [] : row.cases[caseId].blockers)];
  const manual = row.manualReviewRequired ?? isManualWeightReviewType(row.type, row);
  return `<tr data-preview-entity="${esc(row.entityId)}"><td><b>${esc(row.entityId)}</b><span>${esc(row.type)} · ${esc(row.component.identity?.lineId || '')}</span><small>${esc(row.branchId || 'No branch')}</small></td>
    <td><span>Source bore: <b>${row.sourceBoreMm == null ? 'Not supplied' : `${num(row.sourceBoreMm)} mm`}</b></span><span>${row.type === 'PIPE' ? 'Pipe' : 'Fitting'} description Sch: <b>${esc(row.sourceSchedule || 'Not supplied')}</b></span><small>${esc(row.description || 'No source DTXR description')}</small></td>
    <td>${section}${insulationInputMarkup(row, fields)}${row.derived ? `<small>Dry derivation borrows OD ${num(row.derived.derivation.outerDiameterMm)} / wall ${num(row.derived.derivation.wallThicknessMm)} mm — not own section.</small>` : ''}</td>
    <td>${proposed || '<span>No pending proposal for this entity</span>'}${match ? `<small>Class ${esc(match.requestedPipingClass)} → ${esc(match.resolvedPipingClass)} · ${num(match.classMatchConfidence * 100)}% ranking<br>Top candidate Sch ${esc(suggestions.join(' / ') || 'Not supplied')} · ${esc(match.classMatchMethod)}</small>` : ''}</td>
    <td><span>Dry / metal: <b>${num(mass.metalKg)}</b>${row.derived ? ' (derived preview)' : ''}</span><span>${esc(caseId)} fluid: <b>${num(mass.fluidKg)}</b></span><span>Insulation: <b>${row.type === 'PIPE' ? num(mass.insulationKg) : 'Not included in point dry mass'}</b></span><span>${esc(caseId)} ${mass.compositionMassKg != null ? 'mass (dry only)' : `core${mass.dryOnly ? ' (dry only)' : ''}`}: <b>${num(mass.coreMassKg ?? mass.compositionMassKg)}</b></span>${weight.locationMissing ? '<small>Mass known · load placement pending</small>' : ''}</td>
    <td><strong class="${dependency || manual && weight.needsWeightReview ? 'lcp-warn' : 'lcp-ok'}">${esc(dependency ? 'Waiting for pipe section' : manual ? weight.label : 'No manual weight review')}</strong>${weight.locationMissing ? '<small class="lcp-warn">Load location missing · CoG/application point required</small>' : ''}<small>${esc([...new Set(status)].join(' · ') || 'No pending mass evidence for displayed case')}</small>${traceMarkup(row, fields)}</td></tr>`;
}

function insulationInputMarkup(row, fields) {
  const field = fields.find((item) => item.key === 'insulationThicknessMm');
  const fallback = field.evidence?.sourceKind === 'PRODUCT_DEFAULT'
    && field.evidence?.sourceRoot === 'LOAD_CALC_INSULATION_ZERO_DEFAULT_V1';
  return `<form data-preview-insulation="${esc(row.entityId)}"><label>Insulation thickness mm<input name="thickness" type="number" min="0" step="any" aria-label="Insulation thickness mm for ${esc(row.entityId)}" value="${field.value ?? ''}" placeholder="0 if unavailable"></label><button type="submit">Apply thickness</button><button type="button" data-preview-insulation-reset>Use source / default</button><small>Effective: ${num(field.value)} mm · ${fallback ? '0 mm fallback · uninsulated' : esc(field.evidence?.sourceKind || 'Missing/invalid evidence')}<br>Blank + Apply removes only this preview override.</small><span role="status" aria-live="polite" data-insulation-status></span></form>`;
}

function traceMarkup(row, fields) {
  const source = row.derived?.derivation;
  return `<details><summary>Source trace</summary><p>Source entity ${esc(row.source?.sourceEntityId || row.entityId)}<br>JSON ${esc(row.component.sourceReferences?.jsonPointer || 'Not supplied')}</p>
    ${fields.map((field) => `<p>${esc(field.label)}: ${num(field.value)}<br>${esc(field.evidence?.sourcePath || field.evidence?.source || field.evidence?.sourceKind || 'No effective evidence')}</p>`).join('')}
    ${source ? `<p>Borrowed pipe: ${esc(source.sourceComponentKey)}<br>Borrowed source bore: ${row.borrowedBoreMm == null ? 'Not supplied' : `${num(row.borrowedBoreMm)} mm`}<br>Dry-metal length ${num(source.developedLengthM)} m · factor ${source.developedLengthFactor} × OD${source.developedLengthFactorAssumed ? ' (assumed)' : ''}</p>` : ''}
    <p>Application basis: ${esc(row.type === 'PIPE' ? `Distributed over source length ${num(row.component.geometry.sourceLengthM)} m` : row.component.geometry.applicationPoint ? JSON.stringify(row.component.geometry.applicationPoint) + ' m' : 'Missing — point mass remains blocked')}</p>
    ${row.proposed.map(({ record }) => `<p>${esc(record.fieldId)} source: ${esc(record.sourceId)}<br>Revision ${esc(record.revision)}</p>`).join('')}</details>`;
}
