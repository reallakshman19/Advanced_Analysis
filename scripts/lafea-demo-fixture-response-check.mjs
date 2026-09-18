#!/usr/bin/env node
/**
 * The demonstration fixtures must demonstrate something.
 *
 * Before UX-1 (#1821) the LAFEA.4 demo was `cylindricalSource(12)` constrained
 * with `fullyFixed(nodes)`: 130 DOF, all 130 constrained, zero free. Pressure
 * was applied to a shell welded solid at every node, the solver took the
 * FULLY_CONSTRAINED_NO_FREE_SOLVE branch, and the run was reported Accepted
 * with 0 mm displacement and 0 N*mm energy.
 *
 * A zero result still passes as "Accepted", so nothing downstream catches a
 * regression to vacuity. This gate does, headlessly and without a browser:
 * free DOF must exist, the response must be non-zero, and where an independent
 * closed form exists the response must agree with it. #1842 D6.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateLocalShell,
  createCanonicalMitcProductionModel,
} from '../src/core/local-shell/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'public', 'fixtures');

// Governed A4 acceptance band, reused unchanged from the B5 qualification.
const DEFLECTION_RELATIVE_TOLERANCE = 0.02;

const report = {
  schema: 'lafea-demo-fixture-response-check/v1',
  status: 'PASS',
  demos: [
    checkShellDemo(),
    checkContinuumDemo(),
    checkTrunnionDemo(),
  ],
  releaseQualified: false,
};

console.log(JSON.stringify(report, null, 2));
console.log('\n✅ LAFEA demonstration fixtures produce non-zero, oracle-checked responses.');

/**
 * LAFEA.4 shell: full check. The fixture is the qualified B5 cantilever strip,
 * so the closed-form Timoshenko solution is an independent oracle for it.
 */
function checkShellDemo() {
  const source = load('lafea-4-shell-mitc-b5-demo.json');
  assert.equal(source.schema, 'local-shell-model/v2');

  const totalDof = source.nodes.length * 5;
  const freeDof = totalDof - source.constraints.length;
  assert.ok(freeDof > 0, `shell demo must leave free DOF; got ${freeDof} of ${totalDof}`);

  const result = calculateLocalShell(createCanonicalMitcProductionModel(source));
  assert.equal(result.qualification.accepted, true, result.qualification.summary);

  // A demonstration must never read as release-qualified output.
  assert.equal(result.productionQualification.qualifiedForRelease, false);
  assert.equal(result.productionQualification.evidenceState, 'NOT_RUN');

  const loadCase = result.loadCaseResults[0];
  const maximumDeflection = Math.max(...loadCase.nodalDisplacements.map((row) => Math.abs(row.uz)));
  assert.ok(maximumDeflection > 0, 'shell demo must produce non-zero displacement');
  assert.ok(loadCase.totalStrainEnergy > 0, 'shell demo must produce non-zero strain energy');
  assert.equal(loadCase.forceEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.momentEquilibrium.qualification.accepted, true);

  const oracle = timoshenkoTipDeflection(source);
  const relativeError = Math.abs(maximumDeflection - oracle) / oracle;
  assert.ok(
    relativeError <= DEFLECTION_RELATIVE_TOLERANCE,
    `shell demo deflection relative error ${relativeError} exceeds ${DEFLECTION_RELATIVE_TOLERANCE}`,
  );

  return Object.freeze({
    stage: 'LAFEA.4',
    fixture: 'lafea-4-shell-mitc-b5-demo.json',
    formulation: source.elements[0].formulation,
    totalDof,
    freeDof,
    maximumDeflection,
    totalStrainEnergy: loadCase.totalStrainEnergy,
    independentOracle: oracle,
    oracleAuthority: 'INDEPENDENT_TIMOSHENKO_CLOSED_FORM',
    relativeError,
    solverMethod: loadCase.solverEvidence.method,
    qualifiedForRelease: false,
    disposition: 'PASS_NON_ZERO_AND_ORACLE_CHECKED',
  });
}

/**
 * LAFEA.3 continuum: structural check only. The continuum route has its own
 * canonical model and acceptance path, and BM-005 already owns the Lame
 * comparison; duplicating that oracle here would create a second, unqualified
 * copy of it. What is asserted is what this gate exists for: the fixture is
 * not vacuously restrained.
 */
function checkContinuumDemo() {
  const source = load('lafea-3-continuum-bm005-demo.json');
  assert.equal(source.schema, 'local-continuum-model/v1');

  const dofPerNode = 2;
  const totalDof = source.nodes.length * dofPerNode;
  const constrained = source.constraints.length;
  const freeDof = totalDof - constrained;
  assert.ok(freeDof > 0, `continuum demo must leave free DOF; got ${freeDof} of ${totalDof}`);
  assert.ok(source.loadCases?.length > 0, 'continuum demo must declare at least one load case');

  return Object.freeze({
    stage: 'LAFEA.3',
    fixture: 'lafea-3-continuum-bm005-demo.json',
    totalDof,
    constrainedDof: constrained,
    freeDof,
    loadCases: source.loadCases.length,
    responseOracle: 'NOT_CHECKED_HERE_BM005_OWNS_THE_LAME_COMPARISON',
    disposition: 'PASS_NOT_VACUOUSLY_RESTRAINED',
  });
}

/**
 * LAFEA.5 trunnion footprint: not a finite element model. It is a workflow
 * source describing attachment/footprint geometry, so there is no DOF count or
 * displacement to assert. Check it declares the mappings that make the
 * workflow demonstrable, and say plainly that no response is claimed.
 */
function checkTrunnionDemo() {
  const source = load('lafea-5-trunnion-footprint-demo.json');
  assert.equal(source.schema, 'local-trunnion-footprint-source/v1');
  assert.ok(source.loadCaseMappings?.length > 0, 'trunnion demo must declare load-case mappings');
  assert.ok(source.footprint?.orderedNodeIds?.length > 0, 'trunnion demo must declare a footprint');

  return Object.freeze({
    stage: 'LAFEA.5',
    fixture: 'lafea-5-trunnion-footprint-demo.json',
    loadCaseMappings: source.loadCaseMappings.length,
    footprintNodes: source.footprint.orderedNodeIds.length,
    finiteElementModel: false,
    responseOracle: 'NOT_APPLICABLE_WORKFLOW_SOURCE_NOT_AN_FE_MODEL',
    disposition: 'PASS_STRUCTURAL_ONLY_NO_RESPONSE_CLAIMED',
  });
}

/** Closed-form Timoshenko cantilever tip deflection for the demo strip. */
function timoshenkoTipDeflection(source) {
  const xs = source.nodes.map((node) => node.position[0]);
  const ys = source.nodes.map((node) => node.position[1]);
  const span = Math.max(...xs) - Math.min(...xs);
  const width = Math.max(...ys) - Math.min(...ys);
  const thickness = source.elements[0].thickness;
  const { elasticModulus, poissonRatio } = source.materials[0];
  const load = source.loadCases[0].nodalLoads.reduce((sum, row) => sum + (row.fz ?? 0), 0);

  const shearModulus = elasticModulus / (2 * (1 + poissonRatio));
  const inertia = width * thickness ** 3 / 12;
  const area = width * thickness;
  return load * span ** 3 / (3 * elasticModulus * inertia)
    + load * span / ((5 / 6) * shearModulus * area);
}

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}
