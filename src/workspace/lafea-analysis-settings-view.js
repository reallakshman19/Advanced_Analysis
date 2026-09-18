/** Governed projection of analysis/solver settings with explicit source-authority controls. */
import {
  FORMULATION_GUARDS,
  FORMULATIONS,
} from '../core/local-continuum/index.js';
import { createLafeaInfoDisclosure, rowsFromLafeaItems } from './lafea-info-disclosure.js';
import { element } from './lafea-workbench-dom.js';
import { lafeaUiStatusPresentation } from './lafea-ui-status.js';

export const LAFEA_ANALYSIS_SETTINGS_VIEW_SCHEMA = 'lafea-analysis-settings-view/v1';

const FORMULATION_LABELS = Object.freeze({
  [FORMULATIONS.PLANE_STRESS]: 'Plane stress',
  [FORMULATIONS.PLANE_STRAIN]: 'Plane strain — standard displacement',
  [FORMULATIONS.PLANE_STRAIN_BBAR]: 'Plane strain — B-bar (locking resistant)',
});

export function buildLafeaAnalysisSettingsViewModel(stageValue, registryEntryValue = null) {
  const stage = requireStage(stageValue);
  const registry = registryEntry(registryEntryValue);
  const documentValue = stage.document ?? null;
  const profile = documentValue?.qualificationProfile ?? null;
  const requests = documentValue?.resultRequests ?? null;

  const modelRows = compactRows([
    row('Model identity', textValue(documentValue?.modelIdentity)),
    row('Model version', textValue(documentValue?.modelVersion)),
    row('Formulation', formulationLabel(documentValue?.formulation)),
    row('Thickness policy', textValue(documentValue?.thicknessBasis?.policy)),
    row('Requested analyses / cases', requestSummary(requests)),
    row('Unit basis', unitSummary(documentValue?.units)),
    row('Code / allowable basis', codeBasisSummary(documentValue)),
    row('Load combinations', loadCombinationSummary(documentValue)),
    row('Stress quantity', textValue(documentValue?.analysisSettings?.stressQuantity)),
    row('Allowable value', allowableValueSummary(documentValue)),
  ]);

  const solverRows = compactRows([
    row('Registered engine', registry.enginePackage ? `src/core/${registry.enginePackage}` : null),
    row('Registered authority', registry.authority),
    row('Engine state', registry.engineState),
    row('Result presenter', registry.presenterRole),
    row('Lifecycle profile', textValue(stage.lifecycle?.profileId)),
    row('Lifecycle source binding', textValue(stage.lifecycleBinding?.status)),
    row('Qualification profile', qualificationProfileLabel(profile)),
    row('Source schema', textValue(documentValue?.schema)),
  ]);

  const solverSummaryRows = compactRows([
    row('Solver route', solverRouteLabel(registry.enginePackage)),
    row('Availability', registry.engineState ? statusLabel(registry.engineState) : null),
    row('Source binding', stage.lifecycleBinding?.status ? statusLabel(stage.lifecycleBinding.status) : null),
    row('Qualification profile', governedToleranceEntries(profile).length || profile?.identity ? 'Configured' : null),
  ]);

  return freeze({
    schema: LAFEA_ANALYSIS_SETTINGS_VIEW_SCHEMA,
    stageId: stage.stageId,
    readOnly: false,
    sourcePresent: Boolean(documentValue),
    modelRows,
    solverRows,
    solverSummaryRows,
    rows: [...modelRows, ...solverRows],
    formulationControl: stage.stageId === 'LAFEA.3'
      ? buildFormulationControl(stage, documentValue)
      : null,
    recoveryDisclosure: recoveryDisclosure(stage.stageId, documentValue),
    qualificationDetails: qualificationDetails(profile),
    limitations: [...registry.limitations, ...stringArray(documentValue?.limitations)],
  });
}

