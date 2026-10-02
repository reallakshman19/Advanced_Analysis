#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildModelLoadFoundation } from '../src/core/model-loads/model-load-foundation.js';
import { buildPipingPortTopologyGraph } from '../src/core/piping-topology/index.js';
import {
  createSharedPipingModel,
  semanticHash,
} from '../src/core/shared-piping-model/index.js';
import { NON_FEA_COMMON_SCHEMAS } from '../src/core/non-fea-common-checker/index.js';
import {
  createEmptyProjectDataProfile,
  replaceProjectDataValue,
} from '../src/workspace/project-data/project-data-contract.js';
import {
  createNonFeaProductDefaultProvider,
} from '../src/workspace/project-data/non-fea-product-default-profile.js';
import { buildSupportSiteModel } from '../src/workspace/support-sites/support-site-model.js';
import { buildRoutePartitionModel } from '../src/workspace/routes/route-partition-model.js';
import {
  createNonFeaEmpiricalRunAuthorization,
} from '../src/workspace/engineering-loads/non-fea-empirical-run-authorization.js';
import {
  createCurrentCommonInputEmpiricalMassProjection,
} from '../src/workspace/engineering-loads/current-common-input-empirical-mass-projection.js';
import {
  calculateSupportLoadDistributionFromQualifiedCaseMasses,
} from '../src/workspace/engineering-loads/support-load-distribution-v3.js';

/**
 * Issue #1321 independent hand-calculation qualification.
 *
 * The expected values below are derived only from the declared benchmark inputs:
 *   L = 2.000 m
 *   dry pipe = 10 kg/m
 *   insulation = 1 kg/m
 *   OPE fluid = 2 kg/m
 *   HYD fluid = 3 kg/m
 *   g = 9.80665 m/s²
 *   load factor = 1
 *   vertical supports at x = 0 and 2000 mm
 *
 * Hand equations:
 *   m_case = L * (m'_pipe + m'_insulation + m'_fluid,case)
 *   W_case = m_case * g * LF
 *   x_bar = L/2 = 1000 mm
 *   R_A = W * (L-x_bar)/L = W/2
 *   R_B = W * x_bar/L = W/2
 *   sum(R) - W = 0
 *   R_B*L - W*x_bar = 0
 *
 * Production expected values are never imported from a fixture or result file.
 */

const INPUT = Object.freeze({
  lengthM: 2,
  lengthMm: 2000,
  pipeKgPerM: 10,
  insulationKgPerM: 1,
  opeFluidKgPerM: 2,
  hydFluidKgPerM: 3,
  gravityMPerS2: 9.80665,
  loadFactor: 1,
  centroidMm: 1000,
});

const HAND = Object.freeze({
  EMPTY: handCase(0),
  OPE: handCase(INPUT.opeFluidKgPerM),
  HYD: handCase(INPUT.hydFluidKgPerM),
});

// Establish the numerical hand solution before any production calculation runs.
assertClose(HAND.EMPTY.massKg, 22, 1e-12, 'hand EMPTY mass');
assertClose(HAND.OPE.massKg, 26, 1e-12, 'hand OPE mass');
assertClose(HAND.HYD.massKg, 28, 1e-12, 'hand HYD mass');
assertClose(HAND.EMPTY.forceN, 215.7463, 1e-10, 'hand EMPTY gravity force');
assertClose(HAND.OPE.forceN, 254.9729, 1e-10, 'hand OPE gravity force');
assertClose(HAND.HYD.forceN, 274.5862, 1e-10, 'hand HYD gravity force');

const sharedModel = makeSharedModel();
const sourceTopology = buildPipingPortTopologyGraph(sharedModel);
const sourceLoadPrimitiveSet = buildModelLoadFoundation(sharedModel, sourceTopology).loadPrimitiveSet;
const effectiveProfile = makeEffectiveProjectProfile();
const readyCommonInput = makeCommonInput({
  sourceModel: sharedModel,
  enrichedModel: sharedModel,
  projectDataProfile: effectiveProfile,
  sourceLoadPrimitiveSet,
});
const readySnapshot = {
  commonInput: readyCommonInput,
  staleness: { stale: false, changes: [] },
  error: '',
};
const runAuthorization = createNonFeaEmpiricalRunAuthorization(readySnapshot, {
  authorizedAt: '2026-08-27T18:12:00.000Z',
});
const massProjection = createCurrentCommonInputEmpiricalMassProjection({
  snapshot: readySnapshot,
  runAuthorization,
});

