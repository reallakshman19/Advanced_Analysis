# PR1249 — TECH-13 H/I/J Stacked Qualification on Bundle Prerequisite

# CURRENT STATE — READ FIRST

```text
HANDOVER_READINESS: READY_WITH_INHERITED_ENGINEERING_BLOCKERS
REPOSITORY: reallaksh19/Advanced_Analysis
PR: #1249 (draft, open, unmerged)
BRANCH: agent/lafea4-tech13-hij-after-bundle-prereq-20260818
STACK_BASE_PR: #1248
STACK_BASE_SHA: eb2d78240610cff7ec37e37e99e2974386710a92
SOURCE_TECH13_PR: #1246
SOURCE_TECH13_SHA: 371d1d02e2700898d9ed26b498fe883ed741c9d5
CURRENT_HEAD_BEFORE_THIS_WORKREPORT_UPDATE: 907dd5a264e8c20211bc946efbc8aff6c788d343
CURRENT_CODE_TREE_EQUIVALENT_TO: be80ae309db0f23b43e4995ce297d274bea37644 plus workreport-only commits
EXECUTION_MODE: MANUAL
MUTATION_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
CURRENT_STAGE: INHERITED_B01_B02_BLOCKER_CUSTODY_AND_TECH13_QUALIFICATION
TRUST_ROOT: NULL
PRODUCT_RETENTION_AUTHORIZED_NOW: false
UI_BINDING_AUTHORIZED_NOW: false
RELEASE_QUALIFIED: false
PRODUCTION_BUNDLE_CEILING: 1179648 B
BUNDLE_BUILD_STATE: PASS on exact head 907dd5a2... within visible-workbench run 32118202202
BROWSER_STATE: PASS on exact head 907dd5a2...; job remains red only by preserved pre-browser engineering gate
B01_STATE: FAIL — T6/L3/NU=0.4999/REGULAR exact residual 4.627509042620659e-9 misses frozen internal PCG target 2.102108772439442e-9
B02D_STATE: FAIL-CLOSED V1 — frozen T3 coarse mesh violates hard quality gate
TECH13_H_SOURCE_AUDIT: PASS / SOURCE_INSPECTION_ONLY
TECH13_I_SOURCE_AUDIT: PASS / SOURCE_INSPECTION_ONLY
TECH13_J_SOURCE_AUDIT: PASS / SOURCE_INSPECTION_ONLY
TECH13_H_DEDICATED_EXACT_HEAD: NOT_OBSERVED
TECH13_I_DEDICATED_EXACT_HEAD: NOT_OBSERVED
TECH13_J_DEDICATED_EXACT_HEAD: NOT_OBSERVED
TECH13_CANONICAL_RUNNER_REMOTE_TRANSPORT: NOT_AVAILABLE_IN_CURRENT_STOCK_WORKFLOWS
EXACT_NEXT_ACTION: keep PR1249 draft and stop B01/B02 mutation here. Treat B01 numerical repair and any B02D V2 redesign as separate prerequisite engineering work. H/I/J source authority is structurally sound, but dedicated exact-head execution remains NOT_OBSERVED because no TECH-13 stock workflow transports the canonical local runner. Before merge-ready disposition, split/adopt qualified prerequisites, reconstruct/rebase TECH-13 on them, and execute the canonical TECH-13 exact-head runner/verifier through an authorized transport. No merge without owner authorization.
```

## Handover in 60 Seconds

PR #1249 is the stacked TECH-13 H/I/J qualification carrier above #1248. The earlier bundle-size blocker is no longer governing: on exact head `907dd5a264e8c20211bc946efbc8aff6c788d343`, standalone build, production Pages build, shell custody, pinned Chromium provisioning, and actual Stage-17 + production-shell Playwright execution all PASS. The visible-workbench job is red only because its final step deliberately re-propagates the pre-browser B01/B02 engineering gate failure.

The current blockers are inherited engineering qualification, not a discovered TECH-13 authority defect:

1. **B01 near-incompressible sparse PCG** still fails the qualified `/10` internal convergence target for T6/L3/ν=0.4999/REGULAR at the frozen 42,560-iteration cap. Arithmetic-only repairs reduced the exact residual from about `1.97906e-8` to `4.627509042620659e-9`, but the frozen target is `2.102108772439442e-9`. Do not loosen the target, increase the cap, change Jacobi identity, or alter reliable-update policy inside PR1249.
2. **B02D V1 T3 coarse polar mesh** is frozen before observation and hard-blocks mesh quality (`min angle ≈ 9.736093°`, `SJ ≈ 0.169110`, `AR ≈ 5.911`; hard SJ floor = 0.2). `T3=CONTROL` does not authorize bypassing a hard mesh-quality gate. A geometry redesign must be prospectively frozen as a separate V2, not patched into V1 after observation.
3. **TECH-13 H/I/J** remains dormant: trust root NULL, product retention/UI binding/release false. Source audit found the production authority chain structurally fail-closed, but dedicated H/I/J exact-head execution remains NOT_OBSERVED because the branch has no TECH-13-specific Actions workflow. The canonical local exact-head runner/verifier is rigorous but currently lacks an authorized remote execution transport in the stock workflow set.

The retained numerical code tree is the same best state as `be80ae309db0f23b43e4995ce297d274bea37644`; subsequent commits only preserved/reverted experiments and updated this workreport.

## Mission / Scope

Qualify the actual combined tree of:

```text
PR #1248 bundle prerequisite
  + TECH-13H retained refinement authority
  + TECH-13I promotion-bound replay custody
  + TECH-13J implementation-currentness fingerprint
```

This PR is **not** authority to redesign the B01 solver, change B02 frozen benchmark geometry, activate the TECH-13 trust root, or broaden release scope.

### Scope correction recorded 2026-08-18

During stacked qualification, inherited B01/B02 failures surfaced before TECH-13 could be treated as merge-ready. B01 arithmetic experiments were performed on this branch only to isolate whether the inherited failure was a bounded finite-precision defect. The retained B01 arithmetic changes are prerequisite engineering work, not TECH-13 H/I/J semantics. They must be split/adopted through a dedicated qualified prerequisite path before PR1249 can receive a merge-ready disposition.

## Protected Invariants

- trust root remains `null`;
- `productRetentionAuthorized=false`;
- `uiBindingAuthorized=false`;
- `releaseQualified=false`;
- no CST/DKT formulation change;
- no element constitutive/B-bar formulation change;
- no solver tolerance change;
- PCG internal target remains `freeDofResidualTolerance / 10`;
- PCG iteration cap remains `min(50000, max(1000, 16*N))`;
- Jacobi preconditioner identity unchanged;
- exact residual check cadence remains every 100 iterations plus recursive-target checks;
- reliable recurrence restart remains governed by the existing policy;
- adjacent size ratio max 1.5 unchanged;
- AR warning/block 5/10 unchanged;
- SJ warning/block 0.5/0.2 unchanged;
- parent-normal mathematics unchanged;
- TECH-13E frozen oracle/stress criteria unchanged;
- production hard ceiling remains exactly 1,179,648 B;
- B02D V1 frozen definition is not rewritten after observation;
- no workflow-file mutation without explicit authorization;
- no merge without explicit owner authorization.

## Current Implementation Ground Truth

### TECH-13 stack

The branch contains the H/I/J stack above #1248, including retained-refinement authority, promotion-bound replay custody, implementation-currentness fingerprinting, and the corrected canonical TECH-13 plan that includes H/I/J/currentness checks. Trust-root activation remains absent.

### TECH-13 H/I/J production-authority source audit

Source inspection on exact head `907dd5a2...` found no authority defect requiring a production patch:

- **H retention:** the lower-level retention finalizer validates the accepted candidate and promotion record, while the production workbench caller obtains promotion authorization only through the code-owned `requireLafea4ShellProductRefinementPromotionAuthorized()` path. Caller-supplied UI or runtime promotion objects cannot activate the production refinement path.
- **J currentness:** promotion evaluation requires the source-controlled record's `implementationFingerprint` to match the current build-embedded fingerprint. Missing current fingerprint or mismatch blocks activation. The canonical manifest covers promotion, retention, replay, refinement/quality/parent-normal dependencies, production workbench caller, and build injection; only the marked trust-root value slot is normalized for trust-root-only activation.
- **I replay:** replay recovery re-resolves current code-owned promotion, exact semantic record/head, current source lifecycle, midsurface/profile lineage, parent-normal qualification, and exact retained artifact/mesh hashes. Generic V2 recovery remains blocked for TECH-13 product evidence.
- **Activation proof:** the promotion policy explicitly requires `scripts/lafea-tech13g-active-promotion-path-check.mjs` on the trust-root-only activation commit. That active-path checker proves active refinement/UI, retention, promotion-bound round-trip recovery, generic-replay block, and parent rollback on forced child-recovery failure.
- **Pre-promotion limitation:** current H/I/J scripts run with trust root NULL and therefore do not constitute observed active-production activation. Their dedicated exact-head execution remains NOT_OBSERVED until the canonical runner is transported and, later, the activation-only checker is run on the actual trust-root activation commit.

### Retained B01 numerical changes on the current code tree

The retained code-equivalent tree `be80ae30...` contains bounded finite-precision repairs:

- compensated PCG scalar products already present before this repair sequence;
- compensated accumulation of the PCG solution vector `x += alpha*p`;
- compensated accumulation of the recursive residual `r -= alpha*Ap`, with compensation reset when the existing reliable-update policy replaces the residual with an exact residual;
- compensated CSR row summation used by PCG's authoritative `exactResidual()` evaluation;
- PCG recurrence `Ap` remains on the original raw CSR matrix-vector product after the compensated-`Ap` experiment worsened the governing residual;
- sparse stiffness assembly remains original after its compensation experiment worsened the governing residual.

No tolerance, cap, preconditioner, formulation, matrix entries, or benchmark expected values were changed.

## B01 Numerical Repair Ledger

Frozen governing case throughout:

```text
elementType: T6
levelId: L3
poissonRatio: 0.4999
distortionId: REGULAR
free-system size: 2660 DOF (42560 / 16)
iterationLimit: 42560
public free-DOF acceptance gate: 2.102108772439442e-8
qualified internal PCG target:   2.102108772439442e-9
preconditioner: JACOBI
```

| Candidate | Exact head | Governing exact residual | Disposition |
|---|---|---:|---|
| scalar-compensated PCG baseline | `b7fb7c7d...` | `1.97906e-8` | baseline / retained predecessor |
| compensated CSR `Ap` + exact matvec globally | `fba6f634...` | `2.29338e-8` | REJECTED / reverted |
| compensated sparse stiffness assembly | `4c71d1bc...` | `2.6775524020195007e-8` | REJECTED / reverted |
| compensate solution accumulation `x` | `a4347472...` | `1.0710209608078003e-8` | RETAINED |
| compensate recursive residual `r` | `ff5135de...` | `5.587935447692871e-9` | RETAINED |
| compensated two-term direction update | `30a5bca5...` | `5.587935447692871e-9` | NEUTRAL / removed |
| compensated authoritative exact-residual CSR rows | `be80ae30...` | `4.627509042620659e-9` | RETAINED provisionally |
| compensated recurrence `Ap` | `749289cc...` | `7.821654435247183e-9` | REJECTED |
| forward revert to best tree | `a18c0c22...` | code tree = `be80ae30...` | RETAINED CODE TREE |

The arithmetic-only programme improved the governing exact residual by about 76.6% versus the `1.97906e-8` baseline, but B01 still FAILs because `4.627509042620659e-9 > 2.102108772439442e-9`.

### B01 stopping rule

