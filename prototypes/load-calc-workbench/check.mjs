import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createSourceReview, reviewSummary, filterReviewRows, ReviewDeferrals, rowProblems, requireCase } from './workbench-model.js';
import { shellMarkup, rowsMarkup, weightsMarkup, evidenceMarkup } from './workbench-view.js';

const bytes = readFileSync(new URL('../../public/fixtures/Sjson.json', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'), '1e75a288545b771d2292cf730ca19d943e40fa547244478038da65eb8e4fc39a');
const raw = JSON.parse(bytes);
const original = JSON.stringify(raw);
const review = createSourceReview(raw);
assert.equal(review.dataset.entities.length, 279);
assert.equal(review.rows.length, 127);
assert.equal(review.supports.length, 139);
assert.equal(review.branches.length, 13);
assert.equal(review.sourceLengthUnit, 'unknown');
assert.equal(JSON.stringify(raw), original, 'Source normalization and review must not mutate input.');
const baseline = JSON.stringify(review.rows);
const deferrals = new ReviewDeferrals();
const state = { stage: 1, category: 'all', caseId: 'EMPTY', query: '', branch: '', unresolvedOnly: false, deferrals };
for (const caseId of ['EMPTY', 'OPE', 'HYD']) {
  const summary = reviewSummary(review, caseId);
  assert.equal(summary.total, 127);
  assert.equal(summary.coverage, 0, 'Unknown source units must not be bypassed.');
  assert.equal(summary.affected, 127);
  assert.equal(summary.groups.length, 3);
  assert.equal(review.rows[0].mass[caseId].coreMassKg, null, 'An unresolved mass is not zero.');
  assert(rowProblems(review.rows[0], caseId).includes('UNIT_BLOCKED'));
}
assert.equal(review.rows[0].mass.EMPTY.fluidKg, 0, 'EMPTY fluid zero is an existing case convention, not a missing-mass replacement.');
assert.equal(filterReviewRows(review.rows, { query: 'not-a-real-component' }).length, 0);
assert.equal(filterReviewRows(review.rows, { query: '/51228' }).length, 1);
assert(filterReviewRows(review.rows, { branch: review.branches[0] }).every((row) => row.branchId === review.branches[0]));
assert.equal(filterReviewRows(review.rows, { category: 'weights', caseId: 'OPE' }).length, 127);
assert.equal(filterReviewRows(review.rows, { category: 'sections' }).length, 127);
assert.throws(() => requireCase('INVALID'), /Unknown/);
assert.throws(() => deferrals.defer(review.rows[0], 'EMPTY', '  '), /reason/);
deferrals.defer(review.rows[0], 'EMPTY', 'Awaiting approved source evidence');
assert.equal(reviewSummary(review, 'EMPTY', deferrals.skipped).deferred, 1);
assert.equal(reviewSummary(review, 'EMPTY', deferrals.skipped).coverage, 0);
assert.equal(reviewSummary(review, 'HYD', deferrals.skipped).deferred, 1);
assert.equal(JSON.stringify(review.rows), baseline, 'UI deferral must not mutate numerical evidence.');
assert.throws(() => deferrals.defer({ needsReview: false, cases: { EMPTY: { ok: true } } }, 'EMPTY', 'Not needed'), /unresolved/);
deferrals.restore(review.rows[0].entityId);
assert.equal(deferrals.skipped.size, 0);
assert.equal(new ReviewDeferrals().skipped.size, 0, 'A new session starts with no deferrals.');
const markup = shellMarkup(review, state);
assert.equal((markup.match(/data-stage="[0-3]"/g) || []).length, 4);
assert(markup.includes('Saved project settings, accepted matches and proposals are not loaded'));
assert(rowsMarkup([], state, 127).includes('No matching components'));
assert(weightsMarkup(review.rows.slice(0, 1), state).includes('weight-summary'));
assert(weightsMarkup(review.rows.slice(0, 1), state).includes('Pending'));
assert(evidenceMarkup(review.rows[0], state).includes('Source trace & application point'));
for (const stage of [2, 3]) assert(shellMarkup(review, { ...state, stage }).includes('disabled'));
const hostile = { ...review.rows[0], entityId: '"><img src=x onerror=alert(1)>', description: '<script>bad()</script>' };
assert(!rowsMarkup([hostile], state, 1).includes('<img'));
assert(!evidenceMarkup(hostile, state).includes('<script>'));
const available = { ...review.rows[0], needsReview: false, notes: [], missing: [],
  cases: { ...review.rows[0].cases, EMPTY: { ok: true, blockers: [] } },
  mass: { ...review.rows[0].mass, EMPTY: { metalKg: 10, fluidKg: 0, insulationKg: null, coreMassKg: 10, dryOnly: true } } };
assert(rowsMarkup([available], state, 1).includes('Evidence available · not execution'));
assert(weightsMarkup([available], state).includes('Mass evidence available · not execution'));
for (const file of ['workbench-model.js', 'workbench-view.js', 'workbench.js']) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  assert(!/WorkspaceState|engineeringModelStore|nonFeaEnrichmentStore|localStorage|sessionStorage|\.accept\(|\.seal\(|\.authorize\(/.test(source), `${file} must have no app-state or approval write connection.`);
}
assert.equal(JSON.stringify(review.rows), baseline);
console.log('PASS: source fixture binding; 279 entities / 127 components / 139 supports / 13 branches; all three source-only cases blocked; filters; unchanged evidence across defer/restore; markup escaping; four stages; no app-store writes.');
