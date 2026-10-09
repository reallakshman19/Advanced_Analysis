#!/usr/bin/env node
/**
 * Data-only H1 post-relock magnitude diagnostic.
 * Reproduces exact H1 and records the last SLIDE->STICK capacity/direction plus
 * final H1/reference force magnitudes. It evaluates two non-authoritative
 * counterfactuals without changing solver mechanics:
 *   A. hold the last-relock Coulomb force constant;
 *   B. hold last-relock direction but unload/reload only by scalar displacement
 *      projected on that stored force direction.
 */
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
  const solverPath=resolve(input.solverPath??SOLVER_PATH);const src=buildRelockFinalReturnMapCandidateSource(readFileSync(solverPath,'utf8'),solverPath);const temp=resolve(tmpdir(),`m047-mag-${process.pid}-${Date.now()}.mjs`);writeFileSync(temp,src,'utf8');let module;try{module=await import(`${pathToFileURL(temp).href}?mag=${Date.now()}`)}finally{try{unlinkSync(temp)}catch{}}
  const actual=module.solveCaesarAccdbFrictionBenchmark(pkg,['L13'],{profile:module.CAESAR_FRICTION_SOLVER_PROFILE});const hash=semanticHash(actual.cases.L13.rows);if(hash!==H1_HASH)throw new Error(`H1 hash mismatch ${hash}`);
  const ev=actual.mechanics.cases.L13;const refF=vectorsByNode(pkg.references.L13.rows,['FORCE']);const refU=vectorsByNode(pkg.references.L13.rows,['DISPLACEMENT']);
  const last=new Map();
  for(const it of ev.iterations){const byId=new Map((it.supports??[]).map(s=>[s.restraintId,s]));for(const c of it.stateChanges??[]){if(c.from!=='SLIDE'||c.to!=='STICK')continue;const s=byId.get(c.restraintId);const u=[...s.relativeTangentialDisplacementM];last.set(String(c.nodeId),{iteration:it.iteration,nodeId:String(c.nodeId),restraintId:c.restraintId,frictionDofs:[...s.frictionDofs],relockDisplacementM:u,relockForceDirection:unit(u)?.map(x=>-x)??null,relockCapacityN:Number(s.capacityN),relockNormalN:Number(s.normalReactionMagnitudeN),relockAppliedMagnitudeN:Number(s.appliedFrictionForceMagnitudeN)});}}
  const finalSupports=new Map(ev.iterations.at(-1).supports.map(s=>[String(s.nodeId),s]));const k=Number(actual.mechanics.cases.L13.frictionStiffness.appliedSiValue);
  const rows=[];
  for(const [nodeId,r] of [...last.entries()].sort()){
    const s=finalSupports.get(nodeId),rfv=refF.get(nodeId)??{},ruv=refU.get(nodeId)??{};const refForce=s.frictionDofs.map(d=>Number(rfv[d]??0));const refDisp=s.frictionDofs.map(d=>Number(ruv[d]??0));const h1Force=[...s.appliedFrictionForceN];const h1Disp=[...s.relativeTangentialDisplacementM];const refMag=norm(refForce),h1Mag=norm(h1Force);
    const constantForce=r.relockForceDirection.map(x=>x*r.relockCapacityN);
    const deltaH1=h1Disp.map((x,i)=>x-r.relockDisplacementM[i]);
    // At re-lock the stored force is cap*d, where d is relockForceDirection.
    // If that force direction is held fixed, a later displacement increment Δu
    // changes the scalar force along d by -k(Δu·d):
    //   F_scalar = cap - k (Δu · d)
    // This is a data-only counterfactual. It does not alter H1/H2 mechanics.
    const signedDisplacementChangeAlongRelockForce=dot(deltaH1,r.relockForceDirection);
    const scalarMagnitudeSigned=r.relockCapacityN-k*signedDisplacementChangeAlongRelockForce;
    const scalarDirectionMemoryForce=r.relockForceDirection.map(x=>x*scalarMagnitudeSigned);
    const scalarNoReverseForce=r.relockForceDirection.map(x=>x*Math.abs(scalarMagnitudeSigned));
    rows.push({...r,frictionStiffnessNPerM:k,referenceFinalForceN:refForce,referenceFinalMagnitudeN:refMag,referenceFinalDisplacementM:refDisp,referenceFinalCapacityN:Number(s.coefficientOfFriction)*Math.abs(Number(rfv[s.normalDof]??0)),h1FinalForceN:h1Force,h1FinalMagnitudeN:h1Mag,h1FinalDisplacementM:h1Disp,referenceMagnitudeToRelockCapacityRatio:r.relockCapacityN===0?null:refMag/r.relockCapacityN,h1MagnitudeToRelockCapacityRatio:r.relockCapacityN===0?null:h1Mag/r.relockCapacityN,constantRelockForceVectorErrorPct:percentVectorError(constantForce,refForce),scalarDirectionMemorySignedVectorErrorPct:percentVectorError(scalarDirectionMemoryForce,refForce),scalarDirectionMemoryNoReverseVectorErrorPct:percentVectorError(scalarNoReverseForce,refForce),signedDisplacementChangeAlongRelockForceM:signedDisplacementChangeAlongRelockForce,signedScalarMagnitudeN:scalarMagnitudeSigned});
  }
  const focus=['22140','22220','22070','22370','21740','22310','21860','22260','22120'];
  const result={schema:'m047-bm4l-stage2-h1-post-relock-magnitude-diagnostic/v3',rule:'DATA_ONLY_COUNTERFACTUALS_NO_MECHANICS_CHANGE_CORRECTED_SCALAR_PROJECTION_AND_VECTOR_CONSTRUCTION',sourceAccdbSha256:pkg.source.sha256,h1RowsSemanticHash:hash,h1IterationCount:ev.iterationCount,rows,focusRows:focus.map(n=>rows.find(r=>r.nodeId===n)??null)};return Object.freeze({...result,semanticHash:semanticHash(result)});
}
function vectorsByNode(rows,qs){const m=new Map();for(const r of rows){if(r.entityKind!=='NODE'||!qs.includes(r.quantity))continue;const v=m.get(String(r.entityId))??{};v[r.component]=Number(r.value);m.set(String(r.entityId),v)}return m}function norm(v){return Math.hypot(...v)}function dot(a,b){return a.reduce((s,x,i)=>s+x*b[i],0)}function unit(v){const n=norm(v);return n===0?null:v.map(x=>x/n)}function percentVectorError(a,b){const n=norm(b);return n===0?null:100*norm(a.map((x,i)=>x-b[i]))/n}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const args=new Map();const av=process.argv.slice(2);for(let i=0;i<av.length;i+=2)args.set(av[i],av[i+1]);const accdbPath=args.get('--accdb');if(!accdbPath)throw new TypeError('Usage: --accdb <BM4_L.ACCDB> [--out <json>]');const r=await runDiagnostic({accdbPath});const out=args.get('--out');if(out){mkdirSync(dirname(resolve(out)),{recursive:true});writeFileSync(resolve(out),`${canonicalPrettyStringify(r)}\n`,'utf8')}for(const x of r.focusRows.filter(Boolean))process.stdout.write(`${x.nodeId} ref/relockCap=${x.referenceMagnitudeToRelockCapacityRatio} constErr=${x.constantRelockForceVectorErrorPct} scalarErr=${x.scalarDirectionMemorySignedVectorErrorPct} noReverseErr=${x.scalarDirectionMemoryNoReverseVectorErrorPct}\n`)}
export {runDiagnostic};
