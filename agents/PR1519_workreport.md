# PR #1519 Work Report — Governed elastic/thermal Product defaults into target resolution

## Current state

```text
PR                         #1519
branch                     agent/issue-1321-standard-engineering-product-default
issue                      #1321
initial base               751d577290f333dbec9f18804766dde61b0f62da
current main observed      1b8be743e7368eda79a06564acc84a413e1e985c
engineering checkpoint     2fea2fac1b262b0477b8a023fade151be5a35c8a
latest endpoint            EP-LC1321-SEPD-0002
state                      SOURCE_COMPLETE_EXECUTION_NOT_RUN
merge authority            OWNER_ONLY_NOT_GRANTED
```

Governing policy: Common `engineering-pr-delivery-v2` pinned at `10d667ce715bb52e1f73035c6fa326db77d0f9dd`.

## Engineering problem

Issue #1321 requires routine missing engineering inputs to become governed, visible, auditable assumptions when an authorized Product/Project value already exists, rather than generic blockers.

Merged groundwork already provides:

1. #1504 — Product engineering-default provider in ordinary Common Input;
2. #1514 — effective resolver winner controls the Common Input enriched-model projection;
3. `LOAD_CALC_STANDARD_DEFAULTS_V1 / PD-ELASTIC-THERMAL` — existing visible Product screening assumptions.

The target-level Product engineering provider still shipped an empty table. The safe bounded correction is to reuse values already governed by `PD-ELASTIC-THERMAL`, not author new pipe/material tables.

## Bounded Product values

Upstream Product row:

```text
LOAD_CALC_STANDARD_DEFAULTS_V1
PD-ELASTIC-THERMAL

DEFAULT.elasticModulusPa      = 2.0e11 Pa
DEFAULT.thermalExpansionPerK  = 12.0e-6 1/K
```

Target values:

```text
ELASTIC_MODULUS
2.0e11 Pa / 1e6 = 200000 MPa

THERMAL_EXPANSION_COEFFICIENT
12.0e-6 1/K -> 12.0e-6 1/K
```

No new engineering number is selected. E is an exact unit conversion. Alpha is reused without conversion.

## Production implementation

### `src/workspace/project-data/non-fea-product-engineering-default-profile.js`

The explicit `LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1` remains available for qualification fixtures.

Ordinary Product engineering resolution now defaults to `LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1`, version 1, containing exactly:

```text
PD-ENG-ELASTIC-MODULUS-GENERIC-STEEL
  ELASTIC_MODULUS = 200000 MPa

PD-ENG-THERMAL-EXPANSION-GENERIC-STEEL
  THERMAL_EXPANSION_COEFFICIENT = 12e-6 1/K
```

Both rows:

- derive from the same existing `PD-ELASTIC-THERMAL` Product row;
- bind the upstream Product profile ID/version;
- bind the upstream default identity/semantic hash in their basis;
- take allowed methods from the target field registry;
- fail closed if the upstream source value is absent, non-finite or non-positive;
- remain `PRODUCT_DEFAULT` authority only.

### `src/core/non-fea-enrichment/index.js`

Source audit found the workspace target registry already allowed `THERMAL_EXPANSION_COEFFICIENT`, but the common enrichment contract did not define it. The minimum common seam was therefore added:

```text
THERMAL_EXPANSION_COEFFICIENT
-> engineeringProperties.thermalExpansionPerK
-> SOURCE_MASTER_OVERRIDE_DEFAULT authority family
```

This does not alter selector matching, conflict handling, topology custody, support authority or numerical algorithms. It only permits the already-governed target field to traverse the existing resolver/projection path.

### `src/core/shared-piping-model/property-specs.js`

Adds canonical source/evidence custody:

```text
thermalExpansionPerK
unit = 1/K
aliases =
  THERMAL_EXPANSION_PER_K
  THERMALEXPANSIONPERK
  THERMAL_EXPANSION_COEFFICIENT
```

Bare `ALPHA` is intentionally not accepted because it is ambiguous.

## Falsifiers

### `scripts/non-fea-product-engineering-default-profile-check.mjs`

Requires:

- EMPTY profile remains empty;
- STANDARD profile row count = 2;
- two-component thermal fixture produces 4 Product records;
- E records = `200000 MPa`;
- alpha records = `12e-6 1/K`;
- both bind `PD-ELASTIC-THERMAL` provenance/profile hash;
- explicit custom Product tables still exercise provider mechanics only;
- same-scope unequal values fail closed;
- tampering invalidates semantic-hash custody;
- disallowed fields remain rejected.

### `scripts/non-fea-product-engineering-default-runtime-resolution-check.mjs`

Requires the shipped E/alpha records to pass the actual common path:

