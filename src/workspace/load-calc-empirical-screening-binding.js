import { semanticHash } from '../core/shared-piping-model/canonical-json.js';
import { freezeDeep } from './dataset-utils.js';
import { calculateSupportLoadScreeningTerms, DEFAULT_SUPPORT_LOAD_PROFILE } from '../calc-workspace/supportLoadEngine.js';

/** Read-only screening binding. No nearest-pipe lookup, approval or gravity mutation. */
export function buildAutomaticEmpiricalScreening(references, distribution, context = {}) {
  const { dataset, commonState, execution, supportSiteModel, routePartitionModel, lineList } = context;
  const common = commonState?.commonInput;
  const failure = currentnessFailure(context, distribution);
  const tableBinding = lineList ? semanticHash({ sourceHash: lineList.sourceHash || null,
    fieldMap: lineList.fieldMap || {}, rows: lineList.normalizedRows || [] }) : null;
  const rows = references.map(ref => {
    const row = { ...ref, tags: [...(ref.tags || [])], pipeId: null, lineKey: null, matchMethod: null, candidatePipeIds: [],
      inputs: { outsideDiameterMm: null, wallThicknessMm: null, temperatureC: null },
      provenance: {}, reasons: [], terms: null, status: 'UNRESOLVED' };
    if (failure) { row.reasons.push(failure); return row; }
    const sites = (supportSiteModel.sites || []).filter(site => site.siteId === ref.supportSiteId);
    if (sites.length !== 1) { row.reasons.push('Support-site identity is missing or ambiguous.'); return row; }
    const site = sites[0];
    const candidates = physicalPipeCandidates(site, dataset, routePartitionModel);
    row.candidatePipeIds = candidates.map(candidate => candidate.entityId);
    if (candidates.length !== 1) {
      row.reasons.push(candidates.length ? 'Multiple physical straight pipes meet this site; no pipe is chosen.'
        : 'No exact route-local physical straight pipe meets this site.');
      return row;
    }
    const pipe = candidates[0];
    const sections = common.enrichedModel.components.filter(component => component.componentKey === pipe.entityId);
    row.pipeId = pipe.entityId;
    row.lineKey = pipe.lineKey || pipe.lineId || null;
    row.matchMethod = 'UNIQUE_ROUTE_LOCAL_SEGMENT_WITHIN_EXISTING_PORT_TOLERANCE';
    if (sections.length !== 1 || sections[0].type !== 'PIPE'
      || sections[0].identity?.lineId !== row.lineKey) {
      row.reasons.push('Exact sealed pipe section/line identity is missing or ambiguous.'); return row;
    }
    for (const [inputKey, propertyKey] of [['outsideDiameterMm', 'outerDiameterMm'], ['wallThicknessMm', 'wallThicknessMm']]) {
      const evidence = sections[0].engineeringProperties?.[propertyKey];
      const value = sectionValue(evidence);
      row.inputs[inputKey] = value;
      row.provenance[inputKey] = { basis: 'CURRENT_SEALED_ENRICHED_MODEL', commonInputHash: common.semanticHash,
        componentKey: pipe.entityId, propertyKey, evidence: evidence ? structuredClone(evidence) : null };
      if (value === null) row.reasons.push(`${propertyKey} is missing, invalid or not in mm.`);
    }
    const temperature = operatingTemperature(pipe, lineList, row.lineKey, tableBinding);
    row.inputs.temperatureC = temperature.value;
    row.provenance.temperatureC = temperature.provenance;
    if (temperature.reason) row.reasons.push(temperature.reason);
    row.terms = calculateSupportLoadScreeningTerms({ opeVerticalN: row.opeVerticalN, ...row.inputs }, DEFAULT_SUPPORT_LOAD_PROFILE);
    if (!row.terms.guide || row.terms.lineStopN === null) {
      if (!row.reasons.length) row.reasons.push('Section geometry is invalid for screening.');
    }
    row.status = row.reasons.length ? 'UNRESOLVED' : 'SCREENING_ESTIMATE';
    return row;
  });
  return freezeDeep({ rows, tableBinding, summary: { total: rows.length,
    estimated: rows.filter(row => row.status === 'SCREENING_ESTIMATE').length,
    unresolved: rows.filter(row => row.status !== 'SCREENING_ESTIMATE').length } });
}

function currentnessFailure({ dataset, commonState, execution, supportSiteModel, routePartitionModel }, distribution) {
  const common = commonState?.commonInput;
  if (commonState?.staleness?.stale !== false || commonState.error || !common || !execution)
    return 'Current sealed Common Input and its gravity receipt are required for automatic binding.';
  if (distribution?.freshness?.status !== 'CURRENT' || !dataset?.sharedModel
    || execution.datasetId !== dataset.datasetId || distribution.datasetId !== dataset.datasetId
    || common.sourceModelSemanticHash !== dataset.sharedModel.semanticHash
    || common.sourceDatasetSha256 !== dataset.sourceSha256
    || execution.sourceModelSemanticHash !== common.sourceModelSemanticHash
    || execution.sourceDatasetSha256 !== common.sourceDatasetSha256
    || execution.commonInputSemanticHash !== common.semanticHash
    || execution.distributionSemanticHash !== semanticHash(distribution))
    return 'Dataset, Common Input or gravity receipt binding is stale or mismatched.';
  if (supportSiteModel?.status !== 'READY' || routePartitionModel?.status !== 'READY'
    || supportSiteModel.datasetId !== dataset.datasetId || routePartitionModel.datasetId !== dataset.datasetId
    || execution.supportSiteModelSemanticHash !== materialHash(supportSiteModel)
    || execution.routePartitionModelSemanticHash !== materialHash(routePartitionModel))
    return 'Support-site or route authority does not match the current gravity receipt.';
  return null;
}

