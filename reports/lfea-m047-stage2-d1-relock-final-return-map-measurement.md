# M047 Stage 2 — H1 D1 relock final-return-map measurement

Status: **REAL PINNED-ACCDB MEASUREMENT — positive signal, governed review required; not production promotion.**

## Isolated mechanic

Accepted D1 updates its permanent return-map slip offset while a restraint remains on the sliding branch. On an actual `SLIDE → STICK` transition, D1 otherwise carries the prior iteration's slip offset unchanged.

H1 changes only that transition: when `state === SLIDE` and `nextState === STICK`, perform one final ordinary D1 return-map update from the current total relative tangential displacement and current `μ|N|`, then enter STICK carrying that finalized permanent slip offset.

H1 still permits relocking. It is therefore distinct from the rejected no-relock S1 mechanic and from the rejected S2 zero-force/current-position re-anchor. It does not introduce, remove or assume any physical model spring.

Unchanged: D1 total-displacement friction direction, resultant Coulomb capacity, own-restraint signed normal basis, friction stiffness, state boundary/hysteresis, secant acceleration, full-load single-step L13 path, convergence gates, physical equilibrium, ±10% comparison goal and ACCDB authority. Production source was not modified.

## Custody and exercise gate

- measured #1101 source head: `559930bdd614b0b51441b8567df677c0ca216988`
- sibling accepted-D1 evidence head: `fadcee224328ab1a9e3c27e741442654e6b5206c`
- pinned `BM4_L.ACCDB`: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8`, 5,136,384 bytes
- Actions run: `31691489628`
- artifact ID: `9177738876`
- artifact digest: `sha256:4c9478a1b57c83cd3319672938fd18e462fde8ca355b9eda0c5afe1f291b48c9`
- transformed candidate source: `b4add5252cd6bf2e24fc07be664f1bea023649fe26d9b90984ff36fd2c59d988`
- both repeats converged in **249 iterations**
- repeat row hashes: `fnv1a64:77eea847870b228b` / `fnv1a64:77eea847870b228b`
- recovered equilibrium: **PASS**
- convergence gates: **PASS**
- actual `SLIDE → STICK` transitions: **26 in each repeat**, with identical transition identities

The transition count is a hard exercise gate: H1's improved result is tied to a mechanic that was actually exercised, not inferred from final state labels.

## Real L13 accuracy

| metric | D1 | H1 |
|---|---:|---:|
| vectors within ±10% | **13/23** | **15/23** |
| normals within ±10% | **23/23** | **23/23** |
| normalized state matches | **19/23** | **19/23** |
| median vector error | 8.77% | **8.35%** |
| raw worst vector error | 721.91% | **593.95%** |
| above provisional R1 floor passes | 13/22 | **15/22** |
| above-R1 worst vector error | **176.22%** | 177.69% |

No D1 vector pass was lost. Two previously failing relocked rows become passes:

- **21860: 71.77% → 2.49%**
- **22260: 11.26% → 8.35%**

The nine above-R1 D1 vector failures that were all `LOCKED_AFTER_SLIP` improve as a cohort:

- median vector error: **69.23% → 32.61%**
- vectors within ±10%: **0/9 → 2/9**

This is the first post-D1 one-mechanic candidate in the current RCA sequence to improve aggregate vector pass count while retaining all D1 passes and keeping normals 23/23.

## Remaining above-R1 failures

Seven vector failures remain above the provisional R1 floor:

| node | D1 | H1 |
|---|---:|---:|
| 22140 | 176.22% | **177.69%** |
| 22220 | 111.57% | 106.24% |
| 22070 | 87.66% | 87.70% |
| 22370 | 69.23% | 63.29% |
| 21740 | 35.28% | 32.61% |
| 22310 | 23.29% | 19.63% |
| 20440 | 10.96% | 10.98% |

The important negative gate is 22140: H1 slightly worsens the worst above-R1 error from 176.22% to 177.69%. H1 therefore does **not** satisfy a production-promotion boundary that requires the worst governed residual not to regress.

Other useful changes include 22120 improving from 8.45% to 0.79%, while 20710 remains a pass at 9.12%.

## State evidence

Normalized state matches stay 19/23 rather than improving. H1's four remaining normalized mismatches are:

- 22370: CAESAR `SLID`, H1 `LOCKED_AFTER_SLIP`
- 20440: CAESAR `STUCK`, H1 `SLIDING`
- 21470: CAESAR `SLID`, H1 `LOCKED_AFTER_SLIP`
- 21860: CAESAR `SLID`, H1 `LOCKED_AFTER_SLIP`

21860 demonstrates why vector accuracy and final state label must remain separate qualification dimensions: its vector improves to 2.49% while the normalized state still disagrees.

## Decision

**`H1_SIGNAL_PRESENT_REQUIRES_GOVERNED_REVIEW_NOT_PRODUCTION_PROMOTION`**

1. Keep D1 as the accepted experimental baseline until H1 completes governed residual review.
2. Preserve H1 as the leading candidate because it reaches **15/23** without losing an existing D1 pass and materially improves the relocked-failure cohort.
3. Do not promote H1 to production yet: seven above-R1 failures remain, 22140 slightly regresses, and normalized state agreement remains 19/23.
4. Do not unlock L7, L1 or BM4_NL from H1.
5. The next step is data-only residual discrimination within H1: compare transition timing/count/history of the seven remaining failures against the newly repaired 21860/22260 rows before changing another mechanic.
6. No tolerance, comparison rule, acceptance criterion, friction stiffness, normal basis or node exception changes are authorized.

Machine-readable evidence: `reports/lfea-m047-stage2-d1-relock-final-return-map-measurement.json`.
