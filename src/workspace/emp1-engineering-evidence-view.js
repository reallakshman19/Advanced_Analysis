/** Read-only EMP.1 engineering custody presentation. No DOM value is calculation authority. */
import {
  EMP1_PROFESSIONAL_WRC_LOCATIONS,
  emp1StressDisplayNumber,
  emp1StressExactNumber,
  emp1UnitLabel,
  emp1UnitedLabel,
  governingEightPointStressIntensity,
} from './emp1-professional-result-presentation.js';
import { card, element } from './lafea-workbench-dom.js';
import { renderEmp1GammaDomain } from './emp1-gamma-domain-view.js';
import {
  emp1PlainLanguageLabel,
  emp1PlainLanguageLabelRequired,
} from './emp1-plain-language-labels.js';

const FORCE_NAMES = Object.freeze(['Fx', 'Fy', 'Fz']);
const MOMENT_NAMES = Object.freeze(['Mx', 'My', 'Mz']);
const WRC_LOCATIONS = EMP1_PROFESSIONAL_WRC_LOCATIONS;

export function renderEmp1StageEngineeringEvidence(root, stageId, stage, projection) {
  if (stageId === 'LAFEA.1') return renderStageA(root, stage);
  if (stageId === 'LAFEA.2') return renderStageB(root, stage, projection);
  return null;
}

export function renderEmp1BoundedCorrelationEvidence(root, projection) {
  const result = card(root, 'EMP.1.C bounded local-correlation authority');
  result.section.dataset.role = 'emp1-c-bounded-evidence';
  result.section.dataset.guidedTarget = 'emp1-c-bounded-evidence';
  const c = projection?.steps?.find((step) => step.shortId === 'C');
  const routes = Array.isArray(c?.boundedProductionRoutes) ? c.boundedProductionRoutes : [];

  if (!routes.length) {
    result.body.append(element(root, 'p', 'lafea-workbench-svg__empty',
      'No bounded local-correlation route is registered in this product projection.'));
    return result.section;
  }

  const summary = element(root, 'p', 'lafea-workbench__section-intro',
    `${routes.length} governed bounded capabilities are registered. Inspect one capability at a time; global EMP.1.C and code-compliance release remain separately governed.`);
  summary.dataset.role = 'emp1-c-route-capability-summary';
  result.body.append(summary);

  const tabs = element(root, 'div', null);
  tabs.dataset.role = 'emp1-c-route-capability-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'EMP.1.C registered bounded capabilities');
  const buttons = [];
  const panels = [];
  const defaultIndex = Math.max(0, routes.findIndex((route) => route.engineeringUseAuthorized === true));

  routes.forEach((route, index) => {
    const button = element(root, 'button', null, routeCapabilityLabel(route));
    button.type = 'button';
    button.dataset.role = 'emp1-c-route-capability-tab';
    button.dataset.routeId = String(route.routeId ?? 'UNRESOLVED');
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.tabIndex = index === defaultIndex ? 0 : -1;
    buttons.push(button);
    tabs.append(button);

    const panel = renderRouteCapabilityPanel(root, route);
    panel.hidden = true;
    panels.push(panel);

    button.addEventListener('click', () => activateRouteCapability(buttons, panels, index));
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = (index + direction + buttons.length) % buttons.length;
      buttons[next]?.focus?.();
      buttons[next]?.click?.();
    });
  });

  result.body.append(tabs, ...panels);
  activateRouteCapability(buttons, panels, defaultIndex);

  const authorized = routes.find((route) => route.engineeringUseAuthorized) ?? routes[0];
  const gammaDetails = element(root, 'details', 'lafea-workbench__custody-details');
  gammaDetails.dataset.role = 'emp1-c-gamma-domain-detail';
  gammaDetails.append(
    element(root, 'summary', null, 'Shell parameter domain and curve-selection policy'),
    renderEmp1GammaDomain(root, {
      routeGamma: authorized?.scope?.gamma ?? null,
      requestedGamma: authorized?.scope?.gamma ?? null,
    }),
  );
  result.body.append(gammaDetails);
  return result.section;
}