```text
Product provider
-> createNonFeaEnrichmentSidecar()
-> resolveNonFeaEnrichment()
-> selected PRODUCT_DEFAULT candidates
-> createNonFeaEnrichedProjection()
-> component.engineeringProperties.elasticModulusMpa
-> component.engineeringProperties.thermalExpansionPerK
```

Expected projected evidence:

```text
elasticModulusMpa.value         200000
elasticModulusMpa.unit          MPa
elasticModulusMpa.sourceKind    PRODUCT_DEFAULT
thermalExpansionPerK.value      12e-6
thermalExpansionPerK.unit       1/K
thermalExpansionPerK.sourceKind PRODUCT_DEFAULT
```

The same script preserves the existing discriminators:

- Product-only winner = Product;
- Project configured default outranks Product;
- source explicit outranks Product;
- Product cannot author support type/state;
- source model remains immutable;
- ordinary runtime has exactly one common resolver call.

### `scripts/w10.6-flexural-property-contract-check.mjs`

Alias contract now requires the exact thermal-expansion aliases/unit and explicitly verifies bare `ALPHA` is not accepted.

## Authority hierarchy preserved

```text
ACCEPTED_OVERRIDE
> SOURCE_EXPLICIT
> SOURCE_INHERITED
> EXACT_APPROVED_MASTER
> CONFIGURED_DERIVATION
> PROJECT_POLICY
> PROJECT_CONFIGURED_DEFAULT
> PRODUCT_DEFAULT
```

Product only fills a missing target when the existing effective resolver selects it.

## Explicit non-scope / frozen authority

This PR does **not** authorize or introduce:

- generic pipe OD or wall tables;
- generic material-density, fluid-density, insulation or component-mass tables;
- corrosion-allowance promotion;
- support preload or friction promotion;
- source-up-axis or gravity-mechanics changes;
- CoG or mass-composition changes;
- support type/state Product authority;
- load statics changes;
- solver/reaction/residual changes;
- benchmark/oracle/tolerance changes;
- EMP.1/WRC/LAFEA changes;
- workflow changes;
- release/trust/publication authority.

Corrosion allowance and support numerical defaults require separate contract/authority legs and are deliberately deferred.

## Current-main drift

The branch was originally reconciled to `8adfdbcd6a731af29bfc62b1ceade4aa30c65e0d`. Main later advanced through #1521 to:

`1b8be743e7368eda79a06564acc84a413e1e985c`

#1521 refactors workspace modules to satisfy the 300-line contract and adds E2E coverage. It does not touch the #1519 Product profile, target field registry, common enrichment contract, shared property specs or focused falsifiers. This is a reconciliation event, not a Product-authority requalification event.

The final branch reconciliation must use exact current main as a parent and preserve all #1521 files byte-for-byte.

## Executable validation truth

Faithful exact-head repository execution remains unavailable in this chain. Local Git access has repeatedly failed before checkout with:

```text
Could not resolve host: github.com
```

Available GitHub Actions observations have also terminated before executable steps/logs. Do not rerun `steps=[]` jobs merely to generate activity.

Therefore all branch engineering checks remain:

```text
product engineering profile check            NOT_RUN
product engineering runtime resolution        NOT_RUN
shared property alias contract                NOT_RUN
effective Common Input projection             NOT_RUN
aggregate Non-FEA checks                      NOT_RUN
check:imports                                  NOT_RUN
advanced-shell contract                        NOT_RUN
build                                          NOT_RUN
git diff --check                               NOT_RUN
```

Source inspection is not executable PASS.

## Required exact-head execution order

```bash
node scripts/non-fea-product-engineering-default-profile-check.mjs
node scripts/non-fea-product-engineering-default-runtime-resolution-check.mjs
node scripts/w10.6-flexural-property-contract-check.mjs aliases
node scripts/non-fea-effective-common-input-projection-check.mjs
node scripts/run-non-fea-checks.mjs
npm run check:imports
node scripts/advanced-shell-contract-check.mjs
npm run build
git diff --check
```

The first real executable failure owns RCA. Do not tune Product values, precedence or authority to obtain a PASS.

## Changed-file ledger

Engineering source/test paths authorized in this leg:

1. `src/workspace/project-data/non-fea-product-engineering-default-profile.js`
2. `src/core/non-fea-enrichment/index.js`
3. `src/core/shared-piping-model/property-specs.js`
4. `scripts/non-fea-product-engineering-default-profile-check.mjs`
5. `scripts/non-fea-product-engineering-default-runtime-resolution-check.mjs`
6. `scripts/w10.6-flexural-property-contract-check.mjs`

Relay/governance paths:

7. `agents/PR1519_workreport.md`
8. `agents/agentchain.md`
9. `agents/agentchain/LOAD-CALC-1321-EFFECTIVE-PROJECTION-AUTHORITY/EP-LC1321-EFF-0004.md`
10. `agents/agentchain/LOAD-CALC-1321-STANDARD-ENGINEERING-PRODUCT-DEFAULT/EP-LC1321-SEPD-0001.md`
11. `agents/agentchain/LOAD-CALC-1321-STANDARD-ENGINEERING-PRODUCT-DEFAULT/EP-LC1321-SEPD-0002.md`
12. `agents/claims/PR1519.yaml`
13. `agents/status/PR1519.yaml`

Final exact delta must be re-read after current-main reconciliation. No other path is authorized.

## Inputs

- Issue #1321.
- merged #1504 Product engineering runtime.
- merged #1514 effective Common Input projection.
- current main `1b8be743e7368eda79a06564acc84a413e1e985c`.
- `LOAD_CALC_STANDARD_DEFAULTS_V1 / PD-ELASTIC-THERMAL`.
- `NON_FEA_FIELD_REGISTRY` definitions for E/alpha.

## Benchmarks / discriminators

```text
E source                         2.0e11 Pa
E target                         200000 MPa
alpha source/target              12e-6 1/K
standard target profile rows     2
two-component Product records    4 = 2 E + 2 alpha
Product-only winner              PRODUCT_DEFAULT
Project > Product                required
Source > Product                 required
support Product expansion        false
source mutation                  false
```

## Common / governing documents

- `AGENTS.md`.
- Common `engineering-pr-delivery-v2@10d667ce715bb52e1f73035c6fa326db77d0f9dd`.
- `agents/agentchain.md`.
- `EP-LC1321-SEPD-0002`.

## Authoritative sources

No new external source is introduced.

Repository Product authority remains:

- `src/workspace/project-data/non-fea-product-default-profile.js`;
- `LOAD_CALC_STANDARD_DEFAULTS_V1`;
- `PD-ELASTIC-THERMAL`.

These are visible Product screening assumptions, not source-model evidence.

## Production paths

Changed:

- `src/workspace/project-data/non-fea-product-engineering-default-profile.js`
- `src/core/non-fea-enrichment/index.js`
- `src/core/shared-piping-model/property-specs.js`

Read-only context:

- `src/workspace/project-data/non-fea-product-default-profile.js`
- `src/workspace/project-data/non-fea-field-registry.js`
- `src/workspace/non-fea-common-input-runtime.js`
- `src/workspace/project-data/non-fea-effective-value-resolver.js`
- `src/workspace/project-data/non-fea-effective-common-input-projection.js`
- `src/core/shared-piping-model/adapters/workspace-dataset-to-shared.js`

## Validation / test paths

- `scripts/non-fea-product-engineering-default-profile-check.mjs`
- `scripts/non-fea-product-engineering-default-runtime-resolution-check.mjs`
- `scripts/w10.6-flexural-property-contract-check.mjs`
- `scripts/non-fea-effective-common-input-projection-check.mjs`
- `scripts/run-non-fea-checks.mjs`
- import/advanced-shell/build/diff checks listed above.

## Merge disposition

```text
DRAFT
SOURCE_COMPLETE_EXECUTION_NOT_RUN
OWNER_MERGE_AUTHORITY_NOT_GRANTED
```

Do not merge #1519 without a new explicit owner instruction.

## Appendix A — next-agent takeover qualification

Q1 — Production Trace: Trace both `elasticModulusPa` and `thermalExpansionPerK` from `PD-ELASTIC-THERMAL` through the target Product profile, Product provider, common sidecar, resolver ledger, effective projection and final engineering-property keys. Name the authority owner at every seam.

Q2 — Failure Isolation: If E becomes `2.0e11` in `elasticModulusMpa`, or alpha is rejected by common enrichment, identify the first responsible module and the exact wrong value/contract entry that falsifies intended custody.

Q3 — Authority / Invariant: Explain why Product may fill missing E/alpha but cannot displace accepted override/source/master/Project evidence, and why corrosion, OD/wall/density/mass and support preload/friction are not authorized here.

Q4 — Independent Validation: Compute `2.0e11 Pa` in MPa, state alpha's exact value/unit, and identify the upstream Product default plus semantic-hash custody proving both target values are derived.

Q5 — First Execution Falsifier: State the first exact-head command, its required E/alpha assertions, the resolver/projection assertions that follow, and the protected domains that remain frozen if any check fails.

Target: total >=92/100 and minimum each >=17/20 before an incoming agent widens this engineering scope.

## Exact next action

On the first faithful exact-head checkout, run:

`node scripts/non-fea-product-engineering-default-profile-check.mjs`

Stop on the first real failure. If it passes, continue the required execution order, then re-ground exact current main/head/files/reviews/threads. Await explicit owner merge authorization.
