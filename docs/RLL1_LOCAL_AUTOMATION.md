# RLL-1 local Antigravity automation — Advanced_Analysis

This repository adapter consumes the generic Engineering Relay V3.1 RLL-1 transport from Common.

It intentionally does not duplicate the protocol and does not use GitHub MCP.

## Architecture

```text
Antigravity sidecar cron
  -> scripts/rll1-antigravity-worker.ps1
  -> Common V3.1 rll_worker.py
  -> deterministic git + gh claim/state/workspace preparation
  -> exactly one agy -p engineering run
  -> GitHub exact-head evidence
```

The sidecar timer launches ordinary code, not an agent conversation. This avoids a scheduled agent spawning another nested agent merely to obtain deterministic mutex/lease behavior.

## Prerequisites

On the Windows worker:

- a local `Advanced_Analysis` checkout;
- a local `Common` checkout containing the RLL-1 V3.1 implementation;
- `git`;
- GitHub CLI `gh`, authenticated once with `gh auth login`;
- Antigravity CLI `agy`, authenticated interactively once;
- Python.

Until Common PR #467 is merged, use its branch in the local Common checkout only for the RLL pilot. Do not describe the draft transport as merged Common/main authority.

## Install in smoke mode

From the Advanced_Analysis checkout:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-rll1-antigravity-sidecar.ps1 `
  -CommonRoot "C:\path\to\Common" `
  -PilotIssue 1900
```

The installer:

The optional `-PilotIssue` parameter first verifies that the issue already contains an `RLL_EXECUTION_V1` envelope, then applies `rll-ready`. It does not create engineering authority or rewrite the issue contract.

- creates/updates the four `rll-*` labels using `gh`;
- writes `~/.gemini/config/sidecars/advanced-analysis-rll1/sidecar.json`;
- enables that sidecar in `~/.gemini/config/config.json`;
- backs up an existing `config.json` before modification;
- defaults to `RLL_SMOKE=1`, so the timer can claim/update transport state but will not invoke an engineering agent.

Default cadence is every ten minutes.

Antigravity sidecar runtime storage is used for RLL mutex/worktree data when `ANTIGRAVITY_EXECUTABLE_DATA_DIR` is available.

## Enable engineering execution

After the non-destructive smoke has been reviewed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-rll1-antigravity-sidecar.ps1 `
  -CommonRoot "C:\path\to\Common" `
  -PilotIssue 1900 `
  -EnableExecution
```

## Eligible issue metadata

A coordinator adds one RLL execution envelope to the bounded issue.

Branch implementation:

```yaml
RLL_EXECUTION_V1

transport: RLL-1
worker: antigravity-local
mode: BRANCH_RESUME
repository: reallaksh19/Advanced_Analysis
branch: <owned branch>
base_sha: <approved base>
allow_material_write: true
```

Exact-head local certification:

```yaml
RLL_EXECUTION_V1

transport: RLL-1
worker: antigravity-local
mode: EXACT_HEAD_EVIDENCE
repository: reallaksh19/Advanced_Analysis
head_sha: <exact candidate>
base_sha: <comparison base>
allow_material_write: false
```

Then add `rll-ready`.

The worker selects an existing `rll-active` issue first; otherwise it selects the oldest `rll-ready` issue.

### Workspace safety

For `BRANCH_RESUME`, the deterministic launcher positions the worker on the governed branch before invoking Antigravity. It fast-forwards only when safe, preserves local-ahead material, and refuses divergent or dirty wrong-branch reconciliation.

For `EXACT_HEAD_EVIDENCE`, the launcher creates/reuses a dedicated detached worktree under the RLL data directory. The scheduled worker does not detach or repurpose your normal repository checkout.

## Antigravity permissions

Do not use `--dangerously-skip-permissions`.

Headless Antigravity must be able to run the commands required by the bounded engineering issue. Configure the narrowest command/file permissions practical for the project.

Typical RLL execution needs:

- Git read/status/fetch/worktree operations;
- `gh` issue/PR reads and bounded evidence comments;
- the issue-specific Node/npm/Python test commands;
- writes only inside the governed workspace for `BRANCH_RESUME`;
- no tracked writes for `EXACT_HEAD_EVIDENCE`.

Do not authorize `gh pr merge`, release creation, branch deletion, destructive repository administration, or arbitrary elevation.

On Windows, terminal commands may require explicit permission even when the scheduled/headless agent itself starts successfully. Prove the actual installed Antigravity permission behavior with smoke/read-only execution before enabling source-write automation.

## Transport state is not engineering result

`rll-review-ready` means independent review can begin. It does not mean PASS or merge-ready.

Engineering evidence continues to use the issue's exact `PASS | FAIL | NOT_RUN | NOT_APPLICABLE` vocabulary and V3.1 publication types.

## Pause / resume / replan

Only authorized structured comments control transport:

```yaml
RELAY_DIRECTIVE_V1

sequence: 1
issue: <number>
action: PAUSE
```

Then:

```yaml
RELAY_DIRECTIVE_V1

sequence: 2
issue: <number>
action: RESUME
```

Use `REPLAN` only when the governing approach must change. Ordinary comments never become control commands.

## Suggested pilot sequence

1. Install in smoke mode.
2. Mark one read-only exact-head issue `rll-ready`.
3. Verify one timer wake updates the singular worker-state comment and no agent executes.
4. Verify a second overlapping launcher exits on the local mutex.
5. Review GitHub labels/state and local sidecar logs.
6. Enable execution.
7. Let the same exact-head issue execute and publish its evidence.
8. Independently review the result through normal V3.1.
9. Only after that, pilot `BRANCH_RESUME` source writes.

Current Agent C issue #1900 is a suitable exact-head pilot because its contract already forbids tracked source modification and is pinned to an exact candidate SHA.

## Rollback

Disable/remove the `advanced-analysis-rll1` Antigravity sidecar and remove RLL labels.

Do not delete the engineering issue, branch, commits, or evidence. Material Git/GitHub truth remains valid without RLL.
