#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  BASE_LIMITATIONS,
  CANONICAL_UNITS,
  FORMULATION,
  MITC_PRODUCTION_FORMULATION_FAMILY,
  MITC_PRODUCTION_LIMITATIONS,
  MITC_PRODUCTION_MODEL_SCHEMA,
  MITC_PRODUCTION_RESULT_REQUEST,
  MODEL_SCHEMA,
  RESULT_REQUEST,
  calculateLocalShell,
  createCanonicalLocalShellModel,
  createCanonicalMitcProductionModel,
} from '../src/core/local-shell/index.js';
import { MITC3_TOPOLOGY, MITC4_TOPOLOGY } from '../src/core/local-shell/mitc-adoption-model.js';
import { MITC3_FORMULATION } from '../src/core/local-shell/mitc3-element.js';
import { MITC4_FORMULATION } from '../src/core/local-shell/mitc4-element.js';
import { flatNode, qualificationProfile } from './lafea.4-fixtures.mjs';

const E = 200000;
const NU = 0.3;
const D = planeStressMatrix(E, NU);
const EPSILON = Object.freeze([0.0004, -0.0001, 0.00015]);
const KAPPA = Object.freeze([0.00008, -0.00003, 0.00001]);
const FAMILIES = Object.freeze([
  Object.freeze({ label: 'MITC4', formulation: MITC4_FORMULATION, topology: MITC4_TOPOLOGY }),
  Object.freeze({ label: 'MITC3', formulation: MITC3_FORMULATION, topology: MITC3_TOPOLOGY }),
]);

const namedB8 = Object.freeze({
  'LAFEA4-CYL-01': Object.freeze(FAMILIES.map(checkNamedCylinder)),
  'LAFEA4-PRESS-01': Object.freeze(FAMILIES.map(checkNamedPressure)),
  'LAFEA4-COMB-01': Object.freeze(FAMILIES.map(checkNamedCombined)),
});

const b9ThinLimitTable = Object.freeze([
  checkB9FieldCase({
    caseId: 'B9-THIN-MEMBRANE',
    epsilon: EPSILON,
    curvature: [0, 0, 0],
  }),
  checkB9FieldCase({
    caseId: 'B9-THIN-BENDING',
    epsilon: [0, 0, 0],
    curvature: KAPPA,
  }),
]);

for (const row of b9ThinLimitTable) requireIndependentB9Row(row);
assert.throws(
  () => requireIndependentB9Row({
    caseId: 'B9-CIRCULAR-NEGATIVE',
    independentOracle: null,
    cstDkt: { totalEnergy: 1 },
    mitc: { MITC3: { totalEnergy: 1 }, MITC4: { totalEnergy: 1 } },
  }),
  /independent oracle/i,
);
assert.throws(
  () => requireIndependentB9Row({
    caseId: 'B9-CST-DKT-SOLE-ORACLE-NEGATIVE',
    independentOracle: { authority: 'CST_DKT_ONLY', totalEnergy: 1 },
    cstDkt: { totalEnergy: 1 },
    mitc: { MITC3: { totalEnergy: 1 }, MITC4: { totalEnergy: 1 } },
  }),
  /CST\/DKT.*sole oracle/i,
);

console.log(JSON.stringify({
  schema: 'lafea4-a4-named-production-thin-limit-check/v1',
  status: 'PASS_WITH_B6_AUTHORITY_BLOCKER',
  productionOutputUsedToChooseExpectedValues: false,
  productionOutputUsedToChooseTolerance: false,
  cstDktUsedAsSoleOracle: false,
  releaseAuthorityGranted: false,
  namedB8,
  b9ThinLimitTable,
  preservedBlockers: [
    'B6_NEAR_SINGULAR_Q4_HAS_NO_OWNER_AUTHORIZED_NORMALIZED_JACOBIAN_QUALITY_THRESHOLD',
  ],
}, null, 2));

console.log('\n✅ A4 LEG-003 named MITC-v2 production-route and B9 independent|CST-DKT|MITC qualification passed; B6 remains blocked by authority.');

