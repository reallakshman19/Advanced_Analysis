# PR1243 Work Report — Merged LoadCalc / SJSON Performance Stack Qualification

## Recovery header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: RESTRICTED

PR_HEAD_OBSERVED: 4347a5eeffe113d9f7fc0160cb6c340e624dcfbf
REPORT_BASIS_HEAD: 4347a5eeffe113d9f7fc0160cb6c340e624dcfbf
MAIN_HEAD_LAST_CHECKED: 585a897afa0f5c9799cb68a58de00a55808062b3
MERGE_BASE: 585a897afa0f5c9799cb68a58de00a55808062b3
REPORT_SYNC: CURRENT
APPENDIX_A_STATUS: NOT_REQUIRED_NO_TAKEOVER
GROUNDING_EPOCH: GE-003
LAST_DURABLE_CHECKPOINT: 2026-08-18T02:23Z
CURRENT_STAGE: QUALIFICATION / EXACT_HEAD_P0_NOT_RUN
CURRENT_BLOCKER: governed 4,884 role verification, current 20-object SHA recapture/Owner acceptance, exact-head P0 browser/command ladder, and P0 Owner acceptance are incomplete
HIGHEST_RISK: reusing historical fixture evidence after fixture-byte drift or treating repository presence as current exact-head authority verification
EXACT_NEXT_ACTION: run current-main P0 with explicit 4,884 role binding; recapture the current 20-object SHA from current bytes; retain browser/command evidence; obtain explicit Owner P0 acceptance; only then re-ground P1 production candidates
```

`TAKEOVER_AUTHORITY=RESTRICTED` means this PR is an evidence/qualification vehicle only. It must not acquire P1 production changes. A future incoming agent taking over this engineering-critical PR begins READ_ONLY and completes Appendix A before technical mutation.

## Handover in 60 seconds

- #1243 is qualification-only for the already-merged performance stack from #1227, #1229, #1230, #1232, #1237, #1240, #1241 and #1242.
- Current production `main`: `585a897afa0f5c9799cb68a58de00a55808062b3`.
- Current PR is draft, mergeable and contains only this report plus `scripts/performance-stack-exact-head-qualification.mjs`.
- #1244 and #1245 are `SALVAGE_PARTIAL / AUTHORITY_HOLD`; do not absorb their production diffs.
- P0 remains unaccepted; P1 production remains unauthorized.
- The 4,884 source bytes are physically present in the repository, but governed role SHA/identity verification is still `NOT_RUN`.
- The current 20-object fixture is **not byte-identical** to the prior P0-executed fixture; the historical captured SHA-256 cannot be reused.
- Next engineering step is executable P0 evidence, not another optimization.

## Classification

```text
WORK_INTENT: INVESTIGATE / VALIDATE
REPOSITORY_STATE: EXISTING_PR
MUTATION_AUTHORITY: WRITE_ALLOWED_FOR_QUALIFICATION_AND_RECOVERY_ONLY
CRITICALITY: ENGINEERING_CRITICAL
EXECUTION_MODE: MANUAL
MERGE_AUTHORITY: OWNER_ONLY
```

## GE-003 live grounding

Live GitHub evidence at the start of GE-003:

```text
main head:       585a897afa0f5c9799cb68a58de00a55808062b3
PR head:         4347a5eeffe113d9f7fc0160cb6c340e624dcfbf
merge base:      585a897afa0f5c9799cb68a58de00a55808062b3
behind_by:       0
changed files:   2, qualification-only
reviews:         0
review threads:  0
commit statuses: 0 -> NOT_RUN
workflow runs:   0 -> NOT_RUN
```

Repository coordination registries are absent on current main (`agents/MASTER_INDEX.md`, `agents/status/`, `agents/claims/`); live PR state/diffs are therefore the mutable coordination authority.

Open PR #1246 was inspected and has no exact-file or engineering-authority overlap with this qualification-only work. Coordination classification: `SAFE`.

## Source-task authority

Controlling work pack: Issue #541. Merged P0 PR #544 and Issue #541 retain:

```text
P0_ACCEPTED: false
P1_QUALIFICATION_STATUS: BLOCKED
P1_PRODUCTION_FIX_AUTHORIZED: false
```

No later `P0_ACCEPTED=true` or explicit Owner production override was found during re-grounding.

This does not block qualification/evidence work in #1243. It does block production continuation/merge of #1244/#1245 and selection of another optimization.

## 4,884 large-model custody

Current main physically contains:

```text
benchmarks/ATTRIBUTE-AML_ASIM-1835_managed_stage_enriched_stage.json
```

Git-tree custody:

```text
blob SHA-1: 13442af26a1415b70849f5daaca1766a38ac355c
byteLength: 25219174
```

Accepted role authority:

```text
schema: inputxml-managed-stage/v1
expected SHA-256: 88e62782772d743e9236d13775476826f9649ab06d3161de35dc500baa85a9c6
rawRootCount: 276
rawNodeCount: 4884
rawSupportCount: 1331
normalizedPipeCount: 3277
normalizedSupportCount: 1331
normalizedComponentCount: 276
```

The authority manifest intentionally retains `LARGE_MODEL_4884_ENTITY` as `EXTERNAL_CONTENT_ADDRESSED_FILE` with `defaultPath:null`. Therefore physical repository custody is not sufficient.

Current classification:

```text
PHYSICAL_4884_FIXTURE_CUSTODY: PASS
4884_ROLE_SHA256_VERIFICATION_CURRENT_HEAD: NOT_RUN
4884_ROLE_IDENTITY_VERIFICATION_CURRENT_HEAD: NOT_RUN
```

The existing P0 runner must explicitly execute:

```text
--fixture-role LARGE_MODEL_4884_ENTITY=benchmarks/ATTRIBUTE-AML_ASIM-1835_managed_stage_enriched_stage.json
```

and only accept the role when the runner reports `VERIFIED` after computing actual SHA-256 and production identity. Do not weaken the manifest or hand-edit the seed report.

## 20-object fixture authority — GE-003 drift finding

Path:

```text
public/fixtures/topology-edit-20-element-demo.staged.json
```

Historical exact-head P0 execution:

```text
head: 2d5edb875c3138d46858c6df8f93b3650984e0fe
workflow run: 30889413136
historical Git blob SHA-1: c0b00d446eb8168d8f27250e9874dd21c9363268
captured historical SHA-256: 45ef8f2140cdc43cc1b630229f0d49df87978e90dadc8d715ec40ca033493ec0
historical identity: 20 entities / 15 pipes / 5 supports
historical status: CAPTURED_PENDING_OWNER_ACCEPTANCE
```

Current main:

```text
current Git blob SHA-1: 86ed87db0f18d7cca1a6d05e9b1a06cb556c0bcf
```

The Git blob identities differ, proving the bytes differ. Current source includes additional embedded XYZ-branch scenario data that was absent from the historical blob.

Therefore:

```text
HISTORICAL_20_OBJECT_SHA256: OBSOLETE_FOR_CURRENT_MAIN
CURRENT_20_OBJECT_SHA256: NOT_RUN / MUST_RECAPTURE
CURRENT_20_OBJECT_OWNER_ACCEPTANCE: NOT_SATISFIED
```

The old `45ef8f...` value must not be accepted for current main. The next current-head P0 run must recompute the SHA-256 from current bytes and present that newly captured value for explicit Owner acceptance.

## Qualification runner custody

`scripts/performance-stack-exact-head-qualification.mjs` is fail-closed. Its current allowlist contains exactly:

```text
agents/PR1243_workreport.md
scripts/performance-stack-exact-head-qualification.mjs
```

Any production/workflow/non-qualification path above the target SHA fails the runner before qualification.

Runner classifications remain distinct:

```text
FAIL
FULL_PASS
TARGETED_PASS_FULL_NOT_RUN
NOT_RUN
```

`NOT_RUN` never counts as PASS.

## Targeted evidence already obtained

| Gate | Status | Observation | Oracle | Limitation |
|---|---|---|---|---|
| Production target / merge-base custody | PASS | REMOTE_EXECUTION | NONE | live GitHub |
| Qualification-only diff | PASS | REMOTE_EXECUTION | NONE | no production/workflow paths |
| Reviews/threads | PASS | REMOTE_EXECUTION | NONE | none |
| CI/workflows | NOT_RUN | REMOTE_EXECUTION | NONE | zero statuses/runs |
| Support-load EMPTY/OPE/HYD IEEE-754 hand arithmetic | PASS | LOCAL_EXECUTION | ANALYTICAL | targeted |
| Staged identity parity | PASS 5/5 | LOCAL_EXECUTION | INDEPENDENT_REPRODUCTION | targeted |
| Evidence-alias cache | PASS 3/3 | LOCAL_EXECUTION | IMPLEMENTATION_COUPLED | targeted |
| Immutable snapshot custody | PASS | SOURCE_INSPECTION | AUTHORITATIVE_REFERENCE | runtime test NOT_RUN |
| LoadCalc binding currentness | PASS | SOURCE_INSPECTION | AUTHORITATIVE_REFERENCE | runtime fixture NOT_RUN |
| Dependency invalidation | PASS | SOURCE_INSPECTION | AUTHORITATIVE_REFERENCE | runtime fixture NOT_RUN |
| Support-load execution index/base mass | PASS | SOURCE_INSPECTION + LOCAL_EXECUTION | ANALYTICAL | integrated fixture NOT_RUN |
| Physical 4,884 repository blob custody | PASS | REMOTE_EXECUTION | AUTHORITATIVE_REFERENCE | governed SHA/identity verification NOT_RUN |
| 4,884 governed role verification | NOT_RUN | NOT_OBSERVED | AUTHORITATIVE_REFERENCE | execute exact-head P0 explicit binding |
| Historical 20-object SHA capture | PASS HISTORICAL | WORKFLOW_ARTIFACT_INSPECTION | AUTHORITATIVE_REFERENCE | obsolete for current bytes |
| Current 20-object SHA capture | NOT_RUN | NOT_OBSERVED | AUTHORITATIVE_REFERENCE | fixture changed after historical P0 |
| Full exact-head P0 browser/command ladder | NOT_RUN | NOT_OBSERVED | AUTHORITATIVE_REFERENCE | execution-capable checkout required |
| P0 Owner acceptance | FAIL / NOT SATISFIED | ARTIFACT_INSPECTION | AUTHORITATIVE_REFERENCE | Issue #541 / PR #544 |
| P1 production authorization | FAIL / NOT AUTHORIZED | ARTIFACT_INSPECTION | AUTHORITATIVE_REFERENCE | blocked until P0 acceptance |

The authority-gate failures above are governance states, not discovered numerical product failures.

No `NOT_RUN` is represented as PASS.

## Targeted numerical evidence retained

Support-load hand arithmetic:

```text
inside diameter = 154.08 mm
metal            = 134.252021893143 kg
insulation       =  19.545575773942 kg
EMPTY            = 153.797597667084 kg
OPE              = 229.080257741813 kg
HYD              = 242.206010945431 kg
```

Old/new EMPTY/OPE/HYD mass values were IEEE-754 identical via `Object.is`.

No engineering/numerical mismatch has been observed in the executed/source-qualified checks. That is not equivalent to full application qualification.

## Active items

- `ISS-001` — 4,884 explicit current-head role verification is NOT_RUN. **OPEN / BLOCKING P0**.
- `ISS-002` — current 20-object SHA must be recaptured after fixture-byte drift. **OPEN / BLOCKING P0**.
- `ISS-003` — current 20-object captured SHA requires explicit Owner acceptance. **OPEN / BLOCKING P0**.
- `ISS-004` — exact-head P0 browser/command ladder is NOT_RUN. **OPEN / BLOCKING**.
- `ISS-005` — completed exact-head P0 report has not been explicitly accepted by Owner. **OPEN / BLOCKING P1 PRODUCTION**.
- `RISK-001` — reusing historical fixture evidence after byte drift. **OPEN / CONTROLLED**.
- `RISK-002` — treating physical repository custody as governed content-addressed verification. **OPEN / CONTROLLED**.
- `DEC-001` — #1243 stays qualification-only. **ACTIVE**.
- `DEC-002` — no substitute fixture, authority weakening, seed-report promotion, or historical 20-object SHA reuse. **ACTIVE**.
- `DEC-003` — operation-count reductions do not authorize another optimization without current wall-clock evidence. **ACTIVE**.

## Falsifier

Quarantine/recommend revert of the merged performance stack if exact-head execution changes protected source/dataset identity, normalized engineering value/evidence source, authorized empirical binding, stale/current transition, topology invalidation semantics, mass/force/allocation, support reaction/contributor order, CoG/equilibrium, blocker/readiness content/order, output/evidence identity, or browser render-owner/page-error contract.

## Current disposition

```text
PARTIAL_TARGETED_QUALIFICATION_PASS
PHYSICAL_4884_FIXTURE_CUSTODY_PASS
4884_ROLE_VERIFICATION_NOT_RUN
CURRENT_20_OBJECT_SHA_RECAPTURE_REQUIRED
FULL_EXACT_HEAD_P0_NOT_RUN
P0_ACCEPTANCE_NOT_SATISFIED
P1_PRODUCTION_FIX_NOT_AUTHORIZED
```

## EXACT_NEXT_ACTION

Run the existing production P0 machinery from a clean execution-capable checkout of the exact current main. Do not change the authority manifest.

Bind the 4,884 source explicitly:

```text
--fixture-role LARGE_MODEL_4884_ENTITY=benchmarks/ATTRIBUTE-AML_ASIM-1835_managed_stage_enriched_stage.json
```

Use the current repository 20-object fixture unchanged and let the P0 runner recapture its **current** SHA-256. The old historical SHA-256 `45ef8f2140cdc43cc1b630229f0d49df87978e90dadc8d715ec40ca033493ec0` is not valid for current main.

Generate exact-head P0 browser evidence with the same execution ID/head/fixture authority, then run:

```bash
node scripts/run-non-fea-current-main-baseline.mjs \
  --warm-samples 5 \
  --fixture-role LARGE_MODEL_4884_ENTITY=benchmarks/ATTRIBUTE-AML_ASIM-1835_managed_stage_enriched_stage.json \
  --browser-evidence <repository-relative-P0-browser-evidence.json> \
  --execution-id <same-browser-execution-id> \
  --run-commands \
  --fail-on-gate
```

Accept the 4,884 role only if the runner reports `VERIFIED`. Present the newly captured current 20-object SHA for explicit Owner acceptance. Only after the completed current-head P0 report is explicitly accepted by the Owner may P1 production work resume. Re-ground current main before salvaging/reconstructing #1244/#1245 or choosing another optimization.
