# Engineering Relay V3.1 — B02B Definition Repair Validation

## Exact basis
- Request: LOCAL-EP-LAFEA3-C3D-B02B-DEFINITION-1771-0004-ad821c11bcd6
- Mode: VALIDATE_ONLY
- EP: EP-LAFEA3-C3D-B02B-DEFINITION-1771-0004
- Work package: WP-1771
- Branch: relay/c3d-v31-diagnostic-1771
- Required HEAD: ad821c11bcd657a52a80c5760aad845508a2ae82

## What changed
Only `validation/lafea-b02-definitions/B02B-nonuniform-shear-v2.json` was changed: the two governed `FIXED_LOCATION_CONVERGENCE_ONLY` probe dispositions and their preexisting justifications were restored from V1. The V2 corrected shear expected value, `v2OracleCorrection`, and all frozen acceptance numbers were left unchanged.

## Preflight
1. Fetch/check out the requested work and run git rev-parse HEAD.
2. Compare the observed HEAD with request.exact_basis.material_head before running any validation step.
3. If the HEAD differs, do not continue; return HEAD_MISMATCH with the observed HEAD.
4. Run git status --short and require a clean product/source tree before validation.

## Run exactly
- **STEP-CMD-1**
  - `node scripts/lafea-b02b-production-check.mjs`
  - Expected: B02B V2 should exercise convergence-only probe authority; capture PASS or the exact remaining failure.
- **STEP-CMD-2**
  - `node scripts/lafea-b02-production-sequence-check.mjs`
  - Expected: Aggregate sequence should advance beyond B02B if the repair is correct; capture the next exact boundary rather than requiring global PASS.

## Stop / do not
- If git rev-parse HEAD does not equal request.exact_basis.material_head, stop immediately and return HEAD_MISMATCH.
- Stop if V1 and the retained validation record no longer support the convergence-only disposition.
- Stop if preserving V2 sign correction requires any oracle/tolerance rewrite beyond the two acceptance-mode fields.
- Do not modify shared qualifier logic to force a pass.
- Do not touch B-bar, BM-005, solver, mesher, recovery, workflow or #1862.
- After the definition edit, validation must run on the resulting exact material head before checkpoint consideration.
- Do not modify product/source files during validation.
- Do not change any numerical tolerance, expected value, v2OracleCorrection content, qualifier logic, solver, mesher, recovery or result authority.
- Do not commit or push.
- Do not implement B-bar, BM-005 or #1862 fixes in this validation run.

## Return contract
- REQUEST_ID: LOCAL-EP-LAFEA3-C3D-B02B-DEFINITION-1771-0004-ad821c11bcd6
- RESULT: PASS | FAIL | BLOCKED | NOT_RUN_ENVIRONMENT | NOT_RUN_INFRASTRUCTURE | HEAD_MISMATCH
- OBSERVED_HEAD:
- ENVIRONMENT:
- COMMAND_RESULTS:
- FAILURES:
- ARTIFACTS:
