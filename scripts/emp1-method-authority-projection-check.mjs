import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EMP1_METHOD_AUTHORITY_SCHEMA,
  EMP1_METHOD_AUTHORITY_STATE,
  projectEmp1MethodAuthority,
} from '../src/core/emp1/emp1-method-authority-projection.js';

const boundedFixture = fixture();
const bounded = projectEmp1MethodAuthority(boundedFixture);
assert.equal(bounded.schema, EMP1_METHOD_AUTHORITY_SCHEMA);
assert.equal(bounded.productId, 'EMP.1');
assert.equal(bounded.state, EMP1_METHOD_AUTHORITY_STATE.AUTHORIZED_BOUNDED_ROUTE);
assert.equal(bounded.productionAuthority, 'BOUNDED_ROUTE_ONLY');
assert.equal(bounded.globalEmp1CRouteAuthority, false);
assert.equal(bounded.routeEvidenceState, 'EMBEDDED_IN_PRODUCT_PROJECTION');
assert.equal(bounded.routes.length, 1);
assert.equal(bounded.routes[0].routeId, 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP');
assert.equal(bounded.routes[0].registered, true);
assert.equal(bounded.routes[0].engineeringUseAuthorized, true);
assert.equal(bounded.routes[0].method.identity, 'WRC537_2013_CYLINDRICAL_ORIGINAL_GAMMA5_TABLE5_ZERO_DP');
assert.equal(bounded.routes[0].method.edition, '2013');
assert.equal(bounded.routes[0].method.sourceDocumentSha256, 'source-sha');
assert.equal(bounded.routes[0].method.datasetHash, 'dataset-hash');
assert.equal(bounded.routes[0].method.qualificationRecordSha256, 'qualification-sha');
assert.equal(bounded.routes[0].scope.shellFamily, 'CYLINDRICAL');
assert.equal(bounded.routes[0].scope.attachmentShape, 'ROUND');
assert.equal(bounded.routes[0].scope.gamma, 5);
assert.equal(bounded.routes[0].scope.betaMinimum, 0.05);
assert.equal(bounded.routes[0].scope.betaMaximum, 0.5);
assert.equal(bounded.routes[0].scope.differentialPressure, 0);
assert.equal(bounded.routes[0].scope.applicabilitySourceAuthority, 'EMP1_WRC537_APPLICABILITY_SOURCE_AUTHORITY');
assert.equal(bounded.routes[0].scope.absoluteShellMaximumAssured, false);
assert.deepEqual(bounded.routes[0].limitations, [
  'WRC_TABLE5_EIGHT_POINTS_NOT_GLOBAL_ABSOLUTE_MAXIMUM',
  'UNITY_STRESS_CONCENTRATION_MULTIPLIERS_ONLY',
]);
assert.deepEqual(bounded.routes[0].remainingBlocked, [
  'NONZERO_DIFFERENTIAL_PRESSURE',
  'GAMMA_OTHER_THAN_5',
  'GLOBAL_EMP1_C_ROUTE',
]);
assert.equal(bounded.routes[0].releaseQualified, false);
assert.equal(bounded.routes[0].authorityEstablishedByProjection, false);
assert.equal(bounded.authorityBoundary.projectionOnly, true);
assert.equal(bounded.authorityBoundary.createsEngineeringAuthority, false);
assert.equal(bounded.authorityBoundary.createsMethodAuthority, false);
assert.equal(bounded.authorityBoundary.createsSourceAuthority, false);
assert.equal(bounded.authorityBoundary.createsApplicabilityAuthority, false);
assert.equal(bounded.authorityBoundary.createsRouteAuthority, false);
assert.equal(bounded.authorityBoundary.createsCodeCompliance, false);
assert.equal(bounded.authorityBoundary.createsReleaseAuthority, false);
assert.ok(Object.isFrozen(bounded));
assert.ok(Object.isFrozen(bounded.routes));
assert.ok(Object.isFrozen(bounded.routes[0].method));
assert.ok(Object.isFrozen(bounded.routes[0].scope));

boundedFixture.steps[2].boundedProductionRoutes[0].method.identity = 'MUTATED_AFTER_PROJECTION';
assert.equal(
  bounded.routes[0].method.identity,
  'WRC537_2013_CYLINDRICAL_ORIGINAL_GAMMA5_TABLE5_ZERO_DP',
);

const qualifiedMethod = projectEmp1MethodAuthority(fixture({
  productionAuthority: 'QUALIFIED_METHOD_AUTHORITY',
  routes: [],
}));
assert.equal(qualifiedMethod.state, EMP1_METHOD_AUTHORITY_STATE.QUALIFIED_METHOD_AUTHORITY);
assert.equal(qualifiedMethod.routeEvidenceState, 'NOT_EMBEDDED');
assert.deepEqual(qualifiedMethod.blockers, []);

const notAuthorized = projectEmp1MethodAuthority(fixture({
  productionAuthority: 'NOT_AUTHORIZED',
  routes: [],
}));
assert.equal(notAuthorized.state, EMP1_METHOD_AUTHORITY_STATE.NOT_AUTHORIZED);
assert.deepEqual(notAuthorized.blockers, []);

const unsupported = projectEmp1MethodAuthority(fixture({
  productionAuthority: 'UNEXPECTED_AUTHORITY',
  routes: [],
}));
assert.equal(unsupported.state, EMP1_METHOD_AUTHORITY_STATE.BLOCKED);
assert.deepEqual(unsupported.blockers, [
  'EMP1_METHOD_AUTHORITY_PRODUCTION_AUTHORITY_UNSUPPORTED:UNEXPECTED_AUTHORITY',
]);

const boundaryFallbackFixture = fixture();
boundaryFallbackFixture.qualificationBoundary.emp1CBoundedProductionRoutes =
  boundaryFallbackFixture.steps[2].boundedProductionRoutes;
delete boundaryFallbackFixture.steps[2].boundedProductionRoutes;
const boundaryFallback = projectEmp1MethodAuthority(boundaryFallbackFixture);
assert.equal(boundaryFallback.routes.length, 1);
assert.equal(boundaryFallback.routeEvidenceState, 'EMBEDDED_IN_PRODUCT_PROJECTION');

assert.throws(
  () => projectEmp1MethodAuthority({ schema: 'wrong', steps: [] }),
  (error) => error?.code === 'EMP1_METHOD_AUTHORITY_PRODUCT_PROJECTION_INVALID',
);
assert.throws(
  () => projectEmp1MethodAuthority({ schema: 'emp1-product-projection/v1' }),
  (error) => error?.code === 'EMP1_METHOD_AUTHORITY_STEPS_REQUIRED',
);
assert.throws(
  () => projectEmp1MethodAuthority(fixture({ routes: [{}] })),
  (error) => error?.code === 'EMP1_METHOD_AUTHORITY_ROUTE_INVALID:0',
);

const methodSource = readFileSync(
  new URL('../src/core/emp1/emp1-method-authority-projection.js', import.meta.url),
  'utf8',
);
const readinessSource = readFileSync(
  new URL('../src/core/emp1/emp1-readiness-projection.js', import.meta.url),
  'utf8',
);

assert.equal(methodSource.includes("from './emp1-c-bounded-route-registry.js'"), false);
assert.equal(methodSource.includes('runEmp1('), false);
assert.equal(methodSource.includes('semanticHash('), false);
assert.equal(methodSource.includes('stressIntensity'), false);
assert.ok(readinessSource.includes("from './emp1-method-authority-projection.js'"));
assert.equal(
  (readinessSource.match(/projectEmp1MethodAuthority\(projection\)/g) ?? []).length,
  1,
);
assert.ok(readinessSource.includes('authorityProjection: methodAuthority'));

console.log(JSON.stringify({
  schema: 'emp1-method-authority-projection-check/v1',
  status: 'PASS_READ_ONLY_METHOD_AUTHORITY_PROJECTION',
  boundedState: bounded.state,
  routeId: bounded.routes[0].routeId,
  methodIdentity: bounded.routes[0].method.identity,
  sourceAuthorityProjected: bounded.routes[0].method.sourceDocumentSha256,
  applicabilityAuthorityProjected: bounded.routes[0].scope.applicabilitySourceAuthority,
  routeRegistryImportedByProjection: false,
  engineeringAuthorityCreatedByProjection: false,
  methodAuthorityCreatedByProjection: false,
  sourceAuthorityCreatedByProjection: false,
  applicabilityAuthorityCreatedByProjection: false,
  routeAuthorityCreatedByProjection: false,
  releaseAuthorityCreatedByProjection: false,
}, null, 2));

function fixture({
  productionAuthority = 'BOUNDED_ROUTE_ONLY',
  routes = [routeFixture()],
} = {}) {
  return {
    schema: 'emp1-product-projection/v1',
    product: { productId: 'EMP.1' },
    steps: [
      { shortId: 'A', stepId: 'EMP.1.A' },
      { shortId: 'B', stepId: 'EMP.1.B' },
      { shortId: 'C', stepId: 'EMP.1.C', boundedProductionRoutes: routes },
    ],
    qualificationBoundary: {
      emp1CProductionAuthority: productionAuthority,
      emp1CTechnicalQualificationReady: true,
      emp1CRunAuthorized: false,
      emp1CWorkspaceExecutionWired: true,
      globalEmp1CRouteAuthority: false,
      releaseQualified: false,
    },
  };
}

function routeFixture() {
  return {
    schema: 'emp1-c-bounded-route-registry/v1',
    routeId: 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP',
    registered: true,
    engineeringUseAuthorized: true,
    comparisonQualificationAvailable: true,
    suspensionReasons: [],
    limitations: [
      'WRC_TABLE5_EIGHT_POINTS_NOT_GLOBAL_ABSOLUTE_MAXIMUM',
      'UNITY_STRESS_CONCENTRATION_MULTIPLIERS_ONLY',
    ],
    globalEmp1CRouteAuthority: false,
    releaseQualified: false,
    runtimeEligibilityRequired: true,
    method: {
      identity: 'WRC537_2013_CYLINDRICAL_ORIGINAL_GAMMA5_TABLE5_ZERO_DP',
      edition: '2013',
      sourceDocumentSha256: 'source-sha',
      datasetHash: 'dataset-hash',
      qualificationRecordSha256: 'qualification-sha',
      qualificationRecordRole: 'POST_SOURCE_AUTHORITY_EXACT_HEAD_BOUNDED_REQUALIFICATION',
      loadProducerQualificationSha256: 'load-producer-sha',
    },
    scope: {
      shellFamily: 'CYLINDRICAL',
      attachmentShape: 'ROUND',
      variant: 'ORIGINAL',
      gamma: 5,
      betaMinimum: 0.05,
      betaMaximum: 0.5,
      differentialPressure: 0,
      canonicalLengthUnit: 'mm',
      Kn: 1,
      Kb: 1,
      applicabilitySourceAuthority: 'EMP1_WRC537_APPLICABILITY_SOURCE_AUTHORITY',
      applicabilitySourceAuthorityState: 'QUALIFIED_TYPED_GEOMETRY_SOURCE_BINDING_RUNTIME_REQUIRED',
      stressOutputDomain: 'HOST_CYLINDRICAL_SHELL_AT_ATTACHMENT_SHELL_JUNCTURE',
      evaluatedStressLocations: 'WRC_TABLE5_EIGHT_SHELL_JUNCTURE_POINTS',
      absoluteShellMaximumAssured: false,
      continuousJunctureSearchPerformed: false,
    },
    remainingBlocked: [
      'NONZERO_DIFFERENTIAL_PRESSURE',
      'GAMMA_OTHER_THAN_5',
      'GLOBAL_EMP1_C_ROUTE',
    ],
  };
}
