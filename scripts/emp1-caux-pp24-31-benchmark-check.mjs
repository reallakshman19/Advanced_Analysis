import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requireDirectPdf = process.argv.includes('--require-direct-pdf');
const PDF_SHA = 'c1e92798a7bc172d649007ad88f6be548651f07a01cb2fbf83343e2283e0e83e';
const TRANSCRIPTION_BLOB = 'ce0ee91cd996feee162d4dd90ce1af4063e06775';
const BENCHMARK_HASH = '887b231028cd187c63d7cb29aedbc7db182b31d404623f9981f36a21987c2bf3';
const HANDCALC_HASH = '88b3ced854446b68329c46558ddd326ed607a2fc966e7201596f53518abc4b9c';
const QUALIFICATION_HASH = 'd621d81342795b082d8e6add7b938de3f897bb6dff9d320e153602a9c4a9f37e';
const CURRENT_QUALIFICATION_HASH =
  '9c57953aff802624650050c251d05b3ca8ea6a190bec77863f03ec790abc353f';

const benchmark = await readJson('validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-v1.json');
const handcalc = await readJson('validation/emp1/caux2017-wrc01f/caux-pp24-31-independent-handcalc-v1.json');
const qualification = await readJson('validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-qualification-v1.json');
const currentQualification = await readJson(
  'validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-qualification-v3.json',
);
const transcription = await readFile(resolve(root, benchmark.observation.retainedTranscriptionPath));

assert.equal(benchmark.source.rawPdfSha256, PDF_SHA);
assert.deepEqual(benchmark.source.pdfPages, [24,25,26,27,28,29,30,31]);
assert.equal(benchmark.source.expectedByteCount, 7260396);
assert.equal(benchmark.observation.directPdfReobservedThisPr, false);
assert.equal(benchmark.observation.directPdfObservationStatus, 'NOT_RUN_EXECUTION_ENVIRONMENT');
assert.equal(gitBlobSha1(transcription), TRANSCRIPTION_BLOB);
assert.equal(semanticHash(benchmark), BENCHMARK_HASH);
assert.equal(benchmark.freeze.expectedValuesFrozen, true);
assert.equal(benchmark.freeze.productionOutputObservedForExpectedValueSelection, false);
assert.equal(benchmark.freeze.productionOutputUsedToChooseDefinition, false);
assert.equal(benchmark.freeze.toleranceDerivedFromProduction, false);
assert.equal(benchmark.releaseProfileDisposition.state, 'OUTSIDE_BOUNDED_GAMMA5_ZERO_DP_RELEASE_PROFILE_REFERENCE_ONLY');
assert.equal(benchmark.releaseProfileDisposition.productionComparisonRequiredForGamma5Release, false);
assert.deepEqual(benchmark.authority, {
  wrcMethodAuthority: false,
  engineeringUseAuthorized: false,
  productionUseAuthorized: false,
  codeComplianceAuthorized: false,
  releaseAuthorityGranted: false,
});

for (const datum of benchmark.datums) {
  assert.match(datum.classification, /^(SOURCE_REPORTED|INDEPENDENT_DERIVED|UNRESOLVED)$/u);
  assert.equal(datum.document, 'CAUx 2017 - WRC01f.pdf');
  assert.equal(datum.rawPdfSha256, PDF_SHA);
  assert.ok(Number.isInteger(datum.pdfPage) && datum.pdfPage >= 24 && datum.pdfPage <= 31);
  assert.ok(datum.quantityId && datum.label);
  assert.equal(datum.retainedTranscription.gitBlobSha1, TRANSCRIPTION_BLOB);
  assert.equal(datum.retainedTranscription.directPdfReobservedThisPr, false);
}

assert.equal(handcalc.benchmark.semanticHash, BENCHMARK_HASH);
assert.equal(semanticHash(handcalc), HANDCALC_HASH);
assert.deepEqual(handcalc.independence.productionEvaluatorImports, []);
assert.equal(handcalc.independence.productionSrcCoreEmp1Imports, false);
assert.equal(handcalc.independence.productionOutputObserved, false);
assert.equal(handcalc.releaseProfileDisposition.productionComparisonRequired, false);
assert.equal(handcalc.status, 'PASS_INDEPENDENT_ARITHMETIC_REFERENCE_ONLY');

