#!/usr/bin/env node
import assert from 'node:assert/strict';

import { PROFILE_KINDS, canonicalProfile } from '../src/core/lafea-profile-contract/index.js';
import {
  LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA,
} from '../src/workspace/lafea-continuum-physical-probe.js';
import {
  createLafeaMockDocument,
  createLafeaMockDomainAndGeometryEvidence,
  createLafeaMockMeshProfile,
} from '../src/workspace/lafea-simulated-source-provider.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { requireLafeaStageComposition } from '../src/workspace/lafea-stage-composition-root.js';
import { lafeaStageInputDescriptors } from '../src/workspace/lafea-stage-input-descriptors.js';
import { createLafeaWorkbenchOrchestratorStore } from '../src/workspace/lafea-workbench-orchestrator-store.js';

const STAGE_ID = 'LAFEA.3';
const ROUTE = 'DOMAIN_FIRST_COMPILED_SOLVER_MODEL';
const ISSUE = 'github:reallaksh19/Advanced_Analysis#1856';

const matrix = [];
matrix.push(await exerciseSourceEdit({
  editClass: 'GEOMETRY',
  expectedChangeClass: 'GEOMETRY',
  mutate: ({ store, before }) => {
    const node = before.document.nodes[0];
    assert.ok(node);
    store.setScalar(
      'LAFEA.3.node.x', node.nodeId, String(node.x + 1), 'C3C6/GEOMETRY',
    );
  },
}));
matrix.push(await exerciseSourceEdit({
  editClass: 'MATERIAL',
  expectedChangeClass: 'MATERIAL_PROPERTY',
  mutate: ({ store, before }) => {
    const material = before.document.materials[0];
    assert.ok(material);
    store.setScalar(
      'LAFEA.3.material.elasticModulus',
      material.materialId,
      String(material.elasticModulus * 1.05),
      'C3C6/MATERIAL',
    );
  },
}));
matrix.push(await exerciseLoadReachability());
matrix.push(await exerciseSourceEdit({
  editClass: 'SUPPORT',
  expectedChangeClass: 'LOAD_OR_BC',
  qualifiedSurface: 'PRESCRIBED_CONSTRAINT_VALUE',
  mutate: ({ store, before }) => {
    const constraint = before.document.constraints[0];
    assert.ok(constraint);
    store.setScalar(
      'LAFEA.3.constraint.value',
      constraint.constraintId,
      String(Number(constraint.value ?? 0) + 0.125),
      'C3C6/SUPPORT',
    );
  },
}));
matrix.push(await exerciseMeshProfileEdit());
matrix.push(await exerciseSolverConfigurationReachability());
matrix.push(await exerciseProbeDefinitionChange());

const ordering = await exerciseEditDuringRun();

assert.deepEqual(
  matrix.map((row) => row.editClass),
  ['GEOMETRY', 'MATERIAL', 'LOAD', 'SUPPORT', 'MESH_PROFILE', 'SOLVER_CONFIGURATION', 'PROBE'],
);
assert.equal(matrix.filter((row) => row.storeMutationQualified === true).length, 4);
assert.equal(matrix.filter((row) => row.explicitNonClaim === true).length, 3);
assert.equal(
  matrix.filter((row) => row.storeMutationQualified === true)
    .every((row) => row.orderingCase === 'EDIT_AFTER_SUCCESSFUL_SOLVE'),
  true,
);
assert.equal(ordering.editObservedWhileRunning, true);
assert.notEqual(ordering.after.computationalState, 'CURRENT_RESULT');
assert.equal(ordering.after.currentAuthority, false);

