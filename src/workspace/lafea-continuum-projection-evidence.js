/** Hash-addressed source-feature -> mesh -> compiled-contribution custody for LAFEA.3. */
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';

export const LAFEA_CONTINUUM_PROJECTION_EVIDENCE_SCHEMA =
  'lafea-continuum-feature-projection-evidence/v1';

const STAGE_ID = 'LAFEA.3';

export function createLafeaContinuumProjectionEvidence(options) {
  const domain = requireObject(options?.domain, 'LAFEA_CONTINUUM_PROJECTION_DOMAIN_REQUIRED');
  const geometry = requireObject(options?.geometry, 'LAFEA_CONTINUUM_PROJECTION_GEOMETRY_REQUIRED');
  const targets = requireArray(options?.attachmentTargets, 'LAFEA_CONTINUUM_PROJECTION_TARGETS_REQUIRED');
  const targetMap = new Map(targets.map((row) => [row.attachmentId, row.target]));
  const vertexMap = new Map(geometry.vertices.map((row) => [row.vertexId, row]));
  const segmentMap = new Map(geometry.segments.map((row) => [row.segmentId, row]));
  const segmentLoops = collectSegmentLoops(geometry.loops);
  const parents = freeze({
    sourceHash: sha256(options?.sourceHash, 'SOURCE_HASH'),
    analysisDomainHash: sha256(options?.analysisDomainHash, 'ANALYSIS_DOMAIN_HASH'),
    analysisGeometryHash: sha256(options?.analysisGeometryHash, 'ANALYSIS_GEOMETRY_HASH'),
    meshArtifactHash: sha256(options?.meshArtifactHash, 'MESH_ARTIFACT_HASH'),
    meshHash: sha256(options?.meshHash, 'MESH_HASH'),
    meshProfileHash: sha256(options?.meshProfileHash, 'MESH_PROFILE_HASH'),
  });
  const entries = domain.attachments.map((attachment) => {
    const target = targetMap.get(attachment.attachmentId);
    if (!target) fail('LAFEA_CONTINUUM_PROJECTION_ATTACHMENT_TARGET_MISSING');
    return freeze({
      projectionId: `${attachment.attachmentId}/PROJECTION`,
      attachmentId: attachment.attachmentId,
      kind: attachment.kind,
      sourceFeature: sourceFeature(attachment, domain, geometry, vertexMap, segmentMap, segmentLoops),
      meshEntities: freeze({
        nodeIds: [...target.nodeIds],
        edgeNodePaths: target.edgeNodePaths.map((row) => [...row]),
        elementIds: [...target.elementIds],
      }),
      compiledContributionIds: compiledContributionIds(attachment, target),
    });
  }).sort((a, b) => compare(a.attachmentId, b.attachmentId));
  const base = freeze({
    schema: LAFEA_CONTINUUM_PROJECTION_EVIDENCE_SCHEMA,
    stageId: STAGE_ID,
    parents,
    coordinateSystemId: geometry.coordinateSystemId,
    lengthUnit: geometry.lengthUnit,
    entries,
    deterministicOrdering: true,
    releaseAuthorityGranted: false,
  });
  return freeze({
    ...base,
    projectionHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-feature-projection-hash-input/v1',
      projection: base,
    }),
  });
}

export function validateLafeaContinuumProjectionEvidence(value) {
  if (!value || value.schema !== LAFEA_CONTINUUM_PROJECTION_EVIDENCE_SCHEMA
    || value.stageId !== STAGE_ID || !Array.isArray(value.entries)
    || value.releaseAuthorityGranted !== false) {
    fail('LAFEA_CONTINUUM_PROJECTION_EVIDENCE_INVALID');
  }
  const copy = structuredClone(value);
  delete copy.projectionHash;
  const expected = canonicalLafeaSha256({
    schema: 'lafea-continuum-feature-projection-hash-input/v1',
    projection: copy,
  });
  if (value.projectionHash !== expected) fail('LAFEA_CONTINUUM_PROJECTION_EVIDENCE_TAMPERED');
  return value;
}

