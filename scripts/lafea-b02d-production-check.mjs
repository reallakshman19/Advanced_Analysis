#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LAFEA_CONTINUUM_PROBE_CONVERGENCE_DEFINITION_SCHEMA,
  LAFEA_CONTINUUM_PROBE_CONVERGENCE_OBSERVATIONS_SCHEMA,
  createLafeaContinuumProbeConvergenceDefinition,
  createLafeaContinuumProbeConvergenceObservations,
  evaluateLafeaContinuumProbeConvergence,
} from '../src/workspace/lafea-continuum-probe-convergence.js';
import { canonicalLafeaSha256 } from '../src/workspace/lafea-canonical-sha256.js';
import { executeB02dProductionLevel } from './lib/lafea-b02d-production-route.mjs';

// Promoted to the V2 probe-stable polar mesh policy (issue #1716/#1735): the
// V1 definition's fixed radial/circumferential division split a coarse polar
// cell along a diagonal producing a sub-11.5deg triangle, permanently
// blocking T3/T6 mesh quality at every refinement level regardless of h. V2
// widens the circumferential divisions (see B02D-lug-pinhole-v2.json's
// v2DesignBasis) and was independently verified end-to-end (not just the
// mesh-quality gate) before this promotion -- all methods, all levels, every
// equilibrium/convergence/probe gate. See frozen-definition-manifest.json's
// amendments.B02D-V2 for the full governed-adoption record.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const definition = read('validation/lafea-b02-definitions/B02D-lug-pinhole-v2.json');
const convergencePolicy = read('validation/lafea-b02-definitions/B02E-convergence.json');
const matrix = read('validation/lafea-b02-contracts/method-benchmark-applicability.json');
const methodRow = matrix.matrix.find((row) => row.benchmarkId === 'B02D');
const A = definition.acceptance;
assert.ok(methodRow);
assert.equal(methodRow.T3, 'CONTROL');
assert.equal(methodRow.T6, 'REQUIRED');
assert.equal(methodRow.Q8, 'REQUIRED');
assert.equal(definition.loadCase.expectedMomentAboutCenter, 10000);
assert.equal(definition.loadCase.expectedReactionMomentAboutCenter, -10000);

const methods = ['T3', 'T6', 'Q8'].map(runMethod);
for (const method of methods.filter((row) => row.releaseCritical)) assert.equal(method.status, 'PASS');

const body = {
  schema: 'lafea-b02d-production-qualification-receipt/v1',
  caseId: 'B02D-V2',
  status: 'PASS',
  definitionHash: canonicalLafeaSha256(definition),
  convergencePolicyHash: canonicalLafeaSha256(convergencePolicy),
  definitionFrozenBeforeObservation: true,
  productionOutputUsedToChooseDefinition: false,
  meshPolicyId: 'B02D_PROBE_STABLE_POLAR_POLICY_V2',
  loadDistribution: 'CONSISTENT_UNIFORM_LINE_RESULTANT_T2_Q3_EDGE_V1',
  methods,
  t3Disposition: 'CONTROL_NOT_RELEASE_CRITICAL',
  requiredMethods: ['T6', 'Q8'],
  fixedPhysicalProbeAuthority: true,
  fixedPhysicalPathAuthority: true,
  movingMaximumUsed: false,
  nodalAveragedStressUsedAsSoleAuthority: false,
  crossElementAveragingUsed: false,
  integrationPointExtrapolationUsed: false,
  generalInternalFeatureAuthoringAuthorityGranted: false,
  releaseAuthorityGranted: false,
  temperatureAuthorityGranted: false,
};
console.log(JSON.stringify({
  ...body,
  semanticHash: canonicalLafeaSha256({
    schema: 'lafea-b02d-production-qualification-receipt-hash-input/v1', receipt: body,
  }),
}, null, 2));

