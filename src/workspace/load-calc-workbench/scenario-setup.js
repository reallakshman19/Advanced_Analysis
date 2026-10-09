import { buildSjsonEmpiricalPipingRequest } from '../engineering-loads/adapters/sjson-to-empirical-piping-request.js';
import { requireEmpiricalBeamContactRuntimeProfile } from '../engineering-loads/empirical-beam-contact-runtime-profile.js';
import { esc } from '../load-calc-preview-table.js';

/** Import scenario/profile/case inputs only. Source authorities always come from current owners. */
export function buildWorkbenchScenarioProposal(value, authorities) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join(',') !== 'caseConfigurations,runtimeProfile,scenario') {
    throw new Error('Expected exactly scenario, runtimeProfile and caseConfigurations. Workspace authorities cannot be imported here.');
  }
  const runtimeProfile = requireEmpiricalBeamContactRuntimeProfile(value.runtimeProfile);
  const adaptedRequest = buildSjsonEmpiricalPipingRequest({
    dataset: authorities.dataset, sharedModel: authorities.sharedModel,
    topologyGraph: authorities.topologyGraph,
    supportAttachmentModel: authorities.supportAttachmentModel,
    restraintCapabilityModel: authorities.restraintCapabilityModel,
    scenario: value.scenario,
  });
  return { adaptedRequest, runtimeProfile, caseConfigurations: value.caseConfigurations,
    sharedModel: authorities.sharedModel, topologyGraph: authorities.topologyGraph,
    supportAttachmentModel: authorities.supportAttachmentModel,
    restraintCapabilityModel: authorities.restraintCapabilityModel,
    sourceLoadPrimitiveSet: authorities.sourceLoadPrimitiveSet };
}

export function renderScenarioSetup(container, authorities, snapshot, draft = '', feedback = '') {
  const bindings = { datasetHash: authorities.dataset?.sourceSha256
    ? `sha256:${authorities.dataset.sourceSha256}` : null,
    sharedModelHash: authorities.sharedModel?.semanticHash || null,
    topologyHash: authorities.topologyGraph?.semanticHash || null,
    attachmentHash: authorities.supportAttachmentModel?.semanticHash || null,
    restraintHash: authorities.restraintCapabilityModel?.semanticHash || null,
    loadPrimitiveSetHash: authorities.sourceLoadPrimitiveSet?.semanticHash || null };
  container.innerHTML = `<section data-workbench-scenario-setup><h3>Configure the existing calculation scenario</h3>
    <p>Current scenario: ${esc(snapshot.state)}. Gravity can run separately. Fa, Fl and global moments require
    a method-compatible reviewed profile, restraint directions and load cases; missing values are not zero.</p>
    <ol><li>Inspect current source restraints and load primitives below.</li>
    <li>Supply a reviewed scenario, runtimeProfile and caseConfigurations JSON package, with current source bindings.</li>
    <li>Configure, review the existing Methods blockers, then seal, authorize and calculate through the existing owners.</li></ol>
    <p>Weight-only OD/wall/density approvals do not qualify stiffness wall, elastic modulus, thermal expansion,
    axes or tolerances. Importing a profile does not promote its qualification or auto-authorize a run.</p>
    <details><summary>Current source bindings & restraint/load evidence</summary><pre>${esc(JSON.stringify({ bindings,
      restraintCapabilityModel: authorities.restraintCapabilityModel,
      sourceLoadPrimitiveSet: authorities.sourceLoadPrimitiveSet }, null, 2))}</pre></details>
    <label>Reviewed scenario input JSON<textarea data-workbench-scenario-json rows="12" style="display:block;width:100%;box-sizing:border-box" placeholder='{"scenario":{…},"runtimeProfile":{…},"caseConfigurations":[…]}'>${esc(draft)}</textarea></label>
    <p role="status" data-workbench-scenario-feedback>${esc(feedback)}</p>
    <button type="button" data-workbench-scenario-configure>Validate & configure reviewed scenario</button>
    <button type="button" data-load-calc-tab="restraints">Restraints</button>
    <button type="button" data-load-calc-tab="load-cases">Load cases</button>
    <button type="button" data-load-calc-tab="methods">Methods & authorization</button>
    <button type="button" data-load-calc-tab="preflight">Input Check & seal readiness</button></section>`;
}
