import { formatValveHint, rankXmlCiiWeightCandidates } from '../calc-workspace/cii-standalone-port/core/weight-valve-hints.js';
import { isManualWeightReviewType } from './load-calc-weight-review-scope.js';

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

const DEFAULT_LENGTH_TOLERANCE_MM = 4;

export function buildFittingWeightReviewRows({ dataset, masters } = {}) {
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

  const rows = [];
  (sourceModel.components || []).forEach((component) => {
    const type = String(component.type || '').trim().toUpperCase();
    if (!isManualWeightReviewType(type)) return;
    if (component.engineeringProperties?.componentWeightKg != null) return;
    const targetId = component.componentKey || component.sourceEntityId;
    const attributes = rawByEntityId.get(component.sourceEntityId)?.properties?.attributes || {};
    const boreMm = numberFrom(attributes.ABORE ?? attributes.LBORE);
    const lengthMm = distanceBetween(attributes.APOS, attributes.LPOS);
    const description = String(attributes.DTXR || '').trim();
    const rating = ratingFromText(description)
      || ratingFromText(attributes.SPRE)
      || ratingFromText(attributes.LSTU)
      || ratingFromText(attributes.OWNER);

    const base = {
      targetId, type, description, boreMm, lengthMm, rating,
      sourceSemanticHash: sourceModel.semanticHash,
      sourceEntityId: component.sourceEntityId,
    };
    if (boreMm === null) {
      rows.push({ ...base, candidates: [], unresolvable: 'NO_BORE' });
      return;
    }
    let ranking = null;
    if (lengthMm !== null && lengthMm > 0) {
      try {
        ranking = rankXmlCiiWeightCandidates(
          { boreMm, rating, lengthMm, dtxr: description, nodeName: description },
          config,
          { includeRejected: true },
        );
      } catch {
        ranking = null;
      }
    }
    const toCandidate = (candidate, rejected) => ({
      typeDesc: candidate.typeDesc || candidate.valveType || 'UNSPECIFIED',
      weightKg: candidate.weight,
      rowLengthMm: candidate.rowLength,
      rowBoreMm: candidate.rowBore,
      rowRating: candidate.rowRating,
      lengthQualified: candidate.lengthQualified === true,
      lengthDeltaMm: Number.isFinite(candidate.rowLength) && lengthMm !== null ? Math.abs(candidate.rowLength - lengthMm) : null,
      tier: candidate.tier ?? candidate.semanticPotentialTier ?? 0,
      reason: candidate.reason || candidate.semanticReason || '',
      rejected,
    });
    const ranked = (ranking?.candidates || []).map((candidate) => toCandidate(candidate, false));
    const rejected = (ranking?.rejectedCandidates || []).map((candidate) => toCandidate(candidate, true));
    let candidates = [...ranked, ...rejected];

    // Fallback: match master rows by boreMm and rating for point/zero-length fittings or unranked items
    if (!candidates.length && weightRows.length > 0) {
      const descUpper = `${description} ${type}`.toUpperCase();
      const sameBore = weightRows.filter((r) => Math.abs(Number(r.bore) - boreMm) < 1 && Number(r.weight) > 0);
      const sameRating = rating ? sameBore.filter((r) => String(r.rating) === String(rating)) : sameBore;
      const pool = sameRating.length ? sameRating : sameBore;
      if (pool.length) {
        const scored = pool.map((r) => {
          let score = 0;
          const vt = String(r.valveType || '').toUpperCase();
          if (descUpper.includes('BLIND') && vt.includes('BLIND')) score += 1000;
          if (descUpper.includes('FLAN') && vt.includes('FLAN')) score += 500;
          if (descUpper.includes('GATE') && vt.includes('GATE')) score += 500;
          if (descUpper.includes('BALL') && vt.includes('BALL')) score += 500;
          if (descUpper.includes('GLOBE') && vt.includes('GLOBE')) score += 500;
          if (descUpper.includes('CHECK') && vt.includes('CHECK')) score += 500;
          if (descUpper.includes('CONTROL') && vt.includes('CONTROL')) score += 500;
          if (descUpper.includes('INST') || descUpper.includes('GAUGE') || descUpper.includes('TEMPERATURE')) {
            if (vt.includes('FLAN')) score += 200;
          }
          return { row: r, score };
        });
        scored.sort((a, b) => b.score - a.score || a.row.weight - b.row.weight);
        candidates = scored.slice(0, 5).map(({ row, score }) => ({
          typeDesc: row.valveType || 'FITTING',
          weightKg: Number(row.weight),
          rowLengthMm: Number(row.length) || null,
          rowBoreMm: Number(row.bore),
          rowRating: String(row.rating),
          lengthQualified: false,
          lengthDeltaMm: null,
          tier: score,
          reason: `Matched by Bore DN${row.bore}${row.rating ? ` Rating ${row.rating}#` : ''}`,
          rejected: false,
        }));
      }
    }

    const best = candidates.find((c) => !c.rejected) || candidates[0] || null;
    const rankedOnly = candidates.filter((c) => !c.rejected);
    // A clear semantic winner is a candidate whose tier leads the runner-up by
    // more than one keyword-priority step; anything closer is left for the
    // reviewer to decide between, not auto-selected under a false label.
    const clearWinner = Boolean(best) && (rankedOnly.length === 1 || best.tier > (rankedOnly[1]?.tier ?? -Infinity) + 50);
    const valveHint = ranking ? (formatValveHint(ranking.nodeHint) || ranking.semanticSource?.label || '') : '';
    rows.push({
      ...base,
      candidates,
      valveHint,
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
      sourceSemanticHash: row.sourceSemanticHash,
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
  return Number.isFinite(distance) && distance > 0 ? Math.round(distance * 1000) / 1000 : null;
}

/** Pressure rating as written in the fitting description, e.g. "900#". */
function ratingFromText(value) {
  const match = /(\d{2,4})\s*#/u.exec(String(value || ''));
  return match ? match[1] : '';
}
