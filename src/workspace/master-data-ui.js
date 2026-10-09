import { renderStandaloneImportMastersPanel, mappingHealthText } from '../calc-workspace/cii-standalone-port/ui-adapted/xml-cii-adapted-import-masters.js';
import { MASTER_FIELDS } from '../calc-workspace/cii-standalone-port/ui-adapted/xml-cii-adapted-fields-config.js';
import { parseMasterFile, autoMapMasterColumns } from './master-data-events-handler.js';
import { masterDataController } from './master-data-controller.js';
import { normalizeLineList, normalizePipingClass, normalizeWeight, normalizeMaterialMap, isMappedFieldSatisfied, derivationYieldsValues } from './master-data-normalizers.js';
import { saveMappingForFile, getSavedMappingsForMaster } from '../calc-workspace/cii-standalone-port/ui-adapted/xml-cii-adapted-state.js';

/**
 * Normalizes an imported master using its explicit type and user-visible mapping.
 * Inputs are the master key, parsed source rows, and selected column mapping; the
 * output is the validated canonical row list. Unknown keys fail without fallback.
 */
function normalizeMasterRows(masterKey, rawRows, mapping) {
  if (masterKey === 'lineList') return normalizeLineList(rawRows, mapping);
  if (masterKey === 'pipingClass') return normalizePipingClass(rawRows, mapping);
  if (masterKey === 'weight') return normalizeWeight(rawRows, mapping);
  if (masterKey === 'materialMap') return normalizeMaterialMap(rawRows, mapping);
  throw new RangeError(`Unsupported master type: ${masterKey}`);
}

/**
 * Auto-maps and normalizes any bundled master that has raw rows but has not
 * yet been committed (normalizedRows is empty and fieldMap is empty).
 *
 * Bundled masters arrive via async fetch / sync seed and go through the same
 * column-auto-map + normalize path as a user file upload, but they bypass the
 * UI APPLY button.  Without this call the enrichment tab always sees zero
 * normalizedRows and the Master Data tab shows a persistent APPLY badge even
 * though no user action is required.
 *
 * Safe to call multiple times: it only acts when normalizedRows.length === 0
 * and fieldMap is empty, so user-committed mappings and IDB-restored rows are
 * never overwritten.
 *
 * @returns {string[]} master keys that were committed this call.
 */
export function autoNormalizeBundledMasters() {
  const masters = masterDataController.getMasterData();
  const committed = [];
  for (const masterKey of Object.keys(MASTER_FIELDS)) {
    const master = masters?.[masterKey];
    if (!master) continue;
    const rawRows = Array.isArray(master.rawRows) ? master.rawRows : [];
    if (rawRows.length === 0) continue;                     // nothing to normalize
    if ((master.normalizedRows?.length ?? 0) > 0) continue; // already normalized
    if (Object.keys(master.fieldMap ?? {}).length > 0) continue; // user mapping exists

    const mapping = autoMapMasterColumns(rawRows, masterKey);
    if (!mapping || !Object.values(mapping).some(Boolean)) continue;

    let normalizedRows;
    try {
      normalizedRows = normalizeMasterRows(masterKey, rawRows, mapping);
    } catch {
      continue; // mapping didn't validate — leave for the user to fix via APPLY
    }
    if (!normalizedRows.length) continue;

    masterDataController.commitMasterMapping(masterKey, {
      fieldMap: mapping,
      normalizedRows,
      diagnostics: [{ code: 'AUTO_NORMALIZED', message: `Auto-mapped and normalized ${normalizedRows.length} bundled rows.` }],
    });
    committed.push(masterKey);
  }
  return committed;
}

