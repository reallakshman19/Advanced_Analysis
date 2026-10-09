# S5 pressure/Bourdon parity evidence package

## Purpose

This document defines file-level custody for controlled CAESAR S5 observations.

It does **not** authorize production pressure mechanics. Accepted evidence remains `QUALIFIED_PARITY_EVIDENCE_ONLY`; `pressureBourdon`, `pressureStiffening` and `pressureAxialThrust` remain false until separate production-integration authority exists.

## Create a fail-closed package scaffold

Generate a new package instead of hand-authoring the run inventory:

```text
node scripts/lfea-s5-pressure-parity-evidence-template.mjs BOURDON_ONLY /path/to/new-s5-bourdon-package
node scripts/lfea-s5-pressure-parity-evidence-template.mjs PRESSURE_STIFFENING_ONLY /path/to/new-s5-stiffening-package
node scripts/lfea-s5-pressure-parity-evidence-template.mjs BOURDON_AND_PRESSURE_STIFFENING /path/to/new-s5-combined-package
```

The generator creates only the run families required by the selected scope, plus raw-artifact directories and a package `README.txt`.

The generated `evidence.json` is intentionally **not evidence**. It contains fail-closed placeholders such as:

```text
status = DRAFT_NOT_QUALIFIED
observationTolerance = null
hashes = REPLACE_WITH_SHA256
reported results/factors = unresolved placeholders
independent review = PENDING
```

For Bourdon scopes, Q3 begins with `samePhysicalInitialBasis=false`; it must only be changed to true after the 4/6/8-chord evidence actually demonstrates one physical initial basis. For pressure-stiffening scopes, selector/factor/arbitration acceptance booleans begin false.

For Q5, the scaffold deliberately sets `elbowStiffeningPressureSelector=P1` for all three `Default / Include / Exclude` runs. This is a controlled experiment condition so the global pressure-stiffening switch remains discriminating. It is **not** authority for BM4_NL L19/L20, whose actual selector remains unresolved.

The scaffold refuses to overwrite an existing directory. Never modify it to emit a qualified status or production authorization.

## Package root

Store `evidence.json` and all raw CAESAR files under one dedicated directory. Every path in `run.rawArtifacts` must be relative to the evidence JSON directory.

Generated layout begins as:

```text
s5-pressure-parity/
  evidence.json
  README.txt
  raw/
    Q1_STRAIGHT_BOURDON_NONE/
      job-file.bin
      input-source.bin
      output-file.bin
    Q1_STRAIGHT_BOURDON_TRANSLATION/
      ...
    ...
```

The `.bin` names are placeholders for custody locations, not required CAESAR extensions. Replace them with the actual retained file names and update `rawArtifacts` accordingly.

Absolute paths, drive-qualified paths, `.`/`..` traversal, missing files, symbolic links and files resolving outside the package root are rejected.

## Per-run raw artifact binding

Every retained run must contain:

```json
{
  "jobFileHash": "<sha256>",
  "inputSourceHash": "<sha256>",
  "outputFileHash": "<sha256>",
  "rawArtifacts": {
    "jobFile": "raw/<family>/job.caesar",
    "inputSource": "raw/<family>/input.accdb",
    "outputFile": "raw/<family>/output.out"
  }
}
```

Hashes are lowercase SHA-256 values. The file-level intake recomputes each hash against the retained bytes.

## Validation command

```text
node scripts/lfea-s5-pressure-parity-evidence-file-check.mjs /path/to/s5-pressure-parity/evidence.json
```

The command first validates the mechanism-scoped engineering contract and then verifies every raw artifact path/hash.

The generated scaffold **must fail** this command until the controlled observations, predeclared tolerance, hashes, comparisons and independent review are complete.

A successful completed-package intake still reports:

```text
status = QUALIFIED_PARITY_EVIDENCE_ONLY
rawArtifactHashesVerified = true
productionUseAuthorized = false
pressureBourdonAuthorized = false
pressureStiffeningAuthorized = false
pressureAxialThrustAuthorized = false
```

## Allowed qualification scopes

The package must declare exactly one scope:

```text
BOURDON_ONLY
PRESSURE_STIFFENING_ONLY
BOURDON_AND_PRESSURE_STIFFENING
```

### Bourdon-only raw cases

- `Q1_STRAIGHT_BOURDON_NONE`
- `Q1_STRAIGHT_BOURDON_TRANSLATION`
- `Q1_STRAIGHT_BOURDON_TRANSLATION_ROTATION`
- `Q2_BEND_BOURDON_NONE`
- `Q2_BEND_BOURDON_TRANSLATION`
- `Q2_BEND_BOURDON_TRANSLATION_ROTATION`
- `Q6_PRESSURE_THRUST_NEGATIVE_CONTROL`

The Q1 and Q2 groups must preserve all non-switched control state. Q6 must retain Bourdon Translation-only with both generic pressure thrust and effective-area force explicitly absent.

### Pressure-stiffening-only raw cases

- `Q4_SELECTOR_NONE`
- `Q4_SELECTOR_P1`
- `Q4_SELECTOR_P2`
- `Q4_SELECTOR_PMAX`
- `Q5_GLOBAL_DEFAULT_B313`
- `Q5_GLOBAL_INCLUDE_B313`
- `Q5_GLOBAL_EXCLUDE_B313`

For Q4, keep Bourdon disabled and preserve all non-selector control state. Use deliberately different positive P1/P2 values so `None / P1 / P2 / Pmax` can prove selector behavior, exactly-once factor ownership and retained curved centerline geometry.

For Q5, keep Bourdon disabled and hold these fields identical across the three global-mode cases:

```text
activePipingCode = B31.3_2022
elbowStiffeningPressureSelector = P1
pressureFields.P1 = same positive controlled value
material / section / bend geometry / restraints / mechanical load = unchanged
```

Only `usePressureStiffeningOnBends` may vary as `DEFAULT / INCLUDE / EXCLUDE`. A Q5 record using selector `NONE` is rejected because it removes elbow pressure stiffening and cannot establish global-mode arbitration. Selector drift away from P1 is also rejected.

The controlled Q5 P1 setting does **not** resolve or infer the unresolved BM4_NL L19/L20 `Elbow Stiffening Pressure` selector. A future BM4_NL production authority still requires the actual retained source setting.

## Q3 subdivision evidence

Q3 is an LFEA formulation invariant and is recorded in the evidence JSON rather than as additional CAESAR run families:

```text
chordCounts = [4,6,8]
samePhysicalInitialBasis = true
terminalFreeStateNormalizedDelta <= observationTolerance
```

It does not replace controlled CAESAR Q2 parity.

## Evidence custody rule

Do not delete raw CAESAR files after extracting reported values. The JSON is derivative evidence; the retained job/input/output bytes, their recomputed SHA-256 values and report locators are the source custody.

Contract fixtures and generated scaffolds are not CAESAR evidence and must never be substituted for controlled external runs.
