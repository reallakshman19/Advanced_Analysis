/** Source-vs-compiled distributed-load resultant custody for the LAFEA.3 compiler. */
import { integrateEdgeLoad } from '../core/local-continuum/edge-traction-loads.js';
import { lafeaUnitFactor } from '../core/lafea-common-input/units.js';
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import { validateLafeaContinuumProjectionEvidence } from './lafea-continuum-projection-evidence.js';

export const LAFEA_CONTINUUM_LOAD_RESULTANT_EVIDENCE_SCHEMA =
  'lafea-continuum-load-resultant-evidence/v1';
export const LAFEA_CONTINUUM_LOAD_RESULTANT_QUALIFIED_SCOPE =
  'CONSTANT_AND_LINEAR_TRACTION_STRAIGHT_SEGMENT_V2';

const STAGE_ID = 'LAFEA.3';
const LINEAR_TRACTION_LAW = 'LINEAR_SOURCE_SEGMENT_TRACTION_V1';

export function createLafeaContinuumLoadResultantEvidence(model, executionInput) {
  requireObject(model, 'LAFEA_CONTINUUM_RESULTANT_SOLVER_MODEL_REQUIRED');
  requireObject(executionInput, 'LAFEA_CONTINUUM_RESULTANT_EXECUTION_INPUT_REQUIRED');
  const projection = validateLafeaContinuumProjectionEvidence(model.projectionEvidence);
  if (model.parents?.projectionHash !== projection.projectionHash) {
    fail('LAFEA_CONTINUUM_RESULTANT_PROJECTION_PARENT_MISMATCH');
  }
  const projectionByAttachment = new Map(projection.entries.map((row) => [row.attachmentId, row]));
  const nodes = new Map(model.nodes.map((row) => [row.nodeId, row]));
  const elements = new Map(model.elements.map((row) => [row.elementId, row]));
  const sections = new Map(model.sections.map((row) => [row.sectionId, row]));
  const cases = new Map(executionInput.loadCases.map((row) => [row.loadCaseId, row]));
  const evaluated = [];
  const notEvaluated = [];

  for (const attachment of model.attachments) {
    if (!isDistributed(attachment.kind)) continue;
    const projectionEntry = projectionByAttachment.get(attachment.attachmentId);
    if (!projectionEntry) fail('LAFEA_CONTINUUM_RESULTANT_PROJECTION_ENTRY_MISSING');
    const reason = unsupportedReason(attachment, projectionEntry);
    if (reason) {
      notEvaluated.push(freeze({
        attachmentId: attachment.attachmentId,
        kind: attachment.kind,
        reason,
      }));
      continue;
    }
    const factor = lafeaUnitFactor('stress', attachment.payload.unit);
    if (factor === null) fail('LAFEA_CONTINUUM_RESULTANT_TRACTION_UNIT_UNSUPPORTED');
    const thickness = uniformMappedThickness(attachment, elements, sections);
    const tractionLaw = attachment.payload?.law === LINEAR_TRACTION_LAW
      ? LINEAR_TRACTION_LAW : 'CONSTANT_VECTOR';
    const source = tractionLaw === LINEAR_TRACTION_LAW
      ? linearStraightSegmentResultant(projectionEntry.sourceFeature.geometry, thickness, attachment.payload, factor)
      : constantStraightSegmentResultant(
        projectionEntry.sourceFeature.geometry,
        thickness,
        finite(attachment.payload.tx, 'LAFEA_CONTINUUM_RESULTANT_TRACTION_VALUE_INVALID') * factor,
        finite(attachment.payload.ty, 'LAFEA_CONTINUUM_RESULTANT_TRACTION_VALUE_INVALID') * factor,
      );
    for (const caseId of attachment.physicalCaseIds) {
      const loadCase = cases.get(caseId);
      if (!loadCase) fail('LAFEA_CONTINUUM_RESULTANT_CASE_MISSING');
      const compiled = tractionLaw === LINEAR_TRACTION_LAW
        ? compiledAnalyticalTractionResultant(attachment, projectionEntry, loadCase, nodes, source.measure)
        : compiledConstantTractionResultant(
          attachment, projectionEntry, loadCase, nodes, elements, sections,
        );
      const comparison = compareResultants(source, compiled.resultant);
      if (comparison.status !== 'PASS') fail('LAFEA_CONTINUUM_LOAD_RESULTANT_MISMATCH');
      evaluated.push(freeze({
        attachmentId: attachment.attachmentId,
        caseId,
        kind: attachment.kind,
        tractionLaw,
        sourceFeatureId: attachment.targetId,
        projectionId: projectionEntry.projectionId,
        contributionIds: [...projectionEntry.compiledContributionIds],
        sourceResultant: source,
        compiledResultant: compiled.resultant,
        equivalentNodalForces: compiled.equivalentNodalForces,
        comparison,
      }));
    }
  }

  const linearTractionQualified = evaluated.some((row) =>
    row.tractionLaw === LINEAR_TRACTION_LAW && row.comparison.status === 'PASS');
  const base = freeze({
    schema: LAFEA_CONTINUUM_LOAD_RESULTANT_EVIDENCE_SCHEMA,
    stageId: STAGE_ID,
    qualifiedScope: LAFEA_CONTINUUM_LOAD_RESULTANT_QUALIFIED_SCOPE,
    parents: freeze({
      solverModelHash: sha256(model.solverModelHash, 'SOLVER_MODEL_HASH'),
      projectionHash: sha256(projection.projectionHash, 'PROJECTION_HASH'),
      compiledInputHash: canonicalLafeaSha256({
        schema: 'lafea-continuum-compiled-input-hash-input/v1',
        input: executionInput,
      }),
    }),
    evaluated: evaluated.sort(resultantCompare),
    notEvaluated: notEvaluated.sort((a, b) => compare(a.attachmentId, b.attachmentId)),
    forceAndMomentPreservationRequired: true,
    pressureSourceNormalQualified: false,
    linearTractionQualified,
    bodyForceResultantQualified: false,
    releaseAuthorityGranted: false,
  });
  return freeze({
    ...base,
    loadResultantEvidenceHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-load-resultant-evidence-hash-input/v1',
      evidence: base,
    }),
  });
}

