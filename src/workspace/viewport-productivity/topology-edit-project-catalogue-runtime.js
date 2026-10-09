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

const SHA256 = /^sha256:[a-f0-9]{64}$/u;

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

export function createTopologyEditDatasetCatalogueProvider(input = {}) {
  if (typeof input.getDataset !== 'function') {
    throw new TypeError(
      'TopologyEditProjectCatalogueRuntime: getDataset must be a function.',
    );
  }
  const fallback = input.fallbackProvider
    ?? createTopologyEditRepositoryFixtureCatalogueProvider(input);
  return Object.freeze({
    async load(context = {}) {
      const dataset = input.getDataset();
      const basis = topologyEditDatasetCatalogueBasis(dataset);
      const loaded = await fallback.load({
        ...context,
        requireContentSha256: Boolean(basis),
      });
      if (!basis) return loaded;
      const catalogue = createTopologyEditSpecificationCatalogue(loaded.catalogue);
      assertProjectCatalogueBasis(basis, catalogue, loaded.contentSha256);
      return {
        ...loaded,
        catalogue,
        sourceKind: 'PROJECT',
        sourceLocator: basis.locator,
      };
    },
  });
}

export function topologyEditDatasetCatalogueBasis(dataset) {
  const candidates = [
    ['nativeAuthoring.catalogueBasis', dataset?.nativeAuthoring?.catalogueBasis],
    [
      'sourceSnapshot.sourcePackage.project.catalogueBasis',
      dataset?.sourceSnapshot?.sourcePackage?.project?.catalogueBasis,
    ],
    [
      'sourceSnapshot.sourcePackage.catalogueBasis',
      dataset?.sourceSnapshot?.sourcePackage?.catalogueBasis,
    ],
  ];
  const match = candidates.find(([, value]) => value && typeof value === 'object');
  if (!match) return null;
  const [locator, value] = match;
  return Object.freeze({
    catalogueId: requiredText(value.catalogueId, `${locator}.catalogueId`),
    catalogueVersion: requiredText(value.catalogueVersion, `${locator}.catalogueVersion`),
    catalogueHash: exactSha(value.catalogueHash, `${locator}.catalogueHash`),
    sourceHash: exactSha(value.sourceHash, `${locator}.sourceHash`),
    locator,
  });
}

export function createTopologyEditRepositoryFixtureCatalogueProvider(input = {}) {
  const catalogueUrl = stringValue(input.catalogueUrl)
    || TOPOLOGY_EDIT_REPOSITORY_FIXTURE_CATALOGUE_URL;
  return Object.freeze({
    async load({ baseURI, requireContentSha256 = false } = {}) {
      const url = new URL(catalogueUrl, requiredText(baseURI, 'baseURI'));
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(
          `TopologyEditProjectCatalogueRuntime: catalogue request returned ${response.status}.`,
        );
      }
      if (!requireContentSha256) {
        return {
          catalogue: await response.json(),
          contentSha256: null,
          sourceKind: 'REPOSITORY_FIXTURE',
          sourceLocator: catalogueUrl,
        };
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return {
        catalogue: JSON.parse(text),
        contentSha256: await sha256Bytes(bytes),
        sourceKind: 'REPOSITORY_FIXTURE',
        sourceLocator: catalogueUrl,
      };
    },
  });
}

function assertProjectCatalogueBasis(basis, catalogue, contentSha256) {
  const mismatches = [];
  if (catalogue.catalogueId !== basis.catalogueId) mismatches.push('catalogueId');
  if (catalogue.catalogueVersion !== basis.catalogueVersion) mismatches.push('catalogueVersion');
  if (catalogue.authority.sourceHash !== basis.sourceHash) mismatches.push('sourceHash');
  if (contentSha256 !== basis.catalogueHash) mismatches.push('catalogueHash');
  if (mismatches.length) {
    throw new RangeError(
      `TopologyEditProjectCatalogueRuntime: project catalogue basis mismatch: ${mismatches.join(', ')}.`,
    );
  }
}

async function sha256Bytes(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'TopologyEditProjectCatalogueRuntime: Web Crypto SHA-256 authority is unavailable.',
    );
  }
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
  return `sha256:${[...digest].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
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

function exactSha(value, label) {
  const text = requiredText(value, label).toLowerCase();
  if (!SHA256.test(text)) {
    throw new RangeError(
      `TopologyEditProjectCatalogueRuntime: ${label} must be sha256:<64 lowercase hex>.`,
    );
  }
  return text;
}

function requiredText(value, label) {
  const text = stringValue(value);
  if (!text) {
    throw new TypeError(`TopologyEditProjectCatalogueRuntime: ${label} is required.`);
  }
  return text;
}
