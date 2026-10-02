#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const project = fs.readFileSync('src/workspace/project-data/project-data-store.js', 'utf8');
const model = fs.readFileSync('src/workspace/engineering-model-store.js', 'utf8');

function section(source, start, end) {
  const i = source.indexOf(start);
  assert.notEqual(i, -1, `Missing ${start}`);
  const j = source.indexOf(end, i + start.length);
  assert.notEqual(j, -1, `Missing ${end}`);
  return source.slice(i, j);
}

const getHash = section(project, '  getSemanticHash() {', '  getRuntimeRevision() {');
const publish = section(project, '  #publish(reason) {', '  #computeProfileSemanticHash(profile) {');
const bindings = section(model, '  #currentEmpiricalBindings(masterData) {', '  #empiricalBindingBasisKey(masterSourceHashes) {');
const basis = section(model, '  #empiricalBindingBasisKey(masterSourceHashes) {', '  #artifactSemanticHash(artifact) {');
const artifact = section(model, '  #artifactSemanticHash(artifact) {', '  #currentMechanicalReadiness() {');
const rebuild = section(model, '  rebuild(dataset) {', '  /** @deprecated Ordinary production callers');

assert.match(getHash, /return this\.#profileSemanticHash;/u);
assert.doesNotMatch(getHash, /semanticHash\(/u);
assert.match(publish, /profileSemanticHash: this\.#profileSemanticHash/u);
assert.doesNotMatch(publish, /semanticHash\(/u);
console.log('PASS P01 Project Data hash reads are cached.');

for (const token of [
  'sharedModelSemanticHash: this.#artifactHashes.sharedModelSemanticHash',
  'supportSiteModelSemanticHash: this.#artifactHashes.supportSiteModelSemanticHash',
  'routePartitionModelSemanticHash: this.#artifactHashes.routePartitionModelSemanticHash',
  'projectDataProfileSemanticHash: projectDataStore.getSemanticHash()',
  'masterSourceHashes,',
]) assert.ok(bindings.includes(token), `Missing binding token ${token}`);
for (const pattern of [
  /semanticHash\(this\.#dataset\.sharedModel\)/u,
  /semanticHash\(this\.#supportSiteModel\)/u,
  /semanticHash\(this\.#routePartitionModel\)/u,
  /semanticHash\(profile\)/u,
]) assert.doesNotMatch(bindings, pattern);
console.log('PASS P02 binding identity fields no longer rehash on refresh.');

for (const pattern of [
  /this\.#modelRuntimeRevision/u,
  /projectDataStore\.getRuntimeRevision/u,
  /masterSourceHashes\.dataset/u,
  /masterSourceHashes\.lineList/u,
  /masterSourceHashes\.pipingClass/u,
  /masterSourceHashes\.componentWeight/u,
]) assert.match(basis, pattern);
assert.doesNotMatch(basis, /materialMap/u);
console.log('PASS P03 currentness basis is dependency-directed.');

assert.match(artifact, /this\.#artifactHashCache\.get\(artifact\)/u);
assert.match(artifact, /semanticHash\(artifact\)/u);
assert.match(artifact, /this\.#artifactHashCache\.set\(artifact, hash\)/u);
for (const token of ['sharedModelSemanticHash:', 'supportSiteModelSemanticHash:', 'routePartitionModelSemanticHash:']) {
  assert.ok(rebuild.includes(token), `Missing artifact hash ${token}`);
}
console.log('PASS P04 artifact hashes are cached by immutable object identity.');

for (const pattern of [
  /sha256\(this\.#dataset\.sourceSha256/u,
  /nullableSha256\(masterData\?\.lineList\?\.sourceHash/u,
  /sha256\(masterData\?\.pipingClass\?\.sourceHash/u,
  /sha256\(masterData\?\.weight\?\.sourceHash/u,
]) assert.match(bindings, pattern);
console.log('PASS P05 SHA-256 provenance remains authoritative (lineList nullable-optional).');

console.log('STRUCTURAL CURRENTNESS STATUS: PASS');
