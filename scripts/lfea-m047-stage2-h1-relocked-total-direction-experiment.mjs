#!/usr/bin/env node
/**
 * M047 Stage 2 H2 — sequential H1 + re-locked total-displacement direction.
 *
 * Baseline H1 already performs one final D1 return-map slip update on an actual
 * SLIDE -> STICK transition. H2 adds one mechanic after that transition only:
 * while a support remains STICK with permanent slip, preserve its current elastic
 * trial-force magnitude but orient the force opposite current total relative
 * tangential displacement, then choose the slip offset that realizes that vector.
 *
 * The H1 transition itself still uses the H1 final return-map update. This avoids
 * replacing H1 with the previously rejected D2 transform. Resultant capacity,
 * normal basis, kf, state law/hysteresis, acceleration, load path, gates and the
 * comparison goal remain unchanged. Production source is never edited.
 */
import { createHash } from 'node:crypto';
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
const H1_PROFILE_ID='CAESAR-ACCDB-FRICTION-SOLVER-R1-D1-RELOCK-FINAL-RETURN-MAP';
const H2_PROFILE_ID='CAESAR-ACCDB-FRICTION-SOLVER-R1-D1-H1-RELOCKED-TOTAL-DIRECTION';
const PINNED_ACCDB_SHA256='64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const H1_MEASUREMENT_PATH='reports/lfea-m047-stage2-d1-relock-final-return-map-measurement.json';
const H1_DIAGNOSTIC_PATH='reports/lfea-m047-stage2-h1-displacement-branch-diagnostic.json';

