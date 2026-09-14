#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  bendingResultant,
  calculateLocalShell,
  createCanonicalLocalShellModel,
} from '../src/core/local-shell/index.js';
import { rotationInterpolationMap } from '../src/core/local-shell/dkt.js';
import {
  cylindricalSource,
  prescribedPatchSource,
} from './lafea.4-fixtures.mjs';

const E = 200000;
const NU = 0.3;

const rigidModes = qualifyRigidModes();
const edgeConstraint = qualifyDktEdgeConstraint();
const bendingSweep = qualifyBendingThicknessSweep();
const recovery = qualifyThroughThicknessRecovery();
const contamination = qualifyMembraneContaminationFalsifier();
const cylinder = qualifyThinCylinderClosedEndSanity();
const thickDiagnostic = classifyModeratelyThickDiagnostic();

console.log(JSON.stringify({
  schema: 'lafea4-a3-mechanics-dossier-check/v1',
  status: 'PASS',
  formulation: 'CST_DKT_TRI3_THIN_SHELL_V1',
  engineeringAuthority: 'SMALL_DISPLACEMENT_KIRCHHOFF_THIN_SHELL_ONLY',
  releaseAuthorityGranted: false,
  rigidModes,
  edgeConstraint,
  bendingSweep,
  recovery,
  contamination,
  cylinder,
  thickDiagnostic,
}, null, 2));

function qualifyRigidModes() {
  const cases = [
    ['TRANSLATION', prescribedPatchSource({ mode: 'RIGID_TRANSLATION', w: 4 })],
    ['ROTATION', prescribedPatchSource({ mode: 'RIGID_ROTATION', omega: [0.002, -0.001, 0.003] })],
  ];
  const rows = cases.map(([caseId, source]) => {
    const result = solve(source);
    const loadCase = result.loadCaseResults[0];
    let maximumMembraneStrain = 0;
    let maximumCurvature = 0;
    let maximumSurfaceVonMises = 0;
    let maximumReaction = 0;
    for (const element of loadCase.elementResults) {
      maximumMembraneStrain = Math.max(maximumMembraneStrain, ...Object.values(element.membraneStrain).map(Math.abs));
      for (const point of element.integrationPoints) {
        maximumCurvature = Math.max(maximumCurvature, ...Object.values(point.curvature).map(Math.abs));
        maximumSurfaceVonMises = Math.max(maximumSurfaceVonMises, ...point.surfaces.map((surface) => Math.abs(surface.vonMises)));
      }
    }
    maximumReaction = Math.max(0, ...loadCase.reactions.map((row) => Math.abs(row.value)));
    assert.ok(maximumMembraneStrain <= 1e-10, `${caseId} membrane strain ${maximumMembraneStrain}`);
    assert.ok(maximumCurvature <= 1e-8, `${caseId} curvature ${maximumCurvature}`);
    assert.ok(maximumSurfaceVonMises <= 1e-7, `${caseId} stress ${maximumSurfaceVonMises}`);
    assert.ok(Math.abs(loadCase.totalStrainEnergy) <= 1e-7, `${caseId} energy ${loadCase.totalStrainEnergy}`);
    assert.ok(maximumReaction <= 1e-5, `${caseId} reaction ${maximumReaction}`);
    return Object.freeze({
      caseId,
      maximumMembraneStrain,
      maximumCurvature,
      maximumSurfaceVonMises,
      totalStrainEnergy: loadCase.totalStrainEnergy,
      maximumReaction,
    });
  });
  return Object.freeze({ status: 'PASS', cases: rows });
}