console.log(JSON.stringify({
  schema: 'lafea3-c3c-edit-invalidation-matrix-check/v1',
  issue: ISSUE,
  status: 'PASS',
  stageId: STAGE_ID,
  qualificationBoundary: 'REACHABLE_GOVERNED_STORE_MUTATIONS_PLUS_EXPLICIT_NON_CLAIMS',
  sevenClassesPresent: true,
  afterSuccessfulSolveCovered: true,
  editDuringSolveCovered: true,
  qualifiedStoreMutationClasses: matrix
    .filter((row) => row.storeMutationQualified)
    .map((row) => row.editClass),
  explicitNonClaimClasses: matrix
    .filter((row) => row.explicitNonClaim)
    .map((row) => row.editClass),
  matrix,
  ordering,
  releaseAuthorityGranted: false,
  solverFormulationChanged: false,
  stiffnessOrLoadAssemblyChanged: false,
  recoveryConventionChanged: false,
  benchmarkOracleOrToleranceChanged: false,
}, null, 2));

async function exerciseSourceEdit({
  editClass,
  expectedChangeClass,
  mutate,
  qualifiedSurface = null,
}) {
  const run = await solvedWorkbench(editClass);
  try {
    const before = run.store.getState().stages[STAGE_ID];
    const beforeSnapshot = snapshot(before, run.probeEvidence);
    mutate({ store: run.store, before });
    const after = run.store.getState().stages[STAGE_ID];
    assert.notEqual(after.sourceAuthority?.sourceHash, before.sourceAuthority?.sourceHash);
    assert.equal(after.lastSourceAuthorityEvent?.changeClass, expectedChangeClass);
    assertSourceDescendantsRevoked(before, after, run.profile);
    const probeRejection = captureFailure(
      () => run.store.evaluateContinuumPhysicalProbe(run.probe, STAGE_ID),
    );
    assert.equal(probeRejection, 'LAFEA_G4_PROBE_CURRENT_EXECUTION_REQUIRED');
    return Object.freeze({
      editClass,
      storeReachability: 'GOVERNED_MUTATION',
      storeMutationQualified: true,
      explicitNonClaim: false,
      mutationClassification: expectedChangeClass,
      qualifiedSurface,
      orderingCase: 'EDIT_AFTER_SUCCESSFUL_SOLVE',
      before: beforeSnapshot,
      after: snapshot(after),
      descendantDisposition: descendants(beforeSnapshot, snapshot(after), probeRejection),
      reasonCodes: [...after.currentness.blockingReasons],
      negativeDirection: Object.freeze({
        selectedMeshProfilePreserved: after.retainedAnalysisMeshProfile?.semanticHash
          === run.profile.semanticHash,
        historicalExecutionReceiptPreserved:
          after.lifecycle.artifacts.EXECUTION.artifactHash
          === before.lifecycle.artifacts.EXECUTION.artifactHash,
        historicalRecoveryReceiptPreserved:
          after.lifecycle.artifacts.RECOVERY.artifactHash
          === before.lifecycle.artifacts.RECOVERY.artifactHash,
      }),
    });
  } finally {
    run.store.destroy();
  }
}

