import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EMP1_APPLICABILITY_SUMMARY_SCHEMA,
  projectEmp1ApplicabilitySummary,
} from '../src/core/emp1/emp1-applicability-summary.js';
import {
  buildEmp1ProfessionalResultPresentation,
} from '../src/workspace/emp1-professional-result-presentation.js';

const qualifiedInput = applicability();
const qualified = projectEmp1ApplicabilitySummary(qualifiedInput);
assert.equal(qualified.schema, EMP1_APPLICABILITY_SUMMARY_SCHEMA);
assert.equal(qualified.status, 'PASS_WRC537_4_5_SOURCE_LIMITS_QUALIFIED');
assert.equal(qualified.existingAuthority.comparisonApplicabilitySatisfied, true);
assert.equal(qualified.existingAuthority.engineeringUseAuthorized, true);
assert.equal(qualified.existingAuthority.productionUseAuthorized, true);
assert.equal(qualified.source.qualification, 'QUALIFIED_WRC537_4_5_SOURCE_AUTHORITY');
assert.equal(qualified.source.authoritySemanticHash, 'applicability-source-hash');
assert.equal(qualified.source.authorityHashRetained, true);
assert.equal(qualified.evaluatedCase.meanRadius, 100);
assert.deepEqual(qualified.evaluatedCase.loadsConsidered, { P: 10, Mc: 20, Ml: 30 });
assert.equal(qualified.evaluatedCase.evidence.cylinderLength, 150);
assert.equal(qualified.evaluatedCase.evidence.nearestCylinderEndDistance, 60);
assert.equal(qualified.rules.radialLoad.status, 'PASS_SOURCE_LIMIT');
assert.equal(qualified.rules.radialLoad.actualRatio, 1.5);
assert.equal(qualified.rules.radialLoad.minimumRatio, 1);
assert.equal(qualified.rules.externalMoment.status, 'PASS_SOURCE_LIMIT');
assert.equal(qualified.rules.externalMoment.actualRatio, 0.6);
assert.equal(qualified.rules.externalMoment.minimumRatio, 0.5);
assert.equal(qualified.stressScope.attachmentStressesCalculated, false);
assert.equal(qualified.stressScope.nozzleStressesCalculated, false);
assert.equal(qualified.authorityBoundary.projectionOnly, true);
assert.equal(qualified.authorityBoundary.evaluatesGeometry, false);
assert.equal(qualified.authorityBoundary.evaluatesLoads, false);
assert.equal(qualified.authorityBoundary.evaluatesSourceLimits, false);
assert.equal(qualified.authorityBoundary.calculatesRatios, false);
assert.equal(qualified.authorityBoundary.createsApplicabilityAuthority, false);
assert.equal(qualified.authorityBoundary.createsNumericalAuthority, false);
assert.equal(qualified.authorityBoundary.createsCodeCompliance, false);
assert.equal(qualified.authorityBoundary.createsReleaseAuthority, false);
assert.equal(Object.isFrozen(qualified), true);
assert.equal(Object.isFrozen(qualified.rules), true);
assert.equal(Object.isFrozen(qualified.rules.radialLoad), true);
assert.equal(Object.isFrozen(qualified.evaluatedCase.evidence), true);

const comparisonOnly = projectEmp1ApplicabilitySummary(applicability({
  status: 'PASS_WRC537_4_5_SOURCE_LIMITS_COMPARISON_ONLY',
  comparisonApplicabilitySatisfied: true,
  engineeringUseAuthorized: false,
  productionUseAuthorized: false,
  sourceQualification: 'UNQUALIFIED_FOR_PRODUCTION',
  sourceAuthoritySemanticHash: null,
}));
assert.equal(comparisonOnly.status, 'PASS_WRC537_4_5_SOURCE_LIMITS_COMPARISON_ONLY');
assert.equal(comparisonOnly.existingAuthority.productionUseAuthorized, false);
assert.equal(comparisonOnly.source.authorityHashRetained, false);

const incomplete = projectEmp1ApplicabilitySummary(applicability({
  status: 'INCOMPLETE_WRC537_4_5_SOURCE_EVIDENCE',
  comparisonApplicabilitySatisfied: false,
  engineeringUseAuthorized: false,
  productionUseAuthorized: false,
  sourceQualification: 'UNQUALIFIED_FOR_PRODUCTION',
  sourceAuthoritySemanticHash: null,
  evidence: null,
  rules: {
    radialLoad: rule({
      status: 'SOURCE_EVIDENCE_REQUIRED', actualRatio: null, cylinderLength: null,
    }),
    externalMoment: rule({
      sourceSection: 'WRC537_4.5.2',
      status: 'SOURCE_EVIDENCE_REQUIRED',
      limit: 'nearest end distance >= 0.5*Rm when Mc or Ml is evaluated',
      actualRatio: null,
      minimumRatio: 0.5,
      nearestCylinderEndDistance: null,
    }),
  },
  reasons: ['WRC537_4_5_APPLICABILITY_EVIDENCE_REQUIRED'],
}));
assert.equal(incomplete.status, 'INCOMPLETE_WRC537_4_5_SOURCE_EVIDENCE');
assert.equal(incomplete.evaluatedCase.evidence, null);
assert.deepEqual(incomplete.reasons, ['WRC537_4_5_APPLICABILITY_EVIDENCE_REQUIRED']);