function qualifyDktEdgeConstraint() {
  const coordinates = [[0, 0], [4, 0], [0, 3]];
  const dofs = [
    0, 0.2, 0.1,
    2, -0.1, -0.05,
    0.3, 0.04, -0.02,
  ];
  const map = rotationInterpolationMap(coordinates);
  const productionMidpoint = [dotRow(map[6], dofs), dotRow(map[7], dofs)];

  const length = 4;
  const tangent = [1, 0];
  const normal = [0, 1];
  const firstRotation = [dofs[1], dofs[2]];
  const secondRotation = [dofs[4], dofs[5]];
  const chordSlope = (dofs[3] - dofs[0]) / length;
  const thetaNFirst = dot2(firstRotation, normal);
  const thetaNSecond = dot2(secondRotation, normal);
  const thetaTMid = 0.5 * (dot2(firstRotation, tangent) + dot2(secondRotation, tangent));
  const thetaNMid = -1.5 * chordSlope - 0.25 * (thetaNFirst + thetaNSecond);
  const independentMidpoint = [
    thetaTMid * tangent[0] + thetaNMid * normal[0],
    thetaTMid * tangent[1] + thetaNMid * normal[1],
  ];
  const naiveMidpoint = [
    0.5 * (firstRotation[0] + secondRotation[0]),
    0.5 * (firstRotation[1] + secondRotation[1]),
  ];

  vectorClose(productionMidpoint, independentMidpoint, 1e-12);
  const naiveNormalError = Math.abs(dot2(naiveMidpoint, normal) - thetaNMid);
  assert.ok(naiveNormalError > 0.5, `naive midpoint rotation unexpectedly close: ${naiveNormalError}`);
  assert.notDeepEqual(naiveMidpoint, productionMidpoint);

  return Object.freeze({
    status: 'PASS',
    edgeLength: length,
    wi: dofs[0],
    wj: dofs[3],
    chordSlope,
    endpointNormalRotations: [thetaNFirst, thetaNSecond],
    independentlyDerivedMidpointRotation: independentMidpoint,
    productionMidpointRotation: productionMidpoint,
    naiveEndpointAverage: naiveMidpoint,
    naiveNormalRotationError: naiveNormalError,
    falsifierDisposition: 'NAIVE_ENDPOINT_ROTATION_AVERAGE_VIOLATES_DKT_MIDEDGE_KIRCHHOFF_CONSTRAINT',
  });
}

function qualifyBendingThicknessSweep() {
  const curvature = [1e-4, -2e-4, 3e-4];
  const thicknesses = [1, 2, 4, 8];
  const rows = thicknesses.map((thickness) => {
    const source = prescribedPatchSource({
      epsilonX: 0,
      epsilonY: 0,
      gammaXY: 0,
      curvature,
    });
    source.modelIdentity = `A3-BENDING-T${thickness}`;
    source.elements.forEach((element) => { element.thickness = thickness; });
    const result = solve(source);
    const loadCase = result.loadCaseResults[0];
    const db = E * thickness ** 3 / (12 * (1 - NU ** 2));
    const expectedGlobal = [
      db * (curvature[0] + NU * curvature[1]),
      db * (curvature[1] + NU * curvature[0]),
      db * ((1 - NU) / 2) * curvature[2],
    ];
    let maximumMomentError = 0;
    let maximumMembraneContamination = 0;
    let representativeMomentNorm = null;
    for (const elementResult of loadCase.elementResults) {
      const meshElement = result.meshEvidence.elements.find((row) => row.elementId === elementResult.elementId);
      assert.ok(meshElement);
      const expectedLocal = rotateStressLike(expectedGlobal, meshElement.localFrame);
      maximumMembraneContamination = Math.max(
        maximumMembraneContamination,
        ...Object.values(elementResult.membraneStrain).map(Math.abs),
      );
      elementResult.integrationPoints.forEach((point, pointIndex) => {
        const moment = bendingResultant(meshElement, elementResult, pointIndex);
        const actual = [moment.Mxx, moment.Myy, moment.Mxy];
        maximumMomentError = Math.max(maximumMomentError, maxVectorError(actual, expectedLocal));
        if (representativeMomentNorm === null) representativeMomentNorm = Math.hypot(...actual);
      });
    }
    assert.ok(maximumMomentError <= 1e-8 * Math.max(1, Math.hypot(...expectedGlobal)),
      `t=${thickness} bending moment error ${maximumMomentError}`);
    assert.ok(maximumMembraneContamination <= 1e-12,
      `t=${thickness} membrane contamination ${maximumMembraneContamination}`);
    return Object.freeze({
      thickness,
      db,
      expectedGlobalMomentResultant: expectedGlobal,
      representativeMomentNorm,
      maximumMomentError,
      maximumMembraneContamination,
    });
  });
  const base = rows[0].representativeMomentNorm;
  rows.forEach((row) => {
    close(row.representativeMomentNorm / base, row.thickness ** 3, 1e-8);
  });
  return Object.freeze({
    status: 'PASS',
    curvature,
    thicknessScaling: 't^3',
    rows,
  });
}