assert.equal(massProjection.entityRows.length, 1);
const projectedPipe = massProjection.entityRows[0];
assert.equal(projectedPipe.entityId, 'PIPE-A');
assert.equal(projectedPipe.cases.length, 3);

for (const caseId of ['EMPTY', 'OPE', 'HYD']) {
  const projected = projectionCase(projectedPipe, caseId);
  const hand = HAND[caseId];
  assert.equal(projected.mode, 'DISTRIBUTED');
  assertClose(projected.sourceLengthM, INPUT.lengthM, 1e-12, `${caseId} source length`);
  assertClose(projected.massKg, hand.massKg, 1e-12, `${caseId} mass projection parity`);
  assertClose(
    projected.totalMassPerLengthKgPerM,
    hand.massPerLengthKgPerM,
    1e-12,
    `${caseId} mass-per-length parity`,
  );
}

const dataset = makeWorkspaceDataset(sharedModel);
const supportSiteModel = buildSupportSiteModel(dataset, effectiveProfile);
const routePartitionModel = buildRoutePartitionModel(dataset, effectiveProfile);
assert.equal(supportSiteModel.status, 'READY');
assert.equal(routePartitionModel.status, 'READY');
assert.equal(supportSiteModel.sites.length, 2);
assert.equal(routePartitionModel.routes.length, 1);
assertClose(routePartitionModel.routes[0].totalLengthMm, INPUT.lengthMm, 1e-9, 'route length');

const qualifiedCaseMasses = projectedPipe.cases.map((caseRow) => ({
  entityId: projectedPipe.entityId,
  loadCaseId: caseRow.loadCaseId,
  massKg: caseRow.massKg,
  source: {
    kind: 'QUALIFIED_CASE_MASS_RECEIPT',
    authority: 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION',
    semanticHash: massProjection.semanticHash,
    caseSemanticHash: semanticHash(caseRow),
    mode: caseRow.mode,
  },
}));

const distribution = calculateSupportLoadDistributionFromQualifiedCaseMasses({
  dataset,
  profile: effectiveProfile,
  supportSiteModel,
  routePartitionModel,
  masterData: {
    lineList: { sourceHash: '' },
    pipingClass: { sourceHash: '' },
    weight: { sourceHash: '' },
  },
}, qualifiedCaseMasses);

assert.equal(distribution.status, 'CALCULATED');
assert.equal(distribution.loadCases.length, 3);

const leftSite = siteByTag(supportSiteModel, 'S-LEFT');
const rightSite = siteByTag(supportSiteModel, 'S-RIGHT');

for (const caseId of ['EMPTY', 'OPE', 'HYD']) {
  const hand = HAND[caseId];
  const loadCase = distribution.loadCases.find((row) => row.loadCaseId === caseId);
  assert.ok(loadCase, `missing support-load case ${caseId}`);
  assert.equal(loadCase.status, 'CALCULATED');
  assert.equal(loadCase.exceptionLedger.length, 0);
  assert.equal(loadCase.excludedInputs.length, 0);
  assert.equal(loadCase.blockers.length, 0);
  assert.equal(loadCase.equilibrium.passed, true);

  const contribution = loadCase.contributionLedger.find((row) => row.entityId === 'PIPE-A');
  assert.ok(contribution, `missing PIPE-A contribution for ${caseId}`);
  assertClose(contribution.massKg, hand.massKg, 1e-12, `${caseId} contribution mass`);
  assertClose(contribution.verticalForceN, hand.forceN, 1e-9, `${caseId} gravity force parity`);

  const leftReaction = supportReaction(loadCase, leftSite.siteId);
  const rightReaction = supportReaction(loadCase, rightSite.siteId);
  assertClose(leftReaction, hand.leftReactionN, 1e-9, `${caseId} left reaction parity`);
  assertClose(rightReaction, hand.rightReactionN, 1e-9, `${caseId} right reaction parity`);
  assertClose(leftReaction + rightReaction, hand.forceN, 1e-9, `${caseId} force closure`);

  console.log('EQUILIBRIUM:', loadCase.equilibrium);
  assertClose(
    loadCase.equilibrium.evaluatedForceN,
    hand.forceN,
    1e-9,
    `${caseId} evaluated force`,
  );
  assertClose(
    loadCase.equilibrium.evaluatedMomentNmm,
    hand.firstMomentNmm,
    1e-6,
    `${caseId} evaluated first moment`,
  );
  assertClose(
    loadCase.equilibrium.reactionN,
    hand.forceN,
    1e-9,
    `${caseId} reaction force`,
  );
  assertClose(
    loadCase.equilibrium.reactionMomentNmm,
    hand.firstMomentNmm,
    1e-6,
    `${caseId} reaction first moment`,
  );
  assertClose(loadCase.equilibrium.forceResidualN, 0, 1e-9, `${caseId} force residual`);
  assertClose(loadCase.equilibrium.momentResidualNmm, 0, 1e-6, `${caseId} moment residual`);
}

