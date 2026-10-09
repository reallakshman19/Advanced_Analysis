# PR1391 — LFEA S5 pressure/Bourdon authority prerequisite

## CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY_DRAFT_EXTERNAL_EVIDENCE_BLOCKED_RUNTIME_NOT_RUN
TAKEOVER_AUTHORITY: WRITE_ALLOWED
EXECUTION_MODE: AUTO
AUTO_STATE: ACTIVE
SCOPE_AUTHORITY: S5_PREREQUISITE_ONLY_STACKED_ON_PR1348
MERGE_AUTHORITY: OWNER_ONLY

REPOSITORY: reallaksh19/Advanced_Analysis
PR: 1391
PR_URL: https://github.com/reallaksh19/Advanced_Analysis/pull/1391
STACK_BASE_PR: 1348
STACK_BASE_HEAD: 25543a9e6c0e796d63e89841f63e41a4fd3292cc
BRANCH: agent/lfea-piping-promotion-s5-bourdon-pressure-20260823
MAIN_LAST_CHECKED: c2018c4b81e4c45f151ad7e59efd7d903ad7de97
ENGINEERING_CODE_HEAD: a062068797b1a33b2cbae9fdd390cb0e18ece0df
CURRENT_LIVE_HEAD_BEFORE_THIS_REPORT: 556b1d344d7fc09777a9467a8b4c6f5c8be602c1
CURRENT_STAGE: source-state custody + mechanism-isolated protocol + scoped parity intake + raw SHA256 custody + fail-closed scaffolds + discriminating Q5 arbitration
CURRENT_BLOCKER: controlled CAESAR Bourdon/pressure-stiffening evidence absent; BM4_NL L19/L20 selector unresolved; repository runtime NOT_RUN under Issue #54
EXACT_NEXT_ACTION: execute selected S5 controlled CAESAR scope under Issue #1402; retain raw files; pass file-level intake and independent review; keep all production pressure flags false until separate integration plus executable exact-head qualification
```

## 60-second handover

S5 production pressure mechanics remain **BLOCKED**.

```text
pressureStiffening = false
pressureAxialThrust = false
pressureBourdon = false
pressureCodeStress = true
```

Source custody currently establishes:

```text
BOURDON_PRESSURE = TRANSLATION_AND_ROTATION
winning level = INDIVIDUAL_FILE_SETTING
USE_PRESSURE_STIFFENING = DEFAULT
normalized = DEFAULT_CODE
active code = B31.3_2022
L19 Elbow Stiffening Pressure = UNRESOLVED
L20 Elbow Stiffening Pressure = UNRESOLVED
```

Controlled Q5 `P1` is **not** BM4_NL source authority.

## Governing decisions

### DEC-S5-001 — three mechanisms remain separate
Bourdon pressure displacement, bend pressure stiffening and pressure/end thrust are independent authorities. One mechanism's evidence cannot authorize another.

### DEC-S5-002 — global and per-load-case stiffening settings are distinct
`Use Pressure Stiffening on Bends` and `Elbow Stiffening Pressure` are separate records. `DEFAULT_CODE` cannot be collapsed to INCLUDE/EXCLUDE and L19/L20 cannot be guessed.

### DEC-S5-003 — evidence scopes are independent
Allowed scopes:

```text
BOURDON_ONLY
PRESSURE_STIFFENING_ONLY
BOURDON_AND_PRESSURE_STIFFENING
```

`pressureAxialThrust` is outside all current scopes.

### DEC-S5-004 — Q3 owns one physical bend basis
Subdivision evidence uses `[4,6,8]`, requires `samePhysicalInitialBasis=true`, and compares terminal free state without reinitializing MEC-21 per chord.

### DEC-S5-005 — Q4 qualifies the per-case selector
With Bourdon disabled, use `NONE / P1 / P2 / PMAX` with P1 and P2 deliberately distinct; prove selector discrimination, retained curved geometry and exactly-once factor ownership.

### DEC-S5-006 — Q5 must remain discriminating
Q5 global `DEFAULT / INCLUDE / EXCLUDE` is valid only when all non-global-mode state is fixed and the per-case pressure selector remains active:

```text
activePipingCode = B31.3_2022
activateBourdonEffects = NONE
elbowStiffeningPressureSelector = P1
pressureFields.P1 = same positive controlled value
material / section / bend geometry / restraints / mechanical loads = identical
```

Selector `NONE` is rejected because it removes elbow pressure stiffening. Controlled P1 is experiment input only; it cannot resolve/infer BM4_NL L19/L20.

### DEC-S5-007 — Q6 excludes thrust authority
Q6 positively exercises Bourdon `TRANSLATION_ONLY` while generic pressure thrust and effective-area force remain false.

### DEC-S5-008 — raw bytes are source custody
Actual CAESAR job/input/output files remain retained; JSON is derivative. Safe relative paths and recomputed SHA-256 are mandatory.

### DEC-S5-009 — accepted parity cannot authorize production
Successful intake may only return `QUALIFIED_PARITY_EVIDENCE_ONLY`; all production pressure authorization booleans remain false.

## Controlled evidence package

Generate one intended scope:

```text
node scripts/lfea-s5-pressure-parity-evidence-template.mjs BOURDON_ONLY /path/to/new-bourdon-package
node scripts/lfea-s5-pressure-parity-evidence-template.mjs PRESSURE_STIFFENING_ONLY /path/to/new-stiffening-package
node scripts/lfea-s5-pressure-parity-evidence-template.mjs BOURDON_AND_PRESSURE_STIFFENING /path/to/new-combined-package
```

Complete controlled observations/raw files and independent review, then run:

```text
node scripts/lfea-s5-pressure-parity-evidence-file-check.mjs /path/to/package/evidence.json
```

External execution tracker: Issue #1402.

## August 24 repository-execution falsifier

Issue #54 contains valid historical older-head recovery evidence, but current August 24 heads across unrelated work again reproduce jobs that fail before checkout/step evidence.

A bounded S5 CI-only experiment changed only workflow execution mechanics to match historically executable LAFEA routes:

```text
ubuntu-latest -> ubuntu-24.04
implicit checkout -> explicit pull_request.head.sha
fetch-depth -> 0
concurrency -> exact PR/head keyed
```

Fresh evidence:

```text
experiment head: 0eadd01581e198b24c49e13322e9b4a00c7e616e
run: 32716759422
job: 97399542865
conclusion: failure
steps: null
```

The experiment falsified runner label/exact-checkout as the cause. It was fully reverted at:

```text
556b1d344d7fc09777a9467a8b4c6f5c8be602c1
```

The original workflow blob was restored; no engineering/numerical/source file changed.

Current classification:

```text
S5_REPOSITORY_RUNTIME_QUALIFICATION: NOT_RUN
ENGINEERING_SOURCE_FAILURE_PROVEN: FALSE
PASS_PROVEN: FALSE
```

## Validation ledger

| Check | State | Evidence |
|---|---|---|
| Stack base #1348 | PASS — GROUNDED | `25543a9e...` |
| Current main grounding | PASS — SOURCE_INSPECTION | `c2018c4b...`; no identified S5 mechanics overlap |
| BM4_NL Bourdon source state | PASS — SOURCE_INSPECTION | individual-file `TRANSLATION_AND_ROTATION` |
| Global stiffening source state | PASS — SOURCE_INSPECTION | DEFAULT → DEFAULT_CODE under B31.3-2022 |
| BM4_NL L19/L20 selector | UNRESOLVED — SOURCE AUTHORITY | controlled P1 rejected as source inference |
| Mechanism-scoped evidence contract | PASS_AFTER_HARDENING — SOURCE_INSPECTION | Q1-Q6 independent controls |
| Q5 discriminator | PASS_AFTER_FIX — SOURCE_INSPECTION | fixed active P1 required; NONE rejected |
| Raw artifact custody | PASS_AFTER_HARDENING — SOURCE_INSPECTION | safe paths + SHA-256 recomputation |
| Fail-closed scaffold | PASS_AFTER_FIX — SOURCE_INSPECTION | scope-specific, `DRAFT_NOT_QUALIFIED` |
| CI runner-contract experiment | FALSIFIER_COMPLETE | `0eadd015...` / `32716759422` / `97399542865` / `steps=null` |
| CI experiment cleanup | PASS — SOURCE_INSPECTION | original workflow restored at `556b1d34...` |
| Controlled Bourdon parity | UNRESOLVED | Issue #1402 raw runs absent |
| Controlled pressure-stiffening parity | UNRESOLVED | Issue #1402 raw runs absent |
| Repository runtime qualification | NOT_RUN | Issue #54 August 24 recurrence |
| Production numerical promotion | BLOCKED | all three pressure mechanics flags false |

## Changed-file ledger — 11 files

| File | Purpose |
|---|---|
| `.github/workflows/lfea-s5-pressure-authority-gate.yml` | S5 prerequisite route; temporary runner experiment fully reverted |
| `agents/PR1391_workreport.md` | sole living recovery authority |
| `docs/lfea/S5_Pressure_Effect_Source_Authority_20260824.md` | CAESAR setting/source custody |
| `docs/lfea/S5_Pressure_Effect_Parity_Protocol_20260824.md` | Q1-Q6 controlled protocol; fixed-P1 Q5 rule |
| `docs/lfea/S5_Pressure_Parity_Evidence_Package_20260824.md` | evidence package/raw custody/operator instructions |
| `scripts/lfea-s5-pressure-authority-gate-check.mjs` | BM4_NL source-setting falsifier gate |
| `src/core/linear-piping-analysis-consumer/production-pressure-effect-authority.js` | source-state authority contract |
| `scripts/lfea-s5-pressure-parity-evidence-contract.mjs` | mechanism-scoped evidence validator |
| `scripts/lfea-s5-pressure-parity-evidence-contract-check.mjs` | contract fixture/falsifiers including Q5 NONE rejection |
| `scripts/lfea-s5-pressure-parity-evidence-file-check.mjs` | real evidence + raw-byte verifier |
| `scripts/lfea-s5-pressure-parity-evidence-template.mjs` | fail-closed scope scaffold with Q5 fixed P1 |

## Engineering item register

| ID | Type | Severity | Status | Summary |
|---|---|---:|---|---|
| ISS-S5-001 | ISS | high | OPEN | BM4_NL L19/L20 selector unresolved. |
| ISS-S5-002 | ISS | high | OPEN | Controlled Bourdon parity absent. |
| ISS-S5-003 | ISS | high | OPEN | Controlled pressure-stiffening/global arbitration parity absent. |
| IMP-S5-001 | IMP | high | IMPLEMENTED | Source-setting custody and independent mechanism scopes. |
| IMP-S5-002 | IMP | high | IMPLEMENTED | Raw-byte SHA-256 intake. |
| IMP-S5-003 | IMP | high | IMPLEMENTED | Q5 fixed-active-P1 discriminator. |
| RISK-S5-001 | RISK | high | MITIGATED | DEFAULT cannot silently become INCLUDE/EXCLUDE. |
| RISK-S5-002 | RISK | high | MITIGATED | Controlled P1 cannot become BM4_NL authority. |
| RISK-S5-003 | RISK | high | MITIGATED | Bourdon cannot authorize thrust. |
| RISK-S5-004 | RISK | high | MITIGATED | Pressure factor cannot be applied twice or erase curved geometry. |
| RISK-S5-005 | RISK | medium | FALSIFIED | Runner label/exact checkout is not the current zero-step cause. |

## Appendix A — expert takeover questionnaire

1. Why are Bourdon, bend pressure stiffening and axial thrust separate authorities?
2. Which BM4_NL source layer establishes Bourdon mode and what selector remains unresolved?
3. Why is global DEFAULT_CODE different from per-load-case Elbow Stiffening Pressure?
4. Why is Q5 selector NONE non-discriminating?
5. Why is fixed controlled P1 valid for Q5 but forbidden as BM4_NL source inference?
6. What does Q3 prove and why does it not replace Q2 CAESAR parity?
7. How does Q4 prove P1/P2/PMAX behavior and exactly-once factor ownership?
8. How does Q6 separate Bourdon elongation from pressure thrust?
9. How are raw CAESAR bytes bound to derivative evidence?
10. What did the August 24 CI-only runner-contract experiment falsify?

Takeover threshold: all answers must be source/contract grounded without guessing CAESAR behavior.

## Historical record

- S5 was split from a bundled pressure concept into three independent mechanism authorities.
- BM4_NL established Bourdon mode and global DEFAULT_CODE while L19/L20 selector remained unresolved.
- Q1-Q6 controlled protocols, raw-file intake and fail-closed scaffolds were added.
- August 24 source audit found Q5 selector NONE would defeat global arbitration; contract/fixture/scaffold/docs were corrected to fixed controlled P1 at stable engineering head `a0620687...`.
- Issue #1402 owns external CAESAR execution; accepted evidence remains parity-only.
- August 24 CI-only runner-contract experiment remained zero-step and was completely reverted; Issue #54 remains the repository execution blocker.
