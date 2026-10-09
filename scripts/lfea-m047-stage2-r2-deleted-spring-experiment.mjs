#!/usr/bin/env node
/**
 * M047 Stage 2 R2 — CAESAR-documented deleted-spring friction experiment.
 *
 * This command is intentionally separate from the governed return-map solver.
 * It measures one alternative iteration strategy against the real ACCDB while
 * preserving the qualified production path unchanged:
 *
 *   STICK: assemble k_f in every free tangential direction.
 *   BREAKAWAY: when the elastic trial resultant exceeds mu|N|, mark SLIDE.
 *   SLIDE: on the next iteration delete k_f and apply the previous iteration's
 *          constant capped force opposite the current tangential drag direction.
 *
 * R2's hypothesis is that CAESAR may report the first state-stable iterate even
 * when reaction/displacement updates have not reached a nonlinear fixed point.
 * Therefore this command records BOTH:
 *   1. the first state-stable snapshot (the stopping-rule hypothesis), and
 *   2. continued diagnostic iterations through the declared budget, so a limit
 *      cycle or non-converged reaction update remains visible rather than hidden.
 *
 * No tolerance, acceptance criterion, production solver profile or result row is
 * changed by this experiment.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { resolveCaesarFrictionAuthority } from '../src/core/fea-benchmarks/caesar-friction-authority.js';
import {
  CAESAR_ACCDB_CASE_GATES,
  executeCaesarAccdbCaseState,
  prepareCaesarAccdbCaseState,
} from '../src/core/fea-benchmarks/caesar-accdb-linear-solve.js';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const STRATEGY = 'DELETED_SPRING_WITH_CONSTANT_FORCE_AND_STATE_STABLE_STOP_V1';
const STOP_RULE = 'FIRST_ZERO_STATE_CHANGE_ITERATION_RECORDED_AS_HYPOTHETICAL_CAESAR_REPORTING_POINT_V1';
const CONTINUATION_RULE = 'CONTINUE_AFTER_STATE_STABLE_FOR_DIAGNOSTIC_UPDATE_CYCLE_EVIDENCE_V1';
const TRANSLATION_DOFS = Object.freeze(['UX', 'UY', 'UZ']);
const DOFS = Object.freeze(['UX', 'UY', 'UZ', 'RX', 'RY', 'RZ']);
const CAESAR_ANCHOR_RESTRAINT_TYPE = 1;
const AXIS_ALIGNMENT_TOLERANCE = 1e-9;
const FLOAT32_COEFFICIENT_TOLERANCE = 1e-6;
const FRICTION_COLUMN_PATTERN = /^(?:MU|FRICTION|FRIC_COEF|FRICT(?:ION)?_?(?:COEF|COEFF|COEFFICIENT)?|COEF(?:F)?_?FRICT(?:ION)?)$/u;

const NUMERICS = Object.freeze({
  maximumIterations: 60,
  stateBoundaryAbsoluteN: 1e-6,
  stateBoundaryRelative: 1e-9,
  zeroTangentialMotionFloorM: 1e-15,
});

export async function runDeletedSpringExperiment(input) {
  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const rawExport = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: requiredCaesarAccdbTables(profile),
  });
  const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({ rawExport, profile });
  const caseId = input.caseId ?? 'L13';
  const caseRecord = benchmarkPackage.cases.find((row) => row.caseId === caseId);
  if (!caseRecord) throw new TypeError(`Unknown ACCDB case ${caseId}.`);
  const frictionAuthority = resolveCaesarFrictionAuthority({
    authority: benchmarkPackage.profile.configurationAuthority,
    cases: benchmarkPackage.cases,
    caseId,
    inputUnitRows: benchmarkPackage.model.tables.INPUT_UNITS.rows,
  });
  if (!frictionAuthority.frictionActive || frictionAuthority.kind !== 'PRIMITIVE') {
    throw new TypeError(`R2 requires a primitive friction-active case; ${caseId} is not one.`);
  }

  const plan = buildPlan(benchmarkPackage, frictionAuthority);
  const prepared = prepareCaesarAccdbCaseState({
    benchmarkPackage,
    caseRecord,
    solveProfile: benchmarkPackage.profile.linearSolve,
    gate: CAESAR_ACCDB_CASE_GATES.NONLINEAR_EFFECTIVE_FRICTION,
    frictionDofKeys: plan.frictionDofKeys,
  });

  let states = new Map(plan.supports.map((support) => [support.restraintId, 'STICK']));
  let slipDirections = new Map(plan.supports.map((support) => [support.restraintId, null]));
  let previousExecution = null;
  let firstStateStable = null;
  const iterations = [];
  const maximumIterations = Number(input.maximumIterations ?? NUMERICS.maximumIterations);

  for (let iteration = 1; iteration <= maximumIterations; iteration += 1) {
    const overlay = buildOverlay({ benchmarkPackage, caseRecord, plan, states, slipDirections, iteration });
    const executed = executeCaesarAccdbCaseState({ prepared, overlay });
    const measured = measureSupports({ plan, states, slipDirections, executed });
    const stateChanges = measured
      .filter((entry) => entry.state !== entry.nextState)
      .map((entry) => ({
        restraintId: entry.restraintId,
        nodeId: entry.nodeId,
        from: entry.state,
        to: entry.nextState,
      }));
    const updates = updateNorms(previousExecution, executed);
    const record = {
      iteration,
      stateChangeCount: stateChanges.length,
      stateChanges,
      stateSignature: stateSignature(measured),
      displacementUpdateNormM: updates.displacementUpdateNormM,
      reactionUpdateNormN: updates.reactionUpdateNormN,
      recoveredEquilibriumStatus: executed.recoveredEquilibrium.status,
      recoveredEquilibriumMaximumAbsoluteResidual: executed.recoveredEquilibrium.maximumAbsoluteResidual,
      executionSemanticHash: executed.execution.semanticHash,
      stiffnessStateHash: executed.execution.stiffnessStateHash,
      supportRows: measured.map((entry) => entry.ledger),
    };
    iterations.push(record);

    if (firstStateStable === null && stateChanges.length === 0 && iteration > 1) {
      firstStateStable = buildStateStableSnapshot({ benchmarkPackage, caseId, iteration, measured, updates, executed });
    }

    previousExecution = executed;
    states = new Map(measured.map((entry) => [entry.restraintId, entry.nextState]));
    slipDirections = new Map(measured.map((entry) => [entry.restraintId, entry.nextSlipDirection]));
  }

  const result = {
    schema: 'm047-bm4l-stage2-r2-deleted-spring-experiment/v1',
    caseId,
    sourceAccdbSha256: benchmarkPackage.source.sha256,
    strategy: STRATEGY,
    stopRule: STOP_RULE,
    continuationRule: CONTINUATION_RULE,
    productionMechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
    numerics: { ...NUMERICS, maximumIterations },
    frictionAuthority: {
      effectiveCoefficient: frictionAuthority.effectiveCoefficient,
      frictionStiffnessSiValue: frictionAuthority.frictionStiffness.siValue,
      frictionStiffnessConversionRule: frictionAuthority.frictionStiffness.conversionRule,
    },
    frictionSupportCount: plan.supports.length,
    firstStateStable,
    iterations,
    diagnosticTail: iterations.slice(-12).map((entry) => ({
      iteration: entry.iteration,
      stateChangeCount: entry.stateChangeCount,
      stateSignature: entry.stateSignature,
      displacementUpdateNormM: entry.displacementUpdateNormM,
      reactionUpdateNormN: entry.reactionUpdateNormN,
      equilibriumStatus: entry.recoveredEquilibriumStatus,
    })),
  };
  return Object.freeze({ ...result, semanticHash: semanticHash(result) });
}

function buildPlan(benchmarkPackage, frictionAuthority) {
  const rows = benchmarkPackage.model.tables.INPUT_RESTRAINTS.rows;
  const fileCoefficient = frictionAuthority.coefficient.value;
  const byNode = new Map();
  for (const row of rows) {
    const nodeId = String(row.NODE_NUM);
    const entry = byNode.get(nodeId) ?? {
      nodeId,
      anchor: false,
      rowCount: 0,
      restrainedDofs: new Set(),
      frictionRows: [],
    };
    entry.rowCount += 1;
    if (Number(row.RES_TYPEID) === CAESAR_ANCHOR_RESTRAINT_TYPE) {
      entry.anchor = true;
      for (const dof of DOFS) entry.restrainedDofs.add(dof);
    } else {
      entry.restrainedDofs.add(axisAlignedTranslationDof(row));
    }
    const declared = resolveRowCoefficient(row, fileCoefficient);
    if (declared.coefficient > 0) entry.frictionRows.push({ row, declared });
    byNode.set(nodeId, entry);
  }

  const supports = [];
  for (const entry of byNode.values()) {
    if (entry.frictionRows.length === 0) continue;
    if (entry.frictionRows.length !== 1) {
      throw new TypeError(`Node ${entry.nodeId} has ${entry.frictionRows.length} friction rows; R2 supports one friction plane per node.`);
    }
    if (entry.anchor) throw new TypeError(`Anchor node ${entry.nodeId} declares friction; unsupported.`);
    const { row, declared } = entry.frictionRows[0];
    const normalDof = axisAlignedTranslationDof(row);
    const tangentialCandidates = TRANSLATION_DOFS.filter((dof) => dof !== normalDof);
    const frictionDofs = tangentialCandidates.filter((dof) => !entry.restrainedDofs.has(dof));
    if (frictionDofs.length === 0) continue;
    const normalUnitVector = signedNormalUnitVector(row);
    supports.push(Object.freeze({
      restraintId: `${entry.nodeId}:REST_PTR${Number(row.REST_PTR ?? 0)}:TYPE${Number(row.RES_TYPEID)}:${normalDof}`,
      nodeId: entry.nodeId,
      restraintPointer: Number(row.REST_PTR ?? 0),
      restraintTypeId: Number(row.RES_TYPEID),
      normalDof,
      normalUnitVector: Object.freeze(normalUnitVector),
      frictionDofs: Object.freeze(frictionDofs),
      coefficientOfFriction: declared.coefficient,
      frictionStiffnessSiValue: frictionAuthority.frictionStiffness.siValue,
    }));
  }
  supports.sort((left, right) => compareText(left.restraintId, right.restraintId));
  if (supports.length === 0) throw new TypeError('R2 found no active friction supports.');
  return {
    supports,
    frictionDofKeys: supports.flatMap((support) => support.frictionDofs.map((dof) => `${support.nodeId}:${dof}`)),
  };
}

function buildOverlay({ benchmarkPackage, caseRecord, plan, states, slipDirections, iteration }) {
  const constraints = [];
  const nodalLoads = [];
  for (const support of plan.supports) {
    if (states.get(support.restraintId) === 'STICK') {
      for (const dof of support.frictionDofs) {
        constraints.push({
          declarationId: `R2-FRICTION-${support.nodeId}-${dof}`,
          kind: 'PARTIAL_RELEASE_SPRING',
          nodeId: support.nodeId,
          dof,
          stiffness: support.frictionStiffnessSiValue,
        });
      }
      continue;
    }
    const prior = slipDirections.get(support.restraintId);
    if (prior === null) throw new TypeError(`Sliding restraint ${support.restraintId} has no previous capped-force direction.`);
    const force = { fx: 0, fy: 0, fz: 0 };
    support.frictionDofs.forEach((dof, index) => {
      force[`f${dof.slice(1).toLowerCase()}`] = -prior.capacityN * prior.unit[index];
    });
    nodalLoads.push({
      schema: 'fea-linear-load-primitive/v1',
      primitiveId: `R2-${caseRecord.caseId}-${support.nodeId}-IT${iteration}`,
      kind: 'NODAL_FORCE_MOMENT',
      nodeId: support.nodeId,
      basis: { kind: 'GLOBAL' },
      force,
      moment: { mx: 0, my: 0, mz: 0 },
      units: { force: 'N', moment: 'N*m', length: 'm' },
      signConvention: 'APPLIED_TO_STRUCTURE',
      sourceEvidence: sourceEvidence(
        `R2:${caseRecord.caseId}:${support.restraintId}`,
        `${benchmarkPackage.source.sha256}:${prior.capacityN}:${prior.unit.join(',')}`,
      ),
    });
  }
  return { overlayId: `R2-${caseRecord.caseId}-IT${iteration}`, constraints, nodalLoads };
}

function measureSupports({ plan, states, slipDirections, executed }) {
  const displacement = new Map(executed.execution.displacement.map((entry) => {
    const shift = executed.displacementShiftByNode.get(entry.nodeId) ?? null;
    const shiftValue = shift === null ? 0 : shift[DOFS.indexOf(entry.dof)];
    return [`${entry.nodeId}:${entry.dof}`, Number(entry.value) + shiftValue];
  }));
  const reactions = new Map(executed.execution.reactions.map((entry) => [`${entry.nodeId}:${entry.dof}`, Number(entry.value)]));
  const appliedByNode = new Map(executed.overlay.nodalLoads.map((load) => [String(load.nodeId), load.force]));

  return plan.supports.map((support) => {
    const state = states.get(support.restraintId);
    const tangentialDisplacement = support.frictionDofs.map((dof) => displacement.get(`${support.nodeId}:${dof}`) ?? 0);
    const tangentialMotion = norm(tangentialDisplacement);
    const normalIndex = TRANSLATION_DOFS.indexOf(support.normalDof);
    const normalReaction = reactions.get(`${support.nodeId}:${support.normalDof}`) ?? 0;
    const signedNormalProjection = normalReaction * support.normalUnitVector[normalIndex];
    const normalMagnitude = Math.abs(signedNormalProjection);
    const capacityN = support.coefficientOfFriction * normalMagnitude;
    const trialForce = tangentialDisplacement.map((value) => -support.frictionStiffnessSiValue * value);
    const trialMagnitude = norm(trialForce);
    const boundary = Math.max(
      NUMERICS.stateBoundaryAbsoluteN,
      NUMERICS.stateBoundaryRelative * Math.max(capacityN, trialMagnitude),
    );
    const nextState = trialMagnitude > capacityN + boundary ? 'SLIDE' : 'STICK';
    const unit = tangentialMotion > NUMERICS.zeroTangentialMotionFloorM
      ? tangentialDisplacement.map((value) => value / tangentialMotion)
      : unitFromForce(trialForce, trialMagnitude, support.frictionDofs.length);
    const nextSlipDirection = nextState === 'SLIDE' ? { unit, capacityN } : null;
    const appliedForce = state === 'STICK'
      ? support.frictionDofs.map((dof) => reactions.get(`${support.nodeId}:${dof}`) ?? 0)
      : support.frictionDofs.map((dof) => {
        const load = appliedByNode.get(support.nodeId);
        return load === undefined ? 0 : Number(load[`f${dof.slice(1).toLowerCase()}`] ?? 0);
      });
    const appliedMagnitude = norm(appliedForce);
    return {
      restraintId: support.restraintId,
      nodeId: support.nodeId,
      support,
      state,
      nextState,
      nextSlipDirection,
      normalMagnitude,
      capacityN,
      tangentialDisplacement,
      trialMagnitude,
      appliedForce,
      appliedMagnitude,
      ledger: {
        restraintId: support.restraintId,
        nodeId: support.nodeId,
        normalDof: support.normalDof,
        normalReactionComponentN: normalReaction,
        signedNormalProjectionN: signedNormalProjection,
        normalReactionMagnitudeN: normalMagnitude,
        coefficientOfFriction: support.coefficientOfFriction,
        capacityN,
        frictionDofs: support.frictionDofs,
        frictionStiffnessNPerM: support.frictionStiffnessSiValue,
        relativeTangentialDisplacementM: tangentialDisplacement,
        trialTangentialSpringForceMagnitudeN: trialMagnitude,
        state,
        nextState,
        stateChanged: state !== nextState,
        appliedFrictionForceN: appliedForce,
        appliedFrictionForceMagnitudeN: appliedMagnitude,
        appliedCapacityBasis: state === 'SLIDE'
          ? 'PREVIOUS_ITERATION_CAPACITY_AND_DIRECTION_CONSTANT_FORCE'
          : 'CURRENT_ITERATION_TANGENTIAL_SPRING_REACTION',
        previousSlipDirectionUnit: slipDirections.get(support.restraintId)?.unit ?? null,
        nextSlipDirectionUnit: nextSlipDirection?.unit ?? null,
      },
    };
  });
}

function buildStateStableSnapshot({ benchmarkPackage, caseId, iteration, measured, updates, executed }) {
  const reference = vectorsByNode(benchmarkPackage.references[caseId].rows);
  const restraints = measured.map((entry) => {
    const vector = reference.get(entry.nodeId) ?? {};
    const referenceTangential = entry.support.frictionDofs.map((dof) => Number(vector[dof] ?? 0));
    const referenceMagnitude = norm(referenceTangential);
    const vectorError = norm(entry.appliedForce.map((value, index) => value - referenceTangential[index]));
    return {
      restraintId: entry.restraintId,
      nodeId: entry.nodeId,
      state: entry.state,
      nextState: entry.nextState,
      referenceTangentialN: referenceTangential,
      experimentalTangentialN: entry.appliedForce,
      referenceMagnitudeN: referenceMagnitude,
      experimentalMagnitudeN: entry.appliedMagnitude,
      vectorRelativeError: referenceMagnitude === 0 ? null : vectorError / referenceMagnitude,
      referenceUtilisationOnExperimentalNormal: entry.capacityN === 0 ? null : referenceMagnitude / entry.capacityN,
      experimentalUtilisation: entry.capacityN === 0 ? null : entry.appliedMagnitude / entry.capacityN,
      normalReactionMagnitudeN: entry.normalMagnitude,
      capacityN: entry.capacityN,
    };
  });
  const comparable = restraints.filter((row) => row.vectorRelativeError !== null);
  return {
    iteration,
    stateStable: true,
    displacementUpdateNormM: updates.displacementUpdateNormM,
    reactionUpdateNormN: updates.reactionUpdateNormN,
    equilibriumStatus: executed.recoveredEquilibrium.status,
    equilibriumMaximumAbsoluteResidual: executed.recoveredEquilibrium.maximumAbsoluteResidual,
    tangentialVectorsWithinTenPercent: comparable.filter((row) => row.vectorRelativeError <= 0.1).length,
    tangentialVectorsCompared: comparable.length,
    worstTangentialVectorRelativeError: comparable.length === 0 ? null : Math.max(...comparable.map((row) => row.vectorRelativeError)),
    restraints: restraints.sort((left, right) => (right.vectorRelativeError ?? -1) - (left.vectorRelativeError ?? -1)),
  };
}

function updateNorms(previous, current) {
  if (previous === null) return { displacementUpdateNormM: null, reactionUpdateNormN: null };
  const previousDisplacement = new Map(previous.execution.displacement.map((row) => [`${row.nodeId}:${row.dof}`, Number(row.value)]));
  const previousReactions = new Map(previous.execution.reactions.map((row) => [`${row.nodeId}:${row.dof}`, Number(row.value)]));
  return {
    displacementUpdateNormM: maximum(current.execution.displacement.map((row) =>
      Math.abs(Number(row.value) - (previousDisplacement.get(`${row.nodeId}:${row.dof}`) ?? 0)))),
    reactionUpdateNormN: maximum(current.execution.reactions.map((row) =>
      Math.abs(Number(row.value) - (previousReactions.get(`${row.nodeId}:${row.dof}`) ?? 0)))),
  };
}

function vectorsByNode(rows) {
  const result = new Map();
  for (const row of rows) {
    if (row.entityKind !== 'NODE' || row.quantity !== 'FORCE') continue;
    const vector = result.get(String(row.entityId)) ?? {};
    vector[row.component] = Number(row.value);
    result.set(String(row.entityId), vector);
  }
  return result;
}

function stateSignature(measured) {
  return measured.map((entry) => `${entry.restraintId}:${entry.nextState}`).sort(compareText).join('|');
}

function resolveRowCoefficient(row, fileCoefficient) {
  const columns = Object.keys(row).filter((column) => FRICTION_COLUMN_PATTERN.test(column)).sort(compareText);
  for (const column of columns) {
    const value = Number(row[column]);
    if (!Number.isFinite(value) || value < 0) continue;
    if (value > 0 && Math.abs(value - fileCoefficient) > FLOAT32_COEFFICIENT_TOLERANCE) {
      throw new TypeError(`Restraint ${row.NODE_NUM} ${column}=${value} contradicts file coefficient ${fileCoefficient}.`);
    }
    return { coefficient: value, source: `ACCDB:INPUT_RESTRAINTS:${column}` };
  }
  return { coefficient: 0, source: 'ACCDB:INPUT_RESTRAINTS:BLANK_SENTINEL' };
}

function signedNormalUnitVector(row) {
  const cosines = [Number(row.XCOSINE), Number(row.YCOSINE), Number(row.ZCOSINE)];
  const dof = axisAlignedTranslationDof(row);
  const index = TRANSLATION_DOFS.indexOf(dof);
  const sign = cosines[index] >= 0 ? 1 : -1;
  return [0, 1, 2].map((axis) => axis === index ? sign : 0);
}

function axisAlignedTranslationDof(row) {
  const cosines = [Number(row.XCOSINE), Number(row.YCOSINE), Number(row.ZCOSINE)];
  if (!cosines.every(Number.isFinite)) throw new TypeError(`Restraint ${row.NODE_NUM} has non-finite direction cosine.`);
  const magnitudes = cosines.map(Math.abs);
  const dominant = Math.max(...magnitudes);
  if (!(dominant > 0)) throw new TypeError(`Restraint ${row.NODE_NUM} has no direction cosine.`);
  const index = magnitudes.indexOf(dominant);
  if (magnitudes.some((value, axis) => axis !== index && value > AXIS_ALIGNMENT_TOLERANCE * dominant)) {
    throw new TypeError(`Restraint ${row.NODE_NUM} is skewed; R2 rotated tangent planes are not implemented.`);
  }
  return TRANSLATION_DOFS[index];
}

function unitFromForce(force, magnitude, length) {
  if (magnitude > 0) return force.map((value) => -value / magnitude);
  return Array.from({ length }, (_, index) => index === 0 ? 1 : 0);
}

function sourceEvidence(sourceId, sourceRevision) {
  const identity = { sourceId, sourceRevision };
  return { ...identity, sourceSemanticHash: semanticHash(identity) };
}

function norm(values) {
  return Math.hypot(...values);
}

function maximum(values) {
  return values.length === 0 ? 0 : Math.max(...values);
}

function compareText(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const accdbPath = args.get('--accdb');
  if (!accdbPath) {
    throw new TypeError('Usage: --accdb <BM4_L.ACCDB> [--case L13] [--max-iterations 60] [--out reports/r2.json]');
  }
  const result = await runDeletedSpringExperiment({
    accdbPath,
    caseId: args.get('--case') ?? 'L13',
    maximumIterations: args.has('--max-iterations') ? Number(args.get('--max-iterations')) : undefined,
  });
  const out = args.get('--out');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), `${canonicalPrettyStringify(result)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify({
    strategy: result.strategy,
    caseId: result.caseId,
    sourceAccdbSha256: result.sourceAccdbSha256,
    firstStateStable: result.firstStateStable === null ? null : {
      iteration: result.firstStateStable.iteration,
      reactionUpdateNormN: result.firstStateStable.reactionUpdateNormN,
      tangentialVectorsWithinTenPercent: result.firstStateStable.tangentialVectorsWithinTenPercent,
      tangentialVectorsCompared: result.firstStateStable.tangentialVectorsCompared,
      worstTangentialVectorRelativeError: result.firstStateStable.worstTangentialVectorRelativeError,
    },
    diagnosticTail: result.diagnosticTail,
  })}\n`);
}