// Independent sensitivity falsifier: changing one declared physical input must
// change the hand result. This prevents a frozen/stored expected-output pattern.
const heavierHand = handCase(INPUT.opeFluidKgPerM + 0.5);
assertClose(heavierHand.massKg - HAND.OPE.massKg, 1, 1e-12, '0.5 kg/m over 2 m mass sensitivity');
assertClose(
  heavierHand.forceN - HAND.OPE.forceN,
  INPUT.gravityMPerS2,
  1e-10,
  'one-kilogram gravity-force sensitivity',
);
assert.notEqual(heavierHand.leftReactionN, HAND.OPE.leftReactionN);

console.log(JSON.stringify({
  status: 'PASS',
  benchmark: 'ISSUE1321_HANDCALC_MASS_SUPPORT_PARITY_2M_PIPE',
  declaredInputs: INPUT,
  handCases: HAND,
  productionMassProjectionSemanticHash: massProjection.semanticHash,
  routeLengthMm: routePartitionModel.routes[0].totalLengthMm,
  supportCount: supportSiteModel.sites.length,
  massParity: true,
  gravityForceParity: true,
  supportReactionParity: true,
  forceEquilibriumParity: true,
  firstMomentEquilibriumParity: true,
  storedExpectedSolverOutputUsed: false,
  productionMechanicsModified: false,
}, null, 2));

function handCase(fluidKgPerM) {
  const massPerLengthKgPerM = INPUT.pipeKgPerM + INPUT.insulationKgPerM + fluidKgPerM;
  const massKg = massPerLengthKgPerM * INPUT.lengthM;
  const forceN = massKg * INPUT.gravityMPerS2 * INPUT.loadFactor;
  const leftReactionN = forceN * (INPUT.lengthMm - INPUT.centroidMm) / INPUT.lengthMm;
  const rightReactionN = forceN * INPUT.centroidMm / INPUT.lengthMm;
  const firstMomentNmm = forceN * INPUT.centroidMm;
  return Object.freeze({
    fluidKgPerM,
    massPerLengthKgPerM,
    massKg,
    forceN,
    leftReactionN,
    rightReactionN,
    firstMomentNmm,
  });
}

function makeEffectiveProjectProfile() {
  let profile = createEmptyProjectDataProfile();
  profile = {
    ...profile,
    projectId: 'ISSUE1321-HANDCALC-PARITY',
    revision: 1,
    updatedAt: '2026-08-27T18:12:00.000Z',
  };
  profile = replaceProjectDataValue(
    profile,
    'topology.supportTypeCapabilities',
    { REST: { vertical: true } },
    { source: 'Issue #1321 hand-calculation benchmark', authority: 'PROJECT_POLICY' },
    true,
  );
  return createNonFeaProductDefaultProvider({ profile }).effectiveProfile;
}

