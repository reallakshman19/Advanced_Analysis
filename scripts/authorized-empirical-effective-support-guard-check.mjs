#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import {
  createEvidenceValue,
} from '../src/workspace/project-data/project-data-contract.js';
import {
  AUTHORIZED_EMPIRICAL_EFFECTIVE_EXECUTION_PROJECTION_SCHEMA,
} from '../src/workspace/engineering-loads/authorized-empirical-effective-execution-projection.js';
import {
  IMPLEMENTED_GRAVITY_CONVENTIONS,
} from '../src/workspace/engineering-loads/authorized-empirical-gravity-convention-binding.js';
import {
  requireAuthorizedEmpiricalEffectiveSupportProjection,
} from '../src/workspace/engineering-loads/authorized-empirical-effective-support-load-execution.js';

const valid = makeProjection();
assert.equal(requireAuthorizedEmpiricalEffectiveSupportProjection(valid), valid);

const withDefault = mutateProjection(valid, (profile) => {
  profile.loadCalculation.operatingFluidDensitiesKgPerM3.value.DEFAULT = 999;
});
expectCode(
  () => requireAuthorizedEmpiricalEffectiveSupportProjection(withDefault),
  'EMPIRICAL_EFFECTIVE_SUPPORT_DEFAULT_SELECTOR_FORBIDDEN',
);

const unboundEvidence = mutateProjection(valid, (profile) => {
  profile.loadCalculation.materialDensitiesKgPerM3.evidence.source = 'PROJECT_DATA_RAW';
});
expectCode(
  () => requireAuthorizedEmpiricalEffectiveSupportProjection(unboundEvidence),
  'EMPIRICAL_EFFECTIVE_SUPPORT_FIELD_AUTHORITY_INVALID',
);

const wrongAxis = mutateProjection(valid, (profile) => {
  profile.sourcesAndUnits.sourceUpAxis.value = 'W';
});
expectCode(
  () => requireAuthorizedEmpiricalEffectiveSupportProjection(wrongAxis),
  'EMPIRICAL_SOURCE_AXIS_INVALID',
);

const wrongUnit = mutateProjection(valid, (profile) => {
  profile.sourcesAndUnits.lengthUnit.value = 'm';
});
expectCode(
  () => requireAuthorizedEmpiricalEffectiveSupportProjection(wrongUnit),
  'EMPIRICAL_SOURCE_LENGTH_UNIT_UNSUPPORTED',
);

const wrongForceConvention = mutateProjection(valid, (profile) => {
  profile.loadCalculation.forceOutputConvention.value = 'SIGNED_SOURCE_AXIS_FORCE';
});
expectCode(
  () => requireAuthorizedEmpiricalEffectiveSupportProjection(wrongForceConvention),
  'EMPIRICAL_GRAVITY_FORCE_OUTPUT_CONVENTION_UNSUPPORTED',
);

expectCode(
  () => requireAuthorizedEmpiricalEffectiveSupportProjection({
    ...valid,
    semanticHash: 'fnv1a64:0000000000000000',
  }),
  'EMPIRICAL_EFFECTIVE_SUPPORT_PROJECTION_HASH_MISMATCH',
);

const v1Source = await readFile(
  new URL('../src/workspace/engineering-loads/authorized-empirical-load-execution.js', import.meta.url),
  'utf8',
);
const v2Source = await readFile(
  new URL('../src/workspace/engineering-loads/authorized-empirical-load-execution-v2.js', import.meta.url),
  'utf8',
);
for (const [label, source] of [['V1', v1Source], ['V2', v2Source]]) {
  assert.match(source, /calculateAuthorizedEmpiricalEffectiveSupportLoads/u,
    `${label} no longer imports/invokes the ledger-driven support guard`);
  assert.match(source, /effectiveExecutionProjection\s*\?/u,
    `${label} no longer dispatches conditionally on effective projection authority`);
  assert.match(source, /calculateSupportLoadDistribution/u,
    `${label} legacy ledger-less compatibility path was unexpectedly removed`);
}

const effectiveSupportSource = await readFile(
  new URL('../src/workspace/engineering-loads/authorized-empirical-effective-support-load-execution.js', import.meta.url),
  'utf8',
);
assert.match(effectiveSupportSource, /bindAuthorizedEmpiricalSupportCapabilities/u,
  'ledger support execution no longer binds governed support DEFAULT capability');
assert.match(effectiveSupportSource, /requireAuthorizedEmpiricalGravityConventions/u,
  'ledger support execution no longer gates gravity conventions before statics');
assert.match(effectiveSupportSource, /bindAuthorizedEmpiricalGravityConventions/u,
  'ledger support execution no longer binds gravity convention authority after statics');

