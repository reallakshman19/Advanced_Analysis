import { deepFreeze } from '../shared-piping-model/immutable.js';

const EXTERNAL_VECTOR_DEFINITIONS = Object.freeze({
  DISPLACEMENT: Object.freeze(['UX', 'UY', 'UZ']),
  ROTATION: Object.freeze(['RX', 'RY', 'RZ']),
  FORCE: Object.freeze(['UX', 'UY', 'UZ']),
  MOMENT: Object.freeze(['RX', 'RY', 'RZ']),
  GLOBAL_END_FORCE_FROM: Object.freeze(['FX', 'FY', 'FZ']),
  GLOBAL_END_FORCE_TO: Object.freeze(['FX', 'FY', 'FZ']),
  GLOBAL_END_MOMENT_FROM: Object.freeze(['MX', 'MY', 'MZ']),
  GLOBAL_END_MOMENT_TO: Object.freeze(['MX', 'MY', 'MZ']),
});

/**
 * Build coordinate-invariant and conditioning evidence without changing the
 * literal component comparison. Inputs are normalized ACCDB report records;
 * output is deterministic reporting evidence with no tolerance fallback.
 */
export function buildBenchmarkEngineeringAssessment({
  caseRecords,
  qualification,
  actual,
  equilibriumTolerance,
  policy,
}) {
  requireAssessmentInput(caseRecords, qualification, actual, equilibriumTolerance, policy);
  const qualifiedCases = new Map(qualification.cases.map((entry) => [String(entry.caseId), entry]));
  const selectedCaseRecords = caseRecords.filter((entry) => qualifiedCases.has(String(entry.caseId)));
  const externalRows = selectedCaseRecords.flatMap((entry) => comparisonRows(qualifiedCases, entry.caseId)
    .filter(isLiteralExternalRow));
  const restraintRows = externalRows.filter((row) =>
    row.entityKind === 'NODE' && ['FORCE', 'MOMENT'].includes(row.quantity));

  return deepFreeze({
    schema: 'lfea-benchmark-engineering-assessment/v1',
    policy,
    literalExternalComponents: summarizeLiteralRows(externalRows),
    restraintComponents: summarizeLiteralRows(restraintRows),
    equilibriumResidualDisposition: buildEquilibriumResidualDisposition(
      selectedCaseRecords,
      qualifiedCases,
      policy.equilibriumOnlyQuantities,
    ),
    vectorGroups: buildVectorAssessment(selectedCaseRecords, qualifiedCases, policy),
    physicalEquilibrium: buildPhysicalEquilibrium(
      selectedCaseRecords,
      actual,
      equilibriumTolerance,
    ),
    linearCaseConditioning: buildLinearConditioning(
      caseRecords,
      qualifiedCases,
      actual,
      policy.linearCaseConditioning,
    ),
  });
}

function buildEquilibriumResidualDisposition(caseRecords, qualifiedCases, quantities) {
  const selected = new Set(quantities.map(String));
  const rows = caseRecords.flatMap((record) => comparisonRows(qualifiedCases, record.caseId)
    .filter((row) => selected.has(String(row.quantity))));
  const unexpected = rows.filter((row) => row.status !== 'NOT_COMPARED');
  return {
    status: unexpected.length === 0 ? 'PASS' : 'FAIL',
    comparisonRole: 'PHYSICAL_EQUILIBRIUM_ONLY',
    reason: 'Equilibrium residuals are each checked against zero; residual-to-residual relative comparison is not physical.',
    quantities: [...selected].sort(compareText),
    counts: {
      total: rows.length,
      excludedFromRelativeComparison: rows.length - unexpected.length,
      unexpectedComparisonStatus: unexpected.length,
    },
  };
}

