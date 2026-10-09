import assert from 'node:assert/strict';
import {
  WRC537_BLOCKED_STATE,
  WRC537_READY_STATE,
  evaluateWrc537SourceReadiness,
  normalizeWrc537CoefficientRow,
} from '../src/core/local-attachment-correlation/methods/wrc537/source-readiness.js';

const ready = readyFixture();
const accepted = evaluateWrc537SourceReadiness(ready);
assert.equal(accepted.state, WRC537_READY_STATE);
assert.deepEqual(accepted.failedGateIds, []);

assertBlocked('TARGET_EDITION_PRIMARY_TECHNICAL_SOURCE', (fixture) => {
  fixture.manifest.targetEdition.technicalSourceAvailable = false;
  fixture.manifest.targetEdition.technicalSourcePrimaryVerified = false;
  fixture.manifest.targetEdition.technicalSourceReference = null;
});
assertBlocked('SOURCE_EDITION_CONSISTENCY', (fixture) => {
  fixture.manifest.normalizedExtraction.technicalEdition = '3';
});
assertBlocked('DIMENSIONLESS_PARAMETERS_COMPLETE', (fixture) => {
  fixture.dataset.dimensionlessParameters.find((row) => row.parameterId === 'CYL_LAMBDA').equation = 'UNRESOLVED';
});
assertBlocked('LOAD_SIGNS_COMPLETE', (fixture) => {
  fixture.dataset.loads.find((row) => row.cylindrical === 'Mt').positive = 'UNRESOLVED';
});
assertBlocked('LAFEA_MAPPING_COMPLETE', (fixture) => {
  fixture.dataset.stressDefinitions[0].laffeaMapping = 'UNRESOLVED';
});
assertBlocked('COEFFICIENT_VALUES_COMPLETE', (fixture) => {
  fixture.coefficientRows[0].coefficient_value = 'UNRESOLVED';
});
assertBlocked('COEFFICIENT_PRECISION_COMPLETE', (fixture) => {
  fixture.coefficientRows[0].published_precision = 'UNRESOLVED';
});
assertBlocked('COEFFICIENT_SOURCE_CUSTODY_COMPLETE', (fixture) => {
  fixture.coefficientRows[0].review_status = 'EXTRACTED';
});
assertBlocked('COEFFICIENT_SOURCE_CUSTODY_COMPLETE', (fixture) => {
  fixture.coefficientRows[0].edition = '3rd Edition (March 2022)';
});
assertBlocked('STRESS_INTENSITY_MATH_PRIMARY_VERIFIED', (fixture) => {
  fixture.manifest.engineeringVerification.stressIntensityMathPrimaryVerified = false;
});
assertBlocked('PUBLISHED_BENCHMARKS_REPRODUCED', (fixture) => {
  fixture.manifest.engineeringVerification.publishedBenchmarks[0].independentlyReproduced = false;
});

const targetEdition = { edition: '4', publicationDate: '2026-02' };
const normalizedResearchRow = normalizeWrc537CoefficientRow({
  edition: '1st ed. (Dec 2010) / reprint 2013',
  coefficient_value: 'UNRESOLVED',
  published_precision: 'UNRESOLVED',
  source_page: '51',
  source_section: 'SP-1',
  source_figure: 'Fig SP-1',
  extraction_confidence: 'HIGH',
  review_status: 'EXTRACTED',
}, targetEdition);
assert.equal(normalizedResearchRow.normalizedValueState, 'STRUCTURE_ONLY_VALUE_UNRESOLVED');
assert.equal(normalizedResearchRow.normalizedAuthorityState,
  'NOT_TARGET_EDITION_PRIMARY_SOURCE_VERIFIED');
assert.equal(normalizedResearchRow.normalizedEngineeringState, 'RESEARCH_ONLY');

