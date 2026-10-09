import { card, element } from './lafea-workbench-dom.js';
import { lafeaUiIcon } from './lafea-ui-icons.js';

export function renderLafeaEngineeringEvidenceDrawer(root, sections, benchmarkHost = null) {
  const details = element(root, 'details', 'lafea-engineering-evidence-drawer');
  details.dataset.role = 'lafea-engineering-evidence-drawer';
  details.dataset.guidedTarget = 'engineering-evidence';

  const summary = element(root, 'summary', 'lafea-engineering-evidence-drawer__summary');
  const icon = lafeaUiIcon(root.ownerDocument, 'evidence');
  icon.classList.add('lafea-engineering-evidence-drawer__icon');
  const heading = element(root, 'span', 'lafea-engineering-evidence-drawer__heading');
  heading.append(
    element(root, 'strong', null, 'Engineering evidence'),
    element(root, 'span', null, 'Numerical verification, lineage, governance and qualification output'),
  );
  const count = sections.filter(Boolean).length + (benchmarkHost ? 1 : 0);
  summary.append(
    icon,
    heading,
    element(root, 'span', 'lafea-engineering-evidence-drawer__count', `${count} sections`),
  );

  const body = element(root, 'div', 'lafea-engineering-evidence-drawer__body');
  body.dataset.role = 'lafea-technical-evidence';
  sections.filter(Boolean).forEach((section) => body.append(section));

  if (benchmarkHost) {
    const benchmarkCard = card(root, 'Verification output');
    benchmarkCard.section.dataset.guidedTarget = 'verification';
    benchmarkCard.body.append(
      element(
        root,
        'p',
        null,
        'A rendered verification report or demonstration run is not release qualification. Exact-head benchmark manifests and independent expected values remain required.',
      ),
      benchmarkHost,
    );
    body.append(benchmarkCard.section);
  }

  details.append(summary, body);
  return details;
}

export function revealLafeaGuidedTarget(target) {
  if (!target) return false;
  target.hidden = false;
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
    if (parent.hidden) parent.hidden = false;
  }
  target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  target.querySelector?.('button,input,select,textarea,[tabindex]')?.focus?.({ preventScroll: true });
  return true;
}
