/**
 * Private typed-form renderer for governed StageInputDescriptor/v2 fields.
 *
 * The renderer consumes declared descriptors and exact entity identities only.
 * It does not discover arbitrary fields or use array position as authority.
 */
import {
  resolveLafeaDescriptorSourceRef,
  resolveLafeaDescriptorUnit,
} from './lafea-stage-input-descriptors.js';
import { collectDeclaredGovernedMatrices } from './lafea-governed-matrix-presentation.js';
import {
  displayLafeaNumeric,
  firstLafeaEditDiagnostic,
  friendlyLafeaName,
  groupLafeaDescriptors,
  lafeaDescriptorInstances,
  lafeaDescriptorPath,
  lafeaGetAtPath,
  lafeaInputIdentity,
} from './lafea-document-table-support.js';

export function renderLafeaDescriptorForm({
  documentRef,
  container,
  stageId,
  documentValue,
  descriptors,
  onSetScalar,
  onSetScalarBatch = null,
  batchScalarEdits = false,
}) {
  if (!descriptors.length) {
    const blocked = documentRef.createElement('p');
    blocked.className = 'lafea-workbench-svg__empty';
    blocked.textContent = `${stageId} has no governed editable fields.`;
    container.append(blocked);
    return;
  }

  const groups = groupLafeaDescriptors(descriptors);
  for (const [groupId, rows] of groups) {
    const section = documentRef.createElement('section');
    section.className = 'lafea-doc-table-section';
    section.dataset.inputGroup = groupId;
    const title = documentRef.createElement('h4');
    title.textContent = friendlyLafeaName(groupId);
    section.append(title);

    const entityDescriptors = rows.filter(
      (descriptor) => descriptor.valueContract.domainType === 'ENTITY',
    );
    const scalarDescriptors = rows.filter(
      (descriptor) => descriptor.valueContract.domainType === 'NUMBER',
    );
    entityDescriptors.forEach((descriptor) => {
      // When the group's own table already lists every instance of this
      // collection in its identity column, the register is a second copy of the
      // same identities. Keep it reachable, but out of the primary scroll.
      const duplicated = scalarDescriptors.some(
        (scalar) => scalar.target?.collectionPath === descriptor.target?.collectionPath
          && scalar.target?.identityKey === descriptor.target?.identityKey,
      );
      section.append(
        renderIdentityRegister(documentRef, documentValue, descriptor, duplicated),
      );
    });

    if (scalarDescriptors.length) {
      section.append(renderScalarTable({
        documentRef,
        stageId,
        documentValue,
        groupId,
        descriptors: scalarDescriptors,
        onSetScalar,
        onSetScalarBatch,
        batchScalarEdits,
      }));
    }
    container.append(section);
  }
}

