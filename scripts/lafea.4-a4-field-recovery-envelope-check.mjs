#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  CANONICAL_UNITS,
  MITC_PRODUCTION_FORMULATION_FAMILY,
  MITC_PRODUCTION_LIMITATIONS,
  MITC_PRODUCTION_MODEL_SCHEMA,
  MITC_PRODUCTION_RESULT_REQUEST,
  calculateLocalShell,
  createCanonicalMitcProductionModel,
} from '../src/core/local-shell/index.js';
import { MITC3_TOPOLOGY, MITC4_TOPOLOGY } from '../src/core/local-shell/mitc-adoption-model.js';
import { MITC3_FORMULATION } from '../src/core/local-shell/mitc3-element.js';
import {
  MITC4_FORMULATION,
  MITC4_GAUSS_POINTS,
  MITC4_TYING_POINTS,
  jacobianAt,
  q4ShapeFunctionsAndDerivatives,
} from '../src/core/local-shell/mitc4-element.js';
import { flatNode, qualificationProfile } from './lafea.4-fixtures.mjs';

const E = 200000;
const NU = 0.3;
const T = 2;
const D = planeStressMatrix(E, NU);
const EPSILON = Object.freeze([0.0004, -0.0001, 0.00015]);
const KAPPA = Object.freeze([0.00008, -0.00003, 0.00001]);

const affine = [];
for (const family of [
  { name: 'MITC4', formulation: MITC4_FORMULATION, topology: MITC4_TOPOLOGY, points: [[0, 0], [4, 0], [4, 3], [0, 3]] },
  { name: 'MITC3', formulation: MITC3_FORMULATION, topology: MITC3_TOPOLOGY, points: [[0, 0], [4, 0], [0, 3]] },
]) {
  affine.push(checkAffineMembrane(family, 0));
  affine.push(checkAffineMembrane(family, Math.PI / 7));
}

const bending = [
  checkControlledBending({ name: 'MITC4', formulation: MITC4_FORMULATION, topology: MITC4_TOPOLOGY, points: [[0, 0], [4, 0], [4, 3], [0, 3]] }),
  checkControlledBending({ name: 'MITC3', formulation: MITC3_FORMULATION, topology: MITC3_TOPOLOGY, points: [[0, 0], [4, 0], [0, 3]] }),
];

const moderateThickness = [
  checkModerateStrip(MITC4_FORMULATION, MITC4_TOPOLOGY, 'MITC4'),
  checkModerateStrip(MITC3_FORMULATION, MITC3_TOPOLOGY, 'MITC3'),
];

const distortion = inspectNearSingularQ4();
const tyingPointInversion = checkTyingPointInversionRejected();
const pressure = checkDeformableDistortedPressure();

const b8Classification = Object.freeze([
  classifyHistoricalBenchmark('LAFEA4-CYL-01', 'PRESCRIBED_CIRCUMFERENTIAL_STRAIN_AND_PLANE_STRESS_CONVERGENCE'),
  classifyHistoricalBenchmark('LAFEA4-PRESS-01', 'P_TIMES_AREA_CENTROID_FIRST_MOMENT_AND_REACTION_FREE_BODY'),
  classifyHistoricalBenchmark('LAFEA4-COMB-01', 'AFFINE_MEMBRANE_PLUS_CURVATURE_PLUS_PRESSURE_ANALYTICAL_ENERGY'),
]);

console.log(JSON.stringify({
  schema: 'lafea4-a4-field-recovery-envelope-check/v1',
  status: 'PASS_WITH_EXPLICIT_BLOCKERS',
  oracleAuthority: 'INDEPENDENT_CLOSED_FORM_KINEMATICS_PLANE_STRESS_TIMOSHENKO_AND_FREE_BODY',
  productionOutputUsedToChooseExpectedValues: false,
  productionOutputUsedToChooseTolerance: false,
  cstDktUsedAsSoleOracle: false,
  releaseAuthorityGranted: false,
  affineMembrane: affine,
  controlledBending: bending,
  moderateThickness,
  distortion,
  tyingPointInversion,
  deformablePressure: pressure,
  b8Classification,
  blockers: [
    'B6_NEAR_SINGULAR_Q4_HAS_NO_OWNER_AUTHORIZED_NORMALIZED_JACOBIAN_QUALITY_THRESHOLD',
    'B8_HISTORICAL_CYL_PRESS_COMB_SCRIPT_RUNS_V1_CST_DKT_NOT_MITC_V2_ROUTE',
    'B9_THREE_COLUMN_INDEPENDENT_CST_DKT_MITC_TABLE_NOT_CLOSED_IN_THIS_LEG',
  ],
}, null, 2));

