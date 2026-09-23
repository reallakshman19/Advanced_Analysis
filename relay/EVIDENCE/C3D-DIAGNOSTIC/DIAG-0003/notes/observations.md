# Diagnostic Execution Report: C3-D Diagnostic Qualification (DIAG-0003)

## 1. Executive Summary & Request Context

- **Request ID**: `LOCAL-EP-LAFEA3-C3D-DIAGNOSTIC-1771-0003-1019ca26cb18`
- **Work Package**: `WP-1771`
- **EP**: `EP-LAFEA3-C3D-DIAGNOSTIC-1771-0003`
- **Branch**: `relay/c3d-v31-diagnostic-1771`
- **Required Material HEAD**: `1019ca26cb18332983f64258698787280b86afd1`
- **Observed Repository HEAD**: `1019ca26cb18332983f64258698787280b86afd1`
- **Common Repository HEAD**: `c87cf87b313801e42ecd0fcc7d36af0d90c5f400`
- **Execution Timestamp**: `2026-09-22T17:02:12Z` to `2026-09-22T17:03:22Z`
- **Historical Evidence**: `relay/EVIDENCE/C3D-BASELINE/BASELINE-0001/**` preserved strictly unchanged.

---

## 2. Diagnostic Execution Matrix

| Surface ID | Command Line | Status | Exit Code | Start Time (UTC) | End Time (UTC) | Raw Receipts |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **B02 Sequence** | `node scripts/lafea-b02-production-sequence-check.mjs` | **FAIL** | 1 | `2026-09-22T17:02:12.083Z` | `2026-09-22T17:02:56.770Z` | `commands/b02-sequence.*` |
| **B02B Standalone** | `node scripts/lafea-b02b-production-check.mjs` | **FAIL** | 1 | `2026-09-22T17:02:56.847Z` | `2026-09-22T17:03:03.601Z` | `commands/b02b.*` |
| **B-bar Lamé** | `node scripts/lafea-plane-strain-bbar-lame-check.mjs` | **FAIL** | 1 | `2026-09-22T17:03:03.612Z` | `2026-09-22T17:03:04.123Z` | `commands/bbar.*` |
| **BM-005 Ordinary** | `node scripts/lafea.3-bm005-ordinary-route-check.mjs` | **FAIL** | 1 | `2026-09-22T17:03:04.134Z` | `2026-09-22T17:03:22.798Z` | `commands/bm005.*` |
| **Deterministic Replay** | `node relay/EVIDENCE/C3D-DIAGNOSTIC/DIAG-0003/replay/test_replay.mjs` | **PASS** | 0 | `2026-09-22T17:14:33.000Z` | `2026-09-22T17:14:38.000Z` | `replay/*` |

---

## 3. Preservation of Separate Boundary Classifications

### 3.1 B02D V1→V2 Sequence-Binding Correction (VERIFIED EFFECTIVE)
- **Surface**: `scripts/lafea-b02-production-sequence-check.mjs`
- **Observation**:
  In baseline commit `89420e9cba7879d8e9fa172350bd4210f5d90fe0`, the B02 sequence check bound to `scripts/lafea-b02d-probe-stable-polar-mesh-check.mjs` (V1 polar definition), which geometrically failed on T3/L1 angle (9.74° < 11.537°), halting with `LAFEA_B02_PRODUCTION_SEQUENCE_BLOCKED_AT_B02D_POLAR_MESH`.
  In `1019ca26cb18332983f64258698787280b86afd1`, the sequence check was bound to `scripts/lafea-b02d-v2-preobservation-quality-check.mjs`.
  During this execution, step 2 (`B02D_POLAR_MESH`) executed and passed cleanly. The sequence successfully progressed past the polar check, demonstrating that the V1→V2 binding defect in the sequence harness is confirmed and resolved.
  The sequence subsequently halts at B02B with `LAFEA_B02_PRODUCTION_SEQUENCE_BLOCKED_AT_B02B`.

### 3.2 B02B V2 Acceptance-Mode Migration Defect (CONFIRMED UNRESOLVED)
- **Surface**: `scripts/lafea-b02b-production-check.mjs`
- **Failing Assertion**: `scripts/lib/lafea-b02-rectangle-qualification.mjs:97:7`
- **Error**: `AssertionError: B02B-V2/T3/B02B-PROBE-TAU-01 finest relative error: 0.079990250251308 > 0.05`
- **Governance Restriction**:
  Do **not** classify as a bad tolerance or benchmark definition without proving T3 applicability/authority.
  Do **not** relax the B02B 5% error tolerance criterion.

