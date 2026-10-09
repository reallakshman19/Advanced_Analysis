# PR 1211 work report — consolidated WRC537 Edition 4 source-to-evaluator batch

## 1. Current PR role

PR #1211 is the single canonical WRC537 Edition 4 source-to-evaluator batch.

```text
base = main
state = DRAFT / OPEN
merge authorization = NOT GRANTED
engineering activation = BLOCKED
```

Earlier draft PRs #1206, #1207, #1208 and #1210 remain unmerged historical slices. Their implementation content is cumulatively represented here; they are not separate merge prerequisites.

## 2. Engineering objective

Provide one fail-closed chain:

```text
AUTHORIZED WRC537 EDITION 4 SOURCE
        ↓
exact source SHA-256 custody
        ↓
DOCUMENT + DATUM provenance
        ↓
source package READY_FOR_TECHNICAL_IMPLEMENTATION
        ↓
immutable engineering dataset candidate
        ↓
source-bound calculation plan
        ↓
reviewed executable mathematical graph
        ↓
deterministic execution trace
        ↓
term-complete numerical qualification
        ↓
exact source-qualified benchmark input/output custody
        ↓
numeric literal / coefficient custody
        ↓
numerical release candidate
        ↓
STOP — independent approval / trusted registry
```

No step in this PR grants engineering authority.

## 3. Current real engineering state

Available only:

```text
WRC Bulletin 537 public catalog identity
Edition 4
publication 2026-02
```

Still unavailable in authorized technical-source custody:

```text
licensed/authorized Edition 4 source artifact
complete geometry/applicability definitions
U / gamma / rho / lambda / delta equations and limits
all 12 load/moment positive directions and reference points
stress recovery and source stress measure
interpolation/extrapolation rules
Edition 4 coefficient/equation inventory and values
published/reference benchmark inputs/outputs
real WRC-to-LAFEA canonical mapping
```

Therefore the real method remains **BLOCKED**. No missing technical value is promoted from PR #1203, older editions, OCR, secondary software, or synthetic fixtures.

## 4. Source authority model

The source ledger distinguishes:

```text
DOCUMENT_IDENTITY
DOCUMENT
DATUM
```

`DOCUMENT_IDENTITY` establishes catalog identity only.

`DOCUMENT` establishes custody of the exact authorized Edition 4 source artifact and its SHA-256.

Every consumed `DATUM` requires:

```text
record_scope = DATUM
engineering_subject
authority_class = PRIMARY_LICENSED | PRIMARY_AUTHORIZED
publisher = Welding Research Council, Inc.
bulletin_number = 537
edition = 4
publication_date = 2026-02
document_digest = exact technicalSource.documentDigest
locator
verification_status = PRIMARY_SOURCE_VERIFIED
```

## 5. Source-package READY gate

Before `READY_FOR_TECHNICAL_IMPLEMENTATION`, the package requires complete source authority for:

```text
geometry / applicability
five dimensionless parameters
all twelve load conventions
stress components/recovery/surfaces/source stress measure
interpolation/extrapolation
coefficient inventory, values, precision and locators
source benchmark inputs, units, input locators and expected outputs
LAFEA mappings
```

Parameter ranges require `minimum < maximum`. Duplicate parameter/load identities are rejected. Coefficient source locator must equal the retained datum locator.

Mandatory load identities:

```text
spherical:P
spherical:V1
spherical:V2
spherical:M1
spherical:M2
spherical:Mt
cylindrical:P
cylindrical:Vc
cylindrical:Vl
cylindrical:Mc
cylindrical:Ml
cylindrical:Mt
```

## 6. Source benchmark input evidence at READY

A benchmark may preserve a natural nested input object, but **every finite numeric input leaf** requires one `inputEvidence[]` row.

Example:

```json
{
  "inputId": "GEOMETRY_R",
  "benchmarkPath": ["geometry", "R"],
  "units": "mm",
  "sourceRef": "DATUM-WRC537-ED4-BENCHMARK-001",
  "sourceLocator": "exact source locator"
}
```

READY requires:

```text
unique inputId
valid path to finite source input value
explicit source units
exact Edition 4 DATUM source reference
source locator == DATUM locator
datum digest == exact source-document SHA-256
100% finite numeric input-leaf coverage
no duplicate path custody
```

This prevents a bare numeric value such as `100` from being treated as sufficient benchmark evidence without proving whether it means `100 mm`, `100 in`, `100 N`, etc.