async function exerciseMeshProfileEdit() {
  const run = await solvedWorkbench('MESH_PROFILE');
  try {
    const before = run.store.getState().stages[STAGE_ID];
    const beforeSnapshot = snapshot(before, run.probeEvidence);
    const editedProfile = canonicalProfile(PROFILE_KINDS.MESH, {
      schema: 'lafea-mesh-profile/v1',
      profileIdentity: 'C3C6-MESH-PROFILE-EDIT',
      sourceRevision: 'C3C6-MESH-PROFILE-EDIT/V1',
      semanticHash: undefined,
      fields: {
        ...run.profile.fields,
        globalTargetSize: run.profile.fields.globalTargetSize * 0.8,
      },
    });
    run.store.bindAnalysisMeshProfile(editedProfile, STAGE_ID);
    const after = run.store.getState().stages[STAGE_ID];

    assert.equal(after.sourceAuthority.sourceHash, before.sourceAuthority.sourceHash);
    assert.equal(after.lifecycle.artifacts.CANONICAL_MODEL.status, 'CURRENT');
    assert.equal(after.analysisDomainProjection.state, 'CURRENT_PASS');
    assert.equal(after.analysisGeometryProjection.state, 'CURRENT_PASS');
    assert.equal(
      after.analysisDomainProjection.analysisDomainHash,
      before.analysisDomainProjection.analysisDomainHash,
    );
    assert.equal(
      after.analysisGeometryProjection.analysisGeometryHash,
      before.analysisGeometryProjection.analysisGeometryHash,
    );
    assert.notEqual(
      after.retainedAnalysisMeshProfile.semanticHash,
      before.retainedAnalysisMeshProfile.semanticHash,
    );
    assert.equal(after.retainedAnalysisMeshEvidenceV2, null);
    assert.equal(after.retainedContinuumPreflightEvidence, null);
    assert.equal(after.execution, null);
    assert.equal(after.currentness.computationalState, 'STALE_RESULT');
    assert.equal(after.currentness.currentAuthority, false);
    assert.equal(after.currentness.historicalQualificationRetained, true);
    assert.equal(
      after.lifecycle.artifacts.EXECUTION.artifactHash,
      before.lifecycle.artifacts.EXECUTION.artifactHash,
    );
    assert.equal(
      after.lifecycle.artifacts.RECOVERY.artifactHash,
      before.lifecycle.artifacts.RECOVERY.artifactHash,
    );
    assert.notEqual(after.lifecycle.artifacts.ANALYSIS_MESH.status, 'CURRENT');
    assert.notEqual(after.lifecycle.artifacts.EXECUTION.status, 'CURRENT');
    assert.notEqual(after.lifecycle.artifacts.RECOVERY.status, 'CURRENT');

    const probeRejection = captureFailure(
      () => run.store.evaluateContinuumPhysicalProbe(run.probe, STAGE_ID),
    );
    assert.equal(probeRejection, 'LAFEA_G4_PROBE_CURRENT_EXECUTION_REQUIRED');
    const afterSnapshot = snapshot(after);
    return Object.freeze({
      editClass: 'MESH_PROFILE',
      storeReachability: 'GOVERNED_MUTATION',
      storeMutationQualified: true,
      explicitNonClaim: false,
      mutationClassification: 'ANALYSIS_MESH_PROFILE',
      qualifiedSurface: 'BOUND_ANALYSIS_MESH_PROFILE',
      orderingCase: 'EDIT_AFTER_SUCCESSFUL_SOLVE',
      before: beforeSnapshot,
      after: afterSnapshot,
      descendantDisposition: Object.freeze([
        disposition('analysisDomain', beforeSnapshot.analysisDomain, afterSnapshot.analysisDomain, 'PRESERVED'),
        disposition('analysisGeometry', beforeSnapshot.analysisGeometry, afterSnapshot.analysisGeometry, 'PRESERVED'),
        disposition('retainedMesh', beforeSnapshot.retainedMesh, afterSnapshot.retainedMesh, 'INVALIDATED'),
        disposition('compiledSolverModel', beforeSnapshot.compiledSolverModel, afterSnapshot.compiledSolverModel, 'INVALIDATED'),
        disposition('executionResult', beforeSnapshot.executionResult, afterSnapshot.executionResult, 'STALE_HISTORY_RETAINED'),
        disposition('recovery', beforeSnapshot.recovery, afterSnapshot.recovery, 'STALE_HISTORY_RETAINED'),
        disposition('probeEvidence', beforeSnapshot.probeEvidence, { reevaluation: probeRejection }, 'CURRENT_REEVALUATION_REJECTED'),
      ]),
      reasonCodes: [...after.currentness.blockingReasons],
      negativeDirection: Object.freeze({
        sourceRevisionPreserved: true,
        canonicalModelPreserved: true,
        analysisDomainPreserved: true,
        analysisGeometryPreserved: true,
      }),
    });
  } finally {
    run.store.destroy();
  }
}

