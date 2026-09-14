QUALIFICATION_PROFILE: FEA
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_SCOPE_ID: QSCOPE-ADV-LAFEA4-A4-1763-MITC-PRODUCTION-QUALIFICATION
QUESTION_SET_ID: QS-ADV-LAFEA4-A4-1763-0001
QUESTION_SET_STATUS: CURRENT
OWNER_BASELINE: QB-ISSUE-1763-A

# A4 takeover qualification — MITC3/MITC4 production qualification

## Q1 — Production Trace

Domain challenge: Reconstruct the explicit current MITC4/QUAD4 and MITC3/TRI3 public production route and prove there is no silent topology/formulation fallback.

Exact repository data required: `src/core/local-shell/calculate.js`, `mitc-production-model.js`, `mitc-production.js`, `mitc4-element.js`, `mitc3-element.js`, and the LAFEA.4 stage composition/registry binding. Use formulation identities `MITC4_QUAD4_SHELL_V1` and `MITC3_TRI3_SHELL_V1`, v2 model/result schemas, and current production/release-qualification fields.

Concrete payload: for the distorted QUAD4 with local coordinates `(0,0),(4,0),(5,3),(0,2)` mm, use the natural center `(xi,eta)=(0,0)`. MITC4 has 5 DOF/node `[u,v,w,betaX,betaY]`, 20 element DOF and tying points A(0,-1), B(1,0), C(0,1), D(-1,0). MITC3 has 15 element DOF and edge-midpoint tying points A(1/2,0), B(0,1/2), C(1/2,1/2). Both use `k=5/6`.

Required derivation: compute the Q4 center Jacobian explicitly and obtain `J=[[2.25,0.25],[0.25,1.25]]`, `det(J)=2.75>0`; then trace one v2 MITC4 model through public dispatch -> canonical production model -> mechanics model -> assembly/solve -> recovery -> `local-shell-result/v2`, identifying where formulation/topology mismatch must reject rather than fall back. Repeat the identity/fallback reasoning for MITC3/TRI3.

Falsifier: any route that accepts QUAD4 with MITC3, TRI3 with MITC4, or silently returns CST/DKT while preserving a MITC production identity fails Q1.

## Q2 — Current Unresolved Problem / Failure Isolation

Domain challenge: Establish the MITC-specific physical transverse-shear oracle and distinguish real shear compliance from thin-limit shear locking; CST/DKT may be a secondary thin-limit comparator only.

Exact repository data required: current MITC4/MITC3 shear B-matrix/stiffness owners, existing MITC cantilever/adoption checks, production recovery energy split, and A3 CST/DKT thin-shell disposition.

Concrete payload: Timoshenko beam strip with `E=200000 MPa`, `nu=0`, `G=100000 MPa`, `L=10 mm`, `b=1 mm`, `P=1 N`, `k=5/6`, `t=2 mm`. Use `A=bt=2 mm^2` and `I=bt^3/12=2/3 mm^4`.

Calculation/reconstruction: independently compute Euler-Bernoulli bending deflection `delta_b = PL^3/(3EI) = 0.0025 mm`, shear deflection `delta_s = PL/(kGA) = 0.00006 mm`, total `delta_T = 0.00256 mm`, and shear fraction `delta_s/delta_T = 2.34375%`. Then state the expected direction of error for a Kirchhoff-only model and the required MITC energy split. Extend the reasoning dimensionlessly to the issue sweep `t/L=1e-5...0.2` without choosing tolerances from production output.

Required derivation: explain from the tied shear interpolation why an acceptable MITC sequence must suppress spurious shear energy as `t/L -> 0` while retaining the nonzero physical shear contribution at moderate thickness. Identify the first wrong boundary if the `t/L=0.2` result misses the frozen analytical reference: source/units -> geometry/basis -> beta/tying -> load/BC -> B/strain -> constitutive -> solve -> recovery/frame.

Falsifier: CST/DKT and MITC agreeing with each other while both disagree with the independent analytical reference is FAIL, not parity PASS.

## Q3 — Authority / Invariant

Domain challenge: Prove the physical-rotation-to-MITC-slope sign convention and rigid-body objectivity, and preserve the semantic boundary between transverse shear and in-plane/surface stress authority.

