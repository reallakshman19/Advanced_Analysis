export function createReadyWrc537Ed4SourceFixture() {
  const digest = 'a'.repeat(64);
  const documentRef = 'TECH-WRC537-ED4';
  const sourceLedgerRows = [
    {
      record_id: 'CATALOG-WRC537-ED4',
      record_scope: 'DOCUMENT_IDENTITY',
      engineering_subject: 'METHOD_IDENTITY',
      authority_class: 'OFFICIAL_CATALOG_IDENTITY',
      publisher: 'Welding Research Council, Inc.',
      bulletin_number: '537',
      edition: '4',
      publication_date: '2026-02',
      document_digest: '',
      locator: 'Official catalog entry',
      verification_status: 'CATALOG_IDENTITY_VERIFIED',
      notes: 'Fixture catalog identity only.',
    },
    {
      record_id: documentRef,
      record_scope: 'DOCUMENT',
      engineering_subject: 'AUTHORIZED_ED4_TECHNICAL_SOURCE',
      authority_class: 'PRIMARY_LICENSED',
      publisher: 'Welding Research Council, Inc.',
      bulletin_number: '537',
      edition: '4',
      publication_date: '2026-02',
      document_digest: digest,
      locator: 'Authorized Edition 4 technical source',
      verification_status: 'PRIMARY_SOURCE_VERIFIED',
      notes: 'Synthetic qualification fixture; not WRC technical data.',
    },
  ];

  const datum = (recordId, engineeringSubject, locator) => {
    sourceLedgerRows.push({
      record_id: recordId,
      record_scope: 'DATUM',
      engineering_subject: engineeringSubject,
      authority_class: 'PRIMARY_LICENSED',
      publisher: 'Welding Research Council, Inc.',
      bulletin_number: '537',
      edition: '4',
      publication_date: '2026-02',
      document_digest: digest,
      locator,
      verification_status: 'PRIMARY_SOURCE_VERIFIED',
      notes: 'Synthetic datum-level contract fixture only; not WRC engineering data.',
    });
    return { sourceRef: recordId, sourceLocator: locator };
  };

  const geometryDatum = datum('DATUM-WRC537-ED4-GEOMETRY', 'GEOMETRY_DEFINITIONS', 'Fixture p.10 Geometry definitions');
  const applicabilityDatum = datum('DATUM-WRC537-ED4-APPLICABILITY', 'PHYSICAL_APPLICABILITY', 'Fixture p.11 Applicability');
  const stressComponentDatum = datum('DATUM-WRC537-ED4-STRESS-COMPONENT', 'STRESS_COMPONENTS', 'Fixture p.20 Stress components');
  const recoveryDatum = datum('DATUM-WRC537-ED4-RECOVERY', 'RECOVERY_LOCATIONS', 'Fixture p.21 Recovery locations');
  const reconstructionDatum = datum('DATUM-WRC537-ED4-RECONSTRUCTION', 'SURFACE_RECONSTRUCTION', 'Fixture p.22 Surface reconstruction');
  const stressMeasureDatum = datum('DATUM-WRC537-ED4-STRESS-MEASURE', 'STRESS_MEASURE', 'Fixture p.23 Stress measure');
  const interpolationDatum = datum('DATUM-WRC537-ED4-INTERPOLATION', 'INTERPOLATION_POLICY', 'Fixture p.30 Interpolation');
  const coefficientDatum = datum('DATUM-WRC537-ED4-COEFF-001', 'COEFFICIENT_QUALIFIED_FIXTURE_001', 'Fixture p.100 Table X row Y');
  const benchmarkDatum = datum('DATUM-WRC537-ED4-BENCH-001', 'REFERENCE_BENCHMARK_001', 'Fixture p.150 Example 1');

  const parameter = (parameterId) => {
    const source = datum(`DATUM-WRC537-ED4-PARAM-${parameterId}`, `PARAMETER_${parameterId}`, `Fixture p.40 ${parameterId}`);
    return {
      parameterId,
      sourceSymbol: `${parameterId}_SYMBOL`,
      equation: `${parameterId}=SOURCE_EXPRESSION`,
      inputs: ['A', 'B'],
      minimum: 0.1,
      maximum: 10,
      minimumInclusive: true,
      maximumInclusive: true,
      sourceRef: source.sourceRef,
    };
  };

  const load = (family, sourceSymbol) => {
    const key = `${family}-${sourceSymbol}`;
    const source = datum(`DATUM-WRC537-ED4-LOAD-${key}`, `LOAD_CONVENTION_${key}`, `Fixture p.50 ${family} ${sourceSymbol}`);
    return {
      family,
      sourceSymbol,
      physicalDirection: `${family}-${sourceSymbol}-PHYSICAL-DIRECTION`,
      positiveDirection: `${family}-${sourceSymbol}-POSITIVE-DIRECTION`,
      referencePoint: 'ATTACHMENT_SHELL_INTERFACE',
      sourceRef: source.sourceRef,
    };
  };

  const mapping = (sourceQuantity, lafeaField) => ({
    sourceQuantity,
    lafeaField,
    mappingType: 'QUALIFIED_FIXTURE_MAPPING',
  });

  return {
    sourceLedgerRows,
    coefficientRows: [{
      method_id: 'WRC537',
      edition: '4th Edition 2026',
      coefficient_family: 'QUALIFIED_FIXTURE_FAMILY',
      coefficient_id: 'QUALIFIED_FIXTURE_COEFFICIENT_001',
      load_component: 'P',
      stress_component: 'SIGMA_X',
      stress_class: 'MEMBRANE',
      target_location: 'POINT_A',
      surface: 'OUTER',
      parameter_1_name: 'A',
      parameter_1_value: '1',
      parameter_2_name: 'B',
      parameter_2_value: '2',
      parameter_3_name: 'C',
      parameter_3_value: '3',
      coefficient_value: '1.234',
      published_precision: '3_DECIMAL_PLACES',
      source_ref: coefficientDatum.sourceRef,
      source_locator: coefficientDatum.sourceLocator,
      extraction_method: 'DIRECT_TABLE',
      review_status: 'PRIMARY_SOURCE_VERIFIED',
    }],
    sourcePackage: {
      schema: 'wrc537-ed4-source-package/v1',
      expectedCurrentState: 'READY_FOR_TECHNICAL_IMPLEMENTATION',
      identity: {
        bulletinNumber: 'WRC Bulletin 537',
        title: 'Fixture WRC 537 Edition 4 identity',
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
        sourceId: 'AUTHORIZED-WRC537-ED4-FIXTURE',
        documentDigest: digest,
        sourceRef: documentRef,
        accessBasis: 'LICENSED_ENGINEERING_USE_FIXTURE',
        custodyNote: 'Synthetic contract fixture only.',
      },
      geometry: {
        inventoryDeclared: true,
        definitions: [
          ['Rm', 'Fixture spherical mean radius'], ['Rc', 'Fixture cylindrical mean radius'],
          ['T', 'Fixture shell thickness'], ['r0', 'Fixture attachment radius'],
          ['rm', 'Fixture attachment mean radius'], ['t', 'Fixture attachment thickness'],
          ['C1', 'Fixture rectangular half dimension one'], ['C2', 'Fixture rectangular half dimension two'],
        ].map(([symbol, definition]) => ({ symbol, definition, sourceRef: geometryDatum.sourceRef })),
        applicability: {
          hostShellFamilies: ['CYLINDRICAL_SHELL', 'SPHERICAL_SHELL'],
          attachmentFamilies: ['FIXTURE_ATTACHMENT'],
          intersectionOrientation: 'FIXTURE_SOURCE_QUALIFIED_ORIENTATION',
          loadReferenceConvention: 'ATTACHMENT_SHELL_INTERFACE',
          exclusions: ['FIXTURE_SOURCE_QUALIFIED_EXCLUSION'],
          sourceRef: applicabilityDatum.sourceRef,
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
        stressComponents: [{
          sourceSymbol: 'SIGMA_SOURCE', meaning: 'Fixture qualified normal stress',
          stressClass: 'MEMBRANE_BENDING', sourceRef: stressComponentDatum.sourceRef,
        }],
        locations: [{
          locationId: 'POINT_A_OUTER', surface: 'OUTER',
          physicalLocation: 'FIXTURE_SOURCE_QUALIFIED_LOCATION', sourceRef: recoveryDatum.sourceRef,
        }],
        surfaceReconstruction: {
          rule: 'FIXTURE_SOURCE_QUALIFIED_RECONSTRUCTION', sourceRef: reconstructionDatum.sourceRef,
        },
        stressIntensityOrEquivalent: {
          definition: 'FIXTURE_SOURCE_QUALIFIED_STRESS_MEASURE',
          sourceRef: stressMeasureDatum.sourceRef,
          dimensionallyVerified: true,
        },
      },
      interpolation: {
        interpolationAuthorized: true,
        extrapolationAuthorized: false,
        algorithm: 'FIXTURE_SOURCE_QUALIFIED_INTERPOLATION',
        boundaryBehavior: 'FIXTURE_SOURCE_QUALIFIED_BOUNDARY_BEHAVIOR',
        sourceRef: interpolationDatum.sourceRef,
      },
      coefficients: {
        inventoryDeclared: true,
        dataFile: 'WRC537_ED4_COEFFICIENTS.csv',
        policy: 'Fixture Edition 4 primary-source-qualified coefficients only.',
      },
      benchmarks: [{
        caseId: 'WRC537-ED4-FIXTURE-001',
        sourceRef: benchmarkDatum.sourceRef,
        targetEditionPrimarySourceVerified: true,
        independentlyReproduced: true,
        independentCalculationReference: 'FIXTURE_HAND_CALC_001',
        input: { geometry: { R: 100 }, loads: { P: 1000 } },
        inputEvidence: [
          {
            inputId: 'GEOMETRY_R',
            benchmarkPath: ['geometry', 'R'],
            units: 'mm',
            sourceRef: benchmarkDatum.sourceRef,
            sourceLocator: benchmarkDatum.sourceLocator,
          },
          {
            inputId: 'LOAD_P',
            benchmarkPath: ['loads', 'P'],
            units: 'N',
            sourceRef: benchmarkDatum.sourceRef,
            sourceLocator: benchmarkDatum.sourceLocator,
          },
        ],
        expectedResults: [{
          quantity: 'SIGMA_X',
          value: 12.34,
          units: 'MPa',
          absoluteTolerance: 0.005,
          toleranceBasis: 'FIXTURE_SOURCE_DISPLAYED_TO_0.01_MPA',
          sourceRef: benchmarkDatum.sourceRef,
          sourceLocator: benchmarkDatum.sourceLocator,
        }],
      }],
      lafeaMapping: {
        qualified: true,
        geometry: [mapping('Rc', 'geometry.pipeMeanRadius')],
        loads: [
          ...['P', 'V1', 'V2', 'M1', 'M2', 'Mt'].map((symbol) =>
            mapping(`spherical:${symbol}`, `loads.spherical.${symbol}`)),
          ...['P', 'Vc', 'Vl', 'Mc', 'Ml', 'Mt'].map((symbol) =>
            mapping(`cylindrical:${symbol}`, `loads.cylindrical.${symbol}`)),
        ],
        stresses: [mapping('SIGMA_SOURCE', 'result.sigmaX')],
      },
    },
  };
}
