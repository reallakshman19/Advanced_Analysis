# PLAN_UPDATE — Requested load quantities and current-run scope

RESPONSIBILITY: owner-direct:advanced-analysis:sjson-routine-run-auto-20261001
PROTOCOL_REF: reallaksh19/Common@149770a21ca073df49717a96e2106c967adddc2d:skills/engineering-pr-delivery-v3.2
Date: 2026-10-02. Continue FULL_VECTOR_LOADS, same 3-unit denominator; 1 complete.

Observed first boundary is method selection/scope, not missing pipe weight:
normal Current Common Input Run chooses qualified V2/V3 scalar gravity kernels.
They do not produce globalReaction or anchorDecomposition. Existing scenario
results consume method-owned forceN/momentNm and rest/guide/lineStop projections;
scenario configuration/authorization and restricted-domain qualifications are separate.
Fh has no established producer/definition in the accepted workbench spec section 9.2.
Source reference zero forces are not computed reactions.

Bounded material leg: add a presentation-only requested-quantity coverage panel to
normal gravity Results and correct its hardcoded Z-up heading to the actual bound
source axis. It must report available scalar vertical rows with current/historical
status, unit, method and sign; explicitly distinguish Fv rest-basis projection,
Fh, Fa, Fl and global moments from scalar vertical/route-chainage moment demands.
Do not derive missing horizontal values as zero, relabel transfer demand as MX/MY/MZ,
consume reference source forces as reactions, or silently execute a different method.

Falsifiers: existing current-system pane lacks requested-quantity scope; bound X/Y-up
distribution is mislabeled source Z-up. Tests before/after, finite zero vs missing,
failed/unknown/stale row handling, malicious labels escaping, input immutability,
unchanged receipt/numerical content and existing routing/statics/scenario regressions.
Browser: restore approved Sjson inputs if reload, normal Run, inspect new scope and
exact vertical/support quantities; selection must preserve current evidence.

No new result contract/schema, formulas, DOFs, Fh definition, sign/reference-point
transformation, publication/qualification/oracle/engineering master authority.
No new qualification questions. Before any future full-vector integration, diagnose
existing scenario source-binding/applicability and required real engineering inputs.
This disclosure step alone does not complete FULL_VECTOR_LOADS or earn progress.
