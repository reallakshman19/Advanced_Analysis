import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildWeightReviewRows, weightReviewMassValues, WeightReviewSession } from '../src/workspace/load-calc-weight-review-model.js';
import { collapsedWeightRowMarkup } from '../src/workspace/load-calc-weight-review-dialog.js';

const pipe = {
  componentKey: 'p1', type: 'PIPE', identity: { branchId: 'B1' }, diagnostics: [],
  geometry: { start: [0, 0, 0], end: [2, 0, 0], sourceLengthM: 2, applicationPoint: null },
  engineeringProperties: { outerDiameterMm: { value: 100 }, wallThicknessMm: { value: 5 },
    materialDensityKgM3: { value: 7850 }, fluidDensityOpeKgM3: { value: 800 },
    fluidDensityHydKgM3: { value: 1000 }, insulationThicknessMm: { value: 25 },
    insulationDensityKgM3: { value: 100 } },
};
const fitting = (id, type, branch = 'B1') => ({ componentKey: id, type,
  identity: { branchId: branch }, diagnostics: [], geometry: { applicationPoint: [1, 0, 0] }, engineeringProperties: {} });
const components = [pipe, fitting('t1', 'TEE'), fitting('o1', 'OLET'), fitting('r1', 'REDU'), fitting('c1', 'CAP'), fitting('t2', 'TEE', 'B2'), fitting('v1', 'VALV')];
const coverage = { requirementId: 'MASS_COVERAGE', missing: ['c1:COMPONENT_WEIGHT', 't2:COMPONENT_WEIGHT', 'v1:COMPONENT_WEIGHT'] };
const original = JSON.stringify(components);
const rows = buildWeightReviewRows({ components, methodRows: [{ coverageRequirements: [coverage] }, { coverageRequirements: [coverage] }], loadCaseIds: ['EMPTY', 'OPE', 'HYD'] });
const byId = Object.fromEntries(rows.map((row) => [row.entityId, row]));
assert.equal(rows.length, 7);
assert.deepEqual(byId.c1.missing, ['COMPONENT_WEIGHT']);
assert.equal(byId.p1.cases.EMPTY.ok, true);
assert.deepEqual(byId.p1.cases.OPE.massSourceBreakdown.map((r) => r.sourceId), ['PIPE_METAL', 'INSULATION', 'OPE_FLUID']);
assert.ok(byId.p1.cases.HYD.massPerLengthKgM > byId.p1.cases.OPE.massPerLengthKgM);
assert.equal(byId.t1.derived.derivation.developedLengthFactor, 1);
assert.equal(byId.o1.derived.derivation.developedLengthFactorAssumed, true);
assert.equal(byId.r1.derived.derivation.developedLengthFactorAssumed, true);
assert.equal(byId.c1.derived, null);
assert.equal(byId.c1.cases.EMPTY.ok, false);
assert.equal(byId.t2.derived, null, 'Never borrow a section from a different branch');
assert.equal(JSON.stringify(components), original, 'Review must not insert derived weights into source evidence');
const previewMass = weightReviewMassValues(byId.p1, 'OPE');
assert.equal(previewMass.coreMassKg, previewMass.metalKg + previewMass.fluidKg + previewMass.insulationKg);
const collapsed = collapsedWeightRowMarkup(byId.t1, 'EMPTY');
assert.match(collapsed.slice(0, collapsed.indexOf('</summary>')), /Dry\/metal: [\d.,]+ kg/);
assert.ok(!/^<details[^>]*\sopen(?:\s|>)/.test(collapsed), 'Each item starts collapsed with mass visible in summary');
assert.match(collapsedWeightRowMarkup(byId.t2, 'OPE').split('</summary>')[0], /Dry\/metal: Pending/);
assert.equal(weightReviewMassValues(byId.t2, 'OPE').coreMassKg, null);
assert.match(collapsedWeightRowMarkup(byId.c1, 'EMPTY', 'Awaiting dimensions').split('</summary>')[0], /Skipped review · still unresolved/);
assert.match(collapsedWeightRowMarkup(byId.o1, 'EMPTY').split('</summary>')[0], /\(estimate\)/);
assert.match(collapsedWeightRowMarkup(byId.t1, 'EMPTY').split('</summary>')[0], /Insulation: Not derived/);
const noCog = buildWeightReviewRows({ components: [pipe, { ...fitting('unplaced', 'TEE'), geometry: {} }], loadCaseIds: ['EMPTY'] }).find((row) => row.entityId === 'unplaced');
assert.ok(weightReviewMassValues(noCog, 'EMPTY').metalKg > 0);
assert.equal(weightReviewMassValues(noCog, 'EMPTY').coreMassKg, null, 'Dry evidence survives but unplaced mass cannot be shown as executable case mass');
assert.match(collapsedWeightRowMarkup(noCog, 'EMPTY').split('</summary>')[0], /MISSING_COMPONENT_COG/);
const session = new WeightReviewSession();
session.bind('candidate:a');
assert.throws(() => session.skip('candidate:a', 'v1', '', rows), /reason/);
assert.throws(() => session.skip('candidate:a', 'p1', 'defer', rows), /unresolved/);
assert.throws(() => session.skip('candidate:a', 'c1', 'defer', rows), /manual weight-review/);
assert.throws(() => session.skip('candidate:a', 't2', 'defer', rows), /manual weight-review/);
session.skip('candidate:a', 'v1', 'Awaiting valve catalogue', rows);
assert.equal(session.skipped.get('v1'), 'Awaiting valve catalogue');
assert.equal(byId.v1.cases.EMPTY.ok, false, 'Skip cannot turn a failed mass resolution into ready');
session.bind('candidate:a');
assert.equal(session.skipped.size, 1, 'Reopening the same candidate retains review');
session.restore('v1');
assert.equal(session.skipped.size, 0);
session.skip('candidate:a', 'v1', 'defer', rows);
session.bind('candidate:b');
assert.equal(session.skipped.size, 0, 'Changed authority invalidates review deferrals');
assert.throws(() => session.skip('candidate:a', 'v1', 'defer', rows), /changed/);
const dialog = await readFile(new URL('../src/workspace/load-calc-weight-review-dialog.js', import.meta.url), 'utf8');
assert.ok(dialog.includes('dialog.showModal()'), 'Native modal supplies keyboard focus containment');
assert.ok(dialog.includes("dialog.addEventListener('close'"));
assert.ok(!/sealCurrent|acceptProposal|authorize|replaceProjectDataValue|stageProposal\(/.test(dialog), 'Popup is observational; no authority writes');
console.log('PASS load-calc-weight-review-check: existing resolver, contributions, fitting limitations, deduplicated obligations, immutable evidence, reasoned skip/restore/currentness, modal boundary');
