/**
 * M047 Stage 2 nonlinear dry-friction adapter for CAESAR ACCDB benchmarks.
 *
 * This module intentionally does not alter the qualified ACCDB linear mechanics.
 * It reconstructs the assembled structural stiffness/load state from the frozen
 * solver evidence, then adds only CAESAR-style tangential stick springs or
 * capped sliding loads. Primitive friction states are solved independently;
 * derived L15 is an algebraic result combination only.
 */
import { choleskyDecompose, solveCholesky } from '../linear-fea-solver/linear-algebra.js';
import { semanticHash } from '../shared-piping-model/canonical-json.js';
import { deepFreeze } from '../shared-piping-model/immutable.js';
import { compareBenchmarkResultRows } from './qualification-comparison.js';
import { resolveCaesarConfigurationSetting } from './caesar-configuration-authority.js';
import {
  resolveCaesarEffectiveFriction,
  solveCaesarAccdbLinearBenchmark,
} from './caesar-accdb-linear-solve-governed.js';
import { solveCaesarAccdbLinearBenchmark as solveFrozenLinearBenchmark } from './caesar-accdb-linear-solve.js';

const DOFS = Object.freeze(['UX', 'UY', 'UZ', 'RX', 'RY', 'RZ']);
const TRANSLATION_DOFS = Object.freeze(['UX', 'UY', 'UZ']);
const FORCE_COMPONENTS = Object.freeze(['FX', 'FY', 'FZ']);
const MOMENT_COMPONENTS = Object.freeze(['MX', 'MY', 'MZ']);
const N_PER_CM_TO_N_PER_M = 100;
const N_M_PER_DEG_TO_N_M_PER_RAD = 180 / Math.PI;
const HYDRO_WATER_DENSITY_KG_PER_CM3 = 0.001;

export const CAESAR_ACCDB_FRICTION_SOLVER_PROFILE = deepFreeze({
  schema: 'caesar-accdb-friction-solver-profile/v1',
  profileId: 'M047-CAESAR-STIFFNESS-ACTIVE-SET-V1',
  method: 'CAESAR_STIFFNESS_ACTIVE_SET_V1',
  initialization: 'ALL_STICK',
  maximumIterations: 80,
  displacementUpdateRelativeTolerance: 1e-8,
  displacementUpdateAbsoluteToleranceM: 1e-12,
  reactionUpdateRelativeTolerance: 1e-8,
  reactionUpdateAbsoluteToleranceN: 1e-6,
  frictionForceRelativeTolerance: 1e-8,
  frictionForceAbsoluteToleranceN: 1e-6,
  frictionForceScaleFloorN: 1,
  frictionDirectionCosineTolerance: 1e-8,
  stateBoundaryRelativeTolerance: 1e-9,
  minimumSlipDirectionM: 1e-14,
  axisAlignmentTolerance: 1e-8,
  reconstructionRelativeResidualLimit: 1e-6,
  reconstructionForceScaleFloorN: 1,
  reconstructionMomentScaleFloorNm: 1,
  loadSteps: 1,
  relaxationFactor: 1,
  sensitivityMultipliers: Object.freeze([0.5, 1, 2]),
  numericalAuthority: 'IMPLEMENTATION_POLICY_NOT_CAESAR_AUTHORITY_DO_NOT_TUNE_TO_BENCHMARK_FAILURE_COUNTS',
});

/**
 * Solve BM4_L friction qualification cases in governed order L13, L7, L15, L1.
 * Controls L6, L5 and L14 are solved by the governed frozen linear adapter.
 */
export function solveCaesarAccdbFrictionBenchmark(
  benchmarkPackage,
  selectedCaseIds = ['L13', 'L7', 'L15', 'L1'],
  options = {},
) {
  requireBenchmarkPackage(benchmarkPackage);
  const profile = deepFreeze({
    ...CAESAR_ACCDB_FRICTION_SOLVER_PROFILE,
    ...(options.profile ?? {}),
  });
  const requested = new Set(selectedCaseIds.map(String));
  const allowed = new Set(['L13', 'L7', 'L15', 'L1']);
  const unknown = [...requested].filter((caseId) => !allowed.has(caseId));
  if (unknown.length > 0) {
    throw new TypeError(`M047 friction solver accepts only L13, L7, L15 and L1; got ${unknown.join(', ')}.`);
  }

  const controls = solveCaesarAccdbLinearBenchmark(benchmarkPackage, ['L5', 'L6', 'L14']);
  const primitiveResults = {};
  const mechanicsCases = {};
  const sensitivity = {};
  const repeatedRuns = {};

  if (requested.has('L13') || requested.has('L15')) {
    const solved = solveQualifiedPrimitive({
      benchmarkPackage,
      caseId: 'L13',
      controlCaseId: 'L6',
      baseCase: controls.cases.L6,
      baseEvidence: controls.mechanics.cases.L6,
      profile,
    });
    primitiveResults.L13 = solved.actualCase;
    mechanicsCases.L13 = solved.evidence;
    sensitivity.L13 = solved.sensitivity;
    repeatedRuns.L13 = solved.repeatedRun;
  }

  if (requested.has('L7') || requested.has('L15')) {
    const solved = solveQualifiedPrimitive({
      benchmarkPackage,
      caseId: 'L7',
      controlCaseId: 'L5',
      baseCase: controls.cases.L5,
      baseEvidence: controls.mechanics.cases.L5,
      profile,
    });
    primitiveResults.L7 = solved.actualCase;
    mechanicsCases.L7 = solved.evidence;
    sensitivity.L7 = solved.sensitivity;
    repeatedRuns.L7 = solved.repeatedRun;
  }

  if (requested.has('L15')) {
    const derived = buildDerivedL15(benchmarkPackage, primitiveResults.L7, primitiveResults.L13);
    primitiveResults.L15 = derived.actualCase;
    mechanicsCases.L15 = derived.evidence;
  }

  if (requested.has('L1')) {
    const hydroBase = buildHydrotestBase(benchmarkPackage);
    const solved = solveQualifiedPrimitive({
      benchmarkPackage,
      caseId: 'L1',
      controlCaseId: 'COUNTERFACTUAL-MU0-L1-WW+HP',
      baseCase: hydroBase.actualCase,
      baseEvidence: hydroBase.evidence,
      profile,
      baseAuthority: hydroBase.authority,
    });
    primitiveResults.L1 = solved.actualCase;
    mechanicsCases.L1 = solved.evidence;
    sensitivity.L1 = solved.sensitivity;
    repeatedRuns.L1 = solved.repeatedRun;
  }

  const cases = Object.fromEntries(['L13', 'L7', 'L15', 'L1']
    .filter((caseId) => requested.has(caseId))
    .map((caseId) => [caseId, primitiveResults[caseId]]));
  const pairedDeltas = buildPairedDeltaRca({ benchmarkPackage, controls, cases: primitiveResults });

  return deepFreeze({
    schema: 'lfea-accdb-benchmark-actual/v1',
    sourceAccdbSha256: benchmarkPackage.source.sha256,
    cases,
    mechanics: {
      schema: 'lfea-accdb-friction-solve-evidence/v1',
      sourceModelSemanticHash: benchmarkPackage.model.semanticHash,
      profile,
      executionOrder: Object.freeze(['L13', 'L7', 'L15', 'L1'].filter((caseId) => requested.has(caseId))),
      cases: mechanicsCases,
      pairedDeltas,
      repeatedRuns,
      sensitivity,
      limitations: Object.freeze([
        'Static dry friction only; no lift-off, one-directional contact, stress, EXP stress or HYD stress qualification is implemented.',
        'Bidirectional restraint contact is retained exactly as governed by M047 Stage 2.',
        'The qualified linear bend, tee, reducer, rigid, Bourdon, pressure, thermal-strain and recovery mechanics are consumed as frozen evidence and are not retuned here.',
        'Hydrotest WW uses 1000 kg/m^3 water and excludes insulation, matching the CAESAR default hydrotest interpretation; the transformation is emitted explicitly as diagnostic authority.',
      ]),
    },
  });
}

