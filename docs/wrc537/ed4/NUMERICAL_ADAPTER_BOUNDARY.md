# WRC 537 Edition 4 numerical-adapter boundary

## Purpose

This boundary defines how a future source-qualified WRC Bulletin 537 Edition 4 dataset becomes a numerically implementable method **without importing assumptions from the synthetic local-attachment correlation core**.

It does not contain WRC equations, WRC coefficient values, WRC interpolation rules, or WRC sign conventions.

Current status:

```text
SOURCE PACKAGE       BLOCKED
ENGINEERING DATASET  ABSENT
CALCULATION PLAN     ABSENT
QUALIFICATION TRACE  ABSENT
ENGINEERING EXECUTION BLOCKED
```

## Why this boundary is separate

The existing synthetic correlation kernel uses implementation assumptions such as a fixed force/moment basis and a fixed interpolation policy. Those assumptions are qualification fixtures for the generic correlation infrastructure; they are not evidence of WRC 537 Edition 4 mathematics.

The WRC537 adapter therefore does not import or assume:

```text
FORCE_OVER_D_T
MOMENT_OVER_D2_T
BILINEAR_NO_EXTRAPOLATION
```

Any actual dimensional basis, coefficient equation, interpolation algorithm, sign convention, or surface reconstruction must come from the authorized Edition 4 source package.

## Authority sequence

```text
Authorized WRC537 Ed4 source
        ↓
source package READY
        ↓
immutable engineering dataset candidate
        ↓
source-bound calculation plan
        ↓
qualification calculation trace(s)
        ↓
independent numerical-method qualification
        ↓
separate approval/trust stage
        ↓
engineering execution
```

A dataset candidate, calculation plan, or qualification trace is not itself an engineering execution authority.

## Calculation-plan schema

Schema:

```text
wrc537-ed4-calculation-plan/v1
```

A plan is bound to one exact `datasetSemanticHash` and contains:

- plan identity and version;
- source shell/family definition;
- source coordinate-system definition;
- source load-reference definition;
- variables;
- governing equations;
- interpolation rules;
- recovery targets;
- load/stress combination rules;
- source-defined post-processing rules.

The plan intentionally stores source expressions as evidence text. This PR does **not** create an expression evaluator or call `eval()`. The executable mathematical implementation is a later qualification step after the real Edition 4 equations are available.

## Datum-level source custody

Document-level authority is insufficient for a numerical plan.

`WRC537_ED4_SOURCE_LEDGER.csv` now distinguishes:

```text
record_scope = DOCUMENT_IDENTITY | DOCUMENT | DATUM
```

For numerical-plan content, the adapter accepts only:

```text
record_scope = DATUM
```

with a non-empty `engineering_subject`.

Each plan datum must also satisfy all of the following:

```text
authority_class = PRIMARY_LICENSED or PRIMARY_AUTHORIZED
verification_status = PRIMARY_SOURCE_VERIFIED
document_digest = exact authorized Ed4 SHA-256
sourceLocator = exact ledger locator
```

Therefore a generic row such as "authorized Edition 4 technical source" cannot be reused as the numerical authority for every equation.

Recommended datum subjects include:

```text
GEOMETRY_DEFINITION
PHYSICAL_APPLICABILITY
DIMENSIONLESS_PARAMETER
COORDINATE_SYSTEM
LOAD_SIGN_CONVENTION
LOAD_REFERENCE_POINT
COEFFICIENT_EQUATION
COEFFICIENT_TABLE
INTERPOLATION_RULE
EXTRAPOLATION_RULE
STRESS_COMPONENT_DEFINITION
STRESS_RECOVERY_LOCATION
SURFACE_RECONSTRUCTION
LOAD_COMBINATION_RULE
STRESS_COMBINATION_RULE
SOURCE_STRESS_MEASURE
SOURCE_BENCHMARK
```

The free-text `locator` still needs to be populated from the controlled extraction with the exact page/section/equation/table/figure/note information required by the source ledger policy.

## Variables

Every plan variable retains:

```text
variableId
sourceSymbol
role
dimension
unitsPolicy
sourceRef
sourceLocator
```

Supported custody roles are:

```text
INPUT
DERIVED
COEFFICIENT
STRESS
RESULT
OTHER
```

The role is a software-custody label. It must not silently reclassify WRC source terminology such as membrane, bending, shear, inside, outside, longitudinal, circumferential, or radial stress.

## Equations

Each governing equation retains:

