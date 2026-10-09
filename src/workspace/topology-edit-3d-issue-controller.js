/** Spatial issue-review composition over search, lifecycle, and certified autofix. */
import { EVENT_TOPICS } from './event-topics.js';
import {
  TopologyEdit3DViewController as SearchController,
} from './topology-edit-3d-search-controller.js';
import {
  topologyEditSelectionDescription,
  updateTopologyEditSelection,
} from './topology-edit/topology-edit-command-ui.js';
import { TopologyEditCanvasCallout } from './topology-edit/topology-edit-canvas-callout.js';
import {
  buildTopologyEditIssueOverlay,
} from './topology-edit/topology-edit-issue-overlay.js';
import {
  topologyEditEntityIdsForObject,
} from './topology-edit/topology-edit-render-packet.js';
import {
  topologyEditPresentationActions,
} from './viewport-presentation/topology-edit-presentation-contract.js';
import {
  focusTopologyEditCanonicalIds,
} from './viewport-productivity/topology-edit-scene-focus.js';

const PRESENTATION_ACTIONS = topologyEditPresentationActions();

export class TopologyEdit3DViewController extends SearchController {
  constructor(eventBus, lifecycleOptions = {}) {
    super(eventBus, lifecycleOptions);
    this.issueOverlay = null;
    this.issueCallout = null;
    this.issueCalloutMount = null;
    this.issueSummaryElement = null;
    this.issueListElement = null;
    this.issueFixReviewElement = null;
    this.issueFixReviewTitle = null;
    this.issueFixReviewStatus = null;
    this.issueFixEvidenceElement = null;
  }

  buildShell() {
    super.buildShell();
    this.hostElement.style.position = 'relative';
    this.installIssueWorkflow();
    const mount = this.hostElement.ownerDocument.createElement('div');
    mount.dataset.role = 'topology-edit-issue-callout-layer';
    mount.style.position = 'absolute';
    mount.style.inset = '0';
    mount.style.pointerEvents = 'none';
    mount.style.overflow = 'hidden';
    this.hostElement.append(mount);
    this.issueCalloutMount = mount;
    this.issueCallout = new TopologyEditCanvasCallout(mount);
  }

  installIssueWorkflow() {
    if (!this.checkerElement) {
      throw new Error('TopologyEditIssueController: checker host is unavailable.');
    }
    const documentRef = this.checkerElement.ownerDocument;
    const summary = documentRef.createElement('p');
    summary.dataset.role = 'topology-edit-issue-summary';
    const list = documentRef.createElement('div');
    list.dataset.role = 'topology-edit-issue-list';

    const review = documentRef.createElement('section');
    review.dataset.role = 'topology-edit-issue-fix-review';
    review.setAttribute('aria-live', 'polite');
    review.hidden = true;
    const title = documentRef.createElement('strong');
    title.dataset.role = 'topology-edit-issue-fix-title';
    const status = documentRef.createElement('p');
    status.dataset.role = 'topology-edit-issue-fix-status';
    const evidence = documentRef.createElement('details');
    evidence.dataset.role = 'topology-edit-issue-fix-evidence';
    evidence.innerHTML = '<summary>Engineering evidence</summary><dl data-role="topology-edit-issue-fix-evidence-list"></dl>';
    const evidenceList = evidence.querySelector('[data-role="topology-edit-issue-fix-evidence-list"]');
    const actions = documentRef.createElement('div');
    actions.dataset.role = 'topology-edit-issue-fix-actions';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Certified issue fix actions');

    const applyButton = this.hostElement?.querySelector('[data-action="accept-autofix"]');
    const cancelButton = this.hostElement?.querySelector('[data-action="cancel-autofix"]');
    if (!applyButton || !cancelButton || !evidenceList) {
      throw new Error('TopologyEditIssueController: certified autofix action hosts are unavailable.');
    }
    applyButton.textContent = 'Apply fix';
    cancelButton.textContent = 'Cancel';
    actions.append(applyButton, cancelButton);
    review.append(title, status, evidence, actions);
    this.checkerElement.replaceChildren(summary, list, review);

    this.issueSummaryElement = summary;
    this.issueListElement = list;
    this.issueFixReviewElement = review;
    this.issueFixReviewTitle = title;
    this.issueFixReviewStatus = status;
    this.issueFixEvidenceElement = evidenceList;
  }

