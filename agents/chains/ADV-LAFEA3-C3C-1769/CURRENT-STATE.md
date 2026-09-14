# ADV-LAFEA3-C3C-1769 — Current State

STATUS: G004_COMPILER_CANDIDATE_PINNED_NOT_RUN_INFRASTRUCTURE

## Dependency state

C3-B PR #1782 is candidate-qualified at `6d7d099b201029e42e64927d932c2a2f14bef471` but remains draft / owner-gated. This C3-C branch is stacked on that exact dependency and must not be promoted independently.

Reviewed repository `main` remains `41df6e945789273fc327aaeca6686529a9ad8b39`.

## Qualified C3-C state

- baseline compiler/currentness/probe route: qualified;
- C3C-G001: hash-addressed source-feature → mesh → compiled-contribution projection custody qualified;
- C3C-G002: source-vs-compiled `Fx/Fy/Mz` qualified for constant and source-linear straight-segment traction; body-force resultant certification remains open;
- C3C-G003: `LINEAR_SOURCE_SEGMENT_TRACTION_V1` qualified on T6/Q8 with source-coordinate interpolation, exact equivalent nodal-load oracle, force/moment preservation, split-edge invariance, and fail-closed off-source geometry;
- C3C-G004 primitive: source-geometry pressure lowering qualified for LINE/CIRCULAR_ARC, T6/Q8 quadratic edge distribution, OUTER/HOLE orientation, exact independent force/moment oracle, split-edge invariance, and fail-closed geometry.

Last qualified G004-primitive basis: `C3C-SOURCE-BASIS-0009` at `ec5ec819ab889020f17c803718451d1d8673a223`.

## Current G004 compiler candidate

Source basis `C3C-SOURCE-BASIS-0010` is pinned at product head `db2be9d3265738c3911ee8e0b606237a8a14dcf6`.

The candidate:

- keeps the lower-level kernel `pressureLoads` implementation unchanged;
- changes the ordinary source-feature PRESSURE compiler route to use the already-qualified source-pressure primitive and emit consistent nodal forces;
- requires retained SEGMENT projection/source geometry before pressure lowering;
- binds pressure projection custody to every generated nodal contribution ID;
- retains source-normal lineage in each compiled nodal-force `sourceReference`;
- extends load-resultant evidence to independently compare exact source `Fx/Fy/Mz` with compiled pressure nodal terms;
- covers LINE/CIRCULAR_ARC and explicit OUTER/HOLE loop roles;
- adds a registered-annulus T6/Q8 compiler qualification check using the existing B02D V2 retained-mesh producer;
- preserves the existing straight compiled-load parity check as a regression control.

No element formulation, solver, kernel pressure integration/quadrature, mesh threshold, benchmark oracle/tolerance, response/stress authority, workflow authority, or release authority changed.

## Execution truth

`NOT_RUN_INFRASTRUCTURE` for the exact-head G004 compiler campaign.

Diagnostic carrier PR #1798 is a never-merge workflow-only carrier. The first focused run `34799270230` / job `103838440728` and the `C3C-SOURCE-BASIS-0010` retry `34799495527` / job `103839099387` both failed before any job step materialized. Concurrent unrelated repository EMP.1 workflows showed the same zero-step failure pattern. These runs are not classified as engineering FAIL and do not qualify G004.

Two transient placeholder files were accidentally written to the product branch during carrier setup and immediately deleted before candidate pinning. Neither file exists in the candidate tree; #1789 changed-file inventory contains no workflow or placeholder file. No qualification evidence uses those transient commits.

## Remaining governed gaps

- C3C-G004: exact-head execution of the compiler/resultant candidate is still pending; do not promote source-normal pressure compiler authority before PASS.
- C3C-G002: body-force resultant certification remains open.
- C3C-G005: domain-first temperature ΔT remains fail-closed pending governed thermal-expansion/reference-temperature authority.
- C3C-G006: local-feature roller/support semantics remain open; current ordinary restraint semantics are global UX/UY.

## Exact next action

Re-run the never-merge #1798 exact-head carrier against `db2be9d3265738c3911ee8e0b606237a8a14dcf6` when GitHub Actions can start jobs. Require source custody plus every named C3-C gate and the aggregate receipt to PASS on that one head. If an engineering gate fails, the first failing named gate controls the repair. If all pass, advance the source basis once to record the exact PASS, replay on that metadata head, then promote G004 only within its bounded compiler/resultant claim.
