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
- a local `Common` checkout at or after merged RLL-1 basis `8c013591659cbf42111d9d61d102e338f462cff5`;
- `git`;
- GitHub CLI `gh`, authenticated once with `gh auth login --web` using the Windows credential store;
- Antigravity CLI `agy`, authenticated interactively once;
- Python.

Common PR #467 is merged at `8c013591659cbf42111d9d61d102e338f462cff5`. The adapter requires that commit (or a descendant) to be present at the local Common checkout HEAD before it will run or install.

## Install in smoke mode

From the Advanced_Analysis checkout:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-rll1-antigravity-sidecar.ps1 `
  -CommonRoot "C:\path\to\Common" `
  -PilotIssue 1900
```

The installer:

The optional `-PilotIssue` parameter is smoke-only. It requires an OPEN issue that contains an `RLL_EXECUTION_V1` envelope and has not already reached `REVIEW_READY`/`CANCELLED`, then applies `rll-ready`. Never reopen completed engineering work merely to obtain a smoke target. When rerun with `-EnableExecution`, the installer does not relabel the issue; it resumes the smoke-established RLL state.

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

## Authentication and Antigravity permissions

Do not use `--dangerously-skip-permissions`.

Do not set `GH_TOKEN` or `GITHUB_TOKEN` for RLL, and never paste a GitHub OAuth/PAT into sidecar JSON, Antigravity configuration, transcripts, or prompts. Authenticate with `gh auth login --web`; on Windows, GitHub CLI should store the resulting token in the system credential store. If secure storage is unavailable, stop and fix credential storage instead of using a plaintext RLL secret.

Antigravity CLI headless print mode soft-denies tools that need interactive approval. Configure its documented Tool Permission through `/config` or `/settings`; do not create undocumented wildcard grant entries such as `command(*)`, `read_file(*)`, or `write_file(*)`.

For unattended host-backed RLL work, the documented `always-proceed` mode may be required. It is broad host authority, so use it only from a dedicated least-privileged Windows account/workspace and keep RLL's exact-head/clean-tree/postflight guards. Prefer `proceed-in-sandbox` where the task can genuinely operate without host filesystem/network access.

Do not authorize merge/release/branch deletion/destructive repository administration through the engineering contract.

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

Do not hard-code or recycle a completed issue as the pilot. Select the current OPEN bounded RLL task. If a candidate completed before RLL activation, leave it completed and use the next genuine task or a dedicated smoke issue.

## Rollback

Disable/remove the `advanced-analysis-rll1` Antigravity sidecar and remove RLL labels.

Do not delete the engineering issue, branch, commits, or evidence. Material Git/GitHub truth remains valid without RLL.
