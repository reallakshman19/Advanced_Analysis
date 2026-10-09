# WRC537 Edition 4 source-benchmark release custody

## Purpose

This contract closes the boundary between **numerical qualification evidence** and a **numerical release candidate**.

A qualification case may be useful for diagnostics, hand-calculation development, sign checks, isolated equation checks, or supplemental numerical coverage. A self-consistent qualification PASS by itself is not sufficient evidence that the implementation reproduces an authoritative WRC537 Edition 4 source benchmark.

Before a numerical release candidate can exist, the software must prove that every benchmark retained in the source-qualified Edition 4 dataset has been reproduced by a specific qualification case with exact source-qualified input and result custody.

This contract does not supply WRC537 technical data and does not grant engineering authority.

## Authority sequence

```text
source benchmark extracted from authorized Edition 4 source
        ↓
source-qualified benchmark inputEvidence[]
        ↓
source-package READY
        ↓
term-complete qualification case
        ↓
qualification PASS
        ↓
source-benchmark release binding
        ↓
numeric literal/coefficient custody
        ↓
numerical release candidate
        ↓
STOP — independent approval/trust still required
```

The numerical release candidate retains:

```text
engineeringUseAuthorized = false
```

## Why qualification PASS alone is insufficient

Without a separate benchmark-custody gate, a caller could construct inputs and expected values that are internally consistent with the executable graph, attach them to a valid Edition 4 datum row, and obtain numerical PASS without proving that any benchmark retained from the authorized source was actually reproduced.

The release gate therefore distinguishes supplemental qualification evidence from source-benchmark reproduction required for numerical release.

## Why numeric benchmark values alone are insufficient

A retained source benchmark input such as:

```text
R = 100
```

is not engineering-complete unless the source package also proves what physical quantity/unit that value represents and where it came from.

`100 mm` and `100 in` are numerically identical as bare floating-point values but physically different by 25.4×.

Therefore benchmark input source custody is established **before READY**, not supplied later by the release-candidate caller.

## Retained source benchmark

Each retained source benchmark includes:

```text
caseId
sourceRef
targetEditionPrimarySourceVerified
independentlyReproduced
independentCalculationReference
input
inputEvidence[]
expectedResults[]
```

The `input` object may preserve the natural source-example structure, for example:

```json
{
  "geometry": { "R": 100, "t": 10 },
  "loads": { "P": 1000 }
}
```

### inputEvidence[]

Every finite numeric leaf in `input` must have exactly one source-qualified evidence row:

```json
{
  "inputId": "GEOMETRY_R",
  "benchmarkPath": ["geometry", "R"],
  "units": "mm",
  "sourceRef": "DATUM-WRC537-ED4-BENCHMARK-001",
  "sourceLocator": "exact source locator"
}
```

`benchmarkPath` is an ordered list of object keys and/or zero-based array indexes into the retained benchmark `input` object.

The source-package READY gate requires:

- non-empty unique `inputId` values;
- a valid path to a finite numeric input value;
- non-empty units;
- Edition 4 primary DATUM custody;
- datum digest equal to the exact authorized source document SHA-256;
- input evidence source locator equal to the retained datum locator;
- 100% coverage of all finite numeric benchmark input leaves;
- no duplicate input-path custody.

A benchmark with incomplete input units/source locators cannot make the source package READY.

## Expected result evidence

Each retained expected result includes:

```text
quantity
value
units
absoluteTolerance
toleranceBasis
sourceRef
sourceLocator
```

Expected result values, tolerances and locators are likewise source-qualified before READY.

## Release benchmark binding artifact

`WRC537_ED4_BENCHMARK_BINDINGS.json` contains only mappings to evidence already retained in the immutable dataset:

```json
{
  "benchmarkBindings": [
    {
      "sourceBenchmarkCaseId": "SOURCE-CASE-ID",
      "qualificationCaseId": "QUALIFICATION-CASE-ID",
      "inputBindings": [
        {
          "variableId": "PLAN_INPUT_VARIABLE",
          "benchmarkInputId": "GEOMETRY_R"
        }
      ],
      "recoveryBindings": [
        {
          "targetId": "RECOVERY-TARGET",
          "variableId": "RESULT-VARIABLE",
          "benchmarkQuantity": "SOURCE-RESULT-QUANTITY"
        }
      ]
    }
  ]
}
```

The release-candidate caller does **not** supply benchmark paths, units, or source locators. It only selects source-qualified `benchmarkInputId` values already frozen into the dataset.

