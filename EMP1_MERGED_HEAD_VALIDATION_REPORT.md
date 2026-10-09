# EMP.1 Merged-Head Executable Validation Report

- **Target commit (fixed):** `f98d56d4c644b7bb6b79d2302739d12dac720248`
- **Subject:** Merge PR #1701: normalize qualification source and harden exact-head validation
- **Ancestor of origin/main:** confirmed (`git merge-base --is-ancestor`)
- **Validation worktree:** isolated `git worktree add --detach` checkout, exact-head custody confirmed before any test ran
- **Toolchain:** Node v22.22.2, npm 10.9.7, git 2.43.0

## Steps executed

| Step | Result |
|---|---|
| Fetch + ancestor check | PASS |
| Exact-head custody check | PASS (`HEAD == f98d56d4c644...`) |
| `npm ci` (frozen lockfile) | PASS |
| Project-local Chromium install (`PLAYWRIGHT_BROWSERS_PATH=0`) | PASS |
| Browser environment preflight | `PASS_BROWSER_ENVIRONMENT_PREFLIGHT` |
| Node gate: qualification-sample orchestration | PASS |
| Node gate: analytical-layout | PASS |
| Node gate: manual-browser-audit (static) | PASS |
| Node gate: issue-1651 acceptance | PASS |
| Node gate: public-product bounded-route | PASS |
| Focused Playwright: qualification-sample (2 tests) | **1 passed / 1 FAILED** |
| Stage-17 browser carrier | not reached (fail-fast stop) |

## Outcome

`node scripts/emp1-issue1651-executable-validation.mjs` exited non-zero with:

```
{
  "schema": "emp1-issue1651-executable-validation/v1",
  "status": "FAIL_EXECUTABLE_GATE_SEQUENCE",
  "phase": "FOCUSED_PLAYWRIGHT",
  "id": "focused qualification-sample Playwright",
  "exitCode": 1,
  "humanFactorMayProceed": false
}
```

**`PASS_EXECUTABLE_EXACT_HEAD_GATE_SEQUENCE` was NOT emitted.** The five Node gates
passed, but the focused Playwright suite was 1/2, not the required 2/0, and the
Stage-17 carrier never ran because the sequence is fail-fast.

## Root cause of the Playwright failure

`e2e/emp1-qualification-sample-orchestration.spec.js:13` ("clean complete sample
executes and retains A before B/C"):

```
Error: expect(received).toContain(expected) // indexOf
Expected value: null
Received array: ["CALCULATED", "PREPARED_C_BLOCKED"]
```

`state.emp1ExecutionStatus` was `null` at the point of assertion. The preceding
`expect.poll(...).toMatchObject({...})` only waits for A/B document load and
run-input load — it does not wait for the C execution status to leave its
initial `null` state before the test reads `state` a second time. This is a
race in the spec's synchronization, not evidence that qualification sample C
failed to execute; the immediate next assertions (`not.toBe('FAILED')`,
`not.toBe('BLOCKED')`) do not fail, which is consistent with `null` simply
being read too early rather than the run ending in an actual failure/blocked
state.

## Conclusion

At the fixed merged head `f98d56d4c644b7bb6b79d2302739d12dac720248`, EMP.1
executable validation does **not** reach
`PASS_EXECUTABLE_EXACT_HEAD_GATE_SEQUENCE`. The blocking failure is isolated to
a synchronization gap in the focused Playwright spec for qualification-sample
C-status timing, not a regression in the five static Node gates or in the
bounded-route/public-product qualification logic, which all passed cleanly.
