import assert from 'node:assert/strict';
import { calculateSupportLoadScreeningTerms, calculateSupportLoads,
  DEFAULT_SUPPORT_LOAD_PROFILE as profile } from '../src/calc-workspace/supportLoadEngine.js';
import { bindEmpiricalScreeningPreview, empiricalScreeningReferences,
  renderEmpiricalScreeningPreview } from '../src/workspace/load-calc-empirical-screening.js';
import { renderEngineeringLoadPane } from '../src/workspace/load-calc-current-system-view.js';

const base = { opeVerticalN: 13000, outsideDiameterMm: 219.075, wallThicknessMm: 12.7, temperatureC: 100 };
const before = JSON.stringify({ base, profile });
const terms = calculateSupportLoadScreeningTerms(base, profile);
// Independent arithmetic for the existing default profile, not a new oracle.
const raw = 0.1 * 0.3 * 13000 * (12.7 / 6.3) / 1.23;
assert.equal(terms.guide.rawN, Math.round(raw * 1000) / 1000);
assert.equal(terms.guide.roundedGuideH, Math.ceil(raw / 50) * 50);
assert.equal(terms.guide.minimumOpeVerticalN, 3900);
assert.equal(terms.guide.guideH, 3900);
const stopRaw = 1000 * 0.0209 * ((3.14 / 32) * (219.075 ** 4 - (219.075 - 2 * 12.7) ** 4) / 219.075) ** 0.5079 / 1.23;
assert.equal(terms.lineStopN, Math.ceil(stopRaw / 50) * 50);
assert.equal(terms.scope, 'UNSIGNED_EMPIRICAL_SCREENING_MAGNITUDES_NOT_SOLVED_REACTIONS');
assert.ok(Object.isFrozen(terms.guide));
assert.equal(JSON.stringify({ base, profile }), before);
assert.throws(() => calculateSupportLoadScreeningTerms(base), /visible editable/);
assert.throws(() => calculateSupportLoadScreeningTerms(base, { ...profile, guideWallReferenceMm: 0 }), /positive/);
for (const mode of ['up', 'nearest', 'down']) {
  const changed = { ...profile, roundMode: mode };
  const legacyInput = { sourceObjectId: 'P', identity: { pipeOdMm: base.outsideDiameterMm },
    pipePhysical: { wallThicknessMm: base.wallThicknessMm, unitPipeWtKgPerM: 100, insulationWtKgPerM: 0, lumpWeightKg: 0 },
    process: { tempExpC1: 175, fluidWtOpeKgPerM: 3, fluidWtHydKgPerM: 4 },
    spans: { autoSpanMm: 10000, depSpanMm: 10000 }, readiness: { missing: [] } };
  const old = calculateSupportLoads(legacyInput, '', changed);
  const next = calculateSupportLoadScreeningTerms({ ...base, temperatureC: 175, opeVerticalN: old.vertical.opeVA }, changed);
  assert.equal(next.guide.guideH, old.guide.guideHA);
  assert.equal(next.guide.roundedGuideH, old.guide.roundedGuideHA);
  assert.equal(next.lineStopN, old.lineStop.lineStopH);
  assert.equal(next.temperatureFactor, 0.95);
}
const wallDominates = calculateSupportLoadScreeningTerms({ ...base, opeVerticalN: 1000,
  wallThicknessMm: 10000, outsideDiameterMm: 25000, temperatureC: 0 }, profile);
assert.ok(wallDominates.guide.roundedGuideH > wallDominates.guide.minimumOpeVerticalN);
assert.equal(wallDominates.guide.guideH, wallDominates.guide.roundedGuideH);
assert.equal(calculateSupportLoadScreeningTerms({ ...base, opeVerticalN: 0 }, profile).guide.guideH, 0);
for (const value of [null, undefined, NaN, Infinity, '100', -1]) {
  assert.equal(calculateSupportLoadScreeningTerms({ ...base, opeVerticalN: value }, profile).guide, null);
}
for (const key of ['wallThicknessMm', 'temperatureC']) for (const value of [null, undefined, NaN, Infinity, '']) {
  const result = calculateSupportLoadScreeningTerms({ ...base, [key]: value }, profile);
  assert.equal(result.guide, null); assert.equal(result.lineStopN, null);
}
assert.equal(calculateSupportLoadScreeningTerms({ ...base, wallThicknessMm: 0 }, profile).guide, null);
assert.equal(calculateSupportLoadScreeningTerms({ ...base, wallThicknessMm: 110 }, profile).guide, null);
assert.equal(calculateSupportLoadScreeningTerms({ ...base, temperatureC: 501 }, profile).temperatureClamped, true);
assert.equal(calculateSupportLoadScreeningTerms({ ...base, temperatureC: -1 }, profile).temperatureFactor, 1);

