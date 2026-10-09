import { FORMULATIONS } from './constants.js';
import {
  matrixVector, multiply, scaleMatrix, transpose, zeros,
} from './matrix.js';
import { canonicalNumber } from './numeric.js';
import { preservePlanarTranslationNullspace } from './planar-translation-nullspace.js';

export const BBAR_FORMULA_IDS = Object.freeze({
  MODULI: 'PLANE_STRAIN_BBAR_ISOTROPIC_MODULI_V1',
  DEVIATORIC_SPLIT: 'PLANE_STRAIN_BBAR_DEVIATORIC_SPLIT_V1',
  MEAN_DILATATION: 'PLANE_STRAIN_BBAR_MEAN_DILATATION_V1',
  STIFFNESS: 'PLANE_STRAIN_BBAR_STIFFNESS_V1',
  STRESS: 'PLANE_STRAIN_BBAR_STRESS_RECOVERY_V1',
  ENERGY: 'PLANE_STRAIN_BBAR_ELASTIC_ENERGY_V1',
});

export function isBbarPlaneStrain(formulation) {
  return formulation === FORMULATIONS.PLANE_STRAIN_BBAR;
}

export function isPlaneStrainFormulation(formulation) {
  return formulation === FORMULATIONS.PLANE_STRAIN || isBbarPlaneStrain(formulation);
}

export function planeStrainIsotropicModuli(material) {
  const E = material.elasticModulus;
  const nu = material.poissonRatio;
  return Object.freeze({
    shearModulus: canonicalNumber(E / (2 * (1 + nu)), 'B-bar shear modulus'),
    bulkModulus: canonicalNumber(E / (3 * (1 - 2 * nu)), 'B-bar bulk modulus'),
  });
}

export function planeStrainDeviatoricMatrix(material) {
  const { shearModulus: mu } = planeStrainIsotropicModuli(material);
  return Object.freeze([
    Object.freeze([
      canonicalNumber(4 * mu / 3, 'B-bar Ddev xx'),
      canonicalNumber(-2 * mu / 3, 'B-bar Ddev xy'),
      0,
    ]),
    Object.freeze([
      canonicalNumber(-2 * mu / 3, 'B-bar Ddev yx'),
      canonicalNumber(4 * mu / 3, 'B-bar Ddev yy'),
      0,
    ]),
    Object.freeze([0, 0, canonicalNumber(mu, 'B-bar Ddev shear')]),
  ]);
}

export function volumetricRow(B) {
  return Object.freeze(B[0].map((value, index) => canonicalNumber(
    value + B[1][index],
    'B-bar volumetric B row',
  )));
}

export function meanDilatationEvidence(gaussEvidence) {
  if (!Array.isArray(gaussEvidence) || gaussEvidence.length === 0) {
    throw new TypeError('LAFEA_BBAR_GAUSS_EVIDENCE_REQUIRED');
  }
  const dofCount = gaussEvidence[0].B[0].length;
  const numerator = Array(dofCount).fill(0);
  let area = 0;
  for (const gp of gaussEvidence) {
    const weight = gp.weight * gp.jacobianDeterminant;
    area += weight;
    const row = volumetricRow(gp.B);
    row.forEach((value, index) => { numerator[index] += weight * value; });
  }
  if (!(area > 0)) throw new TypeError('LAFEA_BBAR_ELEMENT_AREA_INVALID');
  const meanVolumetricRow = numerator.map((value) => canonicalNumber(
    value / area,
    'B-bar mean volumetric row',
  ));
  return Object.freeze({
    integrationArea: canonicalNumber(area, 'B-bar integration area'),
    meanVolumetricRow: Object.freeze(meanVolumetricRow),
    integrationPointCount: gaussEvidence.length,
  });
}

