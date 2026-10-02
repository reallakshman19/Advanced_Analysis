/** Loaded-file identity is not authority to reapprove old engineering values. */
export function loadedSourceReferenceUpdates({ dataset, masters, profile }) {
  const sources = [
    ['datasetSource', 'dataset', dataset?.sourceSha256, dataset?.sourceName || dataset?.fileName || 'Loaded dataset'],
    ['lineListSource', 'lineList', masters?.lineList?.sourceHash, masters?.lineList?.fileName || 'Line list'],
    ['pipingClassSource', 'pipingClass', masters?.pipingClass?.sourceHash, masters?.pipingClass?.fileName || 'Piping class master'],
    ['componentWeightSource', 'componentWeight', masters?.weight?.sourceHash, masters?.weight?.fileName || 'Component weight master'],
  ];
  return sources.filter(([field, , hash]) => typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash)
    && profile?.sourcesAndUnits?.[field]?.evidence?.sourceHash !== hash)
    .map(([field, sourceKey, sourceHash, name]) => ({
      path: `sourcesAndUnits.${field}`, value: { path: name, sha256: sourceHash },
      evidence: { source: `Loaded file identity: ${name}`, sourceKey, sourceHash, locator: 'whole file' },
    }));
}

/** Bootstrap may accept exact pipe-master proposals only, never catalogue choices. */
export function isAutomaticPipeMasterProposal(proposal) {
  const record = proposal?.record;
  return record?.authority === 'EXACT_APPROVED_MASTER'
    && record?.evidence?.matchMode === 'EXACT'
    && ['PIPE_OUTER_DIAMETER', 'PIPE_WALL_THICKNESS', 'MATERIAL_DENSITY', 'OPERATING_FLUID_DENSITY'].includes(record.fieldId)
    && Boolean(record.evidence.sourceSemanticHash);
}

/** A manual pending choice reserves its exact field/selector, just like acceptance. */
export function selectUnreservedMasterProposals(proposals, snapshot) {
  const key = (record) => `${record?.fieldId}:${record?.selectorKey}`;
  const reserved = new Set([
    ...(snapshot?.acceptedRecords || []).map(key),
    ...(snapshot?.proposals || []).map((proposal) => key(proposal.record)),
  ]);
  return proposals.filter((proposal) => !reserved.has(key(proposal.record)));
}
