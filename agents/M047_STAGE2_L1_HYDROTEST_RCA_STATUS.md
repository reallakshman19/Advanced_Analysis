# M047 Stage 2 — L1 hydrotest RCA auto-batch status

Base: frozen PR #1090 head `101b3973fb24bba71d2f82f6e9e2c58a0fe6b538`

Stacked draft: PR #1114, branch `agent/issue-1083-l1-hydrotest-rca`

Pinned model/reference input: `BM4_L.ACCDB`, SHA-256 `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8`

## Finding under test

The current L1 `WW` path resolves the governed test-fluid density for ordinary pipe/bend spans through `caseMode.contentsDensityKgPerM3`, but the rigid and reducer gravity paths still read source-row `FLUID_DENSITY`. The inspected HP paths remain case-aware and resolve `HYDRO_PRESSURE`.

This is a source-level hypothesis, not a qualified mechanics change.

## Prepared batches

- **A1 — prepared-assembly audit:** `scripts/lfea-m047-stage2-l1-hydrotest-basis-audit.mjs`
  - custody-verifies the pinned ACCDB;
  - compares current prepared L1 gravity with a rigid/reducer-only test-density counterfactual;
  - records changed source elements and gravity deltas;
  - maps normalized `UX/UY/UZ` reference force components back to global `FX/FY/FZ` for the L1 support-force sum;
  - records HP binding and prepared pressure/Bourdon evidence.
- **A2 — nonlinear one-mechanic experiment:** `scripts/lfea-m047-stage2-l1-uniform-ww-experiment.mjs`
  - changes only rigid/reducer source `FLUID_DENSITY` in an in-memory counterfactual;
  - runs unchanged production R2 friction numerics;
  - reports convergence/equilibrium evidence and every friction-restraint normal/tangential comparison.
- **A3 — baseline attribution:** `scripts/lfea-m047-stage2-l1-uniform-ww-assess.mjs`
  - compares A2 against committed production R2 L1 baseline;
  - requires the same pinned source and R2 solver profile;
  - reports each restraint as improved/worsened/unchanged;
  - can nominate but never authorize the hypothesis.
- **A4 — one-shot driver:** `scripts/lfea-m047-stage2-l1-hydrotest-rca-run.mjs`
  - executes A1 -> A2 -> A3;
  - writes all artifacts plus a receipt;
  - leaves `productionPromotionAuthorized: false`.

## Real-file command

```bash
node scripts/lfea-m047-stage2-l1-hydrotest-rca-run.mjs \
  --accdb artifacts/bm4l-stage2/source/BM4_L.ACCDB \
  --out reports/lfea-m047-stage2-l1-hydrotest-rca
```

## Decision boundary

Do not edit production mechanics until the real A1/A2/A3 artifacts exist.

If the special-component counterfactual is load-bearing, improves the L1 normal-error pattern without breaking convergence/equilibrium, and A3 shows the improvement is distributed rather than a single-node trade, the next batch is exactly one production change: pass the resolved case contents density into rigid and reducer gravity the same way ordinary spans already do. Then frozen L2-L6/L14 controls and real nominal L13/L7/L1 must be rerun before promotion.

If the counterfactual is non-load-bearing, mixed, or worse, reject it and continue the L1 linear audit; do not tune friction against L1.

R7 remains frozen because the pinned ACCDB carries no authoritative CAESAR inter-case execution history.

## Current environment boundary

The GitHub connector can read the pinned ZIP only as base64 text, not as a mounted binary. The execution container cannot fetch the raw GitHub URL. Therefore this session has prepared the deterministic measurement path but has not produced a new real-ACCDB accuracy artifact.
