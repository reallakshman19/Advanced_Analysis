import assert from 'node:assert/strict';
import {
  FORMULATIONS,
  MODEL_SCHEMA,
  QUALIFICATION_PROFILE,
  calculateLocalContinuum,
  createCanonicalLocalContinuumModel,
} from '../../src/core/local-continuum/index.js';
import { canonicalLafeaAnalysisMesh } from '../../src/workspace/lafea-analysis-mesh-contract.js';
import { canonicalLafeaSha256 } from '../../src/workspace/lafea-canonical-sha256.js';
import { evaluateLafeaContinuumPhysicalProbe } from '../../src/workspace/lafea-continuum-physical-probe.js';
import { qualifyLafeaHighOrderJacobiansV3 } from '../../src/workspace/lafea-high-order-jacobian-qualification-v3.js';
import { qualifyLafeaMeshTopologyV3 } from '../../src/workspace/lafea-mesh-topology-qualification-v3.js';

const STAGE_ID = 'LAFEA.3';
const CASE_ID = 'LAME-LC1';
const PROBE_SCHEMA = 'lafea-continuum-physical-probe/v1';
const DIRECT_RECOVERY = 'ELEMENT_LOCAL_DIRECT_DISPLACEMENT_GRADIENT';
const DISPLACEMENT_RECOVERY = 'ELEMENT_SHAPE_INTERPOLATION';

export function executeLameBbarQualificationCase(definition, meshPolicy, {
  elementType,
  poissonRatio,
  level,
  distortion,
}) {
  assert.equal(definition.programmeId, 'LAFEA3-PS-BBAR-001');
  assert.equal(meshPolicy.programmeId, definition.programmeId);
  assert.equal(meshPolicy.definitionState, 'FROZEN_BEFORE_PRODUCTION_OBSERVATION');
  assert.equal(meshPolicy.productionOutputUsedToChooseDefinition, false);
  assert.ok(['T6', 'Q8'].includes(elementType));
  assert.ok(definition.poissonRatioLadder.includes(poissonRatio));
  assert.ok(definition.benchmarks.THICK_CYLINDER.meshLadder.levels.some(
    (row) => row.levelId === level.levelId
      && row.targetElementLength === level.targetElementLength,
  ));
  assert.ok(definition.distortionMatrix.some((row) => row.distortionId === distortion.distortionId));

  const meshData = createQuarterAnnulusMesh(definition, meshPolicy, {
    elementType,
    level,
    distortion,
  });
  const mesh = canonicalLafeaAnalysisMesh(meshData.mesh);
  const topology = qualifyLafeaMeshTopologyV3(mesh, { requireSingleComponent: true });
  assert.equal(topology.qualification, 'PASS',
    `${elementType}/${poissonRatio}/${level.levelId}/${distortion.distortionId} topology`);
  const jacobian = qualifyLafeaHighOrderJacobiansV3(mesh, {
    minimumDeterminant: 0,
    maximumDepth: 12,
    maximumSubregions: 8192,
  });
  assert.equal(jacobian.qualification, 'PASS',
    `${elementType}/${poissonRatio}/${level.levelId}/${distortion.distortionId} full-parent Jacobian`);

  const source = sourceModel(definition, {
    elementType,
    poissonRatio,
    mesh,
    innerBoundaryOwners: meshData.innerBoundaryOwners,
  });
  const canonicalInput = createCanonicalLocalContinuumModel(source);
  const result = calculateLocalContinuum(canonicalInput);
  assert.equal(result.qualification.state, 'ACCEPTED', JSON.stringify(result.diagnostics));
  const loadCase = result.loadCaseResults.find((row) => row.loadCaseId === CASE_ID);
  assert.ok(loadCase, 'Lamé load case missing');

  const meshHash = canonicalLafeaSha256({
    schema: 'lafea-bbar-lame-mesh-hash-input/v1', mesh,
  });
  const canonicalExecutionInputHash = canonicalLafeaSha256({
    schema: 'lafea-continuum-compiled-execution-input-hash/v1',
    canonicalInput,
  });
  const executionHash = result.semanticHashes.executionEvidenceHash;
  const recoveryHash = canonicalLafeaSha256({
    schema: 'lafea-bbar-lame-recovery-hash-input/v1',
    canonicalModelSemanticHash: canonicalInput.semanticHash,
    executionHash,
    resultPayloadHash: result.semanticHashes.resultPayloadSemanticHash,
  });
  const stage = Object.freeze({
    stageId: STAGE_ID,
    currentness: Object.freeze({
      currentAuthority: true,
      computationalState: 'CURRENT_RESULT',
    }),
    analysisMeshCustodyProjection: Object.freeze({ state: 'CURRENT_PASS', meshHash }),
    lifecycle: Object.freeze({
      artifacts: Object.freeze({
        RECOVERY: Object.freeze({
          status: 'CURRENT', qualification: 'PASS', artifactHash: recoveryHash,
        }),
      }),
    }),
    execution: Object.freeze({
      stageId: STAGE_ID,
      status: 'QUALIFIED',
      sourceHash: canonicalLafeaSha256({ schema: 'lafea-bbar-lame-source/v1', source }),
      meshHash,
      solverModelHash: canonicalInput.semanticHash,
      canonicalExecutionInputHash,
      compiledExecutionHash: executionHash,
      canonicalInput,
      result,
      releaseQualified: false,
    }),
  });
  const probes = definition.benchmarks.THICK_CYLINDER.fixedPhysicalProbes.map((probe) =>
    evaluateLafeaContinuumPhysicalProbe(
      stage,
      strictProbe(definition, probe),
    ));
  return Object.freeze({
    elementType,
    poissonRatio,
    levelId: level.levelId,
    h: level.targetElementLength,
    distortionId: distortion.distortionId,
    mesh,
    topology,
    jacobian,
    canonicalInput,
    result,
    loadCase,
    stage,
    probes,
    probeCellEvidence: meshData.probeCellEvidence,
  });
}

