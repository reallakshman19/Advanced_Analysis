import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import { validateLafeaAnalysisMeshEvidenceV2 } from './lafea-analysis-mesh-evidence-v2.js';
import {
  LAFEA_SHELL_SURFACE_KINDS,
  shellMidsurfaceFrameAtUvAny,
  shellMidsurfaceKind,
  shellMidsurfacePoint3dAny,
  validateLafeaAnyShellMidsurfaceEvidence,
} from './lafea-shell-midsurface-dispatch.js';
import { cylindricalShellUvAtPoint3d } from './lafea-shell-curved-midsurface-contract.js';
import { curvedHoleShellUvAtPoint3d } from './lafea-shell-curved-hole-midsurface-contract.js';
import { validateLafea4ShellThicknessBasis } from './lafea-shell-thickness-basis.js';

export const LAFEA4_SHELL_GEOMETRIC_QUALITY_SCHEMA =
  'lafea4-shell-geometric-quality-evidence/v1';
export const LAFEA4_SHELL_GEOMETRIC_QUALITY_AUTHORITY =
  'MEASURED_INFORMATIONAL_NOT_QUALIFICATION_GATE';
export const LAFEA4_SHELL_GEOMETRIC_QUALITY_GATE_DISPOSITION = 'NOT_GATED';

const SHELL_TRI3 = 'CST_DKT_TRI3_THIN_SHELL_V1';
const DEGREES_PER_RADIAN = 180 / Math.PI;
const SUPPORTED_SURFACES = new Set([
  LAFEA_SHELL_SURFACE_KINDS.CYLINDRICAL,
  LAFEA_SHELL_SURFACE_KINDS.CYLINDRICAL_HOLES,
]);
const OUTPUT_KEYS = Object.freeze([
  'schema', 'stageId', 'authority', 'gateDisposition', 'qualification',
  'sourceHash', 'analysisDomainHash', 'analysisGeometryHash', 'meshArtifactHash',
  'meshHash', 'meshProfileHash', 'midsurfaceEvidenceHash', 'thicknessBasisHash',
  'surfaceKind', 'lengthUnit', 'elementCount', 'metrics', 'engineeringAuthority',
  'releaseQualified', 'semanticHash',
]);

/**
 * Read-only geometric evidence for retained LAFEA.4 TRI3 shell meshes.
 *
 * This deliberately creates no PASS/WARNING/BLOCK threshold. Existing retained
 * mesh-quality gates remain authoritative. These measurements exist so future
 * qualification work has explicit geometric quantities instead of hidden
 * assumptions about curved facets, parent normals or shell thickness.
 */