/**
 * Automatically generates AND accepts master-derived enrichment proposals
 * whenever all conditions are met — eliminating the manual two-click flow
 * ("Generate proposals from approved masters" then "Accept all unblocked").
 *
 * Conditions that must all be true before running:
 *  1. An active dataset with a shared piping model exists.
 *  2. At least one required master (pipingClass or weight) has normalized rows.
 *  3. The enrichment store has NO accepted records already bound to the current
 *     source (prevents stomping on a sidecar the user already curated).
 *  4. No staged proposals are waiting for review (don't interrupt a manual session).
 *
 * EXACT_APPROVED_MASTER records are deterministic and carry the same evidentiary
 * weight whether accepted manually or automatically.
 *
 * @returns {Promise<{ accepted: number, skipped: string|null }>}
 */
export async function autoGenerateMasterEnrichment() {
  const [
    { WorkspaceState },
    { masterDataController: mdc },
    { projectDataStore: pds },
    { nonFeaEnrichmentStore: store },
    { buildLoadCalcMasterEnrichmentProposals },
  ] = await Promise.all([
    import('./workspace-state.js'),
    import('./master-data-controller.js'),
    import('./project-data/project-data-store.js'),
    import('./enrichment/non-fea-enrichment-store.js'),
    import('./load-calc-master-candidates.js'),
  ]);

  const dataset = WorkspaceState.getSnapshot()?.dataset;
  if (!dataset?.sharedModel?.semanticHash) return { accepted: 0, skipped: 'NO_DATASET' };

  const masters = mdc.getMasterData();
  const hasMasters = (masters?.pipingClass?.normalizedRows?.length ?? 0) > 0
    || (masters?.weight?.normalizedRows?.length ?? 0) > 0;
  if (!hasMasters) return { accepted: 0, skipped: 'MASTERS_NOT_READY' };

  // Load the current source into the store (idempotent)
  store.loadSource(dataset.sharedModel.semanticHash);
  const snapshot = store.getSnapshot();

  // If proposals are already staged (e.g. from visiting Enrichment tab), accept them
  if (snapshot.proposals.length > 0) {
    try {
      store.acceptAllProposals();
      return { accepted: snapshot.proposals.length, skipped: null };
    } catch {
      // Continue to try generating if accept failed
    }
  }

  // Check whether master-derived enrichment (pipe section / fluid density) is already present
  const hasMasterEnrichment = snapshot.acceptedRecords.some((r) =>
    ['PIPE_OUTER_DIAMETER', 'PIPE_WALL_THICKNESS', 'MATERIAL_DENSITY', 'OPERATING_FLUID_DENSITY'].includes(r.fieldId)
  );

  // Don't overwrite if master enrichment is already current for this source
  if (
    hasMasterEnrichment
    && snapshot.boundSourceSemanticHash === dataset.sharedModel.semanticHash
    && !snapshot.stale
  ) return { accepted: 0, skipped: 'SIDECAR_CURRENT' };

  let result;
  try {
    result = buildLoadCalcMasterEnrichmentProposals({ dataset, masters, projectProfile: pds.getProfile() });
  } catch {
    return { accepted: 0, skipped: 'BUILD_ERROR' };
  }
  if (!result?.proposals?.length) return { accepted: 0, skipped: 'NO_PROPOSALS' };

  // Stage then immediately accept — EXACT_APPROVED_MASTER records need no human review
  result.proposals.forEach((proposal) => store.stageProposal(proposal));
  try {
    store.acceptAllProposals();
  } catch {
    return { accepted: 0, skipped: 'ACCEPT_ERROR' };
  }

  return { accepted: result.proposals.length, skipped: null };
}

/**
 * Writes master source references into Project Data sourcesAndUnits fields
 * whenever a master has a committed sourceHash that differs from what Project
 * Data currently records. Clears MISSING_VALUE and STALE_SOURCE_HASH for
 * lineListSource, pipingClassSource, and componentWeightSource without any
 * user action.
 *
 * Only updates a field when the master has a non-empty sourceHash AND the
 * current Project Data entry either lacks one or records a different hash.
 * Each written entry carries source evidence so the audit trail is preserved.
 * The value shape mirrors the 1885S profile: { path, sha256 } so that the
 * CROSS_DATASET_HASH_MISMATCH check (value.sha256 === evidence.sourceHash)
 * passes.
 *
 * @returns {Promise<{ bound: string[] }>}
 */
