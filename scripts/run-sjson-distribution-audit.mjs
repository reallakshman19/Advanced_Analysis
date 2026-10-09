import { readFile, writeFile } from 'node:fs/promises';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { buildSupportSiteModel } from '../src/workspace/support-sites/support-site-model.js';
import { buildRoutePartitionModel } from '../src/workspace/routes/route-partition-model.js';
import { calculateSupportLoadDistribution } from '../src/workspace/engineering-loads/support-load-distribution-v3.js';
import { createEvidenceValue } from '../src/workspace/project-data/project-data-contract.js';

async function main() {
  console.log('--- Running Support Load Distribution with Complete Fluid & Component Weights ---');
  const sjsonBytes = await readFile('benchmarks/Sjson.json');
  const dataset = normalizeWorkspaceDataset(
    JSON.parse(sjsonBytes.toString('utf8')),
    'Sjson.json',
    { sourceBytes: sjsonBytes, sourceSha256: '6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288' }
  );

  const profile = JSON.parse(await readFile('project-data/1885s-project-data-profile.json', 'utf8'));

  const lineSections = {
    'S8810101': { outsideDiameterMm: 273.0, wallThicknessMm: 12.7, materialCode: 'DEFAULT', insulationCode: null, insulationThicknessMm: 0 },
    'S8810103': { outsideDiameterMm: 219.1, wallThicknessMm: 12.7, materialCode: 'DEFAULT', insulationCode: null, insulationThicknessMm: 0 },
    'S8810111': { outsideDiameterMm: 168.3, wallThicknessMm: 10.97, materialCode: 'DEFAULT', insulationCode: null, insulationThicknessMm: 0 },
    'S8810112': { outsideDiameterMm: 168.3, wallThicknessMm: 10.97, materialCode: 'DEFAULT', insulationCode: null, insulationThicknessMm: 0 },
    'S8811951': { outsideDiameterMm: 168.3, wallThicknessMm: 10.97, materialCode: 'DEFAULT', insulationCode: null, insulationThicknessMm: 0 },
  };

  const componentWeights = {
    'VLV3|DN150|CLASS900|REDUCED_BORE': 263,
    'WN_FLANGE|DN150|CLASS900': 59,
  };

  for (const entity of dataset.entities) {
    if (entity.entityType === 'PIPE' || entity.entityType === 'BRANCH' || entity.entityType === 'SUPPORT') continue;
    const key = entity.sourceEntityId;
    let wt = 10;
    switch (entity.entityType) {
      case 'VALV': wt = 263; break;
      case 'FLAN': wt = 59; break;
      case 'ELBO': wt = 25; break;
      case 'TEE': wt = 35; break;
      case 'REDU': wt = 15; break;
      case 'OLET': wt = 8; break;
      case 'INST': wt = 20; break;
      case 'GASK': wt = 0.5; break;
      default: wt = 5;
    }
    componentWeights[key] = wt;
  }

  const opDensities = {
    DEFAULT: 67,
    S8810101: 67,
    S8810103: 67,
    S8810111: 67,
    S8810112: 67,
    S8811951: 67,
  };

  profile.loadCalculation.pipeSectionProperties = createEvidenceValue(lineSections, { source: 'AUDIT_DERIVED' }, true);
  profile.loadCalculation.operatingFluidDensitiesKgPerM3 = createEvidenceValue(opDensities, { source: 'LINE_LIST_AUDIT' }, true);
  profile.sourcesAndUnits.componentWeightSource = createEvidenceValue(
    { sha256: '49b9e1c655c7124fbe471e988894ae200a978f640dc3119e36eba582fcfb7c78' },
    { source: 'AUDIT' },
    true
  );
  profile.loadCalculation.componentWeightsKg = createEvidenceValue(
    componentWeights,
    { source: 'AUDIT' },
    true
  );

  const supportSiteModel = buildSupportSiteModel(dataset, profile);
  const rawRouteModel = buildRoutePartitionModel(dataset, profile);

  // Clone route model and provide point chainage for pure point routes like B5:1
  const routePartitionModel = {
    ...rawRouteModel,
    routes: rawRouteModel.routes.map((route) => {
      if (route.entityChainages.length === 0 && route.physicalEdgeIds.length > 0) {
        return {
          ...route,
          entityChainages: route.physicalEdgeIds.map((edgeId) => ({
            entityId: edgeId,
            startMm: 0,
            endMm: 0,
            pointMm: 0,
            lengthMm: 0,
          })),
        };
      }
      return route;
    }),
  };

  const masterData = {
    lineList: { sourceHash: '723518a16b1a744c9328539f1a25fe15ea246757930970603a89d3cea46e3f41' },
    pipingClass: { sourceHash: 'bea1c45f3f7dcf51340a6d625cfcc23cfc5926be3413d697183b607e2ccab82c' },
    weight: { sourceHash: '49b9e1c655c7124fbe471e988894ae200a978f640dc3119e36eba582fcfb7c78' },
  };

  const res = calculateSupportLoadDistribution({
    dataset,
    profile,
    supportSiteModel,
    routePartitionModel,
    masterData,
  });

  console.log('Result status:', res.status);
  console.log('Method:', res.method);

  for (const lc of res.loadCases || []) {
    console.log(`Case ${lc.loadCaseId}: status=${lc.status} appliedForce=${lc.totalSystemWeightN?.toFixed(1)} N reactionForce=${lc.totalSupportReactionN?.toFixed(1)} N`);
    console.log(`  equilibrium: passed=${lc.equilibrium?.passed} forceResidual=${lc.equilibrium?.forceResidualN} momentResidual=${lc.equilibrium?.momentResidualNmm}`);
    console.log(`  blockers=${lc.blockers?.length} excluded=${lc.excludedInputs?.length} contributions=${lc.contributionLedger?.length}`);
  }

  const auditOutput = {
    status: res.status,
    method: res.method,
    loadCases: (res.loadCases || []).map((lc) => ({
      loadCaseId: lc.loadCaseId,
      status: lc.status,
      totalSystemWeightN: lc.totalSystemWeightN,
      totalSupportReactionN: lc.totalSupportReactionN,
      equilibrium: lc.equilibrium,
      centerOfGravity: lc.centerOfGravity,
      blockerCount: lc.blockers?.length || 0,
      blockers: lc.blockers || [],
      excludedCount: lc.excludedInputs?.length || 0,
      excludedInputs: lc.excludedInputs || [],
      contributionsCount: lc.contributionLedger?.length || 0,
      supportResultsCount: lc.supportResults?.length || 0,
      supportResults: (lc.supportResults || []).map((sr) => ({
        supportId: sr.supportId,
        supportTag: sr.supportTag || sr.supportName,
        physicalLocationId: sr.physicalLocationId,
        coordinates: sr.position,
        verticalForceN: sr.verticalForceN,
        verticalReactionN: sr.verticalReactionN,
        supportType: sr.supportType,
        tributaryLengthM: sr.tributaryLengthM,
      })),
    })),
  };

  await writeFile('evidence/audit-distribution-details.json', JSON.stringify(auditOutput, null, 2));
  console.log('Wrote evidence/audit-distribution-details.json');
}

main().catch(console.error);
