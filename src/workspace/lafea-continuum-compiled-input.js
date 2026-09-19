/** Pure lowering from a validated compiled LAFEA.3 solver model into the existing continuum input contract. */
import { MODEL_SCHEMA } from '../core/local-continuum/index.js';
import { lafeaUnitFactor } from '../core/lafea-common-input/units.js';
import { integrateLafeaAnalyticalEdgeTraction } from './lafea-analytical-traction-lowering.js';
import { integrateLafeaSourcePressure } from './lafea-source-pressure-lowering.js';
import { appendLafeaDeltaTemperatureLoads } from './lafea-continuum-temperature-lowering.js';
import {
  LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_MODE,
  appendLafeaSourceNormalRestraintConstraints,
} from './lafea-continuum-local-restraint.js';

export function buildLafeaContinuumCompiledExecutionInput(model) {
  const sections = new Map(model.sections.map((row) => [row.sectionId, row]));
  const nodeIds = new Set(model.nodes.map((row) => row.nodeId));
  const elementIds = new Set(model.elements.map((row) => row.elementId));
  const caseMap = new Map(model.physicalCases.map((row) => [row.caseId, emptyCase(row.caseId)]));
  const constraints = [];
  const allCaseIds = [...caseMap.keys()].sort(compare);

  for (const attachment of model.attachments) {
    requireAttachmentCases(attachment, caseMap);
    requireCompiledTarget(attachment, nodeIds, elementIds);
    if (attachment.kind === 'RESTRAINT') {
      if (!sameIds(attachment.physicalCaseIds, allCaseIds)) {
        fail('LAFEA_CONTINUUM_COMPILED_CASE_SPECIFIC_RESTRAINT_UNSUPPORTED');
      }
      appendRestraints(constraints, attachment, model);
      continue;
    }
    for (const caseId of attachment.physicalCaseIds) {
      appendCaseAttachment(caseMap.get(caseId), attachment, model, sections);
    }
  }

  const hasAnalyticalTraction = model.attachments.some(
    (row) => row.kind === 'TRACTION' && typeof row.payload?.law === 'string',
  );
  const hasSourcePressure = model.attachments.some((row) => row.kind === 'PRESSURE');
  const hasTemperature = model.attachments.some((row) => row.kind === 'TEMPERATURE');
  const hasSourceNormalRestraint = model.attachments.some(
    (row) => row.kind === 'RESTRAINT'
      && row.payload?.mode === LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_MODE,
  );
  return {
    schema: MODEL_SCHEMA,
    modelIdentity: model.sourceModel.modelIdentity,
    modelVersion: model.sourceModel.modelVersion,
    sourceAncestry: { ...model.sourceModel.sourceAncestry },
    units: executionUnits(model.units),
    formulation: model.formulation,
    materials: materialInputs(model),
    nodes: nodeInputs(model),
    elements: elementInputs(model, sections),
    elementTypePolicy: { ...model.sourceModel.elementTypePolicy },
    constraints,
    loadCases: [...caseMap.values()],
    resultRequests: { loadCaseIds: [...model.requestedCaseIds] },
    qualificationProfile: structuredClone(model.qualificationProfile),
    limitations: [...new Set([
      ...model.limitations,
      'DOMAIN_FIRST_COMPILED_PARITY_EXECUTION_ONLY',
      ...(hasAnalyticalTraction ? ['ANALYTICAL_TRACTION_CONSISTENT_NODAL_LOWERING_V1'] : []),
      ...(hasSourcePressure ? ['SOURCE_NORMAL_PRESSURE_CONSISTENT_NODAL_LOWERING_V1'] : []),
      ...(hasTemperature ? ['GOVERNED_CONSTANT_ALPHA_DELTA_T_LOWERING_V1'] : []),
      ...(hasSourceNormalRestraint ? ['SOURCE_NORMAL_AXIS_ALIGNED_RESTRAINT_V1'] : []),
    ])].sort(compare),
  };
}

