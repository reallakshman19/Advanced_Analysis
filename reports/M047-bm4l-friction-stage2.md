# M047 Stage 2 — BM4_L friction qualification implementation

Issue: #1083

Baseline: `0855afb22b76c4b7657a81641c7fbaa890474cd7` (PR #1046 exact head)

## Scope

Stage 2 adds the governed static dry-friction path for BM4_L while leaving the qualified `src/core/fea-benchmarks/caesar-accdb-linear-solve.js` unchanged. In scope are restraint reactions, translations/rotations, all global element-end actions, physical nodal equilibrium, friction-state evidence, L13/L7/L1 primitive friction cases, and algebraic L15. Stress, EXP/HYD stress, lift-off, one-directional contact, gaps, and other nonlinear mechanics remain out of scope.

## Configuration authority

The configuration resolver, schema, and BM4_L profile use the issue-governed low-to-high precedence:

`OVERALL_GLOBAL_DEFAULT < INDIVIDUAL_FILE_SETTING < LOAD_CASE_SETTING < MODEL_INPUT`

Model `COEFFICIENT_OF_FRICTION_MU = 0.3` remains the highest-authority coefficient. Load-case `FRICTION_MULTIPLIER` is separate:

- L2-L6 = 0;
- L7/L13/L1 = 1;
- L14/L15 = derived, no independent multiplier.

Effective friction is `model mu * load-case multiplier`. `FRICT_STIF = 1.0E6 N/cm` is converted explicitly to `1.0E8 N/m`.

## Frozen-mechanics boundary

`caesar-accdb-linear-solve-governed.js` is a governance/compatibility adapter around the frozen solver. It permits the frozen path only when governed effective friction is zero and preserves the real model coefficient/multiplier in evidence.

`caesar-accdb-friction-solve.js` reconstructs the qualified stiffness/load state from frozen recovery evidence and adds only the friction terms. No bend, tee/B31J, reducer, rigid, Bourdon, pressure-stiffening, thermal-strain, finite-restraint, or global-recovery calibration is introduced.

## Friction mechanics

Friction state is owned **per ACCDB directional restraint row**, not per node. Each support retains its signed normal direction. Signed normal reaction is projected onto that direction; Coulomb capacity is `mu * abs(N)`.

The active set uses:

- deterministic all-stick initialization;
- sticking tangential spring `k_f`;
- slide when the trial tangential resultant exceeds the declared cap boundary;
- sliding capped force opposite slip on the next iteration;
- no relaxation and one load step;
- versioned implementation tolerances that are not claimed as CAESAR authority.

A pre-solve topology gate rejects duplicate anchors, anchor-plus-directional overlap, duplicate directional restraint DOFs, zero/nonfinite normals, and skew normals instead of silently merging or double-counting contacts.

## Unit-safe convergence and reconstruction

The nonlinear convergence gate does not mix incompatible units:

- displacement update uses translational DOFs only and is reported in metres;
- reaction update uses translational force DOFs only and is reported in newtons;
- force and moment equations in frozen-system reconstruction are normalized separately before taking a dimensionless maximum;
- stiffness-sensitivity reaction changes report force and moment ratios separately.

Declared absolute and relative update tolerances are combined as actual acceptance limits. Friction force scale floor and direction-cosine tolerance live in the versioned solver profile rather than as hidden literals.

Repeated nominal runs must produce identical semantic fingerprints. The 0.5x and 2x friction-stiffness runs are **diagnostic only**: a diagnostic non-convergence is retained in evidence and cannot invalidate an otherwise converged nominal 1x result.

## Governed case execution

The public friction boundary enforces this order:

1. L13 = `W+P1`, nonlinear primitive, paired with L6;
2. L7 = `W+T1+P1`, nonlinear primitive, paired with L5;
3. L15 = `L7-L13`, algebraic result construction outside the nonlinear kernel;
4. L1 = `WW+HP`, final independent nonlinear primitive.

### L15

L15 is never passed to the nonlinear kernel. Before subtraction, its friction authority must resolve as algebraic with dependencies exactly L7 and L13, and both dependencies must share one finite, positive governed effective coefficient. No hard-coded value is used for that equality gate.

L15 hard acceptance requires:

- no independent nonlinear solve;
- exact row-wise `L7-L13` identity;
- zero algebraic identity deviation.

Derived L15 equilibrium is calculated and reported, but it is **report-only**. Primitive L13/L7/L1 equilibrium remains the nonlinear acceptance gate, matching the issue acceptance policy for a cancellation-sensitive derived range.

The `L15-L14` paired delta is rebuilt from the governed L15 result and frozen governed L14 control.

### L1 hydrotest

The public entrypoint fails closed unless source L1 remains exact `HYD / WW+HP`. Its pre-solve authority explicitly records:

- `WW`: pipe plus water-filled weight;
- water density: 1000 kg/m3 (`0.001 kg/cm3` in the ACCDB density convention);
- insulation excluded from HYD weight;
- `HP`: hydrostatic test pressure bound to ACCDB `HYDRO_PRESSURE`;
- frozen assembly primitive: temporary `W+P1` with `HYDRO_PRESSURE -> PRESSURE1`;
- zero friction applied only to the internal counterfactual base construction.

Stored ACCDB L1 CAESAR output remains the benchmark reference. The counterfactual base is assembly input only, not reference authority.

## Comparison/RCA

The Stage 2 command reports:

- `L13-L6` sustained friction;
- `L7-L5` operating friction;
- `L15-L14` friction contribution to expansion range.

Delta construction uses the union of row identities and fails on incomplete operands, so a nodal or source-element family cannot be silently dropped. Literal components, coordinate-invariant vectors, global source-element actions, physical equilibrium, nonlinear state residuals, repeatability, and sensitivity remain separate evidence layers.

## Comparison-driven technical repairs

Static comparison against the frozen solver/reference contracts found and repaired these blockers before any parity claim:

1. nodal FORCE/MOMENT identity restored to `UX/UY/UZ`, `RX/RY/RZ`;
2. L15 equilibrium false-pass on nonexistent nodal `FX/MX` keys removed;
3. declared absolute update tolerances made real acceptance gates;
4. signed normal reaction projected onto declared restraint direction;
5. coordinate-invariant nodal vectors corrected to DOF-labelled components;
6. CAESAR reference-equilibrium evidence propagated into engineering assessment;
7. restraint-topology preflight added with per-row friction state ownership;
8. resolved configuration corrected to canonical `caseClass`;
9. displacement/reaction convergence metrics separated by physical units;
10. sensitivity force/moment reaction changes separated;
11. base reconstruction force/moment residuals normalized separately;
12. non-nominal sensitivity failures made diagnostic-only;
13. raw L13/L7 result rows relabelled to their own case IDs instead of control IDs;
14. hidden friction gate thresholds moved into the solver profile;
15. strict governed L1 `HYD / WW+HP` authority added before assembly;
16. L15 moved outside the nonlinear kernel with primitive-only equilibrium hard gates;
17. L15 requires one common positive governed friction state across L7/L13 before subtraction.

## Portable ACCDB extraction — no ACE, no Actions

The production harness uses `reallaksh19/XML_Compare_Utilities` instead of Microsoft ACE/COM:

- XML Compare Utilities commit `d83c62214b7a6486c17698225ea4e11bc3121cb6`;
- `parser/accdb-mdb.js` Git blob `2ea596b6e9fb65e386e5cbb256f4141ce7bb595b`;
- API `readAccdbNamedTables()`;
- local runtime `mdb-reader@2.2.6`;
- official upstream tag `v2.2.6`, commit `720c8da1ef779b332cc5c4df559489cf45fe60bc`.

The harness installs the runtime from the public npm registry. The extraction adapter resolves `mdb-reader` **from the XML parser file's own module location before opening the ACCDB**, verifies `mdb-reader@2.2.6` and the upstream repository identity, records the resolved local entrypoint, and fails if it resolves outside `XML_Compare_Utilities/node_modules/mdb-reader`. This prevents the XML parser's CDN fallback from being used for qualification.

No GitHub Actions qualification workflow is part of this path.

## Immutable BM4_L custody

- Common commit `f4d49f2a47d970ae0abf913b537193e324556177`;
- ZIP Git blob `df119ae1b8272469b6204036ab1aff21e561dfb8`;
- ZIP SHA-256 `978617cba50fa0b1a16c2fa71dc1e0d38e55ac834b191f887d100c6951abd8b9`;
- `BM4_L.ACCDB`: 5,136,384 bytes, SHA-256 `e21b0862851ea2bb6f20d55e4a3a94f501537b618b98dd46afa9f6777ee38d3c`;
- load-case report Git blob `be62eeb08af26dddcd59146e21188c108c4600dd`;
- miscellaneous report Git blob `ef23d224925e4568185a360ecbe1ee62503f15ff`.

The obsolete Stage 1 ACCDB member hash is not an alternative Stage 2 authority.

## Local production command

```powershell
pwsh ./scripts/lfea-m047-bm4l-friction-production.ps1 `
  -ExpectedHead (git rev-parse HEAD) `
  -XmlCompareUtilitiesPath ../XML_Compare_Utilities
```

The harness checks exact head/clean worktree, Node 22, immutable source custody, extractor/runtime custody, configuration and source contracts, frozen controls, nonlinear primitive gates, L15 algebraic policy, determinism, literal restraint acceptance, and artifact hashes. The receipt also surfaces hydro authority, restraint state scope/count, L15 derived-equilibrium status, and diagnostic sensitivity failures.

## Current verification status

At head `a5c51325c39bb8087317ea78732788ed9399d67c`, the branch is 44 commits ahead of exact #1046 head and 0 behind; merge base is exactly `0855afb22b76c4b7657a81641c7fbaa890474cd7`. The frozen `caesar-accdb-linear-solve.js` remains absent from the changed-file set. Intended repair commits use `[skip ci]` and the checked commits have no associated workflow runs.

The pinned BM4_L binary still cannot be materialized into the current ChatGPT execution container through the available connector, so this session has **not** produced or claimed numerical CAESAR II friction parity. The next acceptance step is the local pinned-data command above and review of the resulting custody, resolved configuration, topology, literal/vector/equilibrium, active-set, paired-delta, repeatability, sensitivity, and receipt evidence.
