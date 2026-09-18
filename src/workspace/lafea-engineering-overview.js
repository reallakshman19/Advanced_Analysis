/** User-facing engineering summary derived only from retained workbench state. */
import {
  FORMULATION_GUARDS,
  FORMULATIONS,
} from '../core/local-continuum/index.js';
import { element } from './lafea-workbench-dom.js';
import { lafeaUiStatusPresentation } from './lafea-ui-status.js';

export const LAFEA_ENGINEERING_OVERVIEW_SCHEMA = 'lafea-engineering-overview/v1';

export function buildLafeaEngineeringOverview(stageValue, registryEntryValue) {
  const stage = requireRecord(stageValue, 'LAFEA_ENGINEERING_OVERVIEW_STAGE_REQUIRED');
  const registry = requireRecord(registryEntryValue, 'LAFEA_ENGINEERING_OVERVIEW_REGISTRY_REQUIRED');
  const source = record(stage.document);
  const meshEvidence = record(stage.retainedAnalysisMeshEvidenceV2)
    ?? record(stage.retainedAnalysisMeshEvidence);
  const mesh = record(meshEvidence?.mesh);
  const execution = record(stage.execution);
  const result = record(execution?.result);

  const elementFamilies = uniqueStrings([
    ...(array(source?.elements).map((row) => row?.elementType)),
    ...(array(mesh?.elements).map((row) => row?.elementType)),
  ]);
  const runAuthorized = Boolean(source)
    && registry.engineState === 'QUALIFIED_ROUTE_REGISTERED'
    && stage.orchestration?.sections?.AUTHORIZATION?.state === 'READY';
  const formulationAuthority = continuumFormulationAuthority(source, mesh);
  const governedRoute = stage.domainFirstProfileActive === true
    || stage.shellMidsurfaceProfileActive === true;
  const historicalAccepted = execution?.status === 'QUALIFIED'
    && result?.qualification?.state === 'ACCEPTED';
  const currentAccepted = governedRoute
    ? execution?.status === 'QUALIFIED'
      && stage.lifecycleReadiness?.calculationState === 'CALCULATION_ACCEPTED_BY_STAGE_CONTRACT'
      && stage.lifecycleReadiness?.resultReady === true
    : historicalAccepted;
  // A qualified execution that the stage contract has accepted is current; it is
  // simply not published yet, which is a different fact from a stale result left
  // over from an earlier revision. Reporting both as "Previous result — stale"
  // told an operator their successful run had gone stale.
  const contractAccepted = stage.lifecycleReadiness?.calculationState
    === 'CALCULATION_ACCEPTED_BY_STAGE_CONTRACT';
  const executionStatus = governedRoute
    && execution?.status === 'QUALIFIED'
    && !currentAccepted
    ? (contractAccepted ? 'QUALIFIED_NOT_PUBLISHED' : 'QUALIFIED_NOT_CURRENT')
    : text(execution?.status, 'NOT_RUN');

  return freeze({
    schema: LAFEA_ENGINEERING_OVERVIEW_SCHEMA,
    stageId: String(stage.stageId ?? registry.stageId ?? 'UNKNOWN'),
    model: {
      status: source ? 'LOADED' : 'NOT_LOADED',
      identity: text(source?.modelIdentity, 'Not loaded'),
      formulation: text(source?.formulation, 'Not declared'),
      materialCount: array(source?.materials).length,
      nodeCount: array(source?.nodes).length,
      elementCount: array(source?.elements).length,
      constraintCount: array(source?.constraints).length,
      loadCaseCount: array(source?.loadCases).length,
      elementFamilies,
      units: unitSummary(source?.units),
      formulationAuthority,
    },
    mesh: {
      state: text(stage.analysisMeshCustodyProjection?.state, meshEvidence ? 'RETAINED' : 'NOT_RETAINED'),
      nodeCount: array(mesh?.nodes).length,
      elementCount: array(mesh?.elements).length,
      family: elementFamilies.join(' / ') || 'Not retained',
      profile: text(meshEvidence?.meshProfile?.profileIdentity, text(meshEvidence?.meshProfileIdentity, 'Not bound')),
      qualification: text(meshEvidence?.qualification, text(meshEvidence?.status, 'Not retained')),
    },
    solver: {
      engine: registry.enginePackage ? `src/core/${registry.enginePackage}` : 'Not implemented',
      authority: text(registry.authority, 'UNREGISTERED'),
      engineState: text(registry.engineState, 'UNKNOWN'),
      qualificationProfile: text(source?.qualificationProfile?.identity, 'Not declared'),
      recovery: recoveryLabel(registry, elementFamilies, source?.formulation),
    },
    execution: {
      status: executionStatus,
      authorized: runAuthorized,
      accepted: currentAccepted,
      loadCaseCount: array(result?.loadCaseResults).length,
      qualificationState: text(result?.qualification?.state, 'NOT_RUN'),
      metrics: continuumMetrics(result, source?.units),
    },
    qualification: registry.stageId === 'LAFEA.3' ? {
      program: 'B01 + Plane-Strain B-bar',
      baseRuns: 'NOT EMBEDDED IN WORKBENCH STATE',
      bbarMatrix: 'EXTERNAL EXACT-HEAD 120-SOLVE EVIDENCE REQUIRED',
      metamorphic: 'EXTERNAL CI EVIDENCE REQUIRED',
      failClosed: 'EXTERNAL CI EVIDENCE REQUIRED',
      exactHead: 'EXTERNAL EXACT-HEAD CI REQUIRED',
      releaseAuthority: false,
      scope: 'Workbench runtime state does not manufacture benchmark, B-bar matrix, exact-head or release qualification claims.',
    } : null,
  });
}