export async function runH2Experiment(input){
  const h1=JSON.parse(readFileSync(resolve(input.h1MeasurementPath??H1_MEASUREMENT_PATH),'utf8'));
  const diag=JSON.parse(readFileSync(resolve(input.h1DiagnosticPath??H1_DIAGNOSTIC_PATH),'utf8'));
  validateH1(h1,diag);
  const profile=JSON.parse(readFileSync(resolve(input.profilePath??PROFILE_PATH),'utf8'));
  const rawExport=await extractCaesarAccdbTables({accdbPath:input.accdbPath,tableNames:requiredCaesarAccdbTables(profile)});
  const benchmarkPackage=buildCaesarAccdbBenchmarkPackage({rawExport,profile});
  if(benchmarkPackage.source.sha256!==PINNED_ACCDB_SHA256) throw new TypeError('H2 ACCDB custody mismatch.');
  const loaded=await loadCandidate(resolve(input.solverPath??SOLVER_PATH));
  if(loaded.module.CAESAR_FRICTION_SOLVER_PROFILE.profileId!==H2_PROFILE_ID) throw new Error('H2 profile mismatch.');
  const first=runCandidate(loaded.module,benchmarkPackage);
  const second=runCandidate(loaded.module,benchmarkPackage);
  if(first.error||second.error){
    const record={schema:'m047-bm4l-stage2-h1-relocked-total-direction/v1',measurementBoundary:'REAL_PINNED_ACCDB_EPHEMERAL_H1_H2',caseId:'L13',sourceAccdbSha256:benchmarkPackage.source.sha256,productionSolverModified:false,isolatedMechanic:'POST_H1_RELOCKED_FORCE_DIRECTION_ONLY',candidateProfileId:H2_PROFILE_ID,candidateSourceSha256:loaded.sha256,toleranceChanged:false,comparisonPolicyChanged:false,baselineSummary:h1.candidate,candidate:{converged:false,firstRunFailure:first.error,repeatRunFailure:second.error},candidateSummary:null,decision:'REJECT_H2_NONCONVERGED_KEEP_H1_AS_REVIEW_CANDIDATE_D1_AS_BASELINE'};
    return Object.freeze({...record,semanticHash:semanticHash(record)});
  }
  const actual=first.actual, repeat=second.actual;
  const ev=actual.mechanics.cases.L13, ev2=repeat.mechanics.cases.L13;
  const hash=semanticHash(actual.cases.L13.rows), hash2=semanticHash(repeat.cases.L13.rows);
  const rows=compare({benchmarkPackage,actual,h1});
  const summary=summarize(rows);
  const directionTargetIds=new Set(['22140','22220','22070','22370','21740']);
  const negativeControlIds=new Set(['22310','20440','21860','22260','22120']);
  const directionTargets=rows.filter(r=>directionTargetIds.has(r.nodeId));
  const negativeControls=rows.filter(r=>negativeControlIds.has(r.nodeId));
  const transitionEvents=ev.iterations.flatMap(it=>(it.stateChanges??[]).filter(c=>c.from==='SLIDE'&&c.to==='STICK').map(c=>({iteration:it.iteration,nodeId:c.nodeId,restraintId:c.restraintId})));
  const transitionEvents2=ev2.iterations.flatMap(it=>(it.stateChanges??[]).filter(c=>c.from==='SLIDE'&&c.to==='STICK').map(c=>({iteration:it.iteration,nodeId:c.nodeId,restraintId:c.restraintId})));
  const record={
    schema:'m047-bm4l-stage2-h1-relocked-total-direction/v1',measurementBoundary:'REAL_PINNED_ACCDB_EPHEMERAL_H1_H2',caseId:'L13',sourceAccdbSha256:benchmarkPackage.source.sha256,
    productionSolverModified:false,isolatedMechanic:'POST_H1_RELOCKED_FORCE_DIRECTION_ONLY',candidateProfileId:H2_PROFILE_ID,candidateSourceSha256:loaded.sha256,toleranceChanged:false,comparisonPolicyChanged:false,
    unchangedMechanics:['H1_FINAL_RETURN_MAP_ON_SLIDE_TO_STICK','D1_SLIDING_TOTAL_DISPLACEMENT_DIRECTION','RESULTANT_COULOMB_CAPACITY','OWN_RESTRAINT_NORMAL_BASIS','FRICTION_STIFFNESS','STATE_BOUNDARY_AND_HYSTERESIS','SECANT_ACCELERATION','FULL_LOAD_SINGLE_STEP_L13','CONVERGENCE_GATES','TEN_PERCENT_COMPARISON_GOAL'],
    candidate:{converged:true,deterministic:hash===hash2,equilibriumPass:ev.recoveredEquilibrium?.status==='PASS'&&ev2.recoveredEquilibrium?.status==='PASS',convergencePass:ev.convergenceGates?.status==='CONVERGED'&&ev2.convergenceGates?.status==='CONVERGED',rowsSemanticHash:hash,repeatRowsSemanticHash:hash2,iterationCount:ev.iterationCount,repeatIterationCount:ev2.iterationCount,slideToStickTransitionCount:transitionEvents.length,repeatSlideToStickTransitionCount:transitionEvents2.length,transitionReproducible:JSON.stringify(transitionEvents)===JSON.stringify(transitionEvents2)},
    baselineSummary:h1.candidate,candidateSummary:summary,
    directionTargets:{nodeIds:[...directionTargetIds],baselineMedianErrorPct:median(directionTargets.map(r=>r.baselineErrPct)),candidateMedianErrorPct:median(directionTargets.map(r=>r.candidateErrPct)),baselinePasses:directionTargets.filter(r=>r.baselineErrPct<=10).length,candidatePasses:directionTargets.filter(r=>r.candidateErrPct<=10).length},
    directionCorrectNegativeControls:{nodeIds:[...negativeControlIds],lostPassNodeIds:negativeControls.filter(r=>r.baselineErrPct<=10&&r.candidateErrPct>10).map(r=>r.nodeId),maximumErrorIncreasePctPoints:maximum(negativeControls.map(r=>r.candidateErrPct-r.baselineErrPct))},
    rows,
  };
  record.decision=decide(record);
  return Object.freeze({...record,semanticHash:semanticHash(record)});
}

