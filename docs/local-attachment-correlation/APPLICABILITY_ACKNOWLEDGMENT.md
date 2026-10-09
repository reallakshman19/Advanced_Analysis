# Correlation Applicability Acknowledgment Gate

## Purpose

A registered correlation profile already carries an `applicabilityProfileId`, but retaining that identifier in method metadata is not enough. Engineering execution must not silently assume that the caller intended the registered applicability profile.

The applicability acknowledgment gate therefore requires the caller to explicitly name the exact applicability-profile identity before project geometry evidence is constructed.

## Contract

`local-attachment-correlation-applicability-acknowledgment/v1`

The acknowledgment retains:

- method identity;
- method edition;
- coefficient dataset hash;
- exact applicability-profile ID;
- acknowledgment basis;
- explicit limitations;
- semantic hash.

The required basis is:

`CALLER_EXPLICIT_EXACT_PROFILE_ID_MATCH`

A missing or mismatched profile ID fails closed.

## Engineering-assessment order

The engineering path is now:

```text
trusted registry method
→ explicit applicability-profile acknowledgment
→ LAFEA.2 correlation geometry evidence
→ correlation request
→ correlation calculation
```

The applicability gate must execute before `createCorrelationGeometryEvidenceFromLafea2()`.

This ordering prevents the product from constructing project correlation geometry under a method whose applicability identity was never explicitly selected.

## What this gate proves

It proves only that:

- the caller explicitly supplied an applicability-profile ID;
- that ID exactly equals the registered profile's retained ID;
- the acknowledgment is bound to the exact method/edition/dataset hash;
- the retained acknowledgment has not been altered.

## What this gate does not prove

The acknowledgment deliberately retains these limitations:

```text
APPLICABILITY_IDENTITY_MATCH_ONLY
DOES_NOT_PROVE_PROJECT_GEOMETRY_IS_WITHIN_METHOD_SCOPE
```

An identifier match is not a physical applicability assessment.

For a future real method, the legally available method source must still define what the profile ID means: attachment family, host geometry, dimensions, load-reference convention, stress-recovery locations, exclusions, and any additional qualified limits.

Those source-defined physical applicability rules must be implemented and independently qualified before a method is activated for engineering use.

## Why no WRC family is hard-coded here

The governing LAFEA roadmap defines LAFEA.2 as nominal pipe-section screening and does not commit the local-correlation extension to a specific WRC bulletin or attachment family.

LAFEA.5 separately owns a trunnion-footprint shell workflow.

Therefore this gate does not infer that an arbitrary LAFEA.2 attachment is a nozzle, trunnion, shoe, circular attachment, rectangular attachment, or any other empirical-method family. The exact method family must come from the future qualified dataset/source package.

## Assessment result

Engineering correlation assessment moves to:

`local-attachment-correlation-assessment/v2`

and retains `applicabilityAcknowledgment` alongside geometry evidence, request and result.

If method registration itself fails, the acknowledgment remains `null` because no authoritative applicability profile exists to acknowledge.

If applicability acknowledgment fails, geometry evidence, correlation request and result remain `null`.

## Tamper rule

Validation hashes the supplied acknowledgment before reconstructing the canonical acknowledgment. Changing a limitation, method identity, profile identity, dataset hash or other retained field while leaving the original semantic hash is rejected.

## Current limitation

This is an authority-order and provenance improvement, not the final physical applicability model. The next real-method integration must replace the opaque meaning of `applicabilityProfileId` with source-qualified applicability definitions and executable boundary cases without weakening this explicit acknowledgment gate.
