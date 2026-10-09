import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import { validateLafeaAnalysisMeshEvidenceV2 } from './lafea-analysis-mesh-evidence-v2.js';
import {
  LAFEA_SHELL_SURFACE_KINDS,
  shellMidsurfaceKind,
  validateLafeaAnyShellMidsurfaceEvidence,
} from './lafea-shell-midsurface-dispatch.js';
import { cylindricalShellUvAtPoint3d } from './lafea-shell-curved-midsurface-contract.js';
import { curvedHoleShellUvAtPoint3d } from './lafea-shell-curved-hole-midsurface-contract.js';

export const LAFEA4_PARENT_NORMAL_QUALIFICATION_SCHEMA =
  'lafea4-shell-parent-normal-qualification/v1';
export const LAFEA4_PARENT_NORMAL_CRITERION =
  'MIN_PARENT_DIRECTED_SURFACE_JACOBIAN_STRICTLY_POSITIVE_OVER_ELEMENT_U_INTERVAL_V1';
export const LAFEA4_PARENT_NORMAL_ROUNDOFF_POLICY =
  'FAIL_CLOSED_128_EPSILON_TIMES_FACET_JACOBIAN_MAGNITUDE_V1';

const SHELL_TRI3 = 'CST_DKT_TRI3_THIN_SHELL_V1';
const ROUND_OFF_FACTOR = 128;
const SUPPORTED_SURFACES = new Set([
  LAFEA_SHELL_SURFACE_KINDS.CYLINDRICAL,
  LAFEA_SHELL_SURFACE_KINDS.CYLINDRICAL_HOLES,
]);
const OUTPUT_KEYS = Object.freeze([
  'schema', 'stageId', 'criterion', 'roundoffPolicy', 'sourceHash',
  'analysisDomainHash', 'analysisGeometryHash', 'meshArtifactHash', 'meshHash',
  'meshProfileHash', 'midsurfaceEvidenceHash', 'surfaceKind', 'lengthUnit',
  'elementCount', 'minimumParentDirectedJacobian', 'minimumAlignmentCosine',
  'blockedElementCount', 'negativeElementCount', 'roundoffBandElementCount',
  'blockingElementIds', 'witness', 'qualification', 'productionBindingAuthorized',
  'releaseQualified', 'semanticHash',
]);

/**
 * Candidate hard qualification for LAFEA.4 cylindrical TRI3 shell orientation.
 *
 * For one affine facet J = (x2-x1) x (x3-x1) is constant. On a cylindrical
 * parent the analytic director is
 *
 *   n(theta) = r0 cos(theta) + t0 sin(theta), theta = u/R,
 *
 * so J.n(theta) = a cos(theta) + b sin(theta). The exact minimum over the
 * element's complete nodal u interval is obtained from both interval endpoints
 * plus every stationary point phi+k*pi inside that interval. This avoids the
 * centroid-only blind spot exposed by a 180-degree facet.
 *
 * Engineering criterion: min J.n(theta) > 0. The epsilon band below is not an
 * engineering threshold; it is a fail-closed floating-point classification of
 * values numerically indistinguishable from zero.
 */
