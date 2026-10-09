#!/usr/bin/env node
/**
 * M047 Stage 2 R2 — partial-mobilisation decision report.
 *
 * Consumes the isolated deleted-spring experiment plus the governed return-map
 * L13 tuning artifact. It does not solve anything. The question is specific:
 * does the first state-stable deleted-spring iterate reproduce CAESAR's observed
 * sub-cap mobilisation cluster (nominally 0.91-0.96) better than the return map,
 * which tends to sit exactly on the Coulomb surface?
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const BAND_MIN = 0.91;
const BAND_MAX = 0.96;

export function buildMobilisationDiagnostics(input) {
  const r2 = input.r2;
  const returnMap = input.returnMap;
  if (r2.schema !== 'm047-bm4l-stage2-r2-deleted-spring-experiment/v1') {
    throw new TypeError('R2 deleted-spring experiment artifact is required.');
  }
  if (r2.firstStateStable === null) {
    throw new TypeError('R2 artifact has no state-stable snapshot; the stopping-rule hypothesis cannot be evaluated.');
  }
  if (returnMap.schema !== 'm047-bm4l-stage2-friction-tuning-iteration/v1') {
    throw new TypeError('Governed return-map tuning iteration artifact is required.');
  }
  if (r2.sourceAccdbSha256 !== returnMap.sourceAccdbSha256) {
    throw new TypeError('R2 and return-map artifacts have different ACCDB custody hashes.');
  }
  if (String(r2.caseId) !== String(returnMap.caseId)) {
    throw new TypeError('R2 and return-map artifacts describe different load cases.');
  }

  const returnById = new Map((returnMap.restraints ?? []).map((row) => [row.restraintId, row]));
  const rows = r2.firstStateStable.restraints.map((row) => {
    const baseline = returnById.get(row.restraintId) ?? null;
    const referenceUtilisation = row.referenceUtilisationOnExperimentalNormal;
    const deletedSpringUtilisation = row.experimentalUtilisation;
    const returnMapUtilisation = baseline?.regime?.solvedUtilisation ?? null;
    return {
      restraintId: row.restraintId,
      nodeId: row.nodeId,
      referenceUtilisation,
      deletedSpringUtilisation,
      returnMapUtilisation,
      referenceInBand: inBand(referenceUtilisation),
      deletedSpringInBand: inBand(deletedSpringUtilisation),
      returnMapInBand: inBand(returnMapUtilisation),
      deletedSpringAbsoluteUtilisationError: absoluteDifference(deletedSpringUtilisation, referenceUtilisation),
      returnMapAbsoluteUtilisationError: absoluteDifference(returnMapUtilisation, referenceUtilisation),
      deletedSpringCloser: closer(deletedSpringUtilisation, returnMapUtilisation, referenceUtilisation),
    };
  });

  const referenceCluster = rows.filter((row) => row.referenceInBand);
  const cluster = referenceCluster.map((row) => ({
    ...row,
    deletedSpringReproducesBand: row.deletedSpringInBand,
    returnMapReproducesBand: row.returnMapInBand,
  }));
  const deletedCloserCount = cluster.filter((row) => row.deletedSpringCloser === 'DELETED_SPRING').length;
  const returnCloserCount = cluster.filter((row) => row.deletedSpringCloser === 'RETURN_MAP').length;
  const ties = cluster.filter((row) => row.deletedSpringCloser === 'TIE').length;

  const result = {
    schema: 'm047-bm4l-stage2-r2-mobilisation-diagnostics/v1',
    sourceAccdbSha256: r2.sourceAccdbSha256,
    caseId: r2.caseId,
    stateStableIteration: r2.firstStateStable.iteration,
    band: { minimum: BAND_MIN, maximum: BAND_MAX },
    rule: 'COMPARE_ONLY_REFERENCE_ROWS_IN_DECLARED_PARTIAL_MOBILISATION_BAND_V1',
    referenceClusterCount: cluster.length,
    deletedSpringBandMatchCount: cluster.filter((row) => row.deletedSpringReproducesBand).length,
    returnMapBandMatchCount: cluster.filter((row) => row.returnMapReproducesBand).length,
    deletedSpringCloserCount: deletedCloserCount,
    returnMapCloserCount: returnCloserCount,
    tieCount: ties,
    decision: decision({ cluster, deletedCloserCount, returnCloserCount }),
    rows: cluster,
    productionMechanicsChanged: false,
    toleranceChanged: false,
  };
  return Object.freeze({ ...result, semanticHash: semanticHash(result) });
}

function decision({ cluster, deletedCloserCount, returnCloserCount }) {
  if (cluster.length === 0) return 'NO_REFERENCE_ROWS_IN_DECLARED_BAND';
  if (deletedCloserCount > returnCloserCount) return 'EVIDENCE_FAVOURS_DELETED_SPRING_STATE_STABLE_STOP';
  if (returnCloserCount > deletedCloserCount) return 'EVIDENCE_FAVOURS_RETURN_MAP_FOR_PARTIAL_MOBILISATION';
  return 'INCONCLUSIVE_EQUAL_OR_TIED_SUPPORT';
}

function inBand(value) {
  return Number.isFinite(Number(value)) && Number(value) >= BAND_MIN && Number(value) <= BAND_MAX;
}

function absoluteDifference(left, right) {
  if (!Number.isFinite(Number(left)) || !Number.isFinite(Number(right))) return null;
  return Math.abs(Number(left) - Number(right));
}

function closer(deleted, returned, reference) {
  const a = absoluteDifference(deleted, reference);
  const b = absoluteDifference(returned, reference);
  if (a === null && b === null) return 'TIE';
  if (a === null) return 'RETURN_MAP';
  if (b === null) return 'DELETED_SPRING';
  if (Math.abs(a - b) <= 1e-12) return 'TIE';
  return a < b ? 'DELETED_SPRING' : 'RETURN_MAP';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const r2Path = args.get('--r2');
  const returnMapPath = args.get('--return-map');
  if (!r2Path || !returnMapPath) {
    throw new TypeError('Usage: --r2 <deleted-spring.json> --return-map <L13-iteration.json> [--out <diagnostics.json>]');
  }
  const result = buildMobilisationDiagnostics({
    r2: JSON.parse(readFileSync(resolve(r2Path), 'utf8')),
    returnMap: JSON.parse(readFileSync(resolve(returnMapPath), 'utf8')),
  });
  const out = args.get('--out');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), `${canonicalPrettyStringify(result)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify({
    caseId: result.caseId,
    stateStableIteration: result.stateStableIteration,
    referenceClusterCount: result.referenceClusterCount,
    deletedSpringBandMatchCount: result.deletedSpringBandMatchCount,
    returnMapBandMatchCount: result.returnMapBandMatchCount,
    deletedSpringCloserCount: result.deletedSpringCloserCount,
    returnMapCloserCount: result.returnMapCloserCount,
    decision: result.decision,
  })}\n`);
}
