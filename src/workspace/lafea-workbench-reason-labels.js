/** Presentation-only labels for canonical LAFEA workbench reason codes. */
const REASON_LABELS = Object.freeze({
  ANALYSIS_DOMAIN_NOT_CURRENT: 'The analysis domain is not current.',
  ANALYSIS_MESH_ABSENT: 'Required analysis mesh evidence is absent.',
  ANALYSIS_MESH_CUSTODY_ABSENT: 'Analysis mesh custody has not been established.',
  ANALYSIS_MESH_EVIDENCE_ABSENT: 'Required analysis mesh evidence is absent.',
  ANALYSIS_MESH_QUALITY_BLOCK: 'The retained analysis mesh is blocked by quality checks.',
  ANALYSIS_MESH_WARNING_REVIEW_REQUIRED: 'Review the retained mesh warning before authorization.',
  ANALYSIS_PROFILE_BINDING_REQUIRED: 'Bind a valid analysis profile before continuing.',
  BOUNDARY_CONDITIONS_REQUIRED: 'Define the required restraints or boundary conditions.',
  CANONICAL_AUTHORIZATION_NOT_READY: 'Canonical analysis authorization is not ready.',
  CANONICAL_MODEL_NOT_CURRENT: 'The canonical analysis model is not current.',
  CANONICAL_SOLVER_MODEL_NOT_COMPILED: 'The canonical solver model has not been compiled.',
  CANONICAL_SOLVER_MODEL_NOT_CURRENT: 'The canonical solver model is not current.',
  CONVERGENCE_DOMAIN_STALE: 'The retained convergence study belongs to a different analysis domain. Re-run convergence.',
  CONVERGENCE_GEOMETRY_STALE: 'The retained convergence study belongs to different analysis geometry. Re-run convergence.',
  CONVERGENCE_LIFECYCLE_CUSTODY_STALE: 'The retained convergence evidence is not current in lifecycle custody. Re-run or re-establish the study.',
  CONVERGENCE_POINTWISE_ACCEPTANCE_INELIGIBLE: 'The selected physical point is not eligible for pointwise convergence acceptance.',
  CONVERGENCE_SOURCE_STALE: 'The retained convergence study belongs to a different source revision. Re-run convergence.',
  CONVERGENCE_STUDY_NOT_RUN: 'Run a governed three-level convergence study before publishing Results.',
  EXECUTION_NOT_RUN: 'The analysis has not been run.',
  EXECUTION_REQUIRED: 'Run a qualified analysis before viewing governed results.',
  LAFEA3_CONVERGENCE_NOT_CURRENT_AND_QUALIFIED: 'Results remain blocked until LAFEA.3 convergence evidence is current and qualified.',
  LAFEA_CONTINUUM_SOLVER_SOURCE_PARENT_STALE: 'The retained domain, geometry, or mesh belongs to a different source revision. Re-prepare the analysis from the current source.',
  LAFEA_CONTINUUM_SOLVER_DOMAIN_PARENT_STALE: 'The retained geometry or mesh belongs to a different analysis-domain revision. Re-prepare the domain and mesh.',
  LAFEA_CONTINUUM_SOLVER_GEOMETRY_PARENT_STALE: 'The retained mesh belongs to a different analysis-geometry revision. Regenerate or re-adopt the mesh from the current geometry.',
  LAFEA_CONTINUUM_SOLVER_MESH_NOT_CURRENT_PASS: 'The retained mesh is not a current qualified mesh for solve. Regenerate, re-adopt, or resolve its quality block.',
  LAFEA_CONTINUUM_SOLVER_SOURCE_BINDING_NOT_CURRENT: 'The source binding is not current. Re-establish source authority before solving.',
  LAFEA_CONTINUUM_DOMAIN_FIRST_PREFLIGHT_ABSENT: 'Solve evidence has not been prepared yet. Open Meshing and discretization, then choose "Check solve readiness".',
  LAFEA_CONTINUUM_PREFLIGHT_SOURCE_STALE: 'The prepared solve evidence belongs to an earlier source revision. Choose "Check solve readiness" again to re-prepare it.',
  LAFEA_PREPARATION_NOT_AUTHORIZED: 'Preparation evidence is not authorized for solve.',
  LAFEA_RENDER_DISPLAY_GEOMETRY_HASH_MISMATCH: 'The display geometry belongs to a different analysis revision. Regenerate the view from the current geometry.',
  LAFEA_RENDER_DISPLAY_GEOMETRY_PROFILE_MISSING: 'No display-geometry profile is bound for this stage, so results cannot be drawn.',
  LAFEA_RENDER_LIFECYCLE_BINDING_NOT_SUPPLIED: 'The analysis is not bound to a lifecycle, so there is nothing to display yet.',
  LAFEA_RENDER_LIFECYCLE_BINDING_STALE: 'The lifecycle binding is stale. Re-establish current source authority before results can be displayed.',
  LAFEA_RENDER_LIFECYCLE_BINDING_UNINITIALIZED: 'Lifecycle authority has not been initialized for this source document.',
  LAFEA_RENDER_LIFECYCLE_MESH_NOT_QUALIFIED: 'The retained mesh is not qualified, so qualified results cannot be displayed.',
  LAFEA_RENDER_LIFECYCLE_NOT_SUPPLIED: 'No analysis lifecycle is active. Load a source model to begin.',
  LAFEA_RENDER_LIFECYCLE_PROFILE_MISMATCH: 'The active lifecycle profile does not match this stage.',
  LAFEA_RENDER_LIFECYCLE_RESULT_NOT_READY: 'No qualified result is available to display yet. Run the analysis first.',
  LAFEA_RENDER_LIFECYCLE_STAGE_MISMATCH: 'The active lifecycle belongs to a different analysis stage.',
  LAFEA_RENDER_PACKET_NOT_SUPPLIED: 'No result data has been produced yet, so there is nothing to draw.',
  LAFEA_RENDER_PACKET_SCENE_REVISION_MISMATCH: 'The result data belongs to an earlier view revision. Re-run or refresh the analysis.',
  LAFEA_RENDER_PACKET_STAGE_MISMATCH: 'The result data belongs to a different analysis stage.',
  LAFEA_RENDER_PROFILE_HASH_MISMATCH: 'The result data was produced against a different stage profile.',
  LAFEA_RENDER_PROFILE_MISSING: 'No lifecycle profile is bound for this stage.',
  LAFEA_RENDER_PROFILE_NOT_MESH_RESULT_AUTHORIZED: 'This stage does not display mesh-based results.',
  LAFEA_RENDER_SOURCE_HASH_MISMATCH: 'The result data belongs to a different source revision. Re-run the analysis from the current source.',
  LAFEA_RENDER_STAGE_ENGINE_NOT_IMPLEMENTED: 'The analysis engine for this stage is not implemented, so no result can be displayed.',
  LAFEA_PREPARATION_PROJECTION_ABSENT: 'Preparation evidence has not been established.',
  LIFECYCLE_NOT_INITIALIZED: 'Initialize lifecycle authority for the source document.',
  LIFECYCLE_SOURCE_BINDING_STALE: 'The lifecycle source binding is stale; re-establish current source authority.',
  LOAD_CASES_REQUIRED: 'Define at least one governed load or physical case.',
  MATERIALS_REQUIRED: 'Define at least one governed material or section basis.',
  RELEASE_NOT_QUALIFIED: 'Release qualification has not been established.',
  RELEASE_RECORD_ABSENT: 'No authoritative template release record is bound to this analysis.',
  RELEASE_RECORD_CANDIDATE_HEAD_STALE: 'The release record was qualified for a different repository candidate head.',
  RELEASE_RECORD_CANDIDATE_HEAD_UNAVAILABLE: 'The running workbench has no exact candidate-head identity, so release remains blocked.',
  RELEASE_RECORD_COMPOSITION_STALE: 'The release record does not match the current stage composition.',
  RELEASE_RECORD_DOCUMENT_REVISION_STALE: 'The release record belongs to a different source-document revision.',
  RELEASE_RECORD_EVIDENCE_NOT_AUTHORIZED: 'The release record evidence hash is not authorized by the host release trust anchor.',
  RELEASE_RECORD_INVALID: 'The supplied release record failed its integrity contract.',
  RELEASE_RECORD_LIFECYCLE_BINDING_NOT_CURRENT: 'The lifecycle/source binding is not current for this release record.',
  RELEASE_RECORD_LIFECYCLE_NOT_INITIALIZED: 'Initialize lifecycle authority before binding release evidence.',
  RELEASE_RECORD_LIFECYCLE_PROFILE_STALE: 'The release record lifecycle profile does not match the current stage.',
  RELEASE_RECORD_NOT_QUALIFIED: 'The bound release record is not release-qualified.',
  RELEASE_RECORD_SOURCE_AUTHORITY_ABSENT: 'Current cryptographic source authority is required before release can be bound.',
  RELEASE_RECORD_SOURCE_AUTHORITY_CONTRACT_STALE: 'The release record source-authority contract is not current.',
  RELEASE_RECORD_SOURCE_AUTHORITY_HASH_STALE: 'The release record is bound to a different source-authority artifact.',
  RELEASE_RECORD_SOURCE_HASH_STALE: 'The release record is bound to a different engineering source hash.',
  RELEASE_RECORD_STAGE_REGISTRY_STALE: 'The release record was qualified against a different stage-registry identity.',
  RELEASE_RECORD_TARGET_COMPATIBILITY_BLOCKED: 'Current target compatibility does not authorize this release record.',
  RELEASE_RECORD_TARGET_COMPATIBILITY_STALE: 'The release record no longer matches the current target stage, composition, profile, unit, product, mesh, or benchmark authority.',
  RELEASE_RECORD_TARGET_STAGE_MISMATCH: 'The release record targets a different LAFEA stage.',
  RELEASE_RECORD_TRUST_ANCHOR_UNAVAILABLE: 'No trusted release-evidence hash is configured for this workbench build.',
  RELEASE_RECORD_VALIDITY_NOT_CURRENT: 'The bound release record is not currently valid.',
  RESULT_EVIDENCE_NOT_CURRENT: 'Result evidence is not current for the active analysis.',
  SOURCE_AUTHORITY_REQUIRED: 'Current source authority is required.',
  SOURCE_DOCUMENT_ABSENT: 'Import or create a valid source document.',
  SOURCE_DOCUMENT_REQUIRED: 'Import or create a valid source document.',
  STAGE_ENGINE_NOT_IMPLEMENTED: 'The analysis engine for this stage is not implemented.',
  UNSUPPORTED_STAGE_ENGINE_NOT_IMPLEMENTED: 'Calculation is not implemented for this analysis stage.',
  WORKFLOW_INPUT_CONTRACT_NOT_DECLARED: 'This workflow input contract has not been declared for the active stage.',
  WORKFLOW_STEP_NOT_APPLICABLE: 'This workflow step is not applicable to the active analysis stage.',
});

export function lafeaWorkbenchReasonLabel(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Additional engineering evidence is required.';
  return REASON_LABELS[value] ?? fallbackLabel(value);
}

export function lafeaWorkbenchReasonLabels(values) {
  if (!Array.isArray(values)) return [];
  return values.filter(Boolean).map(lafeaWorkbenchReasonLabel);
}

function fallbackLabel(value) {
  const text = value
    .replace(/^LAFEA_/u, '')
    .replaceAll('_', ' ')
    .toLowerCase();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