function checkNamedCylinder(family) {
  const benchmarkId = 'LAFEA4-CYL-01';
  const strain = 0.001;
  const radius = 100;
  const length = 50;
  const span = Math.PI / 3;
  const thickness = 1.5;
  const expectedStress = E / (1 - NU ** 2) * strain;

  const levels = [4, 8, 16].map((segments) => {
    const nodes = cylinderNodes(segments, { radius, length, span, prefix: `${family.label}-C` });
    const elements = cylinderElements(family, segments, thickness);
    const constraints = nodes.flatMap((node) => {
      const angle = Math.atan2(node.position[1], node.position[2]);
      const displacement = node.rotationBasis2.map((value) => value * strain * radius * angle);
      return prescribed(node.nodeId, [...displacement, 0, 0]);
    });
    const result = solveMitc(productionSource({
      modelIdentity: `${benchmarkId}-${family.label}-N${segments}`,
      nodes,
      elements,
      constraints,
      loadCases: [emptyLoadCase(benchmarkId)],
    }));
    requireNamedMitcRoute(result, benchmarkId, family.formulation);

    const loadCase = result.loadCaseResults[0];
    let strainError = 0;
    let stressError = 0;

    for (const elementResult of loadCase.elementResults) {
      const meshElement = result.meshEvidence.elements
        .find((row) => row.elementId === elementResult.elementId);
      const tangent = circumferentialTangent(nodes, meshElement.nodeIds);
      const [a, b] = localDirection(tangent, meshElement.localFrame);
      for (const point of elementResult.integrationPoints) {
        const hoopStrain = projectStrain(point.membraneStrain, a, b);
        const midsurface = point.surfaces.find((surface) => surface.surface === 'MIDSURFACE');
        assert.ok(midsurface, `${family.label} cylinder must retain MIDSURFACE recovery`);
        const hoopStress = projectStress(midsurface.combinedStress, a, b);
        strainError = Math.max(strainError, Math.abs(hoopStrain - strain));
        stressError = Math.max(stressError, Math.abs(hoopStress - expectedStress));
      }
    }

    assert.equal(loadCase.forceEquilibrium.qualification.accepted, true);
    assert.equal(loadCase.momentEquilibrium.qualification.accepted, true);
    assert.equal(loadCase.energyQualification.accepted, true);
    return Object.freeze({
      segments,
      strainError,
      stressError,
      solverMethod: loadCase.solverEvidence.method,
    });
  });

  for (let index = 1; index < levels.length; index += 1) {
    assert.ok(
      levels[index].strainError < levels[index - 1].strainError / 3.5,
      `${benchmarkId}/${family.label}: circumferential strain error must converge geometrically`,
    );
    assert.ok(
      levels[index].stressError < levels[index - 1].stressError / 3.5,
      `${benchmarkId}/${family.label}: circumferential stress error must converge geometrically`,
    );
  }

  return Object.freeze({
    benchmarkId,
    formulation: family.formulation,
    topology: family.topology,
    publicRoute: 'calculateLocalShell(local-shell-model/v2)',
    independentOracle: Object.freeze({
      authority: 'PRESCRIBED_CIRCUMFERENTIAL_STRAIN_PLUS_PLANE_STRESS',
      hoopStrain: strain,
      hoopStress: expectedStress,
      convergence: 'FACET_GEOMETRY_ERROR_O_H2',
    }),
    levels,
    disposition: 'PASS',
  });
}

