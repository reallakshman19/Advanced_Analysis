#!/usr/bin/env node
/**
 * M047 Stage 2 — verified restraint-by-restraint L13 accuracy review.
 *
 * This command is reporting only. It accepts only a COMPLETE evidence-batch
 * manifest that passes the independent custody verifier, then compares the real
 * governed L13 baseline directly with the isolated direction-only nonlinear
 * experiment. It also joins the R1 reference-resolution classification.
 *
 * A non-converged direction experiment is reported as such: candidate accuracy
 * cells stay null and no qualification percentage is manufactured from a
 * counterfactual/oracle. No tolerance, comparison rule or solver mechanic changes.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { verifyStage2RcaEvidenceManifest } from './lfea-m047-stage2-rca-evidence-manifest-check.mjs';

const CASE_ID = 'L13';
const RELATIVE_GOAL = 0.10;
const NORMAL_PERCENT_GOAL = 10;
const BASELINE_SCHEMA = 'm047-bm4l-stage2-friction-tuning-iteration/v1';
const DIRECTION_SCHEMA = 'm047-bm4l-stage2-direction-only-nonlinear-experiment/v1';
const R1_SCHEMA = 'm047-bm4l-stage2-reference-resolution/v1';

export function buildStage2AccuracyReview(input) {
  const baseline = input.baseline;
  const direction = input.direction;
  const r1 = input.r1;
  const provenance = input.provenance ?? {};
  requireInputs({ baseline, direction, r1 });

  const candidateConverged = direction.candidate?.converged === true && Array.isArray(direction.restraints);
  const candidateById = candidateConverged
    ? new Map(direction.restraints.map((row) => [row.restraintId, row]))
    : new Map();
  const r1ById = new Map(r1.restraints.map((row) => [row.restraintId, row]));

  const restraints = baseline.restraints.map((baselineRow) => {
    const r1Row = r1ById.get(baselineRow.restraintId);
    if (!r1Row) throw new TypeError(`R1 is missing restraint ${baselineRow.restraintId}.`);
    const candidateRow = candidateConverged ? candidateById.get(baselineRow.restraintId) : null;
    if (candidateConverged && !candidateRow) {
      throw new TypeError(`Direction experiment is missing restraint ${baselineRow.restraintId}.`);
    }
    return accuracyRow({ baselineRow, candidateRow, r1Row, candidateConverged });
  });

  if (candidateConverged && candidateById.size !== restraints.length) {
    throw new TypeError(
      `Direction experiment restraint count ${candidateById.size} != baseline ${restraints.length}.`,
    );
  }

  const baselineSummary = summarizePopulation(restraints, 'baseline');
  const candidateSummary = candidateConverged ? summarizePopulation(restraints, 'candidate') : null;
  const record = {
    schema: 'm047-bm4l-stage2-accuracy-review/v1',
    caseId: CASE_ID,
    sourceAccdbSha256: baseline.sourceAccdbSha256,
    sourceEvidenceManifestSchema: provenance.manifestSchema ?? null,
    sourceEvidenceManifestSemanticHash: provenance.manifestSemanticHash ?? null,
    sourceEvidenceVerificationStatus: provenance.verificationStatus ?? null,
    sourceBaselineIterationSemanticHash: baseline.iterationSemanticHash ?? null,
    sourceDirectionExperimentSemanticHash: direction.recordSemanticHash ?? direction.semanticHash ?? null,
    sourceR1SemanticHash: r1.semanticHash ?? null,
    existingRelativeGoal: RELATIVE_GOAL,
    existingNormalPercentGoal: NORMAL_PERCENT_GOAL,
    candidateStatus: candidateConverged ? 'CONVERGED' : 'NONCONVERGED_NO_CANDIDATE_ACCURACY_CLAIM',
    candidateFailure: candidateConverged ? null : {
      firstRunFailure: direction.candidate?.firstRunFailure ?? null,
      repeatRunFailure: direction.candidate?.repeatRunFailure ?? null,
    },
    r1Summary: {
      forceResolutionFloorN: r1.referenceResolution.forceResolutionFloorN,
      comparableRelativeCount: r1.summary.comparableRelativeCount,
      resolutionLimitedCount: r1.summary.resolutionLimitedCount,
      exactZeroReferenceCount: r1.summary.exactZeroReferenceCount,
    },
    baselineSummary,
    candidateSummary,
    delta: candidateSummary === null ? null : {
      normalWithinGoal: candidateSummary.normalWithinGoal - baselineSummary.normalWithinGoal,
      tangentialMagnitudeWithinGoal:
        candidateSummary.tangentialMagnitudeWithinGoal - baselineSummary.tangentialMagnitudeWithinGoal,
      tangentialVectorWithinGoal:
        candidateSummary.tangentialVectorWithinGoal - baselineSummary.tangentialVectorWithinGoal,
      normalizedConstitutiveStateMatches:
        candidateSummary.normalizedConstitutiveStateMatches - baselineSummary.normalizedConstitutiveStateMatches,
      medianVectorRelativeError:
        nullableSubtract(candidateSummary.medianVectorRelativeError, baselineSummary.medianVectorRelativeError),
      worstVectorRelativeError:
        nullableSubtract(candidateSummary.worstVectorRelativeError, baselineSummary.worstVectorRelativeError),
    },
    promotion: direction.promotion ?? null,
    qualificationClaimMade: false,
    interpretationRule:
      'CANDIDATE_PERCENTAGES_ARE_REPORTED_ONLY_FROM_A_CONVERGED_REAL_ACCDB_NONLINEAR_DIRECTION_RUN_NEVER_FROM_THE_DIRECTION_COUNTERFACTUAL_OR_REFERENCE_ORACLE_V1',
    mechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
    restraints,
  };
  return Object.freeze({ ...record, semanticHash: semanticHash(record) });
}

export function buildStage2AccuracyReviewFromManifest(manifest, root = resolve('.')) {
  const verification = verifyStage2RcaEvidenceManifest(manifest, root);
  const baseline = readJson(resolve(root, manifest.baseline.path));
  const r1Entry = requireArtifactEntry(manifest, 'R1_REFERENCE_RESOLUTION');
  const directionEntry = requireArtifactEntry(manifest, 'DIRECTION_ONLY_EXPERIMENT');
  const r1 = readJson(resolve(root, r1Entry.path));
  const direction = readJson(resolve(root, directionEntry.path));
  return buildStage2AccuracyReview({
    baseline,
    r1,
    direction,
    provenance: {
      manifestSchema: manifest.schema,
      manifestSemanticHash: manifest.semanticHash,
      verificationStatus: verification.status,
    },
  });
}

function accuracyRow({ baselineRow, candidateRow, r1Row, candidateConverged }) {
  const referenceForce = numericVector(baselineRow.tangential?.referenceN);
  const baselineForce = numericVector(baselineRow.tangential?.solvedN);
  const referenceMagnitude = Number(baselineRow.tangential?.referenceMagnitudeN ?? norm(referenceForce));
  const baselineMagnitude = Number(baselineRow.tangential?.solvedMagnitudeN ?? norm(baselineForce));
  const referenceState = normalizeReferenceState(baselineRow.regime?.reference);
  const baselineState = normalizeSolverState(baselineRow.regime?.solved);

  const baselineNormalPercentError = percentError(
    baselineRow.normal?.solvedN,
    baselineRow.normal?.referenceN,
  );
  const baselineMagnitudeRelativeError = relativeMagnitudeError(baselineMagnitude, referenceMagnitude);
  const baselineVectorRelativeError = finiteOrNull(baselineRow.tangential?.vectorRelativeError);
  const baselineDirectionCosine = cosine(baselineForce, referenceForce);

  const candidateForce = candidateConverged ? numericVector(candidateRow.candidateTangentialN) : null;
  const candidateMagnitude = candidateConverged ? Number(candidateRow.candidateMagnitudeN) : null;
  const candidateNormalPercentError = candidateConverged
    ? finiteOrNull(candidateRow.normal?.candidatePercentError)
    : null;
  const candidateMagnitudeRelativeError = candidateConverged
    ? relativeMagnitudeError(candidateMagnitude, referenceMagnitude)
    : null;
  const candidateVectorRelativeError = candidateConverged
    ? finiteOrNull(candidateRow.candidateVectorRelativeError)
    : null;
  const candidateDirectionCosine = candidateConverged
    ? finiteOrNull(candidateRow.candidateDirectionCosineToReference)
    : null;
  const candidateState = candidateConverged ? normalizeSolverState(candidateRow.regime) : null;

  return {
    restraintId: baselineRow.restraintId,
    nodeId: baselineRow.nodeId,
    nodeName: baselineRow.nodeName ?? null,
    frictionDofs: [...(baselineRow.frictionDofs ?? [])],
    r1: {
      classification: r1Row.classification,
      forceResolutionFloorN: r1Row.forceResolutionFloorN,
      referenceTangentialMagnitudeN: r1Row.referenceTangentialMagnitudeN,
      relativeComparisonEligible: r1Row.relativeComparisonEligible,
    },
    normal: {
      referenceN: finiteOrNull(baselineRow.normal?.referenceN),
      baselineN: finiteOrNull(baselineRow.normal?.solvedN),
      baselinePercentError: baselineNormalPercentError,
      baselineWithinExistingGoal: withinPercentGoal(baselineNormalPercentError),
      candidateN: candidateConverged ? finiteOrNull(candidateRow.normal?.candidateN) : null,
      candidatePercentError: candidateNormalPercentError,
      candidateWithinExistingGoal: candidateConverged
        ? withinPercentGoal(candidateNormalPercentError)
        : null,
    },
    tangential: {
      referenceN: referenceForce,
      baselineN: baselineForce,
      candidateN: candidateForce,
      referenceMagnitudeN: referenceMagnitude,
      baselineMagnitudeN: baselineMagnitude,
      candidateMagnitudeN: candidateMagnitude,
      baselineMagnitudeRelativeError,
      candidateMagnitudeRelativeError,
      baselineMagnitudeWithinExistingGoal: withinRelativeGoal(baselineMagnitudeRelativeError),
      candidateMagnitudeWithinExistingGoal: candidateConverged
        ? withinRelativeGoal(candidateMagnitudeRelativeError)
        : null,
      baselineVectorRelativeError,
      candidateVectorRelativeError,
      vectorRelativeErrorDelta: candidateConverged
        ? nullableSubtract(candidateVectorRelativeError, baselineVectorRelativeError)
        : null,
      baselineVectorWithinExistingGoal: withinRelativeGoal(baselineVectorRelativeError),
      candidateVectorWithinExistingGoal: candidateConverged
        ? withinRelativeGoal(candidateVectorRelativeError)
        : null,
      baselineDirectionCosineToReference: baselineDirectionCosine,
      baselineDirectionErrorDegrees: angleDegreesFromCosine(baselineDirectionCosine),
      candidateDirectionCosineToReference: candidateDirectionCosine,
      candidateDirectionErrorDegrees: candidateConverged
        ? angleDegreesFromCosine(candidateDirectionCosine)
        : null,
      candidateOppositionCosineToTotalDisplacement: candidateConverged
        ? finiteOrNull(candidateRow.candidateOppositionCosineToTotalDisplacement)
        : null,
    },
    constitutiveState: {
      reference: referenceState,
      baselineRaw: baselineRow.regime?.solved ?? null,
      baselineNormalized: baselineState,
      baselineMatchesReference: referenceState !== null && baselineState !== null
        ? referenceState === baselineState
        : null,
      candidateRaw: candidateConverged ? candidateRow.regime ?? null : null,
      candidateNormalized: candidateState,
      candidateMatchesReference: candidateConverged && referenceState !== null && candidateState !== null
        ? referenceState === candidateState
        : null,
      referenceUtilisation: finiteOrNull(baselineRow.regime?.referenceUtilisation),
      baselineUtilisation: finiteOrNull(baselineRow.regime?.solvedUtilisation),
    },
  };
}

function summarizePopulation(rows, prefix) {
  const normalErrors = rows.map((row) => row.normal[`${prefix}PercentError`]).filter(isFiniteNumber);
  const magnitudeErrors = rows
    .map((row) => row.tangential[`${prefix}MagnitudeRelativeError`])
    .filter(isFiniteNumber);
  const vectorErrors = rows
    .map((row) => row.tangential[`${prefix}VectorRelativeError`])
    .filter(isFiniteNumber);
  const directionErrors = rows
    .map((row) => row.tangential[`${prefix}DirectionErrorDegrees`])
    .filter(isFiniteNumber);
  const stateMatches = rows
    .map((row) => row.constitutiveState[`${prefix}MatchesReference`])
    .filter((value) => typeof value === 'boolean');
  const r1Comparable = rows.filter((row) => row.r1.relativeComparisonEligible === true);

  return {
    frictionRestraintCount: rows.length,
    normalCompared: normalErrors.length,
    normalWithinGoal: normalErrors.filter((value) => Math.abs(value) <= NORMAL_PERCENT_GOAL).length,
    worstAbsoluteNormalPercentError: maxOrNull(normalErrors.map(Math.abs)),
    tangentialMagnitudeCompared: magnitudeErrors.length,
    tangentialMagnitudeWithinGoal: magnitudeErrors.filter((value) => value <= RELATIVE_GOAL).length,
    medianMagnitudeRelativeError: median(magnitudeErrors),
    worstMagnitudeRelativeError: maxOrNull(magnitudeErrors),
    tangentialVectorCompared: vectorErrors.length,
    tangentialVectorWithinGoal: vectorErrors.filter((value) => value <= RELATIVE_GOAL).length,
    medianVectorRelativeError: median(vectorErrors),
    worstVectorRelativeError: maxOrNull(vectorErrors),
    medianDirectionErrorDegrees: median(directionErrors),
    worstDirectionErrorDegrees: maxOrNull(directionErrors),
    normalizedConstitutiveStateCompared: stateMatches.length,
    normalizedConstitutiveStateMatches: stateMatches.filter(Boolean).length,
    r1ComparableCount: r1Comparable.length,
    r1ComparableVectorWithinGoal: r1Comparable.filter((row) =>
      row.tangential[`${prefix}VectorWithinExistingGoal`] === true).length,
  };
}

function requireInputs({ baseline, direction, r1 }) {
  if (baseline?.schema !== BASELINE_SCHEMA || baseline.caseId !== CASE_ID || baseline.converged !== true) {
    throw new TypeError('Accuracy review requires the converged governed L13 baseline artifact.');
  }
  if (direction?.schema !== DIRECTION_SCHEMA || direction.caseId !== CASE_ID) {
    throw new TypeError('Accuracy review requires the L13 direction-only nonlinear experiment artifact.');
  }
  if (r1?.schema !== R1_SCHEMA || r1.caseId !== CASE_ID) {
    throw new TypeError('Accuracy review requires the L13 R1 reference-resolution artifact.');
  }
  if (baseline.sourceAccdbSha256 !== direction.sourceAccdbSha256
      || baseline.sourceAccdbSha256 !== r1.sourceAccdbSha256) {
    throw new TypeError('Accuracy-review artifacts are not bound to the same ACCDB source.');
  }
  if (!Array.isArray(baseline.restraints) || !Array.isArray(r1.restraints)) {
    throw new TypeError('Accuracy-review baseline/R1 restraints are missing.');
  }
}

function requireArtifactEntry(manifest, id) {
  const entry = manifest.artifacts.find((row) => row.id === id);
  if (!entry) throw new TypeError(`Verified evidence manifest is missing ${id}.`);
  return entry;
}

function normalizeReferenceState(value) {
  if (value === 'SLID') return 'SLID';
  if (value === 'STUCK') return 'STUCK';
  return null;
}

function normalizeSolverState(value) {
  if (value === 'SLIDING') return 'SLID';
  if (value === 'STUCK' || value === 'LOCKED_AFTER_SLIP') return 'STUCK';
  return null;
}

function numericVector(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => Number(entry));
}

function norm(values) {
  return Math.hypot(...values);
}

function cosine(left, right) {
  const denominator = norm(left) * norm(right);
  if (!(denominator > 0)) return null;
  return clamp(left.reduce((sum, value, index) => sum + value * right[index], 0) / denominator, -1, 1);
}

function relativeMagnitudeError(value, reference) {
  if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(reference)) || Number(reference) === 0) return null;
  return Math.abs(Number(value) - Number(reference)) / Math.abs(Number(reference));
}

function percentError(value, reference) {
  if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(reference)) || Number(reference) === 0) return null;
  return ((Number(value) - Number(reference)) / Math.abs(Number(reference))) * 100;
}

function angleDegreesFromCosine(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Math.acos(clamp(Number(value), -1, 1)) * 180 / Math.PI;
}

function withinRelativeGoal(value) {
  return Number.isFinite(Number(value)) ? Number(value) <= RELATIVE_GOAL : null;
}

function withinPercentGoal(value) {
  return Number.isFinite(Number(value)) ? Math.abs(Number(value)) <= NORMAL_PERCENT_GOAL : null;
}

function finiteOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function nullableSubtract(left, right) {
  return isFiniteNumber(left) && isFiniteNumber(right) ? left - right : null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function median(values) {
  const ordered = values.filter(isFiniteNumber).sort((left, right) => left - right);
  if (ordered.length === 0) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function maxOrNull(values) {
  const finite = values.filter(isFiniteNumber);
  return finite.length === 0 ? null : Math.max(...finite);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function formatPercentRelative(value) {
  return isFiniteNumber(value) ? `${(100 * value).toFixed(2)}%` : '—';
}

function formatPercent(value) {
  return isFiniteNumber(value) ? `${value.toFixed(2)}%` : '—';
}

function formatDegrees(value) {
  return isFiniteNumber(value) ? `${value.toFixed(2)}°` : '—';
}

export function renderStage2AccuracyReviewMarkdown(record) {
  const b = record.baselineSummary;
  const c = record.candidateSummary;
  const lines = [
    '# M047 Stage 2 — L13 restraint-by-restraint accuracy review',
    '',
    `Source ACCDB: \`${record.sourceAccdbSha256}\``,
    '',
    `Candidate status: **${record.candidateStatus}**.`,
    '',
    '## Summary',
    '',
    '| Metric | Baseline | Direction candidate |',
    '|---|---:|---:|',
    `| Normal reactions within ±10% | ${b.normalWithinGoal}/${b.normalCompared} | ${c ? `${c.normalWithinGoal}/${c.normalCompared}` : '—'} |`,
    `| Tangential magnitudes within ±10% | ${b.tangentialMagnitudeWithinGoal}/${b.tangentialMagnitudeCompared} | ${c ? `${c.tangentialMagnitudeWithinGoal}/${c.tangentialMagnitudeCompared}` : '—'} |`,
    `| Tangential vectors within ±10% | ${b.tangentialVectorWithinGoal}/${b.tangentialVectorCompared} | ${c ? `${c.tangentialVectorWithinGoal}/${c.tangentialVectorCompared}` : '—'} |`,
    `| Median vector error | ${formatPercentRelative(b.medianVectorRelativeError)} | ${c ? formatPercentRelative(c.medianVectorRelativeError) : '—'} |`,
    `| Worst vector error | ${formatPercentRelative(b.worstVectorRelativeError)} | ${c ? formatPercentRelative(c.worstVectorRelativeError) : '—'} |`,
    `| Normalized constitutive-state matches | ${b.normalizedConstitutiveStateMatches}/${b.normalizedConstitutiveStateCompared} | ${c ? `${c.normalizedConstitutiveStateMatches}/${c.normalizedConstitutiveStateCompared}` : '—'} |`,
    '',
    `R1 force-resolution floor: **${record.r1Summary.forceResolutionFloorN.toFixed(3)} N**; `
      + `${record.r1Summary.comparableRelativeCount}/${b.frictionRestraintCount} restraints are classified COMPARABLE_RELATIVE.`,
    '',
  ];
  if (record.candidateStatus !== 'CONVERGED') {
    lines.push(
      '> The direction-only nonlinear candidate did not converge. Candidate accuracy cells are intentionally blank; no counterfactual/oracle is substituted for a nonlinear result.',
      '',
    );
  }
  lines.push(
    '## Restraints',
    '',
    '| Node | R1 | State ref/B0/D1 | Normal err B0/D1 | Vector err B0/D1 | Magnitude err B0/D1 | Direction err B0/D1 | D1 opp. cos |',
    '|---:|---|---|---:|---:|---:|---:|---:|',
  );
  for (const row of record.restraints) {
    lines.push([
      `| ${row.nodeId}`,
      row.r1.classification,
      `${row.constitutiveState.reference ?? '—'}/${row.constitutiveState.baselineNormalized ?? '—'}/${row.constitutiveState.candidateNormalized ?? '—'}`,
      `${formatPercent(row.normal.baselinePercentError)}/${formatPercent(row.normal.candidatePercentError)}`,
      `${formatPercentRelative(row.tangential.baselineVectorRelativeError)}/${formatPercentRelative(row.tangential.candidateVectorRelativeError)}`,
      `${formatPercentRelative(row.tangential.baselineMagnitudeRelativeError)}/${formatPercentRelative(row.tangential.candidateMagnitudeRelativeError)}`,
      `${formatDegrees(row.tangential.baselineDirectionErrorDegrees)}/${formatDegrees(row.tangential.candidateDirectionErrorDegrees)}`,
      `${isFiniteNumber(row.tangential.candidateOppositionCosineToTotalDisplacement)
        ? row.tangential.candidateOppositionCosineToTotalDisplacement.toFixed(6)
        : '—'} |`,
    ].join(' | '));
  }
  lines.push(
    '',
    'This review does not alter tolerances, comparison policy, acceptance criteria, or production mechanics. It is not a qualification claim by itself.',
    '',
  );
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (value === undefined) throw new TypeError(`Missing value for ${String(key)}.`);
    if (key === '--manifest') args.manifestPath = value;
    else if (key === '--out') args.outPath = value;
    else if (key === '--md-out') args.markdownOutPath = value;
    else throw new TypeError(`Unknown Stage 2 accuracy-review argument ${String(key)}.`);
  }
  if (!args.manifestPath) {
    throw new TypeError('Usage: --manifest <reports/.../manifest.json> [--out <accuracy.json>] [--md-out <accuracy.md>]');
  }
  return args;
}

function writeText(path, value) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(resolve(path), value, 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readJson(resolve(args.manifestPath));
  const record = buildStage2AccuracyReviewFromManifest(manifest, resolve('.'));
  if (args.outPath) writeText(args.outPath, `${canonicalPrettyStringify(record)}\n`);
  if (args.markdownOutPath) writeText(args.markdownOutPath, `${renderStage2AccuracyReviewMarkdown(record)}\n`);
  process.stdout.write(`${canonicalPrettyStringify({
    caseId: record.caseId,
    candidateStatus: record.candidateStatus,
    baselineSummary: record.baselineSummary,
    candidateSummary: record.candidateSummary,
    delta: record.delta,
    promotion: record.promotion,
  })}\n`);
}
