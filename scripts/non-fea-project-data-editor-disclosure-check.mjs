import assert from 'node:assert/strict';
import { renderNonFeaProjectDataViewV2 } from '../src/workspace/project-data/non-fea-project-data-view-v2.js';
import { projectDataStore } from '../src/workspace/project-data/project-data-store.js';

// Rendering/disclosure regression only: no engineering values or approvals edited.
projectDataStore.applyProductDefaults();
const before = projectDataStore.getProfile();
const listeners = new Map();
let rendered;
let notifications = 0;
let editing = false;
const valueInput = { type: 'textarea', dataset: {}, value: before.sourcesAndUnits.lengthUnit.value };
const evidenceInput = { value: JSON.stringify({ ...before.sourcesAndUnits.lengthUnit.evidence, locator: 'Disclosure regression fixture, not source approval' }) };
const approvedInput = { checked: before.sourcesAndUnits.lengthUnit.approved };
const actions = { addEventListener() {} };
const group = { parentElement: null, setAttribute(name, value) { this[name] = value; } };
const valueDisclosure = {
  parentElement: { closest() { return group; } },
  setAttribute(name, value) { this[name] = value; },
};
const input = {
  closest() { return valueDisclosure; },
  scrollIntoView() { this.scrolled = true; },
  focus() { this.focused = true; },
};
const root = {
  dataset: {},
  addEventListener(event, listener) { listeners.set(event, listener); },
  querySelector(selector) {
    if (editing && selector.startsWith('[data-project-value=')) return valueInput;
    if (editing && selector.startsWith('[data-project-evidence=')) return evidenceInput;
    if (editing && selector.startsWith('[data-project-approved=')) return approvedInput;
    return selector.startsWith('[data-project-value=') ? input : actions;
  },
};
renderNonFeaProjectDataViewV2({
  ownerDocument: { createElement() { return root; } },
  replaceChildren(child) { rendered = child; },
}, () => { notifications++; });

assert.equal(rendered, root);
assert.match(root.innerHTML, /<details class="phase2-evidence-cell">\s*<summary[^>]*aria-label="Edit evidence for Length unit"/u);
assert.match(root.innerHTML, /aria-label="Evidence for Length unit"[^>]*data-project-evidence="sourcesAndUnits.lengthUnit"/u);
assert.match(root.innerHTML, /<details class="phase2-value-cell">\s*<summary[^>]*aria-label="Edit value for SJSON source"/u);
assert.match(root.innerHTML, /aria-label="Value for SJSON source"[^>]*data-project-value="sourcesAndUnits.datasetSource"/u);
assert.match(root.innerHTML, /aria-label="Edit evidence for Component operating contained-fluid masses"[^>]*>No evidence<\/summary>/u);
assert.doesNotMatch(root.innerHTML, /phase2-(?:value|evidence)-raw\{[^}]*display:none/u);
assert.doesNotMatch(root.innerHTML, /phase2-(?:value|evidence)-cell:focus-within/u);
listeners.get('click')({ target: { closest() { return { dataset: { projectDataGoto: 'sourcesAndUnits.datasetSource' } }; } } });
assert.equal(valueDisclosure.open, '');
assert.equal(group.open, '');
assert.equal(input.scrolled, true);
assert.equal(input.focused, true);
assert.deepEqual(projectDataStore.getProfile(), before);
assert.equal(notifications, 0);
editing = true;
await listeners.get('change')({ target: {
  dataset: { projectEvidence: 'sourcesAndUnits.lengthUnit' },
  matches() { return false; },
  setCustomValidity(message) { throw new Error(message); },
} });
const after = projectDataStore.getProfile();
assert.equal(after.revision, before.revision + 1);
assert.equal(after.sourcesAndUnits.lengthUnit.value, before.sourcesAndUnits.lengthUnit.value);
assert.equal(after.sourcesAndUnits.lengthUnit.approved, before.sourcesAndUnits.lengthUnit.approved);
assert.deepEqual(after.sourcesAndUnits.lengthUnit.evidence, JSON.parse(evidenceInput.value));
for (const [groupKey, fields] of Object.entries(before)) {
  if (!fields || typeof fields !== 'object') continue;
  for (const [fieldKey, entry] of Object.entries(fields)) {
    if (`${groupKey}.${fieldKey}` !== 'sourcesAndUnits.lengthUnit') assert.deepEqual(after[groupKey][fieldKey], entry);
  }
}
assert.equal(notifications, 1);
console.log('PASS: native value/evidence disclosures, empty evidence editing, nested outstanding-field navigation; opening does not edit data, deliberate changes preserve existing value/approval and other fields. Browser keyboard/change verification is separate.');