function executionUnits(units) {
  return {
    length: units.length,
    force: units.force,
    stress: units.stress,
    modulus: units.modulus,
  };
}

function materialInputs(model) {
  return model.materials.map((row) => ({
    materialId: row.materialId,
    elasticModulus: row.elasticModulus,
    poissonRatio: row.poissonRatio,
    sourceReference: ref(model, `MATERIAL/${row.materialId}`),
  }));
}

function nodeInputs(model) {
  return model.nodes.map((row) => ({
    nodeId: row.nodeId,
    x: row.x,
    y: row.y,
    sourceReference: ref(model, `NODE/${row.nodeId}`),
  }));
}

function elementInputs(model, sections) {
  return model.elements.map((row) => {
    const section = sections.get(row.sectionId);
    if (!section) fail('LAFEA_CONTINUUM_COMPILED_SECTION_REFERENCE_MISSING');
    return {
      elementId: row.elementId,
      elementType: row.elementType,
      nodeIds: [...row.nodeIds],
      materialId: row.materialId,
      thickness: section.thickness,
      sourceReference: ref(model, `ELEMENT/${row.elementId}`),
    };
  });
}

function appendRestraints(output, attachment, model) {
  if (attachment.payload?.mode === LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_MODE) {
    return appendLafeaSourceNormalRestraintConstraints({ output, attachment, model });
  }
  const payload = payloadObject(attachment, ['ux', 'uy'], []);
  const active = ['ux', 'uy'].filter((key) => payload[key] === true);
  for (const key of ['ux', 'uy']) {
    if (key in payload && typeof payload[key] !== 'boolean') {
      fail('LAFEA_CONTINUUM_COMPILED_RESTRAINT_PAYLOAD_INVALID');
    }
  }
  if (!active.length) fail('LAFEA_CONTINUUM_COMPILED_RESTRAINT_DOF_REQUIRED');
  for (const nodeId of attachment.compiledTarget.nodeIds) {
    for (const key of active) {
      const dof = key.toUpperCase();
      output.push({
        constraintId: `${attachment.attachmentId}/${nodeId}/${dof}`,
        nodeId,
        dof,
        value: 0,
        sourceReference: `COMPILED_ATTACHMENT#${attachment.attachmentId}`,
      });
    }
  }
}

function appendCaseAttachment(loadCase, attachment, model, sections) {
  if (attachment.kind === 'IMPOSED_DISPLACEMENT') return appendImposed(loadCase, attachment);
  if (attachment.kind === 'CONCENTRATED_LOAD') return appendForce(loadCase, attachment);
  if (attachment.kind === 'TRACTION') {
    if (typeof attachment.payload?.law === 'string') {
      return appendAnalyticalTraction(loadCase, attachment, model, sections);
    }
    return appendConstantTraction(loadCase, attachment);
  }
  if (attachment.kind === 'PRESSURE') return appendSourcePressure(loadCase, attachment, model, sections);
  if (attachment.kind === 'BODY_FORCE') return appendBodyForce(loadCase, attachment, model);
  if (attachment.kind === 'TEMPERATURE') {
    return appendLafeaDeltaTemperatureLoads({ loadCase, attachment, model });
  }
  fail('LAFEA_CONTINUUM_COMPILED_ATTACHMENT_KIND_UNSUPPORTED');
}

function appendImposed(loadCase, attachment) {
  const payload = payloadObject(attachment, ['ux', 'uy', 'unit'], ['unit']);
  const components = ['ux', 'uy'].filter((key) => key in payload);
  if (!components.length) fail('LAFEA_CONTINUUM_COMPILED_IMPOSED_DOF_REQUIRED');
  const factor = dimensionFactor('length', payload.unit);
  for (const key of components) {
    const value = finite(payload[key], 'LAFEA_CONTINUUM_COMPILED_IMPOSED_VALUE_INVALID') * factor;
    for (const nodeId of attachment.compiledTarget.nodeIds) {
      loadCase.imposedDisplacements.push({
        imposedDisplacementId: `${attachment.attachmentId}/${nodeId}/${key.toUpperCase()}`,
        nodeId,
        dof: key.toUpperCase(),
        value,
        sourceReference: `COMPILED_ATTACHMENT#${attachment.attachmentId}`,
      });
    }
  }
}