export function renderLafeaAnalysisSettings(
  root,
  stageValue,
  registryEntryValue = null,
  handlers = {},
) {
  if (!root?.ownerDocument) throw new TypeError('LAFEA_ANALYSIS_SETTINGS_ROOT_REQUIRED');
  const model = buildLafeaAnalysisSettingsViewModel(stageValue, registryEntryValue);
  const section = element(root, 'section', 'lafea-analysis-settings');
  section.dataset.role = 'lafea-analysis-settings';
  section.dataset.readOnly = 'false';
  section.dataset.sourcePresent = String(model.sourcePresent);
  section.append(element(
    root,
    'p',
    'lafea-analysis-settings__intro',
    'Configure only the stage-authorized analysis choices here. Source identity, solver custody and qualification metadata remain available as supporting evidence without occupying the primary workflow.',
  ));

  if (model.formulationControl) {
    section.append(formulationControl(root, stageValue, model.formulationControl, handlers));
  }

  const groups = element(root, 'div', 'lafea-analysis-settings__groups');
  groups.dataset.role = 'lafea-analysis-settings-primary';
  groups.append(
    settingsGroup(root, {
      title: 'Model-declared analysis settings',
      authority: 'MODEL_SOURCE',
      visibleRows: [],
      infoTitle: 'Source metadata',
      infoRows: model.modelRows,
      emptyText: 'Load a governed source model to view source-declared analysis settings.',
    }),
    settingsGroup(root, {
      title: 'Solver readiness',
      authority: 'GOVERNED_SOLVER',
      visibleRows: model.solverSummaryRows.filter((item) => (
        item.label === 'Availability' || item.label === 'Source binding'
      )),
      infoTitle: 'Solver contract metadata',
      infoRows: model.solverSummaryRows,
      emptyText: 'Solver readiness is not established until governed solver and source-binding evidence exist.',
    }),
  );
  section.append(groups);
  if (model.solverRows.length) section.append(technicalSettings(root, model.solverRows));

  if (model.recoveryDisclosure) {
    section.append(textDisclosure(root, 'Recovery policy', model.recoveryDisclosure, 'lafea-solver-recovery-policy'));
  }

  if (model.qualificationDetails.length) {
    const details = element(root, 'details', 'lafea-analysis-settings__details');
    details.dataset.role = 'lafea-technical-evidence';
    details.append(element(root, 'summary', null, `Locked qualification tolerances (${model.qualificationDetails.length})`));
    const qualificationList = element(root, 'ul');
    model.qualificationDetails.forEach((value) => qualificationList.append(element(root, 'li', null, value)));
    details.append(qualificationList);
    section.append(details);
  }

  if (model.limitations.length) {
    const limitations = element(root, 'details', 'lafea-analysis-settings__details');
    limitations.append(element(root, 'summary', null, `Current solver/stage limitations (${model.limitations.length})`));
    const limitationList = element(root, 'ul');
    model.limitations.forEach((value) => limitationList.append(element(root, 'li', null, value)));
    limitations.append(limitationList);
    section.append(limitations);
  }
  return section;
}

