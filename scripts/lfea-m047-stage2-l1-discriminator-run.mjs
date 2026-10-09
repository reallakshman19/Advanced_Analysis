#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { runL1HydrotestRca } from './lfea-m047-stage2-l1-hydrotest-rca-run.mjs';
import { runHydInsulationFalse } from './lfea-m047-stage2-l1-hyd-insulation-false.mjs';

const SHA = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const OUT = 'reports/lfea-m047-stage2-l1-discriminators';

export async function runL1Discriminators(input) {
  const root = resolve(input.outRoot ?? OUT);
  mkdirSync(root, { recursive: true });

  // These are intentionally independent solves from the same unmodified source.
  // No raw-export mutation from one experiment is passed into the other.
  const density = await runL1HydrotestRca({
    accdbPath: input.accdbPath,
    baselinePath: input.baselinePath,
    profilePath: input.profilePath,
    outRoot: join(root, 'density'),
  });
  const insulation = await runHydInsulationFalse({
    accdbPath: input.accdbPath,
    baselinePath: input.baselinePath,
    profilePath: input.profilePath,
  });
  if (density.sourceAccdbSha256 !== SHA || insulation.sourceAccdbSha256 !== SHA) {
    throw new TypeError('L1 discriminator runs are not bound to the pinned BM4_L.ACCDB.');
  }
  write(join(root, 'insulation-experiment.json'), insulation);

  const densityNominated = density.nextAction === 'NOMINATE_ONE_PRODUCTION_WW_DENSITY_SOURCE_CHANGE_THEN_RUN_FROZEN_CONTROLS';
  const insulationNominated = insulation.summary?.nominationStatus === 'NOMINATE_FOR_SEPARATE_PRODUCTION_CHANGE';
  const base = {
    schema: 'm047-bm4l-stage2-l1-discriminator-receipt/v1',
    sourceAccdbSha256: SHA,
    experimentsCombined: false,
    productionMechanicsChanged: false,
    productionPromotionAuthorized: false,
    density: {
      receiptSemanticHash: density.receiptSemanticHash,
      nominated: densityNominated,
      nextAction: density.nextAction,
      normalWithinGoal: density.A2.normalWithinGoal,
      worstNormalPercentError: density.A2.worstNormalPercentError,
    },
    insulation: {
      semanticHash: insulation.semanticHash,
      nominated: insulationNominated,
      converged: insulation.converged,
      equilibriumStatus: insulation.equilibriumStatus ?? null,
      normalWithinGoal: insulation.summary?.normalWithinGoal ?? null,
      worstNormalPercentError: insulation.summary?.normalWorstPercentError ?? null,
    },
    decision: choose(densityNominated, insulationNominated, density, insulation),
    rule: 'IF_BOTH_NOMINATE_THEY_MUST_STILL_BE_PROMOTED_AND_MEASURED_AS_SEPARATE_ONE_MECHANIC_CANDIDATES_NEVER_AS_A_COMBINED_FIX',
  };
  const receipt = { ...base, receiptSemanticHash: semanticHash(base) };
  write(join(root, 'receipt.json'), receipt);
  return receipt;
}

function choose(densityNominated, insulationNominated, density, insulation) {
  if (!insulation.converged) return 'INSULATION_EXPERIMENT_NONCONVERGED_DO_NOT_PROMOTE';
  if (densityNominated && insulationNominated) return 'BOTH_DISCRIMINATORS_NOMINATED_RUN_SEPARATE_PRODUCTION_CANDIDATES_AND_COMPARE';
  if (densityNominated) return 'NOMINATE_DENSITY_PATH_ONLY_FOR_SEPARATE_PRODUCTION_CANDIDATE';
  if (insulationNominated) return 'NOMINATE_HYD_INSULATION_FALSE_ONLY_FOR_SEPARATE_PRODUCTION_CANDIDATE';
  if (density.nextAction.startsWith('STOP_')) return density.nextAction;
  return 'NEITHER_L1_WEIGHT_BASIS_DISCRIMINATOR_NOMINATED_CONTINUE_LINEAR_LOAD_BASIS_RCA';
}

function write(path, value) { writeFileSync(path, `${canonicalPrettyStringify(value)}\n`, 'utf8'); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
  if (!args.get('--accdb')) throw new Error('Usage: --accdb <BM4_L.ACCDB> [--out dir]');
  const result = await runL1Discriminators({ accdbPath: args.get('--accdb'), outRoot: args.get('--out') ?? OUT });
  process.stdout.write(`${canonicalPrettyStringify(result)}\n`);
}
