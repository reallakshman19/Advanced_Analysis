import { semanticHash } from '../core/shared-primitives/canonical-json.js';
import {
  EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
  emp1CBoundedRoute,
} from '../core/emp1/emp1-c-bounded-route-registry.js';
import {
  EMP1_WRC537_GAMMA5_ZERO_DP_BENCHMARK_QUALIFICATION,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS,
} from '../core/emp1/emp1-wrc537-gamma5-zero-dp-route.js';
import { requireLafea1PressureRadiusRunAuthorized } from './lafea-1-pressure-radius-validation.js';
import currentSourceSemanticsGate from '../../validation/emp1/release/emp1-wrc537-gamma5-current-source-semantics-gate-v1.json' with { type: 'json' };

export const EMP1_WORKBENCH_ROUTE_AUTHORITY_SNAPSHOT_SCHEMA =
  'emp1-workbench-route-authority-snapshot/v2';
export const EMP1_WORKBENCH_RETAINED_C_EVIDENCE_SCHEMA =
  'emp1-workbench-retained-c-evidence/v1';

export {
  EMP1_WORKBENCH_ATTACHMENT_DIAMETER_BASIS,
  EMP1_WORKBENCH_ATTACHMENT_PHYSICAL_LOCATION,
  EMP1_WORKBENCH_ATTACHMENT_STATION_BASIS,
  EMP1_WORKBENCH_BOUNDED_ROUTE_REQUEST_SCHEMA,
  EMP1_WORKBENCH_CYLINDER_LENGTH_BASIS,
  EMP1_WORKBENCH_EXECUTION_CURRENTNESS,
  EMP1_WORKBENCH_PRODUCT_EXECUTION_SCHEMA,
  EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED,
  EMP1_WORKBENCH_RUN_INPUT_SCHEMA,
  classifyEmp1WorkbenchExecutionCurrentness,
  emp1WorkbenchRunInputHash,
  normalizeEmp1WorkbenchRunInput,
  projectEmp1WorkbenchRunReadiness,
  projectEmp1WorkbenchCState,
} from './emp1-workbench-run-state.js';

/**
 * Product-owned EMP.1 transaction entrypoint.
 *
 * Keep the live route-authority projection in this eager module because the UI
 * reads it synchronously. Load the heavy retained A/B engines and bounded-C
 * execution only when the async product transaction is actually requested.
 */
export async function executeEmp1WorkbenchProduct(options = {}) {
  // Reject a stale geometry/request-radius combination before loading or
  // invoking any heavy calculation engine. The preflight is read-only and
  // shares the qualified pressure solver's tolerance rule.
  requireLafea1PressureRadiusRunAuthorized(options.aDocument);
  const { executeEmp1WorkbenchProductTransaction } = await import(
    './emp1-workbench-product-execution.js'
  );
  return executeEmp1WorkbenchProductTransaction(
    options,
    currentEmp1WorkbenchRouteAuthority,
    EMP1_WORKBENCH_RETAINED_C_EVIDENCE_SCHEMA,
  );
}

/**
 * Return the live bounded-route authority and a deterministic semantic snapshot.
 * The snapshot intentionally contains no timestamp or UI text. It binds the
 * route module state, frozen oracle identity and retained registry
 * method/scope/qualification data that can change whether an otherwise
 * identical C result remains reportable.
 */
export function currentEmp1WorkbenchRouteAuthority() {
  const registry = emp1CBoundedRoute(EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID);
  const routeModuleAuthorized = EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED === true;
  const routeRegistryRegistered = registry?.registered === true;
  const routeRegistryEngineeringUseAuthorized = registry?.engineeringUseAuthorized === true;
  const productionUseAuthorized = routeModuleAuthorized
    && routeRegistryRegistered
    && routeRegistryEngineeringUseAuthorized;
  const reasons = uniqueSorted([
    ...EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS,
    ...(registry?.suspensionReasons ?? []),
    ...(!registry ? ['EMP1_C_BOUNDED_ROUTE_REGISTRY_ENTRY_REQUIRED'] : []),
    ...(registry && !routeRegistryRegistered ? ['EMP1_C_BOUNDED_ROUTE_NOT_REGISTERED'] : []),
    ...(registry && !routeRegistryEngineeringUseAuthorized
      ? ['EMP1_C_BOUNDED_ROUTE_ENGINEERING_USE_NOT_AUTHORIZED']
      : []),
    ...(!routeModuleAuthorized ? ['EMP1_C_BOUNDED_ROUTE_EXECUTOR_NOT_AUTHORIZED'] : []),
  ]);
  const semanticPayload = {
    schema: EMP1_WORKBENCH_ROUTE_AUTHORITY_SNAPSHOT_SCHEMA,
    routeId: EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
    productionUseAuthorized,
    routeModuleAuthorized,
    routeModuleSuspensionReasons: uniqueSorted(
      EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS,
    ),
    postAuthorityOracleSemanticHash:
      EMP1_WRC537_GAMMA5_ZERO_DP_BENCHMARK_QUALIFICATION.benchmarkHash,
    sourceSemantics: {
      gateSchema: currentSourceSemanticsGate.schema,
      gateSemanticHash: currentSourceSemanticsGate.semanticHash,
      profileSemanticHash: currentSourceSemanticsGate.profile.semanticHash,
      methodSourceSemanticsReady:
        currentSourceSemanticsGate.profile.methodSourceSemanticsReady === true,
      caseApplicabilityState: currentSourceSemanticsGate.caseApplicability.state,
      caseEngineeringUseAuthorizedBySourceGate:
        currentSourceSemanticsGate.authority.caseEngineeringUseAuthorizedByThisGate === true,
      releaseAuthorityGrantedBySourceGate:
        currentSourceSemanticsGate.authority.releaseAuthorityGranted === true,
    },
    registry: registry ? {
      schema: registry.schema ?? null,
      routeId: registry.routeId ?? null,
      registered: routeRegistryRegistered,
      engineeringUseAuthorized: routeRegistryEngineeringUseAuthorized,
      suspensionReasons: uniqueSorted(registry.suspensionReasons ?? []),
      method: structuredClone(registry.method ?? null),
      scope: structuredClone(registry.scope ?? null),
      limitations: [...(registry.limitations ?? [])],
      remainingBlocked: [...(registry.remainingBlocked ?? [])],
    } : null,
  };
  const snapshot = deepFreeze({
    ...semanticPayload,
    semanticHash: semanticHash(semanticPayload),
  });
  return deepFreeze({
    productionUseAuthorized,
    routeModuleAuthorized,
    routeRegistryRegistered,
    routeRegistryEngineeringUseAuthorized,
    reasons,
    routeAuthorityHash: snapshot.semanticHash,
    snapshot,
  });
}

function uniqueSorted(values) {
  return [...new Set((values ?? []).filter((value) => typeof value === 'string'))].sort();
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
