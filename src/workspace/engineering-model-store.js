import { semanticHash } from '../core/shared-piping-model/canonical-json.js';
import { freezeDeep } from './dataset-utils.js';
import { projectDataStore } from './project-data/project-data-store.js';
import { validateProjectDataProfile } from './project-data/project-data-contract.js';
import { buildRoutePartitionModel } from './routes/route-partition-model.js';
import { buildSupportSiteModel, findSupportSiteByEntityId } from './support-sites/support-site-model.js';
import { measureNonFeaP0Stage } from './non-fea-p0-observability.js';
import { engineeringSupportLoadStore } from './engineering-loads/engineering-support-load-store.js';
import {
  AUTHORIZED_EMPIRICAL_LOAD_EXECUTION_REQUEST_SCHEMA,
  buildAuthorizedEmpiricalLoadProfile,
} from './engineering-loads/authorized-empirical-load-execution.js';
import { authorizedEmpiricalRuntimeStore } from './engineering-loads/authorized-empirical-runtime-store.js';
import { authorizedEmpiricalRuntimeStoreV2 } from './engineering-loads/authorized-empirical-runtime-store-v2.js';
import { empiricalLoadCalcScenarioStore } from './engineering-loads/empirical-load-calc-scenario-store.js';
import {
  topologyEditCheckSnapshotStore,
} from './topology-edit/topology-edit-check-snapshot-store.js';

function emptyPerformanceMetrics() {
  return {
    artifactSemanticHashComputations: 0,
    artifactSemanticHashCacheHits: 0,
    empiricalBindingBuilds: 0,
    empiricalBindingCacheHits: 0,
    empiricalBindingCacheBypasses: 0,
  };
}

/**
 * Holds canonical support sites and route partitions for the active dataset and
 * decorates any support member with the same canonical calculation evidence.
 */
export class EngineeringModelStore {
  #dataset = null;
  #supportSiteModel = null;
  #routePartitionModel = null;
  #modelRuntimeRevision = 0;
  #artifactHashes = null;
  #artifactHashCache = new WeakMap();
  #empiricalBindingCache = null;
  #performanceMetrics = emptyPerformanceMetrics();

