# Engineering Relay V3.1 — B02B V2 Routing Repair Validation

- Request: LOCAL-EP-LAFEA3-C3D-B02B-ROUTING-1771-0006-ef09fc3c403c
- Required HEAD: ef09fc3c403cc6b1fb7b206bfb2abc6166c28a24
- Branch: relay/c3d-v31-diagnostic-1771

Run exactly:

```text
node scripts/lafea-b02b-production-check.mjs
node scripts/lafea-b02-production-sequence-check.mjs
```

This validation must not change definitions, the 2% convergence fallback, mesh generation, solver, recovery, B-bar, BM-005, or #1862.
