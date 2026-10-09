# PR 1210 work report — WRC537 Edition 4 numerical-adapter boundary

## 1. Scope

PR #1210 is the source-bound numerical-adapter boundary for WRC Bulletin 537 Edition 4.

Parent stack:

```text
#1206 source readiness validator
  ↓
#1207 Ed4 source package intake
  ↓
#1208 engineering dataset promotion
  ↓
#1210 source-bound numerical adapter boundary
```

This PR does not implement WRC537 numerical mathematics.

It defines the contracts that a future real mathematical implementation must satisfy before it may be qualified.

## 2. Engineering intent

The principal risk addressed by this PR is accidental reuse of the generic synthetic local-attachment correlation assumptions for WRC537.

The synthetic kernel currently contains implementation choices that are useful for infrastructure qualification but are not WRC537 authority.

The WRC537 adapter must therefore remain independent from assumptions such as:

```text
force basis = F/(D t)
moment basis = M/(D² t)
interpolation = bilinear
extrapolation = none
```

unless and until the authorized Edition 4 source explicitly establishes the same rule.

## 3. New schemas

### 3.1 Calculation plan

```text
wrc537-ed4-calculation-plan/v1
```

The calculation plan binds the exact source-qualified engineering dataset to the method definition required by a future evaluator.

It retains:

```text
planIdentity
planVersion
datasetSemanticHash
sourceFamily
sourceCoordinateSystem
sourceLoadReference
variables[]
equations[]
interpolationRules[]
recoveryTargets[]
combinationRules[]
postProcessing[]
authority
planSemanticHash
```

### 3.2 Qualification calculation trace

```text
wrc537-ed4-qualification-calculation-trace/v1
```

The trace retains one numerical evidence path for one exact calculation request and one exact calculation plan.

It retains:

```text
traceIdentity
requestIdentity
datasetSemanticHash
planSemanticHash
inputValues[]
equationSteps[]
recoveryResults[]
notes[]
authority
traceSemanticHash
```

## 4. Dataset prerequisite

A calculation plan can only be created from a valid:

```text
wrc537-ed4-engineering-dataset/v1
```

candidate from PR #1208.

That candidate itself can only be created after the source package reaches:

```text
READY_FOR_TECHNICAL_IMPLEMENTATION
```

The current repository has no real engineering dataset, so no real calculation plan can currently be created.

## 5. Plan authority

Every calculation plan is code-owned as:

```json
{
  "engineeringUseAuthorized": false,
  "authorizationBasis": "SOURCE_BOUND_CALCULATION_PLAN_NOT_NUMERICAL_METHOD_QUALIFIED"
}
```

A caller cannot promote this flag.

Validation rejects a forged true value.

## 6. Trace authority

Every qualification trace is code-owned as:

```json
{
  "engineeringUseAuthorized": false,
  "authorizationBasis": "QUALIFICATION_CALCULATION_EVIDENCE_NOT_ENGINEERING_RESULT"
}
```

A trace therefore cannot be interpreted as an engineering PASS result.

## 7. Datum-level source custody

### 7.1 Ledger extension

The Edition 4 source ledger now contains:

```text
record_scope
engineering_subject
```

The intended scopes are:

```text
DOCUMENT_IDENTITY
DOCUMENT
DATUM
```

### 7.2 Numerical-plan requirement

Every numerical-plan source item must resolve to a retained ledger row satisfying:

```text
record_scope = DATUM
engineering_subject = non-empty
authority_class = PRIMARY_LICENSED or PRIMARY_AUTHORIZED
verification_status = PRIMARY_SOURCE_VERIFIED
document_digest = promoted source document SHA-256
sourceLocator = exact ledger locator
```

This applies to:

- source family;
- coordinate system;
- load reference point;
- variables;
- equations;
- interpolation rules;
- recovery targets;
- combination rules;
- source-defined post-processing.

### 7.3 Why document-level rows are rejected

A document-level row proves that the authorized bulletin exists and is the correct edition.