function renderRouteCapabilityPanel(root, route) {
  const panel = element(root, 'div', null);
  panel.dataset.role = 'emp1-c-route-capability-panel';
  panel.dataset.routeId = String(route.routeId ?? 'UNRESOLVED');
  panel.dataset.authorized = String(route.engineeringUseAuthorized === true);
  panel.setAttribute('role', 'tabpanel');

  const status = element(root, 'strong', 'lafea-result-highlights__status',
    route.engineeringUseAuthorized
      ? 'Engineering use authorized · bounded capability'
      : 'Engineering use not authorized · comparison capability only');
  status.dataset.role = 'emp1-c-bounded-route-status';
  status.dataset.authorized = String(route.engineeringUseAuthorized === true);
  status.dataset.routeId = String(route.routeId ?? 'UNRESOLVED');

  panel.append(status, keyValueTable(root, [
    ['Method', `WRC 537 (${route.method?.edition ?? 'edition unresolved'})`],
    ['Shell / attachment', `${engineeringTerm(route.scope?.shellFamily)} / ${engineeringTerm(route.scope?.attachmentShape)}`],
    ['Curve variant', engineeringTerm(route.scope?.variant)],
    ['γ', gammaCapabilityText(route)],
    ['β domain', betaDomainText(route)],
    ['Differential pressure', route.scope?.differentialPressure],
    ['Kn / Kb', `${engineeringNumber(route.scope?.Kn)} / ${engineeringNumber(route.scope?.Kb)}`],
    ['Interpolation', interpolationCapabilityText(route)],
    ['Release qualified', yesNo(route.releaseQualified)],
  ]));

  const authority = element(root, 'details', 'lafea-workbench__custody-details');
  authority.dataset.role = 'emp1-c-route-detail';
  authority.append(
    element(root, 'summary', null, 'Route authority details'),
    keyValueTable(root, [
      ['WRC load-axis authority', human(route.scope?.cylindricalLoadAxisAuthority)],
      ['WRC +P rule', human(route.scope?.wrcPositivePRule)],
      ['Runtime source-polarity evidence', requiredHuman(
        route.scope?.runtimeSourcePolarityEvidenceRequired === true ? 'REQUIRED' : 'UNRESOLVED',
      )],
      ['Raw foundation eZ is WRC polarity authority', yesNo(
        route.scope?.rawFoundationRadialHintIsPolarityAuthority,
      )],
      ['Cross-variant fallback', requiredHuman(
        route.scope?.crossVariantFallbackAllowed === false ? 'PROHIBITED' : 'UNRESOLVED',
      )],
      ['Global EMP.1.C authority', yesNo(route.globalEmp1CRouteAuthority)],
    ]),
    technicalRouteDetails(root, route),
  );

  const blocked = element(root, 'details', 'lafea-workbench__authority');
  blocked.dataset.role = 'emp1-c-route-limitations';
  const blockedValues = route.remainingBlocked ?? [];
  blocked.append(element(root, 'summary', null,
    `Route limitations (${blockedValues.length})`));
  const list = element(root, 'ul');
  blockedValues.forEach((code) => list.append(element(root, 'li', null, human(code))));
  blocked.append(list);
  panel.append(authority, blocked);
  return panel;
}

