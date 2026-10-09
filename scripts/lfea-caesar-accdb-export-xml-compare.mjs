#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = parseArguments(process.argv.slice(2));
const accdbPath = resolve(args.accdb);
const xmlCompareRoot = resolve(args.xmlCompareRoot);
const parserPath = resolve(xmlCompareRoot, 'parser/accdb-mdb.js');
const expectedReaderRoot = resolve(xmlCompareRoot, 'node_modules/mdb-reader');
const parserRequire = createRequire(pathToFileURL(parserPath));
let mdbReaderEntrypoint;
try {
  mdbReaderEntrypoint = parserRequire.resolve('mdb-reader');
} catch (error) {
  throw new Error(
    `The XML Compare parser cannot resolve the required local mdb-reader runtime from ${parserPath}: ${error.message}`,
    { cause: error },
  );
}
const relativeReaderEntrypoint = relative(expectedReaderRoot, mdbReaderEntrypoint);
if (relativeReaderEntrypoint.startsWith('..') || isAbsolute(relativeReaderEntrypoint)) {
  throw new Error(
    `XML Compare mdb-reader resolved outside the pinned local runtime: ${mdbReaderEntrypoint}.`,
  );
}
const readerPackagePath = resolve(expectedReaderRoot, 'package.json');
const readerPackage = JSON.parse(await readFile(readerPackagePath, 'utf8'));
if (String(readerPackage.name) !== 'mdb-reader' || String(readerPackage.version) !== args.mdbReaderVersion) {
  throw new Error(
    `Local mdb-reader identity mismatch: ${String(readerPackage.name)}@${String(readerPackage.version)} != mdb-reader@${args.mdbReaderVersion}.`,
  );
}
const readerRepository = typeof readerPackage.repository === 'string'
  ? readerPackage.repository
  : readerPackage.repository?.url;
if (!String(readerRepository ?? '').includes('github.com/andipaetzold/mdb-reader')) {
  throw new Error(`Unexpected mdb-reader repository identity: ${String(readerRepository)}.`);
}

const parserModule = await import(pathToFileURL(parserPath).href);
if (typeof parserModule.readAccdbNamedTables !== 'function') {
  throw new TypeError(`${parserPath} does not export readAccdbNamedTables().`);
}

const bytes = await readFile(accdbPath);
const file = await stat(accdbPath);
const log = [];
const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const extracted = await parserModule.readAccdbNamedTables(arrayBuffer, args.tables, log);
const missing = args.tables.filter((tableName) => !Object.prototype.hasOwnProperty.call(extracted, tableName));
if (missing.length > 0) {
  throw new Error(`XML Compare ACCDB reader did not return required tables: ${missing.join(', ')}. ${formatLog(log)}`);
}

const tables = Object.fromEntries(args.tables.map((tableName) => {
  const rows = normalizeRows(extracted[tableName], tableName);
  const columns = orderedColumns(rows);
  if (rows.length > 0 && columns.length === 0) {
    throw new Error(`XML Compare ACCDB reader returned rows without columns for ${tableName}.`);
  }
  return [tableName, { columns, rows }];
}));

const output = {
  schema: 'caesar-accdb-raw-export/v1',
  source: {
    path: accdbPath,
    fileName: basename(accdbPath),
    byteLength: file.size,
    lastWriteTimeUtc: file.mtime.toISOString(),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  },
  provider: 'XML_COMPARE_UTILITIES_MDB_READER_V1',
  extractor: {
    source: 'XML_Compare_Utilities/parser/accdb-mdb.js:readAccdbNamedTables',
    xmlCompareRoot,
    parserPath,
    runtimePolicy: 'LOCAL_MDB_READER_ONLY_NO_CDN_FALLBACK',
    mdbReaderPackagePath: readerPackagePath,
    mdbReaderEntrypoint,
    mdbReaderName: readerPackage.name,
    mdbReaderVersion: readerPackage.version,
    mdbReaderRepository: readerRepository,
    requestedTables: args.tables,
    log,
  },
  tables,
};
process.stdout.write(`${JSON.stringify(output)}\n`);

function normalizeRows(value, tableName) {
  if (!Array.isArray(value)) throw new TypeError(`${tableName} extraction result must be an array.`);
  return value.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new TypeError(`${tableName} row ${index + 1} must be an object.`);
    }
    return Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, normalizeCell(cell)]));
  });
}

function normalizeCell(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : value.toString();
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64');
  }
  if (value instanceof ArrayBuffer) return Buffer.from(value).toString('base64');
  return value;
}

function orderedColumns(rows) {
  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  return columns;
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new TypeError(`Invalid argument near ${String(key)}.`);
    if (values.has(key)) throw new TypeError(`Duplicate argument ${key}.`);
    values.set(key, value);
  }
  const accdb = values.get('--accdb');
  const tablesText = values.get('--tables');
  const xmlCompareRoot = values.get('--xml-compare-root');
  const mdbReaderVersion = values.get('--mdb-reader-version');
  if (!accdb || !tablesText || !xmlCompareRoot || !mdbReaderVersion) {
    throw new TypeError(
      'Usage: --accdb <file.accdb> --tables <A,B,C> --xml-compare-root <XML_Compare_Utilities checkout> --mdb-reader-version <version>.',
    );
  }
  const known = ['--accdb', '--tables', '--xml-compare-root', '--mdb-reader-version'];
  const unknown = [...values.keys()].filter((key) => !known.includes(key));
  if (unknown.length > 0) throw new TypeError(`Unknown arguments: ${unknown.join(', ')}.`);
  const tables = [...new Set(tablesText.split(',').map((entry) => entry.trim().toUpperCase()).filter(Boolean))].sort();
  if (tables.length === 0) throw new TypeError('--tables must contain at least one table name.');
  for (const tableName of tables) {
    if (!/^[A-Z0-9_]+$/u.test(tableName)) throw new TypeError(`Unsafe ACCDB table name ${tableName}.`);
  }
  return Object.freeze({ accdb, tables: Object.freeze(tables), xmlCompareRoot, mdbReaderVersion });
}

function formatLog(log) {
  return log.map((entry) => `[${entry.level ?? 'INFO'}] ${entry.msg ?? ''}`).join(' | ');
}