function appendForce(loadCase, attachment) {
  const payload = payloadObject(attachment, ['fx', 'fy', 'unit'], ['fx', 'fy', 'unit']);
  const [nodeId] = attachment.compiledTarget.nodeIds;
  if (attachment.compiledTarget.nodeIds.length !== 1) {
    fail('LAFEA_CONTINUUM_COMPILED_FORCE_VERTEX_MAPPING_INVALID');
  }
  const factor = dimensionFactor('force', payload.unit);
  loadCase.nodalForces.push({
    loadId: attachment.attachmentId,
    nodeId,
    fx: finite(payload.fx, 'LAFEA_CONTINUUM_COMPILED_FORCE_VALUE_INVALID') * factor,
    fy: finite(payload.fy, 'LAFEA_CONTINUUM_COMPILED_FORCE_VALUE_INVALID') * factor,
    sourceReference: `COMPILED_ATTACHMENT#${attachment.attachmentId}`,
  });
}

function appendConstantTraction(loadCase, attachment) {
  const payload = payloadObject(attachment, ['tx', 'ty', 'unit'], ['tx', 'ty', 'unit']);
  const target = attachment.compiledTarget;
  if (!target.edgeNodePaths.length || target.edgeNodePaths.length !== target.elementIds.length) {
    fail('LAFEA_CONTINUUM_COMPILED_EDGE_OWNER_MAPPING_INVALID');
  }
  const factor = dimensionFactor('stress', payload.unit);
  target.edgeNodePaths.forEach((edgeNodeIds, index) => {
    loadCase.edgeTractions.push({
      tractionId: `${attachment.attachmentId}/${index + 1}`,
      elementId: target.elementIds[index],
      edgeNodeIds: [...edgeNodeIds],
      sourceReference: `COMPILED_ATTACHMENT#${attachment.attachmentId}`,
      tx: finite(payload.tx, 'LAFEA_CONTINUUM_COMPILED_TRACTION_VALUE_INVALID') * factor,
      ty: finite(payload.ty, 'LAFEA_CONTINUUM_COMPILED_TRACTION_VALUE_INVALID') * factor,
    });
  });
}

function appendAnalyticalTraction(loadCase, attachment, model, sections) {
  const payload = attachment.payload;
  const target = attachment.compiledTarget;
  if (!target.edgeNodePaths.length || target.edgeNodePaths.length !== target.elementIds.length) {
    fail('LAFEA_CONTINUUM_COMPILED_EDGE_OWNER_MAPPING_INVALID');
  }
  const projectionEntry = requireSegmentProjection(
    model, attachment, 'LAFEA_CONTINUUM_COMPILED_ANALYTICAL_TRACTION_PROJECTION_REQUIRED',
  );
  const factor = dimensionFactor('stress', payload.unit);
  const nodeById = new Map(model.nodes.map((row) => [row.nodeId, row]));
  const elementById = new Map(model.elements.map((row) => [row.elementId, row]));
  target.edgeNodePaths.forEach((edgeNodeIds, edgeIndex) => {
    const elementId = target.elementIds[edgeIndex];
    const element = elementById.get(elementId);
    const section = sections.get(element?.sectionId);
    if (!element || !section) fail('LAFEA_CONTINUUM_COMPILED_SECTION_REFERENCE_MISSING');
    const edgeNodes = edgeNodeIds.map((nodeId) => nodeById.get(nodeId));
    if (edgeNodes.some((node) => !node)) fail('LAFEA_CONTINUUM_COMPILED_EDGE_NODE_REFERENCE_INVALID');
    const integrated = integrateLafeaAnalyticalEdgeTraction({
      payload,
      edgeNodes,
      thickness: section.thickness,
      stressFactor: factor,
      sourceFeatureGeometry: projectionEntry.sourceFeature.geometry,
    });
    integrated.nodalForces.forEach((force, nodeIndex) => {
      loadCase.nodalForces.push({
        loadId: `${attachment.attachmentId}/${edgeIndex + 1}/${nodeIndex + 1}/${force.nodeId}`,
        nodeId: force.nodeId,
        fx: force.fx,
        fy: force.fy,
        sourceReference: `COMPILED_ANALYTICAL_TRACTION#${attachment.attachmentId}/${integrated.lawId}/${integrated.quadratureId}`,
      });
    });
  });
}

