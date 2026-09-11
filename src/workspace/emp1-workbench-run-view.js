import {
  EMP1_WORKBENCH_ATTACHMENT_DIAMETER_BASIS,
  EMP1_WORKBENCH_ATTACHMENT_PHYSICAL_LOCATION,
  EMP1_WORKBENCH_ATTACHMENT_STATION_BASIS,
  EMP1_WORKBENCH_BOUNDED_ROUTE_REQUEST_SCHEMA,
  EMP1_WORKBENCH_CYLINDER_LENGTH_BASIS,
  EMP1_WORKBENCH_RUN_INPUT_SCHEMA,
} from './emp1-workbench-run-state.js';
import { buildEmp1ProfessionalResultPresentation } from './emp1-professional-result-presentation.js';
import { card, element } from './lafea-workbench-dom.js';
import { emp1PlainLanguageLabel } from './emp1-plain-language-labels.js';

/**
 * Editable source-binding form for the governed EMP.1.C transaction.
 * DOM values are drafts only. They become calculation input only after the
 * controller accepts and normalizes the complete run-input command.
 */
export function renderEmp1WorkbenchRunConfiguration(root, options = {}) {
  const state = options.state ?? {};
  const aDocument = state.stages?.['LAFEA.1']?.document ?? null;
  const bDocument = state.stages?.['LAFEA.2']?.document ?? null;
  const runInput = options.runInput ?? null;
  const currentness = options.currentness ?? { state: 'NOT_RUN', reasons: [] };
  const cState = options.cState ?? null;
  const routeSuspended = cState?.productionUseAuthorized !== true;
  const suspensionReasons = routeSuspended ? cState?.blockerCodes ?? [] : [];
  const panel = card(root, 'EMP.1.C source binding and run setup');
  panel.section.dataset.role = 'emp1-c-run-configuration';
  panel.section.dataset.currentness = currentness.state;
  panel.section.dataset.cState = cState?.state ?? 'SOURCE_INCOMPLETE';
  panel.section.dataset.productionAuthority = routeSuspended ? 'SUSPENDED' : 'AVAILABLE';

  panel.body.append(element(root, 'p', 'lafea-workbench__section-intro',
    'Bind the attachment OUTSIDE diameter at the shell juncture and the WRC §4.5 cylinder geometry to engineering sources. Rm, T, WRC axes, γ, β, Kn/Kb and nearest-end distance are not editable calculation authority; nearest-end distance is derived from cylinder length and the WRC attachment reference station.'));

  const status = element(root, 'strong', 'lafea-result-highlights__status',
    `EMP.1.C: ${cState?.stageBadge ?? human(currentness.state)}`);
  status.dataset.role = 'emp1-product-currentness';
  panel.body.append(status);
  if (currentness.reasons?.length) {
    const notice = element(root, 'p', 'lafea-workbench__authority',
      currentnessRecoveryMessage(currentness.reasons));
    notice.dataset.role = 'emp1-c-currentness-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');

    const technical = element(root, 'details', 'lafea-workbench__custody-details');
    technical.dataset.role = 'emp1-c-currentness-technical';
    technical.dataset.emp1RawAllowed = 'true';
    technical.open = false;
    const reasons = element(root, 'ul');
    for (const code of uniqueText(currentness.reasons)) {
      const item = element(root, 'li');
      const diagnostic = element(root, 'code', null, code);
      diagnostic.dataset.role = 'emp1-c-currentness-reason-code';
      item.append(diagnostic);
      reasons.append(item);
    }
    technical.append(
      element(root, 'summary', null, 'Technical details'),
      element(root, 'p', null,
        'Exact retained currentness diagnostics are preserved here for traceability; they do not make stale numerical evidence current.'),
      reasons,
    );
    panel.body.append(notice, technical);
  }
  if (options.runFailure) {
    const failure = element(root, 'p', 'lafea-workbench__authority',
      `Last EMP.1 transaction failed: ${options.runFailure.code ?? options.runFailure.message ?? 'UNRESOLVED'}.`);
    failure.dataset.role = 'emp1-run-failure';
    panel.body.append(failure);
  }

  if (!aDocument || !bDocument) {
    panel.body.append(element(root, 'p', 'lafea-workbench-svg__empty',
      'Load both EMP.1.A and EMP.1.B source documents before configuring the local-correlation transaction.'));
    return panel.section;
  }

  const local = runInput?.localMethod ?? {};
  const routeRequest = local.routeRequest ?? {};
  const attachment = local.attachmentGeometry ?? {};
  const applicability = local.applicabilityGeometry ?? {};
  const lengthUnit = canonicalLengthUnit(aDocument, bDocument);
  const form = element(root, 'div', 'lafea-workbench__form');

  const loadCase = selectField(root, 'Load case at retained A target reference',
    loadCaseIdentities(aDocument), routeRequest.loadCaseIdentity, 'emp1-c-load-case');
  const pressure = selectField(root, 'Pressure result (comparison scope requires Δp = 0)',
    pressureResultIdentities(aDocument), routeRequest.pressureResultIdentity, 'emp1-c-pressure-result');
  const geometryIdentity = inputField(root, 'Attachment geometry identity',
    attachment.geometryIdentity ?? '', 'text', 'emp1-c-geometry-identity');
  const diameter = inputField(root, `Attachment outside diameter at shell juncture (${lengthUnit})`,
    finiteText(attachment.attachmentDiameter), 'number', 'emp1-c-attachment-diameter');
  diameter.input.min = '0';
  diameter.input.step = 'any';
  const sourceRef = inputField(root, 'Engineering source reference for this outside diameter',
    attachment.sourceReference ?? '', 'text', 'emp1-c-attachment-source-ref');

  const applicabilityIdentity = inputField(root, 'Cylinder geometry identity for WRC §4.5',
    applicability.geometryIdentity ?? '', 'text', 'emp1-c-applicability-geometry-identity');
  const cylinderLength = inputField(root, `Cylinder length between end planes (${lengthUnit})`,
    finiteText(applicability.cylinderLength), 'number', 'emp1-c-cylinder-length');
  cylinderLength.input.min = '0';
  cylinderLength.input.step = 'any';
  const attachmentStation = inputField(root,
    `WRC attachment reference station from cylinder start end plane (${lengthUnit})`,
    finiteText(applicability.attachmentStationFromCylinderStart),
    'number', 'emp1-c-attachment-station');
  attachmentStation.input.min = '0';
  attachmentStation.input.step = 'any';
  const cylinderLengthSource = inputField(root, 'Engineering source reference for cylinder length',
    applicability.cylinderLengthSourceReference ?? '', 'text', 'emp1-c-cylinder-length-source-ref');
  const attachmentStationSource = inputField(root,
    'Engineering source reference for WRC attachment station',
    applicability.attachmentStationSourceReference ?? '', 'text', 'emp1-c-attachment-station-source-ref');

  form.append(
    loadCase.row,
    pressure.row,
    geometryIdentity.row,
    diameter.row,
    sourceRef.row,
    applicabilityIdentity.row,
    cylinderLength.row,
    attachmentStation.row,
    cylinderLengthSource.row,
    attachmentStationSource.row,
  );

  const physicalBasis = element(root, 'p', 'lafea-workbench__authority',
    'WRC r0 basis is locked to OUTSIDE DIAMETER at the ATTACHMENT–SHELL JUNCTURE. WRC §4.5 cylinder length is measured BETWEEN CYLINDER END PLANES. The attachment station is measured from the selected cylinder start end plane to the retained WRC attachment reference point; nearest-end distance is derived as min(x, L−x) and is not directly editable.');
  physicalBasis.dataset.role = 'emp1-c-r0-physical-basis';
  const canonical = element(root, 'p', 'lafea-workbench__authority',
    `Canonical length unit: ${lengthUnit}. Enter attachment diameter, cylinder length and station in this exact unit; no UI-side unit conversion is calculation authority.`);
  canonical.dataset.role = 'emp1-c-canonical-length-unit';

  const apply = element(root, 'button', null, 'Apply C source binding');
  apply.type = 'button';
  apply.dataset.role = 'emp1-c-apply-run-input';
  apply.addEventListener('click', () => {
    sourceRef.input.setCustomValidity('');
    attachmentStationSource.input.setCustomValidity('');
    const response = options.onApply?.({
      schema: EMP1_WORKBENCH_RUN_INPUT_SCHEMA,
      localMethod: {
        routeRequest: {
          schema: EMP1_WORKBENCH_BOUNDED_ROUTE_REQUEST_SCHEMA,
          loadCaseIdentity: loadCase.input.value,
          pressureResultIdentity: pressure.input.value,
        },
        attachmentGeometry: {
          geometryIdentity: geometryIdentity.input.value.trim(),
          attachmentDiameter: Number(diameter.input.value),
          diameterBasis: EMP1_WORKBENCH_ATTACHMENT_DIAMETER_BASIS,
          physicalLocation: EMP1_WORKBENCH_ATTACHMENT_PHYSICAL_LOCATION,
          unit: lengthUnit,
          sourceReference: sourceRef.input.value.trim(),
        },
        applicabilityGeometry: {
          geometryIdentity: applicabilityIdentity.input.value.trim(),
          cylinderLengthBasis: EMP1_WORKBENCH_CYLINDER_LENGTH_BASIS,
          cylinderLength: Number(cylinderLength.input.value),
          attachmentStationBasis: EMP1_WORKBENCH_ATTACHMENT_STATION_BASIS,
          attachmentStationFromCylinderStart: Number(attachmentStation.input.value),
          unit: lengthUnit,
          cylinderLengthSourceReference: cylinderLengthSource.input.value.trim(),
          attachmentStationSourceReference: attachmentStationSource.input.value.trim(),
        },
      },
    });
    if (response?.status === 'REJECTED') {
      const target = String(response.code ?? '').includes('4_5')
        || String(response.code ?? '').includes('APPLICABILITY')
        || String(response.code ?? '').includes('STATION')
        || String(response.code ?? '').includes('CYLINDER')
        ? attachmentStationSource.input
        : sourceRef.input;
      target.setCustomValidity(response.message ?? response.code ?? 'EMP.1 source binding was rejected.');
      target.reportValidity();
    }
  });

  const boundary = element(root, 'div', 'lafea-workbench__authority');
  boundary.dataset.role = 'emp1-c-production-authority';
  if (routeSuspended) {
    boundary.append(
      element(root, 'strong', null, 'C production execution suspended'),
      element(root, 'p', null,
        'The source-bound A→B→C transaction may be prepared, but no production WRC stress result is authorized while the current C-state authority projection is not production-authorized.'),
    );
    const reasons = element(root, 'ul');
    suspensionReasons.forEach((reason) => reasons.append(element(root, 'li', null, human(reason))));
    boundary.append(reasons);
  } else {
    boundary.append(
      element(root, 'strong', null, 'Bounded C execution authority'),
      element(root, 'p', null,
        'Only the registered bounded runtime domain may execute. A successful run is not global WRC authority, code compliance, or release qualification.'),
    );
  }
  panel.body.append(form, physicalBasis, canonical, apply, boundary);
  return panel.section;
}