console.log(JSON.stringify({
  check: 'wrc537-source-readiness-self-test',
  status: 'PASS',
  readyFixtureAccepted: true,
  incompletePrimarySourceRejected: true,
  mixedEditionRejected: true,
  unresolvedParameterRejected: true,
  unresolvedLoadSignRejected: true,
  unresolvedLafeaMappingRejected: true,
  missingCoefficientValueRejected: true,
  missingCoefficientPrecisionRejected: true,
  unverifiedCoefficientRejected: true,
  wrongEditionCoefficientRejected: true,
  unverifiedStressMathRejected: true,
  unreproducedBenchmarkRejected: true,
  misleadingRawExtractedStatusNormalizedToResearchOnly: true,
}));

function assertBlocked(gateId, mutate) {
  const fixture = readyFixture();
  mutate(fixture);
  const result = evaluateWrc537SourceReadiness(fixture);
  assert.equal(result.state, WRC537_BLOCKED_STATE, `${gateId} must block readiness.`);
  assert.ok(result.failedGateIds.includes(gateId), `${gateId} must be reported.`);
}

function readyFixture() {
  return {
    manifest: {
      targetEdition: {
        edition: '4',
        publicationDate: '2026-02',
        catalogIdentityVerified: true,
        catalogAuthority: 'PRIMARY CATALOG',
        catalogReference: 'CATALOG-REF',
        technicalSourceAvailable: true,
        technicalSourcePrimaryVerified: true,
        technicalSourceReference: 'LICENSED-WRC537-ED4',
      },
      normalizedExtraction: {
        targetEditionTechnicalDataVerified: true,
        technicalEdition: '4',
        technicalPublicationDate: '2026-02',
      },
      engineeringVerification: {
        signTablesPrimaryVerified: true,
        interpolationPrimaryVerified: true,
        stressReconstructionPrimaryVerified: true,
        stressIntensityMathPrimaryVerified: true,
        publishedBenchmarks: [{
          caseId: 'WRC537-ED4-SOURCE-001',
          targetEditionPrimarySourceVerified: true,
          independentlyReproduced: true,
        }],
      },
    },
    dataset: {
      method: { bulletinNumber: 'WRC Bulletin 537' },
      geometryDefinitions: [
        { symbol: 'Rc', definition: 'Mean cylindrical shell radius defined by target edition.' },
        { symbol: 'T', definition: 'Shell thickness defined by target edition.' },
      ],
      dimensionlessParameters: [
        parameter('SPHERE_U'), parameter('SPHERE_GAMMA'), parameter('SPHERE_RHO'),
        parameter('CYL_LAMBDA'), parameter('CYL_DELTA'),
      ],
      loads: [
        load('spherical', 'P'), load('spherical', 'V1'), load('spherical', 'V2'),
        load('spherical', 'M1'), load('spherical', 'M2'), load('spherical', 'Mt'),
        load('cylindrical', 'P'), load('cylindrical', 'Vc'), load('cylindrical', 'Vl'),
        load('cylindrical', 'Mc'), load('cylindrical', 'Ml'), load('cylindrical', 'Mt'),
      ],
      stressDefinitions: [
        { source: 'sigma-1', laffeaMapping: 'SIGMA_X' },
        { source: 'sigma-2', laffeaMapping: 'SIGMA_THETA' },
        { source: 'tau', laffeaMapping: 'TAU_XTHETA' },
      ],
    },
    coefficientRows: [{
      edition: '4th Edition (February 2026)',
      coefficient_value: '1.234',
      published_precision: '3_DECIMAL_PLACES',
      source_page: '101',
      source_section: 'TABLE-X',
      source_equation: 'EQ-X',
      source_table: 'TABLE-X',
      source_figure: '',
      extraction_confidence: 'PRIMARY_VERIFIED',
      review_status: 'PRIMARY_SOURCE_VERIFIED',
    }],
  };
}
function parameter(parameterId) {
  return {
    parameterId,
    equation: `${parameterId}=source_expression`,
    inputs: ['A', 'B'],
    minimum: 0.1,
    maximum: 10,
    minimumInclusive: true,
    maximumInclusive: true,
  };
}
function load(family, symbol) {
  return { [family]: symbol, positive: 'TARGET_EDITION_DEFINED_POSITIVE_DIRECTION' };
}
