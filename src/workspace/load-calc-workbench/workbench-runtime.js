import './workbench.css';
import './workbench-shell.css';
import { WorkbenchController, createWorkbenchState } from './workbench-controller.js';
import { prepareCurrentReview, currentReviewBinding } from './current-review.js';
import { renderCurrentWorkbenchResults } from './current-results.js';

export { createWorkbenchState };

export function mountLoadCalcWorkbench(container, state) {
  const controller = new WorkbenchController(container, {
    prepare: prepareCurrentReview, getBinding: currentReviewBinding,
    renderResults: renderCurrentWorkbenchResults, state,
  });
  controller.mount();
  return controller;
}
