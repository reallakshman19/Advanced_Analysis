#!/usr/bin/env node
import assert from 'node:assert/strict';

import { calculateLocalShell, createCanonicalLocalShellModel } from '../src/core/local-shell/index.js';
import { PROFILE_KINDS, canonicalProfile } from '../src/core/lafea-profile-contract/index.js';
import { baseSource, flatNode, pressurePatchSource } from './lafea.4-fixtures.mjs';
import { canonicalLafeaSha256 } from '../src/workspace/lafea-canonical-sha256.js';
import {
  LAFEA_SHELL_ANALYSIS_DOMAIN_SCHEMA,
  LAFEA_SHELL_MIDSURFACE_GEOMETRY_SCHEMA,
  LAFEA_SHELL_MIDSURFACE_INTAKE_SCHEMA,
  LAFEA_SHELL_MIDSURFACE_ORIENTATION,
  LAFEA_SHELL_MIDSURFACE_TOPOLOGY,
  createLafeaShellAnalysisDomain,
  createLafeaShellMidsurfaceEvidence,
  createLafeaShellMidsurfaceGeometry,
} from '../src/workspace/lafea-shell-midsurface-contract.js';
import { produceLafeaShellAnalysisMesh } from '../src/workspace/lafea-shell-mesh-producer.js';
import { compileLafeaShellSolverModel } from '../src/workspace/lafea-shell-solver-model.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';

const STAGE_ID = 'LAFEA.4';
const PRESSURE = 2;
const PRESSURE_SENSE = 'ALONG_ELEMENT_NORMAL';
const TARGETS = Object.freeze([60, 30, 15]);

const handTriangle = qualifyHandTriangle();
const remesh = qualifyRemeshedPlate();

console.log(JSON.stringify({
  schema: 'lafea4-a2-load-transfer-check/v1',
  status: 'PASS',
  engineeringBoundary: 'LOAD_BC_TRANSFER_ONLY',
  releaseAuthorityGranted: false,
  handTriangle,
  remesh,
}, null, 2));

function qualifyHandTriangle() {
  const nodes = [flatNode('A', 0, 0), flatNode('B', 20, 0), flatNode('C', 0, 12)];
  const source = baseSource({
    modelIdentity: 'L4-MAP-01-TRI3-PRESSURE-HAND-ORACLE',
    nodes,
    elements: [{
      elementId: 'T1', nodeIds: ['A', 'B', 'C'], materialId: 'MAT', thickness: 2,
      sourceReference: 'L4-MAP-01-T1',
    }],
    constraints: fullyFixed(nodes),
    loadCases: [{
      loadCaseId: 'PRESSURE', nodalLoads: [],
      pressureLoads: [{
        pressureLoadId: 'P-T1', elementId: 'T1', pressure: PRESSURE,
        sense: PRESSURE_SENSE, sourceReference: 'L4-MAP-01-P-T1',
      }],
      sourceReference: 'L4-MAP-01-PRESSURE',
    }],
  });
  const result = calculateLocalShell(createCanonicalLocalShellModel(source));
  assert.equal(result.qualification.accepted, true, result.qualification.summary);
  const loadCase = result.loadCaseResults[0];
  const contribution = loadCase.appliedLoadEvidence.contributions[0];
  const area = 0.5 * 20 * 12;
  const total = PRESSURE * area;
  const expectedNodal = [0, 0, total / 3];
  const expectedForce = [0, 0, total];
  const expectedMoment = cross3([20 / 3, 4, 0], expectedForce);

  close(contribution.representedArea, 120);
  vectorClose(contribution.nodalForce, expectedNodal);
  vectorClose(contribution.totalForce, expectedForce);
  vectorClose(loadCase.appliedLoadEvidence.appliedForce, expectedForce);
  vectorClose(loadCase.appliedLoadEvidence.appliedMomentAboutOrigin, expectedMoment);
  assert.equal(loadCase.forceEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.momentEquilibrium.qualification.accepted, true);
  assertFullyFixedReactionParity(result, loadCase);

  return Object.freeze({
    caseId: 'L4-MAP-01', area, pressure: PRESSURE,
    expectedTotalForce: expectedForce,
    expectedNodalForce: expectedNodal,
    expectedMomentAboutOrigin: expectedMoment,
  });
}