function formulationControl(root, stageValue, control, handlers) {
  const card = element(root, 'section', 'lafea-analysis-settings__group');
  card.dataset.role = 'lafea3-formulation-selector';
  card.dataset.authority = 'MODEL_SOURCE';
  card.dataset.status = control.status;
  card.dataset.sourcePresent = String(control.sourcePresent);

  const heading = element(root, 'div', 'lafea-analysis-settings__group-heading');
  const basisRows = compactPairs([
    ['Current', formulationLabel(control.current)],
    ['Poisson ratio(s)', control.poissonRatios || null],
    ['Retained mesh families', control.retainedMeshFamilies || null],
    ['B-bar element authority', 'T6 / Q8 only; actual T3 solver mesh blocks before stiffness assembly'],
    ['B-bar temperature authority', 'Not granted — temperature/eigenstrain loads are blocked'],
    ['Legacy plane-strain hard block', `ν ≥ ${FORMULATION_GUARDS.planeStrainPoissonBlock}`],
    ['Qualification state', statusLabel(control.status)],
  ]);
  heading.append(
    element(root, 'h3', null, 'Continuum formulation'),
    createLafeaInfoDisclosure(root.ownerDocument, 'Continuum formulation basis', basisRows, {
      role: 'lafea3-formulation-info',
      className: 'lafea-analysis-settings__info',
    }),
    element(root, 'span', 'lafea-analysis-settings__lock', 'Source input'),
  );

  const select = element(root, 'select');
  select.dataset.role = 'lafea3-formulation-select';
  select.disabled = !control.editable || typeof handlers.onApplyJson !== 'function';
  if (!control.current) {
    const placeholder = element(root, 'option', null, control.sourcePresent
      ? 'Select source formulation'
      : 'No source model loaded');
    placeholder.value = '';
    placeholder.selected = true;
    placeholder.disabled = true;
    select.append(placeholder);
  }
  for (const optionValue of control.options) {
    const option = element(root, 'option', null, optionValue.label);
    option.value = optionValue.value;
    option.selected = optionValue.value === control.current;
    option.disabled = optionValue.disabled;
    if (optionValue.reason) option.title = optionValue.reason;
    select.append(option);
  }

  const status = element(root, 'p', 'lafea-analysis-settings__recovery', control.message);
  status.dataset.role = 'lafea3-formulation-selector-status';
  status.dataset.status = control.status;
  select.addEventListener('change', () => {
    if (!select.value || typeof handlers.onApplyJson !== 'function' || !stageValue?.document) return;
    const next = structuredClone(stageValue.document);
    next.formulation = select.value;
    handlers.onApplyJson(`${JSON.stringify(next, null, 2)}\n`);
  });
  card.append(heading, select, status);
  return card;
}

