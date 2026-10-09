#!/usr/bin/env node
/**
 * M047 Stage 2 R1 — CAESAR reference-resolution classification.
 *
 * This is a reporting-only gate. It does not change the solver, benchmark
 * tolerances, comparison rules, or acceptance criteria. It derives the governed
 * friction stiffness from the real ACCDB/configuration authority, converts the
 * declared CAESAR printed displacement resolution into an equivalent tangential
 * force floor, and labels each friction restraint so relative percentages are not
 * presented as precise where the reference itself is resolution-limited.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { resolveCaesarFrictionAuthority } from '../src/core/fea-benchmarks/caesar-friction-authority.js';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const DEFAULT_CASE_ID = 'L13';
const DEFAULT_PRINTED_DISPLACEMENT_RESOLUTION_MM = 0.001;
const RELATIVE_GOAL = 0.1;

export function classifyReferenceResolution(input) {
  const iteration = input.iteration;
  const frictionStiffnessNPerM = Number(input.frictionStiffnessNPerM);
  const printedResolutionMm = Number(input.printedResolutionMm);
  if (!iteration || !Array.isArray(iteration.restraints)) {
    throw new TypeError('R1 requires a converged friction tuning iteration with restraints.');
  }
  if (!iteration.converged) throw new TypeError('R1 cannot classify a non-converged friction iteration.');
  if (!(frictionStiffnessNPerM > 0)) throw new TypeError('R1 friction stiffness must be positive.');
  if (!(printedResolutionMm > 0)) throw new TypeError('R1 printed displacement resolution must be positive.');

  const halfResolutionM = printedResolutionMm * 1e-3 * 0.5;
  const forceResolutionFloorN = frictionStiffnessNPerM * halfResolutionM;
  const restraints = iteration.restraints.map((row) => {
    const referenceMagnitudeN = Number(row.tangential?.referenceMagnitudeN ?? 0);
    const vectorRelativeError = row.tangential?.vectorRelativeError ?? null;
    const classification = referenceMagnitudeN === 0
      ? 'EXACT_ZERO_REFERENCE'
      : referenceMagnitudeN < forceResolutionFloorN
        ? 'RESOLUTION_LIMITED'
        : 'COMPARABLE_RELATIVE';
    return {
      restraintId: row.restraintId,
      nodeId: row.nodeId,
      frictionDofs: row.frictionDofs,
      referenceTangentialMagnitudeN: referenceMagnitudeN,
      forceResolutionFloorN,
      classification,
      relativeComparisonEligible: classification === 'COMPARABLE_RELATIVE',
      vectorRelativeError,
      withinExistingRelativeGoal: classification === 'COMPARABLE_RELATIVE' && vectorRelativeError !== null
        ? vectorRelativeError <= RELATIVE_GOAL
        : null,
    };
  });
  const comparable = restraints.filter((row) => row.classification === 'COMPARABLE_RELATIVE');
  const resolutionLimited = restraints.filter((row) => row.classification === 'RESOLUTION_LIMITED');
  const exactZero = restraints.filter((row) => row.classification === 'EXACT_ZERO_REFERENCE');
  return {
    schema: 'm047-bm4l-stage2-reference-resolution/v1',
    rule: 'REPORT_REFERENCE_RESOLUTION_SCOPE_WITHOUT_CHANGING_TOLERANCES_OR_RESULT_ROWS',
    caseId: iteration.caseId,
    sourceAccdbSha256: iteration.sourceAccdbSha256,
    sourceIterationSemanticHash: iteration.iterationSemanticHash,
    referenceResolution: {
      printedDisplacementResolutionMm: printedResolutionMm,
      halfPrintedResolutionM: halfResolutionM,
      frictionStiffnessNPerM,
      forceResolutionFloorN,
      derivation: 'forceResolutionFloorN = frictionStiffnessNPerM * 0.5 * printedResolutionMm * 1e-3',
      source: 'ISSUE_1083_STAGE2_R1_DECLARED_CAESAR_PRINT_RESOLUTION',
    },
    existingRelativeGoal: RELATIVE_GOAL,
    summary: {
      frictionRestraintCount: restraints.length,
      comparableRelativeCount: comparable.length,
      resolutionLimitedCount: resolutionLimited.length,
      exactZeroReferenceCount: exactZero.length,
      comparableWithinExistingGoal: comparable.filter((row) => row.withinExistingRelativeGoal).length,
      comparisonPolicyChanged: false,
      toleranceChanged: false,
      resultRowsChanged: false,
    },
    restraints,
  };
}

export async function runReferenceResolutionFloor(input) {
  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const rawExport = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: requiredCaesarAccdbTables(profile),
  });
  const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({ rawExport, profile });
  const caseId = input.caseId ?? DEFAULT_CASE_ID;
  const frictionAuthority = resolveCaesarFrictionAuthority({
    authority: benchmarkPackage.profile.configurationAuthority,
    cases: benchmarkPackage.cases,
    caseId,
    inputUnitRows: benchmarkPackage.model.tables.INPUT_UNITS.rows,
  });
  const iteration = JSON.parse(readFileSync(resolve(input.iterationPath), 'utf8'));
  if (iteration.caseId !== caseId) {
    throw new TypeError(`R1 case mismatch: iteration is ${iteration.caseId}, requested ${caseId}.`);
  }
  if (iteration.sourceAccdbSha256 !== benchmarkPackage.source.sha256) {
    throw new TypeError(
      `R1 custody mismatch: iteration ${iteration.sourceAccdbSha256} != real ACCDB ${benchmarkPackage.source.sha256}.`,
    );
  }
  const record = classifyReferenceResolution({
    iteration,
    frictionStiffnessNPerM: frictionAuthority.frictionStiffness.siValue,
    printedResolutionMm: input.printedResolutionMm ?? DEFAULT_PRINTED_DISPLACEMENT_RESOLUTION_MM,
  });
  const complete = {
    ...record,
    frictionStiffnessAuthority: frictionAuthority.frictionStiffness,
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
    throw new TypeError(
      'Usage: --accdb <BM4_L.ACCDB> --iteration <L13-iteration.json> [--case L13] '
      + '[--printed-resolution-mm 0.001] [--out <json>]',
    );
  }
  const record = await runReferenceResolutionFloor({
    accdbPath,
    iterationPath,
    caseId: accepted.get('--case') ?? DEFAULT_CASE_ID,
    printedResolutionMm: accepted.has('--printed-resolution-mm')
      ? Number(accepted.get('--printed-resolution-mm'))
      : DEFAULT_PRINTED_DISPLACEMENT_RESOLUTION_MM,
  });
  const outPath = accepted.get('--out');
  if (outPath) {
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(resolve(outPath), `${canonicalPrettyStringify(record)}\n`, 'utf8');
  }
  process.stdout.write([
    `case                         ${record.caseId}`,
    `source ACCDB                 ${record.sourceAccdbSha256}`,
    `governed friction stiffness  ${record.referenceResolution.frictionStiffnessNPerM} N/m`,
    `printed displacement step    ${record.referenceResolution.printedDisplacementResolutionMm} mm`,
    `half-step force floor        ${record.referenceResolution.forceResolutionFloorN.toFixed(3)} N`,
    `comparable relative          ${record.summary.comparableRelativeCount}/${record.summary.frictionRestraintCount}`,
    `resolution limited           ${record.summary.resolutionLimitedCount}`,
    `exact zero reference         ${record.summary.exactZeroReferenceCount}`,
    `comparison policy changed    ${record.summary.comparisonPolicyChanged}`,
    `tolerance changed            ${record.summary.toleranceChanged}`,
    `result rows changed          ${record.summary.resultRowsChanged}`,
  ].join('\n') + '\n');
}
