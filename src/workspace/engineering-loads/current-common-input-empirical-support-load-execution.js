import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { freezeDeep, stringValue } from '../dataset-utils.js';
import { projectDataValue } from '../project-data/project-data-contract.js';
import { projectConfirmedSupportMappings } from './current-common-input-support-mapping.js';
import {
  bindAuthorizedEmpiricalGravityConventions,
  requireAuthorizedEmpiricalGravityConventions,
} from './authorized-empirical-gravity-convention-binding.js';
import {
  bindAuthorizedEmpiricalSourceAxis,
  requireAuthorizedEmpiricalSourceBasis,
} from './authorized-empirical-source-axis-binding.js';
import {
  bindAuthorizedEmpiricalSupportCapabilities,
  bindAuthorizedEmpiricalSupportCapabilityResult,
} from './authorized-empirical-support-capability-binding.js';
import {
  createCurrentCommonInputGravityLoadBasis,
  requireCurrentCommonInputGravityLoadBasis,
} from './current-common-input-gravity-load-basis.js';
import {
  requireCurrentCurrentCommonInputEmpiricalMassProjection,
} from './current-common-input-empirical-mass-projection.js';
import {
  EMPIRICAL_LOAD_COG_METHOD,
  EMPIRICAL_LOAD_METHOD,
  calculateSupportLoadDistributionFromQualifiedCaseMasses,
  calculateSupportLoadDistributionWithComponentCogFromQualifiedCaseMasses,
} from './support-load-distribution-v3.js';

export const CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_LOAD_EXECUTION_SCHEMA =
  'current-common-input-empirical-support-load-execution/v1';

const QUALIFIED_CASE_MASS_SOURCE_KIND = 'QUALIFIED_CASE_MASS_RECEIPT';
const QUALIFIED_CASE_MASS_AUTHORITY = 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION';

/**
 * Executes the existing support-load statics against the exact masses sealed by
 * the current Common Input mass projection. This wrapper is the authority seam;
 * the low-level support kernel entrypoint is deliberately non-authorizing.
 *
 * No legacy publication/handoff or Project Data mass-map identity is created.
 * Mass composition is not repeated here: every mass is copied from the current
 * #1471 receipt after its currentness is rebuilt against the #1465 Run decision.
 * Gravity acceleration and load factor are likewise rebound through the existing
 * Non-FEA effective-value resolver before the legacy scalar kernel receives a
 * projected execution profile. The kernel formula itself is unchanged.
 */