function runMethod(method) {
  const releaseCritical = methodRow[method] === 'REQUIRED';
  const levels = definition.globalResponseLadder.levels.map((level) => {
    const run = executeB02dProductionLevel(definition, method, level, { variant: 'V2' });
    const load = run.load.resultant;
    const target = definition.loadCase.resultant;
    const loadResultantRelativeError = Math.hypot(load.forceX - target.x, load.forceY - target.y)
      / Math.max(1, Math.hypot(target.x, target.y));
    const loadMomentRelativeError = Math.abs(load.momentZ - definition.loadCase.expectedMomentAboutCenter)
      / Math.max(1, Math.abs(definition.loadCase.expectedMomentAboutCenter));
    within(loadResultantRelativeError, A.loadResultantRelativeMaximum,
      `B02D/${method}/${level.levelId} load resultant`);
    within(loadMomentRelativeError, A.loadMomentRelativeMaximum,
      `B02D/${method}/${level.levelId} load moment`);

    const equilibrium = equilibriumEvidence(run.stage, run.resultCase);
    within(equilibrium.totalForceRelativeResidual, A.forceEquilibriumRelativeMaximum,
      `B02D/${method}/${level.levelId} force equilibrium`);
    within(equilibrium.totalMomentRelativeResidual, A.momentEquilibriumRelativeMaximum,
      `B02D/${method}/${level.levelId} moment equilibrium`);
    const reactionMomentRelativeError = Math.abs(
      equilibrium.reaction.momentZ - definition.loadCase.expectedReactionMomentAboutCenter,
    ) / Math.max(1, Math.abs(definition.loadCase.expectedReactionMomentAboutCenter));
    within(reactionMomentRelativeError, A.momentEquilibriumRelativeMaximum,
      `B02D/${method}/${level.levelId} reaction moment`);
    within(run.energyReconstruction.relativeResidual, A.energyReconstructionRelativeMaximum,
      `B02D/${method}/${level.levelId} energy reconstruction`);

    const probes = [...run.fixedProbes, ...run.pathProbes];
    for (const probe of probes) {
      within(probe.mapping.mappingResidual, A.probeMappingResidualMaximum,
        `B02D/${method}/${level.levelId}/${probe.probe.probeId} mapping residual`);
      const margin = naturalCoordinateMargin(probe);
      assert.ok(margin > A.naturalCoordinateMarginMinimum,
        `B02D/${method}/${level.levelId}/${probe.probe.probeId} natural margin ${margin}`);
      assert.equal(probe.movingMaximumUsed, A.movingMaximumAllowed);
      assert.equal(probe.nodalStressProjectionUsed, A.nodalProjectionAllowedAsAcceptanceAuthority);
      assert.equal(probe.crossElementAveragingUsed, A.crossElementAveragingAllowedAsAcceptanceAuthority);
      assert.equal(probe.retainedIntegrationPointExtrapolationUsed,
        A.integrationPointExtrapolationAllowedAsAcceptanceAuthority);
      assert.equal(probe.pointwiseAcceptanceEligible, true);
    }
    return Object.freeze({
      levelId: level.levelId,
      h: level.h,
      meshHash: run.stage.execution.meshHash,
      executionHash: run.stage.execution.compiledExecutionHash,
      recoveryHash: run.stage.lifecycle.artifacts.RECOVERY.artifactHash,
      nodeCount: run.meshEvidence.mesh.nodes.length,
      elementCount: run.meshEvidence.mesh.elements.length,
      loadResultant: load,
      loadResultantRelativeError,
      loadMomentRelativeError,
      reactionMomentRelativeError,
      equilibrium,
      strainEnergy: run.resultCase.totalStrainEnergy,
      energyReconstruction: run.energyReconstruction,
      solverStorage: run.runtimeSolverDiagnostics?.storageRoute ?? null,
      solverMethods: run.runtimeSolverDiagnostics?.methods ?? [],
      c3dCustody: run.c3dCustody,
      fixedProbes: run.fixedProbes,
      pathProbes: run.pathProbes,
    });
  });

  const convergenceLevels = definition.globalResponseLadder.evaluatedConvergenceLevels.map((id) => {
    const level = levels.find((row) => row.levelId === id);
    assert.ok(level, `B02D missing convergence level ${id}`);
    return level;
  });
  const energyConvergence = scalarConvergence(
    `B02D/${method}/STRAIN_ENERGY`,
    convergenceLevels.map((row) => ({ levelId: row.levelId, h: row.h, value: row.strainEnergy })),
  );
  if (releaseCritical) {
    assertConverged(energyConvergence, `B02D/${method}/STRAIN_ENERGY`);
    within(energyConvergence.gciFineRelative, A.strainEnergyGciRelativeMaximum,
      `B02D/${method} strain-energy GCI`);
  }
  const fixedProbeConvergence = definition.fixedProbes.map((probe) =>
    probeConvergence(method, probe.probeId, probe.singularityClassification,
      convergenceLevels, (level) => level.fixedProbes, releaseCritical));
  const pathConvergence = definition.fixedPath.stations.map((station) =>
    probeConvergence(method, `${definition.fixedPath.pathId}/${station.stationId}`,
      station.singularityClassification, convergenceLevels,
      (level) => level.pathProbes, releaseCritical));
  return Object.freeze({
    method,
    applicability: methodRow[method],
    releaseCritical,
    status: 'PASS',
    levels: levels.map(levelSummary),
    energyConvergence,
    fixedProbeConvergence,
    pathConvergence,
  });
}

