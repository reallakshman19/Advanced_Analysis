import {
  assertCanonicalStagedJsonText,
  assertCommonCheckerDependencyIntegrity,
  assertCommonInputMethodPartition,
} from '../core/non-fea-common-checker/integrity.js';
import {
  createNonFeaEnrichmentSidecar,
  resolveNonFeaEnrichment,
} from '../core/non-fea-enrichment/index.js';
import { deepFreeze, semanticHash } from '../core/shared-piping-model/index.js';
import { TopologyStore } from './topology-store.js';
import { SupportRestraintStore } from './support-restraint-store.js';
import { ModelLoadStore } from './model-load-store.js';
import { engineeringModelStore } from './engineering-model-store.js';
import { nonFeaEnrichmentStore } from './enrichment/non-fea-enrichment-store.js';
import { projectDataStore } from './project-data/project-data-store.js';
import { createConfiguredDefaultUsageLedger } from './project-data/non-fea-field-registry.js';
import {
  createConfiguredDefaultUsageRowsFromResolution,
  createNonFeaConfiguredDefaultProvider,
} from './project-data/non-fea-configured-default-provider.js';
import {
  createNonFeaEffectiveCommonInputProjection,
} from './project-data/non-fea-effective-common-input-projection.js';
import {
  createNonFeaProductDefaultProvider,
} from './project-data/non-fea-product-default-profile.js';
import { createLoadCalcInsulationDefaultProvider } from './load-calc-insulation-input.js';
import {
  assertRequestedLoadCasesAuthorized,
  createNonFeaLoadCaseAuthority,
} from './project-data/non-fea-load-case-authority.js';
import { WorkspaceState } from './workspace-state.js';
import { nonFeaCommonInputStore } from './non-fea-common-input-store.js';

export const NON_FEA_PRODUCT_SCREENING_SNAPSHOT_ACTOR =
  'Load Calc product screening snapshot (system)';
export const NON_FEA_PRODUCT_SCREENING_SNAPSHOT_STATEMENT =
  'System-generated READY-only screening snapshot; no user approval or partial-method acceptance is asserted.';

export function evaluateCurrentNonFeaCommonInput() {
  try {
    const input = buildCurrentPreFeaRequestInput();
    return nonFeaCommonInputStore.evaluate(input);
  } catch (error) {
    nonFeaCommonInputStore.setError(error);
    return nonFeaCommonInputStore.getSnapshot();
  }
}

export function sealCurrentNonFeaCommonInput(confirmation) {
  evaluateCurrentNonFeaCommonInput();
  if (nonFeaCommonInputStore.getSnapshot().error) {
    throw codedError(nonFeaCommonInputStore.getSnapshot().error, 'COMMON_INPUT_EVALUATION_FAILED');
  }
  const snapshot = nonFeaCommonInputStore.seal(confirmation);
  assertCommonInputMethodPartition(snapshot.commonInput);
  return snapshot;
}

/**
 * Creates the exact system provenance used for a READY-only routine screening
 * snapshot. This is not a human approval and cannot acknowledge partial or
 * blocked methods.
 */
export function createNonFeaReadyProductScreeningConfirmation(report, capturedAt) {
  const readyMethodIds = Array.isArray(report?.readyMethodIds) ? report.readyMethodIds : [];
  const blockedMethodIds = Array.isArray(report?.blockedMethodIds) ? report.blockedMethodIds : [];
  if (report?.packageState !== 'READY' || readyMethodIds.length === 0 || blockedMethodIds.length !== 0) {
    const error = codedError(
      'A product screening snapshot requires a fully READY Common Input checker report.',
      'COMMON_INPUT_PRODUCT_SCREENING_SNAPSHOT_NOT_READY',
    );
    error.details = deepFreeze({
      packageState: report?.packageState || null,
      readyMethodIds: [...readyMethodIds],
      blockedMethodIds: [...blockedMethodIds],
      blockers: structuredClone(report?.blockers || []),
    });
    throw error;
  }
  if (typeof report.semanticHash !== 'string' || report.semanticHash.length === 0) {
    throw codedError(
      'READY screening snapshot requires the checker report semantic hash.',
      'COMMON_INPUT_PRODUCT_SCREENING_SNAPSHOT_REPORT_HASH_REQUIRED',
    );
  }
  const parsedCapturedAt = typeof capturedAt === 'string' ? new Date(capturedAt) : null;
  if (typeof capturedAt !== 'string'
      || capturedAt.trim() !== capturedAt
      || !Number.isFinite(parsedCapturedAt?.getTime())
      || parsedCapturedAt.toISOString() !== capturedAt) {
    throw codedError(
      'READY screening snapshot timestamp must be canonical ISO-8601.',
      'COMMON_INPUT_PRODUCT_SCREENING_SNAPSHOT_TIMESTAMP_INVALID',
    );
  }
  return deepFreeze({
    confirmationId: `PRODUCT-SCREENING:${report.semanticHash}`,
    confirmedAt: capturedAt,
    confirmedBy: NON_FEA_PRODUCT_SCREENING_SNAPSHOT_ACTOR,
    acceptPartial: false,
    acknowledgedBlockedMethods: [],
    statement: NON_FEA_PRODUCT_SCREENING_SNAPSHOT_STATEMENT,
  });
}

