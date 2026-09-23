# Engineering Relay V3.1 — Local Execution Request

## Purpose
Run canonical roadmap reconciliation and task admission, then use pinned V3.1 local-execution export. Require material-basis drift against current main to be DISJOINT; execute source guard once, B02B once and B02 sequence twice on the derived material head.

## Exact basis
- Request: LOCAL-EP-LAFEA3-C3D-B02-R2-1771-0009-74437c406695
- Mode: VALIDATE_ONLY
- EP: EP-LAFEA3-C3D-B02-R2-1771-0009
- Work package: WP-1771
- Branch: relay/c3d-r2-exact-main-1771
- Required HEAD: 74437c40669577926c9761cd6374f53d11178a69

## Preflight
1. Fetch/check out the requested work and run git rev-parse HEAD.
2. Compare the observed HEAD with request.exact_basis.material_head before running any validation step.
3. If the HEAD differs, do not continue; return HEAD_MISMATCH with the observed HEAD.

## Run
- **STEP-CMD-1** — Run this exact caller-supplied command and capture its result.
  - Command: node scripts/lafea-b02-production-source-guard.mjs
  - Working directory: .
  - Expected: Capture exit status and concise output; do not silently repair failures.
- **STEP-CMD-2** — Run this exact caller-supplied command and capture its result.
  - Command: node scripts/lafea-b02b-production-check.mjs
  - Working directory: .
  - Expected: Capture exit status and concise output; do not silently repair failures.
- **STEP-CMD-3** — Run this exact caller-supplied command and capture its result.
  - Command: node scripts/lafea-b02-production-sequence-check.mjs
  - Working directory: .
  - Expected: Capture exit status and concise output; do not silently repair failures.
- **STEP-CMD-4** — Run this exact caller-supplied command and capture its result.
  - Command: node scripts/lafea-b02-production-sequence-check.mjs
  - Working directory: .
  - Expected: Capture exit status and concise output; do not silently repair failures.

## Stop conditions
- If git rev-parse HEAD does not equal request.exact_basis.material_head, stop immediately and return HEAD_MISMATCH.
- Stop on HEAD_MISMATCH.
- Stop if V3.1 material-basis drift against current main is RELEVANT or UNKNOWN.
- Do not modify product/source files.
- Do not normalize a nonzero exit into PASS.
- Do not infer deterministic replay without two durable aggregate runs.
- If numerical commands pass but CURRENT_RESULT/lineage custody is not independently inspectable, return BLOCKED rather than PASS and route to #1862.
- Do not resume or merge PR #1873 until R2 evidence and independent review disposition are complete.

## Do not
- Do not modify product/source files.
- Do not commit or push.
- Do not advance PR, merge, release, or delivery state.
- Do not silently repair a failure; return the observed failure to the originating owner.

## Return exactly this contract
- REQUEST_ID: LOCAL-EP-LAFEA3-C3D-B02-R2-1771-0009-74437c406695
- RESULT: PASS | FAIL | BLOCKED | NOT_RUN_ENVIRONMENT | NOT_RUN_INFRASTRUCTURE | HEAD_MISMATCH
- OBSERVED_HEAD:
- ENVIRONMENT:
- COMMAND_RESULTS:
- FAILURES:
- ARTIFACTS:

## Continuation
- The originating owner resumes responsibility after this bounded local result is returned; the helper does not inherit task custody.