function requireAssessmentInput(caseRecords, qualification, actual, equilibriumTolerance, policy) {
  if (!Array.isArray(caseRecords)) throw new TypeError('Engineering assessment caseRecords must be an array.');
  if (!Array.isArray(qualification?.cases)) throw new TypeError('Engineering assessment qualification cases are required.');
  if (actual?.schema !== 'lfea-accdb-benchmark-actual/v1') {
    throw new TypeError('Engineering assessment requires an ACCDB actual-result package.');
  }
  for (const [field, value] of Object.entries({
    forceN: equilibriumTolerance?.forceN,
    momentNm: equilibriumTolerance?.momentNm,
    vectorRelativeTolerance: policy?.vectorRelativeTolerance,
  })) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      throw new TypeError(`Engineering assessment ${field} must be finite and nonnegative.`);
    }
  }
  if (!Array.isArray(policy?.equilibriumOnlyQuantities)) {
    throw new TypeError('Engineering assessment equilibriumOnlyQuantities must be an array.');
  }
  if (policy?.linearCaseConditioning?.mode !== 'FORMULA_SUPERPOSITION') {
    throw new TypeError('Engineering assessment requires FORMULA_SUPERPOSITION conditioning mode.');
  }
  if (!Array.isArray(policy.linearCaseConditioning.caseIds)) {
    throw new TypeError('Engineering assessment linear case IDs must be an array.');
  }
  if (!Number.isFinite(Number(policy.linearCaseConditioning.superpositionRelativeTolerance))
    || Number(policy.linearCaseConditioning.superpositionRelativeTolerance) < 0) {
    throw new TypeError('Engineering assessment superposition tolerance must be finite and nonnegative.');
  }
}

function comparisonRows(qualifiedCases, caseId) {
  const rows = qualifiedCases.get(String(caseId))?.comparison?.rows;
  if (!Array.isArray(rows)) throw new TypeError(`Qualification comparison rows are missing for ${caseId}.`);
  return rows;
}

function isLiteralExternalRow(row) {
  return ['PASS', 'FAIL'].includes(row.status)
    && Object.prototype.hasOwnProperty.call(EXTERNAL_VECTOR_DEFINITIONS, row.quantity);
}

function summarizeLiteralRows(rows) {
  const failed = rows.filter((row) => row.status === 'FAIL');
  const exactZero = failed.filter((row) => Number(row.referenceValue) === 0);
  return {
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    counts: {
      compared: rows.length,
      passed: rows.length - failed.length,
      failed: failed.length,
      exactZeroFailed: exactZero.length,
      nonzeroFailed: failed.length - exactZero.length,
    },
    failuresByCase: countBy(failed, (row) => row.caseId),
  };
}

function buildVectorAssessment(caseRecords, qualifiedCases, policy) {
  const cases = {};
  const allGroups = [];
  for (const caseRecord of caseRecords) {
    const rows = comparisonRows(qualifiedCases, caseRecord.caseId).filter(isLiteralExternalRow);
    const groups = groupVectorRows(rows).map((entry) => assessVectorGroup(
      caseRecord.caseId,
      entry,
      Number(policy.vectorRelativeTolerance),
    ));
    const failed = groups.filter((entry) => entry.status === 'FAIL');
    const literalFailVectorPass = groups.filter((entry) =>
      entry.status === 'PASS' && entry.literalFailedComponents.length > 0);
    cases[caseRecord.caseId] = {
      status: failed.length === 0 ? 'PASS' : 'FAIL',
      counts: {
        compared: groups.length,
        passed: groups.length - failed.length,
        failed: failed.length,
        literalFailVectorPass: literalFailVectorPass.length,
      },
      failures: failed,
      literalFailVectorPasses: literalFailVectorPass,
    };
    allGroups.push(...groups);
  }
  const failures = allGroups.filter((entry) => entry.status === 'FAIL');
  return {
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    comparisonRule: 'EUCLIDEAN_VECTOR_ERROR_WITH_MAX_RELATIVE_AND_ZERO_REFERENCE_ABSOLUTE_LIMIT_V1',
    counts: {
      compared: allGroups.length,
      passed: allGroups.length - failures.length,
      failed: failures.length,
      literalFailVectorPass: allGroups.filter((entry) =>
        entry.status === 'PASS' && entry.literalFailedComponents.length > 0).length,
    },
    cases,
  };
}

function groupVectorRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const expected = EXTERNAL_VECTOR_DEFINITIONS[row.quantity];
    if (!expected.includes(row.component)) continue;
    const identity = [row.entityKind, row.entityId, row.quantity].join(':');
    if (!groups.has(identity)) groups.set(identity, { identity, rows: [] });
    groups.get(identity).rows.push(row);
  }
  return [...groups.values()].sort((left, right) => compareText(left.identity, right.identity));
}

function assessVectorGroup(caseId, entry, relativeTolerance) {
  const first = entry.rows[0];
  const components = EXTERNAL_VECTOR_DEFINITIONS[first.quantity];
  const byComponent = new Map(entry.rows.map((row) => [row.component, row]));
  const missing = components.filter((component) => !byComponent.has(component));
  if (missing.length > 0 || entry.rows.length !== components.length) {
    throw new TypeError(`Vector group ${caseId}:${entry.identity} has incomplete component coverage.`);
  }
  const ordered = components.map((component) => byComponent.get(component));
  const reference = ordered.map((row) => Number(row.referenceValue));
  const actual = ordered.map((row) => Number(row.actualValue));
  const error = actual.map((value, index) => value - reference[index]);
  const referenceNorm = Math.hypot(...reference);
  const actualNorm = Math.hypot(...actual);
  const errorNorm = Math.hypot(...error);
  const zeroReferenceAbsoluteLimit = Math.hypot(...ordered.map((row) =>
    Number(row.tolerance?.zeroReferenceAbsolute ?? 0)));
  const acceptanceLimit = Math.max(
    zeroReferenceAbsoluteLimit,
    relativeTolerance * referenceNorm,
  );
  const relativeError = referenceNorm === 0 ? null : errorNorm / referenceNorm;
  return {
    caseId: String(caseId),
    entityKind: first.entityKind,
    entityId: first.entityId,
    quantity: first.quantity,
    unit: first.unit,
    components,
    reference,
    actual,
    referenceNorm,
    actualNorm,
    errorNorm,
    relativeError,
    percentError: relativeError === null ? null : relativeError * 100,
    acceptanceLimit,
    zeroReferenceAbsoluteLimit,
    literalFailedComponents: ordered.filter((row) => row.status === 'FAIL').map((row) => row.component),
    status: errorNorm <= acceptanceLimit ? 'PASS' : 'FAIL',
  };
}

function buildPhysicalEquilibrium(caseRecords, actual, tolerance) {
  const cases = {};
  for (const caseRecord of caseRecords) {
    const reference = caseRecord.equilibrium;
    const solver = actual.mechanics?.cases?.[caseRecord.caseId]?.recoveredEquilibrium;
    if (!reference?.maximumAbsoluteResidual || !solver?.maximumAbsoluteResidual) {
      throw new TypeError(`Physical equilibrium evidence is missing for ${caseRecord.caseId}.`);
    }
    const referenceForce = finiteNonnegative(reference.maximumAbsoluteResidual.forceN, 'reference force residual');
    const referenceMoment = finiteNonnegative(reference.maximumAbsoluteResidual.momentNm, 'reference moment residual');
    const solverForce = finiteNonnegative(solver.maximumAbsoluteResidual.forceN, 'solver force residual');
    const solverMoment = finiteNonnegative(solver.maximumAbsoluteResidual.momentNm, 'solver moment residual');
    const referenceStatus = referenceForce <= tolerance.forceN && referenceMoment <= tolerance.momentNm
      ? 'PASS' : 'FAIL';
    const solverStatus = solverForce <= tolerance.forceN && solverMoment <= tolerance.momentNm
      ? 'PASS' : 'FAIL';
    cases[caseRecord.caseId] = {
      status: referenceStatus === 'PASS' && solverStatus === 'PASS' ? 'PASS' : 'FAIL',
      referenceStatus,
      solverStatus,
      referenceMaximumAbsoluteResidual: { forceN: referenceForce, momentNm: referenceMoment },
      solverMaximumAbsoluteResidual: { forceN: solverForce, momentNm: solverMoment },
    };
  }
  const failures = Object.values(cases).filter((entry) => entry.status === 'FAIL').length;
  return {
    status: failures === 0 ? 'PASS' : 'FAIL',
    comparisonRule: 'REFERENCE_AND_SOLVER_CLOSURE_EACH_AGAINST_ZERO_WITH_ENGINEERING_CAP_V1',
    tolerance: { forceN: Number(tolerance.forceN), momentNm: Number(tolerance.momentNm) },
    counts: { compared: caseRecords.length, passed: caseRecords.length - failures, failed: failures },
    cases,
  };
}