export function qualifyLafea4ShellParentNormalOrientation({
  meshEvidence,
  midsurfaceEvidence,
}) {
  const retained = validateLafeaAnalysisMeshEvidenceV2(meshEvidence);
  const midsurface = validateLafeaAnyShellMidsurfaceEvidence(midsurfaceEvidence);
  requireParents(retained, midsurface);
  const surfaceKind = shellMidsurfaceKind(midsurface.geometry);
  if (!SUPPORTED_SURFACES.has(surfaceKind)) {
    fail('LAFEA4_PARENT_NORMAL_SURFACE_NOT_QUALIFIED');
  }
  const geometry = midsurface.geometry;
  const nodeById = new Map(retained.mesh.nodes.map((node) => [node.nodeId, node]));
  const uvByNodeId = new Map(retained.mesh.nodes.map((node) => [
    node.nodeId,
    uvAt(surfaceKind, geometry, node),
  ]));
  const rows = retained.mesh.elements.map((element) => qualifyElement(
    element, nodeById, uvByNodeId, geometry,
  ));
  if (!rows.length) fail('LAFEA4_PARENT_NORMAL_ELEMENTS_REQUIRED');

  rows.sort((left, right) => left.minimumParentDirectedJacobian - right.minimumParentDirectedJacobian
    || left.elementId.localeCompare(right.elementId));
  const witnessRow = rows[0];
  const blockedRows = rows.filter((row) => row.status === 'BLOCK');
  const negativeRows = rows.filter((row) => row.classification === 'NEGATIVE');
  const roundoffRows = rows.filter((row) => row.classification === 'ZERO_OR_ROUNDOFF_BAND');
  const blockingElementIds = blockedRows.map((row) => row.elementId).sort();
  const qualification = blockedRows.length ? 'BLOCK' : 'PASS';
  const lengthUnit = String(geometry.lengthUnit ?? '').trim();
  if (!lengthUnit) fail('LAFEA4_PARENT_NORMAL_LENGTH_UNIT_REQUIRED');

  const core = {
    schema: LAFEA4_PARENT_NORMAL_QUALIFICATION_SCHEMA,
    stageId: 'LAFEA.4',
    criterion: LAFEA4_PARENT_NORMAL_CRITERION,
    roundoffPolicy: LAFEA4_PARENT_NORMAL_ROUNDOFF_POLICY,
    sourceHash: retained.sourceHash,
    analysisDomainHash: retained.analysisDomainHash,
    analysisGeometryHash: retained.analysisGeometryHash,
    meshArtifactHash: retained.artifactHash,
    meshHash: retained.meshHash,
    meshProfileHash: retained.meshProfileHash,
    midsurfaceEvidenceHash: midsurface.semanticHash,
    surfaceKind,
    lengthUnit,
    elementCount: rows.length,
    minimumParentDirectedJacobian: witnessRow.minimumParentDirectedJacobian,
    minimumAlignmentCosine: Math.min(...rows.map((row) => row.minimumAlignmentCosine)),
    blockedElementCount: blockedRows.length,
    negativeElementCount: negativeRows.length,
    roundoffBandElementCount: roundoffRows.length,
    blockingElementIds: freeze(blockingElementIds),
    witness: freeze({
      elementId: witnessRow.elementId,
      nodeIds: witnessRow.nodeIds,
      uMinimum: witnessRow.uMinimum,
      uMaximum: witnessRow.uMaximum,
      angularSpanDegrees: witnessRow.angularSpanDegrees,
      evaluationU: witnessRow.witness.u,
      evaluationKind: witnessRow.witness.kind,
      signedSurfaceJacobian: witnessRow.minimumParentDirectedJacobian,
      alignmentCosine: witnessRow.minimumAlignmentCosine,
      roundoffEnvelope: witnessRow.roundoffEnvelope,
      classification: witnessRow.classification,
    }),
    qualification,
    productionBindingAuthorized: false,
    releaseQualified: false,
  };
  return freeze({
    ...core,
    semanticHash: canonicalLafeaSha256({
      schema: 'lafea4-shell-parent-normal-qualification-hash-input/v1',
      qualification: core,
    }),
  });
}