const g = handcalc.trace.geometry;
approx(g.Rm_recomputed_nominal_mm, (1844-22)/2, 1e-14, 'Rm');
approx(g.T_corroded_mm, 22-3, 1e-14, 'T');
approx(g.gamma_using_reported_Rm, 911/19, 1e-14, 'gamma/reported Rm');
approx(g.gamma_using_corroded_mean_radius, ((1844-19)/2)/19, 1e-14, 'gamma/corroded diagnostic');
assert.equal(g.gammaDisposition, 'UNRESOLVED_SOURCE_INTERNAL_BASIS_OR_TRANSCRIPTION_DISCREPANCY');

const expectedLoads = {
  SUS: [-161,-53,-2109,121,33,-775],
  EXP: [1085,4936,-1636,3933,3031,8657],
  OCC: [1162,107,-330,-1175,1486,-416],
};
for (const [name, expected] of Object.entries(expectedLoads)) {
  const row = handcalc.trace.loadReferenceAndAxisMapping.cases[name];
  const [fx,fy,fz] = row.globalForce_N;
  const [mx,my,mz] = row.globalMoment_Nm;
  assert.deepEqual([fx,-fz,fy,-my,-mz,-mx], expected);
  assert.deepEqual(row.calculatedWrcLoads, expected);
  assert.deepEqual(row.sourceReportedWrcLoads, expected);
  assert.equal(row.status, 'PASS_EXACT');
}

const s = handcalc.trace.curveEvaluationAndStressScales.selectedFormulaReproductions_kPa;
const Rm=911, T=19, r0=162, beta=0.155, P=161, Mc=121000, Ml=33000, Vc=53, Vl=2109, Mt=775000;
const formulas = {
  circMemP_AB: 7.273*P/(Rm*T)*1000,
  circBendP_AB: 0.046*6*P/(T*T)*1000,
  circMemMc: 1.935*Mc/(Rm*Rm*beta*T)*1000,
  circBendMc: 0.080*6*Mc/(Rm*beta*T*T)*1000,
  circMemMl: 5.217*Ml/(Rm*Rm*beta*T)*1000,
  circBendMl: 0.031*6*Ml/(Rm*beta*T*T)*1000,
  longMemP_AB: 5.343*P/(Rm*T)*1000,
  longBendP_AB: 0.082*6*P/(T*T)*1000,
  longMemMc: 3.318*Mc/(Rm*Rm*beta*T)*1000,
  longBendMc: 0.040*6*Mc/(Rm*beta*T*T)*1000,
  longMemMl: 1.861*Ml/(Rm*Rm*beta*T)*1000,
  longBendMl: 0.045*6*Ml/(Rm*beta*T*T)*1000,
  shearVc: Vc/(Math.PI*r0*T)*1000,
  shearVl: Vl/(Math.PI*r0*T)*1000,
  shearMt: Mt/(2*Math.PI*r0*r0*T)*1000,
};
for (const [key, expected] of Object.entries(formulas)) approx(s[key], expected, 1e-11, key);

for (const name of ['SUS','EXP','OCC']) {
  const row = handcalc.trace.stressIntensityReconstruction[name];
  const source = findSourceStressVectors(benchmark, name);
  const calculated = source.circ.map((v, i) => trescaPlaneStress(v, source.long[i], source.shear[i]));
  calculated.forEach((v, i) => approx(v, row.calculated_kPa[i], 1e-9, `${name}/${i}`));
}
const au = handcalc.trace.stressIntensityReconstruction.explicitAuSample;
approx(au.calculated_kPa, Math.sqrt((0-71)**2+4*253**2), 1e-12, 'Au sample');
assert.equal(au.nearestInteger, 511);
assert.equal(au.status, 'PASS_EXPLICIT_SOURCE_SAMPLE');