It does not prove where a specific positive moment sign, coefficient equation, interpolation statement, stress location, or membrane/bending reconstruction rule came from.

Therefore the numerical adapter rejects document-level rows as calculation authority.

## 8. Source variables

Plan variables retain:

```text
variableId
sourceSymbol
role
dimension
unitsPolicy
sourceRef
sourceLocator
```

Role is restricted to:

```text
INPUT
DERIVED
COEFFICIENT
STRESS
RESULT
OTHER
```

These roles are software custody labels only.

They do not replace WRC source terminology.

## 9. Governing-equation contract

Every equation retains:

```text
equationId
outputVariableId
inputVariableIds[]
sourceExpression
sourceRef
sourceLocator
```

Input and output variables must exist in the plan.

Equation IDs are unique.

The equation source row must be a datum-level primary-source row bound to the exact authorized document digest.

## 10. No expression evaluator yet

This PR deliberately does not interpret `sourceExpression`.

It does not use:

```text
eval()
Function(...)
generic correlation basis conversion
implicit interpolation
```

This is intentional.

The real mathematical evaluator must be implemented after the Edition 4 source equations are available and independently reviewed.

## 11. Interpolation contract

Interpolation is represented only when the source-qualified plan requires it.

Each rule retains:

```text
ruleId
inputVariableIds[]
outputVariableId
algorithm
boundaryBehavior
sourceRef
sourceLocator
```

An empty list is allowed when no interpolation is required by the source method.

No default algorithm is supplied.

## 12. Recovery-target contract

Each target retains:

```text
targetId
resultVariableIds[]
physicalLocation
surface
sourceRef
sourceLocator
```

The qualification trace may only report result variables declared for the target.

No source location names are hard-coded in this PR.

## 13. Combination and post-processing boundary

`combinationRules` and `postProcessing` contain source-bound definitions only.

They may be empty.

Do not automatically insert:

- pressure stress;
- principal stress;
- Tresca;
- von Mises;
- code stress;
- allowable comparison;
- fatigue utilization.

If these are LAFEA software post-processing rather than WRC source-method operations, they must remain a separate policy layer.

## 14. Qualification trace completeness

The trace requires the exact set of plan inputs.

Missing, duplicate, or extra input IDs are rejected.

For equations:

```text
number of equationSteps = number of plan equations
```

and each step must occur in plan order with exact:

```text
equationId
outputVariableId
sourceRef
sourceLocator
```

The trace therefore cannot silently omit an inconvenient intermediate term.

## 15. Recovery-result completeness

The trace recovery result set must equal the exact Cartesian declaration from the plan's target/result-variable assignments.

Missing, duplicate, or undeclared results are rejected.

## 16. Semantic hashing

The existing repository canonical JSON / FNV-1a 64-bit semantic hash is used for:

```text
planSemanticHash
traceSemanticHash
```

The promoted dataset remains bound to the source-document SHA-256 from #1208.

The software semantic hash and cryptographic source digest serve different purposes and are not interchangeable.

## 17. Engineering execution remains blocked

The adapter exports:

```text
wrc537Ed4NumericalAdapterCanExecuteEngineering(...)
```

which always returns:

```text
false
```

after validating the dataset and calculation plan.

It also exports:

```text
requireWrc537Ed4EngineeringExecution(...)
```

which always throws:

```text
WRC537_ED4_NUMERICAL_METHOD_NOT_QUALIFIED
```

This gate must not be relaxed merely because a source package, engineering dataset, calculation plan, or calculation trace exists.

## 18. Anti-assumption regression

The current-state script checks that the adapter source does not embed:

```text
FORCE_OVER_D_T
MOMENT_OVER_D2_T
BILINEAR_NO_EXTRAPOLATION
calculateLocalAttachmentCorrelation(
engineeringUseAuthorized: true
```

This is a narrow software guard against accidental coupling to the synthetic correlation implementation.

It is not a substitute for source review.

## 19. Contract self-test fixture

The self-test constructs a fully qualified synthetic source fixture and adds a datum-level source row.

