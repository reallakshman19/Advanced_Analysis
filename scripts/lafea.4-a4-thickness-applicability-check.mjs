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
import { MITC4_FORMULATION } from '../src/core/local-shell/mitc4-element.js';
import { flatNode, qualificationProfile } from './lafea.4-fixtures.mjs';

/**
 * LAFEA.4 / A4 LEG-004 / MITC-B5.
 *
 * This checker closes the issue-requested per-level thickness/applicability
 * table through the public MITC v2 production route. Expected quantities are
 * the closed-form Timoshenko cantilever solution and its analytical bending /
 * shear energy split; production output is never used to choose the expected
 * values or the acceptance tolerances.
 *
 * The very-thin levels are formulation/locking diagnostics in linear theory.
 * A unit load is retained for numerical observability, so the absolute
 * displacement magnitude at the thinnest levels is NOT physical
 * small-displacement authority. Linear scaling permits the response amplitude
 * to be reduced without changing the normalized ratios reported here.
 */

const E = 200000;
const NU = 0;
const G = E / (2 * (1 + NU));
const SHEAR_FACTOR = 5 / 6;
const SPAN = 10;
const WIDTH = 1;
const TIP_LOAD = 1;
const ALONG = 8;

// Existing governed direct MITC3/MITC4 locking checks use ±2% per level and
// <1% spread. LEG-002 already uses 0.01 absolute shear-energy-fraction parity.
// Reuse those pre-existing qualification tolerances; do not fit this table.
const DEFLECTION_RELATIVE_TOLERANCE = 0.02;
const NORMALIZED_DEFLECTION_SPREAD_TOLERANCE = 0.01;
const ENERGY_RELATIVE_TOLERANCE = 0.02;
const SHEAR_FRACTION_ABSOLUTE_TOLERANCE = 0.01;

const THICKNESS_RATIOS = Object.freeze([0.2, 0.1, 0.01, 0.001, 0.0001, 0.00001]);
const families = Object.freeze([
  { label: 'MITC4', formulation: MITC4_FORMULATION, topology: MITC4_TOPOLOGY },
  { label: 'MITC3', formulation: MITC3_FORMULATION, topology: MITC3_TOPOLOGY },
]);

const tables = families.map((family) => runFamily(family));
for (const table of tables) {
  const ratios = table.levels.map((row) => row.normalizedDeflection);
  const spread = Math.max(...ratios) - Math.min(...ratios);
  assert.ok(
    spread < NORMALIZED_DEFLECTION_SPREAD_TOLERANCE,
    `${table.formulation}: normalized-deflection spread ${spread} exceeds ${NORMALIZED_DEFLECTION_SPREAD_TOLERANCE}`,
  );
  table.normalizedDeflectionSpread = spread;
}

const mandatoryNegatives = Object.freeze([
  negative('WRONG_BETA_SIGN_OR_AXIS', 'PASS', 'LEG-001 independent rigid-rotation wrong-beta falsifier'),
  negative('RIGID_ROTATION_PRODUCES_SHEAR_ENERGY', 'PASS', 'LEG-001 corrected-beta objectivity gate'),
  negative('INVERTED_OR_INVALID_Q4_JACOBIAN', 'PASS', 'MITC4 direct/adoption inverted-J rejection'),
  negative('SILENT_MITC4_TO_MITC3_OR_MITC_TO_CST_DKT_FALLBACK', 'PASS', 'MITC identity/topology dispatch gates'),
  negative('UNSUPPORTED_FAMILY_OR_MESH_MISMATCH', 'PASS', 'production-v2 formulation/topology canonicalization rejects mismatch'),
  negative('TRANSVERSE_SHEAR_RELABELED_AS_IN_PLANE_VON_MISES', 'PASS', 'LEG-001/002 recovery semantic-separation gates'),
  negative('GLOBAL_ORACLE_COMPARED_DIRECTLY_TO_ROTATED_LOCAL_RESULT', 'PASS', 'LEG-002 rotated affine oracle is transformed into element-local frame'),
  negative('STALE_MESH_LOAD_RECOVERY_PARENT', 'NOT_APPLICABLE_DIRECT_V2_ATOMIC_MODEL', 'public MITC-v2 benchmark payload is one canonical model; retained-mesh/workbench parent-currentness is not exposed by this direct route and receives no A4 authority'),
  negative('PRESSURE_FORCE_CORRECT_BUT_FIRST_MOMENT_WRONG', 'PASS', 'LEG-002 deliberate +1000 Nmm moment corruption fails moment gate while force remains PASS'),
  negative('CST_DKT_USED_AS_SOLE_MITC_ORACLE', 'PASS', 'LEG-003 missing-independent and CST_DKT_ONLY authority negatives are rejected'),
]);

