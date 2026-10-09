#!/usr/bin/env node

/**
 * A shared model normalized from a source that states no units carries
 * units.length "unknown". SJSON is such a source: the 1885S model reaches the
 * load-source projection with {"length":"unknown","force":"unknown","mass":"unknown"},
 * so no length factor resolves, every component is stamped UNIT_BLOCKED, and
 * the first one reached fails as "cannot project EMPTY mass" - a message about
 * mass for a fault about units.
 *
 * The unit for those models is approved Project Data, not source evidence.
 * This pins that a caller holding that authority can supply it, and that
 * omitting it still lets the model's own units decide.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSharedPipingModel, semanticHash } from '../src/core/shared-piping-model/index.js';
import { buildPipingPortTopologyGraph } from '../src/core/piping-topology/index.js';
import { projectEngineeringLoadSources } from '../src/core/model-loads/load-source-projection.js';

function modelWithUnits(lengthUnit) {
  return createSharedPipingModel({
    project: { datasetId: 'UNIT-CHECK', name: 'UNIT-CHECK', sourceName: 'unit-check.json' },
    units: { length: lengthUnit, force: 'unknown', mass: 'unknown' },
    sourceSnapshotRef: {
      schema: 'source-package-snapshot/v1', datasetId: 'UNIT-CHECK',
      sourceSchema: 'synthetic/v1', sourceSemanticHash: semanticHash({ u: lengthUnit }),
      sourceByteHash: null,
    },
    components: [{
      componentKey: 'PIPE-1', sourceEntityId: 'E1', name: 'PIPE-1', type: 'PIPE',
      identity: { lineId: 'L1', branchId: 'L1/B1', systemId: '', zoneId: '' },
      geometry: {
        start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 }, center: null,
        points: [], branchPoints: [], sources: {}, sourcePath: '/PIPE-1', ports: [],
      },
      engineeringProperties: {}, compatibilityEvidence: {},
      sourceReferences: { sourceEntityId: 'E1' }, diagnostics: [],
    }],
    supports: [], sourceReferences: { nodes: [] }, diagnostics: [],
  });
}

const UNKNOWN = modelWithUnits('unknown');
const graph = buildPipingPortTopologyGraph(UNKNOWN);

// Reproduces the 1885S fault: no governed unit, so nothing projects.
const withoutAuthority = projectEngineeringLoadSources(UNKNOWN, graph);
assert.equal(withoutAuthority.units.unitSupported, false);
assert.equal(withoutAuthority.units.sourceLengthUnit, 'unknown');
assert.ok(
  withoutAuthority.components.every((row) => row.diagnostics.some((d) => d.code === 'UNIT_BLOCKED')),
  'every component is unit-blocked when no unit resolves',
);

// The approved Project Data unit makes the same model projectable.
const withAuthority = projectEngineeringLoadSources(UNKNOWN, graph, { sourceLengthUnit: 'mm' });
assert.equal(withAuthority.units.unitSupported, true);
assert.equal(withAuthority.units.sourceLengthUnit, 'mm');
assert.ok(
  withAuthority.components.every((row) => !row.diagnostics.some((d) => d.code === 'UNIT_BLOCKED')),
  'a governed unit clears UNIT_BLOCKED',
);
assert.equal(withAuthority.components[0].geometry.sourceLengthM, 1, '1000 mm is one metre');

// Omitting the override must not change a model that does declare its units.
const declared = modelWithUnits('mm');
const declaredGraph = buildPipingPortTopologyGraph(declared);
assert.deepEqual(
  projectEngineeringLoadSources(declared, declaredGraph).units,
  projectEngineeringLoadSources(declared, declaredGraph, {}).units,
);
assert.equal(projectEngineeringLoadSources(declared, declaredGraph).units.unitSupported, true);

// An override is a unit, not a licence: an unusable one still blocks.
const nonsense = projectEngineeringLoadSources(UNKNOWN, graph, { sourceLengthUnit: 'furlong' });
assert.equal(nonsense.units.unitSupported, false);

// The current-common-input path must take the unit from the governed basis.
const massProjectionSource = readFileSync(
  new URL('../src/workspace/engineering-loads/current-common-input-empirical-mass-projection.js', import.meta.url),
  'utf8',
);
assert.ok(
  massProjectionSource.includes('optionalAuthorizedEmpiricalSourceLengthUnit(commonInput.projectDataProfile)'),
  'the mass projection must read the approved source basis',
);
assert.ok(
  massProjectionSource.includes('sourceLengthUnit: governedLengthUnit'),
  'the mass projection must pass the governed length unit into the load-source projection',
);

console.log(JSON.stringify({
  check: 'non-fea-load-source-length-unit',
  unknownUnitsBlockEveryComponent: true,
  governedUnitClearsBlock: true,
  governedUnitConvertsGeometry: '1000 mm -> 1 m',
  declaredUnitsUnchanged: true,
  unusableOverrideStillBlocks: true,
  massProjectionUsesGovernedBasis: true,
}, null, 2));

// PD-COMPONENT-COG-FALLBACK declares the geometric midpoint as the placement
// for a component with no exact CoG authority, and the gravity method selector
// already honours it. The load-source projection must honour the same policy,
// or a fitting whose mass was derived from its adjacent pipe section blocks
// with MISSING_COMPONENT_COG for want of a point to apply that mass at.
const lumped = createSharedPipingModel({
  project: { datasetId: 'COG-CHECK', name: 'COG-CHECK', sourceName: 'cog-check.json' },
  units: { length: 'mm', force: 'unknown', mass: 'unknown' },
  sourceSnapshotRef: {
    schema: 'source-package-snapshot/v1', datasetId: 'COG-CHECK',
    sourceSchema: 'synthetic/v1', sourceSemanticHash: semanticHash({ c: 1 }), sourceByteHash: null,
  },
  components: [{
    componentKey: 'ELBO-1', sourceEntityId: 'E1', name: 'ELBO-1', type: 'ELBO',
    identity: { lineId: 'L1', branchId: 'L1/B1', systemId: '', zoneId: '' },
    geometry: {
      start: { x: 0, y: 0, z: 0 }, end: { x: 200, y: 0, z: 0 }, center: null,
      points: [], branchPoints: [], sources: {}, sourcePath: '/ELBO-1', ports: [],
    },
    engineeringProperties: {}, compatibilityEvidence: {},
    sourceReferences: { sourceEntityId: 'E1' }, diagnostics: [],
  }],
  supports: [], sourceReferences: { nodes: [] }, diagnostics: [],
});
const lumpedGraph = buildPipingPortTopologyGraph(lumped);

const withoutPolicy = projectEngineeringLoadSources(lumped, lumpedGraph);
assert.equal(withoutPolicy.components[0].geometry.applicationPoint, null,
  'no policy means no assumed placement');

const withPolicy = projectEngineeringLoadSources(lumped, lumpedGraph, {
  componentCogFallback: 'GEOMETRIC_MIDPOINT',
});
assert.deepEqual(withPolicy.components[0].geometry.applicationPoint, { x: 0.1, y: 0, z: 0 },
  'the governed fallback places mass at the component geometric midpoint');
assert.ok(
  withPolicy.components[0].diagnostics.some((d) => d.code === 'COMPONENT_COG_GEOMETRIC_MIDPOINT_ASSUMED'),
  'an assumed placement must be recorded, not silent',
);

// DISABLED is a policy too, and it must not place anything.
assert.equal(
  projectEngineeringLoadSources(lumped, lumpedGraph, { componentCogFallback: 'DISABLED' })
    .components[0].geometry.applicationPoint,
  null,
);
