# Baseline Qualification Report: C3-D Existing-Model Qualification Estate

## 1. Executive Summary

This execution slice was admitted under **EP-LAFEA3-C3D-BASELINE-1771-0001** (lease: `LEASE-LAFEA3-C3D-BASELINE-1771-0001`, roadmap revision: `RM-0008`, work package: `WP-1771`) on repository `reallaksh19/Advanced_Analysis` at commit `89420e9cba7879d8e9fa172350bd4210f5d90fe0`.

In accordance with the governing principle:
> *Establish the first demonstrated C3-D gap before changing production code. Do not infer a missing implementation merely because issue #1862 describes one.*

All four existing primary qualification harnesses were executed on the exact frozen basis without any product or benchmark modifications.

### Key Findings:
1. **Existing Qualification Estate Fails Before Composition**:
   Every one of the four qualification commands exited with code 1:
   - **B02 Production Sequence** (`scripts/lafea-b02-production-sequence-check.mjs`): Fails at step 2 (`scripts/lafea-b02d-probe-stable-polar-mesh-check.mjs:60`) with `AssertionError: T3/L1 'BLOCK' !== 'PASS'`. The script consumes the obsolete V1 polar mesh definition (`B02D-lug-pinhole.json`), which geometrically creates a 9.74° angle triangle that fails the mesh quality gate (<11.54° threshold), even though B02D production was already promoted to V2 (`B02D-lug-pinhole-v2.json`).
   - **BM-005 Ordinary Route** (`scripts/lafea.3-bm005-ordinary-route-check.mjs`): Single-mesh execution passes, solver diagnostics converge, and negative control passes, but the 4-level refinement study classifies as `OSCILLATORY` (`ASYMPTOTIC_RANGE_NOT_DEMONSTRATED`), marking the benchmark unqualified (`finalResultState: "RESULT_NOT_READY"`).
   - **Plane-Strain B-bar Lamé Route** (`scripts/lafea-plane-strain-bbar-lame-check.mjs`): Fails immediately at `scripts/lafea-plane-strain-bbar-lame-check.mjs:146` with `AssertionError: T6/0.3/L1/REGULAR mesh quality blocked` (minimum angle 11.198° < 11.537°).
   - **B01 Final Qualification** (`scripts/lafea-b01-final-qualification.mjs`): Fails because step 8 (`plane-strain-bbar-qualification`) fails, preventing the 54 base, 270 metamorphic, and 16 negative cases from running.

2. **Underlying Production Workbench Already Holds Authoritative Properties**:
   Inspection of the production runtime (`executeLafeaContinuumAuthoritativeWorkbenchRun`, `projectLafeaRuntimeSolverDiagnostics`, and `lafea-workbench-run-transaction-state.js`) reveals that the workbench store **already computes and holds**:
   - Full ancestry (`sourceHash`, `analysisDomainHash`, `analysisGeometryHash`, `meshHash`, `meshProfileHash`, `projectionHash`, `solverModelHash`, `canonicalExecutionInputHash`, `compiledExecutionHash`, `runtimeDiagnosticsHash`, `recoveryHash`, `runTransactionReceipt`).
   - Full solver diagnostics (`terminationState: 'CONVERGED'`, iteration counts, residuals, tolerances, equilibrium).
   - Bitwise deterministic replay (verified across two independent executions on B02A L1 T6: all 11 hashes and probe values matched identically).