const outside = projectEmp1ApplicabilitySummary(applicability({
  status: 'OUTSIDE_WRC537_4_5_SOURCE_LIMITS',
  comparisonApplicabilitySatisfied: false,
  engineeringUseAuthorized: false,
  productionUseAuthorized: false,
  rules: {
    radialLoad: rule({
      status: 'OUTSIDE_SOURCE_LIMIT', actualRatio: 0.8, cylinderLength: 80,
    }),
    externalMoment: rule({
      sourceSection: 'WRC537_4.5.2',
      status: 'OUTSIDE_SOURCE_LIMIT',
      limit: 'nearest end distance >= 0.5*Rm when Mc or Ml is evaluated',
      actualRatio: 0.4,
      minimumRatio: 0.5,
      nearestCylinderEndDistance: 40,
    }),
  },
  reasons: [
    'WRC537_4_5_1_CYLINDER_LENGTH_LT_RM',
    'WRC537_4_5_2_END_DISTANCE_LT_0P5_RM',
  ],
}));
assert.equal(outside.status, 'OUTSIDE_WRC537_4_5_SOURCE_LIMITS');
assert.equal(outside.rules.radialLoad.actualRatio, 0.8);
assert.equal(outside.rules.externalMoment.actualRatio, 0.4);

assert.throws(
  () => projectEmp1ApplicabilitySummary({ ...qualifiedInput, schema: 'wrong/v1' }),
  /EMP1_APPLICABILITY_RESULT_SCHEMA_INVALID/u,
);
assert.throws(
  () => projectEmp1ApplicabilitySummary({ ...qualifiedInput, status: 'UNKNOWN' }),
  /EMP1_APPLICABILITY_STATUS_UNSUPPORTED/u,
);
assert.throws(
  () => projectEmp1ApplicabilitySummary({
    ...qualifiedInput,
    productionUseAuthorized: 'yes',
  }),
  /EMP1_APPLICABILITY_PRODUCTION_AUTHORITY_REQUIRED/u,
);

const professional = buildEmp1ProfessionalResultPresentation({
  execution: {
    authority: {
      boundedLocalRouteExecuted: true,
      codeComplianceProduced: false,
      releaseQualified: false,
    },
  },
  currentness: { state: 'CURRENT' },
  cState: {
    currentResultAvailable: true,
    blockerCodes: [],
    currentAuthoritySnapshot: {
      routeId: 'EMP1.C.TEST',
      registry: {
        engineeringUseAuthorized: true,
        method: { identity: 'WRC537-TEST', edition: '2013' },
        scope: {},
        limitations: [],
        remainingBlocked: [],
      },
    },
  },
  localCorrelation: {
    stresses: { stressIntensity: [1, 2, 3, 4, 5, 6, 7, 8] },
    qualifiedApplicability: qualifiedInput,
  },
});
assert.equal(professional.status.calculated, true);
assert.equal(professional.applicability.schema, EMP1_APPLICABILITY_SUMMARY_SCHEMA);
assert.equal(professional.applicability.status,
  'PASS_WRC537_4_5_SOURCE_LIMITS_QUALIFIED');
assert.equal(professional.applicability.source.authoritySemanticHash,
  'applicability-source-hash');

const staleProfessional = buildEmp1ProfessionalResultPresentation({
  execution: professionalExecution(),
  currentness: { state: 'STALE' },
  cState: professionalCState(),
  localCorrelation: {
    stresses: { stressIntensity: [1, 2, 3, 4, 5, 6, 7, 8] },
    qualifiedApplicability: qualifiedInput,
  },
});
assert.equal(staleProfessional.status.calculated, false);
assert.equal(staleProfessional.applicability, null);