function materialHash(value) {
  const { semanticHash: declared, ...material } = value;
  const computed = semanticHash(material);
  return declared && declared !== computed ? null : computed;
}

function physicalPipeCandidates(site, dataset, model) {
  const tolerance = model.portMatchToleranceMm;
  if (!Number.isFinite(tolerance) || tolerance < 0) return [];
  const ids = new Set();
  const routes = model.routes.filter(route => route.status === 'READY' && site.branchIds.includes(route.branchId));
  if (new Set(routes.map(route => route.routeId)).size !== routes.length) return [];
  for (const route of routes) for (const id of route.physicalEdgeIds || []) ids.add(id);
  return dataset.entities.filter(pipe => ids.has(pipe.entityId) && pipe.entityType === 'PIPE'
    && model.edges.filter(edge => edge.entityId === pipe.entityId).length === 1
    && model.edges.some(edge => edge.entityId === pipe.entityId && edge.physical === true
      && !edge.topologyCarrier && !edge.pointComponent && edge.lengthMm > 0
      && site.branchIds.includes(edge.branchId) && onSegment(site.positionMm, edge.startMm, edge.endMm, tolerance)))
    .sort((left, right) => left.entityId.localeCompare(right.entityId));
}

function onSegment(point, start, end, tolerance) {
  if (![point, start, end].every(p => p && ['x', 'y', 'z'].every(axis => Number.isFinite(p[axis])))) return false;
  const axes = ['x', 'y', 'z'];
  const delta = axes.map(axis => end[axis] - start[axis]);
  const length2 = delta.reduce((sum, value) => sum + value ** 2, 0);
  if (length2 <= 0) return false;
  const ratio = Math.max(0, Math.min(1, axes.reduce((sum, axis, i) => sum + (point[axis] - start[axis]) * delta[i], 0) / length2));
  return Math.hypot(...axes.map((axis, i) => point[axis] - start[axis] - ratio * delta[i])) <= tolerance;
}

function sectionValue(evidence) {
  return evidence?.unit === 'mm' && !/BLOCKED|STALE|CONFLICT|MISSING/.test(evidence.status || '')
    && typeof evidence.value === 'number' && Number.isFinite(evidence.value) && evidence.value > 0 ? evidence.value : null;
}

/** Mapping semantics, not t1/t2 ordinal: design, tracing and ambiguous columns never become OPE. */
function operatingTemperature(pipe, master, lineKey, bindingHash) {
  const explicit = ['OPERATING_TEMPERATURE_C', 'OP_TEMP_C'];
  const sources = [pipe.properties?.sourceAttributes, pipe.properties?.attributes];
  const values = sources.flatMap((source, i) => explicit.filter(key => Object.hasOwn(source || {}, key))
    .map(key => ({ value: numeric(source[key]), path: `${i ? 'attributes' : 'sourceAttributes'}.${key}` })));
  if (values.length) {
    const value = values[0].value;
    return value !== null && values.every(row => row.value === value)
      ? { value, provenance: { basis: 'SOURCE_EXPLICIT_OPERATING_CELSIUS', pipeId: pipe.entityId, paths: values.map(row => row.path) } }
      : { value: null, provenance: { basis: 'SOURCE_EXPLICIT_OPERATING_CELSIUS', paths: values.map(row => row.path) }, reason: 'Explicit source operating temperature is invalid or conflicting.' };
  }
  const reason = message => ({ value: null, provenance: { basis: 'CURRENT_MAPPED_LINE_LIST', lineKey, bindingHash }, reason: message });
  if (!lineKey || !master?.sourceHash) return reason('Hashed current line-list source is unavailable.');
  const rows = (master.normalizedRows || []).filter(row => String(row.lineKey || '').trim().toUpperCase() === String(lineKey).trim().toUpperCase());
  if (rows.length !== 1) return reason(rows.length ? 'Exact line key has multiple line-list rows.' : 'Exact full line key has no line-list row.');
  const columns = Object.entries(master.fieldMap || {}).filter(([key, header]) => ['t1', 't2', 't3'].includes(key)
    && /(?:working|operating|operation|\bop\.?\s*temp)/i.test(header) && /temp/i.test(header)
    && !/(?:design|tracing|minimum|maximum|\bmin\b|\bmax\b)/i.test(header)
    && /(?:[°º]\s*C|degC|celsius|temp(?:erature)?\.?\s*(?:\[|\()?C(?:\]|\))?\s*$)/i.test(header));
  if (columns.length !== 1) return reason('A unique mapped operating-temperature column explicitly in Celsius is required.');
  const [key, header] = columns[0];
  const row = rows[0];
  const value = numeric(row[key]);
  const raw = row._sourceProvenance?.[header];
  if (raw === undefined || value === null || numeric(raw) !== value) return reason('Mapped operating temperature is missing, invalid or differs from its source cell.');
  return { value, provenance: { basis: 'CURRENT_MAPPED_LINE_LIST_NOT_GRAVITY_SEAL', lineKey,
    fileName: master.fileName, sheet: row._sourceSheet || master.sheetName,
    rowNumber: row._sourceRowNumber, canonicalField: key, header, sourceValue: raw,
    sourceHash: master.sourceHash, bindingHash } };
}

function numeric(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