```text
equationId
outputVariableId
inputVariableIds[]
sourceExpression
sourceRef
sourceLocator
```

The plan validates variable identity and source custody but deliberately does not infer the mathematical meaning of the source expression.

This prevents an implementation agent from silently converting a WRC equation into an assumed generic correlation form.

## Interpolation

Each source-authorized interpolation rule retains:

```text
ruleId
inputVariableIds[]
outputVariableId
algorithm
boundaryBehavior
sourceRef
sourceLocator
```

An empty interpolation list is valid when the source-qualified plan genuinely requires no interpolation.

No default interpolation algorithm is supplied by this boundary.

## Recovery targets

Every recovery target binds:

```text
targetId
resultVariableIds[]
physicalLocation
surface
sourceRef
sourceLocator
```

A result cannot later appear in qualification evidence unless it is declared by the plan.

This is intended to make locations such as crown, saddle, inside surface, outside surface, shell side, nozzle side, longitudinal direction, or circumferential direction explicit if and only if the authorized WRC source defines them.

## Combination and post-processing rules

`combinationRules` and `postProcessing` are arrays of source definitions.

They may be empty.

Do not populate principal stress, Tresca, von Mises, pressure combination, or code utilization merely because LAFEA supports those calculations elsewhere. Populate them in the source plan only when the Edition 4 method itself defines them. Software post-processing outside the WRC source method must remain a separate, clearly identified LAFEA policy layer.

## Qualification trace

Schema:

```text
wrc537-ed4-qualification-calculation-trace/v1
```

A trace binds one exact dataset and calculation plan and retains:

```text
traceIdentity
requestIdentity
datasetSemanticHash
planSemanticHash
inputValues[]
equationSteps[]
recoveryResults[]
notes[]
traceSemanticHash
```

Every equation in the plan must have one corresponding qualification step in plan order.

A step retains:

```text
equationId
outputVariableId
value
units
sourceRef
sourceLocator
```

The source reference and locator must exactly match the governing plan equation.

The trace therefore provides the evidence structure for the required hand-calculation sequence:

```text
geometry / source inputs
→ dimensionless parameters
→ applicability
→ coefficient selection
→ interpolation where source-authorized
→ coefficient/resultant value
→ dimensional equation basis
→ individual stress terms
→ membrane/bending/shear terms where source-defined
→ inside/outside reconstruction where source-defined
→ combined source loads where source-defined
→ source result quantities
→ separately identified downstream LAFEA post-processing
```

The exact sequence will be determined by the real Edition 4 calculation plan rather than by this placeholder architecture.

## What the trace does not prove

The trace contract proves custody and completeness of retained intermediate values. It does **not** yet prove that an equation was evaluated correctly.

Numerical correctness requires the future method evaluator plus independent benchmark/hand-calculation comparison.

This distinction is intentional:

```text
trace present ≠ equation implementation qualified
```

## Engineering execution gate

The boundary exports:

```text
wrc537Ed4NumericalAdapterCanExecuteEngineering(...)
```

which remains false, and:

```text
requireWrc537Ed4EngineeringExecution(...)
```

which throws:

```text
WRC537_ED4_NUMERICAL_METHOD_NOT_QUALIFIED
```

A future PR must not change this until the real WRC537 evaluator has independent qualification evidence and enters the existing approval/trust chain.

## Contract fixture

`scripts/wrc537-ed4-numerical-adapter-self-test.mjs` uses a deliberately simple fixture relation solely to verify software contracts.

The fixture is explicitly marked:

```text
NOT WRC TECHNICAL DATA
```

It must never be promoted into the Edition 4 source package or engineering registry.

## Encoded checks

```bash
node scripts/wrc537-ed4-numerical-adapter-self-test.mjs
node scripts/wrc537-ed4-numerical-adapter-check.mjs
```

These scripts are committed as deterministic regressions. In this agent environment they are NOT_RUN; no GitHub Actions/workflow result is claimed.

## Next technical implementation after source arrival

After a real Ed4 source package and engineering dataset exist:

1. add datum-level source-ledger rows for every equation/rule/location consumed;
2. construct the real source-bound calculation plan;
3. independently review the plan against the authorized bulletin;
4. implement the mathematical evaluator from the approved plan without generic-correlation assumptions;
5. produce equation-by-equation qualification traces;
6. compare source examples and independent hand calculations term by term;
7. qualify interpolation boundaries, signs, all supported loads, and recovery locations;
8. only then create numerical-method qualification/approval evidence.
