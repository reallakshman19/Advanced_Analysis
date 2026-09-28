#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/\r\n/g, '\n');

const rule = read('.agents/rules/rll-1.md');
const wrapper = read('scripts/rll1-antigravity-worker.ps1');
const installer = read('scripts/install-rll1-antigravity-sidecar.ps1');
const docs = read('docs/RLL1_LOCAL_AUTOMATION.md');
const codexWrapper = read('scripts/rll1-codex-worker.ps1');
const codexInstaller = read('scripts/install-rll1-codex-task.ps1');
const codexDocs = read('docs/RLL1_CODEX_LOCAL_AUTOMATION.md');

assert.match(rule, /^---\ntrigger: always_on\n/m);
assert.match(rule, /RLL_EXECUTION_V1/u);
assert.match(rule, /EXACT_HEAD_EVIDENCE/u);
assert.match(rule, /Do not use GitHub MCP/u);
assert.match(rule, /Never broaden scope, merge, release, delete branches/u);
assert.match(rule, /Codex engineering subprocess must not use `gh`, GitHub APIs\/MCP/u);
assert.match(rule, /commit and push belong to the deterministic launcher/u);

assert.match(wrapper, /engineering-pr-delivery-v3\.1\\scripts\\rll_worker\.py/u);
assert.match(wrapper, /--repository", "reallaksh19\/Advanced_Analysis"/u);
assert.match(wrapper, /--authorized-login/u);
assert.match(wrapper, /RLL_SMOKE/u);
assert.match(wrapper, /ANTIGRAVITY_EXECUTABLE_DATA_DIR/u);
assert.match(wrapper, /049ebc556fb37a641709af9b786cea7cfedc6716/u);
assert.match(installer, /049ebc556fb37a641709af9b786cea7cfedc6716/u);
assert.match(docs, /049ebc556fb37a641709af9b786cea7cfedc6716/u);

for (const label of ['rll-ready', 'rll-active', 'rll-review-ready', 'rll-escalation']) {
  assert.match(installer, new RegExp(label, 'u'));
}
assert.match(installer, /builtin = "schedule"/u);
assert.match(installer, /RLL_SMOKE = \$smoke/u);
assert.match(installer, /PilotIssue/u);
assert.match(installer, /RLL_EXECUTION_V1/u);
assert.match(installer, /not OPEN/u);
assert.match(installer, /Never reopen completed work/u);
assert.match(installer, /Execution enablement does not relabel/u);
assert.match(wrapper, /GH_TOKEN/u);
assert.match(wrapper, /gh auth login --web/u);
assert.match(installer, /GH_TOKEN/u);
assert.match(installer, /gh auth login --web/u);
assert.match(installer, /\$configPath\.bak-/u);

assert.doesNotMatch(wrapper, /gh\s+pr\s+merge/iu);
assert.doesNotMatch(installer, /gh\s+pr\s+merge/iu);
assert.doesNotMatch(wrapper, /dangerously-skip-permissions/iu);
assert.doesNotMatch(installer, /dangerously-skip-permissions/iu);
const sidecarBlock = installer.match(/\$sidecar = \[ordered\]@\{[\s\S]*?\n\}/u)?.[0] ?? '';
assert.doesNotMatch(sidecarBlock, /GH_TOKEN|GITHUB_TOKEN|oauth_token/iu,
  'sidecar env must remain credential-free');

assert.match(docs, /dedicated detached worktree/u);
assert.match(docs, /Transport state is not engineering result/u);
assert.match(docs, /Do not hard-code or recycle a completed issue/u);
assert.match(docs, /command\(\*\)/u);
assert.match(docs, /always-proceed/u);

// Codex migration adapter. Antigravity checks above remain as legacy-compatibility
// guards until the Codex smoke is independently qualified.
assert.match(codexWrapper, /rll_worker\.py/u);
assert.match(codexWrapper, /--repository.*reallaksh19\/Advanced_Analysis/u);
assert.match(codexWrapper, /--worker-id/u);
assert.match(codexWrapper, /--executor/u);
assert.match(codexWrapper, /codex/u);
assert.match(codexWrapper, /codex-local/u);
assert.match(codexWrapper, /--codex-user/u);
assert.match(codexWrapper, /--codex-home/u);
assert.match(codexWrapper, /wsl\.exe/u);
assert.match(codexWrapper, /2486ba4a175143aa3816792123c8a2bac24c3379/u);
assert.match(codexInstaller, /2486ba4a175143aa3816792123c8a2bac24c3379/u);
assert.match(codexDocs, /2486ba4a175143aa3816792123c8a2bac24c3379/u);

for (const label of ['rll-ready', 'rll-active', 'rll-review-ready', 'rll-escalation']) {
  assert.match(codexInstaller, new RegExp(label, 'u'));
}
assert.match(codexInstaller, /schtasks\.exe/u);
assert.match(codexInstaller, /\/SC MINUTE \/MO 10/u);
assert.match(codexInstaller, /PilotIssue/u);
assert.match(codexInstaller, /not OPEN/u);
assert.match(codexInstaller, /Never reopen completed work/u);
assert.match(codexInstaller, /Execution enablement does not relabel/u);
assert.match(codexInstaller, /codex login status/u);
assert.match(codexInstaller, /sudo -n -u/u);
assert.match(codexInstaller, /installedWrapper/u);
assert.match(codexInstaller, /Copy-Item -Path \$Wrapper -Destination \$installedWrapper -Force/u);
assert.match(codexInstaller, /%LOCALAPPDATA%|LOCALAPPDATA/u);

assert.match(codexWrapper, /GH_TOKEN/u);
assert.match(codexWrapper, /unset GH_TOKEN GITHUB_TOKEN/u);
assert.match(codexInstaller, /GH_TOKEN/u);
assert.match(codexDocs, /gh auth login --web/u);
assert.match(codexDocs, /No GitHub MCP is used/u);
assert.match(codexDocs, /WSL2\/Linux/u);
assert.match(codexDocs, /allowed_paths/u);
assert.match(codexDocs, /approval_policy="never"/u);
assert.match(codexDocs, /approvals_reviewer="user"/u);
assert.match(codexDocs, /Do not configure `auto_review`/u);
assert.match(codexDocs, /dangerously-bypass-approvals-and-sandbox/u);
assert.match(codexDocs, /launcher-owned commit\/push/u);
assert.match(codexDocs, /scheduled entrypoint therefore survives RLL switching/u);
assert.match(codexDocs, /dedicated `CODEX_HOME`/u);

assert.doesNotMatch(codexWrapper, /gh\s+pr\s+merge/iu);
assert.doesNotMatch(codexInstaller, /gh\s+pr\s+merge/iu);
assert.doesNotMatch(codexWrapper, /dangerously-bypass-approvals-and-sandbox/iu);
assert.doesNotMatch(codexInstaller, /dangerously-bypass-approvals-and-sandbox/iu);

const taskRunnerBlock = codexInstaller.match(/\$runner = @"[\s\S]*?"@/u)?.[0] ?? '';
assert.doesNotMatch(taskRunnerBlock, /GH_TOKEN|GITHUB_TOKEN|oauth_token/iu,
  'scheduled task runner must remain credential-free');

console.log('RLL-1 Advanced_Analysis Antigravity legacy + Codex migration adapter source guard passed.');
