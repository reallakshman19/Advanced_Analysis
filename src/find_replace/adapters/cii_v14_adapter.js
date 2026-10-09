const SHA256 = /^[a-f0-9]{64}$/i;

function invariant(condition, code) {
  if (!condition) throw new Error(`CII_V14_ADAPTER_${code}`);
}

function scalar(value) {
  return value == null || ['string', 'number', 'boolean'].includes(typeof value);
}

function evidenceValue(candidate, side) {
  const direct = side === 'before' ? candidate.before : candidate.proposed;
  if (direct !== undefined) return direct;
  const evidence = side === 'before' ? candidate.targetEvidence : candidate.sourceEvidence;
  return evidence?.value;
}

function identity(candidate) {
  return candidate.targetEvidence?.identity
    ?? candidate.targetIdentity
    ?? candidate.targetNodeId
    ?? candidate.targetElementId
    ?? null;
}

function adaptCandidate(candidate) {
  invariant(candidate && typeof candidate === 'object', 'CANDIDATE_OBJECT_REQUIRED');
  invariant(typeof candidate.operationId === 'string' && candidate.operationId.trim(), 'OPERATION_ID_REQUIRED');
  invariant(typeof candidate.family === 'string' && candidate.family.trim(), `FAMILY_REQUIRED:${candidate.operationId}`);
  const before = evidenceValue(candidate, 'before');
  const proposed = evidenceValue(candidate, 'proposed');
  invariant(scalar(before) && scalar(proposed), `SCALAR_VALUES_REQUIRED:${candidate.operationId}`);
  return Object.freeze({
    operationId: candidate.operationId,
    family: candidate.family,
    property: String(candidate.property || ''),
    action: String(candidate.action || ''),
    status: String(candidate.status || ''),
    scopeDecision: String(candidate.scopeDecision || ''),
    targetIdentity: identity(candidate) == null ? null : String(identity(candidate)),
    before,
    proposed,
    policyAuthority: candidate.policyAuthority ?? null,
    evidenceAuthority: candidate.evidenceAuthority ?? null,
  });
}

export function adaptCiiV14Preview(preview) {
  invariant(preview && typeof preview === 'object', 'PREVIEW_REQUIRED');
  const bridge = preview.versionBridge;
  invariant(bridge?.schema === 'CIIWorkspaceWriterVersionBridge.v2', 'VERSION_BRIDGE_V2_REQUIRED');
  invariant(bridge.mode === 'CHANGE_ISOLATED_V14_VIA_V11', 'CHANGE_ISOLATED_V14_MODE_REQUIRED');
  invariant(Number(bridge.source?.originalVersion) === 14, 'SOURCE_V14_REQUIRED');
  invariant(Number(bridge.target?.originalVersion) === 14, 'TARGET_V14_REQUIRED');
  const sourceHash = bridge.source?.originalSha256;
  const targetHash = bridge.target?.originalSha256;
  invariant(SHA256.test(sourceHash || ''), 'SOURCE_SHA256_REQUIRED');
  invariant(SHA256.test(targetHash || ''), 'TARGET_SHA256_REQUIRED');
  invariant(preview.transferPlan?.status === 'PREVIEW_READY', 'TRANSFER_PLAN_PREVIEW_READY_REQUIRED');
  invariant(Array.isArray(preview.transferPlan.operations), 'TRANSFER_OPERATIONS_REQUIRED');
  const candidates = Object.freeze(preview.transferPlan.operations.map(adaptCandidate));
  const ids = candidates.map((candidate) => candidate.operationId);
  invariant(new Set(ids).size === ids.length, 'DUPLICATE_OPERATION_ID');
  return Object.freeze({
    schema: 'AdvancedAnalysisCiiV14CandidateSet.v1',
    sourceHash,
    targetHash,
    upstreamSchema: bridge.schema,
    upstreamMode: bridge.mode,
    candidates,
  });
}
