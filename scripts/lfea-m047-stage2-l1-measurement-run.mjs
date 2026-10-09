#!/usr/bin/env node
/**
 * Single guarded L1 hydrotest-discriminator measurement boundary.
 *
 * Custody and governed configuration are verified before either independent
 * counterfactual solve is allowed to start. The density and insulation candidates
 * remain separate and the downstream receipt remains non-promotional.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { runL1DiscriminatorPreflight } from './lfea-m047-stage2-l1-discriminator-preflight.mjs';
import { runL1Discriminators } from './lfea-m047-stage2-l1-discriminator-run.mjs';

const ZIP_SHA256 = '978617cba50fa0b1a16c2fa71dc1e0d38e55ac834b191f887d100c6951abd8b9';
const ZIP_BYTES = 582488;
const ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const ACCDB_BYTES = 5136384;
const DEFAULT_OUT = 'reports/lfea-m047-stage2-l1-discriminators';

export async function runL1Measurement(input) {
  if (!input?.zipPath || !input?.accdbPath) throw new TypeError('L1 measurement requires zipPath and accdbPath.');
  const root = resolve(input.outRoot ?? DEFAULT_OUT);
  mkdirSync(root, { recursive: true });

  const custody = verifyCustody(input.zipPath, input.accdbPath);
  const preflight = runL1DiscriminatorPreflight({
    profilePath: input.profilePath,
    baselinePath: input.baselinePath,
  });
  if (preflight.status !== 'PASS') throw new Error('L1 discriminator preflight did not PASS.');
  write(join(root, 'preflight.json'), { custody, ...preflight });

  const discriminator = await runL1Discriminators({
    accdbPath: resolve(input.accdbPath),
    baselinePath: input.baselinePath,
    profilePath: input.profilePath,
    outRoot: root,
  });
  if (discriminator.sourceAccdbSha256 !== ACCDB_SHA256) {
    throw new Error('L1 discriminator receipt is not bound to the pinned BM4_L member.');
  }

  const base = {
    schema: 'm047-stage2-l1-measurement-receipt/v1',
    measurementBoundary: 'CUSTODY_AND_AUTHORITY_PREFLIGHT_BEFORE_TWO_SEPARATE_REAL_ACCDB_DISCRIMINATORS',
    custody,
    preflightSemanticHash: preflight.semanticHash,
    discriminatorReceiptSemanticHash: discriminator.receiptSemanticHash,
    decision: discriminator.decision,
    candidatesCombined: false,
    productionMechanicsChanged: false,
    productionPromotionAuthorized: false,
    nextAction: nextAction(discriminator.decision),
  };
  const receipt = Object.freeze({ ...base, receiptSemanticHash: semanticHash(base) });
  write(join(root, 'measurement-receipt.json'), receipt);
  return receipt;
}

function nextAction(decision) {
  if (String(decision).startsWith('NOMINATE_DENSITY_PATH_ONLY')) {
    return 'IMPLEMENT_AND_MEASURE_ONE_SEPARATE_DENSITY_PRODUCTION_CANDIDATE_THEN_RUN_FROZEN_CONTROLS';
  }
  if (String(decision).startsWith('NOMINATE_HYD_INSULATION_FALSE_ONLY')) {
    return 'IMPLEMENT_AND_MEASURE_ONE_SEPARATE_HYD_INSULATION_PRODUCTION_CANDIDATE_THEN_RUN_FROZEN_CONTROLS';
  }
  if (String(decision).startsWith('BOTH_DISCRIMINATORS_NOMINATED')) {
    return 'KEEP_CANDIDATES_SEPARATE;_IMPLEMENT_AND_MEASURE_EACH_PRODUCTION_CANDIDATE_INDEPENDENTLY_BEFORE_ANY_CUMULATIVE_CHANGE';
  }
  return 'NO_L1_PRODUCTION_CHANGE;_CONTINUE_LINEAR_HYDROTEST_LOAD_BASIS_RCA_FROM_COMMITTED_ARTIFACTS';
}

function verifyCustody(zipPath, accdbPath) {
  const zip = identity(resolve(zipPath));
  const accdb = identity(resolve(accdbPath));
  if (zip.sha256 !== ZIP_SHA256 || zip.bytes !== ZIP_BYTES) {
    throw new Error(`Pinned BM4_L.zip custody mismatch: ${zip.sha256}/${zip.bytes}.`);
  }
  if (accdb.sha256 !== ACCDB_SHA256 || accdb.bytes !== ACCDB_BYTES) {
    throw new Error(`Pinned BM4_L.ACCDB custody mismatch: ${accdb.sha256}/${accdb.bytes}.`);
  }
  return Object.freeze({
    status: 'PASS',
    zip: { ...zip, expectedSha256: ZIP_SHA256, expectedBytes: ZIP_BYTES, status: 'PASS' },
    accdb: { ...accdb, expectedSha256: ACCDB_SHA256, expectedBytes: ACCDB_BYTES, status: 'PASS' },
  });
}

function identity(path) {
  return Object.freeze({
    path,
    bytes: statSync(path).size,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  });
}

function write(path, value) {
  writeFileSync(path, `${canonicalPrettyStringify(value)}\n`, 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
  if (!args.get('--zip') || !args.get('--accdb')) {
    throw new Error('Usage: --zip <BM4_L.zip> --accdb <BM4_L.ACCDB> [--out dir] [--profile path] [--baseline path]');
  }
  const receipt = await runL1Measurement({
    zipPath: args.get('--zip'),
    accdbPath: args.get('--accdb'),
    outRoot: args.get('--out') ?? DEFAULT_OUT,
    profilePath: args.get('--profile'),
    baselinePath: args.get('--baseline'),
  });
  process.stdout.write(`${canonicalPrettyStringify(receipt)}\n`);
}