function sourceFeature(attachment, domain, geometry, vertexMap, segmentMap, segmentLoops) {
  if (attachment.targetType === 'VERTEX') {
    const vertex = vertexMap.get(attachment.targetId);
    if (!vertex) fail('LAFEA_CONTINUUM_PROJECTION_SOURCE_VERTEX_MISSING');
    return freeze({
      targetType: 'VERTEX', featureId: attachment.targetId,
      geometry: freeze({ vertexId: vertex.vertexId, x: vertex.x, y: vertex.y }),
    });
  }
  if (attachment.targetType === 'SEGMENT') {
    const segment = segmentMap.get(attachment.targetId);
    if (!segment) fail('LAFEA_CONTINUUM_PROJECTION_SOURCE_SEGMENT_MISSING');
    const start = vertexMap.get(segment.startVertexId);
    const end = vertexMap.get(segment.endVertexId);
    const loops = segmentLoops.get(segment.segmentId) ?? [];
    return freeze({
      targetType: 'SEGMENT', featureId: attachment.targetId,
      geometry: freeze({
        ...structuredClone(segment),
        start: freeze({ x: start.x, y: start.y }),
        end: freeze({ x: end.x, y: end.y }),
        loopBindings: loops.map((row) => freeze({ ...row })),
      }),
    });
  }
  if (attachment.targetType === 'REGION') {
    return freeze({
      targetType: 'REGION', featureId: attachment.targetId,
      geometry: freeze({
        regionId: domain.region.regionId,
        geometryId: geometry.geometryId,
      }),
    });
  }
  fail('LAFEA_CONTINUUM_PROJECTION_SOURCE_FEATURE_TYPE_UNSUPPORTED');
}

function collectSegmentLoops(loops) {
  const map = new Map();
  for (const loop of loops) {
    for (const segmentId of loop.segmentIds) {
      const rows = map.get(segmentId) ?? [];
      rows.push({ loopId: loop.loopId, role: loop.role });
      map.set(segmentId, rows);
    }
  }
  for (const rows of map.values()) rows.sort((a, b) => compare(a.loopId, b.loopId));
  return map;
}

function compiledContributionIds(attachment, target) {
  const id = attachment.attachmentId;
  if (attachment.kind === 'CONCENTRATED_LOAD') return freeze([id]);
  if (attachment.kind === 'TRACTION' && typeof attachment.payload?.law === 'string') {
    return freeze(target.edgeNodePaths.flatMap((nodeIds, edgeIndex) =>
      nodeIds.map((nodeId, nodeIndex) => `${id}/${edgeIndex + 1}/${nodeIndex + 1}/${nodeId}`)));
  }
  if (attachment.kind === 'TRACTION' || attachment.kind === 'PRESSURE') {
    return freeze(target.edgeNodePaths.map((_, index) => `${id}/${index + 1}`));
  }
  if (attachment.kind === 'BODY_FORCE' || attachment.kind === 'TEMPERATURE') {
    return freeze(target.elementIds.map((elementId) => `${id}/${elementId}`));
  }
  if (attachment.kind === 'RESTRAINT') {
    const active = ['ux', 'uy'].filter((key) => attachment.payload?.[key] === true);
    return freeze(target.nodeIds.flatMap((nodeId) =>
      active.map((key) => `${id}/${nodeId}/${key.toUpperCase()}`)));
  }
  if (attachment.kind === 'IMPOSED_DISPLACEMENT') {
    const active = ['ux', 'uy'].filter((key) => Object.prototype.hasOwnProperty.call(attachment.payload ?? {}, key));
    return freeze(target.nodeIds.flatMap((nodeId) =>
      active.map((key) => `${id}/${nodeId}/${key.toUpperCase()}`)));
  }
  return freeze([]);
}

function requireObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}
function requireArray(value, code) { if (!Array.isArray(value)) fail(code); return value; }
function sha256(value, field) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    fail(`LAFEA_CONTINUUM_PROJECTION_${field}_INVALID`);
  }
  return value;
}
function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
