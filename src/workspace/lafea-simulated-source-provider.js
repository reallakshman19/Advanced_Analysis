/** Compatibility-only lazy provider for deterministic simulated LAFEA sources. */
import {
  PROFILE_KINDS,
  canonicalProfile,
  defaultProfileFields,
  qualifiedMeshQualityPolicyForStage,
} from '../core/lafea-profile-contract/index.js';
import {
  createLafea3SimulatedDomainAndGeometryEvidence,
} from './lafea3-simulated-domain-provider.js';

export const LAFEA3_SIMULATED_MESH_TARGET_MM = 30;
export const LAFEA3_SIMULATED_MESH_ELEMENT_FAMILY = 'T6';
export const LAFEA3_SIMULATED_MESH_PROFILE_ID = 'LAFEA3_SIMULATED_T6_H30_V1';

export async function createLafeaMockDocument(stageId) {
  const provider = await import('./advanced-mock-data.js');
  if (stageId === 'LAFEA.1') {
    const screening = provider.createLafeaMockDocument('LAFEA.2');
    const canonicalFoundation = screening?.sourceEvidence?.foundationModel;
    if (!canonicalFoundation?.sourceEvidence || !canonicalFoundation?.schema) {
      throw new TypeError('EMP1_SIMULATED_A_SOURCE_FROM_B_REQUIRED');
    }
    return {
      ...structuredClone(canonicalFoundation.sourceEvidence),
      schema: canonicalFoundation.schema,
    };
  }
  return provider.createLafeaMockDocument(stageId);
}

export async function createLafeaMockDomainAndGeometryEvidence(stageId, sourceHash) {
  if (stageId === 'LAFEA.3') {
    const source = await createLafeaMockDocument(stageId);
    return createLafea3SimulatedDomainAndGeometryEvidence(sourceHash, source);
  }
  const provider = await import('./advanced-mock-data.js');
  if (typeof provider.createLafeaMockDomainAndGeometryEvidence === 'function') {
    return provider.createLafeaMockDomainAndGeometryEvidence(stageId, sourceHash);
  }
  return null;
}

export const LAFEA4_SIMULATED_MESH_TARGET_MM = 50;
export const LAFEA4_SIMULATED_MESH_ELEMENT_FAMILY = 'CST_DKT_TRI3_THIN_SHELL_V1';
export const LAFEA4_SIMULATED_MESH_PROFILE_ID = 'LAFEA4_SIMULATED_SHELL_H50_V1';

/**
 * Sample-only governed mesh profile for the visible LAFEA.3 and LAFEA.4 demonstration.
 *
 * This is not a fallback for imported engineering models. It exists because
 * Sample already declares a deterministic source and deterministic
 * domain/geometry parent; carrying its mesh profile with the same simulated
 * package makes the qualified Generate Mesh path immediately usable without
 * weakening the general explicit-profile custody rule.
 */
export function createLafeaMockMeshProfile(stageId) {
  if (stageId !== 'LAFEA.3' && stageId !== 'LAFEA.4') return null;
  const defaults = defaultProfileFields(PROFILE_KINDS.MESH);
  const policy = qualifiedMeshQualityPolicyForStage(stageId);
  if (!policy?.fields) throw new TypeError(`${stageId.replace('.', '')}_SIMULATED_MESH_QUALITY_POLICY_REQUIRED`);
  const fields = policy.fields;

  const isLafea4 = stageId === 'LAFEA.4';

  const baseFields = {
    ...defaults,
    globalTargetSize: isLafea4 ? LAFEA4_SIMULATED_MESH_TARGET_MM : LAFEA3_SIMULATED_MESH_TARGET_MM,
    adjacentSizeRatioMax: fields.adjacentSizeRatioMax,
    aspectRatioWarn: fields.aspectRatioWarn,
    aspectRatioBlock: fields.aspectRatioBlock,
    scaledJacobianWarn: fields.scaledJacobianWarn,
    scaledJacobianBlock: fields.scaledJacobianBlock,
    adaptiveLevels: fields.adaptiveLevelsMinimum,
  };

  if (isLafea4) {
    baseFields.shellElement = LAFEA4_SIMULATED_MESH_ELEMENT_FAMILY;
  } else {
    baseFields.continuumElement = LAFEA3_SIMULATED_MESH_ELEMENT_FAMILY;
  }

  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: isLafea4 ? LAFEA4_SIMULATED_MESH_PROFILE_ID : LAFEA3_SIMULATED_MESH_PROFILE_ID,
    sourceRevision: isLafea4 ? 'SIMULATED-LAFEA4-MESH-PROFILE/V1' : 'SIMULATED-LAFEA3-MESH-PROFILE/V1',
    semanticHash: undefined,
    fields: baseFields,
  });
}

Object.defineProperty(createLafeaMockDocument, 'domainAndGeometryFactory', {
  value: createLafeaMockDomainAndGeometryEvidence,
  enumerable: false,
  configurable: false,
  writable: false,
});

Object.defineProperty(createLafeaMockDocument, 'meshProfileFactory', {
  value: createLafeaMockMeshProfile,
  enumerable: false,
  configurable: false,
  writable: false,
});
