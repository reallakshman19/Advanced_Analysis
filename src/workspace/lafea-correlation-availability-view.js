import { actionButton, card, element } from './lafea-workbench-dom.js';
import {
  createLafeaCorrelationGeometryDeclaration,
  projectLafeaCorrelationGeometry,
} from './lafea-correlation-geometry-declaration.js';
import { lafeaCorrelationProductAvailability } from './lafea-correlation-product.js';

const GEOMETRY_DECLARATIONS_BY_ROOT = new WeakMap();

export function renderLafeaCorrelationAvailability(root, stage) {
  const declaration = GEOMETRY_DECLARATIONS_BY_ROOT.get(root) ?? null;
  const geometryProjection = projectLafeaCorrelationGeometry(stage, declaration);
  const availability = lafeaCorrelationProductAvailability(stage, geometryProjection);
  const panel = card(root, 'Local attachment correlation');
  panel.section.dataset.role = 'lafea-correlation-availability';
  panel.section.dataset.guidedTarget = 'local-attachment-correlation';
  panel.section.dataset.correlationState = availability.state;
  panel.section.dataset.geometryState = geometryProjection.state;

  const status = element(root, 'strong', 'lafea-result-highlights__status', availability.state);
  status.dataset.role = 'lafea-correlation-status';
  panel.body.append(
    status,
    element(root, 'p', 'lafea-workbench__section-intro',
      'Detailed local-attachment correlation is a separate governed extension of LAFEA.2. It may consume only retained LAFEA.2 resultants/pressure evidence, a source-bound attachment geometry, and a trusted qualified engineering method.'),
  );

  const summary = element(root, 'table', 'lafea-result-table');
  summary.append(tableRow(root, 'Registered engineering methods',
    String(availability.registeredMethodCount)));
  summary.append(tableRow(root, 'LAFEA.2 execution',
    availability.sourceEvidence.screeningResultStatus));
  summary.append(tableRow(root, 'LAFEA.2 result qualification',
    availability.sourceEvidence.screeningResultQualification ?? 'NOT AVAILABLE'));
  summary.append(tableRow(root, 'Retained LAFEA.2 result hash',
    availability.sourceEvidence.screeningResultPayloadSemanticHash ?? 'NOT AVAILABLE'));
  summary.append(tableRow(root, 'Attachment geometry state', availability.geometry.state));
  summary.append(tableRow(root, 'Geometry declaration hash',
    availability.geometry.declarationHash ?? 'NOT AVAILABLE'));
  summary.append(tableRow(root, 'Geometry evidence hash',
    availability.geometry.geometryEvidenceHash ?? 'NOT AVAILABLE'));
  panel.body.append(summary, geometryEditor(root, stage, declaration, geometryProjection, panel.section));

  if (availability.reasons.length) {
    const heading = element(root, 'h4', null, 'Engineering blockers');
    const list = element(root, 'ul', 'lafea-result-limitations');
    availability.reasons.forEach((reason) => {
      const item = element(root, 'li', null, reasonLabel(reason));
      item.dataset.correlationBlocker = reason;
      list.append(item);
    });
    panel.body.append(heading, list);
  }

  if (availability.methods.length) {
    const heading = element(root, 'h4', null, 'Qualified engineering methods');
    const table = element(root, 'table', 'lafea-result-table');
    const head = element(root, 'tr');
    ['Method', 'Edition', 'Dataset hash', 'Qualification record', 'Approval authority']
      .forEach((label) => {
        const cell = element(root, 'th', null, label);
        cell.scope = 'col';
        head.append(cell);
      });
    table.append(head);
    availability.methods.forEach((method) => {
      const row = element(root, 'tr');
      const methodCell = element(root, 'th', null, method.methodIdentity);
      methodCell.scope = 'row';
      row.append(
        methodCell,
        element(root, 'td', null, method.methodEdition),
        element(root, 'td', null, method.coefficientDatasetHash),
        element(root, 'td', null, method.qualificationRecordHash),
        element(root, 'td', null, method.approvalAuthorityId),
      );
      table.append(row);
    });
    panel.body.append(heading, table);
  } else {
    panel.body.append(element(
      root,
      'p',
      'lafea-workbench__authority',
      'No local-attachment empirical stress result is authorized. The synthetic coefficient fixture is software-qualification evidence only and is not exposed as an engineering method.',
    ));
  }

  if (availability.nextRequiredInput) {
    panel.body.append(element(root, 'p', 'lafea-workbench__authority',
      `Next governed input: ${availability.nextRequiredInput}.`));
  }
  return panel.section;
}

export function selectLafeaCorrelationGeometryDeclaration(root) {
  return GEOMETRY_DECLARATIONS_BY_ROOT.get(root) ?? null;
}