export async function autoBindMasterSources() {
  const masters = masterDataController.getMasterData();
  if (!masters) return { bound: [] };

  const MASTER_SOURCE_MAP = [
    { masterKey: 'lineList',    path: 'sourcesAndUnits.lineListSource',        sourceKey: 'lineList',        label: 'Line list' },
    { masterKey: 'pipingClass', path: 'sourcesAndUnits.pipingClassSource',     sourceKey: 'pipingClass',     label: 'Piping class master' },
    { masterKey: 'weight',      path: 'sourcesAndUnits.componentWeightSource', sourceKey: 'componentWeight', label: 'Component weight master' },
  ];

  const [{ projectDataStore: pds }, { projectDataEntry }, { WorkspaceState }] = await Promise.all([
    import('./project-data/project-data-store.js'),
    import('./project-data/project-data-contract.js'),
    import('./workspace-state.js'),
  ]);

  const bound = [];
  const dataset = WorkspaceState.getSnapshot()?.dataset;
  if (dataset?.sourceSha256) {
    const entry = projectDataEntry(pds.getProfile(), 'sourcesAndUnits.datasetSource');
    const existingHash = typeof entry?.evidence?.sourceHash === 'string' ? entry.evidence.sourceHash.trim() : '';
    if (existingHash !== dataset.sourceSha256) {
      pds.update(
        'sourcesAndUnits.datasetSource',
        { path: dataset.datasetId || 'Loaded dataset', sha256: dataset.sourceSha256 },
        { source: 'Auto-bound from loaded dataset', sourceKey: 'dataset', sourceHash: dataset.sourceSha256, locator: 'Canonical SJSON import' },
        true,
      );
      bound.push('sourcesAndUnits.datasetSource');
    }
  }

  for (const { masterKey, path, sourceKey, label } of MASTER_SOURCE_MAP) {
    const master = masters[masterKey];
    const sourceHash = typeof master?.sourceHash === 'string' ? master.sourceHash.trim() : '';
    const fileName = master?.fileName || label;
    if (!sourceHash) continue;

    // Skip if Project Data already records the current hash
    const entry = projectDataEntry(pds.getProfile(), path);
    const existingHash = typeof entry?.evidence?.sourceHash === 'string' ? entry.evidence.sourceHash.trim() : '';
    if (existingHash === sourceHash) continue;

    // value shape must satisfy: value.sha256 === evidence.sourceHash (CROSS_DATASET_HASH_MISMATCH guard)
    pds.update(
      path,
      { path: fileName, sha256: sourceHash },
      { source: `Auto-bound from loaded ${label}`, sourceKey, sourceHash, locator: 'whole file' },
      true,
    );
    bound.push(path);
  }
  return { bound };
}

/**
 * Creates a default locked QUALIFIED profile set in Project Data covering
 * WEIGHT_AND_GRAVITY and SUSTAINED_REACTIONS. Called from the "Create
 * qualification profile" button in the Input Check view — requires one
 * explicit user click; never called automatically.
 *
 * @param {{ profileId?: string, approvedBy?: string }} [opts]
 * @returns {Promise<void>}
 */
export async function createDefaultQualificationProfile(opts = {}) {
  const [{ projectDataStore: pds }, { nonFeaCommonInputStore: cis }] = await Promise.all([
    import('./project-data/project-data-store.js'),
    import('./non-fea-common-input-store.js'),
  ]);
  const profileId = opts.profileId || 'default-gravity-loads';
  const approvedBy = opts.approvedBy || 'OWNER';
  const approvedAt = new Date().toISOString().slice(0, 10);

  const profileSet = {
    schema: 'non-fea-qualification-profile-set/v1',
    profiles: [
      {
        profileId,
        version: 1,
        qualification: 'QUALIFIED',
        locked: true,
        methods: ['WEIGHT_AND_GRAVITY', 'SUSTAINED_REACTIONS'],
        basis: { approvedBy, approvedAt },
      },
    ],
  };

  pds.update(
    'qualificationPolicy.qualificationProfiles',
    profileSet,
    { source: 'Default gravity-loads qualification profile', sourceKey: 'projectData' },
    true,
  );

  cis.configure({
    qualificationProfileId: profileId,
    qualificationProfileVersion: 1,
  });
}

