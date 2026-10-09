import { createEmp1EngineeringRecordPackage } from '../core/emp1/emp1-engineering-record-package.js';
import {
  emp1EngineeringRecordPackageFilename,
} from './emp1-engineering-record-package-workspace.js';
import { downloadLafeaJson } from './lafea-workbench-controller-io.js';
import { element } from './lafea-workbench-dom.js';

/** DOM-only Review & Evidence form over one controller-owned workspace projection. */
export function renderEmp1EngineeringReviewPanel(root, workspace, onReview) {
  if (workspace?.schema !== 'emp1-engineering-review-workspace/v1') {
    throw new TypeError('EMP1_ENGINEERING_REVIEW_WORKSPACE_INVALID');
  }
  const section = element(root, 'section', 'lafea-workbench__custody');
  section.dataset.role = 'emp1-engineering-review-panel';
  section.dataset.reviewState = workspace.reviewState?.state ?? 'NOT_REVIEWED';
  section.dataset.canCreateReview = String(workspace.canCreateReview === true);
  section.dataset.canExportEngineeringRecord = String(
    workspace.engineeringRecordExport?.canExport === true,
  );
  section.append(
    element(root, 'strong', null, 'Review & Evidence — engineering attestation'),
    element(root, 'p', 'lafea-result-highlights__status',
      `Review state · ${human(workspace.reviewState?.state ?? 'NOT_REVIEWED')}`),
  );

  if (workspace.retainedReview) section.append(retainedReview(root, workspace.retainedReview));
  if (workspace.reviewState?.changedBindings?.length) {
    const changed = element(root, 'p', 'lafea-workbench__authority',
      `Review stale: changed evidence binding(s) · ${workspace.reviewState.changedBindings.map(human).join(', ')}`);
    changed.dataset.role = 'emp1-engineering-review-stale-bindings';
    section.append(changed);
  }
  if (workspace.creationBlockers.length) section.append(reviewBlockers(root, workspace.creationBlockers));

  const form = element(root, 'div', 'lafea-workbench__custody');
  form.dataset.role = 'emp1-engineering-review-form';
  const identity = reviewInput(root, 'emp1-engineering-reviewer-identity', 'Reviewer identity');
  const role = reviewInput(root, 'emp1-engineering-reviewer-role', 'Reviewer role (optional)');
  const comment = element(root, 'textarea');
  comment.dataset.role = 'emp1-engineering-review-comment';
  comment.setAttribute('aria-label', 'Engineering review comment');
  comment.placeholder = 'Review basis, limitations, or required correction (optional)';
  form.append(identity.wrapper, role.wrapper, comment);

  const result = element(root, 'output', 'lafea-workbench__authority');
  result.dataset.role = 'emp1-engineering-review-action-result';
  result.setAttribute('aria-live', 'polite');

  const actions = element(root, 'div', 'lafea-workbench__stages');
  const accept = reviewButton(root, 'Accept engineering review', 'ACCEPTED');
  const reject = reviewButton(root, 'Reject engineering review', 'REJECTED');
  const enabled = workspace.canCreateReview === true && typeof onReview === 'function';
  accept.disabled = !enabled;
  reject.disabled = !enabled;

  const submit = (disposition) => {
    identity.input.setCustomValidity('');
    if (!identity.input.value.trim()) {
      identity.input.setCustomValidity('Reviewer identity is required.');
      identity.input.reportValidity();
      return;
    }
    const response = onReview?.({
      disposition,
      reviewerIdentity: identity.input.value,
      reviewerRole: role.input.value,
      comment: comment.value,
    });
    if (response?.status !== 'RECORDED') {
      result.value = response?.message ?? response?.code ?? 'Engineering review was rejected.';
      result.textContent = result.value;
    }
  };
  accept.addEventListener('click', () => submit('ACCEPTED'));
  reject.addEventListener('click', () => submit('REJECTED'));
  actions.append(accept, reject);

  const exportSection = engineeringRecordExport(root, workspace.engineeringRecordExport, result);
  const boundary = element(root, 'p', 'lafea-workbench__authority',
    'This action records a human engineering-review attestation for the exact current governed EMP.1 execution. A current accepted or rejected review may also be exported as an immutable audit JSON package. Review acceptance or export is not code compliance, release qualification, a cryptographic signature, or a professional digital seal.');
  boundary.dataset.role = 'emp1-engineering-review-authority-boundary';
  section.append(form, actions, exportSection, result, boundary);
  return section;
}

