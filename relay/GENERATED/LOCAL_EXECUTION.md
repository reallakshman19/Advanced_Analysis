# Engineering Relay V3.1 — B02B Ladder Repair Validation

- Request: LOCAL-EP-LAFEA3-C3D-B02B-LADDER-1771-0005-955cbc11394c
- EP: EP-LAFEA3-C3D-B02B-LADDER-1771-0005
- Required HEAD: 955cbc11394c85ad5dfbd3bf399acf70e6a8cf8d
- Branch: relay/c3d-v31-diagnostic-1771

Run exactly:

```text
node scripts/lafea-b02b-production-check.mjs
node scripts/lafea-b02-production-sequence-check.mjs
```

Expected authority: T3 uses [2.5, 1.25, 0.625]; T6/Q8 use [10, 5, 2.5]. Do not modify source or relax qualification criteria. Return the typed V3.1 result packet.