export function lameOracle(definition, poissonRatio, probe) {
  const benchmark = definition.benchmarks.THICK_CYLINDER;
  const E = definition.material.elasticModulus;
  const a = benchmark.geometry.innerRadius;
  const b = benchmark.geometry.outerRadius;
  const pi = benchmark.load.internalPressure;
  const po = benchmark.load.externalPressure;
  const denominator = b * b - a * a;
  const A = (pi * a * a - po * b * b) / denominator;
  const B = (a * a * b * b * (pi - po)) / denominator;
  const r = probe.r;
  const theta = probe.thetaDegrees * Math.PI / 180;
  const sigmaR = A - B / (r * r);
  const sigmaTheta = A + B / (r * r);
  const sigmaZ = 2 * poissonRatio * A;
  const ur = ((1 + poissonRatio) / E) * ((1 - 2 * poissonRatio) * A * r + B / r);
  const c = Math.cos(theta); const s = Math.sin(theta);
  const values = {
    DISPLACEMENT_X: ur * c,
    DISPLACEMENT_Y: ur * s,
    STRESS_SIGMA_X: sigmaR * c * c + sigmaTheta * s * s,
    STRESS_SIGMA_Y: sigmaR * s * s + sigmaTheta * c * c,
    STRESS_SIGMA_Z: sigmaZ,
    STRESS_TAU_XY: (sigmaR - sigmaTheta) * s * c,
  };
  assert.ok(Object.hasOwn(values, probe.quantityId));
  return Object.freeze({
    A, B, sigmaR, sigmaTheta, sigmaZ, ur,
    physicalCoordinate: Object.freeze({ x: r * c, y: r * s }),
    expectedValue: values[probe.quantityId],
    units: probe.units,
  });
}

