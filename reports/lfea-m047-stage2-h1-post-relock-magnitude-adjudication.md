# M047 Stage 2 — H1 post-relock magnitude adjudication

Status: **DATA-ONLY RCA COMPLETE — no general non-tuned magnitude-memory law established; do not stage H3.**

## Boundary

H1 remains the exact nonlinear state being reproduced: row semantic hash `fnv1a64:77eea847870b228b`, 249 iterations, with no mechanics, tolerance, comparison or convergence-gate change.

The already-measured direction RCA remains strong: CAESAR's final force direction aligns closely with the direction captured at H1's last `SLIDE → STICK` event for the major direction residuals. This diagnostic asked a separate question: **what general magnitude evolution, if any, should follow that re-lock?**

Two data-only counterfactuals were evaluated across all 18 restraints that had at least one H1 re-lock event:

1. hold the last-relock Coulomb force vector constant;
2. retain the last-relock force direction and allow scalar unload/reload from subsequent displacement projected on that stored direction.

Neither counterfactual was inserted into the nonlinear solver.

## Guarded evidence

Accepted execution:

- Actions run: `31695000295`
- source head: `fd993f6bada46663125744bd33ee3632a0f292d8`
- artifact ID: `9179018266`
- artifact digest: `sha256:3a35f6f868d269d88efe81b1edaed1703067b89ef22cdf438ba51f9b8e25dbdb`
- ACCDB: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8`
- exact H1 row hash reproduction: PASS
- independent recomputation of every scalar-memory vector error: PASS

Two earlier diagnostic artifacts are explicitly superseded and are **not engineering evidence**: v1 had the scalar projection sign reversed; v2 corrected that sign but omitted direction-component multiplication when constructing the counterfactual vector. Neither bug affected H1, H2, P1 or any nonlinear solver measurement. v3 includes an independent post-run algebra guard and is the only accepted magnitude artifact.

## Aggregate result

| data-only counterfactual | rows ≤10% | rows ≤20% | median vector error | worst |
|---|---:|---:|---:|---:|
| constant last-relock Coulomb force | **12/18** | **14/18** | **8.33%** | 111.39% |
| scalar unload/reload, signed | 7/18 | 9/18 | 21.95% | 177.69% |
| scalar unload/reload, no reverse | 7/18 | 9/18 | 20.97% | 99.08% |

The constant-force counterfactual is often close because many CAESAR final magnitudes remain near the re-lock Coulomb surface. But that is not a general law: the CAESAR final magnitude / H1 re-lock-cap ratio ranges from **0.473 to 1.100**.

## Decisive counterexample: 22310

Node 22310 is direction-correct in H1 and has only a magnitude/history residual. Its CAESAR final magnitude is only **47.31% of the H1 last-relock cap**.

- constant last-relock cap vector error: **111.39%**
- scalar stored-direction counterfactual: **19.63%**
- measured H1 itself: **19.63%**

Therefore “hold the re-lock Coulomb force constant” cannot be a general post-relock rule. It would explicitly destroy the low-utilization unload that CAESAR reports at 22310.

## Major residuals

| node | CAESAR final magnitude / re-lock cap | constant re-lock force error | scalar direction-memory error |
|---|---:|---:|---:|
| 22140 | 0.888 | 12.62% | 177.69% signed / 22.31% no-reverse |
| 22220 | 0.959 | **7.95%** | 97.76% |
| 22070 | 0.946 | 22.09% | 63.87% |
| 22370 | 1.017 | **5.41%** | 56.21% |
| 21740 | 0.920 | 23.34% | 24.36% |
| 22310 | **0.473** | **111.39%** | 19.63% |

Repaired controls also show that neither counterfactual dominates generally: 21860 is excellent under either (0.35% constant, 2.49% scalar), while 22120 is excellent for constant force (1.27%) but poor for scalar memory (25.94%).

## Engineering conclusion

The evidence now separates the remaining issue cleanly:

- **direction memory at re-lock is strongly supported** by the independent last-relock direction diagnostic;
- **magnitude evolution after re-lock is not described by one simple non-tuned rule** among the tested physical counterfactuals;
- continuous direction rewriting (H2) is already measured and rejected because it corrupts magnitude history;
- holding the re-lock cap constant is rejected by 22310;
- scalar elastic unload/reload along the stored re-lock direction is worse in aggregate and does not resolve the major direction rows.

Therefore **no H3 mechanic is authorized from this branch**. Writing one now would require a benchmark-selected threshold, node exception, or undocumented interpolation between incompatible counterexamples.

## Disposition

1. **D1 remains the accepted experimental baseline: 13/23 vectors, 23/23 normals.**
2. **H1 remains the leading governed-review candidate: 15/23 vectors with no D1 pass lost.**
3. P1 and H2 remain rejected.
4. Stop the current post-relock magnitude branch without H3.
5. Do not promote H1 yet; seven above-R1 vector failures remain and 22140 is slightly worse than D1.
6. Do not change production mechanics, friction stiffness, normal basis, tolerances, comparison rules, acceptance criteria or node exceptions.
7. L7, L1 and BM4_NL remain blocked.

Machine-readable adjudication: `reports/lfea-m047-stage2-h1-post-relock-magnitude-adjudication.json`.
