import {
  COMMON_ENRICHED_CANDIDATE_SCHEMA,
  COMMON_ENRICHED_CANDIDATE_STATUS,
  COMMON_ENRICHED_SOURCE_BINDING_SCHEMA,
  createCommonEnrichedPropertiesCandidate,
  requireCommonEnrichedPropertiesCandidate,
} from '../../core/common-enriched-properties/candidate.js';
import {
  COMMON_ENRICHED_FIELD_SCHEMA,
  requireCommonEnrichedField,
} from '../../core/common-enriched-properties/field.js';
import {
  COMMON_ENRICHED_TARGET_RECORD_SCHEMA,
  createCommonEnrichedTargetRecord,
} from '../../core/common-enriched-properties/target-record.js';
import {
  requireCommonEnrichedTargetInventory,
} from '../../core/common-enriched-properties/target-inventory.js';
import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { freezeDeep, isRecord, stringValue } from '../dataset-utils.js';
import {
  createNonFeaProductEngineeringDefaultProvider,
  requireProductEngineeringDefaultProfile,
} from './non-fea-product-engineering-default-profile.js';
import { normalizeEngineeringUnit, sameEngineeringUnit } from './non-fea-unit-equivalence.js';

export const NON_FEA_COMMON_ENRICHED_PRODUCT_DEFAULT_OVERLAY_SCHEMA =
  'non-fea-common-enriched-product-default-overlay/v1';
export const NON_FEA_COMMON_ENRICHED_PRODUCT_DEFAULT_COMPOSITION_SCHEMA =
  'non-fea-common-enriched-product-default-composition/v1';

const LINE_FIELD_MAP = Object.freeze({
  PIPE_OUTER_DIAMETER: ['pipe.outsideDiameterMm', 'mm'],
  PIPE_WALL_THICKNESS: ['pipe.wallThicknessMm', 'mm'],
  MATERIAL_DENSITY: ['material.densityKgM3', 'kg/m3'],
  OPERATING_FLUID_DENSITY: ['fluid.operatingDensityKgM3', 'kg/m3'],
  HYDRO_FLUID_DENSITY: ['fluid.hydroDensityKgM3', 'kg/m3'],
  INSULATION_THICKNESS: ['insulation.thicknessMm', 'mm'],
  INSULATION_DENSITY: ['insulation.densityKgM3', 'kg/m3'],
  CLADDING_WEIGHT: ['permanent.claddingWeightKgPerM', 'kg/m'],
  TRACING_WEIGHT: ['permanent.tracingWeightKgPerM', 'kg/m'],
});
const COMPONENT_FIELD_MAP = Object.freeze({
  COMPONENT_WEIGHT: ['component.weightKg', 'kg'],
  COMPONENT_OPERATING_FLUID_WEIGHT: ['component.fluidWeightOpeKg', 'kg'],
  COMPONENT_HYDRO_FLUID_WEIGHT: ['component.fluidWeightHydKg', 'kg'],
});
const NON_MISSING_BLOCKED = new Set([
  'BLOCKED_AMBIGUOUS',
  'BLOCKED_CONFLICT',
  'BLOCKED_STALE_SOURCE',
]);

/**
 * Projects an explicitly supplied, versioned product engineering-default table
 * onto the LINE/COMPONENT target model used by common-enriched EMPIRICAL_LOADS
 * readiness. The shipped product table is empty; this overlay invents no OD,
 * wall, density, insulation, ancillary distributed mass, or component mass on
 * its own.
 *
 * Component-scoped line values may promote to one LINE field only when every
 * exact source component on the line is covered by one identical product row
 * authority (value, unit, row hash and product-profile hash). Partial or mixed
 * product authority fails closed rather than choosing or averaging a value.
 */