const applicability = Object.freeze({
  qualified: [
    'LINEAR_ELASTIC_SMALL_STRAIN_REISSNER_MINDLIN_KINEMATICS',
    'MITC3_TRI3_AND_MITC4_QUAD4_PUBLIC_LOCAL_SHELL_MODEL_V2_DISPATCH',
    'FIVE_DOF_TRANSLATION_PLUS_TANGENT_ROTATION_WITHOUT_DRILLING',
    'K_EQUALS_5_OVER_6_TRANSVERSE_SHEAR_CORRECTION',
    'TIMOSHENKO_STRIP_NORMALIZED_RESPONSE_T_OVER_L_1E_MINUS_5_TO_0_POINT_2',
    'INDEPENDENT_FORCE_MOMENT_ENERGY_AND_RECOVERY_EVIDENCE_FROM_LEG001_TO_LEG004',
  ],
  explicitlyNotQualified: [
    'SEVERE_DISTORTION_BOUNDARY_WITHOUT_OWNER_AUTHORIZED_QUALITY_CRITERION',
    'DRILLING_DOF_OR_DRILLING_STIFFNESS',
    'FOLLOWER_PRESSURE_OR_GEOMETRIC_NONLINEARITY',
    'PLASTICITY_CONTACT_WELD_OR_CODE_COMPLIANCE',
    'BLANKET_THICK_SHELL_AUTHORITY',
    'PHYSICAL_LARGE_DISPLACEMENT_AUTHORITY_FROM_UNIT_LOAD_THIN_LIMIT_ROWS',
    'RETAINED_MESH_WORKBENCH_MITC_PARENT_CURRENTNESS_NOT_EXPOSED_BY_DIRECT_V2_ROUTE',
    'RELEASE_QUALIFICATION',
  ],
  b6Disposition: 'BLOCKED_AUTHORITY_NO_OWNER_AUTHORIZED_NORMALIZED_JACOBIAN_OR_DISTORTION_THRESHOLD',
  releaseQualified: false,
});

console.log(JSON.stringify({
  schema: 'lafea4-a4-thickness-applicability-check/v1',
  status: 'PASS_WITH_B6_AUTHORITY_BLOCKER',
  oracleAuthority: 'INDEPENDENT_TIMOSHENKO_CLOSED_FORM',
  productionOutputUsedToChooseExpectedValues: false,
  productionOutputUsedToChooseTolerance: false,
  cstDktUsedAsSoleOracle: false,
  thicknessRatios: THICKNESS_RATIOS,
  tolerances: {
    deflectionRelative: DEFLECTION_RELATIVE_TOLERANCE,
    normalizedDeflectionSpread: NORMALIZED_DEFLECTION_SPREAD_TOLERANCE,
    totalEnergyRelative: ENERGY_RELATIVE_TOLERANCE,
    shearEnergyFractionAbsolute: SHEAR_FRACTION_ABSOLUTE_TOLERANCE,
  },
  tables,
  mandatoryNegatives,
  applicability,
}, null, 2));

console.log('\n✅ A4 LEG-004 B5 thickness/applicability matrix passed; B6 remains an explicit authority blocker.');

function runFamily(family) {
  const levels = THICKNESS_RATIOS.map((tOverL) => runLevel(family, tOverL));
  return {
    formulation: family.formulation,
    topology: family.topology,
    levels,
    normalizedDeflectionSpread: null,
    status: 'PASS',
  };
}

