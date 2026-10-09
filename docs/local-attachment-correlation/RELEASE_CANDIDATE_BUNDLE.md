# Local-Attachment Correlation Release Candidate Bundle

## Purpose

A future production correlation method will arrive as more than a coefficient table. Before it can be considered for engineering registration, the repository must be able to prove that the coefficient dataset, method profile, executable qualification evidence, and approval record all refer to the same method definition.

`local-attachment-correlation-release-candidate/v1` is the immutable handoff artifact for that review.

It is deliberately **not** an engineering registry and deliberately does not contain the current trust-root outcome.

## Candidate contents

A release candidate retains:

- candidate identity;
- exact validated dataset package;
- exact candidate correlation profile;
- exact executable PASS qualification evidence;
- exact qualification approval record;
- binding hashes for:
  - dataset package;
  - coefficient dataset;
  - candidate profile;
  - qualification suite;
  - qualification evidence;
  - qualification record;
  - authority-neutral method definition;
- candidate semantic hash.

## Dataset-to-profile custody

Dataset ingestion creates an unqualified profile with `engineeringUseAuthorized=false`.

A release candidate may contain a profile whose authority block has subsequently been prepared for engineering release, but every method-definition field outside that authority block must still match the profile derived from the exact dataset package.

The binding includes:

```text
method identity
method edition
coefficient dataset ID/hash
interpolation policy
applicability profile
provenance
axes
stress targets
response definitions
coefficient grids
uncertainty definition
```

The code computes an authority-neutral `methodDefinitionHash` to enforce this equality.

Changing source provenance, coefficients, applicability, target definitions, interpolation policy, or uncertainty without rebuilding the dataset package therefore invalidates the candidate.

## Qualification custody

The candidate requires executable qualification evidence that:

- is `PASS`;
- binds the exact candidate profile semantic hash;
- binds the exact method/edition/dataset identity;
- retains the exact qualification suite;
- reproduces the same evidence semantic hash when that suite is re-executed against the candidate profile.

The approval record must:

- match the exact candidate profile;
- identify the exact qualification evidence semantic hash;
- state `engineeringUseApproved=true`.

These checks make the release candidate internally coherent, but they do not create code trust.

## Trust is a projection, not candidate data

The current trusted-authority set is code-owned and may change only through a separately qualified software release.

For that reason the release candidate semantic hash does **not** include a field such as `trusted=true` or `READY_FOR_ENGINEERING_REGISTRY`.

Instead:

`correlationReleaseCandidateTrustProjection(candidate)`

computes the current state:

- `READY_FOR_ENGINEERING_REGISTRY`; or
- `UNTRUSTED_APPROVAL_AUTHORITY`.

The projection retains the candidate semantic hash and the approval authority identity/reference, but it is not part of the immutable candidate artifact.

This prevents a trust-root update from corrupting or invalidating an otherwise unchanged release-candidate artifact.

## Registry handoff

`correlationReleaseCandidateRegistryInputs(candidate)` returns profile/record/evidence arrays only when the current trust projection is `READY_FOR_ENGINEERING_REGISTRY`.

When the authority is not trusted it fails closed with:

`CORRELATION_RELEASE_CANDIDATE_NOT_TRUSTED`

The engineering registry then independently re-validates and re-executes the evidence again. Candidate readiness therefore does not bypass registry v2.

## Intended production sequence

```text
licensed source data
→ dataset package
→ dataset-derived unqualified profile
→ candidate profile
→ executable qualification suite
→ PASS qualification evidence
→ approval record
→ immutable release candidate
→ current code trust projection
→ registry v2 inputs
→ registry v2 deep validation/replay
→ engineering method available to LAFEA.2
```

## Rejected candidate conditions

The candidate contract rejects:

- dataset/profile method-definition drift;
- profile/evidence semantic-hash drift;
- FAIL qualification evidence;
- non-reproducible qualification evidence;
- approval record bound to another profile;
- approval record bound to another evidence hash;
- approval record without engineering-use approval;
- profile not marked as an engineering release candidate;
- candidate semantic-hash tampering.

Current trust projection separately rejects an approval authority not present in the code-owned trusted-authority set.

## Independence from LAFEA.2 project geometry

This artifact qualifies a **method release**, not a project calculation.

It contains no LAFEA.2 attachment diameter, screening case, load resultants, or project pressure state. Those remain under the separate source-bound project geometry/result custody introduced by the LAFEA.2 product seam.

The eventual local-attachment calculation therefore requires two independent authorities:

```text
method authority:
release candidate → trusted registry method

project authority:
current LAFEA.2 result → current source-bound attachment geometry
```

Neither path can substitute for the other.

## Current repository state

At this change:

- real production coefficient datasets registered: `0`;
- trusted correlation approval authorities: `0`;
- engineering correlation methods: `0`.

The synthetic package and suite remain software-qualification fixtures only.