function renderScalarTable({
  documentRef,
  stageId,
  documentValue,
  groupId,
  descriptors,
  onSetScalar,
  onSetScalarBatch,
  batchScalarEdits,
}) {
  const wrapper = documentRef.createElement('div');
  wrapper.className = 'lafea-doc-group-editor';
  wrapper.dataset.inputGroup = groupId;
  const table = documentRef.createElement('table');
  table.className = 'lafea-doc-grid lafea-doc-grid--governed';

  // Batch groups may present existing governed descriptors as one identity row with
  // N value columns, but only when every descriptor in the group belongs to a
  // complete compatible family. Pressure uses an explicit declaration; existing
  // X/Y/Z vectors retain their conservative complete-triple detection and are
  // adapted into the same row renderer. Any partial/mixed family falls back to the
  // scalar table rather than reshaping on a guess.
  const matrixPresentation = batchScalarEdits
    ? collectRenderableMatrixPresentation(descriptors)
    : null;
  const header = documentRef.createElement('tr');
  const headings = matrixPresentation
    ? [
      'Engineering identity',
      ...matrixPresentation.columnLabels,
      'Unit',
      'Source/status',
    ]
    : ['Engineering identity', 'Input', 'Unit', 'Source/status'];
  if (!batchScalarEdits) headings.push('Action');
  headings.forEach((label) => {
    const cell = documentRef.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    header.append(cell);
  });
  table.append(header);

  if (matrixPresentation) {
    const emitted = new Set();
    descriptors.forEach((descriptor) => {
      const matrix = matrixPresentation.byDescriptor.get(descriptor.descriptorId);
      if (!matrix || emitted.has(matrix.familyId)) return;
      emitted.add(matrix.familyId);
      lafeaDescriptorInstances(documentValue, matrix.columns[0].descriptor)
        .forEach((instance) => {
          table.append(renderMatrixRow({
            documentRef,
            stageId,
            documentValue,
            matrix,
            instance,
          }));
        });
    });
  } else {
    descriptors.forEach((descriptor) => {
      lafeaDescriptorInstances(documentValue, descriptor)
        .forEach((instance) => {
          table.append(renderScalarRow({
            documentRef,
            stageId,
            documentValue,
            descriptor,
            instance,
            onSetScalar,
            batchScalarEdits,
          }));
        });
    });
  }

  wrapper.append(table);
  if (batchScalarEdits) {
    wrapper.append(renderGroupAction({
      documentRef,
      wrapper,
      groupId,
      onSetScalarBatch,
    }));
  }
  return wrapper;
}

function renderGroupAction({ documentRef, wrapper, groupId, onSetScalarBatch }) {
  const action = documentRef.createElement('div');
  action.className = 'lafea-doc-group-action';
  const output = documentRef.createElement('output');
  output.dataset.role = 'lafea-group-edit-status';
  output.setAttribute('aria-live', 'polite');
  const apply = documentRef.createElement('button');
  apply.type = 'button';
  apply.dataset.role = 'lafea-apply-group';
  apply.dataset.inputGroup = groupId;
  apply.textContent = `Apply ${friendlyLafeaName(groupId)} changes`;
  apply.disabled = true;

  const updateButton = () => {
    apply.disabled = !wrapper.querySelector('[data-role="lafea-governed-input"][data-dirty="true"]');
  };
  wrapper.addEventListener('input', updateButton);
  apply.addEventListener('click', () => {
    const inputs = [...wrapper.querySelectorAll(
      '[data-role="lafea-governed-input"][data-dirty="true"]',
    )];
    if (!inputs.length) return;
    for (const input of inputs) {
      input.reportValidity();
      if (!input.checkValidity()) {
        input.focus();
        return;
      }
    }
    const edits = inputs.map((input) => ({
      descriptorId: input.dataset.descriptorId,
      entityId: input.dataset.entityId || null,
      rawText: input.value,
    }));
    const returned = onSetScalarBatch(edits);
    const diagnostic = firstLafeaEditDiagnostic(returned);
    output.textContent = diagnostic?.message ?? `${edits.length} governed change${edits.length === 1 ? '' : 's'} applied.`;
  });
  action.append(apply, output);
  return action;
}

function renderIdentityRegister(documentRef, documentValue, descriptor, collapsed = false) {
  const wrapper = documentRef.createElement(collapsed ? 'details' : 'div');
  wrapper.className = 'lafea-doc-identity-register';
  const heading = documentRef.createElement(collapsed ? 'summary' : 'h5');
  heading.textContent = descriptor.presentation.label;
  const note = documentRef.createElement('p');
  note.textContent = 'Exact engineering identities. Creation and deletion require governed entity commands; array position is not authority.';
  const list = documentRef.createElement('ul');
  const rows = lafeaGetAtPath(
    documentValue,
    descriptor.target.collectionPath,
  );
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const item = documentRef.createElement('li');
    const identity = row?.[descriptor.target.identityKey];
    item.textContent = typeof identity === 'string'
      ? identity
      : 'BLOCKED — MISSING IDENTITY';
    item.dataset.entityId = typeof identity === 'string' ? identity : '';
    list.append(item);
  });
  wrapper.append(heading, note, list);
  return wrapper;
}

