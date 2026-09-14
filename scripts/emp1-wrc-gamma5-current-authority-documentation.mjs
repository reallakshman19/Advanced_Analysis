#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DOC_PATH = 'docs/emp1/EMP1_PROFESSIONAL_RELEASE_CURRENT_STATE.md';
const LEDGER_PATH = 'validation/emp1/wrc537-2013/gamma5-authority-identity-reconciliation-v1.json';
const ORACLE_PATH = 'validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json';
const QUALIFICATION_PATH = 'validation/emp1/wrc537-2013/gamma5-zero-dp-route-qualification-v2.json';
const AUTHORIZATION_PATH = 'validation/emp1/wrc537-2013/gamma5-zero-dp-route-authorization-v1.json';
const RELEASE_PROFILE_PATH = 'validation/emp1/release/emp1-wrc537-gamma5-bounded-release-profile-v1.json';

const args = process.argv.slice(2);
const write = args.includes('--write');
const unknown = args.filter((value) => value !== '--write');
if (unknown.length) throw gateError(`EMP1_CURRENT_AUTHORITY_DOC_UNKNOWN_ARGUMENT:${unknown[0]}`);

const [ledger, oracle, qualification, authorization, releaseProfile] = await Promise.all([
  readJson(LEDGER_PATH),
  readJson(ORACLE_PATH),
  readJson(QUALIFICATION_PATH),
  readJson(AUTHORIZATION_PATH),
  readJson(RELEASE_PROFILE_PATH),
]);