function checkNamedPressure(family) {
  const benchmarkId = 'LAFEA4-PRESS-01';
  const thickness = 2;
  const pressure = 2.5;
  const nodes = rectangleNodes(`${family.label}-P`);
  const elements = planarElementsForNodes(family, nodes, thickness, 'P');
  const result = solveMitc(productionSource({
    modelIdentity: `${benchmarkId}-${family.label}`,
    nodes,
    elements,
    constraints: fullyFixed(nodes),
    loadCases: [{
      loadCaseId: benchmarkId,
      nodalLoads: [],
      pressureLoads: elements.map((element, index) => ({
        pressureLoadId: `P-${index + 1}`,
        elementId: element.elementId,
        pressure,
        sense: 'ALONG_ELEMENT_NORMAL',
        sourceReference: `P-${index + 1}-SRC`,
      })),
      sourceReference: `${benchmarkId}-SRC`,
    }],
  }));
  requireNamedMitcRoute(result, benchmarkId, family.formulation);

  const loadCase = result.loadCaseResults[0];
  const area = 100 * 50;
  const total = pressure * area;
  const expectedForce = [0, 0, total];
  const expectedMoment = [25 * total, -50 * total, 0];
  vectorClose(loadCase.appliedLoadEvidence.appliedForce, expectedForce, 1e-9, `${family.label} pressure force`);
  vectorClose(loadCase.appliedLoadEvidence.appliedMomentAboutOrigin, expectedMoment, 1e-9, `${family.label} pressure moment`);
  assert.equal(loadCase.forceEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.momentEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.energyQualification.accepted, true);

  for (const reaction of loadCase.reactions) {
    const index = result.meshEvidence.dofOrdering.indexOf(`${reaction.nodeId}:${reaction.dof}`);
    close(reaction.value, -loadCase.appliedLoadEvidence.forceVector[index], 1e-9, `${family.label} fixed reaction`);
  }

  return Object.freeze({
    benchmarkId,
    formulation: family.formulation,
    topology: family.topology,
    publicRoute: 'calculateLocalShell(local-shell-model/v2)',
    independentOracle: Object.freeze({
      authority: 'P_TIMES_AREA_AT_RECTANGLE_CENTROID_PLUS_R_EQUALS_MINUS_F',
      expectedForce,
      expectedMoment,
    }),
    actualForce: loadCase.appliedLoadEvidence.appliedForce,
    actualMoment: loadCase.appliedLoadEvidence.appliedMomentAboutOrigin,
    solverMethod: loadCase.solverEvidence.method,
    disposition: 'PASS',
  });
}

function checkNamedCombined(family) {
  const benchmarkId = 'LAFEA4-COMB-01';
  const thickness = 2;
  const pressure = 0.2;
  const nodes = rectangleNodes(`${family.label}-K`);
  const elements = planarElementsForNodes(family, nodes, thickness, 'K');
  const constraints = fieldConstraints(nodes, EPSILON, KAPPA);
  const result = solveMitc(productionSource({
    modelIdentity: `${benchmarkId}-${family.label}`,
    nodes,
    elements,
    constraints,
    loadCases: [{
      loadCaseId: benchmarkId,
      nodalLoads: [],
      pressureLoads: elements.map((element, index) => ({
        pressureLoadId: `P-${index + 1}`,
        elementId: element.elementId,
        pressure,
        sense: 'ALONG_ELEMENT_NORMAL',
        sourceReference: `P-${index + 1}-SRC`,
      })),
      sourceReference: `${benchmarkId}-SRC`,
    }],
  }));
  requireNamedMitcRoute(result, benchmarkId, family.formulation);

  const loadCase = result.loadCaseResults[0];
  verifyFieldRecovery(result, EPSILON, KAPPA, thickness, `${benchmarkId}/${family.label}`);

  const area = 100 * 50;
  const membraneEnergy = 0.5 * area * thickness * dot(EPSILON, matVec(D, EPSILON));
  const bendingEnergy = 0.5 * area * thickness ** 3 / 12 * dot(KAPPA, matVec(D, KAPPA));
  close(loadCase.membraneStrainEnergy, membraneEnergy, 5e-8, `${family.label} combined membrane energy`);
  close(loadCase.bendingStrainEnergy, bendingEnergy, 5e-8, `${family.label} combined bending energy`);
  close(loadCase.transverseShearStrainEnergy, 0, 5e-8, `${family.label} combined shear energy`);
  close(loadCase.totalStrainEnergy, membraneEnergy + bendingEnergy, 5e-8, `${family.label} combined total energy`);

  const pressureTotal = pressure * area;
  const expectedForce = [0, 0, pressureTotal];
  const expectedMoment = [25 * pressureTotal, -50 * pressureTotal, 0];
  vectorClose(loadCase.appliedLoadEvidence.appliedForce, expectedForce, 1e-9, `${family.label} combined pressure force`);
  vectorClose(loadCase.appliedLoadEvidence.appliedMomentAboutOrigin, expectedMoment, 1e-9, `${family.label} combined pressure moment`);
  assert.equal(loadCase.forceEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.momentEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.energyQualification.accepted, true);

  return Object.freeze({
    benchmarkId,
    formulation: family.formulation,
    topology: family.topology,
    publicRoute: 'calculateLocalShell(local-shell-model/v2)',
    independentOracle: Object.freeze({
      authority: 'AFFINE_MEMBRANE_PLUS_CONSTANT_CURVATURE_PLANE_STRESS_ENERGY_PLUS_PRESSURE_FREE_BODY',
      epsilon: [...EPSILON],
      curvature: [...KAPPA],
      membraneEnergy,
      bendingEnergy,
      expectedForce,
      expectedMoment,
    }),
    actual: Object.freeze({
      membraneEnergy: loadCase.membraneStrainEnergy,
      bendingEnergy: loadCase.bendingStrainEnergy,
      shearEnergy: loadCase.transverseShearStrainEnergy,
      totalEnergy: loadCase.totalStrainEnergy,
      force: loadCase.appliedLoadEvidence.appliedForce,
      moment: loadCase.appliedLoadEvidence.appliedMomentAboutOrigin,
    }),
    disposition: 'PASS',
  });
}

