# LAFEA.4 Current Architecture & Authority Record

Issue: #1757 (A0)  
Parent: #1756  
Repository basis: `reallaksh19/Advanced_Analysis@41df6e945789273fc327aaeca6686529a9ad8b39`  
Tree: `2ebc03a01b3b7485e1b38a7fa41367f92bb92085`  
Observed main basis date: 2026-09-12  
Record role: architecture/authority reconciliation only  
Release disposition: **`RELEASE_NOT_QUALIFIED / HOLD`**

## 1. Governing interpretation rule

This record distinguishes four facts that historical issues and roadmaps sometimes conflate:

1. a formulation is implemented in source;
2. a formulation is registered in the LAFEA.4 composition/calculator contract;
3. a formulation traverses the governed retained-analysis-mesh workbench route;
4. a formulation is release-qualified on one exact head.

These are independent claims. Passing or satisfying an earlier claim does not imply a later one.

When descriptive status in an older issue/roadmap conflicts with executable current source, current source and retained exact-head evidence govern observed implementation status. Owner roadmap intent, source/oracle authority, exclusions and release authority remain protected and are not rewritten by this A0 record.

No element formulation, stiffness/load assembly, mesh algorithm, solver tolerance, recovery convention, benchmark expected value/tolerance, workflow file, roadmap or release flag is changed by A0.

## 2. Exact current authority

### 2.1 Stage registry and composition

Current `src/workspace/lafea-stage-registry.js` declares LAFEA.4 as a five-DOF shell stage with authority:

```text
CST_DKT_TRI3_V1_PLUS_MITC4_QUAD4_MITC3_TRI3_PRODUCTION_DISPATCH
```

and input/result roles:

```text
LOCAL_SHELL_MODEL_V1_OR_V2
LOCAL_SHELL_RESULT_V1_OR_V2
```

The same registry retains these boundaries:

```text
legacy v1 = CST+DKT TRI3 thin shell
v2        = MITC4 QUAD4 / MITC3 TRI3 Reissner-Mindlin
no drilling DOF or drilling penalty
no large-displacement / follower-pressure authority
no plasticity
no weld-stress authority
no code-assessment authority
MITC executable release qualification pending
```

`src/workspace/lafea-stage-composition-bindings.js` binds LAFEA.4 to:

```text
compositionRootId = LAFEA.COMPOSITION.THIN_SHELL/V1
lifecycleProfile  = FEA_MESH_RECOVERY_V1
releaseState      = RELEASE_NOT_QUALIFIED
```

and registers benchmark identities:

```text
SHELL-PATCH-01
SHELL-BEND-01
LAFEA4-CYL-01
LAFEA4-PRESS-01
LAFEA4-COMB-01
```

### 2.2 Source authority

Engineering source identity is issued by `issueLafeaSourceAuthority()` over the normalized stage source using canonical SHA-256. The editor FNV digest is a revision/concurrency token only. `meshConfig` is excluded from engineering source authority.

Required custody invariant:

```text
normalized source
  -> canonical sourceHash
  -> midsurface parent
  -> retained analysis mesh
  -> compiled solver model
  -> execution
  -> recovery/result
```

A stale source/domain/geometry/mesh parent must fail closed rather than be silently reused.

## 3. Current production routes

### 3.1 Route A — governed retained-mesh workbench route: CST/DKT

This is the current authoritative Model -> Mesh -> Run route used by the LAFEA.4 workbench:

```text
normalized LAFEA.4 source
  -> issueLafeaSourceAuthority()
  -> retained shell midsurface evidence
  -> bound analysis mesh profile
       element family = CST_DKT_TRI3_THIN_SHELL_V1
  -> shell mesh producer
       planar / cylindrical / curved-hole / periodic scopes
       retained l-a-f-e-a-analysis-mesh/v1 evidence
  -> mesh custody + parent-normal gates
  -> compileLafeaShellSolverModel()
       mappingMode = PARAMETRIC_MIDSURFACE_UNIFORM_REGION_TRANSFER_V1
       canonicalizes legacy local-shell-model/v1
       requires CST_DKT_TRI3_THIN_SHELL_V1 retained elements
  -> shellSolverModelProjection CURRENT_PASS
  -> authorization READY
  -> LAFEA_SHELL_COMPILED_EXECUTION_ROUTE
       SHELL_RETAINED_MESH_COMPILED_SOLVER_MODEL
  -> calculateLocalShell(compiled.canonicalShellModel)
  -> CST membrane + DKT bending element assembly
  -> dense Cholesky for small systems OR sparse Jacobi-PCG for large systems
  -> reactions / residual / force equilibrium / moment equilibrium / energy
  -> retained surface/IP recovery
  -> lifecycle EXECUTION / RECOVERY
  -> presentLocalShell()
  -> engineering summary + retained evidence
```

