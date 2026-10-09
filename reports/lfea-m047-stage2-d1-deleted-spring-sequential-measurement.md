# M047 Stage 2 — D1 deleted-spring / constant-force sequential measurement

Status: **REAL PINNED-ACCDB MEASUREMENT — rejected for nonconvergence.**

This experiment tests the documented CAESAR friction sequence as a project RCA discriminator: a tangential friction spring is present before breakaway; after the Coulomb cap is exceeded, the spring is removed and the previous iteration's constant capped force is applied on the next iteration. D1's total-relative-tangential-displacement direction is retained. This is not a claim about unpublished CAESAR convergence numerics.

## Custody

- PR #1101 source head measured: `649fb1fb14ecacf7e9b0228290b5d0a090097169`
- sibling D1 evidence head: `ec5d98713727b5d6e4acfe6ccdbc2336ee5f2392`
- pinned `BM4_L.ACCDB` SHA-256: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8`
- ACCDB bytes: `5,136,384`
- GitHub Actions run: `31686794315`
- artifact ID: `9175994007`
- artifact digest: `sha256:dee87508b40b800c6082e73d4d125e1da464c0e3af6445dc2615b7a4c3604328`
- two 400-iteration repeats: **deterministic**
- run semantic hash: `fnv1a64:a666ec2c1ac40269`

No production solver, comparison rule, tolerance, friction stiffness, load path, or node exception was changed.

## Baseline

Accepted D1 remains:

- tangential vectors within ±10%: **13/23**
- normal reactions within ±10%: **23/23**
- normalized constitutive-state matches: **19/23**

## Result

Neither repeated deleted-spring run produced a single full-physics-qualified iterate in the fixed 400-iteration budget: **0/400 in run 1 and 0/400 in run 2**.

The active-set labels become stationary very early, but that is not nonlinear convergence:

- first zero-state-change iteration: **2**
- vectors within ±10% at that iterate: **3/23**
- normals within ±10%: **20/23**
- normalized state matches: **12/23**
- reaction update: **32,077.03 N**
- displacement update: **3.87995 mm**

By iteration 400 the active set is still unchanged and recovered equilibrium remains PASS for each linearized solve, but the nonlinear update is nowhere near the unchanged gates:

| quantity | iteration 400 | required gate |
|---|---:|---:|
| reaction update | **2067.48 N** | `0.01 N` |
| displacement update | **1.23813 mm** | `1e-7 mm` (`1e-10 m`) |
| state changes | **0** | `0` |
| recovered equilibrium | **PASS** | PASS |

The last 48 iterations have active-set period 1 but **full force/reaction response period 2**. The two alternating response states repeat exactly in the tail. Therefore a state-stable stopping rule would select a moving/oscillating nonlinear solution, not a converged static equilibrium.

For diagnosis only, the two final alternating iterates score 6/23 and 5/23 tangential vectors within ±10%, respectively. Those are **not qualified accuracy results** because neither passes the nonlinear convergence gates and they must not be selected based on benchmark error.

## Decision

**`REJECT_DELETED_SPRING_SEQUENTIAL_NONCONVERGED_KEEP_D1`**

1. Keep D1 as the measured L13 experimental baseline.
2. Do not promote the literal deleted-spring / previous-iteration constant-force sequence under the unchanged project convergence gates.
3. Do not use the first state-stable iterate or either period-2 branch as a reported solution.
4. Do not reduce friction stiffness, widen tolerances, alter comparison rules, or introduce node exceptions to force this benchmark to pass.
5. Keep node 20710's independent one-axis capacity/path signal open.
6. L7 and BM4_NL remain blocked.

Compact machine-readable custody and adjudication: `reports/lfea-m047-stage2-d1-deleted-spring-sequential-adjudication.json`.
