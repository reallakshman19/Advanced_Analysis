#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_QUALIFICATION_SHA256,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS,
} from '../src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js';
import {
  EMP1_A_WRC_ZERO_DP_PRODUCER_QUALIFICATION_SHA256,
} from '../src/core/emp1/emp1-a-wrc-zero-dp-load-producer.js';
import {
  EMP1_WRC537_CYLINDRICAL_AXIS_AUTHORITY_ID,
  EMP1_WRC537_CYLINDRICAL_AXIS_SOURCE_SHA256,
} from '../src/core/emp1/emp1-wrc537-cylindrical-axis-authority.js';
import {
  EMP1_WRC537_ATTACHMENT_DIAMETER_BASIS,
  EMP1_WRC537_ATTACHMENT_PHYSICAL_LOCATION,
  EMP1_WRC537_ATTACHMENT_SOURCE_AUTHORITY,
  EMP1_WRC537_ATTACHMENT_SOURCE_AUTHORITY_SCHEMA,
  EMP1_WRC537_ATTACHMENT_SOURCE_QUALIFIED,
} from '../src/core/emp1/emp1-wrc537-attachment-source-authority.js';
import {
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY,
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY_ID,
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY_SCHEMA,
} from '../src/core/emp1/emp1-wrc537-longitudinal-moment-curve-selection.js';
import {
  EMP1_WRC537_APPLICABILITY_SOURCE_AUTHORITY,
  EMP1_WRC537_APPLICABILITY_SOURCE_AUTHORITY_SCHEMA,
  EMP1_WRC537_APPLICABILITY_SOURCE_QUALIFIED,
  EMP1_WRC537_ATTACHMENT_STATION_BASIS,
  EMP1_WRC537_CYLINDER_LENGTH_BASIS,
} from '../src/core/emp1/emp1-wrc537-applicability-source-authority.js';
import {
  EMP1_C_WRC537_GAMMA5_ZERO_DP_QUALIFICATION_SHA256,
} from '../src/core/emp1/emp1-c-bounded-route-registry.js';

const [record, oracle] = await Promise.all([
  readFile('validation/emp1/wrc537-2013/gamma5-zero-dp-route-qualification-v2.json', 'utf8').then(JSON.parse),
  readFile('validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json', 'utf8').then(JSON.parse),
]);
const currentQualificationHash = '9ea591a1918175b3e415d77f1adc4398645ca0503a699cfe8139d9dd3c69b4c7';
const currentOracleHash = '60771128f8261057bf73fa6c183ace5df25f3ee98f417f58da25a6135d8b2e18';
const preSourceAuthorityHistoricalQualificationHash =
  '3b4375407dc9484c80144f2d9a5b555000d0257021108cd799923ed6fede1a8e';
const payloadHash = createHash('sha256').update(canonical(record.semanticPayload)).digest('hex');
assert.equal(payloadHash, currentQualificationHash);
assert.equal(record.qualificationRecordSha256, currentQualificationHash);
assert.equal(record.status, 'CANDIDATE_PENDING_EXECUTABLE_PRODUCTION_REOBSERVATION');
assert.equal(record.engineeringAuthority, false);
assert.equal(record.productionRouteAuthority, false);
assert.equal(record.globalEmp1CRouteAuthority, false);
assert.equal(record.productionObservationUsedToSetAuthority, false);
assert.equal(record.reobservation.currentProductionCandidateObserved, false);
assert.equal(record.reobservation.stressComparisonsPassed, 0);
assert.equal(record.authorization.boundedRouteRegistrationAllowed, false);

const P = record.semanticPayload;
assert.equal(P.benchmarkQualification.benchmarkHash, oracle.semanticHash);
assert.equal(P.benchmarkQualification.benchmarkHash, currentOracleHash);
assert.equal(P.loadProducerQualificationSha256,
  EMP1_A_WRC_ZERO_DP_PRODUCER_QUALIFICATION_SHA256);
assert.equal(P.authorityClosure.cylindricalAxis.authorityId,
  EMP1_WRC537_CYLINDRICAL_AXIS_AUTHORITY_ID);
assert.equal(P.authorityClosure.cylindricalAxis.sourceDocumentSha256,
  EMP1_WRC537_CYLINDRICAL_AXIS_SOURCE_SHA256);
assert.equal(P.authorityClosure.attachmentR0.schema,
  EMP1_WRC537_ATTACHMENT_SOURCE_AUTHORITY_SCHEMA);
assert.equal(P.authorityClosure.attachmentR0.authority,
  EMP1_WRC537_ATTACHMENT_SOURCE_AUTHORITY);
assert.equal(P.authorityClosure.attachmentR0.sourceQualification,
  EMP1_WRC537_ATTACHMENT_SOURCE_QUALIFIED);
assert.equal(P.authorityClosure.attachmentR0.diameterBasis,
  EMP1_WRC537_ATTACHMENT_DIAMETER_BASIS);
assert.equal(P.authorityClosure.attachmentR0.physicalLocation,
  EMP1_WRC537_ATTACHMENT_PHYSICAL_LOCATION);
assert.equal(P.authorityClosure.longitudinalMoment.schema,
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY_SCHEMA);
assert.equal(P.authorityClosure.longitudinalMoment.authorityId,
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY_ID);
assert.equal(P.authorityClosure.longitudinalMoment.semanticHash,
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY.semanticHash);
assert.equal(P.authorityClosure.longitudinalMoment.circumferentialFigure,
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY.selection.circumferentialFigure);
assert.equal(P.authorityClosure.longitudinalMoment.longitudinalFigure,
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY.selection.longitudinalFigure);
assert.equal(P.authorityClosure.applicability.schema,
  EMP1_WRC537_APPLICABILITY_SOURCE_AUTHORITY_SCHEMA);
assert.equal(P.authorityClosure.applicability.authority,
  EMP1_WRC537_APPLICABILITY_SOURCE_AUTHORITY);
assert.equal(P.authorityClosure.applicability.sourceQualification,
  EMP1_WRC537_APPLICABILITY_SOURCE_QUALIFIED);
assert.equal(P.authorityClosure.applicability.cylinderLengthBasis,
  EMP1_WRC537_CYLINDER_LENGTH_BASIS);
assert.equal(P.authorityClosure.applicability.attachmentStationBasis,
  EMP1_WRC537_ATTACHMENT_STATION_BASIS);
assert.equal(P.supersedesHistorical.routeQualificationSha256,
  preSourceAuthorityHistoricalQualificationHash);

// This record does not create production authority by itself. Production route
// authority was applied separately by the retained owner-override authorization
// record and must bind the same qualification identity without rewriting this
// candidate record's NOT_RUN reobservation truth.
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED, true);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_QUALIFICATION_SHA256,
  currentQualificationHash);
assert.equal(EMP1_C_WRC537_GAMMA5_ZERO_DP_QUALIFICATION_SHA256,
  currentQualificationHash);
assert.deepEqual(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS, []);

console.log(JSON.stringify({
  schema: 'emp1-wrc537-gamma5-route-requalification-candidate-check/v1',
  status: 'PASS_CURRENT_QUALIFICATION_RECORD_BOUND_TO_OWNER_AUTHORIZED_ROUTE_STANDARD_REOBSERVATION_STILL_NOT_RUN',
  qualificationRecordSha256: currentQualificationHash,
  oracleHash: oracle.semanticHash,
  recordCreatesProductionAuthority: false,
  ownerAuthorizedProductionRouteActive: true,
  standardExecutableReobservation: record.reobservation.status,
}, null, 2));

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
