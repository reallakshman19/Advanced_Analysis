# EMP.1 — CAUx 2017 WRC01f Pages 24–31 Benchmark

## Purpose

This record originated as Issue #1389 PR-C, which froze the CAUx pages 24–31 reference values and an independent arithmetic trace **before any EMP.1 production-output observation**. The frozen PR-C/Q1 record remains historical and immutable.

Current benchmark status is indexed by:

```text
validation/emp1/release/emp1-current-benchmark-manifest-v1.json
```

That manifest resolves CAUx source qualification through Q3, retains the Sep-3 actual comparison custody unchanged, and records the explicit WRC537 comparison execution contract separately from the CAUx WRC107 source-reproduction semantics.

CAUx is an independent benchmark/reference source. It is **not** WRC method authority and cannot define or correct WRC equations, signs, coefficients, curve domains, interpolation, tolerances, code compliance or production authorization.

## Controlled source

```text
Document: CAUx 2017 - WRC01f.pdf
Source repository: reallaksh19/XML_Compare_Utilities
Pinned commit: dc1371afcd44c12de86b2dad6eddf00f1f0b3c55
Path: docs/emp.1/CAUx 2017 - WRC01f.pdf
Git blob SHA-1: 76573b41462943b2987e28b23ebbbf7e51ac0a02
Bytes: 7,260,396
SHA-256: c1e92798a7bc172d649007ad88f6be548651f07a01cb2fbf83343e2283e0e83e
Pages: 24–31 inclusive
```

Source custody is verified. At the original PR-C/Q1 freeze, direct PDF page re-observation was not available and Q1 therefore retained:

```text
direct PDF page re-observation = NOT_RUN_EXECUTION_ENVIRONMENT
```

That is historical status, not current status. Subsequent direct PDF observation passed, and current qualification Q3 retains:

```text
direct PDF page re-observation = PASS
gamma/radius basis for this benchmark = PASS_RECONCILED
Q3 status = PASS_FINAL_CAUX_SOURCE_QUALIFICATION_GAMMA_RADIUS_RECONCILED_REFERENCE_FREEZE_PRESERVED
```

The repository also retains a page-qualified transcription:

```text
docs/emp1/CAUx_2017_WRC01f_pages_24-31.md
Git blob SHA-1 = ce0ee91cd996feee162d4dd90ce1af4063e06775
```

PR-C freezes values from that retained transcription while explicitly preserving the distinction between retained-transcription inspection and a new direct-PDF observation.

## Frozen benchmark artifacts

```text
validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-v1.json
  semanticHash = 887b231028cd187c63d7cb29aedbc7db182b31d404623f9981f36a21987c2bf3

validation/emp1/caux2017-wrc01f/caux-pp24-31-independent-handcalc-v1.json
  semanticHash = 88b3ced854446b68329c46558ddd326ed607a2fc966e7201596f53518abc4b9c

validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-qualification-v1.json
  semanticHash = d621d81342795b082d8e6add7b938de3f897bb6dff9d320e153602a9c4a9f37e

validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-qualification-v3.json
  semanticHash = 9c57953aff802624650050c251d05b3ca8ea6a190bec77863f03ec790abc353f
```

The expected-value file is frozen with:

```text
productionOutputObservedForExpectedValueSelection = false
productionOutputUsedToChooseDefinition = false
toleranceDerivedFromProduction = false
```

No future production mismatch may be repaired by changing these values or widening a tolerance. The discrepancy must instead be diagnosed.

## Source-reported benchmark configuration

The retained pages report:

```text
Host shell: cylindrical
Attachment: round
Vessel OD: 1844 mm
Nominal shell thickness: 22 mm
Shell corrosion allowance: 3 mm
Nozzle OD: 323.850 mm
Nozzle thickness: 14.270 mm
Internal pressure: 1.970 N/mm²
Pressure thrust: No
Vessel axis: (0,1,0)
Nozzle axis: (1,0,0)
Kn = 1
Kb = 1
beta = 0.155
gamma = 48.03
WRC107 version = March 1979 (B1 & B2)
```

The page-26 signed sustained local loads are:

```text
P  = -161 N
Vc = -53 N
Vl = -2109 N
Mc = +121 N·m
Ml = +33 N·m
Mt = -775 N·m
```

The independent benchmark-specific mapping from the page-25 global vectors is:

```text
P  = Fx
Vc = -Fz
Vl = Fy
Mc = -My
Ml = -Mz
Mt = -Mx
```

