import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { freezeDeep, stringValue } from '../dataset-utils.js';
import {
  EMPIRICAL_COMPONENT_COG_CLASSIFICATION,
  auditEmpiricalComponentLoadAuthority,
} from './empirical-component-load-authority.js';
import { projectDataEntry, projectDataValue, validateProjectDataProfile } from '../project-data/project-data-contract.js';
import {
  createConfiguredDefaultUsageLedger,
} from '../project-data/non-fea-field-registry.js';
import {
  allocateSupportPointLoad,
  allocateSupportUniformLoad,
  evaluateSupportLoadAccounting,
} from './support-load-static-accounting.js';

export const SUPPORT_LOAD_DISTRIBUTION_SCHEMA = 'support-load-distribution/v3';
export const SUPPORT_LOAD_DISTRIBUTION_COG_SCHEMA = 'support-load-distribution/v4';
export const EMPIRICAL_LOAD_METHOD = 'CHAINAGE_TRIBUTARY_SPAN_V2';
export const EMPIRICAL_LOAD_COG_METHOD = 'CHAINAGE_TRIBUTARY_SPAN_V3_COG';

const FLUID_COMPOSITION_RULE = 'BULK_DENSITY=AUTHORIZED_RAW_DENSITY*GOVERNED_FILL_FRACTION';
const COMPONENT_MASS_COMPOSITION_RULE = 'ONE_DRY_MASS_POLICY_PER_PHYSICAL_COMPONENT';
const COMPONENT_CONTENT_COMPOSITION_RULE = 'COMPONENT_CASE_MASS=DRY_POINT_MASS+OPTIONAL_AUTHORIZED_CONTAINED_FLUID';
const FATAL_EXCLUSION_CODES = new Set([
  'INVALID_PIPE_SECTION',
  'INVALID_PIPE_INSIDE_DIAMETER',
  'MISSING_ROUTE_CHAINAGE',
  'MISSING_QUALIFIED_CASE_MASS',
  'INVALID_COMPONENT_CONTENT_MASS',
  'UNAPPROVED_COMPONENT_CONTENT_MASS',
  'UNAUTHORIZED_COMPONENT_CONTENT_MASS',
  'EMPIRICAL_COMPONENT_LOAD_AUTHORITY_RECORD_MISSING',
  'EMPIRICAL_COMPONENT_LOAD_AUTHORITY_BLOCKED',
  'EMPIRICAL_COMPONENT_COG_CHAINAGE_INVALID',
  'EMPIRICAL_COMPONENT_COG_OFF_ROUTE',
  'EMPIRICAL_COMPONENT_COG_ROUTE_AMBIGUOUS',
  'EMPIRICAL_COMPONENT_COG_INVALID',
  'EMPIRICAL_COMPONENT_COG_UNIT_UNSUPPORTED',
  'EMPIRICAL_COMPONENT_EXPLICIT_MOMENT_INVALID',
  'EMPIRICAL_COMPONENT_EXPLICIT_MOMENT_UNSUPPORTED',
  'EMPIRICAL_COMPONENT_ROUTE_MISSING',
  'EMPIRICAL_COMPONENT_ROUTE_AMBIGUOUS',
  'EMPIRICAL_COMPONENT_LOAD_IDENTITY_MISSING',
]);

const supportLoadPerformanceMetrics = {
  executionIndexBuilds: 0,
  entityIndexEntries: 0,
  edgeIndexEntries: 0,
  routeChainageIndexBuilds: 0,
  routeChainageIndexEntries: 0,
  supportProjectionBuilds: 0,
  baseMassArtifactBuilds: 0,
  baseMassComputations: 0,
  caseMassCompositions: 0,
  fluidMassComputations: 0,
  caseEvaluations: 0,
  routeCaseEvaluations: 0,
  contributorIndexWrites: 0,
};

export function getSupportLoadPerformanceMetrics() {
  return { ...supportLoadPerformanceMetrics };
}

export function resetSupportLoadPerformanceMetrics() {
  Object.keys(supportLoadPerformanceMetrics).forEach((key) => {
    supportLoadPerformanceMetrics[key] = 0;
  });
}

/**
 * Calculates vertical gravity reactions by route. Known loads are never
 * discarded merely because the route has fewer than two qualified vertical
 * supports: overhangs retain their force plus signed cantilever/member-transfer
 * moment, and zero-support loads remain explicit unallocated force/first moment.
 * Missing defaultable inputs remain visible exceptions. Invalid geometry,
 * unresolved application-point authority, and failed accounting remain fail-closed.
 */
export function calculateSupportLoadDistribution(input) {
  return calculateDistribution(input, {
    schema: SUPPORT_LOAD_DISTRIBUTION_SCHEMA,
    method: EMPIRICAL_LOAD_METHOD,
    componentLoadAuthorityAudit: null,
  });
}

/**
 * Separately versioned CoG-aware calculation seam. Only exact, qualified,
 * on-route component CoG chainage is consumed. Off-route/ambiguous CoG and
 * positive explicit moments remain fail-closed and are never converted into
 * vertical reactions.
 */
export function calculateSupportLoadDistributionWithComponentCog(input) {
  assertInput(input);
  const componentLoadAuthorityAudit = auditEmpiricalComponentLoadAuthority({
    dataset: input.dataset,
    profile: input.profile,
    routePartitionModel: input.routePartitionModel,
  });
  return calculateDistribution(input, {
    schema: SUPPORT_LOAD_DISTRIBUTION_COG_SCHEMA,
    method: EMPIRICAL_LOAD_COG_METHOD,
    componentLoadAuthorityAudit,
  });
}

/**
 * Low-level non-authorizing seam for callers that already hold exact
 * per-entity/per-case mass authority. It changes only mass acquisition and the
 * Project Data requirement set; gravity, route/support projection, allocation,
 * first-moment accounting and equilibrium use the same implementation below.
 */
export function calculateSupportLoadDistributionFromQualifiedCaseMasses(
  input,
  qualifiedCaseMasses,
) {
  return calculateDistribution(input, {
    schema: SUPPORT_LOAD_DISTRIBUTION_SCHEMA,
    method: EMPIRICAL_LOAD_METHOD,
    componentLoadAuthorityAudit: null,
    profileWorkflow: 'loadCalcProjectBasis',
    qualifiedCaseMassByKey: normalizeQualifiedCaseMasses(qualifiedCaseMasses),
  });
}

/** CoG-aware counterpart of the non-authorizing qualified-case-mass seam. */
export function calculateSupportLoadDistributionWithComponentCogFromQualifiedCaseMasses(
  input,
  qualifiedCaseMasses,
) {
  assertInput(input);
  const componentLoadAuthorityAudit = auditEmpiricalComponentLoadAuthority({
    dataset: input.dataset,
    profile: input.profile,
    routePartitionModel: input.routePartitionModel,
  });
  return calculateDistribution(input, {
    schema: SUPPORT_LOAD_DISTRIBUTION_COG_SCHEMA,
    method: EMPIRICAL_LOAD_COG_METHOD,
    componentLoadAuthorityAudit,
    profileWorkflow: 'loadCalcProjectBasis',
    qualifiedCaseMassByKey: normalizeQualifiedCaseMasses(qualifiedCaseMasses),
  });
}

