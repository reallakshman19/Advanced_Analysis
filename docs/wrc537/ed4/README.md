# WRC 537 Edition 4 source-package intake

This directory is the controlled intake boundary for the eventual WRC Bulletin 537 Edition 4 engineering implementation.

## Public identity already populated

The official WRC/Accuris catalog identifies the active publication as:

- bulletin: WRC Bulletin 537;
- edition: 4;
- publication: 02/2026;
- publisher: Welding Research Council, Inc.;
- pages: 202;
- title: *Precision Equations and Enhanced Diagrams for Local Stresses in Spherical and Cylindrical Shells Due to External Loadings for Implementation of WRC Bulletin 107*.

Catalog reference: WRC/Accuris Online Store product `3060583`.

This metadata proves document identity only. It is **not** technical authority for equations, coefficient values, applicability limits, signs, interpolation, stress recovery, or benchmark answers.

## Files

- `WRC537_ED4_SOURCE_PACKAGE.json` — structured technical intake package.
- `WRC537_ED4_SOURCE_LEDGER.csv` — provenance and exact source-locator ledger.
- `WRC537_ED4_COEFFICIENTS.csv` — Edition 4 coefficient/equation numerical rows only.

The coefficient file intentionally starts header-only. Do not copy the mixed-edition inventory from PR #1203 into it merely to obtain row coverage.

## Extraction order

Fill the package in this order:

1. **Technical-source custody**
   - identify the authorized Edition 4 copy;
   - record an internal source ID;
   - calculate SHA-256 of the exact source file;
   - add a `PRIMARY_LICENSED` or `PRIMARY_AUTHORIZED` ledger row carrying the **same SHA-256**;
   - record the license/authorization basis without committing restricted source bytes unless licensing permits repository storage.

2. **Geometry and physical applicability**
   - define every source symbol exactly;
   - distinguish mean/inside/outside radius and thickness definitions;
   - identify supported host-shell and attachment families;
   - record intersection/orientation requirements, load-reference convention and exclusions;
   - bind the applicability block itself to a primary Edition 4 source reference;
   - every consumed definition gets an exact source locator.

3. **Dimensionless parameters**
   - populate `SPHERE_U`, `SPHERE_GAMMA`, `SPHERE_RHO`, `CYL_LAMBDA`, `CYL_DELTA` from Edition 4 only;
   - retain source symbol, exact equation, inputs, min/max and whether each boundary is inclusive;
   - do not promote older-edition equations without explicit Edition 4 verification.

4. **Load and moment conventions**
   - resolve all twelve family/symbol pairs in the package;
   - retain physical direction, positive direction, and exact load application/reference point;
   - resolve torsion signs explicitly.

5. **Stress recovery**
   - inventory all source stress/resultant quantities;
   - classify membrane, bending and shear terms exactly as supported by the source;
   - define inside/outside surface reconstruction;
   - enumerate recovery locations;
   - retain the source definition of stress intensity or equivalent stress measure;
   - independently dimension-check that stress measure and set `dimensionallyVerified=true` only after the check is complete.

6. **Interpolation and extrapolation**
   - state whether each is authorized by Edition 4;
   - retain the exact algorithm and boundary behavior;
   - distinguish source rules from secondary software practice.

7. **Coefficient/equation inventory and numerical data**
   - first establish the complete Edition 4 family/row inventory;
   - then transcribe numeric values;
   - each row must retain a unique coefficient ID, source precision, source-ledger reference, exact equation/table/figure locator, extraction method and `PRIMARY_SOURCE_VERIFIED` status;
   - no secondary-source coefficient can qualify.

8. **Published/reference benchmarks**
   - retain at least one target-edition source case with exact inputs and expected intermediate/final results;
   - independently reproduce every retained release benchmark;
   - tolerance must be based on source precision/digitization uncertainty, not an arbitrary percentage.

9. **LAFEA canonical mapping**
   - map source geometry, load and stress quantities to LAFEA only after source definitions are resolved;
   - mappings must state DIRECT / CONVERTED / DERIVED or another explicit qualified transform;
   - no axis/sign mapping is accepted by similarity of names alone.

## Source-ledger format

For each source item add a unique row to `WRC537_ED4_SOURCE_LEDGER.csv`.

Technical authority rows must use:

```text
PRIMARY_LICENSED
```

or:

```text
PRIMARY_AUTHORIZED
```

and must contain:

- a unique `record_id`;
- publisher `Welding Research Council, Inc.`;
- bulletin number `537`;
- edition `4`;
- publication date `2026-02`;
- SHA-256 `document_digest` of the exact authorized source copy;
- locator precise enough to find the datum again;
- verification status `PRIMARY_SOURCE_VERIFIED`.

The ledger digest must equal `technicalSource.documentDigest` in the package. This prevents data extracted from one document revision/copy from being silently represented as another source artifact.

`OFFICIAL_CATALOG_IDENTITY` may be used only for document identity metadata and does not require a technical-document digest.

## Coefficient row format

Every numerical row uses:

```csv
method_id,edition,coefficient_family,coefficient_id,load_component,stress_component,stress_class,target_location,surface,parameter_1_name,parameter_1_value,parameter_2_name,parameter_2_value,parameter_3_name,parameter_3_value,coefficient_value,published_precision,source_ref,source_locator,extraction_method,review_status
```

Minimum qualifying values include:

```text
method_id = WRC537
edition = a string explicitly identifying Edition 4 and 2026
coefficient_id = unique within the package
coefficient_value = finite number
published_precision = exact retained source precision
source_ref = Edition 4 primary-technical ledger record
source_locator = exact table/equation/figure location
review_status = PRIMARY_SOURCE_VERIFIED
```

## Executable checks

Package-state check:

```bash
node scripts/wrc537-ed4-source-package-check.mjs
```

The current incomplete package is expected to be `BLOCKED`; the ordinary check verifies that it is blocked for the correct reasons.

Release gate:

```bash
node scripts/wrc537-ed4-source-package-check.mjs --release
```

This must remain non-zero until the package is `READY_FOR_TECHNICAL_IMPLEMENTATION`.

Contract self-test:

```bash
node scripts/wrc537-ed4-source-package-self-test.mjs
```

## Prohibited shortcuts

Do not:

- scrape or reconstruct proprietary coefficients from unreliable OCR;
- promote PR #1203 `HIGH/EXTRACTED` rows to Edition 4 authority;
- infer Edition 4 cylindrical parameters from an earlier edition without verification;
- infer force/moment signs from CAESAR/PV Elite or another secondary implementation;
- use catalog prose as technical equation authority;
- invent interpolation/extrapolation behavior;
- activate a WRC537 calculation/profile/UI path before the package release gate is READY.