export function validateLafeaContinuumLoadResultantEvidence(value) {
  if (!value || value.schema !== LAFEA_CONTINUUM_LOAD_RESULTANT_EVIDENCE_SCHEMA
    || value.stageId !== STAGE_ID
    || value.qualifiedScope !== LAFEA_CONTINUUM_LOAD_RESULTANT_QUALIFIED_SCOPE
    || !Array.isArray(value.evaluated) || !Array.isArray(value.notEvaluated)
    || value.releaseAuthorityGranted !== false) {
    fail('LAFEA_CONTINUUM_LOAD_RESULTANT_EVIDENCE_INVALID');
  }
  const copy = structuredClone(value);
  delete copy.loadResultantEvidenceHash;
  const expected = canonicalLafeaSha256({
    schema: 'lafea-continuum-load-resultant-evidence-hash-input/v1',
    evidence: copy,
  });
  if (value.loadResultantEvidenceHash !== expected) {
    fail('LAFEA_CONTINUUM_LOAD_RESULTANT_EVIDENCE_TAMPERED');
  }
  return value;
}

function isDistributed(kind) {
  return kind === 'TRACTION' || kind === 'PRESSURE' || kind === 'BODY_FORCE';
}

function unsupportedReason(attachment, projection) {
  if (attachment.kind === 'PRESSURE') return 'SOURCE_NORMAL_PRESSURE_G004_OPEN';
  if (attachment.kind === 'BODY_FORCE') return 'BODY_FORCE_RESULTANT_CERTIFICATION_PENDING';
  if (projection.sourceFeature?.geometry?.type !== 'LINE') {
    return 'CURVED_TRACTION_SOURCE_GEOMETRY_CERTIFICATION_PENDING';
  }
  if (typeof attachment.payload?.law === 'string'
    && attachment.payload.law !== LINEAR_TRACTION_LAW) {
    return 'ANALYTICAL_TRACTION_OUTSIDE_QUALIFIED_SCOPE';
  }
  return null;
}

