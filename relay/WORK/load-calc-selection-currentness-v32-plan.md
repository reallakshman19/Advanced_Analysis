# PLAN_UPDATE — Selection preserves current calculation

RESPONSIBILITY: owner-direct:advanced-analysis:sjson-routine-run-auto-20261001
PROTOCOL_REF: reallaksh19/Common@149770a21ca073df49717a96e2106c967adddc2d:skills/engineering-pr-delivery-v3.2
Date: 2026-10-02

Continue EXCEPTION_REVIEW, same declared three-outcome denominator. Prior evidence
records actual selection causing STALE without an engineering edit. Dirty work
and historical records remain preserved; no new issue/PR identity or external write.

First wrong boundary candidate: DatasetController.select publishes a workspace
snapshot (correct UI notification); SharedModelController publishes source CHANGED
unconditionally, even though immutable dataset, shared model and engineeringVersion
are identical. TopologyController then clears/rebuilds, causing real authority
invalidation subscribers to run. Do not weaken those subscribers or hash custody.

Falsifier first: replay real DatasetController/WorkspaceState/SharedModelController/
TopologyController/ModelLoadController/SupportRestraintController on Sjson with
event tracing and the real EngineeringModelController invalidation path. Selection
must change only UI revision and exact selected entity, not emit source/authority
changes or stale seal/result. Demonstrate failure before production edit.

Bounded fix: source publication memo on immutable dataset/model identity plus
engineering revision, not a semantic-hash equality bypass. Source replacement,
patch, load/clear and controller lifecycle must still publish; explicit topology,
support and load rebuild events must still invalidate. First empty publication
must remain observable. Preserve UI selection snapshot/event for all UI consumers.

Validation: new focused reproduction/regression; existing current-run routing,
runtime, static/partial accounting and exception review; imports/shell/build/diff.
Actual browser: restore approved inputs if HMR clears session, run Sjson, select
exception and support rows; require same current receipt/hashes/case values without
rerun. Real edits remain invalidating via focused tests and a reversible browser
input edit if a suitable ordinary input exists. Record each verification separately.

No numerics, supports, engineering applicability, oracle/tolerance, input precedence,
hash functions, trust/release or workflow changes. No qualification questions.
Finish scoped STEP evidence; credit EXCEPTION_REVIEW only after integration passes.

Negative browser check found a second first-wrong-boundary: applying 1 mm Preview
insulation to =1006649732/51207 marks the retained seal stale, but the engineering
controller observes only configuration differences and leaves result/receipt CURRENT.
Extend that existing central subscriber to invalidate CURRENT results when the
store reports stale authority, without re-marking the seal or recursive notification.
Evaluation/sealing/current receipts with unchanged configuration remain non-invalidating;
repeated stale notifications must not repeatedly invalidate an already-stale result.
Focused before/after falsifier plus actual browser Apply/reset/rerun are required.
This preserves existing stale semantics; no numerical or source authority change.
