#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  S5_BOURDON_REQUIRED_FAMILIES,
  S5_PRESSURE_PARITY_EVIDENCE_SCHEMA,
  S5_STIFFENING_REQUIRED_FAMILIES,
} from './lfea-s5-pressure-parity-evidence-contract.mjs';

const SCOPES = new Set([
  'BOURDON_ONLY',
  'PRESSURE_STIFFENING_ONLY',
  'BOURDON_AND_PRESSURE_STIFFENING',
]);
const Q2 = new Set([
  'Q2_BEND_BOURDON_NONE',
  'Q2_BEND_BOURDON_TRANSLATION',
  'Q2_BEND_BOURDON_TRANSLATION_ROTATION',
]);
const Q4 = new Set(['Q4_SELECTOR_NONE', 'Q4_SELECTOR_P1', 'Q4_SELECTOR_P2', 'Q4_SELECTOR_PMAX']);
const Q5 = new Set(['Q5_GLOBAL_DEFAULT_B313', 'Q5_GLOBAL_INCLUDE_B313', 'Q5_GLOBAL_EXCLUDE_B313']);

const scopeArg = process.argv[2];
const outputArg = process.argv[3];
if (scopeArg === '--help' || scopeArg === '-h') {
  console.log('Usage: node scripts/lfea-s5-pressure-parity-evidence-template.mjs <scope> <new-package-directory>');
  console.log('Scopes: BOURDON_ONLY | PRESSURE_STIFFENING_ONLY | BOURDON_AND_PRESSURE_STIFFENING');
  process.exit(0);
}
if (!SCOPES.has(scopeArg)) {
  console.error(`Invalid S5 qualification scope: ${scopeArg ?? ''}`);
  process.exit(2);
}
if (typeof outputArg !== 'string' || outputArg.trim() === '') {
  console.error('A new S5 evidence package directory is required.');
  process.exit(2);
}

const outputDir = path.resolve(process.cwd(), outputArg);
if (fs.existsSync(outputDir)) {
  console.error(`Refusing to overwrite existing path: ${outputDir}`);
  process.exit(2);
}
fs.mkdirSync(outputDir, { recursive: true });

function bourdonMode(family) {
  const values = new Map([
    ['Q1_STRAIGHT_BOURDON_NONE', 'NONE'],
    ['Q1_STRAIGHT_BOURDON_TRANSLATION', 'TRANSLATION_ONLY'],
    ['Q1_STRAIGHT_BOURDON_TRANSLATION_ROTATION', 'TRANSLATION_AND_ROTATION'],
    ['Q2_BEND_BOURDON_NONE', 'NONE'],
    ['Q2_BEND_BOURDON_TRANSLATION', 'TRANSLATION_ONLY'],
    ['Q2_BEND_BOURDON_TRANSLATION_ROTATION', 'TRANSLATION_AND_ROTATION'],
    ['Q6_PRESSURE_THRUST_NEGATIVE_CONTROL', 'TRANSLATION_ONLY'],
  ]);
  return values.get(family) ?? 'NONE';
}

function selector(family) {
  const values = new Map([
    ['Q4_SELECTOR_NONE', 'NONE'],
    ['Q4_SELECTOR_P1', 'P1'],
    ['Q4_SELECTOR_P2', 'P2'],
    ['Q4_SELECTOR_PMAX', 'PMAX'],
    ['Q5_GLOBAL_DEFAULT_B313', 'P1'],
    ['Q5_GLOBAL_INCLUDE_B313', 'P1'],
    ['Q5_GLOBAL_EXCLUDE_B313', 'P1'],
  ]);
  return values.get(family) ?? 'NONE';
}

function globalStiffeningMode(family) {
  const values = new Map([
    ['Q5_GLOBAL_DEFAULT_B313', 'DEFAULT'],
    ['Q5_GLOBAL_INCLUDE_B313', 'INCLUDE'],
    ['Q5_GLOBAL_EXCLUDE_B313', 'EXCLUDE'],
  ]);
  return values.get(family) ?? 'DEFAULT';
}

function runRecord(family) {
  const record = {
    runId: family,
    family,
    caesarVersion: 'REPLACE_WITH_CAESAR_VERSION',
    build: 'REPLACE_WITH_CAESAR_BUILD',
    jobFileHash: 'REPLACE_WITH_SHA256',
    inputSourceHash: 'REPLACE_WITH_SHA256',
    outputFileHash: 'REPLACE_WITH_SHA256',
    rawArtifacts: {
      jobFile: `raw/${family}/job-file.bin`,
      inputSource: `raw/${family}/input-source.bin`,
      outputFile: `raw/${family}/output-file.bin`,
    },
    activePipingCode: 'B31.3_2022',
    activateBourdonEffects: bourdonMode(family),
    usePressureStiffeningOnBends: globalStiffeningMode(family),
    elbowStiffeningPressureSelector: selector(family),
    pressureFields: Q4.has(family) ? { P1: null, P2: null } : { P1: null },
    material: { TODO: 'REPLACE_WITH_CONTROLLED_MATERIAL_STATE' },
    section: { TODO: 'REPLACE_WITH_CONTROLLED_SECTION_STATE' },
    restraints: { TODO: 'REPLACE_WITH_CONTROLLED_RESTRAINT_STATE' },
    mechanicalLoads: { TODO: 'REPLACE_WITH_CONTROLLED_MECHANICAL_LOAD_STATE' },
    reportedDisplacements: { TODO: null },
    reportedReactions: { TODO: null },
    reportLocator: `REPLACE_WITH_REPORT_LOCATOR_${family}`,
    artifactLocator: `REPLACE_WITH_ARTIFACT_LOCATOR_${family}`,
    observer: 'REPLACE_WITH_CAESAR_OPERATOR',
    observationDate: 'YYYY-MM-DD',
  };
  if (Q2.has(family) || Q4.has(family) || Q5.has(family)) {
    record.bendGeometry = { TODO: 'REPLACE_WITH_CONTROLLED_PHYSICAL_BEND_GEOMETRY' };
    record.reportedRotations = { TODO: null };
  }
  if (Q4.has(family) || Q5.has(family)) {
    record.reportedBendFactors = { k: null, ii: null, io: null };
  }
  if (family === 'Q6_PRESSURE_THRUST_NEGATIVE_CONTROL') {
    record.pressureThrustMechanics = {
      genericPressureThrustApplied: false,
      effectiveAreaForceApplied: false,
    };
  }
  return record;
}

