# M047 Stage 2 — R8/NFV15 governed measurement readiness

Status: **READY FOR REQUIRED LOCAL REAL-ACCDB EXECUTION; NO ACCURACY CLAIM.**

This receipt records a source-level QA of the committed R8/NFV15 measurement dispatcher and its frozen baseline dependencies. It does **not** substitute for the mandatory local portable-reader run against the pinned `BM4_L.ACCDB` and does not authorize production promotion.

## Verified dispatcher boundary

Measurement entrypoint:

```bash
node scripts/lfea-m047-stage2-r8-nfv15-measurement-run.mjs \
  --zip artifacts/bm4l-stage2/source/BM4_L.zip \
  --accdb artifacts/bm4l-stage2/source/BM4_L.ACCDB \
  --out reports/lfea-m047-stage2-r8-nfv15-measurement
```

The dispatcher is additive/non-production and enforces this order:

1. run R8 `L13` on the real pinned ACCDB;
2. assess L13 immediately against frozen production R2;
3. run `L7` only if L13 is physics-valid and directionally nominated by the frozen accuracy metrics;
4. assess L7 immediately;
5. reconstruct `L15` exactly as `L7-L13` only if L7 is also nominated;
6. never perform an independent nonlinear L15 solve;
7. stop before L1 while the independent hydrotest-WW load-basis RCA remains unresolved;
8. do not run Friction Angle Variation in this batch.

A nonconverged run, failed custody/equilibrium/nonlinear/NFV ledger gate, incomplete metric set, or non-nomination stops the sequence rather than widening tolerances or moving to another friction mechanic.

## Frozen inputs verified present

- production solver git blob required by the experiment: `5b3ba1ce89f6ff7509bf8be82361993a32497ad2`;
- pinned ZIP SHA-256: `978617cba50fa0b1a16c2fa71dc1e0d38e55ac834b191f887d100c6951abd8b9`, 582,488 bytes;
- pinned ACCDB SHA-256: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8`, 5,136,384 bytes;
- L13 R2 baseline path: `reports/lfea-m047-stage2-r2-rebaseline/L13.json`, Git blob `6c3a6a87bf586a84faa622b2cc48693e9b59fddc`;
- L7 R2 baseline path: `reports/lfea-m047-stage2-r2-rebaseline/L7.json`, Git blob `5f5f9eb9bd4ec371fd1fc548eeff96fac1d7d8c2`;
- governed measurement dispatcher Git blob: `319c67b058c4a86b777d3e55abf16da66c43f2d8`;
- sequence decision module Git blob: `5289305c5511845bc6afc12beee50490075df81a`;
- assessor Git blob: `65d49ed49afede5a920d02910a29b8daf8cb01f8`;
- algebraic L15 module Git blob: `a0eb27fbaf78a05264fddba247736d520b2e6943`.

## Nomination rule

For a converged, physics-valid primitive case, R8 is directionally nominated only when:

- tangential vectors within the frozen ±10% goal increase versus production R2; and
- normal reactions within the frozen ±10% goal do not decrease.

The nomination is only permission to proceed to the next governed gate. It is not production qualification.

## Accuracy boundary

No new R8 percentage is published here. Candidate accuracy exists only after a fresh local custody-verified real `BM4_L.ACCDB` run creates the experiment and assessment artifacts under `reports/`. Qualification additionally requires the governed remaining sequence, repeat determinism, frozen controls, equilibrium, and a separate production implementation/re-measurement if R8 is ultimately selected.

`productionMechanicsChanged: false`

`productionPromotionAuthorized: false`

`accuracyClaimAuthorized: false`
