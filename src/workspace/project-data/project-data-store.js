import approved1885sProfile from '../../../project-data/1885s-project-data-profile.json' with { type: 'json' };
import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { clonePlain, freezeDeep } from '../dataset-utils.js';
import { createNonFeaProductDefaultProvider } from './non-fea-product-default-profile.js';
import {
  createEmptyProjectDataProfile,
  replaceProjectDataValue,
  upgradeProjectDataProfile,
  validateProjectDataProfile,
} from './project-data-contract.js';

/** In-memory authority for visible, source-backed Project Data. */
export class ProjectDataStore {
  #profile = null;
  #profileSemanticHash = null;
  #runtimeRevision = 0;
  #profileHashComputations = 0;
  #origin = null;
  #listeners = new Set();

  #ensureInit() {
    if (!this.#profile) {
      this.#profile = approvedProfile();
      this.#profileSemanticHash = this.#computeProfileSemanticHash(this.#profile);
      this.#runtimeRevision += 1;
      this.#origin = bundledOrigin(this.#profileSemanticHash);
    }
  }

  getProfile() {
    this.#ensureInit();
    return this.#profile;
  }

  getOrigin() {
    this.#ensureInit();
    return this.#origin;
  }

  getSemanticHash() {
    this.#ensureInit();
    return this.#profileSemanticHash;
  }

  /**
   * Runtime-only monotonic currentness token. This never replaces the profile's
   * engineering revision or semantic identity in evidence contracts.
   */
  getRuntimeRevision() {
    this.#ensureInit();
    return this.#runtimeRevision;
  }

  getPerformanceMetrics() {
    this.#ensureInit();
    return {
      runtimeRevision: this.#runtimeRevision,
      profileSemanticHashComputations: this.#profileHashComputations,
    };
  }

  resetPerformanceMetrics() {
    this.#profileHashComputations = 0;
  }

  importProfile(profile, sourceName) {
    if (typeof sourceName !== 'string' || !sourceName.trim()) throw new TypeError('Project Data import source name is required.');
    const upgraded = upgradeProjectDataProfile(profile);
    const audit = validateProjectDataProfile(upgraded, 'normalization', null);
    if (audit.errors.some((row) => row.code === 'INVALID_SCHEMA' || row.code === 'INVALID_FIELD')) {
      throw new TypeError(`Project Data import failed: ${audit.errors.map((row) => row.message).join(' ')}`);
    }
    this.#profile = freezeDeep(clonePlain(upgraded));
    this.#profileSemanticHash = this.#computeProfileSemanticHash(this.#profile);
    this.#runtimeRevision += 1;
    this.#origin = freezeDeep({
      kind: 'EXPLICIT_FILE_IMPORT',
      source: sourceName.trim(),
      profileSemanticHash: this.#profileSemanticHash,
    });
    this.#publish('imported');
    return this.#profile;
  }

  restoreApprovedProfile() {
    this.#profile = approvedProfile();
    this.#profileSemanticHash = this.#computeProfileSemanticHash(this.#profile);
    this.#runtimeRevision += 1;
    this.#origin = bundledOrigin(this.#profileSemanticHash);
    this.#publish('approved-profile-restored');
    return this.#profile;
  }

  /**
   * Materialises built-in product defaults into the visible profile.
   *
   * Only fields that are currently empty are filled; any operator-entered value
   * is preserved and reported as shadowed. Each filled field carries
   * PRODUCT_DEFAULT evidence naming its definition id, basis and hashes, so an
   * applied default is never indistinguishable from an engineering decision.
   * Returns the provider projection, or null when nothing needed filling.
   */
  applyProductDefaults() {
    this.#ensureInit();
    const provider = createNonFeaProductDefaultProvider({ profile: this.#profile });
    if (provider.usageRows.length === 0) return null;
    this.#profile = freezeDeep(clonePlain(provider.effectiveProfile));
    this.#profileSemanticHash = this.#computeProfileSemanticHash(this.#profile);
    this.#runtimeRevision += 1;
    this.#publish('product-defaults-applied');
    return provider;
  }

  update(path, value, evidence, approved) {
    this.#ensureInit();
    this.#profile = replaceProjectDataValue(this.#profile, path, value, evidence, approved);
    this.#profileSemanticHash = this.#computeProfileSemanticHash(this.#profile);
    this.#runtimeRevision += 1;
    this.#publish('updated');
    return this.#profile;
  }

  clear() {
    this.#profile = createEmptyProjectDataProfile();
    this.#profileSemanticHash = this.#computeProfileSemanticHash(this.#profile);
    this.#runtimeRevision += 1;
    this.#origin = freezeDeep({
      kind: 'EMPTY',
      source: 'User-cleared Project Data',
      profileSemanticHash: this.#profileSemanticHash,
    });
    this.#publish('cleared');
    return this.#profile;
  }

  syncAuthorityHashes(activeHashes = {}) {
    this.#ensureInit();
    if (!activeHashes || typeof activeHashes !== 'object') return;
    const datasetHash = typeof activeHashes.dataset === 'string' ? activeHashes.dataset.trim() : '';
    let changed = false;
    let nextProfile = clonePlain(this.#profile);

    if (datasetHash && /^[a-f0-9]{64}$/i.test(datasetHash)) {
      for (const [groupKey, group] of Object.entries(nextProfile)) {
        if (group && typeof group === 'object' && !Array.isArray(group)) {
          for (const [fieldKey, field] of Object.entries(group)) {
            if (field?.evidence?.sourceKey === 'dataset' && field.evidence?.sourceHash !== datasetHash) {
              const path = `${groupKey}.${fieldKey}`;
              const val = fieldKey === 'datasetSource'
                ? { path: activeHashes.datasetFileName || 'Loaded SJSON dataset', sha256: datasetHash }
                : field.value;
              nextProfile = clonePlain(replaceProjectDataValue(
                nextProfile,
                path,
                val,
                { ...field.evidence, sourceHash: datasetHash },
                true,
              ));
              changed = true;
            }
          }
        }
      }
    }

    const mastersMap = [
      { key: 'pipingClass', path: 'sourcesAndUnits.pipingClassSource', label: 'Piping class master' },
      { key: 'componentWeight', path: 'sourcesAndUnits.componentWeightSource', label: 'Component weight master' },
      { key: 'lineList', path: 'sourcesAndUnits.lineListSource', label: 'Line list' },
    ];

    for (const { key, path, label } of mastersMap) {
      const hash = typeof activeHashes[key] === 'string' ? activeHashes[key].trim() : '';
      const [g, f] = path.split('.');
      const current = nextProfile[g]?.[f];
      const existingHash = typeof current?.evidence?.sourceHash === 'string' ? current.evidence.sourceHash.trim() : '';
      if (hash && /^[a-f0-9]{64}$/i.test(hash) && existingHash !== hash) {
        nextProfile = clonePlain(replaceProjectDataValue(
          nextProfile,
          path,
          { path: label, sha256: hash },
          { source: `Auto-bound from loaded ${label}`, sourceKey: key, sourceHash: hash, locator: 'whole file' },
          true,
        ));
        changed = true;
      } else if (key === 'lineList' && !hash && existingHash) {
        nextProfile = clonePlain(replaceProjectDataValue(
          nextProfile,
          path,
          { path: 'Not provided (optional for gravity)', sha256: '' },
          { source: 'No active line-list master loaded', sourceKey: 'lineList', sourceHash: '', locator: 'optional' },
          true,
        ));
        const opFluid = nextProfile.loadCalculation?.operatingFluidDensitiesKgPerM3;
        if (opFluid?.evidence?.sourceKey === 'lineList' && opFluid?.evidence?.sourceHash) {
          nextProfile = clonePlain(replaceProjectDataValue(
            nextProfile,
            'loadCalculation.operatingFluidDensitiesKgPerM3',
            opFluid.value,
            { ...opFluid.evidence, sourceHash: '' },
            true,
          ));
        }
        changed = true;
      }
    }

    if (changed) {
      this.#profile = freezeDeep(nextProfile);
      this.#profileSemanticHash = this.#computeProfileSemanticHash(this.#profile);
      this.#runtimeRevision += 1;
      this.#publish('authority-hashes-synced');
    }
  }

  validate(workflow, activeHashes) {
    this.#ensureInit();
    if (activeHashes && typeof activeHashes === 'object') {
      this.syncAuthorityHashes(activeHashes);
    }
    return validateProjectDataProfile(this.#profile, workflow, activeHashes);
  }

  subscribe(listener) {
    this.#ensureInit();
    if (typeof listener !== 'function') throw new TypeError('Project Data listener must be a function.');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #publish(reason) {
    this.#ensureInit();
    const event = freezeDeep({
      reason,
      profile: this.#profile,
      revision: this.#profile.revision,
      profileSemanticHash: this.#profileSemanticHash,
    });
    this.#listeners.forEach((listener) => listener(event));
  }

  #computeProfileSemanticHash(profile) {
    this.#profileHashComputations += 1;
    return semanticHash(profile);
  }
}

export const projectDataStore = new ProjectDataStore();

function approvedProfile() {
  const profile = freezeDeep(clonePlain(upgradeProjectDataProfile(approved1885sProfile)));
  for (const workflow of ['normalization', 'topology', 'editing', 'webgl', 'benchmark']) {
    const audit = validateProjectDataProfile(profile, workflow, null);
    if (!audit.valid) throw new TypeError(`Bundled 1885S Project Data is invalid for ${workflow}: ${audit.errors.map((row) => `${row.path} ${row.message}`).join('; ')}`);
  }
  return profile;
}

function bundledOrigin(profileSemanticHash) {
  return freezeDeep({
    kind: 'BUNDLED_APPROVED_PROJECT_ARTIFACT',
    source: 'project-data/1885s-project-data-profile.json',
    profileSemanticHash,
  });
}