It reproduces the source-reported sustained, expansion and occasional local load vectors exactly. This is qualified **only for this CAUx geometry/axis example** and is not promoted to universal WRC sign authority.

## Gamma / mean-radius inconsistency

The retained page 26 transcription contains an important internal inconsistency:

```text
reported Rm = (1844 - 22)/2 = 911 mm
reported T  = 22 - 3 = 19 mm
reported gamma = 48.03
```

But:

```text
911 / 19 = 47.9473684211
```

A diagnostic calculation using a corrosion-adjusted mean radius gives:

```text
Rm,corr = (1844 - 19)/2 = 912.5 mm
912.5 / 19 = 48.0263157895 ≈ 48.03
```

Q1 historically recorded this as:

```text
UNRESOLVED_SOURCE_INTERNAL_BASIS_OR_TRANSCRIPTION_DISCREPANCY
```

Q3 later reconciled this exact CAUx case using same-state internal-corrosion geometry:

```text
T = 19 mm
Rm = (1844 - 19)/2 = 912.5 mm
gamma = 912.5/19 = 48.0263157895 -> 48.03
```

The reconciliation is bounded to this benchmark. It does **not** establish a global corrosion/thickness/radius policy and does not create WRC method authority.

## Independent hand calculation

The hand calculation imports no production `src/core/emp1/**` evaluator. It uses only retained CAUx source-reported geometry, axes, loads, displayed curve values, explicit source substitutions and independent arithmetic.

Selected reproductions are:

| Quantity | Independent | Source-displayed |
|---|---:|---:|
| Circ. membrane from P at A/B | 67.6499509 kPa | 67.65 kPa |
| Circ. bending from P at A/B | 123.0914127 kPa | 123.09 kPa |
| Circ. membrane from Mc | 95.7953187 kPa | 95.79 kPa |
| Circ. bending from Mc | 1139.3819383 kPa | 1139 kPa |
| Long. membrane from P at A/B | 49.6980184 kPa | 49.70 kPa |
| Long. bending from P at A/B | 219.4238227 kPa | 219.42 kPa |
| Shear from Vc | 5.48096945 kPa | 5.480 kPa |
| Shear from Vl | 218.1012183 kPa | 218.10 kPa |
| Shear from Mt | 247.3649734 kPa | 247.36 kPa |

The retained source publishes curve coefficients to limited decimal precision and total stress rows as integer kPa. Reconstructing totals from the displayed curve coefficients therefore does not reproduce every integer total exactly; the maximum observed differences for the sustained reconstruction are approximately 3.59 kPa circumferential, 3.04 kPa longitudinal and 0.47 kPa shear. These are recorded as source-display-precision observations. **No engineering tolerance is inferred from them.**

## Stress-intensity arithmetic

Using the source-reported total circumferential, longitudinal and shear stress rows, the hand calculation independently reconstructs plane-stress principal-difference/Tresca stress intensity.

The explicit page-29 Au example gives:

```text
sqrt((0 - 71)^2 + 4*(253)^2)
= 510.956945 kPa
→ source display 511 kPa
```

Across the eight displayed points, the maximum absolute differences between independently recomputed stress intensity from the **rounded source total-stress rows** and the source-displayed integer stress intensities are:

```text
SUS = 0.610231 kPa
EXP = 0.549139 kPa
OCC = 0.783121 kPa
```

Those differences are observations of display precision, not acceptance tolerances and not grounds to tune expected values.

## Release-profile disposition

This CAUx example is **outside** the first professional bounded route for three independent reasons:

1. source-reported `gamma = 48.03`, while the release route requires exactly `gamma = 5`;
2. source-reported internal pressure is `1.970 N/mm²`, while the first release is the zero-differential-pressure / upstream-resolved-pressure-thrust route;
3. the report identifies the WRC107 March 1979 B1/B2 reference context, not the exact gamma5 route identity.

Therefore:

```text
releaseProfileDisposition = OUTSIDE_BOUNDED_GAMMA5_ZERO_DP_RELEASE_PROFILE_REFERENCE_ONLY
gamma5 production comparison required = false
production authorization = false
```

The correct engineering action is **not** to run the gamma5 route at gamma 48.03 or to interpolate/fallback. Unsupported-domain behavior remains fail-closed.

## Page 30 code-check boundary

Page 30 contains source-reported ASME stress classification and allowable checks. PR-C retains the existence of that material only to preserve source context. It does not import those conclusions into EMP.1.

For the bounded professional release:

```text
CODE COMPLIANT = false / NOT ASSESSED
```

unless a separate code-acceptance method is independently selected and qualified.

## Checker

