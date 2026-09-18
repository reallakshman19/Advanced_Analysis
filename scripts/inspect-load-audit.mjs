import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { validateProjectDataProfile } from '../src/workspace/project-data/project-data-contract.js';
import { projectDataStore } from '../src/workspace/project-data/project-data-store.js';
import { buildSupportSiteModel } from '../src/workspace/support-sites/support-site-model.js';
import { buildRoutePartitionModel } from '../src/workspace/routes/route-partition-model.js';
import { calculateSupportLoadDistribution } from '../src/workspace/engineering-loads/support-load-distribution-v3.js';
import { parseMasterFile } from '../src/workspace/master-data-events-handler.js';

console.log('--- Inspecting Load Audit for Sjson.json ---');

const sjsonBytes = await readFile('benchmarks/Sjson.json');
const sjsonSha = createHash('sha256').update(sjsonBytes).digest('hex');
const raw = JSON.parse(sjsonBytes.toString('utf8'));
const dataset = normalizeWorkspaceDataset(raw, 'Sjson.json', {
  sourceBytes: sjsonBytes,
  sourceSha256: sjsonSha,
});

const profile = JSON.parse(await readFile('project-data/1885s-project-data-profile.json', 'utf8'));

const lineListBytes = (await readFile('public/fixtures/AML-91-PDFEED-PX-2345-00001-0000 BC4.xlsx')).buffer;
const parsedLineList = await parseMasterFile(lineListBytes, 'AML-91-PDFEED-PX-2345-00001-0000 BC4.xlsx', 'lineList');

const pipingClassBytes = (await readFile('public/fixtures/Piping class master.xlsx')).buffer;
const parsedPipingClass = await parseMasterFile(pipingClassBytes, 'Piping class master.xlsx', 'pipingClass');

const weightBytes = (await readFile('public/fixtures/wtValveweights.xlsx')).buffer;
const parsedWeight = await parseMasterFile(weightBytes, 'wtValveweights.xlsx', 'weight');

const activeHashes = {
  dataset: sjsonSha,
  lineList: parsedLineList.sourceMetadata.sourceHash,
  pipingClass: parsedPipingClass.sourceMetadata.sourceHash,
  componentWeight: parsedWeight.sourceMetadata.sourceHash,
};

console.log('Active hashes:', activeHashes);

const loadAudit = validateProjectDataProfile(profile, 'loads', activeHashes);
console.log('loadAudit valid:', loadAudit.valid);
console.log('loadAudit errors:', JSON.stringify(loadAudit.errors, null, 2));

const supportSites = buildSupportSiteModel(dataset, profile);
const routePartitions = buildRoutePartitionModel(dataset, profile);

const distribution = calculateSupportLoadDistribution({
  dataset,
  profile,
  masterData: {
    lineList: parsedLineList,
    pipingClass: parsedPipingClass,
    weight: parsedWeight,
  },
  supportSiteModel: supportSites,
  routePartitionModel: routePartitions,
});

console.log('Distribution status:', distribution.status);
console.log('Distribution method:', distribution.method);
console.log('Distribution blocked fields:', distribution.blockedFields);
if (distribution.loadCases) {
  for (const lc of distribution.loadCases) {
    console.log(`LoadCase ${lc.loadCaseId}: status=${lc.status} contributions=${lc.contributionLedger?.length}`);
  }
}