const row = { supportSiteId: 'S', tags: ['PS-test'], status: 'CALCULATED_WITH_EXCEPTIONS', verticalForceN: 13000 };
const distribution = { freshness: { status: 'CURRENT' }, method: 'CHAINAGE_TRIBUTARY_SPAN_V2',
  loadCases: [{ loadCaseId: 'OPE', status: 'CALCULATED_WITH_EXCEPTIONS', supportResults: [row] }] };
const distributionBefore = JSON.stringify(distribution);
assert.equal(empiricalScreeningReferences(distribution).length, 1);
for (const mutate of [
  { freshness: { status: 'STALE' } }, { method: 'UNQUALIFIED' },
  { loadCases: [{ ...distribution.loadCases[0], loadCaseId: 'HYD' }] },
  { loadCases: [distribution.loadCases[0], distribution.loadCases[0]] },
  ...['BLOCKED', 'FAILED', 'UNKNOWN'].map(status => ({ loadCases: [{ ...distribution.loadCases[0], status }] })),
  ...[-1, null, NaN, Infinity].map(verticalForceN => ({ loadCases: [{ ...distribution.loadCases[0], supportResults: [{ ...row, verticalForceN }] }] })),
  { loadCases: [{ ...distribution.loadCases[0], supportResults: [row, row] }] },
]) assert.equal(empiricalScreeningReferences({ ...distribution, ...mutate }).length, 0);
assert.equal(empiricalScreeningReferences({ ...distribution, loadCases: [{ ...distribution.loadCases[0], supportResults: [{ ...row, verticalForceN: 0 }] }] })[0].opeVerticalN, 0);
const html = renderEmpiricalScreeningPreview(distribution);
assert.match(html, /13000.000 N/); assert.match(html, /not an automatic/);
assert.match(html, /guideMinimumOpeVerticalFactor/); assert.match(html, /not exported as a calculated reaction/);
const escaped = renderEmpiricalScreeningPreview({ ...distribution, loadCases: [{ ...distribution.loadCases[0], supportResults: [{ ...row, tags: ['<script>'], supportSiteId: '"bad"' }] }] });
assert.ok(escaped.includes('&lt;script&gt;')); assert.ok(!escaped.includes('<script>'));

// DOM interaction seam only is doubled; calculations above use actual existing engine.
const output = { textContent: '' };
const ref = { value: 'S' };
const fields = Object.entries({ outsideDiameterMm: '219.075', wallThicknessMm: '12.7', temperatureC: '100' })
  .map(([key, value]) => ({ value, dataset: { screenInput: key } }));
const config = [{ value: '0.3', dataset: { screenProfile: 'guideMinimumOpeVerticalFactor' } }];
const handlers = {};
const root = { querySelector: selector => selector === '[data-screen-result]' ? output : ref,
  querySelectorAll: selector => selector === '[data-screen-input]' ? fields : config,
  addEventListener: (name, handler) => { handlers[name] = handler; } };
bindEmpiricalScreeningPreview({ querySelector: () => root }, distribution);
handlers.input(); assert.match(output.textContent, /Fh guide estimate 3900.000 N/);
fields[2].value = ''; handlers.input(); assert.match(output.textContent, /Fh not evaluated/);
assert.doesNotMatch(output.textContent, /Fh guide estimate/);
fields[2].value = '100'; config[0].value = '0'; handlers.change(); assert.match(output.textContent, /Screening not evaluated/);
config[0].value = '0.4'; handlers.change(); assert.match(output.textContent, /Fh guide estimate 5200.000 N/);
ref.value = ''; handlers.change(); assert.match(output.textContent, /Select a current OPE reference/);
assert.equal(JSON.stringify(distribution), distributionBefore);

const pane = { innerHTML: '' };
renderEngineeringLoadPane(pane, distribution, { sites: [], status: 'READY' }, { status: 'READY' });
assert.match(pane.innerHTML, /data-empirical-screen/);
assert.doesNotMatch(pane.innerHTML, /Definition not established/);
console.log('PASS existing empirical screening: independent arithmetic, actual legacy parity, wall/minimum branches, rounding, temperature, missing/invalid/zero/lift-off, OPE-only current references, DOM input changes, profile validation, escaping and immutability.');