async function exerciseLoadReachability() {
  const run = await solvedWorkbench('LOAD');
  try {
    const before = run.store.getState().stages[STAGE_ID];
    const beforeSnapshot = snapshot(before, run.probeEvidence);
    const loadDescriptors = lafeaStageInputDescriptors(STAGE_ID)
      .filter((row) => row.target?.collectionPath === 'loadCases');
    assert.deepEqual(loadDescriptors, []);

    const replacement = structuredClone(before.document);
    const loadCase = replacement.loadCases.find((row) => row.nodalForces?.length);
    assert.ok(loadCase, 'LAFEA.3 qualification source must contain a nodal load.');
    const load = loadCase.nodalForces[0];
    if (Number(load.fx) !== 0) load.fx *= 1.1;
    else load.fy = Number(load.fy) * 1.1 || 1;
    run.store.replaceDocument(replacement, 'C3C6/LOAD-REACHABILITY-PROBE');
    const after = run.store.getState().stages[STAGE_ID];
    assert.equal(after.lastSourceAuthorityEvent?.changeClass, 'GEOMETRY');
    assert.equal(after.currentness.currentAuthority, false);
    assert.notEqual(after.currentness.computationalState, 'CURRENT_RESULT');

    return Object.freeze({
      editClass: 'LOAD',
      storeReachability: 'GENERIC_DOCUMENT_REPLACEMENT_ONLY',
      storeMutationQualified: false,
      explicitNonClaim: true,
      nonClaimReason: 'NO_LAFEA3_GOVERNED_LOAD_DESCRIPTOR_OR_LOAD_CLASS_MUTATION',
      orderingCase: 'EDIT_AFTER_SUCCESSFUL_SOLVE_FALLBACK_ONLY',
      fallbackMutationObserved: Object.freeze({
        physicalLoadValueChanged: true,
        classifiedAs: after.lastSourceAuthorityEvent?.changeClass ?? null,
        qualifiesAsLoadEdit: false,
      }),
      before: beforeSnapshot,
      after: snapshot(after),
      descendantDisposition: descendants(beforeSnapshot, snapshot(after), 'NOT_CLAIMED_AS_LOAD_EDIT'),
      reasonCodes: [...after.currentness.blockingReasons],
    });
  } finally {
    run.store.destroy();
  }
}

async function exerciseSolverConfigurationReachability() {
  const run = await solvedWorkbench('SOLVER_CONFIGURATION');
  try {
    const before = run.store.getState().stages[STAGE_ID];
    const solverNamedMethods = Object.keys(run.store).filter((name) => /solver/iu.test(name)).sort();
    const mutatingSolverMethods = solverNamedMethods.filter(
      (name) => /^(?:set|bind|edit|update|replace|register)/iu.test(name),
    );
    assert.deepEqual(mutatingSolverMethods, []);
    assert.ok(solverNamedMethods.includes('compileContinuumSolverModel'));
    return Object.freeze({
      editClass: 'SOLVER_CONFIGURATION',
      storeReachability: 'READ_ONLY_DERIVATION_ONLY',
      storeMutationQualified: false,
      explicitNonClaim: true,
      nonClaimReason: 'NO_PUBLIC_GOVERNED_SOLVER_CONFIGURATION_MUTATOR',
      orderingCase: 'NOT_APPLICABLE_NO_MUTATOR',
      publicSolverNamedMethods: solverNamedMethods,
      before: snapshot(before, run.probeEvidence),
      after: null,
      descendantDisposition: nonClaimDescendants('SOLVER_CONFIGURATION_EDIT_NOT_DRIVABLE'),
      reasonCodes: ['C3C6_SOLVER_CONFIGURATION_EDIT_SURFACE_NOT_EXPOSED'],
    });
  } finally {
    run.store.destroy();
  }
}

