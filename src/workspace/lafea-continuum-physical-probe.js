import {
  CANONICAL_UNITS,
  principalStress,
  q8BMatrixAt,
  q8ShapeFunctionsAndDerivatives,
  t6BMatrixAt,
  t6ShapeFunctionsAndDerivatives,
  vonMisesStress,
} from '../core/local-continuum/index.js';
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';

export const LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA = 'lafea-continuum-physical-probe/v1';
export const LAFEA_CONTINUUM_PHYSICAL_PROBE_EVIDENCE_SCHEMA =
  'lafea-continuum-physical-probe-evidence/v1';
export const LAFEA_CONTINUUM_QUANTITY_IDENTITY_SCHEMA =
  'lafea-continuum-quantity-identity/v1';

export const LAFEA_CONTINUUM_PROBE_QUANTITIES = Object.freeze([
  'DISPLACEMENT_X', 'DISPLACEMENT_Y', 'DISPLACEMENT_MAGNITUDE',
  'STRAIN_EPSILON_X', 'STRAIN_EPSILON_Y', 'STRAIN_GAMMA_XY',
  'STRESS_SIGMA_X', 'STRESS_SIGMA_Y', 'STRESS_SIGMA_Z', 'STRESS_TAU_XY',
  'PRINCIPAL_MAXIMUM', 'PRINCIPAL_MINIMUM', 'VON_MISES',
]);
export const LAFEA_CONTINUUM_PROBE_SINGULARITY_CLASSES = Object.freeze([
  'NOT_APPLICABLE',
  'NON_SINGULAR_ANALYTICAL',
  'NON_SINGULAR_CONVERGENCE',
  'HIGH_GRADIENT_CONVERGENCE',
  'SINGULAR_EXCLUDED_FROM_POINTWISE_ACCEPTANCE',
]);

const STAGE_ID = 'LAFEA.3';
const FRAME = 'GLOBAL_XY';
const DIRECT_RECOVERY = 'ELEMENT_LOCAL_DIRECT_DISPLACEMENT_GRADIENT';
const DISPLACEMENT_RECOVERY = 'ELEMENT_SHAPE_INTERPOLATION';
const REPRESENTATION = 'PHYSICAL_POINT_DIRECT';
const NATURAL_TOLERANCE = 1e-9;
const MAPPING_RELATIVE_TOLERANCE = 1e-11;
const NEWTON_LIMIT = 40;
const STRESS_QUANTITIES = new Set([
  'STRESS_SIGMA_X', 'STRESS_SIGMA_Y', 'STRESS_SIGMA_Z', 'STRESS_TAU_XY',
  'PRINCIPAL_MAXIMUM', 'PRINCIPAL_MINIMUM', 'VON_MISES',
]);
const STRAIN_QUANTITIES = new Set([
  'STRAIN_EPSILON_X', 'STRAIN_EPSILON_Y', 'STRAIN_GAMMA_XY',
]);
const DISPLACEMENT_QUANTITIES = new Set([
  'DISPLACEMENT_X', 'DISPLACEMENT_Y', 'DISPLACEMENT_MAGNITUDE',
]);