const current = ledger.currentAuthorityIdentity;
const scope = ledger.protectedScope;
assert.equal(ledger.issue, 1762);
assert.equal(ledger.currentSplitBrain, false);
assert.equal(oracle.semanticHash, current.postAuthorityOracleSemanticHash);
assert.equal(qualification.qualificationRecordSha256, current.qualificationRecordSha256);
assert.equal(authorization.authorizedIdentity.qualificationRecordSha256, current.qualificationRecordSha256);
assert.equal(authorization.authorizedIdentity.postAuthorityOracleSemanticHash, current.postAuthorityOracleSemanticHash);
assert.equal(authorization.authorizedIdentity.sourceDocumentSha256, ledger.sourceCustody.wrc537_2013.sha256);
assert.equal(authorization.authorizedIdentity.datasetHash, ledger.boundedDatasetHash);
assert.equal(authorization.authorizationRecordSemanticHash, current.authorizationRecordSemanticHash);
assert.equal(authorization.authorizedScope.routeId, 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP');
assert.equal(authorization.authorityBoundary.boundedEngineeringUseAuthorized, true);
assert.equal(authorization.authorityBoundary.globalEmp1CRouteAuthority, false);
assert.equal(authorization.authorityBoundary.codeComplianceAuthorized, false);
assert.equal(authorization.authorityBoundary.releaseQualified, false);
assert.equal(releaseProfile.method.sourceSha256, ledger.sourceCustody.wrc537_2013.sha256);
assert.equal(releaseProfile.method.datasetHash, ledger.boundedDatasetHash);
assert.equal(releaseProfile.benchmark.physicalOracleHash, current.postAuthorityOracleSemanticHash);
assert.equal(releaseProfile.releaseAuthority.globalEmp1CRouteAuthority, false);
assert.equal(releaseProfile.releaseAuthority.releaseQualified, false);

const markdown = render({ ledger, authorization, releaseProfile });
if (write) {
  await writeFile(resolve(root, DOC_PATH), markdown, 'utf8');
} else {
  const retained = await readFile(resolve(root, DOC_PATH), 'utf8');
  assert.equal(retained, markdown, 'EMP1_CURRENT_AUTHORITY_DOCUMENTATION_DRIFT');
}

console.log(JSON.stringify({
  schema: 'emp1-wrc537-gamma5-current-authority-documentation/v1',
  status: write
    ? 'WROTE_GENERATED_CURRENT_AUTHORITY_DOCUMENTATION'
    : 'PASS_GENERATED_CURRENT_AUTHORITY_DOCUMENTATION_MATCHES_REPOSITORY_AUTHORITY',
  path: DOC_PATH,
  sha256: createHash('sha256').update(markdown, 'utf8').digest('hex'),
  sourceSha256: ledger.sourceCustody.wrc537_2013.sha256,
  datasetHash: ledger.boundedDatasetHash,
  qualificationRecordSha256: current.qualificationRecordSha256,
  oracleSemanticHash: current.postAuthorityOracleSemanticHash,
  authorizationRecordSemanticHash: current.authorizationRecordSemanticHash,
  authorityCreatedByThisProjection: false,
  standardNumericalQualification: authorization.standardEvidenceContract.numericalQualification,
  globalEmp1CRouteAuthority: false,
  codeComplianceAuthorized: false,
  releaseQualified: false,
}, null, 2));

function render({ ledger, authorization, releaseProfile }) {
  const current = ledger.currentAuthorityIdentity;
  const scope = ledger.protectedScope;
  return [
    '# EMP.1 WRC 537 bounded route — generated current authority state',
    '',
    '> GENERATED FILE. Do not hand-edit authority constants here. Regenerate or verify with `node scripts/emp1-wrc-gamma5-current-authority-documentation.mjs --write` / `node scripts/emp1-wrc-gamma5-current-authority-documentation.mjs`.',
    '',
    '## Authority basis',
    '',
    `- Architecture issue: #${ledger.issue} (parent #${ledger.parentIssue}).`,
    `- Reconciliation ledger: \`${LEDGER_PATH}\`.`,
    `- Observed main basis: \`${ledger.observedMainSha}\` (tree \`${ledger.observedMainTreeSha}\`).`,
    `- Reconciliation state: \`${ledger.status}\`.`,
    '- This projection creates no source, method, numerical, code-compliance, release, or deployment authority.',
    '',
    '## Current bounded authority chain',
    '',
    '```text',
    `WRC 537 (2013) source SHA-256 = ${ledger.sourceCustody.wrc537_2013.sha256}`,
    `bounded dataset hash          = ${ledger.boundedDatasetHash}`,
    `qualification record SHA-256  = ${current.qualificationRecordSha256}`,
    `post-authority oracle hash    = ${current.postAuthorityOracleSemanticHash}`,
    `authorization record hash     = ${current.authorizationRecordSemanticHash}`,
    `release-profile reference     = ${releaseProfile.releaseProfileId}`,
    '```',
    '',
    `The authorization mode is \`${current.authorizationMode}\`. Historical and superseded identities remain traceable in the reconciliation ledger by explicit role; they are not current-authority constants in this document.`,
    '',
    '## Oracle-refreeze disposition',
    '',
    `The drift classification is \`${ledger.a3Disposition.requiredClassification}\`. ${ledger.a3Disposition.reason}`,
    '',
    'The repair restores the already-authorized frozen oracle/qualification chain and separates runtime numerical re-observation from oracle authorship. It does **not** authorize a new canonicalization policy, new expected numerical values, or a tolerance change.',
    '',
    '## Protected bounded route',
    '',
    '```text',
    `method                     = ${scope.method}`,
    `shell family               = ${scope.shellFamily}`,
    `attachment shape           = ${scope.attachmentShape}`,
    `variant                    = ${scope.variant}`,
    `gamma                      = ${scope.gamma}`,
    `beta                       = ${scope.betaMinimum} .. ${scope.betaMaximum} inclusive`,
    `differential pressure      = ${scope.differentialPressure}`,
    `Kn / Kb                    = ${scope.Kn} / ${scope.Kb}`,
    `evaluated locations        = ${scope.locations.join(', ')}`,
    `host-shell only            = ${scope.hostShellOnly}`,
    `continuous/global maximum  = ${scope.continuousGlobalMaximumClaim}`,
    '```',
    '',
    'No nonzero-Δp, non-unity-SCF, off-axis/global-extrema, gamma≠5, beta-out-of-range, interpolation, spherical, non-round, WRC 297, nozzle-wall, code-pass, or professional-release authority is created by this reconciliation.',
    '',
    '## Current runtime and release boundary',
    '',
    '```text',
    `bounded production route authorized = ${authorization.authorityBoundary.boundedProductionRouteAuthorized}`,
    `bounded engineering use authorized  = ${authorization.authorityBoundary.boundedEngineeringUseAuthorized}`,
    `global EMP.1.C authority             = ${authorization.authorityBoundary.globalEmp1CRouteAuthority}`,
    `code compliance authorized           = ${authorization.authorityBoundary.codeComplianceAuthorized}`,
    `release qualified                     = ${authorization.authorityBoundary.releaseQualified}`,
    '```',
    '',
    'The frozen bounded release profile remains definition-only and non-authorizing. Bounded route authorization does not back-propagate into global EMP.1.C, code compliance, or professional-release authority.',
    '',
    '## Standard exact-head evidence status',
    '',
    '```text',
    `01-10 pre-authorization evidence = ${authorization.standardEvidenceContract.files01Through10}`,
    `numerical qualification          = ${authorization.standardEvidenceContract.numericalQualification}`,
    `11-12 post-promotion evidence    = ${authorization.postPromotionQualification.completed ? 'GENERATED' : 'NOT_GENERATED'}`,
    `post-promotion execution         = ${authorization.postPromotionQualification.currentExecutionState}`,
    'engineering PASS claimed         = false',
    '```',
    '',
    'Current-head re-observation, replay, falsifiers, authority-currentness checks, and stale-hash guards are control/evidence checks. They do not retroactively create the missing historical 01-12 standard qualification; that obligation remains with #1768.',
    '',
    '## Fail-closed currentness',
    '',
    'The reconciliation checker reuses the existing EMP.1 workbench route-authority snapshot/currentness mechanism. A retained C result created under an older qualification or oracle identity becomes `STALE_AUTHORITY`, is non-reportable as current, preserves its execution authority hash for audit, exposes the current authority hash separately, and requires rerun. Repository-wide stale-identity scanning distinguishes active authority from explicit historical/superseded roles.',
    '',
    'Primary-source semantics needed for professional closure remain owned by #1765; independent benchmark evidence remains owned by #1772; professional product/release closure remains owned by #1775. This generated document is an authority/custody projection only.',
    '',
  ].join('\n');
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}
function gateError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}
