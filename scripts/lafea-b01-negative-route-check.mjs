#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  FORMULATIONS,
  MODEL_SCHEMA,
  QUALIFICATION_PROFILE,
} from '../src/core/local-continuum/index.js';
import { canonicalLafeaSha256 } from '../src/workspace/lafea-canonical-sha256.js';
import { requireLafeaStageComposition } from '../src/workspace/lafea-stage-composition-root.js';
import { clone, triangleSource } from './lafea.3-fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B01 = path.join(ROOT, 'validation/lafea-benchmark-data/B01');
const NEGATIVE_FILE = path.join(B01, 'governance/negative-cases.json');
const DEFINITIONS = JSON.parse(fs.readFileSync(NEGATIVE_FILE, 'utf8'));
const COMPOSITION = requireLafeaStageComposition('LAFEA.3');
const args = parseArgs(process.argv.slice(2));

const selected = DEFINITIONS.cases.filter((row) => !args.negativeId || row.negativeId === args.negativeId);
if (!selected.length) throw new Error('No B01 negative cases selected.');

const gitHead = git(['rev-parse', 'HEAD']);
const cleanTreeAtStart = git(['status', '--porcelain=v1', '--untracked-files=all']) === '';
if (!cleanTreeAtStart && !args.allowDirty) throw new Error('B01 negative qualification requires a clean tree.');

const rows = selected.map(runNegative);
const failed = rows.filter((row) => row.status !== 'PASS');
const masterBase = {
  schema: 'lafea-b01-negative-master/v1',
  issue: 1100,
  stageId: 'LAFEA.3',
  gitHead,
  cleanTreeAtStart,
  negativeDefinitionSha256: shaFile(NEGATIVE_FILE),
  route: routeIdentity(),
  selectedRunCount: rows.length,
  passCount: rows.length - failed.length,
  failCount: failed.length,
  status: failed.length ? 'FAIL' : 'PASS',
  failedRuns: failed.map((row) => ({
    negativeId: row.negativeId,
    expectedFirstBoundary: row.expectedFirstBoundary,
    observedPhase: row.observedPhase,
    observedDiagnostic: row.observedDiagnostic,
    qualificationState: row.qualificationState,
    acceptedByRegisteredAcceptance: row.acceptedByRegisteredAcceptance,
    authorityLeak: row.authorityLeak,
    failureReason: row.failureReason,
  })),
  forbiddenAfterRejection: DEFINITIONS.forbiddenAfterRejection,
  releaseAuthorityGrantedByProgram: false,
};
const master = { ...masterBase, evidenceHash: canonicalLafeaSha256(masterBase) };

const reportDir = path.resolve(ROOT, args.reportDir ?? 'reports/qualification/B01/negative');
fs.mkdirSync(reportDir, { recursive: true });
for (const row of rows) write(path.join(reportDir, `${row.negativeId}.json`), row);
write(path.join(reportDir, 'B01-negative-master.json'), master);
console.log(JSON.stringify(master));
process.exit(master.status === 'PASS' ? 0 : 1);

