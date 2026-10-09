import { pipeMetalMassPerLength } from './formulas.js';
import {
  AUDIT_CODES, ELBOW_TYPES, OLET_TYPES, REDUCER_TYPES, TEE_TYPES,
} from './constants.js';
import { evidenceNumber } from './units.js';

/**
 * Effective-length factor (multiplied by outer diameter) used when a fitting
 * has no independent geometric length. These are legacy pipe-equivalent dry
 * metal estimates, not catalogue weights or standards-qualified fitting geometry.
 * In particular 1.5*OD is not the arc length of a long-radius elbow.
 */
const DEVELOPED_LENGTH_FACTOR_BY_TYPE_SET = Object.freeze([
  { types: ELBOW_TYPES, factor: 1.5 },
  { types: TEE_TYPES, factor: 1.0 },
  // Retain the existing assumed factors without granting standards authority.
  { types: OLET_TYPES, factor: 1.0, assumedFactor: true },
  { types: REDUCER_TYPES, factor: 1.0, assumedFactor: true },
]);

export function isElbowType(type) {
  return ELBOW_TYPES.includes(String(type || '').trim().toUpperCase());
}

export function isTeeType(type) {
  return TEE_TYPES.includes(String(type || '').trim().toUpperCase());
}

export function isPipeLikeFittingType(type) {
  return DEVELOPED_LENGTH_FACTOR_BY_TYPE_SET.some((row) => row.types.includes(String(type || '').trim().toUpperCase()));
}

/**
 * Derives an elbow's dry metal weight from its own line's already-resolved
 * pipe section. Kept as a distinct export (rather than folded into the
 * generic function below) because it is the established name existing
 * callers already use.
 */
export function deriveElbowComponentWeightEvidence(component, allComponents) {
  return deriveByType(ELBOW_TYPES, 1.5, component, allComponents);
}

/** Same derivation as the elbow, using the tee's own effective-length factor. */
export function deriveTeeComponentWeightEvidence(component, allComponents) {
  return deriveByType(TEE_TYPES, 1.0, component, allComponents);
}

/** Tries every known pipe-like fitting type; returns the first applicable result. */
export function derivePipeLikeFittingWeightEvidence(component, allComponents) {
  for (const { types, factor, assumedFactor } of DEVELOPED_LENGTH_FACTOR_BY_TYPE_SET) {
    const result = deriveByType(types, factor, component, allComponents, assumedFactor);
    if (result) return result;
  }
  return null;
}

/**
 * Derives a fitting's dry metal weight from its own line's already-resolved
 * pipe section (outer diameter, wall thickness, material density), using the
 * same PIPE_METAL_MASS_PER_LENGTH_V1 formula as straight pipe over an estimated
 * effective length rather than a geometric segment length.
 *
 * Source port bore selects an already-resolved same-branch pipe section; it
 * does not supply OD, wall or density itself. Returns null
 * whenever a confident derivation is not possible — including when the
 * fitting already carries explicit weight evidence, which is never
 * overridden — so a consuming component always falls back to its existing
 * missing-evidence behaviour rather than receiving a fabricated value.
 */
function deriveByType(types, developedLengthFactor, component, allComponents, assumedFactor = false) {
  if (!types.includes(String(component?.type || '').trim().toUpperCase())) return null;
  if (evidenceNumber(component.engineeringProperties?.componentWeightKg) !== null) return null;
  const review = reviewPipeLikeFittingSection(component, allComponents);
  const sibling = review.sourceComponent;
  if (!sibling) return null;
  const evidence = sibling.engineeringProperties;
  const odMm = evidenceNumber(evidence.outerDiameterMm);
  const wallMm = evidenceNumber(evidence.wallThicknessMm);
  const densityKgM3 = evidenceNumber(evidence.materialDensityKgM3);
  if (odMm === null || wallMm === null || densityKgM3 === null) return null;
  if (!(odMm > 0) || !(wallMm > 0) || wallMm >= odMm / 2 || !(densityKgM3 > 0)) return null;

  const developedLengthM = developedLengthFactor * (odMm / 1000);
  const perLength = pipeMetalMassPerLength(odMm / 1000, wallMm / 1000, densityKgM3, [
    evidence.outerDiameterMm, evidence.wallThicknessMm, evidence.materialDensityKgM3,
  ]);
  return {
    value: perLength.value * developedLengthM,
    source: AUDIT_CODES.DERIVED_FROM_ADJACENT_PIPE_SECTION,
    derivation: {
      formulaId: perLength.trace.formulaId,
      developedLengthM,
      developedLengthFactor,
      developedLengthFactorAssumed: assumedFactor,
      sourceComponentKey: sibling.componentKey || sibling.sourceEntityId || null,
      outerDiameterMm: odMm,
      wallThicknessMm: wallMm,
      materialDensityKgM3: densityKgM3,
      ...(review.boreMatch ? { sectionSelection: review.boreMatch } : {}),
    },
  };
}