## 7. Engineering dataset

Only a READY package may create the immutable engineering dataset candidate. It freezes source package, source ledger, coefficients, source SHA-256, readiness evidence and semantic hashes.

Authority remains:

```text
engineeringUseAuthorized = false
SOURCE_QUALIFIED_DATASET_NOT_METHOD_QUALIFIED
```

## 8. Source-bound calculation plan

The calculation plan binds one exact dataset and retains source-qualified definitions for family, coordinate system, load reference, variables, equations, interpolation, recovery targets, combination rules and post-processing.

Every numerical-plan source item must resolve to a primary Edition 4 DATUM with exact source digest and locator.

## 9. Safe executable representation

No `eval()` or dynamic `Function()` path exists.

Reviewed primitives:

```text
VAR CONST ADD SUB MUL DIV NEG ABS SQRT POW MIN MAX POLYNOMIAL LINEAR_INTERPOLATE
```

These are software capabilities only, not WRC mathematical claims.

Every executable equation/rule requires exact plan binding, source locator, units, dimensions, dimension audit and deterministic execution order.

## 10. Numerical safety and interpolation custody

The evaluator fails closed on missing/extra/duplicate inputs, wrong units, unknown variables, forward references, unsupported operators, non-finite values, division by zero, SQRT domain errors, zero interpolation span, unauthorized interpolation/extrapolation and missing recovery values.

Every `LINEAR_INTERPOLATE` node is recursively bound to source-package interpolation/extrapolation authority, including nested nodes.

No silent unit conversion exists.

## 11. Qualification evidence

Qualification is term-complete.

Every case requires expected values for every executable step and every declared recovery result. Expected values retain:

```text
value
units
absoluteTolerance
toleranceBasis
sourceRef
sourceLocator
```

Each case also requires:

```text
independentReproduction = true
independentCalculationReference = non-empty
```

Qualification PASS is deliberately **not sufficient** for numerical release. Supplemental diagnostic/hand-calculation cases may PASS without being source benchmarks.

## 12. Source-benchmark numerical-release custody

A numerical release candidate requires `benchmarkBindings` covering **every retained source benchmark exactly once**.

Each benchmark binds to one qualification case with exact benchmark source datum/locator and exact independent calculation reference.

### 12.1 Input bindings consume source-qualified evidence IDs

Release bindings do not supply source paths/units/locators. They only reference evidence already frozen into the dataset:

```json
{
  "variableId": "P",
  "benchmarkInputId": "LOAD_P"
}
```

Release proves:

```text
qualification request value == retained benchmark input value
qualification request units == retained inputEvidence.units
```

The binding set must cover every qualification request variable and every retained benchmark input-evidence ID exactly once.

Because READY already proves 100% numeric benchmark input-leaf coverage, the end-to-end chain is:

```text
source numeric input leaf
→ source-qualified value + units + locator
→ benchmarkInputId
→ qualification runtime variable
→ executable plan
```

### 12.2 Recovery bindings

Every retained source benchmark expected result maps exactly once to an expected qualification recovery result with exact equality of:

```text
value
units
absoluteTolerance
toleranceBasis
sourceRef
sourceLocator
```

A self-consistent result with altered source output or tolerance cannot become source-benchmark reproduction evidence.

Focused contract:

`docs/wrc537/ed4/SOURCE_BENCHMARK_RELEASE_CUSTODY.md`

## 13. Numeric literal/coefficient custody

Every executable numeric literal is inventoried.

Allowed classes:

```text
DATASET_COEFFICIENT
SOURCE_LITERAL
```

Dataset coefficient bindings require exact retained coefficient ID/value/source reference/source locator.

Graph variable references must equal source-plan declared input-variable IDs exactly.

## 14. Numerical release candidate

Creation requires:

```text
READY-derived dataset
source-bound calculation plan
validated executable plan
replayed numerical qualification PASS
exact graph-input custody
100% retained source-benchmark coverage
exact source-qualified benchmark input value + unit mapping
exact source benchmark recovery/tolerance/source mapping
exact independent reproduction reference
complete literal/coefficient custody
```

Authority remains:

```text
engineeringUseAuthorized = false
NUMERICALLY_QUALIFIED_CANDIDATE_AWAITING_INDEPENDENT_APPROVAL_AND_TRUST
```

## 15. Pipeline

```bash
node scripts/wrc537-ed4-source-to-evaluator-pipeline.mjs
```

