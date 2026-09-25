import assert from 'node:assert/strict';
import {
  MODEL_SCHEMA,
  QUALIFICATION_PROFILE,
} from '../../src/core/local-continuum/index.js';
import {
  canonicalProfile,
  defaultProfileFields,
  PROFILE_KINDS,
} from '../../src/core/lafea-profile-contract/index.js';
import {
  LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_PROFILE,
  LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
  createLafeaAnalysisGeometryEvidence,
} from '../../src/workspace/lafea-analysis-geometry-evidence.js';
import {
  LAFEA_ANALYSIS_GEOMETRY_ORIENTATION_POLICY,
  LAFEA_ANALYSIS_GEOMETRY_SCHEMA,
  createLafeaAnalysisGeometry,
} from '../../src/workspace/lafea-analysis-geometry-contract.js';
import {
  LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
  createLafeaContinuumAnalysisDomain,
} from '../../src/workspace/lafea-continuum-analysis-domain.js';
import { issueLafeaSourceAuthority } from '../../src/workspace/lafea-source-authority.js';
import { requireLafeaStageComposition } from '../../src/workspace/lafea-stage-composition-root.js';
import { createLafeaWorkbenchStore } from '../../src/workspace/lafea-workbench.js';
import {
  b02aProbeStableProfileIdentity,
  LAFEA_B02A_PROBE_STABLE_PROFILE_SOURCE_REVISION,
  b02bProbeStableProfileIdentity,
  LAFEA_B02B_PROBE_STABLE_PROFILE_SOURCE_REVISION,
} from '../../src/workspace/lafea-mesh-producer-binding.js';

const STAGE_ID = 'LAFEA.3';
const SHELL_ELEMENT = 'CST_DKT_TRI3_THIN_SHELL_V1';
const PHYSICAL_PROBE_SCHEMA = 'lafea-continuum-physical-probe/v1';


export function projectB02C3dCustody(stage) {
  const execution = stage?.execution;
  const currentness = stage?.currentness;
  const transaction = execution?.runTransactionReceipt ?? stage?.latestRunTransactionReceipt;
  const runtime = execution?.runtimeSolverDiagnostics;
  const recovery = stage?.lifecycle?.artifacts?.RECOVERY;

  assert.equal(execution?.status, 'QUALIFIED', 'C3-D custody requires qualified execution');
  assert.equal(currentness?.computationalState, 'CURRENT_RESULT');
  assert.equal(currentness?.currentAuthority, true);
  assert.equal(currentness?.exactCurrentParentChain, true);
  assert.equal(transaction?.status, 'COMPLETED');
  assert.equal(transaction?.executionHash, execution.compiledExecutionHash);
  assert.equal(transaction?.runtimeDiagnosticsHash, runtime?.semanticHash);
  assert.equal(recovery?.status, 'CURRENT');
  assert.equal(recovery?.qualification, 'PASS');

  const body = {
    schema: 'lafea-b02-c3d-custody/v1',
    complete: true,
    sourceHash: execution.sourceHash,
    analysisDomainHash: execution.analysisDomainHash,
    analysisGeometryHash: execution.analysisGeometryHash,
    meshProfileHash: execution.meshProfileHash,
    meshHash: execution.meshHash,
    projectionHash: execution.projectionHash,
    solverModelHash: execution.solverModelHash,
    solverConfigHash: transaction.solverConfigHash,
    canonicalExecutionInputHash: execution.canonicalExecutionInputHash,
    executionHash: execution.compiledExecutionHash,
    runtimeDiagnosticsHash: runtime.semanticHash,
    recoveryHash: recovery.artifactHash,
    transaction: Object.freeze({
      status: transaction.status,
      transactionHash: transaction.transactionHash,
      receiptHash: transaction.semanticHash,
      parents: transaction.parents,
    }),
    currentness: Object.freeze({
      computationalState: currentness.computationalState,
      qualificationState: currentness.qualificationState,
      currentAuthority: currentness.currentAuthority,
      exactCurrentParentChain: currentness.exactCurrentParentChain,
      blockingReasons: currentness.blockingReasons,
    }),
    runtimeSolverDiagnostics: runtime,
  };
  return Object.freeze(body);
}

