# PR #1208 Work Report — WRC 537 Edition 4 Engineering Dataset Promotion

## 1. Purpose

PR #1208 is the custody boundary between:

```text
source-qualified WRC537 Edition 4 extraction
```

and:

```text
an immutable engineering-dataset candidate suitable for numerical-adapter implementation
```

It is intentionally **not** a numerical-method implementation and **not** an engineering authorization.

Parent stack:

```text
PR #1203 — research extraction
PR #1206 — source readiness validator
PR #1207 — Edition 4 controlled source package
PR #1208 — engineering dataset promotion
```

Base branch:

```text
agent/wrc537-ed4-source-package-intake
```

Head branch:

```text
agent/wrc537-ed4-engineering-dataset-promotion
```

## 2. Engineering boundary

The source authority chain is now explicitly:

```text
Authorized WRC537 Ed4 source
        ↓
source SHA-256 custody
        ↓
source-ledger primary authority
        ↓
geometry / applicability
        ↓
U / gamma / rho / lambda / delta
        ↓
load and moment signs
        ↓
stress recovery
        ↓
interpolation / extrapolation
        ↓
coefficient inventory and values
        ↓
source benchmark(s)
        ↓
independent reproduction
        ↓
qualified LAFEA mappings
        ↓
READY_FOR_TECHNICAL_IMPLEMENTATION
        ↓
PR #1208 promotion
        ↓
immutable engineering dataset candidate
        ↓
STOP — still not an executable engineering method
```

The next stage after a real candidate exists is method-adapter implementation and qualification.

## 3. New core contract

File:

```text
src/core/local-attachment-correlation/methods/wrc537/ed4-engineering-dataset.js
```

Schemas:

```text
wrc537-ed4-dataset-promotion/v1
wrc537-ed4-engineering-dataset/v1
```

Creation API:

```text
createWrc537Ed4EngineeringDatasetCandidate(...)
```

Validation API:

```text
validateWrc537Ed4EngineeringDatasetCandidate(...)
```

Explicit activation guard:

```text
engineeringDatasetCandidateCanActivateMethod(...) === false
```

## 4. Promotion precondition

Creation always replays:

```text
evaluateWrc537Ed4SourcePackage(...)
```

The caller cannot supply a PASS result.

If the source package is not:

```text
READY_FOR_TECHNICAL_IMPLEMENTATION
```

creation throws:

```text
WRC537_ED4_SOURCE_PACKAGE_NOT_READY
```

and retains the exact failed source-package gate IDs on the error.

## 5. Candidate contents

The candidate retains the complete source-qualified evidence snapshot:

- exact source package;
- exact source-ledger rows;
- exact coefficient rows;
- retained source-readiness result;
- source document SHA-256;
- promotion metadata;
- code-owned authority state;
- deterministic semantic bindings;
- final dataset semantic hash.

No source content is discarded during promotion.

## 6. Source binding

The candidate retains:

```text
sourceDocumentDigest
sourcePackageSemanticHash
sourceLedgerSemanticHash
coefficientRowsSemanticHash
readinessSemanticHash
datasetSemanticHash
```

`sourceDocumentDigest` is the cryptographic SHA-256 of the exact authorized technical source and is supplied/verified by PR #1207 custody.

The other bindings use the repository canonical JSON semantic hash (`fnv1a64`) for deterministic software-evidence identity.

These serve different purposes and must not be substituted.

## 7. Readiness evidence custody

The complete readiness object is retained as:

```text
sourceReadiness
```

Validation checks:

1. hash of retained readiness equals `readinessSemanticHash`;
2. source package is freshly re-evaluated;
3. fresh readiness hash equals retained readiness hash;
4. retained readiness content equals the fresh replay semantically.

This prevents a caller from keeping valid source data but replacing the gate evidence with an altered or stale PASS record.

## 8. Canonical row policy

Creation sorts source-ledger rows by:

```text
record_id
```

and coefficient rows by:

```text
coefficient_id
```

before hashing.

A candidate supplied for validation must already be strictly sorted and unique.

Validation deliberately does not silently reorder retained evidence before checking it.

The upstream source-package gate already rejects duplicate source and coefficient IDs.

## 9. Authority policy

The candidate authority is code-owned and cannot be supplied by extraction data:

```json
{
  "engineeringUseAuthorized": false,
  "authorizationBasis": "SOURCE_QUALIFIED_DATASET_NOT_METHOD_QUALIFIED"
}
```

This distinction is essential:

```text
source qualification ≠ numerical implementation qualification
```

A correct transcription of WRC data does not prove that software evaluates those data correctly.

## 10. Tamper cases encoded

The self-test encodes rejection of:

- source package not READY;
- duplicate coefficient IDs;
- forged `engineeringUseAuthorized=true`;
- source-package content changed after promotion;
- source-ledger content changed after promotion;
- coefficient value changed after promotion;
- retained readiness evidence changed after promotion;
- retained source-ledger row order changed;
- final dataset semantic hash changed;
- promotion schema changed.

## 11. Synthetic ready fixture

File:

```text
scripts/wrc537-ed4-ready-source-fixture.mjs
```

Purpose:

- prove the promotion contract has a reachable READY path;
- exercise all custody fields without inserting real WRC proprietary technical values;
- prevent a permanently-blocked gate from appearing correct merely because no successful fixture exists.

All fixture technical values are explicitly synthetic contract data.