export function renderLafeaEngineeringOverview(root, stageValue, registryEntryValue, handlers = {}) {
  if (!root?.ownerDocument) throw new TypeError('LAFEA_ENGINEERING_OVERVIEW_ROOT_REQUIRED');
  const model = buildLafeaEngineeringOverview(stageValue, registryEntryValue);
  const host = element(root, 'section', 'lafea-engineering-overview');
  host.dataset.role = 'lafea-engineering-overview';
  host.dataset.executionStatus = model.execution.status;

  const heading = element(root, 'div', 'lafea-engineering-overview__heading');
  heading.append(element(root, 'div'));
  heading.firstElementChild.append(
    element(root, 'span', 'panel-eyebrow', 'Engineering workspace'),
    element(root, 'h2', null, 'Model → mesh → solve → results'),
    element(root, 'p', null, 'Live summary from the active governed source, retained mesh and solver execution.'),
  );
  const run = element(root, 'button', 'lafea-engineering-overview__run', 'Run analysis');
  run.type = 'button';
  run.dataset.role = 'lafea-overview-run';
  run.disabled = typeof handlers.onRun !== 'function' || !model.execution.authorized;
  run.title = model.execution.authorized
    ? 'Run the canonically authorized registered stage calculation.'
    : 'Analysis is not yet authorized. Complete the source, mesh and preflight gates first.';
  run.addEventListener('click', () => handlers.onRun?.());
  heading.append(run);
  host.append(heading);

  const strip = element(root, 'div', 'lafea-engineering-overview__strip');
  strip.dataset.role = 'lafea-engineering-summary';
  strip.append(
    summaryCard(root, 'Model', model.model.status, [
      ['Nodes', model.model.nodeCount],
      ['Elements', model.model.elementCount],
      ['Families', model.model.elementFamilies.join(' / ') || '—'],
      ['Formulation', formulationLabel(model.model.formulation)],
      ['Load cases', model.model.loadCaseCount],
    ]),
    summaryCard(root, 'Mesh', model.mesh.state, [
      ['Nodes', model.mesh.nodeCount],
      ['Elements', model.mesh.elementCount],
      ['Element family', model.mesh.family],
      ['Quality', statusLabel(model.mesh.qualification)],
    ]),
    summaryCard(root, 'Solver', model.solver.engineState, [
      ['Route', solverRouteLabel(model.solver.engine)],
      ['Qualification profile', model.solver.qualificationProfile === 'Not declared' ? 'Not declared' : 'Configured'],
      ['Recovery', model.solver.recovery],
    ]),
    resultCard(root, model),
  );
  host.append(strip, technicalEvidenceDisclosure(root, model));

  if (model.stageId === 'LAFEA.3') {
    host.append(formulationAuthorityPanel(root, model.model.formulationAuthority));
  }
  if (model.qualification) host.append(qualificationBar(root, model.qualification));
  return host;
}

