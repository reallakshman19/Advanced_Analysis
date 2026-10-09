import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
export const LAFEA_BC_LOAD_GLYPH_PROJECTION_SCHEMA = 'lafea-bc-load-glyph-projection/v1';

/** Engineering glyph identities derived only from the exact canonical input passed to the kernel. */
export function projectLafeaContinuumBcLoadGlyphs(execution, loadCaseId = null) {
  const input = execution?.canonicalInput;
  if (!input || !execution?.canonicalExecutionInputHash) throw new TypeError('LAFEA_BC_LOAD_GLYPH_CANONICAL_INPUT_REQUIRED');
  const cases = loadCaseId === null ? input.loadCases : input.loadCases.filter((row) => row.loadCaseId === loadCaseId);
  if (loadCaseId !== null && cases.length !== 1) throw new TypeError('LAFEA_BC_LOAD_GLYPH_LOAD_CASE_NOT_FOUND');
  const glyphs = [];
  for (const row of input.constraints ?? []) glyphs.push(glyph('RESTRAINT', row.constraintId, null, row.nodeId, null, { dof: row.dof, value: row.value }, row.sourceReference));
  for (const loadCase of cases) {
    for (const row of loadCase.imposedDisplacements ?? []) glyphs.push(glyph('IMPOSED_DISPLACEMENT', row.imposedDisplacementId, loadCase.loadCaseId, row.nodeId, null, { dof: row.dof, value: row.value }, row.sourceReference));
    for (const row of loadCase.nodalForces ?? []) glyphs.push(glyph('NODAL_FORCE', row.loadId, loadCase.loadCaseId, row.nodeId, null, { fx: row.fx, fy: row.fy }, row.sourceReference));
    for (const row of loadCase.edgeTractions ?? []) glyphs.push(glyph('EDGE_TRACTION', row.tractionId, loadCase.loadCaseId, null, row.elementId, { edgeNodeIds: row.edgeNodeIds, tx: row.tx, ty: row.ty }, row.sourceReference));
    for (const row of loadCase.pressureLoads ?? []) glyphs.push(glyph('PRESSURE', row.pressureLoadId, loadCase.loadCaseId, null, row.elementId, { edgeNodeIds: row.edgeNodeIds, pressure: row.pressure }, row.sourceReference));
    for (const row of loadCase.bodyForces ?? []) glyphs.push(glyph('BODY_FORCE', row.bodyForceId, loadCase.loadCaseId, null, row.elementId, { bx: row.bx, by: row.by }, row.sourceReference));
  }
  const body = { schema: LAFEA_BC_LOAD_GLYPH_PROJECTION_SCHEMA, stageId: execution.stageId,
    executionHash: execution.compiledExecutionHash, canonicalExecutionInputHash: execution.canonicalExecutionInputHash,
    loadCaseId, coordinateFrame: 'GLOBAL_XY', units: structuredClone(input.units), glyphs };
  return Object.freeze({ ...body, semanticHash: canonicalLafeaSha256({ schema: 'lafea-bc-load-glyph-projection-hash-input/v1', projection: body }) });
}
function glyph(kind, id, loadCaseId, nodeId, elementId, payload, sourceReference) {
  return Object.freeze({ kind, glyphId: `${kind}/${loadCaseId ?? 'ALL'}/${id}`, loadCaseId, nodeId, elementId,
    payload: Object.freeze(structuredClone(payload)), sourceReference: sourceReference ?? null, authority: 'CANONICAL_EXECUTION_INPUT' });
}
