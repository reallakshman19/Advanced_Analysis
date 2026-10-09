#!/usr/bin/env node

/**
 * Every identifier a module calls must be bound in that module.
 *
 * An ES module with a missing import still loads: the ReferenceError fires only
 * when the call is reached. Both times this happened in this work the failure
 * surfaced far from its cause and looked like something else - the fitting
 * weight dialog "had nothing to show" because opening it threw and the view
 * caught the throw into a status message, and SJSON import "failed" with no
 * console error because the adapter threw mid-build. Neither was caught by a
 * check, because the unit checks import the helper directly and never exercise
 * the module that forgot to.
 *
 * So this greps rather than executes: for each watched module, every listed
 * helper it references must also appear in one of its import statements.
 * Cheap, and it fails at the file that is wrong.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WATCHED = Object.freeze({
  'src/core/shared-piping-model/adapters/workspace-dataset-to-shared.js': [
    'withConfiguredSourceAttributeAliases',
    'collectEvidence',
    'createEvidenceIndex',
  ],
  'src/workspace/load-calc-fitting-weight-dialog.js': [
    'zeroMassWaiverSuggested',
    'buildFittingWeightReviewRows',
    'fittingWeightRecordFor',
  ],
  'src/workspace/engineering-loads/current-common-input-empirical-mass-projection.js': [
    'optionalAuthorizedEmpiricalSourceLengthUnit',
    'zeroMassWaiverSetFromProfile',
    'projectDataValue',
    'projectEngineeringLoadSources',
    'derivePipeLikeFittingWeightEvidence',
    'resolveComponentCaseMass',
  ],
  'src/workspace/engineering-loads/empirical-gravity-method-selection.js': [
    'assertZeroMassWaiversAdmissible',
    'createNonFeaZeroMassWaiverSet',
    'zeroMassWaiverSetFromProfile',
  ],
  'src/workspace/project-data/non-fea-common-enriched-configured-default-overlay.js': [
    'sameEngineeringUnit',
    'normalizeEngineeringUnit',
  ],
  'src/workspace/project-data/non-fea-common-enriched-product-default-overlay.js': [
    'sameEngineeringUnit',
    'normalizeEngineeringUnit',
  ],
  'src/workspace/dataset-adapter.js': [
    'withAdjacentRunAttributes',
    'buildSharedPipingModelFromWorkspaceDataset',
    'indexWorkspaceSourcePackage',
  ],
  'src/workspace/auto-generated-pipe-run-attributes.js': [
    'withConfiguredSourceAttributeAliases',
    'ENGINEERING_PROPERTY_SPECS',
  ],
  'src/workspace/enrichment/non-fea-enrichment-view.js': [
    'countFittingsAwaitingWeight',
    'projectDataEntry',
    'NON_FEA_ZERO_MASS_WAIVER_PATH',
  ],
});

const unbound = [];
for (const [file, helpers] of Object.entries(WATCHED)) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  // Import statements only, so a mere mention in a comment or a string does
  // not count as a binding.
  const importBlock = (source.match(/^import[\s\S]*?from\s+'[^']+';$/gmu) || []).join('\n');
  for (const helper of helpers) {
    const used = new RegExp(`\\b${helper}\\s*\\(|\\b${helper}\\b(?!\\s*[,}]?\\s*from)`, 'u').test(
      source.replace(importBlock, ''),
    );
    if (!used) continue;
    if (!new RegExp(`\\b${helper}\\b`, 'u').test(importBlock)) {
      unbound.push(`${file}: ${helper} is used but never imported`);
    }
  }
}

assert.deepEqual(unbound, [], unbound.join('\n'));

console.log(JSON.stringify({
  check: 'non-fea-module-binding',
  modulesWatched: Object.keys(WATCHED).length,
  helpersWatched: Object.values(WATCHED).reduce((sum, row) => sum + row.length, 0),
  unbound: 0,
}, null, 2));