function probeConvergence(method, probeId, singularityClass, levels, selector, releaseCritical) {
  const evidence = levels.map((level) => selector(level).find((row) => row.probe.probeId === probeId));
  assert.equal(evidence.every(Boolean), true, `B02D/${method}/${probeId} evidence missing`);
  const definitionValue = createLafeaContinuumProbeConvergenceDefinition({
    schema: LAFEA_CONTINUUM_PROBE_CONVERGENCE_DEFINITION_SCHEMA,
    studyId: `B02D/${method}/${probeId}`,
    quantityIdentityHash: evidence[0].quantityIdentityHash,
    refinementRatio: convergencePolicy.frozenRules.refinementRatio,
    gciSafetyFactor: convergencePolicy.frozenRules.gciSafetyFactor,
    nearZeroAbsolute: convergencePolicy.frozenRules.nearZeroAbsoluteByQuantityClass.STRESS_MPA,
    orderStabilityRelativeTolerance: convergencePolicy.frozenRules.orderStabilityRelativeTolerance,
    levels: levels.map(({ levelId, h }) => ({ levelId, h })),
  });
  const observations = createLafeaContinuumProbeConvergenceObservations({
    schema: LAFEA_CONTINUUM_PROBE_CONVERGENCE_OBSERVATIONS_SCHEMA,
    studyId: definitionValue.studyId,
    definitionHash: definitionValue.semanticHash,
    levels: levels.map((level, index) => ({ levelId: level.levelId, evidence: evidence[index] })),
  });
  const result = evaluateLafeaContinuumProbeConvergence(definitionValue, observations);
  const gciFineRelative = result.gciFineAbsolute !== null
    ? result.gciFineAbsolute / Math.max(Math.abs(evidence.at(-1).authoritativeValue), 1e-30)
    : result.classification === 'NEAR_ZERO_FINE_DIFFERENCE' ? 0 : null;
  if (releaseCritical) {
    assertConverged({ ...result, gciFineRelative }, `B02D/${method}/${probeId}`);
    const limit = singularityClass === 'HIGH_GRADIENT_CONVERGENCE'
      ? A.highGradientStressGciRelativeMaximum : A.nonSingularStressGciRelativeMaximum;
    within(gciFineRelative, limit, `B02D/${method}/${probeId} stress GCI`);
  }
  return Object.freeze({
    probeId,
    singularityClassification: singularityClass,
    classification: result.classification,
    observedOrder: result.observedOrder,
    gciFineAbsolute: result.gciFineAbsolute,
    gciFineRelative,
    evidenceHash: result.semanticHash,
    releaseCritical,
  });
}

function scalarConvergence(studyId, levels) {
  assert.equal(levels.length, 3);
  const [coarse, medium, fine] = levels;
  close(coarse.h / medium.h, convergencePolicy.frozenRules.refinementRatio, 1e-12, `${studyId} r1`);
  close(medium.h / fine.h, convergencePolicy.frozenRules.refinementRatio, 1e-12, `${studyId} r2`);
  const d1 = coarse.value - medium.value;
  const d2 = medium.value - fine.value;
  const nearZero = convergencePolicy.frozenRules.nearZeroAbsoluteByQuantityClass.ENERGY_N_MM;
  if (Math.abs(d2) <= nearZero) return scalarResult(studyId, levels, 'NEAR_ZERO_FINE_DIFFERENCE', null, 0, 0);
  if (d1 * d2 < 0) return scalarResult(studyId, levels, 'OSCILLATORY', null, null, null);
  if (!(Math.abs(d2) < Math.abs(d1))) return scalarResult(studyId, levels, 'DIVERGENT', null, null, null);
  const p = Math.log(Math.abs(d1 / d2)) / Math.log(convergencePolicy.frozenRules.refinementRatio);
  if (!(Number.isFinite(p) && p > 0)) return scalarResult(studyId, levels, 'DIVERGENT', null, null, null);
  const gci = convergencePolicy.frozenRules.gciSafetyFactor * Math.abs(d2)
    / (convergencePolicy.frozenRules.refinementRatio ** p - 1);
  return scalarResult(studyId, levels, 'MONOTONIC_CONVERGING', p, gci,
    gci / Math.max(Math.abs(fine.value), 1e-30));
}
function scalarResult(studyId, levels, classification, observedOrder, gciFineAbsolute, gciFineRelative) {
  const body = { studyId, classification, observedOrder, gciFineAbsolute, gciFineRelative, levels };
  return Object.freeze({ ...body, evidenceHash: canonicalLafeaSha256({ schema: 'lafea-b02-scalar-convergence/v1', ...body }) });
}
function assertConverged(result, label) {
  assert.ok(['ASYMPTOTIC', 'MONOTONIC_CONVERGING', 'NEAR_ZERO_FINE_DIFFERENCE'].includes(result.classification),
    `${label} convergence is ${result.classification}`);
  assert.ok(Number.isFinite(result.gciFineRelative), `${label} GCI unavailable`);
}

