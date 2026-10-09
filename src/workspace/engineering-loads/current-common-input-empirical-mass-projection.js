import {
  COMMON_ENRICHED_TARGET_INVENTORY_SCHEMA,
  createCommonEnrichedTargetInventory,
} from '../../core/common-enriched-properties/target-inventory.js';
import { createPipingLoadCompositionProfile } from '../../core/model-loads/composition-profile.js';
import { resolveComponentCaseMass } from '../../core/model-loads/component-mass-resolver.js';
import { derivePipeLikeFittingWeightEvidence } from '../../core/model-loads/elbow-derived-mass.js';
import { optionalAuthorizedEmpiricalSourceLengthUnit } from './authorized-empirical-source-axis-binding.js';
import { projectDataValue } from '../project-data/project-data-contract.js';
import { zeroMassWaiverSetFromProfile } from './non-fea-zero-mass-waiver.js';
import { projectEngineeringLoadSources } from '../../core/model-loads/load-source-projection.js';
import { evidenceNumber } from '../../core/model-loads/units.js';
import { buildPipingPortTopologyGraph } from '../../core/piping-topology/index.js';
import { deepFreeze, semanticHash } from '../../core/shared-piping-model/index.js';
import {
  createNonFeaCommonEnrichedConfiguredDefaultOverlay,
} from '../project-data/non-fea-common-enriched-configured-default-overlay.js';
import {
  LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1,
} from '../project-data/non-fea-product-engineering-default-profile.js';
import {
  requireCurrentNonFeaEmpiricalRunAuthorization,
} from './non-fea-empirical-run-authorization.js';

export const CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_SCHEMA =
  'current-common-input-empirical-mass-projection/v1';

const SUPPORTED_LOAD_CASES = Object.freeze(['EMPTY', 'HYD', 'OPE']);
const ANCILLARY_FIELDS = Object.freeze({
  'permanent.claddingWeightKgPerM': 'claddingMassPerLengthKgPerM',
  'permanent.tracingWeightKgPerM': 'tracingMassPerLengthKgPerM',
});
const BLOCKED_AUTHORITY_STATUSES = new Set(['BLOCKED', 'STALE', 'NOT_AVAILABLE', 'NOT_BUILT']);
const FIXED_POLICY = Object.freeze({
  projectionOnly: true,
  executionAuthorizationGranted: false,
  legacyPublicationOrHandoffAuthorityAsserted: false,
  massBasisSource: 'SEALED_COMMON_INPUT_ENRICHED_MODEL',
  sourceLoadPrimitiveSetUsedAsNumericalBasis: false,
  effectiveLoadSourceProjectionRebuiltDeterministically: true,
  existingMassResolverReused: true,
  executionGravityConsumed: false,
  directMassBasisPreserved: true,
  fittingDerivationPreserved: true,
  negligibleMassZeroPreserved: true,
  ancillaryMassIncluded: true,
  componentContainedFluidIncluded: true,
  supportStaticsExecuted: false,
});

/**
 * Seals exact per-entity/per-load-case masses from fully READY current Common
 * Input. Numerical mass authority starts from the exact sealed enriched model,
 * not the workspace ModelLoadStore: that store is rebuilt from ordinary shared-
 * model events and cannot prove that Common Input enrichment was its mass basis.
 *
 * The existing model-load source projection, fitting derivation and component
 * mass resolver are reused directly. This preserves geometry normalization,
 * direct-vs-derived pipe/fluid/insulation mass, same-branch fitting derivation
 * and negligible gasket zero mass without constructing weight forces under a
 * separate gravity profile. This seam adds only Issue #1321 ancillary line mass
 * and optional OPE/HYD component-contained fluid.
 *
 * The source workspace load-primitive hash remains bound as current authority
 * evidence through Common Input/#1465, but its numerical values are not consumed.
 * This receipt is projection-only: no legacy publication/handoff, runtime
 * package, support statics, reaction, gravity execution, or execution authority.
 */
