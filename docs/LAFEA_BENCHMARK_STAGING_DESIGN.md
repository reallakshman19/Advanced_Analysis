# Staged benchmark design — common mesh (LAFEA.3 + LAFEA.4) and LAFEA.3 solver

**Status:** design proposal. No calculation kernel, mesher, solver or governed-authority
behaviour is changed by this document.

**Method.** Read the meshing/solver/benchmark source, ran the existing suites on a clean tree
at `b4eb0ce`, and drove the Empirical tab in headless Chromium (Vite dev server, 1600×1000)
rather than inferring behaviour from markup. Every number below is measured, not estimated.

---

## Part 1 — Walking the EMP tab as a user

The `Empirical` tab (`data-application-nav="EMPIRICAL"`) is `LafeaWorkbenchController` mounted a
second time in `presentationMode: 'ANALYTICAL_CALC'` (`src/workspace/bootstrap.js:178`), showing
only the EMP.1 analytical route: A (load/reference transfer), B (pipe-section screening),
C (governed WRC 537 local correlation). No FE mesh is created in this tab.

### 1.1 What the walkthrough measured

| State | Content height | Screens of scroll | Inputs | Tables |
|---|---|---|---|---|
| Clean load | 6,754 px | 7.1 | 4 | 9 |
| After `[SIMULATED] Load complete EMP.1 qualification sample` | 6,894 px | 7.2 | 4 | 9 |
| After demo source + all disclosures expanded | 10,923 px | 11.4 | 59 | 15 |

The tab scrolls inside a nested container (client height 958 px), not the document, so the
browser's own scrollbar gives no clue how much page is left.

### 1.2 Findings

Several items from `EMP_TAB_UI_RECOMMENDATIONS.md` have genuinely landed and should not be
re-opened: the toolbar is grouped Source / Run / Evidence; the reference-point and load-case
tables render one row per identity with X/Y/Z columns; the JSON path is demoted to a small muted
truncated line; and `human()` in `emp1-professional-workflow-view.js:274` now routes through
`emp1PlainLanguageLabel`. What follows is what a user still hits.