export function createNonFeaCommonEnrichedProductDefaultOverlay({
  defaultProfile,
  sourceModel,
  inventory,
  requestedMethods = ['WEIGHT_AND_GRAVITY'],
} = {}) {
  if (!isRecord(sourceModel)) {
    throw codedError(
      'Product-default common-enriched overlay requires a shared model.',
      'PRODUCT_DEFAULT_COMMON_SOURCE_MODEL_INVALID',
    );
  }
  const productProfile = requireProductEngineeringDefaultProfile(defaultProfile);
  const targetInventory = requireCommonEnrichedTargetInventory(inventory);
  if (targetInventory.sourceModelHash !== sourceModel.semanticHash) {
    throw codedError(
      'Product-default target inventory belongs to a different source model.',
      'PRODUCT_DEFAULT_COMMON_INVENTORY_STALE',
    );
  }
  const provider = createNonFeaProductEngineeringDefaultProvider({
    defaultProfile: productProfile,
    sourceModel,
    requestedMethods,
  });
  const blockers = [...provider.blockers];
  const providerByTargetField = new Map(provider.records.map((record) => [
    `${record.selectorKey}|${record.fieldId}`,
    record,
  ]));
  const targetRecords = [];
  const sourceKey = `PRODUCT_ENGINEERING_DEFAULTS:${provider.profileId}@${provider.profileVersion}`;

  for (const target of targetInventory.lineTargets) {
    const fields = [];
    for (const [fieldId, [fieldName, expectedUnit]] of Object.entries(LINE_FIELD_MAP)) {
      const records = target.sourceRecordIds
        .map((sourceRecordId) => providerByTargetField.get(`${sourceRecordId}|${fieldId}`) || null);
      const present = records.filter(Boolean);
      if (present.length === 0) continue;
      if (present.length !== target.sourceRecordIds.length) {
        blockers.push(issue(
          'PRODUCT_DEFAULT_LINE_PARTIAL_COVERAGE',
          `${target.targetId}:${fieldId}`,
          `Product default ${fieldId} covers ${present.length}/${target.sourceRecordIds.length} exact source components for ${target.targetId}; it cannot be promoted to one LINE value.`,
        ));
        continue;
      }
      const fingerprints = new Set(present.map(productAuthorityFingerprint));
      if (fingerprints.size !== 1) {
        blockers.push(issue(
          'PRODUCT_DEFAULT_LINE_AUTHORITY_CONFLICT',
          `${target.targetId}:${fieldId}`,
          `Product default ${fieldId} resolves to different value/product-row authorities within ${target.targetId}; one LINE value cannot be inferred.`,
        ));
        continue;
      }
      const selected = [...present].sort((left, right) => left.recordId.localeCompare(right.recordId))[0];
      const field = productDefaultField(selected, fieldName, expectedUnit, sourceKey, provider);
      if (field.blocker) blockers.push(field.blocker);
      else fields.push(field.value);
    }
    if (fields.length) {
      targetRecords.push(createCommonEnrichedTargetRecord({
        schema: COMMON_ENRICHED_TARGET_RECORD_SCHEMA,
        targetId: target.targetId,
        targetKind: 'LINE',
        sourceModelHash: targetInventory.sourceModelHash,
        sourceRecordId: target.targetId,
        lineKey: target.lineKey,
        fields: fields.sort(byField),
      }));
    }
  }

  for (const target of targetInventory.componentTargets) {
    const fields = [];
    for (const [fieldId, [fieldName, expectedUnit]] of Object.entries(COMPONENT_FIELD_MAP)) {
      const selected = providerByTargetField.get(`${target.sourceRecordId}|${fieldId}`) || null;
      if (!selected) continue;
      const field = productDefaultField(selected, fieldName, expectedUnit, sourceKey, provider);
      if (field.blocker) blockers.push(field.blocker);
      else fields.push(field.value);
    }
    if (fields.length) {
      targetRecords.push(createCommonEnrichedTargetRecord({
        schema: COMMON_ENRICHED_TARGET_RECORD_SCHEMA,
        targetId: target.targetId,
        targetKind: 'COMPONENT',
        sourceModelHash: targetInventory.sourceModelHash,
        sourceRecordId: target.sourceRecordId,
        lineKey: target.lineKey,
        fields: fields.sort(byField),
      }));
    }
  }

  const sourceBinding = targetRecords.length ? freezeDeep({
    schema: COMMON_ENRICHED_SOURCE_BINDING_SCHEMA,
    sourceKey,
    sourceHash: provider.semanticHash,
    snapshotSemanticHash: provider.productDefaultProfileSemanticHash,
  }) : null;
  const material = {
    schema: NON_FEA_COMMON_ENRICHED_PRODUCT_DEFAULT_OVERLAY_SCHEMA,
    productProfileId: provider.profileId,
    productProfileVersion: provider.profileVersion,
    productDefaultProfileSemanticHash: provider.productDefaultProfileSemanticHash,
    productDefaultProviderSemanticHash: provider.semanticHash,
    sourceModelHash: targetInventory.sourceModelHash,
    inventorySemanticHash: targetInventory.semanticHash,
    sourceBinding,
    targetRecords: targetRecords.sort(byTarget),
    blockers: dedupeIssues(blockers),
  };
  return freezeDeep({ ...material, semanticHash: semanticHash(material) });
}

