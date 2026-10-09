#!/usr/bin/env node
/**
 * M047 Stage 2 R3 data-only friction-capacity diagnostics.
 *
 * No solver mechanic changes here. The script reads the real pinned ACCDB and a
 * real L13 tuning artifact, then tests two reference-data questions:
 *   1. Does CAESAR's reported tangential load sit closer to mu*|N| when |N| is
 *      taken from L13 itself or from the frictionless L6 twin?
 *   2. Are there restraints where the tangential resultant exceeds mu*|N| while
 *      every individual tangential component remains within that same scalar cap?
 *      Such rows are a direct partition signature worth testing with a declared
 *      per-axis solver variant later.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const FRICTION_CASE = 'L13';
const CONTROL_CASE = 'L6';

export function buildCapacityDiagnostics(input) {
  const iteration = input.iteration;
  const frictionReference = vectorsByNode(input.frictionReferenceRows);
  const controlReference = vectorsByNode(input.controlReferenceRows);
  if (!iteration?.converged || !Array.isArray(iteration.restraints)) {
    throw new TypeError('R3 requires a converged L13 tuning iteration with restraint topology.');
  }
  const rows = iteration.restraints.map((support) => {
    const frictionVector = frictionReference.get(String(support.nodeId)) ?? {};
    const controlVector = controlReference.get(String(support.nodeId)) ?? {};
    const tangential = support.frictionDofs.map((dof) => Number(frictionVector[dof] ?? 0));
    const magnitudeN = Math.hypot(...tangential);
    const mu = Number(support.coefficientOfFriction);
    const normalL13N = Math.abs(Number(frictionVector[support.normalDof] ?? 0));
    const normalL6N = Math.abs(Number(controlVector[support.normalDof] ?? 0));
    const capacityL13N = mu * normalL13N;
    const capacityL6N = mu * normalL6N;
    const utilisationL13Normal = capacityL13N === 0 ? null : magnitudeN / capacityL13N;
    const utilisationL6Normal = capacityL6N === 0 ? null : magnitudeN / capacityL6N;
    const componentUtilisationsL13Normal = capacityL13N === 0
      ? tangential.map(() => null)
      : tangential.map((value) => Math.abs(value) / capacityL13N);
    const resultantExceedsL13Cap = capacityL13N > 0 && magnitudeN > capacityL13N;
    const everyComponentWithinL13Cap = capacityL13N > 0
      && tangential.every((value) => Math.abs(value) <= capacityL13N);
    return {
      restraintId: support.restraintId,
      nodeId: support.nodeId,
      normalDof: support.normalDof,
      frictionDofs: support.frictionDofs,
      coefficientOfFriction: mu,
      referenceTangentialN: tangential,
      referenceTangentialMagnitudeN: magnitudeN,
      normalBasis: {
        frictionCase: { caseId: FRICTION_CASE, normalN: normalL13N, capacityN: capacityL13N, utilisation: utilisationL13Normal },
        frictionlessTwin: { caseId: CONTROL_CASE, normalN: normalL6N, capacityN: capacityL6N, utilisation: utilisationL6Normal },
        closerToUnity: closerToUnity(utilisationL13Normal, utilisationL6Normal),
      },
      partition: {
        componentUtilisationsAgainstL13Cap: componentUtilisationsL13Normal,
        resultantExceedsL13Cap,
        everyComponentWithinL13Cap,
        perAxisSignature: resultantExceedsL13Cap && everyComponentWithinL13Cap,
      },
    };
  });
  return {
    schema: 'm047-bm4l-stage2-r3-capacity-diagnostics/v1',
    rule: 'DATA_ONLY_DIAGNOSTIC_NO_SOLVER_MECHANICS_OR_TOLERANCES_CHANGED',
    frictionCaseId: FRICTION_CASE,
    frictionlessTwinCaseId: CONTROL_CASE,
    sourceAccdbSha256: iteration.sourceAccdbSha256,
    sourceIterationSemanticHash: iteration.iterationSemanticHash,
    summary: {
      restraintCount: rows.length,
      l13NormalCloserToUnityCount: rows.filter((row) => row.normalBasis.closerToUnity === FRICTION_CASE).length,
      l6NormalCloserToUnityCount: rows.filter((row) => row.normalBasis.closerToUnity === CONTROL_CASE).length,
      equalDistanceCount: rows.filter((row) => row.normalBasis.closerToUnity === 'EQUAL').length,
      perAxisSignatureCount: rows.filter((row) => row.partition.perAxisSignature).length,
      perAxisSignatureRestraints: rows
        .filter((row) => row.partition.perAxisSignature)
        .map((row) => row.restraintId),
      mechanicsChanged: false,
      toleranceChanged: false,
      comparisonPolicyChanged: false,
    },
    restraints: rows,
  };
}

function closerToUnity(left, right) {
  if (left === null && right === null) return 'EQUAL';
  if (left === null) return CONTROL_CASE;
  if (right === null) return FRICTION_CASE;
  const leftDistance = Math.abs(left - 1);
  const rightDistance = Math.abs(right - 1);
  if (leftDistance === rightDistance) return 'EQUAL';
  return leftDistance < rightDistance ? FRICTION_CASE : CONTROL_CASE;
}

function vectorsByNode(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.entityKind !== 'NODE' || row.quantity !== 'FORCE') continue;
    const vector = map.get(String(row.entityId)) ?? {};
    vector[row.component] = Number(row.value);
    map.set(String(row.entityId), vector);
  }
  return map;
}

export async function runCapacityDiagnostics(input) {
  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const rawExport = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: requiredCaesarAccdbTables(profile),
  });
  const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({ rawExport, profile });
  const iteration = JSON.parse(readFileSync(resolve(input.iterationPath), 'utf8'));
  if (iteration.caseId !== FRICTION_CASE) {
    throw new TypeError(`R3 requires ${FRICTION_CASE} iteration evidence; received ${iteration.caseId}.`);
  }
  if (iteration.sourceAccdbSha256 !== benchmarkPackage.source.sha256) {
    throw new TypeError(
      `R3 custody mismatch: iteration ${iteration.sourceAccdbSha256} != real ACCDB ${benchmarkPackage.source.sha256}.`,
    );
  }
  const frictionReference = benchmarkPackage.references[FRICTION_CASE];
  const controlReference = benchmarkPackage.references[CONTROL_CASE];
  if (!frictionReference || !controlReference) {
    throw new TypeError(`R3 requires reference rows for both ${FRICTION_CASE} and ${CONTROL_CASE}.`);
  }
  const record = buildCapacityDiagnostics({
    iteration,
    frictionReferenceRows: frictionReference.rows,
    controlReferenceRows: controlReference.rows,
  });
  const complete = {
    ...record,
    sourceModelSemanticHash: benchmarkPackage.model.semanticHash,
  };
  return Object.freeze({ ...complete, semanticHash: semanticHash(complete) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const accepted = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) accepted.set(argv[index], argv[index + 1]);
  const accdbPath = accepted.get('--accdb');
  const iterationPath = accepted.get('--iteration');
  if (!accdbPath || !iterationPath) {
    throw new TypeError('Usage: --accdb <BM4_L.ACCDB> --iteration <L13-iteration.json> [--out <json>]');
  }
  const record = await runCapacityDiagnostics({ accdbPath, iterationPath });
  const outPath = accepted.get('--out');
  if (outPath) {
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(resolve(outPath), `${canonicalPrettyStringify(record)}\n`, 'utf8');
  }
  process.stdout.write([
    `restraints                    ${record.summary.restraintCount}`,
    `L13 normal closer to cap      ${record.summary.l13NormalCloserToUnityCount}`,
    `L6 normal closer to cap       ${record.summary.l6NormalCloserToUnityCount}`,
    `equal                         ${record.summary.equalDistanceCount}`,
    `per-axis signature count      ${record.summary.perAxisSignatureCount}`,
    `per-axis signature restraints ${record.summary.perAxisSignatureRestraints.join(', ') || '<none>'}`,
    `mechanics changed             ${record.summary.mechanicsChanged}`,
  ].join('\n') + '\n');
}
