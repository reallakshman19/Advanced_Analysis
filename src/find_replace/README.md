# Find Replace Transaction Engine

New isolated feature.

## Scope

Phase 1:
- Document level find and replace
- CSV driven operations
- Preview before apply
- Before/after validation

Phase 2:
- Element scoped replacement

Phase 3:
- Block scoped replacement

Design rule:

TARGET0 is immutable. All replacement claims are generated against the original bytes and validated independently.

Existing writers are not modified.