/**
 * Applies only product defaults to fields that remain missing after all higher
 * authorities have had an opportunity to resolve them. A resolved Project Data
 * default therefore shadows PRODUCT_DEFAULT exactly as Issue #1321 requires.
 */
export function composeCommonEnrichedCandidateWithProductDefaults({
  candidate,
  overlay,
  candidateId,
  revision,
  createdAt,
} = {}) {
  const sourceCandidate = requireCommonEnrichedPropertiesCandidate(candidate);
  const defaults = requireProductDefaultOverlay(overlay);
  if (defaults.blockers.length) {
    throw codedError(
      'Product-default overlay is blocked and cannot be composed.',
      'PRODUCT_DEFAULT_COMMON_OVERLAY_BLOCKED',
      defaults.blockers,
    );
  }
  if (sourceCandidate.sourceModelHash !== defaults.sourceModelHash) {
    throw codedError(
      'Product-default overlay and candidate source models differ.',
      'PRODUCT_DEFAULT_COMMON_SOURCE_MISMATCH',
    );
  }

  const overlayByTarget = new Map(defaults.targetRecords.map((record) => [record.targetId, record]));
  const appliedRows = [];
  const shadowedRows = [];
  const targetRecords = sourceCandidate.targetRecords.map((record) => {
    const overlayRecord = overlayByTarget.get(record.targetId);
    if (!overlayRecord) return record;
    if (overlayRecord.targetKind !== record.targetKind
        || overlayRecord.sourceRecordId !== record.sourceRecordId
        || overlayRecord.lineKey !== record.lineKey) {
      throw codedError(
        `Product-default target ${record.targetId} does not match the candidate identity.`,
        'PRODUCT_DEFAULT_COMMON_TARGET_MISMATCH',
      );
    }
    const fields = [...record.fields];
    for (const defaultField of overlayRecord.fields) {
      const index = fields.findIndex((field) => field.field === defaultField.field);
      if (index < 0) {
        fields.push(defaultField);
        appliedRows.push(receipt(record.targetId, defaultField, 'FIELD_ABSENT'));
        continue;
      }
      const current = fields[index];
      if (current.status === 'BLOCKED_MISSING') {
        fields[index] = defaultField;
        appliedRows.push(receipt(record.targetId, defaultField, 'BLOCKED_MISSING'));
        continue;
      }
      if (NON_MISSING_BLOCKED.has(current.status)) {
        throw codedError(
          `Product default cannot mask ${current.status} for ${record.targetId}:${current.field}.`,
          'PRODUCT_DEFAULT_COMMON_NON_MISSING_BLOCKER',
          { targetId: record.targetId, field: current.field, status: current.status },
        );
      }
      shadowedRows.push(freezeDeep({
        targetId: record.targetId,
        field: defaultField.field,
        defaultPolicyId: defaultField.policyId,
        retainedStatus: current.status,
        retainedSourceKind: current.sourceKind,
      }));
    }
    return createCommonEnrichedTargetRecord({
      schema: COMMON_ENRICHED_TARGET_RECORD_SCHEMA,
      targetId: record.targetId,
      targetKind: record.targetKind,
      sourceModelHash: record.sourceModelHash,
      sourceRecordId: record.sourceRecordId,
      lineKey: record.lineKey,
      fields: fields.sort(byField),
    });
  });

  const sourceSnapshots = [...sourceCandidate.sourceSnapshots];
  if (appliedRows.length && defaults.sourceBinding) {
    const existing = sourceSnapshots.find((row) => row.sourceKey === defaults.sourceBinding.sourceKey);
    if (existing && semanticHash(existing) !== semanticHash(defaults.sourceBinding)) {
      throw codedError(
        'Product-default source binding conflicts with an existing candidate source key.',
        'PRODUCT_DEFAULT_COMMON_SOURCE_BINDING_CONFLICT',
      );
    }
    if (!existing) sourceSnapshots.push(defaults.sourceBinding);
  }
  sourceSnapshots.sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));

  const composed = createCommonEnrichedPropertiesCandidate({
    schema: COMMON_ENRICHED_CANDIDATE_SCHEMA,
    candidateId: requiredText(candidateId, 'candidateId'),
    projectId: sourceCandidate.projectId,
    revision: positiveInteger(revision, 'revision'),
    createdAt: canonicalTimestamp(createdAt, 'createdAt'),
    status: COMMON_ENRICHED_CANDIDATE_STATUS,
    sourceModelHash: sourceCandidate.sourceModelHash,
    sourceSnapshots,
    targetRecords: targetRecords.sort(byTarget),
    reviewLedgerHash: sourceCandidate.reviewLedgerHash,
  });
  const material = {
    schema: NON_FEA_COMMON_ENRICHED_PRODUCT_DEFAULT_COMPOSITION_SCHEMA,
    sourceCandidateSemanticHash: sourceCandidate.semanticHash,
    productDefaultOverlaySemanticHash: defaults.semanticHash,
    appliedRows: appliedRows.sort(byReceipt),
    shadowedRows: shadowedRows.sort(byReceipt),
    candidate: composed,
  };
  return freezeDeep({ ...material, semanticHash: semanticHash(material) });
}