function appendSourcePressure(loadCase, attachment, model, sections) {
  const payload = payloadObject(attachment, ['pressure', 'unit'], ['pressure', 'unit']);
  const target = attachment.compiledTarget;
  if (!target.edgeNodePaths.length || target.edgeNodePaths.length !== target.elementIds.length) {
    fail('LAFEA_CONTINUUM_COMPILED_EDGE_OWNER_MAPPING_INVALID');
  }
  const projectionEntry = requireSegmentProjection(
    model, attachment, 'LAFEA_CONTINUUM_COMPILED_SOURCE_PRESSURE_PROJECTION_REQUIRED',
  );
  const factor = dimensionFactor('stress', payload.unit);
  const nodeById = new Map(model.nodes.map((row) => [row.nodeId, row]));
  const elementById = new Map(model.elements.map((row) => [row.elementId, row]));
  target.edgeNodePaths.forEach((edgeNodeIds, edgeIndex) => {
    const elementId = target.elementIds[edgeIndex];
    const element = elementById.get(elementId);
    const section = sections.get(element?.sectionId);
    if (!element || !section) fail('LAFEA_CONTINUUM_COMPILED_SECTION_REFERENCE_MISSING');
    const edgeNodes = edgeNodeIds.map((nodeId) => nodeById.get(nodeId));
    if (edgeNodes.some((node) => !node)) fail('LAFEA_CONTINUUM_COMPILED_EDGE_NODE_REFERENCE_INVALID');
    const integrated = integrateLafeaSourcePressure({
      pressure: finite(payload.pressure, 'LAFEA_CONTINUUM_COMPILED_PRESSURE_VALUE_INVALID'),
      edgeNodes,
      thickness: section.thickness,
      stressFactor: factor,
      sourceFeatureGeometry: projectionEntry.sourceFeature.geometry,
    });
    integrated.nodalForces.forEach((force, nodeIndex) => {
      loadCase.nodalForces.push({
        loadId: `${attachment.attachmentId}/${edgeIndex + 1}/${nodeIndex + 1}/${force.nodeId}`,
        nodeId: force.nodeId,
        fx: force.fx,
        fy: force.fy,
        sourceReference: `COMPILED_SOURCE_PRESSURE#${attachment.attachmentId}/${integrated.sourceBoundaryAuthority}/${integrated.quadratureId}`,
      });
    });
  });
}

function requireSegmentProjection(model, attachment, code) {
  const projectionEntry = model.projectionEvidence?.entries?.find(
    (row) => row.attachmentId === attachment.attachmentId,
  );
  if (!projectionEntry
    || projectionEntry.sourceFeature?.targetType !== 'SEGMENT'
    || projectionEntry.sourceFeature?.featureId !== attachment.targetId
    || !projectionEntry.sourceFeature?.geometry) {
    fail(code);
  }
  return projectionEntry;
}

function appendBodyForce(loadCase, attachment, model) {
  if (!attachment.compiledTarget.elementIds.length) {
    fail('LAFEA_CONTINUUM_COMPILED_REGION_MAPPING_EMPTY');
  }
  const payload = payloadObject(attachment, ['bx', 'by', 'unit'], ['bx', 'by', 'unit']);
  const factor = bodyForceFactor(payload.unit, model);
  for (const elementId of attachment.compiledTarget.elementIds) {
    loadCase.bodyForces.push({
      bodyForceId: `${attachment.attachmentId}/${elementId}`,
      elementId,
      bx: finite(payload.bx, 'LAFEA_CONTINUUM_COMPILED_BODY_FORCE_VALUE_INVALID') * factor,
      by: finite(payload.by, 'LAFEA_CONTINUUM_COMPILED_BODY_FORCE_VALUE_INVALID') * factor,
      sourceReference: `COMPILED_ATTACHMENT#${attachment.attachmentId}`,
    });
  }
}

