export const EMP1_METHOD_AUTHORITY_SCHEMA = 'emp1-method-authority/v1';

export const EMP1_METHOD_AUTHORITY_STATE = Object.freeze({
  AUTHORIZED_BOUNDED_ROUTE: 'AUTHORIZED_BOUNDED_ROUTE',
  QUALIFIED_METHOD_AUTHORITY: 'QUALIFIED_METHOD_AUTHORITY',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  BLOCKED: 'BLOCKED',
});

const PRODUCT_SCHEMA = 'emp1-product-projection/v1';
const AUTHORITY_BOUNDED = 'BOUNDED_ROUTE_ONLY';
const AUTHORITY_QUALIFIED_METHOD = 'QUALIFIED_METHOD_AUTHORITY';
const AUTHORITY_NONE = 'NOT_AUTHORIZED';

/**
 * Project existing EMP.1 method/route authority into a stable governance view.
 *
 * Authority is consumed from emp1-product-projection/v1. This module does not
 * import the WRC route registry, re-run applicability, or create method/source/
 * release authority.
 */
export function projectEmp1MethodAuthority(productProjection) {
  const projection = requireProjection(productProjection);
  const boundary = record(projection.qualificationBoundary)
    ? projection.qualificationBoundary
    : {};
  const c = cStep(projection.steps);
  const productionAuthority = boundary.emp1CProductionAuthority ?? null;
  const authorityState = classifyProductionAuthority(productionAuthority);
  const routes = routeSnapshots(c, boundary);

  return deepFreeze({
    schema: EMP1_METHOD_AUTHORITY_SCHEMA,
    productId: projection.product?.productId ?? 'EMP.1',
    state: authorityState.state,
    productionAuthority,
    globalEmp1CRouteAuthority: boundary.globalEmp1CRouteAuthority === true,
    technicalQualificationReady: boundary.emp1CTechnicalQualificationReady === true,
    runAuthorized: boundary.emp1CRunAuthorized === true,
    workspaceExecutionWired: boundary.emp1CWorkspaceExecutionWired === true,
    routeEvidenceState: routes.length > 0 ? 'EMBEDDED_IN_PRODUCT_PROJECTION' : 'NOT_EMBEDDED',
    routes,
    blockers: authorityState.blockers,
    authorityBoundary: {
      projectionOnly: true,
      sourceOfAuthority: 'EMP1_PRODUCT_PROJECTION_QUALIFICATION_BOUNDARY',
      createsEngineeringAuthority: false,
      createsMethodAuthority: false,
      createsSourceAuthority: false,
      createsApplicabilityAuthority: false,
      createsRouteAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
    },
  });
}

function classifyProductionAuthority(value) {
  if (value === AUTHORITY_BOUNDED) {
    return stateResult(EMP1_METHOD_AUTHORITY_STATE.AUTHORIZED_BOUNDED_ROUTE);
  }
  if (value === AUTHORITY_QUALIFIED_METHOD) {
    return stateResult(EMP1_METHOD_AUTHORITY_STATE.QUALIFIED_METHOD_AUTHORITY);
  }
  if (value === AUTHORITY_NONE) {
    return stateResult(EMP1_METHOD_AUTHORITY_STATE.NOT_AUTHORIZED);
  }
  return stateResult(
    EMP1_METHOD_AUTHORITY_STATE.BLOCKED,
    [`EMP1_METHOD_AUTHORITY_PRODUCTION_AUTHORITY_UNSUPPORTED:${String(value)}`],
  );
}

function stateResult(state, blockers = []) {
  return Object.freeze({
    state,
    blockers: unique(blockers),
  });
}

function routeSnapshots(c, boundary) {
  const routes = Array.isArray(c?.boundedProductionRoutes)
    ? c.boundedProductionRoutes
    : Array.isArray(boundary.emp1CBoundedProductionRoutes)
      ? boundary.emp1CBoundedProductionRoutes
      : [];
  return Object.freeze(routes.map((route, index) => routeSnapshot(route, index)));
}

function routeSnapshot(route, index) {
  if (!record(route) || typeof route.routeId !== 'string' || route.routeId.length === 0) {
    throw methodAuthorityError(`EMP1_METHOD_AUTHORITY_ROUTE_INVALID:${index}`);
  }
  return deepFreeze({
    schema: route.schema ?? null,
    routeId: route.routeId,
    registered: route.registered === true,
    engineeringUseAuthorized: route.engineeringUseAuthorized === true,
    comparisonQualificationAvailable: route.comparisonQualificationAvailable === true,
    globalEmp1CRouteAuthority: route.globalEmp1CRouteAuthority === true,
    runtimeEligibilityRequired: route.runtimeEligibilityRequired === true,
    releaseQualified: route.releaseQualified === true,
    method: snapshot(route.method),
    scope: snapshot(route.scope),
    suspensionReasons: stringArray(route.suspensionReasons),
    limitations: stringArray(route.limitations),
    remainingBlocked: stringArray(route.remainingBlocked),
    authorityEstablishedByProjection: false,
  });
}

function cStep(steps) {
  if (!Array.isArray(steps)) return null;
  return steps.find((step) => step?.shortId === 'C') ?? null;
}

function requireProjection(value) {
  if (!record(value) || value.schema !== PRODUCT_SCHEMA) {
    throw methodAuthorityError('EMP1_METHOD_AUTHORITY_PRODUCT_PROJECTION_INVALID');
  }
  if (!Array.isArray(value.steps)) {
    throw methodAuthorityError('EMP1_METHOD_AUTHORITY_STEPS_REQUIRED');
  }
  return value;
}

function snapshot(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(snapshot));
  if (!record(value)) return value ?? null;
  return deepFreeze(Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, snapshot(nested)]),
  ));
}

function stringArray(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.map(String));
}

function unique(values) {
  return Object.freeze([...new Set(values.map(String))]);
}

function record(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function methodAuthorityError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