function buildFormulationControl(stage, documentValue) {
  const sourcePresent = Boolean(documentValue && typeof documentValue === 'object');
  const current = typeof documentValue?.formulation === 'string'
    ? documentValue.formulation
    : null;
  const ratios = (documentValue?.materials ?? [])
    .map((row) => Number.isFinite(row?.poissonRatio) ? row.poissonRatio : null)
    .filter((value) => value !== null);
  const maximumNu = ratios.length ? Math.max(...ratios) : null;
  const hasTemperature = (documentValue?.loadCases ?? []).some(
    (loadCase) => Array.isArray(loadCase?.temperatureLoads) && loadCase.temperatureLoads.length > 0,
  );
  const retainedMesh = stage.retainedAnalysisMeshEvidenceV2?.mesh
    ?? stage.retainedAnalysisMeshEvidence?.mesh
    ?? null;
  const retainedFamilies = [...new Set((retainedMesh?.elements ?? [])
    .map((row) => row?.elementType)
    .filter((value) => typeof value === 'string'))].sort();
  const retainedT3 = retainedFamilies.includes('T3');
  const standardBlocked = maximumNu !== null
    && maximumNu >= FORMULATION_GUARDS.planeStrainPoissonBlock;
  const options = [
    { value: FORMULATIONS.PLANE_STRESS, label: FORMULATION_LABELS[FORMULATIONS.PLANE_STRESS] },
    {
      value: FORMULATIONS.PLANE_STRAIN,
      label: FORMULATION_LABELS[FORMULATIONS.PLANE_STRAIN],
      disabled: standardBlocked && current !== FORMULATIONS.PLANE_STRAIN,
      reason: standardBlocked
        ? `Current material has ν ≥ ${FORMULATION_GUARDS.planeStrainPoissonBlock}; the displacement-only plane-strain formulation remains outside its qualified envelope.`
        : null,
    },
    {
      value: FORMULATIONS.PLANE_STRAIN_BBAR,
      label: FORMULATION_LABELS[FORMULATIONS.PLANE_STRAIN_BBAR],
      disabled: hasTemperature && current !== FORMULATIONS.PLANE_STRAIN_BBAR,
      reason: hasTemperature
        ? 'B-bar thermal/eigenstrain authority is not yet qualified. Remove temperature loads before selecting B-bar.'
        : null,
    },
  ].map((item) => freeze({ ...item, disabled: Boolean(item.disabled) }));

  let status;
  let message;
  if (!sourcePresent) {
    status = 'SOURCE_REQUIRED';
    message = 'Load a governed LAFEA.3 source model before selecting a continuum formulation.';
  } else if (!current) {
    status = 'SOURCE_FORMULATION_REQUIRED';
    message = 'The current source model does not declare a continuum formulation. Select one before analysis can proceed.';
  } else if (current === FORMULATIONS.PLANE_STRESS) {
    status = 'QUALIFIED_SOURCE_INPUT';
    message = 'Plane stress uses the existing qualified continuum route.';
  } else if (current === FORMULATIONS.PLANE_STRAIN) {
    if (standardBlocked) {
      status = 'BLOCKED';
      message = `Standard displacement plane strain is blocked for ν ≥ ${FORMULATION_GUARDS.planeStrainPoissonBlock}.`;
    } else if (maximumNu !== null && maximumNu >= FORMULATION_GUARDS.planeStrainPoissonWarning) {
      status = 'ADVISORY';
      message = 'Standard displacement plane strain is inside the hard source envelope but near the incompressible limit; use B-bar for the separately qualified locking-resistant route.';
    } else {
      status = 'QUALIFIED_SOURCE_INPUT';
      message = 'Standard displacement plane strain retains the existing source-controlled incompressibility guard.';
    }
  } else if (current === FORMULATIONS.PLANE_STRAIN_BBAR) {
    if (hasTemperature) {
      status = 'BLOCKED';
      message = 'B-bar temperature/eigenstrain loading is not qualified.';
    } else if (retainedT3) {
      status = 'MESH_REGENERATION_REQUIRED';
      message = 'The retained mesh contains T3. Regenerate a T6 or Q8 mesh before B-bar solve authorization; source placeholder T3 connectivity is not solver authority.';
    } else if (retainedFamilies.length === 0) {
      status = 'MESH_REQUIRED';
      message = 'B-bar source selection is valid for mechanical loading; generate and qualify a T6 or Q8 mesh before solving.';
    } else {
      status = 'EXACT_HEAD_QUALIFICATION_REQUIRED';
      message = 'T6/Q8 B-bar mechanical route is configured. Exact-head frozen ν/distortion qualification evidence is required before any broader release claim.';
    }
  } else {
    status = 'SOURCE_FORMULATION_UNRECOGNIZED';
    message = `The source formulation ${current} is not recognized by this LAFEA.3 settings control.`;
  }

  return freeze({
    current,
    sourcePresent,
    editable: sourcePresent,
    poissonRatios: ratios.join(', '),
    retainedMeshFamilies: retainedFamilies.join(' / '),
    hasTemperature,
    status,
    message,
    options,
  });
}

function settingsGroup(root, configuration) {
  const {
    title, authority, visibleRows, infoTitle, infoRows, emptyText,
  } = configuration;
  const group = element(root, 'section', 'lafea-analysis-settings__group');
  group.dataset.authority = authority;
  const heading = element(root, 'div', 'lafea-analysis-settings__group-heading');
  heading.append(element(root, 'h3', null, title));
  if (infoRows?.length) {
    heading.append(createLafeaInfoDisclosure(
      root.ownerDocument,
      infoTitle,
      rowsFromLafeaItems(infoRows),
      { className: 'lafea-analysis-settings__info' },
    ));
  }
  heading.append(element(
    root,
    'span',
    'lafea-analysis-settings__lock',
    authority === 'GOVERNED_SOLVER' ? 'Governed' : 'Source',
  ));
  group.append(heading);
  if (visibleRows?.length) {
    const list = element(root, 'dl', 'lafea-analysis-settings__list');
    for (const item of visibleRows) {
      list.append(
        element(root, 'dt', null, item.label),
        element(root, 'dd', null, item.value),
      );
    }
    group.append(list);
  } else if (!infoRows?.length && emptyText) {
    group.append(element(root, 'p', 'lafea-analysis-settings__recovery', emptyText));
  }
  return group;
}

