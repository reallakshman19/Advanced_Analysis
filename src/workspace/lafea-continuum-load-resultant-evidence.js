/** Source-vs-compiled distributed-load resultant custody for the LAFEA.3 compiler. */
import { consistentBodyForceVector } from '../core/local-continuum/body-force-loads.js';
import { integrateEdgeLoad } from '../core/local-continuum/edge-traction-loads.js';
import { lafeaUnitFactor } from '../core/lafea-common-input/units.js';
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import { validateLafeaContinuumProjectionEvidence } from './lafea-continuum-projection-evidence.js';

export const LAFEA_CONTINUUM_LOAD_RESULTANT_EVIDENCE_SCHEMA =
  'lafea-continuum-load-resultant-evidence/v1';
export const LAFEA_CONTINUUM_LOAD_RESULTANT_QUALIFIED_SCOPE =
  'CONSTANT_LINEAR_TRACTION_SOURCE_NORMAL_PRESSURE_AND_STRAIGHT_REGION_BODY_FORCE_V4';

const STAGE_ID = 'LAFEA.3';
const LINEAR_TRACTION_LAW = 'LINEAR_SOURCE_SEGMENT_TRACTION_V1';
const SOURCE_PRESSURE_LAW = 'SOURCE_GEOMETRY_INWARD_NORMAL_V1';
const SOURCE_PRESSURE_AUTHORITY = 'ANALYSIS_GEOMETRY_ORIENTED_SEGMENT_V1';
const BODY_FORCE_LAW = 'UNIFORM_SOURCE_REGION_BODY_FORCE_V1';
const BODY_FORCE_SOURCE_AUTHORITY = 'ANALYSIS_GEOMETRY_ORIENTED_REGION_BOUNDARY_V1';

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
    const thickness = uniformMappedThickness(attachment, elements, sections);

    if (attachment.kind === 'BODY_FORCE') {
      const factor = bodyForceFactor(attachment.payload.unit, model);
      const bx = finite(attachment.payload.bx, 'LAFEA_CONTINUUM_RESULTANT_BODY_FORCE_VALUE_INVALID') * factor;
      const by = finite(attachment.payload.by, 'LAFEA_CONTINUUM_RESULTANT_BODY_FORCE_VALUE_INVALID') * factor;
      const sourceRegionMoments = straightRegionAreaMoments(projectionEntry.sourceFeature.geometry);
      const source = sourceBodyForceResultant(sourceRegionMoments, thickness, bx, by);
      for (const caseId of attachment.physicalCaseIds) {
        const loadCase = cases.get(caseId);
        if (!loadCase) fail('LAFEA_CONTINUUM_RESULTANT_CASE_MISSING');
        const compiled = compiledBodyForceResultant(
          attachment, projectionEntry, loadCase, nodes, elements, sections, source.measure,
        );
        const comparison = compareResultants(source, compiled.resultant);
        if (comparison.status !== 'PASS') fail('LAFEA_CONTINUUM_LOAD_RESULTANT_MISMATCH');
        evaluated.push(freeze({
          attachmentId: attachment.attachmentId,
          caseId,
          kind: attachment.kind,
          bodyForceLaw: BODY_FORCE_LAW,
          sourceRegionAuthority: BODY_FORCE_SOURCE_AUTHORITY,
          sourceFeatureId: attachment.targetId,
          projectionId: projectionEntry.projectionId,
          contributionIds: [...projectionEntry.compiledContributionIds],
          sourceRegionMoments,
          sourceResultant: source,
          compiledResultant: compiled.resultant,
          equivalentNodalForces: compiled.equivalentNodalForces,
          comparison,
        }));
      }
      continue;
    }

    const factor = lafeaUnitFactor('stress', attachment.payload.unit);
    if (factor === null) fail('LAFEA_CONTINUUM_RESULTANT_DISTRIBUTED_STRESS_UNIT_UNSUPPORTED');

    if (attachment.kind === 'PRESSURE') {
      const source = sourcePressureResultant(
        projectionEntry.sourceFeature.geometry,
        thickness,
        finite(attachment.payload.pressure, 'LAFEA_CONTINUUM_RESULTANT_PRESSURE_VALUE_INVALID') * factor,
      );
      for (const caseId of attachment.physicalCaseIds) {
        const loadCase = cases.get(caseId);
        if (!loadCase) fail('LAFEA_CONTINUUM_RESULTANT_CASE_MISSING');
        const compiled = compiledSourcePressureResultant(
          attachment, projectionEntry, loadCase, nodes, source.measure,
        );
        const comparison = compareResultants(source, compiled.resultant);
        if (comparison.status !== 'PASS') fail('LAFEA_CONTINUUM_LOAD_RESULTANT_MISMATCH');
        evaluated.push(freeze({
          attachmentId: attachment.attachmentId,
          caseId,
          kind: attachment.kind,
          pressureLaw: SOURCE_PRESSURE_LAW,
          sourceBoundaryAuthority: SOURCE_PRESSURE_AUTHORITY,
          sourceFeatureId: attachment.targetId,
          projectionId: projectionEntry.projectionId,
          contributionIds: [...projectionEntry.compiledContributionIds],
          sourceResultant: source,
          compiledResultant: compiled.resultant,
          equivalentNodalForces: compiled.equivalentNodalForces,
          comparison,
        }));
      }
      continue;
    }

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
  const pressureSourceNormalQualified = evaluated.some((row) =>
    row.kind === 'PRESSURE'
    && row.pressureLaw === SOURCE_PRESSURE_LAW
    && row.sourceBoundaryAuthority === SOURCE_PRESSURE_AUTHORITY
    && row.comparison.status === 'PASS');
  const bodyForceResultantQualified = evaluated.some((row) =>
    row.kind === 'BODY_FORCE'
    && row.bodyForceLaw === BODY_FORCE_LAW
    && row.sourceRegionAuthority === BODY_FORCE_SOURCE_AUTHORITY
    && row.comparison.status === 'PASS');
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
    pressureSourceNormalQualified,
    linearTractionQualified,
    bodyForceResultantQualified,
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
  if (attachment.kind === 'BODY_FORCE') {
    const geometry = projection.sourceFeature?.geometry;
    if (projection.sourceFeature?.targetType !== 'REGION' || !Array.isArray(geometry?.loops)) {
      return 'SOURCE_REGION_BODY_FORCE_GEOMETRY_MISSING';
    }
    return geometry.loops.every((loop) =>
      Array.isArray(loop.segments) && loop.segments.length > 0
      && loop.segments.every((segment) => segment?.type === 'LINE'))
      ? null : 'CURVED_REGION_BODY_FORCE_RESULTANT_CERTIFICATION_PENDING';
  }
  if (attachment.kind === 'PRESSURE') {
    return ['LINE', 'CIRCULAR_ARC'].includes(projection.sourceFeature?.geometry?.type)
      ? null : 'SOURCE_NORMAL_PRESSURE_GEOMETRY_UNSUPPORTED';
  }
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

