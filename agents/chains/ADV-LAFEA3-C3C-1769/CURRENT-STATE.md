# ADV-LAFEA3-C3C-1769 — Current State

STATUS: G002_BODY_FORCE_STRAIGHT_REGION_CANDIDATE_PENDING_EXACT_HEAD_QUALIFICATION

## Main-current dependency state

- Common protocol basis: `734286a3da99133c0f16faa29bb641103e29ada0`.
- C3-B PR #1782 merged to `main` as `2170593fe8155cf2cacd9fd810b989171c41195f`; issue #1766 is closed completed.
- Prior C3-C PR #1789 merged to `main` as `ea2a2e5842a5ae1931544b20f7dcb97184d7cec1` under explicit Owner authorization.
- This body-force batch branches directly from `main@ea2a2e5842a5ae1931544b20f7dcb97184d7cec1`.

## Validation truth carried forward

- C3C-G001 projection custody: previously qualified bounded.
- C3C-G002 constant + source-linear straight-traction `Fx/Fy/Mz`: previously qualified bounded.
- C3C-G003 source-linear traction T6/Q8: previously qualified bounded.
- C3C-G004 source-pressure primitive: previously exact-head qualified.
- C3C-G004 ordinary compiler/resultant wiring is merged on `main`, but its hosted exact-head campaign remains `NOT_RUN_INFRASTRUCTURE`: every carrier attempt ended before any job step materialized. Merge did not convert that state to PASS.
- C3C-G005 ΔT semantics remain fail-closed.
- C3C-G006 local-feature support/roller semantics remain open.

## Current material batch — remaining G002 body-force invariant

Source basis: `C3C-SOURCE-BASIS-0011`.

The candidate changes evidence/custody only:

1. REGION projection now retains canonical oriented source-boundary loops and physical segment endpoints.
2. Source body-force resultants are independently derived from straight source-region area and first moments using oriented boundary geometry.
3. The compiled side reuses the unchanged governed `consistentBodyForceVector` and verifies projection-owned body-force contribution IDs.
4. Source-vs-compiled `Fx`, `Fy`, and `Mz` must agree; the source receipt retains area and centroid.
5. T6 and Q8 ordinary compiler routes are covered.
6. A force-preserving, moment-breaking negative control is included for the two-element T6 rectangle.
7. Curved-region body-force certification remains explicitly fail-closed (`CURVED_REGION_BODY_FORCE_RESULTANT_CERTIFICATION_PENDING`).

No element formulation, solver, body-force quadrature, mesh quality threshold, benchmark oracle/tolerance, pressure/traction mechanics, recovery authority, release authority, or workflow authority is changed.

## Exact next action

Open one draft product PR to `main` and execute the full C3-C aggregate on one exact candidate through a never-merge workflow carrier. Require source custody plus all named gates, including `C3C-BODY-FORCE-RESULTANT`, to PASS before promoting this bounded body-force claim. If GitHub Actions again produces zero steps, retain `NOT_RUN_INFRASTRUCTURE` and do not merge this candidate merely because GitHub reports it mechanically mergeable.