export function calculateCurrentCommonInputEmpiricalSupportLoads({
  snapshot,
  runAuthorization,
  massProjection,
  method,
  dataset,
  supportSiteModel,
  routePartitionModel,
  masterData,
} = {}) {
  const projection = requireCurrentCurrentCommonInputEmpiricalMassProjection(
    massProjection,
    { snapshot, runAuthorization },
  );
  const commonInput = requireCurrentReadyCommonInput(snapshot);
  const executionDataset = requireDatasetBinding(dataset, commonInput, projection);
  const supportSiteModelSemanticHash = requireAuthorityBinding(
    'supportSiteModel',
    supportSiteModel,
    commonInput.authorityContracts?.supportSiteModel,
  );
  const routePartitionModelSemanticHash = requireAuthorityBinding(
    'routePartitionModel',
    routePartitionModel,
    commonInput.authorityContracts?.routePartitionModel,
  );
  const requestedMethod = requireMethod(method);
  const activeLoadCases = normalizeCaseIds(
    projectDataValue(commonInput.projectDataProfile, 'loadCalculation.activeLoadCases') || [],
  );
  if (JSON.stringify(activeLoadCases) !== JSON.stringify(projection.loadCaseIds)) {
    throw codedError(
      'Current mass projection load cases differ from the sealed active load cases.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_LOAD_CASE_BINDING_MISMATCH',
      { activeLoadCases, projectedLoadCases: projection.loadCaseIds },
    );
  }

  requireAuthorizedEmpiricalSourceBasis(commonInput.projectDataProfile);
  const gravityLoadBasis = createCurrentCommonInputGravityLoadBasis({ commonInput });
  requireCurrentCommonInputGravityLoadBasis(gravityLoadBasis, { commonInput });
  const supportMapping = projectConfirmedSupportMappings({ commonInput, dataset: executionDataset, supportSiteModel });
  const supportCapabilityBinding = bindAuthorizedEmpiricalSupportCapabilities({
    profile: gravityLoadBasis.profile,
    supportSiteModel: supportMapping.supportSiteModel,
  });
  if (supportCapabilityBinding.sourceProfileSemanticHash
      !== gravityLoadBasis.projectedProfileSemanticHash) {
    throw codedError(
      'Support capability binding did not consume the exact gravity/load execution profile.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_GRAVITY_LOAD_PROFILE_MISMATCH',
      {
        expected: gravityLoadBasis.projectedProfileSemanticHash,
        actual: supportCapabilityBinding.sourceProfileSemanticHash || null,
      },
    );
  }
  requireAuthorizedEmpiricalSourceBasis(supportCapabilityBinding.profile);
  requireAuthorizedEmpiricalGravityConventions(supportCapabilityBinding.profile);

  const massBinding = bindProjectionMassesToExecutionEntities({
    projection,
    dataset: executionDataset,
    routePartitionModel,
  });
  const calculationInput = {
    dataset: executionDataset,
    profile: supportCapabilityBinding.profile,
    supportSiteModel: supportMapping.supportSiteModel,
    routePartitionModel,
    masterData,
  };
  const rawDistribution = requestedMethod === EMPIRICAL_LOAD_METHOD
    ? calculateSupportLoadDistributionFromQualifiedCaseMasses(
      calculationInput,
      massBinding.qualifiedCaseMasses,
    )
    : calculateSupportLoadDistributionWithComponentCogFromQualifiedCaseMasses(
      calculationInput,
      massBinding.qualifiedCaseMasses,
    );
  if (rawDistribution.method !== requestedMethod) {
    throw codedError(
      'Mass-receipt support-load execution returned a different empirical method.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_METHOD_MISMATCH',
      { requestedMethod, executedMethod: rawDistribution.method },
    );
  }

  const axisBound = bindAuthorizedEmpiricalSourceAxis({
    distribution: rawDistribution,
    profile: supportCapabilityBinding.profile,
  });
  const conventionBound = bindAuthorizedEmpiricalGravityConventions({
    distribution: axisBound,
    profile: supportCapabilityBinding.profile,
  });
  const distribution = bindAuthorizedEmpiricalSupportCapabilityResult({
    distribution: conventionBound,
    binding: supportCapabilityBinding,
  });

  const material = {
    schema: CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_LOAD_EXECUTION_SCHEMA,
    requestedMethod,
    executedMethod: distribution.method,
    projectId: stringValue(commonInput.projectDataProfile?.projectId) || null,
    datasetId: requiredText(executionDataset.datasetId, 'datasetId'),
    datasetVersion: nullableVersion(executionDataset.version),
    commonInputSemanticHash: commonInput.semanticHash,
    commonInputSealSemanticHash: commonInput.seal.semanticHash,
    runAuthorizationSemanticHash: runAuthorization.semanticHash,
    massProjectionSemanticHash: projection.semanticHash,
    qualifiedCaseMassBindingSemanticHash: massBinding.semanticHash,
    gravityLoadBasisSemanticHash: gravityLoadBasis.semanticHash,
    sourceDatasetSha256: commonInput.sourceDatasetSha256,
    sourceModelSemanticHash: projection.sourceModelSemanticHash,
    supportSiteModelSemanticHash,
    routePartitionModelSemanticHash,
    distributionSemanticHash: semanticHash(distribution),
    mappingSummary: massBinding.summary,
    gravityLoadBasis,
    ...(supportMapping.receipt ? { supportMapping: supportMapping.receipt } : {}),
    policy: freezeDeep({
      legacyPublicationOrHandoffAuthorityAsserted: false,
      legacyMassMapsConsumed: false,
      massRecompositionPerformed: false,
      zeroMassPermitted: true,
      projectDataWorkflow: 'loadCalcProjectBasis',
      forceFormula: 'massKg * gravityMPerS2 * loadFactor',
      gravityLoadAuthority: 'CURRENT_COMMON_INPUT_EFFECTIVE_VALUE_RESOLUTION',
      unboundProjectDataGravityLoadConsumed: false,
      allocationMechanicsChanged: false,
      equilibriumMechanicsChanged: false,
    }),
    distribution,
  };
  return requireCurrentCommonInputEmpiricalSupportLoadExecution({
    ...material,
    semanticHash: semanticHash(material),
  });
}

