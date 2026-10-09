# WRC 537 Edition 4 engineering-dataset promotion

## Purpose

This stage sits **after** the Edition 4 source-package release gate and **before** any WRC537 numerical-method adapter or product registration.

It converts one fully source-qualified Ed4 package into an immutable engineering-dataset candidate while preserving the complete source snapshot.

The promotion does **not** authorize engineering execution.

## Required predecessor state

Promotion is allowed only when:

```text
WRC537_ED4_SOURCE_PACKAGE = READY_FOR_TECHNICAL_IMPLEMENTATION
```

The readiness result is recalculated during promotion. A caller cannot supply or override a PASS state.

If any source-package gate fails, creation throws:

```text
WRC537_ED4_SOURCE_PACKAGE_NOT_READY
```

with the exact failed gate IDs retained on the error.

## Candidate custody

The promoted object retains:

- the complete `WRC537_ED4_SOURCE_PACKAGE.json` snapshot;
- every Edition 4 source-ledger row;
- every Edition 4 coefficient row;
- the exact authorized-source SHA-256 from `technicalSource.documentDigest`;
- promotion identity/version/preparer/reference;
- code-owned authority state;
- semantic hashes for source package, source ledger, coefficients, readiness replay, and final dataset.

The candidate schema is:

```text
wrc537-ed4-engineering-dataset/v1
```

The code-owned authority is always:

```json
{
  "engineeringUseAuthorized": false,
  "authorizationBasis": "SOURCE_QUALIFIED_DATASET_NOT_METHOD_QUALIFIED"
}
```

This is deliberate. Source qualification proves that the extracted data are traceable and internally complete. It does not prove that the eventual WRC537 adapter is correctly implemented or independently qualified.

## Semantic binding

The following bindings are computed with the repository canonical JSON semantic hash:

```text
sourcePackageSemanticHash
sourceLedgerSemanticHash
coefficientRowsSemanticHash
readinessSemanticHash
datasetSemanticHash
```

The authorized source-document digest remains the cryptographic SHA-256 retained by the source package and source ledger.

The semantic hashes provide deterministic software-evidence identity. The document SHA-256 provides exact source-file custody. They have different purposes and must not be substituted for one another.

## Canonical ordering

Source-ledger rows are sorted by:

```text
record_id
```

Coefficient rows are sorted by:

```text
coefficient_id
```

before candidate creation.

Duplicates are rejected. During later validation, retained rows must already be strictly sorted and unique; validation does not silently reorder a supplied candidate before checking its hashes.

This prevents a malformed or altered retained artifact from being normalized into apparent validity.

## Materialization

When the Ed4 source package is READY, first preview the candidate:

```bash
node scripts/wrc537-ed4-engineering-dataset-build.mjs \
  --candidate-id WRC537-ED4-DATASET-001 \
  --candidate-version 1 \
  --prepared-by <qualified-preparer> \
  --preparation-reference <review-or-release-reference>
```

Without `--write`, the candidate is printed but no artifact is created.

After engineering review, materialize and round-trip verify it:

```bash
node scripts/wrc537-ed4-engineering-dataset-build.mjs \
  --candidate-id WRC537-ED4-DATASET-001 \
  --candidate-version 1 \
  --prepared-by <qualified-preparer> \
  --preparation-reference <review-or-release-reference> \
  --write
```

Default output:

```text
docs/wrc537/ed4/WRC537_ED4_ENGINEERING_DATASET.json
```

The writer immediately reads the file back through the candidate validator and requires an identical `datasetSemanticHash`.

## Current repository state

The present Ed4 source package is intentionally BLOCKED because the authorized Edition 4 technical source and its extracted engineering data are not yet present.

Therefore:

- promotion must throw `WRC537_ED4_SOURCE_PACKAGE_NOT_READY`;
- the Edition 4 coefficient CSV remains header-only;
- `WRC537_ED4_ENGINEERING_DATASET.json` must not exist;
- no WRC537 method adapter may consume a promoted dataset;
- no trusted authority or UI execution path is added by this stage.

## Validation scripts

Contract qualification:

```bash
node scripts/wrc537-ed4-engineering-dataset-self-test.mjs
```

Current repository state:

```bash
node scripts/wrc537-ed4-engineering-dataset-check.mjs
```

The self-test proves that a complete synthetic source-authority fixture can be promoted and that tampering is rejected. The repository-state check proves that the current real package cannot be promoted.

## Qualification boundary after promotion

Once a real Ed4 dataset candidate exists, the next engineering stage is **method-adapter implementation and independent numerical qualification**:

```text
READY source package
        ↓
immutable engineering dataset candidate
        ↓
WRC537-specific equations / coefficient evaluator
        ↓
load/sign transformation
        ↓
stress recovery
        ↓
source benchmark reproduction
        ↓
independent hand-calculation ladder
        ↓
qualification evidence
        ↓
approval / trusted authority
        ↓
engineering registry
        ↓
product/UI activation
```

A promoted dataset candidate must never skip directly to the engineering registry.
