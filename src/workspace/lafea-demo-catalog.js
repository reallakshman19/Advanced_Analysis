/**
 * Governed catalog and loader for LAFEA stage demonstration models.
 *
 * Provides traceable demo model metadata and zero-to-first-result loading
 * without bypassing governed normalization, canonicalization, solve, or recovery.
 * Demo models are strictly marked as demonstration only; release authority
 * remains RELEASE_NOT_QUALIFIED.
 */
import { mappedAnnulusSectorQ8, boundaryEdgesWhere } from '../../scripts/lafea.3-benchmark-mesh-adapter.mjs';
import { MODEL_SCHEMA as CONTINUUM_SCHEMA, QUALIFICATION_PROFILE as CONTINUUM_QUAL_PROFILE } from '../core/local-continuum/index.js';
import {
  CANONICAL_UNITS,
  MITC_PRODUCTION_FORMULATION_FAMILY,
  MITC_PRODUCTION_MODEL_SCHEMA,
  MITC_PRODUCTION_LIMITATIONS,
  MITC_PRODUCTION_RESULT_REQUEST,
} from '../core/local-shell/index.js';
import { MITC4_FORMULATION } from '../core/local-shell/mitc4-element.js';
import { MITC3_FORMULATION } from '../core/local-shell/mitc3-element.js';
import { MITC4_TOPOLOGY, MITC3_TOPOLOGY } from '../core/local-shell/mitc-adoption-model.js';
import { qualificationProfile, flatNode } from '../../scripts/lafea.4-fixtures.mjs';
import { workflowSource } from '../../scripts/lafea.5-fixtures.mjs';

export const LAFEA_DEMO_CATALOG = Object.freeze({
  'LAFEA.3': Object.freeze({
    stageId: 'LAFEA.3',
    implemented: true,
    title: 'BM-005 Lamé Pressurized Cylinder (2D Continuum)',
    shortLabel: 'BM-005 Lamé 2D',
    fixtureFileName: 'lafea-3-continuum-bm005-demo.json',
    benchmarkLineage: 'ASME Section VIII Div 2 / Lamé CONT-CYL-01',
    demonstrates: 'Q8 serendipity 2D continuum formulation under internal radial pressure.',
    limitations: 'Demonstration model only. Not qualified for production engineering release.',
    buildModel: buildLafea3DemoDocument,
  }),
  'LAFEA.4': Object.freeze({
    stageId: 'LAFEA.4',
    implemented: true,
    title: 'B5 Timoshenko Cantilever Strip (Shell MITC4 + MITC3)',
    shortLabel: 'B5 Timoshenko Shell',
    fixtureFileName: 'lafea-4-shell-mitc-b5-demo.json',
    benchmarkLineage: 'EP-0010 Timoshenko B5 cantilever strip (t/L = 0.01)',
    demonstrates: 'Mixed MITC4 QUAD4 and MITC3 TRI3 dispatch with transverse shear recovery.',
    limitations: 'Demonstration model only. Not qualified for production engineering release.',
    buildModel: buildLafea4DemoDocument,
  }),
  'LAFEA.5': Object.freeze({
    stageId: 'LAFEA.5',
    implemented: true,
    title: 'Trunnion Footprint Load Distribution',
    shortLabel: 'Trunnion Footprint',
    fixtureFileName: 'lafea-5-trunnion-footprint-demo.json',
    benchmarkLineage: 'Caller-authored host shell trunnion footprint workflow',
    demonstrates: 'Shell footprint mapping, assessment regions, and load introduction.',
    limitations: 'Demonstration model only. Not qualified for production engineering release.',
    buildModel: buildLafea5DemoDocument,
  }),
  'LAFEA.6': Object.freeze({
    stageId: 'LAFEA.6',
    implemented: false,
    title: 'Weld Profile (Not implemented)',
    shortLabel: 'Weld Profile',
    fixtureFileName: null,
    benchmarkLineage: null,
    demonstrates: null,
    limitations: 'Weld profile analysis is not implemented; no demonstration model or solver is available for this stage.',
    buildModel: null,
  }),
});

export function hasLafeaDemoModel(stageId) {
  return Boolean(LAFEA_DEMO_CATALOG[stageId]?.implemented);
}

export function getLafeaDemoDescriptor(stageId) {
  return LAFEA_DEMO_CATALOG[stageId] ?? null;
}

