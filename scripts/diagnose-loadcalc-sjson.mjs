import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { WorkspaceState } from '../src/workspace/workspace-state.js';
import { masterDataController } from '../src/workspace/master-data-controller.js';
import { projectDataStore } from '../src/workspace/project-data/project-data-store.js';
import { nonFeaCommonInputStore } from '../src/workspace/non-fea-common-input-store.js';
import { evaluateCurrentNonFeaCommonInput } from '../src/workspace/non-fea-common-input-runtime.js';
import { parseMasterFile } from '../src/workspace/master-data-events-handler.js';
import { autoNormalizeBundledMasters, autoGenerateMasterEnrichment, autoBindMasterSources, autoEnsureDefaultQualificationProfile } from '../src/workspace/master-data-ui.js';
import { TopologyStore } from '../src/workspace/topology-store.js';
import { SupportRestraintStore } from '../src/workspace/support-restraint-store.js';
import { ModelLoadStore } from '../src/workspace/model-load-store.js';
import { engineeringModelStore } from '../src/workspace/engineering-model-store.js';
import { buildPipingPortTopologyGraph } from '../src/core/piping-topology/index.js';
import { buildSupportAttachmentModel, buildRestraintCapabilityModel } from '../src/core/support-restraints/index.js';
import { buildModelLoadPrimitiveSet } from '../src/core/model-loads/index.js';

console.log('=== Diagnosing Sjson.json in Load Calc ===');

// 1. Ingest Sjson.json
const sjsonBytes = await readFile('benchmarks/Sjson.json');
const sjsonSha = createHash('sha256').update(sjsonBytes).digest('hex');
const raw = JSON.parse(sjsonBytes.toString('utf8'));
const dataset = normalizeWorkspaceDataset(raw, 'Sjson.json', {
  sourceBytes: sjsonBytes,
  sourceSha256: sjsonSha,
});

WorkspaceState.loadDataset(dataset);
console.log('Dataset loaded:', dataset.datasetId, 'nodeCount:', dataset.summary.nodeCount);

// 2. Build canonical models into stores
const graph = buildPipingPortTopologyGraph(dataset.sharedModel);
TopologyStore.rebuild(dataset.sharedModel, graph);

const attachments = buildSupportAttachmentModel(dataset.sharedModel, graph);
const restraints = buildRestraintCapabilityModel(attachments);
SupportRestraintStore.rebuild(dataset.sharedModel, graph, attachments, restraints);

const profile = projectDataStore.getProfile();
const primitives = buildModelLoadPrimitiveSet(dataset.sharedModel, graph, attachments, restraints, profile);
ModelLoadStore.rebuild(dataset.sharedModel, graph, attachments, restraints, primitives);

engineeringModelStore.rebuild(dataset);

// 3. Import Masters
const lineListBytes = await readFile('public/fixtures/AML-91-PDFEED-PX-2345-00001-0000 BC4.xlsx');
const parsedLineList = await parseMasterFile(lineListBytes, 'AML-91-PDFEED-PX-2345-00001-0000 BC4.xlsx', 'lineList');
masterDataController.commitMasterImport('lineList', parsedLineList);

const pipingClassBytes = await readFile('public/fixtures/Piping class master.xlsx');
const parsedPipingClass = await parseMasterFile(pipingClassBytes, 'Piping class master.xlsx', 'pipingClass');
masterDataController.commitMasterImport('pipingClass', parsedPipingClass);

const weightBytes = await readFile('public/fixtures/wtValveweights.xlsx');
const parsedWeight = await parseMasterFile(weightBytes, 'wtValveweights.xlsx', 'weight');
masterDataController.commitMasterImport('weight', parsedWeight);

autoNormalizeBundledMasters();
await autoBindMasterSources();
await autoGenerateMasterEnrichment();
await autoEnsureDefaultQualificationProfile();

// 4. Evaluate Pre-FEA Common Input
const evaluated = evaluateCurrentNonFeaCommonInput();
console.log('Evaluated packageState:', evaluated.report?.packageState);
console.log('Message:', evaluated.message);
console.log('Error:', evaluated.error);
console.log('Ready methods:', evaluated.report?.readyMethodIds);
console.log('Blocked methods:', evaluated.report?.blockedMethodIds);

if (evaluated.report?.blockers?.length) {
  console.log('\n--- BLOCKERS ---');
  for (const b of evaluated.report.blockers) {
    console.log(JSON.stringify(b, null, 2));
  }
}

if (evaluated.report?.gates) {
  console.log('\n--- GATES ---');
  for (const [gateName, gate] of Object.entries(evaluated.report.gates)) {
    console.log(`Gate ${gateName}: state=${gate.state} blockers=${gate.blockers?.length || 0}`);
    if (gate.blockers?.length) {
      console.log('  Gate blockers:', JSON.stringify(gate.blockers.slice(0, 3), null, 2));
    }
  }
}
