#!/usr/bin/env node
/**
 * Data-only H1 residual diagnostic. Reproduces the already-measured H1 candidate
 * and compares CAESAR reference displacement direction with H1 total displacement,
 * elastic stretch, permanent slip and final friction force at each restraint.
 * No nonlinear mechanic, tolerance, gate or comparison rule is changed.
 */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { buildRelockFinalReturnMapCandidateSource } from './lfea-m047-stage2-d1-relock-final-return-map-experiment.mjs';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const SOLVER_PATH = 'src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const EXPECTED_H1_ROWS_HASH = 'fnv1a64:77eea847870b228b';

async function runDiagnostic(input) {
  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const rawExport = await extractCaesarAccdbTables({accdbPath: input.accdbPath, tableNames: requiredCaesarAccdbTables(profile)});
  const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({rawExport, profile});
  if (benchmarkPackage.source.sha256 !== PINNED_ACCDB_SHA256) throw new TypeError('H1 branch diagnostic ACCDB custody mismatch.');

  const solverPath = resolve(input.solverPath ?? SOLVER_PATH);
  const source = buildRelockFinalReturnMapCandidateSource(readFileSync(solverPath, 'utf8'), solverPath);
  const tempPath = resolve(tmpdir(), `m047-h1-branch-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(tempPath, source, 'utf8');
  let module;
  try { module = await import(`${pathToFileURL(tempPath).href}?diag=${Date.now()}`); }
  finally { try { unlinkSync(tempPath); } catch { /* best effort */ } }

  const actual = module.solveCaesarAccdbFrictionBenchmark(benchmarkPackage, ['L13'], {profile: module.CAESAR_FRICTION_SOLVER_PROFILE});
  const rowsHash = semanticHash(actual.cases.L13.rows);
  if (rowsHash !== EXPECTED_H1_ROWS_HASH) throw new Error(`H1 reproduction hash mismatch ${rowsHash}.`);
  const evidence = actual.mechanics.cases.L13;
  if (evidence.convergenceGates?.status !== 'CONVERGED' || evidence.recoveredEquilibrium?.status !== 'PASS') {
    throw new Error('H1 branch diagnostic reproduced an unqualified state.');
  }

  const referenceForce = vectorsByNode(benchmarkPackage.references.L13.rows, ['FORCE']);
  const referenceDisplacement = vectorsByNode(benchmarkPackage.references.L13.rows, ['DISPLACEMENT']);
  const finalSupports = evidence.iterations.at(-1).supports;
  const resultRows = finalSupports.map((support) => {
    const refF = referenceForce.get(String(support.nodeId)) ?? {};
    const refU = referenceDisplacement.get(String(support.nodeId)) ?? {};
    const refTangentialForce = support.frictionDofs.map((dof) => Number(refF[dof] ?? 0));
    const refTangentialDisplacement = support.frictionDofs.map((dof) => Number(refU[dof] ?? 0));
    const h1Displacement = [...support.relativeTangentialDisplacementM];
    const h1ElasticStretch = [...support.elasticTangentialStretchM];
    const h1Slip = [...support.accumulatedSlipM];
    const h1Force = [...support.appliedFrictionForceN];
    return {
      restraintId: support.restraintId,
      nodeId: String(support.nodeId),
      frictionDofs: [...support.frictionDofs],
      regime: support.regime,
      referenceTangentialForceN: refTangentialForce,
      h1TangentialForceN: h1Force,
      forceCosineH1ToReference: cosine(h1Force, refTangentialForce),
      referenceTangentialDisplacementM: refTangentialDisplacement,
      h1TangentialDisplacementM: h1Displacement,
      displacementCosineH1ToReference: cosine(h1Displacement, refTangentialDisplacement),
      h1ElasticStretchM: h1ElasticStretch,
      elasticStretchCosineToReferenceForce: cosine(h1ElasticStretch, refTangentialForce),
      h1PermanentSlipM: h1Slip,
      slipCosineToReferenceDisplacement: cosine(h1Slip, refTangentialDisplacement),
      referenceForceOpposesReferenceDisplacement: cosine(refTangentialForce, refTangentialDisplacement),
      h1ForceOpposesH1Displacement: cosine(h1Force, h1Displacement),
      h1ForceOpposesH1ElasticStretch: cosine(h1Force, h1ElasticStretch),
    };
  }).sort((a,b) => a.nodeId.localeCompare(b.nodeId));

  const focus = ['22140','22220','22070','22370','21740','22310','20440','21860','22260','22120'];
  const result = {
    schema: 'm047-bm4l-stage2-h1-displacement-branch-diagnostic/v1',
    rule: 'DATA_ONLY_REPRODUCTION_OF_COMMITTED_H1_NO_MECHANICS_TOLERANCE_OR_GATE_CHANGE',
    sourceAccdbSha256: benchmarkPackage.source.sha256,
    h1RowsSemanticHash: rowsHash,
    h1IterationCount: evidence.iterationCount,
    focusRows: focus.map((nodeId) => resultRows.find((row) => row.nodeId === nodeId)),
    rows: resultRows,
  };
  return Object.freeze({...result, semanticHash: semanticHash(result)});
}

function vectorsByNode(rows, quantities) {
  const map = new Map();
  for (const row of rows) {
    if (row.entityKind !== 'NODE' || !quantities.includes(row.quantity)) continue;
    const vector = map.get(String(row.entityId)) ?? {};
    vector[row.component] = Number(row.value);
    map.set(String(row.entityId), vector);
  }
  return map;
}
function norm(v) { return Math.hypot(...v); }
function cosine(a,b) { const d=norm(a)*norm(b); return d===0?null:a.reduce((s,x,i)=>s+x*b[i],0)/d; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=new Map(); const argv=process.argv.slice(2); for(let i=0;i<argv.length;i+=2) args.set(argv[i],argv[i+1]);
  const accdbPath=args.get('--accdb'); if(!accdbPath) throw new TypeError('Usage: --accdb <BM4_L.ACCDB> [--out <json>]');
  const record=await runDiagnostic({accdbPath});
  const out=args.get('--out'); if(out){mkdirSync(dirname(resolve(out)),{recursive:true});writeFileSync(resolve(out),`${canonicalPrettyStringify(record)}\n`,'utf8');}
  for(const row of record.focusRows){
    process.stdout.write(`${row.nodeId} forceCos=${row.forceCosineH1ToReference} dispCos=${row.displacementCosineH1ToReference} refF_vs_refU=${row.referenceForceOpposesReferenceDisplacement} h1F_vs_h1U=${row.h1ForceOpposesH1Displacement}\n`);
  }
}

export { runDiagnostic };
