# EMP.1 WRC537 professional evidence export

This document describes the durable EMP.1 evidence package introduced for WRC-05. It is a custody and replay contract. It does not create WRC method authority, engineering-use authority, code compliance, release qualification, or deployment authority.

## Contract identity

The package uses the pre-existing EMP.1 schema identity:

`emp1-evidence-export/v1`

The implementation is owned by:

- `src/core/emp1/emp1-engineering-evidence-export.js`
- `src/workspace/emp1-engineering-review-workspace.js`

The focused executable guard is:

- `scripts/emp1-engineering-evidence-export-check.mjs`

## What is exported

An export is created only from an already-retained, current/reportable `emp1-workbench-product-execution/v2` result. The export does not rerun A, B, C, WRC 537, or any benchmark.

The package binds:

- EMP.1 product version and release-profile identity;
- retained A and B engineering source documents;
- the retained workbench source identity and exact input hashes;
- normalized local-method run input;
- retained A, B and C result hashes;
- the assessment and its exact A/B/C/source parent identities;
- the retained WRC method identity, edition, controlled source SHA-256, dataset hash, qualification-record hash, bounded-route qualification SHA-256, and independent-oracle hash;
- the retained route-authority hash and semantic snapshot;
- benchmark projection evidence, including the currently projected CAUx/PV Elite boundary;
- an optional human engineering-review record and its evidence-bound current/stale state;
- explicit method/stress/route limitations; and
- an outer semantic hash over the complete package payload.

The package consumes existing identities. It does not regenerate production result hashes, derive a new WRC authority record, or widen the bounded route.

## Review retention

The workspace review remains session-local until an engineer explicitly exports the current calculation.

When a review record is included in a valid evidence package, the package durably retains that review record and its exact evidence binding. A later import re-evaluates package integrity and then compares the retained evidence to caller-owned live source and route state.

An accepted review is therefore not treated as permanently current. Any bound source/input/result/assessment/route-authority change makes the imported review stale.

Review acceptance remains a human engineering attestation only. It does not create source authority, method authority, applicability authority, numerical authority, code compliance, release qualification, a cryptographic signature, or a professional digital seal.

## Import and replay classification

`requireEmp1EngineeringEvidencePackage(...)` validates retained package integrity only.

`classifyEmp1EngineeringEvidenceImport(...)` additionally compares the validated package with caller-owned current state. The workspace import adapter supplies:

- governed current input hashes produced by `emp1WorkbenchInputHashes(...)` from the current A document, B document and normalized run input; and
- the current route-authority projection.

The core import classifier therefore does not create a second normalization/currentness implementation.

A package is `CURRENT_REUSABLE` only when all retained input hashes match the live inputs, the retained route-authority hash matches the live route-authority hash, the live route remains production-authorized for the bounded route, and the retained execution actually completed bounded C.

Otherwise the package remains valid historical evidence but is classified `HISTORICAL_NON_REPORTABLE`.

Imported fields cannot make themselves current. In particular, imported currentness, route authorization, release authority, and code-compliance flags are never trusted as live authority.

## Fail-closed boundaries

The package and its checks intentionally reject or downgrade:

- unsupported package schemas;
- extra top-level fields such as an injected `current` flag;
- modified source documents without matching retained input hashes;
- route snapshot/hash disagreement;
- altered A/B/C assessment parent identity;
- altered review identity or evidence binding;
- altered benchmark projection without matching package custody;
- live route-authority drift;
- live route suspension; and
- any attempt to mark the package or release profile as release-qualified.

A stale or authority-drifted import is retained as history and is not reportable as the current engineering result.

## Release-manifest custody

The WRC-05 release manifest is now `emp1-release-candidate/v3`. In addition to the pre-existing source, benchmark, build, security and deployment custody, it records:

- product version;
- live route-authority hash and semantic snapshot;
- bounded-route authorization identity;
- current Stage-C preflight status and explicit historical/current execution distinction;
- durable evidence-export gate status;
- engineering-review contract gate status;
- review/readiness integration gate status;
- explicit `caseSpecificHumanReviewAsserted: false` unless a separate case-specific review artifact exists;
- readiness gate status; and
- deployment receipt SHA-256 when release mode supplies one.

The manifest remains non-authorizing. Case-specific human review is still required for an engineering disposition, and neither review acceptance nor manifest generation creates code or release authority.

## Historical evidence

Existing frozen readiness and pre-authorization records are not rewritten. Statements such as the historical observation that no separate durable numerical export existed remain historical provenance.

The live WRC-05 wiring guard distinguishes that frozen observation from the current implementation. This preserves auditability without pretending that historical evidence had knowledge of later product capability.
