#!/usr/bin/env node
/**
 * M047 Stage 2 — friction direction-law RCA from an existing real-ACCDB iteration.
 *
 * The purpose is to determine whether BM4_L's remaining tangential-vector error is
 * primarily a force-magnitude problem or a tangent-plane direction problem.
 *
 * For every friction restraint this command compares:
 *   A. the committed solver force vector;
 *   B. a mechanics-admissible counterfactual with the SAME solved force magnitude
 *      but direction opposite the solver's total relative tangential displacement;
 *   C. an oracle diagnostic with the SAME solved force magnitude but direction
 *      opposite CAESAR's own reference tangential displacement.
 *
 * C is never a candidate implementation because it uses reference output. It is an
 * upper-bound diagnostic: if C collapses the error while A is poor, magnitude is
 * already adequate and direction is the dominant defect. B is the candidate rule
 * that can be implemented without benchmark data.
 *
 * This command does not change solver mechanics, tolerances, acceptance criteria,
 * or result rows.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const GOAL_RELATIVE = 0.10;
const OPPOSITION_COSINE_STRONG = -0.999;

export function buildDirectionLawRca(iteration) {
  requireIteration(iteration);
  const rows = iteration.restraints.map(analyseRestraint);
  const comparable = rows.filter((row) => row.referenceMagnitudeN > 0);
  const oneD = comparable.filter((row) => row.tangentDimension === 1);
  const twoD = comparable.filter((row) => row.tangentDimension === 2);

  const result = {
    schema: 'm047-bm4l-stage2-direction-law-rca/v1',
    caseId: iteration.caseId,
    sourceAccdbSha256: iteration.sourceAccdbSha256,
    sourceIterationSemanticHash: iteration.iterationSemanticHash ?? null,
    productionMechanicsChanged: false,
    toleranceChanged: false,
    acceptanceCriteriaChanged: false,
    candidateRule: 'FRICTION_OPPOSES_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT_V1',
    currentRule: 'FRICTION_OPPOSES_CURRENT_ELASTIC_TANGENTIAL_STRETCH_V1',
    oracleRule: 'REFERENCE_ONLY_FRICTION_OPPOSES_REFERENCE_TOTAL_TANGENTIAL_DISPLACEMENT_NOT_IMPLEMENTABLE',
    summary: {
      restraintCount: rows.length,
      comparableCount: comparable.length,
      oneFreeTangent: summarizePopulation(oneD),
      twoFreeTangents: summarizePopulation(twoD),
      referenceForceStronglyOpposesReferenceTotalDisplacementCount: comparable.filter((row) =>
        row.referenceForceVsReferenceTotalDisplacementCosine !== null
        && row.referenceForceVsReferenceTotalDisplacementCosine <= OPPOSITION_COSINE_STRONG).length,
      currentWithinGoalCount: comparable.filter((row) => row.currentVectorRelativeError <= GOAL_RELATIVE).length,
      candidateWithinGoalCount: comparable.filter((row) => row.candidateVectorRelativeError !== null
        && row.candidateVectorRelativeError <= GOAL_RELATIVE).length,
      oracleWithinGoalCount: comparable.filter((row) => row.oracleVectorRelativeError !== null
        && row.oracleVectorRelativeError <= GOAL_RELATIVE).length,
      candidateImprovesCount: comparable.filter((row) => row.candidateImprovementRelative !== null
        && row.candidateImprovementRelative > 0).length,
      oracleImprovesCount: comparable.filter((row) => row.oracleImprovementRelative !== null
        && row.oracleImprovementRelative > 0).length,
      medianCurrentVectorRelativeError: median(comparable.map((row) => row.currentVectorRelativeError)),
      medianCandidateVectorRelativeError: median(comparable.map((row) => row.candidateVectorRelativeError).filter(isFiniteNumber)),
      medianOracleVectorRelativeError: median(comparable.map((row) => row.oracleVectorRelativeError).filter(isFiniteNumber)),
    },
    rows: rows.sort((left, right) => right.currentVectorRelativeError - left.currentVectorRelativeError),
  };
  result.conclusion = conclude(result.summary);
  return Object.freeze({ ...result, semanticHash: semanticHash(result) });
}

function analyseRestraint(row) {
  const referenceForce = numericVector(row.tangential?.referenceN);
  const solvedForce = numericVector(row.tangential?.solvedN);
  const referenceDisplacement = nullableNumericVector(row.tangentialDisplacement?.referenceM);
  const solvedDisplacement = numericVector(row.tangentialDisplacement?.solvedM);
  const elasticStretch = numericVector(row.tangentialDisplacement?.elasticStretchM);
  const referenceMagnitudeN = Number(row.tangential?.referenceMagnitudeN ?? norm(referenceForce));
  const solvedMagnitudeN = Number(row.tangential?.solvedMagnitudeN ?? norm(solvedForce));

  const candidateForce = oppositeProjection(solvedDisplacement, solvedMagnitudeN);
  const oracleForce = oppositeProjection(referenceDisplacement, solvedMagnitudeN);
  const currentError = relativeVectorError(solvedForce, referenceForce);
  const candidateError = candidateForce === null ? null : relativeVectorError(candidateForce, referenceForce);
  const oracleError = oracleForce === null ? null : relativeVectorError(oracleForce, referenceForce);

  return {
    restraintId: row.restraintId,
    nodeId: row.nodeId,
    nodeName: row.nodeName,
    tangentDimension: Array.isArray(row.frictionDofs) ? row.frictionDofs.length : referenceForce.length,
    frictionDofs: [...(row.frictionDofs ?? [])],
    regimeReference: row.regime?.reference ?? null,
    regimeSolved: row.regime?.solved ?? null,
    referenceUtilisation: row.regime?.referenceUtilisation ?? null,
    solvedUtilisation: row.regime?.solvedUtilisation ?? null,
    referenceMagnitudeN,
    solvedMagnitudeN,
    magnitudeRelativeError: referenceMagnitudeN === 0 ? null : Math.abs(solvedMagnitudeN - referenceMagnitudeN) / referenceMagnitudeN,
    referenceForceN: referenceForce,
    solvedForceN: solvedForce,
    referenceTotalTangentialDisplacementM: referenceDisplacement,
    solvedTotalTangentialDisplacementM: solvedDisplacement,
    solvedElasticTangentialStretchM: elasticStretch,
    referenceForceVsReferenceTotalDisplacementCosine: cosine(referenceForce, referenceDisplacement),
    solvedForceVsSolvedTotalDisplacementCosine: cosine(solvedForce, solvedDisplacement),
    solvedForceVsElasticStretchCosine: cosine(solvedForce, elasticStretch),
    currentVectorRelativeError: currentError,
    candidateProjectedForceN: candidateForce,
    candidateVectorRelativeError: candidateError,
    candidateImprovementRelative: candidateError === null ? null : currentError - candidateError,
    oracleProjectedForceN: oracleForce,
    oracleVectorRelativeError: oracleError,
    oracleImprovementRelative: oracleError === null ? null : currentError - oracleError,
  };
}

function summarizePopulation(rows) {
  if (rows.length === 0) return { count: 0 };
  const candidate = rows.map((row) => row.candidateVectorRelativeError).filter(isFiniteNumber);
  const oracle = rows.map((row) => row.oracleVectorRelativeError).filter(isFiniteNumber);
  return {
    count: rows.length,
    currentWithinGoalCount: rows.filter((row) => row.currentVectorRelativeError <= GOAL_RELATIVE).length,
    candidateWithinGoalCount: rows.filter((row) => row.candidateVectorRelativeError !== null
      && row.candidateVectorRelativeError <= GOAL_RELATIVE).length,
    oracleWithinGoalCount: rows.filter((row) => row.oracleVectorRelativeError !== null
      && row.oracleVectorRelativeError <= GOAL_RELATIVE).length,
    medianCurrentVectorRelativeError: median(rows.map((row) => row.currentVectorRelativeError)),
    medianCandidateVectorRelativeError: median(candidate),
    medianOracleVectorRelativeError: median(oracle),
    medianMagnitudeRelativeError: median(rows.map((row) => row.magnitudeRelativeError).filter(isFiniteNumber)),
    strongReferenceOppositionCount: rows.filter((row) => row.referenceForceVsReferenceTotalDisplacementCosine !== null
      && row.referenceForceVsReferenceTotalDisplacementCosine <= OPPOSITION_COSINE_STRONG).length,
  };
}

function conclude(summary) {
  const twoD = summary.twoFreeTangents;
  if (!twoD || !Number.isFinite(twoD.medianCurrentVectorRelativeError)) return 'INSUFFICIENT_TWO_DIMENSIONAL_TANGENT_DATA';
  const candidateImproves = Number.isFinite(twoD.medianCandidateVectorRelativeError)
    && twoD.medianCandidateVectorRelativeError < 0.6 * twoD.medianCurrentVectorRelativeError;
  const oracleImproves = Number.isFinite(twoD.medianOracleVectorRelativeError)
    && twoD.medianOracleVectorRelativeError < 0.35 * twoD.medianCurrentVectorRelativeError;
  const referenceDirectionStrong = twoD.strongReferenceOppositionCount >= Math.ceil(0.8 * twoD.count);
  if (candidateImproves && oracleImproves && referenceDirectionStrong) {
    return 'EVIDENCE_FAVOURS_TOTAL_TANGENTIAL_DISPLACEMENT_DIRECTION_AS_NEXT_ISOLATED_MECHANICS_EXPERIMENT';
  }
  if (oracleImproves && referenceDirectionStrong) {
    return 'DIRECTION_DEFECT_CONFIRMED_BUT_SOLVED_TOTAL_DISPLACEMENT_RULE_NOT_YET_SUFFICIENT';
  }
  return 'NO_DIRECTION_RULE_PROMOTION_YET_CONTINUE_R2_R3_CAPACITY_RCA';
}

function oppositeProjection(displacement, magnitude) {
  if (!Array.isArray(displacement) || displacement.some((value) => value === null || !Number.isFinite(value))) return null;
  const length = norm(displacement);
  if (!(length > 0) || !Number.isFinite(magnitude)) return null;
  return displacement.map((value) => -magnitude * value / length);
}

function relativeVectorError(actual, reference) {
  const scale = norm(reference);
  if (!(scale > 0)) return 0;
  return norm(actual.map((value, index) => value - reference[index])) / scale;
}

function cosine(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return null;
  if (left.some((value) => !Number.isFinite(value)) || right.some((value) => value === null || !Number.isFinite(value))) return null;
  const a = norm(left);
  const b = norm(right);
  if (!(a > 0) || !(b > 0)) return null;
  return dot(left, right) / (a * b);
}

function numericVector(value) {
  if (!Array.isArray(value)) return [];
  return value.map(Number);
}

function nullableNumericVector(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => entry === null ? null : Number(entry));
}

function median(values) {
  const sorted = values.filter(isFiniteNumber).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function norm(values) {
  return Math.hypot(...values);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function requireIteration(value) {
  if (!value || value.schema !== 'm047-bm4l-stage2-friction-tuning-iteration/v1') {
    throw new TypeError('Expected an m047-bm4l-stage2-friction-tuning-iteration/v1 artifact.');
  }
  if (!value.converged || !Array.isArray(value.restraints)) {
    throw new TypeError('Direction-law RCA requires a converged iteration with restraint evidence.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
  const iterationPath = args.get('--iteration');
  if (!iterationPath) throw new TypeError('Usage: --iteration <L13 iteration.json> [--out <direction-rca.json>]');
  const iteration = JSON.parse(readFileSync(resolve(iterationPath), 'utf8'));
  const result = buildDirectionLawRca(iteration);
  const outPath = args.get('--out');
  if (outPath) {
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(resolve(outPath), `${canonicalPrettyStringify(result)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify(result)}\n`);
}