export function createLafea4ShellGeometricQualityEvidence({
  meshEvidence,
  midsurfaceEvidence,
  thicknessBasis = null,
}) {
  const retained = validateLafeaAnalysisMeshEvidenceV2(meshEvidence);
  const midsurface = validateLafeaAnyShellMidsurfaceEvidence(midsurfaceEvidence);
  requireParents(retained, midsurface);
  const surfaceKind = shellMidsurfaceKind(midsurface.geometry);
  if (!SUPPORTED_SURFACES.has(surfaceKind)) {
    fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_SURFACE_NOT_QUALIFIED');
  }
  const thickness = thicknessBasis === null
    ? null
    : validateThicknessBasis(thicknessBasis, retained.sourceHash);

  const nodeById = new Map(retained.mesh.nodes.map((node) => [node.nodeId, node]));
  const uvByNodeId = new Map(retained.mesh.nodes.map((node) => [
    node.nodeId,
    uvAt(surfaceKind, midsurface.geometry, node),
  ]));
  const facets = retained.mesh.elements.map((element) => measureFacet(
    element,
    nodeById,
    uvByNodeId,
    midsurface.geometry,
    thickness,
  ));
  if (!facets.length) fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_ELEMENTS_REQUIRED');

  const normalContinuity = measureNormalContinuity(retained.mesh, facets);
  const signedMinimum = minimumBy(facets, (row) => row.signedSurfaceJacobian);
  const signedMaximum = maximumBy(facets, (row) => row.signedSurfaceJacobian);
  const angleMaximum = maximumBy(facets, (row) => row.maximumAngleDegrees);
  const curvatureMaximum = maximumBy(facets, (row) => row.maximumChordMidpointDeviation);
  const hOverTMaximum = thickness?.uniformThickness
    ? maximumBy(facets, (row) => row.hOverT)
    : null;

  const metrics = freeze({
    signedSurfaceJacobian: freeze({
      formulaId: 'SIGNED_TRI3_SURFACE_JACOBIAN_DOT_PARENT_DIRECTOR_V1',
      definition: 'dot(cross(x2-x1,x3-x1),analytic_midsurface_director_at_uv_centroid)',
      minimum: signedMinimum.value,
      maximum: signedMaximum.value,
      negativeOrZeroElementCount: facets.filter((row) => row.signedSurfaceJacobian <= 0).length,
      minimumWitness: facetWitness(signedMinimum.row),
    }),
    facetDeterminantRatio: freeze({
      formulaId: 'AFFINE_TRI3_FACET_CONSTANT_JACOBIAN_V1',
      definition: 'max(|J|)/min(|J|) over one linear TRI3 facet',
      minimum: 1,
      maximum: 1,
      note: 'Linear TRI3 facet geometry is affine; determinant ratio is identically one.',
    }),
    maximumAngleDegrees: freeze({
      formulaId: 'TRI3_3D_CORNER_ANGLE_V1',
      maximum: angleMaximum.value,
      witness: freeze({
        elementId: angleMaximum.row.elementId,
        value: angleMaximum.row.maximumAngleDegrees,
      }),
    }),
    shellNormalContinuityDegrees: freeze({
      formulaId: 'ACOS_FACET_NORMAL_DOT_ACROSS_SHARED_CORNER_EDGE_V1',
      maximum: normalContinuity.maximum,
      sharedEdgeCount: normalContinuity.sharedEdgeCount,
      nonManifoldSharedEdgeCount: normalContinuity.nonManifoldSharedEdgeCount,
      witness: normalContinuity.witness,
    }),
    curvatureChordMidpointDeviation: freeze({
      formulaId: 'EXACT_MIDSURFACE_MIDPOINT_MINUS_FACET_CHORD_MIDPOINT_V1',
      maximum: curvatureMaximum.value,
      witness: freeze({
        elementId: curvatureMaximum.row.elementId,
        nodeIds: curvatureMaximum.row.curvatureWitness.nodeIds,
        exactMidpointUv: curvatureMaximum.row.curvatureWitness.exactMidpointUv,
        value: curvatureMaximum.row.maximumChordMidpointDeviation,
      }),
    }),
    hOverT: hOverTMaximum
      ? freeze({
        formulaId: 'LONGEST_CORNER_EDGE_OVER_SOURCE_BOUND_UNIFORM_THICKNESS_V1',
        status: 'AVAILABLE_UNIFORM_THICKNESS',
        uniformThickness: thickness.uniformThickness,
        maximum: hOverTMaximum.value,
        witness: freeze({
          elementId: hOverTMaximum.row.elementId,
          characteristicLength: hOverTMaximum.row.characteristicLength,
          value: hOverTMaximum.row.hOverT,
        }),
      })
      : freeze({
        formulaId: 'LONGEST_CORNER_EDGE_OVER_SOURCE_BOUND_UNIFORM_THICKNESS_V1',
        status: thickness === null
          ? 'UNAVAILABLE_THICKNESS_BASIS_NOT_SUPPLIED'
          : 'UNAVAILABLE_NONUNIFORM_THICKNESS',
        uniformThickness: null,
        maximum: null,
        witness: null,
      }),
  });

  const core = {
    schema: LAFEA4_SHELL_GEOMETRIC_QUALITY_SCHEMA,
    stageId: 'LAFEA.4',
    authority: LAFEA4_SHELL_GEOMETRIC_QUALITY_AUTHORITY,
    gateDisposition: LAFEA4_SHELL_GEOMETRIC_QUALITY_GATE_DISPOSITION,
    qualification: 'NOT_GATED',
    sourceHash: retained.sourceHash,
    analysisDomainHash: retained.analysisDomainHash,
    analysisGeometryHash: retained.analysisGeometryHash,
    meshArtifactHash: retained.artifactHash,
    meshHash: retained.meshHash,
    meshProfileHash: retained.meshProfileHash,
    midsurfaceEvidenceHash: midsurface.semanticHash,
    thicknessBasisHash: thickness?.semanticHash ?? null,
    surfaceKind,
    lengthUnit: midsurface.geometry.lengthUnit,
    elementCount: facets.length,
    metrics,
    engineeringAuthority: false,
    releaseQualified: false,
  };
  return freeze({
    ...core,
    semanticHash: canonicalLafeaSha256({
      schema: 'lafea4-shell-geometric-quality-evidence-hash-input/v1',
      evidence: core,
    }),
  });
}