function buildLinearConditioning(caseRecords, qualifiedCases, actual, policy) {
  const requested = new Set(policy.caseIds.map(String));
  const records = caseRecords.filter((entry) => requested.has(String(entry.caseId))
    && qualifiedCases.has(String(entry.caseId)));
  const missing = [...requested].filter((caseId) => !records.some((entry) => String(entry.caseId) === caseId));
  if (missing.length > 0) throw new TypeError(`Linear conditioning cases are unavailable: ${missing.join(', ')}.`);
  const signatures = resolveCaseSignatures(caseRecords);
  const operator = commonLinearOperator(records, actual);
  const primitiveByToken = primitiveRepresentatives(records, signatures);
  const cases = {};
  for (const record of records) {
    const caseId = String(record.caseId);
    const signature = signatures.get(caseId);
    const representative = representativeForSignature(signature, primitiveByToken);
    if (representative === caseId) {
      cases[caseId] = primitiveConditioningCase(record, qualifiedCases, signature);
    } else if (representative !== null) {
      cases[caseId] = duplicateConditioningCase(
        record,
        representative,
        qualifiedCases,
        signature,
        Number(policy.superpositionRelativeTolerance),
      );
    } else {
      cases[caseId] = derivedConditioningCase(
        record,
        signature,
        primitiveByToken,
        qualifiedCases,
        Number(policy.superpositionRelativeTolerance),
      );
    }
  }
  const derived = Object.values(cases).filter((entry) => entry.classification !== 'PRIMITIVE');
  const failed = derived.filter((entry) => entry.status !== 'PASS');
  return {
    status: operator.status === 'PASS' && failed.length === 0 ? 'PASS' : 'FAIL',
    rule: 'COMMON_OPERATOR_FORMULA_SUPERPOSITION_AND_PROPAGATED_COMPONENT_ERROR_V1',
    operator,
    primitiveRepresentatives: Object.fromEntries([...primitiveByToken.entries()].sort(([left], [right]) =>
      compareText(left, right))),
    counts: {
      primitiveCases: Object.values(cases).filter((entry) => entry.classification === 'PRIMITIVE').length,
      duplicateCases: Object.values(cases).filter((entry) => entry.classification === 'DUPLICATE_LINEAR_SIGNATURE').length,
      derivedCases: Object.values(cases).filter((entry) => entry.classification === 'DERIVED_LINEAR_COMBINATION').length,
      primitiveFailedRows: Object.values(cases).filter((entry) => entry.classification === 'PRIMITIVE')
        .reduce((sum, entry) => sum + entry.literalExternalFailedRows, 0),
      primitiveNonzeroFailedRows: Object.values(cases).filter((entry) => entry.classification === 'PRIMITIVE')
        .reduce((sum, entry) => sum + entry.literalExternalNonzeroFailedRows, 0),
      primitiveExactZeroFailedRows: Object.values(cases).filter((entry) => entry.classification === 'PRIMITIVE')
        .reduce((sum, entry) => sum + entry.literalExternalExactZeroFailedRows, 0),
      duplicateFailedRows: Object.values(cases).filter((entry) => entry.classification === 'DUPLICATE_LINEAR_SIGNATURE')
        .reduce((sum, entry) => sum + entry.literalExternalFailedRows, 0),
      derivedFailedRows: Object.values(cases).filter((entry) => entry.classification === 'DERIVED_LINEAR_COMBINATION')
        .reduce((sum, entry) => sum + entry.literalExternalFailedRows, 0),
    },
    cases,
  };
}