function qualifyRemeshedPlate() {
  const source = pressurePatchSource(PRESSURE_SENSE);
  source.modelIdentity = 'L4-MAP-04-REMESHED-PLATE';
  source.modelVersion = 'A2-1';
  const positions = new Map([
    ['A', [0, 0, 0]], ['B', [200, 0, 0]],
    ['C', [200, 120, 0]], ['D', [0, 120, 0]],
  ]);
  source.nodes.forEach((node) => { node.position = [...positions.get(node.nodeId)]; });
  source.loadCases[0].pressureLoads.forEach((load) => { load.pressure = PRESSURE; });

  const authority = issueLafeaSourceAuthority(STAGE_ID, source, 'LAFEA4-A2-1759/REMESHED-PLATE');
  const geometry = createPlateGeometry();
  const domain = createDomain(authority.sourceHash, geometry, 'L4-MAP-04-PLATE-DOMAIN');
  const parent = createParent(authority.sourceHash, geometry, domain, 'LAFEA4-A2-1759-DECLARED-PLATE');
  const expectedForce = [0, 0, PRESSURE * 200 * 120];
  const expectedMoment = cross3([100, 60, 0], expectedForce);
  const levels = TARGETS.map((target) => qualifyLevel({
    target, source, authority, parent, expectedForce, expectedMoment,
  }));

  assert.equal(new Set(levels.map((row) => row.meshHash)).size, levels.length);
  assert.equal(new Set(levels.map((row) => row.solverModelBindingHash)).size, levels.length);
  for (let index = 1; index < levels.length; index += 1) {
    assert.ok(levels[index].nodeCount > levels[index - 1].nodeCount);
    assert.ok(levels[index].elementCount > levels[index - 1].elementCount);
    assert.notDeepEqual(levels[index].resolvedNodeIds, levels[index - 1].resolvedNodeIds);
    assert.notDeepEqual(levels[index].resolvedElementIds, levels[index - 1].resolvedElementIds);
  }

  const changedSource = structuredClone(source);
  changedSource.loadCases[0].pressureLoads.forEach((load) => { load.pressure = 3; });
  const changedAuthority = issueLafeaSourceAuthority(
    STAGE_ID, changedSource, 'LAFEA4-A2-1759/STALE-PRESSURE-NEGATIVE',
  );
  const staleMesh = produceLafeaShellAnalysisMesh({
    midsurfaceEvidence: parent, meshProfile: shellProfile(TARGETS[0]),
  }).evidence;
  assert.throws(
    () => compileLafeaShellSolverModel({
      stageId: STAGE_ID, sourceHash: changedAuthority.sourceHash, source: changedSource,
      midsurfaceEvidence: parent, meshEvidence: staleMesh,
    }),
    (error) => error?.code === 'LAFEA_SHELL_SOLVER_SOURCE_PARENT_STALE',
  );

  const partialPressure = structuredClone(source);
  partialPressure.loadCases[0].pressureLoads.pop();
  const partialAuthority = issueLafeaSourceAuthority(
    STAGE_ID, partialPressure, 'LAFEA4-A2-1759/PARTIAL-PRESSURE-NEGATIVE',
  );
  const partialDomain = createDomain(
    partialAuthority.sourceHash, geometry, 'L4-MAP-04-PARTIAL-PRESSURE-DOMAIN',
  );
  const partialParent = createParent(
    partialAuthority.sourceHash, geometry, partialDomain, 'LAFEA4-A2-1759-PARTIAL-PRESSURE-PARENT',
  );
  const partialMesh = produceLafeaShellAnalysisMesh({
    midsurfaceEvidence: partialParent, meshProfile: shellProfile(TARGETS[0]),
  }).evidence;
  assert.throws(
    () => compileLafeaShellSolverModel({
      stageId: STAGE_ID, sourceHash: partialAuthority.sourceHash, source: partialPressure,
      midsurfaceEvidence: partialParent, meshEvidence: partialMesh,
    }),
    (error) => error?.code === 'LAFEA4_SHELL_SOLVER_PRESSURE_REGION_MAPPING_REQUIRED',
  );

  return Object.freeze({
    caseId: 'L4-MAP-04-WHOLE-SURFACE-BOUNDED',
    physicalArea: 200 * 120,
    pressure: PRESSURE,
    expectedForce,
    expectedMomentAboutOrigin: expectedMoment,
    levels,
    staleSourceRejected: true,
    partialPressureRejected: true,
    mappingAuthority: 'WHOLE_SURFACE_UNIFORM_PRESSURE_AND_WHOLE_SURFACE_IDENTICAL_BC_ONLY',
  });
}