export function createLafeaContinuumPhysicalProbe(value) {
  exactKeys(value, [
    'schema', 'probeId', 'physicalCoordinate', 'coordinateFrame', 'loadCaseId',
    'quantityId', 'representation', 'recoveryMethod', 'units', 'singularityClassification',
  ], 'probe');
  if (value.schema !== LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA) fail('LAFEA_G4_PROBE_SCHEMA_INVALID');
  exactKeys(value.physicalCoordinate, ['x', 'y'], 'probe.physicalCoordinate');
  const quantityId = enumValue(value.quantityId, LAFEA_CONTINUUM_PROBE_QUANTITIES, 'LAFEA_G4_PROBE_QUANTITY_INVALID');
  const expectedRecovery = DISPLACEMENT_QUANTITIES.has(quantityId)
    ? DISPLACEMENT_RECOVERY : DIRECT_RECOVERY;
  if (value.representation !== REPRESENTATION) fail('LAFEA_G4_PROBE_REPRESENTATION_INVALID');
  if (value.recoveryMethod !== expectedRecovery) fail('LAFEA_G4_PROBE_RECOVERY_METHOD_INVALID');
  if (value.coordinateFrame !== FRAME) fail('LAFEA_G4_PROBE_FRAME_INVALID');
  const units = text(value.units, 'LAFEA_G4_PROBE_UNITS_INVALID');
  if (units !== expectedUnits(quantityId)) fail('LAFEA_G4_PROBE_UNITS_INCOMPATIBLE');
  const singularityClassification = enumValue(
    value.singularityClassification,
    LAFEA_CONTINUUM_PROBE_SINGULARITY_CLASSES,
    'LAFEA_G4_PROBE_SINGULARITY_CLASS_INVALID',
  );
  if (DISPLACEMENT_QUANTITIES.has(quantityId)
    && singularityClassification !== 'NOT_APPLICABLE') {
    fail('LAFEA_G4_PROBE_DISPLACEMENT_SINGULARITY_CLASS_INVALID');
  }
  const normalized = {
    schema: LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA,
    probeId: text(value.probeId, 'LAFEA_G4_PROBE_ID_INVALID'),
    physicalCoordinate: {
      x: finite(value.physicalCoordinate.x, 'LAFEA_G4_PROBE_X_INVALID'),
      y: finite(value.physicalCoordinate.y, 'LAFEA_G4_PROBE_Y_INVALID'),
    },
    coordinateFrame: FRAME,
    loadCaseId: text(value.loadCaseId, 'LAFEA_G4_PROBE_LOAD_CASE_INVALID'),
    quantityId,
    representation: REPRESENTATION,
    recoveryMethod: expectedRecovery,
    units,
    singularityClassification,
  };
  return deepFreeze({
    ...normalized,
    probeIdentityHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-physical-probe-identity-hash/v1',
      probe: normalized,
    }),
  });
}