export function validateLafea4ShellParentNormalQualification(value) {
  exactKeys(value, OUTPUT_KEYS, 'LAFEA4_PARENT_NORMAL_KEYS_INVALID');
  if (value.schema !== LAFEA4_PARENT_NORMAL_QUALIFICATION_SCHEMA
    || value.stageId !== 'LAFEA.4'
    || value.criterion !== LAFEA4_PARENT_NORMAL_CRITERION
    || value.roundoffPolicy !== LAFEA4_PARENT_NORMAL_ROUNDOFF_POLICY
    || !['PASS', 'BLOCK'].includes(value.qualification)
    || value.productionBindingAuthorized !== false
    || value.releaseQualified !== false) {
    fail('LAFEA4_PARENT_NORMAL_CONTRACT_INVALID');
  }
  for (const hash of [
    value.sourceHash, value.analysisDomainHash, value.analysisGeometryHash,
    value.meshArtifactHash, value.meshHash, value.midsurfaceEvidenceHash,
  ]) requireSha256(hash, 'LAFEA4_PARENT_NORMAL_HASH_INVALID');
  if (typeof value.meshProfileHash !== 'string' || !value.meshProfileHash
    || !SUPPORTED_SURFACES.has(value.surfaceKind)
    || typeof value.lengthUnit !== 'string' || !value.lengthUnit
    || !Number.isSafeInteger(value.elementCount) || value.elementCount < 1
    || !Number.isSafeInteger(value.blockedElementCount) || value.blockedElementCount < 0
    || !Number.isSafeInteger(value.negativeElementCount) || value.negativeElementCount < 0
    || !Number.isSafeInteger(value.roundoffBandElementCount) || value.roundoffBandElementCount < 0
    || !Array.isArray(value.blockingElementIds)) {
    fail('LAFEA4_PARENT_NORMAL_CONTENT_INVALID');
  }
  if (value.qualification === 'PASS' && value.blockedElementCount !== 0) {
    fail('LAFEA4_PARENT_NORMAL_PASS_WITH_BLOCKED_ELEMENTS');
  }
  if (value.qualification === 'BLOCK' && value.blockedElementCount === 0) {
    fail('LAFEA4_PARENT_NORMAL_BLOCK_WITHOUT_BLOCKED_ELEMENTS');
  }
  const core = { ...value };
  delete core.semanticHash;
  const expected = canonicalLafeaSha256({
    schema: 'lafea4-shell-parent-normal-qualification-hash-input/v1',
    qualification: core,
  });
  if (value.semanticHash !== expected) fail('LAFEA4_PARENT_NORMAL_HASH_INVALID');
  return freeze(structuredClone(value));
}

function qualifyElement(element, nodeById, uvByNodeId, geometry) {
  if (element.elementType !== SHELL_TRI3 || element.nodeIds.length !== 3) {
    fail('LAFEA4_PARENT_NORMAL_TRI3_REQUIRED');
  }
  const nodes = element.nodeIds.map((nodeId) => nodeById.get(nodeId));
  if (nodes.some((node) => !node)) fail('LAFEA4_PARENT_NORMAL_NODE_NOT_FOUND');
  const [x1, x2, x3] = nodes;
  const jacobian = cross(subtract(x2, x1), subtract(x3, x1));
  const jacobianMagnitude = norm(jacobian);
  if (!(jacobianMagnitude > 0)) fail('LAFEA4_PARENT_NORMAL_DEGENERATE_TRIANGLE');

  const uValues = element.nodeIds.map((nodeId) => uvByNodeId.get(nodeId).u);
  const uMinimum = Math.min(...uValues);
  const uMaximum = Math.max(...uValues);
  const radius = Number(geometry.surface?.radius);
  if (!(Number.isFinite(radius) && radius > 0)) fail('LAFEA4_PARENT_NORMAL_RADIUS_INVALID');
  const thetaMinimum = uMinimum / radius;
  const thetaMaximum = uMaximum / radius;
  const radial = vector(geometry.surface.radialDirection);
  const axis = vector(geometry.surface.axisDirection);
  const tangent = cross(axis, radial);
  const a = dot(jacobian, radial);
  const b = dot(jacobian, tangent);
  const candidates = stationaryCandidates(thetaMinimum, thetaMaximum, a, b)
    .map((candidate) => freeze({
      ...candidate,
      u: candidate.theta * radius,
      value: a * Math.cos(candidate.theta) + b * Math.sin(candidate.theta),
    }));
  candidates.sort((left, right) => left.value - right.value
    || left.theta - right.theta || left.kind.localeCompare(right.kind));
  const witness = candidates[0];
  const roundoffEnvelope = ROUND_OFF_FACTOR * Number.EPSILON * jacobianMagnitude;
  const classification = witness.value < -roundoffEnvelope
    ? 'NEGATIVE'
    : witness.value <= roundoffEnvelope
      ? 'ZERO_OR_ROUNDOFF_BAND'
      : 'POSITIVE';
  return freeze({
    elementId: element.elementId,
    nodeIds: freeze([...element.nodeIds]),
    uMinimum,
    uMaximum,
    angularSpanDegrees: (thetaMaximum - thetaMinimum) * 180 / Math.PI,
    jacobianMagnitude,
    minimumParentDirectedJacobian: witness.value,
    minimumAlignmentCosine: witness.value / jacobianMagnitude,
    roundoffEnvelope,
    classification,
    status: classification === 'POSITIVE' ? 'OK' : 'BLOCK',
    witness,
  });
}

