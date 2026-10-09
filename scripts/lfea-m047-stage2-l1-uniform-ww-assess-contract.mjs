#!/usr/bin/env node
import assert from 'node:assert/strict';
import { assessL1UniformWw } from './lfea-m047-stage2-l1-uniform-ww-assess.mjs';

const SHA = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const SOLVER = 'CAESAR-ACCDB-FRICTION-SOLVER-R2';
const baseline = {
  caseId: 'L1',
  converged: true,
  sourceAccdbSha256: SHA,
  solverProfileId: SOLVER,
  iterationSemanticHash: 'baseline-hash',
  summary: { normalWithinGoal: 0, normalWorstPercentError: 20 },
  restraints: [{ restraintId: 'R1', nodeId: '1', normal: { percentError: 20 } }],
};
const experiment = {
  caseId: 'L1',
  sourceAccdbSha256: SHA,
  solverProfileId: SOLVER,
  benchmarkAuthority: false,
  hydrotestInvariant: {
    status: 'PASS',
    authorityStatus: 'RESOLVED',
    testFluidDensityKgPerM3: 1000,
    pressureField: 'HYDRO_PRESSURE',
  },
  changedMechanic: { changedSourceCount: 1 },
  converged: true,
  failure: null,
  summary: { normalWithinGoal: 1, normalWorstPercentError: 5 },
  restraints: [{ restraintId: 'R1', nodeId: '1', normal: { percentError: 5 } }],
};

const nominated = assessL1UniformWw({ baseline, experiment });
assert.equal(nominated.interpretation, 'CONSISTENT_MULTI_METRIC_SUPPORT_FOR_SPECIAL_COMPONENT_WW_DENSITY_HYPOTHESIS_REQUIRES_PRODUCTION_CONTROL_RUN_BEFORE_PROMOTION');
assert.equal(nominated.evidence.completeMetricSet, true);
assert.equal(nominated.productionPromotionAuthorized, false);

const nonconverged = assessL1UniformWw({
  baseline,
  experiment: {
    ...experiment,
    converged: false,
    summary: null,
    restraints: null,
    failure: { lastFailedGates: ['DISPLACEMENT_UPDATE_NORM'] },
  },
});
assert.equal(nonconverged.interpretation, 'COUNTERFACTUAL_DID_NOT_CONVERGE_NO_MECHANICS_PROMOTION');
assert.equal(nonconverged.evidence.completeMetricSet, false);

for (const missing of [null, '', '   ', false]) {
  assert.throws(
    () => assessL1UniformWw({
      baseline,
      experiment: {
        ...experiment,
        restraints: [{ restraintId: 'R1', nodeId: '1', normal: { percentError: missing } }],
      },
    }),
    /complete finite normal metrics/,
  );
}

assert.throws(
  () => assessL1UniformWw({
    baseline,
    experiment: { ...experiment, summary: { ...experiment.summary, normalWithinGoal: null } },
  }),
  /experiment\.summary\.normalWithinGoal must be finite/,
);

assert.throws(
  () => assessL1UniformWw({
    baseline: { ...baseline, restraints: [...baseline.restraints, { ...baseline.restraints[0] }] },
    experiment,
  }),
  /duplicate restraintId R1/,
);

assert.throws(
  () => assessL1UniformWw({
    baseline,
    experiment: {
      ...experiment,
      hydrotestInvariant: { ...experiment.hydrotestInvariant, testFluidDensityKgPerM3: 998 },
    },
  }),
  /1000 kg\/m\^3 \/ HYDRO_PRESSURE/,
);

const noChangedSource = assessL1UniformWw({
  baseline,
  experiment: { ...experiment, changedMechanic: { changedSourceCount: 0 } },
});
assert.equal(noChangedSource.interpretation, 'NO_SPECIAL_COMPONENT_WEIGHT_CHANGE_HYPOTHESIS_NOT_LOAD_BEARING_ON_THIS_FILE');

const mixed = assessL1UniformWw({
  baseline,
  experiment: {
    ...experiment,
    summary: { normalWithinGoal: 0, normalWorstPercentError: 25 },
    restraints: [{ restraintId: 'R1', nodeId: '1', normal: { percentError: 25 } }],
  },
});
assert.equal(mixed.interpretation, 'MIXED_OR_NEGATIVE_EVIDENCE_DO_NOT_PROMOTE_SPECIAL_COMPONENT_WW_DENSITY_HYPOTHESIS');

process.stdout.write(`${JSON.stringify({
  schema: 'm047-l1-uniform-ww-assess-contract/v1',
  status: 'PASS',
  checks: [
    'positive_multi_metric_nomination_is_non_promotional',
    'nonconvergence_is_clean_rejection',
    'null_blank_boolean_metrics_fail_closed',
    'null_summary_metric_fails_closed',
    'duplicate_restraint_ids_fail_closed',
    'hydrotest_basis_drift_fails_closed',
    'zero_changed_sources_rejected_as_non_load_bearing',
    'mixed_accuracy_evidence_not_nominated',
  ],
}, null, 2)}\n`);