export function requireCurrentCommonInputEmpiricalSupportLoadExecution(value) {
  if (!isRecord(value)
      || value.schema !== CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_LOAD_EXECUTION_SCHEMA) {
    throw codedError(
      `Expected ${CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_LOAD_EXECUTION_SCHEMA}.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_EXECUTION_INVALID',
    );
  }
  const material = { ...value };
  delete material.semanticHash;
  if (value.semanticHash !== semanticHash(material)) {
    throw codedError(
      'Current Common Input support-load execution semantic hash is stale.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_EXECUTION_HASH_MISMATCH',
    );
  }
  if (value.distributionSemanticHash !== semanticHash(value.distribution)) {
    throw codedError(
      'Current Common Input support-load distribution hash is stale.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_DISTRIBUTION_HASH_MISMATCH',
    );
  }
  if (value.requestedMethod !== value.executedMethod
      || value.distribution?.method !== value.executedMethod) {
    throw codedError(
      'Requested, executed and distribution empirical methods do not agree.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_METHOD_MISMATCH',
    );
  }
  const gravityLoadBasis = requireCurrentCommonInputGravityLoadBasis(value.gravityLoadBasis);
  if (gravityLoadBasis.semanticHash !== value.gravityLoadBasisSemanticHash
      || gravityLoadBasis.commonInputSemanticHash !== value.commonInputSemanticHash
      || gravityLoadBasis.commonInputSealSemanticHash !== value.commonInputSealSemanticHash
      || value.distribution?.supportCapabilityAuthority?.sourceProfileSemanticHash
        !== gravityLoadBasis.projectedProfileSemanticHash) {
    throw codedError(
      'Current support execution does not retain the exact gravity/load execution-basis custody.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_GRAVITY_LOAD_BINDING_MISMATCH',
    );
  }
  requireFixedPolicy(value.policy);
  if (value.supportMapping) {
    const mapping = { ...value.supportMapping }; delete mapping.semanticHash;
    if (value.supportMapping.semanticHash !== semanticHash(mapping)
      || mapping.schema !== 'current-common-input-support-mapping/v1'
      || mapping.commonInputSemanticHash !== value.commonInputSemanticHash
      || mapping.sourceModelSemanticHash !== value.sourceModelSemanticHash
      || mapping.sourceSupportSiteModelSemanticHash !== value.supportSiteModelSemanticHash
      || mapping.geometryChanged !== false || mapping.solverRestraintAuthorityAsserted !== false) {
      throw codedError('Support mapping receipt does not match the execution basis.', 'CURRENT_COMMON_INPUT_SUPPORT_MAPPING_INVALID');
    }
  }
  for (const key of [
    'commonInputSemanticHash', 'commonInputSealSemanticHash',
    'runAuthorizationSemanticHash', 'massProjectionSemanticHash',
    'qualifiedCaseMassBindingSemanticHash', 'gravityLoadBasisSemanticHash',
    'sourceModelSemanticHash', 'supportSiteModelSemanticHash',
    'routePartitionModelSemanticHash', 'distributionSemanticHash', 'semanticHash',
  ]) requireSemanticHash(value[key], key);
  if (typeof value.sourceDatasetSha256 !== 'string'
      || !/^[a-f0-9]{64}$/iu.test(value.sourceDatasetSha256)) {
    throw codedError(
      'sourceDatasetSha256 must be a SHA-256 hexadecimal string.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_EXECUTION_INVALID',
    );
  }
  return freezeDeep(value);
}

function bindProjectionMassesToExecutionEntities({ projection, dataset, routePartitionModel }) {
  const executionEntityIds = new Set((dataset.entities || []).map((entity) => entity.entityId));
  const physicalEdgeIds = new Set(
    (routePartitionModel.routes || []).flatMap((route) => route.physicalEdgeIds || []),
  );
  const mappedExecutionIds = new Set();
  const qualifiedCaseMasses = [];
  const mappingRows = [];

  for (const row of projection.entityRows) {
    const executionEntity = resolveExecutionEntity(dataset, row);
    if (mappedExecutionIds.has(executionEntity.entityId)) {
      throw codedError(
        `More than one mass-projection row maps to execution entity ${executionEntity.entityId}.`,
        'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_COMPONENT_TARGET_AMBIGUOUS',
        { executionEntityId: executionEntity.entityId },
      );
    }
    mappedExecutionIds.add(executionEntity.entityId);
    const expectedMode = executionEntity.entityType === 'PIPE' ? 'DISTRIBUTED' : 'POINT';
    row.cases.forEach((caseRow) => {
      if (caseRow.mode !== expectedMode) {
        throw codedError(
          `Mass projection mode ${caseRow.mode} does not match execution entity ${executionEntity.entityId}.`,
          'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_MASS_MODE_MISMATCH',
          {
            executionEntityId: executionEntity.entityId,
            entityType: executionEntity.entityType,
            loadCaseId: caseRow.loadCaseId,
            expectedMode,
            actualMode: caseRow.mode,
          },
        );
      }
      qualifiedCaseMasses.push(freezeDeep({
        entityId: executionEntity.entityId,
        loadCaseId: caseRow.loadCaseId,
        massKg: caseRow.massKg,
        source: freezeDeep({
          kind: QUALIFIED_CASE_MASS_SOURCE_KIND,
          authority: QUALIFIED_CASE_MASS_AUTHORITY,
          semanticHash: projection.semanticHash,
          targetId: row.targetId,
          projectionEntityId: row.entityId,
          sourceEntityId: row.sourceEntityId || null,
          caseSemanticHash: semanticHash(caseRow),
          mode: caseRow.mode,
        }),
      }));
    });
    mappingRows.push(freezeDeep({
      targetId: row.targetId,
      projectionEntityId: row.entityId,
      sourceEntityId: row.sourceEntityId || null,
      executionEntityId: executionEntity.entityId,
      executionEntityType: executionEntity.entityType,
      physicalRouteEdge: physicalEdgeIds.has(executionEntity.entityId),
    }));
  }

  const missingPhysicalEdgeIds = [...physicalEdgeIds]
    .filter((entityId) => !mappedExecutionIds.has(entityId))
    .sort(ascii);
  if (missingPhysicalEdgeIds.length > 0) {
    throw codedError(
      'One or more physical route entities have no current mass-projection row.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_MASS_COVERAGE_INCOMPLETE',
      { missingPhysicalEdgeIds },
    );
  }
  const unknownExecutionEntityIds = [...mappedExecutionIds]
    .filter((entityId) => !executionEntityIds.has(entityId))
    .sort(ascii);
  if (unknownExecutionEntityIds.length > 0) {
    throw codedError(
      'Mass-projection mapping references an unknown execution entity.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_COMPONENT_TARGET_MISSING',
      { unknownExecutionEntityIds },
    );
  }

  qualifiedCaseMasses.sort((left, right) => (
    ascii(left.entityId, right.entityId) || ascii(left.loadCaseId, right.loadCaseId)
  ));
  mappingRows.sort((left, right) => ascii(left.executionEntityId, right.executionEntityId));
  const summary = freezeDeep({
    projectionEntityCount: projection.entityRows.length,
    mappedExecutionEntityCount: mappingRows.length,
    physicalRouteEntityCount: physicalEdgeIds.size,
    qualifiedCaseMassCount: qualifiedCaseMasses.length,
    zeroMassCaseCount: qualifiedCaseMasses.filter((row) => row.massKg === 0).length,
  });
  const material = { qualifiedCaseMasses, mappingRows, summary };
  return freezeDeep({ ...material, semanticHash: semanticHash(material) });
}

function resolveExecutionEntity(dataset, projectionRow) {
  const shared = (dataset.sharedModel?.components || [])
    .find((component) => component.componentKey === projectionRow.entityId) || null;
  const sourceIds = new Set([
    projectionRow.entityId,
    projectionRow.sourceEntityId,
    shared?.sourceEntityId,
  ].map(stringValue).filter(Boolean));
  const matches = (dataset.entities || []).filter((entity) => (
    entity.entityId === projectionRow.entityId
    || sourceIds.has(stringValue(entity.sourceEntityId))
  ));
  const unique = [...new Map(matches.map((entity) => [entity.entityId, entity])).values()];
  if (unique.length !== 1) {
    throw codedError(
      `Mass projection target ${projectionRow.targetId} does not map to exactly one execution entity.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_COMPONENT_TARGET_AMBIGUOUS',
      {
        targetId: projectionRow.targetId,
        projectionEntityId: projectionRow.entityId,
        sourceEntityId: projectionRow.sourceEntityId || null,
        candidateEntityIds: unique.map((entity) => entity.entityId).sort(ascii),
      },
    );
  }
  return unique[0];
}

