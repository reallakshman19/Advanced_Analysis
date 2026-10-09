# PR1207 Work Report — WRC 537 Edition 4 Source Package Intake

## Status

- PR: #1207
- Title: `WRC537 Ed4: add source package intake contract`
- Branch: `agent/wrc537-ed4-source-package-intake`
- Base: `agent/wrc537-source-readiness-validator` / PR #1206
- State: DRAFT
- Numerical WRC537 implementation: NOT PRESENT
- Engineering method activation: NOT PRESENT
- Current source-package state: BLOCKED by design

## Objective

Create the exact data-custody boundary required before any WRC Bulletin 537 Edition 4 numerical implementation can be written or activated.

The package is intentionally separate from the mixed-edition research merged in PR #1203. PR #1203 remains useful research evidence, but nothing from it is automatically promoted to Edition 4 technical authority.

## Official identity established

Public publisher/catalog metadata currently establishes only:

- Bulletin: WRC Bulletin 537
- Edition: 4
- Published: 02/2026
- Publisher: Welding Research Council, Inc.
- Pages: 202
- Catalog product: 3060583

This identity is retained as `OFFICIAL_CATALOG_IDENTITY` and `IDENTITY_METADATA_ONLY`.

It cannot authorize:

- equations;
- geometry definitions;
- applicability limits;
- force/moment signs;
- stress reconstruction;
- interpolation/extrapolation;
- coefficients;
- benchmark answers.

## New artifacts

### Core contract

`src/core/local-attachment-correlation/methods/wrc537/ed4-source-package.js`

Defines:

- `wrc537-ed4-source-package/v1`;
- `READY_FOR_TECHNICAL_IMPLEMENTATION`;
- `BLOCKED`;
- target identity `WRC Bulletin 537 / Edition 4 / 2026-02`;
- primary technical authority classes `PRIMARY_LICENSED` and `PRIMARY_AUTHORIZED`;
- full package-readiness evaluation.

### Data package

`docs/wrc537/ed4/WRC537_ED4_SOURCE_PACKAGE.json`

Contains structured slots for:

1. identity;
2. authorized technical source custody;
3. geometry definitions;
4. physical applicability;
5. five required dimensionless parameter families;
6. twelve force/moment conventions;
7. stress recovery;
8. interpolation/extrapolation;
9. coefficient inventory custody;
10. source benchmarks;
11. LAFEA canonical mapping.

All technical fields not established from Edition 4 are explicitly unresolved.

### Source ledger

`docs/wrc537/ed4/WRC537_ED4_SOURCE_LEDGER.csv`

Current ledger contains only the public catalog identity record.

Future technical authority rows must include:

- unique record ID;
- authority class `PRIMARY_LICENSED` or `PRIMARY_AUTHORIZED`;
- publisher `Welding Research Council, Inc.`;
- bulletin 537;
- edition 4;
- publication date 2026-02;
- SHA-256 of exact authorized document;
- source locator;
- `PRIMARY_SOURCE_VERIFIED`.

The primary ledger digest must equal `technicalSource.documentDigest`.

### Coefficient file

`docs/wrc537/ed4/WRC537_ED4_COEFFICIENTS.csv`

The file intentionally contains **headers only**.

Reason:

The PR #1203 SP/SM inventory was reconstructed from older/mixed-edition sources. Copying those rows into the Edition 4 authority package would prematurely assert that Edition 4 has the identical coefficient inventory.

Edition 4 inventory must first be checked against the authorized Edition 4 source.

## Readiness gates

The source package cannot become READY unless all of these pass:

1. `PACKAGE_SCHEMA`
2. `SOURCE_LEDGER_IDS_UNIQUE`
3. `EDITION_IDENTITY`
4. `CATALOG_IDENTITY_SOURCE`
5. `PRIMARY_TECHNICAL_SOURCE`
6. `GEOMETRY_COMPLETE`
7. `PARAMETERS_COMPLETE`
8. `LOAD_CONVENTIONS_COMPLETE`
9. `STRESS_RECOVERY_COMPLETE`
10. `INTERPOLATION_POLICY_COMPLETE`
11. `COEFFICIENT_INVENTORY_DECLARED`
12. `COEFFICIENT_IDS_UNIQUE`
13. `COEFFICIENTS_COMPLETE`
14. `BENCHMARKS_COMPLETE`
15. `LAFEA_MAPPING_COMPLETE`
16. `NO_UNRESOLVED_TECHNICAL_FIELDS`

## Required parameter set

The contract currently requires source qualification of:

- `SPHERE_U`
- `SPHERE_GAMMA`
- `SPHERE_RHO`
- `CYL_LAMBDA`
- `CYL_DELTA`

For every parameter, the operator must retain:

- source symbol;
- exact equation;
- exact inputs;
- minimum;
- maximum;
- minimum-bound inclusivity;
- maximum-bound inclusivity;
- Edition 4 primary source reference.

No range may be inferred merely from older charts or secondary software behavior.

## Required load/sign set

### Spherical family

- P
- V1
- V2
- M1
- M2
- Mt

### Cylindrical family

- P
- Vc
- Vl
- Mc
- Ml
- Mt

For each:

- physical direction;
- positive direction;
- load/moment reference point;
- primary source reference.

The contract deliberately treats torsional sign custody as mandatory.

## Physical applicability custody

Physical applicability is not accepted as free text without source authority.

The Edition 4 source must establish:

- host shell families;
- attachment families;
- intersection/orientation rule;
- load-reference convention;
- explicit exclusions;
- primary source reference for the applicability definition itself.

## Stress-recovery custody

Before numerical implementation, retain:

- source stress/resultant symbols;
- meaning;
- membrane/bending/shear classification;
- recovery locations;
- inside/outside surfaces;
- membrane+bending surface reconstruction rule;
- source stress-intensity/equivalent-stress definition;
- primary source locator.

The stress-intensity/equivalent-stress definition must also set:

`dimensionallyVerified = true`

Only after an independent dimensional check.

This specifically prevents the dimensionally inconsistent outer-square-root expression present in the PR #1203 research note from becoming authority accidentally.

## Coefficient qualification rule

A coefficient row qualifies only when:

- `method_id = WRC537`;
- edition string explicitly identifies Edition 4 and 2026;
- coefficient ID is unique;
- numerical value is finite;
- published precision is retained;
- source reference resolves to Edition 4 primary technical authority;
- exact source locator is retained;
- status is `PRIMARY_SOURCE_VERIFIED`.

## Benchmark qualification rule

At least one Edition 4 source benchmark is required.

Every release benchmark must retain:

- case ID;
- Edition 4 primary source reference;
- exact inputs;
- expected results;
- units;
- tolerance basis;
- `targetEditionPrimarySourceVerified = true`;
- `independentlyReproduced = true`.

A secondary software example is not sufficient by itself for this gate.

## LAFEA mapping rule

Mapping occurs only after source definitions are known.

Required mapping families:

- source geometry -> LAFEA geometry;
- source load/moment components -> LAFEA load custody;
- source stress components -> LAFEA result fields.

Mapping cannot be accepted merely because labels look similar.

## Check scripts

Encoded:

```bash
node scripts/wrc537-ed4-source-package-self-test.mjs
node scripts/wrc537-ed4-source-package-check.mjs
node scripts/wrc537-ed4-source-package-check.mjs --release
```

Expected current engineering state:

```text
BLOCKED
```

The ordinary package check is intended to confirm the repository remains correctly blocked.

The release check must return non-zero until every authority gate is satisfied.

## Self-test coverage encoded

The self-test includes a complete synthetic authority package that should reach READY, plus independent rejection cases for:

- duplicate source-ledger IDs;
- catalog metadata used as technical authority;
- invalid SHA-256;
- mismatched ledger/package digest;
- older/mixed edition technical source;
- unresolved geometry;
- applicability without primary custody;
- unresolved parameter boundary;
- unresolved load sign;
- unresolved surface reconstruction;
- unverified dimensional stress measure;
- unresolved interpolation policy;
- undeclared coefficient inventory;
- duplicate coefficient IDs;
- old-edition coefficient;
- missing coefficient precision;
- unreproduced benchmark;
- unqualified LAFEA mapping;
- generic unresolved technical values.

## Validation ledger

| Check | Status | Evidence |
|---|---|---|
| Connector branch ancestry | REVIEWED | Child branch is based exactly on PR #1206 head when created |
| Diff scope | REVIEWED | Ed4 source-package files only |
| Public Edition 4 identity | VERIFIED | Official WRC/Accuris catalog metadata |
| Numerical WRC537 coefficient extraction | NOT PERFORMED | No authorized Edition 4 source supplied |
| Package state script | NOT_RUN | Encoded only |
| Contract self-test | NOT_RUN | Encoded only |
| Release gate | NOT_RUN | Encoded only; expected to block |
| GitHub Actions | NOT_RUN | Explicitly excluded from this workstream |

No unexecuted test is represented as passing.

## Current blockers

### B1 — Authorized Edition 4 technical source