export function renderEmp1WorkbenchExecutionSummary(root, execution, currentness, cState = null) {
  if (!execution) return null;
  const panel = card(root, 'EMP.1 transaction evidence');
  panel.section.dataset.role = 'emp1-product-execution-summary';
  panel.section.dataset.currentness = currentness?.state ?? 'UNRESOLVED';
  panel.section.dataset.cState = cState?.state ?? 'UNRESOLVED';
  const routeExecuted = execution.authority?.boundedLocalRouteExecuted === true;
  const professional = buildEmp1ProfessionalResultPresentation({
    execution,
    currentness,
    cState,
    localCorrelation: cState?.reportableResult ?? null,
  });
  panel.body.append(renderProfessionalStatus(root, professional));
  panel.body.append(keyValueTable(root, [
    ['Transaction status', execution.status],
    ['Engineering decision', execution.decision],
    ['Currentness', currentness?.state],
    ['C state', cState?.stageBadge ?? cState?.state],
    ['C current/reportable result', cState?.currentResultAvailable === true ? 'YES' : 'NO'],
    ['C retained numerical evidence', cState?.retainedResultAvailable === true ? 'YES' : 'NO'],
    ['Execution authority hash', cState?.executionAuthorityHash
      ?? execution.authority?.routeAuthorityHash
      ?? cState?.executionAuthoritySnapshot?.semanticHash
      ?? execution.authority?.routeAuthoritySnapshot?.semanticHash],
    ['Current authority hash', cState?.currentAuthorityHash
      ?? cState?.currentAuthoritySnapshot?.semanticHash],
    ['EMP.1 source hash', execution.sourceHash],
    ['A result hash', execution.result?.loadTransfer?.resultHash],
    ['B retained evidence hash', execution.result?.sectionScreening?.resultHash],
    [routeExecuted ? 'C result hash' : 'C blocked/preparation evidence hash', execution.result?.localCorrelation?.resultHash],
    ['A/B/C invocations', invocationText(execution.invocations)],
    ['C source custody prepared', execution.authority?.boundedLocalRoutePrepared === true ? 'YES' : 'NO'],
    ['C production route executed', routeExecuted ? 'YES' : 'NO'],
    ['C suspension reasons', (execution.authority?.routeSuspensionReasons ?? []).map(human).join('; ') || '—'],
    ['Global C authority', execution.authority?.globalEmp1CRouteAuthority === true ? 'YES' : 'NO'],
    ['Code compliance produced', execution.authority?.codeComplianceProduced === true ? 'YES' : 'NO'],
    ['Release qualified', execution.authority?.releaseQualified === true ? 'YES' : 'NO'],
  ]));
  if (currentness?.state === 'STALE') {
    panel.body.append(element(root, 'p', 'lafea-workbench__authority',
      'This retained transaction is historical/stale and is excluded from current EMP.1 evidence until the transaction is rerun.'));
  }
  if (!routeExecuted && execution.authority?.routeSuspensionReasons?.length) {
    panel.body.append(element(root, 'p', 'lafea-workbench__authority',
      'No WRC stress field was produced by this transaction. A/B results and prepared C custody are retained only to support fail-closed engineering traceability.'));
  }
  const authorityEvidence = renderAuthorityEvidence(root, cState);
  if (authorityEvidence) panel.body.append(authorityEvidence);
  return panel.section;
}

