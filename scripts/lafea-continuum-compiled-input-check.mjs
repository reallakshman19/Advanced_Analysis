#!/usr/bin/env node
import assert from 'node:assert/strict';
import { MODEL_SCHEMA } from '../src/core/local-continuum/index.js';
import {
  buildLafeaContinuumCompiledExecutionInput,
} from '../src/workspace/lafea-continuum-compiled-input.js';

const model = compiledFixture();
const input = buildLafeaContinuumCompiledExecutionInput(model);

assert.equal(input.schema, MODEL_SCHEMA);
assert.equal(input.modelIdentity, 'COMPILED-INPUT-FIXTURE');
assert.equal(input.modelVersion, '1');
assert.deepEqual(input.elementTypePolicy, { allowT3Fallback: true, sourceReference: 'STAGE12B/TEST' });
assert.equal(input.materials.length, 1);
assert.equal(input.nodes.length, 3);
assert.equal(input.elements.length, 1);
assert.equal(input.elements[0].thickness, 10);
assert.equal(input.constraints.length, 4);
assert.deepEqual(
  input.constraints.map(({ nodeId, dof, value }) => ({ nodeId, dof, value })),
  [
    { nodeId: 'A', dof: 'UX', value: 0 },
    { nodeId: 'A', dof: 'UY', value: 0 },
    { nodeId: 'B', dof: 'UX', value: 0 },
    { nodeId: 'B', dof: 'UY', value: 0 },
  ],
);

const l1 = input.loadCases.find((row) => row.loadCaseId === 'L1');
const l2 = input.loadCases.find((row) => row.loadCaseId === 'L2');
assert.ok(l1 && l2);
assert.deepEqual(l1.imposedDisplacements.map(({ nodeId, dof, value }) => ({ nodeId, dof, value })), [
  { nodeId: 'B', dof: 'UX', value: 0.25 },
  { nodeId: 'C', dof: 'UX', value: 0.25 },
]);
assert.deepEqual(l1.nodalForces.map(({ loadId, nodeId, fx, fy }) => ({ loadId, nodeId, fx, fy })), [
  { loadId: 'F1', nodeId: 'B', fx: 1000, fy: -250 },
]);
assert.deepEqual(l1.edgeTractions.map(({ tractionId, elementId, edgeNodeIds, tx, ty }) => ({
  tractionId, elementId, edgeNodeIds, tx, ty,
})), [
  { tractionId: 'T1/1', elementId: 'E1', edgeNodeIds: ['B', 'C'], tx: 2, ty: 3 },
]);
assert.deepEqual(l2.pressureLoads, [], 'ordinary source pressure must lower before the kernel pressure schema');
const pressureForces = l2.nodalForces.filter((row) =>
  row.sourceReference.startsWith('COMPILED_SOURCE_PRESSURE#P1/ANALYSIS_GEOMETRY_ORIENTED_SEGMENT_V1/'));
assert.equal(pressureForces.length, 2);
assert.deepEqual(pressureForces.map(({ loadId, nodeId }) => ({ loadId, nodeId })), [
  { loadId: 'P1/1/1/C', nodeId: 'C' },
  { loadId: 'P1/1/2/A', nodeId: 'A' },
]);
for (const row of pressureForces) {
  close(row.fx, 2000, 1e-9, `${row.nodeId} source-pressure fx`);
  close(row.fy, 0, 1e-12, `${row.nodeId} source-pressure fy`);
}
assert.deepEqual(l2.bodyForces.map(({ bodyForceId, elementId, bx, by }) => ({
  bodyForceId, elementId, bx, by,
})), [
  { bodyForceId: 'BF1/E1', elementId: 'E1', bx: 0.5, by: -0.25 },
]);
assert.deepEqual(input.resultRequests, { loadCaseIds: ['L1', 'L2'] });
assert.ok(input.limitations.includes('DOMAIN_FIRST_COMPILED_PARITY_EXECUTION_ONLY'));
assert.ok(input.limitations.includes('SOURCE_NORMAL_PRESSURE_CONSISTENT_NODAL_LOWERING_V1'));

const badEdgeOwnership = clone(model);
badEdgeOwnership.attachments.find((row) => row.attachmentId === 'T1').compiledTarget.elementIds = [];
expectCode(
  () => buildLafeaContinuumCompiledExecutionInput(badEdgeOwnership),
  'LAFEA_CONTINUUM_COMPILED_EDGE_OWNER_MAPPING_INVALID',
);

const badForceMapping = clone(model);
badForceMapping.attachments.find((row) => row.attachmentId === 'F1').compiledTarget.nodeIds = ['A', 'B'];
expectCode(
  () => buildLafeaContinuumCompiledExecutionInput(badForceMapping),
  'LAFEA_CONTINUUM_COMPILED_FORCE_VERTEX_MAPPING_INVALID',
);

const missingPressureProjection = clone(model);
delete missingPressureProjection.projectionEvidence;
expectCode(
  () => buildLafeaContinuumCompiledExecutionInput(missingPressureProjection),
  'LAFEA_CONTINUUM_COMPILED_SOURCE_PRESSURE_PROJECTION_REQUIRED',
);

const unsupportedBodyForceUnit = clone(model);
unsupportedBodyForceUnit.attachments.find((row) => row.attachmentId === 'BF1').payload.unit = 'kg/m^3';
expectCode(
  () => buildLafeaContinuumCompiledExecutionInput(unsupportedBodyForceUnit),
  'LAFEA_CONTINUUM_COMPILED_BODY_FORCE_UNIT_UNSUPPORTED',
);

