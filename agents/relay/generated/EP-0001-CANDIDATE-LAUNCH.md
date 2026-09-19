# EP-0001 zero-context candidate launch

This file is a generated/preparer-side operating aid. Repository authority remains `REPO_STATE.yaml`, `OVERALL_ROADMAP.yaml`, `EP-0001.yaml`, current DISC/TC evidence, and Common engineering-pr-delivery-v2.5 validators.

## Preconditions

- Start with no conversational history for this work.
- Work from the live `fix/lafea4-trunk-green-b5-execution` checkout.
- Read `agents/relay/REPO_STATE.yaml` first, then `agents/relay/execution-packages/EP-0001.yaml`.
- Use the Common engineering-pr-delivery-v2.5 protocol basis recorded in `REPO_STATE.yaml`.
- Do not treat GitHub Actions `failure` as an engineering failure when the job has `steps=[]`.

## Candidate sequence

1. Run the Common baton/conformance checks:

   ```bash
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/validate_relay_conformance.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/cold_start_check.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/validate_baton_readiness.py .
   ```

2. Execute every `DSTEP-*` in EP-0001 from repository/live-Git/GitHub evidence only. Record the exact expected output names and durable basis for each step.

3. Write a candidate-specific Discovery Receipt under:

   ```text
   agents/relay/certifications/discovery/DISC-<candidate>.yaml
   ```

   It must use the live route `SERIAL:EP-0001`, current basis/digests, `result: PASS` only if every required discovery step passed, and `conversation_context_used: false`.

4. Run the frozen outgoing-preparer assembler. It imports Common's canonical `validate_discovery_receipt.validate_file` and refuses to create an admission unless that exact standalone DISC validates against current repository truth:

   ```bash
   python agents/relay/tools/prepare_ep0001_takeover.py . \
     --common-root <common> \
     --candidate-id <agent-instance-id> \
     --disc-path agents/relay/certifications/discovery/DISC-<candidate>.yaml \
     --tc-id TC-<candidate>
   ```

   The assembler writes the TC, calls Common's canonical `validate_takeover_certification.validate_file` against the still-unmodified `REPO_STATE`, deletes the TC if validation fails, and only then appends the admission locator.

5. Validate the resulting admitted state and derive live write readiness:

   ```bash
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/validate_discovery_receipt.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/validate_takeover_certification.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/material_write_ready.py . \
     --candidate-id <agent-instance-id>
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/resolve_execution_route.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/inspect_git_context.py .
   ```

6. Only when `material_write_ready.py` passes may the candidate execute EP-0001 STEP-01 onward and make engineering-material changes.

## Frozen preparer boundary

`prepare_ep0001_takeover.py` is deliberately limited to `SERIAL:EP-0001`, refuses qualification-required routes, refuses duplicate route admissions, requires a pre-existing PASS repository-only DISC, and records the outgoing preparer as `chatgpt-preparer-ep0001-20260919`.

The helper does **not** establish material-write authority by itself. Common validates the standalone DISC before mutation, validates the TC before admission mutation, then the aggregate takeover validator and `material_write_ready.py` re-open current evidence and live Git/drift/write authority.

## EP-0001 engineering execution after admission

The first execution slice remains the frozen B5/core recovery contract. Do not change production MITC mechanics, solver architecture/tolerances, B6 distortion authority, benchmark/oracle tolerances, product routes, or release state in this EP.
