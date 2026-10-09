import { createCorrelationApplicabilityAcknowledgment } from './applicability.js';
import { calculateLocalAttachmentCorrelation } from './calculate.js';
import { createCorrelationGeometryEvidenceFromLafea2 } from './geometry-evidence.js';
import { createCorrelationRequestFromLafea2 } from './lafea2-bridge.js';
import {
  EMPTY_ENGINEERING_CORRELATION_REGISTRY,
  requireEngineeringCorrelationProfile,
} from './registry.js';

export const CORRELATION_ASSESSMENT_SCHEMA = 'local-attachment-correlation-assessment/v2';

export function calculateEngineeringCorrelationFromLafea2(options) {
  const methodIdentity = options?.methodIdentity ?? null;
  const methodEdition = options?.methodEdition ?? null;
  let applicabilityAcknowledgment = null;
  try {
    const profile = requireEngineeringCorrelationProfile(
      options?.registry ?? EMPTY_ENGINEERING_CORRELATION_REGISTRY,
      methodIdentity,
      methodEdition,
    );
    applicabilityAcknowledgment = createCorrelationApplicabilityAcknowledgment(
      profile,
      options?.applicabilityProfileId,
    );
    const geometryEvidence = createCorrelationGeometryEvidenceFromLafea2({
      screeningRequest: options.screeningRequest,
      screeningResult: options.screeningResult,
      geometryIdentity: options.geometryIdentity,
      attachmentDiameter: options.attachmentDiameter,
      attachmentSourceReference: options.attachmentSourceReference,
    });
    const request = createCorrelationRequestFromLafea2({
      requestIdentity: options.requestIdentity,
      screeningResult: options.screeningResult,
      screeningCaseId: options.screeningCaseId,
      geometryEvidence,
      targetMappings: options.targetMappings,
    });
    const result = calculateLocalAttachmentCorrelation(request, profile);
    if (result.qualification.state !== 'ACCEPTED'
      || result.qualification.engineeringUseAuthorized !== true) {
      return assessment('BLOCKED', methodIdentity, methodEdition, applicabilityAcknowledgment,
        geometryEvidence, request, result,
        result.diagnostics?.length ? result.diagnostics : [diagnostic(
          'CORRELATION_ENGINEERING_RESULT_NOT_AUTHORIZED',
          'Registered engineering correlation did not produce an authorized accepted result.',
        )]);
    }
    return assessment('QUALIFIED', methodIdentity, methodEdition, applicabilityAcknowledgment,
      geometryEvidence, request, result, []);
  } catch (error) {
    return assessment('BLOCKED', methodIdentity, methodEdition, applicabilityAcknowledgment,
      null, null, null, [diagnostic(
        error?.code ?? 'CORRELATION_ENGINEERING_ASSESSMENT_REJECTED',
        error instanceof Error ? error.message : 'Unknown engineering correlation assessment failure.',
        error?.path ?? null,
      )]);
  }
}

function assessment(
  status, methodIdentity, methodEdition, applicabilityAcknowledgment,
  geometryEvidence, request, result, diagnostics,
) {
  return freeze({
    schema: CORRELATION_ASSESSMENT_SCHEMA,
    status,
    methodIdentity,
    methodEdition,
    applicabilityAcknowledgment,
    geometryEvidence,
    request,
    result,
    diagnostics,
  });
}
function diagnostic(code, message, path = null) {
  return freeze({ severity: 'ERROR', code, path, message });
}
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