/**
 * Returns true only when an existing seal itself satisfies the READY-only
 * screening contract. A current PARTIALLY_READY seal may be valid for the
 * explicit human partial-acceptance workflow, but it is never reusable as a
 * routine product screening snapshot.
 */
export function isCurrentReadyNonFeaCalculationSnapshot(snapshot) {
  const commonInput = snapshot?.commonInput;
  return Boolean(
    commonInput
    && snapshot?.staleness?.stale === false
    && !snapshot?.error
    && commonInput.packageState === 'READY'
    && Array.isArray(commonInput.sealedMethodIds)
    && commonInput.sealedMethodIds.length > 0
    && Array.isArray(commonInput.blockedMethodIds)
    && commonInput.blockedMethodIds.length === 0
  );
}

/**
 * Creates the current routine screening snapshot without pretending that a user
 * approved it. Only a fully READY checker report is eligible. PARTIALLY_READY
 * still requires the explicit human acceptance path in sealCurrentNonFeaCommonInput().
 * An already-current fully READY sealed Common Input is reused rather than resealed.
 */
export function sealCurrentReadyNonFeaCalculationSnapshot({ capturedAt = new Date().toISOString() } = {}) {
  const before = nonFeaCommonInputStore.getSnapshot();
  if (isCurrentReadyNonFeaCalculationSnapshot(before)) {
    assertCommonInputMethodPartition(before.commonInput);
    return before;
  }

  const evaluated = evaluateCurrentNonFeaCommonInput();
  if (evaluated.error) {
    throw codedError(evaluated.error, 'COMMON_INPUT_EVALUATION_FAILED');
  }
  const confirmation = createNonFeaReadyProductScreeningConfirmation(
    evaluated.report,
    capturedAt,
  );
  const snapshot = nonFeaCommonInputStore.seal(confirmation);
  assertCommonInputMethodPartition(snapshot.commonInput);
  return snapshot;
}

export function exportCurrentNonFeaCommonInput() {
  const commonInput = nonFeaCommonInputStore.requireCurrentCommonInput();
  assertCommonInputMethodPartition(commonInput);
  return nonFeaCommonInputStore.exportCurrent();
}

export function reimportNonFeaCommonInput(text) {
  assertCanonicalStagedJsonText(text);
  const snapshot = nonFeaCommonInputStore.reimport(text);
  assertCommonInputMethodPartition(snapshot.commonInput);
  return snapshot;
}

export function requireCurrentNonFeaMethods(methodIds) {
  const snapshot = evaluateCurrentNonFeaCommonInput();
  if (snapshot.error) throw codedError(snapshot.error, 'COMMON_INPUT_EVALUATION_FAILED');
  const commonInput = nonFeaCommonInputStore.requireReadyMethods(methodIds);
  assertCommonInputMethodPartition(commonInput);
  return commonInput;
}

