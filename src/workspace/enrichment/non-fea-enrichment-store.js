import { freezeDeep } from '../dataset-utils.js';
import { buildApproximateMatchPreview, requiresApproximateMatchReview } from './approximate-match-preview.js';
import { nonFeaCommonInputStore } from '../non-fea-common-input-store.js';
import {
  NON_FEA_ENRICHMENT_SCHEMAS,
  acceptNonFeaEnrichmentProposal,
  createNonFeaEnrichmentProposal,
  createNonFeaEnrichmentSidecar,
} from '../../core/non-fea-enrichment/index.js';
import {
  validateNonFeaMasterExactCandidateBatch,
} from '../../core/non-fea-enrichment/master-exact-candidates.js';

/**
 * Stages exact enrichment proposals and accepted sidecar records.
 *
 * The store owns no source-model entities and no calculation result. Accepted
 * records remain bound to the exact source semantic hash on which they were
 * reviewed. A source change makes them stale until an explicit exact-match
 * revalidation action is completed by the view/controller.
 */
export class NonFeaEnrichmentStore {
  #snapshot = emptySnapshot(0);

  loadSource(sourceSemanticHash) {
    const next = typeof sourceSemanticHash === 'string' ? sourceSemanticHash : '';
    if (next === this.#snapshot.currentSourceSemanticHash) return this.#snapshot;
    const acceptedBecomeStale = Boolean(
      this.#snapshot.acceptedRecords.length
      && this.#snapshot.boundSourceSemanticHash
      && this.#snapshot.boundSourceSemanticHash !== next
    );
    const snapshot = this.#update({
      currentSourceSemanticHash: next,
      stale: acceptedBecomeStale,
      message: next ? 'Active source changed; accepted records were checked for staleness.' : '',
      error: '',
    });
    if (acceptedBecomeStale) nonFeaCommonInputStore.markStale('ENRICHMENT_SOURCE_CHANGED', 'enrichmentSidecarSemanticHash', 'Accepted enrichment records are bound to a different source model.');
    return snapshot;
  }

  stageProposal(input) {
    const proposal = createNonFeaEnrichmentProposal(input);
    const proposals = [
      ...this.#snapshot.proposals.filter((row) => row.proposalId !== proposal.proposalId),
      proposal,
    ].sort((left, right) => left.proposalId.localeCompare(right.proposalId));
    return this.#update({ proposals, message: `Staged exact proposal ${proposal.proposalId}.`, error: '' });
  }

  stageMasterCandidateBatch(input) {
    const batch = validateNonFeaMasterExactCandidateBatch(input);
    if (batch.status !== 'READY_FOR_REVIEW') {
      throw new TypeError('Blocked approved-master candidate batches cannot be staged for acceptance.');
    }
    const currentHash = requiredSourceHash(this.#snapshot.currentSourceSemanticHash);
    if (batch.sourceSemanticHash !== currentHash) {
      throw new TypeError('Approved-master candidate batch is stale against the active source model.');
    }
    const proposalsById = new Map(this.#snapshot.proposals.map((row) => [row.proposalId, row]));
    batch.proposals.forEach((proposal) => proposalsById.set(proposal.proposalId, proposal));
    return this.#update({
      proposals: [...proposalsById.values()].sort((left, right) => left.proposalId.localeCompare(right.proposalId)),
      message: `Staged ${batch.proposals.length} exact approved-master proposals for explicit review.`,
      error: '',
    });
  }

  stageMigratedRecords(report) {
    if (!report || report.schema !== NON_FEA_ENRICHMENT_SCHEMAS.LEGACY_MIGRATION) {
      throw new TypeError('A Non-FEA legacy migration report is required.');
    }
    const migrated = report.records.map((record) => createNonFeaEnrichmentProposal({
      proposalId: `migration:${record.recordId}`,
      record,
      rationale: `Review migrated ${record.migration?.legacyAuthority || 'legacy'} evidence before acceptance.`,
    }));
    const byId = new Map(this.#snapshot.proposals.map((row) => [row.proposalId, row]));
    migrated.forEach((row) => byId.set(row.proposalId, row));
    return this.#update({
      proposals: [...byId.values()].sort((left, right) => left.proposalId.localeCompare(right.proposalId)),
      migrationReport: report,
      message: report.blockers?.length
        ? `Staged ${migrated.length} migrated records; acceptance is blocked by ${report.blockers.length} migration decisions.`
        : `Staged ${migrated.length} migrated records for explicit review.`,
      error: '',
    });
  }

  importAcceptedSidecar(sidecar) {
    if (!sidecar || sidecar.schema !== NON_FEA_ENRICHMENT_SCHEMAS.SIDECAR) {
      throw new TypeError(`Expected ${NON_FEA_ENRICHMENT_SCHEMAS.SIDECAR}.`);
    }
    const validated = createNonFeaEnrichmentSidecar(sidecar);
    if (sidecar.semanticHash !== validated.semanticHash) {
      throw new TypeError('Imported enrichment sidecar semantic hash is invalid.');
    }
    return this.#updateAuthority({
      acceptedRecords: validated.records,
      boundSourceSemanticHash: validated.sourceSemanticHash,
      stale: validated.sourceSemanticHash !== this.#snapshot.currentSourceSemanticHash,
      proposals: [],
      migrationReport: null,
      message: `Imported ${validated.records.length} accepted common-enrichment records.`,
      error: '',
    }, 'ENRICHMENT_SIDECAR_IMPORTED', 'An accepted enrichment sidecar was imported.');
  }

  acceptProposal(proposalId, decision = {}) {
    const proposal = this.#snapshot.proposals.find((row) => row.proposalId === proposalId);
    if (!proposal) throw new RangeError(`Unknown enrichment proposal: ${proposalId}.`);
    if (requiresApproximateMatchReview(proposal)) {
      throw new TypeError('Review and explicitly confirm the complete approximate master match in the preview before accepting.');
    }
    if (proposal.record.migration && this.#snapshot.migrationReport?.blockers?.length) {
      throw new TypeError('Resolve all migration blockers before accepting migrated records.');
    }
    const currentHash = requiredSourceHash(this.#snapshot.currentSourceSemanticHash);
    const proposalSourceHash = proposal.record.evidence?.sourceSemanticHash;
    if (proposalSourceHash && proposalSourceHash !== currentHash) {
      throw new TypeError('Enrichment proposal is stale against the active source model.');
    }
    if (this.#snapshot.boundSourceSemanticHash && this.#snapshot.boundSourceSemanticHash !== currentHash) {
      throw new TypeError('Accepted records are stale. Revalidate or clear them before accepting another proposal.');
    }
    const accepted = acceptNonFeaEnrichmentProposal(proposal, decision);
    const records = [
      ...this.#snapshot.acceptedRecords.filter((row) => row.recordId !== accepted.recordId),
      accepted,
    ];
    createNonFeaEnrichmentSidecar({ sourceSemanticHash: currentHash, records });
    return this.#updateAuthority({
      acceptedRecords: records,
      boundSourceSemanticHash: currentHash,
      stale: false,
      proposals: this.#snapshot.proposals.filter((row) => row.proposalId !== proposalId),
      message: `Accepted exact enrichment record ${accepted.recordId}.`,
      error: '',
    }, 'ENRICHMENT_RECORD_ACCEPTED', `Accepted enrichment record ${accepted.recordId}.`);
  }

  acceptReviewedApproximateMatch(proposalIds, decision = {}) {
    if (decision.approximateMatchConfirmed !== true || !decision.acceptanceBasis?.trim()) {
      throw new TypeError('Explicit approximate-match confirmation and an acceptance basis are required.');
    }
    const ids = new Set(proposalIds);
    if (!ids.size || ids.size !== proposalIds.length) throw new TypeError('A unique, non-empty proposal group is required.');
    const currentHash = requiredSourceHash(this.#snapshot.currentSourceSemanticHash);
    if (this.#snapshot.stale || (this.#snapshot.boundSourceSemanticHash && this.#snapshot.boundSourceSemanticHash !== currentHash)) {
      throw new TypeError('Accepted records are stale. Revalidate or clear them before applying a reviewed match.');
    }
    const proposals = [...ids].map((id) => {
      const proposal = this.#snapshot.proposals.find((row) => row.proposalId === id);
      if (!proposal || !requiresApproximateMatchReview(proposal)) throw new TypeError('Every reviewed proposal must be a staged approximate match.');
      if (proposal.record.evidence?.sourceSemanticHash !== currentHash) throw new TypeError('Approximate match is stale against the active source model.');
      if (proposal.record.migration && this.#snapshot.migrationReport?.blockers?.length) throw new TypeError('Resolve migration blockers before applying a reviewed match.');
      return proposal;
    });
    const groups = buildApproximateMatchPreview(this.#snapshot.proposals);
    const group = groups.find((row) => row.proposals.some((proposal) => ids.has(proposal.proposalId)));
    if (!group || group.proposals.length !== ids.size || group.proposals.some((proposal) => !ids.has(proposal.proposalId))) {
      throw new TypeError('Review and apply one complete preview group at a time.');
    }
    const recordsById = new Map(this.#snapshot.acceptedRecords.map((record) => [record.recordId, record]));
    proposals.forEach((proposal) => {
      const record = acceptNonFeaEnrichmentProposal(proposal, decision);
      recordsById.set(record.recordId, record);
    });
    const records = [...recordsById.values()];
    // Validate the whole transaction before mutating any accepted authority.
    createNonFeaEnrichmentSidecar({ sourceSemanticHash: currentHash, records });
    return this.#updateAuthority({
      acceptedRecords: records, boundSourceSemanticHash: currentHash, stale: false,
      proposals: this.#snapshot.proposals.filter((proposal) => !ids.has(proposal.proposalId)),
      message: `Applied ${ids.size} explicitly reviewed approximate-match proposals.`, error: '',
    }, 'ENRICHMENT_RECORD_ACCEPTED', 'An approximate master match was explicitly reviewed and applied as one transaction.');
  }

  /** Explicit table Apply only: same proposal validators, one atomic weight transaction. */
  applyReviewedComponentWeights(inputs, decision = {}) {
    if (decision.weightReviewConfirmed !== true || !Array.isArray(inputs) || !inputs.length) {
      throw new TypeError('Explicit component-weight review is required.');
    }
    const currentHash = requiredSourceHash(this.#snapshot.currentSourceSemanticHash);
    if (this.#snapshot.stale || (this.#snapshot.boundSourceSemanticHash && this.#snapshot.boundSourceSemanticHash !== currentHash)) {
      throw new TypeError('Accepted records are stale. Reopen weight review for the current source.');
    }
    const ids = new Set();
    const recordsById = new Map(this.#snapshot.acceptedRecords.map(record => [record.recordId, record]));
    for (const input of inputs) {
      if (input.fieldId !== 'COMPONENT_WEIGHT' || input.selectorKind !== 'ENTITY'
          || input.unit !== 'kg' || typeof input.value !== 'number' || !Number.isFinite(input.value) || input.value < 0
          || input.recordId !== `loadcalc-fitting-weight:${input.selectorKey}`
          || input.evidence?.sourceSemanticHash !== currentHash || input.evidence?.reviewerSelected !== true
          || input.migration || ids.has(input.recordId)
          || !['ACCEPTED_OVERRIDE', 'EXACT_APPROVED_MASTER'].includes(input.authority)
          || (input.value === 0 && (input.authority !== 'ACCEPTED_OVERRIDE'
            || input.sourceId !== 'manual-weight-review' || input.evidence?.zeroWeightAssumption !== true))) {
        throw new TypeError('Only unique current, explicitly reviewed component weights can be applied.');
      }
      ids.add(input.recordId);
      const proposal = createNonFeaEnrichmentProposal({ proposalId: input.recordId, record: input,
        rationale: input.evidence.zeroWeightAssumption ? 'Explicit Skip: equipment weight assumed 0 kg.' : 'Explicit editable-table weight review.' });
      if (requiresApproximateMatchReview(proposal)) throw new TypeError('Approximate matches require their own review.');
      recordsById.set(input.recordId, acceptNonFeaEnrichmentProposal(proposal, decision));
    }
    const records = [...recordsById.values()];
    createNonFeaEnrichmentSidecar({ sourceSemanticHash: currentHash, records });
    return this.#updateAuthority({ acceptedRecords: records, boundSourceSemanticHash: currentHash, stale: false,
      proposals: this.#snapshot.proposals.filter(proposal => !ids.has(proposal.proposalId)),
      message: `Applied ${ids.size} reviewed component weights. Zero values are explicit assumptions.`, error: '',
    }, 'ENRICHMENT_RECORD_ACCEPTED', 'Explicitly reviewed component weights applied as one transaction.');
  }

  acceptAllProposals() {
    if (this.#snapshot.migrationReport?.blockers?.length) {
      throw new TypeError('Resolve migration blockers before accepting all migrated records.');
    }
    let snapshot = this.#snapshot;
    for (const proposal of [...snapshot.proposals]) {
      if (requiresApproximateMatchReview(proposal)) continue;
      this.acceptProposal(proposal.proposalId);
      snapshot = this.#snapshot;
    }
    return snapshot;
  }

  rejectProposal(proposalId) {
    return this.#update({
      proposals: this.#snapshot.proposals.filter((row) => row.proposalId !== proposalId),
      message: `Rejected proposal ${proposalId}.`,
      error: '',
    });
  }

  removeAccepted(recordId) {
    const records = this.#snapshot.acceptedRecords.filter((row) => row.recordId !== recordId);
    return this.#updateAuthority({
      acceptedRecords: records,
      boundSourceSemanticHash: records.length ? this.#snapshot.boundSourceSemanticHash : '',
      stale: records.length ? this.#snapshot.stale : false,
      message: `Removed accepted record ${recordId}.`,
      error: '',
    }, 'ENRICHMENT_RECORD_REMOVED', `Accepted enrichment record ${recordId} was removed.`);
  }

  rebindCurrentSource() {
    const currentHash = requiredSourceHash(this.#snapshot.currentSourceSemanticHash);
    if (!this.#snapshot.acceptedRecords.length) throw new TypeError('No accepted records require rebinding.');
    createNonFeaEnrichmentSidecar({ sourceSemanticHash: currentHash, records: this.#snapshot.acceptedRecords });
    return this.#updateAuthority({
      boundSourceSemanticHash: currentHash,
      stale: false,
      message: 'Accepted records were explicitly rebound after exact-match revalidation.',
      error: '',
    }, 'ENRICHMENT_REBOUND', 'Accepted enrichment records were rebound to the current source model.');
  }

  clear() {
    const hadAuthority = this.#snapshot.acceptedRecords.length > 0;
    this.#snapshot = emptySnapshot(this.#snapshot.version + 1);
    if (hadAuthority) nonFeaCommonInputStore.markStale('ENRICHMENT_CLEARED', 'enrichmentSidecarSemanticHash', 'Accepted enrichment authority was cleared.');
    return this.#snapshot;
  }

  setError(error) { return this.#update({ error: String(error), message: '' }); }
  setMessage(message) { return this.#update({ message: String(message), error: '' }); }
  getSnapshot() { return this.#snapshot; }

  #updateAuthority(patch, code, message) {
    const snapshot = this.#update(patch);
    nonFeaCommonInputStore.markStale(code, 'enrichmentSidecarSemanticHash', message);
    return snapshot;
  }

  #update(patch) {
    this.#snapshot = freezeDeep({
      ...this.#snapshot,
      ...patch,
      version: this.#snapshot.version + 1,
    });
    return this.#snapshot;
  }
}

export const nonFeaEnrichmentStore = new NonFeaEnrichmentStore();

function emptySnapshot(version) {
  return freezeDeep({
    currentSourceSemanticHash: '',
    boundSourceSemanticHash: '',
    stale: false,
    proposals: [],
    acceptedRecords: [],
    migrationReport: null,
    message: '',
    error: '',
    version,
  });
}

function requiredSourceHash(value) {
  if (typeof value !== 'string' || !value) throw new TypeError('An active shared-model source semantic hash is required.');
  return value;
}