function solveQualifiedPrimitive(input) {
  const friction = resolveCaesarEffectiveFriction(input.benchmarkPackage, input.caseId);
  if (friction.kind !== 'PRIMITIVE' || !(friction.effectiveCoefficient > 0)) {
    throw new TypeError(`${input.caseId} must be a primitive case with positive governed effective friction.`);
  }
  const frictionStiffness = resolveFrictionStiffness(input.benchmarkPackage);
  const base = reconstructBaseSystem({
    benchmarkPackage: input.benchmarkPackage,
    caseId: input.caseId,
    controlCaseId: input.controlCaseId,
    baseCase: input.baseCase,
    baseEvidence: input.baseEvidence,
    profile: input.profile,
  });
  const nominal = solvePrimitiveActiveSet({
    ...input,
    base,
    friction,
    frictionStiffnessNPerM: frictionStiffness.valueNPerM,
    stiffnessMultiplier: 1,
  });
  const repeated = solvePrimitiveActiveSet({
    ...input,
    base,
    friction,
    frictionStiffnessNPerM: frictionStiffness.valueNPerM,
    stiffnessMultiplier: 1,
  });
  const nominalFingerprint = primitiveFingerprint(nominal);
  const repeatedFingerprint = primitiveFingerprint(repeated);
  if (nominalFingerprint !== repeatedFingerprint) {
    throw frictionError(
      `${input.caseId} repeated nominal run is not deterministic.`,
      'CAESAR_ACCDB_FRICTION_NONDETERMINISTIC',
    );
  }

  const sensitivityRuns = input.profile.sensitivityMultipliers.map((multiplier) => {
    if (multiplier === 1) return { multiplier, run: nominal, error: null };
    try {
      return {
        multiplier,
        run: solvePrimitiveActiveSet({
          ...input,
          base,
          friction,
          frictionStiffnessNPerM: frictionStiffness.valueNPerM * multiplier,
          stiffnessMultiplier: multiplier,
        }),
        error: null,
      };
    } catch (error) {
      if (!isFrictionDiagnosticError(error)) throw error;
      return {
        multiplier,
        run: null,
        error: { code: error.code, message: error.message },
      };
    }
  });
  const sensitivity = summarizeSensitivity(nominal, sensitivityRuns);
  const evidence = deepFreeze({
    ...nominal.evidence,
    governedFriction: friction,
    frictionStiffness,
    baseAuthority: input.baseAuthority ?? deepFreeze({
      kind: 'REAL_DATA_NONFRICTION_CONTROL',
      caseId: input.controlCaseId,
    }),
    deterministicRepeatedRun: {
      status: 'PASS',
      nominalFingerprint,
      repeatedFingerprint,
    },
  });
  const executionEvidenceHash = semanticHash(evidence);
  return {
    actualCase: deepFreeze({
      executionSemanticHash: nominal.executionSemanticHash,
      executionEvidenceHash,
      stiffnessStateHash: nominal.stiffnessStateHash,
      rows: nominal.rows,
    }),
    evidence,
    repeatedRun: deepFreeze({ status: 'PASS', nominalFingerprint, repeatedFingerprint }),
    sensitivity,
  };
}

function reconstructBaseSystem(input) {
  const ledger = input.baseEvidence.recoveryLedger;
  if (!Array.isArray(ledger) || ledger.length === 0) {
    throw new TypeError(`${input.controlCaseId} lacks the frozen recovery ledger required for friction reconstruction.`);
  }
  const nodeIds = input.baseEvidence.analysisNodePositions.map((entry) => String(entry.nodeId));
  const nodeIndex = new Map(nodeIds.map((nodeId, index) => [nodeId, index]));
  const n = nodeIds.length * 6;
  const K = new Array(n * n).fill(0);
  const F = new Array(n).fill(0);
  const baseSolverU = new Array(n).fill(Number.NaN);

  for (const entry of ledger) {
    const indices = elementIndices(nodeIndex, entry.nodeI, entry.nodeJ);
    requireVector(entry.globalStiffness, 144, `${entry.elementId}.globalStiffness`);
    requireVector(entry.equivalentLoadGlobal, 12, `${entry.elementId}.equivalentLoadGlobal`);
    requireVector(entry.initialStrainLoadGlobal, 12, `${entry.elementId}.initialStrainLoadGlobal`);
    requireVector(entry.jointDisplacement12, 12, `${entry.elementId}.jointDisplacement12`);
    for (let row = 0; row < 12; row += 1) {
      const gr = indices[row];
      F[gr] += entry.equivalentLoadGlobal[row] + entry.initialStrainLoadGlobal[row];
      setConsistent(baseSolverU, gr, entry.jointDisplacement12[row], `${entry.elementId}:jointDisplacement12`);
      for (let column = 0; column < 12; column += 1) {
        K[gr * n + indices[column]] += entry.globalStiffness[row * 12 + column];
      }
    }
  }
  if (baseSolverU.some((value) => !Number.isFinite(value))) {
    throw new TypeError(`${input.controlCaseId} frozen recovery ledger does not cover every analysis DOF.`);
  }

  const restraintState = buildRestraintState(input.benchmarkPackage, nodeIndex, input.profile);
  for (const constraint of restraintState.baseConstraints) {
    K[constraint.globalIndex * n + constraint.globalIndex] += constraint.stiffness;
  }
  const residual = matVec(K, n, baseSolverU).map((value, index) => value - F[index]);
  const reconstructionResidual = dimensionSeparatedReconstructionResidual(residual, F, input.profile);
  const normalizedResidual = reconstructionResidual.maximumRelativeResidual;
  if (normalizedResidual > input.profile.reconstructionRelativeResidualLimit) {
    throw frictionError(
      `${input.controlCaseId} frozen system reconstruction residual ${normalizedResidual} exceeds ${input.profile.reconstructionRelativeResidualLimit}.`,
      'CAESAR_ACCDB_FRICTION_BASE_RECONSTRUCTION_FAILED',
    );
  }

  const shiftByNode = derivePhysicalShift(input.baseCase.rows, baseSolverU, nodeIndex);
  return deepFreeze({
    controlCaseId: input.controlCaseId,
    nodeIds: Object.freeze(nodeIds),
    nodeIndex,
    n,
    K: Object.freeze(K),
    F: Object.freeze(F),
    baseSolverU: Object.freeze(baseSolverU),
    shiftByNode,
    baseConstraints: restraintState.baseConstraints,
    frictionSupports: restraintState.frictionSupports,
    recoveryLedger: ledger,
    baseRows: input.baseCase.rows,
    reconstructionRelativeResidual: normalizedResidual,
    reconstructionResidual,
  });
}