export function evaluateLafeaContinuumPhysicalProbe(stage, definitionValue) {
  const execution = requireCurrentExecution(stage);
  const probe = createLafeaContinuumPhysicalProbe(definitionValue);
  const canonicalInput = execution.canonicalInput;
  const result = execution.result;
  verifyCanonicalInputHash(execution);
  const physicalCase = canonicalInput.loadCases.find((row) => row.loadCaseId === probe.loadCaseId);
  if (!physicalCase) fail('LAFEA_G4_PROBE_LOAD_CASE_NOT_FOUND');
  if (Array.isArray(physicalCase.temperatureLoads) && physicalCase.temperatureLoads.length) {
    fail('LAFEA_G4_PROBE_TEMPERATURE_AUTHORITY_NOT_GRANTED');
  }
  const resultCase = result.loadCaseResults.find((row) => row.loadCaseId === probe.loadCaseId);
  if (!resultCase || !Array.isArray(resultCase.nodalDisplacements)) {
    fail('LAFEA_G4_PROBE_RESULT_CASE_INVALID');
  }
  const located = locatePhysicalPoint(canonicalInput, probe.physicalCoordinate);
  const elementEvidence = result.meshEvidence?.elementEvidence?.find(
    (row) => row.elementId === located.element.elementId,
  );
  if (!elementEvidence || !isMatrix(elementEvidence.dMatrix, 3, 3)) {
    fail('LAFEA_G4_PROBE_ELEMENT_RECOVERY_EVIDENCE_MISSING');
  }
  const displacementById = new Map(resultCase.nodalDisplacements.map((row) => [row.nodeId, row]));
  const supportingNodalDisplacements = located.element.nodeIds.map((nodeId) => {
    const row = displacementById.get(nodeId);
    if (!row || !Number.isFinite(row.ux) || !Number.isFinite(row.uy)) {
      fail('LAFEA_G4_PROBE_NODAL_DISPLACEMENT_INVALID');
    }
    return { nodeId, ux: zero(row.ux), uy: zero(row.uy) };
  });
  const localVector = supportingNodalDisplacements.flatMap((row) => [row.ux, row.uy]);
  const kinematics = pointKinematics(located, elementEvidence);
  const displacement = interpolateDisplacement(kinematics.shapeFunctions, supportingNodalDisplacements);
  const strainVector = matrixVector(kinematics.B, localVector);
  const stressVector = matrixVector(elementEvidence.dMatrix, strainVector);
  const material = canonicalInput.materials.find((row) => row.materialId === located.element.materialId);
  if (!material || !Number.isFinite(material.poissonRatio)) fail('LAFEA_G4_PROBE_MATERIAL_EVIDENCE_MISSING');
  const stress = {
    sigmaX: zero(stressVector[0]),
    sigmaY: zero(stressVector[1]),
    sigmaZ: canonicalInput.formulation === 'PLANE_STRAIN'
      ? zero(material.poissonRatio * (stressVector[0] + stressVector[1])) : 0,
    tauXY: zero(stressVector[2]),
  };
  const strain = {
    epsilonX: zero(strainVector[0]),
    epsilonY: zero(strainVector[1]),
    gammaXY: zero(strainVector[2]),
  };
  const principal = principalStress(stress.sigmaX, stress.sigmaY, stress.tauXY);
  const vonMises = vonMisesStress(
    stress.sigmaX, stress.sigmaY, stress.sigmaZ, stress.tauXY,
  );
  const quantityIdentity = deepFreeze({
    schema: LAFEA_CONTINUUM_QUANTITY_IDENTITY_SCHEMA,
    probeId: probe.probeId,
    physicalCoordinate: probe.physicalCoordinate,
    coordinateFrame: probe.coordinateFrame,
    loadCaseId: probe.loadCaseId,
    quantityId: probe.quantityId,
    representation: probe.representation,
    recoveryMethod: probe.recoveryMethod,
    units: probe.units,
    singularityClassification: probe.singularityClassification,
  });
  const base = {
    schema: LAFEA_CONTINUUM_PHYSICAL_PROBE_EVIDENCE_SCHEMA,
    stageId: STAGE_ID,
    probe,
    probeIdentityHash: probe.probeIdentityHash,
    quantityIdentity,
    quantityIdentityHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-quantity-identity-hash/v1', quantityIdentity,
    }),
    custody: {
      sourceHash: execution.sourceHash,
      meshHash: execution.meshHash,
      solverModelHash: execution.solverModelHash,
      executionHash: execution.compiledExecutionHash,
      canonicalExecutionInputHash: execution.canonicalExecutionInputHash,
      recoveryHash: stage.lifecycle.artifacts.RECOVERY.artifactHash,
    },
    mapping: {
      mappingClass: located.mappingClass,
      elementId: located.element.elementId,
      elementType: located.element.elementType,
      naturalCoordinates: located.naturalCoordinates,
      mappedPhysicalCoordinate: located.mappedPhysicalCoordinate,
      mappingResidual: located.mappingResidual,
      jacobianDeterminant: kinematics.jacobianDeterminant,
      containmentCandidateCount: 1,
    },
    supportingNodalDisplacements,
    displacement,
    strain,
    stressTensor: stress,
    principalMaximum: principal.maximum,
    principalMinimum: principal.minimum,
    vonMises,
    authoritativeValue: quantityValue(probe.quantityId, displacement, strain, stress, principal, vonMises),
    authoritativeUnits: probe.units,
    recoveryAuthority: probe.recoveryMethod,
    tensorFrame: FRAME,
    pointwiseAcceptanceEligible:
      probe.singularityClassification !== 'SINGULAR_EXCLUDED_FROM_POINTWISE_ACCEPTANCE',
    retainedIntegrationPointExtrapolationUsed: false,
    crossElementAveragingUsed: false,
    nodalStressProjectionUsed: false,
    displayInterpolationUsed: false,
    movingMaximumUsed: false,
    releaseAuthorityGranted: false,
    temperatureAuthorityGranted: false,
    status: 'PASS',
  };
  return deepFreeze({
    ...base,
    semanticHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-physical-probe-evidence-hash/v1', evidence: base,
    }),
  });
}