function equilibriumEvidence(stage, loadCase) {
  const nodeById = new Map(stage.execution.canonicalInput.nodes.map((node) => [node.nodeId, node]));
  const applied = resultant(forceVector(stage.execution.result, loadCase.forceEvidence.forceVector, nodeById), nodeById);
  const reaction = resultant(reactionVector(loadCase.supportReactions, nodeById), nodeById);
  const total = {
    forceX: applied.forceX + reaction.forceX,
    forceY: applied.forceY + reaction.forceY,
    momentZ: applied.momentZ + reaction.momentZ,
  };
  return Object.freeze({
    applied, reaction, total,
    totalForceRelativeResidual: Math.hypot(total.forceX, total.forceY)
      / Math.max(1, Math.hypot(definition.loadCase.resultant.x, definition.loadCase.resultant.y)),
    totalMomentRelativeResidual: Math.abs(total.momentZ)
      / Math.max(1, Math.abs(definition.loadCase.expectedMomentAboutCenter)),
  });
}
function forceVector(result, values, nodeById) {
  const vector = blankVector(nodeById);
  result.meshEvidence.dofOrdering.forEach((identity, index) => setDof(vector, identity, values[index]));
  return vector;
}
function reactionVector(rows, nodeById) {
  const vector = blankVector(nodeById);
  rows.forEach((row) => setDof(vector, row.dofIdentity, row.value));
  return vector;
}
function blankVector(nodeById) {
  return new Map([...nodeById.keys()].map((nodeId) => [nodeId, { fx: 0, fy: 0 }]));
}
function setDof(vector, identity, value) {
  const separator = identity.lastIndexOf(':');
  const nodeId = identity.slice(0, separator);
  const dof = identity.slice(separator + 1);
  vector.get(nodeId)[dof === 'UX' ? 'fx' : 'fy'] = value;
}
function resultant(vector, nodeById) {
  let forceX = 0; let forceY = 0; let momentZ = 0;
  for (const [nodeId, force] of vector) {
    const node = nodeById.get(nodeId);
    forceX += force.fx; forceY += force.fy;
    momentZ += node.x * force.fy - node.y * force.fx;
  }
  return Object.freeze({ forceX, forceY, momentZ });
}
function naturalCoordinateMargin(evidence) {
  const n = evidence.mapping.naturalCoordinates;
  return evidence.mapping.elementType === 'Q8'
    ? Math.min(1 - Math.abs(n.xi), 1 - Math.abs(n.eta))
    : Math.min(n.xi, n.eta, n.lambda1);
}
function levelSummary(row) {
  return Object.freeze({
    levelId: row.levelId, h: row.h, meshHash: row.meshHash,
    executionHash: row.executionHash, recoveryHash: row.recoveryHash,
    nodeCount: row.nodeCount, elementCount: row.elementCount,
    loadResultant: row.loadResultant,
    loadResultantRelativeError: row.loadResultantRelativeError,
    loadMomentRelativeError: row.loadMomentRelativeError,
    reactionMomentRelativeError: row.reactionMomentRelativeError,
    equilibrium: row.equilibrium, strainEnergy: row.strainEnergy,
    energyReconstruction: row.energyReconstruction,
    solverStorage: row.solverStorage, solverMethods: row.solverMethods,
    c3dCustody: row.c3dCustody,
    fixedProbes: row.fixedProbes.map(probeSummary), pathProbes: row.pathProbes.map(probeSummary),
  });
}
function probeSummary(probe) {
  return Object.freeze({
    probeId: probe.probe.probeId, value: probe.authoritativeValue, units: probe.authoritativeUnits,
    elementId: probe.mapping.elementId, elementType: probe.mapping.elementType,
    naturalCoordinates: probe.mapping.naturalCoordinates,
    naturalCoordinateMargin: naturalCoordinateMargin(probe),
    mappingResidual: probe.mapping.mappingResidual, evidenceHash: probe.semanticHash,
  });
}
function within(value, limit, label) {
  assert.ok(Number.isFinite(value) && value <= limit, `${label}: ${value} > ${limit}`);
}
function close(actual, expected, relative, label) {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= relative * scale, `${label}: ${actual} != ${expected}`);
}
function read(relativePath) { return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8')); }