const families = scopeArg === 'BOURDON_ONLY'
  ? [...S5_BOURDON_REQUIRED_FAMILIES]
  : scopeArg === 'PRESSURE_STIFFENING_ONLY'
    ? [...S5_STIFFENING_REQUIRED_FAMILIES]
    : [...S5_BOURDON_REQUIRED_FAMILIES, ...S5_STIFFENING_REQUIRED_FAMILIES];

const evidence = {
  _templateNotice: 'DRAFT SCAFFOLD ONLY. This file is intentionally not qualified evidence.',
  schema: S5_PRESSURE_PARITY_EVIDENCE_SCHEMA,
  protocolId: 'S5_Pressure_Effect_Parity_Protocol_20260824',
  evidenceClass: 'CONTROLLED_CAESAR_OBSERVATION',
  qualificationScope: scopeArg,
  tolerancePolicy: {
    observationTolerance: null,
    source: 'PREDECLARE_BEFORE_VIEWING_CAESAR_RESULTS',
    fittedToCaesar: false,
  },
  productionAuthorizationRequested: false,
  pressureBourdonRequested: false,
  pressureStiffeningRequested: false,
  pressureAxialThrustRequested: false,
  expectedValuesRebaselined: false,
  tolerancesWidenedToFitCaesar: false,
  runs: families.map(runRecord),
  independentReview: {
    status: 'PENDING',
    reviewer: 'REPLACE_WITH_INDEPENDENT_REVIEWER',
    reviewDate: 'YYYY-MM-DD',
    reviewLocator: 'REPLACE_WITH_REVIEW_LOCATOR',
  },
  status: 'DRAFT_NOT_QUALIFIED',
};

if (scopeArg !== 'PRESSURE_STIFFENING_ONLY') {
  evidence.bourdonComparisons = {
    straightTranslationVsTranslationRotationError: null,
    straightLfeaClosedEndStrainError: null,
    bendTranslationOnlyError: null,
    bendTranslationRotationError: null,
    pressureThrustForceAdded: false,
  };
  evidence.subdivisionEvidence = {
    chordCounts: [4, 6, 8],
    samePhysicalInitialBasis: false,
    terminalFreeStateNormalizedDelta: null,
  };
}
if (scopeArg !== 'BOURDON_ONLY') {
  evidence.stiffeningComparisons = {
    p1SelectedPressureError: null,
    p2SelectedPressureError: null,
    pmaxSelectedPressureError: null,
    p1P2ResponseDistinct: false,
    factorAppliedExactlyOnce: false,
    curvedCenterlineRetained: false,
    defaultMatchesActiveCodeMethod: false,
    includeOverrideObserved: false,
    excludeOverrideObserved: false,
  };
}

for (const run of evidence.runs) {
  for (const relative of Object.values(run.rawArtifacts)) {
    fs.mkdirSync(path.dirname(path.join(outputDir, relative)), { recursive: true });
  }
}
fs.writeFileSync(path.join(outputDir, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  path.join(outputDir, 'README.txt'),
  [
    `S5 pressure parity evidence scaffold: ${scopeArg}.`,
    'This package is intentionally DRAFT_NOT_QUALIFIED.',
    'Replace every placeholder from controlled CAESAR observations.',
    'Retain actual raw job/input/output files at the paths declared in evidence.json.',
    'Predeclare the tolerance before viewing CAESAR results.',
    'Q5 uses a fixed controlled P1 selector across Default/Include/Exclude so the global setting is discriminating.',
    'Controlled Q5 P1 is not authority for BM4_NL L19/L20; their selector remains unresolved.',
    'Run the file-level checker only after the package is complete.',
    '',
  ].join('\n'),
  'utf8',
);

console.log(JSON.stringify({
  status: 'DRAFT_EVIDENCE_SCAFFOLD_CREATED',
  qualificationScope: scopeArg,
  outputDir,
  evidencePath: path.join(outputDir, 'evidence.json'),
  runCount: evidence.runs.length,
  productionUseAuthorized: false,
  pressureBourdonAuthorized: false,
  pressureStiffeningAuthorized: false,
  pressureAxialThrustAuthorized: false,
}));