async function exerciseProbeDefinitionChange() {
  const run = await solvedWorkbench('PROBE');
  try {
    const before = run.store.getState().stages[STAGE_ID];
    const beforeSnapshot = snapshot(before, run.probeEvidence);
    const editedProbe = Object.freeze({
      ...run.probe,
      quantityId: 'DISPLACEMENT_Y',
    });
    const editedEvidence = run.store.evaluateContinuumPhysicalProbe(editedProbe, STAGE_ID);
    const after = run.store.getState().stages[STAGE_ID];
    const afterSnapshot = snapshot(after, editedEvidence);

    assert.notEqual(editedEvidence.semanticHash, run.probeEvidence.semanticHash);
    assert.notEqual(editedEvidence.quantityIdentityHash, run.probeEvidence.quantityIdentityHash);
    assert.deepEqual(after.currentness.identity, before.currentness.identity);
    assert.equal(after.currentness.computationalState, 'CURRENT_RESULT');
    assert.equal(after.currentness.currentAuthority, true);
    assert.equal(after.sourceAuthority.sourceHash, before.sourceAuthority.sourceHash);
    assert.equal(
      after.analysisMeshCustodyProjection.meshHash,
      before.analysisMeshCustodyProjection.meshHash,
    );
    assert.equal(
      after.execution.compiledExecutionHash,
      before.execution.compiledExecutionHash,
    );
    assert.equal(
      after.lifecycle.artifacts.RECOVERY.artifactHash,
      before.lifecycle.artifacts.RECOVERY.artifactHash,
    );

    const probeNamedMethods = Object.keys(run.store).filter((name) => /probe/iu.test(name)).sort();
    assert.equal(
      probeNamedMethods.some((name) => /^(?:set|bind|edit|update|replace|register)/iu.test(name)),
      false,
    );
    return Object.freeze({
      editClass: 'PROBE',
      storeReachability: 'READ_ONLY_DEFINITION_EVALUATION',
      storeMutationQualified: false,
      explicitNonClaim: true,
      nonClaimReason: 'PROBE_DEFINITION_IS_NOT_RETAINED_EDITABLE_WORKBENCH_STATE',
      orderingCase: 'EVALUATION_AFTER_SUCCESSFUL_SOLVE',
      publicProbeNamedMethods: probeNamedMethods,
      before: beforeSnapshot,
      after: afterSnapshot,
      descendantDisposition: Object.freeze([
        disposition('analysisDomain', beforeSnapshot.analysisDomain, afterSnapshot.analysisDomain, 'PRESERVED'),
        disposition('analysisGeometry', beforeSnapshot.analysisGeometry, afterSnapshot.analysisGeometry, 'PRESERVED'),
        disposition('retainedMesh', beforeSnapshot.retainedMesh, afterSnapshot.retainedMesh, 'PRESERVED'),
        disposition('compiledSolverModel', beforeSnapshot.compiledSolverModel, afterSnapshot.compiledSolverModel, 'PRESERVED'),
        disposition('executionResult', beforeSnapshot.executionResult, afterSnapshot.executionResult, 'PRESERVED'),
        disposition('recovery', beforeSnapshot.recovery, afterSnapshot.recovery, 'PRESERVED'),
        disposition('probeEvidence', beforeSnapshot.probeEvidence, afterSnapshot.probeEvidence, 'NEW_EVIDENCE_IDENTITY'),
      ]),
      reasonCodes: ['C3C6_RETAINED_PROBE_EDIT_SURFACE_NOT_EXPOSED'],
      negativeDirection: Object.freeze({
        upstreamAnalysisCurrentnessPreserved: true,
        onlyProbeEvidenceIdentityChanged: true,
      }),
    });
  } finally {
    run.store.destroy();
  }
}

