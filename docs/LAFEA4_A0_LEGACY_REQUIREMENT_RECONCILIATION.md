# LAFEA.4 A0 Legacy Requirement Reconciliation

Companion to `docs/LAFEA4_CURRENT_ARCHITECTURE_AUTHORITY_RECORD.md`.  
Basis: `main@41df6e945789273fc327aaeca6686529a9ad8b39`.

This appendix preserves item-level custody from legacy issues. `IMPLEMENTED/SOURCE_PRESENT` means the corresponding source owner exists; it is not automatically executable PASS or release qualification.

## Issue #1536 — original required actions

| Legacy requirement | Current A0 classification | Evidence/disposition | New owner if still open |
|---|---|---|---|
| Decide CST/DKT-only vs MITC production strategy | SUPERSEDED_AS_OPEN_DECISION / DECIDED | Current registry/composition carries legacy CST/DKT v1 plus explicit MITC3/MITC4 v2 production dispatch | none; A0 records current truth |
| Build MITC adoption package before production promotion | SOURCE_PRESENT / EXECUTABLE_RELEASE_V&V_OPEN | Adoption element, pressure, solve, recovery, shared-qualification and production-route scripts exist; direct v2 composition route exists; release evidence remains NOT_RUN | #1763 A4 |
| Keep unqualified MITC evidence experimental/nonproduction | SUPERSEDED_BY_NEW_STATE_MODEL | MITC route is now registered production dispatch, but `qualifiedForRelease=false`, `evidenceState=NOT_RUN`, `RELEASE_NOT_QUALIFIED`; old “experimental nonproduction” label is no longer the correct current state | #1763 A4 / #1770 A7 for final qualification wording |
| Add scalable shell solve path | IMPLEMENTED_IN_SOURCE / CURRENT-HEAD_EQUIVALENCE_OPEN | Dense <=1536 DOF; sparse lower-symmetric + shared deterministic Jacobi-PCG above threshold | #1764 A5 |
| Add `LAFEA4-CYL-01`, `LAFEA4-PRESS-01`, `LAFEA4-COMB-01` direct route benchmarks | IMPLEMENTED_IN_SOURCE / CURRENT_EXECUTION_OPEN | IDs registered in composition and production-route scripts present | #1763 A4 |

### #1536 statements that must not be reused as current facts

```text
MITC3/MITC4 are benchmark-only and not exported            -> SUPERSEDED
calculateLocalShell only builds CST/DKT                     -> SUPERSEDED at direct schema dispatch
shell solver is dense-Cholesky-only                         -> SUPERSEDED
no MITC adoption package exists                             -> SUPERSEDED as source-status statement
no drilling DOF                                             -> CURRENT
CST/DKT is Kirchhoff thin-shell without transverse shear    -> CURRENT
MITC release qualification is not established               -> CURRENT
```

Critical qualification: the direct composition/kernel MITC route exists, but the governed LAFEA.4 retained-mesh producer/compiler/workbench chain remains CST/DKT-only at this basis. That integration gap is not resolved by the superseded #1536 wording.

## Issue #1712 — C4-01 through C4-08

| Row | Requirement | Current implementation/evidence classification | Remaining work | Owner |
|---|---|---|---|---|
| C4-01 | Reproduce production single/multipatch generation and baseline shell checks; prove public dispatch and supported geometry envelope | PARTIAL / SOURCE PRESENT | Current producer has planar, cylindrical, curved-hole and periodic CST/DKT scopes; multipatch/seam source exists; current A0 did not execute full exact-head reproduction matrix | #1758 A1 |
| C4-02 | Measure patch/total area, boundaries, normals, seam identity/connectivity, orientation and thickness provenance at every level | PARTIAL / HISTORICAL BM-MESH + CURRENT SOURCE | BM-MESH has historical mesh/seam evidence; current source has midsurface/normal/thickness custody. Exact current-head multipatch/refinement custody and all falsifiers remain to be qualified | #1758 A1 |
| C4-03 | Physical-region restraints and consistent pressure/resultant mapping after refinement; force/moment equilibrium; local/global rotation parity | PARTIAL / CURRENT COMPILER IS BOUNDED | Current workbench compiler permits only whole-surface identical translations, zero local rotations, no nodal-load remap, whole-surface uniform pressure. Direct kernel checks are broader than this workbench transfer envelope | #1759 A2 |
| C4-04 | M4 membrane plus distinct bending and curved-pressure benchmarks through public shell solver on >=3 meshes | PARTIAL / HISTORICAL + FROZEN ORACLES | BM-MESH M4 historical PASS is simulated/informational for accuracy; independent B4-1/B4-2/B4-3 CST/DKT definitions exist. Current-head execution/refinement and curved-pressure mechanics disposition remain | #1761 A3 |
| C4-05 | Freeze licensed/published curved-shell reference before numerical expected values | OPEN / SOURCE_REQUIRED FOR CURVED-SHELL REFERENCE | B4-3 is a published DKT twisting plate, not the requested curved-shell reference. Do not substitute internet numbers or FE-vs-FE output | #1761 A3 |
| C4-06a | Producer/assembly/solve bounded performance and memory ladder | OPEN / INFRASTRUCTURE EXISTS | Sparse/PCG source exists but bounded current resource/equivalence evidence is still required | #1764 A5 |
| C4-06b | Viewport time/memory on bounded product ladder | OPEN | Product viewport performance is separate from solver scalability | #1767 A6 |
| C4-07 | Browser smoke on planar + controlled curved source; inspect normals/seams/thickness, loads, regeneration, fixed probes, stale states, export | PARTIAL | #1755 proves current demo reaches Solve Ready and browser boots, not full Run/output/practical curved journey | #1767 A6 |
| C4-08 | Preserve one practical midsurface source model and provenance; qualify only its envelope | OPEN / PRACTICAL_SOURCE_REQUIRED | Simulated analytical fixtures are not a practical engineering source | #1767 A6 |

