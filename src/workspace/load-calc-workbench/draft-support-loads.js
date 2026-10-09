import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { requireCurrentGravityReceipt } from './result-evidence.js';
import { scenarioResultsDisplayable } from './results-view.js';
import { supportRestraintRows } from '../topology-edit/support-restraint-family.js';
import { empiricalScreeningReferences } from '../load-calc-empirical-screening.js';
import { buildAutomaticEmpiricalScreening } from '../load-calc-empirical-screening-binding.js';

const calculated = status => ['CALCULATED', 'CALCULATED_WITH_EXCEPTIONS'].includes(status);
const finite = value => Number.isFinite(value) ? value : null;

/** Read-only join by source member/site IDs. No coordinate matching, summation or mechanics. */
export function draftSupportLoadsModel(bundle, draft, canonicalIds = []) {
  const dataset = bundle?.screeningContext?.dataset;
  const canonical = draft?.canonical, base = draft?.baseCanonical;
  const empty = (state, message) => ({ state, message, supports: [] });
  if (!dataset || draft?.dataset !== dataset || !canonical || !base
      || canonical.datasetId !== bundle.datasetId || base.datasetId !== bundle.datasetId
      || !base.canonicalTopologyHash || canonical.sourceHash !== base.sourceHash) {
    return empty('SOURCE_MISMATCH', 'Loads are not linked to this model. Return to Results and send the current loads.');
  }
  if (draft.staleReason || canonical.canonicalTopologyHash !== base.canonicalTopologyHash) {
    return empty('DRAFT_CHANGED', 'Draft geometry has changed. Loads are hidden until the current model is recalculated.');
  }
  let gravityCurrent = false, gravityReceipt = null;
  try {
    gravityReceipt = requireCurrentGravityReceipt(bundle);
    gravityCurrent = semanticHash(bundle.supportSiteModel) === gravityReceipt.supportSiteModelSemanticHash;
  } catch { /* Missing/stale gravity is not a zero reaction. */ }
  const scenarioCurrent = scenarioResultsDisplayable(bundle);
  if (!gravityCurrent && !scenarioCurrent) return empty('RESULTS_UNAVAILABLE', 'Loads are out of date or not calculated. Return to Results and rerun.');
  const selected = new Set(canonicalIds);
  const members = (canonical.supports || []).filter(s => selected.has(s.id)
    || supportRestraintRows(s).some(r => selected.has(r.id || r.restraintId)));
  if (!members.length) return empty('SELECT_SUPPORT', 'Click a support in the model or object tree to see its loads.');
  const ids = new Set(members.flatMap(s => [s.entityId, ...(s.sourceEntityIds || [])]).filter(Boolean));
  const sites = (bundle.supportSiteModel?.sites || []).filter(s => s.memberEntityIds.some(id => ids.has(id)));
  if (!sites.length) return empty('NO_SITE', 'This support has no matching calculated support site. No load is assumed.');
  const screeningRows = gravityCurrent
    ? buildAutomaticEmpiricalScreening(empiricalScreeningReferences(bundle.distribution), bundle.distribution, bundle.screeningContext).rows : [];
  const supports = sites.map(site => ({
    siteId: site.siteId, label: site.tags.join(' / ') || site.primaryEntityId,
    memberEntityIds: [...site.memberEntityIds],
    screening: screeningRows.find(row => row.supportSiteId === site.siteId) || null,
    gravity: gravityCurrent ? (bundle.distribution.loadCases || []).map(loadCase => {
      const result = loadCase.supportResults.find(r => r.supportSiteId === site.siteId);
      const available = result && calculated(result.status);
      return { loadCaseId: loadCase.loadCaseId, status: result?.status || 'NOT_AVAILABLE',
        verticalForceN: available ? finite(result.verticalForceN) : null,
        transferMomentNmm: available ? finite(result.cantileverMomentDemandNmm) : null,
        contributors: available ? (result.contributorIds || []).length : null };
    }) : [],
    scenario: scenarioCurrent ? bundle.overlay.arrows.filter(r => r.supportSiteId === site.siteId).map(r => ({
      loadCaseId: r.loadCaseId, restraintId: r.restraintId, resultClass: r.resultClass,
      contactState: r.contactState, forceN: { ...r.forceN }, momentNm: { ...r.momentNm },
      Fv: finite(r.anchorDecomposition?.componentsN?.rest),
      Fa: finite(r.anchorDecomposition?.componentsN?.lineStop),
      Fl: finite(r.anchorDecomposition?.componentsN?.guide),
    })) : [],
  }));
  return { state: 'CURRENT', message: 'Current calculated loads · read-only', supports,
    gravityExecutionHash: gravityCurrent ? gravityReceipt.semanticHash : null,
    scenarioExecutionHash: scenarioCurrent ? bundle.scenario.execution.semanticHash : null,
    sourceAxisBasis: gravityCurrent ? bundle.distribution.sourceAxisBasis : null,
    forceConvention: scenarioCurrent ? bundle.overlay.forceConvention : null,
    momentConvention: scenarioCurrent ? bundle.overlay.momentConvention : null };
}

export function firstLoadedSupportEntityId(bundle) {
  const siteIds = new Set((bundle.distribution?.loadCases || []).flatMap(c => (c.supportResults || [])
    .filter(r => calculated(r.status) && Number.isFinite(r.verticalForceN) && r.contributorIds?.length).map(r => r.supportSiteId)));
  if (scenarioResultsDisplayable(bundle)) for (const row of bundle.overlay.arrows) siteIds.add(row.supportSiteId);
  return bundle.supportSiteModel?.sites?.find(s => siteIds.has(s.siteId))?.primaryEntityId || null;
}