function technicalEvidenceDisclosure(root, model) {
  const details = element(root, 'details', 'lafea-engineering-overview__qualification');
  details.dataset.role = 'lafea-technical-evidence';
  details.append(element(root, 'summary', null, 'Technical identifiers and custody'));
  const grid = element(root, 'div', 'lafea-engineering-overview__qualification-grid');
  [
    ['Stage ID', model.stageId],
    ['Model identity', model.model.identity],
    ['Model formulation ID', model.model.formulation],
    ['Mesh custody state', model.mesh.state],
    ['Mesh profile ID', model.mesh.profile],
    ['Mesh qualification state', model.mesh.qualification],
    ['Solver package', model.solver.engine],
    ['Solver authority', model.solver.authority],
    ['Engine state', model.solver.engineState],
    ['Qualification profile ID', model.solver.qualificationProfile],
    ['Execution state', model.execution.status],
    ['Result qualification state', model.execution.qualificationState],
  ].forEach(([label, value]) => {
    const row = element(root, 'div');
    row.append(element(root, 'strong', null, label), element(root, 'code', null, String(value)));
    grid.append(row);
  });
  details.append(grid);
  return details;
}

function formulationAuthorityPanel(root, value) {
  const details = element(root, 'details', 'lafea-engineering-overview__qualification');
  details.dataset.role = 'lafea3-formulation-authority';
  details.dataset.status = value.status;
  const summary = element(
    root,
    'summary',
    null,
    `Formulation & material controls — ${statusLabel(value.status)}`,
  );
  const grid = element(root, 'div', 'lafea-engineering-overview__qualification-grid');
  [
    ['Configured formulation', formulationLabel(value.formulation)],
    ['Configured Poisson ratio(s)', value.poissonRatios || 'Not declared'],
    ...value.details,
  ].forEach(([label, item]) => {
    const row = element(root, 'div');
    row.append(element(root, 'strong', null, label), element(root, 'span', null, String(item)));
    grid.append(row);
  });
  if (value.message) grid.append(element(root, 'p', null, value.message));
  details.append(summary, grid);
  return details;
}

function continuumFormulationAuthority(source, mesh) {
  const formulation = text(source?.formulation, 'Not declared');
  const ratios = array(source?.materials)
    .map((row) => finite(row?.poissonRatio))
    .filter((value) => value !== null);
  const poissonRatios = ratios.join(', ');

  if (formulation === FORMULATIONS.PLANE_STRAIN_BBAR) {
    const hasTemperature = array(source?.loadCases).some(
      (loadCase) => array(loadCase?.temperatureLoads).length > 0,
    );
    const meshFamilies = uniqueStrings(array(mesh?.elements).map((row) => row?.elementType));
    const hasT3 = meshFamilies.includes('T3');
    const hasUnsupported = meshFamilies.some((family) => family !== 'T6' && family !== 'Q8');
    const details = [
      ['Locking-resistant authority', 'Mean-dilatation B-bar; T6 / Q8 mechanical route only'],
      ['Retained solver-mesh families', meshFamilies.join(' / ') || 'Not retained'],
      ['Temperature / eigenstrain authority', 'Not granted'],
      ['T3 B-bar authority', 'Not granted — actual T3 solver elements block before stiffness assembly'],
      ['Qualification evidence', 'Frozen ν=0.30→0.4999 × distortion × h-refinement matrix requires external exact-head execution'],
      ['Guard authority', 'Source-controlled mechanics; solver tolerances cannot substitute for locking qualification'],
    ];
    if (hasTemperature) {
      return {
        status: 'BLOCKED', formulation, poissonRatios, details,
        message: 'B-bar thermal/eigenstrain loading is outside the qualified formulation envelope.',
      };
    }
    if (!mesh) {
      return {
        status: 'MESH_REQUIRED', formulation, poissonRatios, details,
        message: 'B-bar source selection is configured, but a retained qualified T6 or Q8 solver mesh is required before execution.',
      };
    }
    if (hasT3 || hasUnsupported || meshFamilies.length === 0) {
      return {
        status: 'MESH_REGENERATION_REQUIRED', formulation, poissonRatios, details,
        message: 'The retained solver mesh is outside B-bar T6/Q8 authority. Regenerate a qualified T6 or Q8 mesh; source placeholder connectivity is not solver-mesh authority.',
      };
    }
    return {
      status: 'EXACT_HEAD_QUALIFICATION_REQUIRED', formulation, poissonRatios, details,
      message: 'B-bar mechanical source and T6/Q8 mesh combination is structurally admissible. Workbench runtime state cannot claim the frozen 120-solve ν/distortion qualification or release authority.',
    };
  }

  if (formulation === FORMULATIONS.PLANE_STRESS) {
    return {
      status: 'QUALIFIED',
      formulation,
      poissonRatios,
      details: [
        ['Near-incompressible plane-strain guard', 'Not applicable to plane stress'],
        ['Guard authority', 'Source-controlled'],
      ],
      message: 'Near-incompressible plane-strain locking guard is not applicable to this plane-stress model.',
    };
  }

  if (formulation !== FORMULATIONS.PLANE_STRAIN) {
    return {
      status: 'NOT_DECLARED', formulation, poissonRatios, details: [],
      message: 'A registered continuum formulation is required.',
    };
  }

  const details = [
    ['Plane-strain advisory band', `ν ≥ ${FORMULATION_GUARDS.planeStrainPoissonWarning}`],
    ['Plane-strain qualification block', `ν ≥ ${FORMULATION_GUARDS.planeStrainPoissonBlock}`],
    ['Guard authority', 'Source-controlled; solver tolerances cannot override it'],
    ['Locking-resistant alternative', 'Plane strain — B-bar with separately qualified T6/Q8 mechanics'],
  ];
  const maximum = ratios.length ? Math.max(...ratios) : null;
  if (maximum === null) {
    return {
      status: 'NOT_DECLARED', formulation, poissonRatios: '', details,
      message: 'Material Poisson ratio is required.',
    };
  }
  if (maximum >= FORMULATION_GUARDS.planeStrainPoissonBlock) {
    return {
      status: 'BLOCKED',
      formulation,
      poissonRatios,
      details,
      message: 'Current displacement-only plane-strain authority does not qualify this near-incompressible material. The ν≥0.45 boundary remains unchanged; solver tolerances may not override it.',
    };
  }
  if (maximum >= FORMULATION_GUARDS.planeStrainPoissonWarning) {
    return {
      status: 'ADVISORY',
      formulation,
      poissonRatios,
      details,
      message: 'Model is inside the hard qualification envelope but close to the incompressible limit. Review mesh sensitivity and locking evidence before relying on local stiffness-sensitive quantities.',
    };
  }
  return {
    status: 'QUALIFIED', formulation, poissonRatios, details, message: null,
  };
}