function decide(r){
  if(!r.candidate.deterministic||!r.candidate.equilibriumPass||!r.candidate.convergencePass||!r.candidate.transitionReproducible) return 'REJECT_H2_PHYSICS_DETERMINISM_OR_EXERCISE_GATE';
  if(r.candidateSummary.normalsWithin10Pct!==23) return 'REJECT_H2_NORMAL_REGRESSION';
  if(r.directionCorrectNegativeControls.lostPassNodeIds.length>0) return 'REJECT_H2_LOST_DIRECTION_CORRECT_CONTROL';
  const targetImproved=r.directionTargets.candidateMedianErrorPct<r.directionTargets.baselineMedianErrorPct;
  const aggregateImproved=r.candidateSummary.vectorsWithin10Pct>r.baselineSummary.vectorsWithin10Pct&&r.candidateSummary.medianVectorErrorPct<r.baselineSummary.medianVectorErrorPct;
  return targetImproved&&aggregateImproved?'H2_SIGNAL_PRESENT_REQUIRES_GOVERNED_REVIEW_NOT_PRODUCTION_PROMOTION':'REJECT_H2_AS_MISSING_GLOBAL_MECHANISM';
}
function runCandidate(module,benchmarkPackage){try{return{actual:module.solveCaesarAccdbFrictionBenchmark(benchmarkPackage,['L13'],{profile:module.CAESAR_FRICTION_SOLVER_PROFILE}),error:null};}catch(error){return{actual:null,error:{message:error.message,code:error.code??null,iterationCount:error.iterations?.length??null,failedGates:error.iterations?.at(-1)?.failedGates??null,reactionUpdateTailN:(error.iterations??[]).slice(-8).map(x=>x.reactionUpdateNormN)}};}}

export function buildH2CandidateSource(productionSource,solverPath=resolve(SOLVER_PATH)){
  let source=buildRelockFinalReturnMapCandidateSource(String(productionSource),solverPath);
  source=replaceExactly(source,`  profileId: '${H1_PROFILE_ID}',`,`  profileId: '${H2_PROFILE_ID}',`,'H1 profile');
  source=replaceExactly(source,
`    const totalDirectionMagnitude = norm(tangentialDisplacement);
    const finalizingRelock = state === 'SLIDE' && nextState === 'STICK';
    const applyReturnMap = nextState === 'SLIDE' || finalizingRelock;
    const nextSlip = applyReturnMap && totalDirectionMagnitude > profile.zeroTangentialMotionFloorM
      ? tangentialDisplacement.map((value) =>
        value - (capacityN / stiffness) * value / totalDirectionMagnitude)
      : [...slip];`,
`    const totalDirectionMagnitude = norm(tangentialDisplacement);
    const finalizingRelock = state === 'SLIDE' && nextState === 'STICK';
    const applyReturnMap = nextState === 'SLIDE' || finalizingRelock;
    // H2 applies only after H1 has completed the SLIDE -> STICK transition.
    // Preserve the locked elastic trial magnitude, but orient that force opposite
    // current total displacement. The H1 transition return map always has priority.
    const relockedDirectionForce = state === 'STICK'
      && nextState === 'STICK'
      && norm(slip) > profile.zeroTangentialMotionFloorM
      && totalDirectionMagnitude > profile.zeroTangentialMotionFloorM
      && trialMagnitude > 0
      ? tangentialDisplacement.map((value) => -trialMagnitude * value / totalDirectionMagnitude)
      : null;
    const nextSlip = applyReturnMap && totalDirectionMagnitude > profile.zeroTangentialMotionFloorM
      ? tangentialDisplacement.map((value) =>
        value - (capacityN / stiffness) * value / totalDirectionMagnitude)
      : relockedDirectionForce !== null
        ? tangentialDisplacement.map((value, index) => value + relockedDirectionForce[index] / stiffness)
        : [...slip];`,
    'H1 slip rule');
  return source;
}

