import { buildWeightReviewRows, weightReviewMassValues } from './load-calc-weight-review-model.js';
import { evidenceNumber } from '../core/model-loads/units.js';
import { createPipingLoadCompositionProfile } from '../core/model-loads/composition-profile.js';
import { resolveComponentCaseMassValues } from '../core/model-loads/component-mass-resolver.js';

/** Presentation adapter only. Source, effective evidence and unaccepted proposals stay separate. */
export function buildLoadCalcPreview({ components = [], entities = [], proposals = [], methodRows = [], stale = false, reviewPolicy } = {}) {
  const sources = new Map(entities.map((entity) => [entity.entityId, entity]));
  const componentsByKey = new Map(components.map((component) => [component.componentKey, component]));
  const pending = new Map();
  const profile = createPipingLoadCompositionProfile();
  for (const proposal of proposals) {
    const key = proposal.record?.selectorKey;
    if (proposal.record?.selectorKind !== 'ENTITY') continue;
    if (!pending.has(key)) pending.set(key, []);
    pending.get(key).push(proposal);
  }
  return buildWeightReviewRows({ components, entities, methodRows, reviewPolicy, loadCaseIds: ['EMPTY', 'OPE', 'HYD'] }).map((weight) => {
    const source = sources.get(weight.component.sourceEntityId) || sources.get(weight.entityId);
    const attributes = sourceAttributes(source);
    const description = String(attributes.DTXR || '');
    const proposed = pending.get(weight.entityId) || [];
    const borrowedKey = weight.derived?.derivation?.sourceComponentKey;
    const borrowed = sources.get(componentsByKey.get(borrowedKey)?.sourceEntityId) || sources.get(borrowedKey);
    const ownBore = nominalBore(source);
    const borrowedBore = nominalBore(borrowed);
    const notes = [];
    if (stale) notes.push('STALE — refresh current input');
    if (proposed.length) notes.push(`${proposed.length} fields awaiting review`);
    if (ownBore !== null && borrowedBore !== null && ownBore !== borrowedBore) notes.push('Borrowed pipe bore differs — derivation needs review');
    if (weight.derived?.derivation?.developedLengthFactorAssumed) notes.push('Assumed fitting factor — estimate');
    const effective = weight.derived ? { ...weight.component, engineeringProperties: {
      ...weight.component.engineeringProperties, componentWeightKg: weight.derived,
    } } : weight.component;
    const mass = Object.fromEntries(['EMPTY', 'OPE', 'HYD'].map((id) => {
      const values = resolveComponentCaseMassValues(effective, id, profile);
      return [id, { ...weightReviewMassValues(weight, id),
        // Observation only: known mass is not a qualified load/application point.
        compositionMassKg: values.ok && values.mode === 'POINT' ? values.pointMassKg : null,
      }];
    }));
    return { ...weight, source, attributes, description, sourceBoreMm: ownBore,
      sourceSchedule: description.match(/\bSCH(?:EDULE)?\.?\s*([\d]+[A-Z]?|STD|XS|XXS)\b/i)?.[1] || null,
      proposed, borrowedBoreMm: borrowedBore, notes, mass, stale,
      needsReview: stale || proposed.length > 0 || notes.length > 0 || weight.missing.length > 0
        || Object.values(weight.cases).some((result) => !result.ok),
    };
  });
}

/** UI labels only. Never changes strict case readiness, coverage or load placement. */
export function previewWeightStatus(row, caseId) {
  const mass = row.mass[caseId];
  const available = Number.isFinite(mass.metalKg) && mass.metalKg >= 0;
  const accepted = available && ['ACCEPTED_OVERRIDE', 'EXACT_APPROVED_MASTER']
    .includes(row.component.engineeringProperties.componentWeightKg?.sourceKind);
  return { available, accepted, needsWeightReview: row.manualReviewRequired && !available,
    sectionNotRequired: row.type !== 'PIPE' && !row.derived && available,
    locationMissing: (row.cases[caseId].blockers || []).includes('MISSING_COMPONENT_COG'),
    label: available ? `${row.stale ? 'Weight evidence (stale)' : accepted ? 'Weight applied' : 'Weight available'}: ${mass.metalKg.toLocaleString('en-US', { maximumFractionDigits: 4 })} kg`
      : 'Review equipment weight',
  };
}

function nominalBore(entity) {
  const attributes = sourceAttributes(entity);
  for (const key of ['ABORE', 'LBORE']) {
    const match = String(attributes[key] ?? '').match(/^\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*$/i);
    if (match && Number(match[1]) > 0) return Number(match[1]);
  }
  return null;
}

function sourceAttributes(entity) {
  return { ...entity?.properties?.attributes, ...entity?.properties?.sourceAttributes };
}

export function effectivePreviewFields(row) {
  return [['OD mm', 'outerDiameterMm'], ['Wall mm', 'wallThicknessMm'], ['Metal density kg/m³', 'materialDensityKgM3'],
    ['OPE fluid density kg/m³', 'fluidDensityOpeKgM3'], ['HYD fluid density kg/m³', 'fluidDensityHydKgM3'],
    ['Insulation thickness mm', 'insulationThicknessMm'], ['Insulation density kg/m³', 'insulationDensityKgM3']]
    .map(([label, key]) => ({ label, key, evidence: row.component.engineeringProperties[key],
      value: evidenceNumber(row.component.engineeringProperties[key]),
      borrowedValue: evidenceNumber(row.component.engineeringProperties[key]) === null ? row.derived?.derivation?.[key] ?? null : null }));
}