function buildRestraintState(benchmarkPackage, nodeIndex, profile) {
  const authority = benchmarkPackage.profile.configurationAuthority;
  const units = benchmarkPackage.model.tables.INPUT_UNITS.rows;
  if (units.length !== 1 || units[0].TRANS !== 'N./cm.' || units[0].ROT_STIFF !== 'N.m./deg') {
    throw new TypeError('M047 friction reconstruction requires ACCDB restraint units N./cm. and N.m./deg.');
  }
  const trans = resolveCaesarConfigurationSetting(authority, 'DEFAULT_TRANS_RESTRAINT_STIFF', null).value;
  const rot = resolveCaesarConfigurationSetting(authority, 'DEFAULT_ROT_RESTRAINT_STIFF', null).value;
  if (trans.unit !== 'DISPLAYED_CAESAR_UNITS' || rot.unit !== 'DISPLAYED_CAESAR_UNITS') {
    throw new TypeError('M047 restraint stiffness authority must use displayed CAESAR units.');
  }
  const translationStiffness = Number(trans.value) * N_PER_CM_TO_N_PER_M;
  const rotationStiffness = Number(rot.value) * N_M_PER_DEG_TO_N_M_PER_RAD;
  const constraints = new Map();
  const frictionSupports = [];
  const rows = benchmarkPackage.model.tables.INPUT_RESTRAINTS.rows;
  rows.forEach((row, rowIndex) => {
    const nodeId = String(row.NODE_NUM);
    if (!nodeIndex.has(nodeId)) throw new TypeError(`Restraint node ${nodeId} is absent from analysis nodes.`);
    const type = Number(row.RES_TYPEID);
    if (type === 1) {
      DOFS.forEach((dof, dofIndex) => constraints.set(`${nodeId}:${dof}`, deepFreeze({
        nodeId,
        dof,
        globalIndex: nodeIndex.get(nodeId) * 6 + dofIndex,
        stiffness: dof.startsWith('U') ? translationStiffness : rotationStiffness,
        kind: 'ANCHOR_COMPONENT',
      })));
      return;
    }
    const direction = [Number(row.XCOSINE), Number(row.YCOSINE), Number(row.ZCOSINE)];
    const magnitude = Math.hypot(...direction);
    if (!(magnitude > 0)) throw new TypeError(`Restraint ${nodeId} row ${rowIndex} has a zero normal direction.`);
    const normal = direction.map((value) => value / magnitude);
    const absolute = normal.map(Math.abs);
    const normalAxis = absolute.indexOf(Math.max(...absolute));
    if (Math.abs(absolute[normalAxis] - 1) > profile.axisAlignmentTolerance
      || absolute.some((value, index) => index !== normalAxis && value > profile.axisAlignmentTolerance)) {
      throw frictionError(
        `Restraint ${nodeId} row ${rowIndex} is not axis-aligned; the frozen BM4_L mechanics uses dominant-axis constraints and M047 will not invent skew-contact behavior.`,
        'CAESAR_ACCDB_FRICTION_SKEW_RESTRAINT_UNQUALIFIED',
      );
    }
    const dof = TRANSLATION_DOFS[normalAxis];
    const globalIndex = nodeIndex.get(nodeId) * 6 + normalAxis;
    constraints.set(`${nodeId}:${dof}`, deepFreeze({
      nodeId,
      dof,
      globalIndex,
      stiffness: translationStiffness,
      kind: 'DIRECTIONAL_RESTRAINT',
    }));
    frictionSupports.push(deepFreeze({
      supportId: `ACCDB-FRICTION-${nodeId}-R${rowIndex + 1}`,
      nodeId,
      sourceRowIndex: rowIndex,
      normalAxis,
      normalDirection: Object.freeze(normal),
      normalGlobalIndex: globalIndex,
      normalStiffness: translationStiffness,
      tangentAxes: Object.freeze([0, 1, 2].filter((axis) => axis !== normalAxis)),
    }));
  });
  return {
    baseConstraints: Object.freeze([...constraints.values()]
      .sort((left, right) => left.globalIndex - right.globalIndex)),
    frictionSupports: Object.freeze(frictionSupports
      .sort((left, right) => compareText(left.supportId, right.supportId))),
  };
}

function solvePrimitiveActiveSet(input) {
  const { base, profile, friction } = input;
  const mu = friction.effectiveCoefficient;
  const kf = input.frictionStiffnessNPerM;
  let states = new Map(base.frictionSupports.map((support) => [support.supportId, {
    state: 'STICK',
    slideForce: [0, 0, 0],
  }]));
  let previousU = null;
  let previousReaction = null;
  let previousSignature = null;
  let signatureTwoBack = null;
  const iterationLedger = [];
  let finalState = null;

  for (let iteration = 1; iteration <= profile.maximumIterations; iteration += 1) {
    const K = [...base.K];
    const rhs = [...base.F];
    for (const support of base.frictionSupports) {
      const current = states.get(support.supportId);
      const shift = base.shiftByNode.get(support.nodeId) ?? zero6();
      if (current.state === 'STICK') {
        for (const axis of support.tangentAxes) {
          const index = base.nodeIndex.get(support.nodeId) * 6 + axis;
          K[index * base.n + index] += kf;
          rhs[index] -= kf * shift[axis];
        }
      } else {
        for (const axis of support.tangentAxes) {
          const index = base.nodeIndex.get(support.nodeId) * 6 + axis;
          rhs[index] += current.slideForce[axis];
        }
      }
    }

    const U = solveScaledSpd(K, rhs, base.n, `${input.caseId} iteration ${iteration}`);
    const physicalU = physicalDisplacement(U, base);
    const classified = classifySupports({ base, U, physicalU, states, mu, kf, profile });
    const reactions = buildReactionVector(base, U, classified.appliedFrictionByNode);
    const recovered = recoverGlobalActions(base, U);
    const equilibrium = recoveredEquilibrium(base, recovered, reactions, input.benchmarkPackage.profile.equilibriumTolerance);
    const displacementUpdate = updateMetric(
      translationalDofValues(U),
      previousU === null ? null : translationalDofValues(previousU),
      profile.displacementUpdateAbsoluteToleranceM,
      profile.displacementUpdateRelativeTolerance,
      'TRANSLATIONAL_DOFS_ONLY',
      'm',
    );
    const reactionUpdate = updateMetric(
      translationalDofValues(reactions),
      previousReaction === null ? null : translationalDofValues(previousReaction),
      profile.reactionUpdateAbsoluteToleranceN,
      profile.reactionUpdateRelativeTolerance,
      'TRANSLATIONAL_DOFS_ONLY',
      'N',
    );
    const physics = frictionPhysicsGate(classified.rows, profile);
    const signature = classified.rows.map((row) => `${row.supportId}:${row.nextState}`).join('|');
    const stateStable = classified.stateChanges === 0;
    const converged = previousU !== null
      && stateStable
      && displacementUpdate.status === 'PASS'
      && reactionUpdate.status === 'PASS'
      && physics.status === 'PASS'
      && equilibrium.status === 'PASS';

    iterationLedger.push(deepFreeze({
      iteration,
      stiffnessMultiplier: input.stiffnessMultiplier,
      stateChanges: classified.stateChanges,
      stateSignature: signature,
      displacementUpdate,
      reactionUpdate,
      frictionPhysics: physics,
      equilibrium: {
        status: equilibrium.status,
        maximumAbsoluteResidual: equilibrium.maximumAbsoluteResidual,
      },
      supports: classified.rows,
      convergenceStatus: converged ? 'CONVERGED' : 'CONTINUE',
    }));

    if (converged) {
      finalState = { U, physicalU, reactions, recovered, equilibrium, classified, iteration };
      break;
    }
    if (classified.stateChanges > 0 && signatureTwoBack !== null && signature === signatureTwoBack) {
      throw frictionError(
        `${input.caseId} active set entered a deterministic two-cycle at iteration ${iteration}.`,
        'CAESAR_ACCDB_FRICTION_ACTIVE_SET_CYCLE',
      );
    }
    signatureTwoBack = previousSignature;
    previousSignature = signature;
    previousU = U;
    previousReaction = reactions;
    states = classified.nextStates;
  }

  if (finalState === null) {
    throw frictionError(
      `${input.caseId} did not satisfy all nonlinear convergence gates within ${profile.maximumIterations} iterations.`,
      'CAESAR_ACCDB_FRICTION_NOT_CONVERGED',
    );
  }
  const rows = updateResultRows(input.caseId, base, finalState);
  const stateMap = Object.freeze(finalState.classified.rows.map((row) => Object.freeze({
    supportId: row.supportId,
    nodeId: row.nodeId,
    state: row.nextState,
    normalReactionN: row.normalReactionN,
    frictionMagnitudeN: row.appliedFrictionMagnitudeN,
    capN: row.capN,
  })));
  const executionSemanticHash = semanticHash({
    schema: 'caesar-accdb-friction-execution/v1',
    caseId: input.caseId,
    solverProfileId: profile.profileId,
    governedEffectiveFriction: friction.effectiveCoefficient,
    frictionStiffnessNPerM: kf,
    controlCaseId: base.controlCaseId,
    rows,
  });
  const stiffnessStateHash = semanticHash({
    baseControlStiffnessStateHash: input.baseCase.stiffnessStateHash,
    frictionStiffnessNPerM: kf,
    stateMap,
  });
  return deepFreeze({
    rows,
    executionSemanticHash,
    stiffnessStateHash,
    finalReactionVector: Object.freeze(finalState.reactions),
    stateMap,
    evidence: {
      formula: caseRecord(input.benchmarkPackage, input.caseId).formula,
      controlCaseId: base.controlCaseId,
      method: profile.method,
      initialization: profile.initialization,
      stiffnessMultiplier: input.stiffnessMultiplier,
      frictionStiffnessNPerM: kf,
      effectiveCoefficient: mu,
      reconstructionRelativeResidual: base.reconstructionRelativeResidual,
      reconstructionResidual: base.reconstructionResidual,
      iterationCount: finalState.iteration,
      iterationLedger: Object.freeze(iterationLedger),
      activeSet: stateMap,
      executionStatus: 'PASS',
      nonlinearStateGate: finalState.classified.physicsStatus,
      recoveredEquilibrium: finalState.equilibrium,
      globalRecoveryDisagreement: { rule: 'ASSEMBLED_GLOBAL_ACTION_DIRECT_RECOVERY_V1', maximumAbsolute: 0 },
    },
  });
}