async function loadCandidate(solverPath){const source=buildH2CandidateSource(readFileSync(solverPath,'utf8'),solverPath);const sha256=createHash('sha256').update(source).digest('hex');const temp=resolve(tmpdir(),`m047-h2-${process.pid}-${Date.now()}.mjs`);writeFileSync(temp,source,'utf8');try{return{module:await import(`${pathToFileURL(temp).href}?h2=${Date.now()}`),sha256};}finally{try{unlinkSync(temp)}catch{}}}
function compare({benchmarkPackage,actual,h1}){const ref=vectorsByNode(benchmarkPackage.references.L13.rows);const solved=vectorsByNode(actual.cases.L13.rows);const base=new Map(h1.rows.map(r=>[r.nodeId,r]));const supports=actual.mechanics.cases.L13.iterations.at(-1).supports;return supports.map(s=>{const b=base.get(String(s.nodeId));const rv=ref.get(String(s.nodeId))??{},sv=solved.get(String(s.nodeId))??{};const rf=s.frictionDofs.map(d=>Number(rv[d]??0)),cf=s.frictionDofs.map(d=>Number(sv[d]??0));const m=norm(rf);return{nodeId:String(s.nodeId),restraintId:s.restraintId,frictionDofs:[...s.frictionDofs],baselineErrPct:b.candidateErrPct,candidateErrPct:m===0?null:100*norm(cf.map((x,i)=>x-rf[i]))/m,referenceTangentialN:rf,candidateTangentialN:cf,forceCosineToReference:cosine(cf,rf),candidateRegime:s.regime,referenceState:b.referenceState,candidateNormalErrPct:Math.abs(Number(rv[s.normalDof]??0))===0?null:100*(s.normalReactionMagnitudeN-Math.abs(Number(rv[s.normalDof]??0)))/Math.abs(Number(rv[s.normalDof]??0))};}).sort((a,b)=>(b.candidateErrPct??-Infinity)-(a.candidateErrPct??-Infinity));}
function summarize(rows){const c=rows.filter(r=>r.candidateErrPct!==null);return{vectorsWithin10Pct:c.filter(r=>r.candidateErrPct<=10).length,vectorsCompared:c.length,normalsWithin10Pct:rows.filter(r=>r.candidateNormalErrPct!==null&&Math.abs(r.candidateNormalErrPct)<=10).length,medianVectorErrorPct:median(c.map(r=>r.candidateErrPct)),worstVectorErrorPct:maximum(c.map(r=>r.candidateErrPct)),normalizedStateMatches:rows.filter(r=>(r.candidateRegime==='SLIDING'?'SLID':'STUCK')===r.referenceState).length};}
function validateH1(h1,diag){if(h1.schema!=='m047-bm4l-stage2-d1-relock-final-return-map-measurement/v1'||h1.status!=='H1_SIGNAL_PRESENT_REQUIRES_GOVERNED_REVIEW_NOT_PRODUCTION_PROMOTION')throw new TypeError('H2 requires committed H1 measurement.');if(h1.candidate?.vectorsWithin10Pct!==15||h1.candidate?.normalsWithin10Pct!==23)throw new TypeError('H2 H1 baseline mismatch.');if(diag.schema!=='m047-bm4l-stage2-h1-displacement-branch-diagnostic/v1'||diag.globalReferenceInvariant?.rowsWithReferenceForceCosineToReferenceDisplacementLeMinus0_999999!==22)throw new TypeError('H2 requires committed H1 displacement invariant.');}
function vectorsByNode(rows){const m=new Map();for(const r of rows){if(r.entityKind!=='NODE'||r.quantity!=='FORCE')continue;const v=m.get(String(r.entityId))??{};v[r.component]=Number(r.value);m.set(String(r.entityId),v);}return m;}
function replaceExactly(source,before,after,label){const i=source.indexOf(before);if(i<0)throw new TypeError(`H2 missing ${label}`);if(source.indexOf(before,i+before.length)>=0)throw new TypeError(`H2 ambiguous ${label}`);return source.slice(0,i)+after+source.slice(i+before.length);}
function norm(v){return Math.hypot(...v)} function cosine(a,b){const d=norm(a)*norm(b);return d===0?null:a.reduce((s,x,i)=>s+x*b[i],0)/d} function maximum(v){return v.length?Math.max(...v):0} function median(v){const a=[...v].filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const args=new Map();const av=process.argv.slice(2);for(let i=0;i<av.length;i+=2)args.set(av[i],av[i+1]);const accdbPath=args.get('--accdb');if(!accdbPath)throw new TypeError('Usage: --accdb <BM4_L.ACCDB> [--out <json>]');const r=await runH2Experiment({accdbPath});const out=args.get('--out');if(out){mkdirSync(dirname(resolve(out)),{recursive:true});writeFileSync(resolve(out),`${canonicalPrettyStringify(r)}\n`,'utf8')}process.stdout.write(`H2 decision ${r.decision}\nH1 vectors ${r.baselineSummary.vectorsWithin10Pct}/23\nH2 vectors ${r.candidateSummary?.vectorsWithin10Pct??'NA'}/23\n`);}
