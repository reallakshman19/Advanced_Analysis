#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createCalculationEffectiveValuesInspection,
  NON_FEA_CURRENT_FIELD_RESOLUTION_LEDGER_SCHEMA,
} from '../src/workspace/project-data/non-fea-calculation-effective-values-model.js';

const ledger = {
  schema: NON_FEA_CURRENT_FIELD_RESOLUTION_LEDGER_SCHEMA,
  status: 'READY',
  semanticHash: 'fnv1a64:0123456789abcdef',
  rows: [
    resolutionRow({
      targetKind: 'COMPONENT',
      targetId: 'P-100',
      fieldId: 'PIPE_OUTER_DIAMETER',
      selected: candidate({
        targetKind: 'COMPONENT', targetId: 'P-100', fieldId: 'PIPE_OUTER_DIAMETER',
        value: 168.3, unit: 'mm', authority: 'SOURCE_EXPLICIT',
        recordId: 'source:P-100:OD', sourceId: 'MODEL:SJSON', revision: '/components/0',
        evidence: { source: 'Source model', basis: 'Explicit model OD' }, fromSource: true,
      }),
      candidates: [
        candidate({
          targetKind: 'COMPONENT', targetId: 'P-100', fieldId: 'PIPE_OUTER_DIAMETER',
          value: 168.3, unit: 'mm', authority: 'SOURCE_EXPLICIT',
          recordId: 'source:P-100:OD', sourceId: 'MODEL:SJSON', revision: '/components/0',
          evidence: { source: 'Source model', basis: 'Explicit model OD' }, fromSource: true,
        }),
        candidate({
          targetKind: 'COMPONENT', targetId: 'P-100', fieldId: 'PIPE_OUTER_DIAMETER',
          value: 114.3, unit: 'mm', authority: 'PROJECT_CONFIGURED_DEFAULT',
          recordId: 'project-default:OD-DEFAULT:P-100', sourceId: 'Calculation Defaults', revision: '12',
          evidence: { source: 'Project Data configured default', defaultId: 'OD-DEFAULT', basis: 'Screening OD', scope: { lineIds: ['L100'] } },
        }),
      ],
    }),
    resolutionRow({
      targetKind: 'COMPONENT',
      targetId: 'P-100',
      fieldId: 'MATERIAL_DENSITY',
      selected: candidate({
        targetKind: 'COMPONENT', targetId: 'P-100', fieldId: 'MATERIAL_DENSITY',
        value: 7850, unit: 'kg/m3', authority: 'EXACT_APPROVED_MASTER',
        recordId: 'master:MAT-A', sourceId: 'PIPING_CLASS:MAT-A', revision: 'REV-4',
        evidence: { source: 'Piping class master', matchMethod: 'EXACT_CLASS_MATCH' },
      }),
      candidates: [candidate({
        targetKind: 'COMPONENT', targetId: 'P-100', fieldId: 'MATERIAL_DENSITY',
        value: 7850, unit: 'kg/m3', authority: 'EXACT_APPROVED_MASTER',
        recordId: 'master:MAT-A', sourceId: 'PIPING_CLASS:MAT-A', revision: 'REV-4',
        evidence: { source: 'Piping class master', matchMethod: 'EXACT_CLASS_MATCH' },
      })],
    }),
    resolutionRow({
      targetKind: 'COMPONENT',
      targetId: 'V-200',
      fieldId: 'COMPONENT_WEIGHT',
      selected: candidate({
        targetKind: 'COMPONENT', targetId: 'V-200', fieldId: 'COMPONENT_WEIGHT',
        value: 92, unit: 'kg', authority: 'PROJECT_CONFIGURED_DEFAULT',
        recordId: 'project-default:VALVE-92:V-200', sourceId: 'Calculation Defaults', revision: '12',
        evidence: { source: 'Project Data configured default', defaultId: 'VALVE-92', basis: 'Class 150 valve screening mass', scope: { componentTypes: ['VALVE'] } },
      }),
      candidates: [candidate({
        targetKind: 'COMPONENT', targetId: 'V-200', fieldId: 'COMPONENT_WEIGHT',
        value: 92, unit: 'kg', authority: 'PROJECT_CONFIGURED_DEFAULT',
        recordId: 'project-default:VALVE-92:V-200', sourceId: 'Calculation Defaults', revision: '12',
        evidence: { source: 'Project Data configured default', defaultId: 'VALVE-92', basis: 'Class 150 valve screening mass', scope: { componentTypes: ['VALVE'] } },
      })],
    }),
    resolutionRow({
      targetKind: 'COMPONENT',
      targetId: 'P-300',
      fieldId: 'PIPE_WALL_THICKNESS',
      status: 'BLOCKED',
      selected: null,
      candidates: [
        candidate({
          targetKind: 'COMPONENT', targetId: 'P-300', fieldId: 'PIPE_WALL_THICKNESS',
          value: 6.0, unit: 'mm', authority: 'EXACT_APPROVED_MASTER',
          recordId: 'master:WALL-A', sourceId: 'PIPING_CLASS:A', revision: 'REV-A',
          evidence: { source: 'Master A' },
        }),
        candidate({
          targetKind: 'COMPONENT', targetId: 'P-300', fieldId: 'PIPE_WALL_THICKNESS',
          value: 7.1, unit: 'mm', authority: 'EXACT_APPROVED_MASTER',
          recordId: 'master:WALL-B', sourceId: 'PIPING_CLASS:B', revision: 'REV-B',
          evidence: { source: 'Master B' },
        }),
      ],
    }),
  ],
};