export function validateLafea4ShellGeometricQualityEvidence(value) {
  exactKeys(value, OUTPUT_KEYS, 'LAFEA4_SHELL_GEOMETRIC_QUALITY_KEYS_INVALID');
  if (value.schema !== LAFEA4_SHELL_GEOMETRIC_QUALITY_SCHEMA
    || value.stageId !== 'LAFEA.4'
    || value.authority !== LAFEA4_SHELL_GEOMETRIC_QUALITY_AUTHORITY
    || value.gateDisposition !== 'NOT_GATED'
    || value.qualification !== 'NOT_GATED'
    || value.engineeringAuthority !== false
    || value.releaseQualified !== false) {
    fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_CONTRACT_INVALID');
  }
  for (const hash of [
    value.sourceHash, value.analysisDomainHash, value.analysisGeometryHash,
    value.meshArtifactHash, value.meshHash, value.midsurfaceEvidenceHash,
  ]) requireSha256(hash, 'LAFEA4_SHELL_GEOMETRIC_QUALITY_HASH_INVALID');
  if (typeof value.meshProfileHash !== 'string' || !value.meshProfileHash) {
    fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_PROFILE_HASH_INVALID');
  }
  if (value.thicknessBasisHash !== null) {
    requireSha256(value.thicknessBasisHash, 'LAFEA4_SHELL_GEOMETRIC_QUALITY_THICKNESS_HASH_INVALID');
  }
  if (!SUPPORTED_SURFACES.has(value.surfaceKind)
    || typeof value.lengthUnit !== 'string' || !value.lengthUnit.trim()
    || !Number.isSafeInteger(value.elementCount) || value.elementCount < 1) {
    fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_CONTENT_INVALID');
  }
  const core = { ...value };
  delete core.semanticHash;
  const expected = canonicalLafeaSha256({
    schema: 'lafea4-shell-geometric-quality-evidence-hash-input/v1', evidence: core,
  });
  if (value.semanticHash !== expected) fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_HASH_INVALID');
  return freeze(structuredClone(value));
}

function requireParents(meshEvidence, midsurface) {
  if (meshEvidence.stageId !== 'LAFEA.4' || midsurface.stageId !== 'LAFEA.4') {
    fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_STAGE_INVALID');
  }
  if (meshEvidence.sourceHash !== midsurface.sourceHash
    || meshEvidence.analysisDomainHash !== midsurface.analysisDomainHash
    || meshEvidence.analysisGeometryHash !== midsurface.analysisGeometryHash) {
    fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_PARENT_MISMATCH');
  }
  if (meshEvidence.mesh.elements.some((element) => (
    element.elementType !== SHELL_TRI3 || element.nodeIds.length !== 3
  ))) {
    fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_TRI3_REQUIRED');
  }
}

function validateThicknessBasis(value, sourceHash) {
  const basis = validateLafea4ShellThicknessBasis(value);
  if (basis.sourceHash !== sourceHash) fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_THICKNESS_STALE');
  return basis;
}

function measureFacet(element, nodeById, uvByNodeId, geometry, thickness) {
  const nodes = element.nodeIds.map((id) => nodeById.get(id));
  if (nodes.some((node) => !node)) fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_NODE_NOT_FOUND');
  const [x1, x2, x3] = nodes;
  const e12 = subtract(x2, x1);
  const e13 = subtract(x3, x1);
  const crossValue = cross(e12, e13);
  const jacobianMagnitude = norm(crossValue);
  if (!(jacobianMagnitude > 0)) fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_DEGENERATE_TRIANGLE');
  const facetNormal = scale(crossValue, 1 / jacobianMagnitude);
  const uvs = element.nodeIds.map((id) => uvByNodeId.get(id));
  const centroidUv = {
    u: uvs.reduce((sum, row) => sum + row.u, 0) / 3,
    v: uvs.reduce((sum, row) => sum + row.v, 0) / 3,
  };
  const director = shellMidsurfaceFrameAtUvAny(geometry, centroidUv.u, centroidUv.v).director;
  const signedSurfaceJacobian = dot(crossValue, director);
  const angles = triangleAngles(nodes);
  const edgeLengths = [distance(x1, x2), distance(x2, x3), distance(x3, x1)];
  const characteristicLength = Math.max(...edgeLengths);
  const curvatureRows = [
    edgeCurvature(element.nodeIds[0], element.nodeIds[1], nodeById, uvByNodeId, geometry),
    edgeCurvature(element.nodeIds[1], element.nodeIds[2], nodeById, uvByNodeId, geometry),
    edgeCurvature(element.nodeIds[2], element.nodeIds[0], nodeById, uvByNodeId, geometry),
  ].sort((a, b) => b.deviation - a.deviation || a.nodeIds.join('\u0000').localeCompare(b.nodeIds.join('\u0000')));
  return freeze({
    elementId: element.elementId,
    signedSurfaceJacobian,
    surfaceJacobianMagnitude: jacobianMagnitude,
    facetArea: jacobianMagnitude / 2,
    parentDirectorAlignmentCosine: dot(facetNormal, director),
    facetNormal,
    maximumAngleDegrees: Math.max(...angles),
    characteristicLength,
    hOverT: thickness?.uniformThickness ? characteristicLength / thickness.uniformThickness : null,
    maximumChordMidpointDeviation: curvatureRows[0].deviation,
    curvatureWitness: curvatureRows[0],
  });
}

