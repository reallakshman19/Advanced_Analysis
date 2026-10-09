import { requireEmp1EngineeringRecordPackage } from './emp1-engineering-record-package.js';

export const EMP1_ENGINEERING_RECORD_REVISION_COMPARISON_SCHEMA =
  'emp1-engineering-record-revision-comparison/v1';

const EVIDENCE_KEYS = Object.freeze([
  'sourceHash',
  'loadTransferResultHash',
  'sectionScreeningResultHash',
  'localCorrelationResultHash',
  'assessmentSemanticHash',
  'routeAuthorityHash',
]);

/**
 * Read-only revision comparison over two already-validated engineering record
 * packages. This projection reports changed custody identities only; it does not
 * compare numerical adequacy, infer engineering significance, or create approval.
 */
export function compareEmp1EngineeringRecordRevisions(baseValue, candidateValue) {
  const base = requireEmp1EngineeringRecordPackage(baseValue);
  const candidate = requireEmp1EngineeringRecordPackage(candidateValue);

  const changedEvidenceBindings = EVIDENCE_KEYS.filter(
    (key) => base.evidence[key] !== candidate.evidence[key],
  );
  const reviewChanged = base.review.semanticHash !== candidate.review.semanticHash;
  const reviewDispositionChanged = base.review.disposition !== candidate.review.disposition;
  const methodChanged = !sameJson(base.limitations.method, candidate.limitations.method);
  const scopeChanged = !sameJson(base.limitations.scope, candidate.limitations.scope);
  const routeLimitationsChanged = !sameJson(
    base.limitations.routeLimitations,
    candidate.limitations.routeLimitations,
  );
  const remainingBlockedChanged = !sameJson(
    base.limitations.remainingBlocked,
    candidate.limitations.remainingBlocked,
  );
  const packageIdentityChanged = base.semanticHash !== candidate.semanticHash;

  const changeDomains = [];
  if (changedEvidenceBindings.length) changeDomains.push('EVIDENCE_BINDING');
  if (reviewChanged) changeDomains.push('ENGINEERING_REVIEW');
  if (methodChanged) changeDomains.push('METHOD_IDENTITY');
  if (scopeChanged) changeDomains.push('METHOD_SCOPE');
  if (routeLimitationsChanged || remainingBlockedChanged) changeDomains.push('LIMITATIONS');
  if (!changeDomains.length && packageIdentityChanged) changeDomains.push('PACKAGE_METADATA_ONLY');

  return deepFreeze({
    schema: EMP1_ENGINEERING_RECORD_REVISION_COMPARISON_SCHEMA,
    productId: 'EMP.1',
    base: packageIdentity(base),
    candidate: packageIdentity(candidate),
    samePackageIdentity: !packageIdentityChanged,
    sameEngineeringEvidence: changedEvidenceBindings.length === 0,
    sameReview: !reviewChanged,
    sameMethodAndScope: !methodChanged && !scopeChanged,
    sameLimitations: !routeLimitationsChanged && !remainingBlockedChanged,
    changedEvidenceBindings,
    review: {
      changed: reviewChanged,
      dispositionChanged: reviewDispositionChanged,
      baseDisposition: base.review.disposition,
      candidateDisposition: candidate.review.disposition,
      baseReviewId: base.review.reviewId,
      candidateReviewId: candidate.review.reviewId,
    },
    route: {
      methodChanged,
      scopeChanged,
      routeLimitationsChanged,
      remainingBlockedChanged,
    },
    changeDomains,
    classification: classify({ packageIdentityChanged, changeDomains }),
    authorityBoundary: {
      comparisonOnly: true,
      evaluatesNumericalDifference: false,
      evaluatesEngineeringSignificance: false,
      createsEngineeringCalculationAuthority: false,
      createsMethodAuthority: false,
      createsApplicabilityAuthority: false,
      createsReviewAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
      createsDeploymentAuthority: false,
      createsCryptographicSeal: false,
    },
  });
}

function packageIdentity(value) {
  return Object.freeze({
    packageId: value.packageId,
    semanticHash: value.semanticHash,
    packagedAt: value.packagedAt,
    recordState: value.recordState,
  });
}

function classify({ packageIdentityChanged, changeDomains }) {
  if (!packageIdentityChanged) return 'IDENTICAL_PACKAGE';
  if (!changeDomains.length) return 'PACKAGE_METADATA_CHANGED';
  if (changeDomains.length === 1) return `${changeDomains[0]}_CHANGED`;
  return 'MULTIPLE_CUSTODY_DOMAINS_CHANGED';
}

function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
