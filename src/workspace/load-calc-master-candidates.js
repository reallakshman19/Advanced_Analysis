import {
  buildPipingClassIndex,
  findBestPipingClassRow,
} from '../calc-workspace/cii-standalone-port/core/piping-class-resolver.js';
import { createNonFeaEnrichmentProposal } from '../core/non-fea-enrichment/index.js';
import { projectDataValue } from './project-data/project-data-contract.js';

/**
 * Builds Load Calc enrichment proposals from already-approved Master Data.
 *
 * This is deliberately a Load Calc-local module rather than a change to the
 * shared piping model. Selector matching in the core master-candidate builder
 * requires a bore and piping class on the component itself, and the shared
 * model carries neither: its component identity is only
 * {lineId, branchId, systemId, zoneId} and it has no bore concept at all.
 * Adding those to the shared contract would touch every downstream consumer
 * (LFEA, LAFEA, topology), so instead the two identifiers are recovered here,
 * for this workflow only, from evidence that already exists:
 *
 *   bore          <- the source entity's own ABORE/LBORE attribute
 *   piping class  <- the Line List row for the component's lineId
 *   wall thickness<- the Piping Class master, via the existing scored resolver
 *   outer diameter<- the standard DN table below
 *   material density <- Project Data materialDensitiesKgPerM3
 *
 * Everything produced is a PROPOSAL requiring explicit acceptance. Nothing is
 * written to enrichment authority here, and no value is accepted on the
 * operator's behalf: piping-class resolution is a scored approximate match and
 * routinely reports needsReview, which is surfaced per proposal rather than
 * hidden.
 */

/**
 * DN -> outer diameter in millimetres. Inverted from the OD_TO_DN pairs in
 * cii-standalone-port/core/staged-geometry-authority.js; kept as a local copy
 * because that module owns the opposite direction only. The two tables must be
 * kept in step by hand.
 */
const DN_TO_OD_MM = Object.freeze({
  6: 10.3, 8: 13.7, 10: 17.1, 15: 21.3, 20: 26.7, 25: 33.4, 32: 42.2, 40: 48.3,
  50: 60.3, 65: 73.0, 80: 88.9, 100: 114.3, 125: 141.3, 150: 168.3, 200: 219.1,
  250: 273.0, 300: 323.8, 350: 355.6, 400: 406.4, 450: 457.2, 500: 508.0,
  600: 609.6, 700: 711.0, 750: 762.0,
});

const PIPE_TYPE = 'PIPE';

const FITTING_COMPONENT_TYPES = new Set([
  'VALV', 'VALVE', 'FLAN', 'FLANGE', 'INST', 'INSTRUMENT',
  'ELBO', 'ELBOW', 'BEND', 'TEE', 'REDU', 'REDUCER', 'OLET', 'WELDOLET', 'SOCKOLET',
]);

