import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../../');

const routeModuleUrl = pathToFileURL(path.join(repoRoot, 'scripts/lib/lafea-b02-production-route.mjs')).href;
const { executeB02RectangleProductionLevel } = await import(routeModuleUrl);

const definitionPath = path.join(repoRoot, 'validation/lafea-b02-definitions/B02A-nonuniform-bending.json');
const definition = JSON.parse(fs.readFileSync(definitionPath, 'utf8'));
const level = definition.meshLadder.levels[0]; // L1
const method = 'T6';

const run1 = executeB02RectangleProductionLevel(definition, method, level);
const run2 = executeB02RectangleProductionLevel(definition, method, level);

const s1 = run1.stage.execution;
const s2 = run2.stage.execution;

const hashMatches = {
  sourceHash: { match: s1.sourceHash === s2.sourceHash, value: s1.sourceHash },
  analysisDomainHash: { match: s1.analysisDomainHash === s2.analysisDomainHash, value: s1.analysisDomainHash },
  analysisGeometryHash: { match: s1.analysisGeometryHash === s2.analysisGeometryHash, value: s1.analysisGeometryHash },
  meshHash: { match: s1.meshHash === s2.meshHash, value: s1.meshHash },
  meshProfileHash: { match: s1.meshProfileHash === s2.meshProfileHash, value: s1.meshProfileHash },
  projectionHash: { match: s1.projectionHash === s2.projectionHash, value: s1.projectionHash },
  solverModelHash: { match: s1.solverModelHash === s2.solverModelHash, value: s1.solverModelHash },
  canonicalExecutionInputHash: { match: s1.canonicalExecutionInputHash === s2.canonicalExecutionInputHash, value: s1.canonicalExecutionInputHash },
  compiledExecutionHash: { match: s1.compiledExecutionHash === s2.compiledExecutionHash, value: s1.compiledExecutionHash },
  runtimeDiagnosticsHash: { match: s1.runtimeSolverDiagnostics?.semanticHash === s2.runtimeSolverDiagnostics?.semanticHash, value: s1.runtimeSolverDiagnostics?.semanticHash },
  recoveryHash: { match: run1.stage.lifecycle?.artifacts?.RECOVERY?.artifactHash === run2.stage.lifecycle?.artifacts?.RECOVERY?.artifactHash, value: run1.stage.lifecycle?.artifacts?.RECOVERY?.artifactHash }
};

const allHashesMatched = Object.values(hashMatches).every(h => h.match);
const transactionStatusMatch = s1.runTransaction?.status === s2.runTransaction?.status && s1.runTransaction?.status === 'COMPLETED';
const transactionReceiptMatch = s1.runTransactionReceipt?.status === s2.runTransactionReceipt?.status && s1.runTransactionReceipt?.status === 'COMPLETED';
const probesMatch = JSON.stringify(run1.probes) === JSON.stringify(run2.probes);

const extractPassSummary = (run, passNumber) => ({
  pass: passNumber,
  observedHead: '1019ca26cb18332983f64258698787280b86afd1',
  completedAt: new Date().toISOString(),
  target: {
    benchmark: 'B02A',
    method,
    level: level.id
  },
  hashes: {
    sourceHash: run.stage.execution.sourceHash,
    analysisDomainHash: run.stage.execution.analysisDomainHash,
    analysisGeometryHash: run.stage.execution.analysisGeometryHash,
    meshHash: run.stage.execution.meshHash,
    meshProfileHash: run.stage.execution.meshProfileHash,
    projectionHash: run.stage.execution.projectionHash,
    solverModelHash: run.stage.execution.solverModelHash,
    canonicalExecutionInputHash: run.stage.execution.canonicalExecutionInputHash,
    compiledExecutionHash: run.stage.execution.compiledExecutionHash,
    runtimeDiagnosticsHash: run.stage.execution.runtimeSolverDiagnostics?.semanticHash,
    recoveryHash: run.stage.lifecycle?.artifacts?.RECOVERY?.artifactHash
  },
  runTransaction: run.stage.execution.runTransaction,
  runTransactionReceipt: run.stage.execution.runTransactionReceipt,
  probes: run.probes,
  equilibrium: run.equilibrium,
  strainEnergy: run.strainEnergy
});

const pass1Summary = extractPassSummary(run1, 1);
const pass2Summary = extractPassSummary(run2, 2);

fs.writeFileSync(path.join(__dirname, 'pass1.execution.json'), JSON.stringify(pass1Summary, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'pass2.execution.json'), JSON.stringify(pass2Summary, null, 2) + '\n');

const replayReceipt = {
  schema: 'lafea-c3d-deterministic-replay-receipt/v1',
  observedHead: '1019ca26cb18332983f64258698787280b86afd1',
  replayedAt: new Date().toISOString(),
  target: {
    benchmark: 'B02A',
    method,
    level: level.id
  },
  status: (allHashesMatched && transactionStatusMatch && transactionReceiptMatch && probesMatch) ? 'PASS' : 'FAIL',
  hashes: hashMatches,
  transaction: {
    runTransactionStatus: s1.runTransaction?.status,
    runTransactionReceiptStatus: s1.runTransactionReceipt?.status,
    match: transactionStatusMatch && transactionReceiptMatch
  },
  probes: {
    match: probesMatch,
    values: run1.probes
  },
  rawOutputs: {
    pass1: 'pass1.execution.json',
    pass2: 'pass2.execution.json'
  }
};

const receiptPath = path.join(__dirname, 'replay-receipt.json');
fs.writeFileSync(receiptPath, JSON.stringify(replayReceipt, null, 2) + '\n');

console.log('Pass 1 vs Pass 2 hashes:');
for (const [k, v] of Object.entries(hashMatches)) {
  console.log(`${k} match: ${v.match} ${v.value}`);
}
console.log('runTransaction status match:', s1.runTransaction?.status, s2.runTransaction?.status);
console.log('runTransactionReceipt status match:', s1.runTransactionReceipt?.status, s2.runTransactionReceipt?.status);
console.log('probes match:', probesMatch);
console.log('deterministic replay receipt written to:', receiptPath);