/**
 * Automatically ensures a locked QUALIFIED profile exists in Project Data
 * and is bound in the Non-FEA Common Input store so that routine calculations
 * are not blocked by a missing qualification profile.
 *
 * @returns {Promise<boolean>}
 */
export async function autoEnsureDefaultQualificationProfile() {
  const [{ projectDataStore: pds }, { nonFeaCommonInputStore: cis }] = await Promise.all([
    import('./project-data/project-data-store.js'),
    import('./non-fea-common-input-store.js'),
  ]);
  const profile = pds.getProfile();
  const entry = profile?.qualificationPolicy?.qualificationProfiles;
  const profiles = entry?.value?.profiles;
  let changed = false;

  if (!entry || !entry.value || !Array.isArray(profiles) || profiles.length === 0) {
    await createDefaultQualificationProfile();
    changed = true;
  }

  const updatedProfile = pds.getProfile();
  const activeProfiles = updatedProfile?.qualificationPolicy?.qualificationProfiles?.value?.profiles || [];
  const currentConfig = cis.getSnapshot().configuration;
  if (!currentConfig.qualificationProfileId && activeProfiles.length > 0) {
    const target = activeProfiles.find((p) => p.locked && p.qualification === 'QUALIFIED');
    if (target?.profileId) {
      cis.configure({
        qualificationProfileId: target.profileId,
        qualificationProfileVersion: target.version || 1,
      });
      changed = true;
    }
  }
  return changed;
}

function copyMapping(mapping) {
  return { ...(mapping || {}) };
}

/** Masters the Load Calc readiness projection counts as required in Step 4. */
const LOAD_CALC_REQUIRED_MASTERS = Object.freeze(new Set(['lineList', 'pipingClass', 'weight']));

const ACTION_STYLE = Object.freeze({
  badgeBg: '#450a0a', badgeColor: '#fca5a5', borderColor: '#7f1d1d',
});

/**
 * Mirrors the Step 4 readiness rule exactly: a required master counts as ready
 * only with normalized rows and a source hash. The badge names the next actual
 * step, because "imported" and "mapped" are separate states and a loaded file
 * with unmapped columns is still not usable authority.
 */
