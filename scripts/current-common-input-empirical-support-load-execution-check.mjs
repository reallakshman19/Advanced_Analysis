#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { semanticHash } from '../src/core/shared-piping-model/index.js';
import {
  createEmptyProjectDataProfile,
  replaceProjectDataValue,
} from '../src/workspace/project-data/project-data-contract.js';
import {
  createNonFeaProductDefaultProvider,
} from '../src/workspace/project-data/non-fea-product-default-profile.js';
import {
  EMPIRICAL_LOAD_METHOD,
  calculateSupportLoadDistribution,
  calculateSupportLoadDistributionFromQualifiedCaseMasses,
} from '../src/workspace/engineering-loads/support-load-distribution-v3.js';

const SOURCE_SHA = 'a'.repeat(64);
const profile = fixtureProfile();
const dataset = fixtureDataset();
const routePartitionModel = fixtureRoutePartitionModel();
const supportSiteModel = fixtureSupportSiteModel();
const input = {
  dataset,
  profile,
  routePartitionModel,
  supportSiteModel,
  masterData: {
    lineList: { sourceHash: '' },
    pipingClass: { sourceHash: '' },
    weight: { sourceHash: '' },
  },
};
const masses = qualifiedMasses();

const distribution = calculateSupportLoadDistributionFromQualifiedCaseMasses(input, masses);
assert.equal(distribution.method, EMPIRICAL_LOAD_METHOD);
assert.equal(distribution.status, 'CALCULATED');
assert.deepEqual(
  distribution.loadCases.map((row) => row.loadCaseId),
  ['EMPTY', 'OPE', 'HYD'],
  'the qualified-mass seam must preserve the active Project Data case order',
);
assert.deepEqual(distribution.configuredDefaultUsageLedger.rows, [],
  'sealed case masses must not generate a second legacy configured-default usage ledger');

for (const [loadCaseId, pipeMassKg] of [
  ['EMPTY', 10],
  ['OPE', 20],
  ['HYD', 30],
]) {
  const loadCase = distribution.loadCases.find((row) => row.loadCaseId === loadCaseId);
  assert.ok(loadCase, `missing ${loadCaseId}`);
  assert.equal(loadCase.status, 'CALCULATED');
  assert.equal(loadCase.equilibrium.passed, true);
  assert.equal(loadCase.equilibrium.forceResidualN, 0);
  assert.equal(loadCase.equilibrium.momentResidualNmm, 0);
  assert.equal(loadCase.completenessAudit.evaluatedMassKg, pipeMassKg,
    'zero-mass GASK must remain a qualified contribution without inflating evaluated mass');
  assert.equal(loadCase.contributionLedger.length, 2,
    'PIPE and zero-mass GASK must both remain qualified contributions');

  const pipe = contribution(loadCase, 'PIPE-1');
  const gasket = contribution(loadCase, 'GASK-1');
  const expectedForce = pipeMassKg * 9.80665;
  assert.equal(pipe.massKg, pipeMassKg);
  assert.equal(pipe.verticalForceN, expectedForce);
  assert.equal(pipe.formula.massKg, pipeMassKg);
  assert.equal(
    pipe.formula.massAuthority.authority,
    'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION',
  );
  assert.deepEqual(pipe.formula.projectDataSources, [],
    'the kernel must not reconstruct legacy mass-map sources');
  assert.equal(gasket.massKg, 0);
  assert.equal(gasket.verticalForceN, 0);
  assert.equal(gasket.formula.massKg, 0);
  assert.equal(gasket.formula.massAuthority.mode, 'POINT');

  const s1 = support(loadCase, 'S1');
  const s2 = support(loadCase, 'S2');
  assert.equal(s1.verticalForceN, expectedForce / 2);
  assert.equal(s2.verticalForceN, expectedForce / 2,
    'zero GASK at S2 must add exactly zero reaction');
}

const missingMasses = masses.filter((row) => !(
  row.entityId === 'GASK-1' && row.loadCaseId === 'HYD'
));
const missing = calculateSupportLoadDistributionFromQualifiedCaseMasses(input, missingMasses);
const missingHyd = missing.loadCases.find((row) => row.loadCaseId === 'HYD');
assert.equal(missingHyd.status, 'FAILED',
  'missing qualified case mass must be fatal, not a partial best-effort calculation');
assert.ok(missingHyd.excludedInputs.some((row) => (
  row.code === 'MISSING_QUALIFIED_CASE_MASS'
  && row.entityId === 'GASK-1'
  && row.loadCaseId === 'HYD'
)));