function runLevel(family, tOverL) {
  const thickness = tOverL * SPAN;
  const independent = timoshenkoOracle(thickness);
  const source = stripSource(family, thickness, tOverL);
  const result = solveProduction(source);
  const loadCase = result.loadCaseResults[0];
  const tipRows = loadCase.nodalDisplacements
    .filter((row) => row.nodeId === `N0-${ALONG}` || row.nodeId === `N1-${ALONG}`);
  assert.equal(tipRows.length, 2, `${family.label} t/L=${tOverL}: two tip nodes required`);
  const productionTipDeflection = Math.abs((tipRows[0].uz + tipRows[1].uz) / 2);
  const normalizedDeflection = productionTipDeflection / independent.totalDeflection;
  const deflectionRelativeError = relativeError(productionTipDeflection, independent.totalDeflection);

  assert.ok(
    deflectionRelativeError <= DEFLECTION_RELATIVE_TOLERANCE,
    `${family.label} t/L=${tOverL}: deflection relative error ${deflectionRelativeError}`,
  );

  const totalEnergyRelativeError = relativeError(loadCase.totalStrainEnergy, independent.totalEnergy);
  assert.ok(
    totalEnergyRelativeError <= ENERGY_RELATIVE_TOLERANCE,
    `${family.label} t/L=${tOverL}: total-energy relative error ${totalEnergyRelativeError}`,
  );
  assert.ok(loadCase.bendingStrainEnergy > 0, `${family.label} t/L=${tOverL}: bending energy must be positive`);
  assert.ok(loadCase.transverseShearStrainEnergy > 0, `${family.label} t/L=${tOverL}: shear energy must be positive`);

  const productionShearFraction = loadCase.transverseShearStrainEnergy / loadCase.totalStrainEnergy;
  const shearFractionAbsoluteError = Math.abs(productionShearFraction - independent.shearEnergyFraction);
  assert.ok(
    shearFractionAbsoluteError <= SHEAR_FRACTION_ABSOLUTE_TOLERANCE,
    `${family.label} t/L=${tOverL}: shear-energy fraction error ${shearFractionAbsoluteError}`,
  );

  assert.equal(loadCase.forceEquilibrium.qualification.accepted, true, `${family.label} t/L=${tOverL}: force equilibrium`);
  assert.equal(loadCase.momentEquilibrium.qualification.accepted, true, `${family.label} t/L=${tOverL}: moment equilibrium`);
  assert.equal(loadCase.energyQualification.accepted, true, `${family.label} t/L=${tOverL}: energy qualification`);
  assert.equal(loadCase.freeDofResidualQualification.accepted, true, `${family.label} t/L=${tOverL}: free-DOF residual`);

  const solver = solverSnapshot(loadCase.solverEvidence);
  assert.equal(solver.accepted, true, `${family.label} t/L=${tOverL}: solver evidence must be accepted`);

  return Object.freeze({
    formulation: family.formulation,
    topology: family.topology,
    tOverL,
    thickness,
    span: SPAN,
    width: WIDTH,
    tipLoad: TIP_LOAD,
    interpretation: 'LINEAR_FORMULATION_LOCKING_AND_SHEAR_APPLICABILITY_DIAGNOSTIC_LOAD_AMPLITUDE_SCALABLE',
    analyticalBendingDeflection: independent.bendingDeflection,
    analyticalShearDeflection: independent.shearDeflection,
    analyticalTotalDeflection: independent.totalDeflection,
    productionTipDeflection,
    normalizedDeflection,
    deflectionRelativeError,
    analyticalBendingEnergy: independent.bendingEnergy,
    analyticalShearEnergy: independent.shearEnergy,
    analyticalTotalEnergy: independent.totalEnergy,
    productionBendingEnergy: loadCase.bendingStrainEnergy,
    productionShearEnergy: loadCase.transverseShearStrainEnergy,
    productionTotalEnergy: loadCase.totalStrainEnergy,
    bendingEnergyRelativeError: relativeError(loadCase.bendingStrainEnergy, independent.bendingEnergy),
    shearEnergyRelativeError: relativeError(loadCase.transverseShearStrainEnergy, independent.shearEnergy),
    totalEnergyRelativeError,
    analyticalShearEnergyFraction: independent.shearEnergyFraction,
    productionShearEnergyFraction: productionShearFraction,
    shearEnergyFractionAbsoluteError,
    forceEquilibriumAccepted: true,
    momentEquilibriumAccepted: true,
    energyQualificationAccepted: true,
    freeDofResidualAccepted: true,
    freeDofCount: loadCase.freeDofIdentities.length,
    solver,
    releaseQualified: result.productionQualification.qualifiedForRelease,
    releaseEvidenceState: result.productionQualification.evidenceState,
    status: 'PASS',
  });
}

function timoshenkoOracle(thickness) {
  const area = WIDTH * thickness;
  const inertia = WIDTH * thickness ** 3 / 12;
  const bendingDeflection = TIP_LOAD * SPAN ** 3 / (3 * E * inertia);
  const shearDeflection = TIP_LOAD * SPAN / (SHEAR_FACTOR * G * area);
  const totalDeflection = bendingDeflection + shearDeflection;
  const bendingEnergy = 0.5 * TIP_LOAD * bendingDeflection;
  const shearEnergy = 0.5 * TIP_LOAD * shearDeflection;
  const totalEnergy = bendingEnergy + shearEnergy;
  return Object.freeze({
    area,
    inertia,
    bendingDeflection,
    shearDeflection,
    totalDeflection,
    bendingEnergy,
    shearEnergy,
    totalEnergy,
    shearEnergyFraction: shearEnergy / totalEnergy,
  });
}