/**
 * Source bore restricts section candidates before checking their resolved
 * OD/wall/density. Missing bore retains the legacy uniform-branch check, not
 * first-row selection. Reducer arrive-bore reuse is explicitly approximate;
 * preserving both ports does not qualify a tapered fitting's actual volume.
 * A stable key selects provenance only; it cannot decide between section values.
 */
export function reviewPipeLikeFittingSection(component, components) {
  if (!isPipeLikeFittingType(component?.type)) return sectionReview('NOT_APPLICABLE');
  if (evidenceNumber(component.engineeringProperties?.componentWeightKg) !== null) {
    return sectionReview('EXPLICIT_COMPONENT_WEIGHT');
  }
  const branchId = component.identity?.branchId;
  if (!branchId || !Array.isArray(components)) return sectionReview('MISSING_PIPE_BRANCH');
  const candidates = components.filter((candidate) => (
    String(candidate?.type || '').trim().toUpperCase() === 'PIPE'
    && candidate.identity?.branchId === branchId
  )).sort((left, right) => sectionSourceKey(left).localeCompare(sectionSourceKey(right)));
  if (!candidates.length) return sectionReview('MISSING_BRANCH_PIPE_SECTION');
  const boreMatch = fittingBoreMatch(component);
  if (boreMatch.error) return sectionReview(boreMatch.error, candidates);
  const matched = boreMatch.nominalBoreMm === null ? candidates : candidates.filter((candidate) => {
    const pipeBore = fittingBoreMatch(candidate);
    return !pipeBore.error && pipeBore.nominalBoreMm === boreMatch.nominalBoreMm;
  });
  if (!matched.length) return sectionReview('MISSING_MATCHING_PIPE_BORE_SECTION', candidates);
  return validateMatchingSections(matched, boreMatch);
}

function validateMatchingSections(candidates, boreMatch) {
  const sections = candidates.map((candidate) => [
    evidenceNumber(candidate.engineeringProperties?.outerDiameterMm),
    evidenceNumber(candidate.engineeringProperties?.wallThicknessMm),
    evidenceNumber(candidate.engineeringProperties?.materialDensityKgM3),
  ]);
  if (sections.some((section) => section.some((value) => value === null))) {
    return sectionReview('INCOMPLETE_BRANCH_PIPE_SECTION', candidates);
  }
  if (sections.some(([od, wall, density]) => !(od > 0 && wall > 0 && wall < od / 2 && density > 0))) {
    return sectionReview('INVALID_BRANCH_PIPE_SECTION', candidates);
  }
  if (new Set(sections.map((section) => JSON.stringify(section))).size !== 1) {
    return sectionReview('CONFLICTING_BRANCH_PIPE_SECTIONS', candidates);
  }
  const review = sectionReview(boreMatch.nominalBoreMm === null
    ? 'CONSISTENT_BRANCH_PIPE_SECTION' : 'MATCHED_PIPE_BORE_SECTION', candidates, candidates[0]);
  return boreMatch.nominalBoreMm === null ? review : { ...review, boreMatch };
}

function fittingBoreMatch(component) {
  const arrive = component.compatibilityEvidence?.sourceArriveBoreMm;
  const leave = component.compatibilityEvidence?.sourceLeaveBoreMm;
  const nominal = component.engineeringProperties?.nominalBoreMm;
  const evidence = [arrive, leave, nominal].filter(Boolean);
  if (evidence.some((row) => row.status === 'INVALID' || !(evidenceNumber(row) > 0) || (row.unit && row.unit !== 'mm'))) {
    return { error: 'INVALID_SOURCE_PIPE_BORE' };
  }
  const arriveMm = evidenceNumber(arrive), leaveMm = evidenceNumber(leave);
  const nominalMm = evidenceNumber(nominal);
  const reducing = REDUCER_TYPES.includes(String(component.type || '').trim().toUpperCase());
  if ((!reducing && arriveMm !== null && leaveMm !== null && arriveMm !== leaveMm)
      || (nominalMm !== null && [arriveMm, leaveMm].some((value) => value !== null && value !== nominalMm))) {
    return { error: 'CONFLICTING_SOURCE_PIPE_BORES' };
  }
  return {
    nominalBoreMm: arriveMm ?? leaveMm ?? nominalMm,
    arriveBoreMm: arriveMm, leaveBoreMm: leaveMm,
    policy: reducing && arriveMm !== null && leaveMm !== null && arriveMm !== leaveMm
      ? 'SOURCE_ARRIVE_BORE_PIPE_EQUIVALENT_ESTIMATE_V1' : 'MATCHING_NOMINAL_BORE_V1',
    sourcePaths: evidence.map((row) => row.sourcePath || null),
  };
}

function sectionSourceKey(component) {
  return String(component.componentKey || component.sourceEntityId || '');
}

function sectionReview(code, candidates = [], sourceComponent = null) {
  return {
    code,
    sourceComponent,
    candidateComponentKeys: candidates.map(sectionSourceKey),
  };
}