function classifySupports(input) {
  const nextStates = new Map();
  const appliedFrictionByNode = new Map();
  const rows = [];
  let stateChanges = 0;
  for (const support of input.base.frictionSupports) {
    const current = input.states.get(support.supportId);
    const nodeBase = input.base.nodeIndex.get(support.nodeId) * 6;
    const normalReactionGlobal = [0, 0, 0];
    normalReactionGlobal[support.normalAxis] = -support.normalStiffness * input.U[support.normalGlobalIndex];
    const signedNormalReactionN = dot(normalReactionGlobal, support.normalDirection);
    const capN = input.mu * Math.abs(signedNormalReactionN);
    const tangentialDisplacement = [0, 0, 0];
    for (const axis of support.tangentAxes) tangentialDisplacement[axis] = input.physicalU[nodeBase + axis];
    const slipMagnitudeM = Math.hypot(...tangentialDisplacement);
    const trialForce = tangentialDisplacement.map((value) => -input.kf * value);
    const trialMagnitudeN = Math.hypot(...trialForce);
    const boundaryToleranceN = input.profile.frictionForceAbsoluteToleranceN
      + input.profile.stateBoundaryRelativeTolerance
        * Math.max(input.profile.frictionForceScaleFloorN, capN);
    const nextState = trialMagnitudeN <= capN + boundaryToleranceN ? 'STICK' : 'SLIDE';
    let nextSlideForce = [0, 0, 0];
    if (nextState === 'SLIDE') {
      if (!(slipMagnitudeM > input.profile.minimumSlipDirectionM)) {
        throw frictionError(
          `${support.supportId} requires sliding but has no resolvable tangential direction.`,
          'CAESAR_ACCDB_FRICTION_SLIP_DIRECTION_UNRESOLVED',
        );
      }
      nextSlideForce = tangentialDisplacement.map((value) => -capN * value / slipMagnitudeM);
    }
    const appliedForce = current.state === 'STICK'
      ? trialForce
      : current.slideForce;
    addNodeVector(appliedFrictionByNode, support.nodeId, appliedForce);
    if (current.state !== nextState) stateChanges += 1;
    const appliedMagnitudeN = Math.hypot(...appliedForce);
    const directionCosine = slipMagnitudeM > input.profile.minimumSlipDirectionM && appliedMagnitudeN > 0
      ? dot(appliedForce, tangentialDisplacement) / (appliedMagnitudeN * slipMagnitudeM)
      : null;
    rows.push(deepFreeze({
      supportId: support.supportId,
      nodeId: support.nodeId,
      normalDirection: support.normalDirection,
      tangentialDisplacementM: Object.freeze(tangentialDisplacement),
      slipMagnitudeM,
      signedNormalReactionN,
      normalReactionN: Math.abs(signedNormalReactionN),
      effectiveCoefficient: input.mu,
      frictionStiffnessNPerM: input.kf,
      capN,
      trialTangentialForceN: Object.freeze(trialForce),
      trialMagnitudeN,
      currentState: current.state,
      nextState,
      appliedFrictionN: Object.freeze([...appliedForce]),
      appliedFrictionMagnitudeN: appliedMagnitudeN,
      nextSlideForceN: Object.freeze([...nextSlideForce]),
      directionCosine,
      stateChanged: current.state !== nextState,
      stickResidualN: current.state === 'STICK' ? vectorDistance(appliedForce, trialForce) : null,
      slideResidualN: current.state === 'SLIDE' ? Math.abs(appliedMagnitudeN - capN) : null,
      capViolationN: Math.max(0, appliedMagnitudeN - capN),
    }));
    nextStates.set(support.supportId, {
      state: nextState,
      slideForce: nextSlideForce,
    });
  }
  const physics = frictionPhysicsGate(rows, input.profile);
  return {
    rows: Object.freeze(rows),
    nextStates,
    appliedFrictionByNode,
    stateChanges,
    physicsStatus: physics,
  };
}