export function createCurrentCommonInputEmpiricalMassProjection({
  snapshot,
  runAuthorization,
} = {}) {
  const current = requireCurrentNonFeaEmpiricalRunAuthorization(runAuthorization, snapshot);
  const commonInput = current.commonInput;
  const loadCaseIds = normalizeLoadCases(commonInput.requestedLoadCases);
  const basis = buildProjectionBasis(commonInput);
  const entityRows = basis.effectiveLoadSourceProjection.components.map((component) => projectComponent({
    component,
    components: basis.effectiveLoadSourceProjection.components,
    target: basis.targetBySourceRecordId.get(component.componentKey),
    loadCaseIds,
    ancillaryByLine: basis.ancillaryByLine,
    compositionProfile: basis.compositionProfile,
    zeroMassWaivedIds: basis.zeroMassWaivedIds,
  })).sort((left, right) => ascii(left.entityId, right.entityId));

  const base = {
    schema: CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_SCHEMA,
    runAuthorizationSemanticHash: runAuthorization.semanticHash,
    commonInputSemanticHash: commonInput.semanticHash,
    commonInputSealSemanticHash: commonInput.seal.semanticHash,
    authorityRevisionVectorSemanticHash: runAuthorization.authorityRevisionVectorSemanticHash,
    sourceModelSemanticHash: commonInput.sourceModelSemanticHash,
    enrichedModelSemanticHash: commonInput.enrichedModel.semanticHash,
    resolutionLedgerSemanticHash: commonInput.resolutionLedgerSemanticHash,
    projectDataProfileSemanticHash: commonInput.projectDataProfileSemanticHash,
    configuredDefaultUsageLedgerSemanticHash:
      commonInput.configuredDefaultUsageLedgerSemanticHash || null,
    sourceLoadPrimitiveSetSemanticHash: basis.sourceLoadPrimitiveSetSemanticHash,
    effectiveMassTopologyGraphSemanticHash: basis.effectiveTopologyGraph.semanticHash,
    effectiveLoadSourceProjectionSemanticHash: basis.effectiveLoadSourceProjection.semanticHash,
    targetInventorySemanticHash: basis.inventory.semanticHash,
    ancillaryOverlaySemanticHash: basis.ancillaryOverlay.semanticHash,
    productEngineeringDefaultProfileSemanticHash:
      LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1.semanticHash,
    compositionProfileSemanticHash: basis.compositionProfile.semanticHash,
    loadCaseIds,
    entityRows,
    summary: projectionSummary(entityRows, loadCaseIds),
    policy: FIXED_POLICY,
  };
  return requireCurrentCommonInputEmpiricalMassProjection({
    ...base,
    semanticHash: semanticHash(base),
  });
}