function commonLinearOperator(records, actual) {
  const hashes = records.map((record) => actual.cases?.[record.caseId]?.stiffnessStateHash ?? null);
  const missing = hashes.filter((value) => value === null).length;
  const distinct = [...new Set(hashes.filter((value) => value !== null).map(String))].sort(compareText);
  const nonzeroFrictionCases = records.filter((record) =>
    Number(actual.mechanics?.cases?.[record.caseId]?.effectiveConfiguration?.friction?.value) !== 0)
    .map((record) => String(record.caseId));
  return {
    status: missing === 0 && distinct.length === 1 && nonzeroFrictionCases.length === 0 ? 'PASS' : 'FAIL',
    commonStiffnessStateHash: missing === 0 && distinct.length === 1 ? distinct[0] : null,
    missingHashCount: missing,
    distinctStiffnessStateHashes: distinct,
    nonzeroFrictionCases,
  };
}

function primitiveConditioningCase(record, qualifiedCases, signature) {
  const rows = comparisonRows(qualifiedCases, record.caseId).filter(isLiteralExternalRow);
  const failed = rows.filter((row) => row.status === 'FAIL');
  return {
    caseId: String(record.caseId),
    formula: record.formula,
    signature: signatureObject(signature),
    classification: 'PRIMITIVE',
    status: 'PASS',
    literalExternalFailedRows: failed.length,
    literalExternalNonzeroFailedRows: failed.filter((row) => Number(row.referenceValue) !== 0).length,
    literalExternalExactZeroFailedRows: failed.filter((row) => Number(row.referenceValue) === 0).length,
  };
}

function duplicateConditioningCase(
  record,
  representative,
  qualifiedCases,
  signature,
  superpositionRelativeTolerance,
) {
  const targetRows = comparisonRows(qualifiedCases, record.caseId).filter(isLiteralExternalRow);
  const sourceRows = rowMap(comparisonRows(qualifiedCases, representative).filter(isLiteralExternalRow));
  const failedRows = targetRows.filter((row) => row.status === 'FAIL');
  const evidence = failedRows.map((row) => {
    const source = sourceRows.get(caseIndependentIdentity(row));
    if (!source) throw new TypeError(`Duplicate case ${record.caseId} is missing source row ${caseIndependentIdentity(row)}.`);
    const referenceDifference = Number(row.referenceValue) - Number(source.referenceValue);
    const actualDifference = Number(row.actualValue) - Number(source.actualValue);
    const tolerance = superpositionTolerance([
      row.referenceValue,
      source.referenceValue,
      row.actualValue,
      source.actualValue,
    ], superpositionRelativeTolerance);
    return {
      rowIdentity: caseIndependentIdentity(row),
      sourceCaseId: representative,
      referenceDifference,
      actualDifference,
      tolerance,
      status: Math.abs(referenceDifference) <= tolerance && Math.abs(actualDifference) <= tolerance
        ? 'PASS' : 'FAIL',
    };
  });
  return {
    caseId: String(record.caseId),
    formula: record.formula,
    signature: signatureObject(signature),
    classification: 'DUPLICATE_LINEAR_SIGNATURE',
    representativeCaseId: representative,
    status: evidence.every((entry) => entry.status === 'PASS') ? 'PASS' : 'FAIL',
    literalExternalFailedRows: failedRows.length,
    failedRowEvidence: evidence,
  };
}