console.log('\n✅ A4 LEG-002 field/recovery/envelope checker passed its bounded assertions; declared blockers remain blockers, not promoted PASS.');

function checkAffineMembrane(family, angle) {
  const nodes = rotatedNodes(family.points, angle, `${family.name}-A`);
  const constraints = nodes.flatMap((node) => {
    const [x, y] = node.position;
    const [ex, ey, gxy] = EPSILON;
    return prescribed(node.nodeId, [
      ex * x + 0.5 * gxy * y,
      ey * y + 0.5 * gxy * x,
      0,
      0,
      0,
    ]);
  });
  const result = solveProduction(singleElementSource({
    modelIdentity: `${family.name}-A4-AFFINE-${angle === 0 ? 'AXIS' : 'ROT'}`,
    nodes,
    formulation: family.formulation,
    topology: family.topology,
    thickness: T,
    constraints,
  }));
  const loadCase = result.loadCaseResults[0];
  const element = loadCase.elementResults[0];
  const meshElement = result.meshEvidence.elements[0];
  const expectedLocal = rotateEngineeringTensor(EPSILON, meshElement.localFrame);
  const expectedStress = matVec(D, expectedLocal);

  for (const point of element.integrationPoints) {
    recordClose(point.membraneStrain, expectedLocal, ['epsilonX', 'epsilonY', 'gammaXY'], 2e-10);
    recordClose(point.curvature, [0, 0, 0], ['kappaX', 'kappaY', 'kappaXY'], 2e-10);
    recordClose(point.transverseShearStrain, [0, 0], ['gammaXZ', 'gammaYZ'], 2e-10);
    recordClose(point.transverseShearResultant, [0, 0], ['qX', 'qY'], 2e-8);
    for (const surface of point.surfaces) {
      recordClose(surface.combinedStress, expectedStress, ['sigmaX', 'sigmaY', 'tauXY'], 2e-8);
      assert.equal(surface.invariantAuthority, 'PLANE_STRESS_SAME_POINT_IN_PLANE_ONLY');
    }
  }

  const area = polygonArea(nodes.map((node) => node.position));
  const expectedEnergy = 0.5 * area * T * dot(EPSILON, matVec(D, EPSILON));
  close(loadCase.membraneStrainEnergy, expectedEnergy, 2e-8, `${family.name} affine membrane energy`);
  close(loadCase.bendingStrainEnergy, 0, 2e-8, `${family.name} affine bending energy`);
  close(loadCase.transverseShearStrainEnergy, 0, 2e-8, `${family.name} affine shear energy`);
  close(loadCase.totalStrainEnergy, expectedEnergy, 2e-8, `${family.name} affine total energy`);
  assert.equal(loadCase.energyQualification.accepted, true);

  return Object.freeze({
    formulation: family.formulation,
    orientationRad: angle,
    expectedGlobalStrain: [...EPSILON],
    expectedLocalStrain: expectedLocal,
    expectedLocalStress: expectedStress,
    expectedEnergy,
    status: 'PASS',
  });
}

