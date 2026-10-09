#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEAD = git(['rev-parse', 'HEAD']);
const CLEAN_AT_START = git(['status', '--porcelain=v1', '--untracked-files=all']) === '';

const definitions = [
  ['B02', 'scripts/lafea-b02-production-sequence-check.mjs'],
  ['BM005', 'scripts/lafea.3-bm005-ordinary-route-check.mjs'],
  ['B01', 'scripts/lafea-b01-final-qualification.mjs'],
  ['BBAR', 'scripts/lafea-plane-strain-bbar-qualification-check.mjs'],
];

const constituents = definitions.map(([id, script]) => runConstituent(id, script));
const cleanAtEnd = git(['status', '--porcelain=v1', '--untracked-files=all']) === '';

const anyFail = constituents.some((row) => row.status === 'FAIL');
const anyBlocked = constituents.some((row) => ['BLOCKED', 'NOT_RUN'].includes(row.status));
const status = anyFail ? 'FAIL' : anyBlocked ? 'BLOCKED' : 'PASS';

const receipt = {
  schema: 'lafea3-c3d-production-route-qualification/v1',
  status,
  exactHead: HEAD,
  cleanTreeAtStart: CLEAN_AT_START,
  cleanTreeAtEnd: cleanAtEnd,
  constituents,
  b02CustodyComplete: constituents.find((row) => row.id === 'B02')?.receipt?.c3dCustodyComplete === true,
  releaseAuthorityGranted: false,
  temperatureAuthorityGranted: false,
  c3eAuthorityGranted: false,
  c3fAuditAuthorityGranted: false,
};

console.log(JSON.stringify(receipt, null, 2));
process.exit(status === 'PASS' && cleanAtEnd ? 0 : 1);

function runConstituent(id, script) {
  const child = spawnSync(process.execPath, [path.join(ROOT, script)], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const stdout = child.stdout ?? '';
  const stderr = child.stderr ?? '';
  const parsed = parseLastJson(stdout);
  let status = child.status === 0 ? 'PASS' : child.status === null ? 'NOT_RUN' : 'FAIL';
  const reasons = [];
  if (id === 'B02' && child.status === 0 && parsed?.c3dCustodyComplete !== true) {
    status = 'BLOCKED';
    reasons.push(...(parsed?.c3dCustodyBlockedBy ?? ['B02_C3D_CUSTODY_INCOMPLETE']));
  }
  if (parsed?.status === 'BLOCKED' && status !== 'FAIL') status = 'BLOCKED';
  if (parsed?.status === 'FAIL') status = 'FAIL';
  if (child.error) reasons.push(child.error.message);
  return Object.freeze({
    id,
    script,
    status,
    exitCode: child.status,
    signal: child.signal,
    reasons: Object.freeze(reasons),
    receipt: parsed,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  });
}

function parseLastJson(text) {
  const lines = String(text ?? '').trim().split(/\r?\n/u).filter(Boolean).reverse();
  for (const line of lines) {
    try { return JSON.parse(line); } catch { /* continue */ }
  }
  const source = String(text ?? '').trim();
  const starts = [...source.matchAll(/\{/gu)].map((match) => match.index).reverse();
  for (const start of starts) {
    try { return JSON.parse(source.slice(start)); } catch { /* continue */ }
  }
  return null;
}

function tail(text, limit = 4000) {
  const value = String(text ?? '');
  return value.length <= limit ? value : value.slice(-limit);
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