const VECTOR_AXES = Object.freeze(['X', 'Y', 'Z']);
/**
 * A vector family collapses to one identity row only when it is complete for its
 * own dimensionality: exactly X/Y for a planar quantity such as a LAFEA.3 node,
 * or exactly X/Y/Z for a spatial one. A partial family (X alone, or X and Z)
 * falls back to scalar rows rather than reshaping on a guess.
 */
const VECTOR_AXIS_SETS = Object.freeze([
  Object.freeze(['X', 'Y', 'Z']),
  Object.freeze(['X', 'Y']),
]);

function completeVectorAxes(entry) {
  const present = VECTOR_AXES.filter((axis) => entry.axes[axis]);
  return VECTOR_AXIS_SETS.find((axes) => axes.length === present.length
    && axes.every((axis) => Boolean(entry.axes[axis]))) ?? null;
}

/**
 * Identify descriptors that are the X/Y/Z components of one vector quantity.
 *
 * `vectorDescriptors` in lafea-stage-input-descriptors.js generates these as a
 * shared id prefix with a `.x`/`.y`/`.z` suffix and a label suffixed by the axis.
 * Both are required to agree here, and only complete triples group, so anything
 * that does not match falls through to the existing per-descriptor rendering
 * rather than being reshaped on a guess.
 *
 * Returns a Map from descriptorId to its triple, for every descriptor in a
 * complete triple.
 */
export function collectVectorTriples(descriptors) {
  const candidates = new Map();
  descriptors.forEach((descriptor) => {
    const match = /^(?<group>.+)\.(?<axis>[xyz])$/u.exec(descriptor.descriptorId);
    if (!match) return;
    const axis = match.groups.axis.toUpperCase();
    const label = descriptor.presentation?.label ?? '';
    if (!label.endsWith(` ${axis}`)) return;
    const groupKey = match.groups.group;
    const entry = candidates.get(groupKey)
      ?? { groupKey, axes: {}, label: label.slice(0, -2) };
    entry.axes[axis] = descriptor;
    candidates.set(groupKey, entry);
  });

  const triples = new Map();
  candidates.forEach((entry) => {
    const axes = completeVectorAxes(entry);
    if (!axes) return;
    entry.orderedAxes = axes;
    axes.forEach((axis) => triples.set(entry.axes[axis].descriptorId, entry));
  });
  return triples;
}

/**
 * Group scalar descriptors that address the same collection under the same
 * identity key, so an entity is one row and each governed property is a column
 * instead of each property being its own full-width row. Descriptor order is
 * preserved as column order. Descriptors without a collection target, or whose
 * target is incomplete, are not grouped.
 */
export function collectCollectionFamilies(descriptors) {
  const families = new Map();
  descriptors.forEach((descriptor) => {
    const collectionPath = descriptor.target?.collectionPath;
    const identityKey = descriptor.target?.identityKey;
    if (typeof collectionPath !== 'string' || typeof identityKey !== 'string') return;
    const familyId = `${collectionPath}#${identityKey}`;
    const entry = families.get(familyId) ?? { familyId, collectionPath, identityKey, members: [] };
    entry.members.push(descriptor);
    families.set(familyId, entry);
  });
  return families;
}

/**
 * Build one conservative matrix presentation for a complete batch group.
 *
 * Declared matrices are already compatibility-checked by their presentation
 * registry. Complete X/Y/Z triples are converted to the same renderer shape.
 * A group is matrix-rendered only when every descriptor is covered and all
 * families have the same ordered columns; mixed/incomplete groups fall back.
 */
