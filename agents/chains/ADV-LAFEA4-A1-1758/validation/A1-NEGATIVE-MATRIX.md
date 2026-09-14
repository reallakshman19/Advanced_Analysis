# A1 mandatory negative matrix — current source disposition

Basis: `main@41df6e945789273fc327aaeca6686529a9ad8b39` plus A1 qualification-only branch deltas through LEG-003.

| Negative | Current source disposition | A1 exact-head status | Governing owner / note |
| --- | --- | --- | --- |
| one locally reversed facet | explicit controlled falsifier added in LEG-003; topology quality must BLOCK | NOT_RUN | `lafea-analysis-mesh-quality.js` / orientation diagnostics |
| globally inverted but internally consistent mesh | topology falsifier explicitly proves topology gate PASS; separate parent-normal policy required | NOT_RUN | TECH-12 parent-normal qualification/trust-root path; do not infer from connectivity |
| noncoincident declared seam | existing multipatch adversarial case rejects `LAFEA_SHELL_MULTIPATCH_SEAM_NOT_COINCIDENT_OPPOSITE` | NOT_RUN | multipatch midsurface contract |
| coincident patches without declared seam topology | explicit LEG-003 falsifier rejects absent seam declaration | NOT_RUN | multipatch midsurface contract |
| coordinate-coincident but distinct seam node IDs | explicit LEG-003 mesh falsifier must BLOCK as disconnected patches | NOT_RUN | analysis-mesh orientation/topology gate |
| duplicated seam nodes | same controlled falsifier; no automatic coordinate welding | NOT_RUN | analysis-mesh orientation/topology gate |
| disconnected shell patches | explicit LEG-003 controlled case gives patchCount=2 and BLOCK | NOT_RUN | analysis-mesh orientation/topology gate |
| zero thickness | production thickness basis already fails non-positive values; focused A1 execution case still pending | NOT_RUN | `lafea-shell-thickness-basis.js` |
| negative thickness | production thickness basis already fails non-positive values; focused A1 execution case still pending | NOT_RUN | `lafea-shell-thickness-basis.js` |
| stale thickness/source provenance | existing TECH-2 check explicitly rejects source-hash mismatch | NOT_RUN on A1 head | source-bound thickness basis |
| unsupported element family | producer registry/family contract plus historical BM-MESH negative; current A1 rerun pending | NOT_RUN | mesh producer registry / evidence contract |
| resource ceiling | producer resource disposition plus historical BM-MESH negative; current A1 rerun pending | NOT_RUN | mesh producer registry/plan |
| invalid mesh quality | quality contract fails/blocking thresholds; current A1 focused rerun pending | NOT_RUN | analysis-mesh quality |
| stale source parent | workbench lifecycle source change clears retained midsurface and retained mesh in existing shell checks | NOT_RUN | workbench mesh generation/custody |
| stale domain/geometry parent | compiler/custody require exact parent hashes; explicit A1 focused mutation still pending | NOT_RUN | mesh custody projection / shell compiler |
| stale mesh profile | profile rebinding invalidates retained generated mesh; G5 sequential ladder consumes this behavior | NOT_RUN | workbench mesh generation state |
| tampered retained evidence/artifact hash | v2 evidence validator reconstructs and rejects tamper; explicit A1 focused mutation still pending | NOT_RUN | `lafea-analysis-mesh-evidence-v2.js` |

## Policy boundary
A negative is not PASS merely because the production owner contains a fail-closed branch. A1 only upgrades a row after the exact focused case runs on the candidate head. Historical BM-MESH evidence remains ancestry, not a current-head substitute.

Global inversion is intentionally separated from relative topology consistency. Current curved parent-normal hard-gate production activation remains governed by the existing TECH-12 exact-head/trust-root process and is not activated or bypassed by A1.