Do **not** continue by casually adding symmetric scaling/equilibration, iterative refinement after PCG, a different preconditioner, a higher cap, or a relaxed target inside PR1249. Those are larger solver-algorithm changes and require a separately declared/qualified engineering boundary with independent evidence.

## B02D Frozen-V1 RCA / Disposition

The registered B02D production route uses `B02D_PROBE_STABLE_POLAR_POLICY_V1`. The frozen definition was established before production observation and binds:

- circumferential `backgroundBaseDivisions = 16`;
- radial `backgroundBaseDivisions = 6`;
- T3/T6 topology = two CCW triangles per polar cell;
- Q8 topology = one serendipity quad per cell;
- method applicability: T3 `CONTROL`, T6 `REQUIRED`, Q8 `REQUIRED`.

Observed coarse T3 geometry under the frozen V1 definition is approximately:

```text
minimum angle      9.736093 deg
scaled Jacobian    0.169110
maximum AR         5.911
hard SJ block      0.2
asin(0.2)          11.536959 deg
```

A 16→20 circumferential redesign was quantitatively capable of clearing the hard floor in a reconstruction, but it is **inadmissible as a V1 repair** because it changes a frozen-before-observation definition. Do not mutate V1 or reinterpret `CONTROL` as permission to hard-fail quality. Any redesign must be a prospectively frozen B02D V2 in a separate engineering PR.

## Validation Ledger

Validation entries distinguish engineering result from infrastructure state.

### VAL-1249-STACK-01 — PASS
- Observation: SOURCE_INSPECTION + GIT_GRAPH_INSPECTION
- Oracle: NONE
- #1249 remains stacked on #1248 and contains the H/I/J layer above the bundle prerequisite.

### VAL-1249-HEAD-907-BUILD-BROWSER-01 — PASS
- Observation: REMOTE_EXECUTION
- Oracle: IMPLEMENTATION_COUPLED + REAL_BROWSER_OBSERVATION
- Exact head: `907dd5a264e8c20211bc946efbc8aff6c788d343`
- Visible-workbench run `32118202202`, job `95652424534`.
- Exact-head + clean-tree PASS.
- Static/projection PASS.
- Shell mesh compiler/execution custody PASS.
- Standalone inherited-boundary proof PASS.
- Standalone build PASS.
- Production Pages bundle build PASS under unchanged 1,179,648 B ceiling.
- Pinned Chromium install PASS.
- Stage-17 pre-browser B01/B02 gate observed and retained.
- Actual Stage-17 and production-shell Playwright proof PASS.
- Job conclusion = FAILURE only because `Preserve pre-browser gate failure as job failure` intentionally returned the inherited engineering failure.

### VAL-1249-HEAD-907-B01-METAMORPHIC-01 — PASS
- Observation: REMOTE_EXECUTION
- Oracle: INDEPENDENT_REPRODUCTION / FROZEN MATRIX
- Exact head: `907dd5a2...`
- Run `32118202236`.
- Registered 54-case base matrix reconfirmed PASS before the 270-case metamorphic matrix.
- 270-case metamorphic matrix PASS.

### VAL-1249-HEAD-907-B01-FAILCLOSED-01 — PASS
- Observation: REMOTE_EXECUTION
- Oracle: FROZEN GOVERNED NEGATIVE MATRIX
- Exact head: `907dd5a2...`
- Run `32118202268`.
- Registered base + metamorphic controls reconfirmed before negative matrix.
- 16-case fail-closed matrix PASS.

### VAL-1249-HEAD-907-B01-EXACT-01 — FAIL
- Observation: REMOTE_EXECUTION
- Oracle: ANALYTICAL + AUTHORITATIVE_REFERENCE + FROZEN PRODUCTION MATRIX
- Exact head: `907dd5a264e8c20211bc946efbc8aff6c788d343`
- Run `32118202189`, job `95652424529`, artifact ID `9317651181`.
- Exact-head/clean-tree check PASS.
- ν=0.3 four-level Lamé diagnostic PASS.
- Integrated B01 driver FAIL.
- Governing first failure: T6/L3/ν=0.4999/REGULAR.
- Exact residual `4.627509042620659e-9` > internal target `2.102108772439442e-9` after 42,560 iterations.
- Public acceptance gate remains `2.102108772439442e-8`; it was not weakened.