function renderProfessionalStatus(root, professional) {
  const wrapper = element(root, 'div', 'lafea-workbench__authority');
  wrapper.dataset.role = 'emp1-professional-status';
  wrapper.append(
    element(root, 'strong', null, 'Professional assessment state — independent gates'),
    keyValueTable(root, [
      ['CALCULATED', yesNo(professional.status.calculated)],
      ['METHOD QUALIFIED', yesNo(professional.status.methodQualified)],
      ['CODE COMPLIANT', yesNo(professional.status.codeCompliant)],
      ['RELEASED', yesNo(professional.status.released)],
    ]),
  );
  const domain = element(root, 'div', 'lafea-workbench__custody-details');
  domain.dataset.role = 'emp1-professional-bounded-domain';
  domain.append(
    element(root, 'strong', null, 'Current bounded method/domain authority'),
    keyValueTable(root, [
      ['Route', professional.domain.routeId],
      ['Method', professional.domain.methodIdentity],
      ['Edition', professional.domain.edition],
      ['Shell / attachment', pair(professional.domain.shellFamily, professional.domain.attachmentShape)],
      ['Curve / γ', pair(professional.domain.variant, professional.domain.gamma)],
      ['β domain', range(professional.domain.betaMinimum, professional.domain.betaMaximum)],
      ['Differential pressure', professional.domain.differentialPressure],
      ['Kn / Kb', pair(professional.domain.Kn, professional.domain.Kb)],
      ['Interpolation allowed', yesNoUnknown(professional.domain.interpolationAllowed)],
      ['Cross-variant fallback allowed', yesNoUnknown(professional.domain.crossVariantFallbackAllowed)],
      ['Stress output domain', professional.domain.stressOutputDomain],
      ['Source SHA-256', professional.domain.sourceDocumentSha256],
      ['Dataset hash', professional.domain.datasetHash],
      ['Qualification hash', professional.domain.qualificationRecordSha256],
    ]),
  );
  const blockers = uniqueText([
    ...(professional.currentBlockers ?? []),
    ...(professional.routeLimitations ?? []),
    ...(professional.unsupportedDomain ?? []),
  ]);
  if (blockers.length) {
    const list = element(root, 'ul');
    list.dataset.role = 'emp1-professional-unsupported-domain';
    blockers.forEach((code) => list.append(element(root, 'li', null, human(code))));
    domain.append(element(root, 'strong', null, 'Blocked / limited outside current authority'), list);
  }
  wrapper.append(domain);
  return wrapper;
}