function runNegative(definition) {
  if (definition.negativeId === 'NEG-STALE-RESULT') return staleResultCase(definition);
  const source = buildMutation(definition.negativeId);
  const mutationHash = safeHash(source);
  const observed = executeRegisteredRoute(source);
  const authorityLeak = Boolean(
    observed.qualificationState === 'ACCEPTED'
    || observed.acceptedByRegisteredAcceptance
    || observed.authoritativeResultPresent,
  );
  let pass = !authorityLeak && observed.rejected;
  let failureReason = pass ? null : 'Negative input remained authoritative or was not rejected.';
  let specialEvidence = null;

  if (definition.negativeId === 'NEG-INVERTED-T3') {
    const canonicalizedSafely = observed.acceptedByRegisteredAcceptance
      && observed.canonicalEvidence?.sourceConnectivityRetained === true
      && observed.canonicalEvidence?.sourceSignedAreaBeforeNormalization < 0
      && observed.canonicalEvidence?.canonicalSignedArea > 0
      && observed.canonicalEvidence?.sourceNodeIds?.join('|') !== observed.canonicalEvidence?.canonicalNodeIds?.join('|');
    pass = observed.rejected || canonicalizedSafely;
    failureReason = pass ? null : 'T3 inversion was canonicalized without governed before/after connectivity and negative source-geometry evidence.';
    specialEvidence = { canonicalizedSafely };
  }

  if (definition.negativeId === 'NEG-COINCIDENT-INTERFACE') {
    const governedClassification = !observed.acceptedByRegisteredAcceptance
      && observed.observedDiagnostic?.code === 'COINCIDENT_INDEPENDENT_INTERFACE_CLASSIFIED';
    pass = observed.rejected || governedClassification;
    failureReason = pass ? null : 'Coincident independent interface was accepted without a governed non-authoritative classification.';
    specialEvidence = { governedClassification };
  }

  if (definition.negativeId === 'NEG-DISCONNECTED-ISLAND') {
    const governedMultiComponent = observed.acceptedByRegisteredAcceptance
      && observed.governance?.multiComponentCapability === true;
    pass = observed.rejected || governedMultiComponent;
    failureReason = pass ? null : 'Disconnected component was accepted without governed multi-component capability.';
    specialEvidence = { governedMultiComponent };
  }

  return {
    schema: 'lafea-b01-negative-receipt/v1',
    issue: 1100,
    negativeId: definition.negativeId,
    mutation: definition.mutation,
    expectedFirstBoundary: definition.firstBoundary,
    required: definition.required,
    gitHead,
    mutationSemanticHash: mutationHash,
    observedPhase: observed.observedPhase,
    observedDiagnostic: observed.observedDiagnostic,
    qualificationState: observed.qualificationState,
    acceptedByRegisteredAcceptance: observed.acceptedByRegisteredAcceptance,
    authoritativeResultPresent: observed.authoritativeResultPresent,
    authorityLeak,
    canonicalModelSemanticHash: observed.canonicalModelSemanticHash,
    resultSemanticHash: observed.resultSemanticHash,
    canonicalEvidence: observed.canonicalEvidence,
    isoparametricGeometry: observed.isoparametricGeometry,
    specialEvidence,
    status: pass ? 'PASS' : 'FAIL',
    failureReason,
    releaseAuthorityGrantedByProgram: false,
  };
}

function staleResultCase(definition) {
  const original = triangleSource();
  original.modelIdentity = 'B01_NEG_STALE';
  original.resultRequests = { loadCaseIds: ['L1'] };
  const initial = executeRegisteredRoute(original);
  const changed = clone(original);
  changed.modelVersion = '2';
  changed.materials[0].elasticModulus = 175000;
  const changedObservation = normalizeAndCanonicalize(changed);
  const sourceChanged = Boolean(
    initial.canonicalModelSemanticHash
    && changedObservation.canonicalModelSemanticHash
    && initial.canonicalModelSemanticHash !== changedObservation.canonicalModelSemanticHash,
  );
  const staleStillAccepted = Boolean(initial.rawResult && COMPOSITION.acceptResult(initial.rawResult));
  const explicitInvalidationSurfaceObserved = false;
  const pass = initial.acceptedByRegisteredAcceptance
    && sourceChanged
    && explicitInvalidationSurfaceObserved
    && !staleStillAccepted;
  return {
    schema: 'lafea-b01-negative-receipt/v1',
    issue: 1100,
    negativeId: definition.negativeId,
    mutation: definition.mutation,
    expectedFirstBoundary: definition.firstBoundary,
    required: definition.required,
    gitHead,
    mutationSemanticHash: safeHash({
      before: safeHash(original),
      after: safeHash(changed),
    }),
    observedPhase: 'AUTHORITY_CURRENTNESS',
    observedDiagnostic: pass ? null : {
      code: 'STALE_RESULT_AUTHORITY_NOT_INVALIDATED',
      path: 'registered acceptance/currentness',
      message: 'A previously accepted result remains accepted after source mutation; no repository currentness/invalidation surface tied to the changed canonical source hash was observed.',
    },
    qualificationState: initial.qualificationState,
    acceptedByRegisteredAcceptance: initial.acceptedByRegisteredAcceptance,
    authoritativeResultPresent: initial.authoritativeResultPresent,
    authorityLeak: staleStillAccepted,
    canonicalModelSemanticHash: initial.canonicalModelSemanticHash,
    changedCanonicalModelSemanticHash: changedObservation.canonicalModelSemanticHash,
    sourceChanged,
    staleStillAccepted,
    explicitInvalidationSurfaceObserved,
    status: pass ? 'PASS' : 'FAIL',
    failureReason: pass ? null : 'Current authority is not invalidated after source mutation.',
    releaseAuthorityGrantedByProgram: false,
  };
}