function qualifyThroughThicknessRecovery() {
  const membrane = [0.0004, -0.0001, 0.00015];
  const curvature = [0.008, -0.003, 0.001];
  const thickness = 8;
  const source = prescribedPatchSource({
    epsilonX: membrane[0],
    epsilonY: membrane[1],
    gammaXY: membrane[2],
    curvature,
  });
  source.modelIdentity = 'A3-B5-THROUGH-THICKNESS-ARITHMETIC';
  source.elements.forEach((element) => { element.thickness = thickness; });
  const result = solve(source);
  const expected = new Map([
    ['TOP', independentSurfaceState(membrane, curvature, thickness / 2)],
    ['BOTTOM', independentSurfaceState(membrane, curvature, -thickness / 2)],
  ]);
  let maximumStressError = 0;
  let maximumVonMisesError = 0;
  let swappedTopBottomFalsifierError = 0;
  for (const elementResult of result.loadCaseResults[0].elementResults) {
    const meshElement = result.meshEvidence.elements.find((row) => row.elementId === elementResult.elementId);
    assert.ok(meshElement);
    elementResult.integrationPoints.forEach((point) => {
      for (const surfaceName of ['TOP', 'BOTTOM']) {
        const actual = point.surfaces.find((row) => row.surface === surfaceName);
        assert.ok(actual);
        const oracle = expected.get(surfaceName);
        const expectedLocal = rotateStressLike(
          [oracle.stress.sigmaX, oracle.stress.sigmaY, oracle.stress.tauXY],
          meshElement.localFrame,
        );
        maximumStressError = Math.max(
          maximumStressError,
          maxVectorError(
            [actual.combinedStress.sigmaX, actual.combinedStress.sigmaY, actual.combinedStress.tauXY],
            expectedLocal,
          ),
        );
        maximumVonMisesError = Math.max(
          maximumVonMisesError,
          Math.abs(actual.vonMises - oracle.vonMises),
        );
        if (surfaceName === 'TOP') {
          const wrong = expected.get('BOTTOM');
          const wrongLocal = rotateStressLike(
            [wrong.stress.sigmaX, wrong.stress.sigmaY, wrong.stress.tauXY],
            meshElement.localFrame,
          );
          swappedTopBottomFalsifierError = Math.max(
            swappedTopBottomFalsifierError,
            maxVectorError(
              [actual.combinedStress.sigmaX, actual.combinedStress.sigmaY, actual.combinedStress.tauXY],
              wrongLocal,
            ),
          );
        }
      }
    });
  }
  const stressScale = Math.max(...[...expected.values()].flatMap((row) => [
    Math.abs(row.stress.sigmaX), Math.abs(row.stress.sigmaY), Math.abs(row.stress.tauXY),
  ]));
  assert.ok(maximumStressError <= 1e-8 * Math.max(1, stressScale),
    `B5 stress error ${maximumStressError}`);
  assert.ok(maximumVonMisesError <= 1e-8 * Math.max(1, stressScale),
    `B5 von Mises error ${maximumVonMisesError}`);
  assert.ok(swappedTopBottomFalsifierError > 1000,
    `swapped TOP/BOTTOM must fail materially; error=${swappedTopBottomFalsifierError}`);

  return Object.freeze({
    status: 'PASS',
    classification: 'RECOVERY_ARITHMETIC_AND_SIGN_FIXTURE_NOT_PHYSICAL_SMALL_STRAIN_VALIDATION',
    membraneStrain: membrane,
    curvaturePerMm: curvature,
    thickness,
    independentTop: expected.get('TOP'),
    independentBottom: expected.get('BOTTOM'),
    maximumStressError,
    maximumVonMisesError,
    swappedTopBottomFalsifierError,
  });
}

function qualifyMembraneContaminationFalsifier() {
  const curvature = [1e-4, -2e-4, 3e-4];
  const pure = solve(prescribedPatchSource({
    epsilonX: 0, epsilonY: 0, gammaXY: 0, curvature,
  }));
  const contaminated = solve(prescribedPatchSource({
    epsilonX: 1e-4, epsilonY: 0, gammaXY: 0, curvature,
  }));
  const pureMaximum = maximumMembraneStrain(pure);
  const contaminatedMaximum = maximumMembraneStrain(contaminated);
  assert.ok(pureMaximum <= 1e-12, `pure bending contamination ${pureMaximum}`);
  assert.ok(contaminatedMaximum >= 9e-5, `contamination detector missed injected field ${contaminatedMaximum}`);
  return Object.freeze({
    status: 'PASS',
    pureBendingMaximumMembraneStrain: pureMaximum,
    injectedEpsilonX: 1e-4,
    contaminatedMaximumMembraneStrain: contaminatedMaximum,
    falsifierDetected: true,
  });
}