function makeSharedModel() {
  return createSharedPipingModel({
    project: {
      datasetId: 'ISSUE1321-HANDCALC-DATASET',
      name: 'Issue 1321 hand-calculation parity benchmark',
      sourceName: 'independent hand-calculation fixture',
    },
    units: { length: 'mm', force: 'N', mass: 'kg' },
    sourceSnapshotRef: {
      schema: 'source-package-snapshot/v1',
      datasetId: 'ISSUE1321-HANDCALC-DATASET',
      sourceSchema: 'issue1321-handcalc/v1',
      sourceSemanticHash: semanticHash({
        benchmark: 'ISSUE1321_HANDCALC_MASS_SUPPORT_PARITY_2M_PIPE',
        input: INPUT,
      }),
      sourceByteHash: null,
    },
    components: [
      sharedPipeComponent(),
    ],
    supports: [],
    sourceReferences: { nodes: [] },
    diagnostics: [],
  });
}

function sharedPipeComponent() {
  const start = point(0);
  const end = point(INPUT.lengthMm);
  return {
    componentKey: 'PIPE-A',
    sourceEntityId: 'PIPE-A',
    name: 'PIPE-A',
    type: 'PIPE',
    identity: {
      lineId: 'L-1',
      branchId: 'B-1',
      systemId: 'SYS-1',
      zoneId: 'Z-1',
    },
    geometry: {
      start,
      end,
      center: point(INPUT.centroidMm),
      points: [start, end],
      branchPoints: [],
      explicitCenter: false,
      boreMm: null,
      ports: [
        port('PIPE-A', 'start', start),
        port('PIPE-A', 'end', end),
      ],
      sources: {
        start: 'PIPE-A.start',
        end: 'PIPE-A.end',
        center: 'derived.midpoint',
        branches: [],
      },
    },
    engineeringProperties: {
      unitPipeWeightKgPerM: evidence(INPUT.pipeKgPerM, 'kg/m', 'UNIT_PIPE_WEIGHT_KG_PER_M'),
      outerDiameterMm: evidence(100, 'mm', 'OUTSIDE_DIAMETER_MM'),
      wallThicknessMm: evidence(5, 'mm', 'WALL_THICKNESS_MM'),
      materialDensityKgM3: evidence(7850, 'kg/m3', 'MATERIAL_DENSITY_KG_M3'),
      insulationWeightKgPerM: evidence(INPUT.insulationKgPerM, 'kg/m', 'INSULATION_WEIGHT_KG_PER_M'),
      insulationThicknessMm: evidence(0, 'mm', 'INSULATION_THICKNESS_MM'),
      fluidWeightOpeKgPerM: evidence(INPUT.opeFluidKgPerM, 'kg/m', 'FLUID_WEIGHT_OPE_KG_PER_M'),
      fluidWeightHydKgPerM: evidence(INPUT.hydFluidKgPerM, 'kg/m', 'FLUID_WEIGHT_HYD_KG_PER_M'),
    },
    compatibilityEvidence: {},
    sourceReferences: {
      sourceNodeKey: 'node:PIPE-A',
      sourceEntityId: 'PIPE-A',
      jsonPointer: '/objects/PIPE-A',
      sourcePath: '/MODEL/PIPE-A',
    },
    diagnostics: [],
  };
}