function renderAuthorityEvidence(root, cState) {
  if (!cState) return null;
  const current = cState.currentAuthoritySnapshot ?? null;
  const execution = cState.executionAuthoritySnapshot ?? null;
  const history = Array.isArray(cState.retainedHistoricalEvidence)
    ? cState.retainedHistoricalEvidence
    : [];
  const staleRetainedExecution = cState.retainedResultAvailable === true
    && cState.currentResultAvailable !== true
    ? cState.currentExecutionEvidence ?? null
    : null;
  if (!current && !execution && history.length === 0 && !staleRetainedExecution) return null;

  const details = element(root, 'details', 'lafea-workbench__custody-details');
  details.dataset.role = 'emp1-c-authority-evidence';
  details.dataset.currentResultAvailable = cState.currentResultAvailable === true ? 'true' : 'false';
  const summary = element(root, 'summary', null, 'C route-authority and retained historical evidence');
  details.append(summary, keyValueTable(root, [
    ['C state', cState.stageBadge ?? cState.state],
    ['Current result reportable', cState.currentResultAvailable === true ? 'YES' : 'NO'],
    ['Execution route', execution?.routeId],
    ['Execution authority hash', cState.executionAuthorityHash ?? execution?.semanticHash],
    ['Execution qualification hash', execution?.registry?.method?.qualificationRecordSha256],
    ['Execution source SHA-256', execution?.registry?.method?.sourceDocumentSha256],
    ['Execution dataset hash', execution?.registry?.method?.datasetHash],
    ['Current route', current?.routeId],
    ['Current authority hash', cState.currentAuthorityHash ?? current?.semanticHash],
    ['Current production use authorized', current?.productionUseAuthorized === true ? 'YES' : 'NO'],
    ['Current qualification hash', current?.registry?.method?.qualificationRecordSha256],
    ['Current source SHA-256', current?.registry?.method?.sourceDocumentSha256],
    ['Current dataset hash', current?.registry?.method?.datasetHash],
    ['Retained historical C records', history.length],
  ]));

  if (staleRetainedExecution) {
    const warning = element(root, 'p', 'lafea-workbench__authority',
      'The retained C execution below is historical/stale evidence only. It is explicitly excluded from the current/reportable result projection.');
    warning.dataset.role = 'emp1-c-retained-stale-result-warning';
    const payload = element(root, 'pre', 'lafea-workbench__evidence-json',
      JSON.stringify(staleRetainedExecution, null, 2));
    payload.dataset.role = 'emp1-c-retained-stale-result-payload';
    details.append(warning, payload);
  }

  if (history.length > 0) {
    const warning = element(root, 'p', 'lafea-workbench__authority',
      'Historical C records below are retained evidence only. They are not current/reportable unless the live C-state projection explicitly says so.');
    warning.dataset.role = 'emp1-c-historical-evidence-warning';
    details.append(warning);
    history.forEach((record, index) => {
      const historical = element(root, 'details', 'lafea-workbench__custody-details');
      historical.dataset.role = 'emp1-c-historical-evidence-record';
      historical.dataset.index = String(index);
      historical.append(
        element(root, 'summary', null,
          `Historical C ${index + 1} · ${record.evidenceHash ?? record.localCorrelation?.resultHash ?? 'UNHASHED'}`),
        keyValueTable(root, [
          ['Evidence hash', record.evidenceHash],
          ['Source hash', record.sourceHash],
          ['Authority hash', record.routeAuthorityHash ?? record.authoritySnapshot?.semanticHash],
          ['C result hash', record.localCorrelation?.resultHash],
        ]),
      );
      const payload = element(root, 'pre', 'lafea-workbench__evidence-json',
        JSON.stringify(record.localCorrelation ?? null, null, 2));
      payload.dataset.role = 'emp1-c-historical-result-payload';
      historical.append(payload);
      details.append(historical);
    });
  }
  return details;
}

