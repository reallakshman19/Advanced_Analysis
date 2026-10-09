# M047 Stage 2 — H2 sequential H1 relocked-direction measurement

Status: **REAL PINNED-ACCDB MEASUREMENT — REJECTED.**

H2 starts from measured H1 and adds one mechanic only after H1 has completed an actual `SLIDE → STICK` final return-map update: during later `STICK → STICK` iterations with permanent slip, preserve the current elastic trial-force magnitude but orient that locked force opposite total relative tangential displacement.

This is not the old D2-only experiment: H1 transition finalization has priority. Resultant cap, own-restraint normal basis, friction stiffness, hysteresis, acceleration, full-load path, convergence gates and ±10% comparison goal remain unchanged. Production source was not modified.

## Custody

- #1101 source head: `f087bed5578640c13d063a855b094146a2ded203`
- pinned ACCDB: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8`
- Actions run: `31692958251`
- artifact ID: `9178268980`
- artifact digest: `sha256:b6ac0e008f2a120f390def081c115380a220760b516f4ab528f09880b55a291f`
- transformed candidate source: `4a49d78408eff0c6ccc5382a88ff04f3658a38d528a7a5deb9d1b7b252a9c399`
- both repeats converged in **208 iterations**
- row hashes: `fnv1a64:abb32bb7848706b3` / `fnv1a64:abb32bb7848706b3`
- equilibrium and convergence gates: PASS
- 28 reproducible `SLIDE → STICK` transitions per repeat

## Accuracy

| metric | H1 | H2 |
|---|---:|---:|
| vectors within ±10% | **15/23** | **12/23** |
| normals within ±10% | 23/23 | 23/23 |
| normalized state matches | **19/23** | **18/23** |
| median vector error | **8.35%** | 9.61% |
| raw worst vector error | 593.95% | **382.22%** |

The targeted direction-dominated cohort improves in median error from **87.70% to 57.22%**, proving that locked-force direction is causally important. But the global result regresses.

Major direction repairs:

- 22140: **177.69% → 50.86%**
- 22220: **106.24% → 17.22%**
- 22070: **87.70% → 57.22%**

The cost is unacceptable magnitude/history corruption elsewhere:

- 22260: **8.35% → 98.14%**
- 21800: **3.73% → 43.43%**
- 21470: **8.35% → 42.06%**
- 22020: **1.17% → 18.83%**
- 22310: 19.63% → 41.37%
- 21740: 32.61% → 83.18%

20440 improves to 3.97% and 21860 to 0.14%, but these gains do not offset the lost H1 passes.

## Interpretation

H2 aligns the final force direction with the CAESAR reference very well at the direction-dominated nodes, so the direction hypothesis itself is real. The failure is **continuous reorientation of every locked iterate**, which perturbs permanent-slip magnitude history and the coupled equilibrium branch.

Therefore the next step must not add an arbitrary direction threshold or select nodes. The data-only discriminator is whether CAESAR's final force aligns with the **direction captured at the last H1 re-lock event**. If so, the general path rule to test would be direction memory at re-lock rather than continuous reorientation.

## Decision

**`REJECT_H2_LOST_DIRECTION_CORRECT_CONTROL`**

- D1 remains the accepted experimental baseline.
- H1 remains the leading governed-review candidate at 15/23.
- Reject continuous H2 locked-direction projection.
- No production change, tolerance change, comparison change, node exception, L7 unlock or BM4_NL unlock.

Machine-readable evidence: `reports/lfea-m047-stage2-h2-relocked-total-direction-measurement.json`.
