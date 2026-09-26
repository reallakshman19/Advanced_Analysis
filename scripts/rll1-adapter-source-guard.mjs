#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const rule = read('.agents/rules/rll-1.md');
const wrapper = read('scripts/rll1-antigravity-worker.ps1');
const installer = read('scripts/install-rll1-antigravity-sidecar.ps1');
const docs = read('docs/RLL1_LOCAL_AUTOMATION.md');

assert.match(rule, /^---\ntrigger: always_on\n/m);
assert.match(rule, /RLL_EXECUTION_V1/u);
assert.match(rule, /EXACT_HEAD_EVIDENCE/u);
assert.match(rule, /Do not use GitHub MCP/u);
assert.match(rule, /Never broaden scope, merge, release, delete branches/u);

assert.match(wrapper, /engineering-pr-delivery-v3\.1\\scripts\\rll_worker\.py/u);
assert.match(wrapper, /--repository", "reallaksh19\/Advanced_Analysis"/u);
assert.match(wrapper, /--authorized-login/u);
assert.match(wrapper, /RLL_SMOKE/u);
assert.match(wrapper, /ANTIGRAVITY_EXECUTABLE_DATA_DIR/u);
assert.match(wrapper, /8c013591659cbf42111d9d61d102e338f462cff5/u);
assert.match(installer, /8c013591659cbf42111d9d61d102e338f462cff5/u);
assert.match(docs, /8c013591659cbf42111d9d61d102e338f462cff5/u);

for (const label of ['rll-ready', 'rll-active', 'rll-review-ready', 'rll-escalation']) {
  assert.match(installer, new RegExp(label, 'u'));
}
assert.match(installer, /builtin = "schedule"/u);
assert.match(installer, /RLL_SMOKE = \$smoke/u);
assert.match(installer, /PilotIssue/u);
assert.match(installer, /RLL_EXECUTION_V1/u);
assert.match(installer, /\$configPath\.bak-/u);

assert.doesNotMatch(wrapper, /gh\s+pr\s+merge/iu);
assert.doesNotMatch(installer, /gh\s+pr\s+merge/iu);
assert.doesNotMatch(wrapper, /dangerously-skip-permissions/iu);
assert.doesNotMatch(installer, /dangerously-skip-permissions/iu);

assert.match(docs, /dedicated detached worktree/u);
assert.match(docs, /Transport state is not engineering result/u);
assert.match(docs, /Current Agent C issue #1900/u);

console.log('RLL-1 Advanced_Analysis adapter source guard passed.');