function checkControlledBending(family) {
  const nodes = rotatedNodes(family.points, 0, `${family.name}-B`);
  const [kx, ky, kxy] = KAPPA;
  const constraints = nodes.flatMap((node) => {
    const [x, y] = node.position;
    const w = -0.5 * kx * x ** 2 - 0.5 * ky * y ** 2 - 0.5 * kxy * x * y;
    const betaX = kx * x + 0.5 * kxy * y;
    const betaY = 0.5 * kxy * x + ky * y;
    // production retained rotations are physical tangent rotations:
    // betaX = omega_y = R2, betaY = -omega_x = -R1.
    return prescribed(node.nodeId, [0, 0, w, -betaY, betaX]);
  });
  const result = solveProduction(singleElementSource({
    modelIdentity: `${family.name}-A4-CONTROLLED-BENDING`,
    nodes,
    formulation: family.formulation,
    topology: family.topology,
    thickness: T,
    constraints,
  }));
  const loadCase = result.loadCaseResults[0];
  const element = loadCase.elementResults[0];
  const bendingRigidity = T ** 3 / 12;
  const expectedMoment = matVec(D, KAPPA).map((value) => value * bendingRigidity);
  let maximumShear = 0;

  for (const point of element.integrationPoints) {
    recordClose(point.membraneStrain, [0, 0, 0], ['epsilonX', 'epsilonY', 'gammaXY'], 3e-10);
    recordClose(point.curvature, KAPPA, ['kappaX', 'kappaY', 'kappaXY'], 3e-10);
    const shear = [point.transverseShearStrain.gammaXZ, point.transverseShearStrain.gammaYZ];
    maximumShear = Math.max(maximumShear, ...shear.map(Math.abs));
    vectorClose(shear, [0, 0], 5e-10, `${family.name} controlled-bending shear`);

    const actualCurvature = [point.curvature.kappaX, point.curvature.kappaY, point.curvature.kappaXY];
    const recoveredMoment = matVec(D, actualCurvature).map((value) => value * bendingRigidity);
    vectorClose(recoveredMoment, expectedMoment, 3e-8, `${family.name} bending resultant`);

    for (const surface of point.surfaces) {
      const z = surface.z;
      const expectedStress = matVec(D, KAPPA.map((value) => z * value));
      recordClose(surface.combinedStress, expectedStress, ['sigmaX', 'sigmaY', 'tauXY'], 3e-8);
    }
  }

  const area = polygonArea(nodes.map((node) => node.position));
  const expectedEnergy = 0.5 * area * bendingRigidity * dot(KAPPA, matVec(D, KAPPA));
  close(loadCase.membraneStrainEnergy, 0, 3e-8, `${family.name} bending membrane energy`);
  close(loadCase.transverseShearStrainEnergy, 0, 3e-8, `${family.name} bending shear energy`);
  close(loadCase.bendingStrainEnergy, expectedEnergy, 3e-8, `${family.name} bending energy`);
  close(loadCase.totalStrainEnergy, expectedEnergy, 3e-8, `${family.name} bending total energy`);

  return Object.freeze({
    formulation: family.formulation,
    curvature: [...KAPPA],
    expectedMoment,
    expectedEnergy,
    maximumRecoveredShearStrain: maximumShear,
    status: 'PASS',
  });
}

