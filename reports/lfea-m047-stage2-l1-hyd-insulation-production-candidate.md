# M047 Stage 2 — L1 hydrotest insulation production candidate

**Candidate:** implement CAESAR v14 `Include Insulation in Hydrotest = False` in the production ACCDB assembly, and change no other mechanic.

**Status:** candidate mechanics validated; **production promotion is not authorized**.

## Source / authority

- Pinned `BM4_L.ACCDB`: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8`, 5,136,384 bytes.
- Pinned ZIP: `978617cba50fa0b1a16c2fa71dc1e0d38e55ac834b191f887d100c6951abd8b9`, 582,488 bytes.
- Exact frozen linear-solver base blob used for the candidate patch: `d28e3c5e893cea3ae44e116daf18fcdca0d22107`.
- Locally patched candidate linear-solver blob: `06e1645cfd8a957f5a5ef787c159c0d8d9094508`.
- The exact intended source delta is committed separately as `patches/lfea-m047-stage2-l1-hyd-insulation-production.patch`.

The implementation calls the existing `resolveCaesarConfigurationLedger`, preserving declared precedence:

`OVERALL_GLOBAL_DEFAULT < INDIVIDUAL_FILE_SETTING < LOAD_CASE_SETTING < MODEL_INPUT`.

If `INCLUDE_INSULATION_IN_HYDROTEST` is undeclared at every layer, the documented CAESAR v14 default is `false`. A declared boolean override wins by the existing ledger; non-boolean values fail closed.

### Executed authority contract

Fresh local preparation against the pinned ACCDB produced:

| scenario | resolved level | value | total L1 gravity weight |
|---|---|:---:|---:|
| no declaration | `CAESAR_V14_DEFAULT` | false | 95,515.624630 N |
| L1 load-case override | `LOAD_CASE_SETTING` | true | 111,411.953099 N |
| model-input false over load-case true | `MODEL_INPUT` | false | 95,515.624630 N |

Thus higher authority overrides work and operating/non-HYD cases continue to include insulation.

## One-mechanic source scope

The staged patch changes only insulation contribution to **hydrotest gravity**:

1. ordinary pipe/bend/span line weight excludes insulation when HYD authority resolves false;
2. rigid physical-weight request receives zero insulation thickness/density only for that HYD condition;
3. reducer gravity request receives zero insulation thickness/density only for that HYD condition.

Unchanged: test-fluid density (1000 kg/m3), `HP -> HYDRO_PRESSURE`, D1 friction direction, coefficient of friction, friction stiffness, rigid/reducer fluid-density source, pressure/Bourdon/thermal mechanics, return map, hysteresis, acceleration, 800-iteration ceiling, load stepping, convergence limits, comparison tolerances and acceptance rules.

The rejected rigid/reducer WW density candidate is **not** included.

## Frozen controls — PASS

Real pinned-ACCDB before/after comparison for L2-L6/L14 is bit-identical in every governed control dimension: 6,360 rows per case, row semantic hash identical, execution semantic hash identical, and stiffness-state hash identical.

| case | row hash | execution hash | stiffness hash |
|---|---|---|---|
| L2 | `fnv1a64:68b4321c67d6f29e` | `fnv1a64:ae2360dbad0e6852` | `fnv1a64:45fdd6b1ae86b704` |
| L3 | `fnv1a64:e3fb239ceded6291` | `fnv1a64:7280b9bfbb352a17` | `fnv1a64:45fdd6b1ae86b704` |
| L4 | `fnv1a64:96bb7a651bf908ec` | `fnv1a64:4c2906ad03faf4ee` | `fnv1a64:45fdd6b1ae86b704` |
| L5 | `fnv1a64:bd42936828714096` | `fnv1a64:05f9901458b9c1a3` | `fnv1a64:45fdd6b1ae86b704` |
| L6 | `fnv1a64:7eed679d70c8a2ea` | `fnv1a64:343be28f318155d6` | `fnv1a64:45fdd6b1ae86b704` |
| L14 | `fnv1a64:e3fb239ceded6291` | `fnv1a64:852605311a85eb0b` | `fnv1a64:45fdd6b1ae86b704` |

Control artifact SHA-256: `27925f44ac727f819be51691e2166718e12997a16b0dc8e927e7e66adf97cfe1`.

## Fresh real L1 production-path result

The candidate was exercised through the normal ACCDB package and nonlinear solver path, **without mutating ACCDB input rows**.

Run 1:

- elapsed: 108,440 ms
- iterations: 186
- convergence: `CONVERGED`
- failed gates: none
- recovered equilibrium: `PASS`
- execution: `QUALIFIED`
- normals within ±10%: **22/23**
- worst normal error: **13.953465349988164%**
- tangential vectors within ±10%: **7/23**
- worst tangential vector relative error: **67.52802425901612**
- final rows: `fnv1a64:2e80e62c024d7f81`
- local artifact SHA-256: `bba0fce6c59f4fd2bf49d8539db4d2e164b90ccba1d7c4c454897aee2ffe0226`

Run 2:

- elapsed: 108,815 ms
- iterations: 186
- metrics: identical to run 1
- final rows: `fnv1a64:2e80e62c024d7f81`
- local artifact SHA-256: `9a5d2e1635f8e441793e15cc3ab3c34b86262a2a307afca924946fbf73255c9a`

**Determinism: PASS** (identical final-row semantic hashes and identical aggregate metrics).

The production-path final-row hash is exactly the same as the independently measured insulation discriminator (`fnv1a64:2e80e62c024d7f81`).

## Promotion boundary

This evidence nominates the source patch as the correct L1 HYD load-basis implementation, but it does **not** authorize Stage 2 production promotion:

- L1 tangential friction parity is still far outside the frozen ±10% goal (7/23; worst 67.528 relative error).
- After an execution-container recycle, the local L1 qualification used a numerical R2 friction reconstruction that reproduced the committed R2 L1 baseline aggregate exactly, but its source-text Git blob was not re-established as the exact frozen `5b3ba1ce...` blob. Exact branch-source qualification must therefore be repeated after the staged patch is applied to the repository source.
- No tolerance, comparison rule or acceptance criterion may be moved to absorb the remaining friction error.

`productionPromotionAuthorized: false`.