function qualifyThinCylinderClosedEndSanity() {
  const radius = 100;
  const thickness = 1;
  const pressure = 1;
  const hoopStress = pressure * radius / thickness;
  const axialStress = pressure * radius / (2 * thickness);
  const hoopStrain = (hoopStress - NU * axialStress) / E;
  const axialStrain = (axialStress - NU * hoopStress) / E;
  const radialDisplacement = hoopStrain * radius;
  close(hoopStress, 100, 1e-12);
  close(axialStress, 50, 1e-12);
  close(radialDisplacement, 0.0425, 1e-12);

  const rows = [4, 8, 16].map((segments) => {
    const source = cylindricalSource(segments);
    source.modelIdentity = `A3-B6-CLOSED-END-CYLINDER-${segments}`;
    source.elements.forEach((element) => { element.thickness = thickness; });
    source.loadCases = [{
      loadCaseId: 'PRESCRIBED-MEMBRANE',
      nodalLoads: [],
      pressureLoads: [],
      sourceReference: 'A3-B6-ANALYTICAL-MEMBRANE-STATE',
    }];
    source.constraints = source.nodes.flatMap((node) => {
      const values = [
        axialStrain * node.position[0],
        radialDisplacement * node.director[1],
        radialDisplacement * node.director[2],
        0,
        0,
      ];
      return ['UX', 'UY', 'UZ', 'R1', 'R2'].map((dof, index) => ({
        constraintId: `A3-B6-${node.nodeId}-${dof}`,
        nodeId: node.nodeId,
        dof,
        value: values[index],
        sourceReference: `A3-B6/${node.nodeId}/${dof}`,
      }));
    });
    const result = solve(source);
    let maximumHoopStressError = 0;
    let maximumAxialStressError = 0;
    let maximumBendingStress = 0;
    for (const elementResult of result.loadCaseResults[0].elementResults) {
      const meshElement = result.meshEvidence.elements.find((row) => row.elementId === elementResult.elementId);
      assert.ok(meshElement);
      const tangent = circumferentialTangent(source, meshElement.nodeIds);
      const axial = [1, 0, 0];
      const [ht1, ht2] = localDirection(tangent, meshElement.localFrame);
      const [ax1, ax2] = localDirection(axial, meshElement.localFrame);
      const stress = elementResult.membraneStress;
      const recoveredHoop = projectStress(stress, ht1, ht2);
      const recoveredAxial = projectStress(stress, ax1, ax2);
      maximumHoopStressError = Math.max(maximumHoopStressError, Math.abs(recoveredHoop - hoopStress));
      maximumAxialStressError = Math.max(maximumAxialStressError, Math.abs(recoveredAxial - axialStress));
      for (const point of elementResult.integrationPoints) {
        for (const surface of point.surfaces) {
          maximumBendingStress = Math.max(
            maximumBendingStress,
            ...Object.values(surface.bendingStress).map(Math.abs),
          );
        }
      }
    }
    assert.ok(maximumHoopStressError <= 1e-8 * hoopStress,
      `segments=${segments} hoop error ${maximumHoopStressError}`);
    assert.ok(maximumAxialStressError <= 1e-8 * axialStress,
      `segments=${segments} axial error ${maximumAxialStressError}`);
    assert.ok(maximumBendingStress <= 1e-7, `segments=${segments} bending ${maximumBendingStress}`);
    return Object.freeze({ segments, maximumHoopStressError, maximumAxialStressError, maximumBendingStress });
  });

  return Object.freeze({
    status: 'PASS',
    classification: 'SECONDARY_THIN_CYLINDER_MEMBRANE_SANITY_DIAGNOSTIC',
    radius,
    thickness,
    pressure,
    expectedHoopStressMpa: hoopStress,
    expectedAxialStressMpa: axialStress,
    expectedRadialDisplacementMm: radialDisplacement,
    expectedHoopStrain: hoopStrain,
    expectedAxialStrain: axialStrain,
    meshRows: rows,
  });
}