```text
node scripts/emp1-caux-pp24-31-benchmark-check.mjs
```

Normal mode checks source/transcription custody, semantic hashes, anti-circularity, benchmark-specific load mapping, independent arithmetic, stress-intensity reconstruction and all false authority flags.

Its current successful state is:

```text
PASS_CAUX_REFERENCE_FREEZE_Q1_HISTORICAL_CURRENT_Q3_SOURCE_QUALIFIED
```

The checker still validates Q1 as the immutable historical reference-freeze/arithmetic record, while current direct-source status is taken from Q3. Neither state is production qualification or WRC method authority.

Authorization-facing source mode is:

```text
node scripts/emp1-caux-pp24-31-benchmark-check.mjs --require-direct-pdf
```

The flag now resolves the direct-PDF requirement against current Q3. It passes only while Q3 retains direct page re-observation `PASS`; Q1 remains unchanged.

## Historical remaining boundary — closed

PR-C originally left direct-CAUx-source qualification blocked pending exact controlled PDF page re-observation. That boundary was subsequently closed by the retained direct-PDF observation and Q3 gamma/radius reconciliation described below. Closing the source-observation boundary did not change the gamma5 route, production authority, WRC source semantics, code-compliance state or release profile.

## Update: direct-PDF observation closed (issue #1633) and independently corroborated

The remaining boundary above was closed in a later leg (issue #1633, `validation/emp1/caux2017-wrc01f/caux-pp24-31-direct-pdf-observation-v1.json`), which rendered/re-observed the controlled PDF pages directly (SHA-256 byte-identity confirmed) and recorded a `PASS` for pages 24-31. That observation was carried forward through two superseding qualification records:

```text
caux-pp24-31-benchmark-qualification-v2.json (Q2, issue #1633) — direct-PDF-observation PASS
caux-pp24-31-benchmark-qualification-v3.json (Q3, issue #1633) — gamma/radius basis additionally reconciled
  (same-state corroded mean radius 912.5 mm / T 19 mm reproduces the reported gamma 48.03 to 2 dp;
   the presenter's on-slide annotation mixing a nominal-radius Rm with the corroded T is preserved,
   diagnosed, and does not establish global corrosion-geometry or WRC method authority)
```

`caux-pp24-31-benchmark-qualification-v1.json` (Q1, this document) is intentionally preserved unchanged as the historical pre-observation record (`status` still `BLOCKED_..._NOT_RUN_...`); production code (`emp1-benchmark-evidence-workspace.js`) reads Q3, not Q1.

This pass additionally found and fixed an unrelated integrity bug: the `semanticHash` frozen into `caux-pp24-31-benchmark-v1.json` (and copied into every downstream file: handcalc, Q1, Q2, Q3) did not match the hash the checkers actually recompute from that file's real content — it appears to have never been derived from a real run since the file was first committed. Recomputed and propagated the correct hash through the full dependency chain (handcalc → Q1 → Q2 → Q3 and their four consuming checker scripts); no WRC value, load, curve coefficient, stress result, or authority flag changed — every content assertion in every affected checker (`emp1-caux-pp24-31-benchmark-check.mjs`, `emp1-caux-pp24-31-direct-pdf-qualification-check.mjs`, `emp1-caux-gamma-radius-reconciliation-check.mjs`, `emp1-benchmark-evidence-projection-check.mjs`, plus the production-consuming `emp1-benchmark-evidence-ui-check.mjs`) passed unchanged both before and after, and all nine now exit 0.

Separately, an independently-uploaded copy of the source PDF was verified byte-identical (SHA-256 `c1e92798a7bc172d649007ad88f6be548651f07a01cb2fbf83343e2283e0e83e`, 7,260,396 bytes) to the pinned `rawPdfSha256`. Pages 24-31 were rendered at 200dpi (`pdftoppm`) and visually cross-checked against every frozen datum in `caux-pp24-31-benchmark-v1.json` and every `expectedValueQuantityIds` entry: vessel/nozzle geometry, direction cosines, SUS/EXP/OCC global and WRC-107-converted loads, gamma/beta, all 16 dimensionless curve values, the full circumferential/longitudinal/shear stress tables and all three stress-intensity rows (SUS/EXP/OCC, all 8 points), and the page-31 location-map diagram. Page 24 was confirmed to be generic documentation (a different, non-benchmark sample curve table), correctly excluded from the frozen datums. Zero discrepancies were found — a second, independently-tooled corroboration of the issue #1633 observation, using a different renderer (`pdftoppm`/poppler vs. the prior `pdfium` primary render).
