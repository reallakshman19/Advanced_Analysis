# S5 pressure-effect source authority — CAESAR setting custody

## Status

```text
PURPOSE: SOURCE_AUTHORITY_PREREQUISITE
NUMERICAL_PRESSURE_PROMOTION: BLOCKED
pressureStiffening: false
pressureAxialThrust: false
pressureBourdon: false
```

This document separates CAESAR source settings from LFEA implementation capability for Stage S5.

Pressure presence (`P1..P9`, hydrotest pressure) does not itself authorize Bourdon displacement, bend pressure stiffening, or pressure/end-thrust mechanics.

## 1. CAESAR Bourdon authority

Primary vendor source:

- Hexagon CAESAR II Users Guide — **Activate Bourdon Effects**
- https://docs.hexagonppm.com/r/en-US/CAESAR-II-Users-Guide/Version-12/336122

Source semantics:

- existing-job setting; `New Job Bourdon Pressure` only initializes new jobs and does not change an existing job;
- default steel-piping behavior is no Bourdon displacement;
- `None`: no global pressure displacement;
- `Translation only`: straight-pipe axial elongation and curved-pipe/bend translation;
- `Translational & Rotational`: adds bend opening/rotation associated with residual ovalization of formed bends;
- FRP is a separate special case where Bourdon is automatically considered.

Engineering consequence:

`BOURDON_PRESSURE` must resolve from the governed existing-job configuration layer. It cannot be inferred from pressure magnitude, material geometry, current global defaults or a new-job default.

BM4_NL retained authority resolves:

```text
setting: BOURDON_PRESSURE
resolved level: INDIVIDUAL_FILE_SETTING
value: TRANSLATION_AND_ROTATION
source: USER_VERIFIED_BM4_NL_EXISTING_JOB_SETTINGS_2026-08-09
```

This authorizes source-state custody only. It does not prove LFEA MEC-21 numerical parity.

## 2. Global bend pressure-stiffening configuration

Primary vendor source:

- Hexagon CAESAR II Users Guide — **Use Pressure Stiffening on Bends**
- https://docs.hexagonppm.com/r/en-US/CAESAR-II-Users-Guide/15/334978

Source semantics:

- the setting controls pressure stiffening for piping codes that do not explicitly require it;
- where this configuration applies, pressure is the maximum of all pressures defined for the element;
- `Default` delegates the decision to the active piping code;
- B31.1/B31.3 editions before 2020 used Appendix D; 2020+ editions remove Appendix D and B31J also defines pressure-stiffening effects.

Normalized LFEA source states:

```text
CAESAR raw DEFAULT -> DEFAULT_CODE
CAESAR explicit Yes/include -> INCLUDE
CAESAR explicit No/exclude -> EXCLUDE
```

`DEFAULT_CODE` is a first-class state. It must never be silently normalized to INCLUDE or EXCLUDE.

BM4_NL retained global authority:

```text
USE_PRESSURE_STIFFENING = DEFAULT
DEFAULT_CODE = B31.3_2022
```

Therefore effective pressure-stiffening mechanics require code-method arbitration in addition to the configuration record.

## 3. Per-load-case Elbow Stiffening Pressure

Primary vendor source:

- Hexagon CAESAR II Users Guide — **Elbow Stiffening Pressure**
- https://docs.hexagonppm.com/r/en-US/CAESAR-II-Users-Guide/Version-12/343522

This is a separate per-load-case setting used to determine pressure modifiers for elbow SIF and flexibility factor `k`.

Declared options:

```text
Pmax    maximum P1..P9
None    no elbow pressure stiffening
P1..P9  selected operating pressure
Phydro  hydrostatic pressure
```

Do not couple this selector mechanically to the global `Use Pressure Stiffening on Bends` configuration with an invented contradiction rule. They are distinct CAESAR settings with different scope and semantics.

BM4_NL L19/L20 configuration authority explicitly retains this setting as unresolved:

```text
setting: ELBOW_STIFFENING_PRESSURE
case: L19 / L20
status: UNRESOLVED
reason: CAESAR DEFAULT does not establish the load-case elbow pressure source; P1 is retained provisionally.
```

The provisional `linearSolve.bendPressureStiffening.pressureSource=P1` benchmark field is not promoted into source authority.

## 4. Existing repository configuration precedence

The reusable configuration authority already defines:

```text
OVERALL_GLOBAL_DEFAULT
  < INDIVIDUAL_FILE_SETTING
  < LOAD_CASE_SETTING
  < MODEL_INPUT
```

Source:

`src/core/fea-benchmarks/caesar-configuration-authority.js`

S5 reuses this resolver in qualification. It does not create a second pressure-specific precedence system.

For BM4_NL:

- global `BOURDON_PRESSURE=NONE` is superseded by individual-file `TRANSLATION_AND_ROTATION`;
- global `USE_PRESSURE_STIFFENING=DEFAULT` remains the resolved global configuration;
- active code resolves to `B31.3_2022`;
- L19/L20 `ELBOW_STIFFENING_PRESSURE` remains explicitly unresolved and the resolver must throw.

## 5. Numerical formulation boundary

The repository already contains MEC-21 bend pressure free-movement mathematics:

`src/core/linear-fea-piping-components/bourdon-pressure-expansion.js`

Its current ownership statement is important:

- bend-opening translation/rotation is calculated from one physical bend basis;
- uniform closed-end axial pressure strain is retained as separate evidence;
- the benchmark ACCDB path owns closed-end axial pressure strain on non-bend spans and MEC-21 opening/rotation on bend arcs;
- the bend path deliberately avoids silently adding the same axial term twice.

This is implementation evidence, not production qualification.

Before `pressureBourdon=true`, production must prove:

1. straight-span pressure elongation ownership exactly once;
2. bend opening/rotation sampled from one physical bend initial basis across all S2 chords;
3. mode behavior differs correctly between `TRANSLATION_ONLY` and `TRANSLATION_AND_ROTATION`;
4. source pressure used by each case is the governed case pressure;
5. displacements/reactions agree with independent CAESAR observations.

## 6. Bend pressure-stiffening numerical boundary

Before `pressureStiffening=true`, production must prove:

1. active code and B31/B31J edition authority;
2. resolved per-load-case `Elbow Stiffening Pressure` selector;
3. selected pressure maps to the actual source pressure state (`Pmax`, `P1..P9`, `Phydro`, or `None`);
4. pressure correction modifies the B31/B31J factor set exactly once;
5. S2 curved geometry + S3 local flexibility factor ownership remains free of double counting;
6. factor values and response quantities agree with independent CAESAR evidence.

## 7. Pressure/end thrust remains separate

`pressureAxialThrust` is **not** another name for Bourdon pipe elongation.

S5 source authority does not grant generic pressure/end-cap thrust. Expansion-joint/effective-area pressure thrust and any other closed-end force mechanism require their own geometry, effective area, sign/reference and source custody.

Until separately qualified:

```text
pressureAxialThrust = false
```

## 8. BM4_NL current source-state verdict

```text
Bourdon existing-job mode:
  RESOLVED = TRANSLATION_AND_ROTATION

Global bend pressure-stiffening configuration:
  RESOLVED = DEFAULT_CODE

Active piping code:
  RESOLVED = B31.3_2022

L19 elbow stiffening pressure selector:
  UNRESOLVED

L20 elbow stiffening pressure selector:
  UNRESOLVED

LFEA production Bourdon numerical authority:
  BLOCKED

LFEA production bend pressure-stiffening numerical authority:
  BLOCKED

LFEA generic pressure axial-thrust authority:
  BLOCKED
```

No source-state resolution above changes a production capability flag.
