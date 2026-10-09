import assert from 'node:assert/strict';
import {
  LAFEA_ENGINEERING_CORRELATION_REGISTRY,
  lafeaCorrelationProductAvailability,
} from '../src/workspace/lafea-correlation-product.js';

assert.deepEqual(LAFEA_ENGINEERING_CORRELATION_REGISTRY.profiles, []);
assert.deepEqual(LAFEA_ENGINEERING_CORRELATION_REGISTRY.qualificationRecords, []);

const before = lafeaCorrelationProductAvailability({
  stageId: 'LAFEA.2',
  execution: null,
});
assert.equal(before.state, 'BLOCKED');
assert.equal(before.registeredMethodCount, 0);
assert.deepEqual(before.methods, []);
assert.deepEqual(before.reasons, [
  'NO_ENGINEERING_CORRELATION_PROFILE_REGISTERED',
  'QUALIFIED_LAFEA2_RESULT_REQUIRED',
  'SOURCE_BOUND_ATTACHMENT_GEOMETRY_REQUIRED',
]);
assert.equal(before.sourceEvidence.screeningResultPayloadSemanticHash, null);
assert.equal(before.geometry.state, 'ABSENT');
assert.equal(before.nextRequiredInput, 'SOURCE_BOUND_ATTACHMENT_GEOMETRY');

const retainedHash = 'fnv1a64:0123456789abcdef';
const acceptedStage = {
  stageId: 'LAFEA.2',
  execution: {
    status: 'QUALIFIED',
    result: {
      qualification: { state: 'ACCEPTED' },
      semanticHashes: { screeningResultPayloadSemanticHash: retainedHash },
    },
  },
};
const afterResultOnly = lafeaCorrelationProductAvailability(acceptedStage);
assert.equal(afterResultOnly.state, 'BLOCKED');
assert.deepEqual(afterResultOnly.reasons, [
  'NO_ENGINEERING_CORRELATION_PROFILE_REGISTERED',
  'SOURCE_BOUND_ATTACHMENT_GEOMETRY_REQUIRED',
]);
assert.equal(afterResultOnly.nextRequiredInput, 'SOURCE_BOUND_ATTACHMENT_GEOMETRY');

const geometryProjection = {
  state: 'CURRENT_EVIDENCE',
  declarationHash: 'fnv1a64:aaaaaaaaaaaaaaaa',
  boundDocumentDigest: 'fnv1a64:bbbbbbbbbbbbbbbb',
  currentDocumentDigest: 'fnv1a64:bbbbbbbbbbbbbbbb',
  geometryEvidenceHash: 'fnv1a64:cccccccccccccccc',
  geometryEvidence: { semanticHash: 'fnv1a64:cccccccccccccccc' },
  declaration: { geometryIdentity: 'ATTACHMENT-1', attachmentDiameter: 250 },
  diagnostics: [],
};
const after = lafeaCorrelationProductAvailability(acceptedStage, geometryProjection);
assert.equal(after.state, 'BLOCKED');
assert.equal(after.registeredMethodCount, 0);
assert.deepEqual(after.reasons, ['NO_ENGINEERING_CORRELATION_PROFILE_REGISTERED']);
assert.equal(after.sourceEvidence.screeningResultStatus, 'QUALIFIED');
assert.equal(after.sourceEvidence.screeningResultQualification, 'ACCEPTED');
assert.equal(after.sourceEvidence.screeningResultPayloadSemanticHash, retainedHash);
assert.equal(after.geometry.state, 'CURRENT_EVIDENCE');
assert.equal(after.geometry.geometryEvidenceHash, geometryProjection.geometryEvidenceHash);
assert.equal(after.nextRequiredInput, 'QUALIFIED_ENGINEERING_CORRELATION_METHOD');

const stale = lafeaCorrelationProductAvailability(acceptedStage, {
  ...geometryProjection,
  state: 'STALE',
  geometryEvidenceHash: null,
  geometryEvidence: null,
});
assert.deepEqual(stale.reasons, [
  'NO_ENGINEERING_CORRELATION_PROFILE_REGISTERED',
  'ATTACHMENT_GEOMETRY_SOURCE_STALE',
]);
assert.equal(stale.nextRequiredInput, 'SOURCE_BOUND_ATTACHMENT_GEOMETRY');

assert.throws(
  () => lafeaCorrelationProductAvailability({ stageId: 'LAFEA.1' }),
  /LAFEA_CORRELATION_PRODUCT_STAGE_MUST_BE_LAFEA2/u,
);

console.log(JSON.stringify({
  check: 'lafea2-correlation-product-availability',
  status: 'PASS',
  registeredEngineeringMethods: after.registeredMethodCount,
  preRunBlockers: before.reasons,
  postRunWithoutGeometryBlockers: afterResultOnly.reasons,
  postGeometryBlockers: after.reasons,
  staleGeometryBlockers: stale.reasons,
  retainedLafea2ResultHash: after.sourceEvidence.screeningResultPayloadSemanticHash,
  retainedGeometryEvidenceHash: after.geometry.geometryEvidenceHash,
  syntheticEngineeringMethodExposed: false,
}));
