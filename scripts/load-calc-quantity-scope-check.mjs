import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { buildPipingPortTopologyGraph, createExactTopologyProfile } from '../src/core/piping-topology/index.js';
import { buildSupportAttachmentModel, buildRestraintCapabilityModel, createEvidenceOnlyAttachmentProfile } from '../src/core/support-restraints/index.js';
import { renderEngineeringLoadPane } from '../src/workspace/load-calc-current-system-view.js';

const support = { supportSiteId: 'S', status: 'CALCULATED', verticalForceN: 0,
  cantileverMomentDemandNmm: 32000, contributorIds: [] };
const loadCase = { loadCaseId: 'EMPTY', status: 'CALCULATED_WITH_EXCEPTIONS', supportResults: [support],
  exceptionLedger: [], contributionLedger: [], excludedInputs: [] };
const distribution = { method: 'CHAINAGE_TRIBUTARY_SPAN_V3_COG', status: 'CALCULATED_WITH_EXCEPTIONS',
  freshness: { status: 'CURRENT' }, sourceAxisBasis: 'Y_UP',
  verticalForceConvention: 'positive reaction opposes source-axis gravity', loadCases: [loadCase] };
const receipt = { executedMethod: distribution.method, commonInputSemanticHash: 'COMMON',
  commonInputSealSemanticHash: 'SEAL', runAuthorizationSemanticHash: 'AUTH',
  massProjectionSemanticHash: 'MASS', distributionSemanticHash: 'DIST', semanticHash: 'RECEIPT' };
function render(value, currentReceipt = receipt) {
  const pane = { innerHTML: '' };
  renderEngineeringLoadPane(pane, value, { sites: [], status: 'READY' }, { status: 'READY' },
    null, {}, currentReceipt);
  return pane.innerHTML;
}
const before = JSON.stringify({ distribution, receipt });
const html = render(distribution);
assert.match(html, /data-load-quantity-scope/);
assert.match(html, /source Y-up/);
assert.doesNotMatch(html, /source Z-up/);
assert.match(html, /Vertical gravity reaction[\s\S]*1 \/ 1 current rows/);
for (const key of ['Fv', 'Fh', 'Fa', 'Fl', 'MX / MY / MZ']) {
  assert.ok(html.includes(key));
}
assert.match(html, /rest-axis projection/);
assert.match(html, /not recovered support moments/);
assert.match(html, /Fh[\s\S]*ACCESS_TEMP_WALL_WEIGHTED_V1/);
assert.match(html, /unsigned estimate, not a solved horizontal vector/);
assert.ok(html.includes('0.000'), 'computed exact zero must remain a value');
assert.ok(html.includes('32000.000'), 'unchanged transfer demand stays separately labelled Nmm');
for (const axis of ['X', 'Y', 'Z']) assert.ok(render({ ...distribution, sourceAxisBasis: `${axis}_UP` }).includes(`source ${axis}-up`));
for (const status of ['STALE', 'UNKNOWN']) {
  const stale = render({ ...distribution, freshness: { status } }, null);
  assert.match(stale, /Historical only/);
  assert.doesNotMatch(stale, /1 \/ 1 current rows/);
}
for (const status of ['FAILED', 'BLOCKED', 'UNKNOWN']) {
  const rejected = render({ ...distribution, loadCases: [{ ...loadCase, status }] });
  assert.match(rejected, /0 \/ 1 current rows/);
}
const missing = render({ ...distribution, loadCases: [{ ...loadCase,
  supportResults: [{ ...support, verticalForceN: null }, { ...support, verticalForceN: NaN },
    { ...support, status: 'FAILED' }] }] });
assert.match(missing, /0 \/ 3 current rows/);
const escaped = render({ ...distribution, method: '<img onerror="bad">', sourceAxisBasis: '<script>' });
assert.ok(escaped.includes('&lt;img')); assert.ok(!escaped.includes('<img'));
assert.ok(escaped.includes('axis unavailable'));
assert.equal(JSON.stringify({ distribution, receipt }), before);
console.log('PASS requested-quantity scope: current/historical scalar availability, finite zero/missing, actual XYZ-axis labels, unsupported projections/moments kept separate, receipt/value immutability.');

// Actual source diagnosis, not scenario authorization or a numerical PASS.
const raw = JSON.parse(readFileSync(new URL('../public/fixtures/Sjson.json', import.meta.url), 'utf8'));
const rawBefore = JSON.stringify(raw);
const dataset = normalizeWorkspaceDataset(raw, 'Sjson.json');
const topology = buildPipingPortTopologyGraph(dataset.sharedModel,
  createExactTopologyProfile(dataset.sharedModel.units.length));
const attachments = buildSupportAttachmentModel(dataset.sharedModel, topology,
  createEvidenceOnlyAttachmentProfile(dataset.sharedModel.units.length));
const restraints = buildRestraintCapabilityModel(attachments);
const types = Object.fromEntries([...new Set(restraints.restraints.map(row => row.supportType))]
  .map(type => [type, restraints.restraints.filter(row => row.supportType === type).length]));
assert.deepEqual(types, { GUIDE: 6, REST: 91, LINE_STOP: 11, SUPPORT: 31 });
assert.equal(restraints.restraintAudit.summary.explicitlyResolvedCount, 0);
for (const field of ['frictionEvidence', 'stiffnessEvidence', 'springRateEvidence']) {
  assert.equal(restraints.restraints.filter(row => row[field].length).length, 0);
}
assert.equal(restraints.restraints.filter(row => Object.values(row.gapEvidence).some(values => values.length)).length, 0);
assert.equal(JSON.stringify(raw), rawBefore);
console.log(JSON.stringify({ status: 'SOURCE_DIAGNOSIS_ONLY', supportTypes: types,
  explicitlyResolvedCount: 0, sourceFrictionStiffnessSpringGapEvidenceRows: 0,
  missingEvidenceIsNotZero: true, scenarioAuthorizationCreated: false }));