function checkB9FieldCase({ caseId, epsilon, curvature }) {
  const thickness = 0.1;
  const area = 100 * 50;
  const membraneEnergy = 0.5 * area * thickness * dot(epsilon, matVec(D, epsilon));
  const bendingEnergy = 0.5 * area * thickness ** 3 / 12 * dot(curvature, matVec(D, curvature));
  const totalEnergy = membraneEnergy + bendingEnergy;
  const topCombined = matVec(D, epsilon.map((value, index) => (
    value + thickness / 2 * curvature[index]
  )));
  const independentOracle = Object.freeze({
    authority: 'CLOSED_FORM_AFFINE_MEMBRANE_CONSTANT_CURVATURE_PLANE_STRESS',
    thickness,
    characteristicLength: 100,
    tOverL: thickness / 100,
    totalEnergy,
    topSigmaX: topCombined[0],
  });

  const nodes = rectangleNodes(`${caseId}-N`);
  const constraints = fieldConstraints(nodes, epsilon, curvature);
  const cstDkt = summarizeFieldResult(
    solveCstDkt(cstDktSource({
      modelIdentity: `${caseId}-CST-DKT`,
      nodes,
      constraints,
      thickness,
      loadCaseId: caseId,
    })),
    epsilon,
    curvature,
    thickness,
    `${caseId}/CST-DKT`,
  );
  const mitc3 = summarizeFieldResult(
    solveMitc(productionSource({
      modelIdentity: `${caseId}-MITC3`,
      nodes,
      elements: planarElementsForNodes(FAMILIES[1], nodes, thickness, `${caseId}-M3`),
      constraints,
      loadCases: [emptyLoadCase(caseId)],
    })),
    epsilon,
    curvature,
    thickness,
    `${caseId}/MITC3`,
  );
  const mitc4 = summarizeFieldResult(
    solveMitc(productionSource({
      modelIdentity: `${caseId}-MITC4`,
      nodes,
      elements: planarElementsForNodes(FAMILIES[0], nodes, thickness, `${caseId}-M4`),
      constraints,
      loadCases: [emptyLoadCase(caseId)],
    })),
    epsilon,
    curvature,
    thickness,
    `${caseId}/MITC4`,
  );

  for (const [label, actual] of [
    ['CST/DKT', cstDkt],
    ['MITC3', mitc3],
    ['MITC4', mitc4],
  ]) {
    close(actual.totalEnergy, independentOracle.totalEnergy, 5e-8, `${caseId}/${label} energy vs independent`);
    close(actual.topSigmaX, independentOracle.topSigmaX, 5e-8, `${caseId}/${label} top sigmaX vs independent`);
  }

  return Object.freeze({
    caseId,
    independentOracle,
    cstDkt,
    mitc: Object.freeze({ MITC3: mitc3, MITC4: mitc4 }),
    cstDktRole: 'SECONDARY_COMPARATOR_ONLY',
    disposition: 'PASS_ALL_COLUMNS_AGAINST_INDEPENDENT_ORACLE',
  });
}