function calculateDistribution(input, configuration) {
  assertInput(input);
  const activeHashes = masterHashes(input.masterData, input.dataset);
  const profileAudit = validateProjectDataProfile(
    input.profile,
    configuration.profileWorkflow || 'loads',
    activeHashes,
  );
  const topologyAudit = validateProjectDataProfile(input.profile, 'topology', activeHashes);
  const globalBlockers = [...profileAudit.errors, ...topologyAudit.errors];
  const caseIds = projectDataValue(input.profile, 'loadCalculation.activeLoadCases') || [];
  const componentAuthorityById = new Map(
    (configuration.componentLoadAuthorityAudit?.records || [])
      .map((record) => [record.entityId, record]),
  );
  const execution = {
    ...configuration,
    componentAuthorityById,
    ...buildExecutionIndex(input, globalBlockers, caseIds.length > 0, configuration),
  };
  const cases = caseIds.map((caseId) => calculateCase(
    String(caseId),
    input,
    globalBlockers,
    execution,
  ));
  const sourceHash = input.dataset.sourceSha256 || null;
  const configuredDefaultUsageLedger = buildConfiguredDefaultUsageLedger(input.profile, cases);
  const base = {
    schema: configuration.schema,
    method: configuration.method,
    datasetId: input.dataset.datasetId,
    datasetVersion: input.dataset.version || null,
    hashes: {
      dataset: sourceHash,
      masters: activeHashes,
      projectDataProfile: semanticHash(input.profile),
      supportSiteModel: semanticHash(input.supportSiteModel),
      routePartitionModel: semanticHash(input.routePartitionModel),
    },
    sourceAxisBasis: 'Z_UP',
    verticalForceConvention: 'positive reaction opposes source-axis gravity',
    status: aggregateDistributionStatus(cases),
    loadCases: cases,
    configuredDefaultUsageLedger,
    freshness: {
      status: 'CURRENT',
      datasetId: input.dataset.datasetId,
      datasetVersion: input.dataset.version || null,
    },
  };
  if (!configuration.componentLoadAuthorityAudit) return freezeDeep(base);
  return freezeDeep({
    ...base,
    baseMethod: EMPIRICAL_LOAD_METHOD,
    componentLoadAuthority: {
      schema: configuration.componentLoadAuthorityAudit.schema,
      status: configuration.componentLoadAuthorityAudit.status,
      semanticHash: configuration.componentLoadAuthorityAudit.semanticHash,
      summary: configuration.componentLoadAuthorityAudit.summary,
    },
  });
}

function buildExecutionIndex(input, globalBlockers, hasActiveCases, configuration) {
  supportLoadPerformanceMetrics.executionIndexBuilds += 1;
  const entityById = new Map(input.dataset.entities.map((entity) => [entity.entityId, entity]));
  supportLoadPerformanceMetrics.entityIndexEntries += input.dataset.entities.length;
  const edgeById = new Map(input.routePartitionModel.edges.map((edge) => [edge.entityId, edge]));
  supportLoadPerformanceMetrics.edgeIndexEntries += input.routePartitionModel.edges.length;
  const routeById = new Map();
  const baseMassByEntityId = new Map();
  const usesQualifiedCaseMasses = configuration.qualifiedCaseMassByKey instanceof Map;
  if (globalBlockers.length === 0 && hasActiveCases && !usesQualifiedCaseMasses) {
    supportLoadPerformanceMetrics.baseMassArtifactBuilds += 1;
  }

  input.routePartitionModel.routes.forEach((route) => {
    const chainageByEntityId = new Map(
      route.entityChainages.map((row) => [row.entityId, row]),
    );
    supportLoadPerformanceMetrics.routeChainageIndexBuilds += 1;
    supportLoadPerformanceMetrics.routeChainageIndexEntries += route.entityChainages.length;
    let supports = null;
    if (globalBlockers.length === 0 && route.status === 'READY') {
      supports = routeSupports(route, input.supportSiteModel, edgeById, input.profile);
      supportLoadPerformanceMetrics.supportProjectionBuilds += 1;
      if (hasActiveCases && !usesQualifiedCaseMasses) {
        route.physicalEdgeIds.forEach((entityId) => {
          const entity = entityById.get(entityId);
          const edge = edgeById.get(entityId);
          const chainage = chainageByEntityId.get(entityId);
          if (!entity || !edge || !chainage || !Number.isFinite(chainage.pointMm)) return;
          if (baseMassByEntityId.has(entityId)) return;
          baseMassByEntityId.set(entityId, resolveBaseMass(entity, edge, input.profile));
          supportLoadPerformanceMetrics.baseMassComputations += 1;
        });
      }
    }
    routeById.set(route.routeId, { chainageByEntityId, supports });
  });

  return { entityById, edgeById, routeById, baseMassByEntityId };
}

function calculateCase(caseId, input, globalBlockers, execution) {
  supportLoadPerformanceMetrics.caseEvaluations += 1;
  const state = createCaseState(caseId, globalBlockers);
  if (globalBlockers.length === 0) {
    input.routePartitionModel.routes.forEach((route) => calculateRoute(route, input, state, execution));
  }
  const equilibrium = globalBlockers.length
    ? blockedEquilibrium()
    : equilibriumCheck(state, input.profile);
  if (globalBlockers.length === 0 && !equilibrium.passed) {
    state.blockers.push(...equilibrium.blockers);
  }
  const status = caseStatus(state, globalBlockers);
  return freezeDeep({
    loadCaseId: caseId,
    status,
    verticalForceUnit: 'N',
    supportResults: supportResults(input.supportSiteModel, state, status),
    contributionLedger: state.ledger,
    exceptionLedger: dedupeRows(state.exceptions),
    excludedInputs: state.excludedInputs,
    blockers: dedupeRows(state.blockers),
    equilibrium,
    completenessAudit: completenessAudit(state, status),
  });
}

