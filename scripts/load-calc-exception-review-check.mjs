import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderLoadCalcExceptionReview } from '../src/workspace/load-calc-exception-review.js';
import { renderEngineeringLoadPane } from '../src/workspace/load-calc-consumer-view.js';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { buildRoutePartitionModel } from '../src/workspace/routes/route-partition-model.js';
import { buildSupportSiteModel } from '../src/workspace/support-sites/support-site-model.js';
import { createEmptyProjectDataProfile } from '../src/workspace/project-data/project-data-contract.js';

const rows = [
  { code: 'UNALLOCATED_FORCE_NO_QUALIFIED_VERTICAL_SUPPORT', routeId: 'R<&"', entityId: 'E<&"', verticalForceN: 12, firstMomentNmm: 36, applicationChainageMm: 3 },
  { code: 'UNALLOCATED_FORCE_NO_QUALIFIED_VERTICAL_SUPPORT', routeId: 'R<&"', entityId: 'E-ZERO', verticalForceN: 0, firstMomentNmm: 0, applicationChainageMm: 0 },
  { code: 'OVERHANG_CANTILEVER_TRANSFER', routeId: 'R-TRANSFER', entityId: 'E2', verticalForceN: 4, momentDemandNmm: -8, eccentricityMm: -2, supportSiteId: 'S' },
  { code: 'NEW_UNKNOWN_CODE', routeId: 'R-UNKNOWN', entityId: 'E3', verticalForceN: null },
];
const loadCase = { loadCaseId: 'EMPTY', status: 'CALCULATED_WITH_EXCEPTIONS', exceptionLedger: rows, supportResults: [], contributionLedger: [], excludedInputs: [] };
const sites = { status: 'READY', sites: [{ siteId: 'S', tags: ['REST<&'], primaryEntityId: 'S-ENTITY' }] };
const before = JSON.stringify({ loadCase, sites });
const html = renderLoadCalcExceptionReview(loadCase, true, sites);
assert.ok(html.includes('12.000 N'));
assert.ok(html.includes('36.000 N·mm'));
assert.ok(html.includes('-8.000 N·mm'));
assert.ok(html.includes('data-load-support-entity-id="E&lt;&amp;&quot;"'));
assert.ok(html.includes('R&lt;&amp;&quot;'));
assert.ok(html.includes('REST&lt;&amp;'));
assert.ok(html.includes('Unknown') || html.includes('Unrecognized'));
assert.ok(html.includes('Unavailable N'), 'Missing quantities are not fabricated as zero');
assert.ok(html.includes('E-ZERO'), 'Zero-demand rows remain in exact custody');
assert.equal((html.match(/data-load-exception-code=/g) || []).length, 3);
assert.ok(html.includes('<details open data-load-exception-code="UNALLOCATED'));
assert.ok(html.includes('<details  data-load-exception-code="OVERHANG'));
assert.ok(renderLoadCalcExceptionReview(loadCase, false, sites).includes('Historical / STALE'));
assert.equal(renderLoadCalcExceptionReview({ exceptionLedger: [] }, true, null), '<p>No allocation exceptions recorded.</p>');
assert.equal(JSON.stringify({ loadCase, sites }), before);

const container = { innerHTML: '' };
renderEngineeringLoadPane(container, { status: loadCase.status, freshness: { status: 'CURRENT' }, loadCases: [loadCase] }, sites, { status: 'READY' });
assert.ok(container.innerHTML.includes('Allocation exception review'));
assert.ok(container.innerHTML.includes('<details><summary>Exact exception ledger · JSON</summary>'));
assert.ok(container.innerHTML.includes('&quot;NEW_UNKNOWN_CODE&quot;'));
assert.equal(JSON.stringify({ loadCase, sites }), before, 'Full renderer cannot mutate the result');

// Real Sjson topology diagnosis only: no approved support capability is inferred.
const source = JSON.parse(readFileSync(new URL('../public/fixtures/Sjson.json', import.meta.url), 'utf8'));
const rawBefore = JSON.stringify(source);
const dataset = normalizeWorkspaceDataset(source, 'Sjson.json');
const profile = createEmptyProjectDataProfile();
const routes = buildRoutePartitionModel(dataset, profile);
const supports = buildSupportSiteModel(dataset, profile);
const branch = (suffix) => `/ASIM-1885-10"-S8810101-91261M7-HC-01/${suffix}`;
assert.equal(routes.routes.filter((row) => ['B2', 'B3', 'B5'].some((suffix) => row.branchId === branch(suffix))).length, 3);
assert.equal(supports.members.filter((row) => row.branchId === branch('B2')).length, 0);
assert.equal(supports.members.filter((row) => row.branchId === branch('B5')).length, 0);
const b3 = supports.members.filter((row) => row.branchId === branch('B3'));
assert.equal(b3.length, 1);
assert.equal(b3[0].entityId, '=1006649732/51465');
assert.equal(b3[0].sourceType, '', 'Blank attachment type is not a REST');
assert.equal(JSON.stringify(source), rawBefore);
console.log('PASS exception presentation: exact ledger retained, route grouping, selection, stale/unknown/zero/escaping/immutability; actual Sjson B2/B5 no supports, B3 blank support type. No allocation or vector-method changes.');