export function buildCurrentPreFeaRequestInput() {
  const workspace = WorkspaceState.getSnapshot();
  const dataset = workspace?.status === 'ready' ? workspace.dataset : null;
  if (!dataset?.sharedModel) throw codedError('An active shared piping model is required.', 'COMMON_INPUT_SOURCE_MODEL_REQUIRED');
  if (typeof dataset.sourceSha256 !== 'string') throw codedError('Active dataset SHA-256 is required.', 'COMMON_INPUT_SOURCE_HASH_REQUIRED');

  const configuration = nonFeaCommonInputStore.getSnapshot().configuration;
  const productDefaultProvider = currentProductDefaultProvider();
  const projectDataProfile = productDefaultProvider.effectiveProfile;
  const loadCaseAuthority = createNonFeaLoadCaseAuthority(projectDataProfile);
  if (loadCaseAuthority.state === 'READY') {
    assertRequestedLoadCasesAuthorized(loadCaseAuthority, configuration.requestedLoadCases);
  }

  nonFeaEnrichmentStore.loadSource(dataset.sharedModel.semanticHash);
  const enrichment = nonFeaEnrichmentStore.getSnapshot();
  if (enrichment.migrationReport?.blockers?.length) {
    throw codedError('Legacy migration decisions are unresolved.', 'COMMON_INPUT_MIGRATION_BLOCKED');
  }
  if (enrichment.stale) throw codedError('Accepted enrichment records are stale.', 'COMMON_INPUT_ENRICHMENT_STALE');

  const acceptedEnrichmentSidecar = createNonFeaEnrichmentSidecar({
    sourceSemanticHash: dataset.sharedModel.semanticHash,
    records: enrichment.acceptedRecords,
  });
  const configuredDefaultProvider = createNonFeaConfiguredDefaultProvider({
    profile: projectDataProfile,
    sourceModel: dataset.sharedModel,
    requestedMethods: configuration.requestedMethods,
  });
  if (configuredDefaultProvider.blockers.length) {
    const error = codedError('Configured-default evidence is blocked.', 'COMMON_INPUT_CONFIGURED_DEFAULTS_BLOCKED');
    error.details = configuredDefaultProvider.blockers;
    throw error;
  }
  const productEngineeringDefaultProvider = createLoadCalcInsulationDefaultProvider({
    sourceModel: dataset.sharedModel,
    requestedMethods: configuration.requestedMethods,
  });
  if (productEngineeringDefaultProvider.blockers.length) {
    const error = codedError(
      'Product engineering-default evidence is blocked.',
      'COMMON_INPUT_PRODUCT_ENGINEERING_DEFAULTS_BLOCKED',
    );
    error.details = productEngineeringDefaultProvider.blockers;
    throw error;
  }

  // This sidecar is an ephemeral resolver evidence bundle. The accepted user
  // sidecar remains separately stored; Project Data and Product engineering
  // defaults are compiled into exact ENTITY records only for resolution and
  // are never written back to the accepted sidecar.
  const enrichmentSidecar = createNonFeaEnrichmentSidecar({
    sourceSemanticHash: dataset.sharedModel.semanticHash,
    records: [
      ...acceptedEnrichmentSidecar.records,
      ...configuredDefaultProvider.records,
      ...productEngineeringDefaultProvider.records,
    ],
  });
  const candidateResolutionLedger = resolveNonFeaEnrichment({
    sourceModel: dataset.sharedModel,
    sidecar: enrichmentSidecar,
  });
  if (candidateResolutionLedger.status !== 'READY') {
    const error = codedError('The common field-resolution ledger is blocked.', 'COMMON_INPUT_RESOLUTION_BLOCKED');
    error.details = candidateResolutionLedger.blockers;
    throw error;
  }

  // CORE owns exact target matching, candidate custody and conflict/migration
  // blockers. The existing #1321 effective-value resolver owns the winner.
  // This bridge projects that exact effective winner into the Common Input model
  // instead of allowing the legacy CORE source-first winner to bypass it.
  const effectiveProjection = createNonFeaEffectiveCommonInputProjection({
    sourceModel: dataset.sharedModel,
    candidateResolutionLedger,
  });
  const {
    effectiveValueResolutionLedger,
    resolutionLedger,
    enrichedProjection,
  } = effectiveProjection;

  const configuredDefaultUsageRows = createConfiguredDefaultUsageRowsFromResolution({
    resolutionLedger,
    requestedMethods: configuration.requestedMethods,
  });
  const configuredDefaultUsageLedger = createConfiguredDefaultUsageLedger(
    projectDataProfile,
    configuredDefaultUsageRows,
  );
  const qualificationProfile = selectQualificationProfile(projectDataProfile, configuration);
  assertCommonCheckerDependencyIntegrity({
    enrichmentSidecar,
    resolutionLedger,
    enrichedProjection,
    configuredDefaultUsageLedger,
  });
  const requestId = [
    'PRE-FEA',
    dataset.datasetId || 'ACTIVE-DATASET',
    configuration.requestedMethods.join('+'),
    configuration.requestedLoadCases.join('+'),
    qualificationProfile ? `${qualificationProfile.profileId}@${qualificationProfile.version}` : 'NO-QUALIFICATION',
  ].join(':');

  return {
    requestId,
    sourceDatasetSha256: dataset.sourceSha256,
    requestedMethods: configuration.requestedMethods,
    requestedLoadCases: configuration.requestedLoadCases,
    sourceModel: dataset.sharedModel,
    enrichmentSidecar,
    acceptedEnrichmentSidecar,
    configuredDefaultProvider,
    productEngineeringDefaultProvider,
    productDefaultProvider,
    loadCaseAuthority,
    candidateResolutionLedger,
    effectiveValueResolutionLedger,
    resolutionLedger,
    enrichedProjection,
    projectDataProfile,
    projectDataOrigin: effectiveProjectDataOrigin(productDefaultProvider),
    authorityContracts: {
      topologyGraph: TopologyStore.getGraph(),
      supportAttachmentModel: SupportRestraintStore.getAttachmentModel(),
      restraintCapabilityModel: SupportRestraintStore.getRestraintModel(),
      supportSiteModel: ensureAuthoritySemanticHash(engineeringModelStore.getSupportSiteModel()),
      routePartitionModel: ensureAuthoritySemanticHash(engineeringModelStore.getRoutePartitionModel()),
      loadPrimitiveSet: ModelLoadStore.getLoadPrimitiveSet(),
    },
    qualificationProfile,
    configuredDefaultUsageLedger,
  };
}

