# M047 Stage 2 — unchanged B0 L7 attribution

## Purpose

Determine whether the shared D1/H1 L7 node-20350 normal error (~-25%) already exists under the unchanged production friction solver before the D1 total-displacement direction mechanic is applied.

## Execution

Real pinned `BM4_L.ACCDB` (`64c05a50...82f8`), L7 `OPE / W+T1+P1`, unchanged production solver SHA-256 `9976cda4...dbfa`. No source transform, load stepping, tolerance change, comparison change, or node exception.

Two repeats were executed. The production solver SHA was byte-identical before and after the run.

Custody:
- temporary head: `0148b3880efec359c18df0f974f254508679251f`
- Actions run: `31712522337`
- artifact: `9186197458`
- artifact digest: `sha256:5dacc3bbcd9a4d88857c3fe16418ebc960a47fc1912f3e16b5d250a35aede445`

## Result

**Both B0 L7 repeats are identically nonconverged after 400 iterations.** Their failure objects, state-change histories, reaction-update tails, and displacement-update tails are identical.

Final failed gates in both repeats:
- `DISPLACEMENT_UPDATE_NORM`
- `REACTION_UPDATE_NORM`
- `COULOMB_CAP_COMPLEMENTARITY`
- `SLIDE_CAPACITY_RESIDUAL`
- `SLIP_UPDATE_NORM`

At iteration 400:
- displacement update = `6.605116696645208e-10 m` vs `1e-10 m` limit;
- reaction update = `0.11567343084607273 N` vs `0.01 N` limit.

The remaining complementarity/slide-capacity violations are at restraints 20350, 20440, and 20550. For 20350 specifically:
- terminal applied magnitude = `205.8478743660919 N`;
- terminal instantaneous capacity = `205.80362351100027 N`;
- terminal slide residual = `0.04425085509163296 N`;
- terminal slip update = `2.5267864895087766e-10 m`.

With μ=0.3, the terminal instantaneous capacity corresponds to an own-normal magnitude of about `686.012 N`. This is **not** a converged B0 normal and must not be compared as a qualified final solution. It does show that the nonconverged B0 iteration is on a materially different 20350 branch from the converged D1 (`347.469 N`) and H1 (`350.208 N`) results.

## Attribution decision

`B0_L7_NONCONVERGED_NO_ADMISSIBLE_FINAL_20350_NORMAL`

Therefore the ~-25% converged D1/H1 normal error at 20350 cannot be classified as a pre-existing converged B0 error. D1 both enables L7 convergence and moves 20350 onto a different nonlinear branch. H1 does not materially change that normal branch.

Do not relax B0 convergence gates or use the iteration-400 instantaneous normal as benchmark authority. The next RCA, if pursued, should compare the **B0→D1 branch transition history at 20350/20440/20550** rather than inventing L7 load stepping or changing the normal basis.