function currentnessRecoveryMessage(reasons) {
  const codes = new Set(uniqueText(reasons));
  if (codes.has('EMP1_WORKBENCH_LOADTRANSFERDOCUMENT_CHANGED')) {
    return 'Inputs changed — recalculate load transfer before using the previous local-check result.';
  }
  if (codes.has('EMP1_WORKBENCH_SECTIONSCREENINGDOCUMENT_CHANGED')) {
    return 'Inputs changed — recalculate the section check before using the previous local-check result.';
  }
  if ([
    'EMP1_WORKBENCH_ATTACHMENTGEOMETRY_CHANGED',
    'EMP1_WORKBENCH_APPLICABILITYGEOMETRY_CHANGED',
    'EMP1_WORKBENCH_LOCALROUTE_CHANGED',
  ].some((code) => codes.has(code))) {
    return 'Local-check inputs changed — update the local-check basis and recalculate before using the previous result.';
  }
  if ([
    'EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED',
    'EMP1_WORKBENCH_C_ROUTE_AUTHORITY_SNAPSHOT_REQUIRED',
    'EMP1_WORKBENCH_C_CURRENT_ROUTE_AUTHORITY_REQUIRED',
    'EMP1_WORKBENCH_C_CURRENT_ROUTE_NOT_AUTHORIZED',
  ].some((code) => codes.has(code))) {
    return 'Method authority changed — recalculate the local check under the current qualified method before using the previous result.';
  }
  return 'Inputs changed — recalculate the affected assessment step before using the previous local-check result.';
}