function qualifyLevel({ target, source, authority, parent, expectedForce, expectedMoment }) {
  const retained = produceLafeaShellAnalysisMesh({
    midsurfaceEvidence: parent, meshProfile: shellProfile(target),
  }).evidence;
  assert.equal(retained.qualification, 'PASS');
  const compiled = compileLafeaShellSolverModel({
    stageId: STAGE_ID, sourceHash: authority.sourceHash, source,
    midsurfaceEvidence: parent, meshEvidence: retained,
  });
  assert.equal(compiled.parents.meshHash, retained.meshHash);
  assert.equal(compiled.transferEvidence.pressurePolicy,
    'WHOLE_SURFACE_UNIFORM_PRESSURE_AND_SENSE_ONLY');
  assert.equal(compiled.transferEvidence.translationConstraintPolicy,
    'WHOLE_SURFACE_IDENTICAL_GLOBAL_VALUE_PER_DOF_ONLY');
  assert.equal(compiled.transferEvidence.localRotationConstraintPolicy, 'WHOLE_SURFACE_ZERO_ONLY');

  const kernelCase = compiled.canonicalShellModel.loadCases[0];
  const resolvedElementIds = kernelCase.pressureLoads.map((row) => row.elementId).sort();
  const retainedElementIds = retained.mesh.elements.map((row) => row.elementId).sort();
  assert.deepEqual(resolvedElementIds, retainedElementIds);
  kernelCase.pressureLoads.forEach((row) => {
    assert.equal(row.pressure, PRESSURE);
    assert.equal(row.sense, PRESSURE_SENSE);
    assert.ok(row.sourceReference.includes(retained.meshHash));
  });

  const resolvedNodeIds = [...new Set(
    compiled.canonicalShellModel.constraints.map((row) => row.nodeId),
  )].sort();
  const retainedNodeIds = retained.mesh.nodes.map((row) => row.nodeId).sort();
  assert.deepEqual(resolvedNodeIds, retainedNodeIds);
  assert.equal(compiled.canonicalShellModel.constraints.length, retained.mesh.nodes.length * 5);
  compiled.canonicalShellModel.constraints.forEach((row) => {
    assert.equal(row.value, 0);
    assert.ok(row.sourceReference.includes(retained.meshHash));
  });

  const result = calculateLocalShell(compiled.canonicalShellModel);
  assert.equal(result.qualification.accepted, true, result.qualification.summary);
  const solved = result.loadCaseResults[0];
  vectorClose(solved.appliedLoadEvidence.appliedForce, expectedForce, 1e-8);
  vectorClose(solved.appliedLoadEvidence.appliedMomentAboutOrigin, expectedMoment, 1e-8);
  assert.equal(solved.forceEquilibrium.qualification.accepted, true);
  assert.equal(solved.momentEquilibrium.qualification.accepted, true);
  assert.equal(solved.appliedLoadEvidence.contributions.length, retained.mesh.elements.length);
  assertFullyFixedReactionParity(result, solved);
  const reaction = reactionTotals(compiled.canonicalShellModel, solved.reactions);
  vectorClose(reaction.force, expectedForce.map((value) => -value), 1e-8);
  vectorClose(reaction.moment, expectedMoment.map((value) => -value), 1e-8);

  return Object.freeze({
    target,
    meshHash: retained.meshHash,
    meshArtifactHash: retained.artifactHash,
    solverModelHash: compiled.solverModelHash,
    solverModelBindingHash: compiled.solverModelBindingHash,
    compiledLoadVectorHash: canonicalLafeaSha256({
      schema: 'lafea4-a2-compiled-load-vector/v1',
      meshHash: retained.meshHash,
      forceVector: solved.appliedLoadEvidence.forceVector,
    }),
    nodeCount: retained.mesh.nodes.length,
    elementCount: retained.mesh.elements.length,
    resolvedNodeIds,
    resolvedElementIds,
    appliedForce: solved.appliedLoadEvidence.appliedForce,
    appliedMomentAboutOrigin: solved.appliedLoadEvidence.appliedMomentAboutOrigin,
    reactionForce: reaction.force,
    reactionMomentAboutOrigin: reaction.moment,
  });
}