The old #1712 strategy statement that MITC remains wholly separate/nonproduction is stale. The retained-mesh workbench limitation is real, but its correct statement is: MITC v2 is registered at the composition/kernel boundary and is not yet proven through the bound retained-mesh workbench route.

## Issue #1652 — BM-MESH required actions

| Required action | Current classification | Evidence/disposition |
|---|---|---|
| Fix mesh-quality-panel stale assertion and restore meshing governance chain | IMPLEMENTED | landed before/with subsequent mesh programme work |
| Freeze M2 geometry and cited expected values | IMPLEMENTED | controlled MESH validation data retained |
| Define stage/family ladders and fixed physical probes | IMPLEMENTED | retained MESH validation data |
| Implement staged M0-M4 runner and records | IMPLEMENTED / HISTORICAL PASS | merged PR #1715 records fresh M0-M4 PASS |
| Define exact negative cases | IMPLEMENTED / HISTORICAL PASS | four frozen negatives PASS in #1715: ceiling, unauthorized family, mapped topology mismatch, noncoincident seam |
| Register BM-MESH in benchmark programme | IMPLEMENTED | retained benchmark-program reports exist |
| Do not infer release authority | CURRENT INVARIANT | #1715 explicitly excludes release/practical/UI/full mechanics qualification |

A0 disposition: #1652 is legitimately closed as completed for the BM-MESH contract. Its historical M4 simulated reference values remain informational, not an independent shell-accuracy oracle.

## Issue #1634 — production-readiness rows relevant to LAFEA.4

| Legacy row | Current A0 classification | Current interpretation |
|---|---|---|
| Production bundle browser boot FAIL | HISTORICAL / SUPERSEDED FOR CURRENT MAIN | PR #1755 on current-main ancestry records browser smoke with zero page/console errors |
| Exact-head LAFEA.4 CI NOT_RUN | STILL UNRESOLVED AS RELEASE EVIDENCE | A0 has not executed hosted current-head qualification; old zero-step failures remain infrastructure history |
| Production JS chunk ceiling FAIL | HISTORICAL / SUPERSEDED FOR CURRENT MAIN | PR #1755 records current build PASS with chunk budget satisfied |
| LAFEA.4 local/global tensor oracle defect | FIXED | merged PR #1632 rotates analytical tensors into each element's retained local frame before component comparison |
| Frame convention documentation | FIXED | PR #1632 |
| Stale `check:lafea.4` command documentation | FIXED | real aggregate/focused commands now exist; A0 uses current `package.json` |
| MITC release qualification HOLD | CURRENT | no release promotion in A0 |

Issue #1634 remains open because its scope is repository-wide. A0 only supersedes stale LAFEA.4-specific status observations where newer current-main evidence exists.

## PR ancestry reconciliation

| PR | Merge state | A0 use |
|---|---|---|
| #1541 | MERGED (`ae92c5eb...`) | source ancestry for sparse shell assembly/shared PCG; creation-time zero-step CI is historical |
| #1542 | CLOSED UNMERGED | design/test ancestry for MITC adoption; never cite it as the merge that put MITC production source on main |
| #1574 | MERGED (`b4ca0335...`) | later #1536 recovery/production source ancestry; body still records governed benchmarks NOT_RUN at that epoch |
| #1632 | MERGED (`e29abec7...`) | local/global oracle-frame correction and result-frame discipline |
| #1715 | MERGED (`27dde65f...`) | BM-MESH M0-M4 + frozen-negative historical PASS; simulated M4 values not independent accuracy gate |
| #1755 | MERGED CURRENT MAIN (`41df6e94...`) | demo mesh-profile/generation fix; imports/advanced-shell/build/browser smoke historical PASS; no mechanics change |

## Child ownership rule

A later child may consume historical evidence, but it must not silently inherit its status onto a different exact head. If a child changes source inside another child's authority boundary, the first wrong boundary controls ownership and the dependent child must wait or requalify.

The principal newly isolated gap from A0 is assigned once:

```text
MITC direct composition/kernel production route exists
BUT
bound LAFEA.4 retained-mesh producer/compiler/workbench route is CST/DKT-only

owner = #1763 A4
prerequisites = #1758 A1 geometry/mesh custody + #1759 A2 mapping/frame contracts
```

No A0 source patch is authorized to close that gap.