export function collectRenderableMatrixPresentation(descriptors) {
  const byDescriptor = new Map(collectDeclaredGovernedMatrices(descriptors));
  const vectorMatrices = new Map();
  const vectorTriples = collectVectorTriples(descriptors);
  vectorTriples.forEach((triple, descriptorId) => {
    if (byDescriptor.has(descriptorId)) return;
    let matrix = vectorMatrices.get(triple.groupKey);
    if (!matrix) {
      const basis = triple.axes.X;
      matrix = Object.freeze({
        familyId: triple.groupKey,
        rowLabel: triple.label,
        legacyVector: true,
        target: Object.freeze({
          collectionPath: basis.target.collectionPath,
          identityKey: basis.target.identityKey,
        }),
        columns: Object.freeze(triple.orderedAxes.map((axis) => Object.freeze({
          columnId: axis,
          label: axis,
          descriptor: triple.axes[axis],
        }))),
      });
      vectorMatrices.set(triple.groupKey, matrix);
    }
    byDescriptor.set(descriptorId, matrix);
  });

  collectCollectionFamilies(descriptors).forEach((family) => {
    if (family.members.some((member) => byDescriptor.has(member.descriptorId))) return;
    const matrix = Object.freeze({
      familyId: family.familyId,
      rowLabel: family.members[0].presentation?.label ?? family.collectionPath,
      legacyVector: false,
      target: Object.freeze({
        collectionPath: family.collectionPath,
        identityKey: family.identityKey,
      }),
      columns: Object.freeze(family.members.map((member) => Object.freeze({
        columnId: member.descriptorId,
        label: member.presentation?.label ?? member.descriptorId,
        descriptor: member,
      }))),
    });
    family.members.forEach((member) => byDescriptor.set(member.descriptorId, matrix));
  });

  if (!descriptors.length || byDescriptor.size !== descriptors.length) return null;
  if (!descriptors.every((descriptor) => byDescriptor.has(descriptor.descriptorId))) return null;

  const matrices = [...new Map(
    descriptors.map((descriptor) => {
      const matrix = byDescriptor.get(descriptor.descriptorId);
      return [matrix.familyId, matrix];
    }),
  ).values()];
  if (!matrices.length) return null;

  const signature = matrixColumnSignature(matrices[0]);
  if (!matrices.every((matrix) => matrixColumnSignature(matrix) === signature)) return null;

  return Object.freeze({
    byDescriptor,
    columnLabels: Object.freeze(matrices[0].columns.map((column) => column.label)),
  });
}

function matrixColumnSignature(matrix) {
  return JSON.stringify(matrix.columns.map((column) => [column.columnId, column.label]));
}

/** The governed numeric input for one descriptor instance, shared by both row shapes. */
function buildGovernedInput({ documentRef, stageId, descriptor, instance }) {
  const inputId = lafeaInputIdentity(descriptor, instance.entityId);
  const input = documentRef.createElement('input');
  input.id = inputId;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.dataset.role = 'lafea-governed-input';
  input.dataset.descriptorId = descriptor.descriptorId;
  input.dataset.entityId = instance.entityId ?? '';
  input.value = displayLafeaNumeric(instance.value);
  input.dataset.initialValue = input.value;
  input.dataset.dirty = 'false';
  input.placeholder = instance.state === 'PRESENT_NULL' ? 'null' : '';
  input.setAttribute(
    'aria-label',
    `${descriptor.presentation.label} ${instance.entityId ?? stageId}`,
  );
  const state = documentRef.createElement('small');
  state.id = `${inputId}-state`;
  if (['MISSING', 'INVALID_NUMBER', 'PRESENT_NULL'].includes(instance.state)) {
    state.textContent = `State: ${instance.state}`;
    input.setAttribute('aria-describedby', state.id);
  } else {
    state.style.display = 'none';
  }
  input.addEventListener('input', () => {
    validateNumericInput(input, descriptor.valueContract);
    input.dataset.dirty = String(input.value.trim() !== input.dataset.initialValue.trim());
  });
  return { input, state };
}

/**
 * The identity cell. The exact document path stays in the DOM because it is real
 * custody information a reviewer needs, but it is demoted: the engineering label
 * leads, and the path is small, muted and available in full on hover rather than
 * competing with the label on every row.
 */
