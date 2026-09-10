import assert from 'node:assert/strict';
import {
  EMP1_ASSESSMENT_ACTIONS,
  EMP1_ASSESSMENT_STATE_SCHEMA,
  projectEmp1AssessmentState,
} from '../src/workspace/emp1-assessment-state.js';

const stage = (document, execution = null) => ({ document, execution });
const projection = (a, b, c, releaseQualified = false) => ({
  steps: [
    { shortId: 'A', ...a },
    { shortId: 'B', ...b },
    { shortId: 'C', ...c },
  ],
  qualificationBoundary: { releaseQualified },
});

const empty = projectEmp1AssessmentState({
  state: { activeStageId: 'LAFEA.1', stages: { 'LAFEA.1': stage(null), 'LAFEA.2': stage(null) } },
  projection: projection(
    { documentLoaded: false, resultAvailable: false, state: 'INPUT_REQUIRED' },
    { documentLoaded: false, resultAvailable: false, state: 'INPUT_REQUIRED' },
    { resultAvailable: false, state: 'SOURCE_INCOMPLETE' },
  ),
  executionCurrentness: { state: 'NOT_RUN' },
});
assert.equal(empty.schema, EMP1_ASSESSMENT_STATE_SCHEMA);
assert.equal(empty.outcome.state, 'NOT_READY');
assert.equal(empty.outcome.label, 'Not ready');
assert.equal(empty.nextAction.id, EMP1_ASSESSMENT_ACTIONS.RUN_COMPLETE_EXAMPLE);
assert.equal(empty.nextAction.label, 'Run complete example');
assert.equal(empty.source.label, 'No assessment data loaded');
assert.equal(empty.release.label, 'Not approved for final use');

const aSource = { source: 'A' };
const aOnly = projectEmp1AssessmentState({
  state: { activeStageId: 'LAFEA.1', stages: { 'LAFEA.1': stage(aSource), 'LAFEA.2': stage(null) } },
  projection: projection(
    { documentLoaded: true, resultAvailable: false, state: 'SOURCE_LOADED' },
    { documentLoaded: false, resultAvailable: false, state: 'INPUT_REQUIRED' },
    { resultAvailable: false, state: 'SOURCE_INCOMPLETE' },
  ),
  executionCurrentness: { state: 'NOT_RUN' },
});
assert.equal(aOnly.nextAction.id, EMP1_ASSESSMENT_ACTIONS.RUN_LOAD_TRANSFER);
assert.equal(aOnly.nextAction.label, 'Run load transfer');
assert.equal(aOnly.transfer.label, 'Ready to calculate');

const qualifiedA = {
  stageId: 'LAFEA.1',
  status: 'QUALIFIED',
  result: { qualification: { state: 'ACCEPTED' } },
};
const complete = projectEmp1AssessmentState({
  state: {
    activeStageId: 'LAFEA.1',
    stages: {
      'LAFEA.1': stage(aSource, qualifiedA),
      'LAFEA.2': stage({ source: 'B' }, { stageId: 'LAFEA.2', status: 'QUALIFIED' }),
    },
  },
  projection: projection(
    { documentLoaded: true, resultAvailable: true, state: 'CALCULATED' },
    { documentLoaded: true, resultAvailable: true, state: 'CALCULATED' },
    { resultAvailable: true, state: 'CURRENT_REPORTABLE_BOUNDED_C_EXECUTION' },
  ),
  executionCurrentness: { state: 'CURRENT' },
  cState: { currentResultAvailable: true, retainedResultAvailable: true, buttonEnabled: true },
  runInput: { localMethod: {} },
});
assert.equal(complete.outcome.state, 'CALCULATED');
assert.match(complete.outcome.message, /not approved for final use/u);
assert.equal(complete.nextAction.id, EMP1_ASSESSMENT_ACTIONS.REVIEW_ASSESSMENT);
assert.equal(complete.nextAction.label, 'Review assessment');
assert.equal(complete.result.label, 'Current assessment result');
assert.equal(complete.release.label, 'Not approved for final use');

const failed = projectEmp1AssessmentState({
  state: { activeStageId: 'LAFEA.1', stages: { 'LAFEA.1': stage(aSource), 'LAFEA.2': stage(null) } },
  projection: projection(
    { documentLoaded: true, resultAvailable: false, state: 'SOURCE_LOADED' },
    { documentLoaded: false, resultAvailable: false, state: 'INPUT_REQUIRED' },
    { resultAvailable: false, state: 'SOURCE_INCOMPLETE' },
  ),
  executionCurrentness: { state: 'NOT_RUN' },
  runFailure: { code: 'EMP1_A_CURRENT_QUALIFIED_RESULT_REQUIRED' },
});
assert.equal(failed.outcome.state, 'ACTION_REQUIRED');
assert.equal(failed.blocker.title, 'Assessment needs attention');
assert.equal(
  failed.blocker.message,
  'A current load-transfer result is required before the local check can run.',
);
assert.equal(failed.blocker.technicalCode, 'EMP1_A_CURRENT_QUALIFIED_RESULT_REQUIRED');
assert.equal(failed.nextAction.label, 'Run load transfer');

console.log(JSON.stringify({
  check: 'emp1-assessment-state',
  status: 'PASS',
  authoritativePresentationState: true,
  initialPrimaryAction: empty.nextAction.label,
  completePrimaryAction: complete.nextAction.label,
  failureCodeRetainedAsTechnicalDetail: true,
  releaseAuthorityChanged: false,
}, null, 2));
