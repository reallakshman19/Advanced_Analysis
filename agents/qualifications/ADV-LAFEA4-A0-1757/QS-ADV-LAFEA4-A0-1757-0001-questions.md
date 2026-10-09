# QS-ADV-LAFEA4-A0-1757-0001 — A0 architecture/authority takeover qualification

QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: FEA
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_SCOPE_ID: QSCOPE-ADV-LAFEA4-A0-1757-ARCHITECTURE-AUTHORITY
QUESTION_SET_ID: QS-ADV-LAFEA4-A0-1757-0001
QUALIFICATION_BASIS_HEAD: 41df6e945789273fc327aaeca6686529a9ad8b39
QUESTION_SET_STATUS: CURRENT
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE

## Q1 — Production trace
Domain challenge: Reconstruct the current LAFEA.4 public production route without using historical issue prose as authority.
Repository anchors: `src/workspace/lafea-stage-registry.js`, `lafea-stage-composition-bindings.js`, `lafea-stage-components.js`, `src/core/local-shell/calculate.js`, `mitc-production-model.js`, `mitc-production.js` at `41df6e945789273fc327aaeca6686529a9ad8b39`.
Exact repository data required: `LAFEA.COMPOSITION.THIN_SHELL/V1`, `LOCAL_SHELL_MODEL_V1_OR_V2`, `local-shell-model/v2`, `CST_DKT_TRI3_V1_PLUS_MITC4_QUAD4_MITC3_TRI3_PRODUCTION_DISPATCH`, `RELEASE_NOT_QUALIFIED`.
Concrete payload: Trace one v1 CST/DKT model and one v2 MITC model from stage normalization/canonicalization to `calculateLocalShell`, schema dispatch, result acceptance and release-state binding.
Required derivation: Produce an owner/function/schema table for every transition and identify where v1 and v2 diverge and where they reconverge.
Fail if: file existence is used as proof of production dispatch; numerical acceptance is equated with release qualification; presenter/UI is treated as mechanics authority.

## Q2 — Current unresolved problem / failure isolation
Domain challenge: Distinguish runtime dispatch, calculation qualification and release qualification.
Repository anchors: `src/core/local-shell/calculate.js`, `mitc-production.js`, `mitc-production-model.js`, `src/workspace/lafea-stage-composition-bindings.js`.
Calculation/reconstruction: Build the exact state table for a valid MITC v2 load case that passes residual/equilibrium/energy checks.
Concrete payload: `MITC_PRODUCTION_ROUTE_STATUS='PRODUCTION_ROUTE_REGISTERED'`; `MITC_PRODUCTION_QUALIFICATION_STATE='PENDING_EXECUTABLE_VALIDATION'`; result `qualification.accepted=true`; `productionQualification.qualifiedForRelease=false`; `productionQualification.evidenceState='NOT_RUN'`; composition `releaseStateBinding='RELEASE_NOT_QUALIFIED'`.
Required numerical/technical evidence: Show which booleans/states may be simultaneously true and why there is no contradiction. Identify the first wrong authority boundary in the statement “MITC is production-dispatched, therefore LAFEA.4 is release-qualified.”
Predicted intermediate values: runtime dispatch TRUE; load-case numerical acceptance TRUE for a valid solved case; release qualification FALSE; release evidence NOT_RUN.
Falsifier: Any live source at the pinned head setting release qualified true or bypassing v2 schema dispatch.
Fail if: accepted/registered/qualified-for-release are collapsed into one status.

## Q3 — Authority / invariant
Domain challenge: Reconcile stale roadmap/issue descriptive status with executable current source while preserving roadmap intent.
Repository anchors: `docs/conceptcumroadmapLAFEA.md@088f4cebfd954e5d1e37da855c95142712463a31`, `docs/IntegratedLAFEAroadmap.md@fe93b134c2dd467105dc6dbbe39ed838a468649a`, Issue #1757, live registry/components/core files.
Exact repository data required: roadmap precedence clause saying executable source/exact-head evidence outranks historical plans; stale roadmap claims that MITC is benchmark-only versus live v2 production dispatch.
Concrete payload: Classify at least five statements from #1536/#1712/current roadmaps as CURRENT, SUPERSEDED, HISTORICAL or OPEN_REQUIREMENT and cite the live owner for each.
Required derivation: Separate owner intent (release fail-closed, no drilling/nonlinear/code claim) from stale observed status (MITC not exported/dispatched, dense-only shell route).
Protected invariant: A descriptive status correction cannot grant mechanics, benchmark, source, tolerance or release authority.
First wrong boundary: authority classification / stale observed-status interpretation.
Falsifier: a live source or exact-head retained evidence contradicting the proposed classification.
Invalid shortcut: editing the roadmap or registry to make prose and code agree during A0.
Fail if: A0 mutates the roadmap, mechanics, or release state rather than recording drift.

## Q4 — Independent validation
Domain challenge: Demonstrate an independent shell load oracle and keep it separate from production-route evidence.
Repository anchors: Issue #1712 pressure fixture ancestry plus current pressure/load benchmark scripts inventoried under A0.
Calculation/reconstruction: For a planar TRI3 facet with area `A=120 mm^2` under uniform pressure `p=2 MPa`, derive the consistent corner loads and total resultant.
Concrete payload: `1 MPa = 1 N/mm^2`; `pA=240 N`; linear TRI3 constant-pressure consistent share `pA/3=80 N` per corner along the declared element normal.
Required derivation: Derive `f_i=∫_A N_i p n dA = pA/3 n`, show `Σf_i=240 n N`, and state how the first moment about a declared reference point is checked independently. Explain why this analytical oracle can validate load mapping but cannot by itself qualify MITC bending, sparse solve, product UI or release.
Independent oracle: closed-form finite-element load integration / free-body equilibrium, not production output.
Units/sign/tolerance: N, mm, MPa; normal direction must be explicitly declared; force and moment tolerances must be predeclared by the owning benchmark.
Falsifier: total force correct but first moment wrong, or reversed/undeclared normal.
Fail if: production output is used to generate its own expected force/moment or the check is cited as release qualification.

## Q5 — Next contribution / minimal patch
Domain challenge: Decide whether A0 authorizes a source patch when live source and historical issue/roadmap prose disagree.
Repository anchors: Issue #1757 NO-PATCH boundary, live registry/components/local-shell source, A1-A7 issue map #1758/#1759/#1761/#1763/#1764/#1767/#1770.
Concrete payload: Current source proves MITC v2 production dispatch and release false; stale issue/roadmap prose says benchmark-only/nonproduction.
Required derivation: Name the smallest legitimate A0 contribution and map any discovered geometry/load/mechanics/solver/product/release defect to exactly one child owner.
Safe patch boundary: architecture/authority record, issue-state/handover custody, benchmark inventory and reconciliation only.
Expected before/after evidence: before—conflicting historical descriptions; after—one exact-head reconciliation record with no production numerical diff.
Protected unchanged domains: element formulation, stiffness/load assembly, mesh algorithms, solver tolerances, recovery convention, benchmark expected values/tolerances, workflow, roadmap authority, release flags.
Validation required: source/hash trace and exact-head status classification; executable checks remain PASS/FAIL/NOT_RUN truthfully.
Negative test: if a numerical benchmark fails, A0 records the first wrong boundary and hands it to the owning child rather than fixing it.
Rollback/falsifier boundary: any A0 commit touching protected numerical/authority domains invalidates the leg.
No-patch condition: stale prose/status with correct live runtime behavior.
Fail if: the candidate proposes a numerical “cleanup” or release promotion inside A0.