function constantStraightSegmentResultant(geometry, thickness, tx, ty) {
  const { ax, ay, bx, by, length } = straightGeometry(geometry);
  const forceX = tx * thickness * length;
  const forceY = ty * thickness * length;
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  return resultant(forceX, forceY, cx * forceY - cy * forceX, length);
}

function linearStraightSegmentResultant(geometry, thickness, payload, factor) {
  const { ax, ay, bx, by, dx, dy, length } = straightGeometry(geometry);
  const q0x = finite(payload.txStart, 'LAFEA_CONTINUUM_RESULTANT_TRACTION_VALUE_INVALID') * factor;
  const q0y = finite(payload.tyStart, 'LAFEA_CONTINUUM_RESULTANT_TRACTION_VALUE_INVALID') * factor;
  const q1x = finite(payload.txEnd, 'LAFEA_CONTINUUM_RESULTANT_TRACTION_VALUE_INVALID') * factor;
  const q1y = finite(payload.tyEnd, 'LAFEA_CONTINUUM_RESULTANT_TRACTION_VALUE_INVALID') * factor;
  const dqx = q1x - q0x;
  const dqy = q1y - q0y;
  const forceX = thickness * length * (q0x + q1x) / 2;
  const forceY = thickness * length * (q0y + q1y) / 2;
  const cross = (rx, ry, fx, fy) => rx * fy - ry * fx;
  const momentIntegral = cross(ax, ay, q0x, q0y)
    + 0.5 * (cross(ax, ay, dqx, dqy) + cross(dx, dy, q0x, q0y))
    + (1 / 3) * cross(dx, dy, dqx, dqy);
  return resultant(forceX, forceY, thickness * length * momentIntegral, length);
}

