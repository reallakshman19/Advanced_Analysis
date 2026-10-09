#!/usr/bin/env node
/**
 * M047 Stage 2 R8/NFV15 L15 algebraic reconstruction gate.
 *
 * L15 is never solved nonlinearly. It is reconstructed exactly as L7-L13 from
 * two separately converged real-file R8 primitive artifacts, then compared with
 * the pinned ACCDB L15 reference. This preserves the governed qualification
 * order L13 -> L7 -> L15 -> L1.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const EXPECTED_ZIP_SHA256 = '978617cba50fa0b1a16c2fa71dc1e0d38e55ac834b191f887d100c6951abd8b9';
const EXPECTED_ZIP_BYTES = 582488;
const EXPECTED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const EXPECTED_ACCDB_BYTES = 5136384;
const EXPERIMENT_SOLVER = 'CAESAR-ACCDB-FRICTION-SOLVER-R2-R8-NFV15-EXPERIMENT';
const GOAL_RELATIVE = 0.10;

export async function reconstructR8L15(input) {
  const l13Artifact = JSON.parse(readFileSync(resolve(input.l13Path), 'utf8'));
  const l7Artifact = JSON.parse(readFileSync(resolve(input.l7Path), 'utf8'));
  const l13 = qualifiedPrimitive(l13Artifact, 'L13');
  const l7 = qualifiedPrimitive(l7Artifact, 'L7');
  const custody = verifyCustody({ zipPath: input.zipPath, accdbPath: input.accdbPath });

  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const rawExport = await extractCaesarAccdbTables({
    accdbPath: resolve(input.accdbPath),
    tableNames: requiredCaesarAccdbTables(profile),
  });
  const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({ rawExport, profile });
  if (benchmarkPackage.source.sha256 !== EXPECTED_ACCDB_SHA256) throw new Error('L15 package is not the pinned BM4_L member.');
  const referenceRows = benchmarkPackage.references?.L15?.rows;
  if (!Array.isArray(referenceRows) || referenceRows.length === 0) throw new TypeError('Pinned ACCDB does not expose L15 reference rows.');

  const actualRows = subtractRows(l7.actualRows, l13.actualRows, 'L15');
  const identity = verifyDifferenceIdentity(l7.actualRows, l13.actualRows, actualRows);
  if (identity.status !== 'PASS') throw new Error('L15 algebraic identity failed.');
  const supports = l7.frictionRestraints.map((row) => ({
    restraintId: row.restraintId,
    nodeId: row.nodeId,
    normalDof: row.normalDof,
    frictionDofs: row.frictionDofs,
  }));
  const comparisons = compareFrictionSites({ referenceRows, actualRows, supports });
  const summary = summarize(comparisons);

  const base = {
    schema: 'm047-stage2-r8-nfv15-l15-reconstruction/v1',
    measurementBoundary: 'REAL_PINNED_ACCDB_ALGEBRAIC_DERIVATION_NO_NONLINEAR_L15_SOLVE',
    caseId: 'L15',
    formula: 'L7-L13',
    sourceAccdbSha256: EXPECTED_ACCDB_SHA256,
    custody,
    candidateSolverProfileId: EXPERIMENT_SOLVER,
    constituents: {
      minuendCaseId: 'L7',
      subtrahendCaseId: 'L13',
      l7ExperimentSemanticHash: l7Artifact.experimentSemanticHash ?? null,
      l13ExperimentSemanticHash: l13Artifact.experimentSemanticHash ?? null,
      l7ActualRowsSemanticHash: l7.actualRowsSemanticHash,
      l13ActualRowsSemanticHash: l13.actualRowsSemanticHash,
      l7IterationCount: l7.iterationCount,
      l13IterationCount: l13.iterationCount,
      bothConverged: true,
      bothEquilibriumPass: true,
      bothNonlinearGatePass: true,
    },
    identity,
    actualRowsSemanticHash: semanticHash(actualRows),
    referenceRowsSemanticHash: semanticHash(referenceRows),
    actualRows,
    referenceRows,
    frictionRestraints: comparisons,
    accuracy: summary,
    independentNonlinearSolve: false,
    productionPromotionAuthorized: false,
    nextGate: 'RUN_R8_L1_REAL_PINNED_ACCDB',
  };
  return Object.freeze({ ...base, reconstructionSemanticHash: semanticHash(base) });
}

function qualifiedPrimitive(artifact, caseId) {
  if (!artifact || artifact.schema !== 'm047-stage2-r8-nfv15-real-file-experiment/v1') {
    throw new TypeError(`${caseId} must be an R8 real-file experiment artifact.`);
  }
  if (artifact.caseId !== caseId) throw new TypeError(`Expected ${caseId} artifact, got ${artifact.caseId}.`);
  if (artifact.custody?.status !== 'PASS' || artifact.custody?.accdb?.sha256 !== EXPECTED_ACCDB_SHA256) {
    throw new TypeError(`${caseId} artifact custody is not PASS for the pinned ACCDB.`);
  }
  if (artifact.productionBoundary?.productionMechanicsChanged !== false) {
    throw new TypeError(`${caseId} artifact does not prove production remained unchanged.`);
  }
  if (artifact.experimentalProfile?.profileId !== EXPERIMENT_SOLVER) throw new TypeError(`${caseId} R8 profile mismatch.`);
  if (!Array.isArray(artifact.runs) || artifact.runs.length === 0) throw new TypeError(`${caseId} artifact has no run.`);
  const run = artifact.runs[0];
  if (run.converged !== true || run.recoveredEquilibriumStatus !== 'PASS' || run.convergenceGates?.status !== 'CONVERGED') {
    throw new TypeError(`${caseId} must be converged with equilibrium and nonlinear gates PASS.`);
  }
  if (!Array.isArray(run.actualRows) || !Array.isArray(run.frictionRestraints)) throw new TypeError(`${caseId} run is missing rows or friction restraints.`);
  return run;
}

function compareFrictionSites({ referenceRows, actualRows, supports }) {
  const reference = vectorsByNode(referenceRows);
  const actual = vectorsByNode(actualRows);
  return supports.map((support) => {
    const ref = reference.get(String(support.nodeId)) ?? {};
    const solved = actual.get(String(support.nodeId)) ?? {};
    const referenceNormalN = Math.abs(Number(ref[support.normalDof] ?? 0));
    const solvedNormalN = Math.abs(Number(solved[support.normalDof] ?? 0));
    const referenceTangential = support.frictionDofs.map((dof) => Number(ref[dof] ?? 0));
    const solvedTangential = support.frictionDofs.map((dof) => Number(solved[dof] ?? 0));
    const referenceMagnitudeN = norm(referenceTangential);
    const solvedMagnitudeN = norm(solvedTangential);
    const vectorErrorN = norm(solvedTangential.map((value, index) => value - referenceTangential[index]));
    return Object.freeze({
      restraintId: support.restraintId,
      nodeId: support.nodeId,
      normalDof: support.normalDof,
      frictionDofs: support.frictionDofs,
      normal: {
        referenceN: referenceNormalN,
        solvedN: solvedNormalN,
        relativeError: referenceNormalN === 0 ? null : Math.abs(solvedNormalN - referenceNormalN) / referenceNormalN,
      },
      tangential: {
        referenceN: referenceTangential,
        solvedN: solvedTangential,
        referenceMagnitudeN,
        solvedMagnitudeN,
        vectorErrorN,
        vectorRelativeError: referenceMagnitudeN === 0 ? null : vectorErrorN / referenceMagnitudeN,
      },
    });
  });
}

function summarize(rows) {
  const normal = rows.filter((row) => row.normal.relativeError !== null);
  const tangential = rows.filter((row) => row.tangential.vectorRelativeError !== null);
  return Object.freeze({
    goalRelative: GOAL_RELATIVE,
    frictionRestraintCount: rows.length,
    normalWithinGoal: normal.filter((row) => row.normal.relativeError <= GOAL_RELATIVE).length,
    normalCompared: normal.length,
    normalWorstRelativeError: maximum(normal.map((row) => row.normal.relativeError)),
    tangentialVectorsWithinGoal: tangential.filter((row) => row.tangential.vectorRelativeError <= GOAL_RELATIVE).length,
    tangentialVectorsCompared: tangential.length,
    tangentialWorstRelativeError: maximum(tangential.map((row) => row.tangential.vectorRelativeError)),
  });
}

function subtractRows(minuendRows, subtrahendRows, caseId) {
  const minuend = new Map(minuendRows.map((row) => [rowIdentity(row), row]));
  const subtrahend = new Map(subtrahendRows.map((row) => [rowIdentity(row), row]));
  const identities = [...new Set([...minuend.keys(), ...subtrahend.keys()])].sort(text);
  return identities.map((identity) => {
    const left = minuend.get(identity);
    const right = subtrahend.get(identity);
    if (!left || !right) throw new TypeError(`${caseId} has incomplete constituent row coverage at ${identity}.`);
    if (left.unit !== right.unit) throw new TypeError(`${caseId} row ${identity} has incompatible units.`);
    return {
      entityKind: left.entityKind,
      entityId: left.entityId,
      quantity: left.quantity,
      component: left.component,
      value: Number(left.value) - Number(right.value),
      unit: left.unit,
    };
  });
}

function verifyDifferenceIdentity(minuendRows, subtrahendRows, derivedRows) {
  const minuend = new Map(minuendRows.map((row) => [rowIdentity(row), Number(row.value)]));
  const subtrahend = new Map(subtrahendRows.map((row) => [rowIdentity(row), Number(row.value)]));
  let maximumAbsoluteDeviation = 0;
  for (const row of derivedRows) {
    const identity = rowIdentity(row);
    const expected = minuend.get(identity) - subtrahend.get(identity);
    maximumAbsoluteDeviation = Math.max(maximumAbsoluteDeviation, Math.abs(Number(row.value) - expected));
  }
  return Object.freeze({
    rule: 'EVERY_L15_ROW_EQUALS_R8_L7_MINUS_R8_L13_AT_THE_SAME_IDENTITY',
    comparedRowCount: derivedRows.length,
    maximumAbsoluteDeviation,
    status: maximumAbsoluteDeviation === 0 ? 'PASS' : 'FAIL',
  });
}

function verifyCustody({ zipPath, accdbPath }) {
  if (!zipPath || !accdbPath) throw new TypeError('L15 reconstruction requires both --zip and --accdb.');
  const zip = fileIdentity(resolve(zipPath));
  const accdb = fileIdentity(resolve(accdbPath));
  if (zip.sha256 !== EXPECTED_ZIP_SHA256 || zip.bytes !== EXPECTED_ZIP_BYTES) throw new Error('Pinned ZIP custody mismatch.');
  if (accdb.sha256 !== EXPECTED_ACCDB_SHA256 || accdb.bytes !== EXPECTED_ACCDB_BYTES) throw new Error('Pinned ACCDB custody mismatch.');
  return Object.freeze({
    zip: { ...zip, expectedSha256: EXPECTED_ZIP_SHA256, expectedBytes: EXPECTED_ZIP_BYTES, status: 'PASS' },
    accdb: { ...accdb, expectedSha256: EXPECTED_ACCDB_SHA256, expectedBytes: EXPECTED_ACCDB_BYTES, status: 'PASS' },
    status: 'PASS',
  });
}

function fileIdentity(path) { return Object.freeze({ path, bytes: statSync(path).size, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }); }
function vectorsByNode(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.entityKind !== 'NODE' || !['FORCE', 'MOMENT'].includes(row.quantity)) continue;
    const vector = map.get(String(row.entityId)) ?? {};
    vector[row.component] = Number(row.value);
    map.set(String(row.entityId), vector);
  }
  return map;
}
function rowIdentity(row) { return [row.entityKind, row.entityId, row.quantity, row.component].join(':'); }
function norm(values) { return Math.hypot(...values); }
function maximum(values) { return values.length === 0 ? null : Math.max(...values); }
function text(left, right) { return String(left).localeCompare(String(right), 'en'); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
  if (!args.get('--l13') || !args.get('--l7') || !args.get('--zip') || !args.get('--accdb')) {
    throw new Error('Usage: --l13 <R8-L13.json> --l7 <R8-L7.json> --zip <BM4_L.zip> --accdb <BM4_L.ACCDB> [--out <json>]');
  }
  const record = await reconstructR8L15({
    l13Path: args.get('--l13'),
    l7Path: args.get('--l7'),
    zipPath: args.get('--zip'),
    accdbPath: args.get('--accdb'),
    profilePath: args.get('--profile') ?? PROFILE_PATH,
  });
  const outPath = resolve(args.get('--out') ?? 'reports/lfea-m047-stage2-r8-nfv15-L15.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${canonicalPrettyStringify(record)}\n`, 'utf8');
  process.stdout.write([
    'R8/NFV15 L15',
    `identity=${record.identity.status}`,
    `normalWithin10=${record.accuracy.normalWithinGoal}/${record.accuracy.normalCompared}`,
    `tangentWithin10=${record.accuracy.tangentialVectorsWithinGoal}/${record.accuracy.tangentialVectorsCompared}`,
    `artifact=${outPath}`,
  ].join(' ') + '\n');
}
