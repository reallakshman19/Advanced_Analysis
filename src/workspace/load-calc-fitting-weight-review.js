import { formatValveHint, rankXmlCiiWeightCandidates } from '../calc-workspace/cii-standalone-port/core/weight-valve-hints.js';
import { nonFeaEnrichmentStore } from './enrichment/non-fea-enrichment-store.js';

/**
 * Builds reviewable component-weight candidates for catalogue fittings, using
 * the same ranking logic as the XML->CII standalone Weight Match phase.
 *
 * Bore and rating alone do not identify a fitting: at DN150 900# the master
 * offers ten rows spanning 26 kg to 538 kg. Face-to-face length narrows that
 * (measured from each component's own arrive/leave positions), and DTXR
 * keyword scoring decides the rest: "GATE VALVE FLGD 900#" ranks "Flanged
 * Gate Valve" above every other 610 mm candidate because the description
 * says GATE, not because it happens to sort first. Passing dtxr into the
 * ranking context is what engages that scoring -- omitting it, as an
 * earlier version of this module did, left the ranker choosing among
 * same-length rows with no semantic signal at all, and it chose wrong.
 *
 * The pre-filled weight is therefore the ranker's best pick, not blank. It
 * remains editable, every candidate is shown with its rank reason, and
 * nothing is written until a reviewer explicitly applies it -- a confident
 * automatic ranking is still a proposal, not an acceptance.
 */

/** Catalogue fittings: types the weights master can describe. */
const CATALOGUE_FITTING_TYPES = Object.freeze(['FLAN', 'FLANGE', 'VALV', 'VALVE', 'INST', 'INSTRUMENT']);

const DEFAULT_LENGTH_TOLERANCE_MM = 4;

export function buildFittingWeightReviewRows({ dataset, masters, acceptedRecords } = {}) {
  const sourceModel = dataset?.sharedModel;
  if (!sourceModel) throw new TypeError('Fitting weight review requires an active dataset shared model.');
  const weightRows = masters?.weight?.normalizedRows || [];
  const rawByEntityId = new Map((dataset.entities || []).map((entity) => [entity.entityId, entity]));
  const config = {
    weight: {
      masterRows: weightRows.map((row) => row._sourceProvenance || row),
      lengthToleranceMm: DEFAULT_LENGTH_TOLERANCE_MM,
      masterLengthUnit: 'raw',
    },
  };

  const records = acceptedRecords ?? nonFeaEnrichmentStore.getSnapshot()?.acceptedRecords ?? [];
  const acceptedWeightIds = new Set(
    records
      .filter((r) => r.fieldId === 'COMPONENT_WEIGHT')
      .map((r) => r.selectorKey)
  );

  const rows = [];
  (sourceModel.components || []).forEach((component) => {
    const type = String(component.type || '').trim().toUpperCase();
    if (!CATALOGUE_FITTING_TYPES.includes(type)) return;
    if (component.engineeringProperties?.componentWeightKg != null) return;
    const targetId = component.componentKey || component.sourceEntityId;
    if (acceptedWeightIds.has(targetId)) return;
    const attributes = rawByEntityId.get(component.sourceEntityId)?.properties?.attributes || {};
    const boreMm = numberFrom(attributes.ABORE ?? attributes.LBORE);
    const lengthMm = distanceBetween(attributes.APOS, attributes.LPOS);
    const description = String(attributes.DTXR || '').trim();
    const ratingText = [attributes.DTXR, attributes.SPRE, attributes.NAME, attributes.OWNER].join(' ');
    const rating = ratingFromText(ratingText);

    const base = {
      targetId, type, description, boreMm, lengthMm, rating,
      sourceEntityId: component.sourceEntityId,
    };
    // No bore or no measurable length (e.g. pressure gauge, temperature instrument):
    // auto-resolve to 0 kg — user confirmed "0 kg always for these instruments".
    if (boreMm === null || lengthMm === null) {
      const zeroCandidate = {
        typeDesc: 'No bore / no face-to-face length — instrument',
        weightKg: 0,
        rowLengthMm: null,
        rowBoreMm: null,
        rowRating: rating,
        lengthQualified: false,
        lengthDeltaMm: null,
        tier: 100,
        reason: 'Auto-resolved 0 kg (no bore or no measurable length)',
        rejected: false,
      };
      rows.push({
        ...base,
        candidates: [zeroCandidate],
        valveHint: '',
        bestCandidateIndex: 0,
        clearWinner: true,
        unresolvable: null,
      });
      return;
    }
    let ranking;
    try {
      ranking = rankXmlCiiWeightCandidates(
        { boreMm, rating, lengthMm, dtxr: description, nodeName: description },
        config,
        { includeRejected: true },
      );
    } catch {
      rows.push({ ...base, candidates: [], unresolvable: 'RANKING_FAILED' });
      return;
    }
    const toCandidate = (candidate, rejected) => ({
      typeDesc: candidate.typeDesc || candidate.valveType || 'UNSPECIFIED',
      weightKg: candidate.weight,
      rowLengthMm: candidate.rowLength,
      rowBoreMm: candidate.rowBore,
      rowRating: candidate.rowRating,
      lengthQualified: candidate.lengthQualified === true,
      lengthDeltaMm: Number.isFinite(candidate.rowLength) ? Math.abs(candidate.rowLength - lengthMm) : null,
      tier: candidate.tier ?? candidate.semanticPotentialTier ?? 0,
      reason: candidate.reason || candidate.semanticReason || '',
      rejected,
    });
    const ranked = (ranking.candidates || []).map((candidate) => toCandidate(candidate, false));
    const rejected = (ranking.rejectedCandidates || []).map((candidate) => toCandidate(candidate, true));
    let candidates = [...ranked, ...rejected];
    
    // Auto-resolve zero weight for short fittings (length <= 6mm)
    if (candidates.length === 0 && lengthMm != null && lengthMm <= 6) {
      candidates.push({
        typeDesc: 'No same Bore/Rating master row',
        weightKg: 0,
        rowLengthMm: 0,
        rowBoreMm: boreMm,
        rowRating: rating,
        lengthQualified: true,
        lengthDeltaMm: 0,
        tier: 100,
        reason: 'Auto-resolved 0kg (length \u2264 6mm)',
        rejected: false,
      });
    }
    
    const best = candidates[0] || null;
    // A clear semantic winner is a candidate whose tier leads the runner-up by
    // more than one keyword-priority step; anything closer is left for the
    // reviewer to decide between, not auto-selected under a false label.
    // Also, if length <= 6mm and weight is 0, it does NOT require review (it's a clear winner).
    // If length > 6mm and weight is 0, it DOES require review (force clearWinner to false).
    let clearWinner = Boolean(best) && (
      (candidates.length === 1 && !best.rejected) ||
      (ranked.length > 0 && best.tier > (ranked[1]?.tier ?? -Infinity) + 50)
    );
    
    if (best?.weightKg === 0 && lengthMm > 6) {
      clearWinner = false;
    }

    rows.push({
      ...base,
      candidates,
      valveHint: (ranking?.nodeHint ? formatValveHint(ranking.nodeHint) : ranking?.semanticSource?.label) || '',
      bestCandidateIndex: candidates.length ? 0 : null,
      clearWinner,
      unresolvable: candidates.length === 0 ? 'NO_CANDIDATE' : null,
    });
  });
  return Object.freeze({
    rows: Object.freeze(rows),
    summary: Object.freeze({
      fittingCount: rows.length,
      withCandidates: rows.filter((row) => row.candidates.length > 0).length,
      singleCandidate: rows.filter((row) => row.candidates.length === 1).length,
      clearWinner: rows.filter((row) => row.candidates.length > 1 && row.clearWinner).length,
      needsChoice: rows.filter((row) => row.candidates.length > 1 && !row.clearWinner).length,
      unresolvable: rows.filter((row) => row.unresolvable).length,
      weightMasterRowCount: weightRows.length,
    }),
  });
}