function derivedConditioningCase(
  record,
  signature,
  primitiveByToken,
  qualifiedCases,
  superpositionRelativeTolerance,
) {
  const contributors = [...signature.entries()].map(([token, coefficient]) => {
    const caseId = primitiveByToken.get(token);
    if (caseId === undefined) throw new TypeError(`No primitive case represents load term ${token}.`);
    return { token, coefficient, caseId };
  });
  const contributorRows = new Map(contributors.map((entry) => [
    entry.caseId,
    rowMap(comparisonRows(qualifiedCases, entry.caseId).filter(isLiteralExternalRow)),
  ]));
  const failedRows = comparisonRows(qualifiedCases, record.caseId)
    .filter(isLiteralExternalRow)
    .filter((row) => row.status === 'FAIL');
  const evidence = failedRows.map((row) => {
    const identity = caseIndependentIdentity(row);
    const terms = contributors.map((entry) => {
      const source = contributorRows.get(entry.caseId).get(identity);
      if (!source) throw new TypeError(`Derived case ${record.caseId} is missing ${entry.caseId}:${identity}.`);
      return {
        ...entry,
        referenceValue: Number(source.referenceValue),
        actualValue: Number(source.actualValue),
        literalStatus: source.status,
        zeroReferenceAbsolute: Number(source.tolerance?.zeroReferenceAbsolute ?? 0),
      };
    });
    const predictedReference = terms.reduce((sum, term) => sum + term.coefficient * term.referenceValue, 0);
    const predictedActual = terms.reduce((sum, term) => sum + term.coefficient * term.actualValue, 0);
    const referenceValue = Number(row.referenceValue);
    const actualValue = Number(row.actualValue);
    const numericTolerance = superpositionTolerance([
      predictedReference,
      predictedActual,
      referenceValue,
      actualValue,
      ...terms.flatMap((term) => [term.referenceValue, term.actualValue]),
    ], superpositionRelativeTolerance);
    const referenceCensoringLimit = terms.reduce((sum, term) =>
      sum + (term.referenceValue === 0
        ? Math.abs(term.coefficient) * term.zeroReferenceAbsolute
        : 0), 0);
    const referenceTolerance = numericTolerance + referenceCensoringLimit;
    const actualTolerance = numericTolerance;
    const superpositionPass = Math.abs(predictedReference - referenceValue) <= referenceTolerance
      && Math.abs(predictedActual - actualValue) <= actualTolerance;
    const constituentsPass = terms.every((term) => term.literalStatus === 'PASS');
    const referenceAbsoluteContributionSum = terms.reduce((sum, term) =>
      sum + Math.abs(term.coefficient * term.referenceValue), 0);
    return {
      rowIdentity: identity,
      referenceValue,
      actualValue,
      predictedReference,
      predictedActual,
      numericTolerance,
      referenceCensoringLimit,
      referenceTolerance,
      actualTolerance,
      referenceCancellationFactor: referenceValue === 0
        ? null : referenceAbsoluteContributionSum / Math.abs(referenceValue),
      constituentsPass,
      superpositionPass,
      classification: constituentsPass && superpositionPass
        ? 'CANCELLATION_AMPLIFIED_LITERAL_COMPONENT' : 'UNRESOLVED_DERIVED_FAILURE',
      status: constituentsPass && superpositionPass ? 'PASS' : 'FAIL',
      terms,
    };
  });
  return {
    caseId: String(record.caseId),
    formula: record.formula,
    signature: signatureObject(signature),
    classification: 'DERIVED_LINEAR_COMBINATION',
    contributors,
    status: evidence.every((entry) => entry.status === 'PASS') ? 'PASS' : 'FAIL',
    literalExternalFailedRows: failedRows.length,
    failedRowEvidence: evidence,
  };
}