export function requireCurrentCommonInputEmpiricalMassProjection(value) {
  if (!isRecord(value) || value.schema !== CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_SCHEMA) {
    throw codedError(`Expected ${CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_SCHEMA}.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_INVALID');
  }
  const material = { ...value };
  delete material.semanticHash;
  if (semanticHash(material) !== value.semanticHash) {
    throw codedError('Current Common Input empirical mass projection semantic hash is stale.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_HASH_MISMATCH');
  }
  requireFixedPolicy(value.policy);
  const loadCaseIds = normalizeLoadCases(value.loadCaseIds);
  if (JSON.stringify(loadCaseIds) !== JSON.stringify(value.loadCaseIds)) {
    throw codedError('Projection load cases are not in canonical order.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_LOAD_CASE_ORDER_INVALID');
  }
  if (!Array.isArray(value.entityRows)) {
    throw codedError('Projection entity rows must be an array.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_INVALID');
  }
  const ids = value.entityRows.map((row) => requiredText(row?.entityId, 'entityId'));
  if (new Set(ids).size !== ids.length || [...ids].sort(ascii).join('\0') !== ids.join('\0')) {
    throw codedError('Projection entity identities must be unique and canonically sorted.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_ENTITY_ORDER_INVALID');
  }
  value.entityRows.forEach((row) => validateEntityRow(row, loadCaseIds));
  const expectedSummary = projectionSummary(value.entityRows, loadCaseIds);
  if (semanticHash(expectedSummary) !== semanticHash(value.summary)) {
    throw codedError('Projection summary does not match its entity rows.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_SUMMARY_INVALID');
  }
  for (const key of [
    'runAuthorizationSemanticHash', 'commonInputSemanticHash', 'commonInputSealSemanticHash',
    'authorityRevisionVectorSemanticHash', 'sourceModelSemanticHash', 'enrichedModelSemanticHash',
    'resolutionLedgerSemanticHash', 'projectDataProfileSemanticHash',
    'sourceLoadPrimitiveSetSemanticHash', 'effectiveMassTopologyGraphSemanticHash',
    'effectiveLoadSourceProjectionSemanticHash', 'targetInventorySemanticHash',
    'ancillaryOverlaySemanticHash', 'productEngineeringDefaultProfileSemanticHash',
    'compositionProfileSemanticHash', 'semanticHash',
  ]) semanticHashText(value[key], key);
  if (value.configuredDefaultUsageLedgerSemanticHash !== null) {
    semanticHashText(value.configuredDefaultUsageLedgerSemanticHash,
      'configuredDefaultUsageLedgerSemanticHash');
  }
  return deepFreeze(value);
}

/** Rebuilds the deterministic mass projection from live current authority. */
export function requireCurrentCurrentCommonInputEmpiricalMassProjection(
  value,
  { snapshot, runAuthorization } = {},
) {
  const projection = requireCurrentCommonInputEmpiricalMassProjection(value);
  const rebuilt = createCurrentCommonInputEmpiricalMassProjection({ snapshot, runAuthorization });
  if (projection.semanticHash !== rebuilt.semanticHash) {
    throw codedError('Current Common Input empirical mass projection is stale.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_STALE', {
        expected: rebuilt.semanticHash,
        actual: projection.semanticHash,
      });
  }
  return projection;
}

function buildProjectionBasis(commonInput) {
  const model = commonInput.enrichedModel;
  if (!model || model.schema !== 'shared-piping-model/v1' || !Array.isArray(model.components)) {
    throw codedError('Current Common Input does not contain a valid enriched shared piping model.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_MODEL_INVALID');
  }
  if (model.semanticHash !== semanticHash(withoutSemanticHash(model))) {
    throw codedError('Current Common Input enriched model semantic hash is stale.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_MODEL_STALE');
  }

  const sourcePrimitiveContract = commonInput.authorityContracts?.loadPrimitiveSet || null;
  if (!sourcePrimitiveContract
      || typeof sourcePrimitiveContract.semanticHash !== 'string'
      || BLOCKED_AUTHORITY_STATUSES.has(sourcePrimitiveContract.status)) {
    throw codedError('Current Common Input requires a current source model-load primitive authority contract.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_SOURCE_LOAD_PRIMITIVE_AUTHORITY_REQUIRED', {
        semanticHash: sourcePrimitiveContract?.semanticHash || null,
        status: sourcePrimitiveContract?.status || null,
      });
  }
  semanticHashText(sourcePrimitiveContract.semanticHash,
    'authorityContracts.loadPrimitiveSet.semanticHash');

  const effectiveTopologyGraph = buildPipingPortTopologyGraph(model);
  // SJSON states no units, so the shared model carries units.length "unknown"
  // and every component would project UNIT_BLOCKED. The governed unit is the
  // approved sourcesAndUnits.lengthUnit. Only the unit is required here: the
  // up-axis decides which way gravity acts and is not consulted until
  // distribution, so demanding it would fail closed on a profile that is
  // complete for this step.
  const governedLengthUnit = optionalAuthorizedEmpiricalSourceLengthUnit(commonInput.projectDataProfile);
  // PD-COMPONENT-COG-FALLBACK declares what to do when a component has no exact
  // CoG authority. The gravity method selector already honours it; passing it
  // here is what stops a fitting whose mass was derived from its adjacent pipe
  // section from blocking with MISSING_COMPONENT_COG for want of a point to
  // apply that mass at.
  // The same approved waivers the coverage checker reads, so a component
  // answered there is answered here too.
  const zeroMassWaivedIds = new Set(
    zeroMassWaiverSetFromProfile(commonInput.projectDataProfile).waivedEntityIds,
  );
  const componentCogFallback = projectDataValue(
    commonInput.projectDataProfile,
    'loadCalculation.componentCogFallback',
  );
  const effectiveLoadSourceProjection = projectEngineeringLoadSources(
    model,
    effectiveTopologyGraph,
    { sourceLengthUnit: governedLengthUnit, componentCogFallback },
  );
  const compositionProfile = createPipingLoadCompositionProfile();

  const inventory = createCommonEnrichedTargetInventory({
    schema: COMMON_ENRICHED_TARGET_INVENTORY_SCHEMA,
    inventoryId: 'CURRENT-COMMON-INPUT-EMPIRICAL-MASS-TARGETS',
    sharedModel: model,
  });
  const ancillaryOverlay = createNonFeaCommonEnrichedConfiguredDefaultOverlay({
    profile: commonInput.projectDataProfile,
    sourceModel: model,
    inventory,
    requestedMethods: ['WEIGHT_AND_GRAVITY'],
  });
  if (ancillaryOverlay.blockers.length) {
    throw codedError('Current Common Input ancillary configured-default overlay is blocked.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_ANCILLARY_OVERLAY_BLOCKED', ancillaryOverlay.blockers);
  }
  if (LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1.defaults.length !== 0) {
    throw codedError('Product engineering defaults changed without Common Input currentness custody.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_PRODUCT_DEFAULT_CUSTODY_REQUIRED');
  }

  return {
    sourceLoadPrimitiveSetSemanticHash: sourcePrimitiveContract.semanticHash,
    effectiveTopologyGraph,
    effectiveLoadSourceProjection,
    compositionProfile,
    inventory,
    ancillaryOverlay,
    zeroMassWaivedIds,
    ancillaryByLine: ancillaryByLineTarget(inventory, ancillaryOverlay),
    targetBySourceRecordId: new Map(
      inventory.componentTargets.map((target) => [target.sourceRecordId, target]),
    ),
  };
}

function projectComponent({ component, components, target, loadCaseIds, ancillaryByLine, compositionProfile, zeroMassWaivedIds }) {
  if (!target || target.sourceRecordId !== component.componentKey) {
    throw codedError(`Component ${component.componentKey || '<missing>'} is not bound to one exact target row.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_TARGET_MISMATCH');
  }
  const derivedDryMass = derivePipeLikeFittingWeightEvidence(component, components);
  const resolvedComponent = derivedDryMass
    ? { ...component, engineeringProperties: { ...component.engineeringProperties, componentWeightKg: derivedDryMass } }
    : component;
  const ancillary = target.lineTargetId
    ? ancillaryByLine.get(target.lineTargetId) || zeroAncillary()
    : zeroAncillary();
  const zeroMassWaived = zeroMassWaivedIds?.has(component.componentKey) === true;
  const cases = loadCaseIds.map((loadCaseId) => projectCase({
    component: resolvedComponent,
    target,
    loadCaseId,
    ancillary,
    compositionProfile,
    zeroMassWaived,
  }));
  return deepFreeze({
    targetId: target.targetId,
    entityId: component.componentKey,
    sourceEntityId: component.sourceEntityId || null,
    componentType: String(component.type || 'OBJECT').toUpperCase(),
    lineTargetId: target.lineTargetId,
    lineKey: target.lineKey,
    derivedDryMassEvidence: derivedDryMass ? deepFreeze({
      valueKg: derivedDryMass.value,
      source: derivedDryMass.source,
      derivation: structuredClone(derivedDryMass.derivation),
      semanticHash: semanticHash(derivedDryMass),
    }) : null,
    cases,
  });
}

function projectCase({ component, target, loadCaseId, ancillary, compositionProfile, zeroMassWaived }) {
  const result = resolveComponentCaseMass(component, loadCaseId, compositionProfile, { zeroMassWaived });
  if (!result.ok) {
    throw codedError(`Current Common Input component ${component.componentKey} cannot project ${loadCaseId} mass.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_NOT_PROJECTABLE', {
        targetId: target.targetId,
        entityId: component.componentKey,
        loadCaseId,
        blockers: structuredClone(result.blockers || []),
      });
  }
  const baseMassResolutionSemanticHash = semanticHash(result);
  if (result.mode === 'DISTRIBUTED') {
    const sourceLengthM = Number(component.geometry?.sourceLengthM);
    if (!(sourceLengthM > 0) || !Number.isFinite(result.massPerLengthKgM) || result.massPerLengthKgM < 0) {
      throw codedError(`Distributed component ${component.componentKey} has invalid resolved mass or source length.`,
        'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_VALUE_INVALID');
    }
    const includeAncillary = String(component.type || '').toUpperCase() === 'PIPE';
    const cladding = includeAncillary ? ancillary.claddingMassPerLengthKgPerM : 0;
    const tracing = includeAncillary ? ancillary.tracingMassPerLengthKgPerM : 0;
    const total = result.massPerLengthKgM + cladding + tracing;
    return deepFreeze({
      loadCaseId,
      mode: 'DISTRIBUTED',
      baseMassResolutionSemanticHash,
      sourceMassPerLengthKgPerM: result.massPerLengthKgM,
      claddingMassPerLengthKgPerM: cladding,
      tracingMassPerLengthKgPerM: tracing,
      totalMassPerLengthKgPerM: total,
      sourceLengthM,
      massKg: total * sourceLengthM,
      sourceMassBreakdown: structuredClone(result.massSourceBreakdown || []),
      formulaTrace: structuredClone(result.formulaTrace || []),
      ancillaryEvidence: includeAncillary ? ancillary.evidence : [],
      diagnostics: structuredClone(result.diagnostics || []),
    });
  }
  if (result.mode !== 'POINT' || !Number.isFinite(result.pointMassKg) || result.pointMassKg < 0) {
    throw codedError(`Point component ${component.componentKey} has invalid resolved mass.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_VALUE_INVALID');
  }
  const containedFluid = componentContainedFluid(component, loadCaseId);
  return deepFreeze({
    loadCaseId,
    mode: 'POINT',
    baseMassResolutionSemanticHash,
    dryPointMassKg: result.pointMassKg,
    containedFluidMassKg: containedFluid.massKg,
    massKg: result.pointMassKg + containedFluid.massKg,
    applicationPoint: result.applicationPoint || null,
    dryMassEvidence: result.sourceEvidence || null,
    containedFluidEvidence: containedFluid.evidence,
    diagnostics: structuredClone(result.diagnostics || []),
  });
}

function ancillaryByLineTarget(inventory, overlay) {
  const lineById = new Map(inventory.lineTargets.map((target) => [target.targetId, target]));
  const result = new Map();
  overlay.targetRecords.filter((record) => record.targetKind === 'LINE').forEach((record) => {
    const target = lineById.get(record.targetId);
    if (!target || target.lineKey !== record.lineKey) {
      throw codedError(`Ancillary overlay target ${record.targetId} is not the exact target inventory line.`,
        'CURRENT_COMMON_INPUT_EMPIRICAL_ANCILLARY_TARGET_MISMATCH');
    }
    const row = zeroAncillary();
    for (const field of record.fields) {
      const property = ANCILLARY_FIELDS[field.field];
      if (!property) continue;
      if (field.unit !== 'kg/m' || field.approved !== true
          || !['RESOLVED_EXACT', 'RESOLVED_DERIVED'].includes(field.status)
          || !Number.isFinite(field.value) || field.value < 0) {
        throw codedError(`Ancillary field ${record.targetId}:${field.field} is not approved non-negative kg/m.`,
          'CURRENT_COMMON_INPUT_EMPIRICAL_ANCILLARY_VALUE_INVALID');
      }
      row[property] = Number(field.value);
      row.evidence.push(deepFreeze({
        field: field.field, value: field.value, unit: field.unit,
        sourceKind: field.sourceKind, sourceKey: field.sourceKey, policyId: field.policyId,
        semanticHash: semanticHash(field),
      }));
    }
    result.set(record.targetId, deepFreeze({
      claddingMassPerLengthKgPerM: row.claddingMassPerLengthKgPerM,
      tracingMassPerLengthKgPerM: row.tracingMassPerLengthKgPerM,
      evidence: [...row.evidence].sort((left, right) => ascii(left.field, right.field)),
    }));
  });
  return result;
}

function componentContainedFluid(component, loadCaseId) {
  if (loadCaseId === 'EMPTY' || String(component.type || '').toUpperCase() === 'PIPE') {
    return deepFreeze({ massKg: 0, evidence: null });
  }
  const property = loadCaseId === 'OPE' ? 'componentFluidWeightOpeKg' : 'componentFluidWeightHydKg';
  const evidence = component.engineeringProperties?.[property] || null;
  const value = evidenceNumber(evidence);
  if (value === null) return deepFreeze({ massKg: 0, evidence: null });
  if (!Number.isFinite(value) || value < 0) {
    throw codedError(`Component ${component.componentKey} ${loadCaseId} contained-fluid mass is invalid.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_COMPONENT_CONTENT_INVALID');
  }
  return deepFreeze({
    massKg: value,
    evidence: deepFreeze({
      property, valueKg: value, sourceKind: evidence.sourceKind || null,
      sourcePath: evidence.sourcePath || null, sourceRoot: evidence.sourceRoot || null,
      semanticHash: semanticHash(evidence),
    }),
  });
}

function validateEntityRow(row, loadCaseIds) {
  if (!isRecord(row) || !Array.isArray(row.cases)) {
    throw codedError('Projection entity row is invalid.', 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_INVALID');
  }
  requiredText(row.targetId, 'targetId');
  if (JSON.stringify(row.cases.map((item) => item.loadCaseId)) !== JSON.stringify(loadCaseIds)) {
    throw codedError(`Projection entity ${row.entityId} load cases differ from the projection case set.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_CASE_COVERAGE_INVALID');
  }
  row.cases.forEach((item) => {
    semanticHashText(item.baseMassResolutionSemanticHash, 'baseMassResolutionSemanticHash');
    if (!Number.isFinite(item.massKg) || item.massKg < 0) {
      throw codedError(`Projection entity ${row.entityId} has invalid ${item.loadCaseId} mass.`,
        'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_VALUE_INVALID');
    }
    if (item.mode === 'DISTRIBUTED') {
      for (const key of ['sourceMassPerLengthKgPerM', 'claddingMassPerLengthKgPerM',
        'tracingMassPerLengthKgPerM', 'totalMassPerLengthKgPerM', 'sourceLengthM']) {
        if (!Number.isFinite(item[key]) || item[key] < 0) {
          throw codedError(`Projection entity ${row.entityId} has invalid distributed ${key}.`,
            'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_VALUE_INVALID');
        }
      }
      if (!(item.sourceLengthM > 0)
          || item.totalMassPerLengthKgPerM !== item.sourceMassPerLengthKgPerM
            + item.claddingMassPerLengthKgPerM + item.tracingMassPerLengthKgPerM
          || item.massKg !== item.totalMassPerLengthKgPerM * item.sourceLengthM) {
        throw codedError(`Projection entity ${row.entityId} distributed mass composition is inconsistent.`,
          'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_COMPOSITION_INVALID');
      }
      return;
    }
    if (item.mode !== 'POINT' || !Number.isFinite(item.dryPointMassKg) || item.dryPointMassKg < 0
        || !Number.isFinite(item.containedFluidMassKg) || item.containedFluidMassKg < 0
        || item.massKg !== item.dryPointMassKg + item.containedFluidMassKg) {
      throw codedError(`Projection entity ${row.entityId} point mass composition is inconsistent.`,
        'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_COMPOSITION_INVALID');
    }
  });
}

function projectionSummary(entityRows, loadCaseIds) {
  const cases = entityRows.flatMap((row) => row.cases);
  return deepFreeze({
    entityCount: entityRows.length,
    loadCaseCount: loadCaseIds.length,
    entityCaseCount: cases.length,
    distributedEntityCaseCount: cases.filter((row) => row.mode === 'DISTRIBUTED').length,
    pointEntityCaseCount: cases.filter((row) => row.mode === 'POINT').length,
    zeroMassEntityCaseCount: cases.filter((row) => row.massKg === 0).length,
    ancillaryEntityCaseCount: cases.filter((row) => row.mode === 'DISTRIBUTED'
      && (row.claddingMassPerLengthKgPerM > 0 || row.tracingMassPerLengthKgPerM > 0)).length,
    containedFluidEntityCaseCount: cases.filter((row) => row.mode === 'POINT'
      && row.containedFluidMassKg > 0).length,
  });
}

function zeroAncillary() {
  return { claddingMassPerLengthKgPerM: 0, tracingMassPerLengthKgPerM: 0, evidence: [] };
}

function normalizeLoadCases(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw codedError('Current Common Input empirical mass projection requires at least one load case.',
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_LOAD_CASE_INVALID');
  }
  const rows = [...new Set(value.map((item) => requiredText(item, 'loadCaseId')))].sort(ascii);
  rows.forEach((loadCaseId) => {
    if (!SUPPORTED_LOAD_CASES.includes(loadCaseId)) {
      throw codedError(`Unsupported empirical mass load case ${loadCaseId}.`,
        'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_LOAD_CASE_INVALID');
    }
  });
  return deepFreeze(rows);
}

function requireFixedPolicy(value) {
  if (!isRecord(value)) throw codedError('Projection policy is invalid.',
    'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_POLICY_INVALID');
  const expected = Object.keys(FIXED_POLICY).sort(ascii);
  const actual = Object.keys(value).sort(ascii);
  if (JSON.stringify(actual) !== JSON.stringify(expected)
      || expected.some((key) => value[key] !== FIXED_POLICY[key])) {
    throw codedError('Projection policy was altered.', 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_POLICY_INVALID');
  }
}

function semanticHashText(value, label) {
  if (typeof value !== 'string' || !/^fnv1a64:[0-9a-f]{16}$/u.test(value)) {
    throw codedError(`${label} must be an FNV-1a semantic hash.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_INVALID');
  }
  return value;
}
function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw codedError(`${label} must be a non-empty trimmed string.`,
      'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_INVALID');
  }
  return value;
}
function withoutSemanticHash(value) {
  const { semanticHash: _semanticHash, ...material } = value;
  return material;
}
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function ascii(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function codedError(message, code, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details === null ? null : deepFreeze(structuredClone(details));
  return error;
}
