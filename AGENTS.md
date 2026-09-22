# Advanced_Analysis project agent overlay

COMMON_POLICY_SOURCE:
`reallaksh19/Common@4c0617bd2f41d25f43a5d98673abead8ca4e7686/skills/engineering-pr-delivery-v3.1/`

COMMON_POLICY_REFERENCE:
`reallaksh19/Common@4c0617bd2f41d25f43a5d98673abead8ca4e7686/skills/engineering-pr-delivery-v3.1/SKILL.md`

COMMON_PROTOCOL_MINIMUM_BASIS: `4c0617bd2f41d25f43a5d98673abead8ca4e7686`
LOCAL_POLICY_SCOPE: PROJECT_ONLY
LEGACY_RELAY_WRITES: FORBIDDEN

All reusable relay, qualification, crash-recovery, chain-state, Q1–Q5, validation-integrity, roadmap-governance, migration/cutover, local-execution return, and merge semantics are governed by the pinned Common `engineering-pr-delivery-v3.1` basis above. Resolve the live/default relay protocol from `relay/PROTOCOL_SELECTION.yaml`; after cutover, preserved `agents/relay/**` is read-only history and current authority is V3.1-native. Do not copy or locally fork those generic rules here.

## Project identity / criticality

`reallaksh19/Advanced_Analysis` is an engineering-analysis application containing FEA, piping/local-stress, WRC/EMP.1, LAFEA, load-calculation, engineering source-governance, result-contract and result-presentation work.

Treat work affecting any of the following as `ENGINEERING_CRITICAL` unless a stronger project classification applies:

- FEA/structural/piping mechanics;
- solver stiffness/load assembly, solution, recovery or reactions;
- geometry/topology and coordinate transformations;
- material/section/master engineering data;
- WRC/EMP.1/LAFEA methods and applicability;
- benchmark/oracle expected values;
- source-qualified engineering methods or standards evidence;
- load-calculation mechanics, equilibrium and load/moment transport;
- engineering result contracts, publication or trust/release state.

## Project governing inputs / source custody

Use the owning issue/chain artifacts and repository engineering source ledgers for each domain. Existing controlled source files, benchmark/oracle artifacts, validation fixtures and source-authority documents retain their recorded custody; this project overlay does not create new engineering authority.

For WRC/EMP.1/LAFEA/load-calculation work, preserve the exact source-custody, applicability, coordinate/sign, load-reference, benchmark/oracle and publication boundaries recorded by the owning engineering artifacts.

Historical relay/workreport artifacts remain provenance only:

```text
agents/agentchain.md
agents/agentchain/**
agents/PR*_workreport.md
agents/status/**
agents/claims/**
```

Do not delete or mass-rewrite them. New material legs/takeovers use the canonical v3 paths defined by Common.

## Protected project domains

Do not change these merely to make a test, route, source qualification or UI state pass:

- solver formulation;
- stiffness/load assembly;
- element/result recovery convention;
- local/global coordinate, sign or end-I/end-J convention;
- load/moment reference-point transport;
- governing code methodology;
- WRC/EMP.1/LAFEA applicability/source authority;
- benchmark/oracle authority or tolerances;
- engineering master-data authority;
- Product/Project/source/default precedence where governed;
- result semantic hashes and evidence custody;
- publication/trust/release/deployment authority;
- workflow files unless explicitly authorized.

A presentation/UI fix may not silently alter numerical/result-contract authority. A source-governance fix may not silently authorize production numerics.

## Project validation / benchmark entrypoints

Use the focused validator/benchmark owned by the changed engineering boundary first, then the applicable repository regressions.

Common project-wide checks used when relevant include:

```bash
node scripts/run-non-fea-checks.mjs
npm run check:imports
node scripts/advanced-shell-contract-check.mjs
npm run build
git diff --check
```

Domain-specific WRC/EMP.1/LAFEA/load-calc source, runtime, routing, hand-calc and oracle checks remain authoritative only for the scope they explicitly exercise.

Always preserve truthful `PASS | FAIL | NOT_RUN | NOT_APPLICABLE`. A zero-step workflow, unavailable runner, source inspection, mergeability result, or failed network transport is not executable engineering PASS.

## Project-specific engineering diagnosis expectations

When a numerical discrepancy is under investigation, isolate the first wrong engineering boundary before changing production. Depending on the domain, preserve and inspect actual inputs, geometry/topology, load/reference-point transfer, solver/recovery quantities, transformations, result contracts and presentation separately.

Do not modify several mechanics at once when a single-factor falsifier can isolate the discrepancy.

## Project-specific AUTO hard stops

AUTO progression must stop when continuing requires an unapproved change to:

- solver formulation or stiffness/load assembly;
- recovery or coordinate/sign/end convention;
- governing code or engineering methodology;
- source/applicability authority;
- benchmark/oracle/tolerance authority;
- engineering master-data authority;
- result publication/trust/release/deployment authority;
- another active chain's protected engineering domain.

An independent analytical/reference/cross-solver contradiction may authorize bounded diagnosis, not automatic authority change.

## Project-specific scope / release restrictions

Keep engineering PRs surgical and explain every changed file. Do not silently broaden from presentation to numerics, from source qualification to production authorization, or from one engineering domain into EMP.1/WRC/LAFEA/load-calc neighbors.

Workflow-file changes require explicit authorization.

Merge/release authority is governed by the live Common protocol plus any stricter current Owner instruction; this overlay does not weaken it.