function requireAttachmentCases(attachment, caseMap) {
  if (!Array.isArray(attachment.physicalCaseIds) || !attachment.physicalCaseIds.length
    || attachment.physicalCaseIds.some((caseId) => !caseMap.has(caseId))) {
    fail('LAFEA_CONTINUUM_COMPILED_ATTACHMENT_CASE_INVALID');
  }
}

function requireCompiledTarget(attachment, nodeIds, elementIds) {
  const target = attachment.compiledTarget;
  if (!target || target.targetType !== attachment.targetType || target.featureId !== attachment.targetId
    || !Array.isArray(target.nodeIds) || !Array.isArray(target.edgeNodePaths)
    || !Array.isArray(target.elementIds)) {
    fail('LAFEA_CONTINUUM_COMPILED_TARGET_INVALID');
  }
  if (target.nodeIds.some((id) => !nodeIds.has(id))
    || target.elementIds.some((id) => !elementIds.has(id))) {
    fail('LAFEA_CONTINUUM_COMPILED_TARGET_REFERENCE_INVALID');
  }
  if (target.edgeNodePaths.flat().some((id) => !nodeIds.has(id))) {
    fail('LAFEA_CONTINUUM_COMPILED_EDGE_NODE_REFERENCE_INVALID');
  }
}

function payloadObject(attachment, allowed, required) {
  const value = attachment.payload;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('LAFEA_CONTINUUM_COMPILED_ATTACHMENT_PAYLOAD_INVALID');
  }
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))
    || required.some((key) => !(key in value))) {
    fail('LAFEA_CONTINUUM_COMPILED_ATTACHMENT_PAYLOAD_INVALID');
  }
  return value;
}

function dimensionFactor(dimension, unit) {
  const factor = lafeaUnitFactor(dimension, unit);
  if (factor === null) fail('LAFEA_CONTINUUM_COMPILED_ATTACHMENT_UNIT_UNSUPPORTED');
  return factor;
}

function bodyForceFactor(unit, model) {
  const forceUnit = model.declaredUnits?.force;
  const lengthUnit = model.declaredUnits?.length;
  const stressUnit = model.declaredUnits?.stress;
  const forceFactor = lafeaUnitFactor('force', forceUnit);
  const lengthFactor = lafeaUnitFactor('length', lengthUnit);
  const stressFactor = lafeaUnitFactor('stress', stressUnit);
  if (forceFactor === null || lengthFactor === null || stressFactor === null) {
    fail('LAFEA_CONTINUUM_COMPILED_DECLARED_UNITS_INVALID');
  }
  if (unit === `${forceUnit}/${lengthUnit}^3`) return forceFactor / (lengthFactor ** 3);
  if (unit === `${stressUnit}/${lengthUnit}`) return stressFactor / lengthFactor;
  fail('LAFEA_CONTINUUM_COMPILED_BODY_FORCE_UNIT_UNSUPPORTED');
}

function emptyCase(loadCaseId) {
  return {
    loadCaseId,
    nodalForces: [],
    edgeTractions: [],
    pressureLoads: [],
    bodyForces: [],
    temperatureLoads: [],
    imposedDisplacements: [],
    sourceReference: `COMPILED_CASE#${loadCaseId}`,
  };
}

function ref(model, suffix) { return `SOLVER_MODEL#${model.solverModelHash}/${suffix}`; }
function finite(value, code) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(code);
  return value;
}
function sameIds(left, right) {
  return JSON.stringify([...left].sort(compare)) === JSON.stringify([...right].sort(compare));
}
function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
