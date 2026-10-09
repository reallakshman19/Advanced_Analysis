import assert from 'node:assert/strict';
import { screeningRequestFixture } from './lafea.2-fixtures.mjs';
import { calculateLocalAttachmentScreening } from '../src/core/local-attachment-screening/index.js';
import {
  createLafeaCorrelationGeometryDeclaration,
  projectLafeaCorrelationGeometry,
  validateLafeaCorrelationGeometryDeclaration,
} from '../src/workspace/lafea-correlation-geometry-declaration.js';
import { lafeaCorrelationProductAvailability } from '../src/workspace/lafea-correlation-product.js';

const request = screeningRequestFixture();
const result = calculateLocalAttachmentScreening(request);
assert.equal(result.qualification.state, 'ACCEPTED');

const beforeStage = {
  stageId: 'LAFEA.2',
  document: request,
  execution: null,
};
const declaration = createLafeaCorrelationGeometryDeclaration(beforeStage, {
  geometryIdentity: 'ATTACHMENT-GEOMETRY-001',
  attachmentDiameter: 250,
  attachmentSourceReference: 'QUALIFICATION_FIXTURE/ATTACHMENT_DIAMETER',
});
assert.equal(declaration.stageId, 'LAFEA.2');
assert.equal(declaration.geometryIdentity, 'ATTACHMENT-GEOMETRY-001');
assert.equal(declaration.attachmentDiameter, 250);
assert.match(declaration.sourceDocumentDigest, /^fnv1a64:[0-9a-f]{16}$/u);
assert.match(declaration.semanticHash, /^fnv1a64:[0-9a-f]{16}$/u);
assert.deepEqual(validateLafeaCorrelationGeometryDeclaration(declaration), declaration);

const pending = projectLafeaCorrelationGeometry(beforeStage, declaration);
assert.equal(pending.state, 'CURRENT_INPUT_PENDING_RESULT');
assert.deepEqual(pending.reasons, []);
assert.equal(pending.geometryEvidence, null);
assert.equal(pending.boundDocumentDigest, pending.currentDocumentDigest);

const afterStage = {
  ...beforeStage,
  execution: {
    status: 'QUALIFIED',
    result,
  },
};
const current = projectLafeaCorrelationGeometry(afterStage, declaration);
assert.equal(current.state, 'CURRENT_EVIDENCE');
assert.deepEqual(current.reasons, []);
assert.match(current.geometryEvidenceHash, /^fnv1a64:[0-9a-f]{16}$/u);
assert.equal(current.geometryEvidence.pipeOutsideDiameter, 1000);
assert.equal(current.geometryEvidence.pipeThickness, 10);
assert.equal(current.geometryEvidence.attachmentDiameter, 250);
assert.equal(
  current.geometryEvidence.foundationModelHash,
  request.sourceEvidence.foundationModel.semanticHash,
);
assert.equal(
  current.geometryEvidence.foundationResultHash,
  request.sourceEvidence.foundationResult.semanticHashes.resultPayloadSemanticHash,
);
assert.equal(
  current.geometryEvidence.sourceEvidenceHash,
  result.semanticHashes.sourceEvidenceSemanticHash,
);

const availability = lafeaCorrelationProductAvailability(afterStage, current);
assert.equal(availability.state, 'BLOCKED');
assert.deepEqual(availability.reasons, ['NO_ENGINEERING_CORRELATION_PROFILE_REGISTERED']);
assert.equal(availability.geometry.state, 'CURRENT_EVIDENCE');
assert.equal(availability.geometry.geometryEvidenceHash, current.geometryEvidenceHash);
assert.equal(availability.nextRequiredInput, 'QUALIFIED_ENGINEERING_CORRELATION_METHOD');

const changedRequest = structuredClone(request);
changedRequest.screeningCases.find((row) => row.screeningCaseId === 'CASE-A').pressureFactor = 0.75;
const stale = projectLafeaCorrelationGeometry({
  ...afterStage,
  document: changedRequest,
}, declaration);
assert.equal(stale.state, 'STALE');
assert.deepEqual(stale.reasons, ['ATTACHMENT_GEOMETRY_SOURCE_STALE']);
assert.notEqual(stale.boundDocumentDigest, stale.currentDocumentDigest);
assert.equal(stale.geometryEvidence, null);

const tampered = structuredClone(declaration);
tampered.attachmentDiameter = 251;
const invalid = projectLafeaCorrelationGeometry(afterStage, tampered);
assert.equal(invalid.state, 'INVALID');
assert.equal(invalid.reasons[0], 'LAFEA_CORRELATION_GEOMETRY_DECLARATION_HASH_MISMATCH');
assert.equal(invalid.geometryEvidence, null);

assert.throws(() => createLafeaCorrelationGeometryDeclaration({
  stageId: 'LAFEA.1',
  document: request,
}, {
  geometryIdentity: 'BAD-STAGE',
  attachmentDiameter: 250,
  attachmentSourceReference: 'BAD',
}), (error) => error?.code === 'LAFEA_CORRELATION_GEOMETRY_STAGE_MUST_BE_LAFEA2');

console.log(JSON.stringify({
  check: 'lafea2-correlation-geometry-declaration',
  status: 'PASS',
  declarationHash: declaration.semanticHash,
  sourceDocumentDigest: declaration.sourceDocumentDigest,
  currentGeometryEvidenceHash: current.geometryEvidenceHash,
  foundationModelHash: current.geometryEvidence.foundationModelHash,
  foundationResultHash: current.geometryEvidence.foundationResultHash,
  sourceEvidenceHash: current.geometryEvidence.sourceEvidenceHash,
  currentState: current.state,
  staleState: stale.state,
  tamperState: invalid.state,
  engineeringMethodStillRequired: true,
}));
