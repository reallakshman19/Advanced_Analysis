# M047 Stage 2 — friction-stiffness terminology correction

Status: **AUTHORITATIVE TERMINOLOGY CORRECTION**

## Correction

There is **no physical spring in the BM4_L restraint to delete**.

The earlier shorthand “deleted-spring” was misleading. In CAESAR II static friction, the software introduces a **numerical/fictitious friction stiffness** transverse to the restraint while the restraint is non-sliding. When the calculated friction load reaches/exceeds the Coulomb limit, CAESAR describes replacing that internally inserted friction stiffness with a constant-effort friction force on the next iteration.

Therefore the precise name of the measured experiment is:

**`INTERNAL_FRICTION_STIFFNESS_REPLACEMENT_WITH_LAGGED_CONSTANT_EFFORT_FORCE`**

not “delete a physical spring.”

## Authority

Hexagon CAESAR II help, *Modeling Friction Effects*, states that CAESAR uses the stiffness method, that a non-rigid stiffness is placed at the friction location to resist initial motion, and that after the friction-force limit is reached a constant force is applied to the global load vector on the next iteration. It further describes the constant effort force as being inserted in place of the friction stiffness.

Hexagon CAESAR II help, *Friction Stiffness*, states that for the non-sliding state the software inserts stiffnesses in the two directions perpendicular to the friction restraint line of action.

These are **solver-inserted numerical friction stiffnesses**, not model spring restraints.

## Effect on the measured RCA

The pinned-ACCDB 400-iteration trace remains useful, but only with the corrected interpretation:

- it tested replacement of the **internally inserted friction stiffness** by the previous iteration's capped constant force;
- it did **not** test removal of any physical/model spring;
- the experiment remained deterministic but did not reach the unchanged nonlinear convergence gates;
- the active set stabilized while the force/reaction response entered a period-2 cycle;
- therefore the internal-friction-stiffness-replacement sequence is not promoted as the project solver strategy;
- D1 remains the measured experimental baseline.

Existing filenames and historical strategy labels containing `deleted-spring` are retained only as legacy identifiers for already-produced evidence. They must not be read as asserting that BM4_L contains a physical spring at the friction restraint.

## Node 20710

The 20710 diagnostic should likewise be read as a **one-iteration lag in the internally generated Coulomb constant-force update**. It is not evidence of a physical spring. The local force-lag observation remains useful, but the globally state-stable iterate remains nonconverged and is not a valid stopping rule.

## Governing wording going forward

Use:

> CAESAR-inserted friction stiffness / internal friction-stiffness replacement by a constant-effort force.

Do not use:

> delete the restraint spring / physical spring deletion.