function requireCurrentExecution(stage) {
  if (!stage || stage.stageId !== STAGE_ID) fail('LAFEA_G4_PROBE_STAGE_INVALID');
  if (stage.currentness?.currentAuthority !== true
    || stage.currentness?.computationalState !== 'CURRENT_RESULT') {
    fail('LAFEA_G4_PROBE_CURRENT_EXECUTION_REQUIRED');
  }
  const execution = stage.execution;
  if (!execution || execution.status !== 'QUALIFIED'
    || !execution.canonicalInput || !execution.result
    || execution.result.qualification?.state !== 'ACCEPTED') {
    fail('LAFEA_G4_PROBE_ACCEPTED_EXECUTION_REQUIRED');
  }
  if (stage.analysisMeshCustodyProjection?.state !== 'CURRENT_PASS'
    || stage.analysisMeshCustodyProjection?.meshHash !== execution.meshHash) {
    fail('LAFEA_G4_PROBE_MESH_CUSTODY_MISMATCH');
  }
  const recovery = stage.lifecycle?.artifacts?.RECOVERY;
  if (!recovery || recovery.status !== 'CURRENT' || recovery.qualification !== 'PASS'
    || !recovery.artifactHash) {
    fail('LAFEA_G4_PROBE_RECOVERY_CUSTODY_REQUIRED');
  }
  return execution;
}

function verifyCanonicalInputHash(execution) {
  const expected = canonicalLafeaSha256({
    schema: 'lafea-continuum-compiled-execution-input-hash/v1',
    canonicalInput: execution.canonicalInput,
  });
  if (expected !== execution.canonicalExecutionInputHash) {
    fail('LAFEA_G4_PROBE_CANONICAL_INPUT_HASH_MISMATCH');
  }
}

function locatePhysicalPoint(model, point) {
  const nodeMap = new Map(model.nodes.map((row) => [row.nodeId, row]));
  const candidates = [];
  for (const element of model.elements) {
    if (!['T3', 'T6', 'Q8'].includes(element.elementType)) continue;
    const nodes = element.nodeIds.map((id) => nodeMap.get(id));
    if (nodes.some((node) => !node)) fail('LAFEA_G4_PROBE_MESH_NODE_MISSING');
    if (!insideBoundingBox(nodes, point)) continue;
    const mapped = invertElement(element.elementType, nodes, point);
    if (!mapped || !insideNatural(element.elementType, mapped.xi, mapped.eta)) continue;
    const margin = naturalMargin(element.elementType, mapped.xi, mapped.eta);
    candidates.push({ element, nodes, mapped, margin });
  }
  if (!candidates.length) fail('LAFEA_G4_PROBE_OUTSIDE_MESH');
  if (candidates.length !== 1) fail('LAFEA_G4_PROBE_ELEMENT_AMBIGUOUS');
  const found = candidates[0];
  const mappedPhysicalCoordinate = mapNatural(found.element.elementType, found.nodes, found.mapped.xi, found.mapped.eta);
  return {
    ...found,
    mappingClass: found.margin > NATURAL_TOLERANCE ? 'INTERIOR' : 'BOUNDARY_SINGLE_OWNER',
    naturalCoordinates: deepFreeze(naturalCoordinates(found.element.elementType, found.mapped.xi, found.mapped.eta)),
    mappedPhysicalCoordinate: deepFreeze({ x: zero(mappedPhysicalCoordinate.x), y: zero(mappedPhysicalCoordinate.y) }),
    mappingResidual: Math.hypot(mappedPhysicalCoordinate.x - point.x, mappedPhysicalCoordinate.y - point.y),
  };
}