### 3.3 B-bar T6/L1 Mesh-Quality Boundary (CONFIRMED UNRESOLVED)
- **Surface**: `scripts/lafea-plane-strain-bbar-lame-check.mjs`
- **Failing Assertion**: `scripts/lafea-plane-strain-bbar-lame-check.mjs:146:12`
- **Error**: `AssertionError [ERR_ASSERTION]: T6/0.3/L1/REGULAR mesh quality blocked`
- **Detail**:
  The regular quadratic triangle mesh generated for T6, nu=0.3, level L1 exhibits a minimum corner angle of 11.198°, which falls below the quality gate blocking threshold of 11.537°.
  This assertion blocks B-bar qualification and prevents B01 step 8 from completing.
- **Governance Restriction**:
  Do **not** relax mesh quality thresholds. Reconcile the supported mesh envelope and quality policy with evidence.

### 3.4 BM-005 Oscillatory Convergence / RESULT_NOT_READY Boundary (CONFIRMED UNRESOLVED)
- **Surface**: `scripts/lafea.3-bm005-ordinary-route-check.mjs`
- **Report Status**: `FAIL` (`reasons: ["ASYMPTOTIC_RANGE_NOT_DEMONSTRATED", "ANALYTICAL_ORACLE_OUTSIDE_FINE_GCI", "RESULT_PUBLICATION_NOT_QUALIFIED"]`)
- **Detail**:
  Single mesh solve converges and negative control passes, but 4-level refinement evaluates to `OSCILLATORY`.
  The analytical oracle lies outside the fine GCI band, resulting in `finalResultState: "RESULT_NOT_READY"`.
- **Governance Restriction**:
  Treat as a genuine convergence/publication result until its first owning boundary is demonstrated.
  Do **not** treat as a benchmark-definition defect merely because it prevents a green aggregate.

---

## 4. Deterministic Replay on Material HEAD `1019ca26c`

A two-pass isolated execution probe was executed against `B02A-nonuniform-bending.json`, method `T6`, level `L1` on `1019ca26cb18332983f64258698787280b86afd1`:

- **Execution Script**: `relay/EVIDENCE/C3D-DIAGNOSTIC/DIAG-0003/replay/test_replay.mjs`
- **Exit Code**: `0`
- **Hashes Evaluated**:
  1. `sourceHash`: `sha256:9b141f4ee2e50776cb9f60fda208691b9c9445178d7578b7c50d77f0e5f5823e` (PASS)
  2. `analysisDomainHash`: `sha256:7868f67b381d27d46252cbc97548e2735612a20f6054d320367b8ad29b988490` (PASS)
  3. `analysisGeometryHash`: `sha256:7fdb0311eff788a1862b6dd7a98d7129919a459f70d08d236b024bd4294998f7` (PASS)
  4. `meshHash`: `sha256:379351c80e594c47f38c92f5b005381100a06432d4e7c308ba68f2337da1b616` (PASS)
  5. `meshProfileHash`: `fnv1a64:6f0c17fc304ebf3e` (PASS)
  6. `projectionHash`: `sha256:2a248c7e9d035bb7b18d59e36dfc8feffd6a465d723690dee9fe390cdcf5dbf6` (PASS)
  7. `solverModelHash`: `sha256:144be48c1508450802c60a5d333e35b912872aad43445e61442fed0d97cb7f1c` (PASS)
  8. `canonicalExecutionInputHash`: `sha256:59624d8e6db37939c23cbc5336f9d3f15f1d5d2a3d1f5d6721f3b8067c3309a6` (PASS)
  9. `compiledExecutionHash`: `sha256:de7cdcbfac1beb4bbf2e3394598054c9ea9e2887d800ce2b4e0aa40344814027` (PASS)
  10. `runtimeDiagnosticsHash`: `sha256:599398cd67214426cce04ce5bff2d45dd2be95d1acc8587578b55a19b737cff7` (PASS)
  11. `recoveryHash`: `sha256:6d2ed95d7c17212139922f29e951b71177df393109e741334d490f6da2451481` (PASS)
- **Transaction State**: `runTransaction: COMPLETED`, `runTransactionReceipt: COMPLETED`
- **Probe Agreement**: `true` (100% bitwise matching probe values)
- **Durable Retention**:
  - Script: `replay/test_replay.mjs`
  - Pass 1 JSON: `replay/pass1.execution.json`
  - Pass 2 JSON: `replay/pass2.execution.json`
  - Receipt: `replay/replay-receipt.json`
  - Process outputs: `replay/replay.stdout.txt`, `replay/replay.stderr.txt`, `replay/replay.exit.txt`

---

## 5. Governance & Scope Compliance

- **No Product/Source Code Modified**: Product/source files in `scripts/`, `src/`, `validation/`, `.github/` were not modified.
- **Tolerances & Thresholds Untouched**: No relaxation of the B02B 5% criterion, B-bar angle thresholds, or GCI criteria.
- **Issue #1862**: Remained unadmitted.
- **Clean Tree Preservation**: Changes exist exclusively in untracked diagnostic evidence under `relay/EVIDENCE/C3D-DIAGNOSTIC/DIAG-0003/**`.
- **No Commit or Push**: Repository remains uncommitted and unpushed.
