# M047 Stage 2 — L1 hydrotest-insulation source landing

**Source-landing status:** PASS.  
**Fresh exact-head nonlinear replay status in this agent runtime:** INCOMPLETE — execution ceiling reached before a completed L1 result; no new accuracy number is claimed from those attempts.  
**Production promotion authorized:** false.

## Exact production source landing

The previously qualified one-mechanic HYD insulation candidate has now been landed as a normal source edit on `agent/issue-1083-l1-hyd-insulation-production`.

- landed commit: `2d01d78037b73f4cd3bde909488a7a4a644d74dc`
- parent: `7582b76410a1ac162dd81e095b9e9bc9a64fef41`
- only changed file in the landing commit: `src/core/fea-benchmarks/caesar-accdb-linear-solve.js`
- preimage Git blob: `d28e3c5e893cea3ae44e116daf18fcdca0d22107`
- landed Git blob: `06e1645cfd8a957f5a5ef787c159c0d8d9094508`
- frozen production R2 friction-solver Git blob remains: `5b3ba1ce89f6ff7509bf8be82361993a32497ad2`

The landed linear blob is exactly the same candidate blob that was independently measured before source landing; it is not a manually reconstructed approximation.

## Fresh local real-ACCDB source/authority preflight

The exact committed source was transported as bytes only, materialized locally, and re-hashed before reading the real pinned ACCDB. No workflow solve or workflow accuracy result is used as authority.

Custody:

- `BM4_L.zip`: SHA-256 `978617cba50fa0b1a16c2fa71dc1e0d38e55ac834b191f887d100c6951abd8b9`, 582,488 bytes
- `BM4_L.ACCDB`: SHA-256 `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8`, 5,136,384 bytes
- committed linear source re-hashed locally as Git blob `06e1645cfd8a957f5a5ef787c159c0d8d9094508`
- committed friction source re-hashed locally as Git blob `5b3ba1ce89f6ff7509bf8be82361993a32497ad2`

Fresh L1 preparation from those exact bytes resolved:

- `INCLUDE_INSULATION_IN_HYDROTEST = false`
- authority level: `CAESAR_V14_DEFAULT`
- source: `HEXAGON_CAESAR_II_14_INCLUDE_INSULATION_IN_HYDROTEST_DEFAULT_FALSE`
- precedence: `OVERALL_GLOBAL_DEFAULT < INDIVIDUAL_FILE_SETTING < LOAD_CASE_SETTING < MODEL_INPUT`
- precedence direction: `LOWEST_TO_HIGHEST_AUTHORITY`
- all four BM4_L layers are undeclared for this setting, therefore the CAESAR v14 default applies
- hydrotest contents density remains `1000 kg/m^3`
- pressure field remains `HYDRO_PRESSURE`

This is a fresh local real-ACCDB source/authority check on the landed source, not a synthetic inspection.

## Binding to the already measured candidate

The prior production-candidate evidence remains the measurement authority for accuracy because the source that was measured then and the source now committed are byte-identical at the production linear boundary (`06e1645c...`), with the same frozen R2 friction solver (`5b3ba1ce...`) and the same pinned ACCDB.

Committed prior evidence:

- `reports/lfea-m047-stage2-l1-hyd-insulation-production-candidate.md`
- `reports/lfea-m047-stage2-l1-hyd-insulation-production-controls.json`
- exact patch: `patches/lfea-m047-stage2-l1-hyd-insulation-production.patch`

That already committed local real-file evidence recorded two deterministic candidate runs, each converging in 186 iterations with recovered equilibrium PASS, execution QUALIFIED and zero failed nonlinear gates. The measured result was 22/23 normals within the frozen ±10% goal, worst normal error 13.953465%, and 7/23 tangential vectors within ±10%, with final rows semantic hash `fnv1a64:2e80e62c024d7f81` on both repeats. Frozen L2/L3/L4/L5/L6/L14 controls were bit-identical.

Those numbers are **not re-published here as a new exact-head accuracy measurement**; they are cited as existing evidence bound to the exact same landed production source bytes.

## Fresh exact-head nonlinear replay attempts

Two local replay attempts were made from the transported exact committed source and pinned ACCDB:

1. fresh controls plus two L1 repeats;
2. a narrowed single L1 exact-head solve.

This constrained execution environment exceeded its tool execution ceiling before either nonlinear replay completed. No partial iterate, timeout state, or historical workflow result is treated as benchmark accuracy evidence. The fresh source/authority preflight above completed successfully.

## Engineering boundary

The HYD load-basis correction is now real production source rather than a staged patch artifact. It changes only hydrotest insulation gravity handling and preserves the governed configuration precedence. The rejected rigid/reducer fluid-density candidate is not included.

Stage 2 friction qualification is still blocked by tangential parity. The landed HYD correction must not be used to absorb that separate friction defect, and no acceptance limit, friction coefficient, stiffness, direction rule or convergence tolerance is changed here.

`productionSourceLanded: true`  
`productionMechanicsChanged: true` (HYD insulation gravity only)  
`productionPromotionAuthorized: false`  
`newAccuracyClaimAuthorizedByThisReceipt: false`