### VAL-1249-B01-AP-EXPERIMENT-01 — FAIL / REJECTED CANDIDATE
- Observation: REMOTE_EXECUTION
- Exact head: `749289ccffa4877aaf8274f93de99ed681777deb`
- Exact-head run `32117229397`, job `95649379855`, retained artifact ID `9317360454`.
- Metamorphic run `32117229394`: PASS.
- Fail-closed run `32117229411`: PASS.
- Governing residual worsened to `7.821654435247183e-9`.
- Candidate forward-reverted by `a18c0c22409eb7732e6e59aecd414f1ec95aa709`.

### VAL-1249-B02D-01 — FAIL-CLOSED / INHERITED QUALIFICATION DEBT
- Observation: SOURCE_INSPECTION + REMOTE_GATE_OBSERVATION
- Oracle: FROZEN BENCHMARK DEFINITION + HARD MESH-QUALITY POLICY
- Frozen V1 T3 coarse polar mesh violates hard quality gate.
- No threshold relaxation or post-observation V1 geometry mutation authorized.
- Separate V2 qualification programme required.

### VAL-1249-H-SOURCE-01 — PASS / SOURCE_INSPECTION ONLY
- Production caller obtains refinement authorization through code-owned promotion evaluator.
- Retention authority validates accepted candidate, promotion record, mesh identity/hash, acceptance, and parent-normal qualification.
- Trust root remains NULL on current branch.
- This is not execution evidence.

### VAL-1249-I-SOURCE-01 — PASS / SOURCE_INSPECTION ONLY
- Replay package binds retention authority, acceptance, promotion record and semantic hash.
- Recovery re-resolves current code-owned promotion and current source/midsurface/profile/parent-normal lineage.
- Generic V2 recovery of TECH-13 candidate/retained evidence remains blocked.
- Promotion policy requires active-path checker on the actual activation commit.
- This is not execution evidence.

### VAL-1249-J-SOURCE-01 — PASS / SOURCE_INSPECTION ONLY
- Runtime promotion evaluator blocks missing/mismatched implementation fingerprint.
- Fingerprint manifest covers promotion-critical implementation, retention/replay, quality/refinement/parent-normal, production caller and build injection.
- Only trust-root value slot is normalized for trust-root-only activation.
- J negative matrix source covers critical source changes, trust-root-only invariance, unrelated README invariance, CRLF transport, and browser spoof prevention.
- This is not execution evidence.

### VAL-1249-H-01 — NOT_RUN / NOT_OBSERVED
Dedicated `lafea-tech13h-retained-refinement-authority-check.mjs` has not been remotely executed on the final retained code tree through an authorized stock workflow.

### VAL-1249-I-01 — NOT_RUN / NOT_OBSERVED
Dedicated `lafea-tech13i-promoted-refinement-roundtrip-check.mjs` has not been remotely executed on the final retained code tree through an authorized stock workflow.

### VAL-1249-J-01 — NOT_RUN / NOT_OBSERVED
Dedicated `lafea-tech13j-implementation-currentness-check.mjs` has not been remotely executed on the final retained code tree through an authorized stock workflow.

### VAL-1249-TECH13-EXACT-HEAD-01 — NOT_RUN / NOT_OBSERVED
The canonical local runner `scripts/lafea-tech13-product-refinement-qualification.mjs` and independent bundle verifier are source-complete and rigorous, but no TECH-13-specific GitHub Actions transport exists in the current stock workflow set. Workflow files were not modified because that is outside current authorization.

## Active Engineering Items

