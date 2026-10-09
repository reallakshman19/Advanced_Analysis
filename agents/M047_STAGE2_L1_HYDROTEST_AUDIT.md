# M047 Stage 2 — L1 hydrotest-basis audit batch

Checkpoint: issue #1083 comment **“D1 promoted to production, real L1 converges, two new findings named.”**

This batch is deliberately **RCA-only**. It does not change the production friction law, a tolerance, a convergence gate, a comparison rule, or an already-qualified non-friction mechanic.

## Why this batch is first

Production R2 L1 (`WW+HP`) now converges, but its normal reactions are only 8/23 within ±10%, while the same nonlinear machinery gives 23/23 L13 normals and 22/23 L7 normals. The priority is therefore the linear hydrotest load basis feeding friction, not another Coulomb-law variant.

R7 remains evidence-bounded: the pinned ACCDB contains no case-order/execution-history table, so no multi-case sequencing law is to be guessed or fitted while the L1 load basis is still unresolved.

## Source-code finding to measure, not assume

`caesar-accdb-linear-solve.js` currently treats the governed hydrotest contents density consistently on ordinary pipe and bend spans through:

```text
physicalLineWeight(..., caseMode.contentsDensityKgPerM3)
```

Two special component paths bypass that argument:

- rigid-element gravity constructs `compileCaesarRigidElementAuthority(...)` with `fluidDensity: density(row.FLUID_DENSITY)`;
- reducer gravity constructs `compileTenCylinderReducerAuthority(...)` with `gravity.fluidDensity: density(row.FLUID_DENSITY)`.

For L1, `caseMode.contentsDensityKgPerM3` is the governed 1000 kg/m³ hydrotest fluid. The two special paths therefore appear to keep the operating ACCDB `FLUID_DENSITY` while ordinary spans use hydrotest fluid. That is a concrete component-path asymmetry capable of changing distributed weight and hence support normals.

This observation is **not yet authority to change production code**. It must first be measured on the pinned ACCDB.

## Batch A1 — data/assembly discriminator

Added:

```text
scripts/lfea-m047-stage2-l1-hydrotest-basis-audit.mjs
```

Run on the custody-verified real file:

```bash
node scripts/lfea-m047-stage2-l1-hydrotest-basis-audit.mjs \
  --accdb artifacts/bm4l-stage2/source/BM4_L.ACCDB \
  --out reports/lfea-m047-stage2-l1-hydrotest-basis-audit.json
```

The script prepares L1 twice without running or altering the friction solver:

1. **CURRENT** — source rows unchanged.
2. **UNIFORM_WW_SPECIAL_COMPONENT_COUNTERFACTUAL** — only source rows carrying `RIGID_PTR` or `REDUCER_PTR` have `FLUID_DENSITY` replaced by the already-governed hydrotest density before preparation.

Ordinary pipe/bend spans already use `caseMode.contentsDensityKgPerM3`, so this counterfactual should only move gravity belonging to a special path that still consumes operating `FLUID_DENSITY`.

The artifact records:

- current and counterfactual total prepared gravity weight;
- gravity weight by source kind;
- every source element whose weight changes;
- operating and hydrotest densities on those elements;
- the pinned CAESAR L1 summed support-force vector;
- magnitude closure of current versus counterfactual gravity against the reference global FY sum;
- confirmation that the prepared pressure field is `HYDRO_PRESSURE`;
- HP/P1 source pressure ranges and prepared pressure/Bourdon evidence by element kind.

This is an RCA discriminator, not an acceptance gate. No percentage from this artifact is a qualification result.

## Decision gate for Batch A2

A production mechanics change is authorized only if the real pinned artifact shows all of the following:

1. one or more rigid/reducer source elements change gravity weight under the special-component-only counterfactual;
2. the delta has the sign implied by replacing process fluid with the governed 1000 kg/m³ test fluid;
3. global L1 reference FY magnitude closure improves rather than worsens;
4. HP remains bound to `HYDRO_PRESSURE`, so the observed discrepancy is isolated to WW rather than a mixed WW/HP change.

If those conditions hold, Batch A2 is exactly one mechanics change: make rigid and reducer gravity consume the same case-resolved contents density already used by ordinary spans. Then run, in order:

```text
1. npm run check:lfea-m047-stage2
2. real L2-L6/L14 control regression (must remain identical)
3. real L1 nominal R2 solve and full per-restraint report
4. L13 and L7 nominal repeat only to prove the shared-path edit did not move them unexpectedly
5. deterministic repeated nominal run and production receipt
```

If the counterfactual does not improve the global L1 load closure, do **not** make the density change merely because the source looks asymmetric. Continue the L1 linear audit into HP/Bourdon and component weight distribution instead.

## R7 boundary during this batch

Do not modify the D1 direction law, Coulomb cap, coefficient, multiplier, stiffness, hysteresis, acceleration, iteration budget, or load stepping while A1/A2 is open. R7 can only advance with new external authority for CAESAR’s actual inter-case solve order/history; the ACCDB itself cannot provide it.