const before = JSON.stringify(ledger);
const model = createCalculationEffectiveValuesInspection(ledger);
assert.equal(JSON.stringify(ledger), before, 'inspection must not mutate the current resolver ledger');
assert.equal(model.sourceSchema, NON_FEA_CURRENT_FIELD_RESOLUTION_LEDGER_SCHEMA);
assert.equal(model.sourceResolutionSemanticHash, ledger.semanticHash);
assert.equal(model.summary.rowCount, 4);
assert.equal(model.summary.resolvedCount, 3);
assert.equal(model.summary.blockedCount, 1);
assert.equal(model.summary.sourceExplicitCount, 1);
assert.equal(model.summary.exactMasterCount, 1);
assert.equal(model.summary.projectConfiguredDefaultCount, 1);

const od = find(model, 'COMPONENT', 'P-100', 'PIPE_OUTER_DIAMETER');
assert.equal(od.value, 168.3, 'inspection must mirror the resolver-selected source value');
assert.equal(od.effectiveAuthority, 'SOURCE_EXPLICIT');
assert.equal(od.sourceId, 'MODEL:SJSON');
assert.equal(od.basis, 'Explicit model OD');
assert.equal(od.candidateCount, 2);
assert.deepEqual(od.candidateAuthorities, ['PROJECT_CONFIGURED_DEFAULT', 'SOURCE_EXPLICIT']);
assert.equal(od.defaultId, null, 'shadowed project default must not be presented as the winner');

const density = find(model, 'COMPONENT', 'P-100', 'MATERIAL_DENSITY');
assert.equal(density.effectiveAuthority, 'EXACT_APPROVED_MASTER');
assert.equal(density.basis, 'Piping class master');

const valve = find(model, 'COMPONENT', 'V-200', 'COMPONENT_WEIGHT');
assert.equal(valve.effectiveAuthority, 'PROJECT_CONFIGURED_DEFAULT');
assert.equal(valve.defaultId, 'VALVE-92');
assert.deepEqual(valve.scope, { componentTypes: ['VALVE'] });

const blocked = find(model, 'COMPONENT', 'P-300', 'PIPE_WALL_THICKNESS');
assert.equal(blocked.status, 'BLOCKED');
assert.equal(blocked.value, null);
assert.equal(blocked.effectiveAuthority, null);
assert.equal(blocked.candidateCount, 2, 'blocked candidate custody must remain visible rather than disappearing');
assert.deepEqual(blocked.candidateAuthorities, ['EXACT_APPROVED_MASTER']);

const [routerSource, inspectorSource, runtimeSource] = await Promise.all([
  read('../src/workspace/project-data/project-data-view.js'),
  read('../src/workspace/project-data/non-fea-calculation-effective-values-view.js'),
  read('../src/workspace/non-fea-common-input-runtime.js'),
]);
assert.match(routerSource, /renderNonFeaCalculationEffectiveValuesInspector/u,
  'Load Calc Step 3 router must attach the effective-value inspector');
assert.match(inspectorSource, /buildCurrentPreFeaRequestInput/u,
  'inspector must consume the exact current Common Input request builder');
assert.match(inspectorSource, /resolutionLedger/u);
assert.doesNotMatch(inspectorSource, /resolveNonFeaEffectiveValues|resolveNonFeaEnrichment/u,
  'inspection view must not run a second authority resolver');
assert.doesNotMatch(inspectorSource,
  /sealCurrentNonFea|executeCurrentCommonInput|calculateAuthorized|authorizedEmpiricalRuntime/u,
  'inspection view must not call sealing, execution or authorized-runtime APIs');
assert.match(inspectorSource, /decision ledger, not a duplicate of the complete source model/u,
  'inspection must disclose that resolver rows are not a complete source-field inventory');
assert.match(inspectorSource, /Product-global screening assumptions remain/u,
  'Product defaults must remain distinguished from target-level selected evidence');
assert.match(runtimeSource, /(?:candidateR|r)esolutionLedger = resolveNonFeaEnrichment/u,
  'current Common Input remains the owner of target-level resolution');

console.log(JSON.stringify({
  check: 'non-fea-calculation-effective-values-inspection',
  status: 'PASS',
  sourceLedgerSchema: model.sourceSchema,
  rows: model.summary.rowCount,
  resolved: model.summary.resolvedCount,
  blocked: model.summary.blockedCount,
  sourceWinnerMirrored: true,
  masterWinnerMirrored: true,
  projectDefaultWinnerMirrored: true,
  blockedCandidateCustodyRetained: true,
  sourceOnlyInventoryOverclaimPrevented: true,
  secondResolverIntroduced: false,
}, null, 2));

function resolutionRow({ targetKind, targetId, fieldId, selected, candidates, status = 'RESOLVED' }) {
  return {
    resolutionKey: `${targetKind}|${targetId}|${fieldId}`,
    targetKind,
    targetId,
    fieldId,
    status,
    selected,
    candidates,
  };
}

function candidate(value) {
  return { ...value, migration: null, fromSource: value.fromSource === true };
}

function find(model, targetKind, targetId, fieldId) {
  const row = model.rows.find((candidateRow) => (
    candidateRow.targetKind === targetKind
    && candidateRow.targetId === targetId
    && candidateRow.fieldId === fieldId
  ));
  assert.ok(row, `missing inspection row ${targetKind}|${targetId}|${fieldId}`);
  return row;
}

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}
