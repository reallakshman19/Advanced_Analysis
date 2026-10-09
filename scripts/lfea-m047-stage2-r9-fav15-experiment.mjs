#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';

export const FAV15_DEG = 15;
export const FAV15_VARIANT = 'R9-FAV15-FIRST-STICK-TO-SLIDE-2D-DIRECTION-LIMIT';
export const FAV15_PROFILE_ID = 'CAESAR-ACCDB-FRICTION-SOLVER-R2-FAV15-EXPERIMENT';
export const FROZEN_SOLVER_BLOB = '5b3ba1ce89f6ff7509bf8be82361993a32497ad2';
export const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const GOAL = 0.1;
const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), '..');
const solverPath = resolve(root, 'src/core/fea-benchmarks/caesar-accdb-friction-solve.js');

export function buildFav15SolverSource(source) {
  let s = source;
  const replace = (before, after, label) => {
    const count = s.split(before).length - 1;
    if (count !== 1) throw new Error(`FAV15 source guard ${label}: expected one match, found ${count}.`);
    s = s.replace(before, after);
  };
  replace(
    "  profileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R2',",
    "  profileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R2-FAV15-EXPERIMENT',\n  frictionAngleVariationDeg: 15,\n  frictionAngleVariationRule: 'FIRST_STICK_TO_SLIDE_2D_DIRECTION_CHANGE_LIMIT_V1',",
    'profile',
  );
  replace(
`    const cappedForce = nextState === 'SLIDE' && tangentialMotion > profile.zeroTangentialMotionFloorM
      ? tangentialDisplacement.map((value) => -capacityN * value / tangentialMotion)
      : null;
    const nextSlip = cappedForce !== null
      ? tangentialDisplacement.map((value, index) => value + cappedForce[index] / stiffness)
      : [...slip];`,
`    const d1CappedForce = nextState === 'SLIDE' && tangentialMotion > profile.zeroTangentialMotionFloorM
      ? tangentialDisplacement.map((value) => -capacityN * value / tangentialMotion)
      : null;
    // Hexagon's Friction Angle Variation is used only on the first iteration of
    // a non-sliding -> sliding transition; later iterations compensate angle
    // variation automatically. This experiment therefore limits only a 2-D
    // transition direction change relative to the currently carried elastic
    // trial force. 1-D friction has no angular plane and is left unchanged.
    const fav15 = applyFirstSlideAngleVariation({
      state,
      nextState,
      frictionDofs: support.frictionDofs,
      trialForce,
      d1CappedForce,
      capacityN,
      angleLimitDeg: profile.frictionAngleVariationDeg,
    });
    const cappedForce = fav15.cappedForce;
    const nextSlip = cappedForce !== null
      ? tangentialDisplacement.map((value, index) => value + cappedForce[index] / stiffness)
      : [...slip];`,
    'return-map',
  );
  replace(
`      stretchCosine,
      frictionDirectionCosine,
      ledger: Object.freeze({`,
`      stretchCosine,
      frictionDirectionCosine,
      fav15,
      ledger: Object.freeze({`,
    'return-fav15',
  );
  replace(
`        // Superseded R1 governing quantity, retained as an RCA diagnostic only.
        stretchCosine,
      }),`,
`        // Superseded R1 governing quantity, retained as an RCA diagnostic only.
        stretchCosine,
        frictionAngleVariationDeg: profile.frictionAngleVariationDeg,
        frictionAngleVariationRule: profile.frictionAngleVariationRule,
        frictionAngleVariationEligible: fav15.eligible,
        frictionAngleVariationRawAngleDeg: fav15.rawAngleDeg,
        frictionAngleVariationApplied: fav15.applied,
        frictionAngleVariationAppliedAngleDeg: fav15.appliedAngleDeg,
      }),`,
    'ledger',
  );
  replace(
`/**
 * Reject a numerically stationary but physically invalid friction state.`,
`/**
 * Apply the documented CAESAR friction-angle-variation setting only to the
 * first STICK -> SLIDE transition of a 2-D friction plane. The transition starts
 * from the elastic trial-force direction and may rotate by at most the declared
 * angle toward the R2/D1 target. The next iteration is already in SLIDE and uses
 * R2/D1 without this limiter, matching Hexagon's statement that subsequent
 * iterations compensate for the angle variation automatically.
 */
function applyFirstSlideAngleVariation(input) {
  const { state, nextState, frictionDofs, trialForce, d1CappedForce, capacityN, angleLimitDeg } = input;
  const eligible = state === 'STICK'
    && nextState === 'SLIDE'
    && frictionDofs.length === 2
    && d1CappedForce !== null
    && norm(trialForce) > 0
    && norm(d1CappedForce) > 0;
  if (!eligible) {
    return Object.freeze({ cappedForce: d1CappedForce, eligible: false, rawAngleDeg: null, applied: false, appliedAngleDeg: null });
  }
  const from = trialForce.map((value) => value / norm(trialForce));
  const target = d1CappedForce.map((value) => value / norm(d1CappedForce));
  const cosine = clamp(dot(from, target), -1, 1);
  const rawAngleRad = Math.acos(cosine);
  const rawAngleDeg = rawAngleRad * 180 / Math.PI;
  if (!(rawAngleDeg > angleLimitDeg)) {
    return Object.freeze({ cappedForce: d1CappedForce, eligible: true, rawAngleDeg, applied: false, appliedAngleDeg: rawAngleDeg });
  }
  const limitRad = angleLimitDeg * Math.PI / 180;
  const cross = from[0] * target[1] - from[1] * target[0];
  const sign = cross < 0 ? -1 : 1;
  const c = Math.cos(sign * limitRad);
  const q = Math.sin(sign * limitRad);
  const limited = [c * from[0] - q * from[1], q * from[0] + c * from[1]];
  return Object.freeze({
    cappedForce: limited.map((value) => capacityN * value),
    eligible: true,
    rawAngleDeg,
    applied: true,
    appliedAngleDeg: angleLimitDeg,
  });
}

/**
 * Reject a numerically stationary but physically invalid friction state.`,
    'helper',
  );
  return s;
}