The bound analysis-mesh producer registry currently authorizes only:

```text
LAFEA.4 -> CST_DKT_TRI3_THIN_SHELL_V1
```

for LAFEA.4. The shell mesh producer likewise generates CST/DKT TRI3 for all currently registered planar/curved/hole/periodic shell scopes.

The retained-shell-mesh compiler is also currently CST/DKT-specific. It calls the legacy v1 shell canonicalizer and rejects any retained element whose family is not `CST_DKT_TRI3_THIN_SHELL_V1`.

Therefore the current **governed retained-mesh workbench route is CST/DKT**, even though the stage composition can separately dispatch MITC v2 as described below.

### 3.2 Current compiler transfer envelope

For LAFEA.4 the retained-mesh compiler currently proves and transfers only a deliberately bounded mechanics envelope:

```text
material          one uniform material
thickness         one uniform positive thickness
global UX/UY/UZ   whole-surface identical value per DOF only
local R1/R2       whole-surface zero only
nodal loads       nonempty mapping rejected
pressure          one whole-surface uniform pressure + sense only
source geometry   parametric midsurface required
mesh              CURRENT/PASS + shell orientation/topology PASS
```

These restrictions are current implementation facts, not universal shell methodology limitations. Wider physical load/BC transfer belongs to A2 and must not be inferred from direct-kernel fixtures.

### 3.3 Route B — registered composition/kernel MITC3/MITC4 production contract

The stage composition and public local-shell calculator additionally accept `local-shell-model/v2`:

```text
LAFEA.4 composition normalize
  -> identify local-shell-model/v2
  -> createCanonicalMitcProductionModel()
  -> calculateLocalShell()
       schema dispatch
       -> calculateMitcProductionShell()
  -> MITC3/MITC4 assembly/solve/recovery
  -> local-shell-result/v2
  -> composition acceptResult()
  -> presentLocalShell()
       in-plane surface/IP authority
       transverse shear retained separately
```

The live v2 contract declares:

```text
formulationFamily          MITC_REISSNER_MINDLIN_5DOF_V1
routeStatus                PRODUCTION_ROUTE_REGISTERED
productionQualification    PENDING_EXECUTABLE_VALIDATION
qualifiedForRelease        false
evidenceState              NOT_RUN
contributesToRelease       false
```

A valid MITC result may therefore be numerically accepted at the calculation/load-case level while the production release qualification remains false. This is intentional and must not be collapsed into one PASS state.

### 3.4 Critical integration distinction

`scripts/lafea.4-mitc-production-route-check.mjs` exercises the registered composition route directly: normalize -> canonicalize -> calculate -> accept -> present. It demonstrates the v2 application composition contract when executed.

It does **not** prove that a v2 MITC model traverses the governed retained-analysis-mesh workbench chain, because today:

```text
mesh producer registry -> CST_DKT_TRI3_THIN_SHELL_V1 only
shell mesh producer     -> CST_DKT_TRI3_THIN_SHELL_V1 only
shell solver compiler   -> local-shell-model/v1 + CST_DKT_TRI3_THIN_SHELL_V1 only
workbench run action    -> executes compiler.canonicalShellModel
```

Hence:

```text
MITC production dispatch registered     = CURRENT TRUE
MITC direct composition/kernel route    = CURRENT TRUE
MITC retained-mesh workbench parity     = NOT ESTABLISHED / CURRENT GAP
MITC release qualification              = FALSE / NOT_RUN
```

This integration gap is owned by A4 after A1/A2 establish the geometry/mapping contracts it must consume.

## 4. Solver architecture

The old description “dense-Cholesky-only shell solver” is superseded.

Current assembly chooses:

```text
DOF <= 1536  -> DENSE
DOF > 1536   -> SPARSE_LOWER_SYMMETRIC
```

The dense branch uses deterministic Cholesky. The sparse branch partitions the sparse system and calls the shared deterministic Jacobi-PCG owner under `src/core/lafea-linear-solve/**`. Structural PCG failures are classified as singular/indefinite/under-constrained; qualified residual failure is a numerical non-convergence error. Reactions, residuals, force equilibrium and moment equilibrium are reconstructed independently of storage mode.

Existence of this route does not itself prove current release-scale parity or resource performance. That evidence is owned by A5.

## 5. Result and presentation authority

`presentLocalShell()` is a presentation boundary, not a second mechanics implementation.