Exact repository data required: current MITC adoption/production transformation and recovery owners, `mitc4-element.js` / `mitc3-element.js` shear kinematics `gamma=[betaX+dw/dx,betaY+dw/dy]`, and the production fields `transverseShearAuthority` plus `transverseShearIncludedInInPlaneVonMises`.

Concrete payload: use a local infinitesimal rigid rotation `omega=(0.002,-0.001,0.003)` rad. For a flat local midsurface, `w(x,y)=omega_x*y-omega_y*x`, so `dw/dx=0.001` and `dw/dy=0.002`. The corrected mapping is `betaX=omega_y=-0.001`, `betaY=-omega_x=-0.002`.

Required derivation: show `gamma_xz=-0.001+0.001=0` and `gamma_yz=-0.002+0.002=0` under the corrected mapping. Then evaluate the wrong adapter `betaX=omega_x=0.002`, `betaY=omega_y=-0.001` and obtain spurious shear `[0.003,0.001]`; explain why this must create nonzero shear energy for positive `kGt`. Trace how local/global rotation changes components but not the zero rigid-body invariant.

Falsifier: folding `kG*gamma` transverse-shear stress into the existing in-plane von Mises/surface membrane+bending authority to make a parity check look better is an authority violation.

## Q4 — Independent Validation

Domain challenge: Independently validate distorted-Q4 consistent pressure by both resultant force and first moment; this oracle must not reuse production quadrature output.

Exact repository data required: A2 pressure authority plus current MITC pressure integration and production load/equilibrium evidence. Use the same distorted Q4 coordinates `(0,0),(4,0),(5,3),(0,2)` mm under uniform `p=2 MPa` in +local-z.

Concrete payload: independent consistent nodal area weights are `[5/2,17/6,3,8/3] mm^2`; polygon area is `11 mm^2`; therefore nodal forces are `[5,17/3,6,16/3] N` and total force is `22 N`. The polygon centroid is `(79/33,43/33) mm`.

Calculation/reconstruction: from `r x F`, independently obtain total first moment about the origin `M=(86/3,-158/3,0) N*mm`. Verify the nodal-force first moment reproduces the same vector. Then describe a negative that adds `+1000 N*mm` to one retained moment component without changing force and require force-equilibrium PASS but moment-equilibrium FAIL.

Required derivation: connect the independent force/moment result to the current undeformed-reference pressure convention; state why this does not grant follower-load or finite-rotation pressure authority. For rotated elements, transform the analytical tensor/vector into the element frame before component comparison per the PR #1632 principle.

Falsifier: a pressure implementation with correct `22 N` total force but incorrect first moment fails A4 even if displacement looks plausible.

## Q5 — Next Contribution / Minimal Patch

Domain challenge: Decide the smallest legitimate A4 contribution from current evidence and define the exact NO-PATCH boundary before changing protected mechanics.

Exact repository data required: A4 stack base `bd25d9edb55786a7358ae3abccd016bb96cf176e`, live main `41df6e945789273fc327aaeca6686529a9ad8b39`, current `mitc-production.js` release fields (`qualifiedForRelease:false`, `contributesToLafea4ReleaseQualification:false`, `evidenceState:'NOT_RUN'`), existing adoption/production checks, and Issue #1763 diagnosis order.

Concrete payload: current element contracts expose MITC4 `20` DOF, MITC3 `15` DOF, both `k=5/6`; production numerical qualification may be accepted per load case while release qualification remains false. Required A4 benchmark IDs include `LAFEA4-CYL-01`, `LAFEA4-PRESS-01`, `LAFEA4-COMB-01` and MITC-B1...B9.

Required derivation: justify a qualification-first contribution that adds/fixes only independent A4 evidence until a real failing oracle identifies one wrong owner. If a failure is found, name the first owning function/file, the single-factor repair, unchanged authority domains, focused regression, rollback falsifier and why no registry/release change follows automatically.

NO-PATCH condition: if the independent objectivity, shear, pressure, distortion and production-route evidence passes, do not change formulation, tying points, shear correction, constitutive law, solver tolerance, oracle values/tolerances or release flags merely to create activity.

Falsifier: changing `qualifiedForRelease`, tuning `k`, or fitting an expected value/tolerance to the observed MITC result before an independent contradiction is an invalid A4 contribution.
