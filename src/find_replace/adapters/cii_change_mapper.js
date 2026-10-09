const SUPPORTED_ACTIONS = new Set(['COPY', 'REPLACE']);
const ELEMENT_FAMILIES = new Set(['NODE_NAME', 'GEOMETRY', 'PIPE', 'BEND', 'RESTRAINT', 'SIF_TEE', 'HANGER']);

function invariant(condition, code) {
  if (!condition) throw new Error(`CII_CHANGE_MAPPER_${code}`);
}

function text(value) {
  return value == null ? '' : String(value);
}

function mapCandidate(candidate) {
  invariant(candidate.status === 'PREVIEW_READY', `CANDIDATE_NOT_READY:${candidate.operationId}`);
  invariant(candidate.scopeDecision === 'APPLY', `CANDIDATE_NOT_APPLIED:${candidate.operationId}`);
  invariant(SUPPORTED_ACTIONS.has(candidate.action), `ACTION_UNSUPPORTED:${candidate.operationId}:${candidate.action}`);
  invariant(candidate.before !== candidate.proposed, `NO_CHANGE:${candidate.operationId}`);
  invariant(candidate.targetIdentity, `TARGET_IDENTITY_REQUIRED:${candidate.operationId}`);
  const scope = ELEMENT_FAMILIES.has(candidate.family) ? 'ELEMENT' : 'BLOCK';
  return Object.freeze({
    schema: 'FindReplaceOperation.v1',
    scope,
    from: candidate.targetIdentity,
    to: candidate.targetIdentity,
    block: candidate.family,
    findText: text(candidate.before),
    replaceText: text(candidate.proposed),
    provenance: Object.freeze({
      source: 'XML_COMPARE_UTILITIES_CII_V14',
      candidateOperationId: candidate.operationId,
      property: candidate.property,
      policyAuthority: candidate.policyAuthority,
      evidenceAuthority: candidate.evidenceAuthority,
    }),
  });
}

export function mapCiiCandidatesToTransaction(candidateSet) {
  invariant(candidateSet?.schema === 'AdvancedAnalysisCiiV14CandidateSet.v1', 'CANDIDATE_SET_V1_REQUIRED');
  invariant(Array.isArray(candidateSet.candidates), 'CANDIDATES_REQUIRED');
  const operations = Object.freeze(candidateSet.candidates.map(mapCandidate));
  invariant(operations.length > 0, 'EMPTY_TRANSACTION');
  return Object.freeze({
    schema: 'FindReplaceTransaction.v1',
    sourceHash: candidateSet.targetHash,
    evidenceSourceHash: candidateSet.sourceHash,
    targetVersion: 14,
    operations,
  });
}