Current authoritative result location is retained element integration-point surface evidence. The presenter:

```text
- reports max translational displacement with node/load-case custody;
- reports retained surface/IP von Mises and |sigmaX| with element/IP/surface custody;
- reports force and moment reactions;
- reports applied force and moment resultants;
- reports force/moment equilibrium residual qualification;
- for MITC v2, reports transverse-shear stress/resultants separately;
- does not promote nodal stress projection, averaging, smoothing or contour interpolation to engineering authority.
```

A6 owns engineer-facing product/output qualification; visual appearance is not a numerical oracle.

## 6. Current formulation capability matrix

| Capability | CST/DKT v1 | MITC3 v2 | MITC4 v2 | Current authority consequence |
|---|---|---|---|---|
| Five DOF/node UX/UY/UZ/R1/R2 | YES | YES | YES | No drilling DOF |
| Stage composition registered | YES | YES | YES | Runtime contract exists |
| Direct `calculateLocalShell` dispatch | YES | YES | YES | Kernel/composition route exists |
| Formulation-aware presenter | YES | YES | YES | MITC shear shown separately |
| Bound LAFEA.4 analysis-mesh producer | YES | NO | NO | Current retained mesh producer is CST/DKT only |
| Retained-mesh shell compiler | YES | NO | NO | Current workbench compiler canonicalizes v1 only |
| `SHELL_RETAINED_MESH_COMPILED_SOLVER_MODEL` workbench execution | YES | NO CURRENT PROOF | NO CURRENT PROOF | MITC workbench parity is an A4 gap |
| Kirchhoff thin-shell bending | YES | N/A | N/A | CST/DKT has no transverse-shear term |
| Reissner-Mindlin transverse shear | NO | YES | YES | Does not grant blanket thick-shell authority |
| Dense/sparse solver infrastructure | YES | SOURCE PATH EXISTS | SOURCE PATH EXISTS | A5 must qualify parity/scale on current routes |
| Frozen independent B4-1/B4-2/B4-3 oracle | YES | NO | NO | CST/DKT independent benchmark authority exists |
| MITC adoption/production scripts | N/A | YES | YES | Executable release evidence remains NOT_RUN in A0 |
| Drilling DOF | NO | NO | NO | Explicit unsupported boundary |
| Large displacement/follower pressure | NO | NO | NO | Explicit unsupported boundary |
| Release qualified | NO | NO | NO | `RELEASE_NOT_QUALIFIED` |

## 7. Benchmark and evidence hierarchy

A0 classifies evidence by what it can actually prove.

### 7.1 Frozen independent CST/DKT numerical authority

Retained under `validation/lafea-shell/`:

```text
B4-1-membrane-patch-v1.json
B4-2-pure-bending-patch-v1.json
B4-3-reference-problem-v1.json
frozen-definition-manifest-v1.json
```

B4-1 and B4-2 are analytical membrane/bending patch oracles. B4-3 is the frozen Batoz-Bathe-Ho DKT twisting-square reference. The production comparator is `scripts/lafea4-shell-independent-benchmark-check.mjs`; the freeze/source guard is `scripts/lafea-shell-independent-benchmark-freeze-check.mjs`.

These are the primary existing independent CST/DKT mechanics oracles. A3 owns current-head execution, extension and disposition.

### 7.2 CST/DKT implementation-coupled/focused checks

Current source contains focused checks including:

```text
lafea.4-contract-check.mjs
lafea.4-geometry-basis-check.mjs
lafea.4-shell-transformation-generalization-check.mjs
lafea.4-membrane-check.mjs
lafea.4-pressure-check.mjs
lafea.4-stress-energy-check.mjs
lafea.4-determinism-check.mjs
lafea.4-solver-loads-check.mjs
```

These are useful falsifiers/regressions. They do not replace an independent oracle simply because they pass.

### 7.3 MITC adoption/production checks

`lafea.4-production-adoption-aggregate-check.mjs` imports:

```text
lafea.4-mitc-adoption-element-check.mjs
lafea.4-mitc-adoption-pressure-check.mjs
lafea.4-mitc-adoption-solve-check.mjs
lafea.4-mitc-adoption-recovery-check.mjs
lafea.4-mitc-adoption-shared-qualification-check.mjs
lafea.4-production-route-benchmarks-check.mjs
lafea.4-mitc-production-route-check.mjs
```

These are current source assets. Their existence is not an A0 execution PASS. Current release evidence remains NOT_RUN until A4/A7 execute the governed suite on an exact candidate head with independent reference disposition.

### 7.4 BM-MESH