function createPlateGeometry() {
  return createLafeaShellMidsurfaceGeometry({
    schema: LAFEA_SHELL_MIDSURFACE_GEOMETRY_SCHEMA,
    stageId: STAGE_ID,
    geometryId: 'L4-MAP-04-200X120-PLATE',
    lengthUnit: 'mm',
    origin: { x: 0, y: 0, z: 0 },
    axisU: { x: 1, y: 0, z: 0 },
    axisV: { x: 0, y: 1, z: 0 },
    orientationPolicy: LAFEA_SHELL_MIDSURFACE_ORIENTATION,
    vertices: [
      { vertexId: 'V1', u: 0, v: 0 }, { vertexId: 'V2', u: 200, v: 0 },
      { vertexId: 'V3', u: 200, v: 120 }, { vertexId: 'V4', u: 0, v: 120 },
    ],
    segments: [
      { segmentId: 'S1', startVertexId: 'V1', endVertexId: 'V2' },
      { segmentId: 'S2', startVertexId: 'V2', endVertexId: 'V3' },
      { segmentId: 'S3', startVertexId: 'V3', endVertexId: 'V4' },
      { segmentId: 'S4', startVertexId: 'V4', endVertexId: 'V1' },
    ],
    loops: [{ loopId: 'OUTER', role: 'OUTER', segmentIds: ['S1', 'S2', 'S3', 'S4'] }],
  });
}

function createDomain(sourceHash, geometry, domainId) {
  return createLafeaShellAnalysisDomain({
    schema: LAFEA_SHELL_ANALYSIS_DOMAIN_SCHEMA,
    stageId: STAGE_ID,
    domainId,
    sourceHash,
    midsurfaceGeometryHash: geometry.semanticHash,
    lengthUnit: 'mm',
    topologyClass: LAFEA_SHELL_MIDSURFACE_TOPOLOGY,
  });
}

function createParent(sourceHash, geometry, analysisDomain, producerRef) {
  return createLafeaShellMidsurfaceEvidence({
    schema: LAFEA_SHELL_MIDSURFACE_INTAKE_SCHEMA,
    stageId: STAGE_ID,
    sourceHash,
    analysisDomain,
    geometry,
    producerRef,
  });
}

function shellProfile(target) {
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: `LAFEA4_A2_1759_${target}`,
    sourceRevision: 'A2-1759/V1',
    semanticHash: undefined,
    fields: {
      continuumElement: 'T3', shellElement: 'CST_DKT_TRI3_THIN_SHELL_V1',
      globalTargetSize: target, adjacentSizeRatioMax: 1.5,
      aspectRatioWarn: 5, aspectRatioBlock: 10,
      scaledJacobianWarn: 0.6, scaledJacobianBlock: 0.2,
      adaptiveLevels: 3,
    },
  });
}

function fullyFixed(nodes) {
  return nodes.flatMap((node) => ['UX', 'UY', 'UZ', 'R1', 'R2'].map((dof) => ({
    constraintId: `C-${node.nodeId}-${dof}`,
    nodeId: node.nodeId,
    dof,
    value: 0,
    sourceReference: `L4-MAP-01-C-${node.nodeId}-${dof}`,
  })));
}

function assertFullyFixedReactionParity(result, loadCase) {
  assert.equal(loadCase.reactions.length, result.meshEvidence.dofOrdering.length);
  loadCase.reactions.forEach((reaction) => {
    const index = result.meshEvidence.dofOrdering.indexOf(`${reaction.nodeId}:${reaction.dof}`);
    assert.ok(index >= 0);
    close(reaction.value, -loadCase.appliedLoadEvidence.forceVector[index], 1e-8);
  });
}

function reactionTotals(model, reactions) {
  const nodeById = new Map(model.nodes.map((node) => [node.nodeId, node]));
  let force = [0, 0, 0];
  let moment = [0, 0, 0];
  for (const reaction of reactions) {
    const node = nodeById.get(reaction.nodeId);
    assert.ok(node);
    if (reaction.dof === 'UX' || reaction.dof === 'UY' || reaction.dof === 'UZ') {
      const axis = { UX: 0, UY: 1, UZ: 2 }[reaction.dof];
      const row = [0, 0, 0];
      row[axis] = reaction.value;
      force = add3(force, row);
      moment = add3(moment, cross3(node.position, row));
    } else if (reaction.dof === 'R1') {
      moment = add3(moment, scale3(node.rotationBasis1, reaction.value));
    } else if (reaction.dof === 'R2') {
      moment = add3(moment, scale3(node.rotationBasis2, reaction.value));
    } else {
      assert.fail(`unexpected reaction DOF ${reaction.dof}`);
    }
  }
  return { force, moment };
}

function vectorClose(actual, expected, tolerance = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => close(value, expected[index], tolerance));
}
function close(actual, expected, tolerance = 1e-9) {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= tolerance * scale, `${actual} != ${expected}`);
}
function add3(a, b) { return a.map((value, index) => value + b[index]); }
function scale3(a, factor) { return a.map((value) => value * factor); }
function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
