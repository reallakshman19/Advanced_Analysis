#!/usr/bin/env node
import assert from 'node:assert/strict';

import { createCanonicalLocalShellModel } from '../src/core/local-shell/index.js';
import { assembleDenseGlobalSystem } from '../src/core/local-shell/assembly.js';
import { buildShellElementEvidence } from '../src/core/local-shell/element.js';
import { assembleLoadCase } from '../src/core/local-shell/loads.js';
import { solveLoadCase } from '../src/core/local-shell/solver.js';
import { PROFILE_KINDS, canonicalProfile } from '../src/core/lafea-profile-contract/index.js';
import { createLafeaMockDocument } from '../src/workspace/advanced-mock-data.js';
import { createLafeaSimulatedShellMidsurfaceEvidence } from '../src/workspace/lafea-simulated-shell-midsurface-provider.js';
import { produceLafeaShellAnalysisMesh } from '../src/workspace/lafea-shell-mesh-producer.js';
import { compileLafeaShellSolverModel } from '../src/workspace/lafea-shell-solver-model.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { pressurePatchSource } from './lafea.4-fixtures.mjs';

const partialBoundary = provePartialBoundaryFailsClosed();
const nodalLoad = proveNodalRemapFailsClosed();
const nonzeroLocalRotation = proveNonzeroLocalRotationFailsClosed();
const probe = provePhysicalProbeContractIsAbsentAndFailsClosed();
const momentGate = proveMomentGateIsIndependentOfForceGate();

console.log(JSON.stringify({
  schema: 'lafea4-a2-applicability-negative-check/v1',
  status: 'PASS',
  releaseAuthorityGranted: false,
  qualifiedApplicabilityEnvelope: {
    pressure: 'WHOLE_SURFACE_UNIFORM_PRESSURE_AND_SENSE_ONLY',
    globalTranslations: 'WHOLE_SURFACE_IDENTICAL_VALUE_PER_DOF_ONLY',
    localRotations: 'WHOLE_SURFACE_ZERO_ONLY',
    nodalLoadRemap: 'UNSUPPORTED_FAIL_CLOSED',
    partialBoundaryConstraintRemap: 'UNSUPPORTED_FAIL_CLOSED',
    physicalProbeRemap: 'NO_PRODUCTION_CONTRACT_FAIL_CLOSED',
  },
  negatives: { partialBoundary, nodalLoad, nonzeroLocalRotation, probe, momentGate },
}, null, 2));

function provePartialBoundaryFailsClosed() {
  const source = shellSource();
  source.constraints = [{
    constraintId: 'A2-PARTIAL-UX',
    nodeId: source.nodes[0].nodeId,
    dof: 'UX',
    value: 0,
    sourceReference: 'A2-PARTIAL-UX-SOURCE',
  }];
  const fixture = retainedFixture(source, 'PARTIAL-BC');
  assert.throws(
    () => compileLafeaShellSolverModel(fixture.compileOptions),
    (error) => error?.code === 'LAFEA4_SHELL_SOLVER_CONSTRAINT_MAPPING_REQUIRED',
  );
  return Object.freeze({
    status: 'PASS',
    expectedRejection: 'LAFEA4_SHELL_SOLVER_CONSTRAINT_MAPPING_REQUIRED',
    authority: 'UNSUPPORTED_FAIL_CLOSED',
  });
}

function proveNodalRemapFailsClosed() {
  const source = shellSource();
  source.loadCases = [{
    loadCaseId: 'A2-NODAL-NEGATIVE',
    nodalLoads: [{
      loadId: 'A2-F1',
      nodeId: source.nodes[0].nodeId,
      fx: 10,
      fy: 0,
      fz: 0,
      m1: 0,
      m2: 0,
      sourceReference: 'A2-NODAL-NEGATIVE-SOURCE',
    }],
    pressureLoads: [],
    sourceReference: 'A2-NODAL-NEGATIVE-CASE',
  }];
  const fixture = retainedFixture(source, 'NODAL-LOAD');
  assert.throws(
    () => compileLafeaShellSolverModel(fixture.compileOptions),
    (error) => error?.code === 'LAFEA4_SHELL_SOLVER_NODAL_LOAD_MAPPING_REQUIRED',
  );
  return Object.freeze({
    status: 'PASS',
    expectedRejection: 'LAFEA4_SHELL_SOLVER_NODAL_LOAD_MAPPING_REQUIRED',
    authority: 'UNSUPPORTED_FAIL_CLOSED',
  });
}

