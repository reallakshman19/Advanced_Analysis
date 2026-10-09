# M047 L7 B0→D1 branch-history RCA

Pinned `BM4_L.ACCDB`, L7 `W+T1+P1`. No load stepping or solver/tolerance/comparison change.

Run `31721845373`, artifact `9189855108`, digest `sha256:fdde9a721ff9241064dbd04c79d5220f6c63b75b09b335f6312b31501147b253`.

B0 reproduces nonconvergence at 400 iterations. D1 converges at 161 and reproduces the original raw L7 D1 focus values.

Iteration 1 is identical. At iteration 2, D1 changes the slip increment at all 14 restraints with two tangential DOFs and at none of the nine one-DOF restraints. By iteration 3 the coupled difference reaches 22/23 restraints.

- **20350 (UX,UZ):** B0 relocks at 21 near `683.826 N`, re-slides at 24, and ends sliding near `686.012 N`. D1 relocks at 27 near `348.355 N`, stays locked, and converges at `347.469 N`; CAESAR is `462.691 N`, so the D1 normal remains `-24.90%`.
- **20440 (UX,UZ):** B0 stays sliding. D1 relocks at 23 and converges locked at `1906.714 N`; CAESAR is `1903.251 N`. D1 vector error remains `33.56%`.
- **20550 (UX):** local B0/D1 behavior is identical through iteration 2. Its iteration-3 divergence is downstream coupling. Both remain sliding; D1 converges with `8.80%` vector error.

B0's last state change is iteration 30 but it still misses residual gates at 400. D1 changes state through iteration 67 and then converges, so the improvement is not earlier active-set stabilization.

**Decision:** `D1_CONVERGENCE_GAIN_IS_A_COUPLED_2D_DIRECTION_BRANCH_SELECTION_EFFECT`.

No L7 load stepping, node-local rule, relaxed gate, or production promotion is authorized by this result.