export function requireProductDefaultOverlay(value) {
  if (!isRecord(value)
      || value.schema !== NON_FEA_COMMON_ENRICHED_PRODUCT_DEFAULT_OVERLAY_SCHEMA
      || !Array.isArray(value.targetRecords)
      || !Array.isArray(value.blockers)) {
    throw codedError(
      `Expected ${NON_FEA_COMMON_ENRICHED_PRODUCT_DEFAULT_OVERLAY_SCHEMA}.`,
      'PRODUCT_DEFAULT_COMMON_OVERLAY_INVALID',
    );
  }
  const { semanticHash: suppliedHash, ...material } = value;
  if (suppliedHash !== semanticHash(material)) {
    throw codedError(
      'Product-default common-enriched overlay semantic hash is stale.',
      'PRODUCT_DEFAULT_COMMON_OVERLAY_HASH_MISMATCH',
    );
  }
  return freezeDeep(value);
}

function productDefaultField(record, fieldName, expectedUnit, sourceKey, provider) {
  if (!sameEngineeringUnit(record.unit, expectedUnit)) {
    return {
      value: null,
      blocker: issue(
        'PRODUCT_DEFAULT_COMMON_UNIT_UNSUPPORTED',
        `${record.selectorKey}:${record.fieldId}`,
        `Product default ${record.evidence?.defaultId || record.recordId} uses ${record.unit}; ${fieldName} requires ${expectedUnit}.`,
      ),
    };
  }
  const defaultId = requiredText(record.evidence?.defaultId, 'product default ID');
  const defaultSemanticHash = requiredHash(
    record.evidence?.defaultSemanticHash,
    'product default semantic hash',
  );
  const productDefaultProfileSemanticHash = requiredHash(
    record.evidence?.productDefaultProfileSemanticHash,
    'product default profile semantic hash',
  );
  return {
    blocker: null,
    value: requireCommonEnrichedField({
      schema: COMMON_ENRICHED_FIELD_SCHEMA,
      field: fieldName,
      value: record.value,
      // The declared and expected units are equivalent by the guard above, so
      // the record carries the common-enriched layer's own ASCII spelling:
      // requireCommonEnrichedField rejects a typographic unit outright.
      unit: expectedUnit,
      status: 'RESOLVED_DERIVED',
      sourceKind: 'PRODUCT_DEFAULT',
      sourceKey,
      sourceHash: defaultSemanticHash,
      locator: `PRODUCT_DEFAULT:${defaultId}`,
      matchMethod: 'EXACT_PRODUCT_DEFAULT_SCOPE',
      confidence: 1,
      policyId: defaultId,
      policyHash: productDefaultProfileSemanticHash,
      reviewEventId: null,
      approved: true,
      diagnostics: [
        String(record.evidence?.scopePrecedence || 'ISSUE_1321_SCOPE_PRECEDENCE_V1'),
        `PRODUCT_PROFILE:${provider.profileId}@${provider.profileVersion}`,
      ].sort(),
    }),
  };
}