**U1 — The flagship "show me a working example" button still does not work.**
`[SIMULATED] Load complete EMP.1 qualification sample` — second button in the toolbar — still
fails on a clean tab with `EMP1_A_CURRENT_QUALIFIED_RESULT_REQUIRED`, because the sample does not
run A before attempting C. The *presentation* half of §4.1 landed (a red panel now appears under
the toolbar reading "The last EMP.1 transaction did not complete / Step A must produce a current
qualified result before step C can run"). The *sequencing* half did not. Readiness stays "Input
required" on all seven dimensions and the page grows by 140 px of error text. A new user's first
click still teaches them the tool is broken.

**U2 — Status pills are hard-coded green regardless of state.**
`lafea-result-highlights__status` is defined once, with no `data-status` variant
(`src/workspace/lafea-workbench-styles.js:57`): `border:1px solid #16835f; color:#86efac`.
So these all render green:

- `Overall · Input required` (`emp1-professional-workflow-view.js:124`)
- `Review state · NOT REVIEWED` (`emp1-engineering-review-view.js:15`)
- `EMP.1.C: SOURCE INCOMPLETE` (`emp1-workbench-run-state.js:238`)

Green is the one colour a reader will interpret without reading. Every one of those states is
blocked. Sampling computed styles across the tab, essentially every other status string —
`Authorization: READY`, `Release: NOT QUALIFIED`, `Not established`, `Not ready`, `Not assessed` —
renders in the same `rgb(229,238,251)` body colour, so status carries **no** visual encoding at
all except this one misleading green.

This is the §4.2 story repeating in colour instead of text: the codebase already has the right
pattern two files away — `.lafea-workbench__status[data-status="QUALIFIED"|"FAILED"]` and
`.lafea-guided-workflow__state[data-tone="positive"|"warning"|"critical"]`.

**U3 — The label registry stops exactly where the benchmark surface starts.**
`emp1-plain-language-labels.js` has 85 entries and is used by
`emp1-professional-workflow-view.js` (4×) and `emp1-engineering-evidence-view.js` (2×). It is used
**zero** times by `emp1-benchmark-view.js`, `emp1-benchmark-evidence-workspace.js` and
`emp1-engineering-review-view.js`. Those three render the raw enum straight to screen:

```
INDEPENDENT_BENCHMARK_REFERENCE_NOT_WRC_METHOD_AUTHORITY
PASS_FINAL_CAUX_SOURCE_QUALIFICATION_GAMMA_RADIUS_RECONCILED_REFERENCE_FREEZE_PRESERVED
RETAINED_ACTUAL_EXECUTION_COMPARISON      NOT_RUN_EXECUTION_ENVIRONMENT
OUTSIDE_AUTHORIZED_ENGINEERING_ROUTE      REQUIRED_FROM_RETAINED_SOURCE
SOURCE_NOT_RETAINED                       EMP1 ENGINEERING REVIEW CURRENT EXECUTION REQUIRED
```

68 distinct SHOUTING_CODE strings were collected from one rendered pass. This matters directly to
the benchmark work below: **the benchmark panel is the single worst offender for machine codes
reaching a human engineer**, and it is the panel any new benchmark will be rendered through.

**U4 — Pressure entry is five policy enums wearing the same label.**
The pressure group renders ten rows: `Internal pressure` × {P-CLOSED, P-EXPLICIT, P-EXTERNAL,
P-OPEN, P-UNSPECIFIED} and `External pressure` × the same five. The identity under each label is
a policy code, and nothing on screen says which one the run will actually consume. An engineer
transcribing from a datasheet has to guess.

**U5 — Every editable group has its own `Apply … changes` button.**
`Apply Pressure changes`, `Apply Load cases changes`, and so on down the page, with no dirty-state
marker and no single commit. Editing across groups means finding and pressing each Apply, and
there is no indication which groups still hold uncommitted edits.

**U6 — Six of nine toolbar buttons are disabled on arrival**, and the toolbar buttons carry no
class at all (`className === ""`), so enabled/disabled is the only differentiation and there is no
primary action. The only non-simulated actions a fresh user can press are `Import EMP.1.A source
JSON` and `Verify EMP.1.A`.

### 1.3 What the tab already gets right — and why it matters for benchmarks

The **Benchmark Evidence** panel is the best benchmark presentation in the repository. It renders
the CAUx 2017 comparison as: per-point reference value, computed value, absolute difference,
relative difference, tolerance, and status; then a summary of compared quantities, worst relative
difference (`2.0355862 % · Cu`), worst absolute difference, governing reference point and whether
the governing points agree; then the frozen source PDF SHA-256 and an explicit authority boundary
("Independent reference evidence — not WRC method authority. Does not establish code compliance,
production authorization, or release qualification.").

That is exactly the shape both benchmarks designed below should be reported in. It also shows the
tab already has an in-page benchmark run surface (`fea-benchmark-run`, `fea-benchmark-download`).
The integration work is not "build a benchmark UI" — it is "route two new evidence records through
the panel that already exists", plus fix U3 so it stops shouting codes.

---

## Part 2 — Why a staged benchmark is needed, in this repo, today

The repository is not short of checks. `scripts/` holds 1,586 files; `check:lafea-core` chains 40
of them; `check:lafea-meshing` chains 12. What is missing is *staging, retention and coverage of
the production path*. Four measured facts:

**F1 — The mesh producer's own governance gate is red on `main`.**
`lafea-mesh-producer-registry.js` declares `LAFEA_MESH_PRODUCER_GOVERNANCE_REF =
'npm run check:lafea-meshing'`. That command fails:

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  actual:   'block 1'
  expected: 'blockingThreshold=1'
  at scripts/lafea.10-mesh-quality-panel-check.mjs:90:8
```

It is script 9 of 12 in a single `&&` chain, so mesh smoothing, mesh determinism and mesh producer
binding — steps 10, 11, 12 — **never execute**. The file is byte-identical to `origin/main`, so
this is pre-existing, not introduced by any branch in flight. A qualification whose declared
governance reference does not pass is not a qualification.

**F2 — The bound mesh producer is never meshed into a solver.**
`generateLafeaAnalysisMesh` (`src/workspace/lafea-mesh-producer-engine.js`) — "the single place
where the qualified core mesher is executed for the LAFEA workbench" — is imported by exactly two
scripts, `lafea-mesh-dof-policy-check.mjs` and `lafea-mesh-producer-binding-check.mjs`, and neither
solves the mesh it produces. Only three scripts in the repository go mesh → solver end to end, and
all three take the **shell** path (`lafea-shell-mesh-producer.js` → `calculateLocalShell`):
`lafea-tech4-curved-hole-convergence-check.mjs`, `lafea-shell-compiled-execution-check.mjs`,
`lafea-tech13e-product-refinement-numerical-check.mjs`.

There is **no** end-to-end coverage from the bound producer to `calculateLocalContinuum`. LAFEA.3
is the stage whose own registry entry admits "Production geometry-to-mesh-to-convergence
orchestration is not complete", and that is exactly the untested seam.

**F3 — The solver benchmarks run on meshes production never makes.**
`lafea.3-benchmark-cont-{patch,cyl,hole}-01-check.mjs` mesh through
`scripts/lafea.3-benchmark-mesh-adapter.mjs`, described in its own header as "benchmark-only glue
… not part of either kernel's public surface". Even the flagship staged case B01 authors its
meshes with `validation/lafea-benchmark-data/B01/mesh-generator.py`. The physics is checked
against meshes that no user will ever be given.

**F4 — Nothing is retained.** The three LAFEA.3 benchmarks pass right now with real numbers:

```
CONT-CYL-01  error by level:            5.203% -> 1.871% -> 0.585%
CONT-HOLE-01 hole-edge Kt by level:     2.8755 -> 2.9116 -> 2.9327   (Kirsch: 3)
CONT-HOLE-01 full-field error by level: 13.761% -> 6.218% -> 3.606%
```

Those numbers are `console.log` and nothing else. There is no artifact, no history, no trend, no
hash binding. `reports/qualification/lafea-benchmark-program/` is **empty** — the audited program
runner has never produced a record, even though case B01's three methods all pass today
(verified: `lafea-bucket-01-t3-patch-check`, `lafea.3-t6-patch-check`, `lafea.3-q8-patch-check`).

### 2.1 What already exists and must be reused, not reinvented

- `validation/lafea-benchmark-program/program.json` — a staged program with
  `SEQUENTIAL_CASE_THEN_METHOD`, `advanceOnlyAfterCurrentCasePass`, `trackedCleanTreeRequired`,
  a `cases[]` array (only B01 is `READY`) and a `futureQueue` of B02…B06.
- `scripts/run-lafea-benchmark-program.mjs` + `scripts/lib/lafea-benchmark-audit.mjs` — the audited
  runner producing `lafea-benchmark-audit-record/v1` with head SHA, clean-tree assertion,
  per-method stdout/stderr hashes and a record hash.
- `validation/lafea-benchmark-data/B01/` — the artifact layout to copy: `bucket-manifest.json`,
  `sources/source-registry.json` (path + blob SHA per file under test), `oracle/cases.json`,
  `oracle/expected-values.json`, `oracle/independent-oracle.py`, `convergence/mesh-ladders.json`,
  `convergence/fixed-probes.json`, `governance/negative-cases.json`, `governance/fem-semantics.json`.
- `src/core/lafea-meshing/quality-gates.js` and `mesh-convergence-framework.js` — the gate table
  and the six accepted `CONVERGENCE_QUANTITIES` with default limits, plus
  `rejectRawSingularPeakAsConvergenceQuantity` and `requireSufficientMeshLevels` (≥3 levels).

Everything below is assembly of these parts. No new framework is proposed.

---

## Part 3 — Benchmark A: common analysis mesh, LAFEA.3 + LAFEA.4

**ID:** `BM-MESH`   **Stages:** LAFEA.3 and LAFEA.4 in one suite.

### 3.1 Why one suite can serve both stages

LAFEA.3 and LAFEA.4 do not share a mesh *generator*, but they do share the entire mesh *contract*:
the same registry (`lafea-mesh-producer-registry.js`, producer ref
`LAFEA_CORE_MESHER/LAFEA.10.T6Q8.SHELL.POLAR.V10/LAFEA-MESH-Q1`), the same repeatability policy
`BYTE_IDENTICAL_CANONICAL_MESH_V1`, the same quality policy
`LAFEA_MESH_PROFILE_QUALITY_GATES_V1`, the same canonical mesh content
(`lafea-analysis-mesh/v1`), the same DOF policy, the same resource ceilings (200k nodes /
100k elements / 400k DOF), and the same convergence framework. The benchmark asserts the contract
once and parameterises the gate thresholds per stage.

Bound scopes under test, taken from the registry rather than assumed:

| Stage | Element families | Local refinement |
|---|---|---|
| LAFEA.3 | `T3`, `T6`, `Q8` | `T3`, `T6` |
| LAFEA.4 | `CST_DKT_TRI3_THIN_SHELL_V1` | none |
| LAFEA.5 | `CST_DKT_TRI3_THIN_SHELL_V1` | none (in scope for a later stage, not M0–M4) |

### 3.2 The ladder

Each stage is a gate: the runner does not advance until the current stage passes, and each stage
emits its own record so a failure at M3 does not hide M4.

**M0 — Producer conformance (no physics).**
For every bound `(stageId, elementFamily)` pair, generate a mesh from a frozen geometry and assert:
canonical output validates as `lafea-analysis-mesh/v1`; node/element/DOF counts agree with
`estimateLafeaMeshDofs`; a request above the ceilings returns a `BLOCK` resource disposition and is
never silently truncated; an unbound family is refused. *Evidence:* mesh semantic hash, counts, DOF.

**M1 — Determinism and repeatability.**
Promote `BYTE_IDENTICAL_CANONICAL_MESH_V1` from a declared policy to a measured one. Same geometry
and profile meshed (a) twice in-process, (b) twice in separate Node processes, (c) once with the
input collections shuffled — all three must yield the identical canonical mesh hash.
`scripts/lafea.10-determinism-check.mjs` already does exactly this for `triangulateRegion`; the
work is extending the same cross-process pattern to the **bound producer** (this is one of the
three steps F1 currently prevents from ever running).

**M2 — Geometry fidelity (closed-form oracle, no solver).**
Quantities the mesher must reproduce independently of discretisation:

| Case | Oracle | Quantity |
|---|---|---|
| Unit square | exact | meshed area == analytic area |
| L-shape (re-entrant) | exact | meshed area; no element spans the corner |
| Annulus sector | exact | area; max chordal deviation of boundary nodes from the true arc |
| Square with circular hole | Green's theorem | net area; hole-edge segment count |
| Two-patch planar shell | exact | per-patch area; conforming seam, no duplicated seam nodes |

Chordal deviation is checked against the declared `curvatureToleranceDegrees`; segment counts
against `qualifyBoundarySegmentCount` (≥16 production, ≥24 for code SCL regions).

**M3 — Quality-gate ladder.**
Run `quality-gates.js` over every produced element at three refinement levels and retain the
*distribution* (min / median / worst), not just the aggregate status: aspect ratio (warn 3,
block 10), minimum angle (warn 25°, block 10°), scaled Jacobian (warn 0.5, block 0.2, always BLOCK
when non-positive), plus warpage (warn 5°, block 15°) and the 0.5t–2t size-to-thickness band for
LAFEA.4. Pass criteria: no `BLOCK` at the production level, and the worst-case metric improves or
holds with refinement. **The currently-red `lafea.10-mesh-quality-panel-check.mjs` becomes a gated
stage here instead of link 9 of an `&&` chain.**

**M4 — Mesh-driven convergence (the common handoff).**
The only stage that touches a solver, and only to prove the ladder is usable. Feed the M0 ladder
into `calculateLocalContinuum` (LAFEA.3) and `calculateLocalShell` (LAFEA.4) and record histories
for the accepted `CONVERGENCE_QUANTITIES` through `qualifyConvergenceSet`. Pass = ≥3 levels
(`requireSufficientMeshLevels`), `MONOTONIC`, within the per-quantity default limits
(strain energy 2%, selected displacement 1%, reaction equilibrium 0.5%, SCL membrane 3%,
SCL membrane+bending 3%, weld structural 5%). Probes are physical coordinates, never node IDs.
Raw peak stress is refused by `rejectRawSingularPeakAsConvergenceQuantity` and must stay refused.

**M4 closes F2** — it is the first end-to-end `generateLafeaAnalysisMesh → calculateLocalContinuum`
path in the repository.

### 3.3 Artifacts

```
validation/lafea-benchmark-data/MESH/
  bucket-manifest.json             schema lafea-mesh-bucket-manifest/v1
  sources/source-registry.json     path + blobSha for every producer, gate and policy file
  geometry/cases.json              frozen topologies (square, L-shape, annulus, holed square, 2-patch)
  oracle/expected-values.json      analytic areas, chordal bounds, segment counts — each cited
  convergence/mesh-ladders.json    per stage x family levels, refinement ratio
  convergence/fixed-probes.json    physical-coordinate probes
  governance/negative-cases.json   over-ceiling, unbound family, non-4-sided mapped Q8, seam mismatch
```

Runner `scripts/lafea-mesh-benchmark-run.mjs --stage M0..M4`, emitting
`reports/qualification/lafea-mesh-benchmark/<runId>/audit-record.json` in the existing
`lafea-benchmark-audit-record/v1` shape. Registered as case `BM-MESH` in
`validation/lafea-benchmark-program/program.json`.

**Sequencing note.** F1 blocks M3 and M1. Fixing
`lafea.10-mesh-quality-panel-check.mjs:90` is the first task of this benchmark, not a prerequisite
filed elsewhere.

---

## Part 4 — Benchmark B: LAFEA.3 solver

**ID:** `BM-S` — proposed as program case **B02**, which already sits in the program's
`futureQueue` as *"2D continuum engineering response — bending, shear, hole and lug progression"*
with `activation: AFTER_B01_PASS`.

### 4.1 Scope boundary against existing issues

- **#1569** owns the *rigor and report requirements* for BM-005/BM-006 — oracle citation shape,
  Richardson/GCI, asymptotic-range checking, audit hash. This benchmark **consumes** that schema;
  it does not redefine it.
- **#1535** owns the ordinary production geometry→mesh→convergence route.
- **BM-MESH** (Part 3) owns everything upstream of the solver's input mesh.

What is left, and what this benchmark owns: **the solver and element numerical layer as a staged,
retained-evidence ladder** — the thing that today exists as 28 `lafea.3-*` scripts chained by `&&`,
asserting inline and printing to stdout.

### 4.2 The ladder

**S0 — Element and patch (green today; formalise).**
T3/T6/Q8 constant-strain completeness, rigid-body modes, Jacobian positivity. This *is* program
case B01, and all three of its methods pass on the current head. Stage 0's deliverable is therefore
not new physics — it is **B01 with a retained audit record**, because
`reports/qualification/lafea-benchmark-program/` is empty and the runner has never been exercised.

**S1 — Closed-form fields.**
CONT-CYL-01 (Lamé thick cylinder) and CONT-HOLE-01 (Kirsch plate with hole). Both pass today with
the numbers quoted in F4. The work is: lift the inline `expected` values and magic tolerances
(`< 0.05`) out of the scripts into `oracle/expected-values.json` with full citation, and emit the
per-level results as JSON so the history in F4 stops evaporating.

**S2 — Load-path completeness.**
One case per load type against an independent closed form: edge traction, pressure, body force,
temperature strain, imposed displacement. The five `lafea.3-loads-*-check.mjs` scripts exist but
assert contract shape, not field accuracy.

**S3 — Solver numerics.**
Equilibrium residual against `freeDofTolerance`; reaction sum against applied load; energy balance
(external work == 2 × strain energy); conditioning and pivot evidence from
`solverEvidence.pivots`; scaling reversibility; superposition (L2 == −0.5 · L1 — asserted today in
`lafea.3-solver-check.mjs` but not retained).

**S4 — Fail-closed negatives.**
Each with its exact expected rejection code, from the manifest rather than from an inline
`assert.throws`: rank-deficient restraint → `SINGULAR_SYSTEM`; zero/near-zero element area;
inverted Jacobian; duplicate constraint on one DOF; internal-edge traction →
`REJECTED_LOAD_CASE`; disconnected node; duplicate element node set.

**S5 — Determinism and cost.**
Cross-process byte-identical result hash (`local-continuum/result-hashes.js` already computes it),
plus DOF / wall-time / peak-memory scaling recorded as **informational only** — the program already
declares `performanceIsInformational: true`.

### 4.3 Artifacts

`validation/lafea-benchmark-data/B02/`, mirroring the B01 layout exactly, with runner
`scripts/lafea.3-solver-benchmark-run.mjs --stage S0..S5` emitting the same
`lafea-benchmark-audit-record/v1` record. Activating B02 means flipping its
`definitionState` to `READY` in `program.json` and moving it out of `futureQueue` — the mechanism
is already there and unused.

---

## Part 5 — Surfacing both in the EMP tab

The tab already carries the right presentation and the wrong vocabulary.

1. **Reuse the Benchmark Evidence panel shape.** Reference / computed / absolute difference /
   relative difference / tolerance / status per row, then worst-case and governing-point summary,
   then frozen source hash and an explicit authority boundary. Both `BM-MESH` and `BM-S` audit
   records map onto that table without inventing a new component.
2. **Fix U3 first.** `emp1-benchmark-view.js` and `emp1-benchmark-evidence-workspace.js` do not use
   `emp1PlainLanguageLabel` at all. Adding two benchmark record types to a panel that already
   prints `NOT_RUN_EXECUTION_ENVIRONMENT` and
   `PASS_FINAL_CAUX_SOURCE_QUALIFICATION_GAMMA_RADIUS_RECONCILED_REFERENCE_FREEZE_PRESERVED` at a
   human just multiplies the problem. Extend the registry to cover the benchmark and review code
   sets, then route both panels through it.
3. **Fix U2 at the same time.** A benchmark panel is precisely where a green pill on a blocked or
   not-run state is most dangerous. Give `lafea-result-highlights__status` the `data-status`
   variants the sibling components already have, so `NOT_RUN` and `FAIL` cannot render green.
4. **Show stage state, not just a final verdict.** Both ladders are staged; the panel should show
   which stage the record reached and which gate stopped it — that is the information the current
   `&&` chains destroy.

---

## Appendix — commands used

```bash
npm run check:lafea-meshing                      # FAILS at lafea.10-mesh-quality-panel-check.mjs:90
node scripts/lafea.3-benchmark-cont-patch-01-check.mjs   # PASS
node scripts/lafea.3-benchmark-cont-cyl-01-check.mjs     # PASS  5.203% -> 1.871% -> 0.585%
node scripts/lafea.3-benchmark-cont-hole-01-check.mjs    # PASS  Kt 2.8755 -> 2.9116 -> 2.9327
node scripts/lafea-bucket-01-t3-patch-check.mjs          # PASS  (program case B01)
node scripts/lafea.3-t6-patch-check.mjs                  # PASS  (program case B01)
node scripts/lafea.3-q8-patch-check.mjs                  # PASS  (program case B01)
```

UI walkthrough: `npx vite --port 5199`, headless Chromium at 1600×1000, navigate
`[data-application-nav="EMPIRICAL"]`, measure the workbench subtree and its scroll container.