console.log(JSON.stringify({
  status: 'PASS',
  validLedgerProjectionAccepted: true,
  legacyDefaultSelectorRejected: true,
  unboundProjectedEvidenceRejected: true,
  unsupportedAxisRejected: true,
  unsupportedLengthUnitRejected: true,
  unsupportedForceConventionRejected: true,
  staleProjectionHashRejected: true,
  supportDefaultBindingPresent: true,
  gravityConventionGatePresent: true,
  v1LedgerPathGuarded: true,
  v2LedgerPathGuarded: true,
  ledgerlessCompatibilityPathRetained: true,
}, null, 2));

function makeProjection() {
  const authorizedInputSemanticHash = semanticHash({ input: 'AUTHORIZED' });
  const effectiveValueLedgerSemanticHash = semanticHash({ ledger: 'EFFECTIVE' });
  const dataset = { datasetId: 'DATASET-GUARD-FIXTURE', marker: 'FIXTURE' };
  const mappingMaterial = {
    schema: AUTHORIZED_EMPIRICAL_EFFECTIVE_EXECUTION_PROJECTION_SCHEMA,
    authorizedInputSemanticHash,
    effectiveValueLedgerSemanticHash,
    sourceDatasetSemanticHash: semanticHash(dataset),
    lineMappings: [],
    componentMappings: [],
  };
  const projectionSemanticHash = semanticHash(mappingMaterial);
  const evidence = {
    source: 'AUTHORIZED_EMPIRICAL_EFFECTIVE_VALUE_LEDGER',
    sourceSemanticHash: effectiveValueLedgerSemanticHash,
    authorizedInputSemanticHash,
    effectiveExecutionProjectionSemanticHash: projectionSemanticHash,
  };
  const basisEvidence = {
    source: 'FIXTURE_SOURCE_BASIS',
    authority: 'SOURCE_EXPLICIT',
  };
  const policyEvidence = {
    source: 'FIXTURE_GRAVITY_POLICY',
    authority: 'PROJECT_POLICY',
  };
  const profile = {
    schema: 'project-data-profile/v1',
    projectId: 'PROJECT-GUARD-FIXTURE',
    revision: 1,
    updatedAt: '2026-08-22T12:40:00.000Z',
    sourcesAndUnits: {
      lengthUnit: createEvidenceValue('mm', basisEvidence, true),
      sourceUpAxis: createEvidenceValue('Z', basisEvidence, true),
    },
    loadCalculation: {
      pipeSectionProperties: createEvidenceValue({ L1: { outsideDiameterMm: 114.3, wallThicknessMm: 6.02, materialCode: 'M1', insulationCode: 'I1', insulationThicknessMm: 25 } }, evidence, true),
      materialDensitiesKgPerM3: createEvidenceValue({ M1: 7850 }, evidence, true),
      operatingFluidDensitiesKgPerM3: createEvidenceValue({ L1: 850 }, evidence, true),
      hydroFluidDensitiesKgPerM3: createEvidenceValue({ L1: 1000 }, evidence, true),
      insulationDensitiesKgPerM3: createEvidenceValue({ I1: 160 }, evidence, true),
      componentWeightsKg: createEvidenceValue({ C1: 12.5 }, evidence, true),
      forceOutputConvention: createEvidenceValue(IMPLEMENTED_GRAVITY_CONVENTIONS.forceOutputConvention, policyEvidence, true),
      momentOutputConvention: createEvidenceValue(IMPLEMENTED_GRAVITY_CONVENTIONS.momentOutputConvention, policyEvidence, true),
      analysisBasis: createEvidenceValue(IMPLEMENTED_GRAVITY_CONVENTIONS.analysisBasis, policyEvidence, true),
      resultSignConvention: createEvidenceValue(IMPLEMENTED_GRAVITY_CONVENTIONS.resultSignConvention, policyEvidence, true),
    },
  };
  const material = {
    ...mappingMaterial,
    projectionSemanticHash,
    projectedProfileSemanticHash: semanticHash(profile),
    projectedDatasetSemanticHash: semanticHash(dataset),
  };
  return Object.freeze({
    ...material,
    profile,
    dataset,
    semanticHash: semanticHash(material),
  });
}

function mutateProjection(source, mutateProfile) {
  const profile = structuredClone(source.profile);
  mutateProfile(profile);
  const material = {
    schema: source.schema,
    authorizedInputSemanticHash: source.authorizedInputSemanticHash,
    effectiveValueLedgerSemanticHash: source.effectiveValueLedgerSemanticHash,
    sourceDatasetSemanticHash: source.sourceDatasetSemanticHash,
    lineMappings: structuredClone(source.lineMappings),
    componentMappings: structuredClone(source.componentMappings),
    projectionSemanticHash: source.projectionSemanticHash,
    projectedProfileSemanticHash: semanticHash(profile),
    projectedDatasetSemanticHash: source.projectedDatasetSemanticHash,
  };
  return {
    ...material,
    profile,
    dataset: source.dataset,
    semanticHash: semanticHash(material),
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.equal(error?.code, code);
    return true;
  });
}