async function exerciseEditDuringRun() {
  const run = await preparedWorkbench('DURING_RUN');
  let editObservedWhileRunning = false;
  let runningTransactionHash = null;
  const unsubscribe = run.store.subscribe((state) => {
    const stage = state.stages[STAGE_ID];
    if (editObservedWhileRunning || stage.currentness?.computationalState !== 'RUNNING') return;
    editObservedWhileRunning = true;
    runningTransactionHash = stage.currentness.transactionIdentity.activeTransactionHash;
    const material = stage.document.materials[0];
    run.store.setScalar(
      'LAFEA.3.material.elasticModulus',
      material.materialId,
      String(material.elasticModulus * 1.01),
      'C3C6/DURING-RUN-MATERIAL-EDIT',
    );
  });
  try {
    run.store.run();
  } finally {
    unsubscribe();
  }
  try {
    const after = run.store.getState().stages[STAGE_ID];
    assert.equal(editObservedWhileRunning, true);
    assert.match(runningTransactionHash ?? '', /^sha256:[0-9a-f]{64}$/u);
    assert.equal(after.currentness.currentAuthority, false);
    assert.notEqual(after.currentness.computationalState, 'CURRENT_RESULT');
    assert.equal(after.latestRunTransactionReceipt?.status, 'SUPERSEDED');
    assert.ok(after.latestRunTransactionReceipt?.reasonCode);
    assert.equal(after.execution, null);
    return Object.freeze({
      editClass: 'MATERIAL',
      orderingCase: 'EDIT_DURING_RUNNING_TRANSACTION',
      editObservedWhileRunning,
      runningTransactionHash,
      after: Object.freeze({
        computationalState: after.currentness.computationalState,
        currentAuthority: after.currentness.currentAuthority,
        transactionReceiptStatus: after.latestRunTransactionReceipt?.status ?? null,
        transactionReasonCode: after.latestRunTransactionReceipt?.reasonCode ?? null,
        blockingReasons: [...after.currentness.blockingReasons],
      }),
    });
  } finally {
    run.store.destroy();
  }
}

function assertSourceDescendantsRevoked(before, after, profile) {
  assert.equal(after.currentness.computationalState, 'STALE_RESULT');
  assert.equal(after.currentness.currentAuthority, false);
  assert.equal(after.currentness.historicalQualificationRetained, true);
  assert.notEqual(after.analysisDomainProjection.state, 'CURRENT_PASS');
  assert.notEqual(after.analysisGeometryProjection.state, 'CURRENT_PASS');
  assert.equal(after.retainedAnalysisMeshEvidenceV2, null);
  assert.equal(after.retainedContinuumPreflightEvidence, null);
  assert.equal(after.execution, null);
  assert.notEqual(after.lifecycle.artifacts.EXECUTION.status, 'CURRENT');
  assert.notEqual(after.lifecycle.artifacts.RECOVERY.status, 'CURRENT');
  assert.equal(
    after.lifecycle.artifacts.EXECUTION.artifactHash,
    before.lifecycle.artifacts.EXECUTION.artifactHash,
  );
  assert.equal(
    after.lifecycle.artifacts.RECOVERY.artifactHash,
    before.lifecycle.artifacts.RECOVERY.artifactHash,
  );
  assert.equal(after.retainedAnalysisMeshProfile?.semanticHash, profile.semanticHash);
}

async function solvedWorkbench(label) {
  const run = await preparedWorkbench(label);
  run.store.run();
  const stage = run.store.getState().stages[STAGE_ID];
  assert.equal(stage.execution?.status, 'QUALIFIED');
  assert.equal(stage.execution?.route, ROUTE);
  assert.equal(stage.execution?.result?.qualification?.state, 'ACCEPTED');
  assert.equal(stage.currentness?.computationalState, 'CURRENT_RESULT');
  assert.equal(stage.currentness?.currentAuthority, true);
  assert.equal(stage.currentness?.exactCurrentParentChain, true);
  const probe = probeFor(stage, `C3C6-${label}-PROBE`);
  const probeEvidence = run.store.evaluateContinuumPhysicalProbe(probe, STAGE_ID);
  assert.equal(probeEvidence.status, 'PASS');
  return Object.freeze({ ...run, stage, probe, probeEvidence });
}

