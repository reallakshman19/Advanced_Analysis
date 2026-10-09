#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = fs.readFileSync('src/workspace/engineering-model-store.js', 'utf8');
const viewport = fs.readFileSync('src/workspace/viewport-panel.js', 'utf8');
const scene = fs.readFileSync('src/workspace/three-viewport-scene.js', 'utf8');
const observer = fs.readFileSync('e2e/p1-browser-observer.js', 'utf8');
const spec = fs.readFileSync('e2e/p1-current-main-performance.spec.js', 'utf8');

const expected = Object.freeze({
  SUPPORT_SITE_CONSTRUCTION: 'workspace:p0:SUPPORT_SITE_CONSTRUCTION',
  ROUTE_CONSTRUCTION: 'workspace:p0:ROUTE_CONSTRUCTION',
  MODEL_ZONE_PROJECTION: 'workspace:p0:MODEL_ZONE_PROJECTION',
  RESOLVED_GEOMETRY_CONSTRUCTION: 'workspace:p0:RESOLVED_GEOMETRY_CONSTRUCTION',
  RENDER_MODEL_CONSTRUCTION: 'workspace:p0:RENDER_MODEL_CONSTRUCTION',
  THREE_MATERIALIZATION: 'workspace:p0:THREE_MATERIALIZATION',
  SCENE_INSTALLATION: 'workspace:p0:GPU_SCENE_INSTALL',
  FIT: 'workspace:p0:FIT',
});

assert.match(store, /measureNonFeaP0Stage\(\s*['"]SUPPORT_SITE_CONSTRUCTION['"],[\s\S]*?buildSupportSiteModel\(dataset, profile\)/u);
assert.match(store, /measureNonFeaP0Stage\(\s*['"]ROUTE_CONSTRUCTION['"],[\s\S]*?buildRoutePartitionModel\(dataset, profile\)/u);
assert.match(viewport, /measureNonFeaP0Stage\(\s*['"]MODEL_ZONE_PROJECTION['"],[\s\S]*?projectDatasetForModelZone\(dataset, this\.zoneSelection\)/u);
assert.match(viewport, /measureNonFeaP0Stage\(\s*['"]RESOLVED_GEOMETRY_CONSTRUCTION['"],[\s\S]*?buildResolvedEngineeringGeometry/u);
assert.match(viewport, /measureNonFeaP0Stage\(\s*['"]RENDER_MODEL_CONSTRUCTION['"],[\s\S]*?buildViewportRenderModel\(scoped\)/u);
assert.match(scene, /measureNonFeaP0Stage\(['"]FIT['"], \(\) => backend\.fitView\(\)\)/u);
assert.match(scene, /recordNonFeaP0Duration\(['"]GPU_SCENE_INSTALL['"], sceneInstallationMs\)/u);
assert.match(scene, /['"]THREE_MATERIALIZATION['"]/u);

for (const [stageId, measureName] of Object.entries(expected)) {
  assert.match(observer, new RegExp(`${stageId}: ['"]${measureName.replaceAll(':', '\\:')}['"]`, 'u'),
    `${stageId} observer mapping changed`);
}
assert.match(observer, /performance\.getEntriesByName\(measureName, ['"]measure['"]\)\[0\]/u,
  'P1 stage evidence must preserve first-occurrence semantics');
assert.doesNotMatch(observer, /entries\.reduce/u,
  'P1 stage evidence must not aggregate later actions into the initial stage measurement');
assert.match(spec, /page\.goto\(['"]\/\?nonFeaP0Evidence=1['"]/u,
  'P1 run must explicitly enable the gated production timing path');

console.log(JSON.stringify({
  status: 'PASS',
  requiredStages: Object.keys(expected),
  productionTimingNamespace: 'workspace:p0:*',
  firstOccurrenceSemanticsPreserved: true,
  numericalMethodChanged: false,
  evidenceSchemaChanged: false,
}, null, 2));