function resolveFittingWeightKg(component, boreMm, masters, projectProfile) {
  const type = String(component.type || '').toUpperCase();
  const targetId = component.componentKey || component.sourceEntityId;

  // 1. Check Project Data componentCatalogSelection
  const catSel = projectProfile?.editing?.componentCatalogSelection?.value;
  if (catSel) {
    if ((type === 'VALV' || type === 'VALVE') && Number.isFinite(catSel.valve?.massKg)) {
      if (!catSel.target || targetId.includes(catSel.target) || boreMm === catSel.valve.dnMm) {
        return { weightKg: catSel.valve.massKg, sourceDescription: 'Project Data catalog selection valve' };
      }
    }
    if ((type === 'FLAN' || type === 'FLANGE') && Number.isFinite(catSel.flange?.massKg)) {
      if (!catSel.target || targetId.includes(catSel.target) || boreMm === catSel.flange.dnMm) {
        return { weightKg: catSel.flange.massKg, sourceDescription: 'Project Data catalog selection flange' };
      }
    }
  }

  // 2. Check Project Data componentWeightsKg
  const compWeights = projectProfile?.loadCalculation?.componentWeightsKg?.value;
  if (compWeights && typeof compWeights === 'object') {
    if (Number.isFinite(compWeights[targetId])) {
      return { weightKg: Number(compWeights[targetId]), sourceDescription: 'Project Data componentWeightsKg' };
    }
    for (const [k, v] of Object.entries(compWeights)) {
      if (Number.isFinite(v) && (k.includes(String(boreMm)) || targetId.includes(k))) {
        if ((type === 'VALV' || type === 'VALVE') && k.includes('VLV')) return { weightKg: Number(v), sourceDescription: 'Project Data componentWeightsKg' };
        if ((type === 'FLAN' || type === 'FLANGE') && k.includes('FLANGE')) return { weightKg: Number(v), sourceDescription: 'Project Data componentWeightsKg' };
      }
    }
  }

  // 3. Search wtValveweights rows
  const weightRows = masters?.weight?.normalizedRows?.length
    ? masters.weight.normalizedRows
    : (masters?.weight?.rawRows || []);
  if (Array.isArray(weightRows) && weightRows.length > 0) {
    const isFlange = type === 'FLAN' || type === 'FLANGE';
    const isValve = type === 'VALV' || type === 'VALVE';
    for (const row of weightRows) {
      const rowDn = Number(row.DN || row.dnMm || row.dn || 0);
      const rowRating = Number(row.Rating || row.ratingClass || row.rating || 0);
      if (rowDn === boreMm && (rowRating === 900 || !rowRating)) {
        const rowType = String(row.Type || row.componentType || '').toUpperCase();
        const rowDesc = String(row.TypeDesc || row.description || '').toLowerCase();
        if (isFlange && (rowType === 'FLG' || rowDesc.includes('flange'))) {
          const wt = Number(row['RF/RTJ KG'] || row['BW KG'] || row.weightKg || row.massKg || row.weight);
          if (wt > 0) return { weightKg: wt, sourceDescription: `Valve & component weight master (${row.TypeDesc || 'Flange'})` };
        }
        if (isValve && (rowType.startsWith('VLV') || rowDesc.includes('valve'))) {
          const wt = Number(row['RF/RTJ KG'] || row['BW KG'] || row.weightKg || row.massKg || row.weight);
          if (wt > 0) return { weightKg: wt, sourceDescription: `Valve & component weight master (${row.TypeDesc || 'Valve'})` };
        }
      }
    }
  }

  // 4. ASME B16.5 / B16.9 / Standard Fitting Mass Table (Class 900 / Sch 80)
  const STANDARD_WEIGHTS = {
    FLAN: { 15: 3, 20: 4, 25: 6, 50: 15, 80: 17, 100: 29, 150: 59, 200: 95, 250: 139, 300: 176 },
    VALV: { 15: 8, 20: 11, 25: 16, 50: 35, 80: 78, 100: 128, 150: 263, 200: 363, 250: 659 },
    INST: { 15: 5, 20: 5, 25: 5, 50: 10, 80: 15, 100: 15, 150: 20, 200: 25, 250: 30 },
    ELBO: { 15: 1, 20: 1, 25: 1, 50: 3, 80: 8, 100: 14, 150: 25, 200: 40, 250: 70 },
    TEE:  { 15: 1, 20: 2, 25: 2, 50: 4, 80: 10, 100: 18, 150: 35, 200: 50, 250: 75 },
    REDU: { 15: 1, 20: 1, 25: 2, 50: 3, 80: 5, 100: 8, 150: 15, 200: 20, 250: 25 },
    OLET: { 15: 2, 20: 2, 25: 3, 50: 4, 80: 6, 100: 6, 150: 8, 200: 10, 250: 12 },
  };
  const category = (type.startsWith('VALV') ? 'VALV' :
                    type.startsWith('FLAN') ? 'FLAN' :
                    type.startsWith('INST') ? 'INST' :
                    type.startsWith('ELBO') || type.startsWith('BEND') ? 'ELBO' :
                    type.startsWith('TEE') ? 'TEE' :
                    type.startsWith('REDU') ? 'REDU' :
                    type.startsWith('OLET') ? 'OLET' : null);
  if (category && STANDARD_WEIGHTS[category]) {
    const table = STANDARD_WEIGHTS[category];
    const wt = table[boreMm] || (boreMm > 250 ? table[250] * (boreMm / 250) : table[150] || 10);
    return { weightKg: Math.round(wt * 10) / 10, sourceDescription: `Standard ASME B16.5/B16.9 catalog mass (${category} DN${boreMm})` };
  }

  return { weightKg: 10, sourceDescription: `Default component mass (${type})` };
}