async function preparedWorkbench(label) {
  const source = await createLafeaMockDocument(STAGE_ID);
  const normalized = requireLafeaStageComposition(STAGE_ID).normalizeDocument(source);
  const authority = issueLafeaSourceAuthority(STAGE_ID, normalized, `C3C6/${label}`);
  const parents = await createLafeaMockDomainAndGeometryEvidence(STAGE_ID, authority.sourceHash);
  const profile = createLafeaMockMeshProfile(STAGE_ID);
  const store = createLafeaWorkbenchOrchestratorStore({
    initialStage: STAGE_ID,
    initialDocument: normalized,
    initialSourceHash: authority.sourceHash,
  });
  store.activateDomainFirstProfile(STAGE_ID);
  assert.equal(store.registerAnalysisDomain(parents.domain, STAGE_ID).projection.state, 'CURRENT_PASS');
  assert.equal(
    store.registerAnalysisGeometryEvidence(parents.geometryEvidence, STAGE_ID).projection.state,
    'CURRENT_PASS',
  );
  store.bindAnalysisMeshProfile(profile, STAGE_ID);
  const generated = store.generateAnalysisMesh({}, STAGE_ID);
  assert.equal(generated?.evidence?.qualification, 'PASS');
  const preflight = store.prepareContinuumForRun(STAGE_ID);
  assert.equal(preflight.projection.state, 'CURRENT_PASS');
  return Object.freeze({ store, normalized, authority, parents, profile });
}

function probeFor(stage, probeId) {
  const canonicalInput = stage.execution?.canonicalInput;
  assert.ok(canonicalInput);
  const element = canonicalInput.elements[0];
  assert.ok(element);
  const nodes = new Map(canonicalInput.nodes.map((row) => [row.nodeId, row]));
  const vertices = element.nodeIds.slice(0, 3).map((nodeId) => nodes.get(nodeId));
  assert.equal(vertices.every(Boolean), true);
  const point = {
    x: vertices.reduce((sum, row) => sum + row.x, 0) / vertices.length,
    y: vertices.reduce((sum, row) => sum + row.y, 0) / vertices.length,
  };
  return Object.freeze({
    schema: LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA,
    probeId,
    physicalCoordinate: point,
    coordinateFrame: 'GLOBAL_XY',
    loadCaseId: canonicalInput.loadCases[0].loadCaseId,
    quantityId: 'DISPLACEMENT_X',
    representation: 'PHYSICAL_POINT_DIRECT',
    recoveryMethod: 'ELEMENT_SHAPE_INTERPOLATION',
    units: 'mm',
    singularityClassification: 'NOT_APPLICABLE',
  });
}

