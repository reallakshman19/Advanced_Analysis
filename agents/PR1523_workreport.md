# PR #1523 Work Report — Current-system exception-result presentation custody

## Current state

```text
PR                         #1523
branch                     agent/issue-1321-result-exception-presentation-custody
issue                      #1321
current main               b97f0ddbd42ccb62c677e6322746e3459c0435db
engineering checkpoint     2bebb884e839d11729e3b88d3ffce1907e95e46d
latest endpoint            EP-LC1321-RESPRES-0001
state                      SOURCE_COMPLETE_EXECUTION_NOT_RUN
merge authority            OWNER_ONLY_NOT_GRANTED
```

Governing delivery policy: Common `engineering-pr-delivery-v2@10d667ce715bb52e1f73035c6fa326db77d0f9dd`.

## Problem isolated

Issue #1321 requires valid partial results to remain visible as `CALCULATED_WITH_EXCEPTIONS` with no silent loss of unallocated load or exception evidence.

The loss-boundary audit found the underlying implementation already satisfies almost all of that requirement:

- support-load result cases retain coverage, unallocated force/mass, unallocated first moment, boundary-transfer moment, exception ledgers, contribution ledgers, excluded inputs, and equilibrium/route closure;
- the Loads pane renders those values and ledgers;
- current-system receipt presentation already distinguishes overall result from vertical-reaction distribution and displays receipt hashes plus retained explicit source moments.

The remaining defect is the completion-message classifier. Current-system execution can intentionally have:

```text
supportExecution.resultStatus     CALCULATED_WITH_EXCEPTIONS
supportExecution.distribution.status CALCULATED
```

when source-explicit component moment demand is retained separately. The historical completion classifier reads only `distribution.status`, understating the engineer-facing outcome as plain complete.

## Bounded implementation

### Result presentation classifier

`src/workspace/load-calc-result-presentation.js`

- accepts optional current execution receipt;
- prefers `execution.resultStatus` for presentation only;
- keeps distribution-only fallback for legacy callers;
- does not mutate engineering objects or authority.

### Current-system wrapper

`src/workspace/load-calc-current-system-view.js`

- compares raw distribution presentation against the current-system overall receipt presentation;
- corrects only the ordinary raw completion message when the two statuses differ;
- does not overwrite unrelated user/controller messages;
- leaves current Loads/receipt evidence rendering unchanged.

### Focused falsifier

`scripts/load-calc-current-system-result-presentation-custody-check.mjs`

Requires:

```text
distribution.status = CALCULATED
execution.resultStatus = CALCULATED_WITH_EXCEPTIONS
=> exception presentation wins
=> openLoads remains true
=> message names coverage, unallocated load, transfer-moment evidence
```

It also requires legacy distribution-only fallback and source-checks the existing runtime discriminator and exact current-execution custody into the view.

## Main reconciliation

The branch began at `1b8be743e7368eda79a06564acc84a413e1e985c`. During PR creation main advanced to EMP.1 reconciliation `b97f0ddbd42ccb62c677e6322746e3459c0435db`.

The drift changed only EMP.1/source-governance and shared relay files. No Load Calc presentation/runtime/result path overlapped. The three-file engineering overlay was reconstructed from exact new main and reconciled in `2bebb884e839d11729e3b88d3ffce1907e95e46d`, preserving current EMP.1 state byte-for-byte.

## Executable validation truth

Fresh local access check:

```text
git ls-remote https://github.com/reallaksh19/Advanced_Analysis.git HEAD
fatal: unable to access ... Could not resolve host: github.com
```

Therefore:

```text
result-presentation custody check       NOT_RUN
current-system run routing check        NOT_RUN
current empirical runtime check         NOT_RUN
aggregate non-FEA checks                NOT_RUN
check:imports                            NOT_RUN
advanced-shell contract                 NOT_RUN
build                                   NOT_RUN
git diff --check                        NOT_RUN
```

Source review is not executable PASS.

## Required execution order

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

Stop at the first real executable failure.

## Changed-file ledger

Engineering source/test:

1. `src/workspace/load-calc-result-presentation.js`
2. `src/workspace/load-calc-current-system-view.js`
3. `scripts/load-calc-current-system-result-presentation-custody-check.mjs`

Relay/governance:

4. `agents/PR1523_workreport.md`
5. `agents/claims/PR1523.yaml`
6. `agents/status/PR1523.yaml`
7. `agents/agentchain/LOAD-CALC-1321-RESULT-EXCEPTION-PRESENTATION/EP-LC1321-RESPRES-0001.md`
8. `agents/agentchain.md`

Final current-main delta must be re-read after relay updates.

## Inputs

- Issue #1321.
- current main `b97f0ddbd42ccb62c677e6322746e3459c0435db`.
- current-system execution/result/status modules listed in EP-LC1321-RESPRES-0001.

## Benchmarks / discriminators

- vertical distribution: `CALCULATED`;
- overall current-system result: `CALCULATED_WITH_EXCEPTIONS`;
- completion message must expose exceptions;
- Loads remains open/publishable;
- raw distribution unchanged;
- no new numerical or authority value.

## Common / governing documents

- `Advanced_Analysis/AGENTS.md`.
- Common `engineering-pr-delivery-v2@10d667ce715bb52e1f73035c6fa326db77d0f9dd`.
- `agents/agentchain.md`.

## Authoritative sources

No external numerical source is added. Existing repository result/status contracts are authoritative for this presentation-only leg.

## Production paths

Changed:
- `src/workspace/load-calc-result-presentation.js`
- `src/workspace/load-calc-current-system-view.js`

Read-only:
- `src/workspace/engineering-loads/support-load-distribution-v3.js`
- `src/workspace/engineering-loads/current-common-input-empirical-support-load-execution.js`
- `src/workspace/engineering-loads/current-common-input-empirical-run-runtime.js`
- `src/workspace/engineering-loads/engineering-support-load-store.js`
- `src/workspace/engineering-model-controller.js`
- `src/workspace/engineering-model-store.js`
- `src/workspace/load-calc-consumer-controller.js`
- `src/workspace/load-calc-consumer-view.js`

## Validation / test paths

- `scripts/load-calc-current-system-result-presentation-custody-check.mjs`
- `scripts/load-calc-current-common-input-run-routing-check.mjs`
- `scripts/current-common-input-empirical-run-runtime-check.mjs`
- aggregate/import/advanced-shell/build/diff checks above.

## Protected boundary

No support statics/allocation/equilibrium/tolerance/result-schema/default/authority/workflow/release changes. No PR #1519, EMP.1, WRC, or LAFEA engineering scope is absorbed.

## Merge disposition

```text
DRAFT
SOURCE_COMPLETE
EXECUTION_NOT_RUN
OWNER_MERGE_AUTHORITY_NOT_GRANTED
```

Do not merge #1523 without a new explicit owner instruction.

## Exact next action

On a faithful exact-head checkout run `node scripts/load-calc-current-system-result-presentation-custody-check.mjs`. If it passes, continue the required execution order. Re-ground live main/head/files/reviews/threads before any merge decision.
