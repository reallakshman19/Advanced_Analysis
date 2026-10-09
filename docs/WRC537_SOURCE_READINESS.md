# WRC 537 Source Readiness Gate

## Purpose

PR #1203 is retained as a research/intake package. This gate prevents research metadata, OCR-derived equations, secondary interpretations, mixed-edition references, or incomplete coefficient inventories from becoming executable WRC 537 engineering authority.

The selected release target is **WRC Bulletin 537, Edition 4, published 2026-02** based on authoritative catalog identity metadata. Catalog metadata is used only to identify the target edition. It does not qualify technical equations, coefficients, signs, limits, interpolation, or benchmarks.

## Commands

Normal package-state check:

```bash
node scripts/wrc537-source-readiness-self-test.mjs
node scripts/wrc537-source-readiness-check.mjs
node scripts/wrc537-source-boundary-check.mjs
```

The ordinary readiness check is expected to pass while reporting `readinessState = BLOCKED`. That means the repository correctly recognizes that the current research package is incomplete.

Release gate:

```bash
node scripts/wrc537-source-readiness-check.mjs --release
```

The release form must return non-zero while any engineering-authority gate is incomplete. Only `READY_FOR_IMPLEMENTATION` permits a later PR to begin numerical WRC 537 implementation.

## Current authority chain

```text
PR #1203 raw research artifacts
        |
        +-- method narrative
        +-- research JSON
        +-- coefficient inventory CSV
        |
        v
WRC537_SOURCE_READINESS_MANIFEST.json
        |
        +-- exact target-edition identity
        +-- primary technical-source custody
        +-- mixed-edition reconciliation
        +-- sign/interpolation/stress-math verification
        +-- benchmark custody
        |
        v
source-readiness evaluator
        |
        +-- geometry gate
        +-- dimensionless-parameter gate
        +-- load-sign gate
        +-- LAFEA-mapping gate
        +-- coefficient value gate
        +-- source-precision gate
        +-- primary-source locator gate
        +-- benchmark gate
        |
        v
BLOCKED | READY_FOR_IMPLEMENTATION
```

## Normalization rules

Raw extraction labels are never accepted at face value.

A coefficient row is normalized as follows:

- numerical value unresolved -> `STRUCTURE_ONLY_VALUE_UNRESOLVED`;
- published precision unresolved -> `SOURCE_PRECISION_UNRESOLVED`;
- `HIGH` confidence without target-edition primary verification -> `NOT_PRIMARY_SOURCE_VERIFIED`;
- raw `EXTRACTED` status with unresolved value -> `RESEARCH_ONLY`;
- only value + precision + target-edition primary locator + primary verification can become `ENGINEERING_DATA_CANDIDATE`.

This preserves PR #1203 as evidence of what was researched while making its engineering status unambiguous.

## Mandatory readiness gates

The evaluator requires all of the following before returning `READY_FOR_IMPLEMENTATION`:

1. exact target edition and publication date selected;
2. target edition identity verified against authoritative catalog metadata;
3. licensed/authorized target-edition technical source available and primary-verified;
4. no mixed-edition technical data in the release package;
5. all consumed geometry definitions resolved;
6. all required spherical and cylindrical dimensionless parameters have equations, domains and inclusive/exclusive boundary definitions;
7. every supported force/moment has an explicit positive-direction convention;
8. WRC-to-LAFEA canonical mapping is complete;
9. every required coefficient has a finite numerical value;
10. every coefficient retains source precision;
11. every coefficient retains a target-edition primary-source locator and review status;
12. sign tables are target-edition primary-verified;
13. interpolation/extrapolation rules are target-edition primary-verified;
14. membrane/bending/surface reconstruction is target-edition primary-verified;
15. stress-intensity/principal-stress mathematics is dimensionally checked and primary-verified;
16. at least one target-edition published/reference benchmark is retained;
17. every retained release benchmark is independently reproduced.

## Current result

Current expected state: **BLOCKED**.

The detailed unresolved engineering items are maintained in `docs/06_WRC537_OPEN_ISSUES.md`.

## Numerical-method boundary

This PR intentionally adds **no**:

- WRC 537 coefficient values;
- WRC 537 numerical calculator;
- engineering correlation profile;
- trusted approval authority;
- product registry entry;
- UI run action;
- WRC stress PASS/utilization result.

The boundary guard requires the WRC537 method directory to contain only the source-readiness module until a separate source-qualified implementation PR is authorized.

## Validation status for this PR

Executable checks are committed. They are **NOT_RUN in the current agent environment** because the local runtime cannot resolve `github.com` to obtain the repository checkout. GitHub Actions/workflow execution is intentionally not used for this task.
