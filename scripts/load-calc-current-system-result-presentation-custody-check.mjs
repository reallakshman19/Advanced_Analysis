#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  LOAD_CALC_RESULT_PRESENTATION,
  classifyLoadCalcResultPresentation,
} from '../src/workspace/load-calc-result-presentation.js';

const distribution = {
  status: 'CALCULATED',
  freshness: { status: 'CURRENT' },
};
const currentSystemExecution = {
  resultStatus: 'CALCULATED_WITH_EXCEPTIONS',
};

const rawPresentation = classifyLoadCalcResultPresentation(distribution);
assert.equal(rawPresentation, LOAD_CALC_RESULT_PRESENTATION.CALCULATED);
assert.equal(rawPresentation.message, 'Authorized calculation complete.');

const overallPresentation = classifyLoadCalcResultPresentation(
  distribution,
  currentSystemExecution,
);
assert.equal(
  overallPresentation,
  LOAD_CALC_RESULT_PRESENTATION.CALCULATED_WITH_EXCEPTIONS,
  'current-system overall resultStatus must outrank the narrower vertical distribution status for presentation',
);
assert.equal(overallPresentation.openLoads, true);
assert.match(overallPresentation.message, /complete with exceptions/u);
assert.match(overallPresentation.message, /coverage/u);
assert.match(overallPresentation.message, /unallocated load/u);
assert.match(overallPresentation.message, /transfer-moment evidence/u);

assert.equal(
  classifyLoadCalcResultPresentation(distribution, {}).message,
  rawPresentation.message,
  'legacy callers without an overall resultStatus must retain distribution-status presentation',
);
assert.equal(
  classifyLoadCalcResultPresentation(null, null),
  LOAD_CALC_RESULT_PRESENTATION.UNKNOWN,
);

const currentViewSource = await readFile(
  new URL('../src/workspace/load-calc-current-system-view.js', import.meta.url),
  'utf8',
);
const runRuntimeSource = await readFile(
  new URL('../src/workspace/engineering-loads/current-common-input-empirical-run-runtime.js', import.meta.url),
  'utf8',
);
const consumerControllerSource = await readFile(
  new URL('../src/workspace/load-calc-consumer-controller.js', import.meta.url),
  'utf8',
);

assert.match(
  currentViewSource,
  /classifyLoadCalcResultPresentation\(\s*state\?\.distribution,\s*currentExecution,\s*\)/u,
  'current-system wrapper must classify from the execution receipt when one exists',
);
assert.match(
  currentViewSource,
  /state\.message === rawPresentation\.message/u,
  'wrapper must only replace the ordinary raw-result message, not unrelated user-facing status text',
);
assert.match(
  currentViewSource,
  /output\.textContent = overallPresentation\.message/u,
  'current-system overall status must reach the engineer-facing completion output',
);
assert.match(
  runRuntimeSource,
  /hasRetainedDemand && baseStatus === 'CALCULATED'[\s\S]*?'CALCULATED_WITH_EXCEPTIONS'/u,
  'runtime must retain the discriminator where overall status is stricter than vertical distribution status',
);
assert.match(
  consumerControllerSource,
  /currentCommonInputExecution: engineeringModelStore\.getCurrentCommonInputExecution\(\)/u,
  'Load Calc state must provide the exact current-system execution receipt to the current-system view',
);

console.log(JSON.stringify({
  status: 'PASS',
  benchmark: 'ISSUE1321_CURRENT_SYSTEM_OVERALL_RESULT_PRESENTATION_CUSTODY',
  verticalDistributionStatus: distribution.status,
  overallResultStatus: currentSystemExecution.resultStatus,
  engineerFacingMessage: overallPresentation.message,
  rawDistributionMutated: false,
  resultContractChanged: false,
  staticsMechanicsChanged: false,
}, null, 2));
