# PR1239 — LAFEA.4 TECH-13I promoted refinement round-trip custody

## CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY_FOR_VALIDATION
PR_RECOVERY_STATE: SALVAGE_PARTIAL_IN_PLACE_CURRENT_MAIN
TAKEOVER_AUTHORITY: WRITE_ALLOWED
CRITICALITY: ENGINEERING_CRITICAL
MERGE_AUTHORITY: OWNER_ONLY
REPOSITORY: reallaksh19/Advanced_Analysis
PR: #1239
BRANCH: agent/lafea4-tech13i-promoted-refinement-roundtrip-20260817
BASE: main @ 29c688db4a021db900d1f8c67f56f777f73f4ddc
RECONCILED_ENGINEERING_HEAD: c19a807436ded7b309a1029e2384d2af05faa9b9
CURRENT_STAGE: VALIDATION_BLOCKED_BY_HOSTED_RUNNER_ALLOCATION
APPENDIX_A_STATUS: PASS 99/100, minimum 19/20
ENGINEERING_FAILURE_PROVEN: false
```

## Handover in 60 seconds

PR #1239 is the original dedicated **TECH-13I** increment. Its legacy ancestry was 769 commits behind current main, but the engineering increment was fully recoverable and has now been reconciled in place onto the merged TECH-13H baseline.

The reconciled commit is:

```text
c19a807436ded7b309a1029e2384d2af05faa9b9
parent 1 = legacy #1239 lineage + recovery records
parent 2 = main@29c688db4a021db900d1f8c67f56f777f73f4ddc
```

The resulting tree is **current main + TECH-13I only + three recovery records**. The PR is retargeted to `main`, has exactly 13 changed files, is mergeable, draft, has no reviews and no review threads.

TECH-13I fills the custody gap intentionally left by TECH-13H:

```text
promoted retained TECH-13H evidence
-> promotion-bound replay package
-> structural + semantic-hash/tamper validation
-> generic V2 recovery remains forbidden
-> dedicated recovery requires current code-owned promotion authority
-> current source / midsurface / mesh-profile custody
-> parent-normal production gate before recovery
-> exact promoted artifactHash + meshHash restore
-> parent-normal production gate after recovery
-> same replay-package semanticHash on re-export
```

Production promotion trust root remains `NULL`; package contents cannot activate replay; `releaseQualified=false` remains mandatory.

## Salvage/currentness proof

Legacy #1239 engineering diff is exactly 10 files, 794 additions / 3 deletions. Every final #1239 blob is byte-identical to the independently recovered #1246 TECH-13I checkpoint:

```text
checkpoint = 5d7f0c67828c2493bc7691f4696326c64eb37309
parent     = 5715883ccc3da576b9b80bd96cc41f6f33b1b96f
```

Final I blobs:

```text
bundle verifier      d2bd98854ffd4daea4a4d922a2a774c48a70e2b5
active G path        c793f2d7b675f6c2178af31ad98f995ed4ba587a
I roundtrip checker  7701c2dc781abd7d437c931a089bca7dbfa7c23d
mesh actions         becd2d13ff57586a1c7d98a964a5624cd0482a7d
legacy I API blob    61fa38e0b6c8b7658c1ffdb94963dce3fd34d664
replay actions       41dabba48f5e65691eab8b2f7e31ff845db071b9
replay package       ffea58290c8ad79ac88430ae15d810f5ed104b8f
exact-head plan      5b873eddb255204ce99122de4c81cbffcc0a3a04
promotion policy     183f1ad356acdd3977b17afe091aa1a80d4448ea
TECH-13 program      0c3ec83ca3147f9facbc8418b012bcb8be164d7d
```

Six of seven shared I-parent files remained byte-identical on current main. Only `src/workspace/lafea-workbench-orchestrator-api.js` had legitimate later main evolution. Historical I changed that file only by exposing two methods:

```text
exportLafea4ProductRefinementReplayPackage
recoverLafea4ProductRefinementReplayPackage
```

Therefore that file was reconciled semantically on current main instead of replaying the stale whole-file blob. Current main API behavior is preserved; only those two I methods were added. Reconciled API blob is `b598c4b537398c4051ca4c984b4ebed82998002d`.

## Exact changed-file ledger — 13 files

Engineering / qualification:

```text
scripts/lafea-tech13-product-refinement-bundle-verifier.mjs
scripts/lafea-tech13g-active-promotion-path-check.mjs
scripts/lafea-tech13i-promoted-refinement-roundtrip-check.mjs
src/workspace/lafea-workbench-mesh-generation-actions.js
src/workspace/lafea-workbench-orchestrator-api.js
src/workspace/lafea4-shell-product-refinement-replay-actions.js
src/workspace/lafea4-shell-product-refinement-replay.js
validation/lafea4-refinement/product-refinement-exact-head-plan-v1.json
validation/lafea4-refinement/product-refinement-promotion-v1.json
validation/lafea4-refinement/tech13-product-local-refinement-program-v1.json
```

Recovery:

```text
agents/PR1239_workreport.md
agents/status/PR1239.yaml
agents/claims/PR1239.yaml
```

No TECH-13J, workflow, solver/formulation, benchmark/oracle/tolerance, mesh-threshold or release-authority file is in the PR.

## Production authority trace

`src/workspace/lafea4-shell-product-refinement-replay.js` defines a replay sidecar carrying the retained authority, accepted candidate and promotion record. It validates exact schema/key shape, hashes the package, validates candidate/promoted authority lineage, preserves exact mesh bytes/hash and requires a distinct promoted authority artifact.

`requireCurrentLafea4ShellProductRefinementReplayPackage()` obtains authority only from the source-controlled current promotion trust root. A structurally valid package cannot activate itself.

`src/workspace/lafea4-shell-product-refinement-replay-actions.js` performs dedicated recovery only after:

1. current promotion record matches the package;
2. source lifecycle is CURRENT;
3. current midsurface/source/domain/geometry hashes match;
4. current mesh profile matches;
5. parent-normal production gate accepts before recovery.

It then restores the exact promoted evidence through the lower-level evidence store, verifies artifactHash/meshHash identity, recomputes parent-normal custody and requires the same pre/post companion and gate semantic hashes. Generic orchestrator V2 recovery remains blocked for TECH-13 evidence.

## Protected invariants

```text
production trust root = NULL
releaseQualified = false
generic V2 recovery for TECH-13 = forbidden
package alone cannot activate replay
current promotion record must match package
source lifecycle must be CURRENT
midsurface/source/domain/geometry/profile custody must match
parent-normal gate must PASS pre/post replay
restored artifactHash == promoted artifactHash
restored meshHash == promoted meshHash
re-export semanticHash == imported package semanticHash
adjacent size ratio max = 1.5
aspect ratio warn/block = 5 / 10
scaled Jacobian warn/block = 0.5 / 0.2
no CST/DKT formulation change
no solver/recovery mathematics change
no TECH-13E oracle/tolerance change
no TECH-13J implementation fingerprint
no workflow/Vite bundle-policy change
```

## Validation ledger

| Gate | Status | Observation | Authority/oracle |
|---|---|---|---|
| live main / PR grounding | PASS | SOURCE_INSPECTION | live GitHub |
| final 13-file ledger | PASS | SOURCE_INSPECTION | live PR file list |
| mergeability | PASS | SOURCE_INSPECTION | live GitHub |
| reviews / threads | PASS / none | SOURCE_INSPECTION | live GitHub |
| #1239 final blobs == independent recovered I checkpoint | PASS | SOURCE_INSPECTION | exact Git blobs |
| six shared parent files current | PASS | SOURCE_INSPECTION | exact Git blobs |
| orchestrator API drift | PASS / reconciled | SOURCE_INSPECTION | current main + additive I seam |
| replay authority trace | PASS | SOURCE_INSPECTION | production modules |
| null-trust-root negative control | PASS | SOURCE_INSPECTION | focused checker |
| generic TECH-13 V2 replay still blocked | PASS | SOURCE_INSPECTION | H + I paths |
| TECH13I focused Node | NOT_RUN | NOT_OBSERVED | runtime unavailable |
| active promotion round-trip | NOT_RUN | NOT_OBSERVED | runtime unavailable |
| exact-head TECH-13 bundle | NOT_RUN | NOT_OBSERVED | runtime unavailable |
| browser/build | NOT_RUN | REMOTE_PRE_STEP | hosted runner allocation |

Current exact reconciliation-head runner evidence:

```text
run       = 32919506290
job       = 98030083217
head      = c19a807436ded7b309a1029e2384d2af05faa9b9
runner_id = 0
steps     = []
class     = PRE_STEP_HOSTED_RUNNER_ALLOCATION
```

Therefore execution remains `NOT_RUN`; there is no engineering FAIL and no rerun is justified. Recovery-record-only head changes after this checkpoint do not justify another runner probe.

## Coordination / supersession

- #1435: TECH-13H prerequisite, merged at `29c688db4a021db900d1f8c67f56f777f73f4ddc`.
- #1246: stale combined H/I/J provenance. H is superseded by merged #1435; I is superseded by current-main #1239; J remains unresolved provenance.
- #1249: stale 31-file stacked H/I/J qualification carrier. Its I role is superseded by #1239; J/build provenance must be assessed separately.
- #1432: LAFEA.3, separate authority domain.

## Appendix A — takeover qualification

```text
A1 Production Trace            20/20
A2 Current Failure Isolation   20/20
A3 Authority / Invariant       20/20
A4 Independent Validation      19/20
A5 Next-Commit / Minimal Patch 20/20
TOTAL                           99/100
MINIMUM                         19/20
TAKEOVER_AUTHORITY              WRITE_ALLOWED
```

A4 is 19/20 because executable qualification is currently NOT_RUN; no execution was fabricated.

## EXACT_NEXT_ACTION

1. Keep #1239 draft and Owner-only; do not rerun the same zero-step hosted job.
2. Record I supersession on #1246 and #1249.
3. Proceed to TECH-13J read-only salvage/currentness assessment from current main; do not import combined J/build changes blindly.
4. Revisit #1239 only on legitimate runtime recovery, material main drift, review input, or explicit owner merge authorization.