function classifyModeratelyThickDiagnostic() {
  const length = 10;
  const width = 1;
  const thickness = 2;
  const load = 1;
  const shearCorrection = 5 / 6;
  const shearModulus = E / (2 * (1 + 0));
  const secondMoment = width * thickness ** 3 / 12;
  const area = width * thickness;
  const eulerBernoulli = load * length ** 3 / (3 * E * secondMoment);
  const shear = load * length / (shearCorrection * shearModulus * area);
  const timoshenko = eulerBernoulli + shear;
  const omittedFractionOfPhysicalDeflection = shear / timoshenko;
  close(thickness / length, 0.2, 1e-12);
  assert.ok(shear > 0);
  assert.ok(timoshenko > eulerBernoulli);
  assert.ok(omittedFractionOfPhysicalDeflection > 0.02);
  return Object.freeze({
    status: 'DIAGNOSTIC_OUTSIDE_QUALIFIED_KIRCHHOFF_ENVELOPE',
    thicknessToLength: thickness / length,
    eulerBernoulliBendingDeflectionMm: eulerBernoulli,
    timoshenkoShearDeflectionMm: shear,
    timoshenkoTotalDeflectionMm: timoshenko,
    omittedShearFractionOfPhysicalDeflection: omittedFractionOfPhysicalDeflection,
    expectedCstDktBias: 'UNDER_DEFLECTION_RELATIVE_TO_SHEAR_DEFORMABLE_PHYSICS',
    thickShellAuthorityGranted: false,
  });
}

function independentSurfaceState(membrane, curvature, z) {
  const strain = membrane.map((value, index) => value + z * curvature[index]);
  const stress = planeStress(strain);
  return Object.freeze({
    z,
    engineeringStrain: Object.freeze({ epsilonX: strain[0], epsilonY: strain[1], gammaXY: strain[2] }),
    stress: Object.freeze({ sigmaX: stress[0], sigmaY: stress[1], tauXY: stress[2] }),
    vonMises: vonMises(stress),
  });
}

function planeStress([epsilonX, epsilonY, gammaXY]) {
  const factor = E / (1 - NU ** 2);
  const shearModulus = E / (2 * (1 + NU));
  return [
    factor * (epsilonX + NU * epsilonY),
    factor * (epsilonY + NU * epsilonX),
    shearModulus * gammaXY,
  ];
}

function vonMises([sigmaX, sigmaY, tauXY]) {
  return Math.sqrt(sigmaX ** 2 - sigmaX * sigmaY + sigmaY ** 2 + 3 * tauXY ** 2);
}

function maximumMembraneStrain(result) {
  return Math.max(0, ...result.loadCaseResults[0].elementResults.flatMap((element) =>
    Object.values(element.membraneStrain).map(Math.abs)));
}

function rotateStressLike([xx, yy, xy], frame) {
  const ex = frame.ex;
  const ey = frame.ey;
  const tensor = [[xx, xy], [xy, yy]];
  return [
    quadratic2(ex, tensor, ex),
    quadratic2(ey, tensor, ey),
    quadratic2(ex, tensor, ey),
  ];
}

function quadratic2(left3, tensor, right3) {
  const left = [left3[0], left3[1]];
  const right = [right3[0], right3[1]];
  return left[0] * (tensor[0][0] * right[0] + tensor[0][1] * right[1])
    + left[1] * (tensor[1][0] * right[0] + tensor[1][1] * right[1]);
}

function circumferentialTangent(source, nodeIds) {
  const centroid = nodeIds.map((nodeId) => source.nodes.find((node) => node.nodeId === nodeId).position)
    .reduce((total, position) => total.map((value, index) => value + position[index]), [0, 0, 0])
    .map((value) => value / 3);
  const angle = Math.atan2(centroid[1], centroid[2]);
  return [0, Math.cos(angle), -Math.sin(angle)];
}

function localDirection(globalVector, frame) {
  const a = dot3(globalVector, frame.ex);
  const b = dot3(globalVector, frame.ey);
  const length = Math.hypot(a, b);
  return [a / length, b / length];
}

function projectStress(stress, a, b) {
  return a ** 2 * stress.sigmaX + b ** 2 * stress.sigmaY + 2 * a * b * stress.tauXY;
}

function solve(source) {
  const result = calculateLocalShell(createCanonicalLocalShellModel(source));
  assert.equal(result.qualification.accepted, true, result.qualification.summary);
  return result;
}

function dotRow(row, vector) {
  return row.reduce((sum, value, index) => sum + value * vector[index], 0);
}
function dot2(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function dot3(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function maxVectorError(a, b) {
  assert.equal(a.length, b.length);
  return Math.max(...a.map((value, index) => Math.abs(value - b[index])));
}
function vectorClose(actual, expected, tolerance = 1e-9) {
  const scale = Math.max(1, ...expected.map(Math.abs));
  const error = maxVectorError(actual, expected);
  assert.ok(error <= tolerance * scale, `${JSON.stringify(actual)} != ${JSON.stringify(expected)} (error ${error})`);
}
function close(actual, expected, tolerance = 1e-9) {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= tolerance * scale, `${actual} != ${expected}`);
}