function frictionPhysicsGate(rows, profile) {
  const evaluated = rows.map((row) => {
    const forceTolerance = profile.frictionForceAbsoluteToleranceN
      + profile.frictionForceRelativeTolerance
        * Math.max(profile.frictionForceScaleFloorN, row.capN);
    const capPass = row.capViolationN <= forceTolerance;
    const constitutivePass = row.currentState === 'STICK'
      ? row.stickResidualN <= forceTolerance
      : row.slideResidualN <= forceTolerance;
    const directionPass = row.currentState !== 'SLIDE'
      || row.appliedFrictionMagnitudeN <= forceTolerance
      || (row.directionCosine !== null
        && row.directionCosine <= -1 + profile.frictionDirectionCosineTolerance);
    return {
      supportId: row.supportId,
      status: capPass && constitutivePass && directionPass ? 'PASS' : 'FAIL',
      capPass,
      constitutivePass,
      directionPass,
      forceToleranceN: forceTolerance,
    };
  });
  const failures = evaluated.filter((row) => row.status === 'FAIL');
  return deepFreeze({
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    counts: { total: evaluated.length, failed: failures.length },
    failures: Object.freeze(failures),
  });
}

function buildReactionVector(base, U, appliedFrictionByNode) {
  const reactions = new Array(base.n).fill(0);
  for (const constraint of base.baseConstraints) {
    reactions[constraint.globalIndex] += -constraint.stiffness * U[constraint.globalIndex];
  }
  for (const [nodeId, vector] of appliedFrictionByNode) {
    const offset = base.nodeIndex.get(nodeId) * 6;
    for (let axis = 0; axis < 3; axis += 1) reactions[offset + axis] += vector[axis];
  }
  return reactions;
}

function recoverGlobalActions(base, U) {
  const actions = [];
  const incident = new Map();
  const correction = new Map();
  for (const entry of base.recoveryLedger) {
    const indices = elementIndices(base.nodeIndex, entry.nodeI, entry.nodeJ);
    const joint = indices.map((index) => U[index]);
    const elastic = matrixVector(entry.globalStiffness, 12, joint);
    const qGlobal = elastic.map((value, index) => value
      - entry.equivalentLoadGlobal[index]
      - entry.initialStrainLoadGlobal[index]);
    actions.push(deepFreeze({ entry, qGlobal: Object.freeze(qGlobal) }));
    addIncident(incident, correction, entry.nodeI, qGlobal.slice(0, 6));
    addIncident(incident, correction, entry.nodeJ, qGlobal.slice(6, 12));
  }
  for (const [nodeId, vector] of correction) {
    incident.set(nodeId, incident.get(nodeId).map((value, index) => value + vector[index]));
  }
  return { actions: Object.freeze(actions), incident };
}

function recoveredEquilibrium(base, recovered, reactions, tolerance) {
  const rows = [];
  for (const nodeId of base.nodeIds) {
    const incident = recovered.incident.get(nodeId) ?? zero6();
    const offset = base.nodeIndex.get(nodeId) * 6;
    DOFS.forEach((dof, index) => {
      const reaction = reactions[offset + index];
      const residual = incident[index] - reaction;
      const limit = dof.startsWith('U') ? tolerance.forceN : tolerance.momentNm;
      rows.push(deepFreeze({
        nodeId,
        dof,
        incidentAction: clean(incident[index]),
        reaction: clean(reaction),
        appliedNodalLoad: 0,
        residual: clean(residual),
        limit,
        status: Math.abs(residual) <= limit ? 'PASS' : 'FAIL',
      }));
    });
  }
  const failures = rows.filter((row) => row.status === 'FAIL');
  return deepFreeze({
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    rule: 'SUM_ELEMENT_END_ACTIONS_EQUALS_BASE_PLUS_FRICTION_SUPPORT_REACTION_V1',
    counts: { total: rows.length, passed: rows.length - failures.length, failed: failures.length },
    maximumAbsoluteResidual: {
      forceN: maxAbs(rows.filter((row) => row.dof.startsWith('U')).map((row) => row.residual)),
      momentNm: maxAbs(rows.filter((row) => row.dof.startsWith('R')).map((row) => row.residual)),
    },
    failures: Object.freeze(failures),
  });
}

function updateResultRows(caseId, base, finalState) {
  const values = new Map();
  for (const nodeId of base.nodeIds) {
    const offset = base.nodeIndex.get(nodeId) * 6;
    const shift = base.shiftByNode.get(nodeId) ?? zero6();
    DOFS.forEach((dof, index) => {
      const physical = finalState.U[offset + index] + shift[index];
      const isTranslation = index < 3;
      values.set(rowIdentity('NODE', nodeId, isTranslation ? 'DISPLACEMENT' : 'ROTATION', dof), clean(physical));
      values.set(rowIdentity('NODE', nodeId, isTranslation ? 'FORCE' : 'MOMENT', dof), clean(finalState.reactions[offset + index]));
      const incident = finalState.recovered.incident.get(nodeId) ?? zero6();
      values.set(rowIdentity(
        'NODE', nodeId,
        isTranslation ? 'INCIDENT_GLOBAL_FORCE' : 'INCIDENT_GLOBAL_MOMENT',
        dof,
      ), clean(incident[index]));
    });
  }
  for (const recovered of finalState.recovered.actions) appendElementValueMap(values, recovered.entry.elementId, recovered.qGlobal);
  const sourceRows = sortedSourceRows(base, finalState.recovered.actions);
  for (const source of sourceRows) {
    const descendants = finalState.recovered.actions.filter((entry) =>
      String(entry.entry.sourceElementId) === String(source.ELEMENTID));
    appendElementValueMap(values, sourceResultElementId(source), [
      ...descendants[0].qGlobal.slice(0, 6),
      ...descendants.at(-1).qGlobal.slice(6, 12),
    ]);
  }
  return Object.freeze(base.baseRows.map((row) => {
    const identity = rowIdentity(row.entityKind, row.entityId, row.quantity, row.component);
    if (!values.has(identity)) {
      throw new TypeError(`Nonlinear recovery did not reproduce base result identity ${identity}.`);
    }
    return deepFreeze({ ...row, caseId, value: values.get(identity) });
  }));
}

function appendElementValueMap(values, entityId, qGlobal) {
  for (const [label, offset] of [['FROM', 0], ['TO', 6]]) {
    FORCE_COMPONENTS.forEach((component, index) => values.set(
      rowIdentity('ELEMENT', entityId, `GLOBAL_END_FORCE_${label}`, component),
      clean(qGlobal[offset + index]),
    ));
    MOMENT_COMPONENTS.forEach((component, index) => values.set(
      rowIdentity('ELEMENT', entityId, `GLOBAL_END_MOMENT_${label}`, component),
      clean(qGlobal[offset + index + 3]),
    ));
  }
}

function buildDerivedL15(benchmarkPackage, l7, l13) {
  if (!l7 || !l13) throw new TypeError('L15 requires independently converged L7 and L13 states.');
  const rows = subtractRows('L15', l7.rows, l13.rows);
  const recoveredEquilibrium = equilibriumFromResultRows(
    rows,
    benchmarkPackage.profile.equilibriumTolerance,
  );
  const evidence = deepFreeze({
    formula: 'L15=L7-L13',
    combinationMethod: 'ALG',
    independentNonlinearSolve: false,
    operandExecutionSemanticHashes: Object.freeze([l7.executionSemanticHash, l13.executionSemanticHash]),
    algebraicIdentityMaximumAbsoluteResidual: 0,
    executionStatus: recoveredEquilibrium.status === 'PASS' ? 'PASS' : 'FAIL',
    recoveredEquilibrium,
  });
  if (evidence.executionStatus !== 'PASS') {
    throw frictionError('L15 derived equilibrium failed.', 'CAESAR_ACCDB_FRICTION_L15_EQUILIBRIUM_FAILED');
  }
  const executionSemanticHash = semanticHash({ schema: 'caesar-accdb-derived-friction-case/v1', rows, evidence });
  return {
    actualCase: deepFreeze({
      executionSemanticHash,
      executionEvidenceHash: semanticHash(evidence),
      stiffnessStateHash: semanticHash({ kind: 'ALG', operands: evidence.operandExecutionSemanticHashes }),
      rows,
    }),
    evidence,
  };
}

function equilibriumFromResultRows(rows, tolerance) {
  const values = new Map(rows.filter((row) => row.entityKind === 'NODE').map((row) => [
    rowIdentity(row.entityKind, row.entityId, row.quantity, row.component),
    Number(row.value),
  ]));
  const nodeIds = [...new Set(rows.filter((row) => row.entityKind === 'NODE').map((row) => String(row.entityId)))];
  let forceN = 0;
  let momentNm = 0;
  for (const nodeId of nodeIds) {
    TRANSLATION_DOFS.forEach((component) => {
      const incident = values.get(rowIdentity('NODE', nodeId, 'INCIDENT_GLOBAL_FORCE', component)) ?? 0;
      const reaction = values.get(rowIdentity('NODE', nodeId, 'FORCE', component)) ?? 0;
      forceN = Math.max(forceN, Math.abs(incident - reaction));
    });
    DOFS.slice(3).forEach((component) => {
      const incident = values.get(rowIdentity('NODE', nodeId, 'INCIDENT_GLOBAL_MOMENT', component)) ?? 0;
      const reaction = values.get(rowIdentity('NODE', nodeId, 'MOMENT', component)) ?? 0;
      momentNm = Math.max(momentNm, Math.abs(incident - reaction));
    });
  }
  return deepFreeze({
    status: forceN <= tolerance.forceN && momentNm <= tolerance.momentNm ? 'PASS' : 'FAIL',
    rule: 'DERIVED_RESULT_INCIDENT_ACTION_MINUS_SUPPORT_REACTION_V1',
    maximumAbsoluteResidual: { forceN, momentNm },
  });
}

function buildHydrotestBase(benchmarkPackage) {
  const adapted = hydrotestCompatibilityPackage(benchmarkPackage);
  const solved = solveFrozenLinearBenchmark(adapted, ['L1']);
  const authority = deepFreeze({
    kind: 'COUNTERFACTUAL_ZERO_FRICTION_HYDROTEST_BASE',
    benchmarkAuthority: 'ACCDB_L1_WW+HP_WITH_FRICTION_REMOVED_ONLY_FOR_NONLINEAR_BASE_CONSTRUCTION',
    waterDensityKgPerM3: 1000,
    insulationIncluded: false,
    pressureField: 'HYDRO_PRESSURE',
    sourceModelInput: 'PINNED_BM4_L_ACCDB',
  });
  return {
    actualCase: solved.cases.L1,
    evidence: deepFreeze({ ...solved.mechanics.cases.L1, hydrotestCompatibilityAuthority: authority }),
    authority,
  };
}

function hydrotestCompatibilityPackage(benchmarkPackage) {
  const rows = benchmarkPackage.model.tables.INPUT_BASIC_ELEMENT_DATA.rows.map((row) => {
    const hydro = Number(row.HYDRO_PRESSURE);
    if (!(hydro >= 0)) throw new TypeError(`Element ${row.ELEMENTID} has invalid HYDRO_PRESSURE.`);
    return {
      ...row,
      PRESSURE1: hydro,
      FLUID_DENSITY: HYDRO_WATER_DENSITY_KG_PER_CM3,
      INSUL_THICK: 0,
      INSUL_DENSITY: 0,
    };
  });
  const authority = benchmarkPackage.profile.configurationAuthority;
  const cases = benchmarkPackage.cases.map((entry) => entry.caseId === 'L1'
    ? { ...entry, formula: 'W+P1' }
    : entry);
  const transformedModelHash = semanticHash({
    sourceModelSemanticHash: benchmarkPackage.model.semanticHash,
    adapter: 'M047-HYDROTEST-WW-HP-TO-FROZEN-W-P1-V1',
    waterDensityKgPerM3: 1000,
    insulationIncluded: false,
    pressureMapping: 'HYDRO_PRESSURE->PRESSURE1',
  });
  return {
    ...benchmarkPackage,
    cases,
    model: {
      ...benchmarkPackage.model,
      semanticHash: transformedModelHash,
      tables: {
        ...benchmarkPackage.model.tables,
        INPUT_BASIC_ELEMENT_DATA: {
          ...benchmarkPackage.model.tables.INPUT_BASIC_ELEMENT_DATA,
          rows,
        },
      },
    },
    profile: {
      ...benchmarkPackage.profile,
      configurationAuthority: {
        ...authority,
        layers: {
          ...authority.layers,
          modelInput: {
            ...authority.layers.modelInput,
            settings: {
              ...authority.layers.modelInput.settings,
              COEFFICIENT_OF_FRICTION_MU: 0,
            },
          },
        },
      },
    },
  };
}

function buildPairedDeltaRca({ benchmarkPackage, controls, cases }) {
  const pairs = [
    ['L13-L6', cases.L13?.rows, controls.cases.L6.rows, benchmarkPackage.references.L13?.rows, benchmarkPackage.references.L6?.rows],
    ['L7-L5', cases.L7?.rows, controls.cases.L5.rows, benchmarkPackage.references.L7?.rows, benchmarkPackage.references.L5?.rows],
    ['L15-L14', cases.L15?.rows, controls.cases.L14.rows, benchmarkPackage.references.L15?.rows, benchmarkPackage.references.L14?.rows],
  ];
  return deepFreeze(Object.fromEntries(pairs.flatMap(([id, actualLeft, actualRight, refLeft, refRight]) => {
    if (!actualLeft || !actualRight || !refLeft || !refRight) return [];
    const actualDelta = subtractRows(`RCA:${id}:ACTUAL`, actualLeft, actualRight);
    const referenceDelta = subtractRows(`RCA:${id}:REFERENCE`, refLeft, refRight);
    const comparison = compareBenchmarkResultRows({
      caseId: `RCA:${id}`,
      referenceRows: referenceDelta,
      actualRows: actualDelta,
      tolerances: benchmarkPackage.profile.tolerances,
      optionalQuantities: [],
      exposedQuantities: [...new Set(actualDelta.map((row) => row.quantity))],
      excludedQuantities: benchmarkPackage.profile.engineeringAssessment?.equilibriumOnlyQuantities ?? [],
    });
    return [[id, deepFreeze({
      actualDeltaRows: actualDelta,
      referenceDeltaRows: referenceDelta,
      comparison,
    })]];
  })));
}