function requireDatasetBinding(dataset, commonInput, projection) {
  if (!isRecord(dataset) || !Array.isArray(dataset.entities) || !isRecord(dataset.sharedModel)) {
    throw codedError(
      'Current support-load execution requires the active workspace dataset and shared model.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_DATASET_REQUIRED',
    );
  }
  if (dataset.sourceSha256 !== commonInput.sourceDatasetSha256) {
    throw codedError(
      'Execution dataset source SHA differs from the sealed Common Input.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_DATASET_STALE',
      { expected: commonInput.sourceDatasetSha256, actual: dataset.sourceSha256 || null },
    );
  }
  const sharedModelSemanticHash = requireCurrentSemanticHash(
    'dataset.sharedModel',
    dataset.sharedModel,
  );
  if (sharedModelSemanticHash !== commonInput.sourceModelSemanticHash
      || sharedModelSemanticHash !== projection.sourceModelSemanticHash) {
    throw codedError(
      'Execution shared model differs from the source model bound by Common Input and the mass projection.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_SOURCE_MODEL_STALE',
      {
        datasetSharedModelSemanticHash: sharedModelSemanticHash,
        commonInputSourceModelSemanticHash: commonInput.sourceModelSemanticHash,
        projectionSourceModelSemanticHash: projection.sourceModelSemanticHash,
      },
    );
  }
  const sourceDatasetId = stringValue(dataset.sharedModel.project?.datasetId);
  const enrichedDatasetId = stringValue(commonInput.enrichedModel?.project?.datasetId);
  if (sourceDatasetId && enrichedDatasetId && sourceDatasetId !== enrichedDatasetId) {
    throw codedError(
      'Source and enriched Common Input dataset identities differ.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_DATASET_ID_MISMATCH',
      { sourceDatasetId, enrichedDatasetId },
    );
  }
  return dataset;
}

