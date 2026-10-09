import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { deepFreeze } from '../../core/shared-piping-model/immutable.js';
import {
  NON_FEA_COMPONENT_COG_FALLBACK,
  optionalNonFeaComponentCogFallbackPolicy,
  requireNonFeaComponentCogFallbackPolicy,
} from '../project-data/non-fea-component-cog-fallback-policy.js';
import {
  NON_FEA_GRAVITY_METHOD_AUTO,
  requireReadyNonFeaGravityMethodAuthority,
} from '../project-data/non-fea-gravity-method-authority.js';
import { projectDataValue } from '../project-data/project-data-contract.js';
import {
  EMPIRICAL_COMPONENT_COG_CLASSIFICATION,
  auditEmpiricalComponentLoadAuthority,
  requireEmpiricalComponentLoadAuthorityAudit,
} from './empirical-component-load-authority.js';
import {
  requireCurrentCommonInputExplicitMomentRetention,
} from './current-common-input-explicit-moment-retention.js';
import {
  assertZeroMassWaiversAdmissible,
  createNonFeaZeroMassWaiverSet,
  zeroMassWaiverSetFromProfile,
} from './non-fea-zero-mass-waiver.js';
import { getEmpiricalMethodRegistration } from './empirical-method-registry.js';
import {
  EMPIRICAL_LOAD_COG_METHOD,
  EMPIRICAL_LOAD_METHOD,
} from './support-load-distribution-v3.js';

export const EMPIRICAL_GRAVITY_AUTO = NON_FEA_GRAVITY_METHOD_AUTO;
export const EMPIRICAL_GRAVITY_METHOD_SELECTION_SCHEMA =
  'empirical-gravity-method-selection/v1';
export const EMPIRICAL_GOVERNED_GRAVITY_METHOD_SELECTION_SCHEMA =
  'empirical-governed-gravity-method-selection/v1';

const BEAM_CONTACT = 'EMPIRICAL_BEAM_CONTACT_V1';
const EXPLICIT_MOMENT_UNSUPPORTED = 'EMPIRICAL_COMPONENT_EXPLICIT_MOMENT_UNSUPPORTED';
const ALLOWED_REQUESTS = Object.freeze([
  EMPIRICAL_GRAVITY_AUTO,
  EMPIRICAL_LOAD_COG_METHOD,
  EMPIRICAL_LOAD_METHOD,
]);

export function evaluateEmpiricalGravityMethodSelection(input = {}) {
  const requestedMethod = methodRequest(input.requestedMethod ?? EMPIRICAL_GRAVITY_AUTO);
  const componentCogFallbackPolicy = requireProfileComponentCogFallback(input.profile);
  const componentAuthorityAudit = auditEmpiricalComponentLoadAuthority({
    dataset: input.dataset,
    profile: input.profile,
    routePartitionModel: input.routePartitionModel,
  });
  return createEmpiricalGravityMethodSelection({
    requestedMethod,
    componentCogFallbackPolicy,
    componentAuthorityAudit,
    explicitMomentRetention: input.explicitMomentRetention || null,
    zeroMassWaiverSet: zeroMassWaiverSetFromProfile(input.profile),
  });
}

/**
 * Evaluates the existing selector from a hash-bound effective Project Data
 * method request. A source explicit moment becomes eligible for V2 only when a
 * separate current-system retention receipt bound to the exact component audit
 * is supplied. Callers without that receipt preserve the historical fail-closed
 * behavior.
 */
export function evaluateGovernedEmpiricalGravityMethodSelection(input = {}) {
  const componentCogFallbackPolicy = requireProfileComponentCogFallback(input.profile);
  const componentAuthorityAudit = auditEmpiricalComponentLoadAuthority({
    dataset: input.dataset,
    profile: input.profile,
    routePartitionModel: input.routePartitionModel,
  });
  return createGovernedEmpiricalGravityMethodSelection({
    gravityMethodAuthority: input.gravityMethodAuthority,
    componentCogFallbackPolicy,
    componentAuthorityAudit,
    explicitMomentRetention: input.explicitMomentRetention || null,
    zeroMassWaiverSet: zeroMassWaiverSetFromProfile(input.profile),
  });
}

