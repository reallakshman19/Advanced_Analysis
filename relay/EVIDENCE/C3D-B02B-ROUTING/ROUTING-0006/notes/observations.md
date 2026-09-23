# B02B V2 Routing Repair Execution Report (ROUTING-0006)

## 1. Request Context & Preflight Verification

- **Request ID**: `LOCAL-EP-LAFEA3-C3D-B02B-ROUTING-1771-0006-ef09fc3c403c`
- **Work Package**: `WP-1771`
- **EP**: `EP-LAFEA3-C3D-B02B-ROUTING-1771-0006`
- **Material Base**: `955cbc11394c85ad5dfbd3bf399acf70e6a8cf8d`
- **Required Material HEAD**: `ef09fc3c403cc6b1fb7b206bfb2abc6166c28a24`
- **Observed Repository HEAD**: `ef09fc3c403cc6b1fb7b206bfb2abc6166c28a24` (MATCH)
- **Required Common V3.1 Basis**: `4c0617bd2f41d25f43a5d98673abead8ca4e7686`
- **Observed Common HEAD**: `4c0617bd2f41d25f43a5d98673abead8ca4e7686` (MATCH)

---

## 2. Root Cause Analysis: Generic Rectangle Fallthrough vs Probe-Stable Mesh

In `EP-0005`, the governed method-specific mesh ladder (`T3: [2.5, 1.25, 0.625]`, `T6/Q8: [10, 5, 2.5]`) was restored, curing displacement divergence on `B02B-PROBE-UY-01`. However, shear probe `B02B-PROBE-TAU-01` still evaluated as `OSCILLATORY` on T3 with a 2.465% spread exceeding the 2.0% stability threshold.

### Root Cause
Investigation revealed that the production router in `scripts/lib/lafea-b02-production-route.mjs` checked:
```javascript
const useB02bProbeStable = definition.caseId === 'B02B';
```
Because the active definition declared:
```json
"caseId": "B02B-V2",
"supersedesCaseId": "B02B"
```
the selector evaluated to `false`, causing B02B-V2 to fall through to the unconditioned generic rectangle mesher instead of the qualified probe-stable mesh (`b02b-probe-stable-rectangle-mesh.js`).

### Repair
Commit `ef09fc3c403cc6b1fb7b206bfb2abc6166c28a24` updated the selector:
```javascript
const useB02bProbeStable = definition.caseId === 'B02B'
  || (definition.caseId === 'B02B-V2' && definition.supersedesCaseId === 'B02B');
```
No definitions, tolerances, qualifier code, or 2% stability criteria were altered.

---

## 3. Command Execution Matrix

| Surface ID | Command Line | Status | Exit Code | Start Time (UTC) | End Time (UTC) | Raw Receipts |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **B02B Standalone** | `node scripts/lafea-b02b-production-check.mjs` | **PASS** | **0** | `2026-09-22T23:27:03.210Z` | `2026-09-22T23:28:43.384Z` | `commands/b02b.*` |
| **B02 Sequence** | `node scripts/lafea-b02-production-sequence-check.mjs` | **FAIL** | **1** | `2026-09-22T23:28:43.539Z` | `2026-09-22T23:51:15.245Z` | `commands/b02-sequence.*` |

---

## 4. Technical Analysis & Failing Boundary Shift

### 4.1 B02B Standalone Check Passes (GREEN)
Under `ef09fc3c4`, B02B-V2 exercises the qualified B02B probe-stable mesh:
- **T3 Method**:
  - `B02B-PROBE-TAU-01`: `MONOTONIC_CONVERGING` (observed order `1.568`, `gciFineRelative` `0.410%`)
  - `B02B-PROBE-UY-01`: `MONOTONIC_CONVERGING` (observed order `1.034`, `gciFineRelative` `0.331%`)
  - Strain energy relative error: `0.788%` (< 5% limit)
  - Status: **PASS**
- **Q8 Method**:
  - `B02B-PROBE-TAU-01`: `MONOTONIC_CONVERGING` (observed order `2.184`)
  - `B02B-PROBE-UY-01`: `MONOTONIC_CONVERGING` (observed order `0.136`)
  - Status: **PASS**
- Standalone check exits **0**.

### 4.2 Aggregate Sequence Calculation Advances Past B02B
In the sequence harness (`scripts/lafea-b02-production-sequence-check.mjs`):
1. `B02C_ANALYTICAL_TRACTION`: PASS
2. `B02D_POLAR_MESH`: PASS
3. `B02A`: PASS
4. `B02B`: **PASS** (Calculation completed cleanly; `LAFEA_B02_PRODUCTION_SEQUENCE_BLOCKED_AT_B02B` is **NOT emitted**)
5. `B02C`: PASS
6. `B02D`: PASS

All child test scripts execute to completion with status 0.

### 4.3 New Exact Failing Boundary: Sequence Receipt Case ID Assertion
The sequence failure shifts from calculation blockage to the post-execution receipt assertion block at lines 31-37:
```javascript
for (const id of ['B02A', 'B02B', 'B02C', 'B02D']) {
  assert.equal(receipts[id].caseId, id);
  assert.equal(receipts[id].definitionFrozenBeforeObservation, true);
  ...
}
```
`receipts['B02B'].caseId` is `'B02B-V2'`.
Line 32 fails with:
`AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`
`'B02B-V2' !== 'B02B'`
`at scripts/lafea-b02-production-sequence-check.mjs:32:10`

---

## 5. Governance & Prohibitions Enforced

- **5% numerical tolerance**: Unaltered
- **2% stable-band criterion**: Unaltered (not widened)
- **Expected values and `v2OracleCorrection`**: Unmodified
- **Mesh generator and qualifier implementations**: Unmodified
- **B-bar and BM-005**: Untouched
- **Issue #1862**: Unadmitted
- **Git custody**: No commit or push performed