const summarySource = readFileSync(
  new URL('../src/core/emp1/emp1-applicability-summary.js', import.meta.url),
  'utf8',
);
const presentationSource = readFileSync(
  new URL('../src/workspace/emp1-professional-result-presentation.js', import.meta.url),
  'utf8',
);
assert.equal(summarySource.includes('evaluateEmp1Wrc537CylindricalApplicability'), false);
assert.equal(summarySource.includes('requireEmp1Wrc537QualifiedCylindricalApplicability'), false);
assert.equal(summarySource.includes('semanticHash('), false);
assert.equal(summarySource.includes('Math.abs('), false);
assert.equal(summarySource.includes('emp1-wrc537-cylindrical-applicability.js'), false);
assert.equal(presentationSource.includes("../core/emp1/emp1-applicability-summary.js"), true);
assert.equal(
  (presentationSource.match(/projectEmp1ApplicabilitySummary\(localCorrelation\.qualifiedApplicability\)/gu) ?? []).length,
  1,
);
assert.equal(presentationSource.includes('evaluateEmp1Wrc537CylindricalApplicability'), false);
assert.equal(presentationSource.includes('requireEmp1Wrc537QualifiedCylindricalApplicability'), false);

console.log(JSON.stringify({
  schema: 'emp1-applicability-summary-check/v1',
  status: 'PASS_READ_ONLY_EXISTING_APPLICABILITY_PRESENTATION',
  qualifiedStatus: qualified.status,
  comparisonOnlyStatus: comparisonOnly.status,
  incompleteStatus: incomplete.status,
  outsideStatus: outside.status,
  sourceAuthorityHashRetained: qualified.source.authorityHashRetained,
  applicabilityLogicDuplicated: false,
  geometryEvaluatedBySummary: false,
  loadsEvaluatedBySummary: false,
  ratiosCalculatedBySummary: false,
  applicabilityAuthorityCreatedBySummary: false,
  numericalAuthorityCreatedBySummary: false,
  codeComplianceCreatedBySummary: false,
  releaseAuthorityCreatedBySummary: false,
}, null, 2));

function applicability(overrides = {}) {
  return {
    schema: 'emp1-wrc537-cylindrical-applicability/v1',
    status: 'PASS_WRC537_4_5_SOURCE_LIMITS_QUALIFIED',
    comparisonApplicabilitySatisfied: true,
    engineeringUseAuthorized: true,
    productionUseAuthorized: true,
    sourceQualification: 'QUALIFIED_WRC537_4_5_SOURCE_AUTHORITY',
    sourceAuthoritySemanticHash: 'applicability-source-hash',
    meanRadius: 100,
    loadsConsidered: { P: 10, Mc: 20, Ml: 30 },
    evidence: {
      cylinderLength: 150,
      nearestCylinderEndDistance: 60,
      basisAuthority: 'TYPED_ENGINEERING_SOURCE',
      sourceQualification: 'QUALIFIED_WRC537_4_5_SOURCE_AUTHORITY',
      sourceReferences: {
        cylinderLength: 'SOURCE:L',
        nearestCylinderEndDistance: 'DERIVED:MIN_X_L_MINUS_X',
      },
    },
    rules: {
      radialLoad: rule(),
      externalMoment: rule({
        sourceSection: 'WRC537_4.5.2',
        limit: 'nearest end distance >= 0.5*Rm when Mc or Ml is evaluated',
        actualRatio: 0.6,
        minimumRatio: 0.5,
        nearestCylinderEndDistance: 60,
      }),
    },
    reasons: [],
    stressScope: {
      domain: 'HOST_CYLINDRICAL_SHELL_AT_ATTACHMENT_SHELL_JUNCTURE',
      shellStressesCalculated: true,
      attachmentStressesCalculated: false,
      nozzleStressesCalculated: false,
      recoveryLocation: 'ATTACHMENT_SHELL_JUNCTURE',
      sourceSection: 'WRC537_4.5.3',
    },
    ...overrides,
  };
}

function rule(overrides = {}) {
  return {
    sourceSection: 'WRC537_4.5.1',
    status: 'PASS_SOURCE_LIMIT',
    limit: 'l >= Rm when radial load P is evaluated',
    actualRatio: 1.5,
    minimumRatio: 1,
    cylinderLength: 150,
    nearestCylinderEndDistance: null,
    ...overrides,
  };
}

function professionalExecution() {
  return {
    authority: {
      boundedLocalRouteExecuted: true,
      codeComplianceProduced: false,
      releaseQualified: false,
    },
  };
}

function professionalCState() {
  return {
    currentResultAvailable: true,
    blockerCodes: [],
    currentAuthoritySnapshot: {
      routeId: 'EMP1.C.TEST',
      registry: {
        engineeringUseAuthorized: true,
        method: { identity: 'WRC537-TEST', edition: '2013' },
        scope: {},
        limitations: [],
        remainingBlocked: [],
      },
    },
  };
}