3. **Receipt Emission Gap (Narrow Issue #1862)**:
   The benchmark qualification scripts (`lafea-b02-rectangle-qualification.mjs`, `lafea-b02c-production-check.mjs`, `lafea-b02d-production-check.mjs`) discard or omit these authoritative properties from their exported receipts, retaining only `meshHash`, `executionHash`, and `recoveryHash`.
   Issue #1862 proposed building a new composition layer, but in reality, the production engine does not need new architecture—it only needs its existing properties projected into the qualification receipts once the benchmark definition blockers are resolved.

4. **Disposition**:
   **`STRUCTURED_BOUNDARY_FINDINGS`** (with secondary finding **`NARROW_ISSUE_1862`**).
   Confirmed source-binding defects are cleanly separated from unresolved numerical/mesh/convergence boundaries; no tolerance or oracle relaxation is permitted.
   Issue #1862 must remain **unadmitted**.

---

## 2. Frozen Execution Basis

- **Repository**: `reallaksh19/Advanced_Analysis`
- **Handover HEAD**: `89420e9cba7879d8e9fa172350bd4210f5d90fe0`
- **Branch**: `main` (detached at 89420e9)
- **Working Tree**: Clean before and after execution (only permitted writes in `relay/EVIDENCE/C3D-BASELINE/**`)
- **Environment**:
  - Node.js: `v24.11.1`
  - npm: `11.6.2`
  - Git: `2.52.0.windows.1`
  - OS: Windows (`win32`, `x64`)

### Source Blob Identities:
- `scripts/lafea-b02-production-sequence-check.mjs`: `5826e8d457b6b75d548da3963fa6c980dc530da4`
- `scripts/lafea.3-bm005-ordinary-route-check.mjs`: `fe08a2b6359e250981f68cab6d4c4fe4c9c74699`
- `scripts/lafea-b01-final-qualification.mjs`: `305af161ca3ce7a2b4ea6b6ea4b2ca4560753a5a`
- `scripts/lafea-plane-strain-bbar-lame-check.mjs`: `47f9dcad62387aef74f3a069aa666e180f260602`
- `scripts/lib/lafea-b02-production-route.mjs`: `5d873872404ad6f0885a1fd9e9bacbb7631f5650`
- `scripts/lib/lafea-b02-rectangle-qualification.mjs`: `021f041aa30fb6686f839fa94ff85240672799f1`
- `src/workspace/lafea-runtime-solver-diagnostics.js`: `e5e6ef00d25bd8b9d4e42448148461bdcf4bb77f`
- `src/workspace/lafea-continuum-authoritative-workbench-run.js`: `a469259db7887aceaaf8783b7e7700046c4cddd8`

All blobs match the exact handover values.

---

## 3. Command Execution Matrix

| Surface ID | Command Line | Status | Exit Code | Stdout Artifact | Stderr Artifact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B02** | `node scripts/lafea-b02-production-sequence-check.mjs` | **FAIL** | 1 | `commands/b02.stdout.txt` | `commands/b02.stderr.txt` |
| **BM-005** | `node scripts/lafea.3-bm005-ordinary-route-check.mjs` | **FAIL** | 1 | `commands/bm005.stdout.txt` | `commands/bm005.stderr.txt` |
| **B01** | `node scripts/lafea-b01-final-qualification.mjs` | **FAIL** | 1 | `commands/b01.stdout.txt` | `commands/b01.stderr.txt` |
| **B-bar** | `node scripts/lafea-plane-strain-bbar-lame-check.mjs` | **FAIL** | 1 | `commands/bbar.stdout.txt` | `commands/bbar.stderr.txt` |

---

## 4. Root Cause Analysis of Executed Failures

### 4.1 B02 Production Sequence Failure
- **Failing Location**: `scripts/lafea-b02d-probe-stable-polar-mesh-check.mjs:60:12`
- **Error**: `AssertionError [ERR_ASSERTION]: T3/L1 'BLOCK' !== 'PASS'`
- **Mechanism**:
  `lafea-b02-production-sequence-check.mjs` sequentially runs:
  1. `B02C_ANALYTICAL_TRACTION` -> PASSED.
  2. `B02D_POLAR_MESH` (`scripts/lafea-b02d-probe-stable-polar-mesh-check.mjs`) -> FAILED.
  The polar check script loads `validation/lafea-b02-definitions/B02D-lug-pinhole.json` (V1 definition). In V1, the radial/circumferential division ratio splits coarse polar cells along a diagonal creating a triangular element with a 9.74° corner angle and a scaled Jacobian of 0.169.
  Under the frozen mesh quality policy (`qualifyLafeaAnalysisMesh`), any element with angle < 11.537° or scaled Jacobian < 0.2 is classified as `worstStatus: 'BLOCK'`.
  The script asserts that `first.evidence.qualification === 'PASS'` for all methods (`T3`, `T6`, `Q8`) and all levels, which fails on T3/L1.
  Crucially, `scripts/lafea-b02d-production-check.mjs` was already updated to V2 (`B02D-lug-pinhole-v2.json`), which widens the divisions and passes cleanly. However, `lafea-b02-production-sequence-check.mjs` was never updated to retire or repin the V1 check.

### 4.2 B02B T3 Relative Error Failure
- **Failing Location**: `scripts/lib/lafea-b02-rectangle-qualification.mjs:97:7`
- **Error**: `AssertionError: B02B-V2/T3/B02B-PROBE-TAU-01 finest relative error: 0.079990250251308 > 0.05`
- **Mechanism**:
  When `scripts/lafea-b02b-production-check.mjs` is executed individually, constant-strain triangles (T3) achieve 7.999% relative error on shear stress probe `TAU-01` on the finest mesh, exceeding the 5% error limit. While T3 is marked `CONTROL_NOT_RELEASE_CRITICAL` in B02D, B02B strictly asserts within 5% for all methods.

### 4.3 B-bar Lamé Route Mesh Quality Failure
- **Failing Location**: `scripts/lafea-plane-strain-bbar-lame-check.mjs:146:12`
- **Error**: `AssertionError [ERR_ASSERTION]: T6/0.3/L1/REGULAR mesh quality blocked`
- **Mechanism**:
  The harness executes `executeLameBbarQualificationCase` for T6, nu=0.3, level L1, REGULAR distortion. The generated mesh produces quadratic triangles with a minimum angle of 11.198°, which falls below the quality gate blocking threshold of 11.537°. `qualifyLafeaAnalysisMesh` flags the mesh as `BLOCK`, triggering an immediate assertion failure.
  Because B01 final qualification (`scripts/lafea-b01-final-qualification.mjs`) invokes this check as step 8, B01 is also blocked from completing.

### 4.4 BM-005 Convergence Oscillatory Classification
- **Failing Location**: `scripts/lafea.3-bm005-ordinary-route-check.mjs`
- **Result**: `report.status: "FAIL"`, reasons: `["ASYMPTOTIC_RANGE_NOT_DEMONSTRATED", "ANALYTICAL_ORACLE_OUTSIDE_FINE_GCI", "RESULT_PUBLICATION_NOT_QUALIFIED"]`.
- **Mechanism**:
  BM-005 executes all 4 levels (COARSE, MEDIUM, FINE, EXTRA_FINE) through the ordinary workbench route. However, probe convergence evaluates to `OSCILLATORY` rather than monotonic. The analytical oracle lies outside the fine mesh GCI band. Consequently, publication authority is denied (`finalResultState: "RESULT_NOT_READY"`).

---

## 5. Field-by-Field C3-D Completeness Analysis

### 5.1 Production Ancestry
- **In Workbench Runtime**: All 13 ancestry tokens exist authoritatively on `stage.execution` and `runTransactionReceipt`.
- **In Emitted Receipts**: Only `meshHash`, `executionHash`, and `recoveryHash` are retained in B02 level receipts. The remaining hashes (`sourceHash`, `analysisDomainHash`, `analysisGeometryHash`, `meshProfileHash`, `projectionHash`, `solverModelHash`, `solverConfigHash`, `canonicalExecutionInputHash`, `runtimeDiagnosticsHash`, `runTransactionReceipt`) are **omitted from the benchmark receipts**.

### 5.2 Solver Diagnostics
- **In Workbench Runtime**: `projectLafeaRuntimeSolverDiagnostics` projects full diagnostic records including storageRoute, methods, iteration counts, initial/final residuals, convergence tolerances, and free-DOF residuals.
- **In BM-005**: Fully emitted under `report.solverDiagnostics`.
- **In B02 Receipts**: Only `solverStorage` and `solverMethods` are extracted; residual and iteration evidence is omitted.

### 5.3 Currentness Authority
- **In Workbench Runtime**: `runTransactionReceipt` transitions to `COMPLETED` only after preflight parent matching, execution verification, and recovery publication.
- **In B02 Receipts**: Currentness is asserted in-memory during execution (`stage.lifecycle.artifacts.RECOVERY.status === 'CURRENT'`), but no persistent currentness token or transaction receipt is emitted in the output JSON.

### 5.4 Equilibrium & Mechanics
- Fully retained in B02 and BM-005: applied forces/moments, reaction forces/moments, imbalances, relative residuals, strain energy, and energy reconstruction.

### 5.5 Convergence
- Evaluated with rigorous GCI and observed order across 3-4 levels on fixed physical probes. Proved monotonic on B02A, B02C, and B02D; oscillatory on BM-005.

### 5.6 Deterministic Replay
- Existing qualification suite contains no second-pass solver execution.
- Empirical probe on B02A L1 T6 proved 100% bitwise determinism across two isolated passes (identical hashes for source, domain, geometry, mesh, profile, projection, solver model, input, execution, runtime diagnostics, recovery, and identical probe values).
- Replay script and raw receipts are durably retained under repository custody:
  - Script: `relay/EVIDENCE/C3D-BASELINE/BASELINE-0001/replay/test_replay.mjs`
  - Replay Receipt: `relay/EVIDENCE/C3D-BASELINE/BASELINE-0001/replay/replay-receipt.json`
  - Pass 1 Summary: `relay/EVIDENCE/C3D-BASELINE/BASELINE-0001/replay/pass1.execution.json`
  - Pass 2 Summary: `relay/EVIDENCE/C3D-BASELINE/BASELINE-0001/replay/pass2.execution.json`
  - Process stdout/exit: `relay/EVIDENCE/C3D-BASELINE/BASELINE-0001/replay/replay.stdout.txt`, `replay.exit.txt`

---

## 6. Disposition & Next Engineering Steps

### Disposition: `STRUCTURED_BOUNDARY_FINDINGS`
The primary failure preventing C3-D qualification is not a missing composition architecture (#1862). It is that the existing qualification harnesses contain confirmed source-binding defects and unresolved numerical/mesh/convergence boundaries:

1. **Confirmed Source Binding Defect**:
   - `lafea-b02-production-sequence-check.mjs` references an obsolete V1 polar mesh test (`B02D-lug-pinhole.json`) that was superseded by V2 (`B02D-lug-pinhole-v2.json`). V2 passes cleanly, but the sequence check was left pointing to V1.

2. **Unresolved Qualification Envelope**:
   - `lafea-b02b-production-check.mjs` reports T3 finest relative error of 7.999% against the 5% limit.
   - *Governance Restriction*: Do not classify as a bad tolerance or benchmark definition defect without proving T3 applicability/authority. Do not relax the B02B 5% tolerance criterion.

3. **Unresolved Mesh Quality Boundary**:
   - `lafea-plane-strain-bbar-lame-check.mjs` generates a coarse T6 mesh whose minimum angle (11.198°) violates the frozen quality threshold (< 11.537°), halting B-bar qualification and B01 step 8.
   - *Governance Restriction*: Reconcile raw evidence and intended supported mesh envelope before proposing any change.

4. **Unresolved Convergence Boundary**:
   - `lafea.3-bm005-ordinary-route-check.mjs` classifies 4-level refinement as `OSCILLATORY` (`RESULT_NOT_READY`).
   - *Governance Restriction*: Treat as a genuine convergence/publication result until its first owning boundary is demonstrated. Do not treat as a benchmark-definition defect merely because it prevents a green aggregate.

5. **Receipt Projection Gap & Deterministic Replay**:
   - Workbench production runtime authoritatively holds all 13 ancestry tokens, solver diagnostics, and currentness tokens. Receipts omit them.
   - Two-pass deterministic replay is 100% proved and durably retained in-repository under `replay/`.

### Recommendation for Next EP:
1. **Keep Issue #1862 UNADMITTED**: Do not implement a new composition layer while the constituent benchmark definitions and boundaries are unresolved.
2. **Open a Targeted Diagnostic EP**:
   - Rebind `scripts/lafea-b02-production-sequence-check.mjs` to the verified V2 polar mesh qualification.
   - Assess T3 qualification envelope applicability on B02B without weakening frozen tolerances.
   - Reconcile the coarse-level triangle angle on the B-bar Lamé route.
   - Investigate the BM-005 oscillatory convergence boundary.
3. **Narrow Issue #1862**: Once boundaries are reconciled, narrow issue #1862 strictly to projecting already-existing workbench properties (`runTransactionReceipt`, `runtimeDiagnosticsHash`, ancestry) into benchmark qualification receipts without modifying solver or mechanics code.

### Authority Statement:
This baseline execution establishes empirical findings only. It grants no release authority and no unexecuted C3-D capability claim.
