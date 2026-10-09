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
  NON_FEA_CONFIGURED_DEFAULT_SCOPE_PRECEDENCE,
  createNonFeaConfiguredDefaultProvider,
} from './non-fea-configured-default-provider.js';
import { normalizeEngineeringUnit, sameEngineeringUnit } from './non-fea-unit-equivalence.js';

export const NON_FEA_COMMON_ENRICHED_CONFIGURED_DEFAULT_OVERLAY_SCHEMA =
  'non-fea-common-enriched-configured-default-overlay/v1';
export const NON_FEA_COMMON_ENRICHED_DEFAULT_COMPOSITION_SCHEMA =
  'non-fea-common-enriched-default-composition/v1';

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
 * Projects selected Project Data configured defaults onto the LINE/COMPONENT
 * target model used by common-enriched EMPIRICAL_LOADS readiness.
 *
 * Component-scoped line properties are promoted to one LINE field only when
 * every source component belonging to that line is covered and every selected
 * default has identical value, unit and default-policy identity. Partial or
 * inconsistent coverage is a blocker; no first/nearest/majority value wins.
 */
export function createNonFeaCommonEnrichedConfiguredDefaultOverlay({
  profile,
  sourceModel,
  inventory,
  requestedMethods = ['WEIGHT_AND_GRAVITY'],
} = {}) {
  if (!isRecord(profile)) throw new TypeError('Configured-default common-enriched overlay requires Project Data.');
  if (!isRecord(sourceModel)) throw new TypeError('Configured-default common-enriched overlay requires a shared model.');
  const targetInventory = requireCommonEnrichedTargetInventory(inventory);
  if (targetInventory.sourceModelHash !== sourceModel.semanticHash) {
    throw codedError(
      'Configured-default target inventory belongs to a different source model.',
      'CONFIGURED_DEFAULT_COMMON_INVENTORY_STALE',
    );
  }
  const provider = createNonFeaConfiguredDefaultProvider({
    profile,
    sourceModel,
    requestedMethods,
  });
  const blockers = [...provider.blockers];
  const providerByTargetField = new Map(provider.records.map((record) => [
    `${record.selectorKey}|${record.fieldId}`,
    record,
  ]));
  const targetRecords = [];
  const sourceKey = `PROJECT_CONFIGURED_DEFAULTS:${profile.revision}`;

  for (const target of targetInventory.lineTargets) {
    const fields = [];
    for (const [fieldId, [fieldName, expectedUnit]] of Object.entries(LINE_FIELD_MAP)) {
      const records = target.sourceRecordIds
        .map((sourceRecordId) => providerByTargetField.get(`${sourceRecordId}|${fieldId}`) || null);
      const present = records.filter(Boolean);
      if (present.length === 0) continue;
      if (present.length !== target.sourceRecordIds.length) {
        blockers.push(issue(
          'CONFIGURED_DEFAULT_LINE_PARTIAL_COVERAGE',
          `${target.targetId}:${fieldId}`,
          `Configured default ${fieldId} covers ${present.length}/${target.sourceRecordIds.length} exact source components for ${target.targetId}; it cannot be promoted to one LINE value.`,
        ));
        continue;
      }
      const fingerprints = new Set(present.map(defaultAuthorityFingerprint));
      if (fingerprints.size !== 1) {
        blockers.push(issue(
          'CONFIGURED_DEFAULT_LINE_AUTHORITY_CONFLICT',
          `${target.targetId}:${fieldId}`,
          `Configured default ${fieldId} resolves to different value/policy authorities within ${target.targetId}; one LINE value cannot be inferred.`,
        ));
        continue;
      }
      const selected = [...present].sort((left, right) => left.recordId.localeCompare(right.recordId))[0];
      const field = configuredDefaultField(selected, fieldName, expectedUnit, sourceKey, provider);
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
      const field = configuredDefaultField(selected, fieldName, expectedUnit, sourceKey, provider);
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
    snapshotSemanticHash: provider.semanticHash,
  }) : null;
  const material = {
    schema: NON_FEA_COMMON_ENRICHED_CONFIGURED_DEFAULT_OVERLAY_SCHEMA,
    projectDataRevision: Number.isInteger(profile.revision) ? profile.revision : null,
    sourceModelHash: targetInventory.sourceModelHash,
    inventorySemanticHash: targetInventory.semanticHash,
    configuredDefaultProviderSemanticHash: provider.semanticHash,
    configuredDefaultPolicyHash: provider.configuredDefaultPolicyHash,
    scopePrecedence: NON_FEA_CONFIGURED_DEFAULT_SCOPE_PRECEDENCE,
    sourceBinding,
    targetRecords: targetRecords.sort(byTarget),
    blockers: dedupeIssues(blockers),
  };
  return freezeDeep({ ...material, semanticHash: semanticHash(material) });
}

/**
 * Applies only missing-field defaults to an UNAPPROVED common-enriched
 * candidate. Resolved evidence is retained and recorded as shadowing the
 * default. Ambiguous/conflicting/stale fields remain blockers and cannot be
 * converted to routine defaults.
 */
