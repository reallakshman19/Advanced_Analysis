#!/usr/bin/env node
/**
 * M047 Stage 2 — L7 load-step readiness plan.
 *
 * Planning only. No solve or production mechanic is changed here. The pure builder
 * accepts only the current Stage 2 RCA decision-gate schema, and the CLI accepts
 * only a COMPLETE evidence-batch manifest that passes the independent manifest
 * verifier. This prevents L7 planning from being unlocked by a stale, hand-mixed
 * or superseded post-direction RCA artifact.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { verifyStage2RcaEvidenceManifest } from './lfea-m047-stage2-rca-evidence-manifest-check.mjs';

const STEP_COUNTS = Object.freeze([1, 5, 10]);
const DECISION_SCHEMA = 'm047-bm4l-stage2-rca-decision-gate/v1';
const MANIFEST_SCHEMA = 'm047-bm4l-stage2-rca-evidence-batch/v1';
const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const CLEAR_DECISION = 'L13_RCA_CLEARED_FOR_L7_LOAD_STEPPING';

export function buildL7LoadStepPlan(decisionGate, provenance = {}) {
  if (decisionGate?.schema !== DECISION_SCHEMA) {
    throw new TypeError('L7 stepping requires the current governed Stage 2 RCA decision-gate artifact.');
  }
  if (decisionGate.caseId !== 'L13') {
    throw new TypeError(`L7 stepping gate requires L13 RCA; received ${decisionGate.caseId}.`);
  }
  if (decisionGate.sourceAccdbSha256 !== PINNED_ACCDB_SHA256) {
    throw new TypeError('L7 stepping gate is not bound to the corrected pinned BM4_L ACCDB member.');
  }
  if (decisionGate.next?.decision !== CLEAR_DECISION
      || decisionGate.next?.l7LoadSteppingAllowed !== true) {
    const error = new Error(
      `L7 load stepping is blocked by L13 RCA decision ${decisionGate.next?.decision ?? '<missing>'}.`,
    );
    error.code = 'M047_L7_LOAD_STEPPING_BLOCKED_BY_L13_RCA';
    throw error;
  }

  const plan = {
    schema: 'm047-bm4l-stage2-l7-load-step-plan/v2',
    sourceAccdbSha256: decisionGate.sourceAccdbSha256,
    sourceL13RcaSchema: decisionGate.schema,
    sourceL13RcaDecisionSemanticHash: decisionGate.semanticHash ?? null,
    sourceEvidenceManifestSchema: provenance.manifestSchema ?? null,
    sourceEvidenceManifestSemanticHash: provenance.manifestSemanticHash ?? null,
    sourceEvidenceManifestVerificationStatus: provenance.manifestVerificationStatus ?? null,
    caseId: 'L7',
    caseClass: 'OPE',
    formula: 'W+T1+P1',
    frictionlessTwinCaseId: 'L5',
    mechanic: 'EQUAL_LOAD_INCREMENT_CONTINUATION_WITH_CARRIED_FRICTION_STATE_V1',
    stepCounts: [...STEP_COUNTS],
    variants: STEP_COUNTS.map((count) => ({
      label: `L7-EQUAL-STEPS-${count}`,
      stepCount: count,
      incrementFraction: 1 / count,
      carrySlipStateBetweenIncrements: true,
      carryActiveSetBetweenIncrements: true,
      solveEachIncrementToExistingNonlinearConvergenceGates: true,
      finalComparisonAtFullLoadOnly: true,
    })),
    unchangedMechanics: [
      'FRICTION_DIRECTION_RULE',
      'FRICTION_STIFFNESS',
      'COULOMB_CAPACITY_RULE',
      'NORMAL_REACTION_BASIS',
      'STATE_BOUNDARY_AND_HYSTERESIS',
      'CONVERGENCE_LIMITS',
      'RESULT_COMPARISON_THRESHOLDS',
      'L5_CONTROL_MECHANICS',
    ],
    selectionRule:
      'LOAD_STEPPING_MAY_BE_PROMOTED_ONLY_IF_A_DECLARED_STEP_COUNT_IMPROVES_L7_WITHOUT_CHANGING_L13_OR_CONTROL_MECHANICS_V1',
    mechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };
  return Object.freeze({ ...plan, semanticHash: semanticHash(plan) });
}

export function buildL7LoadStepPlanFromManifest(manifest, root = resolve('.')) {
  if (manifest?.schema !== MANIFEST_SCHEMA) {
    throw new TypeError('L7 manifest gate requires the Stage 2 RCA evidence-batch manifest.');
  }
  const verification = verifyStage2RcaEvidenceManifest(manifest, root);
  if (verification.status !== 'PASS' || verification.nextDecision !== CLEAR_DECISION) {
    const error = new Error(
      `L7 load stepping is blocked by verified evidence decision ${verification.nextDecision ?? '<missing>'}.`,
    );
    error.code = 'M047_L7_LOAD_STEPPING_BLOCKED_BY_VERIFIED_MANIFEST';
    throw error;
  }
  const decisionEntry = manifest.artifacts.find((entry) => entry.id === 'RCA_DECISION_GATE');
  if (!decisionEntry) throw new TypeError('Verified evidence manifest is missing RCA_DECISION_GATE.');
  const decisionGate = JSON.parse(readFileSync(resolve(root, decisionEntry.path), 'utf8'));
  return buildL7LoadStepPlan(decisionGate, {
    manifestSchema: manifest.schema,
    manifestSemanticHash: manifest.semanticHash,
    manifestVerificationStatus: verification.status,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const manifestPath = args.get('--manifest');
  if (!manifestPath) throw new TypeError('Usage: --manifest <reports/.../manifest.json> [--out <plan.json>]');
  const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'));
  const plan = buildL7LoadStepPlanFromManifest(manifest, resolve('.'));
  const out = args.get('--out');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), `${canonicalPrettyStringify(plan)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify(plan)}\n`);
}