Merged PR #1715 records M0-M4 PASS across T3/T6/Q8 and CST/DKT shell ladders plus four frozen negative controls. Retained report directories exist under `reports/qualification/lafea-benchmark-program/mesh-1710-*`.

Classification:

```text
producer/mesh-contract regression        historical PASS evidence
frozen negatives                         historical PASS evidence
M4 simulated analytical response values  informational / not independent accuracy gate
current A0 re-execution                   NOT_RUN
practical project/UI qualification        not established by BM-MESH
release qualification                     not established by BM-MESH
```

A1 consumes M0-M3 mesh/custody evidence; A3 consumes only the parts of M4 that are valid regression inputs, not as a substitute for independent mechanics V&V.

### 7.5 Product/build/browser evidence

PR #1755 is the current-main merge and retains ancestry evidence that, on its qualification head:

```text
check:imports                    PASS
advanced-shell-contract-check    PASS
build                            PASS
headless browser smoke           PASS (0 page/console errors)
LAFEA.4 demo                     MODEL READY -> MESH COMPLETE -> SOLVE READY
```

This supersedes older #1634/#1715 descriptions of the bundle/boot state for current main. It does not prove actual Run -> accepted result -> output, practical-source qualification, independent numerical accuracy, hosted exact-head CI, or release.

## 8. Legacy issue/PR reconciliation

| Source | Current disposition | Retain | Do not inherit blindly |
|---|---|---|---|
| #1371 | MIXED-STAGE OPEN; LAFEA.4 scope transferred to #1756 hierarchy | custody, frozen benchmark intent, Model->Mesh->Analyse->Output invariants | old single-formulation status |
| #1413 | MIXED-STAGE OPEN; LAFEA.4 exact-head closure transferred principally to A7 | exact-head/first-failure discipline, B4-1/B4-2/B4-3 | old MITC exclusion as current implementation fact |
| #1536 | CLOSED/SUPERSEDED | no-drilling/thin-vs-shear questions, scalability and adoption history | “MITC not exported/production”, “dense-only”, “no adoption package” as current facts |
| PR #1541 | MERGED | sparse storage + shared PCG ancestry | creation-time NOT_RUN status as current status |
| PR #1542 | CLOSED UNMERGED / HISTORICAL | MITC adoption design, slope mapping, pressure/recovery test ancestry | any claim that PR #1542 itself landed |
| later #1536 recovery incl. PR #1574 | MERGED SOURCE ANCESTRY | production-contract source landed; release still held | source-complete as executable release PASS |
| PR #1632 | MERGED | local/global oracle-frame correction; engineering shear/twist transform discipline | old build/boot/CI observations as current product state |
| #1634 | OPEN REPOSITORY-WIDE | release evidence separation, hosted exact-head principle | old current-main bundle/boot failure after #1755 |
| #1652 | CLOSED COMPLETED | BM-MESH source/oracle/custody and M0-M4 history | simulated M4 values as independent shell accuracy qualification |
| PR #1715 | MERGED | M0-M4 + four negative PASS history | old bundle-size FAIL as current; practical/UI/release claims |
| #1710 | OPEN MULTI-STAGE | shared mesh/product evidence principles | treating LAFEA.4 child status as current after #1756 supersession |
| #1712 | CLOSED/SUPERSEDED | C4 engineering requirements and hand-calculation payloads | “MITC remains separate/nonproduction” as current composition fact |
| PR #1755 | MERGED CURRENT MAIN | demo mesh profile/generation, current build/boot smoke ancestry | numerical qualification or Run/output/release claims |

## 9. Remaining gaps and single child ownership

To avoid two issues repairing one boundary, unresolved work is assigned by first wrong boundary.

| First unresolved boundary | Owner | Required outcome |
|---|---|---|
| midsurface geometry, patch/seam identity, normals, thickness provenance, retained mesh custody | #1758 A1 | qualify existing physical geometry -> CST/DKT retained mesh chain and falsifiers |
| physical load/BC/probe projection, pressure force+moment, local/global covariance, refinement remap | #1759 A2 | independent mapping/equilibrium/frame qualification |
| CST membrane/DKT bending/twisting/recovery accuracy | #1761 A3 | execute B4 independent programme + hand-calculation/refinement dossier |
| MITC3/MITC4 mechanics + applicability + **retained-mesh workbench integration parity** | #1763 A4 | qualify v2 formulation and close the composition-vs-workbench integration gap without FE-vs-FE circularity |
| dense/sparse/PCG equivalence, mechanisms, convergence diagnostics, bounded resource envelope | #1764 A5 | qualify solver backend independently of element formulation |
| actual browser Run -> accepted result -> output, practical source, evidence/export/reload UX | #1767 A6 | product qualification; browser is not numerical oracle |
| one exact-head complete suite, independent disposition, registry/release closure | #1770 A7 | only place allowed to recommend release-state change |