function summarizeSensitivity(nominal, records) {
  const nominalStates = new Map(nominal.stateMap.map((row) => [row.supportId, row.state]));
  const nominalTranslationReaction = translationalDofValues(nominal.finalReactionVector);
  const nominalMomentReaction = rotationalDofValues(nominal.finalReactionVector);
  const runs = records.map((record) => {
    if (record.run === null) {
      return deepFreeze({
        stiffnessMultiplier: record.multiplier,
        convergenceStatus: 'DIAGNOSTIC_FAILED',
        iterationCount: null,
        stateFlipCount: null,
        stateFlipSupportIds: null,
        translationReactionVectorRelativeChange: null,
        momentReactionVectorRelativeChange: null,
        fingerprint: null,
        error: record.error,
        qualificationUse: 'DIAGNOSTIC_ONLY',
      });
    }
    const run = record.run;
    const stateFlips = run.stateMap.filter((row) => nominalStates.get(row.supportId) !== row.state);
    const translationReaction = translationalDofValues(run.finalReactionVector);
    const momentReaction = rotationalDofValues(run.finalReactionVector);
    return deepFreeze({
      stiffnessMultiplier: run.evidence.stiffnessMultiplier,
      convergenceStatus: run.evidence.executionStatus,
      iterationCount: run.evidence.iterationCount,
      stateFlipCount: stateFlips.length,
      stateFlipSupportIds: Object.freeze(stateFlips.map((row) => row.supportId)),
      translationReactionVectorRelativeChange: relativeVectorChange(
        translationReaction,
        nominalTranslationReaction,
      ),
      momentReactionVectorRelativeChange: relativeVectorChange(
        momentReaction,
        nominalMomentReaction,
      ),
      fingerprint: primitiveFingerprint(run),
      error: null,
      qualificationUse: run.evidence.stiffnessMultiplier === 1 ? 'NOMINAL' : 'DIAGNOSTIC_ONLY',
    });
  });
  return deepFreeze({
    nominalMultiplier: 1,
    rule: 'SENSITIVITY_IS_DIAGNOSTIC_AND_CANNOT_INVALIDATE_A_CONVERGED_NOMINAL_RUN',
    reactionChangeRule: 'FORCE_AND_MOMENT_REACTION_NORMS_REPORTED_SEPARATELY_NO_MIXED_UNITS',
    diagnosticFailureCount: runs.filter((run) => run.convergenceStatus === 'DIAGNOSTIC_FAILED').length,
    runs: Object.freeze(runs),
  });
}

function resolveFrictionStiffness(benchmarkPackage) {
  const record = resolveCaesarConfigurationSetting(
    benchmarkPackage.profile.configurationAuthority,
    'FRICT_STIF',
    null,
  );
  if (record.value.unit !== 'DISPLAYED_CAESAR_UNITS') {
    throw new TypeError('FRICT_STIF must be governed in displayed CAESAR units.');
  }
  const displayedValue = Number(record.value.value);
  return deepFreeze({
    setting: 'FRICT_STIF',
    authority: record,
    displayedValue,
    displayedUnit: 'N/cm',
    conversion: 'N/cm * 100 = N/m',
    valueNPerM: displayedValue * N_PER_CM_TO_N_PER_M,
  });
}

function derivePhysicalShift(rows, solverU, nodeIndex) {
  const shift = new Map();
  const rowMap = new Map(rows.filter((row) => row.entityKind === 'NODE'
    && ['DISPLACEMENT', 'ROTATION'].includes(row.quantity))
    .map((row) => [`${row.entityId}:${row.component}`, Number(row.value)]));
  for (const [nodeId, nodeNumber] of nodeIndex) {
    if (!rowMap.has(`${nodeId}:UX`)) continue;
    const vector = DOFS.map((dof, index) => rowMap.get(`${nodeId}:${dof}`) - solverU[nodeNumber * 6 + index]);
    shift.set(nodeId, Object.freeze(vector));
  }
  return shift;
}

function physicalDisplacement(U, base) {
  const result = [...U];
  for (const [nodeId, shift] of base.shiftByNode) {
    const offset = base.nodeIndex.get(nodeId) * 6;
    for (let index = 0; index < 6; index += 1) result[offset + index] += shift[index];
  }
  return result;
}

function solveScaledSpd(K, rhs, n, context) {
  const scale = new Array(n);
  for (let index = 0; index < n; index += 1) {
    const diagonal = K[index * n + index];
    if (!(diagonal > 0)) {
      throw frictionError(`${context} has nonpositive diagonal at DOF ${index}.`, 'CAESAR_ACCDB_FRICTION_MATRIX_INVALID');
    }
    scale[index] = 1 / Math.sqrt(diagonal);
  }
  const scaled = new Array(n * n);
  for (let row = 0; row < n; row += 1) {
    for (let column = 0; column < n; column += 1) {
      scaled[row * n + column] = K[row * n + column] * scale[row] * scale[column];
    }
  }
  const factor = choleskyDecompose(scaled, n);
  if (!factor.success) {
    throw frictionError(
      `${context} scaled stiffness is not positive definite at pivot ${factor.failedIndex}.`,
      'CAESAR_ACCDB_FRICTION_CHOLESKY_FAILED',
    );
  }
  const y = solveCholesky(factor.L, n, rhs.map((value, index) => value * scale[index]));
  return y.map((value, index) => value * scale[index]);
}

function subtractRows(caseId, leftRows, rightRows) {
  const left = new Map(leftRows.map((row) => [caseIndependentIdentity(row), row]));
  const right = new Map(rightRows.map((row) => [caseIndependentIdentity(row), row]));
  const identities = [...new Set([...left.keys(), ...right.keys()])].sort(compareText);
  return Object.freeze(identities.map((identity) => {
    const a = left.get(identity);
    const b = right.get(identity);
    if (!a || !b) throw new TypeError(`${caseId} delta has incomplete row identity ${identity}.`);
    if (a.unit !== b.unit) throw new TypeError(`${caseId} delta unit mismatch at ${identity}.`);
    return deepFreeze({
      caseId,
      entityKind: a.entityKind,
      entityId: a.entityId,
      quantity: a.quantity,
      component: a.component,
      value: Number(a.value) - Number(b.value),
      unit: a.unit,
      required: a.required !== false && b.required !== false,
    });
  }));
}

function primitiveFingerprint(run) {
  return semanticHash({
    rows: run.rows,
    stateMap: run.stateMap,
    iterationLedger: run.evidence.iterationLedger,
  });
}

function updateMetric(current, previous, absoluteTolerance, relativeTolerance, scope, unit) {
  if (previous === null) {
    return deepFreeze({
      scope,
      unit,
      absolute: Infinity,
      relative: Infinity,
      scale: 0,
      combinedLimit: absoluteTolerance,
      absoluteTolerance,
      relativeTolerance,
      status: 'NOT_EVALUATED',
    });
  }
  if (current.length !== previous.length) {
    throw new TypeError(`${scope} update vectors have inconsistent lengths.`);
  }
  const difference = current.map((value, index) => value - previous[index]);
  const absolute = maxAbs(difference);
  const scale = Math.max(maxAbs(current), maxAbs(previous));
  const relative = scale === 0 ? (absolute === 0 ? 0 : Infinity) : absolute / scale;
  const combinedLimit = absoluteTolerance + relativeTolerance * scale;
  return deepFreeze({
    scope,
    unit,
    absolute,
    relative,
    scale,
    combinedLimit,
    absoluteTolerance,
    relativeTolerance,
    status: absolute <= combinedLimit ? 'PASS' : 'FAIL',
  });
}

function translationalDofValues(vector) {
  if (!Array.isArray(vector) || vector.length % DOFS.length !== 0) {
    throw new TypeError('A complete six-DOF vector is required for translational projection.');
  }
  const values = [];
  for (let offset = 0; offset < vector.length; offset += DOFS.length) {
    values.push(vector[offset], vector[offset + 1], vector[offset + 2]);
  }
  return values;
}