function executeRegisteredRoute(source) {
  let normalized;
  let model;
  let result;
  try {
    normalized = COMPOSITION.normalizeDocument(source);
  } catch (error) {
    return rejection('SOURCE_NORMALIZATION', error);
  }
  try {
    model = COMPOSITION.canonicalize(normalized);
  } catch (error) {
    return rejection('CANONICALIZATION', error);
  }
  const canonicalEvidence = t3OrientationEvidence(source, model);
  try {
    result = COMPOSITION.calculate(model);
  } catch (error) {
    return {
      ...rejection('REGISTERED_CALCULATION_THROW', error),
      canonicalModelSemanticHash: model.semanticHash,
      canonicalEvidence,
    };
  }
  const accepted = COMPOSITION.acceptResult(result);
  const isoparametricGeometry = result?.meshEvidence?.elementEvidence
    ?.map((row) => row?.isoparametricGeometry)
    .find(Boolean) ?? null;
  return {
    observedPhase: accepted ? 'REGISTERED_ACCEPTANCE' : 'REGISTERED_CALCULATION_REJECTION',
    observedDiagnostic: result?.diagnostics?.[0] ?? null,
    qualificationState: result?.qualification?.state ?? null,
    acceptedByRegisteredAcceptance: accepted,
    authoritativeResultPresent: accepted && Array.isArray(result?.loadCaseResults),
    rejected: !accepted && result?.qualification?.state !== 'ACCEPTED',
    canonicalModelSemanticHash: model.semanticHash,
    resultSemanticHash: safeHash(result),
    canonicalEvidence,
    isoparametricGeometry,
    rawResult: result,
  };
}

function normalizeAndCanonicalize(source) {
  try {
    const normalized = COMPOSITION.normalizeDocument(source);
    const model = COMPOSITION.canonicalize(normalized);
    return { canonicalModelSemanticHash: model.semanticHash };
  } catch (error) {
    return { canonicalModelSemanticHash: null, error: normalizeError(error) };
  }
}

function rejection(phase, error) {
  return {
    observedPhase: phase,
    observedDiagnostic: normalizeError(error),
    qualificationState: null,
    acceptedByRegisteredAcceptance: false,
    authoritativeResultPresent: false,
    rejected: true,
    canonicalModelSemanticHash: null,
    resultSemanticHash: null,
    canonicalEvidence: null,
    isoparametricGeometry: null,
    rawResult: null,
  };
}

function t3OrientationEvidence(source, model) {
  const sourceElement = source.elements?.find((row) => row.elementType === 'T3');
  if (!sourceElement || source.modelIdentity !== 'B01_NEG_INVERTED_T3') return null;
  const nodeMap = new Map(source.nodes.map((row) => [row.nodeId, row]));
  const sourceArea = signedPolygonArea(sourceElement.nodeIds.map((id) => nodeMap.get(id)));
  const canonicalElement = model.elements?.find((row) => row.elementId === sourceElement.elementId);
  const canonicalNodeMap = new Map(model.nodes.map((row) => [row.nodeId, row]));
  const canonicalArea = canonicalElement
    ? signedPolygonArea(canonicalElement.nodeIds.map((id) => canonicalNodeMap.get(id)))
    : null;
  return {
    sourceNodeIds: [...sourceElement.nodeIds],
    canonicalNodeIds: canonicalElement ? [...canonicalElement.nodeIds] : null,
    sourceSignedAreaBeforeNormalization: sourceArea,
    canonicalSignedArea: canonicalArea,
    sourceConnectivityRetained: Boolean(
      canonicalElement
      && (Array.isArray(canonicalElement.sourceNodeIds)
        || Array.isArray(canonicalElement.nodeIdsBeforeNormalization)
        || canonicalElement.signedAreaBeforeNormalization < 0)
    ),
  };
}