It then uses the fixture-only relation:

```text
SIGMA = P / A
```

with:

```text
P = 1000 N
A = 100 mm²
SIGMA = 10 MPa
```

This relation is **not WRC537 data or a WRC537 benchmark**.

Its sole purpose is to exercise the numerical-plan and evidence contracts with obvious dimensional values.

## 20. Regression cases encoded

The self-test encodes rejection of:

1. wrong dataset hash;
2. document-level source row used as numerical datum;
3. official catalog row used as technical source;
4. wrong source locator;
5. forged calculation-plan authority;
6. plan semantic-hash tamper;
7. missing qualification input;
8. equation-step source/locator mismatch;
9. recovery-result set mismatch;
10. forged qualification-trace authority;
11. trace semantic-hash tamper;
12. engineering execution attempt.

## 21. Current real repository state

Expected current real state:

```text
WRC537_ED4_SOURCE_PACKAGE.json       BLOCKED
WRC537_ED4_ENGINEERING_DATASET.json  ABSENT
WRC537_ED4_CALCULATION_PLAN.json     ABSENT
WRC537_ED4_QUALIFICATION_TRACE.json  ABSENT
```

This is correct.

## 22. Files changed by PR #1210

At initial draft publication:

```text
docs/wrc537/ed4/NUMERICAL_ADAPTER_BOUNDARY.md

docs/wrc537/ed4/WRC537_ED4_SOURCE_LEDGER.csv

scripts/wrc537-ed4-numerical-adapter-check.mjs
scripts/wrc537-ed4-numerical-adapter-self-test.mjs

src/core/local-attachment-correlation/methods/wrc537/ed4-numerical-adapter.js
```

This work report is then added as:

```text
agents/PR1210_workreport.md
```

## 23. Files intentionally not changed

This PR intentionally does not modify:

```text
src/core/local-attachment-correlation/calculate.js
src/core/local-attachment-correlation/profile.js
src/core/local-attachment-correlation/interpolation.js
src/core/local-attachment-correlation/engineering-registry.js
src/core/local-attachment-correlation/engineering-assessment.js
src/workspace/lafea-correlation-product.js
```

It also adds no UI execution control.

## 24. Validation status

Encoded commands:

```bash
node scripts/wrc537-ed4-numerical-adapter-self-test.mjs
node scripts/wrc537-ed4-numerical-adapter-check.mjs
```

Status in this agent environment:

```text
NOT_RUN
```

Reason:

The working environment does not contain a locally executable checkout of the connected GitHub branch, and previous attempts to retrieve the raw GitHub branch into the container were network-gated.

No GitHub Actions/workflow execution is used or claimed.

Static connector-side checks performed:

- parent/head ancestry inspected;
- changed-file scope inspected;
- no global registry/index/UI file in diff;
- engineering execution remains explicitly false/throwing in source;
- synthetic generic-basis tokens are guarded by committed current-state regression.

Do not rewrite this status as PASS until the scripts have actually executed successfully.

## 25. Remaining P0 dependency

The authorized WRC Bulletin 537 Edition 4 technical source is still required.

Without it there is no valid basis to create:

```text
real engineering dataset
real calculation plan
real numerical evaluator
real source benchmark expected values
```

## 26. Next source-dependent implementation sequence

Once the authorized Edition 4 source is available:

1. calculate and retain the exact source SHA-256;
2. fill the #1207 source package;
3. create datum-level ledger rows for every consumed technical statement;
4. make the source package READY;
5. use #1208 to materialize the immutable engineering dataset;
6. construct the real calculation plan from the bulletin;
7. perform independent plan review against every source locator;
8. implement the WRC-specific mathematical evaluator;
9. execute source examples and hand calculations;
10. retain equation-by-equation qualification traces;
11. qualify signs, limits, interpolation and recovery surfaces;
12. create numerical-method qualification evidence;
13. proceed through approval/trust/registry activation only after qualification passes.

## 27. Numerical evaluator requirements

The future evaluator must not use text evaluation of source equations.

