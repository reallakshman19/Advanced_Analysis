import assert from 'node:assert/strict';
import {
  WRC537_ED4_PACKAGE_BLOCKED,
  WRC537_ED4_PACKAGE_READY,
  evaluateWrc537Ed4SourcePackage,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-source-package.js';

const ready = readyFixture();
const accepted = evaluateWrc537Ed4SourcePackage(ready);
assert.equal(accepted.state, WRC537_ED4_PACKAGE_READY);
assert.deepEqual(accepted.failedGateIds, []);

assertBlocked('SOURCE_LEDGER_IDS_UNIQUE', (fixture) => {
  fixture.sourceLedgerRows.push({ ...fixture.sourceLedgerRows[1] });
});
assertBlocked('PRIMARY_TECHNICAL_SOURCE', (fixture) => {
  fixture.sourcePackage.technicalSource.sourceRef = 'CATALOG-WRC537-ED4';
});
assertBlocked('PRIMARY_TECHNICAL_SOURCE', (fixture) => {
  fixture.sourcePackage.technicalSource.documentDigest = 'not-a-sha256';
});
assertBlocked('PRIMARY_TECHNICAL_SOURCE', (fixture) => {
  fixture.sourceLedgerRows.find((row) => row.record_id === 'TECH-WRC537-ED4').edition = '3';
});
assertBlocked('PRIMARY_TECHNICAL_SOURCE', (fixture) => {
  fixture.sourceLedgerRows.find((row) => row.record_id === 'TECH-WRC537-ED4').document_digest = 'b'.repeat(64);
});
assertBlocked('GEOMETRY_COMPLETE', (fixture) => {
  fixture.sourcePackage.geometry.definitions.find((row) => row.symbol === 'Rc').definition = 'UNRESOLVED_ED4';
});
assertBlocked('GEOMETRY_COMPLETE', (fixture) => {
  fixture.sourcePackage.geometry.applicability.sourceRef = 'CATALOG-WRC537-ED4';
});
assertBlocked('PARAMETERS_COMPLETE', (fixture) => {
  fixture.sourcePackage.parameters.find((row) => row.parameterId === 'CYL_LAMBDA').minimumInclusive = null;
});
assertBlocked('LOAD_CONVENTIONS_COMPLETE', (fixture) => {
  fixture.sourcePackage.loads.find((row) => row.family === 'cylindrical' && row.sourceSymbol === 'Mt').positiveDirection = 'UNRESOLVED';
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
  fixture.coefficientRows.push({ ...fixture.coefficientRows[0] });
});
assertBlocked('COEFFICIENTS_COMPLETE', (fixture) => {
  fixture.coefficientRows[0].edition = '3rd Edition 2022';
});
assertBlocked('COEFFICIENTS_COMPLETE', (fixture) => {
  fixture.coefficientRows[0].published_precision = 'UNRESOLVED';
});
assertBlocked('BENCHMARKS_COMPLETE', (fixture) => {
  fixture.sourcePackage.benchmarks[0].independentlyReproduced = false;
});
assertBlocked('LAFEA_MAPPING_COMPLETE', (fixture) => {
  fixture.sourcePackage.lafeaMapping.qualified = false;
});
assertBlocked('NO_UNRESOLVED_TECHNICAL_FIELDS', (fixture) => {
  fixture.sourcePackage.geometry.applicability.exclusions[0] = 'TBD';
});

console.log(JSON.stringify({
  check: 'wrc537-ed4-source-package-self-test',
  status: 'PASS',
  completeSyntheticAuthorityAccepted: true,
  duplicateLedgerIdentityRejected: true,
  catalogMetadataCannotActAsTechnicalAuthority: true,
  documentDigestRequiredAndLedgerBound: true,
  mixedEditionPrimarySourceRejected: true,
  unresolvedGeometryRejected: true,
  applicabilityRequiresPrimarySourceCustody: true,
  unresolvedParameterBoundaryRejected: true,
  unresolvedLoadSignRejected: true,
  unresolvedStressReconstructionRejected: true,
  stressMeasureDimensionalVerificationRequired: true,
  interpolationAuthorityRequired: true,
  coefficientInventoryDeclarationRequired: true,
  duplicateCoefficientIdRejected: true,
  oldEditionCoefficientRejected: true,
  coefficientPrecisionRequired: true,
  unreproducedBenchmarkRejected: true,
  unqualifiedLafeaMappingRejected: true,
  genericUnresolvedTechnicalFieldRejected: true,
}));

function assertBlocked(gateId, mutate) {
  const fixture = readyFixture();
  mutate(fixture);
  const result = evaluateWrc537Ed4SourcePackage(fixture);
  assert.equal(result.state, WRC537_ED4_PACKAGE_BLOCKED, `${gateId} must block the source package.`);
  assert.ok(result.failedGateIds.includes(gateId), `${gateId} must be reported.`);
}

function readyFixture() {
  const digest = 'a'.repeat(64);
  const sourceLedgerRows = [
    {
      record_id: 'CATALOG-WRC537-ED4',
      authority_class: 'OFFICIAL_CATALOG_IDENTITY',
      publisher: 'Welding Research Council, Inc.',
      bulletin_number: '537',
      edition: '4',
      publication_date: '2026-02',
      document_digest: '',
      locator: 'Official catalog entry',
      verification_status: 'CATALOG_IDENTITY_VERIFIED',
    },
    {
      record_id: 'TECH-WRC537-ED4',
      authority_class: 'PRIMARY_LICENSED',
      publisher: 'Welding Research Council, Inc.',
      bulletin_number: '537',
      edition: '4',
      publication_date: '2026-02',
      document_digest: digest,
      locator: 'Authorized Edition 4 technical source',
      verification_status: 'PRIMARY_SOURCE_VERIFIED',
    },
  ];
  const sourceRef = 'TECH-WRC537-ED4';
  const parameter = (parameterId) => ({
    parameterId,
    sourceSymbol: `${parameterId}_SYMBOL`,
    equation: `${parameterId}=SOURCE_EXPRESSION`,
    inputs: ['A', 'B'],
    minimum: 0.1,
    maximum: 10,
    minimumInclusive: true,
    maximumInclusive: true,
    sourceRef,
  });
  const load = (family, sourceSymbol) => ({
    family,
    sourceSymbol,
    physicalDirection: `${family}-${sourceSymbol}-PHYSICAL-DIRECTION`,
    positiveDirection: `${family}-${sourceSymbol}-POSITIVE-DIRECTION`,
    referencePoint: 'ATTACHMENT_SHELL_INTERFACE',
    sourceRef,
  });
  return {
    sourceLedgerRows,
    coefficientRows: [{
      method_id: 'WRC537',
      edition: '4th Edition 2026',
      coefficient_family: 'QUALIFIED_FAMILY',
      coefficient_id: 'QUALIFIED_COEFFICIENT_001',
      load_component: 'P',
      stress_component: 'SIGMA_X',
      stress_class: 'MEMBRANE',
      target_location: 'POINT_A',
      surface: 'OUTER',
      coefficient_value: '1.234',
      published_precision: '3_DECIMAL_PLACES',
      source_ref: sourceRef,
      source_locator: 'p.100 Table X row Y',
      extraction_method: 'DIRECT_TABLE',
      review_status: 'PRIMARY_SOURCE_VERIFIED',
    }],
    sourcePackage: {
      schema: 'wrc537-ed4-source-package/v1',
      identity: {
        bulletinNumber: 'WRC Bulletin 537',
        title: 'WRC 537 qualified title',
        edition: '4',
        publicationDate: '2026-02',
        numberOfPages: 202,
        publisher: 'Welding Research Council, Inc.',
        catalogSourceRef: 'CATALOG-WRC537-ED4',
        catalogQualification: 'IDENTITY_METADATA_ONLY',
      },
      technicalSource: {
        available: true,
        editionVerified: true,
        edition: '4',
        publicationDate: '2026-02',
        sourceId: 'AUTHORIZED-WRC537-ED4',
        documentDigest: digest,
        sourceRef,
        accessBasis: 'LICENSED_ENGINEERING_USE',
        custodyNote: 'Authorized source retained outside repository; extracted data source-located.',
      },
      geometry: {
        inventoryDeclared: true,
        definitions: [
          ['Rm', 'Qualified spherical mean radius definition'],
          ['Rc', 'Qualified cylindrical mean radius definition'],
          ['T', 'Qualified shell thickness definition'],
          ['r0', 'Qualified attachment radius definition'],
          ['rm', 'Qualified attachment mean radius definition'],
          ['t', 'Qualified attachment thickness definition'],
          ['C1', 'Qualified rectangular dimension definition'],
          ['C2', 'Qualified rectangular dimension definition'],
        ].map(([symbol, definition]) => ({ symbol, definition, sourceRef })),
        applicability: {
          hostShellFamilies: ['CYLINDRICAL_SHELL', 'SPHERICAL_SHELL'],
          attachmentFamilies: ['SOURCE_QUALIFIED_ATTACHMENT'],
          intersectionOrientation: 'SOURCE_QUALIFIED_ORIENTATION',
          loadReferenceConvention: 'ATTACHMENT_SHELL_INTERFACE',
          exclusions: ['SOURCE_QUALIFIED_EXCLUSION'],
          sourceRef,
        },
      },
      parameters: [
        parameter('SPHERE_U'), parameter('SPHERE_GAMMA'), parameter('SPHERE_RHO'),
        parameter('CYL_LAMBDA'), parameter('CYL_DELTA'),
      ],
      loads: [
        load('spherical', 'P'), load('spherical', 'V1'), load('spherical', 'V2'),
        load('spherical', 'M1'), load('spherical', 'M2'), load('spherical', 'Mt'),
        load('cylindrical', 'P'), load('cylindrical', 'Vc'), load('cylindrical', 'Vl'),
        load('cylindrical', 'Mc'), load('cylindrical', 'Ml'), load('cylindrical', 'Mt'),
      ],
      stressRecovery: {
        inventoryDeclared: true,
        stressComponents: [{ sourceSymbol: 'SIGMA_SOURCE', meaning: 'Qualified normal stress', stressClass: 'MEMBRANE_BENDING', sourceRef }],
        locations: [{ locationId: 'POINT_A_OUTER', surface: 'OUTER', physicalLocation: 'SOURCE_QUALIFIED_LOCATION', sourceRef }],
        surfaceReconstruction: { rule: 'SOURCE_QUALIFIED_MEMBRANE_BENDING_RULE', sourceRef },
        stressIntensityOrEquivalent: { definition: 'SOURCE_QUALIFIED_STRESS_MEASURE', sourceRef, dimensionallyVerified: true },
      },
      interpolation: {
        interpolationAuthorized: true,
        extrapolationAuthorized: false,
        algorithm: 'SOURCE_QUALIFIED_INTERPOLATION_ALGORITHM',
        boundaryBehavior: 'SOURCE_QUALIFIED_BOUNDARY_BEHAVIOR',
        sourceRef,
      },
      coefficients: {
        inventoryDeclared: true,
        dataFile: 'WRC537_ED4_COEFFICIENTS.csv',
        policy: 'Edition 4 primary-source-qualified coefficients only.',
      },
      benchmarks: [{
        caseId: 'WRC537-ED4-SOURCE-001',
        sourceRef,
        targetEditionPrimarySourceVerified: true,
        independentlyReproduced: true,
        input: { geometry: { R: 100 }, loads: { P: 1000 } },
        expectedResults: [{ quantity: 'SIGMA_X', value: 12.34, units: 'MPa', toleranceBasis: 'SOURCE_PRECISION' }],
      }],
      lafeaMapping: {
        qualified: true,
        geometry: [{ sourceQuantity: 'Rc', lafeaField: 'geometry.pipeMeanRadius', mappingType: 'DIRECT' }],
        loads: [
          ...['P', 'V1', 'V2', 'M1', 'M2', 'Mt'].map((symbol) => ({ sourceQuantity: `spherical:${symbol}`, lafeaField: `loads.spherical.${symbol}`, mappingType: 'QUALIFIED' })),
          ...['P', 'Vc', 'Vl', 'Mc', 'Ml', 'Mt'].map((symbol) => ({ sourceQuantity: `cylindrical:${symbol}`, lafeaField: `loads.cylindrical.${symbol}`, mappingType: 'QUALIFIED' })),
        ],
        stresses: [{ sourceQuantity: 'SIGMA_SOURCE', lafeaField: 'result.sigmaX', mappingType: 'QUALIFIED' }],
      },
    },
  };
}