function buildMutation(negativeId) {
  switch (negativeId) {
    case 'NEG-NONFINITE-E': {
      const source = triangleSource();
      source.modelIdentity = 'B01_NEG_NONFINITE_E';
      source.materials[0].elasticModulus = Infinity;
      return source;
    }
    case 'NEG-PE-NU-0P5': {
      const source = triangleSource({ formulation: FORMULATIONS.PLANE_STRAIN });
      source.modelIdentity = 'B01_NEG_NU_0P5';
      source.materials[0].poissonRatio = 0.5;
      return source;
    }
    case 'NEG-THICKNESS-ZERO': {
      const source = triangleSource({ thickness: 0 });
      source.modelIdentity = 'B01_NEG_THICKNESS_ZERO';
      return source;
    }
    case 'NEG-THICKNESS-NEG': {
      const source = triangleSource({ thickness: -1 });
      source.modelIdentity = 'B01_NEG_THICKNESS_NEG';
      return source;
    }
    case 'NEG-INVERTED-T3': {
      const source = triangleSource({ clockwise: true });
      source.modelIdentity = 'B01_NEG_INVERTED_T3';
      source.resultRequests = { loadCaseIds: ['L1'] };
      return source;
    }
    case 'NEG-INVERTED-T6':
      return fullyPrescribedElementSource('B01_NEG_INVERTED_T6', 'T6', t6Nodes(), ['A', 'C', 'B', 'CA', 'BC', 'AB']);
    case 'NEG-INVERTED-Q8':
      return fullyPrescribedElementSource('B01_NEG_INVERTED_Q8', 'Q8', q8Nodes(), ['A', 'D', 'C', 'B', 'DA', 'CD', 'BC', 'AB']);
    case 'NEG-DUPLICATE-NODE': {
      const source = triangleSource();
      source.modelIdentity = 'B01_NEG_DUPLICATE_NODE';
      source.nodes.push({ ...source.nodes[0], sourceReference: 'DUPLICATE#A' });
      source.resultRequests = { loadCaseIds: ['L1'] };
      return source;
    }
    case 'NEG-DISCONNECTED-ISLAND':
      return disconnectedSource();
    case 'NEG-COINCIDENT-INTERFACE':
      return coincidentInterfaceSource();
    case 'NEG-T6-MIDSIDE': {
      const nodes = t6Nodes();
      nodes.find((row) => row.nodeId === 'AB').y = 0.2;
      return fullyPrescribedElementSource('B01_NEG_T6_MIDSIDE', 'T6', nodes, ['A', 'B', 'C', 'AB', 'BC', 'CA']);
    }
    case 'NEG-Q8-MIDSIDE': {
      const nodes = q8Nodes();
      nodes.find((row) => row.nodeId === 'AB').y = 0.2;
      return fullyPrescribedElementSource('B01_NEG_Q8_MIDSIDE', 'Q8', nodes, ['A', 'B', 'C', 'D', 'AB', 'BC', 'CD', 'DA']);
    }
    case 'NEG-MECHANISM': {
      const source = triangleSource();
      source.modelIdentity = 'B01_NEG_MECHANISM';
      source.constraints = [];
      source.resultRequests = { loadCaseIds: ['L1'] };
      return source;
    }
    case 'NEG-FORMULATION': {
      const source = triangleSource();
      source.modelIdentity = 'B01_NEG_FORMULATION';
      source.formulation = 'UNREGISTERED_B01_FORMULATION';
      source.resultRequests = { loadCaseIds: ['L1'] };
      return source;
    }
    case 'NEG-Q4-PRODUCTION': {
      const source = fullyPrescribedElementSource('B01_NEG_Q4', 'T3', q8Nodes().slice(0, 4), ['A', 'B', 'C']);
      source.elements[0].elementType = 'Q4';
      source.elements[0].nodeIds = ['A', 'B', 'C', 'D'];
      source.elementTypePolicy.allowT3Fallback = false;
      return source;
    }
    default:
      throw new Error(`Unknown B01 negative ${negativeId}.`);
  }
}

function disconnectedSource() {
  const nodes = [
    node('A', 0, 0), node('B', 1, 0), node('C', 0, 1),
    node('D', 10, 0), node('E', 11, 0), node('F', 10, 1),
  ];
  return sourceFromParts(
    'B01_NEG_DISCONNECTED_ISLAND', nodes,
    [element('E1', 'T3', ['A', 'B', 'C']), element('E2', 'T3', ['D', 'E', 'F'])],
    true,
  );
}

function coincidentInterfaceSource() {
  const nodes = [
    node('A', 0, 0), node('B1', 1, 0), node('C1', 1, 1),
    node('B2', 1, 0), node('C2', 1, 1), node('D', 2, 0), node('E', 2, 1),
  ];
  return sourceFromParts(
    'B01_NEG_COINCIDENT_INTERFACE', nodes,
    [
      element('E1', 'T3', ['A', 'B1', 'C1']),
      element('E2', 'T3', ['B2', 'D', 'C2']),
      element('E3', 'T3', ['D', 'E', 'C2']),
    ],
    true,
  );
}

