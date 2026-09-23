# B02B V2 Mesh-Ladder Migration Repair Execution Report (LADDER-0005)

## 1. Request Context & Preflight Verification

- **Request ID**: `LOCAL-EP-LAFEA3-C3D-B02B-LADDER-1771-0005-955cbc11394c`
- **Work Package**: `WP-1771`
- **EP**: `EP-LAFEA3-C3D-B02B-LADDER-1771-0005`
- **Material Base**: `ad821c11bcd657a52a80c5760aad845508a2ae82`
- **Required Material HEAD**: `955cbc11394c85ad5dfbd3bf399acf70e6a8cf8d`
- **Observed Repository HEAD**: `955cbc11394c85ad5dfbd3bf399acf70e6a8cf8d` (MATCH)
- **Required Common V3.1 Basis**: `4c0617bd2f41d25f43a5d98673abead8ca4e7686`
- **Observed Common HEAD**: `4c0617bd2f41d25f43a5d98673abead8ca4e7686` (MATCH)

---

## 2. Field-Level V1 vs V2 Mesh-Ladder Comparison (Migration Omission Proof)

Governed V1 source: `validation/lafea-b02-definitions/B02B-nonuniform-shear.json`
Active V2 definition: `validation/lafea-b02-definitions/B02B-nonuniform-shear-v2.json`

| Field | Governed V1 | Pre-Repair V2 (`ad821c11b`) | Repaired V2 (`955cbc113`) | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| `meshLadder.levels` (T3 / fallback) | `[{"h":2.5},{"h":1.25},{"h":0.625}]` | `[{"h":10},{"h":5},{"h":2.5}]` | `[{"h":2.5},{"h":1.25},{"h":0.625}]` | **RESTORED** |
| `meshLadder.levelsByMethod.T6` | `[{"h":10},{"h":5},{"h":2.5}]` | OMITTED (missing) | `[{"h":10},{"h":5},{"h":2.5}]` | **RESTORED** |
| `meshLadder.levelsByMethod.Q8` | `[{"h":10},{"h":5},{"h":2.5}]` | OMITTED (missing) | `[{"h":10},{"h":5},{"h":2.5}]` | **RESTORED** |
| `meshLadder.levelsByMethodJustification` | Present (T6/Q8 h=2.5 rationale, T3 probe-stable window) | OMITTED (missing) | Present (byte-identical to V1) | **RESTORED** |

### Definition Invariants Preserved
Comparing `ad821c11b` to `955cbc113`:
- Expected shear stress (`B02B-PROBE-TAU-01`): `-3.54290625` (**UNCHANGED**)
- Expected displacement (`B02B-PROBE-UY-01`): `-0.000874382546875` (**UNCHANGED**)
- `v2OracleCorrection`: **UNCHANGED**
- `acceptanceMode`: `FIXED_LOCATION_CONVERGENCE_ONLY` for both probes (**UNCHANGED**)
- Numerical tolerances: **UNCHANGED**
- Qualifier code: **UNCHANGED**
- Git diff check (`git diff --check`): **CLEAN**

---

## 3. Command Execution Matrix

| Surface ID | Command Line | Status | Exit Code | Start Time (UTC) | End Time (UTC) | Raw Receipts |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **B02B Standalone** | `node scripts/lafea-b02b-production-check.mjs` | **FAIL** | 1 | `2026-09-22T17:51:06.741Z` | `2026-09-22T17:54:14.474Z` | `commands/b02b.*` |
| **B02 Sequence** | `node scripts/lafea-b02-production-sequence-check.mjs` | **FAIL** | 1 | `2026-09-22T17:54:14.567Z` | `2026-09-22T17:57:53.480Z` | `commands/b02-sequence.*` |

---

## 4. Technical Analysis & Failing Boundary Shift

### 4.1 Resolution of UY-01 Divergent Witness
In the preceding definition-only run (`REPAIR-0004` on `ad821c11b`), T3 failed with:
`AssertionError [ERR_ASSERTION]: B02B-V2/T3/B02B-PROBE-UY-01 convergence is DIVERGENT`
because the mesh ladder was coarse `[10, 5, 2.5]`.
With the governed fine ladder `[2.5, 1.25, 0.625]` restored:
- `B02B-PROBE-UY-01` displacement convergence on T3 is **no longer divergent**.

### 4.2 Shift to New Exact Boundary: T3 TAU-01 Oscillatory Convergence
Both harnesses now stop at:
`scripts/lib/lafea-b02-rectangle-qualification.mjs:168:12`
`AssertionError [ERR_ASSERTION]: B02B-V2/T3/B02B-PROBE-TAU-01 convergence is OSCILLATORY`

Under `qualifyB02RectangleCase`:
1. `convergenceOnly` probes require that the refinement sequence is either strictly acceptable (`MONOTONIC_CONVERGING` or `STABLE_WITHIN_TOLERANCE_NOT_RICHARDSON_MONOTONIC`) or that the finest 3 levels vary by `<= 0.02` (2%).
2. For constant-strain triangles (T3) on B02B, shear stress probe `B02B-PROBE-TAU-01` evaluates as `OSCILLATORY` across levels [2.5, 1.25, 0.625] and exceeds the 2% relative band criterion.
3. In strict compliance with governing instructions:
   - The exact failure is retained fail-closed.
   - No convergence policy or qualifier code is modified.
   - The 2% stable-band rule is NOT modified to force T3 green.
   - No numerical tolerance is relaxed.

---

## 5. Governance & Prohibitions Enforced

- **5% numerical tolerance**: Unaltered
- **Expected values**: Unchanged
- **`v2OracleCorrection`**: Unmodified
- **Qualifier code**: Unmodified
- **B-bar and BM-005**: Untouched
- **Solver / mesher mechanics**: Unmodified
- **Issue #1862**: Unadmitted
- **Git custody**: No commit or push performed