function engineeringRecordExport(root, descriptor, result) {
  const section = element(root, 'div', 'lafea-workbench__custody');
  section.dataset.role = 'emp1-engineering-record-export';
  const button = element(root, 'button', null, 'Download Engineering Record');
  button.type = 'button';
  button.dataset.role = 'emp1-engineering-record-download';
  button.disabled = descriptor?.canExport !== true;
  if (descriptor?.blockers?.length) {
    button.title = descriptor.blockers.map(human).join(' · ');
  }
  button.addEventListener('click', () => {
    if (descriptor?.canExport !== true || !descriptor.packageInput) return;
    try {
      const packageValue = createEmp1EngineeringRecordPackage({
        ...descriptor.packageInput,
        packagedAt: new Date().toISOString(),
      });
      downloadLafeaJson(
        root.ownerDocument,
        packageValue,
        emp1EngineeringRecordPackageFilename(packageValue),
      );
      result.value = `Engineering record exported · ${packageValue.packageId}`;
      result.textContent = result.value;
    } catch (error) {
      result.value = error?.code ?? error?.message ?? 'Engineering record export failed.';
      result.textContent = result.value;
    }
  });
  section.append(
    element(root, 'strong', null, 'Engineering record export'),
    element(root, 'p', 'lafea-workbench__section-intro',
      descriptor?.canExport === true
        ? 'Export the exact current reviewed evidence and retained route limitations as a validated JSON audit record.'
        : 'Export becomes available only when the governed calculation and retained engineering review are both current.'),
    button,
  );
  return section;
}

function retainedReview(root, review) {
  const retained = element(root, 'dl', 'lafea-workbench__custody');
  retained.dataset.role = 'emp1-engineering-review-retained';
  appendDefinition(root, retained, 'Review ID', review.reviewId);
  appendDefinition(root, retained, 'Disposition', review.disposition);
  appendDefinition(root, retained, 'Reviewer', review.reviewer?.identity);
  appendDefinition(root, retained, 'Reviewed at', review.reviewedAt);
  appendDefinition(root, retained, 'Basis', review.basisCode);
  return retained;
}

function reviewBlockers(root, codes) {
  const details = element(root, 'details', 'lafea-workbench__custody-details');
  details.dataset.role = 'emp1-engineering-review-blockers';
  details.append(element(root, 'summary', null, `Review action unavailable (${codes.length})`));
  const blockers = element(root, 'ul');
  codes.forEach((code) => {
    const item = element(root, 'li', null, human(code));
    item.dataset.blockerCode = code;
    blockers.append(item);
  });
  details.append(blockers);
  return details;
}

function reviewInput(root, role, label) {
  const wrapper = element(root, 'label');
  wrapper.append(element(root, 'span', null, label));
  const input = element(root, 'input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.dataset.role = role;
  input.setAttribute('aria-label', label);
  wrapper.append(input);
  return { wrapper, input };
}

function reviewButton(root, text, disposition) {
  const button = element(root, 'button', null, text);
  button.type = 'button';
  button.dataset.role = 'emp1-engineering-review-action';
  button.dataset.disposition = disposition;
  return button;
}

function appendDefinition(root, list, label, value) {
  const row = element(root, 'div');
  row.append(
    element(root, 'dt', null, label),
    element(root, 'dd', null, value == null ? '—' : human(value)),
  );
  list.append(row);
}

function human(value) {
  return String(value ?? 'UNRESOLVED').replaceAll('_', ' ');
}
