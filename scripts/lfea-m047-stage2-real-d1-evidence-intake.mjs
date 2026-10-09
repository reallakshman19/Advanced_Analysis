#!/usr/bin/env node
/**
 * Validate the compact real pinned-ACCDB D1 evidence before using it as the
 * baseline for any sequential Stage 2 mechanics experiment.
 *
 * The compact evidence was produced outside this branch. This intake therefore
 * recomputes every stored restraint error and the published summary from the 23
 * restraint rows. It refuses to trust internally inconsistent compact evidence.
 * It changes no mechanics.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const PINNED_ACCDB_BYTES = 5_136_384;
const BASELINE_HEAD = '12c695a9ed9a3dedada1d45024712df911069a80';
const CONTROL_CASES = Object.freeze(['L2', 'L3', 'L4', 'L5', 'L6', 'L14']);
const GOAL_PERCENT = 10;

export function validateAcceptedRealD1Evidence(evidence) {
  assert.equal(evidence?.schema, 'm047-bm4l-stage2-real-d1-evidence/v1', 'unsupported real D1 evidence schema');
  assert.equal(evidence.measurementBoundary, 'REAL_PINNED_ACCDB_LOCAL_SOLVE');
  assert.equal(evidence.source?.accdbSha256, PINNED_ACCDB_SHA256, 'D1 evidence ACCDB custody mismatch');
  assert.equal(evidence.source?.accdbBytes, PINNED_ACCDB_BYTES, 'D1 evidence ACCDB byte count mismatch');
  assert.equal(evidence.source?.baselineHead, BASELINE_HEAD, 'D1 evidence is not based on the frozen PR #1090 head');
  assert.match(String(evidence.source?.currentHead ?? ''), /^[a-f0-9]{40}$/u, 'D1 measured source head is missing');

  assert.equal(evidence.controls?.status, 'PASS', 'frozen controls must PASS before D1 can be accepted');
  for (const caseId of CONTROL_CASES) {
    const row = evidence.controls?.cases?.[caseId];
    assert.ok(row, `D1 evidence is missing control ${caseId}`);
    assert.equal(row.rows, 6360, `${caseId} control row count changed`);
    assert.equal(row.diff, 0, `${caseId} control differences are nonzero`);
    assert.equal(row.rowsIdentical, true, `${caseId} rows are not identical`);
    assert.equal(row.rowsHash, true, `${caseId} row hash changed`);
    assert.equal(row.executionHash, true, `${caseId} execution hash changed`);
    assert.equal(row.stiffnessHash, true, `${caseId} stiffness hash changed`);
    assert.equal(row.equilibrium, 'PASS', `${caseId} recovered equilibrium failed`);
  }

  const d1 = evidence.d1;
  assert.equal(d1?.caseId, 'L13');
  assert.equal(d1?.changedMechanic, 'SLIDING_COULOMB_FORCE_DIRECTION_ONLY');
  assert.equal(d1?.productionSolverModified, false, 'accepted D1 must remain an isolated experiment');
  assert.equal(d1?.converged, true, 'D1 must converge before it can be a sequential baseline');
  assert.ok(Array.isArray(d1?.restraints), 'D1 evidence restraint table is required');
  assert.equal(d1.restraints.length, 23, 'D1 evidence must contain all 23 effective friction restraints');
  assert.equal(new Set(d1.restraints.map((row) => row.id)).size, 23, 'D1 restraint identities must be unique');
  d1.restraints.forEach(validateRestraintRow);

  for (const [name, hash] of Object.entries(evidence.fullLocalArtifactSha256 ?? {})) {
    assert.match(String(hash), /^[a-f0-9]{64}$/u, `full local artifact hash ${name} is invalid`);
  }

  const recomputed = summarizeRows(d1.restraints);
  assert.equal(recomputed.normalWithinGoal, d1.summary?.normalWithinGoal, 'D1 normal-within-goal headline disagrees with rows');
  assertClose(recomputed.normalWorstPercentError, d1.summary?.normalWorstPercentError,
    'D1 worst normal error headline disagrees with rows');
  assert.equal(recomputed.tangentialVectorsWithinGoal, d1.summary?.tangentialVectorsWithinGoal,
    'D1 vector-within-goal headline disagrees with rows');
  assertClose(recomputed.tangentialWorstRelativeError, d1.summary?.tangentialWorstRelativeError,
    'D1 worst vector error headline disagrees with rows');
  assert.equal(recomputed.constitutiveStateMatches, d1.constitutiveStateMatches,
    'D1 constitutive-state match count disagrees with rows');
  assert.equal(recomputed.genuineStateMismatches, d1.genuineStateMismatches,
    'D1 genuine state mismatch count disagrees with rows');
  assert.equal(recomputed.aboveR1FloorCount, d1.aboveProvisionalR1Floor?.count,
    'D1 above-R1 row count disagrees with rows');
  assert.equal(recomputed.aboveR1VectorsWithinGoal, d1.aboveProvisionalR1Floor?.vectorsWithin10Pct,
    'D1 above-R1 vector pass count disagrees with rows');
  assertClose(recomputed.aboveR1WorstVectorErrorPct, d1.aboveProvisionalR1Floor?.worstVectorErrorPct,
    'D1 above-R1 worst vector error disagrees with rows');

  assert.equal(evidence.validation?.status, 'PASS', 'D1 evidence validator did not PASS');
  assert.deepEqual(evidence.validation?.failedChecks ?? [], [], 'D1 evidence validator retained failed checks');
  assert.equal(evidence.decision?.d1, 'ACCEPT_AS_EXPERIMENTAL_BASELINE_NOT_FINAL_QUALIFICATION',
    'D1 is not explicitly accepted as the sequential experimental baseline');
  assert.equal(evidence.decision?.c1, 'KEEP_CURRENT_CASE_OWN_RESTRAINT_NORMAL_BASIS',
    'C1 must retain the current-case own-restraint normal basis');
  assert.equal(evidence.decision?.sequentialS1, 'REJECT_NONCONVERGED',
    'the measured no-relock S1 result must remain rejected');
  assert.equal(evidence.decision?.toleranceChanges, 0, 'D1/S1 evidence changed a tolerance');
  assert.equal(evidence.sequentialS1?.converged, false, 'measured sequential S1 must remain nonconverged');
  assert.equal(evidence.sequentialS1?.evidence?.productionSolverModified, false,
    'sequential S1 must remain an isolated experiment');

  const residuals = classifyResiduals(d1.restraints);
  const s2Justified = residuals.aboveR1VectorFailureCount > 0
    && residuals.aboveR1NonRelockedFailureCount === 0
    && evidence.decision.sequentialS1 === 'REJECT_NONCONVERGED';
  const base = {
    schema: 'm047-bm4l-stage2-real-d1-evidence-intake/v1',
    status: 'PASS',
    caseId: 'L13',
    sourceAccdbSha256: PINNED_ACCDB_SHA256,
    sourceAccdbByteLength: PINNED_ACCDB_BYTES,
    measuredSourceHead: evidence.source.currentHead,
    frozenBaselineHead: evidence.source.baselineHead,
    acceptedD1: {
      converged: true,
      vectorWithinGoal: recomputed.tangentialVectorsWithinGoal,
      normalWithinGoal: recomputed.normalWithinGoal,
      normalWorstPercentError: recomputed.normalWorstPercentError,
      constitutiveStateMatches: recomputed.constitutiveStateMatches,
      aboveR1Floor: {
        count: recomputed.aboveR1FloorCount,
        vectorsWithinGoal: recomputed.aboveR1VectorsWithinGoal,
        worstVectorErrorPct: recomputed.aboveR1WorstVectorErrorPct,
      },
    },
    residuals,
    priorSequentialStatePathExperiment: {
      experiment: 'D1_S1_NO_RELOCK',
      result: 'REJECT_NONCONVERGED',
      iterationCount: evidence.sequentialS1?.iterationCount ?? null,
    },
    next: {
      decision: s2Justified
        ? 'S2_RELOCK_REFERENCE_RESET_EXPERIMENT_JUSTIFIED'
        : 'D1_RESIDUAL_NOT_EXCLUSIVELY_RELOCK_REFERENCE',
      reason: s2Justified
        ? 'EVERY_ABOVE_R1_D1_VECTOR_FAILURE_IS_LOCKED_AFTER_SLIP_AND_NO_RELOCK_WAS_NONCONVERGENT'
        : 'D1_RESIDUALS_REQUIRE_RECLASSIFICATION_BEFORE_ANOTHER_STATE_PATH_MECHANIC',
      productionMechanicsPromotionAuthorized: false,
    },
    mechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };
  return Object.freeze({ ...base, semanticHash: semanticHash(base) });
}

function validateRestraintRow(row) {
  assert.equal(typeof row.id, 'string', 'D1 restraint id must be a string');
  const nRef = finite(row.nRef, `${row.id}.nRef`);
  const nSol = finite(row.nSol, `${row.id}.nSol`);
  const expectedNormalError = nRef === 0 ? null : 100 * (nSol - nRef) / Math.abs(nRef);
  if (expectedNormalError === null) assert.equal(row.nErrPct, null, `${row.id}.nErrPct must be null for zero normal reference`);
  else assertClose(finite(row.nErrPct, `${row.id}.nErrPct`), expectedNormalError, `${row.id}.nErrPct is inconsistent`);

  assert.ok(Array.isArray(row.ftRef) && Array.isArray(row.ftSol), `${row.id} tangential vectors are required`);
  assert.ok(row.ftRef.length > 0 && row.ftRef.length === row.ftSol.length,
    `${row.id} tangential vector component counts differ`);
  const reference = row.ftRef.map((value, index) => finite(value, `${row.id}.ftRef[${index}]`));
  const solved = row.ftSol.map((value, index) => finite(value, `${row.id}.ftSol[${index}]`));
  const referenceMagnitude = norm(reference);
  const solvedMagnitude = norm(solved);
  assertClose(finite(row.ftRefMag, `${row.id}.ftRefMag`), referenceMagnitude, `${row.id}.ftRefMag is inconsistent`);
  assertClose(finite(row.ftSolMag, `${row.id}.ftSolMag`), solvedMagnitude, `${row.id}.ftSolMag is inconsistent`);
  const expectedVectorErrorPct = referenceMagnitude === 0 ? null
    : 100 * norm(solved.map((value, index) => value - reference[index])) / referenceMagnitude;
  if (expectedVectorErrorPct === null) assert.equal(row.vecErrPct, null, `${row.id}.vecErrPct must be null for zero reference`);
  else assertClose(finite(row.vecErrPct, `${row.id}.vecErrPct`), expectedVectorErrorPct, `${row.id}.vecErrPct is inconsistent`);

  assert.ok(['STUCK', 'SLID'].includes(row.refState), `${row.id} has unsupported CAESAR state ${row.refState}`);
  assert.ok(['STUCK', 'SLID'].includes(row.solState), `${row.id} has unsupported normalized solver state ${row.solState}`);
  assert.ok(['STUCK', 'SLIDING', 'LOCKED_AFTER_SLIP'].includes(row.solRaw),
    `${row.id} has unsupported raw solver state ${row.solRaw}`);
  assert.equal(typeof row.belowR1Floor, 'boolean', `${row.id}.belowR1Floor must be boolean`);
}

function summarizeRows(rows) {
  const normalErrors = rows.map((row) => Math.abs(finite(row.nErrPct, `${row.id}.nErrPct`)));
  const vectorErrorsPct = rows.map((row) => finite(row.vecErrPct, `${row.id}.vecErrPct`));
  const above = rows.filter((row) => row.belowR1Floor !== true);
  const aboveErrors = above.map((row) => finite(row.vecErrPct, `${row.id}.vecErrPct`));
  return {
    normalWithinGoal: normalErrors.filter((value) => value <= GOAL_PERCENT).length,
    normalWorstPercentError: maximum(normalErrors),
    tangentialVectorsWithinGoal: vectorErrorsPct.filter((value) => value <= GOAL_PERCENT).length,
    tangentialWorstRelativeError: maximum(vectorErrorsPct) / 100,
    constitutiveStateMatches: rows.filter((row) => row.refState === row.solState).length,
    genuineStateMismatches: rows.filter((row) => row.refState !== row.solState).length,
    aboveR1FloorCount: above.length,
    aboveR1VectorsWithinGoal: aboveErrors.filter((value) => value <= GOAL_PERCENT).length,
    aboveR1WorstVectorErrorPct: maximum(aboveErrors),
  };
}

function classifyResiduals(rows) {
  const vectorFailures = rows.filter((row) => finite(row.vecErrPct, `${row.id}.vecErrPct`) > GOAL_PERCENT);
  const above = vectorFailures.filter((row) => row.belowR1Floor !== true);
  const relocked = above.filter((row) => row.solRaw === 'LOCKED_AFTER_SLIP');
  const nonRelocked = above.filter((row) => row.solRaw !== 'LOCKED_AFTER_SLIP');
  const below = vectorFailures.filter((row) => row.belowR1Floor === true);
  return {
    totalVectorFailureCount: vectorFailures.length,
    totalVectorFailureIds: ids(vectorFailures),
    belowR1VectorFailureCount: below.length,
    belowR1VectorFailureIds: ids(below),
    aboveR1VectorFailureCount: above.length,
    aboveR1VectorFailureIds: ids(above),
    aboveR1RelockedFailureCount: relocked.length,
    aboveR1RelockedFailureIds: ids(relocked),
    aboveR1NonRelockedFailureCount: nonRelocked.length,
    aboveR1NonRelockedFailureIds: ids(nonRelocked),
    allAboveR1VectorFailuresAreRelocked: above.length > 0 && nonRelocked.length === 0,
  };
}

function ids(rows) {
  return rows.map((row) => row.id).sort(compareText);
}

function finite(value, label) {
  const number = Number(value);
  assert.ok(Number.isFinite(number), `${label} must be finite`);
  return number;
}

function assertClose(actual, expected, label) {
  const a = Number(actual);
  const b = Number(expected);
  assert.ok(Number.isFinite(a) && Number.isFinite(b), `${label}: values must be finite`);
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  assert.ok(Math.abs(a - b) <= 1e-9 * scale, `${label}: ${a} != ${b}`);
}

function norm(values) {
  return Math.hypot(...values);
}

function maximum(values) {
  return values.length === 0 ? 0 : Math.max(...values);
}

function compareText(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    throw new TypeError('Usage: node scripts/lfea-m047-stage2-real-d1-evidence-intake.mjs <real-d1-evidence.json>');
  }
  const evidence = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
  process.stdout.write(`${canonicalPrettyStringify(validateAcceptedRealD1Evidence(evidence))}\n`);
}