function fullyPrescribedElementSource(modelIdentity, family, nodes, nodeIds) {
  return sourceFromParts(modelIdentity, nodes, [element('E1', family, nodeIds)], family === 'T3');
}

function sourceFromParts(modelIdentity, nodes, elements, allowT3Fallback) {
  const imposedDisplacements = nodes.flatMap((row) => [
    { imposedDisplacementId: `${row.nodeId}-UX`, nodeId: row.nodeId, dof: 'UX', value: 0, sourceReference: `NEG#${row.nodeId}#UX` },
    { imposedDisplacementId: `${row.nodeId}-UY`, nodeId: row.nodeId, dof: 'UY', value: 0, sourceReference: `NEG#${row.nodeId}#UY` },
  ]);
  return {
    schema: MODEL_SCHEMA,
    modelIdentity,
    modelVersion: '1',
    sourceAncestry: { sourceModelIdentity: modelIdentity, sourceVersion: '1', adapterIdentity: 'LAFEA3_B01_NEGATIVE', adapterVersion: '1' },
    units: { length: 'mm', force: 'N', stress: 'MPa', modulus: 'MPa' },
    formulation: FORMULATIONS.PLANE_STRESS,
    materials: [{ materialId: 'MAT', elasticModulus: 200000, poissonRatio: 0.3, sourceReference: 'NEG#MAT' }],
    nodes,
    elements,
    elementTypePolicy: { allowT3Fallback, sourceReference: allowT3Fallback ? 'NEG#T3_FALLBACK' : 'NEG#PRODUCTION_QUADRATIC' },
    constraints: [],
    loadCases: [{
      loadCaseId: 'NEG', nodalForces: [], edgeTractions: [], pressureLoads: [], bodyForces: [], temperatureLoads: [], imposedDisplacements,
      sourceReference: `NEG#${modelIdentity}`,
    }],
    resultRequests: { loadCaseIds: ['NEG'] },
    qualificationProfile: JSON.parse(JSON.stringify(QUALIFICATION_PROFILE)),
    limitations: ['B01_NEGATIVE_QUALIFICATION_ONLY', 'NO_RELEASE_AUTHORITY_FROM_B01'],
  };
}

function t6Nodes() {
  return [
    node('A', 0, 0), node('B', 2, 0), node('C', 0, 2),
    node('AB', 1, 0), node('BC', 1, 1), node('CA', 0, 1),
  ];
}

function q8Nodes() {
  return [
    node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2),
    node('AB', 1, 0), node('BC', 2, 1), node('CD', 1, 2), node('DA', 0, 1),
  ];
}

function node(nodeId, x, y) {
  return { nodeId, x, y, sourceReference: `NEG#NODE#${nodeId}` };
}
function element(elementId, elementType, nodeIds) {
  return { elementId, elementType, nodeIds, materialId: 'MAT', thickness: 1, sourceReference: `NEG#ELEMENT#${elementId}` };
}

function signedPolygonArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const left = points[index];
    const right = points[(index + 1) % points.length];
    sum += left.x * right.y - right.x * left.y;
  }
  return sum / 2;
}

function routeIdentity() {
  return {
    compositionRootId: COMPOSITION.compositionRootId,
    registryAuthority: COMPOSITION.registryEntry.authority,
    enginePackage: COMPOSITION.registryEntry.enginePackage,
    sequence: ['normalizeDocument', 'canonicalize', 'calculate', 'acceptResult'],
  };
}

function normalizeError(error) {
  return {
    code: error?.code ?? error?.name ?? 'ERROR',
    path: error?.path ?? null,
    message: error instanceof Error ? error.message : String(error),
  };
}
function safeHash(value) {
  try {
    return canonicalLafeaSha256(value);
  } catch {
    const text = JSON.stringify(value, (_key, item) => (
      typeof item === 'number' && !Number.isFinite(item) ? String(item) : item
    ));
    return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
  }
}
function shaFile(file) { return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`; }
function write(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function parseArgs(values) {
  const output = { allowDirty: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--allow-dirty') output.allowDirty = true;
    else if (value === '--negative') output.negativeId = values[++index];
    else if (value === '--report-dir') output.reportDir = values[++index];
    else throw new Error(`Unknown argument ${value}.`);
  }
  return output;
}
function git(parameters) { return execFileSync('git', parameters, { cwd: ROOT, encoding: 'utf8' }).trim(); }
