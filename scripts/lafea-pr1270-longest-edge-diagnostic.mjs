#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const refinementPath = 'src/workspace/lafea-retained-mesh-refinement.js';
const evidencePath = 'src/workspace/lafea-analysis-mesh-evidence-v2.js';
const caseRunner = 'scripts/lafea-pr1270-clearance-case.mjs';
const originalRefinement = fs.readFileSync(refinementPath, 'utf8');
const originalEvidence = fs.readFileSync(evidencePath, 'utf8');

const pointAnchor = '  pointClearanceLocalFactor: 0.18,';
assert.ok(originalRefinement.includes(pointAnchor), 'point-clearance anchor missing');
const evidenceAnchor = `  const result = qualifyRefinedMeshAdjacentSizeRatio(
    mesh,
    meshProfile.fields.adjacentSizeRatioMax,
  );`;
assert.ok(originalEvidence.includes(evidenceAnchor), 'adjacency evidence anchor missing');
const diagnosticEvidence = originalEvidence.replace(
  evidenceAnchor,
  `${evidenceAnchor}\n  console.error('PR1270_CLEARANCE_METRIC=' + JSON.stringify({ maximumAllowed: result.maximumAllowed, maximumObserved: result.maximumObserved, adjacentEdgeCount: result.adjacentEdgeCount, violatingAdjacencyCount: result.violatingAdjacencyCount, qualification: result.qualification }));`,
);

const globalTarget = 30;
const localTargets = [22.5, 15, 11.25, 7.5];
const families = ['T3', 'T6'];
const scenarios = [
  { scenario: 'BASE_CENTER', width: 200, height: 120, xFraction: 0.50, yFraction: 0.50 },
  { scenario: 'BASE_NEAR_EDGE', width: 200, height: 120, xFraction: 0.15, yFraction: 0.50 },
  { scenario: 'BASE_NEAR_CORNER', width: 200, height: 120, xFraction: 0.15, yFraction: 0.15 },
  { scenario: 'ELONGATED_CENTER', width: 300, height: 90, xFraction: 0.50, yFraction: 0.50 },
];
const candidateFactors = [0.625, 0.65];
const rows = [];

try {
  fs.writeFileSync(evidencePath, diagnosticEvidence);

  // One known-negative control proves that the diagnostic still detects the
  // governed 1.5 actual-topology blocker rather than merely exercising a path.
  fs.writeFileSync(refinementPath, originalRefinement.replace(
    pointAnchor,
    '  pointClearanceLocalFactor: 0.60,',
  ));
  const negative = runCase({
    factor: 0.60,
    family: 'T6',
    localTarget: 15,
    scenario: scenarios[0],
    role: 'NEGATIVE_CONTROL',
  });
  rows.push(negative);
  assert.equal(negative.qualification, 'BLOCK', '0.60 negative control unexpectedly passed');
  assert.ok(negative.maximumObserved > 1.5, 'negative control did not exceed governed 1.5 ratio');

  for (const factor of candidateFactors) {
    fs.writeFileSync(refinementPath, originalRefinement.replace(
      pointAnchor,
      `  pointClearanceLocalFactor: ${factor},`,
    ));
    for (const family of families) {
      for (const localTarget of localTargets) {
        for (const scenario of scenarios) {
          rows.push(runCase({
            factor,
            family,
            localTarget,
            scenario,
            role: 'QUALIFICATION_MATRIX',
          }));
        }
      }
    }
  }
} finally {
  fs.writeFileSync(refinementPath, originalRefinement);
  fs.writeFileSync(evidencePath, originalEvidence);
}

const candidateSummaries = candidateFactors.map((factor) => summarizeFactor(
  factor,
  rows.filter((row) => row.role === 'QUALIFICATION_MATRIX' && row.pointClearanceLocalFactor === factor),
));
const fullyPassing = candidateSummaries.filter((summary) => summary.qualification === 'PASS');

console.log(`PR1270_CLEARANCE_MATRIX=${JSON.stringify({
  check: 'PR1270_POINT_CLEARANCE_QUALIFICATION_MATRIX',
  governedAdjacentSizeRatioMaximum: 1.5,
  globalTarget,
  negativeControl: negativeSummary(rows[0]),
  matrixCaseCount: rows.filter((row) => row.role === 'QUALIFICATION_MATRIX').length,
  dimensions: {
    families,
    localTargets,
    targetRatios: localTargets.map((value) => value / globalTarget),
    scenarios,
    candidateFactors,
  },
  candidateSummaries,
  fullyPassingFactors: fullyPassing.map((summary) => summary.pointClearanceLocalFactor),
  rows,
})}`);

assert.ok(fullyPassing.length > 0, 'no point-clearance candidate passed the full matrix');
throw new Error(`PR1270_CLEARANCE_MATRIX_COMPLETE=${JSON.stringify({
  fullyPassingFactors: fullyPassing.map((summary) => summary.pointClearanceLocalFactor),
  candidateSummaries,
})}`);