## Mandatory benchmark coverage

Every benchmark retained in `dataset.sourcePackage.benchmarks` must appear exactly once in the release binding set.

A release candidate is rejected when:

- a retained source benchmark is omitted;
- a benchmark is bound more than once;
- a referenced qualification case does not exist;
- one qualification case is reused as reproduction evidence for multiple source benchmarks.

## Qualification-case custody

The qualification case bound to a source benchmark must retain the same source datum/locator and the exact retained independent-calculation reference.

Required:

```text
qualificationCase.sourceRef == sourceBenchmark.sourceRef
qualificationCase.sourceLocator == source benchmark DATUM locator
qualificationCase.independentReproduction == true
qualificationCase.independentCalculationReference == sourceBenchmark.independentCalculationReference
```

Numerical agreement does not permit substitution of a different independent reproduction reference.

## Exact benchmark-input release custody

For each input binding:

```text
qualification request variable
↔ source-qualified benchmarkInputId
```

The release gate resolves the input evidence's retained path/value and requires:

```text
qualification request value == retained benchmark numeric value
qualification request units == retained benchmark inputEvidence.units
```

There is no silent unit conversion at this identity boundary.

The binding set must cover:

- every qualification request input variable exactly once; and
- every retained source-qualified benchmark input evidence row exactly once.

Because source-package READY already requires every finite numeric input leaf to have one evidence row, this gives end-to-end 100% input coverage:

```text
source benchmark numeric leaf
→ inputEvidence ID + units + source locator
→ qualification request variable
→ executable plan
```

## Exact recovery-result custody

Every source benchmark expected result must map exactly once to a qualification expected recovery result.

The release gate requires exact equality of:

```text
value
units
absoluteTolerance
toleranceBasis
sourceRef
sourceLocator
```

Every qualification expected recovery result must also be represented in the benchmark binding.

A numerically self-consistent calculation with a changed source answer, different units, wider tolerance, different tolerance basis, or different source locator cannot become the retained source benchmark reproduction.

## Intermediate values

The release benchmark binding is centered on source benchmark inputs and retained source outputs.

Term-complete qualification remains separately mandatory for every executable equation/interpolation step. Intermediate expected values may be derived from independently reproduced hand calculations when the publication does not print them, but those derived intermediates do not replace exact source benchmark input/output custody.

## Numeric literal/coefficient custody remains separate

After source-benchmark custody is satisfied, every executable numeric literal must still bind as exactly one of:

```text
DATASET_COEFFICIENT
SOURCE_LITERAL
```

Source-benchmark reproduction does not authorize unbound magic numbers.

## Pipeline state

The one-command pipeline includes:

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

Required release binding artifact:

```text
docs/wrc537/ed4/WRC537_ED4_BENCHMARK_BINDINGS.json
```

It must remain absent while the real Edition 4 source package is BLOCKED.

## Representative fail-closed diagnostics

Source-package readiness rejects incomplete benchmark input source custody through `BENCHMARKS_COMPLETE` and `DATUM_SOURCE_CUSTODY_COMPLETE`.

Release-candidate diagnostics include:

```text
WRC537_ED4_NUMERICAL_RELEASE_SOURCE_BENCHMARKS_REQUIRED
WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_COVERAGE_MISMATCH
WRC537_ED4_NUMERICAL_RELEASE_QUALIFICATION_CASE_REUSED
WRC537_ED4_NUMERICAL_RELEASE_QUALIFICATION_CASE_UNKNOWN
WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_CASE_CUSTODY_MISMATCH
WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_EVIDENCE_DUPLICATE
WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_EVIDENCE_UNKNOWN
WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_VALUE_MISMATCH
WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_UNITS_MISMATCH
WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_BINDING_SET_MISMATCH
WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_EVIDENCE_SET_MISMATCH
WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_RECOVERY_VALUE_MISMATCH
WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_RECOVERY_BINDING_SET_MISMATCH
```

## Current real state

No authorized/licensed WRC Bulletin 537 Edition 4 technical source has been populated in the repository source package.

Therefore:

```text
source package = BLOCKED
source benchmark inputEvidence = NOT POPULATED WITH REAL WRC DATA
source benchmark bindings = ABSENT
numerical release candidate = ABSENT
engineering activation = BLOCKED
```

Synthetic fixtures used by regression scripts exercise only the software contract. They are not WRC537 engineering data or validation evidence.