Need an authorized/licensed WRC 537 Edition 4 technical source.

Required first evidence:

- source ID;
- access/license basis;
- SHA-256;
- edition/date verification;
- primary ledger row.

### B2 — Edition 4 geometry/applicability extraction

All current technical geometry slots remain unresolved.

### B3 — Edition 4 parameter equations/domains

Especially cylindrical lambda/delta; no older-edition inference is permitted.

### B4 — Load/sign conventions

All twelve source conventions must be checked from Edition 4.

### B5 — Stress reconstruction and stress measure

Requires direct source verification and independent dimensional review.

### B6 — Interpolation/extrapolation

Requires Edition 4 authority, not secondary software practice.

### B7 — Coefficient/equation inventory and values

Ed4 file intentionally empty pending authorized extraction.

### B8 — Benchmarks

Need at least one Edition 4 source/reference numerical case and independent reproduction.

### B9 — LAFEA mapping

Must wait until the source coordinate, sign and geometry definitions are settled.

## Exact next action when the authorized Edition 4 source is available

1. Compute SHA-256 of the exact source file.
2. Add primary technical source-ledger row.
3. Fill `technicalSource` custody fields.
4. Extract geometry nomenclature and applicability with exact locators.
5. Extract all five parameter equations and domains.
6. Extract all twelve load conventions.
7. Extract stress/resultant definitions, locations and reconstruction.
8. Verify source stress measure dimensionally.
9. Extract interpolation/extrapolation rules.
10. Build the **Edition 4** coefficient/equation inventory.
11. Transcribe numerical values with published precision.
12. Extract source benchmark(s).
13. Independently reproduce benchmark(s).
14. Complete LAFEA canonical mapping.
15. Run package ordinary check.
16. Run package release gate.
17. Only if READY: hand the qualified package to the downstream WRC537 numerical adapter workstream.

## Questions for the next engineer

1. Is the supplied source definitely Edition 4 dated February 2026?
2. What SHA-256 identifies the exact authorized source copy?
3. Does the license permit local extraction into machine-readable engineering data?
4. Does it permit committing the extracted coefficients to this repository?
5. Are there Edition 4 amendments/corrections that must be included in the source identity?
6. Does Edition 4 materially change the older SP/SM chart inventory?
7. Does Edition 4 retain the same spherical parameter definitions?
8. What are the exact Edition 4 cylindrical lambda/delta definitions?
9. Are all parameter domain boundaries explicitly inclusive/exclusive?
10. Are different domains used for different attachment families?
11. Is interpolation specified directly by the bulletin or only by engineering practice?
12. Does Edition 4 authorize extrapolation, and if so under precisely what conditions?
13. What is the exact positive torsional convention for each shell family?
14. Are load moments defined at the shell interface/midsurface/outer surface or another reference?
15. Are remote-point moment translations part of WRC or a LAFEA/piping policy?
16. Which stress components are source outputs versus software post-processing?
17. How are membrane and bending terms reconstructed at inner and outer surfaces?
18. What is the exact source definition of stress intensity/equivalent stress?
19. Is that source expression dimensionally consistent as printed?
20. Are principal stresses an explicit source output or LAFEA post-processing?
21. What recovery locations are mandatory for each attachment/shell family?
22. Does Edition 4 identify off-junction peak-stress treatment?
23. Is the coefficient representation polynomial, tabular, chart-based, or mixed by family?
24. How many independent coefficient families exist in Edition 4?
25. Are coefficients dimensionless in every family?
26. What source precision is printed for each coefficient family?
27. Are any Edition 4 coefficients supplied via formulas rather than numeric tables?
28. Are there source examples for both spherical and cylindrical cases?
29. Do source examples expose intermediate coefficient/resultant values suitable for qualification?
30. What tolerance follows from published precision for each example?
31. Does Edition 4 include errata/corrections already incorporated into the base document?
32. How should source corrections be represented in the ledger?
33. Can every extracted coefficient be traced to exact page/table/equation/figure location?
34. Does the LAFEA coordinate convention require a rotation/sign transform from WRC axes?
35. Is any currently planned LAFEA.2 geometry field insufficient to prove WRC physical applicability?
36. Should some WRC537 configurations be routed to a separate LAFEA stage rather than LAFEA.2?
37. Which source outputs belong to shell only versus nozzle/attachment stress?
38. What project thickness convention should remain external policy rather than WRC authority?
39. Should pressure stress remain a separately audited contribution?
40. What exact evidence will authorize transition from source-package READY to numerical-adapter development?