function snapshot(stage, probeEvidence = null) {
  return Object.freeze({
    sourceHash: stage.sourceAuthority?.sourceHash ?? null,
    computationalState: stage.currentness?.computationalState ?? null,
    currentAuthority: stage.currentness?.currentAuthority ?? false,
    historicalQualificationRetained: stage.currentness?.historicalQualificationRetained ?? false,
    meshProfileHash: stage.retainedAnalysisMeshProfile?.semanticHash ?? null,
    analysisDomain: Object.freeze({
      state: stage.analysisDomainProjection?.state ?? null,
      projectionHash: stage.analysisDomainProjection?.analysisDomainHash ?? null,
      retainedHash: stage.retainedAnalysisDomain?.semanticHash ?? null,
    }),
    analysisGeometry: Object.freeze({
      state: stage.analysisGeometryProjection?.state ?? null,
      projectionHash: stage.analysisGeometryProjection?.analysisGeometryHash ?? null,
      retainedHash: stage.retainedAnalysisGeometryEvidence?.analysisGeometryHash ?? null,
      lifecycleStatus: stage.lifecycle?.artifacts?.ANALYSIS_GEOMETRY?.status ?? null,
    }),
    retainedMesh: Object.freeze({
      present: Boolean(stage.retainedAnalysisMeshEvidenceV2),
      custodyState: stage.analysisMeshCustodyProjection?.state ?? null,
      meshHash: stage.retainedAnalysisMeshEvidenceV2?.meshHash
        ?? stage.currentness?.identity?.meshRevisionHash
        ?? null,
      artifactHash: stage.retainedAnalysisMeshEvidenceV2?.artifactHash ?? null,
      lifecycleStatus: stage.lifecycle?.artifacts?.ANALYSIS_MESH?.status ?? null,
    }),
    compiledSolverModel: Object.freeze({
      preflightPresent: Boolean(stage.retainedContinuumPreflightEvidence),
      solverModelHash: stage.retainedContinuumPreflightEvidence?.solverModelHash ?? null,
      solverConfigHash: stage.currentness?.identity?.solverConfigHash ?? null,
    }),
    executionResult: Object.freeze({
      present: Boolean(stage.execution),
      status: stage.execution?.status ?? null,
      executionHash: stage.execution?.compiledExecutionHash
        ?? stage.currentness?.identity?.executionHash
        ?? null,
      lifecycleStatus: stage.lifecycle?.artifacts?.EXECUTION?.status ?? null,
    }),
    recovery: Object.freeze({
      recoveryHash: stage.currentness?.identity?.recoveryHash ?? null,
      lifecycleStatus: stage.lifecycle?.artifacts?.RECOVERY?.status ?? null,
    }),
    probeEvidence: probeEvidence
      ? Object.freeze({
        semanticHash: probeEvidence.semanticHash,
        probeIdentityHash: probeEvidence.probeIdentityHash,
        quantityIdentityHash: probeEvidence.quantityIdentityHash,
        status: probeEvidence.status,
      })
      : Object.freeze({ retainedInWorkbench: false }),
  });
}

function descendants(before, after, probeAfter) {
  return Object.freeze([
    disposition('analysisDomain', before.analysisDomain, after.analysisDomain, 'INVALIDATED_OR_REVALIDATION_REQUIRED'),
    disposition('analysisGeometry', before.analysisGeometry, after.analysisGeometry, 'INVALIDATED_OR_REVALIDATION_REQUIRED'),
    disposition('retainedMesh', before.retainedMesh, after.retainedMesh, 'INVALIDATED'),
    disposition('compiledSolverModel', before.compiledSolverModel, after.compiledSolverModel, 'INVALIDATED'),
    disposition('executionResult', before.executionResult, after.executionResult, 'STALE_HISTORY_RETAINED'),
    disposition('recovery', before.recovery, after.recovery, 'STALE_HISTORY_RETAINED'),
    disposition('probeEvidence', before.probeEvidence, { reevaluation: probeAfter }, 'CURRENT_REEVALUATION_REJECTED'),
  ]);
}

function nonClaimDescendants(reason) {
  return Object.freeze([
    'analysisDomain', 'analysisGeometry', 'retainedMesh', 'compiledSolverModel',
    'executionResult', 'recovery', 'probeEvidence',
  ].map((artifact) => Object.freeze({
    artifact,
    before: 'CURRENT_BASELINE_AVAILABLE',
    after: 'NOT_OBSERVED',
    expectedDisposition: 'NOT_CLAIMED',
    observation: reason,
  })));
}

function disposition(artifact, before, after, expectedDisposition) {
  return Object.freeze({ artifact, before, after, expectedDisposition });
}

function captureFailure(action) {
  try {
    action();
  } catch (error) {
    return error?.code ?? error?.message ?? String(error);
  }
  return 'NO_FAILURE';
}