function buildIdentityCell({
  documentRef,
  stageId,
  descriptor,
  instance,
  labelText,
  pathText = null,
}) {
  const cell = documentRef.createElement('th');
  cell.scope = 'row';
  const label = documentRef.createElement('strong');
  label.textContent = labelText ?? descriptor.presentation.label;
  const identity = documentRef.createElement('code');
  identity.textContent = instance.entityId ?? stageId;
  identity.className = 'lafea-doc-identity';
  const path = documentRef.createElement('code');
  path.textContent = pathText ?? lafeaDescriptorPath(descriptor, instance.entityId);
  path.className = 'lafea-doc-path';
  path.title = path.textContent;
  cell.append(label, identity, path);
  return cell;
}

/** One row carrying all declared governed columns for a single engineering identity. */
function renderMatrixRow({ documentRef, stageId, documentValue, matrix, instance }) {
  const row = documentRef.createElement('tr');
  row.dataset.matrixGroup = matrix.familyId;
  if (matrix.legacyVector) row.dataset.vectorGroup = matrix.familyId;
  if (instance.entityId) row.dataset.rowId = instance.entityId;

  row.append(buildIdentityCell({
    documentRef,
    stageId,
    descriptor: matrix.columns[0].descriptor,
    instance,
    labelText: matrix.rowLabel,
    pathText: matrixIdentityPath(matrix, instance.entityId),
  }));

  matrix.columns.forEach((column) => {
    const descriptor = column.descriptor;
    const columnInstance = lafeaDescriptorInstances(documentValue, descriptor)
      .find((candidate) => candidate.entityId === instance.entityId) ?? instance;
    const cell = documentRef.createElement('td');
    cell.dataset.matrixColumn = column.columnId;
    if (matrix.legacyVector) cell.dataset.vectorAxis = column.columnId;
    const sourceRef = descriptorSourceRef(
      documentValue,
      descriptor,
      columnInstance.entityId,
    );
    cell.dataset.sourceRef = sourceRef ?? '';
    const { input, state } = buildGovernedInput({
      documentRef, stageId, descriptor, instance: columnInstance,
    });
    cell.append(input, state);
    row.append(cell);
  });

  const unitCell = documentRef.createElement('td');
  const unit = resolveLafeaDescriptorUnit(documentValue, matrix.columns[0].descriptor);
  unitCell.textContent = unit ?? matrix.columns[0].descriptor.unitContract.dimension ?? '—';
  row.append(unitCell);

  row.append(buildMatrixSourceCell({
    documentRef,
    documentValue,
    matrix,
    entityId: instance.entityId,
  }));
  return row;
}

function matrixIdentityPath(matrix, entityId) {
  if (matrix.legacyVector) {
    return lafeaDescriptorPath(matrix.columns[0].descriptor, entityId);
  }
  return `${matrix.target.collectionPath}[${matrix.target.identityKey}=${entityId}]`;
}

/** Source pointers remain independently visible for every matrix value column. */
function buildMatrixSourceCell({ documentRef, documentValue, matrix, entityId }) {
  const cell = documentRef.createElement('td');
  const entries = matrix.columns.map((column) => ({
    label: column.label,
    sourceRef: descriptorSourceRef(documentValue, column.descriptor, entityId),
    sourceStatus: column.descriptor.authority.sourceStatus,
  }));
  const oneSharedSource = entries.every((entry) => (
    entry.sourceRef === entries[0].sourceRef
    && entry.sourceStatus === entries[0].sourceStatus
  ));

  if (oneSharedSource) {
    appendSourceEntry(documentRef, cell, null, entries[0]);
    return cell;
  }
  entries.forEach((entry) => appendSourceEntry(documentRef, cell, entry.label, entry));
  return cell;
}