function checkModerateStrip(formulation, topology, label) {
  const L = 10;
  const b = 1;
  const P = 1;
  const t = 2;
  const nu = 0;
  const G = E / (2 * (1 + nu));
  const k = 5 / 6;
  const area = b * t;
  const inertia = b * t ** 3 / 12;
  const bending = P * L ** 3 / (3 * E * inertia);
  const shear = P * L / (k * G * area);
  const theory = bending + shear;
  const shearFraction = shear / theory;
  const along = 8;
  const nodes = [];
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i <= along; i += 1) {
      nodes.push(flatNode(`N${row}-${i}`, i * L / along, row * b));
    }
  }
  const elements = [];
  for (let i = 0; i < along; i += 1) {
    const a = `N0-${i}`;
    const b0 = `N0-${i + 1}`;
    const c = `N1-${i + 1}`;
    const d = `N1-${i}`;
    if (formulation === MITC4_FORMULATION) {
      elements.push(productionElement(`Q${i}`, formulation, topology, [a, b0, c, d], t));
    } else {
      elements.push(
        productionElement(`T${i}A`, formulation, topology, [a, b0, c], t),
        productionElement(`T${i}B`, formulation, topology, [a, c, d], t),
      );
    }
  }
  const constraints = nodes.flatMap((node) => {
    const rows = [constraint(node.nodeId, 'UX', 0), constraint(node.nodeId, 'UY', 0)];
    if (node.position[0] === 0) {
      rows.push(
        constraint(node.nodeId, 'UZ', 0),
        constraint(node.nodeId, 'R1', 0),
        constraint(node.nodeId, 'R2', 0),
      );
    }
    return rows;
  });
  const loadCases = [{
    loadCaseId: `${label}-TOVERL-0.2`,
    nodalLoads: [
      nodalLoad(`N0-${along}`, P / 2),
      nodalLoad(`N1-${along}`, P / 2),
    ],
    pressureLoads: [],
    sourceReference: `${label}-TOVERL-0.2-SRC`,
  }];
  const result = solveProduction(productionSource({
    modelIdentity: `${label}-A4-TOVERL-0.2`,
    poissonRatio: nu,
    nodes,
    elements,
    constraints,
    loadCases,
  }));
  const loadCase = result.loadCaseResults[0];
  const tip = loadCase.nodalDisplacements
    .filter((row) => row.nodeId === `N0-${along}` || row.nodeId === `N1-${along}`)
    .map((row) => row.uz);
  assert.equal(tip.length, 2);
  const deflection = Math.abs((tip[0] + tip[1]) / 2);
  const ratio = deflection / theory;
  assert.ok(ratio > 0.98 && ratio < 1.02, `${label} t/L=0.2 production deflection/theory=${ratio}`);

  const externalWorkEnergy = 0.5 * P * deflection;
  close(loadCase.totalStrainEnergy, externalWorkEnergy, 2e-8, `${label} strain energy vs 1/2 P delta`);
  assert.ok(loadCase.bendingStrainEnergy > 0, `${label} must retain bending energy`);
  assert.ok(loadCase.transverseShearStrainEnergy > 0, `${label} must retain physical shear energy`);
  const recoveredShearFraction = loadCase.transverseShearStrainEnergy / loadCase.totalStrainEnergy;
  assert.ok(
    Math.abs(recoveredShearFraction - shearFraction) < 0.01,
    `${label} shear-energy fraction ${recoveredShearFraction} not consistent with independent ${shearFraction}`,
  );
  assert.equal(loadCase.forceEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.momentEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.energyQualification.accepted, true);

  return Object.freeze({
    formulation,
    tOverL: t / L,
    analyticalBendingDeflection: bending,
    analyticalShearDeflection: shear,
    analyticalTotalDeflection: theory,
    analyticalShearFraction: shearFraction,
    productionTipDeflection: deflection,
    productionOverTheory: ratio,
    recoveredBendingEnergy: loadCase.bendingStrainEnergy,
    recoveredShearEnergy: loadCase.transverseShearStrainEnergy,
    recoveredTotalEnergy: loadCase.totalStrainEnergy,
    recoveredShearEnergyFraction: recoveredShearFraction,
    solverMethod: loadCase.solverEvidence.method,
    status: 'PASS',
  });
}

function inspectNearSingularQ4() {
  const healthy = [[0, 0], [4, 0], [5, 3], [0, 2]];
  const near = [[0, 0], [4, 0], [4, 1e-6], [0, 2e-6]];
  const healthyDets = governingJacobians(healthy);
  const nearDets = governingJacobians(near);
  assert.ok(Math.min(...healthyDets) > 0);
  assert.ok(Math.min(...nearDets) > 0);
  const scale = maximumPairDistance(near) ** 2;
  const normalizedMinimum = Math.min(...nearDets) / scale;
  assert.ok(normalizedMinimum < 1e-6, `near-singular control must be materially ill-shaped; got ${normalizedMinimum}`);

  const nodes = near.map(([x, y], index) => flatNode(String.fromCharCode(65 + index), x, y));
  const canonical = createCanonicalMitcProductionModel(singleElementSource({
    modelIdentity: 'MITC4-A4-NEAR-SINGULAR-DIAGNOSTIC',
    nodes,
    formulation: MITC4_FORMULATION,
    topology: MITC4_TOPOLOGY,
    thickness: 1,
    constraints: nodes.flatMap((node) => prescribed(node.nodeId, [0, 0, 0, 0, 0])),
  }));
  assert.equal(canonical.schema, MITC_PRODUCTION_MODEL_SCHEMA);

  return Object.freeze({
    healthyGoverningJacobians: healthyDets,
    nearSingularGoverningJacobians: nearDets,
    normalizedMinimumJacobian: normalizedMinimum,
    canonicalModelAcceptsNearSingularPositiveJacobian: true,
    a4Disposition: 'BLOCKED_NO_OWNER_AUTHORIZED_NORMALIZED_JACOBIAN_QUALITY_THRESHOLD',
    productionPatchAuthorized: false,
  });
}