function stationaryCandidates(thetaMinimum, thetaMaximum, a, b) {
  const rows = [
    { theta: thetaMinimum, kind: 'INTERVAL_MINIMUM_U' },
    { theta: thetaMaximum, kind: 'INTERVAL_MAXIMUM_U' },
  ];
  const phase = Math.atan2(b, a);
  const kMinimum = Math.floor((thetaMinimum - phase) / Math.PI) - 1;
  const kMaximum = Math.ceil((thetaMaximum - phase) / Math.PI) + 1;
  const tolerance = 64 * Number.EPSILON * Math.max(1, Math.abs(thetaMinimum), Math.abs(thetaMaximum));
  for (let k = kMinimum; k <= kMaximum; k += 1) {
    const theta = phase + k * Math.PI;
    if (theta > thetaMinimum + tolerance && theta < thetaMaximum - tolerance) {
      rows.push({ theta, kind: k % 2 === 0 ? 'STATIONARY_MAXIMUM' : 'STATIONARY_MINIMUM' });
    }
  }
  return rows;
}

function requireParents(meshEvidence, midsurface) {
  if (meshEvidence.stageId !== 'LAFEA.4' || midsurface.stageId !== 'LAFEA.4') {
    fail('LAFEA4_PARENT_NORMAL_STAGE_INVALID');
  }
  if (meshEvidence.sourceHash !== midsurface.sourceHash
    || meshEvidence.analysisDomainHash !== midsurface.analysisDomainHash
    || meshEvidence.analysisGeometryHash !== midsurface.analysisGeometryHash) {
    fail('LAFEA4_PARENT_NORMAL_PARENT_MISMATCH');
  }
}

function uvAt(surfaceKind, geometry, point) {
  // Analysis-mesh nodes deliberately carry identity (`nodeId`) in addition to
  // coordinates. The inverse-surface contracts deliberately accept a pure
  // geometric point only. Project the representation boundary here rather than
  // weakening the exact surface contract or changing any parent-normal math.
  const position = vector(point);
  if (surfaceKind === LAFEA_SHELL_SURFACE_KINDS.CYLINDRICAL) {
    return cylindricalShellUvAtPoint3d(geometry, position);
  }
  if (surfaceKind === LAFEA_SHELL_SURFACE_KINDS.CYLINDRICAL_HOLES) {
    return curvedHoleShellUvAtPoint3d(geometry, position);
  }
  fail('LAFEA4_PARENT_NORMAL_SURFACE_NOT_QUALIFIED');
}

function vector(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    fail('LAFEA4_PARENT_NORMAL_VECTOR_INVALID');
  }
  return { x: value.x, y: value.y, z: value.z };
}
function subtract(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function norm(a) { return Math.hypot(a.x, a.y, a.z); }
function requireSha256(value, code) { if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) fail(code); }
function exactKeys(value, expected, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) fail(code);
}
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
