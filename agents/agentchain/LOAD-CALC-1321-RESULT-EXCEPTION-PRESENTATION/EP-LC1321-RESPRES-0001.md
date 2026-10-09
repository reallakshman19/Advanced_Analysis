# EP-LC1321-RESPRES-0001 — Current-system overall-result presentation custody

CHAIN_ID: LOAD-CALC-1321-RESULT-EXCEPTION-PRESENTATION
LEG_ID: LEG-A
ENDPOINT_ID: EP-LC1321-RESPRES-0001
PREVIOUS_ENDPOINT: NONE_NEW_CHAIN
CREATED_AT: 2026-08-29T04:05:00+05:30
ENDPOINT_REASON: CONCRETE_ENGINEER_FACING_RESULT_STATUS_LOSS_BOUNDARY
TASK_ISSUE: Advanced_Analysis #1321
PR: #1523
BRANCH: agent/issue-1321-result-exception-presentation-custody
CHECKPOINT_HEAD: 2bebb884e839d11729e3b88d3ffce1907e95e46d
MAIN_HEAD_OBSERVED: b97f0ddbd42ccb62c677e6322746e3459c0435db
MERGE_BASE: b97f0ddbd42ccb62c677e6322746e3459c0435db
STATE: SOURCE_COMPLETE_EXECUTION_NOT_RUN
AUTO_STATE: BLOCKED_ON_EXECUTION_RECOVERY
TAKEOVER: WRITE_ALLOWED_WITHIN_THIS_BOUNDED_PRESENTATION_CHAIN
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

## Mission

Preserve the current-system Run receipt's overall result status in the engineer-facing Load Calc completion presentation when it is intentionally stricter than the vertical-reaction distribution status. Do not change any calculation, allocation, equilibrium, result-contract, default, or authority mechanism.

## Proven loss boundary

Current main already retains and renders the underlying engineering evidence:

- support-load cases retain `contributionLedger`, `exceptionLedger`, `equilibrium`, and `completenessAudit`;
- unallocated load retains force and first moment;
- overhang/cantilever treatment retains force and transfer-moment demand;
- `CALCULATED_WITH_EXCEPTIONS` remains publishable in the Loads pane;
- the current Common Input execution receipt is stored separately from legacy authorized-handoff custody;
- the current-system Loads receipt already presents overall status, vertical-distribution status, hashes, and retained explicit source moments.

The remaining loss is the completion banner path:

```text
current runtime
  execution.resultStatus = CALCULATED_WITH_EXCEPTIONS
  execution.distribution.status = CALCULATED
        ↓
engineering-model-controller publishes both execution + distribution
        ↓
consumer's historical classifier sees distribution.status only
        ↓
"Authorized calculation complete."
```

For retained source-explicit component moment demand this understates the already-qualified result state and omits the immediate instruction to review coverage/unallocated/transfer-moment evidence.

## Bounded implementation

`src/workspace/load-calc-result-presentation.js`

- extends the presentation-only classifier with an optional execution receipt;
- prefers `execution.resultStatus` when supplied;
- falls back exactly to `distribution.status` for legacy callers;
- does not mutate status or engineering values.

`src/workspace/load-calc-current-system-view.js`

- compares raw distribution presentation with current-system overall presentation;
- replaces only the ordinary raw-result completion text when the receipt status differs;
- preserves unrelated controller/user messages;
- leaves existing current-system receipt and Loads evidence rendering unchanged.

`scripts/load-calc-current-system-result-presentation-custody-check.mjs`

- discriminates raw `CALCULATED` versus overall `CALCULATED_WITH_EXCEPTIONS`;
- requires the exception presentation to win and remain `openLoads=true`;
- checks the current-system view actually passes the receipt to the classifier;
- checks the runtime discriminator that can produce the stricter status;
- checks current-system receipt custody reaches the view.

## Current-main reconciliation

The branch began at `1b8be743e7368eda79a06564acc84a413e1e985c`. While the draft PR was opened, `main` advanced by one EMP.1 current-state reconciliation commit to `b97f0ddbd42ccb62c677e6322746e3459c0435db`.

That drift changes EMP.1 docs/release evidence plus `agents/agentchain.md`; it does not touch this chain's three engineering/test paths or any Load Calc result/runtime contract. The exact three-file engineering overlay was re-parented onto current main in two-parent commit `2bebb884e839d11729e3b88d3ffce1907e95e46d`.

## Inputs