// B6 mandatory negative: inverted/invalid Q4 Jacobian, at the MITC tying points.
//
// A bilinear Q4 map varies over the element, so a positive determinant at every
// Gauss point does not imply a valid map at the mid-edge tying points where the
// MITC shear field is sampled. This control is a self-intersecting quad whose
// top edge runs backwards: positive at all four Gauss points, negative at tying
// point C. Production accepted it and returned a displacement until
// covariantShearRow began validating where it actually samples the map.
function checkTyingPointInversionRejected() {
  const corners = [[0, 0], [2, 0], [0.9, 1], [1.1, 1]];
  const gauss = MITC4_GAUSS_POINTS.map((point) => {
    const { dNdXi, dNdEta } = q4ShapeFunctionsAndDerivatives(point.xi, point.eta);
    return jacobianAt(corners, dNdXi, dNdEta).determinant;
  });
  const tying = MITC4_TYING_POINTS.map((point) => {
    const { dNdXi, dNdEta } = q4ShapeFunctionsAndDerivatives(point.xi, point.eta);
    return jacobianAt(corners, dNdXi, dNdEta).determinant;
  });
  assert.ok(gauss.every((value) => value > 0), 'control must stay positive at every Gauss point');
  assert.ok(tying.some((value) => value <= 0), 'control must be non-positive at a tying point');

  // The map is only evaluated when the stiffness is built, so the rejection
  // surfaces from the solve as a rejected result, not from model construction.
  const nodes = corners.map(([x, y], index) => flatNode(String.fromCharCode(65 + index), x, y));
  const result = calculateLocalShell(createCanonicalMitcProductionModel(singleElementSource({
    modelIdentity: 'MITC4-A4-TYING-POINT-INVERSION',
    nodes,
    formulation: MITC4_FORMULATION,
    topology: MITC4_TOPOLOGY,
    thickness: 1,
    constraints: nodes.flatMap((node) => prescribed(node.nodeId, [0, 0, 0, 0, 0])),
  })));
  assert.equal(
    result.qualification.accepted,
    false,
    'production must reject a Q4 whose map is inverted at a tying point',
  );
  assert.match(
    result.qualification.summary,
    /Jacobian determinant must be positive at tying point/,
    `rejection must name the tying point; got ${result.qualification.summary}`,
  );

  return Object.freeze({
    corners,
    gaussDeterminants: gauss,
    tyingDeterminants: tying,
    positiveAtEveryGaussPoint: true,
    nonPositiveAtTyingPoint: true,
    productionRejects: true,
    rejectionSummary: result.qualification.summary,
    disposition: 'PASS_INVERTED_TYING_POINT_MAP_IS_REJECTED',
  });
}

