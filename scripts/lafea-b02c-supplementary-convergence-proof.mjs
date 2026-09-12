#!/usr/bin/env node
/**
 * Supplementary B02C fixed-probe robustness study.
 *
 * The frozen B02C definition remains unchanged: L1-L3 use the dedicated,
 * frozen graded-polar production strategy and retain the independent Kirsch
 * oracle plus every frozen acceptance tolerance. This supplementary script
 * adds finer h-levels without broadening that special strategy's authority.
 *
 * L4/L5 are therefore executed through the ordinary qualified LAFEA.3
 * production mesher. The strategy transition is retained explicitly in this
 * script's evidence and is NOT treated as one continuous Richardson/GCI or
 * same-mesh-family asymptotic sequence. Same-strategy trend assertions apply
 * only inside frozen L1-L3. Supplementary levels are used as independent
 * fixed-probe tolerance/robustness evidence on a second qualified production
 * meshing route.
 *
 * No frozen geometry, load, material, probe, oracle, tolerance, quality gate,
 * formulation, solver or recovery convention is modified here.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  B02C_FROZEN_MESH_POLICY,
  B02C_SUPPLEMENTARY_MESH_POLICY,
  executeB02KirschProductionLevel,
} from './lib/lafea-b02-kirsch-production-route.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const definition = read('validation/lafea-b02-definitions/B02C-kirsch.json');
const frozenLevelIds = new Set(definition.meshLadder.levels.map((level) => level.levelId));

// Same nominal h refinement ratio (2) as the frozen ladder, extended two levels finer.
// These extra levels are supplementary observations, not additions to the frozen definition.
const supplementaryLevels = [
  ...definition.meshLadder.levels,
  { levelId: 'L4-SUPPLEMENTARY', h: 2.8125, targetElementLength: 2.8125, curvatureToleranceDegrees: 1.40625 },
  { levelId: 'L5-SUPPLEMENTARY', h: 1.40625, targetElementLength: 1.40625, curvatureToleranceDegrees: 0.703125 },
];

function measureLevel(method, level) {
  const run = executeB02KirschProductionLevel(definition, method, level);
  return {
    levelId: level.levelId,
    h: level.h,
    meshPolicyClass: run.meshPolicyClass,
    meshStrategy: run.meshStrategy,
    meshStrategyReason: run.meshStrategyReason,
    probes: definition.fixedProbes.map((frozen) => {
      const probe = run.probes.find((row) => row.probe.probeId === frozen.probeId);
      assert.ok(probe, `${method}/${level.levelId} missing probe ${frozen.probeId}`);
      const relativeError = Math.abs(probe.authoritativeValue - frozen.analyticalReferenceValue)
        / Math.abs(frozen.analyticalReferenceValue);
      const limit = frozen.singularityClassification === 'HIGH_GRADIENT_CONVERGENCE'
        ? definition.acceptance.highGradientFineRelativeMaximum
        : definition.acceptance.nonSingularFineRelativeMaximum;
      return {
        probeId: frozen.probeId,
        singularityClassification: frozen.singularityClassification,
        value: probe.authoritativeValue,
        relativeError,
        limit,
        withinTolerance: relativeError <= limit,
      };
    }),
  };
}

function assertMesherAuthority(rows, method) {
  for (const row of rows) {
    const expected = frozenLevelIds.has(row.levelId)
      ? B02C_FROZEN_MESH_POLICY
      : B02C_SUPPLEMENTARY_MESH_POLICY;
    assert.equal(
      row.meshPolicyClass,
      expected,
      `${method}/${row.levelId} must retain the declared B02C mesh-policy boundary`,
    );
  }
}

const t3ByLevel = supplementaryLevels.map((level) => measureLevel('T3', level));
assertMesherAuthority(t3ByLevel, 'T3');

// Decisive T3 supplementary claim: at the finest ordinary-production-mesher
// level, every fixed physical probe simultaneously satisfies its unchanged
// frozen tolerance against the independent Kirsch oracle.
const t3Finest = t3ByLevel.at(-1);
for (const probe of t3Finest.probes) {
  assert.ok(
    probe.withinTolerance,
    `T3/${probe.probeId} must be within tolerance at ${t3Finest.levelId}: ` +
    `${(probe.relativeError * 100).toFixed(3)}% > ${(probe.limit * 100).toFixed(1)}%`,
  );
}

// T6: frozen L1-L3 remain on the frozen graded-polar route; L4 is an
// ordinary-production-mesher robustness observation. Do not infer convergence
// order or noise-floor stabilization across the strategy boundary.
const t6Levels = supplementaryLevels.slice(0, 4);
const t6ByLevel = t6Levels.map((level) => measureLevel('T6', level));
assertMesherAuthority(t6ByLevel, 'T6');
for (const probe of t6ByLevel.at(-1).probes) {
  assert.ok(
    probe.withinTolerance,
    `T6/${probe.probeId} must stay within tolerance at ${t6ByLevel.at(-1).levelId}: ` +
    `${(probe.relativeError * 100).toFixed(3)}% > ${(probe.limit * 100).toFixed(1)}%`,
  );
}

// Q8: keep the same-strategy frozen-level trend check on L1-L3 only. L4 uses
// the ordinary production mesher, so it is checked against the unchanged
// physical-probe tolerances but excluded from a same-strategy monotonic claim.
const q8Levels = supplementaryLevels.slice(0, 4);
const q8ByLevel = q8Levels.map((level) => measureLevel('Q8', level));
assertMesherAuthority(q8ByLevel, 'Q8');
for (const probe of q8ByLevel.at(-1).probes) {
  assert.ok(
    probe.withinTolerance,
    `Q8/${probe.probeId} must stay within tolerance at ${q8ByLevel.at(-1).levelId}: ` +
    `${(probe.relativeError * 100).toFixed(3)}% > ${(probe.limit * 100).toFixed(1)}%`,
  );
}
const frozenCrownQ8 = q8ByLevel
  .filter((row) => frozenLevelIds.has(row.levelId))
  .map((row) => row.probes.find((p) => p.probeId === 'KIRSCH_NEAR_CROWN_PMAX').relativeError);
for (let i = 1; i < frozenCrownQ8.length; i += 1) {
  assert.ok(
    frozenCrownQ8[i] < frozenCrownQ8[i - 1],
    `Q8/KIRSCH_NEAR_CROWN_PMAX frozen-route relative error must strictly decrease: ` +
    `level ${i} (${frozenCrownQ8[i]}) >= level ${i - 1} (${frozenCrownQ8[i - 1]})`,
  );
}

function trendFor(byLevel) {
  const trend = {};
  for (const probe of definition.fixedProbes) {
    trend[probe.probeId] = byLevel.map((row) => {
      const found = row.probes.find((entry) => entry.probeId === probe.probeId);
      return {
        levelId: row.levelId,
        h: row.h,
        meshPolicyClass: row.meshPolicyClass,
        meshStrategy: row.meshStrategy,
        meshStrategyReason: row.meshStrategyReason,
        relativeErrorPercent: Number((found.relativeError * 100).toFixed(4)),
        withinTolerance: found.withinTolerance,
      };
    });
  }
  return trend;
}

function policyTrace(rows) {
  return rows.map((row) => ({
    levelId: row.levelId,
    h: row.h,
    meshPolicyClass: row.meshPolicyClass,
    meshStrategy: row.meshStrategy,
    meshStrategyReason: row.meshStrategyReason,
  }));
}

console.log(JSON.stringify({
  schema: 'lafea-b02c-supplementary-convergence-proof/v2',
  status: 'PASS',
  authorityBoundary: {
    frozenDefinitionModified: false,
    frozenOracleModified: false,
    frozenToleranceModified: false,
    meshQualityThresholdModified: false,
    frozenSpecialStrategyBroadened: false,
    crossStrategyRichardsonOrGciClaimed: false,
    frozenLevelsMeshPolicy: B02C_FROZEN_MESH_POLICY,
    supplementaryLevelsMeshPolicy: B02C_SUPPLEMENTARY_MESH_POLICY,
  },
  note: 'Frozen L1-L3 retain the dedicated B02C graded-polar production route. L4/L5 are explicitly separate ordinary-production-mesher observations; no convergence-order continuity is claimed across that strategy boundary.',
  frozenTolerances: {
    highGradientFineRelativeMaximum: definition.acceptance.highGradientFineRelativeMaximum,
    nonSingularFineRelativeMaximum: definition.acceptance.nonSingularFineRelativeMaximum,
  },
  T3: {
    meshPolicyTrace: policyTrace(t3ByLevel),
    perProbeTrend: trendFor(t3ByLevel),
    allProbesWithinToleranceAtLevel: t3Finest.levelId,
    conclusion: 'At L5-SUPPLEMENTARY, T3 satisfies every unchanged fixed-probe tolerance against the independent Kirsch closed-form oracle on the ordinary qualified production mesher. This is supplementary robustness/tolerance evidence, not a Richardson/GCI continuation of the frozen graded-polar ladder.',
  },
  T6: {
    meshPolicyTrace: policyTrace(t6ByLevel),
    perProbeTrend: trendFor(t6ByLevel),
    conclusion: 'T6 remains within every unchanged fixed-probe tolerance at the L4 supplementary ordinary-production-mesher observation. The result is cross-route robustness evidence only; no same-strategy convergence-order or noise-floor claim crosses L3 to L4.',
  },
  Q8: {
    meshPolicyTrace: policyTrace(q8ByLevel),
    perProbeTrend: trendFor(q8ByLevel),
    frozenCrownMonotonicallyDecreasing: true,
    conclusion: 'Q8 crown error strictly decreases across the frozen L1-L3 graded-polar route and the L4 ordinary-production-mesher observation remains within every unchanged fixed-probe tolerance. L4 is not included in the same-strategy monotonic or Richardson/GCI claim.',
  },
}, null, 2));

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}
