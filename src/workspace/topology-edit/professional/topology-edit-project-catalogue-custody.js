import {
  deepFreeze,
  isPlainRecord,
  semanticHash,
  stringValue,
} from '../../../core/shared-piping-model/index.js';
import {
  assertTopologyEditSpecificationCatalogue,
} from './topology-edit-spec-catalog.js';

export const TOPOLOGY_EDIT_PROJECT_CATALOGUE_CUSTODY_SCHEMA =
  'TopologyEditProjectCatalogueCustody.v1';

export const TOPOLOGY_EDIT_PROJECT_CATALOGUE_SOURCE_KINDS = Object.freeze([
  'PROJECT',
  'REPOSITORY_FIXTURE',
  'TEST',
]);

const SOURCE_KINDS = new Set(TOPOLOGY_EDIT_PROJECT_CATALOGUE_SOURCE_KINDS);

export function createTopologyEditProjectCatalogueCustody(input = {}) {
  const catalogue = assertTopologyEditSpecificationCatalogue(input.catalogue);
  const material = {
    schema: TOPOLOGY_EDIT_PROJECT_CATALOGUE_CUSTODY_SCHEMA,
    dataset: {
      sourceHash: requiredText(input.datasetSourceHash, 'datasetSourceHash'),
      sessionVersion: nonNegativeInteger(
        input.datasetSessionVersion,
        'datasetSessionVersion',
      ),
    },
    source: {
      kind: sourceKind(input.sourceKind),
      locator: requiredText(input.sourceLocator, 'sourceLocator'),
    },
    catalogue,
  };
  return deepFreeze({ ...material, custodyHash: semanticHash(material) });
}

export function assertTopologyEditProjectCatalogueCustody(value) {
  if (!isPlainRecord(value)) fail('custody must be an object.');
  const rebuilt = createTopologyEditProjectCatalogueCustody({
    datasetSourceHash: value.dataset?.sourceHash,
    datasetSessionVersion: value.dataset?.sessionVersion,
    sourceKind: value.source?.kind,
    sourceLocator: value.source?.locator,
    catalogue: value.catalogue,
  });
  const supplied = { ...value };
  delete supplied.custodyHash;
  if (
    value.schema !== TOPOLOGY_EDIT_PROJECT_CATALOGUE_CUSTODY_SCHEMA
    || value.custodyHash !== semanticHash(supplied)
    || value.custodyHash !== rebuilt.custodyHash
  ) fail('custody differs from its immutable content authority.', RangeError);
  return rebuilt;
}

export function topologyEditProjectCatalogueCustodyMatchesDataset(
  custodyInput,
  identity = {},
) {
  const custody = assertTopologyEditProjectCatalogueCustody(custodyInput);
  return custody.dataset.sourceHash === stringValue(identity.sourceHash)
    && custody.dataset.sessionVersion === Number(identity.sessionVersion);
}

function sourceKind(value) {
  const token = requiredText(value, 'sourceKind').toUpperCase();
  if (!SOURCE_KINDS.has(token)) {
    fail(`sourceKind has unsupported value ${token}.`, RangeError);
  }
  return token;
}

function nonNegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    fail(`${label} must be a non-negative integer.`, RangeError);
  }
  return number;
}

function requiredText(value, label) {
  const text = stringValue(value);
  if (!text) fail(`${label} is required.`);
  return text;
}

function fail(message, Constructor = TypeError) {
  throw new Constructor(`TopologyEditProjectCatalogueCustody: ${message}`);
}