function technicalSettings(root, rows) {
  const details = element(root, 'details', 'lafea-analysis-settings__details');
  details.dataset.role = 'lafea-technical-evidence';
  details.append(element(root, 'summary', null, 'Technical identifiers and lifecycle custody'));
  const list = element(root, 'dl', 'lafea-analysis-settings__list');
  for (const item of rows) {
    list.append(
      element(root, 'dt', null, item.label),
      element(root, 'dd', null, item.value),
    );
  }
  details.append(list);
  return details;
}

function textDisclosure(root, title, text, role) {
  const details = element(root, 'details', 'lafea-analysis-settings__details');
  details.dataset.role = role;
  details.append(
    element(root, 'summary', null, title),
    element(root, 'p', 'lafea-analysis-settings__recovery', text),
  );
  return details;
}

function registryEntry(value) {
  if (!value || typeof value !== 'object') {
    return { enginePackage: null, authority: null, engineState: null, presenterRole: null, limitations: [] };
  }
  return {
    enginePackage: typeof value.enginePackage === 'string' ? value.enginePackage : null,
    authority: typeof value.authority === 'string' ? value.authority : null,
    engineState: typeof value.engineState === 'string' ? value.engineState : null,
    presenterRole: typeof value.presenterRole === 'string' ? value.presenterRole : null,
    limitations: stringArray(value.limitations),
  };
}

function recoveryDisclosure(stageId, documentValue) {
  if (stageId !== 'LAFEA.3' || !documentValue) return null;
  if (documentValue?.formulation === FORMULATIONS.PLANE_STRAIN_BBAR) {
    return 'B-bar T6/Q8 stress uses pointwise deviatoric strain plus the retained element-mean dilatation used by stiffness. Integration-point stress remains authoritative; projected nodal stress is display-only.';
  }
  const families = [...new Set((documentValue?.elements ?? [])
    .map((item) => item?.elementType)
    .filter((value) => typeof value === 'string'))];
  if (families.some((value) => value === 'T6' || value === 'Q8')) {
    return 'T6/Q8 integration-point stress is authoritative; projected nodal stress is display-only.';
  }
  return 'Recovery authority follows the registered LAFEA.3 continuum result contract.';
}

function requestSummary(value) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value.requestedAnalyses) && value.requestedAnalyses.length) return value.requestedAnalyses.join(', ');
  if (Array.isArray(value.loadCaseIds) && value.loadCaseIds.length) return `Load cases: ${value.loadCaseIds.join(', ')}`;
  if (Array.isArray(value.transformedLoadCaseIdentities) && value.transformedLoadCaseIdentities.length) {
    return `Load cases: ${value.transformedLoadCaseIdentities.join(', ')}`;
  }
  return null;
}

function unitSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rows = Object.entries(value)
    .filter(([, unit]) => typeof unit === 'string' && unit)
    .map(([quantity, unit]) => `${quantity}: ${unit}`);
  return rows.length ? rows.join(' • ') : null;
}

function codeBasisSummary(documentValue) {
  if (!documentValue || typeof documentValue !== 'object') return null;
  const direct = displayValue(documentValue.codeBasis);
  if (direct) return direct;
  const settings = documentValue.analysisSettings;
  return settings && typeof settings === 'object' ? displayValue(settings.codeBasis) : null;
}

function loadCombinationSummary(documentValue) {
  const factors = documentValue?.analysisSettings?.loadCombinationFactors;
  if (!factors || typeof factors !== 'object' || Array.isArray(factors)) return null;
  const rows = Object.entries(factors)
    .map(([caseId, factor]) => `${caseId}: ${factor}`);
  return rows.length ? rows.join(', ') : null;
}

function allowableValueSummary(documentValue) {
  const val = documentValue?.analysisSettings?.allowableValue;
  if (typeof val === 'number') return String(val);
  if (!val || typeof val !== 'object') return null;
  if (typeof val.value === 'number') return `${val.value} ${val.unit ?? ''}`.trim();
  return null;
}