export function bbarStiffnessMatrix(gaussEvidence, material, thickness) {
  const Ddev = planeStrainDeviatoricMatrix(material);
  const moduli = planeStrainIsotropicModuli(material);
  const mean = meanDilatationEvidence(gaussEvidence);
  const dofCount = mean.meanVolumetricRow.length;
  let deviatoric = zeros(dofCount, dofCount);
  for (const gp of gaussEvidence) {
    const contribution = scaleMatrix(
      multiply(multiply(transpose(gp.B), Ddev), gp.B),
      gp.weight * gp.jacobianDeterminant * thickness,
    );
    deviatoric = deviatoric.map((row, i) => row.map(
      (value, j) => value + contribution[i][j],
    ));
  }
  const volumetric = outerProduct(mean.meanVolumetricRow, mean.meanVolumetricRow)
    .map((row) => row.map((value) => value
      * moduli.bulkModulus * mean.integrationArea * thickness));
  const integratedStiffness = deviatoric.map((row, i) => row.map((value, j) => canonicalNumber(
    value + volumetric[i][j],
    'B-bar stiffness',
  )));
  const balanced = preservePlanarTranslationNullspace(integratedStiffness);
  return Object.freeze({
    stiffness: balanced.stiffness,
    meanDilatation: mean,
    deviatoricMatrix: Ddev,
    moduli,
    translationNullspace: balanced.evidence,
    formulaIds: Object.freeze([
      BBAR_FORMULA_IDS.MODULI,
      BBAR_FORMULA_IDS.DEVIATORIC_SPLIT,
      BBAR_FORMULA_IDS.MEAN_DILATATION,
      BBAR_FORMULA_IDS.STIFFNESS,
    ]),
  });
}

export function bbarMeanDilatation(meanVolumetricRow, localDisplacementVector) {
  return matrixVector([meanVolumetricRow], localDisplacementVector)[0];
}

export function recoverBbarPlaneStrainStress(strain, meanDilatation, material) {
  const { shearModulus: mu, bulkModulus: K } = planeStrainIsotropicModuli(material);
  const theta = strain[0] + strain[1];
  return Object.freeze({
    sigmaX: canonicalNumber(
      2 * mu * (strain[0] - theta / 3) + K * meanDilatation,
      'B-bar sigma x',
    ),
    sigmaY: canonicalNumber(
      2 * mu * (strain[1] - theta / 3) + K * meanDilatation,
      'B-bar sigma y',
    ),
    sigmaZ: canonicalNumber(
      -2 * mu * theta / 3 + K * meanDilatation,
      'B-bar sigma z',
    ),
    tauXY: canonicalNumber(mu * strain[2], 'B-bar tau xy'),
  });
}

export function bbarElementElasticEnergy(
  gaussEvidence,
  localDisplacementVector,
  meanVolumetricRow,
  material,
  thickness,
) {
  const { shearModulus: mu, bulkModulus: K } = planeStrainIsotropicModuli(material);
  const thetaBar = bbarMeanDilatation(meanVolumetricRow, localDisplacementVector);
  let deviatoricEnergy = 0;
  let area = 0;
  for (const gp of gaussEvidence) {
    const strain = matrixVector(gp.B, localDisplacementVector);
    const theta = strain[0] + strain[1];
    const exDev = strain[0] - theta / 3;
    const eyDev = strain[1] - theta / 3;
    const ezDev = -theta / 3;
    const tensorDevNormSquared = exDev * exDev + eyDev * eyDev + ezDev * ezDev
      + 0.5 * strain[2] * strain[2];
    const measure = gp.weight * gp.jacobianDeterminant;
    area += measure;
    deviatoricEnergy += mu * tensorDevNormSquared * measure * thickness;
  }
  const volumetricEnergy = 0.5 * K * thetaBar * thetaBar * area * thickness;
  return Object.freeze({
    strainEnergy: canonicalNumber(
      deviatoricEnergy + volumetricEnergy,
      'B-bar element elastic strain energy',
    ),
    deviatoricEnergy: canonicalNumber(deviatoricEnergy, 'B-bar deviatoric energy'),
    volumetricEnergy: canonicalNumber(volumetricEnergy, 'B-bar volumetric energy'),
    meanDilatation: canonicalNumber(thetaBar, 'B-bar mean dilatation'),
  });
}

function outerProduct(left, right) {
  return left.map((a) => right.map((b) => a * b));
}