export async function runFav15Experiment(input) {
  const actualBlob = gitBlob(solverPath);
  if (actualBlob !== FROZEN_SOLVER_BLOB) throw new Error(`FAV15 requires frozen R2 solver blob ${FROZEN_SOLVER_BLOB}; got ${actualBlob}.`);
  const accdbBytes = readFileSync(resolve(input.accdbPath));
  const accdbSha = sha256(accdbBytes);
  if (accdbSha !== PINNED_ACCDB_SHA256) throw new Error(`FAV15 requires pinned ACCDB ${PINNED_ACCDB_SHA256}; got ${accdbSha}.`);
  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const rawExport = await extractCaesarAccdbTables({ accdbPath: resolve(input.accdbPath), tableNames: requiredCaesarAccdbTables(profile) });
  const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({ rawExport, profile });
  const token = `${process.pid}-${Date.now()}`;
  const tempName = `caesar-accdb-friction-solve.fav15-${token}.mjs`;
  const tempPath = resolve(dirname(solverPath), tempName);
  const source = buildFav15SolverSource(readFileSync(solverPath, 'utf8'));
  const sourceSha256 = sha256(Buffer.from(source));
  writeFileSync(tempPath, source, 'utf8');
  try {
    const mod = await import(`${pathToFileURL(tempPath).href}?fav15=${encodeURIComponent(token)}`);
    if (mod.CAESAR_FRICTION_SOLVER_PROFILE.profileId !== FAV15_PROFILE_ID) throw new Error('FAV15 profile ID mismatch.');
    const started = Date.now();
    const actual = mod.solveCaesarAccdbFrictionBenchmark(benchmarkPackage, [input.caseId ?? 'L13']);
    const elapsedMs = Date.now() - started;
    const caseId = input.caseId ?? 'L13';
    const evidence = actual.mechanics.cases[caseId];
    const restraints = compareRestraints({ benchmarkPackage, actual, caseId });
    const favEvents = evidence.iterations.flatMap((iteration) => iteration.supports
      .filter((support) => support.frictionAngleVariationEligible)
      .map((support) => ({
        iteration: iteration.iteration,
        restraintId: support.restraintId,
        nodeId: support.nodeId,
        rawAngleDeg: support.frictionAngleVariationRawAngleDeg,
        applied: support.frictionAngleVariationApplied,
        appliedAngleDeg: support.frictionAngleVariationAppliedAngleDeg,
        state: support.state,
        nextState: support.nextState,
      })));
    const record = Object.freeze({
      schema: 'm047-r9-fav15-experiment/v1',
      variant: FAV15_VARIANT,
      caseId,
      sourceAccdbSha256: benchmarkPackage.source.sha256,
      sourceAccdbBytes: accdbBytes.length,
      frozenProductionSolverBlob: actualBlob,
      ephemeralSolverSha256: sourceSha256,
      solverProfileId: mod.CAESAR_FRICTION_SOLVER_PROFILE.profileId,
      frictionAngleVariationDeg: FAV15_DEG,
      mechanic: {
        oneMechanicOnly: true,
        scope: 'FIRST_STICK_TO_SLIDE_DIRECTION_ONLY',
        dimensionalScope: 'TWO_DIMENSIONAL_FRICTION_PLANES_ONLY',
        transitionRule: 'LIMIT_DIRECTION_CHANGE_FROM_ELASTIC_TRIAL_FORCE_TOWARD_R2_D1_TARGET_TO_15_DEG_ON_TRANSITION_ITERATION_ONLY',
        subsequentIterationRule: 'R2_D1_FULL_DIRECTION_AUTOMATIC_COMPENSATION',
        unchanged: ['D1_DIRECTION_AFTER_TRANSITION','MU','FRICTION_STIFFNESS','CURRENT_OWN_NORMAL_CAPACITY','RETURN_MAP','STATE_BOUNDARY','RELOCK','ACCELERATION','MAXIMUM_ITERATIONS','LOAD_STEPPING','CONVERGENCE_TOLERANCES','COMPARISON_GOAL','QUALIFIED_LINEAR_MECHANICS'],
      },
      elapsedMs,
      converged: true,
      convergence: {
        iterationCount: evidence.iterationCount,
        nonlinearGateStatus: evidence.convergenceGates.status,
        failedGates: evidence.convergenceGates.failedGates,
        recoveredEquilibriumStatus: evidence.recoveredEquilibrium.status,
        executionStatus: evidence.executionStatus,
      },
      fav15: {
        eligibleTransitionCount: favEvents.length,
        limitedTransitionCount: favEvents.filter((event) => event.applied).length,
        events: favEvents,
      },
      restraints,
      summary: summarize(restraints),
      finalRowsSemanticHash: semanticHash(actual.cases[caseId].rows),
      productionSolverModified: false,
      productionPromotionAuthorized: false,
    });
    if (input.outPath) { mkdirSync(dirname(resolve(input.outPath)), { recursive: true }); writeFileSync(resolve(input.outPath), `${canonicalPrettyStringify(record)}\n`, 'utf8'); }
    return record;
  } finally { rmSync(tempPath, { force: true }); }
}

