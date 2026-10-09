#!/usr/bin/env node
/**
 * M047 Stage 2 R6 — fail-closed restraint sentinel preflight for BM4_L.
 *
 * INPUT_RESTRAINTS.STIFFNESS, GAP and CNODE are declared blank throughout BM4_L.
 * The portable ACCDB reader canonicalizes Access NULL to JavaScript null, so this
 * boundary deliberately accepts exactly null and nothing else. A future populated
 * value (including 0, a negative numeric sentinel or a string) stops Stage 2 before
 * assembly instead of being silently solved as the current grounded/no-gap/default-
 * stiffness model.
 *
 * This script is evidence/preflight only. It changes no solver mechanic, tolerance,
 * comparison rule or result row.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const PINNED_ACCDB_BYTES = 5_136_384;
const FIELDS = Object.freeze(['STIFFNESS', 'GAP', 'CNODE']);

export function inspectRestraintSentinels(input) {
  const columns = Array.isArray(input.columns) ? input.columns.map(String) : [];
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const missingColumns = FIELDS.filter((field) => !columns.includes(field));
  if (missingColumns.length > 0) {
    const error = new TypeError(`INPUT_RESTRAINTS is missing required R6 column(s): ${missingColumns.join(', ')}.`);
    error.code = 'CAESAR_ACCDB_RESTRAINT_SENTINEL_COLUMN_MISSING';
    error.evidence = { missingColumns, availableColumns: columns };
    throw error;
  }

  const fieldSummaries = Object.fromEntries(FIELDS.map((field) => {
    const nonblankRows = rows
      .map((row, index) => ({
        rowIndex: index,
        nodeId: row?.NODE_NUM === undefined || row?.NODE_NUM === null ? null : String(row.NODE_NUM),
        value: row?.[field],
      }))
      .filter((entry) => entry.value !== null);
    return [field, {
      field,
      rule: 'ACCESS_NULL_ONLY_V1',
      rowCount: rows.length,
      blankCount: rows.length - nonblankRows.length,
      nonblankCount: nonblankRows.length,
      nonblankRows,
      status: nonblankRows.length === 0 ? 'PASS' : 'FAIL',
    }];
  }));

  const failures = FIELDS.flatMap((field) => fieldSummaries[field].nonblankRows
    .map((entry) => ({ field, ...entry })));
  const result = {
    schema: 'm047-bm4l-stage2-r6-restraint-sentinel-preflight/v1',
    table: 'INPUT_RESTRAINTS',
    blankRule: 'PORTABLE_ACCDB_READER_CANONICAL_NULL_ONLY_V1',
    semantics: {
      STIFFNESS: 'BLANK_MEANS_USE_GOVERNED_DEFAULT_RESTRAINT_STIFFNESS',
      GAP: 'BLANK_MEANS_NO_DECLARED_GAP',
      CNODE: 'BLANK_MEANS_GROUNDED_RESTRAINT_NO_CONNECTING_NODE',
    },
    rowCount: rows.length,
    fields: fieldSummaries,
    failureCount: failures.length,
    failures,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    mechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };

  if (failures.length > 0) {
    const error = new Error(
      `R6 restraint sentinel preflight found ${failures.length} nonblank STIFFNESS/GAP/CNODE value(s); `
      + 'current BM4_L mechanics cannot be reused for this file.',
    );
    error.code = 'CAESAR_ACCDB_RESTRAINT_SENTINEL_NONBLANK';
    error.evidence = result;
    throw error;
  }
  return Object.freeze({ ...result, semanticHash: semanticHash(result) });
}

export async function runRestraintSentinelPreflight(input) {
  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const rawExport = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: requiredCaesarAccdbTables(profile),
    expectedSha256: PINNED_ACCDB_SHA256,
  });
  if (rawExport.source.byteLength !== PINNED_ACCDB_BYTES) {
    throw new TypeError(
      `BM4_L ACCDB byte length ${rawExport.source.byteLength} does not match pinned ${PINNED_ACCDB_BYTES}.`,
    );
  }
  const table = rawExport.tables.INPUT_RESTRAINTS;
  if (!table) throw new TypeError('R6 requires INPUT_RESTRAINTS from the real ACCDB.');
  const inspection = inspectRestraintSentinels(table);
  const { semanticHash: inspectionSemanticHash, ...inspectionRecord } = inspection;
  const complete = {
    ...inspectionRecord,
    inspectionSemanticHash,
    sourceAccdbSha256: rawExport.source.sha256,
    sourceAccdbByteLength: rawExport.source.byteLength,
    provider: rawExport.provider,
    custodyStatus: rawExport.source.sha256 === PINNED_ACCDB_SHA256
      && rawExport.source.postReadSha256 === PINNED_ACCDB_SHA256 ? 'PASS' : 'FAIL',
  };
  if (complete.custodyStatus !== 'PASS') {
    throw new Error('R6 custody status is not PASS after the pinned ACCDB read.');
  }
  return Object.freeze({ ...complete, semanticHash: semanticHash(complete) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const accdbPath = args.get('--accdb');
  if (!accdbPath) {
    throw new TypeError('Usage: --accdb <BM4_L.ACCDB> [--out <r6.json>]');
  }
  const record = await runRestraintSentinelPreflight({ accdbPath });
  const outPath = args.get('--out');
  if (outPath) {
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(resolve(outPath), `${canonicalPrettyStringify(record)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify({
    status: record.status,
    sourceAccdbSha256: record.sourceAccdbSha256,
    rowCount: record.rowCount,
    fields: Object.fromEntries(FIELDS.map((field) => [field, record.fields[field].status])),
    failureCount: record.failureCount,
    mechanicsChanged: record.mechanicsChanged,
  })}\n`);
}