export function executeB02RectangleProductionLevel(definition, method, level) {
  requireRectangleDefinition(definition);
  if (!['T3', 'T6', 'Q8'].includes(method)) throw new TypeError('LAFEA_B02_METHOD_INVALID');
  const source = sourceDocument(definition, method);
  const composition = requireLafeaStageComposition(STAGE_ID);
  const normalizedSource = composition.normalizeDocument(source);
  const authority = issueLafeaSourceAuthority(
    STAGE_ID,
    normalizedSource,
    `${definition.caseId}/PRODUCTION_ROUTE/${method}/${level.levelId}`,
  );
  const geometry = rectangleGeometry(definition);
  const domain = rectangleDomain(definition, authority.sourceHash, geometry);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
    stageId: STAGE_ID,
    sourceHash: authority.sourceHash,
    analysisDomain: domain,
    geometry,
    producerRef: `${definition.caseId}/FROZEN_RECTANGLE_GEOMETRY`,
    profileId: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_PROFILE,
  });
  const store = createLafeaWorkbenchStore({
    initialStage: STAGE_ID,
    initialDocument: normalizedSource,
    initialSourceHash: authority.sourceHash,
  });
  try {
    store.activateDomainFirstProfile();
    assert.equal(store.registerAnalysisDomain(domain).projection.state, 'CURRENT_PASS');
    assert.equal(store.registerAnalysisGeometryEvidence(geometryEvidence).projection.state, 'CURRENT_PASS');
    store.bindAnalysisMeshProfile(meshProfile(definition, method, level));
    const generated = store.generateAnalysisMesh();
    assert.equal(generated?.evidence?.qualification, 'PASS');
    assert.ok(generated.evidence.mesh.elements.length > 0);
    assert.equal(
      generated.evidence.mesh.elements.every((row) => row.elementType === method),
      true,
      `${definition.caseId}/${method}/${level.levelId} must retain the requested element family`,
    );
    const preflight = store.prepareContinuumForRun();
    assert.equal(preflight.projection.state, 'CURRENT_PASS');
    assert.equal(preflight.projection.usableForAuthorization, true);
    store.run();
    const stage = store.getState().stages[STAGE_ID];
    assert.equal(stage.execution?.status, 'QUALIFIED');
    assert.equal(stage.execution?.result?.qualification?.state, 'ACCEPTED');
    assert.equal(stage.execution?.releaseQualified, false);
    assert.equal(stage.lifecycle?.artifacts?.RECOVERY?.status, 'CURRENT');
    assert.equal(stage.lifecycle?.artifacts?.RECOVERY?.qualification, 'PASS');
    return {
      stage,
      probes: definition.fixedProbes.map((probe) => store.evaluateContinuumPhysicalProbe({
        schema: PHYSICAL_PROBE_SCHEMA,
        probeId: probe.probeId,
        physicalCoordinate: structuredClone(probe.physicalCoordinate),
        coordinateFrame: probe.coordinateFrame,
        loadCaseId: probe.loadCaseId,
        quantityId: probe.quantityId,
        representation: probe.representation,
        recoveryMethod: probe.recoveryMethod,
        units: probe.units,
        singularityClassification: probe.singularityClassification,
      })),
      meshEvidence: generated.evidence,
      preflight: stage.retainedContinuumPreflightEvidence,
      c3dCustody: projectB02C3dCustody(stage),
    };
  } finally {
    store.destroy();
  }
}

