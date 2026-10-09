#!/usr/bin/env node
import assert from 'node:assert/strict';
import { canonicalLafeaSha256 } from '../src/workspace/lafea-canonical-sha256.js';
import {
  LAFEA_CONTINUUM_PROBE_CONVERGENCE_DEFINITION_SCHEMA,
  LAFEA_CONTINUUM_PROBE_CONVERGENCE_OBSERVATIONS_SCHEMA,
  compareLafeaContinuumPhysicalProbeEvidence,
  createLafeaContinuumProbeConvergenceDefinition,
  evaluateLafeaContinuumProbeConvergence,
} from '../src/workspace/lafea-continuum-probe-convergence.js';
import { LAFEA_CONTINUUM_PHYSICAL_PROBE_EVIDENCE_SCHEMA } from '../src/workspace/lafea-continuum-physical-probe.js';

const Q = `sha256:${'a'.repeat(64)}`;
const P = `sha256:${'b'.repeat(64)}`;
const asymptoticCase = study([26, 14, 11, 10.25]);
const asymptotic = evaluateLafeaContinuumProbeConvergence(
  asymptoticCase.definition,
  asymptoticCase.observations,
);
assert.equal(asymptotic.classification, 'ASYMPTOTIC');
assert.ok(Math.abs(asymptotic.observedOrder - 2) < 1e-12);
assert.ok(Math.abs(asymptotic.richardsonExtrapolatedValue - 10) < 1e-12);
assert.ok(Math.abs(asymptotic.gciFineAbsolute - 0.3125) < 1e-12);
assert.equal(asymptotic.definitionWasFrozenBeforeObservations, true);
assert.equal(asymptotic.benchmarkAcceptanceGranted, false);
assert.equal(asymptotic.globalConvergenceAuthorityGranted, false);
assert.equal(asymptotic.releaseAuthorityGranted, false);

const sameDefinitionDifferentObservedValues = study([30, 20, 15, 12.5], {}, false, asymptoticCase.definition);
assert.equal(
  createLafeaContinuumProbeConvergenceDefinition(asymptoticCase.definition).semanticHash,
  createLafeaContinuumProbeConvergenceDefinition(sameDefinitionDifferentObservedValues.definition).semanticHash,
  'definition hash must be independent of observed response values',
);
assert.notEqual(
  asymptoticCase.observations.levels[0].evidence.semanticHash,
  sameDefinitionDifferentObservedValues.observations.levels[0].evidence.semanticHash,
);

const oscillatoryCase = study([11, 9.5, 10.25]);
const oscillatory = evaluateLafeaContinuumProbeConvergence(oscillatoryCase.definition, oscillatoryCase.observations);
assert.equal(oscillatory.classification, 'OSCILLATORY');
assert.equal(oscillatory.observedOrder, null);

const divergentCase = study([10, 10.1, 10.4]);
const divergent = evaluateLafeaContinuumProbeConvergence(divergentCase.definition, divergentCase.observations);
assert.equal(divergent.classification, 'DIVERGENT');

const preCase = study([26, 14, 11.5, 10.6], { orderStabilityRelativeTolerance: 0.1 });
const preAsymptotic = evaluateLafeaContinuumProbeConvergence(preCase.definition, preCase.observations);
assert.equal(preAsymptotic.classification, 'PRE_ASYMPTOTIC');
assert.equal(preAsymptotic.richardsonExtrapolatedValue, null);
assert.equal(preAsymptotic.gciFineAbsolute, null);

const nearZeroCase = study([4e-9, 2e-9, 1e-9], { nearZeroAbsolute: 1e-8 });
const nearZero = evaluateLafeaContinuumProbeConvergence(nearZeroCase.definition, nearZeroCase.observations);
assert.equal(nearZero.classification, 'NEAR_ZERO_SCALE_LIMITED');
assert.equal(nearZero.gciFinePercent, null);

const singularCase = study([26, 14, 11], {}, true);
const singular = evaluateLafeaContinuumProbeConvergence(singularCase.definition, singularCase.observations);
assert.equal(singular.classification, 'SINGULAR_EXCLUDED');
assert.equal(singular.pointwiseAcceptanceEligible, false);

