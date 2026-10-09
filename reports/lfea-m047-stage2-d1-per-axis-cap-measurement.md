# M047 Stage 2 — D1 per-axis Coulomb-box measurement

Status: **REAL PINNED-ACCDB MEASUREMENT — REJECTED AS THE MISSING GLOBAL L13 MECHANISM.**

## Scope

Accepted baseline is D1: sliding force direction opposite total relative tangential displacement with the current resultant Coulomb surface `||F_t||₂ <= μ|N|`.

P1 changes exactly one mechanic: the Coulomb capacity surface becomes a per-tangential-axis box:

```text
|F_i| <= μ|N|   for every free tangential axis i
```

D1 direction is retained exactly. Along that direction, the box-surface resultant capacity is `μ|N| / max(|direction_i|)`. Therefore a restraint with only one free tangent is mathematically unchanged by the local cap geometry and is an explicit negative control.

Unchanged: own-restraint signed normal basis, friction stiffness, state hysteresis, secant acceleration, full-load single-step L13 path, convergence limits, physical-equilibrium gate, ±10% comparison goal, and all ACCDB authority. The production solver was not modified.

## Custody

- #1101 experiment source head: `89ee02cf22412728819928d5d37146b573b9a82a`
- sibling accepted-D1 evidence head: `fadcee224328ab1a9e3c27e741442654e6b5206c`
- pinned `BM4_L.ACCDB` SHA-256: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8`
- ACCDB bytes: `5,136,384`
- Actions run: `31690877725`
- artifact ID: `9177392823`
- artifact digest: `sha256:57639ac42f6ab0663f1b5704cdde7752284c18bb19e27a0f621b22a988b3aa15`
- transformed candidate source SHA-256: `ef994300219d55849aca3e31049339b12047df8f9a3d13d6293c5fe1c8332a47`
- repeat row semantic hashes: `fnv1a64:a2864ca10d4813f4` / `fnv1a64:a2864ca10d4813f4`

Static isolation contract, source custody, ACCDB custody, both nonlinear repeats, convergence gates and recovered equilibrium all passed.

## Real result

| metric | D1 | P1 per-axis box |
|---|---:|---:|
| converged | yes | yes |
| iterations | 396 | **90** |
| deterministic | yes | **yes** |
| vectors within ±10% | **13/23** | **6/23** |
| normals within ±10% | **23/23** | **23/23** |
| normalized state matches | **19/23** | **14/23** |
| median vector error | **8.77%** | **13.54%** |
| above-R1-floor vector passes | **13/22** | **6/22** |
| above-R1-floor worst vector error | 176.22% | **102.69%** |

The lower worst error does not compensate for the broad loss of already-correct rows: threshold accuracy collapses from 13/23 to 6/23 and state agreement drops from 19/23 to 14/23.

## Reference partition candidates

The reference-only R3 signature identified exactly two two-axis rows where the CAESAR resultant exceeds `μ|N|` while each component individually remains below that same scalar cap:

| node | D1 vector error | P1 vector error | outcome |
|---|---:|---:|---|
| 22370 | 69.23% | 59.05% | improves but still fails |
| 21470 | 8.76% | 7.86% | small improvement; already passed |

The target cohort remains **1/2 within ±10% before and after P1**. The capacity-partition signature therefore does not convert into a useful qualification gain.

## Named residuals / negative control

| node | D1 | P1 | interpretation |
|---|---:|---:|---|
| 22140 | 176.22% | 102.69% | improves locally, but it is not a partition-signature row |
| 22220 | 111.57% | 40.12% | improves locally, but it is not a partition-signature row |
| 22370 | 69.23% | 59.05% | genuine partition candidate, still fails |
| 21470 | 8.76% | 7.86% | genuine partition candidate, already passed under D1 |
| 20710 | 9.03% | 10.36% | one-axis negative control; local cap geometry is identical |

The global coupling moves 20710 slightly even though its local one-axis cap law is unchanged, which is expected in a coupled nonlinear system. It does not provide support for a per-axis cap.

Several D1 passes become clear regressions under P1, including 20170 (8.77% → 33.50%), 20520 (5.43% → 27.98%), 22260 (11.26% → 36.57%), and 20440 (10.96% → 42.65%).

## Decision

**`REJECT_P1_AS_MISSING_GLOBAL_MECHANISM_KEEP_D1`**

1. Keep D1 as the L13 experimental baseline: **13/23 vectors, 23/23 normals, 19/23 normalized states**.
2. Close the per-axis-vs-resultant capacity-partition branch for the current BM4_L L13 model.
3. Do not promote P1 because local improvement at 22140/22220 is accompanied by broad regressions and those nodes were not reference partition candidates in the first place.
4. Do not reinterpret 20710 as per-axis-cap evidence; its one-axis local law is identical under P1.
5. No production mechanic, tolerance, comparison rule, acceptance criterion, friction stiffness, normal basis or node exception is changed by this result.

Machine-readable evidence: `reports/lfea-m047-stage2-d1-per-axis-cap-measurement.json`.
