/** Governed source-feature local restraint lowering for LAFEA.3. */

export const LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_MODE = 'SOURCE_NORMAL';
export const LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_POLICY =
  'SOURCE_NORMAL_AXIS_ALIGNED_V1';

const AXIS_ALIGNMENT_RELATIVE_TOLERANCE = 1e-12;

export function sourceNormalRestraintDof(sourceFeatureGeometry) {
  const geometry = requireObject(
    sourceFeatureGeometry,
    'LAFEA_CONTINUUM_LOCAL_RESTRAINT_SOURCE_GEOMETRY_REQUIRED',
  );
  if (geometry.type !== 'LINE') {
    fail('LAFEA_CONTINUUM_LOCAL_RESTRAINT_LINEAR_CONSTRAINT_AUTHORITY_REQUIRED');
  }
  const start = requirePoint(
    geometry.start,
    'LAFEA_CONTINUUM_LOCAL_RESTRAINT_SOURCE_GEOMETRY_INVALID',
  );
  const end = requirePoint(
    geometry.end,
    'LAFEA_CONTINUUM_LOCAL_RESTRAINT_SOURCE_GEOMETRY_INVALID',
  );
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0) || !Number.isFinite(length)) {
    fail('LAFEA_CONTINUUM_LOCAL_RESTRAINT_SOURCE_GEOMETRY_INVALID');
  }
  const tolerance = AXIS_ALIGNMENT_RELATIVE_TOLERANCE * Math.max(1, length);
  const horizontal = Math.abs(dy) <= tolerance;
  const vertical = Math.abs(dx) <= tolerance;
  if (horizontal === vertical) {
    fail('LAFEA_CONTINUUM_LOCAL_RESTRAINT_LINEAR_CONSTRAINT_AUTHORITY_REQUIRED');
  }
  return horizontal ? 'UY' : 'UX';
}

export function appendLafeaSourceNormalRestraintConstraints({ output, attachment, model }) {
  if (!Array.isArray(output) || !attachment || !model) {
    fail('LAFEA_CONTINUUM_LOCAL_RESTRAINT_INPUT_REQUIRED');
  }
  if (attachment.targetType !== 'SEGMENT') {
    fail('LAFEA_CONTINUUM_LOCAL_RESTRAINT_SEGMENT_REQUIRED');
  }
  const payload = requireObject(
    attachment.payload,
    'LAFEA_CONTINUUM_COMPILED_RESTRAINT_PAYLOAD_INVALID',
  );
  if (JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(['mode'])) {
    fail('LAFEA_CONTINUUM_COMPILED_RESTRAINT_PAYLOAD_INVALID');
  }
  if (payload.mode !== LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_MODE) {
    fail('LAFEA_CONTINUUM_COMPILED_RESTRAINT_PAYLOAD_INVALID');
  }
  const projectionEntry = model.projectionEvidence?.entries?.find(
    (row) => row.attachmentId === attachment.attachmentId,
  );
  if (!projectionEntry
    || projectionEntry.sourceFeature?.targetType !== 'SEGMENT'
    || projectionEntry.sourceFeature?.featureId !== attachment.targetId
    || !projectionEntry.sourceFeature?.geometry) {
    fail('LAFEA_CONTINUUM_LOCAL_RESTRAINT_PROJECTION_REQUIRED');
  }
  if (!Array.isArray(attachment.compiledTarget?.nodeIds)
    || !attachment.compiledTarget.nodeIds.length) {
    fail('LAFEA_CONTINUUM_LOCAL_RESTRAINT_NODE_MAPPING_REQUIRED');
  }
  const dof = sourceNormalRestraintDof(projectionEntry.sourceFeature.geometry);
  for (const nodeId of attachment.compiledTarget.nodeIds) {
    output.push({
      constraintId: `${attachment.attachmentId}/${nodeId}/${dof}`,
      nodeId,
      dof,
      value: 0,
      sourceReference: [
        'COMPILED_SOURCE_NORMAL_RESTRAINT',
        attachment.attachmentId,
        LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_POLICY,
        projectionEntry.projectionId,
      ].join('#'),
    });
  }
  return Object.freeze({
    mode: LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_MODE,
    policyId: LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_POLICY,
    dof,
    nodeIds: Object.freeze([...attachment.compiledTarget.nodeIds]),
  });
}

function requirePoint(value, code) {
  const point = requireObject(value, code);
  if (typeof point.x !== 'number' || !Number.isFinite(point.x)
    || typeof point.y !== 'number' || !Number.isFinite(point.y)) {
    fail(code);
  }
  return point;
}
function requireObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}
function fail(code) {
  const error = new TypeError(code);
  error.code = code;
  throw error;
}
