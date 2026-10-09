#!/usr/bin/env node
/**
 * M047 Stage 2 R5 — data-only friction/bend/tee topology inventory.
 *
 * The first R5 question is binary: do any governed L13 friction restraints land on
 * source stations used to construct a bend arc or on a declared physical welding
 * tee junction? If not, bend/tee tangent-plane geometry cannot explain the current
 * BM4_L friction-vector discrepancy. If yes, this command does not guess a mechanic;
 * it emits an explicit requirement for a later arc/tee tangent verification.
 *
 * No solver mechanic, tolerance, comparison rule or result row is changed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';

const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const PINNED_ACCDB_BYTES = 5_136_384;
const CAESAR_WELDING_TEE_TYPE = 3;

export function buildFrictionGeometryInventory(input) {
  const iteration = input.iteration;
  if (iteration?.schema !== 'm047-bm4l-stage2-friction-tuning-iteration/v1'
      || iteration.converged !== true
      || !Array.isArray(iteration.restraints)) {
    throw new TypeError('R5 requires a converged L13 friction tuning iteration artifact.');
  }
  const basicRows = Array.isArray(input.basicElementRows) ? input.basicElementRows : [];
  const sifTeeRows = Array.isArray(input.sifTeeRows) ? input.sifTeeRows : [];

  const bendStations = buildBendStations(basicRows);
  const teeNodes = [...new Set(sifTeeRows
    .filter((row) => Number(row.TYPE) === CAESAR_WELDING_TEE_TYPE && Number(row.NODE) > 0)
    .map((row) => String(row.NODE)))].sort(compareText);
  const teeSet = new Set(teeNodes);
  const bendByNode = new Map();
  for (const bend of bendStations) {
    for (const station of bend.stations) {
      const entries = bendByNode.get(station.nodeId) ?? [];
      entries.push({
        bendPointer: bend.bendPointer,
        sourceElementId: bend.sourceElementId,
        role: station.role,
      });
      bendByNode.set(station.nodeId, entries);
    }
  }

  const restraints = iteration.restraints.map((support) => {
    const nodeId = String(support.nodeId);
    const bendCoincidences = bendByNode.get(nodeId) ?? [];
    const teeJunction = teeSet.has(nodeId);
    return {
      restraintId: support.restraintId,
      nodeId,
      nodeName: support.nodeName ?? '',
      normalDof: support.normalDof,
      frictionDofs: [...support.frictionDofs],
      bendCoincidences,
      teeJunction,
      geometrySensitive: bendCoincidences.length > 0 || teeJunction,
    };
  });

  const geometrySensitive = restraints.filter((row) => row.geometrySensitive);
  const bendSensitive = restraints.filter((row) => row.bendCoincidences.length > 0);
  const teeSensitive = restraints.filter((row) => row.teeJunction);
  const decision = geometrySensitive.length === 0
    ? {
      status: 'NO_FRICTION_RESTRAINT_ON_BEND_OR_TEE_SOURCE_STATION',
      requiredNextMechanic: null,
      directionPromotionBlockedByR5: false,
    }
    : {
      status: 'BEND_OR_TEE_TANGENT_VERIFICATION_REQUIRED',
      requiredNextMechanic: 'VERIFY_FRICTION_TANGENT_PLANE_AGAINST_LOCAL_BEND_ARC_OR_TEE_LEG_TANGENT_BEFORE_DIRECTION_PROMOTION',
      directionPromotionBlockedByR5: true,
    };

  const result = {
    schema: 'm047-bm4l-stage2-r5-friction-geometry-inventory/v1',
    caseId: iteration.caseId,
    sourceAccdbSha256: iteration.sourceAccdbSha256,
    sourceIterationSemanticHash: iteration.iterationSemanticHash,
    rule: 'TOPOLOGY_ONLY_NO_ARC_OR_TEE_DIRECTION_MECHANIC_INFERRED_V1',
    bendDefinitionCount: bendStations.length,
    teeJunctionCount: teeNodes.length,
    frictionRestraintCount: restraints.length,
    bendCoincidentFrictionCount: bendSensitive.length,
    teeCoincidentFrictionCount: teeSensitive.length,
    geometrySensitiveFrictionCount: geometrySensitive.length,
    bendStations,
    teeJunctionNodeIds: teeNodes,
    restraints,
    decision,
    mechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };
  return Object.freeze({ ...result, semanticHash: semanticHash(result) });
}

function buildBendStations(rows) {
  const bends = [];
  for (const row of rows) {
    const bendPointer = Number(row.BEND_PTR);
    if (!(bendPointer > 0)) continue;
    const sourceElementId = String(row.ELEMENTID);
    const incomingFromNode = String(row.FROM_NODE);
    const intersectionNode = String(row.TO_NODE);
    const outgoing = rows.filter((candidate) => String(candidate.FROM_NODE) === intersectionNode);
    if (outgoing.length !== 1) {
      throw new TypeError(
        `R5 BEND_PTR ${bendPointer} at source element ${sourceElementId} requires exactly one outgoing element from node ${intersectionNode}; found ${outgoing.length}.`,
      );
    }
    bends.push({
      bendPointer,
      sourceElementId,
      outgoingSourceElementId: String(outgoing[0].ELEMENTID),
      stations: [
        { role: 'BEND_INCOMING_SOURCE_ENDPOINT', nodeId: incomingFromNode },
        { role: 'BEND_GEOMETRIC_INTERSECTION', nodeId: intersectionNode },
        { role: 'BEND_OUTGOING_SOURCE_ENDPOINT', nodeId: String(outgoing[0].TO_NODE) },
      ],
    });
  }
  return bends.sort((left, right) => left.bendPointer - right.bendPointer
    || compareText(left.sourceElementId, right.sourceElementId));
}

export async function runFrictionGeometryInventory(input) {
  const iteration = JSON.parse(readFileSync(resolve(input.iterationPath), 'utf8'));
  if (iteration.caseId !== 'L13') {
    throw new TypeError(`R5 BM4_L geometry inventory requires L13; received ${iteration.caseId}.`);
  }
  if (iteration.sourceAccdbSha256 !== PINNED_ACCDB_SHA256) {
    throw new TypeError('R5 iteration artifact does not carry the corrected pinned BM4_L ACCDB hash.');
  }
  const rawExport = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: ['INPUT_BASIC_ELEMENT_DATA', 'INPUT_SIFTEES'],
    expectedSha256: PINNED_ACCDB_SHA256,
  });
  if (rawExport.source.byteLength !== PINNED_ACCDB_BYTES) {
    throw new TypeError(`R5 ACCDB byte length ${rawExport.source.byteLength} does not match pinned ${PINNED_ACCDB_BYTES}.`);
  }
  const inspection = buildFrictionGeometryInventory({
    iteration,
    basicElementRows: rawExport.tables.INPUT_BASIC_ELEMENT_DATA.rows,
    sifTeeRows: rawExport.tables.INPUT_SIFTEES.rows,
  });
  const { semanticHash: inspectionSemanticHash, ...inspectionRecord } = inspection;
  const complete = {
    ...inspectionRecord,
    inspectionSemanticHash,
    provider: rawExport.provider,
    custodyStatus: rawExport.source.postReadSha256 === PINNED_ACCDB_SHA256 ? 'PASS' : 'FAIL',
  };
  if (complete.custodyStatus !== 'PASS') {
    throw new Error('R5 custody status is not PASS after the pinned ACCDB read.');
  }
  return Object.freeze({ ...complete, semanticHash: semanticHash(complete) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const accdbPath = args.get('--accdb');
  const iterationPath = args.get('--iteration');
  if (!accdbPath || !iterationPath) {
    throw new TypeError('Usage: --accdb <BM4_L.ACCDB> --iteration <L13-iteration.json> [--out <r5.json>]');
  }
  const record = await runFrictionGeometryInventory({ accdbPath, iterationPath });
  const outPath = args.get('--out');
  if (outPath) {
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(resolve(outPath), `${canonicalPrettyStringify(record)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify({
    caseId: record.caseId,
    frictionRestraintCount: record.frictionRestraintCount,
    bendCoincidentFrictionCount: record.bendCoincidentFrictionCount,
    teeCoincidentFrictionCount: record.teeCoincidentFrictionCount,
    geometrySensitiveFrictionCount: record.geometrySensitiveFrictionCount,
    decision: record.decision,
    mechanicsChanged: record.mechanicsChanged,
  })}\n`);
}

function compareText(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}