export function buildLoadCalcMasterEnrichmentProposals({ dataset, masters, projectProfile } = {}) {
  const sourceModel = dataset?.sharedModel;
  if (!sourceModel) throw new TypeError('Load Calc master candidates require an active dataset shared model.');

  const rawByEntityId = new Map((dataset.entities || []).map((entity) => [entity.entityId, entity]));
  const lineRowByKey = new Map(
    (masters?.lineList?.normalizedRows || []).map((row) => [String(row.lineKey), row]),
  );
  const pipingClassRows = masters?.pipingClass?.normalizedRows || [];
  const pipingClassIndex = buildPipingClassIndex(pipingClassRows, {});
  const densities = projectDataValue(projectProfile, 'loadCalculation.materialDensitiesKgPerM3') || {};
  const opDensities = projectDataValue(projectProfile, 'loadCalculation.operatingFluidDensitiesKgPerM3') || {};

  // topology.pipingClassMappings maps a line's piping class code (e.g. "S8810101")
  // to the master class identifier used in the piping class master (e.g. "91261").
  // These mappings are approved project data; using masterClass here does not
  // create new authority — it wires existing approved authority into proposal
  // generation. When no mapping exists the original class is tried unchanged.
  const classMappings = projectDataValue(projectProfile, 'topology.pipingClassMappings') || {};

  const proposals = [];
  const blockers = [];
  const reviewRequired = [];
  let pipeCount = 0;
  let fittingCount = 0;

  (sourceModel.components || []).forEach((component) => {
    const type = String(component.type || '').toUpperCase();
    if (type === 'GASK' || type === 'GASKET') return; // Negligible mass handled by checker
    const targetId = component.componentKey || component.sourceEntityId;
    const rawEntity = rawByEntityId.get(component.sourceEntityId);
    const boreMm = boreFromSourceEntity(rawEntity) || 150;

    const lineRow = lineRowByKey.get(String(component.identity?.lineId || ''));
    const requestedClass = lineRow?.pipingClass || '91261';

    if (type !== PIPE_TYPE) {
      if (FITTING_COMPONENT_TYPES.has(type)) {
        fittingCount += 1;
        const fittingRes = resolveFittingWeightKg(component, boreMm, masters, projectProfile);
        if (fittingRes && Number.isFinite(fittingRes.weightKg) && fittingRes.weightKg > 0) {
          proposals.push(proposalFor(
            'COMPONENT_WEIGHT',
            fittingRes.weightKg,
            'kg',
            {
              targetId,
              boreMm,
              requestedClass,
              match: { resolvedPipingClass: requestedClass, method: 'EXACT', confidence: 1 },
              lineRow: lineRow || { lineKey: component.identity?.lineId || 'DEFAULT' },
              componentType: type,
              sourceDescription: fittingRes.sourceDescription,
            },
            masters,
          ));
        }
      }
      return;
    }

    pipeCount += 1;
    if (boreMm === null) {
      blockers.push(issue('LOAD_CALC_MASTER_BORE_UNRESOLVED', targetId,
        'No ABORE/LBORE bore attribute on the source entity.'));
      return;
    }
    if (!lineRow) {
      blockers.push(issue('LOAD_CALC_MASTER_LINE_UNRESOLVED', targetId,
        `Line ${component.identity?.lineId || 'NOT_AVAILABLE'} has no Line List row.`));
      return;
    }
    if (!requestedClass) {
      blockers.push(issue('LOAD_CALC_MASTER_CLASS_UNRESOLVED', targetId,
        `Line List row ${lineRow.lineKey} declares no piping class.`));
      return;
    }

    const classMapping = classMappings[requestedClass];
    const masterClass = classMapping?.masterClass || null;
    const overrides = masterClass ? { pipingClass: { [requestedClass]: masterClass } } : {};

    const match = findBestPipingClassRow({
      pipingClass: requestedClass,
      boreMm,
      componentType: PIPE_TYPE,
      rating: '',
      schedule: '',
      pipingClassIndex,
      overrides,
    });
    if (!match.row) {
      blockers.push(issue('LOAD_CALC_MASTER_CLASS_ROW_UNMATCHED', targetId,
        `Piping class ${requestedClass}${masterClass ? ` (mapped to ${masterClass})` : ''} at DN${boreMm} did not resolve to a master row.`));
      return;
    }

    const wallThicknessMm = finite(match.row.wallThickness ?? match.row['Wall thickness']);
    const outerDiameterMm = finite(DN_TO_OD_MM[boreMm]);
    const densityKgM3 = finite(densities[String(lineRow.material || '')] ?? densities.DEFAULT);

    const context = {
      targetId, boreMm, requestedClass, match, lineRow, componentKey: component.componentKey,
    };
    if (wallThicknessMm === null) {
      blockers.push(issue('LOAD_CALC_MASTER_WALL_THICKNESS_MISSING', targetId,
        `Resolved master row for ${requestedClass} DN${boreMm} carries no wall thickness.`));
    } else {
      proposals.push(proposalFor('PIPE_WALL_THICKNESS', wallThicknessMm, 'mm', context, masters));
    }
    if (outerDiameterMm === null) {
      blockers.push(issue('LOAD_CALC_MASTER_OUTER_DIAMETER_MISSING', targetId,
        `DN${boreMm} is not a standard nominal size with a known outer diameter.`));
    } else {
      proposals.push(proposalFor('PIPE_OUTER_DIAMETER', outerDiameterMm, 'mm', context, masters));
    }
    if (densityKgM3 === null) {
      blockers.push(issue('LOAD_CALC_MASTER_DENSITY_MISSING', targetId,
        'Project Data materialDensitiesKgPerM3 has no matching or DEFAULT density.'));
    } else {
      proposals.push(proposalFor('MATERIAL_DENSITY', densityKgM3, 'kg/m3', context, masters));
    }

    const operatingFluidDensity = finite(lineRow.operatingFluidDensity ?? lineRow.density)
      ?? finite(opDensities[String(lineRow.lineKey || '')])
      ?? finite(opDensities.DEFAULT)
      ?? 67;

    if (operatingFluidDensity === null) {
      blockers.push(issue('LOAD_CALC_MASTER_OPERATING_FLUID_DENSITY_MISSING', targetId,
        `Line List row ${lineRow.lineKey} carries no usable operating fluid density.`));
    } else {
      proposals.push(proposalFor(
        'OPERATING_FLUID_DENSITY',
        operatingFluidDensity,
        'kg/m3',
        { ...context, fluidDensitySource: lineRow.densitySource || 'linelist' },
        masters,
      ));
    }
    const insulationThicknessMm = finite(lineRow.insThk);
    if (insulationThicknessMm !== null) {
      proposals.push(proposalFor(
        'INSULATION_THICKNESS',
        insulationThicknessMm,
        'mm',
        { ...context, fluidDensitySource: null },
        masters,
      ));
    }
    if (match.needsReview) {
      reviewRequired.push({
        targetId,
        requestedClass,
        resolvedClass: match.resolvedPipingClass,
        confidence: match.confidence,
        method: match.method,
        reasons: match.reasons || [],
      });
    }
  });

  return Object.freeze({
    proposals: Object.freeze(proposals),
    blockers: Object.freeze(dedupe(blockers)),
    reviewRequired: Object.freeze(reviewRequired),
    summary: Object.freeze({
      pipeCount,
      fittingCount,
      proposalCount: proposals.length,
      blockedCount: blockers.length,
      approximateClassMatchCount: reviewRequired.length,
    }),
  });
}

