import assert from 'node:assert/strict';
import { semanticHash } from '../src/core/shared-primitives/canonical-json.js';
import {
  CORRELATION_APPLICABILITY_DEFINITION_SCHEMA,
  CORRELATION_PHYSICAL_APPLICABILITY_SCHEMA,
  correlationApplicabilityDefinitionMatchesProfile,
  createCorrelationApplicabilityDefinition,
  evaluateCorrelationPhysicalApplicability,
  syntheticCorrelationApplicabilityDefinition,
  syntheticCorrelationProfile,
  validateCorrelationApplicabilityDefinition,
} from '../src/core/local-attachment-correlation/index.js';

const profile = syntheticCorrelationProfile();
const definition = syntheticCorrelationApplicabilityDefinition(profile);
assert.equal(definition.schema, CORRELATION_APPLICABILITY_DEFINITION_SCHEMA);
assert.equal(correlationApplicabilityDefinitionMatchesProfile(definition, profile), true);
assert.deepEqual(validateCorrelationApplicabilityDefinition(definition), definition);

const context = {
  hostShellFamily: 'CYLINDRICAL_SHELL',
  attachmentFamily: 'CIRCULAR_ATTACHMENT',
  intersectionOrientation: 'NORMAL_TO_HOST_MIDSURFACE',
  loadReferenceConvention: 'ATTACHMENT_SHELL_INTERFACE',
};

const midpoint = evaluateCorrelationPhysicalApplicability({
  definition,
  profile,
  geometryEvidence: geometry(300, 10, 75, 'MIDPOINT'),
  context,
  requestedTargetIds: ['CROWN_OUTER'],
});
assert.equal(midpoint.schema, CORRELATION_PHYSICAL_APPLICABILITY_SCHEMA);
assert.equal(midpoint.state, 'ACCEPTED');
assert.equal(check(midpoint, 'DIAMETER_RATIO').value, 0.25);
assert.equal(check(midpoint, 'DIAMETER_THICKNESS_RATIO').value, 30);
assert.ok(midpoint.parameterChecks.every((row) => row.pass));
assert.ok(midpoint.topologyChecks.every((row) => row.pass));
assert.ok(midpoint.targetChecks.every((row) => row.pass));
assert.deepEqual(midpoint.diagnostics, []);

const lower = evaluateCorrelationPhysicalApplicability({
  definition,
  profile,
  geometryEvidence: geometry(300, 15, 60, 'LOWER'),
  context,
  requestedTargetIds: ['CROWN_OUTER'],
});
assert.equal(lower.state, 'ACCEPTED');
assert.equal(check(lower, 'DIAMETER_RATIO').value, 0.2);
assert.equal(check(lower, 'DIAMETER_THICKNESS_RATIO').value, 20);

const upper = evaluateCorrelationPhysicalApplicability({
  definition,
  profile,
  geometryEvidence: geometry(300, 7.5, 90, 'UPPER'),
  context,
  requestedTargetIds: ['CROWN_OUTER'],
});
assert.equal(upper.state, 'ACCEPTED');
assert.equal(check(upper, 'DIAMETER_RATIO').value, 0.3);
assert.equal(check(upper, 'DIAMETER_THICKNESS_RATIO').value, 40);

const outsideRatio = evaluateCorrelationPhysicalApplicability({
  definition,
  profile,
  geometryEvidence: geometry(300, 10, 93, 'OUTSIDE-RATIO'),
  context,
  requestedTargetIds: ['CROWN_OUTER'],
});
assert.equal(outsideRatio.state, 'REJECTED');
assert.equal(check(outsideRatio, 'DIAMETER_RATIO').value, 0.31);
assert.equal(check(outsideRatio, 'DIAMETER_RATIO').pass, false);
assert.ok(outsideRatio.diagnostics.some((row) =>
  row.code === 'CORRELATION_PHYSICAL_APPLICABILITY_LIMIT_EXCEEDED'));

const outsideDt = evaluateCorrelationPhysicalApplicability({
  definition,
  profile,
  geometryEvidence: geometry(300, 300 / 41, 75, 'OUTSIDE-DT'),
  context,
  requestedTargetIds: ['CROWN_OUTER'],
});
assert.equal(outsideDt.state, 'REJECTED');
assert.ok(Math.abs(check(outsideDt, 'DIAMETER_THICKNESS_RATIO').value - 41) < 1e-12);
assert.equal(check(outsideDt, 'DIAMETER_THICKNESS_RATIO').pass, false);