function createQuarterAnnulusMesh(definition, meshPolicy, { elementType, level, distortion }) {
  const benchmark = definition.benchmarks.THICK_CYLINDER;
  const { innerRadius: a, outerRadius: b } = benchmark.geometry;
  const h = level.targetElementLength;
  const radialProbeAnchors = [...new Set(
    benchmark.fixedPhysicalProbes.map((probe) => probe.r),
  )].sort((x, y) => x - y);
  const angularProbeAnchors = [...new Set(
    benchmark.fixedPhysicalProbes.map((probe) => probe.thetaDegrees * Math.PI / 180),
  )].sort((x, y) => x - y);
  assert.deepEqual(radialProbeAnchors, meshPolicy.radialAxis.protectedProbeRadii);
  const angularProbeDegrees = angularProbeAnchors.map((value) => value * 180 / Math.PI);
  assert.equal(angularProbeDegrees.length, meshPolicy.angularAxis.protectedProbeAnglesDegrees.length);
  angularProbeDegrees.forEach((value, index) => close(
    value,
    meshPolicy.angularAxis.protectedProbeAnglesDegrees[index],
    1e-12,
    `Protected angular probe ${index + 1}`,
  ));
  const radialPhase = meshPolicy.radialAxis.targetPhase;
  const angularPhase = meshPolicy.angularAxis.targetPhase;
  assert.ok(
    Math.abs(radialPhase - angularPhase)
      >= meshPolicy.t6DiagonalAvoidance.minimumPhaseSeparation,
  );
  const radialBreaks = protectedAxis(a, b, h, radialProbeAnchors, radialPhase);
  const angularTarget = h / ((a + b) / 2);
  const angularBreaks = protectedAxis(
    0,
    Math.PI / 2,
    angularTarget,
    angularProbeAnchors,
    angularPhase,
  );
  const probeCellEvidence = benchmark.fixedPhysicalProbes.map((probe) => {
    const theta = probe.thetaDegrees * Math.PI / 180;
    const radial = containingCell(radialBreaks, probe.r);
    const angular = containingCell(angularBreaks, theta);
    const radialCellPhase = (probe.r - radial.left) / (radial.right - radial.left);
    const angularCellPhase = (theta - angular.left) / (angular.right - angular.left);
    close(radialCellPhase, radialPhase, 1e-12, `${probe.probeId} radial phase`);
    close(angularCellPhase, angularPhase, 1e-12, `${probe.probeId} angular phase`);
    const diagonalPhaseSeparation = Math.abs(radialCellPhase - angularCellPhase);
    assert.ok(
      diagonalPhaseSeparation >= meshPolicy.t6DiagonalAvoidance.minimumPhaseSeparation - 1e-12,
      `${probe.probeId} is too close to the T6 cell diagonal`,
    );
    return Object.freeze({
      probeId: probe.probeId,
      radialCell: Object.freeze(radial),
      angularCell: Object.freeze(angular),
      radialCellPhase,
      angularCellPhase,
      diagonalPhaseSeparation,
      elementBoundaryPlacement: false,
      t6DiagonalPlacement: false,
    });
  });

  const nodes = new Map();
  const corners = Array.from({ length: radialBreaks.length }, () => []);
  for (let i = 0; i < radialBreaks.length; i += 1) {
    for (let j = 0; j < angularBreaks.length; j += 1) {
      const id = `C-R${i}-T${j}`;
      const point = distortedPolarPoint(
        radialBreaks[i], angularBreaks[j],
        a, b, h, distortion,
      );
      corners[i][j] = id;
      nodes.set(id, node(id, point.x, point.y));
    }
  }

  const edgeMids = new Map();
  const elements = [];
  const innerBoundaryOwners = [];
  const nr = radialBreaks.length - 1;
  const nt = angularBreaks.length - 1;
  for (let i = 0; i < nr; i += 1) {
    for (let j = 0; j < nt; j += 1) {
      const c1 = corners[i][j];
      const c2 = corners[i + 1][j];
      const c3 = corners[i + 1][j + 1];
      const c4 = corners[i][j + 1];
      if (elementType === 'Q8') {
        const m12 = edgeMid(c1, c2, nodes, edgeMids, a, b);
        const m23 = edgeMid(c2, c3, nodes, edgeMids, a, b);
        const m34 = edgeMid(c3, c4, nodes, edgeMids, a, b);
        const m41 = edgeMid(c4, c1, nodes, edgeMids, a, b);
        const elementId = `Q8-R${i}-T${j}`;
        elements.push({
          elementId, elementType: 'Q8',
          nodeIds: [c1, c2, c3, c4, m12, m23, m34, m41],
        });
        if (i === 0) innerBoundaryOwners.push({ elementId, edgeNodeIds: [c1, m41, c4] });
      } else {
        const m12 = edgeMid(c1, c2, nodes, edgeMids, a, b);
        const m23 = edgeMid(c2, c3, nodes, edgeMids, a, b);
        const m31 = edgeMid(c3, c1, nodes, edgeMids, a, b);
        const m34 = edgeMid(c3, c4, nodes, edgeMids, a, b);
        const m41 = edgeMid(c4, c1, nodes, edgeMids, a, b);
        const eA = `T6A-R${i}-T${j}`;
        const eB = `T6B-R${i}-T${j}`;
        elements.push({ elementId: eA, elementType: 'T6', nodeIds: [c1, c2, c3, m12, m23, m31] });
        elements.push({ elementId: eB, elementType: 'T6', nodeIds: [c1, c3, c4, m31, m34, m41] });
        if (i === 0) innerBoundaryOwners.push({ elementId: eB, edgeNodeIds: [c1, m41, c4] });
      }
    }
  }

  return Object.freeze({
    mesh: {
      schema: 'lafea-analysis-mesh/v1',
      meshIdentity: `PS-BBAR-LAME/${elementType}/${level.levelId}/${distortion.distortionId}`,
      nodes: [...nodes.values()].map((row) => ({ ...row, z: 0 })),
      elements,
    },
    innerBoundaryOwners: Object.freeze(innerBoundaryOwners.map(Object.freeze)),
    radialBreaks: Object.freeze(radialBreaks),
    angularBreaks: Object.freeze(angularBreaks),
    probeCellEvidence: Object.freeze(probeCellEvidence),
  });
}

