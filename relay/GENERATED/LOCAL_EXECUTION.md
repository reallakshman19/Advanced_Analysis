# Engineering Relay V3.1 — Local Execution Request

## Purpose
Export the V3.1 VALIDATE_ONLY local execution request for exact material head 1019ca26cb18332983f64258698787280b86afd1 and execute the four existing diagnostic commands without modifying product/source state.

## Exact basis
- Request: LOCAL-EP-LAFEA3-C3D-DIAGNOSTIC-1771-0003-1019ca26cb18
- Mode: VALIDATE_ONLY
- EP: EP-LAFEA3-C3D-DIAGNOSTIC-1771-0003
- Work package: WP-1771
- Branch: relay/c3d-v31-diagnostic-1771
- Required HEAD: 1019ca26cb18332983f64258698787280b86afd1

## Preflight
1. Fetch/check out the requested work and run git rev-parse HEAD.
2. Compare the observed HEAD with request.exact_basis.material_head before running any validation step.
3. If the HEAD differs, do not continue; return HEAD_MISMATCH with the observed HEAD.

## Run
- **STEP-CMD-1** — Run this exact caller-supplied command and capture its result.
  - Command: node scripts/lafea-b02-production-sequence-check.mjs
  - Working directory: .
  - Expected: Capture exit status and concise output; do not silently repair failures.
- **STEP-CMD-2** — Run this exact caller-supplied command and capture its result.
  - Command: node scripts/lafea-b02b-production-check.mjs
  - Working directory: .
  - Expected: Capture exit status and concise output; do not silently repair failures.
- **STEP-CMD-3** — Run this exact caller-supplied command and capture its result.
  - Command: node scripts/lafea-plane-strain-bbar-lame-check.mjs
  - Working directory: .
  - Expected: Capture exit status and concise output; do not silently repair failures.
- **STEP-CMD-4** — Run this exact caller-supplied command and capture its result.
  - Command: node scripts/lafea.3-bm005-ordinary-route-check.mjs
  - Working directory: .
  - Expected: Capture exit status and concise output; do not silently repair failures.

## Stop conditions
- If git rev-parse HEAD does not equal request.exact_basis.material_head, stop immediately and return HEAD_MISMATCH.
- Stop on HEAD_MISMATCH.
- Do not modify product/source files.
- Do not relax B02B tolerances or mesh-quality thresholds.
- Do not reinterpret BM-005 OSCILLATORY / RESULT_NOT_READY as a benchmark defect without first-owning evidence.
- Do not admit or implement #1862.
- If execution is unavailable, return NOT_RUN_ENVIRONMENT or NOT_RUN_INFRASTRUCTURE.

## Do not
- Do not modify product/source files.
- Do not commit or push.
- Do not advance PR, merge, release, or delivery state.
- Do not silently repair a failure; return the observed failure to the originating owner.

## Return exactly this contract
- REQUEST_ID: LOCAL-EP-LAFEA3-C3D-DIAGNOSTIC-1771-0003-1019ca26cb18
- RESULT: PASS | FAIL | BLOCKED | NOT_RUN_ENVIRONMENT | NOT_RUN_INFRASTRUCTURE | HEAD_MISMATCH
- OBSERVED_HEAD:
- ENVIRONMENT:
- COMMAND_RESULTS:
- FAILURES:
- ARTIFACTS:

## Continuation
- The originating owner resumes responsibility after this bounded local result is returned; the helper does not inherit task custody.