function resultCard(root, model) {
  const canonicalStatus = model.execution.accepted ? 'ACCEPTED' : model.execution.status;
  const rows = [
    ['Status', statusLabel(canonicalStatus)],
    ['Load cases', model.execution.loadCaseCount],
  ];
  for (const metric of model.execution.metrics.slice(0, 4)) {
    rows.push([metric.label, `${format(metric.value)}${metric.unit ? ` ${metric.unit}` : ''}`]);
  }
  return summaryCard(root, 'Results', canonicalStatus, rows);
}

function summaryCard(root, title, status, rows) {
  const presentation = lafeaUiStatusPresentation(status);
  const card = element(root, 'article', 'lafea-engineering-overview__card');
  card.dataset.status = String(status);
  card.dataset.tone = presentation.tone;
  const header = element(root, 'div', 'lafea-engineering-overview__card-header');
  header.append(
    element(root, 'h3', null, title),
    element(root, 'strong', 'lafea-engineering-overview__badge', presentation.label),
  );
  const facts = element(root, 'dl', 'lafea-engineering-overview__facts');
  rows.forEach(([label, value]) => {
    facts.append(element(root, 'dt', null, String(label)), element(root, 'dd', null, String(value)));
  });
  card.append(header, facts);
  return card;
}

function qualificationBar(root, value) {
  const details = element(root, 'details', 'lafea-engineering-overview__qualification');
  details.dataset.role = 'lafea-technical-evidence';
  const summary = element(root, 'summary', null, `${value.program} qualification evidence`);
  const grid = element(root, 'div', 'lafea-engineering-overview__qualification-grid');
  [
    ['Base benchmark', value.baseRuns],
    ['B-bar ν/distortion matrix', value.bbarMatrix],
    ['Metamorphic', value.metamorphic],
    ['Fail-closed', value.failClosed],
    ['Exact-head integrated', value.exactHead],
    ['Release authority', value.releaseAuthority ? 'Granted' : 'Not granted'],
    ['Runtime scope', value.scope],
  ].forEach(([label, item]) => {
    const row = element(root, 'div');
    row.append(element(root, 'strong', null, label), element(root, 'span', null, String(item)));
    grid.append(row);
  });
  details.append(summary, grid);
  return details;
}

