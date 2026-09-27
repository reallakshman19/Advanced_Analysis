# 1885S WebGL Editing and Empirical Load Benchmark

Evidence hash: `fnv1a64:582e8e25877aa74f`

This qualification uses the repository-owned SJSON plus content-addressed line-list, piping-class, and component-weight masters. No developer-local drive path is an execution dependency.

## Source authority

| Source | SHA-256 | Portable reference |
|---|---|---|
| dataset | `6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288` | `repository:benchmarks/Sjson.json` |
| lineList | `723518a16b1a744c9328539f1a25fe15ea246757930970603a89d3cea46e3f41` | `sha256:723518a16b1a744c9328539f1a25fe15ea246757930970603a89d3cea46e3f41` |
| pipingClass | `bea1c45f3f7dcf51340a6d625cfcc23cfc5926be3413d697183b607e2ccab82c` | `sha256:bea1c45f3f7dcf51340a6d625cfcc23cfc5926be3413d697183b607e2ccab82c` |
| componentWeight | `72e266002256e2ac0b0c0c9c722dde2bb65e93deec2075d209c7ab78d219cda2` | `sha256:72e266002256e2ac0b0c0c9c722dde2bb65e93deec2075d209c7ab78d219cda2` |

## Verified normalization

- 279 source nodes
- 139 support records -> 38 tagged assemblies -> 37 physical sites
- 13 route partitions, 127 topology edges, 124 physical edges, and 3 AUTO carriers
- Source coordinates remain Z-up; conversion occurs only at the Three.js boundary
- Line S8811951 / class 91261M7 / DN150 / row 316 preserved

## Inline replacement

Status: **PASSED**

Exactly three components were retired. Gaskets `/51249` and `/51255`, support `/51254`, and the B2 AUTO carrier retained their identities. Endpoint, ancestry, retained-identity, connectivity, non-overlap, undo, and redo checks passed.

## Empirical loads

Method: `CHAINAGE_TRIBUTARY_SPAN_V2`  
Status: **BLOCKED — no numeric reactions published**

| Project Data field | Code | Reason |
|---|---|---|
| loadCalculation.pipeSectionProperties | MISSING_VALUE | An authoritative value is required. |

EMPTY, OPE, and HYD remain separate blocked cases. Their `verticalForceN` values are null and equilibrium is not run while Project Data is incomplete.

## Browser benchmark

Browser timing is emitted separately by the exact-head Wave 5 Chromium harness.