function appendSourceEntry(documentRef, cell, label, entry) {
  const wrapper = documentRef.createElement('div');
  if (label) {
    const heading = documentRef.createElement('strong');
    heading.textContent = `${label}: `;
    wrapper.append(heading);
  }
  const source = documentRef.createElement('code');
  source.textContent = entry.sourceRef ?? '—';
  const sourceStatus = documentRef.createElement('small');
  sourceStatus.textContent = entry.sourceStatus;
  sourceStatus.style.display = 'block';
  wrapper.append(source, sourceStatus);
  cell.append(wrapper);
}

/** Source pointer and retained-source status for one descriptor instance. */
function buildSourceCell({ documentRef, documentValue, descriptor, instance }) {
  const cell = documentRef.createElement('td');
  const sourceRef = descriptorSourceRef(documentValue, descriptor, instance.entityId);
  const source = documentRef.createElement('code');
  source.textContent = sourceRef ?? '—';
  const sourceStatus = documentRef.createElement('small');
  sourceStatus.textContent = descriptor.authority.sourceStatus;
  sourceStatus.style.display = 'block';
  cell.append(source, sourceStatus);
  return cell;
}

function descriptorSourceRef(documentValue, descriptor, entityId) {
  try {
    return resolveLafeaDescriptorSourceRef(documentValue, descriptor, entityId);
  } catch {
    return null;
  }
}

function renderScalarRow({
  documentRef,
  stageId,
  documentValue,
  descriptor,
  instance,
  onSetScalar,
  batchScalarEdits,
}) {
  const row = documentRef.createElement('tr');
  row.dataset.descriptorId = descriptor.descriptorId;
  if (instance.entityId) row.dataset.rowId = instance.entityId;

  const identityCell = buildIdentityCell({ documentRef, stageId, descriptor, instance });

  const inputCell = documentRef.createElement('td');
  const { input, state } = buildGovernedInput({ documentRef, stageId, descriptor, instance });
  inputCell.append(input, state);

  const unitCell = documentRef.createElement('td');
  const unit = resolveLafeaDescriptorUnit(documentValue, descriptor);
  unitCell.textContent = unit ?? descriptor.unitContract.dimension ?? '—';

  const sourceCell = buildSourceCell({ documentRef, documentValue, descriptor, instance });

  row.append(identityCell, inputCell, unitCell, sourceCell);
  if (!batchScalarEdits) {
    const actionCell = documentRef.createElement('td');
    const apply = documentRef.createElement('button');
    apply.type = 'button';
    apply.textContent = 'Apply';
    apply.dataset.role = 'lafea-apply-descriptor';
    apply.addEventListener('click', () => {
      validateNumericInput(input, descriptor.valueContract);
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }
      const returned = onSetScalar(
        descriptor.descriptorId,
        instance.entityId,
        input.value,
      );
      const diagnostic = firstLafeaEditDiagnostic(returned);
      if (diagnostic) {
        input.setCustomValidity(diagnostic.message);
        input.setAttribute('aria-invalid', 'true');
        input.reportValidity();
      }
    });
    actionCell.append(apply);
    row.append(actionCell);
  }
  return row;
}

function validateNumericInput(input, contract) {
  input.setCustomValidity('');
  const text = input.value.trim();
  if (text !== '') {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      input.setCustomValidity('Must be a finite number');
    } else if (contract.minimum !== null
      && (contract.minimumExclusive ? parsed <= contract.minimum : parsed < contract.minimum)) {
      input.setCustomValidity(
        `Value must be ${contract.minimumExclusive ? '>' : '>='} ${contract.minimum}`,
      );
    } else if (contract.maximum !== null
      && (contract.maximumExclusive ? parsed >= contract.maximum : parsed > contract.maximum)) {
      input.setCustomValidity(
        `Value must be ${contract.maximumExclusive ? '<' : '<='} ${contract.maximum}`,
      );
    }
  }
  input.setAttribute('aria-invalid', input.checkValidity() ? 'false' : 'true');
}