function checkDeformableDistortedPressure() {
  const points = [[0, 0], [4, 0], [5, 3], [0, 2]];
  const ids = ['A', 'B', 'C', 'D'];
  const nodes = points.map(([x, y], index) => flatNode(ids[index], x, y));
  const constraints = ['A', 'D'].flatMap((nodeId) => prescribed(nodeId, [0, 0, 0, 0, 0]));
  const p = 2;
  const source = productionSource({
    modelIdentity: 'MITC4-A4-DEFORMABLE-DISTORTED-PRESSURE',
    nodes,
    elements: [productionElement('Q1', MITC4_FORMULATION, MITC4_TOPOLOGY, ids, T)],
    constraints,
    loadCases: [{
      loadCaseId: 'PRESSURE',
      nodalLoads: [],
      pressureLoads: [{
        pressureLoadId: 'P1',
        elementId: 'Q1',
        pressure: p,
        sense: 'ALONG_ELEMENT_NORMAL',
        sourceReference: 'P1-SRC',
      }],
      sourceReference: 'PRESSURE-SRC',
    }],
  });
  const result = solveProduction(source);
  const loadCase = result.loadCaseResults[0];
  const expectedForce = [0, 0, 22];
  const expectedMoment = [86 / 3, -158 / 3, 0];
  vectorClose(loadCase.appliedLoadEvidence.appliedForce, expectedForce, 2e-10, 'distorted pressure force');
  vectorClose(loadCase.appliedLoadEvidence.appliedMomentAboutOrigin, expectedMoment, 2e-10, 'distorted pressure moment');
  assert.equal(loadCase.forceEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.momentEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.energyQualification.accepted, true);
  assert.ok(loadCase.totalStrainEnergy > 0);
  assert.ok(loadCase.bendingStrainEnergy > 0);
  assert.ok(loadCase.transverseShearStrainEnergy > 0);

  const correct = qualifyForceMoment(
    loadCase.appliedLoadEvidence.appliedForce,
    loadCase.appliedLoadEvidence.appliedMomentAboutOrigin,
    expectedForce,
    expectedMoment,
  );
  assert.equal(correct.forceAccepted, true);
  assert.equal(correct.momentAccepted, true);
  const corruptedMoment = [...expectedMoment];
  corruptedMoment[0] += 1000;
  const negative = qualifyForceMoment(expectedForce, corruptedMoment, expectedForce, expectedMoment);
  assert.equal(negative.forceAccepted, true, 'moment corruption must not make force oracle fail');
  assert.equal(negative.momentAccepted, false, 'first-moment corruption must be detected independently');

  return Object.freeze({
    formulation: MITC4_FORMULATION,
    expectedForce,
    expectedMoment,
    totalStrainEnergy: loadCase.totalStrainEnergy,
    bendingStrainEnergy: loadCase.bendingStrainEnergy,
    transverseShearStrainEnergy: loadCase.transverseShearStrainEnergy,
    forceMomentOracle: correct,
    deliberateMomentCorruption: { corruptedMoment, disposition: negative },
    responseOracleClassification: 'DEFORMABLE_RESPONSE_EXECUTED_WITH_INDEPENDENT_LOAD_EQUILIBRIUM; DISPLACEMENT_IS_REGRESSION_ONLY_IN_THIS_LEG',
    status: 'PASS_FOR_B7_FORCE_MOMENT_ENERGY; RESPONSE_QOI_NOT_PROMOTED_TO_INDEPENDENT',
  });
}

function classifyHistoricalBenchmark(benchmarkId, independentOracle) {
  return Object.freeze({
    benchmarkId,
    independentOracle,
    oracleReusableForA4: true,
    historicalExecutableScriptRoute: 'LOCAL_SHELL_MODEL_V1_CST_DKT_TRI3',
    requiredA4Route: 'LOCAL_SHELL_MODEL_V2_MITC3_MITC4',
    disposition: 'ORACLE_REUSABLE_BUT_HISTORICAL_SCRIPT_NOT_CREDITED_AS_MITC_B8_PRODUCTION_ROUTE_PASS',
  });
}

function singleElementSource({ modelIdentity, nodes, formulation, topology, thickness, constraints }) {
  return productionSource({
    modelIdentity,
    nodes,
    elements: [productionElement('E1', formulation, topology, nodes.map((node) => node.nodeId), thickness)],
    constraints,
    loadCases: [{ loadCaseId: 'FIELD', nodalLoads: [], pressureLoads: [], sourceReference: 'FIELD-SRC' }],
  });
}

function productionSource({ modelIdentity, poissonRatio = NU, nodes, elements, constraints, loadCases }) {
  return {
    schema: MITC_PRODUCTION_MODEL_SCHEMA,
    modelIdentity,
    modelVersion: '2',
    sourceAncestry: ['qualification/a4-leg002/v1'],
    units: { ...CANONICAL_UNITS },
    formulationFamily: MITC_PRODUCTION_FORMULATION_FAMILY,
    materials: [{ materialId: 'MAT', elasticModulus: E, poissonRatio, sourceReference: 'MAT-SRC' }],
    nodes,
    elements,
    constraints,
    loadCases,
    resultRequests: {
      stressSurfaces: [...MITC_PRODUCTION_RESULT_REQUEST.stressSurfaces],
      retainElementMatrices: true,
      retainTransverseShear: true,
    },
    qualificationProfile: qualificationProfile(),
    mitcQualification: {
      quadPlanarity: { absolute: 1e-9, relative: 1e-8 },
      rigidBodyEnergy: { absolute: 1e-9, relative: 1e-9 },
    },
    limitations: [...MITC_PRODUCTION_LIMITATIONS],
  };
}