function runCase({ factor, family, localTarget, scenario, role }) {
  const caseId = sanitize([
    role,
    `F${factor}`,
    family,
    `H${localTarget}`,
    scenario.scenario,
  ].join('_'));
  const run = spawnSync(process.execPath, [caseRunner], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PR1270_CASE_ID: caseId,
      PR1270_FAMILY: family,
      PR1270_HGLOBAL: String(globalTarget),
      PR1270_HLOCAL: String(localTarget),
      PR1270_WIDTH: String(scenario.width),
      PR1270_HEIGHT: String(scenario.height),
      PR1270_XF: String(scenario.xFraction),
      PR1270_YF: String(scenario.yFraction),
    },
  });
  const combined = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const resultMatch = combined.match(/PR1270_CASE_RESULT=(\{[^\n]+\})/u);
  const metricMatches = [...combined.matchAll(/PR1270_CLEARANCE_METRIC=(\{[^\n]+\})/gu)];
  const finalMetric = metricMatches.length
    ? JSON.parse(metricMatches.at(-1)[1])
    : null;
  const result = resultMatch ? JSON.parse(resultMatch[1]) : null;
  const firstError = combined.match(/(?:TypeError|Error): ([A-Z0-9_]+)/u)?.[1] ?? null;
  return {
    role,
    caseId,
    pointClearanceLocalFactor: factor,
    pointClearanceMm: factor * localTarget,
    family,
    globalTarget,
    localTarget,
    targetRatio: localTarget / globalTarget,
    scenario: scenario.scenario,
    width: scenario.width,
    height: scenario.height,
    xFraction: scenario.xFraction,
    yFraction: scenario.yFraction,
    childExitCode: run.status,
    qualification: result?.qualification ?? finalMetric?.qualification ?? 'NOT_REACHED',
    maximumObserved: result?.maximumObserved ?? finalMetric?.maximumObserved ?? null,
    maximumAllowed: result?.maximumAllowed ?? finalMetric?.maximumAllowed ?? 1.5,
    violatingAdjacencyCount:
      result?.violatingAdjacencyCount ?? finalMetric?.violatingAdjacencyCount ?? null,
    adjacentEdgeCount: result?.adjacentEdgeCount ?? finalMetric?.adjacentEdgeCount ?? null,
    localPointCount: result?.localPointCount ?? null,
    parentLocalCorners: result?.parentLocalCorners ?? null,
    childLocalCorners: result?.childLocalCorners ?? null,
    localCornerGain: result?.localCornerGain ?? null,
    parentNodes: result?.parentNodes ?? null,
    childNodes: result?.childNodes ?? null,
    parentElements: result?.parentElements ?? null,
    childElements: result?.childElements ?? null,
    childLocalStats: result?.childLocalStats ?? null,
    firstError,
  };
}

function summarizeFactor(factor, factorRows) {
  assert.equal(factorRows.length, families.length * localTargets.length * scenarios.length);
  const failures = factorRows.filter((row) => (
    row.childExitCode !== 0
    || row.qualification !== 'PASS'
    || row.violatingAdjacencyCount !== 0
    || !(row.localPointCount > 0)
    || !(row.localCornerGain > 0)
  ));
  const numericObserved = factorRows
    .map((row) => row.maximumObserved)
    .filter(Number.isFinite);
  const localPointCounts = factorRows
    .map((row) => row.localPointCount)
    .filter(Number.isFinite);
  const localCornerGains = factorRows
    .map((row) => row.localCornerGain)
    .filter(Number.isFinite);
  const worstMaximumObserved = numericObserved.length ? Math.max(...numericObserved) : null;
  return {
    pointClearanceLocalFactor: factor,
    caseCount: factorRows.length,
    passingCaseCount: factorRows.length - failures.length,
    failingCaseCount: failures.length,
    worstMaximumObserved,
    minimumAdjacencyMargin: Number.isFinite(worstMaximumObserved)
      ? 1.5 - worstMaximumObserved
      : null,
    minimumAdjacencyMarginPercentOfLimit: Number.isFinite(worstMaximumObserved)
      ? ((1.5 - worstMaximumObserved) / 1.5) * 100
      : null,
    minimumLocalPointCount: localPointCounts.length ? Math.min(...localPointCounts) : null,
    minimumLocalCornerGain: localCornerGains.length ? Math.min(...localCornerGains) : null,
    failureCaseIds: failures.map((row) => row.caseId),
    qualification: failures.length ? 'BLOCK' : 'PASS',
  };
}
function negativeSummary(row) {
  return {
    pointClearanceLocalFactor: row.pointClearanceLocalFactor,
    family: row.family,
    localTarget: row.localTarget,
    scenario: row.scenario,
    maximumObserved: row.maximumObserved,
    qualification: row.qualification,
  };
}
function sanitize(value) {
  return value.replace(/[^A-Za-z0-9_-]+/gu, '_');
}