function summarizeFieldResult(result, epsilon, curvature, thickness, label) {
  verifyFieldRecovery(result, epsilon, curvature, thickness, label);
  const loadCase = result.loadCaseResults[0];
  const first = loadCase.elementResults[0].integrationPoints[0];
  const top = first.surfaces.find((surface) => surface.surface === 'TOP');
  assert.ok(top, `${label} must retain TOP surface`);
  return Object.freeze({
    resultSchema: result.schema,
    formulations: result.formulations ?? [result.formulation],
    totalEnergy: loadCase.totalStrainEnergy,
    topSigmaX: top.combinedStress.sigmaX,
    energyQualification: loadCase.energyQualification.accepted,
  });
}

function requireIndependentB9Row(row) {
  if (!row?.independentOracle) {
    throw new TypeError(`B9 ${row?.caseId ?? 'row'} requires an independent oracle before FE comparisons`);
  }
  if (row.independentOracle.authority === 'CST_DKT_ONLY') {
    throw new TypeError(`B9 ${row.caseId}: CST/DKT cannot be the sole oracle`);
  }
  if (!row.cstDkt || !row.mitc?.MITC3 || !row.mitc?.MITC4) {
    throw new TypeError(`B9 ${row.caseId}: independent | CST/DKT | MITC3 | MITC4 columns are mandatory`);
  }
  return row;
}

function requireNamedMitcRoute(result, benchmarkId, formulation) {
  assert.equal(result.schema, 'local-shell-result/v2');
  assert.equal(result.formulation, MITC_PRODUCTION_FORMULATION_FAMILY);
  assert.deepEqual(result.formulations, [formulation]);
  assert.equal(result.qualification.accepted, true);
  assert.equal(result.productionQualification.qualifiedForRelease, false);
  assert.equal(result.productionQualification.evidenceState, 'NOT_RUN');
  assert.equal(result.loadCaseResults.length, 1);
  assert.equal(result.loadCaseResults[0].loadCaseId, benchmarkId);
}

function verifyFieldRecovery(result, epsilon, curvature, thickness, label) {
  const loadCase = result.loadCaseResults[0];
  for (const elementResult of loadCase.elementResults) {
    const meshElement = result.meshEvidence.elements.find((row) => row.elementId === elementResult.elementId);
    const localEpsilon = rotateEngineeringTensor(epsilon, meshElement.localFrame);
    const localCurvature = rotateEngineeringTensor(curvature, meshElement.localFrame);
    for (const point of elementResult.integrationPoints) {
      const membrane = point.membraneStrain ?? elementResult.membraneStrain;
      recordClose(membrane, localEpsilon, ['epsilonX', 'epsilonY', 'gammaXY'], 5e-9, `${label} membrane`);
      recordClose(point.curvature, localCurvature, ['kappaX', 'kappaY', 'kappaXY'], 5e-9, `${label} curvature`);
      if (point.transverseShearStrain) {
        recordClose(point.transverseShearStrain, [0, 0], ['gammaXZ', 'gammaYZ'], 5e-9, `${label} shear`);
      }
      for (const surface of point.surfaces) {
        const expectedStrain = localEpsilon.map((value, index) => (
          value + surface.z * localCurvature[index]
        ));
        const expectedStress = matVec(D, expectedStrain);
        recordClose(surface.combinedStress, expectedStress, ['sigmaX', 'sigmaY', 'tauXY'], 5e-7, `${label} surface`);
      }
    }
  }

  const area = 100 * 50;
  const expectedMembraneEnergy = 0.5 * area * thickness * dot(epsilon, matVec(D, epsilon));
  const expectedBendingEnergy = 0.5 * area * thickness ** 3 / 12 * dot(curvature, matVec(D, curvature));
  close(loadCase.membraneStrainEnergy, expectedMembraneEnergy, 5e-8, `${label} membrane energy`);
  close(loadCase.bendingStrainEnergy, expectedBendingEnergy, 5e-8, `${label} bending energy`);
  if (loadCase.transverseShearStrainEnergy !== undefined) {
    close(loadCase.transverseShearStrainEnergy, 0, 5e-8, `${label} shear energy`);
  }
  close(loadCase.totalStrainEnergy, expectedMembraneEnergy + expectedBendingEnergy, 5e-8, `${label} total energy`);
  assert.equal(loadCase.energyQualification.accepted, true);
}

