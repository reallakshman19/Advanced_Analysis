# WRC 537 Open Engineering Issues

Status: **IMPLEMENTATION BLOCKED**

This file normalizes the research introduced by PR #1203. It does not replace the original research artifacts and does not promote secondary-source or OCR-derived content to engineering authority.

## WRC537-ISSUE-001 — Target-edition technical authority missing

**Engineering question:** Which exact WRC Bulletin 537 edition is the numerical implementation qualified against?

**Current state:** The release target is Edition 4, published 2026-02, based on current WRC catalog identity metadata. PR #1203 contains technical research from the 2010/2013 material and secondary references to the 2022 edition. The licensed/authorized Edition 4 technical document is not present.

**Why implementation is blocked:** Technical equations, coefficients, signs, applicability limits, interpolation rules and examples cannot be inherited across editions without verification.

**Required resolution:** `PRIMARY_SOURCE_TARGET_EDITION_VERIFICATION`.

## WRC537-ISSUE-002 — Numerical coefficients absent

**Engineering question:** What are the exact target-edition numerical coefficient values and published precision for each required curve/equation family?

**Current state:** `docs/04_WRC537_NUMERICAL_TABLES.csv` inventories table/curve structure but retains `UNRESOLVED` coefficient values and precision.

**Normalization rule:** A raw row marked `EXTRACTED` or `HIGH` remains `RESEARCH_ONLY` when its numerical value, source precision, or target-edition primary verification is absent.

**Why implementation is blocked:** No shell-stress coefficient evaluation is possible or auditable without exact values and precision.

**Required resolution:** `LICENSED_DATA_EXTRACTION_AND_SECOND_PERSON_REVIEW`.

## WRC537-ISSUE-003 — Cylindrical parameters incomplete

**Engineering question:** What are the exact Edition 4 definitions, equations, ranges and boundary inclusivity for the cylindrical-shell parameters currently identified as lambda and delta?

**Current state:** PR #1203 leaves `CYL_LAMBDA` and `CYL_DELTA` unresolved.

**Why implementation is blocked:** Cylindrical-shell applicability and curve selection cannot be evaluated deterministically.

**Required resolution:** `PRIMARY_SOURCE_TARGET_EDITION_VERIFICATION`.

## WRC537-ISSUE-004 — Load and moment signs incomplete

**Engineering question:** What positive directions and coordinate mappings apply to every supported force and moment component?

**Current state:** Spherical torsion and multiple cylindrical load/moment signs remain unresolved. The proposed LAFEA-to-WRC mapping is research-only.

**Why implementation is blocked:** An incorrect sign convention can reverse membrane/bending/shear contributions while still producing numerically plausible results.

**Required resolution:** `PRIMARY_SOURCE_SIGN_TABLE_VERIFICATION_AND_LAFEA_AXIS_MAPPING`.

## WRC537-ISSUE-005 — Stress reconstruction and stress-intensity mathematics not qualified

**Engineering question:** What exact Edition 4 equations define inside/outside surface reconstruction, principal quantities and source stress intensity?

**Current state:** PR #1203 derives a sign multiplier matrix from a secondary guide and explicitly marks the surface-reconstruction convention unresolved. Its displayed stress-intensity expressions also contain an outer square-root form that is dimensionally inconsistent if the enclosed quantity has stress units.

**Engineering consequence:** The displayed equations are quarantined as research text and shall not be used as source equations or benchmarks.

**Required resolution:** `PRIMARY_SOURCE_EQUATION_VERIFICATION`, followed by an independent dimensional check and hand calculation.

## WRC537-ISSUE-006 — Interpolation/extrapolation authority incomplete

**Engineering question:** Which interpolation and extrapolation operations are explicitly authorized by Edition 4?

**Current state:** PR #1203 attributes the detailed sequential linear interpolation procedure to a secondary CEI guide while noting only partial bulletin support.

**Why implementation is blocked:** Interpolating results versus coefficients, axis order, and boundary handling are numerical-method decisions that must be source qualified.

**Required resolution:** `PRIMARY_SOURCE_INTERPOLATION_POLICY_VERIFICATION`.

## WRC537-ISSUE-007 — Published numerical benchmarks absent

**Engineering question:** Which target-edition published/reference cases can independently qualify implementation outputs?

**Current state:** No Edition 4 primary-source numerical benchmark is retained and independently reproduced.

**Why implementation is blocked:** A coefficient transcription and evaluator could be self-consistent yet wrong without independent source examples.

**Required resolution:** `PRIMARY_SOURCE_BENCHMARK_EXTRACTION_AND_INDEPENDENT_REPRODUCTION`.

## WRC537-ISSUE-008 — LAFEA canonical mapping incomplete

**Engineering question:** How do target-edition geometry, loads, stress components, surfaces and recovery points map to LAFEA canonical fields without sign or reference-point ambiguity?

**Current state:** PR #1203 retains `UNRESOLVED` LAFEA stress mappings.

**Why implementation is blocked:** Method mathematics cannot safely consume application loads/geometry before this translation layer is qualified.

**Required resolution:** `LAFEA_WRC537_MAPPING_QUALIFICATION` after Issues 001–006 are resolved.

## Release rule

WRC 537 numerical implementation, product registration, trusted-authority activation and UI execution remain forbidden until `scripts/wrc537-source-readiness-check.mjs --release` returns `READY_FOR_IMPLEMENTATION`.