function makeCommonInput({ sourceModel, enrichedModel, projectDataProfile, sourceLoadPrimitiveSet }) {
  const base = {
    schema: NON_FEA_COMMON_SCHEMAS.COMMON_INPUT,
    packageState: 'READY',
    requestSemanticHash: semanticHash({ request: 'issue1321-handcalc' }),
    reportSemanticHash: semanticHash({ report: 'issue1321-handcalc' }),
    candidateSemanticHash: semanticHash({ candidate: 'issue1321-handcalc' }),
    sourceDatasetSha256: 'a'.repeat(64),
    sourceModelSemanticHash: sourceModel.semanticHash,
    enrichmentSidecarSemanticHash: semanticHash({ sidecar: 'issue1321-handcalc' }),
    resolutionLedgerSemanticHash: semanticHash({ resolution: 'issue1321-handcalc' }),
    enrichedProjectionSemanticHash: semanticHash({ projection: enrichedModel.semanticHash }),
    projectDataProfileSemanticHash: semanticHash(projectDataProfile),
    configuredDefaultUsageLedgerSemanticHash: null,
    qualificationProfileSemanticHash: null,
    requestedLoadCases: ['EMPTY', 'HYD', 'OPE'],
    sealedMethodIds: ['SUSTAINED_REACTIONS', 'WEIGHT_AND_GRAVITY'],
    blockedMethodIds: [],
    enrichedModel,
    resolutionLedger: { schema: 'issue1321-handcalc-resolution/v1' },
    projectDataProfile,
    configuredDefaultUsageLedger: null,
    qualificationProfile: null,
    authorityContracts: {
      topologyGraph: contract('topology'),
      supportAttachmentModel: contract('attachment'),
      restraintCapabilityModel: contract('restraint'),
      supportSiteModel: contract('support-site'),
      routePartitionModel: contract('route'),
      loadPrimitiveSet: {
        schema: sourceLoadPrimitiveSet.schema,
        status: 'READY',
        semanticHash: sourceLoadPrimitiveSet.semanticHash,
      },
    },
    methodReadiness: [],
    lineage: { schema: 'issue1321-handcalc-lineage/v1' },
    seal: {
      semanticHash: semanticHash({ seal: 'issue1321-handcalc' }),
      confirmedBy: 'Issue #1321 hand-calculation qualification fixture',
    },
  };
  return { ...base, semanticHash: semanticHash(base) };
}

function makeWorkspaceDataset(sharedModel) {
  return {
    datasetId: 'ISSUE1321-HANDCALC-DATASET',
    version: 1,
    sourceSha256: 'a'.repeat(64),
    sharedModel,
    entities: [
      pipingEntity('PIPE-A', point(0), point(INPUT.lengthMm)),
      supportEntity('SUPPORT-LEFT', 'S-LEFT', point(0)),
      supportEntity('SUPPORT-RIGHT', 'S-RIGHT', point(INPUT.lengthMm)),
    ],
  };
}

function pipingEntity(entityId, start, end) {
  return {
    entityId,
    entityType: 'PIPE',
    category: 'piping',
    branchId: 'B-1',
    lineKey: 'L-1',
    sourceEntityId: entityId,
    componentReference: entityId,
    jsonPointer: `/entities/${entityId}`,
    properties: {
      geometry: { start, end },
      attributes: {},
    },
  };
}

function supportEntity(entityId, tag, center) {
  return {
    entityId,
    entityType: 'SUPPORT',
    category: 'support',
    branchId: 'B-1',
    lineKey: 'L-1',
    sourceEntityId: entityId,
    componentReference: entityId,
    jsonPointer: `/supports/${entityId}`,
    properties: {
      geometry: { center },
      attributes: {
        SUPPORT_TAG: tag,
        SUPPORT_TYPE: 'REST',
      },
    },
  };
}

function projectionCase(entityRow, caseId) {
  const row = entityRow.cases.find((item) => item.loadCaseId === caseId);
  assert.ok(row, `missing projected case ${caseId}`);
  return row;
}

function siteByTag(model, tag) {
  const site = model.sites.find((row) => row.tags.includes(tag));
  assert.ok(site, `missing support site ${tag}`);
  return site;
}

function supportReaction(loadCase, supportSiteId) {
  const row = loadCase.supportResults.find((item) => item.supportSiteId === supportSiteId);
  assert.ok(row, `missing reaction for ${supportSiteId}`);
  return row.verticalForceN;
}

function point(x) {
  return { x, y: 0, z: 0 };
}

function port(key, role, position) {
  return {
    portKey: `${key}:port:${role}`,
    role,
    position,
    sourceReference: { sourcePath: `${key}.${role}` },
  };
}

function evidence(value, unit, field) {
  return {
    value,
    unit,
    sourcePath: `sourceAttributes.${field}`,
    sourceRoot: 'sourceAttributes',
    sourceKind: 'sourceAttributes',
  };
}

function contract(id) {
  return {
    schema: `issue1321-handcalc-${id}/v1`,
    status: 'READY',
    semanticHash: semanticHash({ contract: `issue1321-handcalc-${id}` }),
  };
}

function assertClose(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: actual must be finite`);
  assert.ok(Number.isFinite(expected), `${label}: expected must be finite`);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}, tolerance ${tolerance}`,
  );
}
