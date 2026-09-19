# EP-0001 zero-context candidate launch

This file is a generated/preparer-side operating aid. Repository authority remains `REPO_STATE.yaml`, `OVERALL_ROADMAP.yaml`, `EP-0001.yaml`, current DISC/TC evidence, and Common engineering-pr-delivery-v2.5 validators.

## Preconditions

- Start with no conversational history for this work.
- Work from the live `fix/lafea4-trunk-green-b5-execution` checkout.
- Read `agents/relay/REPO_STATE.yaml` first, then `agents/relay/execution-packages/EP-0001.yaml`.
- Check out Common exactly at the `relay_protocol.basis_ref` recorded in `REPO_STATE.yaml`.
- `gh` must be authenticated for `reallaksh19/Advanced_Analysis`.
- Do not classify a GitHub Actions `failure` as engineering FAIL when the job has `steps=[]`.

## Candidate sequence

1. Run the Common baton/conformance checks:

   ```bash
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/validate_relay_conformance.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/cold_start_check.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/validate_baton_readiness.py .
   ```

2. Generate the candidate-specific Discovery Receipt deterministically from repository, Git, and live GitHub state:

   ```bash
   python agents/relay/tools/discover_ep0001.py . \
     --common-root <common> \
     --candidate-id <agent-instance-id> \
     --disc-id DISC-<candidate>
   ```

   The discovery runner:
   - refuses a Common checkout whose HEAD differs from the pinned protocol basis;
   - executes DSTEP-01 through DSTEP-06 from repository/Git/GitHub observations only;
   - refuses a wrong carrier branch, material-ref ancestry failure, live-PR-head mismatch, or `src/core/**` scope leakage;
   - checks the production direct/PCG solver-evidence contract and the repaired B5 bindings;
   - reads historical VR-0001..VR-0004 and current VR-0010 boundaries;
   - inspects live hosted job step arrays through authenticated `gh api`;
   - validates the standalone DISC through Common's canonical `validate_discovery_receipt.validate_file` before publishing it;
   - writes `conversation_context_used: false`;
   - never mutates `takeover_admissions`.

3. Run the frozen outgoing-preparer assembler:

   ```bash
   python agents/relay/tools/prepare_ep0001_takeover.py . \
     --common-root <common> \
     --candidate-id <agent-instance-id> \
     --disc-path agents/relay/certifications/discovery/DISC-<candidate>.yaml \
     --tc-id TC-<candidate>
   ```

   The assembler revalidates the standalone DISC, writes the outgoing-preparer-owned TC, validates that TC against the still-unmodified `REPO_STATE`, deletes a rejected TC, and only then appends the admission locator.

4. Validate the admitted state and derive live material-write readiness:

   ```bash
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/validate_discovery_receipt.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/validate_takeover_certification.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/material_write_ready.py . \
     --candidate-id <agent-instance-id>
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/resolve_execution_route.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/inspect_git_context.py .
   ```

5. Only when `material_write_ready.py` passes may the candidate execute EP-0001 STEP-01 onward and make engineering-material changes.

## Frozen authority boundary

`discover_ep0001.py` creates candidate discovery evidence only. `prepare_ep0001_takeover.py` is an outgoing-preparer artifact limited to `SERIAL:EP-0001`; it refuses qualification-required routes and duplicate route admissions and records preparer identity `chatgpt-preparer-ep0001-20260919`.

Neither helper establishes material-write authority by itself. Common validators reopen current repository evidence, and `material_write_ready.py` additionally checks the live route, Git/material ancestry, drift, WRITE authority, execution continuation, and hard-stop state.

## EP-0001 engineering execution after admission

The first execution slice remains the frozen B5/core recovery contract. Do not change production MITC mechanics, solver architecture/tolerances, B6 distortion authority, benchmark/oracle tolerances, product routes, or release state in this EP.