function sourceModel(definition, { elementType, poissonRatio, mesh, innerBoundaryOwners }) {
  const benchmark = definition.benchmarks.THICK_CYLINDER;
  const nodes = mesh.nodes.map((row) => ({
    nodeId: row.nodeId, x: row.x, y: row.y,
    sourceReference: `PS-BBAR-LAME#NODE/${row.nodeId}`,
  }));
  const constraints = [];
  const tolerance = 1e-10 * benchmark.geometry.outerRadius;
  for (const row of nodes) {
    if (Math.abs(row.y) <= tolerance) constraints.push({
      constraintId: `SYM-X/${row.nodeId}/UY`, nodeId: row.nodeId, dof: 'UY', value: 0,
      sourceReference: 'PS-BBAR-LAME#SYM-X',
    });
    if (Math.abs(row.x) <= tolerance) constraints.push({
      constraintId: `SYM-Y/${row.nodeId}/UX`, nodeId: row.nodeId, dof: 'UX', value: 0,
      sourceReference: 'PS-BBAR-LAME#SYM-Y',
    });
  }
  const pressureLoads = innerBoundaryOwners.map((owner, index) => ({
    pressureLoadId: `PIN/${index + 1}`,
    elementId: owner.elementId,
    edgeNodeIds: [...owner.edgeNodeIds],
    pressure: benchmark.load.internalPressure,
    sourceReference: 'PS-BBAR-LAME#INTERNAL_PRESSURE',
  }));
  return {
    schema: MODEL_SCHEMA,
    modelIdentity: `PS-BBAR-LAME-${elementType}-NU-${poissonRatio}`,
    modelVersion: '1',
    sourceAncestry: {
      sourceModelIdentity: definition.programmeId,
      sourceVersion: 'FROZEN-V1',
      adapterIdentity: 'LAFEA_BBAR_LAME_QUALIFICATION_FIXTURE',
      adapterVersion: '2',
    },
    units: { length: 'mm', force: 'N', stress: 'MPa', modulus: 'MPa' },
    formulation: FORMULATIONS.PLANE_STRAIN_BBAR,
    materials: [{
      materialId: 'MAT',
      elasticModulus: definition.material.elasticModulus,
      poissonRatio,
      sourceReference: `PS-BBAR-LAME#MATERIAL/NU-${poissonRatio}`,
    }],
    nodes,
    elements: mesh.elements.map((row) => ({
      elementId: row.elementId,
      elementType: row.elementType,
      nodeIds: [...row.nodeIds],
      materialId: 'MAT',
      thickness: benchmark.geometry.thickness,
      sourceReference: `PS-BBAR-LAME#ELEMENT/${row.elementId}`,
    })),
    elementTypePolicy: {
      allowT3Fallback: false,
      sourceReference: 'PS-BBAR-LAME#T6-Q8-ONLY',
    },
    constraints,
    loadCases: [{
      loadCaseId: CASE_ID,
      nodalForces: [], edgeTractions: [], pressureLoads, bodyForces: [],
      temperatureLoads: [], imposedDisplacements: [],
      sourceReference: 'PS-BBAR-LAME#LC1',
    }],
    resultRequests: { loadCaseIds: [CASE_ID] },
    qualificationProfile: structuredClone(QUALIFICATION_PROFILE),
    limitations: [
      'PLANE_STRAIN_BBAR_MECHANICAL_QUALIFICATION_FIXTURE',
      'NO_TEMPERATURE_AUTHORITY',
      'NO_RELEASE_AUTHORITY_FROM_SINGLE_CASE',
    ],
  };
}

function strictProbe(definition, probe) {
  const oracle = lameOracle(definition, 0.30, probe);
  const displacement = probe.quantityId.startsWith('DISPLACEMENT_');
  return {
    schema: PROBE_SCHEMA,
    probeId: probe.probeId,
    physicalCoordinate: { ...oracle.physicalCoordinate },
    coordinateFrame: 'GLOBAL_XY',
    loadCaseId: CASE_ID,
    quantityId: probe.quantityId,
    representation: 'PHYSICAL_POINT_DIRECT',
    recoveryMethod: displacement ? DISPLACEMENT_RECOVERY : DIRECT_RECOVERY,
    units: probe.units,
    singularityClassification: displacement
      ? 'NOT_APPLICABLE' : probe.singularityClassification,
  };
}