Preferred implementation:

- explicit reviewed functions per equation family; or
- a typed, audited mathematical representation whose operator set is fixed and independently tested.

The evaluator must preserve:

```text
input quantity identity
source equation identity
source locator
intermediate values
units/dimensions
coefficient values/interpolation evidence
stress contribution identity
recovery target
surface
sign
```

## 28. Hand-calculation qualification requirements

For each retained benchmark, compare term by term rather than only final stress.

Minimum trace should include, where applicable to the source method:

```text
geometry interpretation
dimensionless parameters
applicability checks
coefficient family/selection
source bracket values
interpolation weights/intermediates
final coefficient
dimensional force/moment basis
individual stress contribution
membrane term
bending term
shear term
inside surface
outside surface
combined external loads
source-defined total/result quantity
separate LAFEA post-processing
```

Do not force a trace item that the source method does not use. Record the source method's actual sequence.

## 29. Tolerance policy

The future qualifier must distinguish:

```text
published source precision
chart/digitization uncertainty, if authorized
interpolation tolerance
floating-point implementation tolerance
independent benchmark tolerance
```

Do not use a blanket ±1% tolerance.

## 30. Takeover questions

Before implementing real WRC mathematics, the next engineer must be able to answer all of these from the authorized source package.

1. What exact Edition 4 geometry quantity does each source radius/diameter symbol mean?
2. Which shell thickness is used by each equation?
3. Which attachment dimension is used by each dimensionless parameter?
4. What are the exact definitions of U, gamma, rho, lambda and delta in Edition 4?
5. What are the minimum and maximum values for every parameter?
6. Are each of those limits inclusive?
7. Which shell families are supported?
8. Which attachment/nozzle geometries are supported?
9. What intersection/orientation restrictions apply?
10. Where is each force applied?
11. Where is each moment referenced?
12. What is the positive direction for every supported force component?
13. What is the positive sense for every supported moment/torsion component?
14. How are spherical and cylindrical load symbols defined relative to local axes?
15. How are source load symbols mapped to LAFEA load custody without changing signs?
16. What stress/resultant components are calculated by the source?
17. Which are membrane terms?
18. Which are bending terms?
19. Which are shear terms?
20. What are the exact stress recovery locations?
21. Which results are inside-surface versus outside-surface quantities?
22. Does the source prescribe membrane ± bending surface reconstruction?
23. What is the exact coefficient/equation family for every supported load/result combination?
24. Does Edition 4 use equations, numerical tables, diagrams, or a combination?
25. What source precision is retained for each coefficient datum?
26. What interpolation is explicitly authorized?
27. Is interpolation linear in the source parameter or in a transformed parameter?
28. Is two-dimensional/sequential interpolation required anywhere?
29. Is extrapolation explicitly permitted anywhere?
30. How are simultaneous loads combined?
31. Does WRC537 itself define pressure combination or is pressure external to the method?
32. Does WRC537 itself define principal stress, stress intensity, Tresca, or von Mises?
33. What published/reference numerical examples exist in Edition 4?
34. Can each example be reproduced with retained intermediate values?
35. What errata or edition-specific corrections apply?
36. What source terms require separate downstream LAFEA post-processing rather than inclusion in the WRC method?
37. What numerical operator set is actually needed by all retained source equations?
38. Which source equations require special numerical conditioning or logarithmic/exponential evaluation?
39. What behavior is required exactly on every source-domain boundary?
40. What must the software do immediately outside every source-defined domain?

## 31. Handover verdict

```text
NUMERICAL_ADAPTER_CONTRACT = IMPLEMENTED
REAL_WRC537_EQUATIONS = NOT_IMPLEMENTED
REAL_WRC537_COEFFICIENTS = NOT_AVAILABLE
REAL_WRC537_CALCULATION_PLAN = ABSENT
NUMERICAL_METHOD_QUALIFICATION = NOT_STARTED
ENGINEERING_EXECUTION = BLOCKED
```

This is the intended state of PR #1210.