function continuumMetrics(resultValue, unitsValue) {
  const result = record(resultValue);
  if (!result) return [];
  const units = record(unitsValue) ?? {};
  const loadCases = array(result.loadCaseResults);
  let maxDisplacement = null;
  let maxVonMises = null;
  let maxSigmaX = null;
  let maxEnergy = null;

  for (const loadCase of loadCases) {
    for (const displacement of array(loadCase?.nodalDisplacements)) {
      const ux = finite(displacement?.ux);
      const uy = finite(displacement?.uy);
      if (ux === null || uy === null) continue;
      maxDisplacement = maxFinite(maxDisplacement, Math.hypot(ux, uy));
    }
    if (Number.isFinite(loadCase?.totalStrainEnergy)) {
      maxEnergy = maxFinite(maxEnergy, loadCase.totalStrainEnergy);
    }
    for (const elementResult of array(loadCase?.elementResults)) {
      maxVonMises = maxFinite(maxVonMises, finite(elementResult?.vonMises));
      maxSigmaX = maxAbsFinite(maxSigmaX, finite(elementResult?.stress?.sigmaX));
      for (const point of array(elementResult?.gaussPointResults)) {
        maxSigmaX = maxAbsFinite(maxSigmaX, finite(point?.stress?.sigmaX));
        maxVonMises = maxFinite(maxVonMises, finite(point?.vonMises));
      }
    }
  }

  const metrics = [];
  if (maxDisplacement !== null) metrics.push(metric('Max displacement', maxDisplacement, units.length ?? 'length-unit'));
  if (maxVonMises !== null) metrics.push(metric('Max von Mises', maxVonMises, units.stress ?? 'stress-unit'));
  if (maxSigmaX !== null) metrics.push(metric('Max |σx|', maxSigmaX, units.stress ?? 'stress-unit'));
  if (maxEnergy !== null) {
    const energyUnit = units.force && units.length ? `${units.force}·${units.length}` : 'energy-unit';
    metrics.push(metric('Max load-case elastic energy', maxEnergy, energyUnit));
  }
  return metrics;
}

function recoveryLabel(registry, elementFamilies, formulation) {
  if (registry.stageId === 'LAFEA.3' && formulation === FORMULATIONS.PLANE_STRAIN_BBAR) {
    return 'B-bar integration-point stress — retained mean dilatation (authoritative)';
  }
  if (registry.stageId === 'LAFEA.3' && elementFamilies.some((value) => value === 'T6' || value === 'Q8')) {
    return 'Integration-point stress (authoritative)';
  }
  return registry.presenterRole ?? 'Registered stage result';
}

function formulationLabel(value) {
  if (value === FORMULATIONS.PLANE_STRESS) return 'Plane stress';
  if (value === FORMULATIONS.PLANE_STRAIN) return 'Plane strain — standard displacement';
  if (value === FORMULATIONS.PLANE_STRAIN_BBAR) return 'Plane strain — B-bar (locking resistant)';
  return text(value, 'Not declared');
}

function solverRouteLabel(engine) {
  if (engine === 'src/core/local-continuum') return 'Linear continuum solver';
  if (engine === 'src/core/local-shell') return 'Linear thin-shell solver';
  if (engine === 'Not implemented') return 'Not implemented';
  return 'Registered stage solver';
}

function statusLabel(value) {
  return lafeaUiStatusPresentation(value).label;
}

function metric(label, value, unit) { return { label, value, unit }; }
function finite(value) { return Number.isFinite(value) ? value : null; }
function maxFinite(current, value) {
  if (value === null) return current;
  return current === null ? value : Math.max(current, value);
}
function maxAbsFinite(current, value) {
  if (value === null) return current;
  return maxFinite(current, Math.abs(value));
}
function unitSummary(value) {
  const units = record(value);
  if (!units) return 'Not declared';
  return Object.entries(units).map(([name, unit]) => `${name}: ${unit}`).join(' • ') || 'Not declared';
}
function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value))].sort();
}
function array(value) { return Array.isArray(value) ? value : []; }
function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : null; }
function text(value, fallback) { return typeof value === 'string' && value ? value : fallback; }
function requireRecord(value, code) {
  const result = record(value);
  if (!result) throw new TypeError(code);
  return result;
}
function format(value) {
  return Number.isFinite(value) ? Number(value.toPrecision(7)).toString() : '—';
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