export async function loadLafeaDemoDocument(stageId) {
  const descriptor = getLafeaDemoDescriptor(stageId);
  if (!descriptor) {
    throw new TypeError(`Unknown LAFEA stage: ${stageId}`);
  }
  if (!descriptor.implemented || typeof descriptor.buildModel !== 'function') {
    throw new Error(descriptor.limitations || `No demonstration model exists for ${stageId}.`);
  }

  // If in a browser with fetch available, try to fetch the public fixture file first
  if (typeof fetch === 'function' && typeof window !== 'undefined' && descriptor.fixtureFileName) {
    try {
      const base = import.meta.env?.BASE_URL ?? '/Advanced_Analysis/';
      const fixtureUrl = new URL(`fixtures/${descriptor.fixtureFileName}`, new URL(base, window.location.href)).href;
      const response = await fetch(fixtureUrl);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fallback to inline model builder
    }
  }

  // Fallback to deterministic model builder
  return descriptor.buildModel();
}

function buildLafea3DemoDocument() {
  const Ri = 50, Ro = 100, internalPressure = 10, E = 200000, nu = 0.3, thickness = 10;
  const { nodes, elements } = mappedAnnulusSectorQ8(Ri, Ro, Math.PI / 2, 2, 4);
  const nodesById = new Map(nodes.map((row) => [row.nodeId, row]));
  const constraints = [];
  nodes.forEach((row) => {
    if (Math.abs(row.y) < 1e-6) constraints.push({ constraintId: `C-${row.nodeId}-UY`, nodeId: row.nodeId, dof: 'UY', value: 0, sourceReference: `C-${row.nodeId}-UY` });
    if (Math.abs(row.x) < 1e-6) constraints.push({ constraintId: `C-${row.nodeId}-UX`, nodeId: row.nodeId, dof: 'UX', value: 0, sourceReference: `C-${row.nodeId}-UX` });
  });
  const innerEdges = boundaryEdgesWhere(
    elements,
    nodesById,
    (node) => Math.hypot(node.x, node.y) <= Ri + 1e-6,
  );
  const pressureLoads = innerEdges.map((edge, index) => ({
    pressureLoadId: `P${index}`,
    elementId: edge.elementId,
    edgeNodeIds: edge.edgeNodeIds,
    pressure: internalPressure,
    sourceReference: `LOAD#P${index}`,
  }));

  return {
    schema: CONTINUUM_SCHEMA,
    modelIdentity: 'BM-005-LAME-CONT-CYL-01-DEMO',
    modelVersion: '1',
    sourceAncestry: {
      sourceModelIdentity: 'CONT-CYL-01',
      sourceVersion: 'BM005-FROZEN/V1',
      adapterIdentity: 'LAFEA3_BM005_ANNULUS_Q8_DEMO',
      adapterVersion: '1',
    },
    units: { length: 'mm', force: 'N', stress: 'MPa', modulus: 'MPa' },
    formulation: 'PLANE_STRESS',
    materials: [{
      materialId: 'MAT',
      elasticModulus: E,
      poissonRatio: nu,
      sourceReference: 'MAT-SRC',
    }],
    nodes: nodes.map((n) => ({ nodeId: n.nodeId, x: n.x, y: n.y, sourceReference: `NODE#${n.nodeId}` })),
    elements: elements.map((e) => ({
      elementId: e.elementId,
      elementType: 'Q8',
      nodeIds: e.nodeIds,
      materialId: 'MAT',
      thickness,
      sourceReference: `ELEMENT#${e.elementId}`,
    })),
    elementTypePolicy: {
      allowT3Fallback: false,
      sourceReference: 'BM005_Q8_ONLY',
    },
    constraints,
    loadCases: [{
      loadCaseId: 'INTERNAL_PRESSURE',
      nodalForces: [],
      edgeTractions: [],
      pressureLoads,
      bodyForces: [],
      temperatureLoads: [],
      imposedDisplacements: [],
      sourceReference: 'CASE#INTERNAL_PRESSURE',
    }],
    resultRequests: { loadCaseIds: ['INTERNAL_PRESSURE'] },
    qualificationProfile: JSON.parse(JSON.stringify(CONTINUUM_QUAL_PROFILE)),
    limitations: [
      'Demonstration model based on the ASME B02/BM-005 Lamé thick cylinder benchmark.',
      'Plane stress formulation over quarter-annulus symmetry sector with internal pressure.',
      'Demonstration only; not qualified for production engineering release.',
    ],
  };
}

