#!/usr/bin/env node

/**
 * SJSON does not model the straight pipe between two fittings; the converter
 * synthesises one and marks it AUTO_GENERATED_PIPE. Those synthetic pipes
 * carry only what the gap geometry shows, so on the 1885S model all 43 of them
 * arrived with no insulation thickness while every real fitting around them
 * stated INSU 80mm - and the mass resolver, correctly, refused to project a
 * pipe mass whose insulation it could not determine.
 *
 * A synthetic pipe is the run between the fittings that bound it, so this pins
 * exactly when the bounding fittings settle a run-scoped value for it, and
 * exactly when they do not.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUTO_PIPE_RUN_ATTRIBUTE_INHERITED,
  AUTO_PIPE_RUN_ATTRIBUTE_UNRESOLVED,
  withAdjacentRunAttributes,
} from '../src/workspace/auto-generated-pipe-run-attributes.js';

const entity = (entityId, attributes, extra = {}) => Object.freeze({
  entityId,
  entityType: 'PIPE',
  parentSourceNodeKey: extra.branch || 'branch-1',
  properties: Object.freeze({ attributes: Object.freeze(attributes), ...extra.properties }),
});
const auto = (entityId, attributes = {}, extra) => entity(
  entityId, { AUTO_GENERATED_PIPE: 'true', ...attributes }, extra,
);
const inheritedOn = (rows, entityId) => rows.find((row) => row.entityId === entityId)
  .properties.enrichedAttributes || {};
const diagnosticsOn = (rows, entityId) => (rows.find((row) => row.entityId === entityId)
  .properties.diagnostics || []).map((row) => row.code);

// Both bounding fittings agree: the gap between them carries the value, and
// records where it came from.
{
  const rows = withAdjacentRunAttributes([
    entity('ELBO-1', { INSU: '80mm' }),
    auto('GAP-1'),
    entity('OLET-1', { INSU: '80mm' }),
  ]);
  assert.equal(inheritedOn(rows, 'GAP-1').INSU, '80mm');
  assert.match(inheritedOn(rows, 'GAP-1').INSU_SOURCE, /ELBO-1 and OLET-1/u);
  assert.deepEqual(diagnosticsOn(rows, 'GAP-1'), [AUTO_PIPE_RUN_ATTRIBUTE_INHERITED]);
  // Real components are returned exactly as they came in.
  assert.equal(rows[0].properties.enrichedAttributes, undefined);
  assert.equal(rows[2].properties.enrichedAttributes, undefined);
}

// They disagree: nothing is invented, and the disagreement is reported rather
// than settled by whichever side is consulted first.
{
  const rows = withAdjacentRunAttributes([
    entity('ELBO-1', { INSU: '80mm' }),
    auto('GAP-1'),
    entity('OLET-1', { INSU: '120mm' }),
  ]);
  assert.equal(inheritedOn(rows, 'GAP-1').INSU, undefined);
  assert.deepEqual(diagnosticsOn(rows, 'GAP-1'), [AUTO_PIPE_RUN_ATTRIBUTE_UNRESOLVED]);
}

// One side states it and the other is silent: the run may start, end or change
// at exactly that silent fitting, so the pipe keeps its absence.
{
  const rows = withAdjacentRunAttributes([
    entity('ELBO-1', { INSU: '80mm' }),
    auto('GAP-1'),
    entity('OLET-1', {}),
  ]);
  assert.equal(inheritedOn(rows, 'GAP-1').INSU, undefined);
  assert.deepEqual(diagnosticsOn(rows, 'GAP-1'), []);
}

// A head or tail pipe has no component on its outboard side at all. There is
// nothing there to disagree with, so the one fitting that bounds it governs.
{
  const rows = withAdjacentRunAttributes([
    auto('HEAD'),
    entity('ELBO-1', { INSU: '80mm' }),
    auto('TAIL'),
  ]);
  assert.equal(inheritedOn(rows, 'HEAD').INSU, '80mm');
  assert.equal(inheritedOn(rows, 'TAIL').INSU, '80mm');
  assert.match(inheritedOn(rows, 'HEAD').INSU_SOURCE, /adjacent ELBO-1$/u);
}

// A value the synthetic pipe states itself is never overwritten.
{
  const rows = withAdjacentRunAttributes([
    entity('ELBO-1', { INSU: '80mm' }),
    auto('GAP-1', { INSU: '25mm' }),
    entity('OLET-1', { INSU: '80mm' }),
  ]);
  assert.equal(inheritedOn(rows, 'GAP-1').INSU, undefined);
  assert.equal(rows.find((row) => row.entityId === 'GAP-1').properties.attributes.INSU, '25mm');
}

// Neighbours are the run's, not the model's: a fitting on another branch is
// not adjacent.
{
  const rows = withAdjacentRunAttributes([
    entity('ELBO-1', { INSU: '80mm' }, { branch: 'branch-A' }),
    auto('GAP-1', {}, { branch: 'branch-B' }),
    entity('OLET-1', { INSU: '80mm' }, { branch: 'branch-A' }),
  ]);
  assert.equal(inheritedOn(rows, 'GAP-1').INSU, undefined);
}

// A model with no synthetic pipes is returned as-is.
{
  const rows = [entity('ELBO-1', { INSU: '80mm' })];
  assert.equal(withAdjacentRunAttributes(rows), rows);
}

// A project that teaches the importer another name for the property gets the
// inheritance on that name too.
{
  const rows = withAdjacentRunAttributes([
    entity('ELBO-1', { LAGGING_MM: '65mm' }),
    auto('GAP-1'),
    entity('OLET-1', { LAGGING_MM: '65mm' }),
  ], { sourceAttributeAliases: { insulationThicknessMm: ['LAGGING_MM'] } });
  assert.equal(inheritedOn(rows, 'GAP-1').LAGGING_MM, '65mm');
}

// The real model: every synthetic pipe ends up with a thickness, and it comes
// from the neighbours rather than from a default.
{
  const { normalizeWorkspaceDataset } = await import('../src/workspace/dataset-adapter.js');
  const dataset = normalizeWorkspaceDataset(
    JSON.parse(readFileSync(new URL('../public/fixtures/Sjson.json', import.meta.url), 'utf8')),
    'Sjson.json',
  );
  const synthetic = dataset.entities.filter(
    (row) => String(row.properties?.attributes?.AUTO_GENERATED_PIPE).toLowerCase() === 'true',
  );
  assert.equal(synthetic.length, 43);
  assert.equal(synthetic.filter((row) => row.properties.enrichedAttributes?.INSU).length, 43);

  const components = dataset.sharedModel.components.filter((row) => /AUTO/u.test(row.name));
  assert.equal(components.length, 43);
  const thicknesses = components.map((row) => row.engineeringProperties.insulationThicknessMm);
  assert.equal(thicknesses.filter(Boolean).length, 43);
  assert.deepEqual(
    [...new Set(thicknesses.map((row) => row.sourceKind))],
    ['enrichedAttributes'],
    'inherited values must stay out of the source attributes',
  );
  // Not one project-wide number: the model carries more than one thickness and
  // each pipe took its own neighbours'.
  assert.ok(new Set(thicknesses.map((row) => row.value)).size > 1);
  console.log(JSON.stringify({
    check: 'non-fea-auto-generated-pipe-run-attribute',
    syntheticPipes: synthetic.length,
    insulationThicknessResolved: 43,
    distinctThicknessesMm: [...new Set(thicknesses.map((row) => row.value))].sort((a, b) => a - b),
    statedValueWins: true,
    disagreementReported: true,
    silentNeighbourRefused: true,
  }, null, 2));
}