function compareRestraints({ benchmarkPackage, actual, caseId }) {
  const reference = vectorsByNode(benchmarkPackage.references[caseId].rows);
  const solved = vectorsByNode(actual.cases[caseId].rows);
  const supports = actual.mechanics.cases[caseId].iterations.at(-1).supports;
  return supports.map((support) => {
    const ref = reference.get(support.nodeId) ?? {}; const got = solved.get(support.nodeId) ?? {};
    const ft = support.frictionDofs; const rt = ft.map((dof) => ref[dof] ?? 0); const at = ft.map((dof) => got[dof] ?? 0);
    const rn = Math.abs(ref[support.normalDof] ?? 0); const rm = norm(rt);
    return {
      restraintId: support.restraintId, nodeId: support.nodeId, frictionDofs: ft,
      normal: { referenceN: rn, solvedN: support.normalReactionMagnitudeN, percentError: rn === 0 ? null : ((support.normalReactionMagnitudeN - rn) / Math.abs(rn)) * 100 },
      tangential: { referenceN: rt, solvedN: at, vectorRelativeError: rm === 0 ? null : norm(at.map((v,i)=>v-rt[i]))/rm },
      regime: support.regime,
    };
  }).sort((a,b)=>(b.tangential.vectorRelativeError??0)-(a.tangential.vectorRelativeError??0));
}
function summarize(rows) { const t=rows.filter(r=>r.tangential.vectorRelativeError!==null), n=rows.filter(r=>r.normal.percentError!==null); return { goalRelative:GOAL, frictionRestraintCount:rows.length, tangentialVectorsCompared:t.length, tangentialVectorsWithinGoal:t.filter(r=>r.tangential.vectorRelativeError<=GOAL).length, tangentialWorstRelativeError:Math.max(...t.map(r=>r.tangential.vectorRelativeError)), normalWithinGoal:n.filter(r=>Math.abs(r.normal.percentError)<=GOAL*100).length, normalWorstPercentError:Math.max(...n.map(r=>Math.abs(r.normal.percentError))) }; }
function vectorsByNode(rows) { const map=new Map(); for(const row of rows){if(row.entityKind!=='NODE'||row.quantity!=='FORCE')continue;const v=map.get(String(row.entityId))??{};v[row.component]=Number(row.value);map.set(String(row.entityId),v);} return map; }
function norm(v){return Math.hypot(...v);} function dot(a,b){return a.reduce((s,x,i)=>s+x*b[i],0);} function clamp(v,a,b){return Math.min(b,Math.max(a,v));}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
function gitBlob(path){return execFileSync('git',['hash-object',path],{encoding:'utf8'}).trim();}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const args=new Map(); for(let i=2;i<process.argv.length;i+=2) args.set(process.argv[i],process.argv[i+1]);
  if(!args.get('--accdb')) throw new Error('Usage: --accdb <BM4_L.ACCDB> [--case L13] [--out file.json]');
  const record=await runFav15Experiment({accdbPath:args.get('--accdb'),caseId:args.get('--case')??'L13',outPath:args.get('--out'),profilePath:args.get('--profile')});
  process.stdout.write(`${canonicalPrettyStringify({caseId:record.caseId,elapsedMs:record.elapsedMs,convergence:record.convergence,fav15:record.fav15,summary:record.summary,finalRowsSemanticHash:record.finalRowsSemanticHash,productionPromotionAuthorized:false})}\n`);
}