assert.throws(
  () => calculateSupportLoadDistributionFromQualifiedCaseMasses(input, [
    ...masses.filter((row) => row.entityId !== 'GASK-1'),
    qualifiedMass('GASK-1', 'EMPTY', -1, 'POINT'),
  ]),
  /massKg must be finite and non-negative/u,
);
assert.throws(
  () => calculateSupportLoadDistributionFromQualifiedCaseMasses(input, [
    ...masses.filter((row) => row.entityId !== 'GASK-1'),
    {
      ...qualifiedMass('GASK-1', 'EMPTY', 0, 'POINT'),
      source: {
        ...qualifiedMass('GASK-1', 'EMPTY', 0, 'POINT').source,
        authority: 'CALLER_INVENTED_AUTHORITY',
      },
    },
  ]),
  /not a qualified mass receipt/u,
  'the low-level seam must accept only the exact current Common Input mass-projection authority label',
);

const legacy = calculateSupportLoadDistribution(input);
assert.equal(legacy.status, 'BLOCKED',
  'legacy entrypoint must retain its historical Project Data mass-map requirements');
assert.ok(legacy.loadCases.every((row) => row.status === 'BLOCKED'));

const kernelSource = await readFile(
  new URL('../src/workspace/engineering-loads/support-load-distribution-v3.js', import.meta.url),
  'utf8',
);
const wrapperSource = await readFile(
  new URL('../src/workspace/engineering-loads/current-common-input-empirical-support-load-execution.js', import.meta.url),
  'utf8',
);
assert.match(kernelSource,
  /configuration\.profileWorkflow \|\| 'loads'/u,
  'legacy profile workflow must remain the default');
assert.match(kernelSource,
  /profileWorkflow: 'loadCalcProjectBasis'/u,
  'qualified-mass seam must use the existing project-basis workflow');
assert.match(kernelSource,
  /source\.authority !== 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION'/u,
  'low-level seam must pin the exact mass authority label');
assert.match(kernelSource,
  /const forceN = mass\.massKg\s*\n\s*\* projectDataValue\(input\.profile, 'loadCalculation\.gravityMPerS2'\)\s*\n\s*\* projectDataValue\(input\.profile, 'loadCalculation\.loadFactor'\);/u,
  'mass-to-force equation must remain the existing kernel equation');
assert.match(kernelSource, /allocateSupportUniformLoad/u);
assert.match(kernelSource, /allocateSupportPointLoad/u);
assert.match(kernelSource, /evaluateSupportLoadAccounting/u);
assert.doesNotMatch(wrapperSource, /baselineId|handoffId|authorized-empirical-load-input/u,
  'current Common Input wrapper must not manufacture or depend on legacy publication/handoff authority');
