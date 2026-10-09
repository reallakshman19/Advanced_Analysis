import { createSourceReview, filterReviewRows, ReviewDeferrals } from './workbench-model.js';
import { shellMarkup, rowsMarkup, evidenceMarkup, weightsMarkup, specialCategoryMarkup } from './workbench-view.js';

const app = document.querySelector('#app');
const sourceSha256 = '1e75a288545b771d2292cf730ca19d943e40fa547244478038da65eb8e4fc39a';
const state = { stage: 1, category: 'all', caseId: 'EMPTY', query: '', branch: '',
  unresolvedOnly: false, deferrals: new ReviewDeferrals(), selectedId: null };
let review;
let returnToWeights = false;

function filteredRows() { return filterReviewRows(review.rows, state); }

function renderContent() {
  const target = app.querySelector('#review-content');
  if (!target) return;
  target.innerHTML = ['supports', 'other'].includes(state.category)
    ? specialCategoryMarkup(review, state.category) : rowsMarkup(filteredRows(), state, review.rows.length);
}

function render() {
  app.innerHTML = shellMarkup(review, state);
  app.setAttribute('aria-busy', 'false');
  renderContent();
  app.querySelector('#evidence-dialog').addEventListener('close', () => {
    if (returnToWeights) { returnToWeights = false; openWeights(); }
  });
}

function openEvidence(id, fromWeights = false) {
  const row = review.rows.find((item) => item.entityId === id);
  if (!row) return;
  state.selectedId = id;
  returnToWeights = fromWeights;
  if (fromWeights) app.querySelector('#weight-dialog').close();
  const dialog = app.querySelector('#evidence-dialog');
  dialog.innerHTML = evidenceMarkup(row, state);
  dialog.showModal();
}

function openWeights() {
  const dialog = app.querySelector('#weight-dialog');
  dialog.innerHTML = weightsMarkup(filteredRows(), state);
  dialog.showModal();
}

function updateReviewAfterDeferral(row, message) {
  const dialog = app.querySelector('#evidence-dialog');
  dialog.innerHTML = evidenceMarkup(row, state);
  dialog.querySelector('#deferral-status').textContent = message;
  dialog.querySelector('[data-restore], [name="reason"]')?.focus();
  // Only presentation changes; recompute the unchanged coverage with the current deferral count.
  const summary = app.querySelector('.readiness');
  const template = document.createElement('template');
  template.innerHTML = shellMarkup(review, state);
  summary.replaceWith(template.content.querySelector('.readiness'));
  renderContent();
}

app.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || !review) return;
  if (button.dataset.stage !== undefined) {
    state.stage = Number(button.dataset.stage);
    render();
    app.querySelector(`[data-stage="${state.stage}"]`).focus();
  } else if (button.dataset.category) {
    state.category = button.dataset.category;
    render();
    app.querySelector(`.category-nav [data-category="${state.category}"]`).focus();
  } else if (button.dataset.review) openEvidence(button.dataset.review);
  else if (button.dataset.weightReview) openEvidence(button.dataset.weightReview, true);
  else if (button.dataset.close) app.querySelector(`#${button.dataset.close}`).close();
  else if (button.dataset.restore) {
    state.deferrals.restore(button.dataset.restore);
    updateReviewAfterDeferral(review.rows.find((row) => row.entityId === button.dataset.restore), 'Restored. Input readiness and mass evidence are unchanged.');
  } else if (button.dataset.action === 'weights') openWeights();
  else if (button.dataset.action === 'next') {
    const unresolved = filteredRows().filter((row) => (row.needsReview || !row.cases[state.caseId].ok) && !state.deferrals.skipped.has(row.entityId));
    if (!unresolved.length) {
      const count = app.querySelector('.row-count');
      if (count) count.textContent = 'No non-deferred unresolved items in this filter. Deferrals remain unresolved; change filters or restore them.';
      return;
    }
    const current = unresolved.findIndex((row) => row.entityId === state.selectedId);
    openEvidence(unresolved[(current + 1) % unresolved.length].entityId);
  }
});

app.addEventListener('input', (event) => {
  if (event.target.dataset.filter !== 'query') return;
  state.query = event.target.value;
  renderContent();
});

app.addEventListener('change', (event) => {
  const filter = event.target.dataset.filter;
  if (!filter || filter === 'query') return;
  state[filter] = filter === 'unresolvedOnly' ? event.target.checked : event.target.value;
  if (filter === 'caseId') {
    render();
    app.querySelector('[data-filter="caseId"]').focus();
  } else renderContent();
});

app.addEventListener('submit', (event) => {
  const id = event.target.dataset.defer;
  if (!id) return;
  event.preventDefault();
  const row = review.rows.find((item) => item.entityId === id);
  try {
    state.deferrals.defer(row, state.caseId, new FormData(event.target).get('reason'));
    updateReviewAfterDeferral(row, 'Deferred for this session only. No input changed; calculation remains unavailable.');
  } catch (error) {
    app.querySelector('#deferral-status').textContent = error.message;
  }
});

try {
  const response = await fetch(new URL('../../fixtures/Sjson.json', import.meta.url));
  if (!response.ok) throw new Error(`Source fixture could not be loaded (HTTP ${response.status}).`);
  const bytes = await response.arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((value) => value.toString(16).padStart(2, '0')).join('');
  if (digest !== sourceSha256) throw new Error('The source fixture has changed since this prototype was bound. Review its source custody before using the preview.');
  review = createSourceReview(JSON.parse(new TextDecoder().decode(bytes)));
  render();
} catch (error) {
  app.setAttribute('aria-busy', 'false');
  app.replaceChildren();
  const main = document.createElement('main');
  main.id = 'main';
  const heading = document.createElement('h1');
  heading.textContent = 'Source preview unavailable';
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = error.message;
  main.append(heading, message);
  app.append(main);
}
