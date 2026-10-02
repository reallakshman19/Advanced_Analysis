import { projectEngineeringLoadSources } from '../../core/model-loads/load-source-projection.js';
import { buildPipingPortTopologyGraph } from '../../core/piping-topology/index.js';
import { projectDataEntry } from '../project-data/project-data-contract.js';
import { buildLoadCalcPreview } from '../load-calc-preview-model.js';

/** Observational adapter; no defaults, proposals, seals or execution writes. */
export function createPreparedReview({ workspace, enrichment, snapshot, status, binding }) {
  const dataset = workspace?.dataset;
  const base = {
    mode: 'prepared', binding, dataset: dataset || { sourceName: 'No active source', entities: [] },
    rows: [], branches: [], diagnostics: [], sourceLengthUnit: dataset?.sharedModel?.units?.length || 'unknown',
    supports: (dataset?.entities || []).filter((entity) => entity.selectionType === 'support'),
    status, requestHash: snapshot?.request?.semanticHash || null,
    reportHash: snapshot?.report?.semanticHash || null,
    checkerMassCoverage: checkerMassCoverage(status),
  };
  const problem = preparationProblem(workspace, enrichment, snapshot, status);
  if (problem) return { ...base, status: null, requestHash: null, reportHash: null,
    checkerMassCoverage: null, unavailable: problem, issueGroups: [
    { id: 'other', title: 'Prepare current inputs', count: 0, detail: problem },
  ] };
  const request = snapshot.request;
  const model = request.enrichedProjection.enrichedModel;
  const projection = projectEngineeringLoadSources(model, buildPipingPortTopologyGraph(model), {
    lengthUnitFallback: projectDataEntry(request.projectDataProfile, 'sourcesAndUnits.lengthUnit'),
  });
  const rows = buildLoadCalcPreview({ components: projection.components, entities: dataset.entities,
    proposals: enrichment.proposals, methodRows: status.commonInput.methodRows });
  return { ...base, rows, sourceLengthUnit: projection.units.sourceLengthUnit,
    lengthUnitAuthority: projection.units.lengthUnitAuthority || null, diagnostics: projection.diagnostics,
    branches: [...new Set(rows.map((row) => row.branchId).filter(Boolean))].sort() };
}

function checkerMassCoverage(status) {
  const rows = (status?.commonInput?.methodRows || []).flatMap((method) =>
    (method.coverageRequirements || []).filter((row) => row.requirementId === 'MASS_COVERAGE'));
  const unique = [...new Map(rows.map((row) => [`${row.covered}/${row.total}`, row])).values()];
  return unique.length === 1 ? { covered: unique[0].covered, total: unique[0].total } : null;
}

function preparationProblem(workspace, enrichment, snapshot, status) {
  if (workspace?.status !== 'ready' || !workspace.dataset?.sharedModel) return 'Import a source dataset in the existing workspace first.';
  if (snapshot?.error) return `Current preparation failed: ${snapshot.error}. Previous effective weights are withheld.`;
  const request = snapshot?.request;
  if (!request?.enrichedProjection?.enrichedModel || !snapshot.report) return 'Current preparation and checker report are required. No previous weights are reused.';
  const sourceHash = workspace.dataset.sharedModel.semanticHash;
  if (enrichment?.stale || enrichment?.currentSourceSemanticHash !== sourceHash
      || request.sourceModel?.semanticHash !== sourceHash
      || request.enrichedProjection.sourceSemanticHash !== sourceHash
      || request.sourceDatasetSha256 !== workspace.dataset.sourceSha256) {
    return 'Source binding changed or accepted evidence is stale. Prepare the current source before reviewing effective weights.';
  }
  if (!request.semanticHash || snapshot.report.requestSemanticHash !== request.semanticHash) {
    return 'Checker report does not belong to this request. Effective weights are withheld.';
  }
  if (status?.commonInput?.reportSemanticHash !== snapshot.report.semanticHash) {
    return 'Workspace checker status does not match the prepared report. Effective weights are withheld.';
  }
  return null;
}