function geometryEditor(root, stage, declaration, projection, panelSection) {
  const section = element(root, 'section', 'lafea-analysis-settings__group');
  section.dataset.role = 'lafea-correlation-geometry-editor';
  section.dataset.geometryState = projection.state;
  const heading = element(root, 'div', 'lafea-analysis-settings__group-heading');
  heading.append(
    element(root, 'h4', null, 'Source-bound attachment geometry'),
    element(root, 'span', 'lafea-analysis-settings__lock', 'SOURCE'),
  );
  section.append(
    heading,
    element(root, 'p', 'lafea-workbench__section-intro',
      'This declaration is bound to the exact current LAFEA.2 source-document digest. Editing or replacing the LAFEA.2 source makes the declaration stale until it is explicitly rebound. It does not authorize an empirical method.'),
  );

  const form = element(root, 'div', 'lafea-guided-summary');
  const identity = textInput(root, 'Geometry identity', 'lafea-correlation-geometry-identity',
    declaration?.geometryIdentity ?? 'ATTACHMENT-GEOMETRY-1');
  const diameter = textInput(root, 'Attachment diameter (mm)', 'lafea-correlation-attachment-diameter',
    declaration?.attachmentDiameter ?? '');
  diameter.input.inputMode = 'decimal';
  const sourceReference = textInput(root, 'Attachment diameter source reference',
    'lafea-correlation-attachment-source-reference', declaration?.attachmentSourceReference ?? '');
  form.append(identity.wrapper, diameter.wrapper, sourceReference.wrapper);

  const feedback = element(root, 'output', 'lafea-workbench__authority', geometryStateLabel(projection.state));
  feedback.dataset.role = 'lafea-correlation-geometry-feedback';
  feedback.dataset.geometryState = projection.state;
  const actions = element(root, 'div', 'lafea-guided-summary');
  const bind = actionButton(root, declaration ? 'Rebind geometry to current LAFEA.2 source' : 'Bind geometry to current LAFEA.2 source', () => {
    try {
      const next = createLafeaCorrelationGeometryDeclaration(stage, {
        geometryIdentity: identity.input.value,
        attachmentDiameter: Number(diameter.input.value),
        attachmentSourceReference: sourceReference.input.value,
      });
      GEOMETRY_DECLARATIONS_BY_ROOT.set(root, next);
      rerenderPanel(root, stage, panelSection);
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
      feedback.dataset.geometryState = 'INVALID_INPUT';
    }
  });
  bind.dataset.role = 'lafea-correlation-bind-geometry';
  bind.disabled = !stage.document;
  actions.append(bind);
  if (declaration) {
    const clear = actionButton(root, 'Clear geometry declaration', () => {
      GEOMETRY_DECLARATIONS_BY_ROOT.delete(root);
      rerenderPanel(root, stage, panelSection);
    });
    clear.dataset.role = 'lafea-correlation-clear-geometry';
    actions.append(clear);
  }
  section.append(form, actions, feedback);

  const evidence = element(root, 'table', 'lafea-result-table');
  evidence.append(tableRow(root, 'Bound source document digest',
    projection.boundDocumentDigest ?? 'NOT AVAILABLE'));
  evidence.append(tableRow(root, 'Current source document digest',
    projection.currentDocumentDigest ?? 'NOT AVAILABLE'));
  evidence.append(tableRow(root, 'Geometry evidence hash',
    projection.geometryEvidenceHash ?? 'NOT AVAILABLE'));
  evidence.append(tableRow(root, 'LAFEA.1 canonical model hash',
    projection.geometryEvidence?.foundationModelHash ?? 'NOT AVAILABLE'));
  evidence.append(tableRow(root, 'LAFEA.1 result payload hash',
    projection.geometryEvidence?.foundationResultHash ?? 'NOT AVAILABLE'));
  section.append(evidence);
  return section;
}

function rerenderPanel(root, stage, panelSection) {
  panelSection.replaceWith(renderLafeaCorrelationAvailability(root, stage));
}

function textInput(root, label, role, value) {
  const wrapper = element(root, 'label', 'lafea-guided-summary');
  const labelText = element(root, 'span', null, label);
  const input = element(root, 'input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.value = String(value ?? '');
  input.dataset.role = role;
  wrapper.append(labelText, input);
  return { wrapper, input };
}

function tableRow(root, label, value) {
  const row = element(root, 'tr');
  const key = element(root, 'th', null, label);
  key.scope = 'row';
  row.append(key, element(root, 'td', null, value));
  return row;
}

function geometryStateLabel(state) {
  const labels = {
    ABSENT: 'No source-bound attachment geometry is retained.',
    CURRENT_INPUT_PENDING_RESULT:
      'Geometry declaration is current for this LAFEA.2 source; run LAFEA.2 to reconstruct exact correlation geometry evidence.',
    CURRENT_EVIDENCE:
      'Geometry declaration and reconstructed correlation geometry evidence are current.',
    STALE:
      'Geometry declaration is stale because the LAFEA.2 source changed. Rebind explicitly before correlation use.',
    INVALID: 'Geometry declaration/evidence is invalid and cannot be used.',
  };
  return labels[state] ?? state;
}

function reasonLabel(reason) {
  const labels = {
    NO_ENGINEERING_CORRELATION_PROFILE_REGISTERED:
      'No qualified engineering correlation method/edition is registered.',
    QUALIFIED_LAFEA2_RESULT_REQUIRED:
      'Run and qualify the current LAFEA.2 nominal screening result before local-correlation custody can be established.',
    LAFEA2_RESULT_HASH_REQUIRED:
      'The qualified LAFEA.2 result is missing its retained payload semantic hash.',
    SOURCE_BOUND_ATTACHMENT_GEOMETRY_REQUIRED:
      'Declare attachment geometry identity, diameter and source reference and bind it to the current LAFEA.2 source.',
    ATTACHMENT_GEOMETRY_SOURCE_STALE:
      'The retained attachment geometry belongs to an earlier LAFEA.2 source and must be explicitly rebound.',
    ATTACHMENT_GEOMETRY_INVALID:
      'The retained attachment geometry declaration or reconstructed evidence is invalid.',
    ATTACHMENT_GEOMETRY_EVIDENCE_REQUIRED:
      'Current correlation geometry evidence could not be reconstructed from the qualified LAFEA.2 result.',
  };
  return labels[reason] ?? reason;
}
