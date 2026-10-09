#!/usr/bin/env node
/** Run the A1/A2/A3 L1 hydrotest diagnostics on one pinned ACCDB. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildL1HydrotestBasisAudit } from './lfea-m047-stage2-l1-hydrotest-basis-audit.mjs';
import { runL1UniformWwExperiment } from './lfea-m047-stage2-l1-uniform-ww-experiment.mjs';
import { assessL1UniformWw } from './lfea-m047-stage2-l1-uniform-ww-assess.mjs';

const SHA = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const BASELINE = 'reports/lfea-m047-stage2-r2-rebaseline/L1.json';
const OUT = 'reports/lfea-m047-stage2-l1-hydrotest-rca';

export async function runL1HydrotestRca(input) {
  const root = resolve(input.outRoot ?? OUT);
  mkdirSync(root, { recursive: true });
  const baseline = JSON.parse(readFileSync(resolve(input.baselinePath ?? BASELINE), 'utf8'));
  pinned(baseline.sourceAccdbSha256, 'baseline');

  const audit = await buildL1HydrotestBasisAudit({ accdbPath: input.accdbPath, profilePath: input.profilePath });
  pinned(audit.sourceAccdbSha256, 'A1');
  write(join(root, 'A1-hydrotest-basis-audit.json'), audit);

  const experiment = await runL1UniformWwExperiment({ accdbPath: input.accdbPath, profilePath: input.profilePath });
  pinned(experiment.sourceAccdbSha256, 'A2');
  write(join(root, 'A2-uniform-ww-experiment.json'), experiment);

  const assessment = assessL1UniformWw({ baseline, experiment });
  pinned(assessment.sourceAccdbSha256, 'A3');
  write(join(root, 'A3-uniform-ww-assessment.json'), assessment);

  const base = {
    schema: 'm047-bm4l-stage2-l1-hydrotest-rca-receipt/v1',
    sourceAccdbSha256: SHA,
    productionMechanicsChanged: false,
    productionPromotionAuthorized: false,
    baselineSemanticHash: baseline.iterationSemanticHash ?? semanticHash(baseline),
    A1: {
      semanticHash: audit.auditSemanticHash,
      changedSourceCount: audit.uniformWwSpecialComponentCounterfactual.changedSourceCount,
      closerAssembly: audit.referenceGlobalForceCheck.closerAssembly,
      pressureBinding: audit.pressureAudit.bindingStatus,
    },
    A2: {
      semanticHash: experiment.experimentSemanticHash,
      converged: experiment.converged,
      failedGates: experiment.failure?.lastFailedGates ?? [],
      normalWithinGoal: experiment.summary?.normalWithinGoal ?? null,
      normalCompared: experiment.summary?.normalCompared ?? null,
      worstNormalPercentError: experiment.summary?.normalWorstPercentError ?? null,
    },
    A3: {
      semanticHash: assessment.assessmentSemanticHash,
      interpretation: assessment.interpretation,
      evidence: assessment.evidence,
    },
    nextAction: chooseNext(audit, experiment, assessment),
    evidenceBoundary: 'RCA_ONLY_NO_PRODUCTION_QUALIFICATION_CLAIM',
  };
  const receipt = Object.freeze({ ...base, receiptSemanticHash: semanticHash(base) });
  write(join(root, 'receipt.json'), receipt);
  return receipt;
}

function chooseNext(audit, experiment, assessment) {
  if (audit.pressureAudit.bindingStatus !== 'PASS') return 'STOP_AND_AUDIT_HP_BINDING';
  if (audit.uniformWwSpecialComponentCounterfactual.changedSourceCount === 0) return 'REJECT_WW_SPECIAL_COMPONENT_DENSITY_AS_NON_LOAD_BEARING';
  if (!experiment.converged) return 'REJECT_PROMOTION_COUNTERFACTUAL_DID_NOT_CONVERGE';
  if (assessment.interpretation.startsWith('CONSISTENT_MULTI_METRIC_SUPPORT')) return 'NOMINATE_ONE_PRODUCTION_WW_DENSITY_SOURCE_CHANGE_THEN_RUN_FROZEN_CONTROLS';
  return 'DO_NOT_PROMOTE_CONTINUE_L1_LOAD_BASIS_RCA';
}

function pinned(value, label) {
  if (value !== SHA) throw new TypeError(`${label} is not bound to pinned BM4_L.ACCDB.`);
}
function write(path, value) { writeFileSync(path, `${canonicalPrettyStringify(value)}\n`, 'utf8'); }
function parse(argv) {
  const m = new Map();
  for (let i = 0; i < argv.length; i += 2) m.set(argv[i], argv[i + 1]);
  if (!m.get('--accdb')) throw new TypeError('Usage: --accdb <BM4_L.ACCDB> [--baseline file] [--profile file] [--out dir]');
  return { accdbPath: m.get('--accdb'), baselinePath: m.get('--baseline') ?? BASELINE, profilePath: m.get('--profile'), outRoot: m.get('--out') ?? OUT };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${canonicalPrettyStringify(await runL1HydrotestRca(parse(process.argv.slice(2))))}\n`);
}