function stripSource(family, thickness, tOverL) {
  const nodes = [];
  for (let row = 0; row < 2; row += 1) {
    for (let index = 0; index <= ALONG; index += 1) {
      nodes.push(flatNode(`N${row}-${index}`, index * SPAN / ALONG, row * WIDTH));
    }
  }

  const elements = [];
  for (let index = 0; index < ALONG; index += 1) {
    const a = `N0-${index}`;
    const b = `N0-${index + 1}`;
    const c = `N1-${index + 1}`;
    const d = `N1-${index}`;
    if (family.formulation === MITC4_FORMULATION) {
      elements.push(productionElement(`Q${index}`, family.formulation, family.topology, [a, b, c, d], thickness));
    } else {
      elements.push(
        productionElement(`T${index}A`, family.formulation, family.topology, [a, b, c], thickness),
        productionElement(`T${index}B`, family.formulation, family.topology, [a, c, d], thickness),
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

  const loadCaseId = `${family.label}-B5-${String(tOverL).replace('.', 'P')}`;
  return productionSource({
    modelIdentity: `A4-${loadCaseId}`,
    nodes,
    elements,
    constraints,
    loadCases: [{
      loadCaseId,
      nodalLoads: [
        nodalLoad(`N0-${ALONG}`, TIP_LOAD / 2),
        nodalLoad(`N1-${ALONG}`, TIP_LOAD / 2),
      ],
      pressureLoads: [],
      sourceReference: `${loadCaseId}-SRC`,
    }],
  });
}

function productionSource({ modelIdentity, nodes, elements, constraints, loadCases }) {
  return {
    schema: MITC_PRODUCTION_MODEL_SCHEMA,
    modelIdentity,
    modelVersion: '2',
    sourceAncestry: ['qualification/a4-leg004/v1'],
    units: { ...CANONICAL_UNITS },
    formulationFamily: MITC_PRODUCTION_FORMULATION_FAMILY,
    materials: [{ materialId: 'MAT', elasticModulus: E, poissonRatio: NU, sourceReference: 'MAT-SRC' }],
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

function solveProduction(source) {
  const canonical = createCanonicalMitcProductionModel(source);
  const result = calculateLocalShell(canonical);
  assert.equal(result.schema, 'local-shell-result/v2');
  assert.equal(result.qualification.accepted, true, `${source.modelIdentity}: ${result.qualification.summary}`);
  assert.equal(result.productionQualification.qualifiedForRelease, false);
  assert.equal(result.productionQualification.evidenceState, 'NOT_RUN');
  return result;
}

function solverSnapshot(evidence) {
  assert.ok(evidence && typeof evidence.method === 'string' && evidence.method.length > 0, 'solver method required');
  assert.equal(evidence.accepted, true, `solver ${evidence.method} must be accepted`);
  const row = {
    method: evidence.method,
    accepted: evidence.accepted,
    algorithmRevision: evidence.algorithmRevision ?? null,
    preconditioner: evidence.preconditioner ?? null,
    minimumPivot: evidence.minimumPivot ?? null,
    pivotTolerance: evidence.pivotTolerance ?? null,
    pivotToToleranceRatio: null,
    finalResidualInfinity: evidence.finalResidualInfinity ?? null,
    convergenceTarget: evidence.convergenceTarget ?? null,
    iterationCount: evidence.iterationCount ?? null,
  };
  if (Array.isArray(evidence.pivots) && evidence.pivots.length > 0) {
    assert.ok(Number.isFinite(evidence.minimumPivot));
    assert.ok(Number.isFinite(evidence.pivotTolerance));
    assert.ok(evidence.minimumPivot > evidence.pivotTolerance, 'dense solve minimum pivot must exceed tolerance');
    row.pivotToToleranceRatio = evidence.minimumPivot / evidence.pivotTolerance;
  }
  if (Number.isFinite(evidence.finalResidualInfinity) && Number.isFinite(evidence.convergenceTarget)) {
    assert.ok(evidence.finalResidualInfinity <= evidence.convergenceTarget, 'iterative solve must meet convergence target');
  }
  return Object.freeze(row);
}

function negative(id, disposition, evidence) {
  return Object.freeze({ id, disposition, evidence });
}

function relativeError(actual, expected) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected));
  assert.notEqual(expected, 0);
  return Math.abs(actual - expected) / Math.abs(expected);
}
