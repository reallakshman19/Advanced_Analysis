import { filterReviewRows, ReviewDeferrals } from './workbench-model.js';
import { shellMarkup, rowsMarkup, pipeSectionGroupsMarkup, evidenceMarkup, weightsMarkup, specialCategoryMarkup } from './workbench-view.js';
import { openWeightReviewSettings } from '../load-calc-weight-review-settings.js';

export function createWorkbenchState() {
  return { stage: 1, category: 'all', caseId: 'EMPTY', query: '', branch: '',
    unresolvedOnly: false, deferrals: new ReviewDeferrals(), selectedId: null, toolTab: null, sectionBore: '' };
}

/** Owns only view state. Preparation and freshness are explicit injected seams. */
export class WorkbenchController {
  constructor(root, { prepare, getBinding, renderResults = null, renderTool = null,
    getRunAvailability = null, state = createWorkbenchState() }) {
    this.root = root;
    this.prepare = prepare;
    this.getBinding = getBinding;
    this.renderResults = renderResults;
    this.renderTool = renderTool;
    this.getRunAvailability = getRunAvailability;
    this.state = state;
    this.returnToWeights = false;
    this.handlers = {
      click: (event) => this.click(event), input: (event) => this.input(event),
      change: (event) => this.change(event), submit: (event) => this.submit(event),
    };
  }
  mount() {
    this.root.classList.add('lc-workbench-host');
    this.root.dataset.role = 'load-calc-workbench';
    for (const [name, handler] of Object.entries(this.handlers)) this.root.addEventListener(name, handler);
    this.refresh();
    this.timer = setInterval(() => this.checkCurrent(), 1200);
  }
  destroy() {
    clearInterval(this.timer);
    this.returnToWeights = false;
    for (const [name, handler] of Object.entries(this.handlers)) this.root.removeEventListener(name, handler);
    this.root.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
  }
  refresh() {
    this.returnToWeights = false;
    try {
      const review = this.prepare();
      this.state.deferrals.bind(review.binding);
      this.review = review;
      if (!review.rows.some((row) => row.entityId === this.state.selectedId)) this.state.selectedId = null;
      if (!review.branches.includes(this.state.branch)) this.state.branch = '';
      this.render();
    } catch (error) {
      this.review = null;
      this.state.deferrals.skipped.clear();
      this.root.replaceChildren();
      const message = this.root.ownerDocument.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = `Prepared review unavailable: ${error.message}`;
      this.root.append(message);
    }
  }
  checkCurrent() {
    if (!this.review) return false;
    const binding = this.getBinding();
    if (binding === this.review.binding) return true;
    this.returnToWeights = false;
    this.state.deferrals.bind(binding);
    this.state.selectedId = null;
    this.review = { ...this.review, binding, rows: [], branches: [], requestHash: null,
      reportHash: null, status: null, checkerMassCoverage: null,
      unavailable: 'Inputs changed. Previous effective weights and session skips are cleared. Refresh prepared inputs.',
      issueGroups: [{ id: 'other', title: 'Refresh prepared inputs', count: 0,
        detail: 'Current preparation and checker evidence are required.' }] };
    this.render();
    return false;
  }
  filteredRows() { return filterReviewRows(this.review.rows, this.state); }
  renderContent() {
    const target = this.root.querySelector('#review-content');
    if (!target) return;
    target.innerHTML = ['supports', 'other'].includes(this.state.category)
      ? specialCategoryMarkup(this.review, this.state.category)
      : this.state.category === 'sections' ? pipeSectionGroupsMarkup(this.filteredRows(), this.state, this.review.rows)
        : rowsMarkup(this.filteredRows(), this.state, this.review.rows.length, this.review.rows);
  }
  render() {
    this.root.innerHTML = shellMarkup(this.review, this.state, this.getRunAvailability?.());
    this.renderContent();
    const results = this.root.querySelector('[data-workbench-results]');
    if (results && this.renderResults && !this.review.unavailable) this.renderResults(results);
    const tool = this.root.querySelector('[data-workbench-tool]');
    if (tool && this.renderTool && this.state.toolTab) this.renderTool(tool, this.state.toolTab);
    this.root.querySelector('#evidence-dialog').addEventListener('close', () => {
      if (this.returnToWeights) { this.returnToWeights = false; this.openWeights(); }
    });
  }
  openEvidence(id, fromWeights = false) {
    const row = this.review.rows.find((item) => item.entityId === id);
    if (!row) return;
    this.state.selectedId = id;
    this.returnToWeights = fromWeights;
    if (fromWeights) this.root.querySelector('#weight-dialog').close();
    const dialog = this.root.querySelector('#evidence-dialog');
    dialog.innerHTML = evidenceMarkup(row, this.state);
    dialog.showModal();
  }
  openWeights() {
    if (!this.checkCurrent()) return;
    const dialog = this.root.querySelector('#weight-dialog');
    dialog.innerHTML = weightsMarkup(this.filteredRows(), this.state);
    dialog.showModal();
  }
  updateDeferral(row, message) {
    const dialog = this.root.querySelector('#evidence-dialog');
    dialog.innerHTML = evidenceMarkup(row, this.state);
    dialog.querySelector('#deferral-status').textContent = message;
    dialog.querySelector('[data-restore], [name="reason"]')?.focus();
    const template = this.root.ownerDocument.createElement('template');
    template.innerHTML = shellMarkup(this.review, this.state);
    this.root.querySelector('.readiness').replaceWith(template.content.querySelector('.readiness'));
    this.renderContent();
  }
  click(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-weight-review-settings')) {
      openWeightReviewSettings({ documentRef: this.root.ownerDocument, onApplied: () => this.refresh() }); return;
    }
    if (button.dataset.action === 'refresh') { this.refresh(); return; }
    // Navigation bubbles to the existing route owner, not an alternate runner.
    if (button.dataset.loadCalcTab || button.hasAttribute('data-load-calc-run')
      || button.hasAttribute('data-load-calc-import') || button.hasAttribute('data-load-calc-weight-review')
      || button.hasAttribute('data-load-calc-apply-approved-pipe-inputs') || button.hasAttribute('data-pipe-section-branch')) return;
    if (button.dataset.action === 'close-tool') { this.state.toolTab = null; this.refresh(); return; }
    if (!this.checkCurrent()) return;
    const data = button.dataset;
    if (data.stage !== undefined) {
      this.state.stage = Number(data.stage); this.state.toolTab = null; this.refresh();
      this.root.querySelector(`[data-stage="${this.state.stage}"]`)?.focus();
    } else if (data.category) {
      this.state.category = data.category; this.state.sectionBore = ''; this.render();
      this.root.querySelector(`.category-nav [data-category="${this.state.category}"]`)?.focus();
    } else if (data.review) this.openEvidence(data.review);
    else if (data.weightReview) this.openEvidence(data.weightReview, true);
    else if (data.close) this.root.querySelector(`#${data.close}`)?.close();
    else if (data.restore) {
      this.state.deferrals.restore(data.restore);
      this.updateDeferral(this.review.rows.find((row) => row.entityId === data.restore), 'Restored. Input readiness is unchanged.');
    } else if (data.action === 'weights') this.openWeights();
    else if (data.action === 'next') this.nextUnresolved();
  }
  nextUnresolved() {
    const rows = this.filteredRows().filter((row) => (row.needsReview || !row.cases[this.state.caseId].ok)
      && !this.state.deferrals.skipped.has(row.entityId));
    if (!rows.length) {
      const count = this.root.querySelector('.row-count');
      if (count) count.textContent = 'No non-deferred unresolved items in this filter. Deferrals remain unresolved.';
      return;
    }
    const index = rows.findIndex((row) => row.entityId === this.state.selectedId);
    this.openEvidence(rows[(index + 1) % rows.length].entityId);
  }
  input(event) {
    if (event.target.dataset.filter !== 'query' || !this.checkCurrent()) return;
    this.state.query = event.target.value;
    this.renderContent();
  }
  change(event) {
    const filter = event.target.dataset.filter;
    if (!filter || filter === 'query' || !this.checkCurrent()) return;
    this.state[filter] = filter === 'unresolvedOnly' ? event.target.checked : event.target.value;
    if (filter === 'branch') this.state.sectionBore = '';
    if (filter === 'caseId') {
      this.render(); this.root.querySelector('[data-filter="caseId"]')?.focus();
    } else this.renderContent();
  }
  submit(event) {
    const id = event.target.dataset.defer;
    if (!id) return;
    event.preventDefault();
    if (!this.checkCurrent()) return;
    const row = this.review.rows.find((item) => item.entityId === id);
    try {
      this.state.deferrals.defer(row, this.state.caseId, new FormData(event.target).get('reason'));
      this.updateDeferral(row, 'Deferred for this session only. No input or calculation eligibility changed.');
    } catch (error) {
      this.root.querySelector('#deferral-status').textContent = error.message;
    }
  }
}