function pointKinematics(located, elementEvidence) {
  const { element, nodes, mapped } = located;
  if (element.elementType === 'T3') {
    if (!isMatrix(elementEvidence.bMatrix, 3, 6)) fail('LAFEA_G4_PROBE_T3_B_MATRIX_MISSING');
    const jacobianDeterminant = (nodes[1].x - nodes[0].x) * (nodes[2].y - nodes[0].y)
      - (nodes[1].y - nodes[0].y) * (nodes[2].x - nodes[0].x);
    if (!(jacobianDeterminant > 0)) fail('LAFEA_G4_PROBE_ELEMENT_ORIENTATION_INVALID');
    return {
      B: elementEvidence.bMatrix,
      shapeFunctions: [1 - mapped.xi - mapped.eta, mapped.xi, mapped.eta],
      jacobianDeterminant,
    };
  }
  if (element.elementType === 'T6') {
    const kinematics = t6BMatrixAt(nodes, mapped.xi, mapped.eta);
    return { ...kinematics, shapeFunctions: t6ShapeFunctionsAndDerivatives(mapped.xi, mapped.eta).N };
  }
  if (element.elementType === 'Q8') {
    const kinematics = q8BMatrixAt(nodes, mapped.xi, mapped.eta);
    return { ...kinematics, shapeFunctions: q8ShapeFunctionsAndDerivatives(mapped.xi, mapped.eta).N };
  }
  fail('LAFEA_G4_PROBE_ELEMENT_TYPE_UNSUPPORTED');
}

function invertElement(type, nodes, point) {
  if (type === 'T3') return invertTriangle(nodes.slice(0, 3), point);
  let xi = 0; let eta = 0;
  if (type === 'T6') {
    const seed = invertTriangle(nodes.slice(0, 3), point);
    if (seed) { xi = seed.xi; eta = seed.eta; }
  }
  for (let iteration = 0; iteration < NEWTON_LIMIT; iteration += 1) {
    const shape = shapeData(type, xi, eta);
    const mapped = mapFromShape(nodes, shape.N);
    const residualX = point.x - mapped.x;
    const residualY = point.y - mapped.y;
    const jacobian = mappingJacobian(nodes, shape.dNdXi, shape.dNdEta);
    if (!(jacobian.determinant > 0)) fail('LAFEA_G4_PROBE_NONPOSITIVE_JACOBIAN');
    const scale = Math.max(1, elementSize(nodes));
    if (Math.hypot(residualX, residualY) <= MAPPING_RELATIVE_TOLERANCE * scale) {
      return { xi: zero(xi), eta: zero(eta) };
    }
    const dXi = (jacobian.dyDeta * residualX - jacobian.dxDeta * residualY) / jacobian.determinant;
    const dEta = (-jacobian.dyDxi * residualX + jacobian.dxDxi * residualY) / jacobian.determinant;
    xi += dXi; eta += dEta;
    if (!Number.isFinite(xi) || !Number.isFinite(eta)) return null;
  }
  return null;
}

function invertTriangle(nodes, point) {
  const [a, b, c] = nodes;
  const determinant = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (!(determinant > 0)) fail('LAFEA_G4_PROBE_ELEMENT_ORIENTATION_INVALID');
  return {
    xi: ((point.x - a.x) * (c.y - a.y) - (point.y - a.y) * (c.x - a.x)) / determinant,
    eta: ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) / determinant,
  };
}

