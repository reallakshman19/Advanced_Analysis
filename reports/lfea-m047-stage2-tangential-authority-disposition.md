# M047 Stage 2 — tangential friction authority disposition after R8/R9

Status: **RCA boundary update; no production friction promotion.**

This report records the source/evidence boundary after the measured R8/NFV15 and R9/FAV15 discriminators, and after landing the separate L1 hydrotest-insulation correction. It does not alter production friction mechanics and does not publish a new benchmark accuracy result.

## 1. Inter-case nonlinear-state carryover is not CAESAR II static authority

An earlier R7 hypothesis kept open the possibility that CAESAR II might carry friction/restraint state from one static load case into another because the pinned ACCDB contains no execution-history table.

That hypothesis is now **rejected as a CAESAR-authoritative mechanism** by Hexagon's own documentation.

Hexagon, *Sustained Stresses and Nonlinear Restraints*, explicitly contrasts CAESAR II with software that runs an operating case and reuses that restraint configuration for later cases. CAESAR II instead incorporates nonlinear restraints by **considering each load case independently**, determining the restraint configuration for each load case from the loads present in that case.

Engineering consequence:

- do not implement L13→L7, L7→L13, or other shared static-case friction-state transfer as a CAESAR parity hypothesis;
- do not use missing ACCDB execution logs as permission to fit an inter-case sequence;
- L15 remains an algebraic result from independently converged L7 and L13 states, never a third nonlinear solve.

This does not rule out path/basin sensitivity **inside one static load case**. Hexagon's friction discussion itself notes that dry-friction systems can admit multiple static equilibrium positions. It does rule out using a guessed previous static load case as the governing initial friction state.

## 2. R8 / Friction Normal Force Variation is closed by measurement

R8/NFV15 changed only the documented 15% retained-normal sliding-capacity rule and was measured locally against the pinned real L13 ACCDB.

Measured decision already committed on the R8 branch:

- production R2: 23/23 normals, 13/23 tangential vectors within ±10%;
- R8/NFV15: 23/23 normals, 9/23 tangential vectors;
- nonlinear gates/equilibrium passed;
- R8 rejected at L13; L7/L15 were correctly not run.

R8 must not be combined with subsequent friction hypotheses.

## 3. R9 / Friction Angle Variation is not nominated

Hexagon documents `Friction Angle Variation` with a default of 15 degrees and states that it is currently used only on the first iteration in which a restraint changes from non-sliding to sliding; subsequent iterations compensate for angle variation automatically.

The isolated R9/FAV15 branch measured a bounded first-transition discriminator on real pinned L13. Its committed result is:

- production R2: 23/23 normals, 13/23 tangential vectors within ±10%;
- R9/FAV15: 23/23 normals, 13/23 tangential vectors within ±10%;
- worst tangential vector relative error decreased from 7.219149 to 6.832354;
- only one observed 2-D transition was limited: node 21800 at iteration 16, 18.907989 degrees to 15 degrees;
- nonlinear gates/equilibrium passed;
- frozen pass count did not improve, so R9 is not nominated and L7/L15 are not run.

Important authority limitation: Hexagon's public documentation gives the value and first-transition scope but does **not** publish the exact proprietary direction-interpolation algorithm. The committed R9 implementation is therefore a bounded discriminator, not a declaration of CAESAR's internal algorithm. Its no-count-improvement result is useful negative evidence; it does not authorize broader FAV guessing.

## 4. Friction Slide Multiplier is not an admissible tuning knob

Hexagon documents `Friction Slide Multiplier` as an internal friction sliding force multiplier and instructs users not to adjust it unless directed by Hexagon Support.

Therefore it is explicitly excluded from benchmark fitting/tuning in M047 Stage 2.

## 5. Remaining measured tangential problem

The accepted production R2/D1 baseline remains:

- L13: 13/23 tangential vectors, 23/23 normals within ±10%;
- L7: 10/23 tangential vectors, 22/23 normals within ±10% on the previously measured production basis;
- corrected L1 HYD load basis: previously measured candidate 7/23 tangential vectors while normal parity improves to 22/23.

The L1 hydrotest-insulation correction is now a separate real source edit and must not be mixed with a friction law change.

Existing L7 continuation evidence shows N=1 reproduces single-step exactly, while fixed proportional N=5 and N=10 both fail at their second step with the residual concentrated at restraint 20550. Those failed continuations do not authorize selecting a different step count.

## 6. Next admissible friction RCA

The next work remains **within-load-case nonlinear state evolution**, not another coefficient/cap parameter sweep:

1. preserve production R2/D1, own-restraint current-normal basis, friction stiffness, state boundary, return map, acceleration, iteration ceiling and all tolerances;
2. inspect restraint 20550's state/force/slip/residual path in the already defined L7 single-step versus failed N=5@0.4 and N=10@0.2 continuations;
3. distinguish a genuine multiple-equilibrium / basin-selection effect from simple nonconvergence before proposing any initialization or continuation-state change;
4. any future initialization/state-transfer discriminator must operate **within the same static load case**, be predeclared independently of benchmark failure count, and remain diagnostic until a source-backed rule exists;
5. do not change Friction Slide Multiplier, coefficient, comparison goal, tolerance, or node-specific behavior.

A fresh exact-production per-iteration replay was attempted in the current constrained agent runtime but exceeded its execution ceiling before completion. No partial iterate or timeout state is used as evidence here.

`productionFrictionMechanicsChanged: false`  
`productionPromotionAuthorized: false`  
`newAccuracyClaimAuthorizedByThisReport: false`
