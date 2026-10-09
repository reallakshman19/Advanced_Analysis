# PLAN_UPDATE — explicit reviewed zero equipment weights

Responsibility: owner-direct:advanced-analysis:sjson-routine-run-auto-20261001
Protocol: reallaksh19/Common@149770a21ca073df49717a96e2106c967adddc2d:skills/engineering-pr-delivery-v3.2

Owner amendment: assign weight=0 to the seven pending equipment items (51274,
51284, 51462, 51463, 51476, 51483, 51485 under =1006649732/).
This supersedes their review-only skips. It does not change pipe/fitting
derivation, source precedence, mechanics, scenario qualification or publication.

Implementation: allow explicit numeric zero in the catalogue review, while
blank/whitespace/negative/nonfinite inputs remain unstaged. Record zero as an
ACCEPTED_OVERRIDE with an explicit zero-weight assumption, not master evidence.
Omit these current accepted zero overrides from the pending review; retain the
existing catalogue-positive and stale/tamper/conflict guards.

Validation: focused review regression with zero/blank/negative and resolver
custody; imports, shell contracts, build and diff. In retained browser14, enter
and accept seven zeros, preserve the original196 records, export the203-record
sidecar, revalidate and execute the existing gravity Run. Trace the first actual
remaining blocker without fabricating scenario authority or full-vector loads.

Outcome units remain EXCEPTION_REVIEW, FULL_VECTOR_LOADS, RUNNABLE_WORKBENCH;
no completion credit from starting this leg or from input coverage alone.