function activateRouteCapability(buttons, panels, index) {
  buttons.forEach((button, candidate) => {
    const selected = candidate === index;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  panels.forEach((panel, candidate) => {
    const selected = candidate === index;
    panel.hidden = !selected;
    panel.dataset.emp1RouteCapabilityActive = String(selected);
  });
}

function routeCapabilityLabel(route) {
  if (Number.isFinite(route.scope?.gamma)) {
    return `γ ${engineeringNumber(route.scope.gamma)} exact · ${route.engineeringUseAuthorized ? 'Authorized' : 'Not authorized'}`;
  }
  return route.engineeringUseAuthorized
    ? 'Variable γ · Authorized'
    : 'Interpolated γ · Comparison only';
}

function gammaCapabilityText(route) {
  if (Number.isFinite(route.scope?.gamma)) return `${engineeringNumber(route.scope.gamma)} · exact tabulated row`;
  const rows = Array.isArray(route.scope?.tabulatedGammaRows) ? route.scope.tabulatedGammaRows : [];
  return rows.length ? `Between tabulated rows: ${rows.join(', ')}` : 'Unresolved';
}

function betaDomainText(route) {
  const minimum = route.scope?.betaMinimum;
  const maximum = route.scope?.betaMaximum;
  if (Number.isFinite(minimum) && Number.isFinite(maximum)) {
    return `${engineeringNumber(minimum)} ≤ β ≤ ${engineeringNumber(maximum)}`;
  }
  return human(route.scope?.betaDomainBasis ?? 'UNRESOLVED');
}

function interpolationCapabilityText(route) {
  if (route.scope?.interpolationAllowed === false) return 'Not permitted';
  if (route.scope?.interpolationAllowed === true) {
    return route.engineeringUseAuthorized
      ? 'Permitted by governing route authority'
      : 'Comparison-qualified policy; engineering use not authorized';
  }
  return 'Unresolved';
}

export function renderEmp1CorrelationResultEvidence(root, localCorrelation) {
  if (!localCorrelation || typeof localCorrelation !== 'object') return null;
  const result = card(root, 'EMP.1.C WRC calculation evidence');
  result.section.dataset.role = 'emp1-c-result-evidence';
  const custody = localCorrelation.sourceCustody;
  const numerics = localCorrelation.numerics;
  const geometry = custody?.geometry ?? numerics?.geometry;
  if (geometry) {
    result.body.append(sectionHeading(root, 'Source-bound WRC geometry'));
    result.body.append(keyValueTable(root, [
      ['Rm', geometry.meanRadius],
      ['T', geometry.shellThickness],
      ['r0', geometry.attachmentRadius],
      ['γ = Rm/T', geometry.gamma],
      ['β = 0.875 r0/Rm', geometry.beta],
      ['Geometry evidence hash', custody?.geometryEvidenceHash],
    ]));
  }
  if (custody?.loadReference || custody?.axes) {
    result.body.append(sectionHeading(root, 'Reference and foundation-frame custody'));
    result.body.append(keyValueTable(root, [
      ['Reference identity', custody?.loadReference?.identity],
      ['Reference point global', vectorText(custody?.loadReference?.pointGlobal)],
      ['Foundation vessel eX', vectorText(custody?.axes?.vesselCenterlineGlobal)],
      ['Foundation radial eZ — unoriented line', vectorText(custody?.axes?.nozzleCenterlineGlobal)],
      ['Foundation result hash', custody?.foundationResultHash],
      ['Screening result hash', custody?.screeningResultHash],
    ]));
  }
  const axis = custody?.wrcAxisAuthority ?? localCorrelation?.axisAuthority;
  if (axis) {
    result.body.append(sectionHeading(root, 'Source-qualified WRC load-axis polarity'));
    result.body.append(keyValueTable(root, [
      ['Axis authority state', human(axis.state)],
      ['Axis authority identity', axis.authorityId],
      ['Source point global', vectorText(axis.sourcePointGlobal)],
      ['Attachment target global', vectorText(axis.targetPointGlobal)],
      ['Raw radial-line alignment with +P', axis.sourceToTargetRadialAlignment],
      ['+P', vectorText(axis.basisGlobal?.P)],
      ['+Vc', vectorText(axis.basisGlobal?.Vc)],
      ['+Vl', vectorText(axis.basisGlobal?.Vl)],
      ['+Mc moment axis', vectorText(axis.basisGlobal?.Mc)],
      ['+Ml moment axis', vectorText(axis.basisGlobal?.Ml)],
      ['+Mt moment axis', vectorText(axis.basisGlobal?.Mt)],
      ['Axis source SHA-256', axis.sourceDocumentSha256],
    ]));
  }
  const units = numerics?.units;
  if (numerics?.wrcLoads) {
    result.body.append(sectionHeading(root, 'WRC attachment-reference loads'));
    result.body.append(keyValueTable(root, [
      ['P', units?.force], ['Vc', units?.force], ['Vl', units?.force],
      ['Mc', units?.moment], ['Ml', units?.moment], ['Mt', units?.moment],
    ].map(([key, unit]) => [emp1UnitedLabel(key, unit), numerics.wrcLoads[key]])));
  }
  const stresses = localCorrelation.stresses;
  if (stresses?.stressIntensity?.length === WRC_LOCATIONS.length) {
    result.body.append(sectionHeading(root, 'Eight-location shell stress trace'));
    result.body.append(wrcStressTable(root, stresses, units?.stress));
    result.body.append(wrcStressFullPrecisionDetails(root, stresses, units?.stress));
    result.body.append(renderWrcProfessionalScope(
      root,
      governingEightPointStressIntensity(stresses.stressIntensity),
      units?.stress,
    ));
  }
  return result.section;
}

function renderWrcProfessionalScope(root, governing, stressUnit) {
  const scope = element(root, 'div', 'lafea-workbench__authority');
  scope.dataset.role = 'emp1-c-eight-point-governing';
  const governingValue = governing.state === 'AVAILABLE'
    ? `${governing.location} · stress intensity `
      + `${emp1StressDisplayNumber(governing.stressIntensity)} `
      + `${emp1UnitLabel(stressUnit) ?? 'unit unresolved'}`
    : `UNRESOLVED · ${human(governing.reason)}`;
  scope.append(
    element(root, 'strong', null, 'Professional WRC result scope'),
    keyValueTable(root, [
      ['Governing among eight evaluated WRC points', governingValue],
      ['Evaluated locations', governing.evaluatedLocations.join(', ')],
      ['Envelope basis', human(governing.basis)],
      ['Continuous/global shell maximum', 'NOT CLAIMED'],
      ['Stress result domain', 'HOST CYLINDRICAL SHELL AT ATTACHMENT–SHELL JUNCTURE'],
      ['Nozzle / attachment-wall stress', 'NOT CALCULATED'],
      ['Continuous juncture search', 'NOT PERFORMED'],
      ['Code compliance', 'NOT ESTABLISHED BY THIS WRC RESULT'],
    ]),
    element(root, 'p', null,
      'The governing value above is the maximum retained stress intensity among Au, Al, Bu, Bl, Cu, Cl, Du and Dl only. It is not a continuous or global shell maximum. Engineering judgment remains required outside these evaluated locations.'),
  );
  return scope;
}

function renderStageA(root, stage) {
  const result = card(root, 'EMP.1.A load, reference and axis custody');
  result.section.dataset.role = 'emp1-a-engineering-custody';
  const execution = retainedResult(stage);
  if (!execution) {
    const status = element(root, 'strong', 'lafea-result-highlights__status', 'EMP.1.A custody · Not retained');
    status.dataset.role = 'emp1-a-custody-status';
    result.body.append(
      status,
      element(root, 'p', 'lafea-workbench__section-intro',
        'Run EMP.1.A to retain transformed resultants, target reference and coordinate frame.'),
    );
    return result.section;
  }

  const frame = execution.coordinateSystemEvidence ?? {};
  const loadCases = execution.transformedLoadCases ?? [];
  const pressureRows = execution.pressureStressResults ?? [];
  const status = element(root, 'strong', 'lafea-result-highlights__status', 'EMP.1.A custody · Retained');
  status.dataset.role = 'emp1-a-custody-status';
  result.body.append(status, keyValueTable(root, [
    ['Coordinate system', frame.identity],
    ['Transformed load cases', loadCases.length],
    ['Pressure results', pressureRows.length],
    ['WRC polarity authority from raw foundation eZ', 'No'],
  ]));

  const details = element(root, 'details', 'lafea-workbench__custody-details');
  details.dataset.role = 'emp1-a-custody-detail';
  details.append(
    element(root, 'summary', null, 'Retained load / reference / axis detail'),
    element(root, 'p', 'lafea-workbench__section-intro',
      'These vectors are retained calculation evidence. EMP.1.C derives WRC polarity from source-qualified vessel-axis and load-reference geometry; foundation eZ is only a radial line.'),
    sectionHeading(root, 'Retained coordinate basis'),
    keyValueTable(root, [
      ['Coordinate system', frame.identity],
      ['Origin global', vectorText(frame.originGlobal)],
      ['eX — pipe/vessel axis', vectorText(frame.axesGlobal?.eX)],
      ['eY — circumferential axis', vectorText(frame.axesGlobal?.eY)],
      ['eZ — radial line, polarity not WRC authority', vectorText(frame.axesGlobal?.eZ)],
      ['Handedness', frame.handedness],
      ['Orthogonality residual', frame.orthogonalityResidual],
    ]),
    sectionHeading(root, 'Transferred load cases'),
    loadCaseTable(root, loadCases),
    sectionHeading(root, 'Pressure disposition'),
    pressureTable(root, pressureRows),
  );
  result.body.append(details);
  return result.section;
}

function renderStageB(root, stage, projection) {
  const result = card(root, 'EMP.1.B geometry, thickness and A→B custody');
  result.section.dataset.role = 'emp1-b-engineering-custody';
  const execution = retainedResult(stage);
  const source = stage?.document?.sourceEvidence;
  const model = source?.foundationModel;
  const section = execution?.sectionProperties;
  const currentness = projection?.custody?.bSourceEvidenceState ?? 'UNRESOLVED';
  const current = human(currentness);
  const status = element(root, 'strong', 'lafea-result-highlights__status', `A → B ${current}`);
  status.dataset.role = 'emp1-b-engineering-currentness';
  status.dataset.state = currentness;
  result.body.append(status);

  if (!model) {
    result.body.append(element(root, 'p', 'lafea-workbench-svg__empty',
      'Load a valid EMP.1.B request to inspect retained A geometry lineage.'));
    return result.section;
  }
  const ro = section?.outerRadius ?? model.pipeGeometry?.outsideDiameter?.value / 2;
  const t = section?.assessmentPipeThickness ?? model.thicknessBasis?.assessmentPipeThickness?.value;
  const rm = Number.isFinite(ro) && Number.isFinite(t) ? ro - t / 2 : null;
  result.body.append(keyValueTable(root, [
    ['Pipe OD', model.pipeGeometry?.outsideDiameter?.value],
    ['Assessment thickness T', t],
    ['Mean radius Rm', rm],
    ['Retained screening result', execution ? 'Available' : 'Not retained'],
  ]));

  const details = element(root, 'details', 'lafea-workbench__custody-details');
  details.dataset.role = 'emp1-b-custody-detail';
  details.append(
    element(root, 'summary', null, 'Geometry lineage and retained ancestry'),
    sectionHeading(root, 'Section geometry lineage'),
    keyValueTable(root, [
      ['Pipe OD', model.pipeGeometry?.outsideDiameter?.value],
      ['Assessment thickness T', t],
      ['Outer radius', ro],
      ['Inner radius', section?.innerRadius],
      ['Mean radius Rm = Ro − T/2', rm],
      ['OD source', section?.sourceReferences?.outsideDiameter ?? model.pipeGeometry?.outsideDiameter?.sourceRef],
      ['Thickness source', section?.sourceReferences?.assessmentPipeThickness ?? model.thicknessBasis?.assessmentPipeThickness?.sourceRef],
    ]),
    sectionHeading(root, 'Retained ancestry'),
    keyValueTable(root, [
      ['Foundation model hash', model.semanticHash],
      ['Foundation result hash', source?.foundationResult?.semanticHashes?.resultPayloadSemanticHash],
      ['Screening request hash', stage?.document?.semanticHash],
      ['Screening result hash', execution?.semanticHashes?.screeningResultPayloadSemanticHash],
    ]),
  );
  if (execution?.limitations?.length) {
    const limits = element(root, 'details', 'lafea-workbench__authority');
    limits.append(element(root, 'summary', null, `Screening limitations (${execution.limitations.length})`));
    const list = element(root, 'ul');
    execution.limitations.forEach((value) => list.append(element(root, 'li', null, human(value))));
    limits.append(list);
    details.append(limits);
  }
  result.body.append(details);
  return result.section;
}

function loadCaseTable(root, rows) {
  const table = element(root, 'table', 'lafea-result-table');
  appendHeader(root, table, ['Load case', 'Action', 'Source ref', 'Target ref', ...FORCE_NAMES, ...MOMENT_NAMES]);
  if (!rows.length) appendEmptyRow(root, table, 10, 'No retained transformed load cases.');
  rows.forEach((row) => {
    const tr = element(root, 'tr');
    const identity = element(root, 'th', null, String(row.identity ?? 'UNRESOLVED'));
    identity.scope = 'row';
    tr.append(identity,
      element(root, 'td', null, human(row.canonicalActionSense ?? row.inputActionSense)),
      element(root, 'td', null, String(row.sourceReferencePointIdentity ?? '—')),
      element(root, 'td', null, `${row.targetReferencePointIdentity ?? '—'} @ ${vectorText(row.targetPointGlobal)}`));
    [...(row.transformedForceLocal ?? []).slice(0, 3), ...(row.transformedMomentLocal ?? []).slice(0, 3)]
      .forEach((value) => tr.append(element(root, 'td', null, engineeringNumber(value))));
    table.append(tr);
  });
  return table;
}

function pressureTable(root, rows) {
  const table = element(root, 'table', 'lafea-result-table');
  appendHeader(root, table, ['Pressure result', 'Definition', 'Pi', 'Po', 'Δp', 'End condition', 'Axial pressure stress', 'Limitations']);
  if (!rows.length) appendEmptyRow(root, table, 8, 'No retained pressure result.');
  rows.forEach((row) => {
    const tr = element(root, 'tr');
    const identity = element(root, 'th', null, String(row.identity ?? 'UNRESOLVED'));
    identity.scope = 'row';
    const dp = Number.isFinite(row.internalPressure) && Number.isFinite(row.externalPressure)
      ? row.internalPressure - row.externalPressure : null;
    tr.append(identity,
      element(root, 'td', null, String(row.pressureDefinitionIdentity ?? '—')),
      element(root, 'td', null, engineeringNumber(row.internalPressure)),
      element(root, 'td', null, engineeringNumber(row.externalPressure)),
      element(root, 'td', null, engineeringNumber(dp)),
      element(root, 'td', null, human(row.endCondition)),
      element(root, 'td', null, engineeringNumber(row.axialPressureStress)),
      element(root, 'td', null, (row.limitations ?? []).map(human).join('; ') || '—'));
    table.append(tr);
  });
  return table;
}

function stressRowValues(stresses, index) {
  return [
    stresses.circumferential?.[index],
    stresses.longitudinal?.[index],
    stresses.shear?.[index],
    stresses.stressIntensity?.[index],
  ];
}

/**
 * Engineer-facing Table-5 recovery. Every stress column states its governed
 * unit and shows four significant figures; the exact retained magnitude stays on
 * each cell and in the full-precision disclosure below.
 */
function wrcStressTable(root, stresses, stressUnit) {
  const table = element(root, 'table', 'lafea-result-table');
  table.dataset.role = 'emp1-c-eight-point-stress';
  appendHeader(root, table, ['Location',
    emp1UnitedLabel('σφ', stressUnit),
    emp1UnitedLabel('σx', stressUnit),
    emp1UnitedLabel('τ', stressUnit),
    emp1UnitedLabel('Stress intensity', stressUnit)]);
  WRC_LOCATIONS.forEach((location, index) => {
    const tr = element(root, 'tr');
    const identity = element(root, 'th', null, location);
    identity.scope = 'row';
    tr.append(identity, ...stressRowValues(stresses, index).map((value) => {
      const cell = element(root, 'td', null, emp1StressDisplayNumber(value));
      if (Number.isFinite(value)) cell.dataset.emp1ExactValue = emp1StressExactNumber(value);
      return cell;
    }));
    table.append(tr);
  });
  return table;
}

function wrcStressFullPrecisionDetails(root, stresses, stressUnit) {
  const details = element(root, 'details', 'lafea-workbench__custody-details');
  details.dataset.emp1RawTechnical = 'true';
  details.dataset.role = 'emp1-c-eight-point-stress-full-precision';
  const table = element(root, 'table', 'lafea-result-table');
  appendHeader(root, table, ['Location', 'σφ', 'σx', 'τ', 'Stress intensity']);
  WRC_LOCATIONS.forEach((location, index) => {
    const tr = element(root, 'tr');
    const identity = element(root, 'th', null, location);
    identity.scope = 'row';
    tr.append(identity, ...stressRowValues(stresses, index)
      .map((value) => element(root, 'td', null, emp1StressExactNumber(value))));
    table.append(tr);
  });
  details.append(
    element(root, 'summary', null,
      emp1UnitedLabel('Full-precision retained stress values', stressUnit)),
    table);
  return details;
}

function keyValueTable(root, rows) {
  const table = element(root, 'table', 'lafea-result-table');
  appendHeader(root, table, ['Engineering datum', 'Retained value']);
  rows.forEach(([label, value]) => {
    const tr = element(root, 'tr');
    const th = element(root, 'th', null, label);
    th.scope = 'row';
    tr.append(th, element(root, 'td', null, displayValue(value)));
    table.append(tr);
  });
  return table;
}

function technicalRouteDetails(root, route) {
  const details = element(root, 'details', 'lafea-workbench__custody-details');
  details.dataset.emp1RawTechnical = 'true';
  details.append(
    element(root, 'summary', null, 'Technical route identifiers'),
    keyValueTable(root, [
      ['Route ID', route.routeId],
      ['Method ID', route.method?.identity],
      ['Axis source SHA-256', route.scope?.cylindricalLoadAxisSourceSha256],
    ]),
  );
  return details;
}

function appendHeader(root, table, labels) {
  const tr = element(root, 'tr');
  labels.forEach((label) => {
    const th = element(root, 'th', null, label);
    th.scope = 'col';
    tr.append(th);
  });
  table.append(tr);
}
function appendEmptyRow(root, table, span, text) {
  const tr = element(root, 'tr');
  const td = element(root, 'td', null, text);
  td.colSpan = span;
  tr.append(td);
  table.append(tr);
}
function sectionHeading(root, text) { return element(root, 'h4', null, text); }
function retainedResult(stage) { return stage?.execution?.result ?? stage?.execution ?? null; }
function vectorText(value) {
  return Array.isArray(value) && value.length === 3
    ? `[${value.map(engineeringNumber).join(', ')}]`
    : '—';
}
function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') return engineeringNumber(value);
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return value == null || value === '' ? '—' : String(value);
}
function engineeringNumber(value) {
  if (!Number.isFinite(value)) return '—';
  return Number(value.toPrecision(10)).toString();
}
function engineeringTerm(value) {
  const terms = {
    CYLINDRICAL: 'Cylindrical shell',
    ROUND: 'Round attachment',
    ORIGINAL: 'Original',
  };
  return terms[value] ?? human(value);
}
function yesNo(value) {
  return value === true ? 'Yes' : value === false ? 'No' : 'Unresolved';
}
function human(value) {
  return emp1PlainLanguageLabel(value);
}
function requiredHuman(value) {
  return emp1PlainLanguageLabelRequired(value);
}