/**
 * The enrichment record for a reviewer's chosen candidate.
 *
 * Records how many candidates were on offer and whether the chosen one was
 * length-qualified, so a single-candidate confirmation stays distinguishable
 * from a judgement call between five.
 */
export function fittingWeightRecordFor(row, candidate, candidateIndex, masters) {
  return {
    recordId: `loadcalc-fitting-weight:${row.targetId}`,
    selectorKind: 'ENTITY',
    selectorKey: row.targetId,
    fieldId: 'COMPONENT_WEIGHT',
    value: candidate.weightKg,
    unit: 'kg',
    authority: 'EXACT_APPROVED_MASTER',
    sourceId: masters?.weight?.fileName || 'weight',
    revision: masters?.weight?.sourceHash || 'NOT_AVAILABLE',
    evidence: {
      matchMode: candidate.lengthQualified ? 'BORE_RATING_LENGTH' : 'BORE_RATING_ONLY',
      selectedTypeDesc: candidate.typeDesc,
      rankReason: candidate.reason || null,
      wasTopRanked: candidateIndex === row.bestCandidateIndex,
      componentDescription: row.description,
      boreMm: row.boreMm,
      rating: row.rating,
      componentLengthMm: row.lengthMm,
      masterRowLengthMm: candidate.rowLengthMm,
      lengthDeltaMm: candidate.lengthDeltaMm,
      lengthToleranceMm: DEFAULT_LENGTH_TOLERANCE_MM,
      candidateCount: row.candidates.length,
      reviewerSelected: true,
      weightMasterSourceHash: masters?.weight?.sourceHash || null,
    },
  };
}

function numberFrom(value) {
  const numeric = Number(String(value ?? '').replace(/[^0-9.]/gu, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function distanceBetween(start, end) {
  if (!start || !end) return null;
  const distance = Math.hypot(
    Number(end.x) - Number(start.x),
    Number(end.y) - Number(start.y),
    Number(end.z) - Number(start.z),
  );
  return Number.isFinite(distance) && distance >= 0 ? Math.round(distance * 1000) / 1000 : null;
}

/** Pressure rating as written in the fitting description, e.g. "900#". */
function ratingFromText(value) {
  const match = /(\d{2,4})\s*#/u.exec(String(value || ''));
  return match ? match[1] : '';
}
