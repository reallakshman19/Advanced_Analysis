# QS-ADV-LAFEA4-A3-1761-0001 — FEA qualification questions

SCOPE: CST/DKT independent mechanics and recovery V&V for issue #1761.
STATUS: CURRENT

## Q1 — Discrete Kirchhoff edge constraint
Derive the retained DKT edge-midpoint normal rotation from zero transverse shear at the midpoint. For edge length L with transverse values wi,wj and endpoint normal rotations theta_n,i/theta_n,j, show the chord-slope term and explain why the naive endpoint average is not generally valid. Falsifier: a nonuniform-curvature case must distinguish the two constructions.

## Q2 — CST membrane completeness and frames
For a nontrivial affine field with epsilon_x, epsilon_y and gamma_xy nonzero, independently derive plane-stress stress and membrane resultants N=sigma*t. Repeat under physical in-plane rotation and require local/global tensor covariance rather than direct global-to-local component comparison.

## Q3 — DKT bending, recovery and thickness scaling
From D=E*t^3/[12(1-nu^2)] and the declared engineering twist convention, derive bending/twisting resultants for constant curvature, then derive TOP/BOTTOM stress from epsilon(z)=epsilon_m+z*kappa. Verify membrane contamination near zero, sign reversal, and t^3 stiffness scaling. Falsifiers: swapped faces and injected membrane strain.

## Q4 — Independent published reference and source custody
Execute the frozen Batoz-Bathe-Ho twisting-square definition without changing geometry, signs, values or tolerances after observing production. Retain DOI/page/figure custody and separate published-reference evidence from analytical patch evidence. Falsifier: any output-fitted value or tolerance invalidates the oracle.

## Q5 — Applicability and safe-patch boundary
Use a moderate t/L≈0.2 diagnostic to distinguish absence of shear locking from omission of real transverse-shear compliance. Explain the expected Kirchhoff over-stiffness/under-deflection direction. Safe-patch decision is NO-PATCH unless an independent oracle identifies a first wrong CST/DKT mechanics/recovery boundary; no MITC switch, weak spring, drilling penalty, tolerance relaxation or thick-shell claim is permitted to manufacture PASS.