function calculateRoute(route, input, state, execution) {
  supportLoadPerformanceMetrics.routeCaseEvaluations += 1;
  if (route.status !== 'READY') {
    state.blockers.push(...route.blockers.map((row) => ({ ...row, routeId: route.routeId })));
    return;
  }
  const routeExecution = execution.routeById.get(route.routeId);
  if (!routeExecution) throw new Error(`Missing support-load execution index for route ${route.routeId}.`);
  const supports = routeExecution.supports;
  if (!Array.isArray(supports)) throw new Error(`Missing qualified support projection for READY route ${route.routeId}.`);

  route.physicalEdgeIds.forEach((entityId) => {
    const entity = execution.entityById.get(entityId);
    const edge = execution.edgeById.get(entityId);
    const chainage = routeExecution.chainageByEntityId.get(entityId);
    if (!entity || !edge || !chainage || !Number.isFinite(chainage.pointMm)) {
      recordMissingChainage(state, execution, route, entityId, entity, edge, input.profile);
      return;
    }
    const mass = execution.qualifiedCaseMassByKey instanceof Map
      ? resolveQualifiedCaseMass(execution.qualifiedCaseMassByKey, entityId, state.caseId)
      : resolveLegacyCaseMass(execution, entity, edge, state.caseId, input.profile);
    const application = resolveApplicationPoint(entity, chainage, execution);
    if (!mass.qualified) {
      state.excludedInputs.push({ ...mass.exclusion, routeId: route.routeId, entityId });
    }
    if (!application.qualified) {
      state.excludedInputs.push(...application.exclusions.map((exclusion) => ({
        ...exclusion,
        routeId: route.routeId,
        entityId,
      })));
    }
    if (!mass.qualified || !application.qualified) return;

    const forceN = mass.massKg
      * projectDataValue(input.profile, 'loadCalculation.gravityMPerS2')
      * projectDataValue(input.profile, 'loadCalculation.loadFactor');
    const accounting = edge.entityType === 'PIPE' && edge.lengthMm > 0
      ? allocateSupportUniformLoad({ startMm: chainage.startMm, endMm: chainage.endMm, forceN, supports })
      : allocateSupportPointLoad({ chainageMm: application.chainageMm, forceN, supports });
    recordContribution(state, route, entity, chainage, application, mass, forceN, accounting);
  });
}

/**
 * A component the route carries no chainage for.
 *
 * Where the load acts decides how it splits between supports, so a component
 * that cannot be placed on the route is normally fatal: its force is real and
 * nothing can say which supports carry it.
 *
 * A qualified mass of exactly zero is the one case where the position cannot
 * matter. Zero force allocated anywhere adds zero to every reaction and zero
 * to every first moment, so the result is identical whether the component is
 * placed or omitted, and no reaction is understated by leaving it out. The
 * 1885S model has one: a pressure gauge, alone on its branch, whose source
 * weight is 0 and whose route therefore has no length to measure along.
 *
 * This turns on the mass actually qualified for the case, never on the kind of
 * component. A gauge with a real weight stays fatal, and so does any component
 * whose mass could not be qualified at all - an unknown mass at an unknown
 * position is exactly the case the exclusion exists for.
 */
function recordMissingChainage(state, execution, route, entityId, entity, edge, profile) {
  const mass = unplacedCaseMass(state, execution, entityId, entity, edge, profile);
  if (mass.qualified && mass.massKg === 0) {
    state.exceptions.push({
      code: 'ZERO_MASS_OFF_ROUTE_CONTRIBUTION_IGNORED',
      routeId: route.routeId,
      entityId,
      loadCaseId: state.caseId,
      massKg: 0,
      verticalForceN: 0,
    });
    return;
  }
  state.excludedInputs.push({ code: 'MISSING_ROUTE_CHAINAGE', routeId: route.routeId, entityId });
}

/** The case mass of a component the route could not place, when one is available. */
function unplacedCaseMass(state, execution, entityId, entity, edge, profile) {
  if (execution.qualifiedCaseMassByKey instanceof Map) {
    return resolveQualifiedCaseMass(execution.qualifiedCaseMassByKey, entityId, state.caseId);
  }
  if (!entity || !edge || !execution.baseMassByEntityId?.has(entityId)) return { qualified: false };
  return resolveLegacyCaseMass(execution, entity, edge, state.caseId, profile);
}

function resolveLegacyCaseMass(execution, entity, edge, caseId, profile) {
  if (!execution.baseMassByEntityId.has(entity.entityId)) {
    throw new Error(`Missing case-independent mass artifact for entity ${entity.entityId}.`);
  }
  const baseMass = execution.baseMassByEntityId.get(entity.entityId);
  return resolveCaseMass(baseMass, entity, caseId, profile);
}

function resolveQualifiedCaseMass(qualifiedCaseMassByKey, entityId, caseId) {
  supportLoadPerformanceMetrics.caseMassCompositions += 1;
  const row = qualifiedCaseMassByKey.get(qualifiedCaseMassKey(entityId, caseId));
  if (!row) {
    return {
      qualified: false,
      exclusion: { code: 'MISSING_QUALIFIED_CASE_MASS', entityId, loadCaseId: caseId },
    };
  }
  return {
    qualified: true,
    massKg: row.massKg,
    formula: {
      massAuthority: structuredClone(row.source),
      massKg: row.massKg,
      projectDataSources: [],
    },
  };
}

function normalizeQualifiedCaseMasses(value) {
  if (!Array.isArray(value)) {
    throw new TypeError('qualifiedCaseMasses must be an array.');
  }
  const result = new Map();
  value.forEach((row, index) => {
    const entityId = requiredQualifiedMassText(row?.entityId, `qualifiedCaseMasses[${index}].entityId`);
    const loadCaseId = requiredQualifiedMassText(
      row?.loadCaseId,
      `qualifiedCaseMasses[${index}].loadCaseId`,
    );
    if (!['EMPTY', 'HYD', 'OPE'].includes(loadCaseId)) {
      throw new RangeError(`Unsupported qualified case mass load case: ${loadCaseId}.`);
    }
    const massKg = Number(row?.massKg);
    if (!Number.isFinite(massKg) || massKg < 0) {
      throw new RangeError(`qualifiedCaseMasses[${index}].massKg must be finite and non-negative.`);
    }
    const source = row?.source;
    if (!source || typeof source !== 'object' || Array.isArray(source)
        || source.kind !== 'QUALIFIED_CASE_MASS_RECEIPT'
        || source.authority !== 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION'
        || !qualifiedSemanticHash(source.semanticHash)
        || !qualifiedSemanticHash(source.caseSemanticHash)
        || !['DISTRIBUTED', 'POINT'].includes(source.mode)) {
      throw new TypeError(`qualifiedCaseMasses[${index}].source is not a qualified mass receipt.`);
    }
    const key = qualifiedCaseMassKey(entityId, loadCaseId);
    if (result.has(key)) {
      throw new RangeError(`Duplicate qualified case mass: ${entityId}:${loadCaseId}.`);
    }
    result.set(key, freezeDeep({
      entityId,
      loadCaseId,
      massKg,
      source: freezeDeep(structuredClone(source)),
    }));
  });
  return result;
}

function qualifiedCaseMassKey(entityId, caseId) {
  return `${entityId}\u0000${caseId}`;
}