function edgeCurvature(aId, bId, nodeById, uvByNodeId, geometry) {
  const a = nodeById.get(aId); const b = nodeById.get(bId);
  const auv = uvByNodeId.get(aId); const buv = uvByNodeId.get(bId);
  const uv = { u: (auv.u + buv.u) / 2, v: (auv.v + buv.v) / 2 };
  const exact = shellMidsurfacePoint3dAny(geometry, uv.u, uv.v);
  const chord = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  return freeze({
    nodeIds: freeze([aId, bId].sort()),
    exactMidpointUv: freeze(uv),
    deviation: distance(exact, chord),
  });
}

function measureNormalContinuity(mesh, facets) {
  const normalByElementId = new Map(facets.map((row) => [row.elementId, row.facetNormal]));
  const users = new Map();
  for (const element of mesh.elements) {
    for (let index = 0; index < 3; index += 1) {
      const a = element.nodeIds[index]; const b = element.nodeIds[(index + 1) % 3];
      const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
      const row = users.get(key) ?? [];
      row.push(element.elementId);
      users.set(key, row);
    }
  }
  const rows = [];
  let nonManifoldSharedEdgeCount = 0;
  for (const [key, rawIds] of users.entries()) {
    const ids = [...new Set(rawIds)].sort();
    if (ids.length < 2) continue;
    if (ids.length > 2) nonManifoldSharedEdgeCount += 1;
    for (let i = 0; i < ids.length - 1; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const cosine = clamp(dot(normalByElementId.get(ids[i]), normalByElementId.get(ids[j])), -1, 1);
        rows.push(freeze({
          nodeIds: freeze(key.split('\u0000')),
          elementIds: freeze([ids[i], ids[j]]),
          angleDegrees: Math.acos(cosine) * DEGREES_PER_RADIAN,
        }));
      }
    }
  }
  rows.sort((a, b) => b.angleDegrees - a.angleDegrees
    || a.nodeIds.join('\u0000').localeCompare(b.nodeIds.join('\u0000')));
  return freeze({
    maximum: rows[0]?.angleDegrees ?? 0,
    sharedEdgeCount: [...users.values()].filter((row) => new Set(row).size >= 2).length,
    nonManifoldSharedEdgeCount,
    witness: rows[0] ?? null,
  });
}

function uvAt(surfaceKind, geometry, point) {
  const position = { x: point.x, y: point.y, z: point.z };
  if (surfaceKind === LAFEA_SHELL_SURFACE_KINDS.CYLINDRICAL) {
    return cylindricalShellUvAtPoint3d(geometry, position);
  }
  if (surfaceKind === LAFEA_SHELL_SURFACE_KINDS.CYLINDRICAL_HOLES) {
    return curvedHoleShellUvAtPoint3d(geometry, position);
  }
  fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_SURFACE_NOT_QUALIFIED');
}

function triangleAngles(nodes) {
  return nodes.map((origin, index) => {
    const first = subtract(nodes[(index + 1) % 3], origin);
    const second = subtract(nodes[(index + 2) % 3], origin);
    const denominator = norm(first) * norm(second);
    if (!(denominator > 0)) fail('LAFEA4_SHELL_GEOMETRIC_QUALITY_DEGENERATE_TRIANGLE');
    return Math.acos(clamp(dot(first, second) / denominator, -1, 1)) * DEGREES_PER_RADIAN;
  });
}

function facetWitness(row) {
  return freeze({
    elementId: row.elementId,
    signedSurfaceJacobian: row.signedSurfaceJacobian,
    surfaceJacobianMagnitude: row.surfaceJacobianMagnitude,
    facetArea: row.facetArea,
    parentDirectorAlignmentCosine: row.parentDirectorAlignmentCosine,
  });
}
function minimumBy(rows, selector) {
  return rows.reduce((best, row) => selector(row) < best.value ? { row, value: selector(row) } : best,
    { row: rows[0], value: selector(rows[0]) });
}
function maximumBy(rows, selector) {
  return rows.reduce((best, row) => selector(row) > best.value ? { row, value: selector(row) } : best,
    { row: rows[0], value: selector(rows[0]) });
}
function subtract(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function scale(a, factor) { return { x: a.x * factor, y: a.y * factor, z: a.z * factor }; }
function norm(a) { return Math.hypot(a.x, a.y, a.z); }
function distance(a, b) { return norm(subtract(a, b)); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
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