assert.equal(qualification.benchmark.semanticHash, BENCHMARK_HASH);
assert.equal(qualification.independentHandCalculation.semanticHash, HANDCALC_HASH);
assert.equal(semanticHash(qualification), QUALIFICATION_HASH);
assert.equal(qualification.freeze.expectedValuesFrozenBeforeProductionObservation, true);
assert.equal(qualification.freeze.productionOutputObservedForExpectedValueSelection, false);
assert.equal(qualification.releaseProfileDisposition.gamma5ProductionComparisonRequired, false);
assert.equal(qualification.releaseProfileDisposition.mayAuthorizeProduction, false);
assert.equal(qualification.source.directPdfPageReobservation, 'NOT_RUN_EXECUTION_ENVIRONMENT');
assert.match(qualification.status, /^BLOCKED_FINAL_CAUX_SOURCE_QUALIFICATION_/u);
assert.deepEqual(qualification.authority, {
  wrcMethodAuthority: false,
  engineeringUseAuthorized: false,
  productionUseAuthorized: false,
  codeComplianceAuthorized: false,
  releaseAuthorityGranted: false,
});

// Q1 is immutable historical freeze evidence. Current direct-source status is Q3.
assert.equal(semanticHash(currentQualification), CURRENT_QUALIFICATION_HASH);
assert.equal(currentQualification.benchmark.semanticHash, BENCHMARK_HASH);
assert.equal(currentQualification.independentHandCalculation.semanticHash, HANDCALC_HASH);
assert.equal(currentQualification.source.directPdfPageReobservation, 'PASS');
assert.equal(currentQualification.source.gammaRadiusBasisForThisBenchmark, 'PASS_RECONCILED');
assert.equal(
  currentQualification.status,
  'PASS_FINAL_CAUX_SOURCE_QUALIFICATION_GAMMA_RADIUS_RECONCILED_REFERENCE_FREEZE_PRESERVED',
);
assert.deepEqual(currentQualification.authority, qualification.authority);

console.log(JSON.stringify({
  schema: 'emp1-caux-pp24-31-benchmark-check/v1',
  status: 'PASS_CAUX_REFERENCE_FREEZE_OUTSIDE_GAMMA5_PROFILE_DIRECT_PDF_REOBSERVATION_PENDING',
  benchmarkSemanticHash: BENCHMARK_HASH,
  handCalculationSemanticHash: HANDCALC_HASH,
  historicalQualificationSemanticHash: QUALIFICATION_HASH,
  historicalDirectPdfPageReobservation: qualification.source.directPdfPageReobservation,
  currentQualificationSemanticHash: CURRENT_QUALIFICATION_HASH,
  currentQualificationId: currentQualification.qualificationId,
  directPdfPageReobservation: currentQualification.source.directPdfPageReobservation,
  gammaRadiusBasisForThisBenchmark:
    currentQualification.source.gammaRadiusBasisForThisBenchmark,
  expectedValuesFrozenBeforeProductionObservation: true,
  productionOutputObservedForExpectedValueSelection: false,
  releaseProfileDisposition: qualification.releaseProfileDisposition.state,
  productionAuthority: false,
  codeComplianceAuthority: false,
  requireDirectPdf,
}, null, 2));

if (requireDirectPdf && currentQualification.source.directPdfPageReobservation !== 'PASS') {
  process.exit(2);
}

function findSourceStressVectors(b, name) {
  const ids = name === 'SUS'
    ? ['P27_SUS_TOTAL_CIRC','P28_SUS_TOTAL_LONG','P28_SUS_TOTAL_SHEAR']
    : [`P29_${name}_TOTAL_CIRC`,`P29_${name}_TOTAL_LONG`,`P29_${name}_TOTAL_SHEAR`];
  const values = ids.map((id) => b.datums.find((d) => d.quantityId === id)?.value);
  values.forEach((v, i) => assert.ok(Array.isArray(v), `missing ${ids[i]}`));
  return { circ: values[0], long: values[1], shear: values[2] };
}
function trescaPlaneStress(sx, sy, tau) {
  const avg=(sx+sy)/2;
  const r=Math.sqrt(((sx-sy)/2)**2+tau**2);
  const p=[avg+r,avg-r,0];
  return Math.max(...p)-Math.min(...p);
}
function approx(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual-expected) <= tolerance, `${label}: ${actual} != ${expected}`);
}
function semanticHash(value) {
  const copy=structuredClone(value);
  delete copy.semanticHash;
  return createHash('sha256').update(stableJson(copy)).digest('hex');
}
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function gitBlobSha1(bytes) {
  const header=Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}
async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}
