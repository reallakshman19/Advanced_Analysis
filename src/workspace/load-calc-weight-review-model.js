import { createPipingLoadCompositionProfile } from '../core/model-loads/composition-profile.js';
import { resolveComponentCaseMass } from '../core/model-loads/component-mass-resolver.js';
import { derivePipeLikeFittingWeightEvidence, reviewPipeLikeFittingSection } from '../core/model-loads/elbow-derived-mass.js';
import { evidenceNumber } from '../core/model-loads/units.js';
import { isManualWeightReviewType } from './load-calc-weight-review-scope.js';

/** Observational review only: reuse the resolver; never supply replacement evidence. */
export function buildWeightReviewRows({ components = [], methodRows = [], loadCaseIds = ['EMPTY'] } = {}) {
  const missing = new Map();
  for (const method of methodRows) for (const coverage of method.coverageRequirements || []) {
    if (coverage.requirementId !== 'MASS_COVERAGE') continue;
    for (const token of coverage.missing || []) {
      const split = token.lastIndexOf(':');
      const id = split > 0 ? token.slice(0, split) : token;
      const reasons = missing.get(id) || new Set();
      reasons.add(split > 0 ? token.slice(split + 1) : 'MASS_EVIDENCE');
      missing.set(id, reasons);
    }
  }
  const profile = createPipingLoadCompositionProfile();
  const byId = new Map(components.map((component) => [component.componentKey, component]));
  for (const id of missing.keys()) if (!byId.has(id)) byId.set(id, { componentKey: id, type: 'UNKNOWN', engineeringProperties: {}, geometry: {} });
  return [...byId.values()].map((component) => {
    const derived = derivePipeLikeFittingWeightEvidence(component, components);
    const effective = derived ? { ...component, engineeringProperties: {
      ...component.engineeringProperties, componentWeightKg: derived,
    } } : component;
    return {
      entityId: component.componentKey,
      type: String(component.type || 'UNKNOWN').toUpperCase(),
      branchId: component.identity?.branchId || '',
      missing: [...(missing.get(component.componentKey) || [])].sort(),
      component,
      derived,
      sectionReview: reviewPipeLikeFittingSection(component, components),
      cases: Object.fromEntries(loadCaseIds.map((id) => [id, resolveComponentCaseMass(effective, id, profile)])),
    };
  }).sort((a, b) => a.entityId.localeCompare(b.entityId));
}

/** Display values only. Partial evidence is never promoted to a complete case mass. */
export function weightReviewMassValues(row, caseId) {
  const result = row.cases[caseId];
  const distributed = result.ok && result.mode === 'DISTRIBUTED';
  const sourceMass = (sourceId) => {
    if (!distributed) return null;
    const part = result.massSourceBreakdown.find((item) => item.sourceId === sourceId);
    return part ? part.massPerLengthKgM * row.component.geometry.sourceLengthM : null;
  };
  const pointDry = row.derived?.value ?? evidenceNumber(row.component.engineeringProperties.componentWeightKg)
    ?? (result.ok && result.mode === 'POINT' ? result.pointMassKg : null);
  return {
    metalKg: row.type === 'PIPE' ? sourceMass('PIPE_METAL') : pointDry,
    fluidKg: caseId === 'EMPTY' ? 0 : row.type === 'PIPE' ? sourceMass(`${caseId}_FLUID`)
      : evidenceNumber(row.component.engineeringProperties[caseId === 'OPE' ? 'componentFluidWeightOpeKg' : 'componentFluidWeightHydKg']),
    insulationKg: sourceMass('INSULATION'),
    coreMassKg: result.ok ? distributed ? result.massPerLengthKgM * row.component.geometry.sourceLengthM : result.pointMassKg : null,
    dryOnly: result.ok && !distributed,
  };
}

/** Session-only deferrals, bound to the exact reviewed candidate/report. Not exclusions. */
export class WeightReviewSession {
  binding = '';
  skipped = new Map();
  bind(binding) {
    if (!binding) throw new TypeError('A current weight-review binding is required.');
    if (binding !== this.binding) { this.binding = binding; this.skipped.clear(); }
  }
  skip(binding, entityId, reason, rows) {
    if (binding !== this.binding) throw new Error('Weight review changed; reopen the popup.');
    if (!rows.some((row) => row.entityId === entityId && row.missing.length && isManualWeightReviewType(row.type))) {
      throw new Error('Only a current unresolved manual weight-review row can be deferred.');
    }
    if (!String(reason || '').trim()) throw new Error('Enter a reason before skipping.');
    this.skipped.set(entityId, String(reason).trim());
  }
  restore(entityId) { this.skipped.delete(entityId); }
}
