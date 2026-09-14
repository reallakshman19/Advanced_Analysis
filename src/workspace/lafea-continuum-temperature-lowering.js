/** Governed domain-first ΔT lowering into the existing local-continuum thermal-strain contract. */

export const LAFEA_CONTINUUM_DELTA_T_LAW = 'CONSTANT_ALPHA_DELTA_T_V1';
export const LAFEA_CONTINUUM_THERMAL_MATERIAL_AUTHORITY_SCHEMA =
  'lafea-continuum-thermal-material-authority/v1';

const BBAR_FORMULATION = 'PLANE_STRAIN_BBAR';

export function appendLafeaDeltaTemperatureLoads({ loadCase, attachment, model }) {
  if (!loadCase || !attachment || !model) fail('LAFEA_CONTINUUM_COMPILED_TEMPERATURE_INPUT_REQUIRED');
  if (model.formulation === BBAR_FORMULATION) {
    fail('LAFEA_CONTINUUM_COMPILED_TEMPERATURE_BBAR_NOT_QUALIFIED');
  }
  if (!Array.isArray(attachment.compiledTarget?.elementIds)
    || !attachment.compiledTarget.elementIds.length) {
    fail('LAFEA_CONTINUUM_COMPILED_REGION_MAPPING_EMPTY');
  }

  const payload = attachment.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('LAFEA_CONTINUUM_COMPILED_ATTACHMENT_PAYLOAD_INVALID');
  }
  if (!payload.thermalMaterialAuthority) {
    // Preserve the historical fail-closed code for unqualified legacy ΔT intent.
    fail('LAFEA_CONTINUUM_COMPILED_TEMPERATURE_SEMANTICS_NOT_QUALIFIED');
  }
  exactKeys(payload, ['value', 'unit', 'thermalMaterialAuthority'],
    'LAFEA_CONTINUUM_COMPILED_ATTACHMENT_PAYLOAD_INVALID');

  const deltaTemperature = deltaTemperatureKelvin(payload.value, payload.unit);
  const authority = validateThermalMaterialAuthority(payload.thermalMaterialAuthority);
  const elementById = new Map(model.elements.map((row) => [row.elementId, row]));
  const mappedElements = attachment.compiledTarget.elementIds.map((elementId) => {
    const element = elementById.get(elementId);
    if (!element) fail('LAFEA_CONTINUUM_COMPILED_TARGET_REFERENCE_INVALID');
    return element;
  });
  if (mappedElements.some((element) => element.materialId !== authority.materialRef)) {
    fail('LAFEA_CONTINUUM_COMPILED_TEMPERATURE_MATERIAL_AUTHORITY_MISMATCH');
  }

  const thermalStrain = finite(
    authority.coefficientPerKelvin * deltaTemperature,
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_STRAIN_INVALID',
  );
  for (const element of mappedElements) {
    loadCase.temperatureLoads.push({
      temperatureLoadId: `${attachment.attachmentId}/${element.elementId}`,
      elementId: element.elementId,
      thermalStrain,
      sourceReference: [
        'COMPILED_DELTA_T',
        attachment.attachmentId,
        authority.law,
        authority.materialRef,
        authority.sourceEvidence.sourceSemanticHash,
      ].join('#'),
    });
  }
  return Object.freeze({
    law: authority.law,
    materialRef: authority.materialRef,
    coefficientPerKelvin: authority.coefficientPerKelvin,
    referenceTemperatureKelvin: authority.referenceTemperatureKelvin,
    deltaTemperatureKelvin: deltaTemperature,
    thermalStrain,
    sourceEvidence: authority.sourceEvidence,
  });
}

export function validateThermalMaterialAuthority(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('LAFEA_CONTINUUM_COMPILED_TEMPERATURE_AUTHORITY_INVALID');
  }
  exactKeys(value, [
    'schema', 'law', 'materialRef', 'coefficientPerKelvin',
    'referenceTemperatureKelvin', 'sourceEvidence',
  ], 'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_AUTHORITY_INVALID');
  if (value.schema !== LAFEA_CONTINUUM_THERMAL_MATERIAL_AUTHORITY_SCHEMA
    || value.law !== LAFEA_CONTINUUM_DELTA_T_LAW) {
    fail('LAFEA_CONTINUUM_COMPILED_TEMPERATURE_AUTHORITY_INVALID');
  }
  const materialRef = text(value.materialRef,
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_AUTHORITY_INVALID');
  const coefficientPerKelvin = finite(value.coefficientPerKelvin,
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_AUTHORITY_INVALID');
  const referenceTemperatureKelvin = finite(value.referenceTemperatureKelvin,
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_AUTHORITY_INVALID');
  if (!(referenceTemperatureKelvin > 0)) {
    fail('LAFEA_CONTINUUM_COMPILED_TEMPERATURE_AUTHORITY_INVALID');
  }
  const sourceEvidence = validateSourceEvidence(value.sourceEvidence);
  return Object.freeze({
    schema: value.schema,
    law: value.law,
    materialRef,
    coefficientPerKelvin,
    referenceTemperatureKelvin,
    sourceEvidence,
  });
}

function validateSourceEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('LAFEA_CONTINUUM_COMPILED_TEMPERATURE_SOURCE_EVIDENCE_INVALID');
  }
  exactKeys(value, ['sourceId', 'sourceRevision', 'sourceSemanticHash'],
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_SOURCE_EVIDENCE_INVALID');
  const sourceId = text(value.sourceId,
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_SOURCE_EVIDENCE_INVALID');
  const sourceRevision = text(value.sourceRevision,
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_SOURCE_EVIDENCE_INVALID');
  const sourceSemanticHash = text(value.sourceSemanticHash,
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_SOURCE_EVIDENCE_INVALID');
  if (!/^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u.test(sourceSemanticHash)) {
    fail('LAFEA_CONTINUUM_COMPILED_TEMPERATURE_SOURCE_EVIDENCE_INVALID');
  }
  return Object.freeze({ sourceId, sourceRevision, sourceSemanticHash });
}

function deltaTemperatureKelvin(value, unit) {
  const delta = finite(value, 'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_VALUE_INVALID');
  if (!['C', 'K'].includes(unit)) {
    fail('LAFEA_CONTINUUM_COMPILED_TEMPERATURE_UNIT_UNSUPPORTED');
  }
  // Celsius and kelvin increments have identical magnitude.
  return delta;
}

function exactKeys(value, keys, code) {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(code);
}
function text(value, code) {
  if (typeof value !== 'string' || !value.trim()) fail(code);
  return value.trim();
}
function finite(value, code) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(code);
  return Object.is(value, -0) ? 0 : value;
}
function fail(code) {
  const error = new TypeError(code);
  error.code = code;
  throw error;
}