Dependency rule remains:

```text
A0 -> A1 -> A2 -> A3 -> A4
A3/A4 -> A5 -> A6 -> A7
```

A4 may design analytical cases early, but must consume A1/A2 custody/mapping contracts rather than introduce a parallel MITC mesh/load architecture.

## 10. Exact first-wrong-boundary rules for later children

Later work must classify failure before patching:

```text
source/source hash
midsurface geometry/topology
mesh generation/custody
load/BC/probe projection
formulation kinematics/stiffness
assembly
solver/backend
reaction/equilibrium/energy
recovery
local/global transformation
result contract/presentation
browser/product custody
release/infrastructure
```

Do not compensate for an upstream defect by changing a downstream tolerance, oracle, smoothing rule, formulation or solver.

Particular prohibitions retained from current architecture:

```text
no seam welding in a benchmark to hide topology error
no normal reversal to make a pressure sign pass
no weak spring/drilling penalty to hide a mechanism
no CST/DKT -> MITC switch to repair a mapping defect
no MITC -> CST/DKT comparison as sole independent oracle
no nodal/display smoothing as engineering stress authority
no force-only pressure check when first moment is wrong
no post-observation expected-value/tolerance tuning
```

## 11. Current command and evidence matrix

A0 used repository/source inspection only. The current connector did not provide a repository execution shell, so commands not actually run remain `NOT_RUN`.

| Gate | A0 status | Retained input evidence | Next owner |
|---|---|---|---|
| `node scripts/advanced-shell-contract-check.mjs` | NOT_RUN | PR #1755 historical PASS ancestry | A6/A7 |
| `node scripts/lafea4-shell-independent-benchmark-check.mjs` | NOT_RUN | frozen B4 definitions present | A3/A7 |
| `node scripts/lafea.4-production-adoption-aggregate-check.mjs` | NOT_RUN | aggregate + seven current gate scripts present | A4/A7 |
| `node scripts/lafea.4-mitc-adoption-shared-qualification-check.mjs` | NOT_RUN | source present; PR #1632 oracle-frame correction merged | A4 |
| `node scripts/lafea.4-production-route-benchmarks-check.mjs` | NOT_RUN | source present | A4 |
| `node scripts/lafea.4-mitc-production-route-check.mjs` | SOURCE INSPECTED / NOT EXECUTED | composition/kernel route assertions present | A4 |
| BM-MESH M0-M4 | HISTORICAL PASS / A0 REEXECUTION NOT_RUN | PR #1715 + retained report tree | A1/A3 |
| `npm run check:lafea-meshing` | NOT_RUN | current script exists in package.json | A1/A7 |
| `npm run check:lafea-solver` | NOT_RUN | current script exists in package.json | A5/A7 |
| `npm run check:imports` | NOT_RUN | PR #1755 historical PASS | A7 |
| `npm run build` | NOT_RUN | PR #1755 historical PASS; supersedes old bundle failure | A6/A7 |
| hosted exact-head LAFEA.4 workflow | NOT_RUN in A0 | historical zero-step failures are infrastructure evidence only | A7 / #54 as infrastructure owner |

## 12. A0 closure conclusions

The current source architecture is internally understandable once the route layers are separated:

1. **CST/DKT is the current governed retained-mesh workbench route.**
2. **MITC3/MITC4 v2 are registered composition/kernel production-dispatch contracts with formulation-aware results/presentation.**
3. **The currently bound LAFEA.4 mesh producer and retained-shell-mesh compiler do not yet establish MITC workbench parity.** This is the principal current integration gap inherited by A4.
4. **Sparse shell assembly and deterministic PCG exist in current source; dense-only wording is obsolete.**
5. **CST/DKT has a frozen independent B4 benchmark family.** BM-MESH M4 simulated values are not a substitute for it.
6. **MITC numerical result acceptance is not release qualification.** Current v2 production qualification explicitly remains pending/NOT_RUN and the composition remains `RELEASE_NOT_QUALIFIED`.
7. **PR #1755 resolves the stale demo mesh-binding/build/boot observation but only through Solve Ready.** Actual Run/output/practical-source qualification remains A6.
8. **No release claim changes in A0.** A7 owns the final exact-head disposition.

Until A1-A7 produce their required retained evidence on a single candidate release head:

```text
LAFEA.4 RELEASE_QUALIFIED = FALSE
DISPOSITION = HOLD
```