function proveNonzeroLocalRotationFailsClosed() {
  const source = shellSource();
  source.constraints = source.nodes.map((node) => ({
    constraintId: `A2-${node.nodeId}-R1`,
    nodeId: node.nodeId,
    dof: 'R1',
    value: 0.01,
    sourceReference: `A2-${node.nodeId}-R1-SOURCE`,
  }));
  const fixture = retainedFixture(source, 'NONZERO-R1');
  assert.throws(
    () => compileLafeaShellSolverModel(fixture.compileOptions),
    (error) => error?.code === 'LAFEA4_SHELL_SOLVER_NONZERO_LOCAL_ROTATION_MAPPING_REQUIRED',
  );
  return Object.freeze({
    status: 'PASS',
    expectedRejection: 'LAFEA4_SHELL_SOLVER_NONZERO_LOCAL_ROTATION_MAPPING_REQUIRED',
    authority: 'UNSUPPORTED_FAIL_CLOSED',
  });
}

function provePhysicalProbeContractIsAbsentAndFailsClosed() {
  const source = pressurePatchSource('ALONG_ELEMENT_NORMAL');
  source.probes = [{
    probeId: 'STALE-PROBE',
    ownerNodeId: source.nodes[0].nodeId,
    sourceReference: 'A2-UNQUALIFIED-PROBE',
  }];
  assert.throws(
    () => createCanonicalLocalShellModel(source),
    (error) => /model source keys must be exactly/u.test(error?.message ?? ''),
  );
  return Object.freeze({
    status: 'PASS',
    productionProbeContractPresent: false,
    staleProbeCanEnterCanonicalShellModel: false,
    disposition: 'NOT_APPLICABLE_UNTIL_A_PHYSICAL_PROBE_TRANSFER_CONTRACT_EXISTS',
  });
}

function proveMomentGateIsIndependentOfForceGate() {
  const model = createCanonicalLocalShellModel(pressurePatchSource('ALONG_ELEMENT_NORMAL'));
  const elements = buildShellElementEvidence(model);
  const assembly = assembleDenseGlobalSystem(model, elements);
  const loads = assembleLoadCase(model, model.loadCases[0], assembly, elements);
  const baseline = solveLoadCase(model, assembly, loads);
  assert.equal(baseline.forceEquilibrium.qualification.accepted, true);
  assert.equal(baseline.momentEquilibrium.qualification.accepted, true);

  const corruptedLoads = {
    ...loads,
    appliedMomentAboutOrigin: [
      loads.appliedMomentAboutOrigin[0] + 1000,
      loads.appliedMomentAboutOrigin[1],
      loads.appliedMomentAboutOrigin[2],
    ],
  };
  const corrupted = solveLoadCase(model, assembly, corruptedLoads);
  assert.equal(corrupted.forceEquilibrium.qualification.accepted, true);
  assert.equal(corrupted.momentEquilibrium.qualification.accepted, false);
  assert.deepEqual(corrupted.forceEquilibrium.residual, baseline.forceEquilibrium.residual);
  assert.ok(Math.abs(corrupted.momentEquilibrium.residual[0]) > 100);

  return Object.freeze({
    status: 'PASS',
    baselineForceGate: true,
    baselineMomentGate: true,
    corruptedForceGateRemainsPass: true,
    corruptedMomentGateFails: true,
    injectedMomentError: 1000,
    corruptedMomentResidual: corrupted.momentEquilibrium.residual,
  });
}

function retainedFixture(source, identity) {
  const authority = issueLafeaSourceAuthority('LAFEA.4', source, `LAFEA4-A2-1759/${identity}`);
  const parent = createLafeaSimulatedShellMidsurfaceEvidence(
    'LAFEA.4', authority.sourceHash, source,
  );
  const meshEvidence = produceLafeaShellAnalysisMesh({
    midsurfaceEvidence: parent,
    meshProfile: shellProfile(identity),
  }).evidence;
  assert.equal(meshEvidence.qualification, 'PASS');
  return {
    compileOptions: {
      stageId: 'LAFEA.4',
      sourceHash: authority.sourceHash,
      source,
      midsurfaceEvidence: parent,
      meshEvidence,
    },
  };
}

function shellSource() {
  return structuredClone(createLafeaMockDocument('LAFEA.4'));
}

function shellProfile(identity) {
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: `LAFEA4_A2_1759_NEG_${identity}`,
    sourceRevision: 'A2-1759/NEG-V1',
    semanticHash: undefined,
    fields: {
      continuumElement: 'T3',
      shellElement: 'CST_DKT_TRI3_THIN_SHELL_V1',
      globalTargetSize: 30,
      adjacentSizeRatioMax: 1.5,
      aspectRatioWarn: 5,
      aspectRatioBlock: 10,
      scaledJacobianWarn: 0.6,
      scaledJacobianBlock: 0.2,
      adaptiveLevels: 3,
    },
  });
}
