import assert from 'node:assert/strict';
import {
  WRC537_ED4_PACKAGE_BLOCKED,
  WRC537_ED4_PACKAGE_READY,
  evaluateWrc537Ed4SourcePackage,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-source-package.js';
import { createReadyWrc537Ed4SourceFixture } from './wrc537-ed4-ready-source-fixture.mjs';

const ready = createReadyWrc537Ed4SourceFixture();
const accepted = evaluateWrc537Ed4SourcePackage(ready);
assert.equal(accepted.state, WRC537_ED4_PACKAGE_READY);
assert.deepEqual(accepted.failedGateIds, []);
assert.equal(accepted.statistics.primaryTechnicalDocumentRows, 1);
assert.ok(accepted.statistics.primaryDatumRows > 0);

assertBlocked('SOURCE_LEDGER_IDS_UNIQUE', (fixture) => {
  fixture.sourceLedgerRows.push(structuredClone(fixture.sourceLedgerRows[0]));
});
assertBlocked('PRIMARY_TECHNICAL_SOURCE', (fixture) => {
  fixture.sourcePackage.technicalSource.sourceRef = 'CATALOG-WRC537-ED4';
});
assertBlocked('PRIMARY_TECHNICAL_SOURCE', (fixture) => {
  fixture.sourcePackage.technicalSource.documentDigest = 'not-a-sha256';
});
assertBlocked('PRIMARY_TECHNICAL_SOURCE', (fixture) => {
  fixture.sourceLedgerRows.find((row) => row.record_id === 'TECH-WRC537-ED4').record_scope = 'DATUM';
});
assertBlocked('PRIMARY_TECHNICAL_SOURCE', (fixture) => {
  fixture.sourceLedgerRows.find((row) => row.record_id === 'TECH-WRC537-ED4').edition = '3';
});
assertBlocked('PRIMARY_TECHNICAL_SOURCE', (fixture) => {
  fixture.sourceLedgerRows.find((row) => row.record_id === 'TECH-WRC537-ED4').document_digest = 'b'.repeat(64);
});
assertBlocked('DATUM_SOURCE_CUSTODY_COMPLETE', (fixture) => {
  fixture.sourcePackage.geometry.definitions[0].sourceRef = 'TECH-WRC537-ED4';
});
assertBlocked('DATUM_SOURCE_CUSTODY_COMPLETE', (fixture) => {
  fixture.sourceLedgerRows.find((row) => row.record_scope === 'DATUM').document_digest = 'b'.repeat(64);
});
assertBlocked('GEOMETRY_COMPLETE', (fixture) => {
  fixture.sourcePackage.geometry.definitions.find((row) => row.symbol === 'Rc').definition = 'UNRESOLVED_ED4';
});
assertBlocked('GEOMETRY_COMPLETE', (fixture) => {
  fixture.sourcePackage.geometry.applicability.sourceRef = 'TECH-WRC537-ED4';
});
assertBlocked('PARAMETERS_COMPLETE', (fixture) => {
  fixture.sourcePackage.parameters.find((row) => row.parameterId === 'CYL_LAMBDA').minimumInclusive = null;
});
assertBlocked('PARAMETERS_COMPLETE', (fixture) => {
  const row = fixture.sourcePackage.parameters.find((candidate) => candidate.parameterId === 'CYL_LAMBDA');
  row.maximum = row.minimum;
});
assertBlocked('PARAMETERS_COMPLETE', (fixture) => {
  fixture.sourcePackage.parameters.push(structuredClone(fixture.sourcePackage.parameters[0]));
});
assertBlocked('LOAD_CONVENTIONS_COMPLETE', (fixture) => {
  fixture.sourcePackage.loads.find((row) => row.family === 'cylindrical' && row.sourceSymbol === 'Mt').positiveDirection = 'UNRESOLVED';
});
assertBlocked('LOAD_CONVENTIONS_COMPLETE', (fixture) => {
  fixture.sourcePackage.loads.push(structuredClone(fixture.sourcePackage.loads[0]));
});
assertBlocked('STRESS_RECOVERY_COMPLETE', (fixture) => {
  fixture.sourcePackage.stressRecovery.surfaceReconstruction.rule = 'UNRESOLVED';
});
assertBlocked('STRESS_RECOVERY_COMPLETE', (fixture) => {
  fixture.sourcePackage.stressRecovery.stressIntensityOrEquivalent.dimensionallyVerified = false;
});
assertBlocked('INTERPOLATION_POLICY_COMPLETE', (fixture) => {
  fixture.sourcePackage.interpolation.interpolationAuthorized = null;
});
assertBlocked('COEFFICIENT_INVENTORY_DECLARED', (fixture) => {
  fixture.sourcePackage.coefficients.inventoryDeclared = false;
});
assertBlocked('COEFFICIENT_IDS_UNIQUE', (fixture) => {
  fixture.coefficientRows.push(structuredClone(fixture.coefficientRows[0]));
});
assertBlocked('COEFFICIENTS_COMPLETE', (fixture) => {
  fixture.coefficientRows[0].edition = '3rd Edition 2022';
});
assertBlocked('COEFFICIENTS_COMPLETE', (fixture) => {
  fixture.coefficientRows[0].published_precision = 'UNRESOLVED';
});
assertBlocked('COEFFICIENTS_COMPLETE', (fixture) => {
  fixture.coefficientRows[0].source_locator = 'Wrong coefficient locator';
});
assertBlocked('BENCHMARKS_COMPLETE', (fixture) => {
  fixture.sourcePackage.benchmarks[0].independentlyReproduced = false;
});
assertBlocked('BENCHMARKS_COMPLETE', (fixture) => {
  fixture.sourcePackage.benchmarks[0].independentCalculationReference = '';
});
assertBlocked('BENCHMARKS_COMPLETE', (fixture) => {
  fixture.sourcePackage.benchmarks[0].inputEvidence[0].units = '';
});
assertBlocked('BENCHMARKS_COMPLETE', (fixture) => {
  fixture.sourcePackage.benchmarks[0].inputEvidence[0].sourceLocator = 'Wrong benchmark input locator';
});
assertBlocked('BENCHMARKS_COMPLETE', (fixture) => {
  fixture.sourcePackage.benchmarks[0].inputEvidence.pop();
});
assertBlocked('BENCHMARKS_COMPLETE', (fixture) => {
  fixture.sourcePackage.benchmarks[0].inputEvidence[1].inputId = fixture.sourcePackage.benchmarks[0].inputEvidence[0].inputId;
});
assertBlocked('BENCHMARKS_COMPLETE', (fixture) => {
  fixture.sourcePackage.benchmarks[0].expectedResults[0].absoluteTolerance = null;
});
assertBlocked('BENCHMARKS_COMPLETE', (fixture) => {
  fixture.sourcePackage.benchmarks[0].expectedResults[0].sourceLocator = 'Wrong benchmark locator';
});
assertBlocked('LAFEA_MAPPING_COMPLETE', (fixture) => {
  fixture.sourcePackage.lafeaMapping.qualified = false;
});
assertBlocked('LAFEA_MAPPING_COMPLETE', (fixture) => {
  fixture.sourcePackage.lafeaMapping.loads[0].sourceQuantity = fixture.sourcePackage.lafeaMapping.loads[1].sourceQuantity;
});
assertBlocked('NO_UNRESOLVED_TECHNICAL_FIELDS', (fixture) => {
  fixture.sourcePackage.geometry.applicability.exclusions[0] = 'TBD';
});

console.log(JSON.stringify({
  check: 'wrc537-ed4-source-package-self-test',
  status: 'PASS',
  completeSyntheticAuthorityAccepted: true,
  technicalDocumentAndDatumCustodySeparated: true,
  datumLevelTechnicalSourceCustodyRequired: true,
  datumDigestMustMatchExactAuthorizedSource: true,
  nonDegenerateParameterDomainsRequired: true,
  duplicateParameterAndLoadIdentitiesRejected: true,
  coefficientLocatorMustEqualLedgerLocator: true,
  benchmarkInputsRequireUnitsAndDatumLocator: true,
  benchmarkNumericInputLeafCoverageRequired: true,
  benchmarkInputEvidenceIdsUnique: true,
  benchmarkAbsoluteToleranceAndIndependentReferenceRequired: true,
  exactMandatoryLafeaLoadMappingCoverageRequired: true,
  unresolvedTechnicalFieldsRejected: true,
}));

function assertBlocked(gateId, mutate) {
  const fixture = createReadyWrc537Ed4SourceFixture();
  mutate(fixture);
  const result = evaluateWrc537Ed4SourcePackage(fixture);
  assert.equal(result.state, WRC537_ED4_PACKAGE_BLOCKED, `${gateId} must block the source package.`);
  assert.ok(result.failedGateIds.includes(gateId), `${gateId} must be reported.`);
}