### ISS-1249-01 — B01 near-incompressible sparse-PCG convergence
- Status: OPEN / inherited blocker.
- Falsifier: frozen T6/L3/ν=0.4999/REGULAR production case.
- Current best exact residual: `4.627509042620659e-9`.
- Required target: `2.102108772439442e-9`.
- Larger solver changes require a separate qualified prerequisite PR.

### ISS-1249-02 — B02D V1 T3 hard mesh-quality block
- Status: OPEN / inherited blocker.
- Frozen V1 must remain fail-closed.
- Any redesign requires prospectively frozen V2.

### ISS-1249-03 — TECH-13 H/I/J exact-head execution transport
- Status: OPEN.
- Local exact-head runner/verifier exists and requires H/I/J + all prerequisite engineering steps + real browser PASS.
- No TECH-13-specific stock Actions workflow transports it.
- Do not create/modify workflow infrastructure without explicit authorization.
- Source inspection cannot be relabeled execution PASS.

### RISK-1249-01 — Scope entanglement
B01 prerequisite numerical repairs are currently present on this branch. They are not TECH-13 semantics. Before merge-ready disposition, split/adopt them through a separately qualified prerequisite path, then rebase/reconstruct #1249 on the qualified prerequisite and rerun exact-head TECH-13 qualification.

### RISK-1249-02 — False PASS by benchmark/tolerance mutation
Prohibited mitigations include raising PCG cap, weakening `/10`, changing expected Lamé values, loosening mesh-quality floors, changing B02D V1 frozen geometry, or classifying an unexecuted check as PASS.

## Changed-File / Custody Note

Relative to #1248, PR1249 contains the intended TECH-13 H/I/J code/scripts/validation plus qualification-era B01 prerequisite arithmetic changes in `src/core/local-continuum/solver.js` and `src/core/local-continuum/sparse-matrix.js`. The B01 files require prerequisite split/adoption before merge-ready status. Rejected numerical experiments remain in history with explicit forward reverts so evidence is auditable.

## Exact Continuation State

1. Re-ground PR #1249 head after this workreport commit.
2. Do not make more B01 or B02 production changes in PR1249.
3. Keep PR1249 draft; current disposition is **BLOCKED_BY_INHERITED_PREREQUISITES**, not merge-ready.
4. Create/qualify B01 larger-solver work only in a separate prerequisite PR if pursued; create B02D V2 only as a separately frozen benchmark-design PR if pursued.
5. Once prerequisites are qualified/adopted, reconstruct/rebase the TECH-13 H/I/J stack on those qualified prerequisites to remove scope entanglement.
6. Execute the existing canonical TECH-13 exact-head runner + independent bundle verifier through an authorized execution transport; do not alter workflows merely to manufacture PASS.
7. On the later trust-root-only activation commit, run the policy-required active-promotion-path checker and preserve `releaseQualified=false` unless separately authorized/qualified.
8. No merge without explicit owner authorization.

## Appendix A — Engineering Takeover / Recovery Check

1. **Production trace** — authority path: frozen B01/B02 definitions → production mesh/solver → exact residual/equilibrium → qualification receipts; TECH-13 authority path remains separate and dormant.
2. **Failure isolation** — current B01 first failure is T6/L3/ν=0.4999/REGULAR sparse PCG termination; B02D first hard-quality failure is frozen T3 coarse polar mesh; no TECH-13 production-authority source defect was found.
3. **Authority / invariants** — `/10` target, 16N cap, Jacobi identity, hard mesh thresholds, frozen B02D V1, trust-root NULL, implementation-currentness gate, and release=false are protected.
4. **Independent validation** — 54 base, 270 metamorphic, 16 fail-closed, analytical Lamé, build/browser, frozen benchmark custody, and TECH-13 source inspection are kept distinct; failed exact-head B01 and unexecuted H/I/J are not relabeled PASS.
5. **Next minimal patch** — none inside PR1249 for B01/B02/TECH-13 authority. Next work is prerequisite separation/qualification and authorized exact-head transport, followed by TECH-13 reconstruction and rerun.
