import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('contextual issue workflow reuses certified autofix actions and exposes exact evidence', async () => {
  const controller = await source('src/workspace/topology-edit-3d-issue-controller.js');
  for (const token of [
    'installIssueWorkflow()',
    'data-review-topology-issue-fix',
    'data-issue-overlay-hash',
    'reviewIssueFixById(',
    'focusIssue(entry)',
    'previewAutofix(suggestion.suggestionHash)',
    "applyButton.textContent = 'Apply fix'",
    "cancelButton.textContent = 'Cancel'",
    'Engineering evidence',
    "evidenceRow('Preview hash', preview.previewHash)",
    "evidenceRow('Request hash', preview.requestHash)",
    "evidenceRow('Certification hash', preview.certificationHash)",
    "evidenceRow('Candidate hash', preview.candidateDraftHash)",
    "evidenceRow('Ghost hash', preview.ghostHash)",
    "evidenceRow('Basis topology', preview.priorDraftHash)",
  ]) assert.ok(controller.includes(token), `missing ${token}`);

  assert.match(controller, /querySelector\('\[data-action="accept-autofix"\]'\)/);
  assert.match(controller, /querySelector\('\[data-action="cancel-autofix"\]'\)/);
  assert.match(controller, /actions\.append\(applyButton, cancelButton\)/);

  for (const prohibited of [
    'TopologyEditAutofixController',
    'acceptTopologyEditCommand',
    'certifyTopologyEditCommand',
    'WorkspaceState.update',
    'WorkspaceState.replace',
    'applyCanonicalTopologyToWorkspaceEntities',
  ]) assert.equal(controller.includes(prohibited), false, `UI must not acquire ${prohibited}`);
});

test('production WebGL selection route delegates issue picks before canonical selection', async () => {
  const lifecycle = await source('src/workspace/topology-edit-3d-view-controller.js');
  const issue = await source('src/workspace/topology-edit-3d-issue-controller.js');
  assert.match(lifecycle, /viewportSelectionHandler = \(pick, event\) => \{[\s\S]*handleIssuePick\?\.\(pick, event\)[\s\S]*handleViewportSelection\(pick, event\)/);
  assert.match(issue, /handleIssuePick\(pick, event\)[\s\S]*pick\?\.objectKind !== 'issue'/);
  assert.match(issue, /showIssueById\([\s\S]*event\?\.clientX[\s\S]*event\?\.clientY/);
});

test('source-backed issue pick proxy stays centered on the exact marker and owns no engineering authority', async () => {
  const renderer = await source('src/workspace/topology-edit/topology-edit-issue-renderer.js');
  assert.match(renderer, /const SOURCE_BACKED_PICK_SCALE = 1\.65/);
  assert.match(renderer, /if \(entry\.suggestionHash\) \{[\s\S]*sourceBackedPickProxy/);
  assert.match(renderer, /marker\.add\(sourceBackedPickProxy/);
  assert.match(renderer, /issuePickProxy: true/);
  assert.match(renderer, /sourceBackedSuggestionHash: entry\.suggestionHash/);
  assert.match(renderer, /material\.colorWrite = false/);
  const proxyBody = renderer.match(/function sourceBackedPickProxy\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.notEqual(proxyBody, '');
  assert.doesNotMatch(proxyBody, /position\./, 'pick proxy must inherit the exact marker anchor without an offset');
  for (const prohibited of [
    'canonicalTopologyHash =',
    'acceptTopologyEditCommand',
    'certifyTopologyEditCommand',
    'WorkspaceState.',
  ]) assert.equal(renderer.includes(prohibited), false, `renderer must not acquire ${prohibited}`);
});

test('issue callout presents review intent while retaining the existing certified preview callback', async () => {
  const callout = await source('src/workspace/topology-edit/topology-edit-canvas-callout.js');
  assert.match(callout, /'Review fix',[\s\S]*'preview-callout-fix'/);
  assert.match(callout, /onPreviewFix\?\.\(entry\)/);
  assert.doesNotMatch(callout, /acceptTopologyEditCommand|certifyTopologyEditCommand|WorkspaceState\./);
});

test('certified autofix kernel remains the sole acceptance authority', async () => {
  const autofix = await source('src/workspace/topology-edit/topology-edit-autofix-controller.js');
  const session = await source('src/workspace/topology-edit/topology-edit-certified-session.js');
  assert.match(autofix, /preview\.sessionVersion !== session\.journal\.sessionVersion/);
  assert.match(autofix, /preview\.priorDraftHash !== session\.currentTopology\(\)\.canonicalTopologyHash/);
  assert.match(autofix, /accepted candidate differs from preview/);
  assert.match(session, /return TopologyEditAutofixController\.accept\(this, preview\)/);
});