function productionElement(elementId, formulation, topology, nodeIds, thickness) {
  return {
    elementId,
    formulation,
    topology,
    nodeIds,
    materialId: 'MAT',
    thickness,
    sourceReference: `${elementId}-SRC`,
  };
}

function solveProduction(source) {
  const canonical = createCanonicalMitcProductionModel(source);
  const result = calculateLocalShell(canonical);
  assert.equal(result.schema, 'local-shell-result/v2');
  assert.equal(result.qualification.accepted, true, `${source.modelIdentity}: ${result.qualification.summary}`);
  assert.equal(result.productionQualification.qualifiedForRelease, false);
  assert.equal(result.productionQualification.evidenceState, 'NOT_RUN');
  return result;
}

function rotatedNodes(points, angle, prefix) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return points.map(([x, y], index) => {
    const X = c * x - s * y;
    const Y = s * x + c * y;
    return flatNode(`${prefix}${index + 1}`, X, Y);
  });
}

function prescribed(nodeId, values) {
  return ['UX', 'UY', 'UZ', 'R1', 'R2'].map((dof, index) => constraint(nodeId, dof, values[index]));
}

function constraint(nodeId, dof, value) {
  return {
    constraintId: `C-${nodeId}-${dof}`,
    nodeId,
    dof,
    value,
    sourceReference: `C-${nodeId}-${dof}-SRC`,
  };
}

function nodalLoad(nodeId, fz) {
  return {
    loadId: `F-${nodeId}`,
    nodeId,
    fx: 0,
    fy: 0,
    fz,
    m1: 0,
    m2: 0,
    sourceReference: `F-${nodeId}-SRC`,
  };
}

function rotateEngineeringTensor([x, y, xy], frame) {
  const c = frame.ex[0];
  const s = frame.ex[1];
  return [
    c ** 2 * x + s ** 2 * y + c * s * xy,
    s ** 2 * x + c ** 2 * y - c * s * xy,
    2 * c * s * (y - x) + (c ** 2 - s ** 2) * xy,
  ];
}

function planeStressMatrix(modulus, poisson) {
  const factor = modulus / (1 - poisson ** 2);
  return [
    [factor, factor * poisson, 0],
    [factor * poisson, factor, 0],
    [0, 0, factor * (1 - poisson) / 2],
  ];
}

function governingJacobians(nodes) {
  return [...MITC4_GAUSS_POINTS, ...MITC4_TYING_POINTS].map((point) => {
    const { dNdXi, dNdEta } = q4ShapeFunctionsAndDerivatives(point.xi, point.eta);
    return jacobianAt(nodes, dNdXi, dNdEta).determinant;
  });
}

function maximumPairDistance(points) {
  let maximum = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      maximum = Math.max(maximum, Math.hypot(points[j][0] - points[i][0], points[j][1] - points[i][1]));
    }
  }
  return maximum;
}

function polygonArea(points) {
  let twice = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

function qualifyForceMoment(actualForce, actualMoment, expectedForce, expectedMoment) {
  const forceError = maxVectorError(actualForce, expectedForce);
  const momentError = maxVectorError(actualMoment, expectedMoment);
  return Object.freeze({
    forceError,
    momentError,
    forceAccepted: forceError <= 1e-9 * Math.max(1, ...expectedForce.map(Math.abs)),
    momentAccepted: momentError <= 1e-9 * Math.max(1, ...expectedMoment.map(Math.abs)),
  });
}

function maxVectorError(actual, expected) {
  return Math.max(...actual.map((value, index) => Math.abs(value - expected[index])));
}

function matVec(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function recordClose(record, expected, fields, tolerance) {
  fields.forEach((field, index) => close(record[field], expected[index], tolerance, field));
}

function vectorClose(actual, expected, tolerance, label) {
  assert.equal(actual.length, expected.length, `${label} length`);
  actual.forEach((value, index) => close(value, expected[index], tolerance, `${label}[${index}]`));
}

function close(actual, expected, tolerance, label) {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= tolerance * scale, `${label}: ${actual} != ${expected}`);
}
