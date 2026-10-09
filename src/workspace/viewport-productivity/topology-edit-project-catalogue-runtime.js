import { stringValue } from '../../core/shared-piping-model/index.js';
import {
  createTopologyEditSpecificationCatalogue,
} from '../topology-edit/professional/topology-edit-spec-catalog.js';
import {
  createTopologyEditProjectCatalogueCustody,
  topologyEditProjectCatalogueCustodyMatchesDataset,
} from '../topology-edit/professional/topology-edit-project-catalogue-custody.js';

export const TOPOLOGY_EDIT_REPOSITORY_FIXTURE_CATALOGUE_URL =
  'fixtures/topology-edit-professional-spec-catalog.json';

export class TopologyEditProjectCatalogueRuntime {
  constructor(input = {}) {
    if (typeof input.getDatasetIdentity !== 'function') {
      throw new TypeError(
        'TopologyEditProjectCatalogueRuntime: getDatasetIdentity must be a function.',
      );
    }
    if (typeof input.getBaseURI !== 'function') {
      throw new TypeError(
        'TopologyEditProjectCatalogueRuntime: getBaseURI must be a function.',
      );
    }
    this.getDatasetIdentity = input.getDatasetIdentity;
    this.getBaseURI = input.getBaseURI;
    this.provider = input.provider
      ?? createTopologyEditRepositoryFixtureCatalogueProvider();
    if (typeof this.provider?.load !== 'function') {
      throw new TypeError(
        'TopologyEditProjectCatalogueRuntime: provider.load must be a function.',
      );
    }
    this.custody = null;
    this.requestSequence = 0;
  }

  currentCatalogue() {
    return this.custody?.catalogue ?? null;
  }

  matchesCurrentDataset() {
    if (!this.custody) return false;
    return topologyEditProjectCatalogueCustodyMatchesDataset(
      this.custody,
      normalizeDatasetIdentity(this.getDatasetIdentity()),
    );
  }

  invalidate() {
    this.requestSequence += 1;
    this.custody = null;
  }

  async load() {
    const requestSequence = ++this.requestSequence;
    const datasetIdentity = normalizeDatasetIdentity(this.getDatasetIdentity());
    let loaded;
    try {
      loaded = await this.provider.load({
        datasetIdentity,
        baseURI: this.getBaseURI(),
      });
    } catch (error) {
      if (this.isStaleRequest(requestSequence, datasetIdentity)) {
        return { status: 'STALE', custody: null };
      }
      throw error;
    }
    if (this.isStaleRequest(requestSequence, datasetIdentity)) {
      return { status: 'STALE', custody: null };
    }
    const catalogue = createTopologyEditSpecificationCatalogue(loaded?.catalogue);
    const custody = createTopologyEditProjectCatalogueCustody({
      datasetSourceHash: datasetIdentity.sourceHash,
      datasetSessionVersion: datasetIdentity.sessionVersion,
      sourceKind: loaded?.sourceKind,
      sourceLocator: loaded?.sourceLocator,
      catalogue,
    });
    if (this.isStaleRequest(requestSequence, datasetIdentity)) {
      return { status: 'STALE', custody: null };
    }
    this.custody = custody;
    return { status: 'CURRENT', custody };
  }

  isStaleRequest(requestSequence, datasetIdentity) {
    if (requestSequence !== this.requestSequence) return true;
    const currentIdentity = normalizeDatasetIdentity(this.getDatasetIdentity());
    return !sameDatasetIdentity(datasetIdentity, currentIdentity);
  }

  destroy() {
    this.invalidate();
  }
}

export function createTopologyEditRepositoryFixtureCatalogueProvider(input = {}) {
  const catalogueUrl = stringValue(input.catalogueUrl)
    || TOPOLOGY_EDIT_REPOSITORY_FIXTURE_CATALOGUE_URL;
  return Object.freeze({
    async load({ baseURI } = {}) {
      const url = new URL(catalogueUrl, requiredText(baseURI, 'baseURI'));
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(
          `TopologyEditProjectCatalogueRuntime: catalogue request returned ${response.status}.`,
        );
      }
      return {
        catalogue: await response.json(),
        sourceKind: 'REPOSITORY_FIXTURE',
        sourceLocator: catalogueUrl,
      };
    },
  });
}

function normalizeDatasetIdentity(value = {}) {
  const sourceHash = requiredText(value.sourceHash, 'dataset.sourceHash');
  const sessionVersion = Number(value.sessionVersion);
  if (!Number.isInteger(sessionVersion) || sessionVersion < 0) {
    throw new RangeError(
      'TopologyEditProjectCatalogueRuntime: dataset.sessionVersion must be a non-negative integer.',
    );
  }
  return { sourceHash, sessionVersion };
}

function sameDatasetIdentity(left, right) {
  return left.sourceHash === right.sourceHash
    && left.sessionVersion === right.sessionVersion;
}

function requiredText(value, label) {
  const text = stringValue(value);
  if (!text) {
    throw new TypeError(`TopologyEditProjectCatalogueRuntime: ${label} is required.`);
  }
  return text;
}