function shapeData(type, xi, eta) {
  if (type === 'T6') return t6ShapeFunctionsAndDerivatives(xi, eta);
  if (type === 'Q8') return q8ShapeFunctionsAndDerivatives(xi, eta);
  fail('LAFEA_G4_PROBE_MAPPING_ELEMENT_TYPE_UNSUPPORTED');
}
function mapNatural(type, nodes, xi, eta) {
  if (type === 'T3') return mapFromShape(nodes, [1 - xi - eta, xi, eta]);
  return mapFromShape(nodes, shapeData(type, xi, eta).N);
}
function mapFromShape(nodes, shape) {
  return {
    x: shape.reduce((sum, value, index) => sum + value * nodes[index].x, 0),
    y: shape.reduce((sum, value, index) => sum + value * nodes[index].y, 0),
  };
}
function mappingJacobian(nodes, dNdXi, dNdEta) {
  let dxDxi = 0; let dyDxi = 0; let dxDeta = 0; let dyDeta = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    dxDxi += dNdXi[index] * nodes[index].x;
    dyDxi += dNdXi[index] * nodes[index].y;
    dxDeta += dNdEta[index] * nodes[index].x;
    dyDeta += dNdEta[index] * nodes[index].y;
  }
  return { dxDxi, dyDxi, dxDeta, dyDeta,
    determinant: dxDxi * dyDeta - dxDeta * dyDxi };
}
function insideNatural(type, xi, eta) {
  if (type === 'Q8') return Math.abs(xi) <= 1 + NATURAL_TOLERANCE
    && Math.abs(eta) <= 1 + NATURAL_TOLERANCE;
  return xi >= -NATURAL_TOLERANCE && eta >= -NATURAL_TOLERANCE
    && xi + eta <= 1 + NATURAL_TOLERANCE;
}
function naturalMargin(type, xi, eta) {
  return type === 'Q8'
    ? Math.min(1 - Math.abs(xi), 1 - Math.abs(eta))
    : Math.min(xi, eta, 1 - xi - eta);
}
function naturalCoordinates(type, xi, eta) {
  return type === 'Q8' ? { xi: zero(xi), eta: zero(eta) }
    : { xi: zero(xi), eta: zero(eta), lambda1: zero(1 - xi - eta), lambda2: zero(xi), lambda3: zero(eta) };
}
function insideBoundingBox(nodes, point) {
  const xs = nodes.map((node) => node.x), ys = nodes.map((node) => node.y);
  const scale = Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const tolerance = MAPPING_RELATIVE_TOLERANCE * scale;
  return point.x >= Math.min(...xs) - tolerance && point.x <= Math.max(...xs) + tolerance
    && point.y >= Math.min(...ys) - tolerance && point.y <= Math.max(...ys) + tolerance;
}
function elementSize(nodes) {
  const xs = nodes.map((node) => node.x), ys = nodes.map((node) => node.y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function interpolateDisplacement(shape, rows) {
  return {
    ux: zero(shape.reduce((sum, value, index) => sum + value * rows[index].ux, 0)),
    uy: zero(shape.reduce((sum, value, index) => sum + value * rows[index].uy, 0)),
  };
}
function quantityValue(quantityId, displacement, strain, stress, principal, vonMises) {
  const values = {
    DISPLACEMENT_X: displacement.ux,
    DISPLACEMENT_Y: displacement.uy,
    DISPLACEMENT_MAGNITUDE: Math.hypot(displacement.ux, displacement.uy),
    STRAIN_EPSILON_X: strain.epsilonX,
    STRAIN_EPSILON_Y: strain.epsilonY,
    STRAIN_GAMMA_XY: strain.gammaXY,
    STRESS_SIGMA_X: stress.sigmaX,
    STRESS_SIGMA_Y: stress.sigmaY,
    STRESS_SIGMA_Z: stress.sigmaZ,
    STRESS_TAU_XY: stress.tauXY,
    PRINCIPAL_MAXIMUM: principal.maximum,
    PRINCIPAL_MINIMUM: principal.minimum,
    VON_MISES: vonMises,
  };
  if (!(quantityId in values)) fail('LAFEA_G4_PROBE_QUANTITY_UNSUPPORTED');
  return zero(values[quantityId]);
}
function expectedUnits(quantityId) {
  if (DISPLACEMENT_QUANTITIES.has(quantityId)) return CANONICAL_UNITS.length;
  if (STRAIN_QUANTITIES.has(quantityId)) return CANONICAL_UNITS.strain;
  if (STRESS_QUANTITIES.has(quantityId)) return CANONICAL_UNITS.stress;
  fail('LAFEA_G4_PROBE_QUANTITY_UNSUPPORTED');
}
function matrixVector(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}
function isMatrix(value, rows, columns) {
  return Array.isArray(value) && value.length === rows
    && value.every((row) => Array.isArray(row) && row.length === columns && row.every(Number.isFinite));
}
function exactKeys(value, expected, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`LAFEA_G4_${path.toUpperCase().replaceAll('.', '_')}_INVALID`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail('LAFEA_G4_PROBE_KEYS_INVALID');
}
function enumValue(value, allowed, code) { if (!allowed.includes(value)) fail(code); return value; }
function text(value, code) { if (typeof value !== 'string' || !value.trim()) fail(code); return value.trim(); }
function finite(value, code) { if (!Number.isFinite(value)) fail(code); return value; }
function zero(value) { return Math.abs(value) < 1e-15 ? 0 : value; }
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