  deactivate() {
    this.issueCallout?.destroy();
    this.issueCallout = null;
    this.issueCalloutMount = null;
    this.issueOverlay = null;
    this.issueSummaryElement = null;
    this.issueListElement = null;
    this.issueFixReviewElement = null;
    this.issueFixReviewTitle = null;
    this.issueFixReviewStatus = null;
    this.issueFixEvidenceElement = null;
    this.viewportBackend?.clearIssues();
    super.deactivate();
  }

  handleCanvasPointer(event) {
    const pick = this.viewportBackend?.pickAt(event.clientX, event.clientY);
    if (!pick?.objectId || !this.session) return;
    if (this.handleIssuePick(pick, event)) return;
    this.applyCanonicalPick(pick, event.shiftKey);
  }

  handleIssuePick(pick, event) {
    if (pick?.objectKind !== 'issue' || !pick.objectId || !this.session) return false;
    this.showIssueById(
      pick.objectId,
      event?.clientX,
      event?.clientY,
      this.issueOverlay?.overlayHash ?? null,
    );
    return true;
  }

  handleHostClick(event) {
    const showButton = event.target.closest('[data-show-topology-issue]');
    if (showButton) {
      const rect = this.hostElement.getBoundingClientRect();
      this.showIssueById(
        showButton.dataset.showTopologyIssue,
        rect.left + rect.width * 0.64,
        rect.top + Math.min(rect.height * 0.45, 320),
        showButton.dataset.issueOverlayHash,
      );
      return;
    }
    const reviewButton = event.target.closest('[data-review-topology-issue-fix]');
    if (reviewButton) {
      this.reviewIssueFixById(
        reviewButton.dataset.reviewTopologyIssueFix,
        reviewButton.dataset.issueOverlayHash,
      );
      return;
    }
    return super.handleHostClick(event);
  }

  applyCanonicalPick(pick, additive) {
    if (pick.objectKind === 'node' || pick.objectKind === 'component') {
      this.selection = updateTopologyEditSelection(
        this.selection,
        pick.objectId,
        additive,
      );
    }
    const entityIds = pick.workspaceEntityIds?.length
      ? pick.workspaceEntityIds
      : topologyEditEntityIdsForObject(
        this.session.currentTopology(),
        pick.objectId,
      );
    if (entityIds.length) {
      this.eventBus.publish(EVENT_TOPICS.VIEWPORT_SELECTION_REQUESTED, {
        entityId: entityIds[0],
        source: 'topology-edit-3d',
      });
    }
    this.presentationToolbar?.update(this.presentationState);
    this.setStatus(pickStatus(pick, this.selection));
    this.updateActionButtons();
  }

  renderCheckerPanel() {
    if (!this.checkerElement || !this.session || !this.issueSummaryElement
        || !this.issueListElement) return;
    this.issueCallout?.hideCallout();
    this.issueOverlay = buildTopologyEditIssueOverlay({
      canonicalTopology: this.session.currentTopology(),
      issues: this.issues,
      suggestions: this.autofixSuggestions,
    });
    this.viewportBackend?.renderIssues(this.issueOverlay);
    const visualIssues = this.visualDiagnostics.map((row) => ({
      kind: row.code,
      message: row.message,
    }));
    const total = this.issues.length + visualIssues.length;
    if (!total) {
      this.issueSummaryElement.textContent = 'No topology or visual-evidence issues detected.';
      this.issueListElement.replaceChildren();
      this.renderIssueFixReview();
      return;
    }
    const entries = new Map(
      this.issueOverlay.entries.map((entry) => [entry.issueId, entry]),
    );
    const rows = this.issues.slice(0, 30).map((issue) => issueRow(
      issue,
      entries.get(issue.id),
      this.issueOverlay.overlayHash,
    ));
    const visualRows = visualIssues.slice(0, Math.max(0, 30 - rows.length))
      .map((issue) => `<li>${escapeHtml(issue.kind)}: ${escapeHtml(issue.message)}</li>`);
    this.issueSummaryElement.textContent = `${total} issue(s); ${this.issueOverlay.anchoredIssueCount} spatial marker(s); ${this.autofixSuggestions.length} source-backed fix(es)`;
    this.issueListElement.innerHTML = `<ul>${[...rows, ...visualRows].join('')}</ul>`;
    this.renderIssueFixReview();
  }