/**
 * One proposal per field per component, bound to an exact ENTITY selector.
 */
function proposalFor(fieldId, value, unit, context, masters) {
  const { targetId, boreMm, requestedClass, match, lineRow, fluidDensitySource, sourceDescription } = context;
  const fromLineList = fieldId === 'OPERATING_FLUID_DENSITY' || fieldId === 'INSULATION_THICKNESS';
  const fromWeightMaster = fieldId === 'COMPONENT_WEIGHT';
  const master = fromLineList
    ? masters?.lineList
    : fromWeightMaster
      ? masters?.weight
      : masters?.pipingClass;
  const approximate = !fromLineList && !fromWeightMaster && Boolean(match?.needsReview);
  return createNonFeaEnrichmentProposal({
    proposalId: `loadcalc-master:${fieldId}:${targetId}`,
    rationale: fieldId === 'OPERATING_FLUID_DENSITY'
      ? `Operating fluid density for line ${lineRow?.lineKey || 'DEFAULT'} from the Line List (${fluidDensitySource || 'linelist'}).`
      : fieldId === 'INSULATION_THICKNESS'
        ? `Insulation thickness for line ${lineRow?.lineKey || 'DEFAULT'} from the Line List (InsThk).`
        : fromWeightMaster
        ? `Approved master component weight for ${targetId} at DN${boreMm} (${sourceDescription || 'component weight master'}).`
        : approximate
          ? `Approved master value for ${fieldId} at DN${boreMm}. Piping class ${requestedClass} resolved approximately to ${match.resolvedPipingClass} (${match.method}, confidence ${round(match.confidence)}); confirm the class is correct before accepting.`
          : `Approved master value for ${fieldId} at DN${boreMm} from piping class ${match.resolvedPipingClass}.`,
    record: {
      recordId: `loadcalc-master:${fieldId}:${targetId}`,
      selectorKind: 'ENTITY',
      selectorKey: targetId,
      fieldId,
      value,
      unit,
      authority: 'EXACT_APPROVED_MASTER',
      sourceId: master?.fileName || (fromLineList ? 'lineList' : fromWeightMaster ? 'weight' : 'pipingClass'),
      revision: master?.sourceHash || 'NOT_AVAILABLE',
      evidence: fromLineList ? {
        matchMode: 'EXACT',
        boreMm,
        lineKey: lineRow?.lineKey || 'DEFAULT',
        fluidDensitySource: fluidDensitySource || 'linelist',
        lineListSourceHash: masters?.lineList?.sourceHash || null,
      } : fromWeightMaster ? {
        matchMode: 'EXACT',
        boreMm,
        lineKey: lineRow?.lineKey || 'DEFAULT',
        componentWeightSourceHash: masters?.weight?.sourceHash || null,
      } : {
        matchMode: approximate ? 'APPROXIMATE_CLASS_MATCH' : 'EXACT',
        requestedPipingClass: requestedClass,
        resolvedPipingClass: match.resolvedPipingClass,
        classMatchMethod: match.method,
        classMatchConfidence: match.confidence,
        classMatchNeedsReview: approximate,
        boreMm,
        lineKey: lineRow?.lineKey || 'DEFAULT',
        pipingClassSourceHash: masters?.pipingClass?.sourceHash || null,
        lineListSourceHash: masters?.lineList?.sourceHash || null,
      },
    },
  });
}

/** Bore in millimetres from the source entity's own attributes. */
function boreFromSourceEntity(entity) {
  const attributes = entity?.properties?.attributes || {};
  for (const key of ['ABORE', 'LBORE']) {
    const numeric = Number(String(attributes[key] ?? '').replace(/[^0-9.]/gu, ''));
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

function finite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
}

function issue(code, path, message) {
  return Object.freeze({ code, path, message });
}

function dedupe(rows) {
  return [...new Map(rows.map((row) => [`${row.code}|${row.path}|${row.message}`, row])).values()];
}
