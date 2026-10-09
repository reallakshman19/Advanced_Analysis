#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeB02dProductionLevel } from './lib/lafea-b02d-production-route.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const definition = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'validation/lafea-b02-definitions/B02D-lug-pinhole.json'),
  'utf8',
));
const level = definition.globalResponseLadder.levels.find((row) => row.levelId === 'L4');
if (!level) throw new Error('B02D diagnostic L4 definition missing.');

const run = executeB02dProductionLevel(definition, 'T6', level);
const result = run.stage.execution.result;
const resultCase = run.resultCase;
const receipt = {
  schema: 'lafea-b02d-v2-t6-l4-coarse-correction-diagnostic/v1',
  caseId: 'B02D',
  meshPolicyId: 'B02D_PROBE_STABLE_POLAR_POLICY_V1',
  method: 'T6',
  levelId: 'L4',
  h: level.h,
  qualification: result.qualification.state,
  meshHash: run.stage.execution.meshHash,
  nodeCount: run.meshEvidence.mesh.nodes.length,
  elementCount: run.meshEvidence.mesh.elements.length,
  totalStrainEnergy: resultCase.totalStrainEnergy,
  solverDiagnostics: run.runtimeSolverDiagnostics,
  supportReactions: resultCase.supportReactions,
  loadForceEvidence: resultCase.forceEvidence,
  releaseAuthorityGranted: false,
};
console.log(JSON.stringify(receipt, null, 2));