function sourcePressureResultant(geometry, thickness, pressure) {
  const ax = finite(geometry.start?.x, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  const ay = finite(geometry.start?.y, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  const bx = finite(geometry.end?.x, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  const by = finite(geometry.end?.y, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  requirePressureLoopBinding(geometry.loopBindings);
  const measure = sourceBoundaryMeasure(geometry, ax, ay, bx, by);
  const lineLoad = pressure * thickness;
  return resultant(
    -lineLoad * (by - ay),
    lineLoad * (bx - ax),
    0.5 * lineLoad * ((bx * bx + by * by) - (ax * ax + ay * ay)),
    measure,
  );
}

function sourceBoundaryMeasure(geometry, ax, ay, bx, by) {
  if (geometry.type === 'LINE') {
    const length = Math.hypot(bx - ax, by - ay);
    if (!(length > 0)) fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
    return length;
  }
  if (geometry.type !== 'CIRCULAR_ARC') {
    fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_PRESSURE_GEOMETRY_UNSUPPORTED');
  }
  const cx = finite(geometry.centerX, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  const cy = finite(geometry.centerY, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  const radius = finite(geometry.radius, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  if (!(radius > 0) || !['CCW', 'CW'].includes(geometry.sweep)) {
    fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  }
  const scale = Math.max(1, radius, Math.abs(cx), Math.abs(cy), Math.abs(ax), Math.abs(ay), Math.abs(bx), Math.abs(by));
  const tolerance = 1e-8 * scale;
  if (Math.abs(Math.hypot(ax - cx, ay - cy) - radius) > tolerance
    || Math.abs(Math.hypot(bx - cx, by - cy) - radius) > tolerance) {
    fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  }
  const a0 = Math.atan2(ay - cy, ax - cx);
  const a1 = Math.atan2(by - cy, bx - cx);
  const angle = geometry.sweep === 'CCW' ? ccw(a0, a1) : ccw(a1, a0);
  if (!(angle > 1e-12)) fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_GEOMETRY_INVALID');
  return radius * angle;
}

function requirePressureLoopBinding(bindings) {
  if (!Array.isArray(bindings) || bindings.length !== 1
    || typeof bindings[0]?.loopId !== 'string'
    || !['OUTER', 'HOLE'].includes(bindings[0]?.role)) {
    fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_PRESSURE_LOOP_BINDING_INVALID');
  }
  return bindings[0];
}

function straightRegionAreaMoments(geometry) {
  if (geometry?.orientationPolicy !== 'OUTER_CCW_HOLES_CW_V1'
    || !Array.isArray(geometry.loops) || !geometry.loops.length) {
    fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_REGION_GEOMETRY_INVALID');
  }
  let area = 0;
  let firstMomentX = 0;
  let firstMomentY = 0;
  let outerCount = 0;
  for (const loop of geometry.loops) {
    if (!['OUTER', 'HOLE'].includes(loop?.role)
      || !Array.isArray(loop.segments) || !loop.segments.length) {
      fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_REGION_GEOMETRY_INVALID');
    }
    let loopArea = 0;
    let loopFirstMomentX = 0;
    let loopFirstMomentY = 0;
    for (const segment of loop.segments) {
      if (segment?.type !== 'LINE') fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_REGION_GEOMETRY_INVALID');
      const x0 = finite(segment.start?.x, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_REGION_GEOMETRY_INVALID');
      const y0 = finite(segment.start?.y, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_REGION_GEOMETRY_INVALID');
      const x1 = finite(segment.end?.x, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_REGION_GEOMETRY_INVALID');
      const y1 = finite(segment.end?.y, 'LAFEA_CONTINUUM_RESULTANT_SOURCE_REGION_GEOMETRY_INVALID');
      const cross = x0 * y1 - x1 * y0;
      loopArea += 0.5 * cross;
      loopFirstMomentX += (x0 + x1) * cross / 6;
      loopFirstMomentY += (y0 + y1) * cross / 6;
    }
    const scale = Math.max(1, Math.abs(loopArea));
    if ((loop.role === 'OUTER' && !(loopArea > 1e-12 * scale))
      || (loop.role === 'HOLE' && !(loopArea < -1e-12 * scale))) {
      fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_REGION_ORIENTATION_INVALID');
    }
    if (loop.role === 'OUTER') outerCount += 1;
    area += loopArea;
    firstMomentX += loopFirstMomentX;
    firstMomentY += loopFirstMomentY;
  }
  if (outerCount !== 1 || !(area > 0)) {
    fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_REGION_GEOMETRY_INVALID');
  }
  return freeze({
    area: clean(area),
    firstMomentX: clean(firstMomentX),
    firstMomentY: clean(firstMomentY),
    centroidX: clean(firstMomentX / area),
    centroidY: clean(firstMomentY / area),
    areaUnit: 'mm^2',
    firstMomentUnit: 'mm^3',
  });
}

function sourceBodyForceResultant(region, thickness, bx, by) {
  return resultant(
    bx * thickness * region.area,
    by * thickness * region.area,
    thickness * (by * region.firstMomentX - bx * region.firstMomentY),
    region.area,
    'mm^2',
  );
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
  return compiledNodalResultant(
    attachment,
    projection,
    loadCase,
    nodes,
    measure,
    `COMPILED_ANALYTICAL_TRACTION#${attachment.attachmentId}/${LINEAR_TRACTION_LAW}/`,
  );
}

function compiledSourcePressureResultant(attachment, projection, loadCase, nodes, measure) {
  if (loadCase.pressureLoads.some((row) =>
    row.sourceReference === `COMPILED_ATTACHMENT#${attachment.attachmentId}`
    || row.pressureLoadId?.startsWith(`${attachment.attachmentId}/`))) {
    fail('LAFEA_CONTINUUM_RESULTANT_SOURCE_PRESSURE_NOT_LOWERED');
  }
  return compiledNodalResultant(
    attachment,
    projection,
    loadCase,
    nodes,
    measure,
    `COMPILED_SOURCE_PRESSURE#${attachment.attachmentId}/${SOURCE_PRESSURE_AUTHORITY}/`,
  );
}

function compiledBodyForceResultant(attachment, projection, loadCase, nodes, elements, sections, measure) {
  const expectedIds = new Set(projection.compiledContributionIds);
  const loads = loadCase.bodyForces.filter((row) =>
    row.sourceReference === `COMPILED_ATTACHMENT#${attachment.attachmentId}`);
  if (loads.length !== expectedIds.size
    || loads.some((row) => !expectedIds.has(row.bodyForceId))) {
    fail('LAFEA_CONTINUUM_RESULTANT_CONTRIBUTION_CUSTODY_MISMATCH');
  }
  let forceX = 0;
  let forceY = 0;
  let momentZ = 0;
  const equivalentNodalForces = [];
  for (const load of loads.sort((a, b) => compare(a.bodyForceId, b.bodyForceId))) {
    const element = elements.get(load.elementId);
    const section = sections.get(element?.sectionId);
    if (!element || !section) fail('LAFEA_CONTINUUM_RESULTANT_ELEMENT_SECTION_MISSING');
    const physicalNodes = element.nodeIds.map((nodeId) => nodes.get(nodeId));
    if (physicalNodes.some((node) => !node)) fail('LAFEA_CONTINUUM_RESULTANT_ELEMENT_NODE_MISSING');
    const forces = consistentBodyForceVector(
      element.elementType, physicalNodes, section.thickness, load.bx, load.by,
    );
    forces.forEach(([fx, fy], index) => {
      const node = physicalNodes[index];
      forceX += fx;
      forceY += fy;
      momentZ += node.x * fy - node.y * fx;
      equivalentNodalForces.push(freeze({
        contributionId: load.bodyForceId,
        nodeId: node.nodeId,
        fx: clean(fx),
        fy: clean(fy),
      }));
    });
  }
  return freeze({
    resultant: resultant(forceX, forceY, momentZ, measure, 'mm^2'),
    equivalentNodalForces: freeze(equivalentNodalForces),
  });
}

function compiledNodalResultant(attachment, projection, loadCase, nodes, measure, sourcePrefix) {
  const expectedIds = new Set(projection.compiledContributionIds);
  const loads = loadCase.nodalForces.filter((row) => expectedIds.has(row.loadId));
  if (loads.length !== expectedIds.size
    || loads.some((row) => !row.sourceReference.startsWith(sourcePrefix))) {
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

function bodyForceFactor(unit, model) {
  const forceUnit = model.declaredUnits?.force;
  const lengthUnit = model.declaredUnits?.length;
  const stressUnit = model.declaredUnits?.stress;
  const forceFactor = lafeaUnitFactor('force', forceUnit);
  const lengthFactor = lafeaUnitFactor('length', lengthUnit);
  const stressFactor = lafeaUnitFactor('stress', stressUnit);
  if (forceFactor === null || lengthFactor === null || stressFactor === null) {
    fail('LAFEA_CONTINUUM_RESULTANT_DECLARED_UNITS_INVALID');
  }
  if (unit === `${forceUnit}/${lengthUnit}^3`) return forceFactor / (lengthFactor ** 3);
  if (unit === `${stressUnit}/${lengthUnit}`) return stressFactor / lengthFactor;
  fail('LAFEA_CONTINUUM_RESULTANT_BODY_FORCE_UNIT_UNSUPPORTED');
}

function compareResultants(source, compiled) {
  const forceScale = Math.max(1, Math.hypot(source.forceX, source.forceY));
  const characteristicLength = source.measureUnit === 'mm^2'
    ? Math.sqrt(Math.max(0, source.measure)) : source.measure;
  const momentScale = Math.max(
    1, Math.abs(source.momentZ), forceScale * Math.max(1, characteristicLength),
  );
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

function resultant(forceX, forceY, momentZ, measure, measureUnit = 'mm') {
  return freeze({
    forceX: clean(forceX), forceY: clean(forceY), momentZ: clean(momentZ), measure: clean(measure),
    forceUnit: 'N', momentUnit: 'N*mm', measureUnit, origin: freeze({ x: 0, y: 0 }),
  });
}

function ccw(start, end) {
  let value = end - start;
  while (value < 0) value += Math.PI * 2;
  while (value >= Math.PI * 2) value -= Math.PI * 2;
  return value;
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
