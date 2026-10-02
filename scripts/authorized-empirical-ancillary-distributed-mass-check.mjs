#!/usr/bin/env node

import assert from 'node:assert/strict';
import { semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import {
  createEmptyProjectDataProfile,
  createEvidenceValue,
  validateProjectDataProfile,
} from '../src/workspace/project-data/project-data-contract.js';
import {
  getNonFeaFieldDefinition,
} from '../src/workspace/project-data/non-fea-field-registry.js';
import {
  createNonFeaEffectiveValueCandidate,
  resolveNonFeaEffectiveValues,
} from '../src/workspace/project-data/non-fea-effective-value-resolver.js';
import {
  AUTHORIZED_EMPIRICAL_EFFECTIVE_VALUE_LEDGER_SCHEMA,
} from '../src/workspace/engineering-loads/authorized-empirical-effective-value-ledger.js';
import {
  computeAuthorizedEmpiricalLoadInputSemanticHash,
} from '../src/workspace/engineering-loads/authorized-empirical-load-input.js';
import {
  createAuthorizedEmpiricalEffectiveExecutionProjection,
} from '../src/workspace/engineering-loads/authorized-empirical-effective-execution-projection.js';
import {
  AUTHORIZED_EMPIRICAL_LOAD_EXECUTION_V2_REQUEST_SCHEMA,
  calculateAuthorizedEmpiricalLoadExecutionV2,
} from '../src/workspace/engineering-loads/authorized-empirical-load-execution-v2.js';
import {
  EMPIRICAL_LOAD_METHOD,
} from '../src/workspace/engineering-loads/support-load-distribution-v3.js';

const HASHES = Object.freeze({
  dataset: '1'.repeat(64),
  lineList: '2'.repeat(64),
  pipingClass: '3'.repeat(64),
  componentWeight: '4'.repeat(64),
});
const SH = Object.freeze({
  baseline: 'fnv1a64:1111111111111111',
  readinessEvaluation: 'fnv1a64:2222222222222222',
  readiness: 'fnv1a64:3333333333333333',
  handoff: 'fnv1a64:4444444444444444',
  payload: 'fnv1a64:5555555555555555',
  configuration: 'fnv1a64:6666666666666666',
  line: 'fnv1a64:7777777777777777',
});

for (const fieldId of ['CLADDING_WEIGHT', 'TRACING_WEIGHT']) {
  const definition = getNonFeaFieldDefinition(fieldId);
  assert.ok(definition, `${fieldId} must be registered`);
  assert.equal(definition.canonicalUnit, 'kg/m');
  assert.equal(definition.defaultEligible, true);
  assert.ok(definition.methods.includes('WEIGHT_AND_GRAVITY'));
  assert.ok(definition.authorityPath.includes('PROJECT_CONFIGURED_DEFAULT'));
  assert.ok(definition.authorityPath.includes('PRODUCT_DEFAULT'));
}

const dataset = makeDataset();
const profile = makeProfile();
const supportSiteModel = makeSupportSiteModel();
const routePartitionModel = makeRoutePartitionModel();
const masterData = {
  lineList: { sourceHash: HASHES.lineList },
  pipingClass: { sourceHash: HASHES.pipingClass },
  weight: { sourceHash: HASHES.componentWeight },
};

const baselineInput = makeAuthorizedInput({});
const ancillaryInput = makeAuthorizedInput({ claddingKgPerM: 2, tracingKgPerM: 1 });
const explicitZeroInput = makeAuthorizedInput({ claddingKgPerM: 0, tracingKgPerM: 0 });

const baselineProjection = createAuthorizedEmpiricalEffectiveExecutionProjection({
  authorizedInput: baselineInput,
  dataset,
  profile,
});
const ancillaryProjection = createAuthorizedEmpiricalEffectiveExecutionProjection({
  authorizedInput: ancillaryInput,
  dataset,
  profile,
});
const zeroProjection = createAuthorizedEmpiricalEffectiveExecutionProjection({
  authorizedInput: explicitZeroInput,
  dataset,
  profile,
});

const baselineSection = baselineProjection.profile.loadCalculation.pipeSectionProperties.value['L-1'];
const ancillarySection = ancillaryProjection.profile.loadCalculation.pipeSectionProperties.value['L-1'];
const zeroSection = zeroProjection.profile.loadCalculation.pipeSectionProperties.value['L-1'];
assert.equal(Object.hasOwn(baselineSection, 'claddingMassPerLengthKgPerM'), false,
  'absence must remain absence rather than fabricated zero evidence');
assert.equal(Object.hasOwn(baselineSection, 'tracingMassPerLengthKgPerM'), false,
  'absence must remain absence rather than fabricated zero evidence');
assert.equal(ancillarySection.claddingMassPerLengthKgPerM, 2);
assert.equal(ancillarySection.tracingMassPerLengthKgPerM, 1);
assert.equal(zeroSection.claddingMassPerLengthKgPerM, 0);
assert.equal(zeroSection.tracingMassPerLengthKgPerM, 0);

const zeroAudit = validateProjectDataProfile(
  zeroProjection.profile,
  'loads',
  masterDataHashes(),
);
assert.equal(zeroAudit.valid, true,
  `explicit governed zero ancillary mass must remain valid: ${JSON.stringify(zeroAudit.errors)}`);

assert.throws(
  () => createAuthorizedEmpiricalEffectiveExecutionProjection({
    authorizedInput: makeAuthorizedInput({ claddingKgPerM: -1 }),
    dataset,
    profile,
  }),
  (error) => error?.code === 'EMPIRICAL_EFFECTIVE_EXECUTION_VALUE_INVALID',
  'negative ancillary mass must fail before gravity execution',
);

const baseline = execute(baselineInput, 'BASELINE');
const ancillary = execute(ancillaryInput, 'ANCILLARY');
const zero = execute(explicitZeroInput, 'ZERO');

for (const receipt of [baseline, ancillary, zero]) {
  assert.equal(receipt.status, 'CALCULATED');
  assert.equal(receipt.distribution.status, 'CALCULATED');
  assert.equal(receipt.distribution.loadCases.length, 3);
  receipt.distribution.loadCases.forEach((loadCase) => {
    assert.equal(loadCase.status, 'CALCULATED');
    assert.equal(loadCase.equilibrium.passed, true);
    assert.equal(loadCase.excludedInputs.length, 0);
  });
}

for (const loadCaseId of ['EMPTY', 'OPE', 'HYD']) {
  const baseContribution = contributionFor(baseline, loadCaseId);
  const ancillaryContribution = contributionFor(ancillary, loadCaseId);
  const zeroContribution = contributionFor(zero, loadCaseId);

  assert.ok(Math.abs(ancillaryContribution.massKg - baseContribution.massKg - 3) < 1e-12,
    `${loadCaseId}: 2 kg/m cladding + 1 kg/m tracing on 1 m pipe must add exactly 3 kg`);
  assert.ok(Math.abs(zeroContribution.massKg - baseContribution.massKg) < 1e-12,
    `${loadCaseId}: explicit zero ancillary evidence must add exactly zero mass`);
  assert.equal(ancillaryContribution.formula.claddingKg, 2);
  assert.equal(ancillaryContribution.formula.tracingKg, 1);
  assert.equal(ancillaryContribution.formula.claddingMassPerLengthKgPerM, 2);
  assert.equal(ancillaryContribution.formula.tracingMassPerLengthKgPerM, 1);
  assert.equal(ancillaryContribution.formula.fluidKg, baseContribution.formula.fluidKg,
    `${loadCaseId}: ancillary permanent mass must not change fluid mass`);
  assert.equal(ancillaryContribution.formula.metalKg, baseContribution.formula.metalKg,
    `${loadCaseId}: ancillary permanent mass must not change metal mass`);
  assert.equal(ancillaryContribution.formula.insulationKg, baseContribution.formula.insulationKg,
    `${loadCaseId}: ancillary permanent mass must not change insulation mass`);
  assert.deepEqual(allocationFractions(ancillaryContribution), allocationFractions(baseContribution),
    `${loadCaseId}: uniform-load support allocation fractions must remain unchanged`);
  assert.equal(
    ancillary.distribution.loadCases.find((row) => row.loadCaseId === loadCaseId).equilibrium.passed,
    true,
  );
}

assert.notEqual(ancillaryProjection.semanticHash, baselineProjection.semanticHash,
  'ancillary engineering values must change effective execution identity');
assert.notEqual(ancillary.semanticHash, baseline.semanticHash,
  'ancillary engineering values must stale/change execution identity');

console.log(JSON.stringify({
  status: 'PASS',
  benchmark: 'ISSUE1321_ANCILLARY_DISTRIBUTED_MASS',
  pipeLengthM: 1,
  claddingKgPerM: 2,
  tracingKgPerM: 1,
  expectedAddedMassKgPerCase: 3,
  cases: ['EMPTY', 'OPE', 'HYD'],
  absenceRemainsUnprojected: true,
  explicitZeroAccepted: true,
  negativeRejected: true,
  metalMassInvariant: true,
  insulationMassInvariant: true,
  fluidMassInvariant: true,
  allocationFractionsInvariant: true,
  equilibriumClosed: true,
  executionIdentityChanges: ancillary.semanticHash !== baseline.semanticHash,
}, null, 2));

function execute(authorizedInput, suffix) {
  return calculateAuthorizedEmpiricalLoadExecutionV2({
    schema: AUTHORIZED_EMPIRICAL_LOAD_EXECUTION_V2_REQUEST_SCHEMA,
    executionId: `EXEC-${suffix}`,
    executedAt: '2026-08-25T14:45:00.000Z',
    method: EMPIRICAL_LOAD_METHOD,
    authorizedInput,
    dataset,
    profile,
    supportSiteModel,
    routePartitionModel,
    masterData,
  });
}

function contributionFor(receipt, loadCaseId) {
  const loadCase = receipt.distribution.loadCases.find((row) => row.loadCaseId === loadCaseId);
  assert.ok(loadCase, `missing ${loadCaseId}`);
  assert.equal(loadCase.contributionLedger.length, 1);
  return loadCase.contributionLedger[0];
}

function allocationFractions(contribution) {
  return contribution.allocations.map((row) => Number((row.verticalForceN / contribution.verticalForceN).toFixed(6)));
}

function makeAuthorizedInput({ claddingKgPerM, tracingKgPerM } = {}) {
  const candidates = [
    lineCandidate('PIPE_OUTER_DIAMETER', 100, 'mm'),
    lineCandidate('PIPE_WALL_THICKNESS', 5, 'mm'),
    lineCandidate('MATERIAL_DENSITY', 7850, 'kg/m3'),
    lineCandidate('OPERATING_FLUID_DENSITY', 800, 'kg/m3'),
    lineCandidate('HYDRO_FLUID_DENSITY', 1000, 'kg/m3'),
    lineCandidate('INSULATION_THICKNESS', 0, 'mm'),
  ];
  if (claddingKgPerM !== undefined) {
    candidates.push(lineCandidate('CLADDING_WEIGHT', claddingKgPerM, 'kg/m', 'PROJECT_CONFIGURED_DEFAULT'));
  }
  if (tracingKgPerM !== undefined) {
    candidates.push(lineCandidate('TRACING_WEIGHT', tracingKgPerM, 'kg/m', 'PROJECT_CONFIGURED_DEFAULT'));
  }
  const effective = resolveNonFeaEffectiveValues({ candidates });
  assert.equal(effective.status, 'RESOLVED');
  const ledgerMaterial = {
    schema: AUTHORIZED_EMPIRICAL_EFFECTIVE_VALUE_LEDGER_SCHEMA,
    handoffSemanticHash: SH.handoff,
    baselineSemanticHash: SH.baseline,
    resolutionSemanticHash: effective.semanticHash,
    status: effective.status,
    rows: effective.rows,
    summary: effective.summary,
  };
  const effectiveValueLedger = Object.freeze({
    ...ledgerMaterial,
    semanticHash: semanticHash(ledgerMaterial),
  });

  const loadCalculationOverlay = {
    pipeSectionProperties: {
      'L-1': {
        outsideDiameterMm: 20,
        wallThicknessMm: 1,
        materialCode: 'LEGACY-MAT',
        insulationCode: null,
        insulationThicknessMm: 0,
      },
    },
    materialDensitiesKgPerM3: { 'LEGACY-MAT': 100 },
    operatingFluidDensitiesKgPerM3: { 'L-1': 100 },
    hydroFluidDensitiesKgPerM3: { 'L-1': 100 },
    insulationDensitiesKgPerM3: {},
    componentWeightsKg: {},
  };
  const draft = {
    schema: 'authorized-empirical-load-input/v1',
    intakeId: 'ANCILLARY-MASS-INPUT',
    projectId: 'ANCILLARY-MASS-PROJECT',
    baselineId: 'ANCILLARY-MASS-BASELINE',
    baselineRevision: 1,
    baselineSemanticHash: SH.baseline,
    readinessEvaluationSemanticHash: SH.readinessEvaluation,
    readinessSemanticHash: SH.readiness,
    handoffSemanticHash: SH.handoff,
    projectionPayloadSemanticHash: SH.payload,
    adapterVersion: 'empirical-adapter/1.0.0',
    configurationHash: SH.configuration,
    createdAt: '2026-08-25T14:44:00.000Z',
    lineBindings: [{
      targetId: 'LINE:L-1',
      sourceRecordId: 'PIPE-SRC',
      lineKey: 'L-1',
      projectionRecordSemanticHash: SH.line,
    }],
    componentBindings: [],
    loadCalculationOverlay,
    overlaySemanticHash: semanticHash(loadCalculationOverlay),
    effectiveValueLedger,
    summary: {
      lineCount: 1,
      componentCount: 0,
      materialCodeCount: 1,
      insulationCodeCount: 0,
      componentCatalogCount: 0,
    },
    semanticHash: 'fnv1a64:0000000000000000',
  };
  return Object.freeze({
    ...draft,
    semanticHash: computeAuthorizedEmpiricalLoadInputSemanticHash(draft),
  });
}

function lineCandidate(fieldId, value, unit, authority = 'EXACT_APPROVED_MASTER') {
  return createNonFeaEffectiveValueCandidate({
    candidateId: `LINE:L-1:${fieldId}`,
    targetKind: 'LINE',
    targetId: 'LINE:L-1',
    fieldId,
    value,
    unit,
    authority,
    sourceId: `${authority}:L-1:${fieldId}`,
    evidence: authority === 'PROJECT_CONFIGURED_DEFAULT'
      ? { source: 'Project configured default fixture', defaultId: `DEFAULT:${fieldId}`, basis: 'Focused ancillary-mass qualification' }
      : { source: 'Focused ancillary-mass qualification master' },
  });
}

function makeProfile() {
  const empty = createEmptyProjectDataProfile();
  const source = (value, sourceKey, sourceHash) => createEvidenceValue(
    value,
    { source: 'FIXTURE_CONTROLLED_SOURCE', sourceKey, sourceHash },
    true,
  );
  const approved = (value, label) => createEvidenceValue(value, { source: label }, true);
  return {
    ...empty,
    projectId: 'ANCILLARY-MASS-PROJECT',
    revision: 1,
    updatedAt: '2026-08-25T14:43:00.000Z',
    sourcesAndUnits: {
      ...empty.sourcesAndUnits,
      lineListSource: source({ sha256: HASHES.lineList }, 'lineList', HASHES.lineList),
      pipingClassSource: source({ sha256: HASHES.pipingClass }, 'pipingClass', HASHES.pipingClass),
      componentWeightSource: source({ sha256: HASHES.componentWeight }, 'componentWeight', HASHES.componentWeight),
    },
    topology: {
      ...empty.topology,
      portMatchToleranceMm: approved(1, 'FIXTURE_TOPOLOGY'),
      supportSiteGroupingToleranceMm: approved(1, 'FIXTURE_TOPOLOGY'),
      autoCarrierCoincidenceToleranceMm: approved(1, 'FIXTURE_TOPOLOGY'),
      routeJoiningRules: approved({ mode: 'EXACT' }, 'FIXTURE_TOPOLOGY'),
      supportTypeCapabilities: approved({ REST: { vertical: true } }, 'FIXTURE_TOPOLOGY'),
    },
    loadCalculation: {
      ...empty.loadCalculation,
      gravityMPerS2: approved(9.81, 'FIXTURE_LOAD_POLICY'),
      loadFactor: approved(1, 'FIXTURE_LOAD_POLICY'),
      equilibriumTolerances: approved({ forceN: 1e-8, momentNmm: 1e-5 }, 'FIXTURE_LOAD_POLICY'),
      activeLoadCases: approved(['EMPTY', 'OPE', 'HYD'], 'FIXTURE_LOAD_POLICY'),
    },
  };
}

function makeDataset() {
  const sharedBase = {
    schema: 'shared-piping-model/v1',
    units: { length: 'mm', force: 'N', mass: 'kg' },
    components: [],
    supports: [],
  };
  return {
    schema: 'analysis-workspace-dataset/v1',
    datasetId: 'ANCILLARY-MASS-DATASET',
    version: 1,
    sourceSha256: HASHES.dataset,
    sharedModel: { ...sharedBase, semanticHash: semanticHash(sharedBase) },
    entities: [{
      entityId: 'pipe-1',
      entityType: 'PIPE',
      lineKey: 'L-1',
      sourceEntityId: 'PIPE-SRC',
      jsonPointer: '/items/0',
      componentReference: 'PIPE-1',
      properties: {},
    }],
  };
}

function makeSupportSiteModel() {
  const site = (siteId, x) => ({
    siteId,
    tags: [siteId],
    positionMm: { x, y: 0, z: 0 },
    assemblyIds: [`assembly-${siteId}`],
    memberEntityIds: [`support-${siteId}`],
    assemblies: [{ members: [{ sourceType: 'REST' }] }],
  });
  return { schema: 'support-site-model/v1', sites: [site('S-0', 0), site('S-1', 1000)] };
}

function makeRoutePartitionModel() {
  return {
    schema: 'route-partition-model/v1',
    routes: [{
      routeId: 'R-1',
      status: 'READY',
      blockers: [],
      physicalEdgeIds: ['pipe-1'],
      entityChainages: [{
        entityId: 'pipe-1',
        startMm: 0,
        endMm: 1000,
        pointMm: 500,
        sourceStartChainageMm: 0,
        sourceEndChainageMm: 1000,
      }],
    }],
    edges: [{
      entityId: 'pipe-1',
      entityType: 'PIPE',
      lengthMm: 1000,
      pointComponent: false,
      topologyCarrier: false,
      startMm: { x: 0, y: 0, z: 0 },
      endMm: { x: 1000, y: 0, z: 0 },
    }],
  };
}

function masterDataHashes() {
  return {
    dataset: HASHES.dataset,
    lineList: HASHES.lineList,
    pipingClass: HASHES.pipingClass,
    componentWeight: HASHES.componentWeight,
  };
}