function requireAuthorityBinding(label, value, contract) {
  if (!isRecord(value) || !isRecord(contract) || typeof contract.semanticHash !== 'string') {
    throw codedError(
      `Current ${label} authority binding is unavailable.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_AUTHORITY_BINDING_REQUIRED',
      { label },
    );
  }
  const expectedHash = requireSemanticHash(contract.semanticHash, `${label}.semanticHash`);
  const currentHash = requireCurrentSemanticHash(label, value);
  if (currentHash !== expectedHash) {
    throw codedError(
      `Current ${label} differs from the Common Input authority contract.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_AUTHORITY_STALE',
      { label, expected: expectedHash, actual: currentHash },
    );
  }
  return currentHash;
}

function requireCurrentSemanticHash(label, value) {
  if (!isRecord(value)) {
    throw codedError(
      `${label} must be an object with deterministic semantic identity.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_AUTHORITY_BINDING_REQUIRED',
      { label },
    );
  }
  const declared = typeof value.semanticHash === 'string' ? value.semanticHash : null;
  const material = structuredClone(value);
  delete material.semanticHash;
  const computed = semanticHash(material);
  if (declared !== null && declared !== computed) {
    throw codedError(
      `${label} declared semantic hash does not match its current content.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_AUTHORITY_HASH_MISMATCH',
      { label, declared, computed },
    );
  }
  return declared || computed;
}