function requiredQualifiedMassText(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function qualifiedSemanticHash(value) {
  return typeof value === 'string' && /^fnv1a64:[0-9a-f]{16}$/u.test(value);
}

function resolveApplicationPoint(entity, chainage, execution) {
  if (!execution.componentLoadAuthorityAudit || entity.entityType === 'PIPE') {
    return { qualified: true, chainageMm: chainage.pointMm, authority: null };
  }
  const record = execution.componentAuthorityById.get(entity.entityId);
  if (!record) {
    return { qualified: false, exclusions: [{ code: 'EMPIRICAL_COMPONENT_LOAD_AUTHORITY_RECORD_MISSING' }] };
  }
  if (!record.integrationEligible) {
    return {
      qualified: false,
      exclusions: record.blockers.length
        ? record.blockers
        : [{ code: 'EMPIRICAL_COMPONENT_LOAD_AUTHORITY_BLOCKED' }],
    };
  }
  if (!Number.isFinite(record.candidateChainageMm)) {
    return { qualified: false, exclusions: [{ code: 'EMPIRICAL_COMPONENT_COG_CHAINAGE_INVALID' }] };
  }
  return {
    qualified: true,
    chainageMm: record.candidateChainageMm,
    authority: {
      auditSemanticHash: execution.componentLoadAuthorityAudit.semanticHash,
      classification: record.cogClassification,
      currentMethodPointChainageMm: record.currentMethodPointChainageMm,
      candidateChainageMm: record.candidateChainageMm,
      disposition: record.integrationDisposition,
      sourcePath: record.cogEvidence?.sourcePath ?? null,
      sourceUnit: record.cogEvidence?.sourceUnit ?? null,
    },
  };
}

function resolveBaseMass(entity, edge, profile) {
  if (entity.entityType !== 'PIPE') return componentMass(entity, profile);
  const sections = projectDataValue(profile, 'loadCalculation.pipeSectionProperties') || {};
  const section = sections[entity.lineKey];
  if (!section) return excluded('MISSING_PIPE_SECTION', 'loadCalculation.pipeSectionProperties');
  const materialDensities = projectDataValue(profile, 'loadCalculation.materialDensitiesKgPerM3') || {};
  const materialDensity = materialDensities[section.materialCode];
  if (!positive(materialDensity)) return excluded('MISSING_MATERIAL_DENSITY', 'loadCalculation.materialDensitiesKgPerM3');
  if (!positive(section.outsideDiameterMm) || !positive(section.wallThicknessMm)) {
    return excluded('INVALID_PIPE_SECTION', 'loadCalculation.pipeSectionProperties');
  }
  const insideDiameterMm = section.outsideDiameterMm - (2 * section.wallThicknessMm);
  if (!positive(insideDiameterMm)) return excluded('INVALID_PIPE_INSIDE_DIAMETER', 'loadCalculation.pipeSectionProperties');
  const lengthM = edge.lengthMm / 1000;
  const metalKg = annulusAreaM2(section.outsideDiameterMm, insideDiameterMm) * lengthM * materialDensity;
  const insulation = insulationMass(section, lengthM, profile);
  if (!insulation.qualified) return insulation;
  const claddingMassPerLengthKgPerM = section.claddingMassPerLengthKgPerM ?? 0;
  const tracingMassPerLengthKgPerM = section.tracingMassPerLengthKgPerM ?? 0;
  const claddingKg = claddingMassPerLengthKgPerM * lengthM;
  const tracingKg = tracingMassPerLengthKgPerM * lengthM;
  return {
    qualified: true,
    baseMassKg: metalKg + insulation.massKg + claddingKg + tracingKg,
    section,
    insideDiameterMm,
    lengthM,
    formula: {
      metalKg,
      insulationKg: insulation.massKg,
      claddingKg,
      tracingKg,
      claddingMassPerLengthKgPerM,
      tracingMassPerLengthKgPerM,
      lengthM,
      outsideDiameterMm: section.outsideDiameterMm,
      insideDiameterMm,
      projectDataSources: [
        sourceRef(profile, 'loadCalculation.pipeSectionProperties'),
        sourceRef(profile, 'loadCalculation.materialDensitiesKgPerM3'),
        insulation.source,
      ].filter(Boolean),
    },
  };
}

function resolveCaseMass(baseMass, entity, caseId, profile) {
  supportLoadPerformanceMetrics.caseMassCompositions += 1;
  if (!baseMass.qualified) return baseMass;
  if (entity.entityType !== 'PIPE') return componentCaseMass(baseMass, caseId, profile);
  supportLoadPerformanceMetrics.fluidMassComputations += 1;
  const fluid = fluidMass(caseId, baseMass.section, entity, baseMass.insideDiameterMm, baseMass.lengthM, profile);
  if (!fluid.qualified) return fluid;
  return {
    qualified: true,
    massKg: baseMass.baseMassKg + fluid.massKg,
    formula: {
      metalKg: baseMass.formula.metalKg,
      insulationKg: baseMass.formula.insulationKg,
      claddingKg: baseMass.formula.claddingKg,
      tracingKg: baseMass.formula.tracingKg,
      claddingMassPerLengthKgPerM: baseMass.formula.claddingMassPerLengthKgPerM,
      tracingMassPerLengthKgPerM: baseMass.formula.tracingMassPerLengthKgPerM,
      fluidKg: fluid.massKg,
      lengthM: baseMass.formula.lengthM,
      outsideDiameterMm: baseMass.formula.outsideDiameterMm,
      insideDiameterMm: baseMass.formula.insideDiameterMm,
      projectDataSources: [...baseMass.formula.projectDataSources, fluid.source].filter(Boolean),
    },
  };
}

function componentCaseMass(baseMass, caseId, profile) {
  if (caseId === 'EMPTY') return baseMass;
  const path = caseId === 'OPE'
    ? 'loadCalculation.componentOperatingFluidWeightsKg'
    : 'loadCalculation.componentHydroFluidWeightsKg';
  const entry = projectDataEntry(profile, path);
  const contentMap = entry?.value || {};
  if (!Object.hasOwn(contentMap, baseMass.componentSelector)) return baseMass;
  if (entry?.approved !== true || !stringValue(entry?.evidence?.source)) {
    return excluded('UNAPPROVED_COMPONENT_CONTENT_MASS', path);
  }
  const contentMassKg = Number(contentMap[baseMass.componentSelector]);
  if (!Number.isFinite(contentMassKg) || contentMassKg < 0) {
    return excluded('INVALID_COMPONENT_CONTENT_MASS', path);
  }
  const authorization = resolveAuthorizedComponentContent(
    baseMass,
    caseId,
    profile,
    entry,
    contentMassKg,
  );
  if (!authorization) return excluded('UNAUTHORIZED_COMPONENT_CONTENT_MASS', path);
  const contentSource = sourceRef(profile, path);
  return {
    qualified: true,
    massKg: baseMass.massKg + contentMassKg,
    formula: {
      ...baseMass.formula,
      rule: COMPONENT_CONTENT_COMPOSITION_RULE,
      loadCaseId: caseId,
      dryComponentMassKg: baseMass.massKg,
      containedFluidMassKg: contentMassKg,
      containedFluidSemanticHash: authorization.contentReceipt.containedFluidSemanticHash,
      contentCompositionSemanticHash: authorization.contentReceipt.compositionSemanticHash,
      projectDataSources: [...baseMass.formula.projectDataSources, contentSource].filter(Boolean),
    },
  };
}

function resolveAuthorizedComponentContent(baseMass, caseId, profile, entry, contentMassKg) {
  const evidence = entry?.evidence;
  if (evidence?.source !== 'AUTHORIZED_EMPIRICAL_EFFECTIVE_VALUE_LEDGER') return null;
  if (evidence?.massCompositionRule !== COMPONENT_CONTENT_COMPOSITION_RULE) return null;
  if (!stringValue(evidence?.sourceSemanticHash)
      || !stringValue(evidence?.authorizedInputSemanticHash)
      || !stringValue(evidence?.effectiveExecutionProjectionSemanticHash)
      || !stringValue(evidence?.baselineSemanticHash)
      || !stringValue(evidence?.handoffSemanticHash)) return null;

  const contentReceipt = evidence?.componentContentBySelector?.[baseMass.componentSelector];
  if (!contentReceipt || typeof contentReceipt !== 'object' || Array.isArray(contentReceipt)) return null;
  if (contentReceipt.rule !== COMPONENT_CONTENT_COMPOSITION_RULE
      || contentReceipt.loadCaseId !== caseId
      || contentReceipt.containedFluidMassKg !== contentMassKg
      || !stringValue(contentReceipt.targetId)
      || !stringValue(contentReceipt.entityId)
      || !stringValue(contentReceipt.containedFluidSemanticHash)
      || !stringValue(contentReceipt.compositionSemanticHash)) return null;

  const dryEntry = projectDataEntry(profile, 'loadCalculation.componentWeightsKg');
  const dryEvidence = dryEntry?.evidence;
  if (dryEntry?.approved !== true
      || dryEvidence?.source !== 'AUTHORIZED_EMPIRICAL_EFFECTIVE_VALUE_LEDGER'
      || dryEvidence?.massCompositionRule !== COMPONENT_MASS_COMPOSITION_RULE) return null;
  for (const key of [
    'sourceSemanticHash',
    'authorizedInputSemanticHash',
    'effectiveExecutionProjectionSemanticHash',
    'baselineSemanticHash',
    'handoffSemanticHash',
  ]) {
    if (dryEvidence?.[key] !== evidence[key]) return null;
  }
  const dryReceipt = dryEvidence?.componentMassCompositionBySelector?.[baseMass.componentSelector];
  if (!dryReceipt || typeof dryReceipt !== 'object' || Array.isArray(dryReceipt)) return null;
  if (dryReceipt.rule !== COMPONENT_MASS_COMPOSITION_RULE
      || dryReceipt.targetId !== contentReceipt.targetId
      || dryReceipt.entityId !== contentReceipt.entityId
      || Number(dryReceipt.componentWeightKg) !== baseMass.massKg
      || !stringValue(dryReceipt.componentWeightSemanticHash)
      || !stringValue(dryReceipt.compositionSemanticHash)) return null;

  return { contentReceipt, dryReceipt };
}

function insulationMass(section, lengthM, profile) {
  const thickness = section.insulationThicknessMm;
  if (thickness === 0) {
    return { qualified: true, massKg: 0, source: sourceRef(profile, 'loadCalculation.pipeSectionProperties') };
  }
  if (!positive(thickness)) return excluded('MISSING_INSULATION_THICKNESS', 'loadCalculation.pipeSectionProperties');
  const densities = projectDataValue(profile, 'loadCalculation.insulationDensitiesKgPerM3') || {};
  const densityResolution = resolveProjectDataDensity(densities, section.insulationCode);
  if (!densityResolution) return excluded('MISSING_INSULATION_DENSITY', 'loadCalculation.insulationDensitiesKgPerM3');
  return {
    qualified: true,
    massKg: annulusAreaM2(section.outsideDiameterMm + (2 * thickness), section.outsideDiameterMm)
      * lengthM * densityResolution.densityKgPerM3,
    source: resolvedDensitySourceRef(profile, 'loadCalculation.insulationDensitiesKgPerM3', densityResolution),
  };
}

function fluidMass(caseId, section, entity, insideDiameterMm, lengthM, profile) {
  if (caseId === 'EMPTY') return { qualified: true, massKg: 0, source: null };
  const path = caseId === 'OPE'
    ? 'loadCalculation.operatingFluidDensitiesKgPerM3'
    : 'loadCalculation.hydroFluidDensitiesKgPerM3';
  const entry = projectDataEntry(profile, path);
  const densities = entry?.value || {};
  const densityResolution = resolveProjectDataDensity(densities, entity.lineKey, entry?.evidence);
  if (!densityResolution) return excluded('MISSING_FLUID_DENSITY', path);
  return {
    qualified: true,
    massKg: Math.PI * insideDiameterMm ** 2 / 4e6 * lengthM * densityResolution.densityKgPerM3,
    source: resolvedDensitySourceRef(profile, path, densityResolution),
  };
}

function componentMass(entity, profile) {
  const weights = projectDataValue(profile, 'loadCalculation.componentWeightsKg') || {};
  const attributes = entity.properties?.attributes || {};
  const key = stringValue(attributes.CATALOG_KEY) || stringValue(entity.sourceEntityId);
  const qualifiedWeight = typeof weights[key] === 'object' ? weights[key]?.massKg : weights[key];
  if (!key || !positive(qualifiedWeight)) return excluded('MISSING_COMPONENT_MASS', 'loadCalculation.componentWeightsKg');
  const value = typeof weights[key] === 'object' ? weights[key].massKg : weights[key];
  return {
    qualified: true,
    componentSelector: key,
    massKg: Number(value),
    formula: {
      catalogKey: key,
      massKg: Number(value),
      dryComponentMassKg: Number(value),
      projectDataSources: [sourceRef(profile, 'loadCalculation.componentWeightsKg')],
    },
  };
}

function routeSupports(route, supportModel, edgeById, profile) {
  const tolerance = projectDataValue(profile, 'topology.portMatchToleranceMm');
  const capabilities = projectDataValue(profile, 'topology.supportTypeCapabilities') || {};
  return supportModel.sites.flatMap((site) => {
    const vertical = site.assemblies.some((assembly) => (
      assembly.members.some((member) => capabilities[member.sourceType]?.vertical === true)
    ));
    if (!vertical) return [];
    const chainageMm = projectPointToRoute(site.positionMm, route, edgeById, tolerance);
    if (!Number.isFinite(chainageMm)) return [];
    return [{ siteId: site.siteId, chainageMm }];
  }).sort((left, right) => left.chainageMm - right.chainageMm);
}

function projectPointToRoute(point, route, edgeById, tolerance) {
  for (const row of route.entityChainages) {
    const edge = edgeById.get(row.entityId);
    if (!edge || edge.pointComponent || edge.topologyCarrier || edge.lengthMm <= 0) continue;
    const projection = projectToSegment(point, edge.startMm, edge.endMm);
    if (projection.distanceMm > tolerance) continue;
    return row.sourceStartChainageMm
      + projection.ratio * (row.sourceEndChainageMm - row.sourceStartChainageMm);
  }
  return null;
}

function recordContribution(state, route, entity, routeChainage, application, mass, forceN, accounting) {
  const contributionId = `${state.caseId}:${entity.entityId}`;
  const allocations = accounting.allocations || [];
  const boundaryTransfers = accounting.boundaryTransfers || [];
  const unallocated = accounting.unallocated || [];
  const contributorSites = new Set();
  allocations.forEach((allocation) => {
    state.reactions.set(allocation.siteId, (state.reactions.get(allocation.siteId) ?? 0) + allocation.verticalForceN);
    if (!contributorSites.has(allocation.siteId)) {
      contributorSites.add(allocation.siteId);
      const contributors = state.contributorsBySite.get(allocation.siteId) || [];
      contributors.push(contributionId);
      state.contributorsBySite.set(allocation.siteId, contributors);
      supportLoadPerformanceMetrics.contributorIndexWrites += 1;
    }
  });

  boundaryTransfers.forEach((transfer) => {
    state.boundaryMomentBySite.set(
      transfer.supportSiteId,
      (state.boundaryMomentBySite.get(transfer.supportSiteId) ?? 0) + transfer.momentDemandNmm,
    );
    state.exceptions.push({
      code: 'OVERHANG_CANTILEVER_TRANSFER',
      routeId: route.routeId,
      entityId: entity.entityId,
      supportSiteId: transfer.supportSiteId,
      verticalForceN: transfer.verticalForceN,
      eccentricityMm: transfer.eccentricityMm,
      momentDemandNmm: transfer.momentDemandNmm,
    });
  });
  unallocated.forEach((row) => state.exceptions.push({
    code: 'UNALLOCATED_FORCE_NO_QUALIFIED_VERTICAL_SUPPORT',
    routeId: route.routeId,
    entityId: entity.entityId,
    verticalForceN: row.verticalForceN,
    applicationChainageMm: row.applicationChainageMm,
    firstMomentNmm: row.firstMomentNmm,
  }));

  const allocatedForceN = sum(allocations.map((row) => row.verticalForceN));
  const reactionMomentNmm = sum(allocations.map((row) => row.verticalForceN * row.chainageMm));
  const boundaryTransferMomentNmm = sum(boundaryTransfers.map((row) => row.momentDemandNmm));
  const unallocatedForceN = sum(unallocated.map((row) => row.verticalForceN));
  const unallocatedMomentNmm = sum(unallocated.map((row) => row.firstMomentNmm));
  const evaluatedMomentNmm = forceN * application.chainageMm;

  state.evaluatedMassKg += mass.massKg;
  state.evaluatedForceN += forceN;
  state.evaluatedMomentNmm += evaluatedMomentNmm;
  state.reactionMomentNmm += reactionMomentNmm;
  state.boundaryTransferMomentNmm += boundaryTransferMomentNmm;
  state.unallocatedForceN += unallocatedForceN;
  state.unallocatedMomentNmm += unallocatedMomentNmm;
  if (forceN !== 0) {
    state.allocatedMassKg += mass.massKg * allocatedForceN / forceN;
    state.unallocatedMassKg += mass.massKg * unallocatedForceN / forceN;
  }

  const routeState = routeAccountingState(state, route.routeId);
  routeState.evaluatedForceN += forceN;
  routeState.evaluatedMomentNmm += evaluatedMomentNmm;
  routeState.reactionForceN += allocatedForceN;
  routeState.reactionMomentNmm += reactionMomentNmm;
  routeState.boundaryTransferMomentNmm += boundaryTransferMomentNmm;
  routeState.unallocatedForceN += unallocatedForceN;
  routeState.unallocatedMomentNmm += unallocatedMomentNmm;

  const formula = application.authority
    ? { ...mass.formula, applicationPointAuthority: application.authority }
    : mass.formula;
  const contribution = {
    contributionId,
    routeId: route.routeId,
    entityId: entity.entityId,
    source: {
      sourceEntityId: entity.sourceEntityId,
      jsonPointer: entity.jsonPointer,
      componentReference: entity.componentReference,
      masterRow: entity.properties?.editProvenance?.catalogRow || null,
    },
    massKg: mass.massKg,
    verticalForceN: forceN,
    chainageMm: application.chainageMm,
    formula,
    accountingDisposition: accounting.disposition,
    allocations,
    boundaryTransfers,
    unallocated,
  };
  if (application.authority) contribution.currentMethodPointChainageMm = routeChainage.pointMm;
  state.ledger.push(contribution);
}

function routeAccountingState(state, routeId) {
  let row = state.routeAccounting.get(routeId);
  if (row) return row;
  row = {
    evaluatedForceN: 0,
    evaluatedMomentNmm: 0,
    reactionForceN: 0,
    reactionMomentNmm: 0,
    boundaryTransferMomentNmm: 0,
    unallocatedForceN: 0,
    unallocatedMomentNmm: 0,
  };
  state.routeAccounting.set(routeId, row);
  return row;
}

function supportResults(model, state, caseStatusValue) {
  const publishable = caseStatusValue === 'CALCULATED' || caseStatusValue === 'CALCULATED_WITH_EXCEPTIONS';
  return model.sites.map((site) => {
    const contributorIds = [...(state.contributorsBySite.get(site.siteId) || [])];
    const reaction = state.reactions.get(site.siteId) ?? 0;
    const cantileverMomentDemandNmm = state.boundaryMomentBySite.get(site.siteId) ?? 0;
    return {
      supportSiteId: site.siteId,
      tags: site.tags,
      sourceAxisBasis: 'Z_UP',
      status: caseStatusValue,
      verticalForceN: publishable ? reaction : null,
      qualifiedReactionCandidateN: publishable || contributorIds.length > 0 ? reaction : null,
      cantileverMomentDemandNmm: publishable ? cantileverMomentDemandNmm : null,
      contributorIds,
    };
  });
}

function equilibriumCheck(state, profile) {
  const tolerance = projectDataValue(profile, 'loadCalculation.equilibriumTolerances') || {};
  const forceLimit = tolerance.forceN;
  const momentLimit = tolerance.momentNmm;
  if (!positiveOrZero(forceLimit) || !positiveOrZero(momentLimit)) {
    return missingToleranceEquilibrium(state);
  }

  const globalClosure = evaluateSupportLoadAccounting({
    evaluatedForceN: state.evaluatedForceN,
    evaluatedMomentNmm: state.evaluatedMomentNmm,
    reactionForceN: sum([...state.reactions.values()]),
    reactionMomentNmm: state.reactionMomentNmm,
    boundaryTransferMomentNmm: state.boundaryTransferMomentNmm,
    unallocatedForceN: state.unallocatedForceN,
    unallocatedMomentNmm: state.unallocatedMomentNmm,
    forceToleranceN: forceLimit,
    momentToleranceNmm: momentLimit,
  });
  const routeChecks = [...state.routeAccounting.entries()]
    .sort(([left], [right]) => ascii(left, right))
    .map(([routeId, row]) => ({
      routeId,
      momentReference: 'ROUTE_CHAINAGE_ORIGIN',
      ...evaluateSupportLoadAccounting({
        ...row,
        forceToleranceN: forceLimit,
        momentToleranceNmm: momentLimit,
      }),
    }));
  const failedRoutes = routeChecks.filter((row) => !row.passed);
  const passed = globalClosure.passed && failedRoutes.length === 0;
  const blockers = [];
  if (!globalClosure.passed) {
    blockers.push({
      code: 'EQUILIBRIUM_CHECK_FAILED',
      forceResidualN: globalClosure.forceResidualN,
      momentResidualNmm: globalClosure.momentResidualNmm,
    });
  }
  failedRoutes.forEach((row) => blockers.push({
    code: 'ROUTE_EQUILIBRIUM_CHECK_FAILED',
    routeId: row.routeId,
    forceResidualN: row.forceResidualN,
    momentResidualNmm: row.momentResidualNmm,
    momentReference: row.momentReference,
  }));
  return {
    status: passed ? 'PASSED' : 'FAILED',
    passed,
    momentReference: 'PER_ROUTE_CHAINAGE_ORIGIN_WITH_AGGREGATE_DIAGNOSTIC',
    routeChecks,
    appliedForceN: globalClosure.evaluatedForceN,
    evaluatedForceN: globalClosure.evaluatedForceN,
    reactionN: globalClosure.reactionForceN,
    unallocatedForceN: globalClosure.unallocatedForceN,
    forceResidualN: globalClosure.forceResidualN,
    appliedMomentNmm: globalClosure.evaluatedMomentNmm,
    evaluatedMomentNmm: globalClosure.evaluatedMomentNmm,
    reactionMomentNmm: globalClosure.reactionMomentNmm,
    boundaryTransferMomentNmm: globalClosure.boundaryTransferMomentNmm,
    unallocatedMomentNmm: globalClosure.unallocatedMomentNmm,
    accountedMomentNmm: globalClosure.accountedMomentNmm,
    momentResidualNmm: globalClosure.momentResidualNmm,
    blockers,
  };
}

function missingToleranceEquilibrium(state) {
  return {
    status: 'FAILED',
    passed: false,
    momentReference: 'PER_ROUTE_CHAINAGE_ORIGIN_WITH_AGGREGATE_DIAGNOSTIC',
    routeChecks: [],
    appliedForceN: state.evaluatedForceN,
    evaluatedForceN: state.evaluatedForceN,
    reactionN: sum([...state.reactions.values()]),
    unallocatedForceN: state.unallocatedForceN,
    forceResidualN: null,
    appliedMomentNmm: state.evaluatedMomentNmm,
    evaluatedMomentNmm: state.evaluatedMomentNmm,
    reactionMomentNmm: state.reactionMomentNmm,
    boundaryTransferMomentNmm: state.boundaryTransferMomentNmm,
    unallocatedMomentNmm: state.unallocatedMomentNmm,
    accountedMomentNmm: null,
    momentResidualNmm: null,
    blockers: [{
      code: 'MISSING_EQUILIBRIUM_TOLERANCE',
      projectDataPath: 'loadCalculation.equilibriumTolerances',
    }],
  };
}

function blockedEquilibrium() {
  return {
    status: 'NOT_RUN_PROJECT_DATA_BLOCKED',
    passed: false,
    momentReference: 'PER_ROUTE_CHAINAGE_ORIGIN_WITH_AGGREGATE_DIAGNOSTIC',
    routeChecks: [],
    appliedForceN: null,
    evaluatedForceN: null,
    reactionN: null,
    unallocatedForceN: null,
    forceResidualN: null,
    appliedMomentNmm: null,
    evaluatedMomentNmm: null,
    reactionMomentNmm: null,
    boundaryTransferMomentNmm: null,
    unallocatedMomentNmm: null,
    accountedMomentNmm: null,
    momentResidualNmm: null,
    blockers: [],
  };
}

function completenessAudit(state, status) {
  const allocatedForceN = sum([...state.reactions.values()]);
  const coverageRatio = state.evaluatedForceN > 0
    ? allocatedForceN / state.evaluatedForceN
    : (state.excludedInputs.length > 0 ? 0 : 1);
  return {
    status: status === 'FAILED'
      ? 'FAILED'
      : status === 'BLOCKED'
        ? 'BLOCKED'
        : status === 'CALCULATED_WITH_EXCEPTIONS'
          ? 'COMPLETE_WITH_EXCEPTIONS'
          : 'COMPLETE',
    coverageBasis: 'EVALUATED_KNOWN_FORCE_ONLY',
    evaluatedMassKg: state.evaluatedMassKg,
    allocatedMassKg: state.allocatedMassKg,
    unallocatedMassKg: state.unallocatedMassKg,
    blockedInvalidMassKg: state.excludedInputs.length > 0 ? null : 0,
    evaluatedForceN: state.evaluatedForceN,
    allocatedForceN,
    unallocatedForceN: state.unallocatedForceN,
    invalidForceN: state.excludedInputs.length > 0 ? null : 0,
    coverageRatio,
    boundaryTransferMomentNmm: state.boundaryTransferMomentNmm,
    unallocatedFirstMomentNmm: state.unallocatedMomentNmm,
    routeAccountingCount: state.routeAccounting.size,
    evaluatedContributionCount: state.ledger.length,
    allocatedContributionCount: state.ledger.filter((row) => row.allocations.length > 0).length,
    unallocatedContributionCount: state.ledger.filter((row) => row.unallocated.length > 0).length,
    excludedContributionCount: state.excludedInputs.length,
    exceptionCount: state.exceptions.length,
    qualifiedAppliedForceN: state.ledger.length ? state.evaluatedForceN : null,
    qualifiedReactionCandidateN: state.ledger.length ? allocatedForceN : null,
    qualifiedContributionCount: state.ledger.length,
  };
}

// A case is BLOCKED, not FAILED, when calculation was never attempted because
// the Project Data/topology profile itself was incomplete (globalBlockers is
// only ever non-empty in that pre-execution scenario; calculateCase skips all
// route processing whenever it is). FAILED is reserved for a route or
// equilibrium check that was actually attempted and did not close.
function caseStatus(state, globalBlockers) {
  if (globalBlockers.length > 0) return 'BLOCKED';
  if (state.blockers.length > 0 || state.excludedInputs.some(isFatalExclusion)) return 'FAILED';
  if (state.excludedInputs.length > 0 || state.exceptions.length > 0) return 'CALCULATED_WITH_EXCEPTIONS';
  return 'CALCULATED';
}

function isFatalExclusion(row) {
  const code = stringValue(row?.code);
  return FATAL_EXCLUSION_CODES.has(code)
    || code.startsWith('EMPIRICAL_COMPONENT_COG_')
    || code.startsWith('EMPIRICAL_COMPONENT_EXPLICIT_MOMENT_');
}

function aggregateDistributionStatus(cases) {
  if (cases.length === 0 || cases.some((row) => row.status === 'FAILED')) return 'FAILED';
  if (cases.some((row) => row.status === 'BLOCKED')) return 'BLOCKED';
  if (cases.some((row) => row.status === 'CALCULATED_WITH_EXCEPTIONS')) return 'CALCULATED_WITH_EXCEPTIONS';
  return 'CALCULATED';
}

function sourceRef(profile, path) {
  const entry = projectDataEntry(profile, path);
  return entry ? { projectDataPath: path, evidence: entry.evidence } : null;
}

export function resolveProjectDataDensity(densities, exactSelector, evidence = null) {
  const exactValue = densities[exactSelector];
  const exactDensity = densityValue(exactValue);
  if (positive(exactDensity)) {
    return {
      densityKgPerM3: Number(exactDensity),
      selector: exactSelector,
      authority: 'EXACT_SCOPED_VALUE',
      fallbackUsed: false,
    };
  }
  const authorizedZero = resolveAuthorizedZeroFluidDensity(exactValue, exactSelector, evidence);
  if (authorizedZero) return authorizedZero;
  const fallbackDensity = densityValue(densities.DEFAULT);
  if (!positive(fallbackDensity)) return null;
  return {
    densityKgPerM3: Number(fallbackDensity),
    selector: 'DEFAULT',
    authority: 'PROJECT_CONFIGURED_DEFAULT',
    fallbackUsed: true,
  };
}

function resolveAuthorizedZeroFluidDensity(value, exactSelector, evidence) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (evidence?.source !== 'AUTHORIZED_EMPIRICAL_EFFECTIVE_VALUE_LEDGER') return null;
  if (evidence?.massCompositionRule !== FLUID_COMPOSITION_RULE) return null;
  if (!stringValue(evidence?.sourceSemanticHash)
      || !stringValue(evidence?.authorizedInputSemanticHash)
      || !stringValue(evidence?.effectiveExecutionProjectionSemanticHash)) return null;
  const receipt = evidence?.fluidCompositionBySelector?.[exactSelector];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return null;
  if (value.selected !== 0
      || !positive(value.rawDensityKgPerM3)
      || value.fillFraction !== 0
      || !stringValue(value.rawDensitySemanticHash)
      || !stringValue(value.fillPolicySemanticHash)
      || !stringValue(value.compositionSemanticHash)) return null;
  if (receipt.rule !== FLUID_COMPOSITION_RULE
      || receipt.rawDensityKgPerM3 !== value.rawDensityKgPerM3
      || receipt.rawDensitySemanticHash !== value.rawDensitySemanticHash
      || receipt.fillFraction !== 0
      || receipt.fillPolicySemanticHash !== value.fillPolicySemanticHash
      || receipt.bulkDensityKgPerM3 !== 0
      || receipt.compositionSemanticHash !== value.compositionSemanticHash) return null;
  return {
    densityKgPerM3: 0,
    selector: exactSelector,
    authority: 'AUTHORIZED_ZERO_FLUID_COMPOSITION',
    fallbackUsed: false,
    zeroFluid: true,
    rawDensityKgPerM3: Number(value.rawDensityKgPerM3),
    fillFraction: 0,
    rawDensitySemanticHash: value.rawDensitySemanticHash,
    fillPolicySemanticHash: value.fillPolicySemanticHash,
    compositionSemanticHash: value.compositionSemanticHash,
  };
}

