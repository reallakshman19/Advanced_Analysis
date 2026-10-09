#!/usr/bin/env node
/**
 * M047 Stage 2 — dispatch one governed next action from a verified L13 evidence bundle.
 *
 * This command never changes solver mechanics. It accepts only a COMPLETE evidence
 * manifest that passes the independent manifest verifier, reads the bound RCA
 * decision artifact, and emits exactly one next work package. Only an explicit
 * L13_RCA_CLEARED_FOR_L7_LOAD_STEPPING decision may materialize the planning-only
 * L7 N=1/5/10 load-step plan.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { verifyStage2RcaEvidenceManifest } from './lfea-m047-stage2-rca-evidence-manifest-check.mjs';
import { buildL7LoadStepPlan } from './lfea-m047-stage2-l7-load-step-plan.mjs';

const DECISION_SCHEMA = 'm047-bm4l-stage2-rca-decision-gate/v1';

export function classifyStage2NextDecision(decision) {
  switch (decision) {
    case 'R5_LOCAL_TANGENT_VERIFICATION_REQUIRED':
      return action('BLOCKED_RCA', 'R5_LOCAL_TANGENT_VERIFICATION',
        'A friction restraint coincides with bend/tee source topology; verify the local tangent plane before any direction-law promotion.');
    case 'HALT_DIRECTION_CANDIDATE_NOT_PROMOTABLE':
      return action('BLOCKED_RCA', 'DIRECTION_CANDIDATE_FAILURE_RCA',
        'The direction-only candidate failed at least one promotion gate; inspect its convergence/physics/accuracy evidence before another mechanic.');
    case 'DIRECTION_MECHANISM_STILL_UNRESOLVED':
      return action('BLOCKED_RCA', 'DIRECTION_RESIDUAL_RCA',
        'Direction residuals remain after the isolated direction candidate; do not interpret R2/R3 as promotion evidence yet.');
    case 'R2_DELETED_SPRING_STATE_PATH_IS_NEXT_MECHANICS_CANDIDATE':
      return action('EXPERIMENT_REQUIRED', 'R2_STATE_PATH_PROMOTION_EXPERIMENT',
        'Deleted-spring state-stable evidence is favored; the next change must be an isolated governed R2 experiment, not a silent production edit.');
    case 'CAPACITY_BASIS_BEFORE_PARTITION':
      return action('BLOCKED_RCA', 'R3_NORMAL_CAPACITY_BASIS_RCA',
        'A single-free-tangent over-cap restraint cannot be explained by per-axis partition; resolve the normal/capacity basis first.');
    case 'TEST_FRICTIONLESS_TWIN_NORMAL_CAPACITY_BASIS':
      return action('EXPERIMENT_REQUIRED', 'R3_FRICTIONLESS_TWIN_NORMAL_BASIS_EXPERIMENT',
        'Reference utilisation is closer to unity with the frictionless-twin normal; test that basis as one isolated hypothesis.');
    case 'PER_AXIS_CAPACITY_PARTITION_EXPERIMENT_JUSTIFIED':
      return action('EXPERIMENT_REQUIRED', 'R3_PER_AXIS_CAPACITY_PARTITION_EXPERIMENT',
        'Residual resultant-over-cap signatures remain after direction/state/basis screening; a per-axis experiment is justified but not yet governed.');
    case 'L13_RESIDUAL_MECHANISM_UNRESOLVED':
      return action('BLOCKED_RCA', 'L13_RESIDUAL_CLASSIFICATION',
        'L13 still has above-goal residuals with no supported next capacity mechanism; classify the remaining rows before changing mechanics.');
    case 'L13_RCA_CLEARED_FOR_L7_LOAD_STEPPING':
      return action('L7_PLAN_READY', 'R4_L7_LOAD_STEPPING_SENSITIVITY',
        'L13 RCA is cleared; planning-only N=1/5/10 equal-increment L7 sensitivity may now be emitted.');
    default: {
      const error = new Error(
        `Verified COMPLETE L13 evidence bundle produced unexpected decision ${String(decision)}.`,
      );
      error.code = 'M047_STAGE2_VERIFIED_BUNDLE_UNEXPECTED_DECISION';
      throw error;
    }
  }
}

export function dispatchStage2NextAction(manifest, root = resolve('.')) {
  const verification = verifyStage2RcaEvidenceManifest(manifest, root);
  const decisionEntry = manifest.artifacts.find((entry) => entry.id === 'RCA_DECISION_GATE');
  if (!decisionEntry) throw new TypeError('Verified evidence manifest is missing RCA_DECISION_GATE.');
  const decisionGate = JSON.parse(readFileSync(resolve(root, decisionEntry.path), 'utf8'));
  if (decisionGate?.schema !== DECISION_SCHEMA) {
    throw new TypeError(`Unsupported Stage 2 RCA decision schema ${String(decisionGate?.schema)}.`);
  }
  if (verification.nextDecision !== decisionGate.next?.decision) {
    throw new TypeError('Manifest verification decision does not match the bound RCA decision artifact.');
  }

  const nextAction = classifyStage2NextDecision(decisionGate.next?.decision);
  const l7Plan = nextAction.disposition === 'L7_PLAN_READY'
    ? buildL7LoadStepPlan(decisionGate, {
      manifestSchema: manifest.schema,
      manifestSemanticHash: manifest.semanticHash,
      manifestVerificationStatus: verification.status,
    })
    : null;

  const record = {
    schema: 'm047-bm4l-stage2-next-action-dispatch/v1',
    caseId: 'L13',
    sourceAccdbSha256: manifest.sourceAccdbSha256,
    sourceEvidenceManifestSemanticHash: manifest.semanticHash,
    sourceEvidenceVerificationStatus: verification.status,
    sourceDecisionSemanticHash: decisionGate.semanticHash ?? null,
    decision: decisionGate.next?.decision,
    nextAction,
    l7Plan,
    automaticProductionMechanicsMutationAllowed: false,
    mechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };
  return Object.freeze({ ...record, semanticHash: semanticHash(record) });
}

function action(disposition, workPackage, reason) {
  return Object.freeze({
    disposition,
    workPackage,
    reason,
    productionMechanicsPromotionAuthorized: false,
  });
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (value === undefined) throw new TypeError(`Missing value for ${String(key)}.`);
    if (key === '--manifest') result.manifestPath = value;
    else if (key === '--out') result.outPath = value;
    else if (key === '--l7-plan-out') result.l7PlanOutPath = value;
    else throw new TypeError(`Unknown Stage 2 dispatch argument ${String(key)}.`);
  }
  if (!result.manifestPath) {
    throw new TypeError('Usage: --manifest <reports/.../manifest.json> [--out <dispatch.json>] [--l7-plan-out <plan.json>]');
  }
  return result;
}

function write(value, path) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(resolve(path), `${canonicalPrettyStringify(value)}\n`, 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(resolve(args.manifestPath), 'utf8'));
  const record = dispatchStage2NextAction(manifest, resolve('.'));
  if (args.outPath) write(record, args.outPath);
  if (args.l7PlanOutPath) {
    if (record.l7Plan === null) {
      const error = new Error(
        `--l7-plan-out is forbidden for decision ${record.decision}; L13 is not cleared for L7 stepping.`,
      );
      error.code = 'M047_STAGE2_L7_PLAN_OUTPUT_FORBIDDEN';
      throw error;
    }
    write(record.l7Plan, args.l7PlanOutPath);
  }
  process.stdout.write(`${canonicalPrettyStringify(record)}\n`);
}