  renderIssueFixReview() {
    const review = this.issueFixReviewElement;
    const evidence = this.issueFixEvidenceElement;
    if (!review || !evidence || !this.issueFixReviewTitle || !this.issueFixReviewStatus) return;
    const preview = this.autofixPreview;
    const suggestion = preview
      ? this.autofixSuggestions.find((row) => (
        row.issueId === preview.issueId
        && row.suggestionHash === preview.suggestionHash
      ))
      : null;
    if (!preview || !suggestion) {
      review.hidden = true;
      review.dataset.issueId = '';
      review.dataset.previewHash = '';
      review.dataset.certificationHash = '';
      review.dataset.candidateDraftHash = '';
      evidence.replaceChildren();
      return;
    }
    review.hidden = false;
    review.dataset.issueId = preview.issueId;
    review.dataset.previewHash = preview.previewHash;
    review.dataset.certificationHash = preview.certificationHash;
    review.dataset.candidateDraftHash = preview.candidateDraftHash ?? '';
    this.issueFixReviewTitle.textContent = `Certified fix · ${suggestion.commandType}`;
    this.issueFixReviewStatus.textContent = 'Ready to apply. Canonical topology and journal state remain unchanged until Apply fix.';
    evidence.innerHTML = [
      evidenceRow('Issue ID', preview.issueId),
      evidenceRow('Command', suggestion.commandType),
      evidenceRow('Suggestion hash', preview.suggestionHash),
      evidenceRow('Preview hash', preview.previewHash),
      evidenceRow('Request hash', preview.requestHash),
      evidenceRow('Certification hash', preview.certificationHash),
      evidenceRow('Candidate hash', preview.candidateDraftHash),
      evidenceRow('Ghost hash', preview.ghostHash),
      evidenceRow('Basis topology', preview.priorDraftHash),
      evidenceRow('Session version', preview.sessionVersion),
    ].join('');
  }

  showIssueById(issueId, screenX, screenY, expectedOverlayHash = null) {
    if (!this.issueOverlay
      || (expectedOverlayHash && expectedOverlayHash !== this.issueOverlay.overlayHash)) {
      this.setStatus('Issue review is stale; refresh the current topology checks.');
      return;
    }
    const entry = this.issueOverlay.entries
      .find((row) => row.issueId === issueId);
    if (!entry) {
      this.setStatus(`Issue ${issueId} is no longer present or has no spatial anchor.`);
      return;
    }
    this.issueCallout?.showIssue({
      entry,
      screenX,
      screenY,
      onPreviewFix: (current) => this.previewIssueFix(current),
      onFlyTo: (current) => this.focusIssue(current),
    });
    this.setStatus(`Reviewing ${entry.severity} ${entry.kind} at ${entry.anchorSource}.`);
  }

  reviewIssueFixById(issueId, expectedOverlayHash = null) {
    if (!this.issueOverlay
      || (expectedOverlayHash && expectedOverlayHash !== this.issueOverlay.overlayHash)) {
      this.setStatus('Issue fix is stale; refresh the current topology checks.');
      return;
    }
    const entry = this.issueOverlay.entries.find((row) => row.issueId === issueId);
    if (!entry?.suggestionHash) {
      this.setStatus(`Issue ${issueId} has no current source-backed certified fix.`);
      return;
    }
    this.previewIssueFix(entry);
  }

