#!/usr/bin/env node
/** Data-only diagnostic: does CAESAR final friction direction align with H1's last re-lock direction? */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { buildRelockFinalReturnMapCandidateSource } from './lfea-m047-stage2-d1-relock-final-return-map-experiment.mjs';

const PROFILE_PATH='benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const SOLVER_PATH='src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
const PIN='64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const H1_HASH='fnv1a64:77eea847870b228b';

async function runDiagnostic(input){
  const profile=JSON.parse(readFileSync(resolve(input.profilePath??PROFILE_PATH),'utf8'));
  const raw=await extractCaesarAccdbTables({accdbPath:input.accdbPath,tableNames:requiredCaesarAccdbTables(profile)});
  const pkg=buildCaesarAccdbBenchmarkPackage({rawExport:raw,profile}); if(pkg.source.sha256!==PIN)throw new TypeError('custody mismatch');
  const solverPath=resolve(input.solverPath??SOLVER_PATH); const src=buildRelockFinalReturnMapCandidateSource(readFileSync(solverPath,'utf8'),solverPath);
  const temp=resolve(tmpdir(),`m047-last-relock-${process.pid}-${Date.now()}.mjs`);writeFileSync(temp,src,'utf8');let module;try{module=await import(`${pathToFileURL(temp).href}?lr=${Date.now()}`)}finally{try{unlinkSync(temp)}catch{}}
  const actual=module.solveCaesarAccdbFrictionBenchmark(pkg,['L13'],{profile:module.CAESAR_FRICTION_SOLVER_PROFILE});
  const hash=semanticHash(actual.cases.L13.rows);if(hash!==H1_HASH)throw new Error(`H1 hash mismatch ${hash}`);
  const ev=actual.mechanics.cases.L13;const ref=vectorsByNode(pkg.references.L13.rows);
  const events=[];
  for(const it of ev.iterations){
    const byId=new Map((it.supports??[]).map(s=>[s.restraintId,s]));
    for(const c of it.stateChanges??[]){
      if(c.from!=='SLIDE'||c.to!=='STICK')continue;
      const s=byId.get(c.restraintId);if(!s)throw new Error(`missing support ${c.restraintId} at transition`);
      const u=[...s.relativeTangentialDisplacementM];const dir=unit(u)?.map(x=>-x)??null;
      events.push({iteration:it.iteration,nodeId:String(c.nodeId),restraintId:c.restraintId,frictionDofs:[...s.frictionDofs],relockOppositionDirection:dir,relockTangentialDisplacementM:u});
    }
  }
  const lastByNode=new Map();for(const e of events)lastByNode.set(e.nodeId,e);
  const finalSupports=new Map(ev.iterations.at(-1).supports.map(s=>[String(s.nodeId),s]));
  const rows=[];
  for(const [nodeId,e] of [...lastByNode.entries()].sort()){
    const s=finalSupports.get(nodeId),rv=ref.get(nodeId)??{};const rf=s.frictionDofs.map(d=>Number(rv[d]??0));const ff=[...s.appliedFrictionForceN];
    rows.push({...e,referenceTangentialForceN:rf,finalH1TangentialForceN:ff,lastRelockDirectionCosineToReferenceForce:cosine(e.relockOppositionDirection,rf),finalH1ForceCosineToReferenceForce:cosine(ff,rf),finalH1ForceCosineToLastRelockDirection:cosine(ff,e.relockOppositionDirection),finalRegime:s.regime});
  }
  const focus=['22140','22220','22070','22370','21740','22310','20440','21860','22260','22120'];
  const result={schema:'m047-bm4l-stage2-h1-last-relock-direction-diagnostic/v1',rule:'DATA_ONLY_H1_REPRODUCTION_NO_MECHANICS_CHANGE',sourceAccdbSha256:pkg.source.sha256,h1RowsSemanticHash:hash,h1IterationCount:ev.iterationCount,relockEventCount:events.length,lastRelockRows:rows,focusRows:focus.map(n=>rows.find(r=>r.nodeId===n)??null)};
  return Object.freeze({...result,semanticHash:semanticHash(result)});
}
function vectorsByNode(rows){const m=new Map();for(const r of rows){if(r.entityKind!=='NODE'||r.quantity!=='FORCE')continue;const v=m.get(String(r.entityId))??{};v[r.component]=Number(r.value);m.set(String(r.entityId),v)}return m}
function norm(v){return Math.hypot(...v)}function unit(v){const n=norm(v);return n===0?null:v.map(x=>x/n)}function cosine(a,b){if(a===null)return null;const d=norm(a)*norm(b);return d===0?null:a.reduce((s,x,i)=>s+x*b[i],0)/d}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const args=new Map();const av=process.argv.slice(2);for(let i=0;i<av.length;i+=2)args.set(av[i],av[i+1]);const accdbPath=args.get('--accdb');if(!accdbPath)throw new TypeError('Usage: --accdb <BM4_L.ACCDB> [--out <json>]');const r=await runDiagnostic({accdbPath});const out=args.get('--out');if(out){mkdirSync(dirname(resolve(out)),{recursive:true});writeFileSync(resolve(out),`${canonicalPrettyStringify(r)}\n`,'utf8')}for(const x of r.focusRows.filter(Boolean))process.stdout.write(`${x.nodeId} relockIt=${x.iteration} relockRefCos=${x.lastRelockDirectionCosineToReferenceForce} finalRefCos=${x.finalH1ForceCosineToReferenceForce}\n`)}
export {runDiagnostic};
