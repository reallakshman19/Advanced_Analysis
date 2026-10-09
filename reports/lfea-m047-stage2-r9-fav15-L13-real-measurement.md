# M047 Stage 2 — R9/FAV15 fresh real L13 measurement

**Decision:** `R9_FAV15_NOT_NOMINATED_AT_L13_COUNT_UNCHANGED`

## Custody and scope

- Pinned `BM4_L.ACCDB`: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8` (5,136,384 bytes).
- Frozen production friction solver blob: `5b3ba1ce89f6ff7509bf8be82361993a32497ad2` (`CAESAR-ACCDB-FRICTION-SOLVER-R2`).
- Experimental solver SHA-256: `403adf5b204ef8362f2bde481382351d6329d8010d8f2d41426d6f79c11000dd`.
- Variant: `R9-FAV15-FIRST-STICK-TO-SLIDE-2D-DIRECTION-LIMIT`.
- One mechanic only: CAESAR Friction Angle Variation default 15° on the first non-sliding→sliding transition of a **2-D** friction plane.
- On an eligible transition, the direction carried by the elastic trial force may rotate at most 15° toward the R2/D1 target for that transition iteration. The next iteration is already sliding and resumes unmodified R2/D1. One-dimensional friction directions are unchanged because they have no angular plane.
- Unchanged: D1 after transition, μ, friction stiffness, current-own-normal capacity, return map, state boundary/re-lock, acceleration, 800-iteration ceiling, load stepping, convergence tolerances, frozen ±10% comparison goal, and all qualified linear mechanics.

This is a document-bounded discriminator of Hexagon's published first-transition rule, not a claim that the proprietary internal implementation is known beyond the published behavior.

## Pre-measurement transition forensic

A bounded exact-R2 run over the first 25 iterations observed 28 STICK→SLIDE transitions. Eight were re-breakaways after prior slip. Only two exceeded 15°: node 21800 on a 2-D plane (18.907989°) and node 22140 as a 1-D sign reversal (180°). The FAV15 experiment therefore has only one 2-D intervention site in that observed path.

## Real L13 result

- elapsed: 241.142 s
- iterations: **396**
- nonlinear gates: **CONVERGED**; failed gates: []
- recovered equilibrium: **PASS**
- execution: **QUALIFIED**
- eligible 2-D STICK→SLIDE transitions: **18**
- transitions actually limited by 15°: **1**
- the only limited event is node **21800**, iteration **16**, raw angle **18.907989°**, applied angle **15°**.
- final rows semantic hash: `fnv1a64:86e0c94ba51f9909`

### Frozen accuracy comparison

| Metric | production R2 baseline | R9/FAV15 | decision delta |
|---|---:|---:|---:|
| normals within ±10% | 23/23 | 23/23 | 0 |
| tangential vectors within ±10% | 13/23 | 13/23 | 0 |
| worst normal error | 1.794642% | 1.794507% | -0.000135 pp |
| worst tangential vector relative error | 7.219149 | 6.832354 | -0.386794 |

The worst tangential error decreases, but **the frozen pass count does not improve**. The established fail-fast nomination rule requires an increase in tangential vectors within the ±10% goal without degrading normal parity. Therefore R9/FAV15 is not nominated and does not proceed to L7 or L15.

### Per-restraint R9/FAV15 accuracy

| restraint | normal err % | tangent rel err | within 10% | regime |
|---|---:|---:|:---:|---|
| `20090:REST_PTR2:TYPE3:UY` | 1.794507 | 0.083765 | yes | LOCKED_AFTER_SLIP |
| `20170:REST_PTR3:TYPE3:UY` | 0.870507 | 0.087707 | yes | LOCKED_AFTER_SLIP |
| `20250:REST_PTR4:TYPE3:UY` | -0.005481 | 0.016960 | yes | STUCK |
| `20350:REST_PTR6:TYPE3:UY` | -0.151675 | 0.012857 | yes | SLIDING |
| `20440:REST_PTR8:TYPE3:UY` | -0.026081 | 0.108866 | no | LOCKED_AFTER_SLIP |
| `20520:REST_PTR9:TYPE3:UY` | -0.051930 | 0.051684 | yes | LOCKED_AFTER_SLIP |
| `20550:REST_PTR10:TYPE3:UY` | 0.035585 | 0.041587 | yes | STUCK |
| `20580:REST_PTR11:TYPE3:UY` | -0.125586 | 0.002563 | yes | SLIDING |
| `20710:REST_PTR13:TYPE3:UY` | 0.644897 | 0.090286 | yes | SLIDING |
| `21470:REST_PTR14:TYPE3:UY` | -0.132357 | 0.087582 | yes | LOCKED_AFTER_SLIP |
| `21610:REST_PTR16:TYPE3:UY` | -1.578122 | 0.057621 | yes | SLIDING |
| `21740:REST_PTR18:TYPE3:UY` | -0.112211 | 0.355934 | no | LOCKED_AFTER_SLIP |
| `21800:REST_PTR19:TYPE3:UY` | -0.046963 | 0.040960 | yes | LOCKED_AFTER_SLIP |
| `21860:REST_PTR20:TYPE3:UY` | 0.058555 | 0.714849 | no | LOCKED_AFTER_SLIP |
| `21930:REST_PTR21:TYPE3:UY` | 0.268082 | 6.832354 | no | STUCK |
| `22020:REST_PTR22:TYPE3:UY` | -1.126727 | 0.012891 | yes | SLIDING |
| `22070:REST_PTR23:TYPE3:UY` | -1.584934 | 0.892286 | no | LOCKED_AFTER_SLIP |
| `22120:REST_PTR24:TYPE3:UY` | 0.173364 | 0.075917 | yes | LOCKED_AFTER_SLIP |
| `22140:REST_PTR25:TYPE3:UY` | 0.789400 | 1.803983 | no | LOCKED_AFTER_SLIP |
| `22220:REST_PTR26:TYPE3:UY` | -0.228385 | 1.129340 | no | LOCKED_AFTER_SLIP |
| `22260:REST_PTR27:TYPE3:UY` | 0.047887 | 0.111964 | no | LOCKED_AFTER_SLIP |
| `22310:REST_PTR28:TYPE3:UY` | 0.051381 | 0.236899 | no | LOCKED_AFTER_SLIP |
| `22370:REST_PTR29:TYPE3:UY` | -0.011353 | 0.692855 | no | LOCKED_AFTER_SLIP |

## FAV15 transition ledger

| iteration | restraint | raw angle ° | limited? | applied angle ° |
|---:|---|---:|:---:|---:|
| 1 | `20090:REST_PTR2:TYPE3:UY` | 0.000000000 | no | 0.000000000 |
| 1 | `20170:REST_PTR3:TYPE3:UY` | 0.000000854 | no | 0.000000854 |
| 1 | `20350:REST_PTR6:TYPE3:UY` | 0.000000000 | no | 0.000000000 |
| 1 | `20440:REST_PTR8:TYPE3:UY` | 0.000000000 | no | 0.000000000 |
| 1 | `20520:REST_PTR9:TYPE3:UY` | 0.000000854 | no | 0.000000854 |
| 1 | `21470:REST_PTR14:TYPE3:UY` | 0.000000000 | no | 0.000000000 |
| 1 | `21610:REST_PTR16:TYPE3:UY` | 0.000001207 | no | 0.000001207 |
| 1 | `21740:REST_PTR18:TYPE3:UY` | 0.000000000 | no | 0.000000000 |
| 1 | `21800:REST_PTR19:TYPE3:UY` | 0.000001708 | no | 0.000001708 |
| 1 | `22070:REST_PTR23:TYPE3:UY` | 0.000000854 | no | 0.000000854 |
| 1 | `22120:REST_PTR24:TYPE3:UY` | 0.000000000 | no | 0.000000000 |
| 1 | `22220:REST_PTR26:TYPE3:UY` | 0.000001207 | no | 0.000001207 |
| 1 | `22260:REST_PTR27:TYPE3:UY` | 0.000000854 | no | 0.000000854 |
| 1 | `22370:REST_PTR29:TYPE3:UY` | 0.000000854 | no | 0.000000854 |
| 9 | `20090:REST_PTR2:TYPE3:UY` | 2.375095706 | no | 2.375095706 |
| 16 | `20170:REST_PTR3:TYPE3:UY` | 0.472332292 | no | 0.472332292 |
| 16 | `20350:REST_PTR6:TYPE3:UY` | 0.341702452 | no | 0.341702452 |
| 16 | `21800:REST_PTR19:TYPE3:UY` | 18.907988965 | yes | 15.000000000 |

## Authority boundary

- `productionPromotionAuthorized: false`.
- R8/NFV15 remains rejected and is not combined with this experiment.
- The validated L1 hydrotest-insulation correction remains on its separate branch and is not combined with this friction mechanic.
- No tolerance, coefficient, stiffness, iteration ceiling, convergence threshold, comparison criterion, or linear mechanic is changed.
- BM4_NL remains out of scope.

Full local experiment JSON SHA-256: `a17295222e2412f3935c4c62e7d5d425db7aef8b8ed5ca1a15897f2c5db28684`.