  previewIssueFix(entry) {
    const suggestion = this.autofixSuggestions.find((row) => (
      row.issueId === entry.issueId
      && row.suggestionHash === entry.suggestionHash
    ));
    if (!suggestion) {
      this.setStatus('The source-backed fix suggestion is stale; rerun the checker.');
      return;
    }
    this.focusIssue(entry);
    this.previewAutofix(suggestion.suggestionHash);
  }

  previewAutofix(suggestionHash) {
    const result = super.previewAutofix(suggestionHash);
    this.renderIssueFixReview();
    const preview = this.autofixPreview;
    if (preview) {
      const suggestion = this.autofixSuggestions.find((row) => (
        row.suggestionHash === preview.suggestionHash
      ));
      this.setStatus(`${suggestion?.commandType ?? 'Fix'} preview certified. Apply fix or Cancel; canonical topology is unchanged.`);
    }
    return result;
  }

  cancelAutofix(silent = false) {
    const result = super.cancelAutofix(silent);
    this.renderIssueFixReview();
    return result;
  }

  focusIssue(entry) {
    if (!entry.canonicalIds.length) {
      this.setStatus(`Issue ${entry.issueId} has no canonical focus target.`);
      return;
    }
    let result = this.focusCanonicalIds(entry.canonicalIds);
    let visibilityReset = false;
    if (result.status !== 'FOCUSED') {
      this.applyPresentationAction({ type: PRESENTATION_ACTIONS.SHOW_ALL_IDS });
      visibilityReset = true;
      result = this.focusCanonicalIds(entry.canonicalIds);
    }
    if (result.status !== 'FOCUSED') {
      this.setStatus(`Issue targets are absent from the current visual projection: ${entry.canonicalIds.join(', ')}.`);
      return;
    }
    const firstId = result.foundIds[0];
    const entityIds = topologyEditEntityIdsForObject(
      this.session.currentTopology(),
      firstId,
    );
    if (entityIds.length) {
      this.eventBus.publish(EVENT_TOPICS.VIEWPORT_SELECTION_REQUESTED, {
        entityId: entityIds[0],
        source: 'viewport',
      });
    }
    this.setStatus(
      `${visibilityReset ? 'Presentation visibility reset; ' : ''}`
      + `focused ${result.foundIds.length} canonical target(s) for ${entry.kind}.`,
    );
  }

  focusCanonicalIds(canonicalIds) {
    const result = focusTopologyEditCanonicalIds({
      groups: this.viewportBackend?.groups,
      camera: this.viewportBackend?.activeCamera,
      controls: this.viewportBackend?.controls,
      canonicalIds,
    });
    if (result.status === 'FOCUSED') this.viewportBackend?.invalidate('canonical-selection-focus');
    return result;
  }
}

function issueRow(issue, entry, overlayHash) {
  const show = entry
    ? ` <button type="button" data-show-topology-issue="${escapeHtml(issue.id)}" data-issue-overlay-hash="${escapeHtml(overlayHash)}">Show in 3D</button>`
    : '';
  const review = entry?.suggestionHash
    ? ` <button type="button" data-review-topology-issue-fix="${escapeHtml(issue.id)}" data-issue-overlay-hash="${escapeHtml(overlayHash)}">Review fix</button>`
    : '';
  return `<li data-issue-kind="${escapeHtml(issue.kind)}" data-issue-id="${escapeHtml(issue.id)}"><strong>${escapeHtml(issue.severity)}</strong> ${escapeHtml(issue.kind)}: ${escapeHtml(issue.message)}${show}${review}</li>`;
}

function evidenceRow(label, value) {
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? '')}</dd>`;
}

function pickStatus(pick, selection) {
  if (pick.objectKind === 'restraint') {
    return `Selected ${pick.restraintFamily || 'restraint'} ${pick.restraintId} on support ${pick.supportId}.`;
  }
  if (pick.objectKind === 'support') {
    return `Selected support ${pick.supportId || pick.objectId}.`;
  }
  return topologyEditSelectionDescription(selection);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}