function loadCaseIdentities(documentValue) {
  const requested = documentValue?.resultRequests?.transformedLoadCaseIdentities;
  if (Array.isArray(requested) && requested.length) return uniqueText(requested);
  return uniqueText((documentValue?.loadCases ?? []).map((row) => row?.identity));
}
function pressureResultIdentities(documentValue) {
  return uniqueText((documentValue?.resultRequests?.pressure ?? []).map((row) => row?.identity));
}
function canonicalLengthUnit(aDocument, bDocument) {
  return aDocument?.units?.canonical?.length
    ?? bDocument?.units?.canonical?.length
    ?? aDocument?.units?.length
    ?? 'UNRESOLVED';
}
function uniqueText(values) {
  return [...new Set((values ?? []).filter((value) => typeof value === 'string' && value.trim()))];
}
function selectField(root, labelText, values, selected, role) {
  const row = element(root, 'label');
  const label = element(root, 'span', null, labelText);
  const input = element(root, 'select');
  input.dataset.role = role;
  const blank = element(root, 'option', null, 'Select…');
  blank.value = '';
  input.append(blank);
  values.forEach((value) => {
    const option = element(root, 'option', null, value);
    option.value = value;
    option.selected = value === selected;
    input.append(option);
  });
  row.append(label, input);
  return { row, input };
}
function inputField(root, labelText, value, type, role) {
  const row = element(root, 'label');
  const label = element(root, 'span', null, labelText);
  const input = element(root, 'input');
  input.type = type;
  input.value = value;
  input.dataset.role = role;
  row.append(label, input);
  return { row, input };
}
function keyValueTable(root, rows) {
  const table = element(root, 'table', 'lafea-result-table');
  const head = element(root, 'tr');
  ['Engineering datum', 'Retained value'].forEach((label) => {
    const th = element(root, 'th', null, label);
    th.scope = 'col';
    head.append(th);
  });
  table.append(head);
  rows.forEach(([label, value]) => {
    const tr = element(root, 'tr');
    const th = element(root, 'th', null, label);
    th.scope = 'row';
    tr.append(th, element(root, 'td', null, value == null || value === '' ? '—' : String(value)));
    table.append(tr);
  });
  return table;
}
function invocationText(value) {
  if (!value) return '—';
  return `A ${value.loadTransfer ?? 0} · B ${value.sectionScreening ?? 0} · prepare C ${value.localPreparation ?? 0} · production C ${value.localCorrelation ?? 0}`;
}
function pair(first, second) {
  const left = first == null ? 'UNRESOLVED' : String(first);
  const right = second == null ? 'UNRESOLVED' : String(second);
  return `${left} / ${right}`;
}
function range(minimum, maximum) {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return 'UNRESOLVED';
  return `${minimum} ≤ β ≤ ${maximum}`;
}
function yesNo(value) { return value === true ? 'YES' : 'NO'; }
function yesNoUnknown(value) {
  return value === true ? 'YES' : value === false ? 'NO' : 'UNRESOLVED';
}
function finiteText(value) { return Number.isFinite(value) ? String(value) : ''; }
function human(value) { return emp1PlainLanguageLabel(value); }