export function createGovernedEmpiricalGravityMethodSelection(input = {}) {
  const authority = requireReadyNonFeaGravityMethodAuthority(input.gravityMethodAuthority);
  const audit = requireEmpiricalComponentLoadAuthorityAudit(input.componentAuthorityAudit);
  const componentCogFallbackPolicy = optionalNonFeaComponentCogFallbackPolicy(
    input.componentCogFallbackPolicy,
  );
  if (audit.projectDataProfileSemanticHash !== authority.projectDataSemanticHash) {
    throw codedError(
      'Gravity-method authority and component-load audit do not bind the same effective Project Data profile.',
      'EMPIRICAL_GRAVITY_METHOD_AUTHORITY_PROFILE_MISMATCH',
      {
        authorityProjectDataSemanticHash: authority.projectDataSemanticHash,
        auditProjectDataProfileSemanticHash: audit.projectDataProfileSemanticHash,
      },
    );
  }
  const selection = createEmpiricalGravityMethodSelection({
    requestedMethod: authority.requestedMethod,
    componentCogFallbackPolicy,
    componentAuthorityAudit: audit,
    explicitMomentRetention: input.explicitMomentRetention || null,
    zeroMassWaiverSet: input.zeroMassWaiverSet || null,
  });
  const base = {
    schema: EMPIRICAL_GOVERNED_GRAVITY_METHOD_SELECTION_SCHEMA,
    gravityMethodAuthority: authority,
    componentCogFallbackPolicy,
    componentAuthorityAuditProjectDataProfileSemanticHash:
      audit.projectDataProfileSemanticHash,
    selection,
  };
  return deepFreeze({ ...base, semanticHash: semanticHash(base) });
}

export function createEmpiricalGravityMethodSelection(input = {}) {
  const requestedMethod = methodRequest(input.requestedMethod ?? EMPIRICAL_GRAVITY_AUTO);
  const componentCogFallbackPolicy = optionalNonFeaComponentCogFallbackPolicy(
    input.componentCogFallbackPolicy,
  );
  const audit = requireEmpiricalComponentLoadAuthorityAudit(input.componentAuthorityAudit);
  const retention = optionalExplicitMomentRetention(input.explicitMomentRetention, audit);
  const waiverSet = optionalZeroMassWaiverSet(input.zeroMassWaiverSet, audit);
  const classification = classifyAudit(audit, retention, componentCogFallbackPolicy, waiverSet);
  const explicit = requestedMethod !== EMPIRICAL_GRAVITY_AUTO;
  const choice = explicit
    ? explicitChoice(requestedMethod, classification)
    : autoChoice(classification);
  const candidates = candidateRows(classification, choice.selectedMethod);
  const fallbackLedger = fallbackRows(requestedMethod, classification, choice, retention);
  const base = {
    schema: EMPIRICAL_GRAVITY_METHOD_SELECTION_SCHEMA,
    requestedMethod,
    selectedMethod: choice.selectedMethod,
    selectionState: choice.selectionState,
    componentCogFallbackPolicy,
    componentAuthorityAuditSemanticHash: audit.semanticHash,
    explicitMomentRetentionSemanticHash: retention?.semanticHash || null,
    zeroMassWaiverSemanticHash: waiverSet.semanticHash,
    zeroMassWaivedEntityIds: waiverSet.waivedEntityIds,
    candidates,
    fallbackLedger,
    assumptions: choice.assumptions,
    exceptions: classification.exceptions,
    retainedDemandLedger: classification.retainedDemands,
    policy: {
      highestFidelityQualifiedMethodFirst: true,
      componentCogFallback: componentCogFallbackPolicy,
      missingCogMayFallbackToV2:
        componentCogFallbackPolicy === NON_FEA_COMPONENT_COG_FALLBACK.GEOMETRIC_MIDPOINT,
      knownOffRouteCogMayFallbackToV2: false,
      ambiguousCogMayFallbackToV2: false,
      invalidCogEvidenceMayFallbackToV2: false,
      explicitMomentMayFallbackToV2: true,
      explicitMomentFallbackRequiresRetentionReceipt: true,
      explicitMomentVerticalReactionDistributionAllowed: false,
      beamContactIsSeparateMechanicsFamily: true,
      selectionIsNotExecutionAuthorization: true,
    },
  };
  return deepFreeze({ ...base, semanticHash: semanticHash(base) });
}