const wrongTopology = evaluateCorrelationPhysicalApplicability({
  definition,
  profile,
  geometryEvidence: geometry(300, 10, 75, 'WRONG-TOPOLOGY'),
  context: { ...context, attachmentFamily: 'RECTANGULAR_ATTACHMENT' },
  requestedTargetIds: ['CROWN_OUTER'],
});
assert.equal(wrongTopology.state, 'REJECTED');
assert.ok(wrongTopology.diagnostics.some((row) =>
  row.code === 'CORRELATION_PHYSICAL_APPLICABILITY_TOPOLOGY_MISMATCH'));

const wrongTarget = evaluateCorrelationPhysicalApplicability({
  definition,
  profile,
  geometryEvidence: geometry(300, 10, 75, 'WRONG-TARGET'),
  context,
  requestedTargetIds: ['UNAPPROVED_TARGET'],
});
assert.equal(wrongTarget.state, 'REJECTED');
assert.ok(wrongTarget.diagnostics.some((row) =>
  row.code === 'CORRELATION_PHYSICAL_APPLICABILITY_TARGET_NOT_PERMITTED'));

const tampered = structuredClone(definition);
tampered.parameterLimits[0].maximum = 0.9;
assert.throws(
  () => validateCorrelationApplicabilityDefinition(tampered),
  (error) => error?.code === 'CORRELATION_APPLICABILITY_DEFINITION_HASH_MISMATCH',
);

const wrongProfile = structuredClone(profile);
wrongProfile.applicabilityProfileId = 'DIFFERENT-APPLICABILITY-PROFILE';
assert.equal(correlationApplicabilityDefinitionMatchesProfile(definition, wrongProfile), false);
assert.throws(
  () => evaluateCorrelationPhysicalApplicability({
    definition,
    profile: wrongProfile,
    geometryEvidence: geometry(300, 10, 75, 'WRONG-PROFILE'),
    context,
    requestedTargetIds: ['CROWN_OUTER'],
  }),
  (error) => error?.code === 'CORRELATION_APPLICABILITY_DEFINITION_PROFILE_MISMATCH',
);

const unsupportedParameter = {
  schema: CORRELATION_APPLICABILITY_DEFINITION_SCHEMA,
  definitionIdentity: 'UNSUPPORTED-PARAMETER',
  methodIdentity: profile.methodIdentity,
  methodEdition: profile.methodEdition,
  coefficientDatasetHash: profile.coefficientDatasetHash,
  applicabilityProfileId: profile.applicabilityProfileId,
  sourceReference: 'SYNTHETIC',
  sourceEdition: '1',
  topology: context,
  permittedTargetIds: ['CROWN_OUTER'],
  parameterLimits: [{
    parameterId: 'UNSUPPORTED_GEOMETRY_PARAMETER',
    minimum: 0,
    maximum: 1,
    minimumInclusive: true,
    maximumInclusive: true,
  }],
  exclusions: [],
};
assert.throws(
  () => createCorrelationApplicabilityDefinition(unsupportedParameter),
  (error) => error?.code === 'CORRELATION_APPLICABILITY_PARAMETER_UNSUPPORTED',
);

console.log(JSON.stringify({
  check: 'lafea-correlation-physical-applicability',
  status: 'PASS',
  applicabilityDefinitionHash: definition.semanticHash,
  midpoint: {
    diameterRatio: check(midpoint, 'DIAMETER_RATIO').value,
    diameterThicknessRatio: check(midpoint, 'DIAMETER_THICKNESS_RATIO').value,
  },
  lowerBoundaryAccepted: true,
  upperBoundaryAccepted: true,
  diameterRatio031Rejected: true,
  diameterThicknessRatio41Rejected: true,
  topologyMismatchRejected: true,
  targetMismatchRejected: true,
  definitionTamperRejected: true,
  unsupportedGeometryParameterFailsClosed: true,
}));

function geometry(pipeOutsideDiameter, pipeThickness, attachmentDiameter, identity) {
  const base = {
    schema: 'local-attachment-correlation-geometry/v1',
    geometryIdentity: `SYNTHETIC-${identity}`,
    sourceStageId: 'LAFEA.2',
    sourceEvidenceHash: `SOURCE-${identity}`,
    foundationModelHash: `MODEL-${identity}`,
    foundationResultHash: `RESULT-${identity}`,
    pipeOutsideDiameter,
    pipeThickness,
    attachmentDiameter,
    sourceReferences: {
      pipeOutsideDiameter: 'SYNTHETIC/PIPE_OD',
      pipeThickness: 'SYNTHETIC/PIPE_T',
      attachmentDiameter: 'SYNTHETIC/ATTACHMENT_D',
    },
  };
  return Object.freeze({ ...base, semanticHash: semanticHash(base) });
}
function check(result, parameterId) {
  const matches = result.parameterChecks.filter((row) => row.parameterId === parameterId);
  assert.equal(matches.length, 1, `Expected one ${parameterId} check.`);
  return matches[0];
}
