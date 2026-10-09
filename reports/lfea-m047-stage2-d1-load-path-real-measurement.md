# M047 Stage 2 D1 physical-load continuation — real pinned-ACCDB measurement

Completed real `BM4_L.ACCDB` project-declared continuation RCA. This does not claim CAESAR II internally performs static load stepping.

## Custody

- PR #1101 measured source head: `862fa28f328ce279aca421044bee486246427583`
- sibling evidence head: `ee777d92c6fa833e33639de58e16637855b2402f`
- pinned ACCDB SHA-256: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8`
- Actions run: `31682260399`; artifact ID `9175161189`; digest `sha256:2498b5ce9fa8d730c47730a587bb00786beb654d0303de1553f04e38c2675caf`
- experiment semantic hash: `fnv1a64:8d9d141f04721544`
- finalization semantic hash: `fnv1a64:dc8f3e52b34ee8ce`
- production solver SHA-256: `9976cda40cdfd3214ce125d71a3ce5c5f30b33b7f5a9835231705d49b68dfbfa`
- ephemeral candidate SHA-256: `f749feea16184846b181da14d0104b07e175fb1c3cf93b313b84ed2d3b8c3926`

Pinned ZIP/member custody and Stage 2 preflight passed before solving. No production-solver, tolerance, comparison-policy, or node-exception change was used.

## Accuracy

| run | vectors ≤10% | normals ≤10% | state matches | median vector error | worst above-R1 vector error | total iterations |
|---|---:|---:|---:|---:|---:|---:|
| D1-L13-PATH-N1 | 13/23 | 23/23 | 19/23 | 8.77% | 176.22% | 396 |
| D1-L13-PATH-N5 | 12/23 | 23/23 | 16/23 | 8.34% | 53.77% | 693 |
| D1-L13-PATH-N10 | 12/23 | 23/23 | 14/23 | 8.91% | 47.28% | 1137 |

N1 reproduction: **PASS**, 396 iterations; max normal difference 1.836e-10 N; max tangential-component difference 1.834e-9 N.

| node | D1/N1 | N5 | N10 | N5 raw state | N10 raw state |
|---|---:|---:|---:|---|---|
| 20710 | 9.03% | 10.54% | 11.67% | LOCKED_AFTER_SLIP | LOCKED_AFTER_SLIP |
| 22140 | 176.22% | 53.77% | 47.28% | LOCKED_AFTER_SLIP | LOCKED_AFTER_SLIP |
| 22220 | 111.57% | 22.42% | 6.54% | LOCKED_AFTER_SLIP | SLIDING |
| 20440 | 10.96% | 10.80% | 10.93% | SLIDING | LOCKED_AFTER_SLIP |
| 22370 | 69.23% | 1.73% | 25.86% | SLIDING | LOCKED_AFTER_SLIP |
| 22120 | 8.45% | 0.65% | 2.65% | SLIDING | LOCKED_AFTER_SLIP |

## Refinement

N5 vs N10: **FAIL**; max normal difference 29.56 N; max tangential-component difference 408.51 N against the existing 0.01 N force-difference limit.
Raw-state mismatches: 20090:REST_PTR2:TYPE3:UY, 20350:REST_PTR6:TYPE3:UY, 20440:REST_PTR8:TYPE3:UY, 22120:REST_PTR24:TYPE3:UY, 22220:REST_PTR26:TYPE3:UY, 22370:REST_PTR29:TYPE3:UY.

## Disposition

**NO_CONTINUATION_PROMOTION_KEEP_D1_EXPERIMENTAL_BASELINE**

- Retain D1 as the experimental L13 baseline.
- Reject physical-load continuation for promotion: N5/N10 both fall to 12/23 vectors and are not refinement-stable.
- L7 and BM4_NL remain blocked.
- Keep 20710 one-axis capacity/path signal open.