/**
 * Two governed profile shapes reach this view and only one carries a name.
 * The LAFEA.3 continuum profile is `{schema, identity, tolerances}`; the
 * LAFEA.4 shell profile is a flat record of governed tolerance entries with no
 * schema, identity or wrapper. Reading `identity` alone reported a shell run
 * whose every acceptance gate is governed -- choleskyPivot, freeDofResidual,
 * force/moment equilibrium, strainEnergyReconstruction -- as "Not declared",
 * which says the opposite of the truth. Name it when it has a name, and
 * otherwise say how many entries govern the run.
 */
function qualificationProfileLabel(profile) {
  const identity = textValue(profile?.identity);
  if (identity) return identity;
  const entries = governedToleranceEntries(profile);
  if (!entries.length) return null;
  return `Declared — ${entries.length} governed ${entries.length === 1 ? 'tolerance' : 'tolerances'}`;
}

/** Governed tolerance entries from either profile shape, nested or flat. */
function governedToleranceEntries(profile) {
  if (!profile || typeof profile !== 'object') return [];
  const source = profile.tolerances && typeof profile.tolerances === 'object'
    ? profile.tolerances
    : profile;
  return Object.entries(source).filter(([quantity, rule]) => (
    quantity !== 'tolerances'
    && rule
    && typeof rule === 'object'
    && !Array.isArray(rule)
    && ['absolute', 'relative', 'minimum'].some((key) => Number.isFinite(rule[key]))
  ));
}

function qualificationDetails(profile) {
  if (!profile || typeof profile !== 'object') return [];
  const rows = [];
  if (typeof profile.schema === 'string') rows.push(`Schema: ${profile.schema}`);
  if (Number.isFinite(profile.frameMinimumSine)) rows.push(`Frame minimum sine: ${profile.frameMinimumSine}`);
  if (Number.isFinite(profile.handednessMinimumAlignment)) rows.push(`Handedness minimum alignment: ${profile.handednessMinimumAlignment}`);
  for (const [quantity, rule] of governedToleranceEntries(profile)) {
    const parts = [];
    if (Number.isFinite(rule.absolute)) parts.push(`absolute: ${rule.absolute}`);
    if (Number.isFinite(rule.relative)) parts.push(`relative: ${rule.relative}`);
    if (Number.isFinite(rule.minimum)) parts.push(`minimum: ${rule.minimum}`);
    rows.push(`${quantity} tolerance — ${parts.join(', ')}`);
  }
  return rows;
}

function displayValue(value) {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const fields = Object.entries(value)
    .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
    .map(([key, item]) => `${key}: ${item}`);
  return fields.length ? fields.join(' • ') : null;
}

function formulationLabel(value) {
  return FORMULATION_LABELS[value] ?? textValue(value);
}
function solverRouteLabel(enginePackage) {
  if (enginePackage === 'local-continuum') return 'Linear continuum solver';
  if (enginePackage === 'local-shell') return 'Linear thin-shell solver';
  if (!enginePackage) return null;
  return 'Registered stage solver';
}
function statusLabel(value) { return lafeaUiStatusPresentation(value).label; }
function row(label, value) { return { label, value }; }
function compactRows(rows) {
  return rows.filter((item) => item && item.value !== null && item.value !== undefined && item.value !== '')
    .map((item) => freeze(item));
}
function compactPairs(rows) {
  return rows.filter((item) => Array.isArray(item) && item.length >= 2
    && item[1] !== null && item[1] !== undefined && item[1] !== '');
}
function textValue(value) { return typeof value === 'string' && value ? value : null; }
function stringArray(value) { return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item) : []; }
function requireStage(value) {
  if (!value || typeof value !== 'object' || typeof value.stageId !== 'string') throw new TypeError('LAFEA_ANALYSIS_SETTINGS_STAGE_REQUIRED');
  return value;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
