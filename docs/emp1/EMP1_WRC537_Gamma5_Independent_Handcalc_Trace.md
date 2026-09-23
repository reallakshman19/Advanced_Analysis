# EMP.1 WRC-04 H1 — Independent Gamma=5 Hand-Calculation Trace

## Purpose

This record closes the reviewer-trace gap in #1772 H1 without creating a second WRC numerical implementation.

The retained independent oracle namespace already contained:

- physical source-to-reference statics;
- WRC axis/load reconstruction;
- direct retained-source curve parsing;
- independent Table-5 arithmetic;
- load reversal, zero-isolation and superposition falsifiers;
- the current post-authority physical oracle using Table-5 axis-of-symmetry `1B/2B`.

What was missing was one human-auditable artifact retaining the intermediate arithmetic and signed load-family contributions required by #1772.

That artifact is now:

```text
validation/emp1/wrc537-2013/gamma5-independent-handcalc-trace-v1.json
```

It contains **189 ordered trace rows** and is indexed by the current benchmark manifest.

## Authority boundary

```text
engineering validation evidence = true
production authority            = false
production observation used     = false
production imports              = []
code compliance authority       = false
release authority               = false
```

The trace does not authorize production, code compliance or release.

The qualification case is synthetic retained evidence only. Its WRC-02 applicability prerequisites are satisfied by fixture construction; they are **not reusable evidence for a real vessel**.

## Frozen physical case

```text
Rm = 100 mm
T  = 20 mm
r0 = 17.714285714285715 mm
gamma = 5
beta  = 0.155
Kn = Kb = 1
cylinder length = 300 mm
attachment station = 80 mm
```

Global source/reference package:

```text
source point  = [0,0,1000] mm
target point  = [0,0,0] mm
force source  = [-400,250,1000] N
moment source = [-250000,-200000,700000] N.mm
```

Independent statics reproduces exactly:

```text
P  = -1000 N
Vc = 250 N
Vl = -400 N
Mc = 500000 N.mm
Ml = -600000 N.mm
Mt = 700000 N.mm
```

## Trace contents

The 189 rows retain:

1. SI unit normalization;
2. reference translation `M_target = M_source + (r_source-r_target) x F`;
3. all six WRC load projections;
4. `gamma=Rm/T` and `beta=0.875*r0/Rm`;
5. WRC 537 §4.5 qualification-case ratios;
6. fourteen exact current source figures:
   `4C,3C,2C-1,1C,3A,1A,3B,1B,1C-1,2C,4A,2A,4B,2B`;
7. coefficient rows, beta, rational numerator, denominator and ordinate for every figure;
8. all nine stress scale factors;
9. every signed membrane/bending/shear contribution at every Au..Dl physical location/surface;
10. same-point algebraic superposition for circumferential, longitudinal and shear stress;
11. combined WRC stress intensity at all eight points;
12. the governing evaluated point;
13. an explicit eight-point-only / no-global-maximum scope statement.

Each row retains:

```text
stepId
category
sourceLocator
formulaOrFigureId
inputs
intermediate
output
physicalLocationSurface
classification
```

## Frozen result

Locations:

```text
Au Al Bu Bl Cu Cl Du Dl
```

Stress intensity, N/mm²:

```text
72.67281563686576
66.18009495654130
66.31741974972616
61.76250020459521
60.13784797265036
57.95382326192188
65.42702806161043
61.299618330183876
```

Governing evaluated point:

```text
Au = 72.67281563686576 N/mm²
```

This means maximum over the eight evaluated Table-5 source locations only. A continuous attachment-juncture or global shell maximum was not searched and is not claimed.

## Independence firewall

The qualification checker is:

```text
scripts/emp1-wrc537-gamma5-independent-handcalc-trace-check.mjs
```

Its reconstruction path is limited to:

```text
scripts/oracles/emp1-wrc537/source-authority.mjs
scripts/oracles/emp1-wrc537/table5-handcalc.mjs
scripts/oracles/emp1-wrc537/physical-statics.mjs
scripts/oracles/emp1-wrc537/curve-fit-source.mjs
```

The checker scans this path and rejects imports from production EMP.1/core calculation code.

It independently reconstructs the six WRC loads, fourteen curve evaluations, scale factors, signed component arrays and 32 final stress quantities before comparing the frozen trace to the current physical oracle.

Negative controls mutate:

- one WRC load;
- the `1B` ordinate;
- one signed longitudinal-moment bending component;
- one final stress intensity;
- the governing location;
- global-maximum scope;
- the production-import boundary;
- trace-row completeness.

All must be rejected.

## Relationship to H2 and H3

The current benchmark manifest now indexes three distinct evidence programmes:

```text
H1 gamma5 independent hand calculation -> frozen independent trace
H2 CAUx independent comparison          -> current Q3 + retained comparison custody
H3 PV Elite comparator                  -> REFERENCE_NOT_AVAILABLE
```

H2 remains comparison evidence and does not create WRC method authority. H3 must remain unavailable until an exact retained PV Elite source package exists.

## Historical/current distinction

The older `gamma5-full-table5-oracle-v1.json` retains historical `1B-1/2B-1` worked-case selection and remains historical comparison evidence.

The current bounded eight-point route and this H1 trace use source-authorized axis-of-symmetry `1B/2B`, matching:

```text
validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json
semantic hash =
60771128f8261057bf73fa6c183ace5df25f3ee98f417f58da25a6135d8b2e18
```

No historical evidence is rewritten.

## Execution truth

The trace is frozen from independent source arithmetic and protected by an executable checker. Hosted exact-head CI remains subject to #54. If a GitHub job is created with `steps=null` and no logs, its state remains `NOT_RUN_EXECUTION_ENVIRONMENT`, not numerical PASS or FAIL.
