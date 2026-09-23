# Plane-Strain B-bar Lamé Qualification Execution Report (BBAR-0008)

## 1. Request Context & Preflight Verification

- **Work Package**: `WP-1771`
- **EP**: `EP-LAFEA3-C3D-BBAR-LAME-1771-0008`
- **Lease**: `LEASE-LAFEA3-C3D-BBAR-LAME-1771-0008` (state: ACTIVE)
- **Material Base**: `a553f43be691b7e7bf425c733f2aaf9712744a74`
- **Permitted Write Scope**: `scripts/lib/lafea-plane-strain-bbar-lame-fixture.mjs`, `relay/EVIDENCE/C3D-BBAR-LAME/**`
- **Prohibitions**:
  - No changes to benchmark definitions, expected values, or tolerances
  - No changes to quality policy blocking thresholds or solver code
  - No BM-005 changes
  - No workflow YAML changes
  - No merge authority

---

## 2. Mesh Angle Defect Resolution (AC-C3D-BBAR-1)

### Defect Mechanism in Baseline:
In `scripts/lib/lafea-plane-strain-bbar-lame-fixture.mjs`, `protectedAxis` previously calculated the cell subdivision count as:
```javascript
const count = Math.max(1, Math.ceil(subdivisionRatio - roundoff));
```
For the coarse L1 mesh ($h = 20$ mm), the non-probe angular interval $[0, 23.333^\circ]$ has width $23.333^\circ$ against target angular spacing $19.098^\circ$ ($	ext{ratio} = 1.2217$). Using `Math.ceil` split this single cell into two narrow slivers of $11.666^\circ$ each. During triangular split (T6), this collapsed the corner angle to $11.198^\circ$, violating the frozen quality threshold ($11.537^\circ$) and halting qualification at Gate 0 with `worstStatus: 'BLOCK'`.

### Applied Material Fix:
In `scripts/lib/lafea-plane-strain-bbar-lame-fixture.mjs:401`:
```javascript
const count = Math.max(1, Math.round(subdivisionRatio));
```
Nearest-integer rounding keeps the interval as a single $23.333^\circ$ cell.

### Quantitative Validation:
- Pre-repair minimum corner angle: $11.198^\circ$ (`BLOCK`)
- Post-repair minimum corner angle: $17.23^\circ$ (`PASS`)
- Blocking threshold: $11.537^\circ$ (margin: $+5.693^\circ$)
- `AC-C3D-BBAR-1`: **PASSED**.

---

## 3. Qualification Execution & Downstream Solver Barrier (AC-C3D-BBAR-2)

With the Gate 0 mesh quality gate cleared, `node scripts/lafea-plane-strain-bbar-lame-check.mjs` advanced into the full analysis matrix.

### Matrix Results:
1. **Level L1 ($h=20$)**: 198 DOFs (<= 1536) -> Solved via Dense Cholesky -> **ALL PASS** (T6/Q8, all $
u \in [0.3, 0.4999]$, all distortions).
2. **Level L2 ($h=10$)**: 798 DOFs (<= 1536) -> Solved via Dense Cholesky -> **ALL PASS** (T6/Q8, all $
u \in [0.3, 0.4999]$, all distortions).
3. **Level L3 ($h=5$)**: 2730 DOFs (> 1536) -> Automatically switches to Symmetric CSR + Jacobi PCG:
   - $
u = 0.30$: **PASS** (478 iterations, residual $1.67 	imes 10^{-10} \le 2.10 	imes 10^{-10}$)
   - $
u = 0.45$: **PASS** (708 iterations, residual $1.76 	imes 10^{-10} \le 2.10 	imes 10^{-10}$)
   - $
u = 0.49$: **PASS** (1523 iterations, residual $1.40 	imes 10^{-10} \le 2.10 	imes 10^{-10}$)
   - $
u = 0.499$: **FAIL** after 42,560 iterations:
     `Sparse PCG residual 1.471926225349307e-8 exceeds internal target 2.102108772439442e-10 (acceptance gate 2.102108772439442e-8)`
   - $
u = 0.4999$: **FAIL** after 42,560 iterations:
     `Sparse PCG residual 0.00514 exceeds internal target 2.102108772439442e-10`

### Downstream Boundary Analysis:
1. **Per-DOF Residual vs Internal Convergence Target**:
   At $
u = 0.499$, the residual reached $1.47 	imes 10^{-8}$, which already satisfies the caller's per-DOF acceptance gate ($2.10 	imes 10^{-8}$). However, `pcg.js` enforces `PCG_CONVERGENCE_SAFETY_FACTOR = 100` (introduced in commit `929828f11` to handle 70,000 DOF models), requiring residual $< 2.10 	imes 10^{-10}$.
2. **Ill-Conditioning in Near-Incompressibility**:
   In near-incompressible plane strain ($
u 	o 0.5$), the bulk modulus $K = rac{E}{3(1-2
u)}$ dominates, scaling matrix condition number as $O(rac{1}{1-2
u} h^{-2})$. Simple Jacobi preconditioning does not separate the volumetric null space, causing iteration counts to exceed the `Math.min(50000, size * 16)` cap.
3. **Scope Boundary**:
   Under EP-0008, modifying solver code in `src/core/lafea-linear-solve/` or relaxing acceptance tolerances is strictly prohibited. The exact numerical failure is retained fail-closed.

---

## 4. Governance Compliance

- **Product code changes**: Only 1 line modified in `scripts/lib/lafea-plane-strain-bbar-lame-fixture.mjs` (rounding logic).
- **Benchmark definitions & tolerances**: Completely unmodified.
- **Solver & quality code**: Completely unmodified.
- **BM-005**: Untouched.
- **Delivery mode**: Retained on `relay/c3d-v31-diagnostic-1771` for Draft PR #1868. Never merged to `main`.
