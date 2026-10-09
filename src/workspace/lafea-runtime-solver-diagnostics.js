/** Read-only diagnostics projected from the actual authoritative continuum result. */
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
export const LAFEA_RUNTIME_SOLVER_DIAGNOSTICS_SCHEMA = 'lafea-runtime-solver-diagnostics/v1';

export function projectLafeaRuntimeSolverDiagnostics(execution) {
  const result = execution?.result; if (!result) return null;
  const loadCases = (result.loadCaseResults ?? []).map((row) => {
    const s = row.solverEvidence ?? {}, free = row.freeDofResiduals ?? [], reactions = row.reactions ?? [];
    return Object.freeze({
      loadCaseId: row.loadCaseId ?? null,
      dofCount: free.length + reactions.length, freeDofCount: free.length,
      constrainedDofCount: reactions.length, reactionCount: reactions.length,
      method: s.method ?? null, preconditioner: s.preconditioner ?? null,
      iterations: Number.isInteger(s.iterations) ? s.iterations : null,
      iterationLimit: Number.isInteger(s.iterationLimit) ? s.iterationLimit : null,
      initialResidualInfinity: num(s.initialResidualInfinity), finalResidualInfinity: num(s.finalResidualInfinity),
      convergenceTarget: num(s.convergenceTarget), residualTolerance: num(s.residualTolerance), pivotRatio: num(s.pivotRatio),
      freeDofResidualInfinity: maxAbs(free.map((x) => x?.value)), accepted: s.accepted === true && row.equilibrium?.accepted === true,
      equilibrium: row.equilibrium ? structuredClone(row.equilibrium) : null,
    });
  });
  const body = { schema: LAFEA_RUNTIME_SOLVER_DIAGNOSTICS_SCHEMA, stageId: execution.stageId ?? 'LAFEA.3', executionHash: execution.compiledExecutionHash ?? null, solverModelHash: execution.solverModelHash ?? null, storageRoute: result.meshEvidence?.globalStiffnessStorage ?? (Array.isArray(result.meshEvidence?.globalStiffnessMatrix) ? 'DENSE' : null), loadCases, methods: [...new Set(loadCases.map((x) => x.method).filter(Boolean))].sort(), terminationState: execution.status === 'QUALIFIED' ? 'CONVERGED' : 'REJECTED', progressPolicy: 'REAL_MILESTONES_ONLY_NO_PERCENTAGE', releaseQualified: false };
  return Object.freeze({ ...body, semanticHash: canonicalLafeaSha256({ schema: 'lafea-runtime-solver-diagnostics-hash-input/v1', diagnostics: body }) });
}
function num(value) { return Number.isFinite(value) ? value : null; }
function maxAbs(values) { const finite = values.filter(Number.isFinite).map(Math.abs); return finite.length ? Math.max(...finite) : null; }