function sourceDocument(definition, method) {
  const x0 = definition.geometry.xMinimum;
  const x1 = definition.geometry.xMaximum;
  const y0 = definition.geometry.yMinimum;
  const y1 = definition.geometry.yMaximum;
  const caseIds = definition.loadCase ? [definition.loadCase.loadCaseId] : [];
  if (caseIds.length !== 1) throw new TypeError('LAFEA_B02_SINGLE_CASE_REQUIRED');
  return {
    schema: MODEL_SCHEMA,
    modelIdentity: `${definition.caseId}_DOMAIN_FIRST_SOURCE_${method}`,
    modelVersion: '1',
    sourceAncestry: {
      sourceModelIdentity: definition.caseId,
      sourceVersion: 'FROZEN_DEFINITION_V1',
      adapterIdentity: 'LAFEA_B02_DOMAIN_FIRST_PRODUCTION_ADAPTER',
      adapterVersion: '1',
    },
    units: { length: 'mm', force: 'N', stress: 'MPa', modulus: 'MPa' },
    formulation: definition.formulation,
    materials: [{
      materialId: 'MAT',
      elasticModulus: definition.material.elasticModulus,
      poissonRatio: definition.material.poissonRatio,
      sourceReference: `${definition.caseId}#MATERIAL`,
    }],
    nodes: [
      node('SRC-A', x0, y0), node('SRC-B', x1, y0),
      node('SRC-C', x1, y1), node('SRC-D', x0, y1),
    ],
    elements: [
      element('SRC-E1', ['SRC-A', 'SRC-B', 'SRC-D'], definition.geometry.thickness),
      element('SRC-E2', ['SRC-B', 'SRC-C', 'SRC-D'], definition.geometry.thickness),
    ],
    elementTypePolicy: {
      allowT3Fallback: true,
      sourceReference: `${definition.caseId}#DOMAIN_FIRST_SOURCE_PLACEHOLDER_NOT_MESH_AUTHORITY`,
    },
    constraints: [
      constraint('SRC-C1', 'SRC-A', 'UX'), constraint('SRC-C2', 'SRC-A', 'UY'),
      constraint('SRC-C3', 'SRC-D', 'UX'),
    ],
    loadCases: caseIds.map((loadCaseId) => ({
      loadCaseId,
      nodalForces: [], edgeTractions: [], pressureLoads: [], bodyForces: [],
      temperatureLoads: [], imposedDisplacements: [],
      sourceReference: `${definition.caseId}#${loadCaseId}/DOMAIN_FIRST_ATTACHMENT_AUTHORITY`,
    })),
    resultRequests: { loadCaseIds: caseIds },
    qualificationProfile: structuredClone(QUALIFICATION_PROFILE),
    limitations: ['B02_DOMAIN_FIRST_SOURCE_GEOMETRY_IS_NOT_ANALYSIS_MESH_AUTHORITY'],
  };
}

function rectangleGeometry(definition) {
  const { xMinimum: x0, xMaximum: x1, yMinimum: y0, yMaximum: y1 } = definition.geometry;
  return createLafeaAnalysisGeometry({
    schema: LAFEA_ANALYSIS_GEOMETRY_SCHEMA,
    stageId: STAGE_ID,
    geometryId: `${definition.caseId}-RECTANGLE`,
    coordinateSystemId: 'GLOBAL_XY',
    lengthUnit: 'mm',
    orientationPolicy: LAFEA_ANALYSIS_GEOMETRY_ORIENTATION_POLICY,
    vertices: [
      { vertexId: 'V-BL', x: x0, y: y0 },
      { vertexId: 'V-BR', x: x1, y: y0 },
      { vertexId: 'V-TR', x: x1, y: y1 },
      { vertexId: 'V-TL', x: x0, y: y1 },
    ],
    segments: [
      line('Y_MIN', 'V-BL', 'V-BR'),
      line('X_MAX', 'V-BR', 'V-TR'),
      line('Y_MAX', 'V-TR', 'V-TL'),
      line('X_MIN', 'V-TL', 'V-BL'),
    ],
    loops: [{
      loopId: 'OUTER', role: 'OUTER', segmentIds: ['Y_MIN', 'X_MAX', 'Y_MAX', 'X_MIN'],
    }],
  });
}