function protectedAxis(minimum, maximum, target, anchors, targetPhase) {
  assert.ok(target > 0 && maximum > minimum);
  assert.ok(targetPhase > 0 && targetPhase < 1);
  const breaks = [minimum, maximum];
  for (const anchor of anchors) {
    assert.ok(anchor > minimum && anchor < maximum);
    const left = anchor - targetPhase * target;
    const right = left + target;
    assert.ok(
      left >= minimum - 1e-12 && right <= maximum + 1e-12,
      `Protected probe cell [${left}, ${right}] around ${anchor} exceeds axis [${minimum}, ${maximum}]`,
    );
    breaks.push(Math.max(minimum, left), Math.min(maximum, right));
  }
  const protectedBreaks = uniqueSorted(breaks);
  const output = [protectedBreaks[0]];
  for (let index = 0; index < protectedBreaks.length - 1; index += 1) {
    const left = protectedBreaks[index];
    const right = protectedBreaks[index + 1];
    const subdivisionRatio = (right - left) / target;
    const roundoff = 64 * Number.EPSILON * Math.max(1, Math.abs(subdivisionRatio));
    const count = Math.max(1, Math.ceil(subdivisionRatio - roundoff));
    for (let step = 1; step <= count; step += 1) {
      output.push(left + (right - left) * step / count);
    }
  }
  const canonical = uniqueSorted(output);
  for (const anchor of anchors) {
    assert.equal(canonical.some((value) => Math.abs(value - anchor) <= 1e-12), false,
      `Probe anchor ${anchor} must remain inside a cell, not on an interface.`);
    const cell = containingCell(canonical, anchor);
    const phase = (anchor - cell.left) / (cell.right - cell.left);
    close(phase, targetPhase, 1e-12, `Probe anchor ${anchor} phase`);
    close(cell.right - cell.left, target, 1e-12, `Probe anchor ${anchor} cell width`);
  }
  return canonical;
}

function containingCell(axis, value) {
  for (let index = 0; index < axis.length - 1; index += 1) {
    if (value > axis[index] + 1e-12 && value < axis[index + 1] - 1e-12) {
      return Object.freeze({ left: axis[index], right: axis[index + 1], index });
    }
  }
  throw new TypeError(`Frozen probe ${value} is not strictly inside one protected cell.`);
}

function distortedPolarPoint(r, theta, a, b, h, distortion) {
  const boundary = Math.abs(r - a) <= 1e-12 || Math.abs(r - b) <= 1e-12
    || Math.abs(theta) <= 1e-12 || Math.abs(theta - Math.PI / 2) <= 1e-12;
  if (boundary || distortion.distortionId === 'REGULAR') return polar(r, theta);
  const window = Math.sin(Math.PI * (r - a) / (b - a)) * Math.sin(2 * theta);
  const rr = r + distortion.radialAmplitudeTimesH * h * window;
  const tt = theta + distortion.angularAmplitudeTimesHOverR * (h / r) * window;
  return polar(rr, tt);
}

function edgeMid(leftId, rightId, nodes, cache, a, b) {
  const key = leftId < rightId ? `${leftId}\u0000${rightId}` : `${rightId}\u0000${leftId}`;
  if (cache.has(key)) return cache.get(key);
  const left = nodes.get(leftId); const right = nodes.get(rightId);
  assert.ok(left && right);
  const lp = cartesianToPolar(left); const rp = cartesianToPolar(right);
  let point;
  const samePhysicalCircle = Math.abs(lp.r - rp.r) <= 1e-10
    && (Math.abs(lp.r - a) <= 1e-10 || Math.abs(lp.r - b) <= 1e-10);
  if (samePhysicalCircle) {
    point = polar((lp.r + rp.r) / 2, unwrapMidAngle(lp.theta, rp.theta));
  } else {
    point = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  }
  const id = `M-${cache.size + 1}`;
  nodes.set(id, node(id, point.x, point.y));
  cache.set(key, id);
  return id;
}

function node(nodeId, x, y) { return Object.freeze({ nodeId, x, y }); }
function polar(r, theta) { return { x: r * Math.cos(theta), y: r * Math.sin(theta) }; }
function cartesianToPolar(point) {
  return { r: Math.hypot(point.x, point.y), theta: Math.atan2(point.y, point.x) };
}
function unwrapMidAngle(left, right) {
  let delta = right - left;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return left + delta / 2;
}
function uniqueSorted(values) {
  return [...values].sort((a, b) => a - b).filter(
    (value, index, rows) => index === 0 || Math.abs(value - rows[index - 1]) > 1e-12,
  );
}
function close(actual, expected, relative, label) {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= relative * scale,
    `${label}: ${actual} != ${expected}`,
  );
}