function rotationalDofValues(vector) {
  if (!Array.isArray(vector) || vector.length % DOFS.length !== 0) {
    throw new TypeError('A complete six-DOF vector is required for rotational projection.');
  }
  const values = [];
  for (let offset = 0; offset < vector.length; offset += DOFS.length) {
    values.push(vector[offset + 3], vector[offset + 4], vector[offset + 5]);
  }
  return values;
}

function relativeVectorChange(current, baseline) {
  if (current.length !== baseline.length) throw new TypeError('Sensitivity vectors have inconsistent lengths.');
  const difference = current.map((value, index) => value - baseline[index]);
  const scale = Math.max(norm2(baseline), Number.MIN_VALUE);
  return norm2(difference) / scale;
}

function dimensionSeparatedReconstructionResidual(residual, reference, profile) {
  const forceResidual = translationalDofValues(residual);
  const momentResidual = rotationalDofValues(residual);
  const forceReference = translationalDofValues(reference);
  const momentReference = rotationalDofValues(reference);
  const forceScaleN = Math.max(profile.reconstructionForceScaleFloorN, maxAbs(forceReference));
  const momentScaleNm = Math.max(profile.reconstructionMomentScaleFloorNm, maxAbs(momentReference));
  const forceRelativeResidual = maxAbs(forceResidual) / forceScaleN;
  const momentRelativeResidual = maxAbs(momentResidual) / momentScaleNm;
  return deepFreeze({
    rule: 'FORCE_AND_MOMENT_EQUATIONS_NORMALIZED_SEPARATELY_BEFORE_DIMENSIONLESS_MAX',
    force: {
      maximumAbsoluteResidualN: maxAbs(forceResidual),
      scaleN: forceScaleN,
      relativeResidual: forceRelativeResidual,
    },
    moment: {
      maximumAbsoluteResidualNm: maxAbs(momentResidual),
      scaleNm: momentScaleNm,
      relativeResidual: momentRelativeResidual,
    },
    maximumRelativeResidual: Math.max(forceRelativeResidual, momentRelativeResidual),
  });
}

function isFrictionDiagnosticError(error) {
  return typeof error?.code === 'string' && error.code.startsWith('CAESAR_ACCDB_FRICTION_');
}

function sortedSourceRows(base, recoveredActions) {
  const byId = new Map();
  for (const action of recoveredActions) {
    if (!byId.has(String(action.entry.sourceElementId))) byId.set(String(action.entry.sourceElementId), action.entry);
  }
  return [...byId.keys()].map((sourceElementId) => {
    const sourceRow = sourceRowFromResultId(base.baseRows, sourceElementId);
    if (!sourceRow) throw new TypeError(`Cannot recover source element identity ${sourceElementId}.`);
    return sourceRow;
  }).sort((a, b) => Number(a.ELEMENTID) - Number(b.ELEMENTID));
}

function sourceRowFromResultId(baseRows, sourceElementId) {
  const prefix = `INPUT_ELEMENT:${sourceElementId}|`;
  const row = baseRows.find((entry) => entry.entityKind === 'ELEMENT' && String(entry.entityId).startsWith(prefix));
  if (!row) return null;
  const match = /^INPUT_ELEMENT:([^|]+)\|([^>-]+)->([^|]+)\|(.*)$/u.exec(String(row.entityId));
  if (!match) return null;
  return { ELEMENTID: match[1], FROM_NODE: match[2], TO_NODE: match[3], ELEMENT_NAME: match[4] };
}

function sourceResultElementId(row) {
  return `INPUT_ELEMENT:${String(row.ELEMENTID)}|${String(row.FROM_NODE)}->${String(row.TO_NODE)}`
    + `|${String(row.ELEMENT_NAME ?? '').trim()}`;
}

function elementIndices(nodeIndex, nodeI, nodeJ) {
  const left = nodeIndex.get(String(nodeI));
  const right = nodeIndex.get(String(nodeJ));
  if (left === undefined || right === undefined) throw new TypeError(`Element ${nodeI}->${nodeJ} has unknown node.`);
  return [...DOFS.map((_dof, index) => left * 6 + index), ...DOFS.map((_dof, index) => right * 6 + index)];
}

function setConsistent(vector, index, value, context) {
  if (!Number.isFinite(value)) throw new TypeError(`${context} contains nonfinite displacement.`);
  if (Number.isFinite(vector[index])) {
    const tolerance = 1e-12 * Math.max(1, Math.abs(vector[index]), Math.abs(value));
    if (Math.abs(vector[index] - value) > tolerance) {
      throw new TypeError(`${context} gives inconsistent shared-node displacement at index ${index}.`);
    }
  } else {
    vector[index] = value;
  }
}

function requireVector(value, length, field) {
  if (!Array.isArray(value) || value.length !== length || value.some((entry) => !Number.isFinite(Number(entry)))) {
    throw new TypeError(`${field} must contain ${length} finite numbers.`);
  }
}

function addNodeVector(map, nodeId, vector) {
  const prior = map.get(String(nodeId)) ?? [0, 0, 0];
  vector.forEach((value, index) => { prior[index] += value; });
  map.set(String(nodeId), prior);
}

function addIncident(map, correctionMap, nodeId, vector) {
  const id = String(nodeId);
  const prior = map.get(id) ?? zero6();
  const corrections = correctionMap.get(id) ?? zero6();
  vector.forEach((term, index) => {
    const next = prior[index] + term;
    corrections[index] += Math.abs(prior[index]) >= Math.abs(term)
      ? (prior[index] - next) + term
      : (term - next) + prior[index];
    prior[index] = next;
  });
  map.set(id, prior);
  correctionMap.set(id, corrections);
}

function matrixVector(matrix, n, vector) {
  const result = new Array(n).fill(0);
  for (let row = 0; row < n; row += 1) {
    let sum = 0;
    for (let column = 0; column < n; column += 1) sum += matrix[row * n + column] * vector[column];
    result[row] = sum;
  }
  return result;
}

function matVec(matrix, n, vector) { return matrixVector(matrix, n, vector); }
function dot(left, right) { return left.reduce((sum, value, index) => sum + value * right[index], 0); }
function norm2(value) { return Math.sqrt(dot(value, value)); }
function vectorDistance(left, right) { return Math.hypot(...left.map((value, index) => value - right[index])); }
function maxAbs(values) { return values.length === 0 ? 0 : Math.max(...values.map((value) => Math.abs(Number(value)))); }
function zero6() { return [0, 0, 0, 0, 0, 0]; }
function clean(value) { return Object.is(value, -0) || Math.abs(value) < 1e-12 ? 0 : value; }
function compareText(left, right) { return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0; }
function rowIdentity(entityKind, entityId, quantity, component) { return [entityKind, entityId, quantity, component].join(':'); }
function caseIndependentIdentity(row) { return rowIdentity(row.entityKind, row.entityId, row.quantity, row.component); }
function caseRecord(benchmarkPackage, caseId) {
  const record = benchmarkPackage.cases.find((entry) => entry.caseId === caseId);
  if (!record) throw new TypeError(`Unknown ACCDB case ${caseId}.`);
  return record;
}
function requireBenchmarkPackage(value) {
  if (!value || value.schema !== 'caesar-accdb-benchmark-package/v1') {
    throw new TypeError('A canonical CAESAR ACCDB benchmark package is required.');
  }
}
function frictionError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