function densityValue(value) {
  return typeof value === 'number' ? value : value?.selected;
}

function resolvedDensitySourceRef(profile, path, resolution) {
  const source = sourceRef(profile, path);
  return source ? {
    ...source,
    selector: resolution.selector,
    resolutionAuthority: resolution.authority,
    fallbackUsed: resolution.fallbackUsed,
    densityKgPerM3: resolution.densityKgPerM3,
    ...(resolution.zeroFluid === true ? {
      zeroFluid: true,
      rawDensityKgPerM3: resolution.rawDensityKgPerM3,
      fillFraction: 0,
      rawDensitySemanticHash: resolution.rawDensitySemanticHash,
      fillPolicySemanticHash: resolution.fillPolicySemanticHash,
      compositionSemanticHash: resolution.compositionSemanticHash,
    } : {}),
  } : null;
}

function buildConfiguredDefaultUsageLedger(profile, cases) {
  const policy = projectDataValue(profile, 'qualificationPolicy.configuredDefaults');
  const defaultByFieldId = new Map((policy?.defaults || []).map((row) => [row.fieldId, row]));
  const usageRows = cases.flatMap((loadCase) => (
    (loadCase.contributionLedger || []).flatMap((contribution) => (
      (contribution.formula?.projectDataSources || [])
        .filter((source) => source.fallbackUsed === true)
        .map((source) => {
          const fieldId = configuredDefaultFieldId(source.projectDataPath);
          const configured = defaultByFieldId.get(fieldId);
          return {
            defaultId: configured?.defaultId || '',
            fieldId,
            methodId: 'WEIGHT_AND_GRAVITY',
            targetId: `${loadCase.loadCaseId}:${contribution.entityId}:${fieldId}`,
            reason: `No positive exact scoped value for ${source.projectDataPath}; approved DEFAULT selector used by ${EMPIRICAL_LOAD_METHOD}.`,
          };
        })
    ))
  ));
  return createConfiguredDefaultUsageLedger(profile, usageRows);
}