export function composeCommonEnrichedCandidateWithConfiguredDefaults({
  candidate,
  overlay,
  candidateId,
  revision,
  createdAt,
} = {}) {
  const sourceCandidate = requireCommonEnrichedPropertiesCandidate(candidate);
  const defaults = requireConfiguredDefaultOverlay(overlay);
  if (defaults.blockers.length) {
    throw codedError(
      'Configured-default overlay is blocked and cannot be composed.',
      'CONFIGURED_DEFAULT_COMMON_OVERLAY_BLOCKED',
      defaults.blockers,
    );
  }
  if (sourceCandidate.sourceModelHash !== defaults.sourceModelHash) {
    throw codedError(
      'Configured-default overlay and candidate source models differ.',
      'CONFIGURED_DEFAULT_COMMON_SOURCE_MISMATCH',
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
        `Configured-default target ${record.targetId} does not match the candidate identity.`,
        'CONFIGURED_DEFAULT_COMMON_TARGET_MISMATCH',
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
          `Configured default cannot mask ${current.status} for ${record.targetId}:${current.field}.`,
          'CONFIGURED_DEFAULT_COMMON_NON_MISSING_BLOCKER',
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
        'Configured-default source binding conflicts with an existing candidate source key.',
        'CONFIGURED_DEFAULT_COMMON_SOURCE_BINDING_CONFLICT',
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
    schema: NON_FEA_COMMON_ENRICHED_DEFAULT_COMPOSITION_SCHEMA,
    sourceCandidateSemanticHash: sourceCandidate.semanticHash,
    configuredDefaultOverlaySemanticHash: defaults.semanticHash,
    appliedRows: appliedRows.sort(byReceipt),
    shadowedRows: shadowedRows.sort(byReceipt),
    candidate: composed,
  };
  return freezeDeep({ ...material, semanticHash: semanticHash(material) });
}

export function requireConfiguredDefaultOverlay(value) {
  if (!isRecord(value)
      || value.schema !== NON_FEA_COMMON_ENRICHED_CONFIGURED_DEFAULT_OVERLAY_SCHEMA
      || !Array.isArray(value.targetRecords)
      || !Array.isArray(value.blockers)) {
    throw codedError(
      `Expected ${NON_FEA_COMMON_ENRICHED_CONFIGURED_DEFAULT_OVERLAY_SCHEMA}.`,
      'CONFIGURED_DEFAULT_COMMON_OVERLAY_INVALID',
    );
  }
  const { semanticHash: suppliedHash, ...material } = value;
  if (suppliedHash !== semanticHash(material)) {
    throw codedError(
      'Configured-default common-enriched overlay semantic hash is stale.',
      'CONFIGURED_DEFAULT_COMMON_OVERLAY_HASH_MISMATCH',
    );
  }
  return freezeDeep(value);
}

function configuredDefaultField(record, fieldName, expectedUnit, sourceKey, provider) {
  if (!sameEngineeringUnit(record.unit, expectedUnit)) {
    return {
      value: null,
      blocker: issue(
        'CONFIGURED_DEFAULT_COMMON_UNIT_UNSUPPORTED',
        `${record.selectorKey}:${record.fieldId}`,
        `Configured default ${record.evidence?.defaultId || record.recordId} uses ${record.unit}; ${fieldName} requires ${expectedUnit}.`,
      ),
    };
  }
  const defaultId = requiredText(record.evidence?.defaultId, 'configured default ID');
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
      sourceKind: 'PROJECT_CONFIGURED_DEFAULT',
      sourceKey,
      sourceHash: provider.semanticHash,
      locator: `DEFAULT:${defaultId}`,
      matchMethod: 'EXACT_CONFIGURED_DEFAULT_SCOPE',
      confidence: 1,
      policyId: defaultId,
      policyHash: provider.configuredDefaultPolicyHash,
      reviewEventId: null,
      approved: true,
      diagnostics: [NON_FEA_CONFIGURED_DEFAULT_SCOPE_PRECEDENCE],
    }),
  };
}

function defaultAuthorityFingerprint(record) {
  return semanticHash({
    value: record.value,
    // Normalized so two records spelling the same unit differently read as
    // one authority rather than a conflict that cannot be resolved.
    unit: normalizeEngineeringUnit(record.unit),
    defaultId: record.evidence?.defaultId || null,
    basis: record.evidence?.basis || null,
    configuredDefaultPolicyHash: record.evidence?.configuredDefaultPolicyHash || null,
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
  if (!text) throw codedError(`${label} is required.`, 'CONFIGURED_DEFAULT_COMMON_INPUT_INVALID');
  return text;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw codedError(`${label} must be a positive integer.`, 'CONFIGURED_DEFAULT_COMMON_INPUT_INVALID');
  }
  return value;
}

function canonicalTimestamp(value, label) {
  const text = requiredText(value, label);
  if (new Date(text).toISOString() !== text) {
    throw codedError(`${label} must be canonical ISO-8601 UTC.`, 'CONFIGURED_DEFAULT_COMMON_INPUT_INVALID');
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