function rectangleDomain(definition, sourceHash, geometry) {
  const attachments = definition.loadCase.routeAttachmentSemantics.map((row, index) => {
    if (row.targetType !== 'EDGE') {
      throw new TypeError('LAFEA_B02_FROZEN_EDGE_SEMANTICS_REQUIRED');
    }
    if (!['X_MIN', 'X_MAX', 'Y_MIN', 'Y_MAX'].includes(row.boundary)) {
      throw new TypeError('LAFEA_B02_FROZEN_BOUNDARY_UNKNOWN');
    }
    return {
      attachmentId: `${definition.caseId}-A${index + 1}`,
      kind: row.kind,
      targetType: 'SEGMENT',
      targetId: row.boundary,
      physicalCaseIds: [definition.loadCase.loadCaseId],
      payload: structuredClone(row.payload),
    };
  });
  return createLafeaContinuumAnalysisDomain({
    schema: LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
    stageId: STAGE_ID,
    sourceHash,
    applicationRef: `${definition.caseId}/FROZEN_PRODUCTION_DOMAIN`,
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: definition.formulation,
    region: { regionId: 'REGION-1', materialRef: 'MAT' },
    physicalCases: [{ caseId: definition.loadCase.loadCaseId }],
    attachments,
  }, geometry);
}

function meshProfile(definition, method, level) {
  const defaults = defaultProfileFields(PROFILE_KINDS.MESH);
  const useB02aProbeStable = definition.caseId === 'B02A';
  const useB02bProbeStable = definition.caseId === 'B02B'
    || (definition.caseId === 'B02B-V2' && definition.supersedesCaseId === 'B02B');
  const profileIdentity = useB02aProbeStable
    ? b02aProbeStableProfileIdentity(method, level.targetElementLength)
    : useB02bProbeStable
      ? b02bProbeStableProfileIdentity(method, level.targetElementLength)
      : `${definition.caseId}_${method}_${level.levelId}_FROZEN_H`;
  const sourceRevision = useB02aProbeStable
    ? LAFEA_B02A_PROBE_STABLE_PROFILE_SOURCE_REVISION
    : useB02bProbeStable
      ? LAFEA_B02B_PROBE_STABLE_PROFILE_SOURCE_REVISION
      : 'B02-FROZEN-DEFINITION-V1';
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity,
    sourceRevision,
    semanticHash: undefined,
    fields: {
      ...defaults,
      continuumElement: method,
      shellElement: SHELL_ELEMENT,
      globalTargetSize: level.targetElementLength,
      adjacentSizeRatioMax: definition.meshLadder.commonRequestPolicy.growthLimit,
    },
  });
}

function requireRectangleDefinition(definition) {
  if (!definition || definition.stageId !== STAGE_ID || definition.geometry?.type !== 'RECTANGLE'
    || definition.definitionState !== 'FROZEN_BEFORE_PRODUCTION_OBSERVATION') {
    throw new TypeError('LAFEA_B02_RECTANGLE_DEFINITION_INVALID');
  }
  const { xMinimum, xMaximum, yMinimum, yMaximum, thickness } = definition.geometry;
  if (![xMinimum, xMaximum, yMinimum, yMaximum, thickness].every(Number.isFinite)
    || !(xMaximum > xMinimum) || !(yMaximum > yMinimum) || !(thickness > 0)) {
    throw new TypeError('LAFEA_B02_RECTANGLE_GEOMETRY_INVALID');
  }
}
function node(nodeId, x, y) { return { nodeId, x, y, sourceReference: `B02_SOURCE_NODE#${nodeId}` }; }
function element(elementId, nodeIds, thickness) { return { elementId, elementType: 'T3', nodeIds, materialId: 'MAT', thickness, sourceReference: `B02_SOURCE_ELEMENT#${elementId}` }; }
function constraint(constraintId, nodeId, dof) { return { constraintId, nodeId, dof, value: 0, sourceReference: `B02_SOURCE_CONSTRAINT#${constraintId}` }; }
function line(segmentId, startVertexId, endVertexId) { return { segmentId, type: 'LINE', startVertexId, endVertexId }; }
