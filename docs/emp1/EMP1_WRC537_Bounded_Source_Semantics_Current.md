# EMP.1 WRC-02 — Current bounded WRC 537 source-semantics profile

## Status

```text
PASS_BOUNDED_METHOD_SOURCE_SEMANTICS_WITH_EXTERNAL_CASE_PREREQUISITES
```

Issue #1765 integrates the retained WRC 537 (2013) source work for the existing bounded EMP.1 route. This record does not rewrite the historical nine-row P0 aggregate and does not widen runtime authority.

The integration separates two questions that the older aggregate mixed together:

```text
What does the bounded WRC method mean?       -> source semantics
Does this physical vessel satisfy that use?  -> case applicability evidence
```

The first is closed for the bounded method by the current profile. The second remains fail-closed until each case supplies the required engineering evidence.

## Controlled method envelope

```text
WRC 537 (2013)
CYLINDRICAL / ROUND / ORIGINAL
gamma = 5 exact
beta = 0.05..0.50 inclusive
differential pressure = 0
Kn = Kb = 1
Au, Al, Bu, Bl, Cu, Cl, Du, Dl
longitudinal moment = Table-5 axis-of-symmetry 1B / 2B
host-shell result only
continuous/global maximum = not claimed
code compliance = NOT_ASSESSED
```

Controlled source SHA-256 remains:

```text
698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2
```

Direct rendering of the pinned repository PDF remains unavailable in the connected binary transport and is retained as `NOT_RUN_EXECUTION_ENVIRONMENT_BINARY_TRANSPORT`. This integration therefore creates no new direct-page observation claim.

## Why the historical nine blockers are not nine current method blockers

The legacy records remain useful and immutable. Their `BLOCKED_*` labels describe each micro-issue's original closure standard, not necessarily a current bounded-method prerequisite.

### Recovery surfaces and physical locations

The retained WRC Table 4 transcription, pages 39–40, states:

- `u` = upper/outer shell surface;
- `L` = lower/inner shell surface;
- A/B are the longitudinal-axis pair;
- C/D are the circumferential/transverse-axis pair.

Table 5, pages 41–42, then uses the same `Au..Dl` columns for every applicable membrane, bending and shear contribution, instructs algebraic summation, and forms combined stress intensity afterward.

The bounded profile therefore treats the eight source-labeled columns as common physical recovery locations/surfaces. It does **not** invent a new signed global-angle relabeling of A versus B or C versus D. The existing qualified WRC load-axis authority retains physical polarity.

The existing eight-point longitudinal-moment authority remains unchanged: `1B/2B` is the axis-of-symmetry Table-5 route, while `1B-1/2B-1` remains a separate off-axis maximum capability requiring its own flexible-nozzle applicability custody.

### Stress intensity

The older #1383 record required a separate WRC sentence explicitly stating a plane-stress principal-value reconstruction and `sigma3 = 0`. That is not necessary to bind the software to the source.

Table 5 directly defines combined `S` from the algebraically summed `sigma_phi`, `sigma_x` and `tau` values, including its like-sign, unlike-sign and zero-shear cases. WRC also defines `S` as twice maximum shear stress and identifies Maximum Shear Theory.

The current product's principal-difference implementation is accepted only because the WRC-02 checker independently proves it algebraically equivalent to those direct Table-5 formulas. The profile does **not** claim WRC separately states `sigma3 = 0`, and it creates no von-Mises authority.

### T and Rm

WRC source semantics establish:

```text
T  = cylindrical host-shell wall thickness
Rm = cylindrical host-shell mean/mid-radius
gamma = Rm/T
beta  = 0.875*r0/Rm
```

WRC method semantics do not select an asset-integrity state such as nominal, corroded, measured or minimum wall. For one concentric wall, the elementary identity

```text
Rm = (Do + Di)/4 = Do/2 - T/2 = Di/2 + T/2
```

is valid only when the dimensions describe the same physical wall state.

Accordingly, the assessment-state question is a **case prerequisite**, not a missing WRC symbol definition.

### Attachment class and axis

The bounded source family is the standard cylindrical ROUND host-shell attachment parameterized by `r0`. This does not authorize arbitrary round surrogates, lugs, pads, modified reinforcement or off-axis flexible-nozzle extrema.

WRC's reference axis is the shell-normal axis through the attachment center. A real case must prove that its physical attachment axis coincides with that reference. Oblique/skew projection is not authorized.

### Nearby interaction

The retained source does not provide a quantitative nearby-attachment spacing rule or an interaction correction. No threshold is invented.

Instead, a professional case must retain governed evidence that nearby attachments or other discontinuities do not invalidate the single idealized-attachment WRC evaluation. This external evidence is an applicability prerequisite, not a fabricated WRC equation.

### Material / shell-theory boundary

The retained source supports the bounded statements that cylindrical theory used flexible loading surfaces and that large-deflection/other nonlinear effects were identified as later extension work. Table 5 has no explicit `E` or Poisson-ratio input.

This does **not** establish universal material independence, absolute modulus cancellation or Poisson-ratio irrelevance. The current profile therefore requires case evidence that the intended assessment does not rely on behavior outside the retained original cylindrical theory. Unqualified behavior remains fail-closed.

### Code acceptance

WRC shell-stress calculation and downstream code classification/allowable assessment are separate authority planes. The absence of code-classification authority is therefore not a missing WRC calculation semantic.

```text
code stress classification = not authorized
allowable comparison        = not authorized
code assessment performed   = false
code compliance             = NOT_ASSESSED
```

## External case prerequisites

Every professional case must satisfy all five:

1. `SAME_STATE_ASSESSMENT_GEOMETRY`
2. `STANDARD_ROUND_ATTACHMENT_CLASS`
3. `PHYSICAL_ATTACHMENT_AXIS_COINCIDENCE`
4. `ISOLATION_OR_NONINTERACTION_EVIDENCE`
5. `ORIGINAL_CYLINDRICAL_THEORY_APPLICABILITY_EVIDENCE`

Missing evidence is not a PASS and cannot be replaced by production output, CAUx agreement or UI defaults.

## Historical aggregate preservation

The historical file remains unchanged:

```text
validation/emp1/release/emp1-wrc537-gamma5-p0-source-semantics-gate-v1.json
state = BLOCKED_P0_SOURCE_SEMANTICS
blockerCount = 9
```

It is classified as `HISTORICAL_IMMUTABLE_PRE_WRC02_INTEGRATION_AGGREGATE`.

Current WRC-02 source-semantic status resolves through:

```text
validation/emp1/wrc537-2013/bounded-source-semantics-v1.json
validation/emp1/release/emp1-wrc537-gamma5-current-source-semantics-gate-v1.json
```

Historical source-research rows are not edited to manufacture a green past state.

## Authority boundary

This integration does not change:

- WRC equations, coefficients or curve data;
- load signs or Table-5 recovery numerics;
- expected stresses or any oracle;
- numerical tolerances;
- gamma/beta/dP/SCF authority;
- route registration/engineering-use authority;
- non-tabulated-gamma policy;
- resultHash authority;
- code compliance;
- professional-release/deployment authority.

The next consumer is #1768. Numerical qualification may bind this profile, but its qualification case must carry evidence satisfying the declared case prerequisites.
