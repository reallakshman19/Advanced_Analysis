# WRC537 Edition 4 source-to-evaluator batch

## 1. Purpose

This document defines the complete **source-independent** software path from an authorized WRC Bulletin 537 Edition 4 technical source to a numerically qualified release candidate.

It does not provide WRC537 technical equations, coefficients, signs, limits or benchmark answers.

The real engineering method remains BLOCKED until the authorized Edition 4 technical source is supplied and qualified.

## 2. End-to-end authority chain

```text
AUTHORIZED EDITION 4 SOURCE
        ↓
exact SHA-256 source custody
        ↓
DOCUMENT + DATUM source ledger
        ↓
source-package READY
        ↓
immutable engineering dataset candidate
        ↓
source-bound calculation plan
        ↓
reviewed executable graph
        ↓
deterministic execution trace
        ↓
term-complete numerical qualification
        ↓
exact retained source-benchmark release custody
        ↓
exact numeric literal/coefficient custody
        ↓
numerical release candidate
        ↓
STOP — independent approval/trust
```

Every artifact through numerical release remains:

```text
engineeringUseAuthorized = false
```

## 3. Source-package prerequisite

The source package must reach:

```text
READY_FOR_TECHNICAL_IMPLEMENTATION
```

before dataset promotion.

READY requires exact Edition 4 source authority for:

```text
geometry / physical applicability
U / gamma / rho / lambda / delta
all 12 load/moment conventions
stress recovery and surfaces
source stress measure
interpolation / extrapolation
coefficient/equation inventory and values
source benchmark inputs and expected outputs
LAFEA canonical mapping
```

Every consumed technical datum must be bound to the exact authorized source document SHA-256 and exact Edition 4 locator.

## 4. Source benchmark input custody at READY

A source benchmark retains its natural input structure in `input` plus a source-qualified `inputEvidence[]` inventory.

Example:

```json
{
  "input": {
    "geometry": { "R": 100, "t": 10 },
    "loads": { "P": 1000 }
  },
  "inputEvidence": [
    {
      "inputId": "GEOMETRY_R",
      "benchmarkPath": ["geometry", "R"],
      "units": "mm",
      "sourceRef": "DATUM-WRC537-ED4-BENCHMARK-001",
      "sourceLocator": "exact source locator"
    }
  ]
}
```

Before READY:

```text
every finite numeric benchmark input leaf
→ exactly one inputEvidence ID
→ explicit source units
→ exact DATUM source reference/locator
→ exact authorized source digest
```

A bare numeric source input cannot qualify.

## 5. Engineering dataset

Only a READY source package may create:

```text
wrc537-ed4-engineering-dataset/v1
```

The dataset freezes:

```text
source package
source ledger
coefficient rows
source document SHA-256
source readiness evidence
promotion metadata
canonical semantic hashes
```

Source qualification is not numerical-method qualification.

## 6. Calculation plan

The source-bound calculation plan retains:

```text
source family
coordinate system
load reference
variables
equations
interpolation rules
recovery targets
combination rules
post-processing rules
```

Every plan item that carries technical meaning must reference an Edition 4 primary `DATUM` row with the exact source document digest and locator.

Source expression text is evidence only; it is never executed directly.

## 7. Safe executable graph

No `eval()` or dynamic `Function()` path exists.

Supported software primitives are:

```text
VAR
CONST
ADD
SUB
MUL
DIV
NEG
ABS
SQRT
POW
MIN
MAX
POLYNOMIAL
LINEAR_INTERPOLATE
```

The primitive set is software capability, not evidence that WRC537 uses a particular mathematical form.

Every compiled equation/interpolation requires:

```text
exact source plan binding
sourceRef/sourceLocator
explicit variable units
dimension vectors
verified dimension audit
deterministic execution order
```

## 8. Interpolation/extrapolation custody

Executable interpolation cannot define its own engineering authority.

Every `LINEAR_INTERPOLATE` node is recursively checked against source-package policy, including nodes nested inside equation graphs.

Required:

```text
source interpolation authorization == executable interpolation use
source extrapolation authorization == executable sourceAllowsExtrapolation
```

## 9. Execution safety

Runtime execution rejects:

```text
missing / extra / duplicate input variables
wrong units
unknown variables
forward or unbound references
unsupported operators
non-finite values
division by zero
negative SQRT domain
zero interpolation span
unauthorized extrapolation
missing recovery results
```

There is no silent unit conversion.

## 10. Term-complete qualification

Qualification suite schema:

```text
wrc537-ed4-numerical-qualification-suite/v1
```

Each case is bound to the exact dataset, calculation plan and executable plan.

Every case must include an expected value for:

```text
every executable equation/interpolation step
+
every declared recovery result
```

Expected values retain:

```text
value
units
absoluteTolerance
toleranceBasis
sourceRef
sourceLocator
```

Every case also requires:

```text
independentReproduction = true
independentCalculationReference = non-empty
```

No default percentage tolerance is inserted.

Qualification PASS means the executable plan reproduced the retained expected values. It does **not** by itself prove that the case is one of the source benchmarks frozen in the dataset.

## 11. Source-benchmark release custody

A numerical release candidate requires full source-benchmark custody in addition to qualification PASS.

Artifact:

```text
docs/wrc537/ed4/WRC537_ED4_BENCHMARK_BINDINGS.json
```

Every benchmark frozen in `dataset.sourcePackage.benchmarks` must be covered exactly once.

Each binding maps:

```text
sourceBenchmarkCaseId
↔ qualificationCaseId
```

and retains input/recovery mappings.

### Input mapping

Release input bindings use only source-qualified benchmark evidence IDs:

```json
{
  "variableId": "P",
  "benchmarkInputId": "LOAD_P"
}
```

The release gate proves:

```text
request value == source benchmark value
request units == source benchmark inputEvidence.units
```

It also requires the binding set to cover every qualification request variable and every source-qualified benchmark input evidence row exactly once.

Because READY requires 100% numeric benchmark input-leaf evidence, the release chain proves:

```text
source numeric benchmark input
→ source-qualified value/units/locator
→ qualification runtime variable
→ executable plan
```

### Recovery mapping

Every source benchmark expected result maps exactly once to an expected qualification recovery result with exact equality of:

```text
value
units
absoluteTolerance
toleranceBasis
sourceRef
sourceLocator
```

The qualification case must also retain the exact source benchmark datum/locator and exact independent calculation reference.

See `SOURCE_BENCHMARK_RELEASE_CUSTODY.md` for the detailed contract.

## 12. Numeric literal/coefficient custody

Every numeric literal embedded in every executable graph is inventoried.

Each literal must bind as exactly one of:

```text
DATASET_COEFFICIENT
SOURCE_LITERAL
```

A dataset coefficient binding requires exact equality to the retained coefficient value and exact source reference/locator.

Graph variable references must also equal the source plan's declared input-variable set exactly.

## 13. Numerical release candidate

Schema:

```text
wrc537-ed4-numerical-release-candidate/v1
```

Creation requires:

```text
valid READY-derived dataset
valid source-bound calculation plan
valid executable plan
replayed numerical qualification PASS
exact graph input custody
100% source benchmark coverage
exact source-qualified benchmark value + unit bindings
exact source benchmark recovery/tolerance/source bindings
exact independent reproduction reference
complete numeric literal/coefficient custody
```

Authority remains:

```text
engineeringUseAuthorized = false
NUMERICALLY_QUALIFIED_CANDIDATE_AWAITING_INDEPENDENT_APPROVAL_AND_TRUST
```

## 14. One-command pipeline

Run:

```bash
node scripts/wrc537-ed4-source-to-evaluator-pipeline.mjs
```

Possible states:

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

`--write` materializes only artifacts whose prerequisites already validate.

The pipeline never auto-interprets source prose into a calculation plan.

`--release` remains non-zero at the approval/trust boundary even after numerical release-candidate creation.

## 15. Required real artifacts after source extraction

```text
docs/wrc537/ed4/WRC537_ED4_SOURCE_PACKAGE.json
docs/wrc537/ed4/WRC537_ED4_SOURCE_LEDGER.csv
docs/wrc537/ed4/WRC537_ED4_COEFFICIENTS.csv

docs/wrc537/ed4/WRC537_ED4_ENGINEERING_DATASET.json
docs/wrc537/ed4/WRC537_ED4_CALCULATION_PLAN.json
docs/wrc537/ed4/WRC537_ED4_EXECUTABLE_PLAN.json
docs/wrc537/ed4/WRC537_ED4_QUALIFICATION_SUITE.json
docs/wrc537/ed4/WRC537_ED4_QUALIFICATION_EVIDENCE.json
docs/wrc537/ed4/WRC537_ED4_BENCHMARK_BINDINGS.json
docs/wrc537/ed4/WRC537_ED4_LITERAL_BINDINGS.json
docs/wrc537/ed4/WRC537_ED4_NUMERICAL_RELEASE_CANDIDATE.json
```

These real generated artifacts remain absent while the source package is BLOCKED.

## 16. Engineering procedure once Edition 4 is supplied

1. calculate SHA-256 of the exact authorized Edition 4 source artifact;
2. establish DOCUMENT custody;
3. extract every consumed technical statement into DATUM custody;
4. complete geometry/applicability;
5. complete all five parameter equations/domains;
6. complete all twelve load conventions;
7. complete stress quantities/recovery/surface rules;
8. complete source interpolation/extrapolation policy;
9. inventory/transcribe every Edition 4 coefficient/equation with source precision and locator;
10. extract source benchmark inputs, source units and exact input locators;
11. retain one `inputEvidence` row for every finite numeric benchmark input leaf;
12. extract benchmark expected outputs with units/tolerances/locators;
13. independently reproduce retained source benchmarks;
14. qualify LAFEA mappings;
15. make source package READY;
16. materialize immutable dataset;
17. construct/review calculation plan;
18. compile source mathematics into safe graphs;
19. dimension-check every graph;
20. build term-complete qualification cases;
21. debug failures at first divergent intermediate;
22. replay qualification to PASS;
23. bind every retained source benchmark exactly to qualification evidence;
24. bind every executable numeric literal;
25. create numerical release candidate;
26. submit exact artifact hashes to independent approval/trust;
27. activate registry/product/UI only after trusted approval.

## 17. Explicit non-assumptions

This batch does not assert any of the following unless established by the authorized source:

```text
force basis = F/(D t)
moment basis = M/(D^2 t)
bilinear interpolation
no extrapolation
pressure stress inclusion
von Mises combination
Tresca combination
inside/outside sign convention
fixed recovery point names
specific parameter formulas
specific coefficient polynomials
```

## 18. Current real status

```text
Edition 4 catalog identity          available
Edition 4 authorized technical data unavailable in repository
source package                      BLOCKED
engineering dataset                 ABSENT
calculation plan                    ABSENT
executable plan                     ABSENT
qualification suite/evidence        ABSENT
benchmark bindings                  ABSENT
literal bindings                    ABSENT
numerical release candidate         ABSENT
engineering activation              BLOCKED
```

This is the correct fail-closed state until the authorized Edition 4 technical content is supplied and qualified.