function buildLafea4DemoDocument() {
  const SPAN = 10, WIDTH = 1, ALONG = 8, E = 200000, NU = 0, TIP_LOAD = 1;
  const thickness = 0.1; // t/L = 0.01

  const nodes = [];
  for (let row = 0; row < 2; row += 1) {
    for (let index = 0; index <= ALONG; index += 1) {
      nodes.push(flatNode(`N${row}-${index}`, index * SPAN / ALONG, row * WIDTH));
    }
  }

  const elements = [];
  for (let index = 0; index < ALONG; index += 1) {
    const a = `N0-${index}`;
    const b = `N0-${index + 1}`;
    const c = `N1-${index + 1}`;
    const d = `N1-${index}`;
    if (index % 2 === 1) {
      elements.push(
        {
          elementId: `T${index}A`,
          formulation: MITC3_FORMULATION,
          topology: MITC3_TOPOLOGY,
          nodeIds: [a, b, c],
          materialId: 'MAT',
          thickness,
          sourceReference: `T${index}A-SRC`,
        },
        {
          elementId: `T${index}B`,
          formulation: MITC3_FORMULATION,
          topology: MITC3_TOPOLOGY,
          nodeIds: [a, c, d],
          materialId: 'MAT',
          thickness,
          sourceReference: `T${index}B-SRC`,
        }
      );
    } else {
      elements.push({
        elementId: `Q${index}`,
        formulation: MITC4_FORMULATION,
        topology: MITC4_TOPOLOGY,
        nodeIds: [a, b, c, d],
        materialId: 'MAT',
        thickness,
        sourceReference: `Q${index}-SRC`,
      });
    }
  }

  const constraints = nodes.flatMap((node) => {
    const rows = [
      { constraintId: `C-${node.nodeId}-UX`, nodeId: node.nodeId, dof: 'UX', value: 0, sourceReference: `C-${node.nodeId}-UX-SRC` },
      { constraintId: `C-${node.nodeId}-UY`, nodeId: node.nodeId, dof: 'UY', value: 0, sourceReference: `C-${node.nodeId}-UY-SRC` }
    ];
    if (node.position[0] === 0) {
      rows.push(
        { constraintId: `C-${node.nodeId}-UZ`, nodeId: node.nodeId, dof: 'UZ', value: 0, sourceReference: `C-${node.nodeId}-UZ-SRC` },
        { constraintId: `C-${node.nodeId}-R1`, nodeId: node.nodeId, dof: 'R1', value: 0, sourceReference: `C-${node.nodeId}-R1-SRC` },
        { constraintId: `C-${node.nodeId}-R2`, nodeId: node.nodeId, dof: 'R2', value: 0, sourceReference: `C-${node.nodeId}-R2-SRC` }
      );
    }
    return rows;
  });

  return {
    schema: MITC_PRODUCTION_MODEL_SCHEMA,
    modelIdentity: 'LAFEA4-B5-CANTILEVER-STRIP-DEMO',
    modelVersion: '2',
    sourceAncestry: ['qualification/a4-leg004/v1', 'demo/lafea4-b5-timoshenko/v1'],
    units: { ...CANONICAL_UNITS },
    formulationFamily: MITC_PRODUCTION_FORMULATION_FAMILY,
    materials: [{ materialId: 'MAT', elasticModulus: E, poissonRatio: NU, sourceReference: 'MAT-SRC' }],
    nodes,
    elements,
    constraints,
    loadCases: [{
      loadCaseId: 'TIP_LOAD',
      nodalLoads: [
        { loadId: `F-N0-${ALONG}`, nodeId: `N0-${ALONG}`, fx: 0, fy: 0, fz: TIP_LOAD / 2, m1: 0, m2: 0, sourceReference: `F-N0-${ALONG}-SRC` },
        { loadId: `F-N1-${ALONG}`, nodeId: `N1-${ALONG}`, fx: 0, fy: 0, fz: TIP_LOAD / 2, m1: 0, m2: 0, sourceReference: `F-N1-${ALONG}-SRC` }
      ],
      pressureLoads: [],
      sourceReference: 'TIP_LOAD-SRC',
    }],
    resultRequests: {
      stressSurfaces: [...MITC_PRODUCTION_RESULT_REQUEST.stressSurfaces],
      retainElementMatrices: true,
      retainTransverseShear: true,
    },
    qualificationProfile: qualificationProfile(),
    mitcQualification: {
      quadPlanarity: { absolute: 1e-9, relative: 1e-8 },
      rigidBodyEnergy: { absolute: 1e-9, relative: 1e-9 },
    },
    limitations: [
      ...MITC_PRODUCTION_LIMITATIONS,
      'Demonstration model based on the qualified B5 cantilever strip benchmark (EP-0010 envelope).',
      'Exercises MITC4 QUAD4 and MITC3 TRI3 dispatch against closed-form Timoshenko reference.',
      'Demonstration only; not qualified for production engineering release.',
    ],
  };
}

function buildLafea5DemoDocument() {
  const source = workflowSource({
    workflowIdentity: 'TRUNNION-FOOTPRINT-DEMO-V1',
  });
  source.sourceAncestry.sourceReference = 'demo/lafea5-trunnion-footprint/v1';
  return source;
}
