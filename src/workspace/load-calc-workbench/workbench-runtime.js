import './workbench.css';
import './workbench-shell.css';
import { WorkbenchController, createWorkbenchState } from './workbench-controller.js';
import { prepareCurrentReview, currentReviewBinding } from './current-review.js';
import { renderCurrentWorkbenchResults } from './current-results.js';

export { createWorkbenchState };

export function mountLoadCalcWorkbench(container, state, owners = {}) {
  const controller = new WorkbenchController(container, {
    prepare: prepareCurrentReview, getBinding: currentReviewBinding,
    renderResults: renderCurrentWorkbenchResults, state, ...owners,
  });
  controller.mount();
  return controller;
}
