# M047 Stage 2 — L1 HYD insulation experiment scope proof

This note proves the staged `Include Insulation in Hydrotest = False` discriminator changes the L1 gravity basis only in the current ACCDB implementation. It is source evidence, not a real-file accuracy result.

## Ordinary pipe and bend spans

`caesar-accdb-linear-solve.js::physicalLineWeight()` computes three additive line-weight terms: pipe metal, contents, and insulation. `INSUL_THICK` and `INSUL_DENSITY` appear only in the insulation-area / insulation-weight term returned to `gravityVector()`. Frame stiffness, thermal strain and pressure strain are assembled separately from section geometry, material and the governed pressure/temperature fields.

Therefore setting the two insulation fields to zero removes only the insulation gravity contribution for ordinary straight/bend descendants.

## Rigid elements

`buildRigidElement()` passes `INSUL_THICK` and `INSUL_DENSITY` to `compileCaesarRigidElementAuthority()`. In `linear-fea-rigid-element/rigid-element.js`, those inputs are consumed only by `physicalWeights()` to calculate the documented 1.75× rigid-insulation weight. Rigid stiffness is independently built from the original inside diameter and ten times the entered pipe wall thickness. Thermal and Bourdon pressure states are also independent of insulation inputs.

Thus the staged mutation removes rigid-element insulation weight without changing the artificial rigid stiffness section or pressure/thermal mechanics.

## Reducers

`buildReducerElement()` passes the insulation fields only inside the reducer request's `gravity` object. `compileTenCylinderReducerAuthority()` forms each cylinder stiffness from interpolated metal OD/wall and material properties. The insulation inputs enter only `insulationLineWeight`, which is added to metal and fluid line weight when gravity is enabled.

Thus the staged mutation removes reducer insulation gravity without changing reducer condensation stiffness, thermal strain or hydro-pressure mechanics.

## Cladding boundary

The current BM4_L rigid adapter passes `claddingWeight: 0` and the reducer/ordinary ACCDB paths expose no separate cladding-weight input in this solver. The staged experiment therefore changes the actual modeled insulation contribution represented by `INSUL_THICK` / `INSUL_DENSITY`; it does not invent an undeclared cladding term.

## Decision

For the current implementation, zeroing `INSUL_THICK` and `INSUL_DENSITY` in the experiment is a **gravity-load-only discriminator**. It does not alter structural stiffness, restraint mechanics, test-fluid density, `HP=HYDRO_PRESSURE`, Bourdon behavior, temperature basis, R2 friction law, convergence tolerances or acceptance criteria.

Production promotion remains unauthorized until the fresh pinned-ACCDB L1 experiment is measured and committed, followed by a separate production candidate and frozen L2-L6/L14 regression if nominated.