- Advanced_Analysis Issue #1321.
- current `main@b97f0ddbd42ccb62c677e6322746e3459c0435db`.
- `src/workspace/engineering-loads/support-load-distribution-v3.js`.
- `src/workspace/engineering-loads/current-common-input-empirical-support-load-execution.js`.
- `src/workspace/engineering-loads/current-common-input-empirical-run-runtime.js`.
- `src/workspace/engineering-loads/engineering-support-load-store.js`.
- `src/workspace/engineering-model-controller.js`.
- `src/workspace/engineering-model-store.js`.
- `src/workspace/load-calc-consumer-controller.js`.
- `src/workspace/load-calc-consumer-view.js`.
- `src/workspace/load-calc-current-system-view.js`.
- `src/workspace/load-calc-result-presentation.js`.

## Benchmarks / discriminators

```text
vertical distribution status       CALCULATED
overall current-system result       CALCULATED_WITH_EXCEPTIONS
expected completion presentation    complete with exceptions
expected action                     review coverage / unallocated / transfer-moment evidence
Loads pane remains publishable      true
raw distribution mutated            false
statics/result contract changed     false
```

## Common / governing documents

- `Advanced_Analysis/AGENTS.md`.
- Common `engineering-pr-delivery-v2@10d667ce715bb52e1f73035c6fa326db77d0f9dd` and same-commit references.
- `agents/agentchain.md`.

## Authoritative sources

No new external engineering source is introduced. This leg consumes existing repository result-status and evidence contracts only. Numerical authority remains with the existing support-load/current-system runtime implementation.

## Production paths

Changed:

- `src/workspace/load-calc-result-presentation.js`
- `src/workspace/load-calc-current-system-view.js`

Read-only authority context:

- `src/workspace/engineering-loads/support-load-distribution-v3.js`
- `src/workspace/engineering-loads/current-common-input-empirical-support-load-execution.js`
- `src/workspace/engineering-loads/current-common-input-empirical-run-runtime.js`
- `src/workspace/engineering-loads/engineering-support-load-store.js`
- `src/workspace/engineering-model-controller.js`
- `src/workspace/engineering-model-store.js`
- `src/workspace/load-calc-consumer-controller.js`
- `src/workspace/load-calc-consumer-view.js`

## Validation / test paths

Changed:

- `scripts/load-calc-current-system-result-presentation-custody-check.mjs`

Required exact-head sequence when execution is available:

```bash
node scripts/load-calc-current-system-result-presentation-custody-check.mjs
node scripts/load-calc-current-common-input-run-routing-check.mjs
node scripts/current-common-input-empirical-run-runtime-check.mjs
node scripts/run-non-fea-checks.mjs
npm run check:imports
node scripts/advanced-shell-contract-check.mjs
npm run build
git diff --check
```

## Execution truth

A fresh local repository-access retry failed before checkout:

```text
git ls-remote https://github.com/reallaksh19/Advanced_Analysis.git HEAD
fatal: unable to access ... Could not resolve host: github.com
```

Therefore every executable check above remains `NOT_RUN`. Source inspection, GitHub diff metadata, or mergeability must not be reported as executable PASS.

## Protected boundary

This endpoint does not authorize changes to:

- support-load allocation or statics;
- unallocated force/first-moment mechanics;
- cantilever/overhang transfer mechanics;
- equilibrium or tolerances;
- result schemas or semantic-hash custody;
- default/effective-value resolution;
- Product/Project/source/master authority;
- CoG/mass/gravity/source-axis mechanics;
- support capability/contact mechanics;
- workflows;
- EMP.1/WRC/LAFEA;
- release/trust/publication authority.

## Exact next safe action

On the first faithful exact-head checkout, run `node scripts/load-calc-current-system-result-presentation-custody-check.mjs`. Stop at the first real failure and repair only the presentation-custody seam. If it passes, run the documented regression sequence. Re-ground current main/head/files/reviews/threads before any merge decision. PR #1523 remains draft/unmerged until the owner explicitly authorizes merge.

## Incoming qualification — exactly Q1–Q5

Q1 — Production trace: Trace `CALCULATED_WITH_EXCEPTIONS` from `bindExplicitMomentRetentionToSupportExecution()` through the current execution store and Load Calc rendering path, while separately tracing `distribution.status = CALCULATED`. Identify the exact former loss boundary.

Q2 — Failure isolation: If the Loads receipt says overall `CALCULATED_WITH_EXCEPTIONS` but the completion banner still says plain complete, which presentation modules and exact status values should be inspected first?

Q3 — Authority/invariant: Explain why this leg may change presentation precedence between an existing execution receipt and its narrower distribution status but may not alter statics, equilibrium, result contracts, defaults, or publication authority.

Q4 — Independent validation: Given vertical distribution `CALCULATED` and a retained source-explicit moment that promotes `execution.resultStatus` to `CALCULATED_WITH_EXCEPTIONS`, state the correct engineer-facing result and why no vertical reaction may be invented from that retained moment.

Q5 — First execution falsifier: State the first command, the raw-versus-overall discriminator it must prove, the legacy fallback it must preserve, and the protected domains that must remain frozen if it fails.
