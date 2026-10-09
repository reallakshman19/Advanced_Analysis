import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTopologyEditSpecificationCatalogue,
} from '../src/workspace/topology-edit/professional/topology-edit-spec-catalog.js';
import {
  assertTopologyEditProjectCatalogueCustody,
  createTopologyEditProjectCatalogueCustody,
  topologyEditProjectCatalogueCustodyMatchesDataset,
} from '../src/workspace/topology-edit/professional/topology-edit-project-catalogue-custody.js';
import {
  TopologyEditProjectCatalogueRuntime,
} from '../src/workspace/viewport-productivity/topology-edit-project-catalogue-runtime.js';

const DATASET_A = Object.freeze({ sourceHash: 'dataset-source-a', sessionVersion: 7 });
const DATASET_B = Object.freeze({ sourceHash: 'dataset-source-b', sessionVersion: 8 });

function catalogueInput() {
  return {
    catalogueId: 'project-catalogue-test',
    catalogueVersion: '2026.08',
    authority: {
      sourceId: 'project-specification-register',
      sourceVersion: 'rev-17',
      sourceHash: `sha256:${'a'.repeat(64)}`,
    },
    records: [{
      recordId: 'PIPE-DN100-TEST',
      componentType: 'PIPE',
      nominalSizeMm: 100,
      outsideDiameterMm: 114.3,
      schedule: '40',
      wallThicknessMm: 6.02,
      endConnectionFrom: 'BW',
      endConnectionTo: 'BW',
      pipingClass: 'TEST-150',
      sourceReference: {
        documentId: 'spec-register',
        revision: 'rev-17',
        path: '/pipe/dn100',
      },
    }],
  };
}

test('project catalogue custody is deterministic, immutable, and dataset-bound', () => {
  const catalogue = createTopologyEditSpecificationCatalogue(catalogueInput());
  const first = createTopologyEditProjectCatalogueCustody({
    datasetSourceHash: DATASET_A.sourceHash,
    datasetSessionVersion: DATASET_A.sessionVersion,
    sourceKind: 'PROJECT',
    sourceLocator: 'project://specification-register/rev-17',
    catalogue,
  });
  const second = createTopologyEditProjectCatalogueCustody({
    datasetSourceHash: DATASET_A.sourceHash,
    datasetSessionVersion: DATASET_A.sessionVersion,
    sourceKind: 'PROJECT',
    sourceLocator: 'project://specification-register/rev-17',
    catalogue,
  });

  assert.equal(first.custodyHash, second.custodyHash);
  assert.equal(first.catalogue.catalogueHash, catalogue.catalogueHash);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.dataset), true);
  assert.equal(Object.isFrozen(first.catalogue), true);
  assert.equal(topologyEditProjectCatalogueCustodyMatchesDataset(first, DATASET_A), true);
  assert.equal(topologyEditProjectCatalogueCustodyMatchesDataset(first, DATASET_B), false);
  assert.equal(assertTopologyEditProjectCatalogueCustody(first).custodyHash, first.custodyHash);

  const tampered = {
    ...first,
    dataset: { ...first.dataset, sessionVersion: first.dataset.sessionVersion + 1 },
  };
  assert.throws(
    () => assertTopologyEditProjectCatalogueCustody(tampered),
    /custody differs from its immutable content authority/,
  );
});

test('catalogue runtime rejects an older success after a newer dataset load wins', async () => {
  let identity = { ...DATASET_A };
  let resolveFirst;
  let loadCount = 0;
  const provider = {
    load() {
      loadCount += 1;
      if (loadCount === 1) {
        return new Promise((resolve) => { resolveFirst = resolve; });
      }
      return Promise.resolve(providerResult('PROJECT', 'project://catalogue/b'));
    },
  };
  const runtime = new TopologyEditProjectCatalogueRuntime({
    getDatasetIdentity: () => identity,
    getBaseURI: () => 'https://example.invalid/workspace/',
    provider,
  });

  const older = runtime.load();
  identity = { ...DATASET_B };
  runtime.invalidate();
  const newer = runtime.load();
  resolveFirst(providerResult('PROJECT', 'project://catalogue/a'));

  const [olderResult, newerResult] = await Promise.all([older, newer]);
  assert.equal(olderResult.status, 'STALE');
  assert.equal(newerResult.status, 'CURRENT');
  assert.equal(runtime.custody.dataset.sourceHash, DATASET_B.sourceHash);
  assert.equal(runtime.custody.dataset.sessionVersion, DATASET_B.sessionVersion);
  assert.equal(runtime.custody.source.locator, 'project://catalogue/b');
});

test('catalogue runtime suppresses an older failure after a newer dataset load wins', async () => {
  let identity = { ...DATASET_A };
  let rejectFirst;
  let loadCount = 0;
  const provider = {
    load() {
      loadCount += 1;
      if (loadCount === 1) {
        return new Promise((resolve, reject) => { rejectFirst = reject; });
      }
      return Promise.resolve(providerResult('PROJECT', 'project://catalogue/b'));
    },
  };
  const runtime = new TopologyEditProjectCatalogueRuntime({
    getDatasetIdentity: () => identity,
    getBaseURI: () => 'https://example.invalid/workspace/',
    provider,
  });

  const older = runtime.load();
  identity = { ...DATASET_B };
  runtime.invalidate();
  const newer = runtime.load();
  rejectFirst(new Error('obsolete project catalogue request failed'));

  const [olderResult, newerResult] = await Promise.all([older, newer]);
  assert.equal(olderResult.status, 'STALE');
  assert.equal(newerResult.status, 'CURRENT');
  assert.equal(runtime.currentCatalogue().catalogueId, 'project-catalogue-test');
});

function providerResult(sourceKind, sourceLocator) {
  return {
    catalogue: catalogueInput(),
    sourceKind,
    sourceLocator,
  };
}