## 12. Current repository-state check

File:

```text
scripts/wrc537-ed4-engineering-dataset-check.mjs
```

The current real Ed4 package must be blocked by at least:

```text
PRIMARY_TECHNICAL_SOURCE
GEOMETRY_COMPLETE
PARAMETERS_COMPLETE
LOAD_CONVENTIONS_COMPLETE
STRESS_RECOVERY_COMPLETE
INTERPOLATION_POLICY_COMPLETE
COEFFICIENT_INVENTORY_DECLARED
COEFFICIENTS_COMPLETE
BENCHMARKS_COMPLETE
LAFEA_MAPPING_COMPLETE
```

It additionally requires:

```text
WRC537_ED4_COEFFICIENTS.csv = header-only
```

and:

```text
WRC537_ED4_ENGINEERING_DATASET.json = absent
```

while the package remains blocked.

## 13. Materializer

File:

```text
scripts/wrc537-ed4-engineering-dataset-build.mjs
```

Required metadata:

```text
--candidate-id
--candidate-version
--prepared-by
--preparation-reference
```

Default behavior:

```text
preview only; do not write artifact
```

Explicit materialization:

```text
--write
```

When writing, the script immediately re-reads the JSON through the validator and requires an identical `datasetSemanticHash`.

The current blocked source package cannot reach the writer.

## 14. Documentation

Added:

```text
docs/wrc537/ed4/ENGINEERING_DATASET_PROMOTION.md
```

It defines:

- predecessor state;
- candidate custody;
- semantic/hash policy;
- canonical ordering;
- materialization workflow;
- present blocked state;
- next qualification boundary.

## 15. Files added by PR #1208

```text
src/core/local-attachment-correlation/methods/wrc537/ed4-engineering-dataset.js
scripts/wrc537-ed4-ready-source-fixture.mjs
scripts/wrc537-ed4-engineering-dataset-self-test.mjs
scripts/wrc537-ed4-engineering-dataset-check.mjs
scripts/wrc537-ed4-engineering-dataset-build.mjs
docs/wrc537/ed4/ENGINEERING_DATASET_PROMOTION.md
agents/PR1208_workreport.md
```

## 16. Validation status

Encoded checks:

```bash
node scripts/wrc537-ed4-engineering-dataset-self-test.mjs
node scripts/wrc537-ed4-engineering-dataset-check.mjs
```

Future materialization:

```bash
node scripts/wrc537-ed4-engineering-dataset-build.mjs ...
```

Execution status in this agent environment:

```text
NOT_RUN
```

Reason:

- no local repository checkout/runtime path was available for direct execution;
- GitHub Actions/workflow execution is intentionally not used as a substitute.

No unexecuted check is claimed PASS.

## 17. Current blockers

The engineering dataset cannot yet be created from real data because PR #1207 is intentionally incomplete.

The principal missing authority remains:

```text
authorized WRC Bulletin 537 Edition 4 technical source
```

followed by source-qualified extraction of all technical fields and coefficients.

## 18. What the next engineer must not do

Do not:

- materialize a real dataset from the current blocked package;
- copy PR #1203 mixed-edition coefficients into the Ed4 file;
- mark a source-qualified dataset as engineering-use authorized;
- connect this candidate directly to the engineering registry;
- implement WRC math from secondary-source memory;
- bypass source readiness by constructing a dataset object manually;
- use semantic hashes as a replacement for the authorized document SHA-256;
- infer load/sign mappings by matching names only.

## 19. Next stage after real source extraction

Once PR #1207 becomes READY and PR #1208 materializes a real dataset candidate, create a separate successor PR for:

```text
methods/wrc537 numerical adapter
```

That PR must implement, source-by-source:

1. source parameter evaluation;
2. coefficient/equation evaluation;
3. interpolation exactly as authorized;
4. load/sign transformation;
5. membrane/bending/shear recovery;
6. surface reconstruction;
7. source stress measure/post-processing distinction;
8. deterministic calculation trace;
9. published benchmark reproduction;
10. independent hand-calculation qualification.

Only after numerical qualification should the existing qualification-record / release-candidate / trusted-authority / engineering-registry chain be used.

## 20. Takeover questions

Before implementing the numerical adapter, the next engineer must be able to answer all of the following from source-qualified Ed4 data:

1. What exact Edition 4 equations define each shell/attachment parameter?
2. What are the exact inclusive/exclusive bounds for every independent parameter?
3. Which attachment families are supported for cylindrical shells?
4. Which attachment families are supported for spherical shells?
5. What exact load reference point does WRC use?
6. What is the positive sign of every supported force and moment?
7. What WRC quantity maps to each LAFEA load component?
8. Which stress/resultant components are source outputs?
9. Which locations/surfaces are source recovery points?
10. How are membrane and bending terms combined on each surface?
11. What interpolation algorithm is authorized?
12. Is extrapolation authorized anywhere?
13. How is each coefficient/equation family selected?
14. What published precision is retained for every coefficient?
15. What source examples are available for independent reproduction?
16. What tolerance follows from source precision?
17. Which derived quantities are WRC outputs versus LAFEA post-processing?
18. Can every computed intermediate value be traced to source locator + dataset hash?
19. Does any implementation branch require another WRC bulletin or external publication?
20. Are any residual unresolved fields still capable of affecting a numerical result?

If any answer is unresolved, numerical-method qualification is not complete.