export function listCurrentQualificationProfiles() {
  const profile = currentProductDefaultProvider().effectiveProfile;
  const entry = profile?.qualificationPolicy?.qualificationProfiles;
  if (!entry || entry.approved !== true || !entry.evidence?.source) return [];
  const value = entry.value;
  if (!value || value.schema !== 'non-fea-qualification-profile-set/v1' || !Array.isArray(value.profiles)) return [];
  return value.profiles.map((row) => ({ ...structuredClone(row) }));
}

export function getCurrentNonFeaLoadCaseAuthority() {
  return createNonFeaLoadCaseAuthority(currentProductDefaultProvider().effectiveProfile);
}

export function getCurrentNonFeaProductDefaultProvider() {
  return currentProductDefaultProvider();
}

function currentProductDefaultProvider() {
  return createNonFeaProductDefaultProvider({ profile: projectDataStore.getProfile() });
}

function effectiveProjectDataOrigin(productDefaultProvider) {
  return deepFreeze({
    ...structuredClone(projectDataStore.getOrigin()),
    productDefaults: {
      authority: 'PRODUCT_DEFAULT',
      profileId: productDefaultProvider.profileId,
      profileVersion: productDefaultProvider.profileVersion,
      providerSemanticHash: productDefaultProvider.semanticHash,
      productDefaultProfileSemanticHash: productDefaultProvider.productDefaultProfileSemanticHash,
      usageCount: productDefaultProvider.usageRows.length,
    },
  });
}

function selectQualificationProfile(projectDataProfile, configuration) {
  const entry = projectDataProfile?.qualificationPolicy?.qualificationProfiles;
  if (!configuration.qualificationProfileId || !configuration.qualificationProfileVersion) {
    if (entry?.approved === true && entry?.value?.schema === 'non-fea-qualification-profile-set/v1' && Array.isArray(entry?.value?.profiles)) {
      const defaultProfile = entry.value.profiles.find((row) => (
        row.qualification === 'QUALIFIED' && row.locked === true
      ));
      if (defaultProfile) return defaultProfile;
    }
    return null;
  }
  if (!entry || entry.approved !== true || !entry.evidence?.source) {
    throw codedError('Qualification profile authority is not approved and source-evidenced.', 'COMMON_INPUT_QUALIFICATION_AUTHORITY_REQUIRED');
  }
  const set = entry.value;
  if (!set || set.schema !== 'non-fea-qualification-profile-set/v1' || !Array.isArray(set.profiles)) {
    throw codedError('Qualification profile set is invalid.', 'COMMON_INPUT_QUALIFICATION_SET_INVALID');
  }
  const selected = set.profiles.find((row) => (
    row.profileId === configuration.qualificationProfileId
    && row.version === configuration.qualificationProfileVersion
  ));
  if (!selected) {
    throw codedError(
      `Qualification profile ${configuration.qualificationProfileId}@${configuration.qualificationProfileVersion} was not found.`,
      'COMMON_INPUT_QUALIFICATION_PROFILE_NOT_FOUND',
    );
  }
  return selected;
}

function ensureAuthoritySemanticHash(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if (typeof value.semanticHash === 'string' && value.semanticHash.includes(':')) return value;
  const base = structuredClone(value);
  return deepFreeze({ ...base, semanticHash: semanticHash(base) });
}

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