function requireCurrentReadyCommonInput(snapshot) {
  const commonInput = snapshot?.commonInput;
  if (!commonInput
      || snapshot?.staleness?.stale !== false
      || snapshot?.error
      || commonInput.packageState !== 'READY'
      || !commonInput.seal?.semanticHash
      || !commonInput.projectDataProfile) {
    throw codedError(
      'Current Common Input support-load execution requires an error-free fully READY current seal.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_COMMON_INPUT_NOT_READY',
    );
  }
  return commonInput;
}

function normalizeCaseIds(value) {
  if (!Array.isArray(value)) return [];
  const rows = [...new Set(value.map((item) => requiredText(item, 'loadCaseId')))].sort(ascii);
  rows.forEach((row) => {
    if (!['EMPTY', 'HYD', 'OPE'].includes(row)) {
      throw codedError(
        `Unsupported support-load case ${row}.`,
        'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_LOAD_CASE_INVALID',
      );
    }
  });
  return rows;
}

function requireMethod(value) {
  if (value !== EMPIRICAL_LOAD_METHOD && value !== EMPIRICAL_LOAD_COG_METHOD) {
    throw codedError(
      'Current Common Input support-load method is unsupported.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_METHOD_INVALID',
      { value, allowed: [EMPIRICAL_LOAD_METHOD, EMPIRICAL_LOAD_COG_METHOD] },
    );
  }
  return value;
}

function requireFixedPolicy(value) {
  const expected = {
    legacyPublicationOrHandoffAuthorityAsserted: false,
    legacyMassMapsConsumed: false,
    massRecompositionPerformed: false,
    zeroMassPermitted: true,
    projectDataWorkflow: 'loadCalcProjectBasis',
    forceFormula: 'massKg * gravityMPerS2 * loadFactor',
    gravityLoadAuthority: 'CURRENT_COMMON_INPUT_EFFECTIVE_VALUE_RESOLUTION',
    unboundProjectDataGravityLoadConsumed: false,
    allocationMechanicsChanged: false,
    equilibriumMechanicsChanged: false,
  };
  if (!isRecord(value)
      || JSON.stringify(Object.keys(value).sort(ascii)) !== JSON.stringify(Object.keys(expected).sort(ascii))
      || Object.entries(expected).some(([key, item]) => value[key] !== item)) {
    throw codedError(
      'Current Common Input support-load execution policy was altered.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_EXECUTION_POLICY_INVALID',
    );
  }
}

function requireSemanticHash(value, label) {
  if (typeof value !== 'string' || !/^fnv1a64:[0-9a-f]{16}$/u.test(value)) {
    throw codedError(
      `${label} must be an FNV-1a semantic hash.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_EXECUTION_INVALID',
    );
  }
  return value;
}

function requiredText(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    throw codedError(
      `${label} must be a non-empty trimmed string.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_EXECUTION_INVALID',
    );
  }
  return value;
}

function nullableVersion(value) {
  if (value === null || value === undefined) return null;
  if (Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() === value && value.length > 0) return value;
  throw codedError(
    'datasetVersion must be null, an integer, or a non-empty string.',
    'CURRENT_COMMON_INPUT_EMPIRICAL_SUPPORT_EXECUTION_INVALID',
  );
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ascii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function codedError(message, code, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details === null ? null : freezeDeep(structuredClone(details));
  return error;
}
