# RLL-1 local Codex automation — Advanced_Analysis

This repository adapter consumes Common Engineering Relay V3.1 RLL-1 plus the Codex executor profile.

The Codex migration replaces Antigravity scheduling/execution only. RLL authority, labels, mutex, GitHub lease/state, directives, `BRANCH_RESUME`, `EXACT_HEAD_EVIDENCE`, review, and merge/release boundaries stay unchanged.

## Architecture

```text
Windows Task Scheduler (10 min)
  -> scripts/rll1-codex-worker.ps1
  -> WSL2/Linux
  -> Common rll_codex_worker.py
  -> Common deterministic RLL core
  -> launcher-owned git + gh preparation/state
  -> isolated codex exec
  -> launcher path/postflight checks
  -> launcher-owned commit/push + TASK_EVIDENCE
```

No GitHub MCP is used.

## Why WSL2/Linux is required for writes

Native-Windows Codex `workspace-write` is not qualified for unattended RLL branch writes because current Codex CLI reports show requested workspace-write can behave read-only.

`BRANCH_RESUME` therefore runs inside WSL2/Linux. The Windows host is only the scheduler entrypoint.

Do not use unrestricted sandboxing as a workaround.

## Identity split

Use two Linux identities:

1. Provider/launcher user (the WSL default user)
   - owns the checkout and `.git`;
   - has `git`, Python and `gh`;
   - authenticates with `gh auth login --web`;
   - owns RLL labels/state/evidence/commit/push.

2. `rll-codex` engineering user
   - runs only `codex exec`;
   - has a dedicated `CODEX_HOME`, default `/home/rll-codex/.codex-rll`;
   - has no GitHub CLI credential store;
   - can read the repository and can write governed worktree files for branch-write pilots;
  - cannot write `.git`.

Install Codex globally so both users can execute the binary, then authenticate only the Codex identity:

```bash
sudo npm install -g @openai/codex
sudo useradd -m -s /bin/bash rll-codex   # if not already present
sudo -u rll-codex env CODEX_HOME=/home/rll-codex/.codex-rll \
  HOME=/home/rll-codex codex login
```

Configure passwordless sudo only for switching from the provider user to the dedicated `rll-codex` user, not for arbitrary root commands.

The working tree must be writable by `rll-codex` for a branch-write smoke while `.git` remains provider-owned/not writable by that user.

## Provider authentication

Inside WSL as the provider/launcher user:

```bash
gh auth login --web
gh auth status
```

Do not set `GH_TOKEN` or `GITHUB_TOKEN`.

Do not copy GitHub OAuth/PAT material into the Codex user's home, `CODEX_HOME`, prompts, task files, or scheduler configuration.

## Common basis

During migration smoke this adapter is pinned to Common draft head:

`5093474da3228720f73047226754c7e17f5ea5a3`

Before the adapter can be considered current, repin it to the merged Common #475 SHA.

## Install smoke scheduler

Example:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/install-rll1-codex-task.ps1 `
  -WslDistribution "Ubuntu" `
  -RepoRootLinux "/srv/rll/Advanced_Analysis" `
  -CommonRootLinux "/srv/rll/Common" `
  -PilotIssue <fresh-open-smoke-issue>
```

The installer:

 - verifies WSL, Python, git, gh, codex and sudo;
- verifies the required Common basis;
- verifies provider `gh auth status`;
- verifies the dedicated Codex identity and `codex login status`;
- creates/updates the four RLL labels;
- refuses completed/review-ready pilot reuse;
- copies the credential-free Codex wrapper plus local runner under `%LOCALAPPDATA%\RLL\Advanced_Analysis`, outside the governed checkout;
- the scheduled entrypoint therefore survives RLL switching the repository checkout onto a governed branch that does not yet contain the Codex adapter;
- creates a Windows Task Scheduler job every ten minutes;
- defaults to `-Smoke`, so the deterministic launcher runs but Codex is not invoked.

No Antigravity sidecar is involved.

## Enable execution

After the scheduler/mutex smoke is reviewed, rerun the installer with the same pilot plus:

```powershell
-EnableExecution
```

Execution enablement does not relabel the pilot.

## Codex execution envelope

Read-only exact head:

```yaml
RLL_EXECUTION_V1

transport: RLL-1
worker: codex-local
mode: EXACT_HEAD_EVIDENCE
repository: reallaksh19/Advanced_Analysis
head_sha: <exact-sha>
base_sha: <comparison-base>
allow_material_write: false
```

Branch write:

```yaml
RLL_EXECUTION_V1

transport: RLL-1
worker: codex-local
mode: BRANCH_RESUME
repository: reallaksh19/Advanced_Analysis
branch: <governed-branch>
base_sha: <approved-base>
allow_material_write: true
allowed_paths: path/one; path/two; directory/prefix
commit_message: <bounded launcher-owned commit message>
```

`allowed_paths` is mandatory for Codex branch writes.

## Codex policy

Common invokes Codex with:

- `codex exec`;
- JSONL events;
- structured output schema;
- `approval_policy="never"`;
- `approvals_reviewer="user"`;
- explicit `read-only` or `workspace-write` sandbox;
- web search disabled;
- workspace network disabled.

Do not configure `auto_review`.
Do not use `--dangerously-bypass-approvals-and-sandbox`.

The Codex process is instructed not to use `gh`, GitHub APIs, MCP, commit, push, rebase, merge or release.

## Pilot sequence

1. Create a fresh OPEN exact-head smoke issue for `worker: codex-local`.
2. Install scheduler in smoke mode.
3. Prove discovery, singular worker-state mutation and mutex overlap rejection.
4. Enable execution and prove exact-head read-only evidence with a clean unchanged tree.
5. Create a disposable WSL/Linux branch-write smoke with one harmless authorized path.
6. Prove in-workspace edit succeeds, out-of-scope path is rejected, and Codex does not move Git HEAD.
7. Prove launcher-owned commit/push and evidence publication.
8. Repin this adapter to the merged Common #475 SHA.
9. Only then migrate authorized engineering task #1908 from `antigravity-local` to `codex-local`.

## #1908 migration boundary

The L5 governance implementation remains authorized but transport-paused.

Do not relabel #1908 `rll-ready` until both Codex smoke stages pass and its execution envelope is replaced with a `worker: codex-local` envelope containing the exact five allowed paths.

No merge/release authority is implied.

## Rollback

Disable/delete the Windows scheduled task and remove RLL labels if needed.

Do not delete engineering issues, branches, commits or evidence. Git/GitHub material truth remains valid without the scheduler.