States:

```text
SOURCE_PACKAGE_BLOCKED
SOURCE_BOUND_CALCULATION_PLAN_REQUIRED
EXECUTABLE_PLAN_REQUIRED
QUALIFICATION_SUITE_REQUIRED
NUMERICAL_QUALIFICATION_FAILED
SOURCE_BENCHMARK_CUSTODY_REQUIRED
NUMERIC_LITERAL_CUSTODY_REQUIRED
NUMERICAL_RELEASE_CANDIDATE_AWAITING_APPROVAL_AND_TRUST
```

Release artifacts include:

```text
WRC537_ED4_BENCHMARK_BINDINGS.json
WRC537_ED4_LITERAL_BINDINGS.json
WRC537_ED4_NUMERICAL_RELEASE_CANDIDATE.json
```

These must remain absent while the real source package is BLOCKED.

## 16. Product/registry boundary

The reviewed WRC method module set is limited to source readiness, source package, engineering dataset, numerical adapter, execution engine, qualification engine and numerical release candidate.

The boundary guard requires WRC537 to remain absent from product/index/engineering-registry/engineering-assessment/trusted-authority activation paths.

No UI Run action is activated.

## 17. Stack-level defects found and fixed

### A — READY could outrun datum provenance

Fixed by requiring DATUM-level custody before READY.

### B — DATUM digest could differ from the exact technical source digest

Fixed by requiring every consumed DATUM digest to equal `technicalSource.documentDigest`.

### C — executable extrapolation could override source policy

Fixed by recursively binding interpolation/extrapolation primitives to source-package authority.

### D — legacy source-boundary guard contradicted later reviewed modules

Fixed by permitting only the exact reviewed module set while still forbidding activation paths.

### E — qualification PASS could bypass retained source benchmarks

Fixed by requiring one-to-one retained source-benchmark bindings at numerical release.

### F — retained benchmark numeric inputs could be partially omitted

Fixed by requiring 100% finite numeric benchmark input-leaf source evidence before READY and full evidence-ID coverage at release.

### G — benchmark numeric values had no source unit/locator custody

Previous state:

```text
benchmark input value = 100
```

could be retained without machine proof of units/source locator.

Effect:

A numerically identical but physically wrong input basis could theoretically be represented by the same floating-point value.

Fix:

Every numeric source benchmark input now requires source-qualified `inputEvidence` containing units and exact DATUM locator before READY. Release runtime units must exactly equal those retained source units.

## 18. Synthetic contract fixtures

Software-only fixtures include:

```text
1000 N / 100 mm² = 10 MPa
(1000 / 100) × 1.234 = 12.34 MPa
```

They are not WRC537 technical data or engineering validation cases.

Regressions encode rejection of incomplete benchmark input units/locators, missing numeric input-leaf evidence, missing benchmark release coverage, unknown benchmark input evidence IDs, self-consistent but wrong benchmark inputs/recoveries, mismatched independent calculation references, incorrect coefficient custody and forged authority.

## 19. Validation ledger

| Check | Status | Evidence / limitation |
|---|---|---|
| Connector branch/PR state review | REVIEWED | PR remains draft/open/unmerged |
| Source authority boundary review | REVIEWED | Real source remains BLOCKED |
| Benchmark input unit/source-custody review | REVIEWED | READY now source-qualifies value/unit/locator |
| Benchmark release-custody static review | REVIEWED | Release maps only retained inputEvidence IDs |
| Pipeline state review | REVIEWED | source benchmark gate retained |
| Source-package benchmark regressions | ENCODED / NOT_RUN | unit/locator/leaf coverage negative cases added |
| Release-candidate benchmark regressions | ENCODED / NOT_RUN | source benchmark mapping negative cases added |
| Full Node regression suite | NOT_RUN | no executable repository checkout available in this agent context |
| GitHub Actions/workflows | NOT_RUN | explicitly excluded from this workstream |

Selected constructed JavaScript revisions were syntax-checked before connector upload during this work. That is not represented as execution of the repository regression suite.

No unexecuted regression is claimed as PASS.

## 20. Review/merge posture

PR #1211 is the canonical review target and remains draft/open/unmerged.

Fresh explicit user authorization is required before merge.

## 21. Remaining P0 external dependency

The next real engineering input is an authorized/licensed WRC Bulletin 537 Edition 4 technical source.

Once supplied:

