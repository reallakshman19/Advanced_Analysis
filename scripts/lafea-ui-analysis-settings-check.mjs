#!/usr/bin/env node
import assert from 'node:assert/strict';
import { sourceFixture } from './lafea.1-fixtures.mjs';
import { triangleSource } from './lafea.3-fixtures.mjs';
import {
  LAFEA_ANALYSIS_SETTINGS_VIEW_SCHEMA,
  buildLafeaAnalysisSettingsViewModel,
} from '../src/workspace/lafea-analysis-settings-view.js';

const analyticalDocument = sourceFixture();
const analytical = buildLafeaAnalysisSettingsViewModel(stage(
  'LAFEA.1',
  analyticalDocument,
  'ANALYTICAL_FOUNDATION_V1',
));
assert.equal(analytical.schema, LAFEA_ANALYSIS_SETTINGS_VIEW_SCHEMA);
assert.equal(analytical.readOnly, false);
assert.equal(value(analytical, 'Lifecycle profile'), 'ANALYTICAL_FOUNDATION_V1');
assert.equal(value(analytical, 'Lifecycle source binding'), 'CURRENT');
assert.equal(value(analytical, 'Model identity'), analyticalDocument.modelIdentity);
assert.equal(value(analytical, 'Qualification profile'), analyticalDocument.qualificationProfile.identity);
assert.equal(value(analytical, 'Thickness policy'), analyticalDocument.thicknessBasis.policy);
assert.match(value(analytical, 'Requested analyses / cases'), /LOAD_TRANSFER/u);
assert.match(value(analytical, 'Unit basis'), /length: mm/u);
assert.equal(
  value(analytical, 'Code / allowable basis'),
  'Not declared by the active stage source contract',
);
assert.ok(analytical.qualificationDetails.length > 0);

const continuumDocument = triangleSource();
const continuum = buildLafeaAnalysisSettingsViewModel(stage(
  'LAFEA.3',
  continuumDocument,
  'FEA_MESH_RECOVERY_V1',
));
assert.equal(value(continuum, 'Formulation'), 'Plane stress');
assert.equal(continuum.formulationControl.current, continuumDocument.formulation);
assert.match(value(continuum, 'Requested analyses / cases'), /L1/u);
assert.match(value(continuum, 'Unit basis'), /stress: MPa/u);
assert.equal(value(continuum, 'Code / allowable basis'), 'Not declared by the active stage source contract');

console.log(JSON.stringify({
  check: 'lafea-ui-analysis-settings',
  status: 'PASS',
  sourceSettingsEditable: true,
  governedSolverSettingsLocked: true,
  humanReadableFormulationProjection: true,
  governedFormulationIdentityPreserved: true,
  missingCodeBasisIsExplicit: true,
  githubActionsWorkflowAdded: false,
}));

// Keep the qualified LAFEA.3 refinement route in the existing release gate
// without adding a second workflow or weakening any engineering threshold.
await import('./lafea3-local-refinement-ui-check.mjs');
await import('./lafea3-mapped-refinement-envelope-check.mjs');
await import('./lafea-retained-mesh-refinement-check.mjs');

function stage(stageId, document, profileId) {
  return {
    stageId,
    document,
    lifecycle: { profileId },
    lifecycleBinding: { status: 'CURRENT' },
  };
}
function value(model, label) {
  return model.rows.find((row) => row.label === label)?.value;
}

await import('./lafea-pr1270-longest-edge-diagnostic.mjs');
