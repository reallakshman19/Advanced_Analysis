#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createEmptyProjectDataProfile,
  replaceProjectDataValue,
  validateProjectDataProfile,
} from '../src/workspace/project-data/project-data-contract.js';
import {
  createNonFeaProductDefaultProvider,
} from '../src/workspace/project-data/non-fea-product-default-profile.js';

const activeHashes = {
  dataset: '1'.repeat(64),
  lineList: '',
  pipingClass: '',
  componentWeight: '',
};
const ledgerEvidence = {
  source: 'AUTHORIZED_EMPIRICAL_EFFECTIVE_VALUE_LEDGER',
  sourceSemanticHash: 'fnv1a64:1111111111111111',
  authorizedInputSemanticHash: 'fnv1a64:2222222222222222',
  effectiveExecutionProjectionSemanticHash: 'fnv1a64:3333333333333333',
};

const genericProfile = effectiveProfileWithLoadMaps({ source: 'FIXTURE_AUTHORIZED_MAP' });
const explicitLedgerWorkflowAudit = validateProjectDataProfile(
  genericProfile,
  'authorizedGravityLoads',
  activeHashes,
);
assert.deepEqual(
  explicitLedgerWorkflowAudit.errors,
  [],
  'explicit authorizedGravityLoads workflow must not re-demand master-source sheets',
);

const genericLegacyAudit = validateProjectDataProfile(genericProfile, 'loads', activeHashes);
assertMissingLegacySources(genericLegacyAudit);

const ledgerProfile = effectiveProfileWithLoadMaps(ledgerEvidence);
const kernelLoadsAudit = validateProjectDataProfile(ledgerProfile, 'loads', activeHashes);
assert.deepEqual(
  kernelLoadsAudit.errors,
  [],
  'legacy kernel loads validation must resolve to ledger-aware requirements only for fully bound effective maps',
);

const tamperedEvidence = {
  ...ledgerEvidence,
  effectiveExecutionProjectionSemanticHash: 'fnv1a64:4444444444444444',
};
const tamperedProfile = replaceProjectDataValue(
  ledgerProfile,
  'loadCalculation.componentWeightsKg',
  { V1: 10 },
  tamperedEvidence,
  true,
);
const tamperedAudit = validateProjectDataProfile(tamperedProfile, 'loads', activeHashes);
assertMissingLegacySources(tamperedAudit);

const storeSource = readFileSync(
  new URL('../src/workspace/engineering-model-store.js', import.meta.url),
  'utf8',
);
assert.match(
  storeSource,
  /runtimePackage\.authorizedInput\?\.effectiveValueLedger\s*\? 'authorizedGravityLoads'\s*:\s*'loads'/u,
  'production readiness must select the ledger-aware workflow only for ledger-bearing input',
);

const distributionSource = readFileSync(
  new URL('../src/workspace/engineering-loads/support-load-distribution-v3.js', import.meta.url),
  'utf8',
);
assert.match(
  distributionSource,
  /validateProjectDataProfile\([\s\S]*?'loads'[\s\S]*?activeHashes\)/u,
  'falsifier must cover the legacy kernel loads-validation call that ledger evidence resolves safely',
);

console.log(JSON.stringify({
  status: 'PASS',
  benchmark: 'ISSUE1321_LEDGER_AWARE_PRE_EXECUTION_AND_KERNEL_READINESS',
  explicitAuthorizedWorkflowErrors: explicitLedgerWorkflowAudit.errors.length,
  kernelLoadsWithBoundLedgerErrors: kernelLoadsAudit.errors.length,
  genericLegacyErrors: genericLegacyAudit.errors.length,
  tamperedLedgerErrors: tamperedAudit.errors.length,
  absentMasterSources: [
    'lineListSource',
    'pipingClassSource',
    'componentWeightSource',
  ],
}, null, 2));

function effectiveProfileWithLoadMaps(evidence) {
  let profile = createEmptyProjectDataProfile();
  profile = replaceProjectDataValue(profile, 'loadCalculation.pipeSectionProperties', {
    L1: {
      outsideDiameterMm: 100,
      wallThicknessMm: 5,
      materialCode: 'MAT',
      insulationCode: 'NONE',
      insulationThicknessMm: 0,
    },
  }, evidence, true);
  profile = replaceProjectDataValue(
    profile,
    'loadCalculation.materialDensitiesKgPerM3',
    { MAT: 7850 },
    evidence,
    true,
  );
  profile = replaceProjectDataValue(
    profile,
    'loadCalculation.operatingFluidDensitiesKgPerM3',
    { L1: 800 },
    evidence,
    true,
  );
  profile = replaceProjectDataValue(
    profile,
    'loadCalculation.hydroFluidDensitiesKgPerM3',
    { L1: 1000 },
    evidence,
    true,
  );
  profile = replaceProjectDataValue(
    profile,
    'loadCalculation.insulationDensitiesKgPerM3',
    { NONE: 0 },
    evidence,
    true,
  );
  profile = replaceProjectDataValue(
    profile,
    'loadCalculation.componentWeightsKg',
    { V1: 10 },
    evidence,
    true,
  );
  profile = replaceProjectDataValue(
    profile,
    'sourcesAndUnits.datasetSource',
    { sha256: '1'.repeat(64) },
    { source: 'FIXTURE_DATASET', sourceKey: 'dataset', sourceHash: '1'.repeat(64) },
    true,
  );
  return createNonFeaProductDefaultProvider({ profile }).effectiveProfile;
}

function assertMissingLegacySources(audit) {
  assert.ok(audit.errors.length >= 3, 'legacy loads workflow must remain stricter');
  for (const path of [
    'sourcesAndUnits.lineListSource',
    'sourcesAndUnits.pipingClassSource',
    'sourcesAndUnits.componentWeightSource',
  ]) {
    assert.ok(
      audit.errors.some((row) => row.path === path),
      `legacy workflow must still require ${path}`,
    );
  }
}
