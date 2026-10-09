# Local-Attachment Correlation Registry Evidence Gate

## Purpose

The engineering correlation registry is the final code boundary between a correlation method package and a product-visible engineering method. A qualification record that merely contains an evidence hash is not sufficient at this boundary.

Registry v2 therefore requires the actual executable qualification evidence package and replays its retained suite against the exact candidate profile before authority is considered.

## Registry schema

`local-attachment-correlation-method-registry/v2`

A retained registry contains aligned arrays of:

- correlation profiles;
- qualification approval records;
- executable qualification evidence;
- a deterministic registry semantic hash.

The arrays are canonicalized by `methodIdentity + methodEdition`; callers do not establish authority through array position.

## Activation sequence

For each proposed method profile, registry construction performs the following sequence:

1. Validate the profile as a correlation profile.
2. Require `engineeringUseAuthorized=true` on the candidate engineering profile.
3. Reject profiles whose provenance is `INTERNAL_TEST_DATA`.
4. Resolve exactly one qualification record by exact profile identity/hash binding.
5. Resolve exactly one qualification evidence package whose:
   - method identity matches;
   - method edition matches;
   - coefficient dataset ID matches;
   - coefficient dataset hash matches;
   - profile semantic hash matches;
   - semantic hash equals the record's `qualificationEvidenceHash`.
6. Require qualification evidence status `PASS`.
7. Validate the exact qualification suite retained inside that evidence package.
8. Re-execute that retained suite against the exact profile.
9. Require the reproduced evidence semantic hash to equal the supplied evidence semantic hash.
10. Require the approval record's engineering-use approval flag.
11. Require the approval authority ID to exist in the code-owned trusted-authority set.
12. Only then retain the profile as an engineering registry method.

The trusted-authority set remains empty at present, so no non-empty engineering registry can be created today.

## Read-path validation

`validateEngineeringCorrelationRegistry()` does not trust a caller-created object merely because it has the correct schema and semantic hash.

It rebuilds the registry from its retained profiles, approval records, and evidence packages. This repeats profile validation, evidence pairing, evidence replay, approval checks, and trusted-authority checks before comparing the reconstructed registry semantic hash.

Both:

- `engineeringCorrelationMethods()`; and
- `requireEngineeringCorrelationProfile()`

call this deep validator before returning data.

Therefore a manually assembled or deserialized registry cannot bypass the construction gate.

## Rejected cases

Registry v2 explicitly rejects:

- engineering profile with no qualification record;
- qualification record with no actual evidence package;
- record whose evidence hash does not identify the supplied evidence;
- FAIL qualification evidence;
- duplicate qualification evidence;
- evidence that cannot be reproduced from its retained suite and exact profile;
- unclaimed qualification records or evidence packages;
- record without engineering-use approval;
- approval authority not present in the code-owned trust root;
- registry semantic-hash tampering.

## Why registry v1 is not accepted

Registry v1 retained profiles and approval records but did not retain executable qualification evidence. There is intentionally no compatibility adapter that upgrades a v1 registry by trusting its evidence-hash claim.

No authorized production correlation method existed under registry v1, so there is no qualified engineering state that requires migration. Accepting v1 at the engineering boundary would instead preserve the exact authority gap v2 is intended to remove.

Dataset packages, profiles, qualification suites, and qualification records keep their own existing versioned contracts. This change is specifically the engineering registry activation contract.

## Separation from product geometry

This registry gate is independent of LAFEA.2 attachment-geometry custody.

A method can be qualified only by method/dataset benchmark evidence. Product geometry can be current or stale without affecting method qualification. Conversely, current source-bound geometry cannot make an unqualified method authoritative.

The eventual calculation path therefore requires both independent conditions:

```text
qualified + trusted method
AND
current LAFEA.2 result + current source-bound attachment geometry
```

Neither path can create the other path's authority.

## Current authority state

At the time of this change:

- licensed/local-attachment production coefficient data registered: `0`;
- trusted correlation approval authorities registered: `0`;
- engineering correlation methods registered: `0`;
- synthetic qualification fixtures exposed as engineering methods: `0`.

The synthetic datasets and executable suites remain software-qualification evidence only.