export function requireEmpiricalGravityMethodSelection(value) {
  if (!value || value.schema !== EMPIRICAL_GRAVITY_METHOD_SELECTION_SCHEMA) {
    throw new TypeError(`Expected ${EMPIRICAL_GRAVITY_METHOD_SELECTION_SCHEMA}.`);
  }
  const { semanticHash: supplied, ...base } = value;
  if (supplied !== semanticHash(base)) {
    throw new TypeError('Empirical gravity method-selection semantic hash mismatch.');
  }
  methodRequest(value.requestedMethod);
  if (value.selectedMethod !== null) methodRequest(value.selectedMethod);
  optionalNonFeaComponentCogFallbackPolicy(value.componentCogFallbackPolicy);
  return deepFreeze(structuredClone(value));
}

export function requireGovernedEmpiricalGravityMethodSelection(value) {
  if (!value || value.schema !== EMPIRICAL_GOVERNED_GRAVITY_METHOD_SELECTION_SCHEMA) {
    throw new TypeError(`Expected ${EMPIRICAL_GOVERNED_GRAVITY_METHOD_SELECTION_SCHEMA}.`);
  }
  const { semanticHash: supplied, ...base } = value;
  if (supplied !== semanticHash(base)) {
    throw new TypeError('Governed empirical gravity method-selection semantic hash mismatch.');
  }
  const authority = requireReadyNonFeaGravityMethodAuthority(value.gravityMethodAuthority);
  const selection = requireEmpiricalGravityMethodSelection(value.selection);
  optionalNonFeaComponentCogFallbackPolicy(value.componentCogFallbackPolicy);
  if (selection.requestedMethod !== authority.requestedMethod) {
    throw codedError(
      'Governed selector request differs from gravity-method authority.',
      'EMPIRICAL_GRAVITY_METHOD_AUTHORITY_REQUEST_MISMATCH',
    );
  }
  if (selection.componentCogFallbackPolicy !== value.componentCogFallbackPolicy) {
    throw codedError(
      'Governed selector CoG fallback policy differs from the governed package binding.',
      'EMPIRICAL_GRAVITY_COMPONENT_COG_FALLBACK_POLICY_MISMATCH',
    );
  }
  if (
    value.componentAuthorityAuditProjectDataProfileSemanticHash
    !== authority.projectDataSemanticHash
  ) {
    throw codedError(
      'Governed selector audit profile differs from gravity-method authority.',
      'EMPIRICAL_GRAVITY_METHOD_AUTHORITY_PROFILE_MISMATCH',
      {
        authorityProjectDataSemanticHash: authority.projectDataSemanticHash,
        auditProjectDataProfileSemanticHash:
          value.componentAuthorityAuditProjectDataProfileSemanticHash,
      },
    );
  }
  return deepFreeze(structuredClone(value));
}

function requireProfileComponentCogFallback(profile) {
  return requireNonFeaComponentCogFallbackPolicy(
    projectDataValue(profile, 'loadCalculation.componentCogFallback'),
  );
}

/**
 * Binds the waiver set to the exact audit it was admitted against.
 *
 * Admissibility is checked here, not only where a reviewer sets a waiver: the
 * audit is what knows whether a component carries a source explicit moment, and
 * a waiver that would drop a real demand must fail closed at selection rather
 * than quietly lighten the model.
 */
function optionalZeroMassWaiverSet(value, audit) {
  const waiverSet = value === null || value === undefined
    ? createNonFeaZeroMassWaiverSet({ waivers: [] })
    : value;
  const rejected = assertZeroMassWaiversAdmissible(waiverSet, audit.records || []);
  if (rejected.length > 0) {
    throw codedError(
      'A zero-mass waiver is not admissible against the current component-load authority audit.',
      'EMPIRICAL_GRAVITY_ZERO_MASS_WAIVER_INADMISSIBLE',
      { rejected },
    );
  }
  return waiverSet;
}

function optionalExplicitMomentRetention(value, audit) {
  if (value === null || value === undefined) return null;
  const retention = requireCurrentCommonInputExplicitMomentRetention(value);
  if (retention.componentLoadAuthorityAuditSemanticHash !== audit.semanticHash) {
    throw codedError(
      'Explicit-moment retention and method selector do not bind the same component-load authority audit.',
      'EMPIRICAL_GRAVITY_EXPLICIT_MOMENT_RETENTION_AUDIT_MISMATCH',
      {
        expected: audit.semanticHash,
        actual: retention.componentLoadAuthorityAuditSemanticHash,
      },
    );
  }
  return retention;
}