assert.doesNotMatch(wrapperSource, /resolveCaseMass|componentCaseMass|fluidMass|componentMass\(/u,
  'current Common Input wrapper must not recompose sealed masses');
assert.match(wrapperSource, /projectId: stringValue\([^\n]+projectId[^\n]*\) \|\| null/u,
  'kernel cutover must not invent a new project-ID readiness gate');

console.log(JSON.stringify({
  status: 'PASS',
  benchmark: 'ISSUE1321_CURRENT_COMMON_INPUT_SUPPORT_KERNEL_CONSUMPTION',
  method: distribution.method,
  caseCount: distribution.loadCases.length,
  qualifiedContributionCount: distribution.loadCases.reduce(
    (total, row) => total + row.contributionLedger.length,
    0,
  ),
  zeroMassGasketQualified: true,
  missingMassFailsClosed: true,
  legacyMassMapsConsumedByNewSeam: false,
  legacyEntryPointBehaviorPreserved: true,
  forceFormulaChanged: false,
  allocationMechanicsChanged: false,
  equilibriumMechanicsChanged: false,
}, null, 2));

function fixtureProfile() {
  const base = createEmptyProjectDataProfile();
  const withSupportCapability = replaceProjectDataValue(
    base,
    'topology.supportTypeCapabilities',
    { REST: { vertical: true } },
    { source: 'PR1475 focused fixture', authority: 'PROJECT_POLICY' },
    true,
  );
  return createNonFeaProductDefaultProvider({ profile: withSupportCapability }).effectiveProfile;
}

function fixtureDataset() {
  const sharedModel = {
    schema: 'shared-piping-model/v1',
    project: { datasetId: 'PR1475-DATASET', name: 'PR1475 fixture', sourceName: 'fixture' },
    units: { length: 'mm', force: 'N', mass: 'kg' },
    sourceSnapshotRef: {
      schema: 'source-package-snapshot/v1',
      datasetId: 'PR1475-DATASET',
      sourceSchema: 'fixture/v1',
      sourceSemanticHash: semanticHash({ source: 'pr1475' }),
      sourceByteHash: null,
    },
    components: [],
    supports: [],
    sourceReferences: { nodes: [] },
    diagnostics: [],
  };
  sharedModel.semanticHash = semanticHash(sharedModel);
  return {
    datasetId: 'PR1475-DATASET',
    version: 1,
    sourceSha256: SOURCE_SHA,
    sharedModel,
    entities: [
      {
        entityId: 'PIPE-1',
        sourceEntityId: 'PIPE-SOURCE',
        entityType: 'PIPE',
        category: 'pipe',
        branchId: 'B1',
        lineKey: 'L1',
        jsonPointer: '/entities/PIPE-1',
        componentReference: 'PIPE-1',
        properties: {
          geometry: { start: point(0), end: point(1000) },
          attributes: {},
        },
      },
      {
        entityId: 'GASK-1',
        sourceEntityId: 'GASK-SOURCE',
        entityType: 'GASK',
        category: 'component',
        branchId: 'B1',
        lineKey: 'L1',
        jsonPointer: '/entities/GASK-1',
        componentReference: 'GASK-1',
        properties: {
          geometry: { start: point(1000), end: point(1000) },
          attributes: {},
        },
      },
    ],
  };
}

function fixtureRoutePartitionModel() {
  return {
    schema: 'route-partition-model/v1',
    datasetId: 'PR1475-DATASET',
    status: 'READY',
    blockers: [],
    edges: [
      {
        edgeId: 'PIPE-1', entityId: 'PIPE-1', branchId: 'B1', lineKey: 'L1', entityType: 'PIPE',
        startMm: point(0), endMm: point(1000), lengthMm: 1000,
        pointComponent: false, topologyCarrier: false, physical: true,
      },
      {
        edgeId: 'GASK-1', entityId: 'GASK-1', branchId: 'B1', lineKey: 'L1', entityType: 'GASK',
        startMm: point(1000), endMm: point(1000), lengthMm: 0,
        pointComponent: true, topologyCarrier: false, physical: true,
      },
    ],
    routes: [{
      routeId: 'route:B1:1',
      branchId: 'B1',
      lineKey: 'L1',
      status: 'READY',
      blockers: [],
      physicalEdgeIds: ['PIPE-1', 'GASK-1'],
      entityChainages: [
        {
          entityId: 'PIPE-1', startMm: 0, endMm: 1000,
          sourceStartChainageMm: 0, sourceEndChainageMm: 1000, pointMm: 500,
        },
        {
          entityId: 'GASK-1', startMm: 1000, endMm: 1000,
          sourceStartChainageMm: 1000, sourceEndChainageMm: 1000, pointMm: 1000,
        },
      ],
      totalLengthMm: 1000,
    }],
  };
}

function fixtureSupportSiteModel() {
  return {
    schema: 'support-site-model/v1',
    datasetId: 'PR1475-DATASET',
    status: 'READY',
    blockers: [],
    sites: [
      supportSite('S1', 0),
      supportSite('S2', 1000),
    ],
  };
}

function supportSite(siteId, x) {
  return {
    siteId,
    tags: [siteId],
    positionMm: point(x),
    assemblies: [{
      assemblyId: `${siteId}:A1`,
      members: [{ sourceType: 'REST' }],
    }],
  };
}

function qualifiedMasses() {
  return [
    qualifiedMass('PIPE-1', 'EMPTY', 10, 'DISTRIBUTED'),
    qualifiedMass('PIPE-1', 'OPE', 20, 'DISTRIBUTED'),
    qualifiedMass('PIPE-1', 'HYD', 30, 'DISTRIBUTED'),
    qualifiedMass('GASK-1', 'EMPTY', 0, 'POINT'),
    qualifiedMass('GASK-1', 'OPE', 0, 'POINT'),
    qualifiedMass('GASK-1', 'HYD', 0, 'POINT'),
  ];
}

function qualifiedMass(entityId, loadCaseId, massKg, mode) {
  const caseMaterial = { entityId, loadCaseId, massKg, mode };
  return {
    entityId,
    loadCaseId,
    massKg,
    source: {
      kind: 'QUALIFIED_CASE_MASS_RECEIPT',
      authority: 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION',
      semanticHash: semanticHash({ projection: 'PR1475' }),
      caseSemanticHash: semanticHash(caseMaterial),
      mode,
    },
  };
}

function contribution(loadCase, entityId) {
  const row = loadCase.contributionLedger.find((item) => item.entityId === entityId);
  assert.ok(row, `missing contribution ${loadCase.loadCaseId}:${entityId}`);
  return row;
}

function support(loadCase, siteId) {
  const row = loadCase.supportResults.find((item) => item.supportSiteId === siteId);
  assert.ok(row, `missing support result ${loadCase.loadCaseId}:${siteId}`);
  return row;
}

function point(x) {
  return { x, y: 0, z: 0 };
}