```text
exact source SHA-256
→ DOCUMENT/DATUM extraction
→ benchmark input value/unit/locator evidence
→ READY source package
→ immutable dataset
→ real calculation plan
→ actual source mathematical graph
→ term-complete source/hand benchmark qualification
→ exact source benchmark bindings
→ literal/coefficient bindings
→ numerical release candidate
→ independent approval/trust
→ registry/product integration
```

## Appendix A — takeover questions

1. What exact Edition 4 source artifact SHA-256 is authoritative?
2. What licensing/authorization basis permits implementation use?
3. Are all consumed DATUM rows bound to that exact digest?
4. What are the exact source definitions of Rm, Rc, T, r0, rm, t, C1 and C2 where applicable?
5. What thickness basis is required: nominal, corroded, effective, or another definition?
6. What are the exact equations for U, gamma, rho, lambda and delta?
7. What are each parameter's inclusive/exclusive numerical limits?
8. Are any parameter domains shell-family or attachment-family dependent?
9. What are the exact spherical positive directions for P, V1, V2, M1, M2 and Mt?
10. What are the exact cylindrical positive directions for P, Vc, Vl, Mc, Ml and Mt?
11. What is the source load/moment reference point?
12. Is remote-load translation part of WRC537 or a separate LAFEA/piping policy?
13. What coordinate basis defines source axial/circumferential/local directions?
14. What host-shell/attachment/intersection topologies are supported?
15. What topologies/proximity conditions are explicitly excluded?
16. What recovery locations exist and how are they geometrically defined?
17. What surfaces are reported at each location?
18. How are membrane and bending terms reconstructed at inner/outer surfaces?
19. What shear components are source outputs and what signs apply?
20. Does Edition 4 define stress intensity/equivalent stress, or is that LAFEA post-processing?
21. Has every retained stress-measure expression been independently dimension-checked?
22. What coefficient/equation families exist in Edition 4?
23. Has every coefficient been extracted with displayed precision and exact locator?
24. What interpolation algorithm is source-authorized for each family?
25. Is extrapolation authorized, and under what exact conditions/ranges?
26. Are interpolation/extrapolation rules family-specific?
27. What published/reference numerical examples are retained from Edition 4?
28. Does each benchmark retain every numeric geometry/load input consumed by the method?
29. Does every finite numeric benchmark input leaf have exactly one inputEvidence ID?
30. What source units apply to every retained benchmark input value?
31. Is every benchmark input unit bound to an exact Edition 4 DATUM locator?
32. Are benchmark inputs reported in units different from the canonical executable-plan units?
33. If conversion is required, where is that conversion explicitly source/policy-qualified rather than silently applied?
34. What exact source output quantities are retained for each benchmark?
35. Does every source output map to one calculation-plan recovery target/result variable?
36. What absolute tolerance follows from source displayed precision for each output?
37. Is every benchmark independent calculation reference genuinely independent of the software evaluator?
38. Can every benchmark intermediate be independently reconstructed when not printed by the source?
39. What is the first divergent intermediate when a benchmark fails?
40. Does the real LAFEA mapping preserve all source signs, axes, locations and surfaces?
41. Are pressure stresses separate from the WRC external-load result?
42. Are principal/Tresca/von-Mises results source outputs or separate LAFEA post-processing?
43. Does every executable graph reference exactly the variables declared by its source equation/rule?
44. Is every executable numeric literal source-bound or dataset-coefficient-bound?
45. Has every interpolation primitive been checked against source interpolation/extrapolation authority?
46. Does the numerical release candidate cover 100% of retained source benchmarks exactly once?
47. Can one qualification case accidentally be reused for two source benchmarks?
48. Does every release input binding reference a source-qualified benchmarkInputId rather than a caller-authored path/unit?
49. Does every release binding cover every retained benchmark inputEvidence ID exactly once?
50. Do runtime request units exactly equal retained source benchmark input units?
51. Does every benchmark binding cover every source expected result exactly once?
52. Do recovery bindings preserve exact value, units, tolerance basis and locator?
53. Does the bound qualification case retain the exact benchmark independent calculation reference?
54. Has numerical qualification passed before any approval/trust request?
55. Is approval authority explicitly trusted by code rather than caller-supplied?
56. Does product/UI activation remain impossible until source, numerical, benchmark, approval and trust gates all pass?
57. Has any older-edition/secondary-source datum entered the Edition 4 release dataset?
58. Can any source benchmark numeric input remain unitless or source-locator-free at READY?