const temperature = clone(model);
temperature.attachments.push(attachment(
  'TEMP', 'TEMPERATURE', 'REGION', 'REGION-1', ['L1'],
  { value: 50, unit: 'C' },
  target('REGION', 'REGION-1', [], [], ['E1']),
));
expectCode(
  () => buildLafeaContinuumCompiledExecutionInput(temperature),
  'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_SEMANTICS_NOT_QUALIFIED',
);

console.log(JSON.stringify({
  schema: 'lafea-continuum-compiled-input-check/v2',
  check: 'lafea-continuum-compiled-input',
  status: 'PASS',
  stageId: 'LAFEA.3',
  restraintLoweringCovered: true,
  imposedDisplacementLoweringCovered: true,
  concentratedLoadLoweringCovered: true,
  tractionLoweringCovered: true,
  sourceNormalPressureLoweringCovered: true,
  sourcePressureProjectionRequired: true,
  bodyForceLoweringCovered: true,
  edgeOwnershipFailsClosed: true,
  forceVertexMappingFailsClosed: true,
  bodyForceUnitsFailClosed: true,
  temperatureSemanticsFailClosed: true,
  solverExecuted: false,
  releaseAuthorityChanged: false,
}));

function compiledFixture() {
  return {
    solverModelHash: `sha256:${'a'.repeat(64)}`,
    sourceModel: {
      modelIdentity: 'COMPILED-INPUT-FIXTURE', modelVersion: '1',
      sourceAncestry: {
        sourceModelIdentity: 'FIXTURE', sourceVersion: '1',
        adapterIdentity: 'STAGE12B_TEST', adapterVersion: '1',
      },
      elementTypePolicy: { allowT3Fallback: true, sourceReference: 'STAGE12B/TEST' },
    },
    units: { length: 'mm', force: 'N', stress: 'MPa', modulus: 'MPa' },
    declaredUnits: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: 'PLANE_STRESS',
    materials: [{ materialId: 'MAT', elasticModulus: 200000, poissonRatio: 0.3 }],
    sections: [{ sectionId: 'SEC', thickness: 10 }],
    nodes: [node('A', 0, 0), node('B', 100, 0), node('C', 0, 100)],
    elements: [{
      elementId: 'E1', elementType: 'T3', nodeIds: ['A', 'B', 'C'],
      materialId: 'MAT', sectionId: 'SEC',
    }],
    physicalCases: [{ caseId: 'L1' }, { caseId: 'L2' }],
    attachments: [
      attachment('FIX', 'RESTRAINT', 'SEGMENT', 'S1', ['L1', 'L2'],
        { ux: true, uy: true }, target('SEGMENT', 'S1', ['A', 'B'], [['A', 'B']], ['E1'])),
      attachment('U1', 'IMPOSED_DISPLACEMENT', 'SEGMENT', 'S2', ['L1'],
        { ux: 0.25, unit: 'mm' }, target('SEGMENT', 'S2', ['B', 'C'], [['B', 'C']], ['E1'])),
      attachment('F1', 'CONCENTRATED_LOAD', 'VERTEX', 'B', ['L1'],
        { fx: 1, fy: -0.25, unit: 'kN' }, target('VERTEX', 'B', ['B'], [], [])),
      attachment('T1', 'TRACTION', 'SEGMENT', 'S2', ['L1'],
        { tx: 2, ty: 3, unit: 'MPa' }, target('SEGMENT', 'S2', ['B', 'C'], [['B', 'C']], ['E1'])),
      attachment('P1', 'PRESSURE', 'SEGMENT', 'S3', ['L2'],
        { pressure: 4, unit: 'MPa' }, target('SEGMENT', 'S3', ['C', 'A'], [['C', 'A']], ['E1'])),
      attachment('BF1', 'BODY_FORCE', 'REGION', 'REGION-1', ['L2'],
        { bx: 0.5, by: -0.25, unit: 'N/mm^3' }, target('REGION', 'REGION-1', [], [], ['E1'])),
    ],
    projectionEvidence: {
      entries: [{
        attachmentId: 'P1',
        sourceFeature: {
          targetType: 'SEGMENT', featureId: 'S3',
          geometry: {
            segmentId: 'S3', type: 'LINE', startVertexId: 'C', endVertexId: 'A',
            start: { x: 0, y: 100 }, end: { x: 0, y: 0 },
            loopBindings: [{ loopId: 'OUTER', role: 'OUTER' }],
          },
        },
      }],
    },
    requestedCaseIds: ['L1', 'L2'],
    qualificationProfile: { profileIdentity: 'STAGE12B-COMPILED-INPUT' },
    limitations: [],
  };
}

function attachment(attachmentId, kind, targetType, targetId, physicalCaseIds, payload, compiledTarget) {
  return { attachmentId, kind, targetType, targetId, physicalCaseIds, payload, compiledTarget };
}
function target(targetType, featureId, nodeIds, edgeNodePaths, elementIds) {
  return { targetType, featureId, nodeIds, edgeNodePaths, elementIds };
}
function node(nodeId, x, y) { return { nodeId, x, y }; }
function clone(value) { return structuredClone(value); }
function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}, tolerance ${tolerance}`);
}
function expectCode(action, code) {
  assert.throws(action, (error) => error?.code === code, `expected ${code}`);
}