function configuredDefaultFieldId(projectDataPath) {
  const fieldIds = {
    'loadCalculation.hydroFluidDensitiesKgPerM3': 'HYDRO_FLUID_DENSITY',
    'loadCalculation.insulationDensitiesKgPerM3': 'INSULATION_DENSITY',
  };
  const fieldId = fieldIds[projectDataPath];
  if (!fieldId) throw new RangeError(`Unsupported configured-default path: ${projectDataPath}.`);
  return fieldId;
}

function createCaseState(caseId, blockers) {
  return {
    caseId,
    blockers: [...blockers],
    excludedInputs: [],
    exceptions: [],
    ledger: [],
    reactions: new Map(),
    contributorsBySite: new Map(),
    boundaryMomentBySite: new Map(),
    routeAccounting: new Map(),
    evaluatedMassKg: 0,
    allocatedMassKg: 0,
    unallocatedMassKg: 0,
    evaluatedForceN: 0,
    evaluatedMomentNmm: 0,
    reactionMomentNmm: 0,
    boundaryTransferMomentNmm: 0,
    unallocatedForceN: 0,
    unallocatedMomentNmm: 0,
  };
}

function excluded(code, projectDataPath) {
  return { qualified: false, exclusion: { code, projectDataPath } };
}

function annulusAreaM2(outerMm, innerMm) {
  return Math.PI * (outerMm ** 2 - innerMm ** 2) / 4e6;
}

function projectToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const length2 = dx ** 2 + dy ** 2 + dz ** 2;
  const ratio = length2 === 0
    ? 0
    : Math.max(0, Math.min(1, (
      (point.x - start.x) * dx
        + (point.y - start.y) * dy
        + (point.z - start.z) * dz
    ) / length2));
  const projected = {
    x: start.x + ratio * dx,
    y: start.y + ratio * dy,
    z: start.z + ratio * dz,
  };
  return {
    ratio,
    distanceMm: Math.hypot(point.x - projected.x, point.y - projected.y, point.z - projected.z),
  };
}

function masterHashes(masterData, dataset) {
  return {
    dataset: dataset.sourceSha256 || '',
    lineList: masterData?.lineList?.sourceHash || '',
    pipingClass: masterData?.pipingClass?.sourceHash || '',
    componentWeight: masterData?.weight?.sourceHash || '',
  };
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function positive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function positiveOrZero(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function ascii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertInput(input) {
  if (!input?.dataset || !input.profile || !input.supportSiteModel || !input.routePartitionModel) {
    throw new TypeError('Support load distribution requires dataset, profile, support-site model, and route-partition model.');
  }
}
