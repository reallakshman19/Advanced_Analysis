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

Source basis `C3C-SOURCE-BASIS-0010` was materially pinned at `db2be9d3265738c3911ee8e0b606237a8a14dcf6`. Subsequent commits on #1789 are control-plane/current-state only; they do not change any source-basis-pinned engineering or qualification blob. Exact-head execution must nevertheless target the then-current #1789 head, not the older material-pinning SHA.

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

Diagnostic carrier PR #1798 is a never-merge workflow-only carrier. Every observed attempt has failed before any job step materialized:

- run `34799270230` / job `103838440728` — zero steps;
- run `34799495527` / job `103839099387` — zero steps;
- run `34799746351` / job `103839825024` — zero steps;
- run `34814830048` attempt 1 / job `103883221135` — zero steps;
- direct connector re-run of the same exact job, run `34814830048` attempt 2 / job `103883346172` — zero steps and no log blob.

No checkout, source-custody check, or engineering command ran in those attempts. Concurrent unrelated repository workflows have shown the same zero-step failure pattern. These attempts are infrastructure failures rather than engineering FAIL evidence and do not qualify G004.

Two transient placeholder files were accidentally written to the product branch during carrier setup and immediately deleted before candidate pinning. Neither file exists in the candidate tree; #1789 changed-file inventory contains no workflow or placeholder file. No qualification evidence uses those transient commits.

## Remaining governed gaps

- C3C-G004: exact-head execution of the compiler/resultant candidate is still pending; do not promote source-normal pressure compiler authority before PASS.
- C3C-G002: body-force resultant certification remains open.
- C3C-G005: domain-first temperature ΔT remains fail-closed pending governed thermal-expansion/reference-temperature authority.
- C3C-G006: local-feature roller/support semantics remain open; current ordinary restraint semantics are global UX/UY.

## Exact next action

Resolve the then-current #1789 head and re-run never-merge carrier #1798 against that exact SHA when GitHub Actions can actually create job steps. Prefer a direct re-run of the existing carrier job before creating another carrier commit when the carrier already targets the exact product head. Require source custody plus every named C3-C gate and the aggregate receipt to PASS on one exact head. If an engineering gate fails, the first failing named gate controls the repair. If all pass, advance the source basis once to record the exact PASS, replay on that metadata head, then promote G004 only within its bounded compiler/resultant claim.
