import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { createNonFeaEnrichmentSidecar } from '../src/core/non-fea-enrichment/index.js';
import { validateProjectDataProfile } from '../src/workspace/project-data/project-data-contract.js';

// Verify actual browser-exported INPUT artifacts, not solver execution or result export.
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const profile = read('relay/WORK/load-calc-run-readiness-v32-project-data.json');
const sidecar = read('relay/WORK/load-calc-run-readiness-v32-accepted-inputs.json');
const sourceHash = createHash('sha256').update(readFileSync('public/fixtures/Sjson.json')).digest('hex');
assert.equal(sourceHash, '1e75a288545b771d2292cf730ca19d943e40fa547244478038da65eb8e4fc39a');
assert.equal(profile.revision, 12);
assert.equal(semanticHash(profile), 'fnv1a64:c155f4fb720f96a0');
for (const [field, value] of [['lengthUnit', 'mm'], ['sourceUpAxis', 'Z']]) {
  const entry = profile.sourcesAndUnits[field];
  assert.equal(entry.value, value);
  assert.equal(entry.approved, true);
  assert.equal(entry.evidence.sourceHash, sourceHash);
  assert.match(entry.evidence.verification, /223 matching pairs, zero contradictions/u);
}
const audit = validateProjectDataProfile(profile, 'normalization', { dataset: sourceHash });
assert.equal(audit.valid, true, JSON.stringify(audit.errors));
const stale = structuredClone(profile);
stale.sourcesAndUnits.sourceUpAxis.evidence.sourceHash = '0'.repeat(64);
assert.ok(validateProjectDataProfile(stale, 'normalization', { dataset: sourceHash }).errors.some(row => row.code === 'STALE_SOURCE_HASH'));
const unapproved = structuredClone(profile);
unapproved.sourcesAndUnits.lengthUnit.approved = false;
assert.equal(validateProjectDataProfile(unapproved, 'normalization', { dataset: sourceHash }).valid, false);
assert.deepEqual(createNonFeaEnrichmentSidecar(sidecar), sidecar);
assert.equal(sidecar.sourceSemanticHash, 'fnv1a64:46ec305d089d59eb');
assert.equal(sidecar.records.length, 195);
const weights = sidecar.records.filter(row => row.fieldId === 'COMPONENT_WEIGHT');
assert.equal(weights.length, 23);
for (const row of weights) {
  assert(row.value > 0);
  assert.equal(row.unit, 'kg');
  assert.match(row.evidence.selectedTypeDesc, /^(Weldneck Flange|Flanged Gate Valve|Flanged Globe Valve)$/u);
}
const missingIds = ['51250', '51274', '51284', '51462', '51463', '51476', '51483', '51485'].map(id => '=1006649732/' + id);
for (const id of missingIds) assert(!weights.some(row => row.selectorKey === id), `${id}: unsupported weight must remain absent, not zero.`);
console.log(JSON.stringify({ status: 'PASS', scope: 'EXPORTED_INPUT_CUSTODY_ONLY',
  projectRevision: profile.revision, projectSemanticHash: semanticHash(profile),
  acceptedRecords: sidecar.records.length, reviewedCatalogueWeights: weights.length,
  unresolvedManualWeights: missingIds, sidecarSemanticHash: sidecar.semanticHash,
  gravityCalculated: false, resultExportCreated: false }, null, 2));