function productAuthorityFingerprint(record) {
  return semanticHash({
    value: record.value,
    // Normalized so two records spelling the same unit differently read as
    // one authority rather than a conflict that cannot be resolved.
    unit: normalizeEngineeringUnit(record.unit),
    defaultSemanticHash: record.evidence?.defaultSemanticHash || null,
    productDefaultProfileSemanticHash:
      record.evidence?.productDefaultProfileSemanticHash || null,
  });
}

function receipt(targetId, field, replacedStatus) {
  return freezeDeep({
    targetId,
    field: field.field,
    defaultPolicyId: field.policyId,
    replacedStatus,
    sourceKind: field.sourceKind,
  });
}

function dedupeIssues(rows) {
  const byKey = new Map();
  rows.forEach((row) => byKey.set(`${row.code}|${row.path}|${row.message}`, row));
  return freezeDeep([...byKey.values()].sort((left, right) => (
    `${left.code}|${left.path}`.localeCompare(`${right.code}|${right.path}`)
  )));
}

function issue(code, path, message) {
  return freezeDeep({ code, path, message });
}

function requiredText(value, label) {
  const text = stringValue(value);
  if (!text) throw codedError(`${label} is required.`, 'PRODUCT_DEFAULT_COMMON_INPUT_INVALID');
  return text;
}

function requiredHash(value, label) {
  const text = requiredText(value, label);
  if (!/^fnv1a64:[0-9a-f]{16}$/u.test(text)) {
    throw codedError(`${label} must be an FNV-1a semantic hash.`, 'PRODUCT_DEFAULT_COMMON_INPUT_INVALID');
  }
  return text;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw codedError(`${label} must be a positive integer.`, 'PRODUCT_DEFAULT_COMMON_INPUT_INVALID');
  }
  return value;
}

function canonicalTimestamp(value, label) {
  const text = requiredText(value, label);
  if (new Date(text).toISOString() !== text) {
    throw codedError(`${label} must be canonical ISO-8601 UTC.`, 'PRODUCT_DEFAULT_COMMON_INPUT_INVALID');
  }
  return text;
}

function byField(left, right) {
  return left.field.localeCompare(right.field);
}

function byTarget(left, right) {
  return left.targetId.localeCompare(right.targetId);
}

function byReceipt(left, right) {
  return `${left.targetId}|${left.field}|${left.defaultPolicyId}`
    .localeCompare(`${right.targetId}|${right.field}|${right.defaultPolicyId}`);
}

function codedError(message, code, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}
