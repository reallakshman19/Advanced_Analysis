import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TOPOLOGY_EDIT_CONTEXTUAL_OPERATION_MIGRATIONS,
  TOPOLOGY_EDIT_PIPE_GEOMETRY_OPERATIONS,
  renderTopologyEditProfessionalOperationPanel,
  topologyEditProfessionalOperationUiDisposition,
} from '../src/workspace/viewport-productivity/topology-edit-professional-operation-panel.js';

const RETIRED = ['INSERT_INLINE_COMPONENT', 'RECONNECT_ENDPOINTS'];
const REMAINING = [
  'EXTEND_EDGE',
  'SHORTEN_EDGE',
  'SPLIT_EDGE_FROM_DISTANCE',
  'MOVE_CONNECTED_RUN',
  'CREATE_ORTHOGONAL_OFFSET',
  'APPLY_DECLARED_SLOPE',
];

test('Pipe geometry exposes only non-duplicated engineering operations', () => {
  assert.deepEqual(
    TOPOLOGY_EDIT_PIPE_GEOMETRY_OPERATIONS.map(([operationType]) => operationType),
    REMAINING,
  );
  for (const operationType of RETIRED) {
    assert.equal(
      TOPOLOGY_EDIT_PIPE_GEOMETRY_OPERATIONS.some(([id]) => id === operationType),
      false,
    );
  }
  assert.equal(
    TOPOLOGY_EDIT_CONTEXTUAL_OPERATION_MIGRATIONS.INSERT_INLINE_COMPONENT.destination,
    'Place component',
  );
  assert.equal(
    TOPOLOGY_EDIT_CONTEXTUAL_OPERATION_MIGRATIONS.RECONNECT_ENDPOINTS.destination,
    'Connect ends',
  );
});

test('ordinary pipe geometry operation remains selectable and planner-neutral', () => {
  const disposition = topologyEditProfessionalOperationUiDisposition('EXTEND_EDGE');
  assert.deepEqual(disposition, {
    operationType: 'EXTEND_EDGE',
    selectable: true,
    migration: null,
  });
  const element = { innerHTML: '' };
  renderTopologyEditProfessionalOperationPanel(element, {
    values: { operationType: 'EXTEND_EDGE' },
    operationCapabilities: {},
  });
  assert.match(element.innerHTML, /<strong>Pipe geometry<\/strong>/u);
  assert.match(element.innerHTML, /value="EXTEND_EDGE"/u);
  assert.doesNotMatch(element.innerHTML, /value="INSERT_INLINE_COMPONENT"/u);
  assert.doesNotMatch(element.innerHTML, /value="RECONNECT_ENDPOINTS"/u);
  assert.doesNotMatch(element.innerHTML, /professional-center-distance-mm/u);
  assert.doesNotMatch(element.innerHTML, /professional-insertion-length-mm/u);
  assert.doesNotMatch(element.innerHTML, /professional-inline-direction/u);
  assert.doesNotMatch(element.innerHTML, /professional-catalogue-record/u);
});

for (const [operationType, destination] of [
  ['INSERT_INLINE_COMPONENT', 'Place component'],
  ['RECONNECT_ENDPOINTS', 'Connect ends'],
]) {
  test(`saved ${operationType} view fails closed and points to ${destination}`, () => {
    const disposition = topologyEditProfessionalOperationUiDisposition(operationType);
    assert.equal(disposition.selectable, false);
    assert.equal(disposition.migration.destination, destination);

    const element = { innerHTML: '' };
    renderTopologyEditProfessionalOperationPanel(element, {
      values: { operationType },
      operationCapabilities: {},
      capability: { status: 'AVAILABLE', reasonCode: 'AVAILABLE', reason: 'available' },
    });
    assert.match(element.innerHTML, new RegExp(`Moved to ${destination}`, 'u'));
    assert.match(
      element.innerHTML,
      new RegExp(`value="${operationType}" selected disabled`, 'u'),
    );
    assert.match(
      element.innerHTML,
      /data-action="plan-professional-operation" disabled/u,
    );
  });
}

test('unknown restored operation is also non-selectable rather than planner-executable', () => {
  const disposition = topologyEditProfessionalOperationUiDisposition('FUTURE_UNKNOWN');
  assert.equal(disposition.selectable, false);
  assert.equal(disposition.migration, null);
  const element = { innerHTML: '' };
  renderTopologyEditProfessionalOperationPanel(element, {
    values: { operationType: 'FUTURE_UNKNOWN' },
    operationCapabilities: {},
    capability: { status: 'AVAILABLE', reasonCode: 'AVAILABLE', reason: 'available' },
  });
  assert.match(element.innerHTML, /FUTURE_UNKNOWN — unavailable in Pipe geometry/u);
  assert.match(element.innerHTML, /data-action="plan-professional-operation" disabled/u);
});