const tampered = structuredClone(asymptoticCase.observations);
tampered.definitionHash = `sha256:${'f'.repeat(64)}`;
assert.throws(
  () => evaluateLafeaContinuumProbeConvergence(asymptoticCase.definition, tampered),
  /LAFEA_G4_CONVERGENCE_DEFINITION_HASH_MISMATCH/u,
);

const left = evidence(11, 1, '1');
const right = evidence(10.25, 0.5, '2');
const comparison = compareLafeaContinuumPhysicalProbeEvidence(left, right);
assert.equal(comparison.compatible, true);
assert.equal(comparison.quantityIdentityHash, Q);
assert.throws(
  () => compareLafeaContinuumPhysicalProbeEvidence(left, {
    ...right,
    quantityIdentityHash: `sha256:${'c'.repeat(64)}`,
  }),
  /LAFEA_G4_PROBE_COMPARISON_IDENTITY_MISMATCH/u,
);

console.log(JSON.stringify({
  schema: 'lafea-b02-g4-convergence-diagnostic/v1',
  status: 'PASS',
  definitionHashIndependentOfObservedValues: true,
  observationDefinitionHashMismatchRejected: true,
  incompatibleQuantityComparisonRejected: true,
  asymptoticClassification: true,
  preAsymptoticClassification: true,
  oscillatoryClassification: true,
  divergentClassification: true,
  nearZeroAbsoluteRuleApplied: true,
  singularPointwiseAcceptanceExcluded: true,
  benchmarkAcceptanceGranted: false,
  releaseAuthorityGranted: false,
  temperatureAuthorityGranted: false,
}));

function study(values, overrides = {}, singular = false, frozenDefinition = null) {
  const hs = values.length === 4 ? [4, 2, 1, 0.5] : [4, 2, 1];
  const rawDefinition = frozenDefinition ?? {
    schema: LAFEA_CONTINUUM_PROBE_CONVERGENCE_DEFINITION_SCHEMA,
    studyId: `G4-CONVERGENCE-${values.length}-LEVEL`,
    quantityIdentityHash: Q,
    refinementRatio: 2,
    gciSafetyFactor: 1.25,
    nearZeroAbsolute: overrides.nearZeroAbsolute ?? 1e-12,
    orderStabilityRelativeTolerance: overrides.orderStabilityRelativeTolerance ?? 0.2,
    levels: hs.map((h, index) => ({ levelId: `L${index}`, h })),
  };
  const definition = createLafeaContinuumProbeConvergenceDefinition(rawDefinition);
  return {
    definition: rawDefinition,
    observations: {
      schema: LAFEA_CONTINUUM_PROBE_CONVERGENCE_OBSERVATIONS_SCHEMA,
      studyId: definition.studyId,
      definitionHash: definition.semanticHash,
      levels: values.map((value, index) => ({
        levelId: `L${index}`,
        evidence: evidence(value, hs[index], String(index + 1), singular),
      })),
    },
  };
}
function evidence(value, h, suffix, singular = false) {
  const base = {
    schema: LAFEA_CONTINUUM_PHYSICAL_PROBE_EVIDENCE_SCHEMA,
    status: 'PASS',
    probeIdentityHash: P,
    quantityIdentityHash: Q,
    authoritativeUnits: 'MPa',
    authoritativeValue: value,
    pointwiseAcceptanceEligible: !singular,
    custody: {
      meshHash: `sha256:${String(Math.round(h * 10)).padStart(2, '0').repeat(32).slice(0, 64)}`,
      executionHash: `sha256:${'d'.repeat(63)}${suffix.slice(0, 1)}`,
      recoveryHash: `sha256:${'e'.repeat(63)}${suffix.slice(0, 1)}`,
    },
  };
  return {
    ...base,
    semanticHash: canonicalLafeaSha256({
      schema: 'lafea-b02-g4-synthetic-probe-observation/v1',
      observation: base,
    }),
  };
}
