#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  deriveIndependentWrc537PhysicalStatics,
  assertIndependentWrcRoundtrip,
} from './oracles/emp1-wrc537/physical-statics.mjs';
import {
  evaluateIndependentWrc537Table5,
} from './oracles/emp1-wrc537/table5-handcalc.mjs';

const basePhysical = {
  sourcePointGlobal: [0, 0, 1000],
  targetPointGlobal: [0, 0, 0],
  vesselLongitudinalPositiveGlobal: [1, 0, 0],
  foundationRadialLineGlobal: [0, 0, 1],
  forceAtSourceGlobal: [-400, 250, 1000],
  momentAtSourceGlobal: [-250000, -200000, 700000],
};
const expectedWrc = { P: -1000, Vc: 250, Vl: -400, Mc: 500000, Ml: -600000, Mt: 700000 };
const statics = deriveIndependentWrc537PhysicalStatics(basePhysical);
assert.deepEqual(statics.wrcLoads, expectedWrc);
assertIndependentWrcRoundtrip(statics);

const detections = [];
expectFailure('coincident-source-target', () => deriveIndependentWrc537PhysicalStatics({
  ...basePhysical, sourcePointGlobal: [0, 0, 0],
}), /SOURCE_TO_TARGET_RADIAL/u);
expectFailure('nonradial-source-target', () => deriveIndependentWrc537PhysicalStatics({
  ...basePhysical, sourcePointGlobal: [100, 0, 1000],
}), /INDEPENDENT_WRC_SOURCE_TO_TARGET_NOT_RADIAL/u);

const reversedRadialLine = deriveIndependentWrc537PhysicalStatics({
  ...basePhysical, foundationRadialLineGlobal: [0, 0, -1],
});
assert.deepEqual(reversedRadialLine.wrcLoads, expectedWrc,
  'foundation radial line is unoriented and must not define +P polarity');
detections.push('raw-radial-line-polarity-cannot-reverse-P');

const sourceArmWrong = deriveIndependentWrc537PhysicalStatics({
  ...basePhysical, sourcePointGlobal: [0, 0, -1000],
});
assert.notDeepEqual(sourceArmWrong.wrcLoads, expectedWrc,
  'reversing physical source point must change the derived WRC package');
detections.push('source-arm-sign-corruption-detected');

const forceMutation = deriveIndependentWrc537PhysicalStatics({
  ...basePhysical, forceAtSourceGlobal: [-401, 250, 1000],
});
assert.notDeepEqual(forceMutation.wrcLoads, expectedWrc);
detections.push('global-force-mutation-detected');
const momentMutation = deriveIndependentWrc537PhysicalStatics({
  ...basePhysical, momentAtSourceGlobal: [-250000, -200001, 700000],
});
assert.notDeepEqual(momentMutation.wrcLoads, expectedWrc);
detections.push('global-moment-mutation-detected');

const geometry = { meanRadius: 100, shellThickness: 20, attachmentRadius: 17.714285714285715, beta: 0.155 };
const scf = { Kn: 1, Kb: 1 };
const signs = {
  pMem: [-1,-1,-1,-1,-1,-1,-1,-1],
  pBend: [-1,1,-1,1,-1,1,-1,1],
  mcMem: [0,0,0,0,-1,-1,1,1],
  mcBend: [0,0,0,0,-1,1,1,-1],
  mlMem: [-1,-1,1,1,0,0,0,0],
  mlBend: [-1,1,1,-1,0,0,0,0],
  vc: [1,1,-1,-1,0,0,0,0],
  vl: [0,0,0,0,-1,-1,1,1],
  mt: [1,1,1,1,1,1,1,1],
};
const locations = ['Au','Al','Bu','Bl','Cu','Cl','Du','Dl'];
const currentQ = {
  circ: { Pmem_AB:1.0087532980990799,Pmem_CD:0.9701040475671592,Pbend_AB:0.14703292762964923,Pbend_CD:0.17141454656732902,Mcmem:0.08941898249736933,Mcbend:0.10525347243142809,Mlmem:0.3230087351167803,Mlbend:0.06123300282237935 },
  long: { Pmem_AB:0.9701040475671592,Pmem_CD:1.0087532980990799,Pbend_AB:0.17312891453333643,Pbend_CD:0.14456277586481106,Mcmem:0.12298242595099688,Mcbend:0.06307353478680365,Mlmem:0.08350203830442386,Mlbend:0.09730171780398315 },
};
const historicalQ = structuredClone(currentQ);
historicalQ.circ.Mlbend = 0.06104247731814361;
historicalQ.long.Mlbend = 0.09617686766359428;
const current = evaluateIndependentWrc537Table5({ geometry, stressConcentration:scf, loads:expectedWrc, curveOrdinates:currentQ, signs, locations });
const historical = evaluateIndependentWrc537Table5({ geometry, stressConcentration:scf, loads:expectedWrc, curveOrdinates:historicalQ, signs, locations });
for(let index=0; index<4; index+=1) assert.notEqual(current.stresses.stressIntensity[index], historical.stresses.stressIntensity[index]);
for(let index=4; index<8; index+=1) assert.equal(current.stresses.stressIntensity[index], historical.stresses.stressIntensity[index]);
detections.push('historical-off-axis-1B1-2B1-vector-rejected');

const wrongSign = structuredClone(signs); wrongSign.mlBend[0] *= -1;
const corrupted = evaluateIndependentWrc537Table5({ geometry, stressConcentration:scf, loads:expectedWrc, curveOrdinates:currentQ, signs:wrongSign, locations });
assert.notEqual(corrupted.stresses.circumferential[0], current.stresses.circumferential[0]);
detections.push('table5-sign-corruption-detected');

assert.equal(detections.length, 8);
console.log(JSON.stringify({
  schema:'emp1-wrc537-gamma5-post-authority-refreeze-falsifiers/v1',
  status:'PASS_POST_AUTHORITY_PHYSICAL_ORACLE_FALSIFIERS',
  productionImports:[],
  productionObservationUsed:false,
  detections,
}, null, 2));

function expectFailure(name, fn, pattern){
  let error=null; try{fn();}catch(caught){error=caught;}
  assert(error, `${name}: expected failure`);
  assert.match(String(error.message), pattern, `${name}: wrong failure ${error.message}`);
  detections.push(name);
}