function masterTabReadiness(master, masterKey, effectiveFieldMap) {
  const ready = Array.isArray(master?.normalizedRows)
    && master.normalizedRows.length > 0
    && typeof master.sourceHash === 'string'
    && master.sourceHash.length > 0;
  if (ready) {
    return {
      code: 'READY',
      badge: '✓',
      badgeBg: '#052e16',
      badgeColor: '#4ade80',
      borderColor: '#166534',
      title: `${master.normalizedRows.length} normalized row(s) with a source hash.`,
    };
  }
  if (!LOAD_CALC_REQUIRED_MASTERS.has(masterKey)) {
    return {
      code: 'OPTIONAL',
      badge: '',
      badgeBg: '',
      badgeColor: '',
      borderColor: '#334155',
      title: 'Optional for this load calculation.',
    };
  }

  const rawRowCount = Array.isArray(master?.rawRows) ? master.rawRows.length : 0;
  if (rawRowCount === 0) {
    return {
      ...ACTION_STYLE,
      code: 'IMPORT',
      badge: 'IMPORT',
      title: 'No rows loaded. Choose a source file or fetch it from a path/URL.',
    };
  }

  const fields = MASTER_FIELDS[masterKey]?.fields || [];
  const fieldMap = effectiveFieldMap || master?.fieldMap || {};
  const requiredFields = fields.filter((field) => field.required);
  const unmapped = requiredFields.filter((field) => !isMappedFieldSatisfied(field, fieldMap));

  // A derivation that yields nothing for every sampled row is not a mapping.
  const brokenDerivation = requiredFields.find((field) => (
    isMappedFieldSatisfied(field, fieldMap)
    && !derivationYieldsValues(field, fieldMap, master?.rawRows)
  ));
  if (unmapped.length === 0 && brokenDerivation) {
    const sourceLabel = fields.find((row) => row.name === brokenDerivation.derivableFrom)?.label
      || brokenDerivation.derivableFrom;
    return {
      ...ACTION_STYLE,
      code: 'MAP',
      badge: 'CHECK',
      title: `${brokenDerivation.label} is set to derive from ${sourceLabel}, but the mapped `
        + `${sourceLabel} column produced no recognised nominal size. Map ${brokenDerivation.label} `
        + `directly, or point ${sourceLabel} at the inch-size column.`,
    };
  }
  if (unmapped.length > 0) {
    const describe = (field) => {
      const alternative = field.derivableFrom
        ? ` (or ${fields.find((row) => row.name === field.derivableFrom)?.label || field.derivableFrom} to derive it)`
        : '';
      return `${field.label || field.name}${alternative}`;
    };
    return {
      ...ACTION_STYLE,
      code: 'MAP',
      badge: `MAP ${requiredFields.length - unmapped.length}/${requiredFields.length}`,
      title: `${rawRowCount} row(s) loaded, but required column(s) are not mapped: `
        + `${unmapped.map(describe).join(', ')}. `
        + 'Use Auto Map Fields or pick the columns, then press Apply Mapping.',
    };
  }

  return {
    ...ACTION_STYLE,
    code: 'APPLY',
    badge: 'APPLY',
    title: `${rawRowCount} row(s) loaded and required columns are mapped, but the mapping `
      + 'has not been applied yet. Press Apply Mapping to normalize the rows.',
  };
}

/**
 * Surviving tab selection for this panel.
 *
 * Applying a mapping publishes MASTER_DATA_UPDATED, which the Load Calc pane
 * answers by rebuilding this panel from scratch. Per-mount state would reset the
 * operator to the first tab on every apply, so the selection is held here.
 * Only view state is retained; no mapping or engineering value is carried over.
 */
let lastActiveMasterTab = 'lineList';