function classifyAudit(audit, retention, componentCogFallbackPolicy, waiverSet) {
  const auditedRecords = audit.records || [];
  const waivedIds = new Set(waiverSet?.waivedEntityIds || []);
  // A waived component is massless, so it is not in the load path at all: it
  // cannot be missing a CoG worth resolving, and it cannot block a method it
  // contributes nothing to. Excluding it here is what keeps one waived gauge
  // from demoting the whole model to the V2 fallback.
  const records = waivedIds.size === 0
    ? auditedRecords
    : auditedRecords.filter((row) => !waivedIds.has(row.entityId));
  const retainedIds = new Set(
    retention?.status === 'RETAINED'
      ? retention.records.map((row) => row.entityId)
      : [],
  );
  const missingCog = records.filter((row) => (
    row.cogClassification === EMPIRICAL_COMPONENT_COG_CLASSIFICATION.MIDPOINT_FALLBACK
  ));
  const onRouteCog = records.filter((row) => (
    row.cogClassification === EMPIRICAL_COMPONENT_COG_CLASSIFICATION.ON_ROUTE
  ));
  const retainedExplicit = records.filter((row) => hasRetainedExplicitMoment(row, retainedIds));
  const hard = records.filter((row) => hasFallbackProhibitingEvidence(row, retainedIds));
  const otherBlocked = records.filter((row) => (
    row.integrationEligible !== true
    && !hard.includes(row)
    && unhandledBlockers(row, retainedIds).length > 0
  ));
  const exceptions = [...hard, ...otherBlocked].map((row) => deepFreeze({
    entityId: row.entityId,
    routeId: row.routeId,
    cogClassification: row.cogClassification,
    blockerCodes: unhandledBlockers(row, retainedIds).map((item) => item.code).sort(),
    explicitMomentNm: row.explicitMoment?.magnitudeNm ?? null,
    disposition: row.integrationDisposition,
  })).sort(byEntity);
  const retainedDemands = retainedExplicit.map((row) => deepFreeze({
    entityId: row.entityId,
    routeId: row.routeId,
    demandKind: 'SOURCE_EXPLICIT_POINT_MOMENT',
    explicitMomentNm: row.explicitMoment.magnitudeNm,
    axis: row.explicitMoment.axis,
    disposition: 'RETAINED_SEPARATE_SUPPORT_CIVIL_DEMAND',
    verticalReactionDistribution: 'NOT_PERFORMED',
  })).sort(byEntity);
  const blockingExceptionIds = [...new Set(
    [...hard, ...otherBlocked].map((row) => row.entityId),
  )].sort();
  return deepFreeze({
    componentCogFallbackPolicy,
    componentCount: records.length,
    missingCogCount: missingCog.length,
    onRouteCogCount: onRouteCog.length,
    retainedExplicitMomentCount: retainedExplicit.length,
    hardExceptionCount: hard.length,
    otherBlockedCount: otherBlocked.length,
    missingCogIds: missingCog.map((row) => row.entityId).sort(),
    retainedExplicitMomentIds: retainedExplicit.map((row) => row.entityId).sort(),
    hardExceptionIds: hard.map((row) => row.entityId).sort(),
    blockingExceptionIds,
    exceptions,
    retainedDemands,
  });
}

function autoChoice(state) {
  if (state.hardExceptionCount > 0 || state.otherBlockedCount > 0) {
    return deepFreeze({
      selectedMethod: null,
      selectionState: 'EXCEPTION_POLICY_REQUIRED',
      assumptions: [],
    });
  }
  if (state.componentCount === 0) {
    return deepFreeze({
      selectedMethod: EMPIRICAL_LOAD_METHOD,
      selectionState: 'SELECTED_V2_NO_COG_FIDELITY_GAIN',
      assumptions: [],
    });
  }
  if (
    state.missingCogCount > 0
    && state.componentCogFallbackPolicy !== NON_FEA_COMPONENT_COG_FALLBACK.GEOMETRIC_MIDPOINT
  ) {
    return deepFreeze({
      selectedMethod: null,
      selectionState: state.componentCogFallbackPolicy === NON_FEA_COMPONENT_COG_FALLBACK.DISABLED
        ? 'COG_FALLBACK_DISABLED_BY_POLICY'
        : 'COG_FALLBACK_POLICY_REQUIRED',
      assumptions: [],
    });
  }
  if (state.retainedExplicitMomentCount > 0) {
    return deepFreeze({
      selectedMethod: EMPIRICAL_LOAD_METHOD,
      selectionState: 'SELECTED_V2_EXPLICIT_MOMENT_RETAINED_SEPARATELY',
      assumptions: midpointAssumptions(state.missingCogIds),
    });
  }
  if (state.missingCogCount > 0) {
    return deepFreeze({
      selectedMethod: EMPIRICAL_LOAD_METHOD,
      selectionState: 'SELECTED_V2_MISSING_COG_FALLBACK',
      assumptions: midpointAssumptions(state.missingCogIds),
    });
  }
  return deepFreeze({
    selectedMethod: EMPIRICAL_LOAD_COG_METHOD,
    selectionState: 'SELECTED_V3_COG',
    assumptions: [],
  });
}

