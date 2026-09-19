# EP-0001 repository-grounded candidate launch

This is a preparer-side operating aid. Authority remains in `REPO_STATE.yaml`, the roadmap, `EP-0001.yaml`, current DISC/TC evidence, and the pinned Common engineering-pr-delivery-v2.5 validators.

## Revised V2.5 semantics

- The candidate may be incoming **or continuing**.
- `conversation_context_used: false` means DISC/TC evidence is grounded in repository/provider sources rather than chat authority; it no longer means the process must have no chat history.
- A candidate may assemble its own TC document. `prepared_by` is provenance, not certification authority.
- Self-evaluation is still invalid. Deterministic certification authority is `validate_takeover_certification.py`, which reopens the DISC, EP and current basis.
- Route-level `material_authority: WRITE` is not candidate permission. Candidate permission is still derived only by `material_write_ready.py`.

## Candidate sequence

1. Use Common exactly at the SHA in `REPO_STATE.relay_protocol.basis_ref`.

2. Establish repository-grounded DISC evidence for DSTEP-01 through DSTEP-06. The helper `agents/relay/tools/discover_ep0001.py` remains available in a real checkout, but DSTEP-02 now concerns carrier-branch/GitHub basis; the separate runtime gate owns worktree enforcement.

3. Assemble a TC/admission record, either directly from the current templates or with:

   ```bash
   python agents/relay/tools/prepare_ep0001_takeover.py . \
     --common-root <common> \
     --candidate-id <agent-instance-id> \
     --disc-path agents/relay/certifications/discovery/DISC-<candidate>.yaml \
     --tc-id TC-<candidate>
   ```

4. Run canonical validation:

   ```bash
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/validate_discovery_receipt.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/validate_takeover_certification.py .
   ```

5. In a **real live Git checkout**, run:

   ```bash
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/material_write_ready.py . \
     --candidate-id <agent-instance-id>
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/resolve_execution_route.py .
   python <common>/skills/engineering-pr-delivery-v2.5/scripts/inspect_git_context.py .
   ```

6. Only a live `material_write_ready=true` result permits EP-0001 STEP-01 onward or any engineering-material write.

## Engineering boundary

EP-0001 remains a harness/custody recovery slice. Do not change production MITC mechanics, solver architecture/tolerances, B6 distortion authority, benchmark/oracle tolerances, product routes, or release state.
