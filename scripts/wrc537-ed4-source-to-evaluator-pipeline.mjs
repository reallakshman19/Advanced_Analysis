import fs from 'node:fs';
import path from 'node:path';
import {
  WRC537_ED4_PACKAGE_READY,
  evaluateWrc537Ed4SourcePackage,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-source-package.js';
import {
  WRC537_ED4_PROMOTION_SCHEMA,
  createWrc537Ed4EngineeringDatasetCandidate,
  validateWrc537Ed4EngineeringDatasetCandidate,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-engineering-dataset.js';
import { validateWrc537Ed4CalculationPlan } from '../src/core/local-attachment-correlation/methods/wrc537/ed4-numerical-adapter.js';
import { validateWrc537Ed4ExecutablePlan } from '../src/core/local-attachment-correlation/methods/wrc537/ed4-execution-engine.js';
import {
  WRC537_ED4_NUMERICAL_QUALIFICATION_PASS,
  runWrc537Ed4NumericalQualification,
  validateWrc537Ed4NumericalQualificationSuite,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-qualification-engine.js';
import {
  createWrc537Ed4NumericalReleaseCandidate,
  executableLiteralInventory,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-numerical-release-candidate.js';

const root = process.cwd();
const ed4 = path.join(root, 'docs', 'wrc537', 'ed4');
const paths = {
  sourcePackage: path.join(ed4, 'WRC537_ED4_SOURCE_PACKAGE.json'),
  sourceLedger: path.join(ed4, 'WRC537_ED4_SOURCE_LEDGER.csv'),
  coefficients: path.join(ed4, 'WRC537_ED4_COEFFICIENTS.csv'),
  dataset: path.join(ed4, 'WRC537_ED4_ENGINEERING_DATASET.json'),
  calculationPlan: path.join(ed4, 'WRC537_ED4_CALCULATION_PLAN.json'),
  executablePlan: path.join(ed4, 'WRC537_ED4_EXECUTABLE_PLAN.json'),
  qualificationSuite: path.join(ed4, 'WRC537_ED4_QUALIFICATION_SUITE.json'),
  qualificationEvidence: path.join(ed4, 'WRC537_ED4_QUALIFICATION_EVIDENCE.json'),
  benchmarkBindings: path.join(ed4, 'WRC537_ED4_BENCHMARK_BINDINGS.json'),
  literalBindings: path.join(ed4, 'WRC537_ED4_LITERAL_BINDINGS.json'),
  numericalReleaseCandidate: path.join(ed4, 'WRC537_ED4_NUMERICAL_RELEASE_CANDIDATE.json'),
};
const write = process.argv.includes('--write');
const release = process.argv.includes('--release');

const sourcePackage = readJson(paths.sourcePackage);
const sourceLedgerRows = parseCsv(fs.readFileSync(paths.sourceLedger, 'utf8'));
const coefficientRows = parseCsv(fs.readFileSync(paths.coefficients, 'utf8'));
const readiness = evaluateWrc537Ed4SourcePackage({ sourcePackage, sourceLedgerRows, coefficientRows });
if (readiness.state !== WRC537_ED4_PACKAGE_READY) {
  finish('SOURCE_PACKAGE_BLOCKED', {
    failedGateIds: readiness.failedGateIds,
    sourceLedgerRows: sourceLedgerRows.length,
    coefficientRows: coefficientRows.length,
  }, release ? 2 : 0);
}

let dataset;
if (fs.existsSync(paths.dataset)) {
  dataset = validateWrc537Ed4EngineeringDatasetCandidate(readJson(paths.dataset));
} else {
  dataset = createWrc537Ed4EngineeringDatasetCandidate({
    sourcePackage,
    sourceLedgerRows,
    coefficientRows,
    promotion: {
      schema: WRC537_ED4_PROMOTION_SCHEMA,
      candidateIdentity: 'WRC537-ED4-ENGINEERING-DATASET',
      candidateVersion: '1',
      preparedBy: 'wrc537-ed4-source-to-evaluator-pipeline',
      preparationReference: 'SOURCE_PACKAGE_READY_PROMOTION',
    },
  });
  if (write) writeJson(paths.dataset, dataset);
}

if (!fs.existsSync(paths.calculationPlan)) {
  finish('SOURCE_BOUND_CALCULATION_PLAN_REQUIRED', {
    datasetSemanticHash: dataset.datasetSemanticHash,
    requiredPath: relative(paths.calculationPlan),
    instruction: 'Create by engineering review from authorized Edition 4 datum-level source rows; do not infer from PR1203 or synthetic formulas.',
  }, release ? 3 : 0);
}
const calculationPlan = validateWrc537Ed4CalculationPlan(dataset, readJson(paths.calculationPlan));

if (!fs.existsSync(paths.executablePlan)) {
  finish('EXECUTABLE_PLAN_REQUIRED', {
    datasetSemanticHash: dataset.datasetSemanticHash,
    planSemanticHash: calculationPlan.planSemanticHash,
    requiredPath: relative(paths.executablePlan),
    instruction: 'Compile reviewed source equations into the audited declarative operator graph; no eval/string execution.',
  }, release ? 4 : 0);
}
const executablePlan = validateWrc537Ed4ExecutablePlan(dataset, calculationPlan, readJson(paths.executablePlan));

if (!fs.existsSync(paths.qualificationSuite)) {
  finish('QUALIFICATION_SUITE_REQUIRED', {
    executablePlanSemanticHash: executablePlan.executablePlanSemanticHash,
    requiredPath: relative(paths.qualificationSuite),
    instruction: 'Retain source/independent benchmarks with expected value for every execution step and recovery result.',
  }, release ? 5 : 0);
}
const suite = validateWrc537Ed4NumericalQualificationSuite(
  dataset, calculationPlan, executablePlan, readJson(paths.qualificationSuite),
);
const evidence = runWrc537Ed4NumericalQualification(dataset, calculationPlan, executablePlan, suite);
if (write) writeJson(paths.qualificationEvidence, evidence);

if (evidence.status !== WRC537_ED4_NUMERICAL_QUALIFICATION_PASS) {
  finish('NUMERICAL_QUALIFICATION_FAILED', {
    evidenceSemanticHash: evidence.evidenceSemanticHash,
    failingCases: evidence.cases.filter((row) => row.status !== WRC537_ED4_NUMERICAL_QUALIFICATION_PASS)
      .map((row) => row.caseId),
  }, release ? 6 : 0);
}

if (!fs.existsSync(paths.benchmarkBindings)) {
  finish('SOURCE_BENCHMARK_CUSTODY_REQUIRED', {
    benchmarkCount: dataset.sourcePackage.benchmarks.length,
    sourceBenchmarkCaseIds: dataset.sourcePackage.benchmarks.map((row) => row.caseId),
    requiredPath: relative(paths.benchmarkBindings),
    instruction: 'Bind each retained source benchmark to a qualification case, exact request inputs, and exact recovery outputs. Arbitrary self-consistent qualification data cannot become a numerical release candidate.',
  }, release ? 7 : 0);
}
const benchmarkBindingFile = readJson(paths.benchmarkBindings);
if (!benchmarkBindingFile || !Array.isArray(benchmarkBindingFile.benchmarkBindings)) {
  throw new Error('WRC537_ED4_BENCHMARK_BINDINGS_FILE_INVALID');
}

const literalInventory = executableLiteralInventory(executablePlan);
if (!fs.existsSync(paths.literalBindings)) {
  finish('NUMERIC_LITERAL_CUSTODY_REQUIRED', {
    literalCount: literalInventory.length,
    literalInventory,
    requiredPath: relative(paths.literalBindings),
    instruction: 'Bind every executable numeric literal as DATASET_COEFFICIENT or SOURCE_LITERAL. No unbound magic numbers.',
  }, release ? 8 : 0);
}
const literalBindingFile = readJson(paths.literalBindings);
if (!literalBindingFile || !Array.isArray(literalBindingFile.literalBindings)) {
  throw new Error('WRC537_ED4_LITERAL_BINDINGS_FILE_INVALID');
}
const releaseCandidate = createWrc537Ed4NumericalReleaseCandidate(
  dataset,
  calculationPlan,
  executablePlan,
  suite,
  evidence,
  {
    schema: 'wrc537-ed4-numerical-release-candidate/v1',
    candidateIdentity: literalBindingFile.candidateIdentity ?? 'WRC537-ED4-NUMERICAL-RELEASE-CANDIDATE',
    candidateVersion: literalBindingFile.candidateVersion ?? '1',
    benchmarkBindings: benchmarkBindingFile.benchmarkBindings,
    literalBindings: literalBindingFile.literalBindings,
  },
);
if (write) writeJson(paths.numericalReleaseCandidate, releaseCandidate);

finish('NUMERICAL_RELEASE_CANDIDATE_AWAITING_APPROVAL_AND_TRUST', {
  datasetSemanticHash: dataset.datasetSemanticHash,
  planSemanticHash: calculationPlan.planSemanticHash,
  executablePlanSemanticHash: executablePlan.executablePlanSemanticHash,
  suiteSemanticHash: suite.suiteSemanticHash,
  evidenceSemanticHash: evidence.evidenceSemanticHash,
  numericalReleaseCandidateSemanticHash: releaseCandidate.candidateSemanticHash,
  sourceBenchmarkBindingCount: releaseCandidate.benchmarkBindings.length,
  literalCount: releaseCandidate.literalInventory.length,
  engineeringUseAuthorized: false,
  nextGate: 'Independent approval authority + trusted engineering registry activation; this pipeline cannot grant engineering authority.',
}, release ? 9 : 0);

function finish(state, detail, exitCode) {
  console.log(JSON.stringify({
    schema: 'wrc537-ed4-source-to-evaluator-pipeline-report/v1',
    state,
    writeRequested: write,
    releaseRequested: release,
    detail,
  }, null, 2));
  process.exit(exitCode);
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function relative(file) { return path.relative(root, file).replaceAll('\\', '/'); }

function parseCsv(text) {
  const rows = parseCsvRows(text.replace(/^\uFEFF/u, ''));
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter((row) => row.some((value) => value !== '')).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/u, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('WRC537_ED4_CSV_UNTERMINATED_QUOTE');
  if (field !== '' || row.length) { row.push(field.replace(/\r$/u, '')); rows.push(row); }
  return rows;
}