function explicitChoice(requestedMethod, state) {
  if (requestedMethod === EMPIRICAL_LOAD_COG_METHOD) {
    if (state.hardExceptionCount > 0 || state.otherBlockedCount > 0) {
      return deepFreeze({ selectedMethod: null, selectionState: 'EXPLICIT_V3_OUTSIDE_QUALIFIED_INPUT_DOMAIN', assumptions: [] });
    }
    if (state.retainedExplicitMomentCount > 0) {
      return deepFreeze({ selectedMethod: null, selectionState: 'EXPLICIT_V3_SOURCE_MOMENT_REQUIRES_SEPARATE_V2_DEMAND', assumptions: [] });
    }
    if (state.missingCogCount > 0) {
      return deepFreeze({ selectedMethod: null, selectionState: 'EXPLICIT_V3_COG_INPUT_INCOMPLETE', assumptions: [] });
    }
    return deepFreeze({ selectedMethod: requestedMethod, selectionState: 'EXPLICIT_V3_SELECTED', assumptions: [] });
  }
  if (state.hardExceptionCount > 0 || state.otherBlockedCount > 0) {
    return deepFreeze({ selectedMethod: null, selectionState: 'EXPLICIT_V2_FALLBACK_PROHIBITED_BY_KNOWN_EVIDENCE', assumptions: [] });
  }
  return deepFreeze({
    selectedMethod: requestedMethod,
    selectionState: state.retainedExplicitMomentCount > 0
      ? 'EXPLICIT_V2_SELECTED_WITH_SEPARATE_MOMENT_DEMAND'
      : 'EXPLICIT_V2_SELECTED',
    assumptions: midpointAssumptions(state.missingCogIds, true),
  });
}

function candidateRows(state, selectedMethod) {
  const v3State = state.hardExceptionCount || state.otherBlockedCount
    ? 'OUTSIDE_QUALIFIED_INPUT_DOMAIN'
    : state.retainedExplicitMomentCount > 0
      ? 'EXPLICIT_MOMENT_REQUIRES_SEPARATE_V2_DEMAND'
      : state.missingCogCount ? 'INPUT_INCOMPLETE' : 'READY';
  const v2State = state.hardExceptionCount || state.otherBlockedCount
    ? 'FALLBACK_PROHIBITED_BY_KNOWN_EVIDENCE'
    : state.missingCogCount > 0
      && state.componentCogFallbackPolicy !== NON_FEA_COMPONENT_COG_FALLBACK.GEOMETRIC_MIDPOINT
      ? (state.componentCogFallbackPolicy === NON_FEA_COMPONENT_COG_FALLBACK.DISABLED
        ? 'FALLBACK_DISABLED_BY_POLICY'
        : 'FALLBACK_POLICY_REQUIRED')
      : 'READY';
  return deepFreeze([
    candidate(EMPIRICAL_LOAD_COG_METHOD, v3State, selectedMethod),
    candidate(EMPIRICAL_LOAD_METHOD, v2State, selectedMethod),
    deepFreeze({
      methodId: BEAM_CONTACT,
      registration: registration(BEAM_CONTACT),
      applicability: 'SEPARATE_RESTRICTED_MECHANICS_FAMILY',
      inputState: 'NOT_EVALUATED_BY_CHAINAGE_SELECTOR',
      selected: false,
      reason: 'Beam/contact requires independent planarity, component-type, boundary and restraint-capability qualification.',
    }),
  ]);
}

