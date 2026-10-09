#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ENGINEERING_MODEL_EVENTS } from '../src/workspace/engineering-model-controller.js';
import { LoadCalcConsumerController } from '../src/workspace/load-calc-consumer-controller.js';
import {
  EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS,
} from '../src/workspace/engineering-loads/empirical-load-calc-scenario-controller.js';
import {
  empiricalLoadCalcScenarioStore,
} from '../src/workspace/engineering-loads/empirical-load-calc-scenario-store.js';

const originalScenarioSnapshot = empiricalLoadCalcScenarioStore.getSnapshot;

function runCase({ scenario }) {
  const events = [];
  let readyCalls = 0;
  let authorizationRefreshCalls = 0;

  empiricalLoadCalcScenarioStore.getSnapshot = () => scenario;
  const controller = new LoadCalcConsumerController(
    {},
    { getContext: () => null },
    {
      publish(topic, payload) { events.push({ topic, payload }); },
      subscribe() { return () => {}; },
    },
    {
      readyCalculationSnapshotProvider() {
        readyCalls += 1;
        throw new Error('ordinary Run must not create the READY snapshot in the UI controller');
      },
      empiricalAuthorizationController: {
        refreshEmpirical() {
          authorizationRefreshCalls += 1;
          throw new Error('ordinary Run must not consult legacy explicit authorization');
        },
      },
    },
  );
  controller.render = () => {};
  controller.runCurrentCalculation();
  return { controller, events, readyCalls, authorizationRefreshCalls };
}

try {
  const scenarioEligible = runCase({
    scenario: { calculationEligible: true, state: 'AUTHORIZED_CURRENT' },
  });
  assert.equal(scenarioEligible.readyCalls, 0);
  assert.equal(scenarioEligible.authorizationRefreshCalls, 0);
  assert.deepEqual(scenarioEligible.events, [{
    topic: EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS.CALCULATE_REQUESTED,
    payload: {},
  }], 'scenario-ready Run path must remain unchanged');

  for (const scenario of [
    { calculationEligible: false, state: 'DRAFT_READY' },
    { calculationEligible: false, state: 'DRAFT_BLOCKED' },
    { calculationEligible: false, state: 'NOT_CONFIGURED' },
  ]) {
    const ordinary = runCase({ scenario });
    assert.equal(ordinary.readyCalls, 0,
      'ordinary UI routing must leave READY snapshot creation to the current-system runtime');
    assert.equal(ordinary.authorizationRefreshCalls, 0,
      'ordinary UI routing must not depend on legacy explicit authorization currentness');
    assert.deepEqual(ordinary.events, [{
      topic: ENGINEERING_MODEL_EVENTS.CURRENT_COMMON_INPUT_CALCULATE_REQUESTED,
      payload: { source: 'load-calc' },
    }], 'ordinary Run must publish exactly one current-system request');
  }

  const source = await readFile(
    new URL('../src/workspace/load-calc-consumer-controller.js', import.meta.url),
    'utf8',
  );
  assert.match(source,
    /if \(event\.target\.closest\('\[data-load-calc-run\]'\)\) \{\s*this\.runCurrentCalculation\(\);/u,
    'Run click must delegate to the focused routing method');

  const runBody = source.match(/\n  runCurrentCalculation\(\) \{([\s\S]*?)\n  \}\r?\n\r?\n  handleClick\(event\)/u)?.[1];
  assert.ok(runBody, 'focused Run routing method must remain discoverable by the regression');
  const scenarioIndex = runBody.indexOf('snap?.calculationEligible');
  const currentSystemIndex = runBody.indexOf('CURRENT_COMMON_INPUT_CALCULATE_REQUESTED');
  assert.ok(scenarioIndex >= 0 && currentSystemIndex > scenarioIndex,
    'scenario currentness must be checked before ordinary current-system routing');
  assert.doesNotMatch(runBody, /readyCalculationSnapshotProvider/u,
    'ordinary Run must not own READY snapshot creation/reuse');
  assert.doesNotMatch(runBody, /empiricalAuthorizationController|refreshEmpirical/u,
    'ordinary Run must not refresh or require the legacy empirical authorization');
  assert.doesNotMatch(runBody, /sealCurrentNonFeaCommonInput/u,
    'ordinary Run must never invoke the manual human-style seal transaction');
  assert.doesNotMatch(runBody, /ENGINEERING_MODEL_EVENTS\.CALCULATE_REQUESTED/u,
    'ordinary Run must not publish the legacy explicit-authority calculation event');
  assert.doesNotMatch(runBody, /AUTHORIZE_REQUESTED/u,
    'ordinary Run must not manufacture scenario authorization');

  console.log(JSON.stringify({
    status: 'PASS',
    benchmark: 'ISSUE1321_FINAL_ORDINARY_RUN_ROUTING',
    scenarioPathUnchanged: true,
    ordinaryCurrentSystemRequests: 1,
    uiReadySnapshotCalls: 0,
    legacyAuthorizationRefreshCalls: 0,
    manualSealCalledByRun: false,
    legacyCalculateEventCalledByRun: false,
  }, null, 2));
} finally {
  empiricalLoadCalcScenarioStore.getSnapshot = originalScenarioSnapshot;
}