function productionSource({ modelIdentity, nodes, elements, constraints, loadCases }) {
  return {
    schema: MITC_PRODUCTION_MODEL_SCHEMA,
    modelIdentity,
    modelVersion: '2',
    sourceAncestry: ['qualification/a4-leg003/v1'],
    units: { ...CANONICAL_UNITS },
    formulationFamily: MITC_PRODUCTION_FORMULATION_FAMILY,
    materials: [{
      materialId: 'MAT',
      elasticModulus: E,
      poissonRatio: NU,
      sourceReference: 'MAT-SRC',
    }],
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

function cstDktSource({ modelIdentity, nodes, constraints, thickness, loadCaseId }) {
  return {
    schema: MODEL_SCHEMA,
    modelIdentity,
    modelVersion: '1',
    sourceAncestry: ['qualification/a4-leg003-b9/v1'],
    units: { ...CANONICAL_UNITS },
    formulation: FORMULATION,
    materials: [{
      materialId: 'MAT',
      elasticModulus: E,
      poissonRatio: NU,
      sourceReference: 'MAT-SRC',
    }],
    nodes,
    elements: [
      { elementId: 'E1', nodeIds: [nodes[0].nodeId, nodes[1].nodeId, nodes[2].nodeId], materialId: 'MAT', thickness, sourceReference: 'E1-SRC' },
      { elementId: 'E2', nodeIds: [nodes[0].nodeId, nodes[2].nodeId, nodes[3].nodeId], materialId: 'MAT', thickness, sourceReference: 'E2-SRC' },
    ],
    constraints,
    loadCases: [emptyLoadCase(loadCaseId)],
    resultRequests: {
      stressSurfaces: [...RESULT_REQUEST.stressSurfaces],
      dktIntegrationRule: RESULT_REQUEST.dktIntegrationRule,
      retainElementMatrices: true,
    },
    qualificationProfile: qualificationProfile(),
    limitations: [...BASE_LIMITATIONS],
  };
}

function solveMitc(source) {
  const result = calculateLocalShell(createCanonicalMitcProductionModel(source));
  assert.equal(result.qualification.accepted, true, `${source.modelIdentity}: ${result.qualification.summary}`);
  assert.equal(result.productionQualification.qualifiedForRelease, false);
  assert.equal(result.productionQualification.evidenceState, 'NOT_RUN');
  return result;
}

function solveCstDkt(source) {
  const result = calculateLocalShell(createCanonicalLocalShellModel(source));
  assert.equal(result.qualification.accepted, true, `${source.modelIdentity}: ${result.qualification.summary}`);
  return result;
}

function rectangleNodes(prefix) {
  return [
    flatNode(`${prefix}-A`, 0, 0),
    flatNode(`${prefix}-B`, 100, 0),
    flatNode(`${prefix}-C`, 100, 50),
    flatNode(`${prefix}-D`, 0, 50),
  ];
}

function planarElementsForNodes(family, nodes, thickness, elementPrefix) {
  const [a, b, c, d] = nodes.map((node) => node.nodeId);
  if (family.formulation === MITC4_FORMULATION) {
    return [productionElement(`${elementPrefix}-Q1`, family.formulation, family.topology, [a, b, c, d], thickness)];
  }
  return [
    productionElement(`${elementPrefix}-T1`, family.formulation, family.topology, [a, b, c], thickness),
    productionElement(`${elementPrefix}-T2`, family.formulation, family.topology, [a, c, d], thickness),
  ];
}

function cylinderNodes(segments, { radius, length, span, prefix }) {
  const nodes = [];
  for (let axial = 0; axial < 2; axial += 1) {
    for (let index = 0; index <= segments; index += 1) {
      const angle = -span / 2 + span * index / segments;
      nodes.push(cylinderNode(`${prefix}-N${axial}-${index}`, axial * length, radius, angle));
    }
  }
  return nodes;
}

function cylinderElements(family, segments, thickness) {
  const elements = [];
  const prefix = `${family.label}-C`;
  for (let index = 0; index < segments; index += 1) {
    const a = `${prefix}-N0-${index}`;
    const b = `${prefix}-N1-${index}`;
    const c = `${prefix}-N1-${index + 1}`;
    const d = `${prefix}-N0-${index + 1}`;
    if (family.formulation === MITC4_FORMULATION) {
      elements.push(productionElement(`Q${index}`, family.formulation, family.topology, [a, b, c, d], thickness));
    } else {
      elements.push(
        productionElement(`T${index}A`, family.formulation, family.topology, [a, b, c], thickness),
        productionElement(`T${index}B`, family.formulation, family.topology, [a, c, d], thickness),
      );
    }
  }
  return elements;
}

function cylinderNode(nodeId, x, radius, angle) {
  const director = [0, Math.sin(angle), Math.cos(angle)];
  const rotationBasis1 = [1, 0, 0];
  const rotationBasis2 = [0, Math.cos(angle), -Math.sin(angle)];
  return {
    nodeId,
    position: [x, radius * Math.sin(angle), radius * Math.cos(angle)],
    director,
    rotationBasis1,
    rotationBasis2,
    sourceReference: `${nodeId}-SRC`,
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

function fieldConstraints(nodes, epsilon, curvature) {
  const [ex, ey, gxy] = epsilon;
  const [kx, ky, kxy] = curvature;
  return nodes.flatMap((node) => {
    const [x, y] = node.position;
    return prescribed(node.nodeId, [
      ex * x + 0.5 * gxy * y,
      ey * y + 0.5 * gxy * x,
      -0.5 * kx * x ** 2 - 0.5 * ky * y ** 2 - 0.5 * kxy * x * y,
      -ky * y - 0.5 * kxy * x,
      kx * x + 0.5 * kxy * y,
    ]);
  });
}

function fullyFixed(nodes) {
  return nodes.flatMap((node) => prescribed(node.nodeId, [0, 0, 0, 0, 0]));
}

function prescribed(nodeId, values) {
  return ['UX', 'UY', 'UZ', 'R1', 'R2'].map((dof, index) => ({
    constraintId: `C-${nodeId}-${dof}`,
    nodeId,
    dof,
    value: values[index],
    sourceReference: `C-${nodeId}-${dof}-SRC`,
  }));
}

function emptyLoadCase(loadCaseId) {
  return {
    loadCaseId,
    nodalLoads: [],
    pressureLoads: [],
    sourceReference: `${loadCaseId}-SRC`,
  };
}

function circumferentialTangent(nodes, nodeIds) {
  const centroid = nodeIds
    .map((nodeId) => nodes.find((node) => node.nodeId === nodeId).position)
    .reduce((sum, position) => sum.map((value, index) => value + position[index]), [0, 0, 0])
    .map((value) => value / nodeIds.length);
  const angle = Math.atan2(centroid[1], centroid[2]);
  return [0, Math.cos(angle), -Math.sin(angle)];
}

function localDirection(global, frame) {
  let a = dot(global, frame.ex);
  let b = dot(global, frame.ey);
  const length = Math.hypot(a, b);
  a /= length;
  b /= length;
  return [a, b];
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

function projectStrain(record, a, b) {
  return a ** 2 * record.epsilonX + b ** 2 * record.epsilonY + a * b * record.gammaXY;
}

function projectStress(record, a, b) {
  return a ** 2 * record.sigmaX + b ** 2 * record.sigmaY + 2 * a * b * record.tauXY;
}

function planeStressMatrix(E0, nu) {
  const factor = E0 / (1 - nu ** 2);
  return [
    [factor, factor * nu, 0],
    [factor * nu, factor, 0],
    [0, 0, factor * (1 - nu) / 2],
  ];
}

function matVec(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function recordClose(record, expected, fields, tolerance, label) {
  fields.forEach((field, index) => close(record[field], expected[index], tolerance, `${label} ${field}`));
}

function vectorClose(actual, expected, tolerance, label) {
  assert.equal(actual.length, expected.length, `${label} length`);
  actual.forEach((value, index) => close(value, expected[index], tolerance, `${label}[${index}]`));
}

function close(actual, expected, tolerance = 1e-9, label = 'value') {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= tolerance * scale,
    `${label}: ${actual} != ${expected}`,
  );
}