  rebuild(dataset) {
    this.#dataset = dataset;
    this.#modelRuntimeRevision += 1;
    this.#empiricalBindingCache = null;
    topologyEditCheckSnapshotStore.invalidate();
    if (!dataset) {
      this.#supportSiteModel = null;
      this.#routePartitionModel = null;
      this.#artifactHashes = null;
      return;
    }
    const profile = projectDataStore.getProfile();
    this.#supportSiteModel = measureNonFeaP0Stage(
      'SUPPORT_SITE_CONSTRUCTION',
      () => buildSupportSiteModel(dataset, profile),
    );
    this.#routePartitionModel = measureNonFeaP0Stage(
      'ROUTE_CONSTRUCTION',
      () => buildRoutePartitionModel(dataset, profile),
    );
    this.#artifactHashes = freezeDeep({
      sharedModelSemanticHash: dataset.sharedModel && typeof dataset.sharedModel === 'object'
        ? this.#artifactSemanticHash(dataset.sharedModel)
        : null,
      supportSiteModelSemanticHash: this.#artifactSemanticHash(this.#supportSiteModel),
      routePartitionModelSemanticHash: this.#artifactSemanticHash(this.#routePartitionModel),
    });
  }

  /** @deprecated Ordinary production callers shall use executeConfiguredAuthorized(). */
  calculate(masterData) {
    this.#requireActiveModels();
    return engineeringSupportLoadStore.calculate({
      dataset: this.#dataset,
      profile: projectDataStore.getProfile(),
      supportSiteModel: this.#supportSiteModel,
      routePartitionModel: this.#routePartitionModel,
      masterData,
    });
  }

  /** @deprecated Low-level seam retained for focused contract checks only. */
  calculateAuthorized({ executionId, executedAt, authorizedInput, masterData }) {
    this.#requireActiveModels();
    return engineeringSupportLoadStore.calculateAuthorized({
      schema: AUTHORIZED_EMPIRICAL_LOAD_EXECUTION_REQUEST_SCHEMA,
      executionId,
      executedAt,
      authorizedInput,
      dataset: this.#dataset,
      profile: projectDataStore.getProfile(),
      supportSiteModel: this.#supportSiteModel,
      routePartitionModel: this.#routePartitionModel,
      masterData,
    });
  }

  configureAuthorizedEmpiricalPackage(runtimePackage, masterData) {
    this.#requireActiveModels();
    const bindings = this.#currentEmpiricalBindings(masterData);
    const configured = authorizedEmpiricalRuntimeStore.configure(runtimePackage, bindings);
    try {
      const blockers = this.#currentEmpiricalReadiness(masterData, runtimePackage);
      return blockers.length > 0
        ? authorizedEmpiricalRuntimeStore.markBlockedNotReady('EMPIRICAL_INPUT_NOT_READY', blockers)
        : configured;
    } catch (error) {
      return authorizedEmpiricalRuntimeStore.markBlockedNotReady(
        error.code || 'EMPIRICAL_INPUT_NOT_READY',
        [{ message: error instanceof Error ? error.message : String(error) }],
      );
    }
  }

  refreshAuthorizedEmpiricalPackage(masterData) {
    if (!this.#dataset || !this.#supportSiteModel || !this.#routePartitionModel) {
      return authorizedEmpiricalRuntimeStore.refresh(null);
    }
    const runtimePackage = authorizedEmpiricalRuntimeStore.getPackage();
    if (!runtimePackage) {
      try {
        this.#currentEmpiricalBindings(masterData);
        const mechanicalBlockers = this.#currentMechanicalReadiness();
        return mechanicalBlockers.length > 0
          ? authorizedEmpiricalRuntimeStore.markBlockedNotReady('EMPIRICAL_MODELS_NOT_READY', mechanicalBlockers)
          : authorizedEmpiricalRuntimeStore.refresh({});
      } catch (error) {
        return authorizedEmpiricalRuntimeStore.markBlockedNotReady(
          error.code || 'EMPIRICAL_RUNTIME_BINDINGS_UNAVAILABLE',
          [{ message: error instanceof Error ? error.message : String(error) }],
        );
      }
    }
    try {
      const refreshed = authorizedEmpiricalRuntimeStore.refresh(this.#currentEmpiricalBindings(masterData));
      if (!refreshed.calculationEligible) return refreshed;
      const blockers = this.#currentEmpiricalReadiness(masterData, runtimePackage);
      return blockers.length > 0
        ? authorizedEmpiricalRuntimeStore.markBlockedNotReady('EMPIRICAL_INPUT_NOT_READY', blockers)
        : refreshed;
    } catch (error) {
      return authorizedEmpiricalRuntimeStore.markBlockedNotReady(
        error.code || 'EMPIRICAL_RUNTIME_BINDINGS_UNAVAILABLE',
        [{ message: error instanceof Error ? error.message : String(error) }],
      );
    }
  }

  markEmpiricalStale(reason, datasetVersion = null) {
    engineeringSupportLoadStore.markStale(reason, datasetVersion);
    const v2 = authorizedEmpiricalRuntimeStoreV2.getPackage()
      ? authorizedEmpiricalRuntimeStoreV2.markStale(reason, [{ datasetVersion }])
      : null;
    const v1 = authorizedEmpiricalRuntimeStore.getPackage()
      ? authorizedEmpiricalRuntimeStore.markStale(reason, [{ datasetVersion }])
      : null;
    return v2 || v1 || authorizedEmpiricalRuntimeStore.markStale(reason, [{ datasetVersion }]);
  }

  executeConfiguredAuthorized(masterData) {
    this.#requireActiveModels();
    this.refreshAuthorizedEmpiricalPackage(masterData);
    const runtimePackage = authorizedEmpiricalRuntimeStore.requireCurrentPackage();
    const execution = engineeringSupportLoadStore.calculateAuthorized({
      schema: AUTHORIZED_EMPIRICAL_LOAD_EXECUTION_REQUEST_SCHEMA,
      executionId: runtimePackage.executionId,
      executedAt: runtimePackage.executedAt,
      authorizedInput: runtimePackage.authorizedInput,
      dataset: this.#dataset,
      profile: projectDataStore.getProfile(),
      supportSiteModel: this.#supportSiteModel,
      routePartitionModel: this.#routePartitionModel,
      masterData,
    });
    authorizedEmpiricalRuntimeStore.recordExecution(execution);
    return execution;
  }

  deactivate(reason = 'NO_ACTIVE_DATASET') {
    this.rebuild(null);
    engineeringSupportLoadStore.markStale(reason, null);
    if (authorizedEmpiricalRuntimeStoreV2.getPackage()) {
      return authorizedEmpiricalRuntimeStoreV2.markStale(reason, [{ datasetVersion: null }]);
    }
    return authorizedEmpiricalRuntimeStore.getPackage()
      ? authorizedEmpiricalRuntimeStore.markStale(reason, [{ datasetVersion: null }])
      : authorizedEmpiricalRuntimeStore.refresh(null);
  }

  #currentEmpiricalBindings(masterData) {
    this.#requireActiveModels();
    const profile = projectDataStore.getProfile();
    const sourceDatasetHash = sha256(this.#dataset.sourceSha256, 'dataset.sourceSha256');
    if (!this.#dataset.sharedModel || typeof this.#dataset.sharedModel !== 'object') {
      fail('The active dataset has no materialized shared model.', 'EMPIRICAL_RUNTIME_SHARED_MODEL_MISSING');
    }
    if (!this.#artifactHashes?.sharedModelSemanticHash) {
      fail('The active dataset shared-model semantic identity is unavailable.', 'EMPIRICAL_RUNTIME_SHARED_MODEL_HASH_MISSING');
    }
    const masterSourceHashes = freezeDeep({
      dataset: sourceDatasetHash,
      lineList: sha256(masterData?.lineList?.sourceHash, 'masterData.lineList.sourceHash'),
      pipingClass: sha256(masterData?.pipingClass?.sourceHash, 'masterData.pipingClass.sourceHash'),
      componentWeight: sha256(masterData?.weight?.sourceHash, 'masterData.weight.sourceHash'),
    });
    const basisKey = this.#empiricalBindingBasisKey(masterSourceHashes);
    if (basisKey && this.#empiricalBindingCache?.basisKey === basisKey) {
      this.#performanceMetrics.empiricalBindingCacheHits += 1;
      return this.#empiricalBindingCache.bindings;
    }

    const bindings = freezeDeep({
      projectId: identity(profile?.projectId, 'projectData.projectId'),
      datasetId: identity(this.#dataset.datasetId, 'dataset.datasetId'),
      datasetVersion: nullableVersion(this.#dataset.version),
      sourceDatasetHash,
      sharedModelSemanticHash: this.#artifactHashes.sharedModelSemanticHash,
      supportSiteModelSemanticHash: this.#artifactHashes.supportSiteModelSemanticHash,
      routePartitionModelSemanticHash: this.#artifactHashes.routePartitionModelSemanticHash,
      projectDataProfileSemanticHash: projectDataStore.getSemanticHash(),
      masterSourceHashes,
    });
    this.#performanceMetrics.empiricalBindingBuilds += 1;
    if (basisKey) {
      this.#empiricalBindingCache = { basisKey, bindings };
    } else {
      this.#performanceMetrics.empiricalBindingCacheBypasses += 1;
    }
    return bindings;
  }

  #empiricalBindingBasisKey(masterSourceHashes) {
    const projectRuntimeRevision = projectDataStore.getRuntimeRevision?.();
    if (!nonnegativeInteger(projectRuntimeRevision)) return null;
    return JSON.stringify([
      this.#modelRuntimeRevision,
      projectRuntimeRevision,
      this.#dataset?.datasetId ?? null,
      this.#dataset?.version ?? null,
      masterSourceHashes.dataset,
      masterSourceHashes.lineList,
      masterSourceHashes.pipingClass,
      masterSourceHashes.componentWeight,
    ]);
  }

  #artifactSemanticHash(artifact) {
    const cached = this.#artifactHashCache.get(artifact);
    if (cached) {
      this.#performanceMetrics.artifactSemanticHashCacheHits += 1;
      return cached;
    }
    const hash = semanticHash(artifact);
    this.#artifactHashCache.set(artifact, hash);
    this.#performanceMetrics.artifactSemanticHashComputations += 1;
    return hash;
  }

  #currentMechanicalReadiness() {
    const blockers = [];
    if (this.#supportSiteModel?.status && this.#supportSiteModel.status !== 'READY') {
      blockers.push(...(this.#supportSiteModel.blockers || [{ code: 'SUPPORT_SITE_MODEL_NOT_READY' }]));
    }
    if (this.#routePartitionModel?.status && this.#routePartitionModel.status !== 'READY') {
      blockers.push(...(this.#routePartitionModel.blockers || [{ code: 'ROUTE_PARTITION_MODEL_NOT_READY' }]));
    }
    const topologyCheck = topologyEditCheckSnapshotStore.getSnapshot(this.#dataset?.datasetId);
    if (!topologyCheck) {
      blockers.push({
        code: 'TOPOLOGY_CHECK_REQUIRED',
        message: 'A current canonical topology check is required.',
      });
    }
    blockers.push(...(topologyCheck?.blockingFindings || []).map((finding) => ({
      code: finding.kind,
      message: finding.message,
      topologyCheckSnapshotHash: topologyCheck.snapshotHash,
      nodeIds: finding.nodeIds,
      edgeIds: finding.edgeIds,
    })));
    return freezeDeep(blockers.map((row) => ({ ...row })));
  }

  #currentEmpiricalReadiness(masterData, runtimePackage) {
    const blockers = [...this.#currentMechanicalReadiness()];
    const profile = buildAuthorizedEmpiricalLoadProfile(
      projectDataStore.getProfile(),
      runtimePackage.authorizedInput,
    );
    const activeHashes = currentMasterHashes(masterData, this.#dataset);
    const loadWorkflow = runtimePackage.authorizedInput?.effectiveValueLedger
      ? 'authorizedGravityLoads'
      : 'loads';
    blockers.push(...validateProjectDataProfile(profile, loadWorkflow, activeHashes).errors);
    blockers.push(...validateProjectDataProfile(profile, 'topology', activeHashes).errors);
    return freezeDeep(dedupeBlockers(blockers));
  }

  #requireActiveModels() {
    if (!this.#dataset || !this.#supportSiteModel || !this.#routePartitionModel) {
      throw codedError('Load calculation requires an active normalized dataset.', 'EMPIRICAL_RUNTIME_ACTIVE_MODEL_MISSING');
    }
  }

  canonicalEntityId(entityId) {
    return findSupportSiteByEntityId(this.#supportSiteModel, entityId)?.primaryEntityId || entityId;
  }

  decorateEntity(entity) {
    if (!entity) return null;
    const site = findSupportSiteByEntityId(this.#supportSiteModel, entity.entityId);
    if (!site) return entity;
    const distribution = engineeringSupportLoadStore.getDistribution();

    const scenarioExecution = empiricalLoadCalcScenarioStore.getExecution();
    const scenarioCoreResult = scenarioExecution?.coreResult || null;

    const loadCases = (distribution?.loadCases || []).map((loadCase) => {
      const result = loadCase.supportResults.find((row) => row.supportSiteId === site.siteId);
      const ledgers = loadCase.contributionLedger.filter((row) => row.allocations.some((allocation) => allocation.siteId === site.siteId));

      const scenarioCaseResult = scenarioCoreResult?.loadCases?.find((lc) => lc.loadCaseId === loadCase.loadCaseId);
      const scenarioSupportResult = scenarioCaseResult?.supportResults?.find((row) => row.supportSiteId === site.siteId);

      return {
        loadCaseId: loadCase.loadCaseId,
        supportSiteId: site.siteId,
        status: result?.status || loadCase.status,
        verticalForceN: result?.verticalForceN ?? null,
        contributorIds: result?.contributorIds || [],
        formulasAndSources: ledgers.map((row) => ({ contributionId: row.contributionId, formula: row.formula, source: row.source })),
        excludedInputs: loadCase.excludedInputs,
        anchorDecomposition: scenarioSupportResult?.anchorDecomposition ?? null,
        contactState: scenarioSupportResult?.contactState ?? null,
        restraintId: scenarioSupportResult?.restraintId ?? null,
      };
    });
    const runtimeStore = activeEmpiricalRuntimeStore();
    const currentSystemExecution = engineeringSupportLoadStore.getCurrentCommonInputExecution();
    const authorizedExecution = runtimeStore.getExecution() || engineeringSupportLoadStore.getAuthorizedExecution();
    const authority = currentSystemExecution
      ? 'CURRENT_COMMON_INPUT_SYSTEM_RUN'
      : authorizedExecution
        ? 'AUTHORIZED_HANDOFF'
        : 'UNAUTHORIZED_LEGACY_RESULT';
    const authorizationState = currentSystemExecution
      ? 'EXECUTED_CURRENT_SYSTEM'
      : runtimeStore.getSnapshot().state;
    return freezeDeep({
      ...entity,
      entityId: site.primaryEntityId,
      name: site.tags.join(' / '),
      properties: {
        ...entity.properties,
        supportSite: {
          schema: this.#supportSiteModel.schema,
          siteId: site.siteId,
          tags: site.tags,
          positionMm: site.positionMm,
          assemblyIds: site.assemblyIds,
          memberEntityIds: site.memberEntityIds,
        },
        engineeringSupportLoads: distribution ? {
          method: distribution.method,
          authority,
          authorizationState,
          freshness: distribution.freshness,
          sourceAxisBasis: distribution.sourceAxisBasis,
          loadCases,
        } : {
          authority: runtimeStore.getPackage() ? 'AUTHORIZED_HANDOFF' : 'NOT_CALCULATED',
          authorizationState: runtimeStore.getSnapshot().state,
          freshness: { status: 'NOT_CALCULATED' },
          sourceAxisBasis: 'Z_UP',
          loadCases: [],
        },
      },
    });
  }

  getSupportSiteModel() { return this.#supportSiteModel; }
  getRoutePartitionModel() { return this.#routePartitionModel; }
  getTopologyCheckSnapshot() {
    return topologyEditCheckSnapshotStore.getSnapshot(this.#dataset?.datasetId);
  }
  getDistribution() { return engineeringSupportLoadStore.getDistribution(); }
  getCurrentCommonInputExecution() {
    return engineeringSupportLoadStore.getCurrentCommonInputExecution();
  }
  getAuthorizedExecution() {
    return activeEmpiricalRuntimeStore().getExecution()
      || engineeringSupportLoadStore.getAuthorizedExecution();
  }
  getEmpiricalAuthorizationState() { return activeEmpiricalRuntimeStore().getSnapshot(); }
  getAuthorizedEmpiricalPackage() { return activeEmpiricalRuntimeStore().getPackage(); }
  getPerformanceMetrics() {
    return {
      modelRuntimeRevision: this.#modelRuntimeRevision,
      ...this.#performanceMetrics,
      empiricalBindingCacheActive: Boolean(this.#empiricalBindingCache),
    };
  }
  resetPerformanceMetrics() {
    this.#performanceMetrics = emptyPerformanceMetrics();
  }
  clear() {
    this.rebuild(null);
    engineeringSupportLoadStore.clear();
    authorizedEmpiricalRuntimeStore.clear();
    authorizedEmpiricalRuntimeStoreV2.clear();
  }
}

function activeEmpiricalRuntimeStore() {
  return authorizedEmpiricalRuntimeStoreV2.getPackage()
    ? authorizedEmpiricalRuntimeStoreV2
    : authorizedEmpiricalRuntimeStore;
}

function identity(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(`${label} must be a non-empty trimmed string.`, 'EMPIRICAL_RUNTIME_IDENTITY_INVALID');
  }
  return value;
}

function sha256(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    fail(`${label} must be a lowercase SHA-256 digest.`, 'EMPIRICAL_RUNTIME_SHA256_INVALID');
  }
  return value;
}

function nullableVersion(value) {
  if (value === null || value === undefined) return null;
  if (Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.length > 0 && value.trim() === value) return value;
  fail('dataset.version must be null, an integer, or a non-empty trimmed string.', 'EMPIRICAL_RUNTIME_VERSION_INVALID');
}

function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function currentMasterHashes(masterData, dataset) {
  return {
    dataset: dataset?.sourceSha256 || '',
    lineList: masterData?.lineList?.sourceHash || '',
    pipingClass: masterData?.pipingClass?.sourceHash || '',
    componentWeight: masterData?.weight?.sourceHash || '',
  };
}

function dedupeBlockers(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function fail(message, code) {
  throw codedError(message, code);
}

export const engineeringModelStore = new EngineeringModelStore();