function fallbackRows(requestedMethod, state, choice, retention) {
  if (requestedMethod !== EMPIRICAL_GRAVITY_AUTO) return deepFreeze([]);
  if (choice.selectedMethod === EMPIRICAL_LOAD_METHOD) {
    const rows = [];
    if (state.retainedExplicitMomentCount > 0) {
      rows.push({
        fromMethod: EMPIRICAL_LOAD_COG_METHOD,
        toMethod: EMPIRICAL_LOAD_METHOD,
        reasonCode: 'EXPLICIT_COMPONENT_MOMENT_RETAINED_SEPARATELY',
        affectedEntityIds: state.retainedExplicitMomentIds,
        permittedByPolicy: true,
        retentionSemanticHash: retention?.semanticHash || null,
      });
    }
    if (state.missingCogCount > 0) {
      rows.push({
        fromMethod: EMPIRICAL_LOAD_COG_METHOD,
        toMethod: EMPIRICAL_LOAD_METHOD,
        reasonCode: 'COG_NOT_AVAILABLE',
        affectedEntityIds: state.missingCogIds,
        permittedByPolicy: true,
        componentCogFallbackPolicy: state.componentCogFallbackPolicy,
      });
    }
    return deepFreeze(rows);
  }
  if (choice.selectedMethod === null) {
    if (
      state.hardExceptionCount === 0
      && state.otherBlockedCount === 0
      && state.missingCogCount > 0
    ) {
      return deepFreeze([{
        fromMethod: EMPIRICAL_LOAD_COG_METHOD,
        toMethod: EMPIRICAL_LOAD_METHOD,
        reasonCode: state.componentCogFallbackPolicy === NON_FEA_COMPONENT_COG_FALLBACK.DISABLED
          ? 'COG_FALLBACK_DISABLED_BY_POLICY'
          : 'COG_FALLBACK_POLICY_REQUIRED',
        affectedEntityIds: state.missingCogIds,
        permittedByPolicy: false,
        componentCogFallbackPolicy: state.componentCogFallbackPolicy,
      }]);
    }
    return deepFreeze([{
      fromMethod: EMPIRICAL_LOAD_COG_METHOD,
      toMethod: EMPIRICAL_LOAD_METHOD,
      reasonCode: 'KNOWN_ECCENTRICITY_OR_UNQUALIFIED_COMPONENT_EVIDENCE',
      affectedEntityIds: state.blockingExceptionIds,
      permittedByPolicy: false,
    }]);
  }
  return deepFreeze([]);
}

function midpointAssumptions(entityIds, explicitV2 = false) {
  return entityIds.map((entityId) => deepFreeze({
    entityId,
    code: 'GEOMETRIC_MIDPOINT_APPLICATION',
    reason: explicitV2
      ? 'Explicit V2 uses the qualified midpoint application rule.'
      : 'No qualified component CoG evidence is available and the governed fallback policy permits the geometric midpoint.',
  }));
}

function candidate(methodId, inputState, selectedMethod) {
  return deepFreeze({
    methodId,
    registration: registration(methodId),
    applicability: 'VERTICAL_CHAINAGE_DISTRIBUTION',
    inputState,
    selected: selectedMethod === methodId,
  });
}

function registration(methodId) {
  const row = getEmpiricalMethodRegistration(methodId);
  return row ? deepFreeze(structuredClone(row)) : null;
}

function hasRetainedExplicitMoment(row, retainedIds) {
  return (row.explicitMoment?.magnitudeNm ?? 0) > 0 && retainedIds.has(row.entityId);
}

function unhandledBlockers(row, retainedIds) {
  const explicitRetained = hasRetainedExplicitMoment(row, retainedIds);
  return (row.blockers || []).filter((blocker) => !(
    explicitRetained && blocker.code === EXPLICIT_MOMENT_UNSUPPORTED
  ));
}

function hasFallbackProhibitingEvidence(row, retainedIds) {
  if ((row.explicitMoment?.magnitudeNm ?? 0) > 0
      && !hasRetainedExplicitMoment(row, retainedIds)) return true;
  return [
    EMPIRICAL_COMPONENT_COG_CLASSIFICATION.OFF_ROUTE,
    EMPIRICAL_COMPONENT_COG_CLASSIFICATION.AMBIGUOUS,
    EMPIRICAL_COMPONENT_COG_CLASSIFICATION.INVALID,
  ].includes(row.cogClassification);
}

function methodRequest(value) {
  const method = String(value || '').trim();
  if (!ALLOWED_REQUESTS.includes(method)) {
    throw new RangeError(`Unsupported empirical gravity method request: ${method || 'EMPTY'}.`);
  }
  return method;
}

function codedError(message, code, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function byEntity(left, right) {
  return `${left.entityId}|${left.routeId}`.localeCompare(`${right.entityId}|${right.routeId}`);
}
