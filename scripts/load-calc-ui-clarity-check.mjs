import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderLoadCalcConsumer } from '../src/workspace/load-calc-consumer-view.js';

const shell = await readFile(
  new URL('../src/workspace/load-calc-consumer-view.js', import.meta.url),
  'utf8',
);
const scenario = await readFile(
  new URL('../src/workspace/engineering-loads/empirical-load-calc-scenario-view.js', import.meta.url),
  'utf8',
);

// Exercise the rendered primary/fallback headers instead of retired label text.
const documentRef = { createElement: () => ({ dataset: {} }) };
const primary = renderLoadCalcConsumer(documentRef, { activeTab: 'workbench', message: '<blocked>' }).innerHTML;
assert.match(primary, /Support Load Workbench/u);
assert.match(primary, /Advanced \/ legacy workflow/u);
assert.match(primary, /&lt;blocked&gt;/u);
assert.doesNotMatch(primary, /data-load-calc-run/u, 'Run belongs to stage 3, not a duplicate header owner');
assert.doesNotMatch(primary, /data-empirical-calculate|data-engineering-load-calculate/u);
const blocked = renderLoadCalcConsumer(documentRef, { activeTab: 'topology' }).innerHTML;
assert.match(blocked, /disabled\s+data-load-calc-run/u);
assert.match(blocked, /Open load workbench/u);
const gravity = renderLoadCalcConsumer(documentRef, { activeTab: 'topology',
  authorizationState: { calculationEligible: true } }).innerHTML;
assert.match(gravity, /Run Load Calc — Gravity/u);
assert.match(gravity, /data-load-calc-run/u);
const configured = renderLoadCalcConsumer(documentRef, { activeTab: 'topology',
  empiricalScenarioState: { calculationEligible: true } }).innerHTML;
assert.match(configured, /Execute configured empirical scenario/u);
assert.match(configured, /data-load-calc-run/u);

for (const group of ['Setup', 'Scenario', 'Output', 'Diagnostics', 'Model']) {
  assert.match(shell, new RegExp(`tabGroup\\('${group}'`, 'u'));
}

assert.match(scenario, /Calculate — Configured Scenario/u);
assert.match(scenario, /data-empirical-calculate/u);
assert.match(scenario, /Authorize scenario/u);

assert.doesNotMatch(
  shell,
  /data-empirical-calculate/u,
  'The header must not silently take ownership of configured-scenario execution.',
);
assert.doesNotMatch(
  scenario,
  /data-engineering-load-calculate/u,
  'The Methods surface must not silently take ownership of authorized-gravity execution.',
);

console.log('load-calc-ui-clarity-check: PASS');