function resolveCaseSignatures(caseRecords) {
  const records = new Map(caseRecords.map((record) => [String(record.caseId), record]));
  const cache = new Map();
  function resolveCase(caseId, stack) {
    if (cache.has(caseId)) return cache.get(caseId);
    if (stack.includes(caseId)) throw new TypeError(`Circular CAESAR load-case formula: ${[...stack, caseId].join(' -> ')}.`);
    const record = records.get(caseId);
    if (!record) return new Map([[caseId, 1]]);
    const formula = formulaExpression(record);
    const terms = parseSignedTerms(formula);
    const signature = new Map();
    for (const term of terms) {
      const resolved = records.has(term.token) && term.token !== caseId
        ? resolveCase(term.token, [...stack, caseId])
        : new Map([[term.token, 1]]);
      for (const [token, coefficient] of resolved) {
        signature.set(token, (signature.get(token) ?? 0) + term.sign * coefficient);
      }
    }
    for (const [token, coefficient] of signature) {
      if (coefficient === 0) signature.delete(token);
    }
    cache.set(caseId, signature);
    return signature;
  }
  for (const caseId of records.keys()) resolveCase(caseId, []);
  return cache;
}

function formulaExpression(record) {
  const formula = String(record.formula ?? '').replace(/\s+/gu, '').toUpperCase();
  if (formula === '') throw new TypeError(`CAESAR case ${record.caseId} has no formula.`);
  const parts = formula.split('=');
  if (parts.length === 1) return parts[0];
  if (parts.length !== 2 || parts[0] !== String(record.caseId).toUpperCase() || parts[1] === '') {
    throw new TypeError(`Unsupported CAESAR assignment formula ${formula} for ${record.caseId}.`);
  }
  return parts[1];
}

function parseSignedTerms(expression) {
  const matches = expression.match(/[+-]?[^+-]+/gu) ?? [];
  if (matches.length === 0 || matches.join('') !== expression) {
    throw new TypeError(`Unsupported CAESAR linear formula ${expression}.`);
  }
  return matches.map((value) => {
    const sign = value.startsWith('-') ? -1 : 1;
    const token = value.replace(/^[+-]/u, '');
    if (!/^[A-Z][A-Z0-9_.]*$/u.test(token)) {
      throw new TypeError(`Unsupported CAESAR linear formula token ${token}.`);
    }
    return { token, sign };
  });
}

function primitiveRepresentatives(records, signatures) {
  const result = new Map();
  const ordered = [...records].sort((left, right) =>
    Number(left.lcaseNumber) - Number(right.lcaseNumber) || compareText(left.caseId, right.caseId));
  for (const record of ordered) {
    if (String(record.formula).includes('=')) continue;
    const signature = signatures.get(String(record.caseId));
    if (signature.size !== 1) continue;
    const [[token, coefficient]] = signature;
    if (coefficient === 1 && !result.has(token)) result.set(token, String(record.caseId));
  }
  return result;
}

function representativeForSignature(signature, primitiveByToken) {
  if (signature.size !== 1) return null;
  const [[token, coefficient]] = signature;
  return coefficient === 1 ? primitiveByToken.get(token) ?? null : null;
}

function signatureObject(signature) {
  return Object.fromEntries([...signature.entries()].sort(([left], [right]) => compareText(left, right)));
}

function rowMap(rows) {
  return new Map(rows.map((row) => [caseIndependentIdentity(row), row]));
}

function caseIndependentIdentity(row) {
  return [row.entityKind, row.entityId, row.quantity, row.component].join(':');
}

function superpositionTolerance(values, relativeTolerance) {
  const scale = Math.max(...values.map((value) => Math.abs(Number(value))));
  return Math.max(512 * Number.EPSILON * scale, relativeTolerance * scale);
}

function finiteNonnegative(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${field} must be finite and nonnegative.`);
  return number;
}

function countBy(rows, keyOf) {
  const counts = {};
  for (const row of rows) {
    const key = String(keyOf(row));
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => compareText(left, right)));
}

function compareText(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}