function straightGeometry(geometry) {
  const ax = finite(geometry.start?.x, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  const ay = finite(geometry.start?.y, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  const bx = finite(geometry.end?.x, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  const by = finite(geometry.end?.y, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  return { ax, ay, bx, by, dx, dy, length };
}

function compiledConstantTractionResultant(attachment, projection, loadCase, nodes, elements, sections) {
  const expectedIds = new Set(projection.compiledContributionIds);
  const loads = loadCase.edgeTractions.filter((row) =>
    row.sourceReference === `COMPILED_ATTACHMENT#${attachment.attachmentId}`);
  if (loads.length !== expectedIds.size
    || loads.some((row) => !expectedIds.has(row.tractionId))) {
    fail('LAFEA_CONTINUUM_RESULTANT_CONTRIBUTION_CUSTODY_MISMATCH');
  }
  let forceX = 0; let forceY = 0; let momentZ = 0; let length = 0;
  const equivalentNodalForces = [];
  for (const load of loads.sort((a, b) => compare(a.tractionId, b.tractionId))) {
    const element = elements.get(load.elementId);
    const section = sections.get(element?.sectionId);
    if (!element || !section) fail('LAFEA_CONTINUUM_RESULTANT_ELEMENT_SECTION_MISSING');
    const edgeNodes = load.edgeNodeIds.map((nodeId) => nodes.get(nodeId));
    if (edgeNodes.some((node) => !node)) fail('LAFEA_CONTINUUM_RESULTANT_EDGE_NODE_MISSING');
    const integrated = integrateEdgeLoad(edgeNodes, section.thickness, () => [load.tx, load.ty]);
    length += integrated.length;
    integrated.forces.forEach(([fx, fy], index) => {
      const node = edgeNodes[index];
      forceX += fx; forceY += fy; momentZ += node.x * fy - node.y * fx;
      equivalentNodalForces.push(freeze({
        contributionId: load.tractionId,
        nodeId: node.nodeId,
        fx: clean(fx),
        fy: clean(fy),
      }));
    });
  }
  return freeze({
    resultant: resultant(forceX, forceY, momentZ, length),
    equivalentNodalForces: freeze(equivalentNodalForces),
  });
}

function compiledAnalyticalTractionResultant(attachment, projection, loadCase, nodes, measure) {
  const expectedIds = new Set(projection.compiledContributionIds);
  const prefix = `COMPILED_ANALYTICAL_TRACTION#${attachment.attachmentId}/${LINEAR_TRACTION_LAW}/`;
  const loads = loadCase.nodalForces.filter((row) => expectedIds.has(row.loadId));
  if (loads.length !== expectedIds.size
    || loads.some((row) => !row.sourceReference.startsWith(prefix))) {
    fail('LAFEA_CONTINUUM_RESULTANT_CONTRIBUTION_CUSTODY_MISMATCH');
  }
  let forceX = 0; let forceY = 0; let momentZ = 0;
  const equivalentNodalForces = loads.sort((a, b) => compare(a.loadId, b.loadId)).map((load) => {
    const node = nodes.get(load.nodeId);
    if (!node) fail('LAFEA_CONTINUUM_RESULTANT_EDGE_NODE_MISSING');
    forceX += load.fx;
    forceY += load.fy;
    momentZ += node.x * load.fy - node.y * load.fx;
    return freeze({
      contributionId: load.loadId,
      nodeId: load.nodeId,
      fx: clean(load.fx),
      fy: clean(load.fy),
    });
  });
  return freeze({
    resultant: resultant(forceX, forceY, momentZ, measure),
    equivalentNodalForces: freeze(equivalentNodalForces),
  });
}

function uniformMappedThickness(attachment, elements, sections) {
  const values = attachment.compiledTarget.elementIds.map((elementId) => {
    const element = elements.get(elementId);
    const section = sections.get(element?.sectionId);
    if (!element || !section) fail('LAFEA_CONTINUUM_RESULTANT_ELEMENT_SECTION_MISSING');
    return section.thickness;
  });
  const unique = [...new Set(values)];
  if (unique.length !== 1 || !(unique[0] > 0)) fail('LAFEA_CONTINUUM_RESULTANT_THICKNESS_INVALID');
  return unique[0];
}

function compareResultants(source, compiled) {
  const forceScale = Math.max(1, Math.hypot(source.forceX, source.forceY));
  const momentScale = Math.max(1, Math.abs(source.momentZ), forceScale * Math.max(1, source.measure));
  const forceTolerance = 1e-10 * forceScale;
  const momentTolerance = 1e-10 * momentScale;
  const residual = freeze({
    forceX: clean(compiled.forceX - source.forceX),
    forceY: clean(compiled.forceY - source.forceY),
    momentZ: clean(compiled.momentZ - source.momentZ),
  });
  const status = Math.abs(residual.forceX) <= forceTolerance
    && Math.abs(residual.forceY) <= forceTolerance
    && Math.abs(residual.momentZ) <= momentTolerance ? 'PASS' : 'FAIL';
  return freeze({ status, forceTolerance, momentTolerance, residual });
}

function resultant(forceX, forceY, momentZ, measure) {
  return freeze({
    forceX: clean(forceX), forceY: clean(forceY), momentZ: clean(momentZ), measure: clean(measure),
    forceUnit: 'N', momentUnit: 'N*mm', measureUnit: 'mm', origin: freeze({ x: 0, y: 0 }),
  });
}

function resultantCompare(a, b) {
  const first = compare(a.attachmentId, b.attachmentId);
  return first || compare(a.caseId, b.caseId);
}
function requireObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}
function sha256(value, field) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    fail(`LAFEA_CONTINUUM_RESULTANT_${field}_INVALID`);
  }
  return value;
}
function finite(value, code) { if (typeof value !== 'number' || !Number.isFinite(value)) fail(code); return value; }
function clean(value) { return Object.is(value, -0) || Math.abs(value) < 1e-13 ? 0 : value; }
function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
