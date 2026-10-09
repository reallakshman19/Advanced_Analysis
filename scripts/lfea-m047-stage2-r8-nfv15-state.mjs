#!/usr/bin/env node
import assert from 'node:assert/strict';

export const NFV15_RELATIVE = 0.15;

/**
 * Pure state transition for CAESAR v14 Friction Normal Force Variation.
 * This owns no solve mechanics: it only decides which own-normal magnitude is
 * retained as the sliding friction-capacity basis from one converged iteration
 * candidate to the next.
 */
export function advanceNfv15(input) {
  const threshold = Number(input.threshold ?? NFV15_RELATIVE);
  const current = Math.abs(Number(input.currentNormalMagnitudeN));
  const retainedEntering = input.retainedNormalMagnitudeN === null
    || input.retainedNormalMagnitudeN === undefined
    ? null
    : Math.abs(Number(input.retainedNormalMagnitudeN));
  const state = String(input.state);
  const nextState = String(input.nextState);
  if (!Number.isFinite(threshold) || threshold < 0) throw new TypeError('NFV threshold must be finite and nonnegative.');
  if (!Number.isFinite(current)) throw new TypeError('Current normal magnitude must be finite.');
  if (retainedEntering !== null && !Number.isFinite(retainedEntering)) throw new TypeError('Retained normal magnitude must be finite or null.');
  if (!['STICK', 'SLIDE'].includes(state) || !['STICK', 'SLIDE'].includes(nextState)) throw new TypeError('NFV state must be STICK or SLIDE.');

  const retaining = state === 'SLIDE' && retainedEntering !== null;
  const variationRelative = !retaining
    ? 0
    : retainedEntering === 0
      ? (current === 0 ? 0 : Number.POSITIVE_INFINITY)
      : Math.abs(current - retainedEntering) / retainedEntering;
  const refreshed = retaining && variationRelative > threshold;
  const capacityNormalMagnitudeN = retaining && !refreshed ? retainedEntering : current;
  const nextRetainedNormalMagnitudeN = nextState === 'SLIDE'
    ? state === 'SLIDE' ? capacityNormalMagnitudeN : current
    : null;

  return Object.freeze({
    threshold,
    state,
    nextState,
    currentNormalMagnitudeN: current,
    retainedNormalEnteringN: retainedEntering,
    variationRelative,
    refreshed,
    capacityNormalMagnitudeN,
    nextRetainedNormalMagnitudeN,
    enteredSlidingThisStep: state === 'STICK' && nextState === 'SLIDE',
    leftSlidingThisStep: state === 'SLIDE' && nextState === 'STICK',
  });
}

/** Deterministic executable contract for the documented 15% retained-normal rule. */
export function checkNfv15StateContract() {
  const seed = advanceNfv15({ state: 'STICK', nextState: 'SLIDE', currentNormalMagnitudeN: 1000, retainedNormalMagnitudeN: null });
  assert.equal(seed.capacityNormalMagnitudeN, 1000);
  assert.equal(seed.nextRetainedNormalMagnitudeN, 1000);
  assert.equal(seed.refreshed, false);

  const within = advanceNfv15({ state: 'SLIDE', nextState: 'SLIDE', currentNormalMagnitudeN: 1100, retainedNormalMagnitudeN: 1000 });
  assert.equal(within.variationRelative, 0.1);
  assert.equal(within.refreshed, false);
  assert.equal(within.capacityNormalMagnitudeN, 1000);
  assert.equal(within.nextRetainedNormalMagnitudeN, 1000);

  const exactBoundary = advanceNfv15({ state: 'SLIDE', nextState: 'SLIDE', currentNormalMagnitudeN: 1150, retainedNormalMagnitudeN: 1000 });
  assert.ok(Math.abs(exactBoundary.variationRelative - 0.15) <= Number.EPSILON);
  assert.equal(exactBoundary.refreshed, false, 'Documented threshold is exceeded, not merely reached.');

  const beyond = advanceNfv15({ state: 'SLIDE', nextState: 'SLIDE', currentNormalMagnitudeN: 1160, retainedNormalMagnitudeN: 1000 });
  assert.equal(beyond.variationRelative, 0.16);
  assert.equal(beyond.refreshed, true);
  assert.equal(beyond.capacityNormalMagnitudeN, 1160);
  assert.equal(beyond.nextRetainedNormalMagnitudeN, 1160);

  const release = advanceNfv15({ state: 'SLIDE', nextState: 'STICK', currentNormalMagnitudeN: 1110, retainedNormalMagnitudeN: 1000 });
  assert.equal(release.nextRetainedNormalMagnitudeN, null);

  const rebreak = advanceNfv15({ state: 'STICK', nextState: 'SLIDE', currentNormalMagnitudeN: 900, retainedNormalMagnitudeN: null });
  assert.equal(rebreak.nextRetainedNormalMagnitudeN, 900);

  return Object.freeze({
    status: 'PASS',
    rule: 'SEED_ON_STICK_TO_SLIDE_RETAIN_UNTIL_ABS_CURRENT_MINUS_BASIS_OVER_BASIS_GT_0_15_REFRESH_THEN_DISCARD_ON_STICK',
    cases: Object.freeze({ seed, within, exactBoundary, beyond, release, rebreak }),
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1])) {
  process.stdout.write(`${JSON.stringify(checkNfv15StateContract(), null, 2)}\n`);
}
