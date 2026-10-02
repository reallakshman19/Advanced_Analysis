import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { deepFreeze } from '../../core/shared-piping-model/immutable.js';
import {
  compareAuthorizedEmpiricalRuntimeBindings,
  requireAuthorizedEmpiricalRuntimePackage,
} from './authorized-empirical-runtime-package.js';
import {
  createGovernedEmpiricalRuntimePackageProjectionV2,
  requireGovernedEmpiricalRuntimePackageProjectionV2,
  GOVERNED_EMPIRICAL_RUNTIME_PACKAGE_PROJECTION_V2_SCHEMA,
} from './governed-empirical-runtime-package-v2.js';
import {
  evaluateGovernedEmpiricalGravityMethodSelection,
} from './empirical-gravity-method-selection.js';
import {
  createNonFeaGravityMethodAuthority,
} from '../project-data/non-fea-gravity-method-authority.js';

const PROJECT_DATA_BINDING = 'projectDataProfileSemanticHash';

/**
 * Upgrades the existing explicit V1 authorization context into the governed
 * method-bound V2 production package. The caller's identity, timestamps and
 * authorized input are retained. Dataset/model/master bindings must already be
 * current. The V1 Project Data binding must equal the exact current raw profile
 * hash and is then replaced by the effective Product-default profile hash.
 */
export function createProductionGovernedEmpiricalProjection(input = {}) {
  const legacyRuntimePackage = requireAuthorizedEmpiricalRuntimePackage(
    input.legacyRuntimePackage,
  );
  const current = requireCurrentContext(input);
  const sourceProjectDataSemanticHash = hash(
    input.sourceProjectDataSemanticHash,
    'sourceProjectDataSemanticHash',
  );
  if (
    legacyRuntimePackage.bindings.projectDataProfileSemanticHash
    !== sourceProjectDataSemanticHash
  ) {
    fail(
      'Legacy empirical authorization does not bind the exact current raw Project Data profile.',
      'EMPIRICAL_PRODUCTION_GOVERNED_SOURCE_PROJECT_DATA_MISMATCH',
      {
        expected: sourceProjectDataSemanticHash,
        actual: legacyRuntimePackage.bindings.projectDataProfileSemanticHash,
      },
    );
  }
  const mismatches = compareAuthorizedEmpiricalRuntimeBindings(
    legacyRuntimePackage.bindings,
    current.bindings,
  ).filter((row) => row.field !== PROJECT_DATA_BINDING);
  if (mismatches.length > 0) {
    fail(
      'Legacy empirical authorization context is stale against the live governed runtime context.',
      'EMPIRICAL_PRODUCTION_GOVERNED_UPGRADE_BINDING_MISMATCH',
      mismatches,
    );
  }
  return createProjection({
    runtimePackage: legacyRuntimePackage,
    current,
  });
}

/** Rebuilds the current governed receipt without creating a new authorization. */
export function rebuildProductionGovernedEmpiricalProjection(input = {}) {
  const configured = requireGovernedEmpiricalRuntimePackageProjectionV2(
    input.configuredProjection,
  );
  const current = requireCurrentContext(input);
  return createProjection({
    runtimePackage: configured.runtimePackage,
    current,
  });
}

export function createProductionGovernedEmpiricalBindings(input = {}) {
  return requireCurrentContext(input).bindings;
}

function createProjection({ runtimePackage, current }) {
  const gravityMethodAuthority = createNonFeaGravityMethodAuthority(
    current.effectiveProfile,
  );
  const governedSelection = evaluateGovernedEmpiricalGravityMethodSelection({
    gravityMethodAuthority,
    dataset: current.dataset,
    profile: current.effectiveProfile,
    routePartitionModel: current.routePartitionModel,
  });
  return createGovernedEmpiricalRuntimePackageProjectionV2({
    schema: GOVERNED_EMPIRICAL_RUNTIME_PACKAGE_PROJECTION_V2_SCHEMA,
    governedSelection,
    packageContext: {
      packageId: runtimePackage.packageId,
      configuredAt: runtimePackage.configuredAt,
      executionId: runtimePackage.executionId,
      executedAt: runtimePackage.executedAt,
      authorizedInput: runtimePackage.authorizedInput,
      bindings: current.bindings,
    },
  });
}

function requireCurrentContext(input) {
  const dataset = object(input.dataset, 'dataset');
  const effectiveProfile = object(input.effectiveProfile, 'effectiveProfile');
  const supportSiteModel = object(input.supportSiteModel, 'supportSiteModel');
  const routePartitionModel = object(input.routePartitionModel, 'routePartitionModel');
  const masterData = object(input.masterData, 'masterData');
  const sourceDatasetHash = sha256(dataset.sourceSha256, 'dataset.sourceSha256');
  if (!dataset.sharedModel || typeof dataset.sharedModel !== 'object') {
    fail('Current dataset shared model is required.', 'EMPIRICAL_PRODUCTION_GOVERNED_SHARED_MODEL_REQUIRED');
  }
  const bindings = deepFreeze({
    projectId: identity(effectiveProfile.projectId, 'effectiveProfile.projectId'),
    datasetId: identity(dataset.datasetId, 'dataset.datasetId'),
    datasetVersion: dataset.version ?? null,
    sourceDatasetHash,
    sharedModelSemanticHash: semanticHash(dataset.sharedModel),
    supportSiteModelSemanticHash: semanticHash(supportSiteModel),
    routePartitionModelSemanticHash: semanticHash(routePartitionModel),
    projectDataProfileSemanticHash: semanticHash(effectiveProfile),
    masterSourceHashes: {
      dataset: sourceDatasetHash,
      lineList: nullableSha256(masterData?.lineList?.sourceHash, 'masterData.lineList.sourceHash'),
      pipingClass: sha256(masterData?.pipingClass?.sourceHash, 'masterData.pipingClass.sourceHash'),
      componentWeight: sha256(masterData?.weight?.sourceHash, 'masterData.weight.sourceHash'),
    },
  });
  return deepFreeze({
    dataset,
    effectiveProfile,
    supportSiteModel,
    routePartitionModel,
    masterData,
    bindings,
  });
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object.`, 'EMPIRICAL_PRODUCTION_GOVERNED_CONTEXT_INVALID');
  }
  return value;
}

function identity(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    fail(`${label} must be a non-empty trimmed string.`, 'EMPIRICAL_PRODUCTION_GOVERNED_IDENTITY_INVALID');
  }
  return value;
}

function hash(value, label) {
  if (typeof value !== 'string' || !/^fnv1a64:[0-9a-f]{16}$/u.test(value)) {
    fail(`${label} must be an FNV-1a semantic hash.`, 'EMPIRICAL_PRODUCTION_GOVERNED_HASH_INVALID');
  }
  return value;
}

function sha256(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    fail(`${label} must be a lowercase SHA-256 digest.`, 'EMPIRICAL_PRODUCTION_GOVERNED_HASH_INVALID');
  }
  return value;
}

/**
 * Like sha256() but accepts null/undefined/'' when the line list master has
 * not been loaded. The line list is optional for the gravity load calculation
 * (it is only consumed for fluid-density enrichment). When absent the binding
 * records null; downstream readiness guards surface the gap without throwing.
 */
function nullableSha256(value, label) {
  if (value === null || value === undefined || value === '') return null;
  return sha256(value, label);
}

function fail(message, code, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details === null ? null : deepFreeze(details);
  throw error;
}