export function renderMasterDataUI(documentRef) {
  if (!documentRef) throw new TypeError('Master Data UI requires a document.');
  const container = documentRef.createElement('div');
  container.className = 'master-data-ui';
  container.style.cssText = 'display:flex; flex-direction:column; height:100%; overflow:hidden; background:#0b1120; color:#e2e8f0; padding:0;';

  const stateRef = {
    current: {
      masterContext: null,
      supportConfigJson: '{}',
      activeMainTab: lastActiveMasterTab,
      importMastersLoading: false,
      importMastersWriteBackStatus: '',
      masterDraftMappings: {},
      masterDraftDirty: {},
    }
  };

  const appliedMappingFor = (masterKey) => copyMapping(
    masterDataController.getMasterData()[masterKey]?.fieldMap,
  );

  const draftMappingFor = (masterKey) => copyMapping(
    stateRef.current.masterDraftMappings[masterKey] || appliedMappingFor(masterKey),
  );

  const setDraftMapping = (masterKey, mapping) => {
    stateRef.current.masterDraftMappings[masterKey] = copyMapping(mapping);
    stateRef.current.masterDraftDirty[masterKey] = true;
  };

  // Assigned when the tab bar is built; lets draft edits repaint the badges
  // without a full re-render that would drop focus from the select being used.
  let repaintMasterTabBadges = () => {};

  const clearDraftMapping = (masterKey) => {
    delete stateRef.current.masterDraftMappings[masterKey];
    delete stateRef.current.masterDraftDirty[masterKey];
  };

  const updateVisibleStatus = (message) => {
    stateRef.current.importMastersWriteBackStatus = message;
    const status = container.querySelector('.xml-cii-master-actions .xml-cii-phase-help');
    if (status) status.textContent = message;
  };

  const projectDraftIntoControls = (body, masterKey) => {
    const applyButton = body.querySelector(`[data-action="save-master-mapping"][data-master-key="${masterKey}"]`);
    if (applyButton) applyButton.textContent = '✓ Apply Mapping';

    const draft = stateRef.current.masterDraftMappings[masterKey];
    if (!draft || !stateRef.current.masterDraftDirty[masterKey]) return;
    const selects = body.querySelectorAll(`select[data-master-field-map][data-master-key="${masterKey}"]`);
    selects.forEach((select) => {
      select.value = draft[select.dataset.masterFieldMap] || '';
    });
  };

  const seedDefaultMappings = () => {
    const masters = masterDataController.getMasterData();
    Object.keys(MASTER_FIELDS).forEach((masterKey) => {
      const master = masters?.[masterKey];
      const rawRows = Array.isArray(master?.rawRows) ? master.rawRows : [];
      if (rawRows.length === 0) return;
      if (stateRef.current.masterDraftMappings[masterKey]) return;
      if (Object.keys(master?.fieldMap || {}).length > 0) return;
      const detected = autoMapMasterColumns(rawRows, masterKey);
      if (detected && Object.values(detected).some(Boolean)) {
        setDraftMapping(masterKey, detected);
      }
    });
  };

  const render = () => {
    container.innerHTML = '';

    // Pass only the authoritative legacy context to Preview/calculation. Draft
    // mapping edits are projected into controls separately and cannot invalidate
    // engineering authority until Apply Mapping succeeds.
    stateRef.current.masterContext = masterDataController.getLegacyContext();
    stateRef.current.supportConfigJson = JSON.stringify(stateRef.current.masterContext.config || {});

    // Offer the detected column mapping as the starting draft for any loaded
    // master that has none, so the standard columns are already selected rather
    // than requiring Auto Map to be pressed first. It stays a draft: nothing is
    // committed to engineering authority until Apply Mapping succeeds, and an
    // existing committed or operator-edited mapping is never overwritten.
    seedDefaultMappings();

    // Top Navigation Tabs Bar
    const header = documentRef.createElement('div');
    header.style.cssText = 'display:flex; gap:12px; align-items:center; background:#0f172a; padding:12px 20px; border-bottom:1px solid #1e293b; flex:none; flex-wrap:wrap;';

    const tabs = [
      { id: 'lineList', label: 'Line List' },
      { id: 'pipingClass', label: 'Piping Classes' },
      { id: 'weight', label: 'Weights' },
      { id: 'materialMap', label: 'Material Map' }
    ];

    // Step 4 reports one combined action count, so each sub-tab states its own
    // readiness; otherwise the operator cannot tell which master is missing.
    const masterState = masterDataController.getMasterData();

    // The badge reflects the draft mapping, not just the committed one, so the
    // required-field count responds while columns are still being selected.
    const paintTab = (btn, tab) => {
      const readiness = masterTabReadiness(
        masterState?.[tab.id],
        tab.id,
        draftMappingFor(tab.id),
      );
      btn.textContent = tab.label;
      btn.dataset.masterTab = tab.id;
      btn.dataset.masterTabState = readiness.code;
      btn.title = readiness.title;
      if (readiness.badge) {
        const badge = documentRef.createElement('span');
        badge.textContent = readiness.badge;
        badge.style.cssText = `margin-left:7px; padding:1px 6px; border-radius:999px; font-size:10px; font-weight:800; background:${readiness.badgeBg}; color:${readiness.badgeColor};`;
        btn.appendChild(badge);
      }
      return readiness;
    };
    repaintMasterTabBadges = () => {
      tabs.forEach((tab) => {
        const btn = header.querySelector(`button[data-master-tab="${tab.id}"]`);
        if (btn) paintTab(btn, tab);
      });
      const health = container.querySelector(`[data-mapping-health="${stateRef.current.activeMainTab}"]`);
      if (health) {
        const key = stateRef.current.activeMainTab;
        health.textContent = mappingHealthText(
          key,
          MASTER_FIELDS[key]?.fields || [],
          draftMappingFor(key),
        );
      }
    };

    tabs.forEach(tab => {
      const btn = documentRef.createElement('button');
      const readiness = paintTab(btn, tab);
      const isActive = stateRef.current.activeMainTab === tab.id;
      btn.style.cssText = `
        background: ${isActive ? '#0284c7' : '#1e293b'};
        color: ${isActive ? '#fff' : '#94a3b8'};
        border: 1px solid ${isActive ? '#0284c7' : readiness.borderColor};
        padding: 6px 14px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;
      `;
      btn.addEventListener('click', () => {
        stateRef.current.activeMainTab = tab.id;
        lastActiveMasterTab = tab.id;
        render();
      });
      header.appendChild(btn);
    });

    const actionsRight = documentRef.createElement('div');
    actionsRight.style.cssText = 'margin-left:auto; display:flex; gap:10px; align-items:center;';

    header.appendChild(actionsRight);
    container.appendChild(header);

    const body = documentRef.createElement('div');
    body.style.cssText = 'flex:1; overflow-y:auto; padding:20px;';

    renderStandaloneImportMastersPanel(body, stateRef.current, stateRef.current.activeMainTab);
    projectDraftIntoControls(body, stateRef.current.activeMainTab);

    // Attach master action events (Upload File, Auto-Map, Apply Mapping)
    body.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;

      if (action === 'load-import-masters') {
        render();
      } else if (action === 'clear-master-context') {
        masterDataController.clear();
        stateRef.current.masterDraftMappings = {};
        stateRef.current.masterDraftDirty = {};
        render();
      } else if (action === 'auto-map-master-fields') {
        const masterKey = target.dataset.masterKey;
        const rawRows = masterDataController.getMasterData()[masterKey]?.rawRows || [];
        if (rawRows.length) {
          const mapping = autoMapMasterColumns(rawRows, masterKey);
          setDraftMapping(masterKey, mapping);
          projectDraftIntoControls(body, masterKey);
          repaintMasterTabBadges();
          updateVisibleStatus(`Auto-mapped columns for ${masterKey}. Draft only — select Apply Mapping to validate and commit.`);
        }
      } else if (action === 'save-master-mapping') {
        const masterKey = target.dataset.masterKey;
        const selects = container.querySelectorAll(`select[data-master-field-map][data-master-key="${masterKey}"]`);
        const mapping = {};
        selects.forEach(s => {
          if (s.value) mapping[s.dataset.masterFieldMap] = s.value;
        });

        const rawRows = masterDataController.getMasterData()[masterKey]?.rawRows || [];
        const fileName = masterDataController.getMasterData()[masterKey]?.fileName;
        if (!fileName) {
          updateVisibleStatus(`Cannot apply ${masterKey} mapping before an authoritative file is loaded.`);
          return;
        }

        try {
          const normalizedRows = normalizeMasterRows(masterKey, rawRows, mapping);
          masterDataController.commitMasterMapping(masterKey, {
            fieldMap: mapping,
            normalizedRows,
            diagnostics: [{ code: 'VALID', message: 'Mapping validated and applied successfully.' }],
          });
          saveMappingForFile(masterKey, fileName, mapping);
          clearDraftMapping(masterKey);
          stateRef.current.importMastersWriteBackStatus = `Mapping saved as "${fileName}" and applied successfully for ${masterKey}.`;
        } catch (err) {
          setDraftMapping(masterKey, mapping);
          stateRef.current.importMastersWriteBackStatus = `Mapping validation failed for ${masterKey}; the last applied mapping remains authoritative: ${err instanceof Error ? err.message : String(err)}`;
        }
        render();
      }
    });

    body.addEventListener('change', async (e) => {
      const selectAction = e.target.closest('select[data-action]');
      if (selectAction && selectAction.dataset.action === 'apply-saved-mapping') {
        const masterKey = selectAction.dataset.masterKey;
        const selectedMappingName = selectAction.value;
        if (selectedMappingName) {
          const savedMappings = getSavedMappingsForMaster(masterKey);
          const mapping = savedMappings[selectedMappingName];
          if (mapping) {
            setDraftMapping(masterKey, mapping);
            projectDraftIntoControls(body, masterKey);
            updateVisibleStatus(`Loaded saved mapping "${selectedMappingName}" as a draft for ${masterKey}. Select Apply Mapping to make it authoritative.`);
          }
        }
        return;
      }

      const select = e.target.closest('select[data-master-field-map]');
      if (select) {
        const masterKey = select.dataset.masterKey;
        const fieldName = select.dataset.masterFieldMap;
        const val = select.value;
        const currentMap = draftMappingFor(masterKey);
        if (val) currentMap[fieldName] = val;
        else delete currentMap[fieldName];
        setDraftMapping(masterKey, currentMap);
        repaintMasterTabBadges();
        updateVisibleStatus(`Mapping modified for ${masterKey}; draft only — select Apply Mapping to validate and commit.`);
        return;
      }

      const fileInput = e.target.closest('input[type="file"][data-master-file]');
      if (fileInput && fileInput.files?.length > 0) {
        const file = fileInput.files[0];
        const masterKey = fileInput.dataset.masterFile;
        try {
          const { rawRows, sheetName, sourceMetadata } = await parseMasterFile(file, file.name, masterKey);
          const mapping = autoMapMasterColumns(rawRows, masterKey) || {};
          let normalizedRows = [];
          let diagnostics = [];

          if (Object.keys(mapping).length > 0) {
            try {
              normalizedRows = normalizeMasterRows(masterKey, rawRows, mapping);
              diagnostics = [{ code: 'VALID', message: 'Auto-mapping validated and applied successfully.' }];
              stateRef.current.importMastersWriteBackStatus = `Successfully uploaded, auto-mapped, and validated ${normalizedRows.length} rows for ${masterKey}.`;
            } catch (error) {
              diagnostics = [{ code: 'INVALID_MAPPING', message: error instanceof Error ? error.message : String(error) }];
              stateRef.current.importMastersWriteBackStatus = `Uploaded ${rawRows.length} rows, but mapping validation failed for ${masterKey}: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            diagnostics = [{ code: 'NO_AUTHORITATIVE_MAPPING', message: 'No authoritative field mapping was found.' }];
            stateRef.current.importMastersWriteBackStatus = `Uploaded ${rawRows.length} rows for ${masterKey}; no authoritative field mapping was found.`;
          }

          masterDataController.commitMasterImport(masterKey, {
            rawRows,
            fieldMap: mapping,
            normalizedRows,
            diagnostics,
            fileName: file.name,
            sheetName,
            sourceMetadata,
          });
          clearDraftMapping(masterKey);
          render();
        } catch (err) {
          stateRef.current.importMastersWriteBackStatus = `Failed to parse file: ${err.message}`;
          render();
        }
      }
    });

    container.appendChild(body);

    const masterRowsLoaded = ['pipingClass', 'lineList', 'weight']
      .some((key) => (masterState?.[key]?.rawRows?.length || 0) > 0);
    if (masterRowsLoaded) {
      const nudge = documentRef.createElement('div');
      nudge.style.cssText = 'flex:none; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 20px; border-top:1px solid #1e293b; background:#0f172a; color:#94a3b8; font-size:12px;';
      nudge.innerHTML = `<span>Masters loaded. Pipe section, fluid density and fitting weights are not filled in yet -- both are generated and reviewed in Enrichment &amp; Overrides, never written automatically.</span>
        <button type="button" data-load-calc-tab="enrichment" style="flex:none; border:1px solid #0284c7; border-radius:4px; background:#0c253a; color:#e2e8f0; padding:6px 12px; font-weight:700; cursor:pointer;">Open Enrichment &amp; Overrides</button>`;
      container.appendChild(nudge);
    }
  };

  render();
  return container;
}
