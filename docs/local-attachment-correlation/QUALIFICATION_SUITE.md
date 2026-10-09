# Local-attachment correlation — executable qualification suite

Status: software qualification infrastructure. This document does not qualify or authorize any real engineering correlation method.

## Purpose

A coefficient package and a matching semantic hash prove data integrity, not engineering correctness. A local-attachment correlation method must also demonstrate that the implemented evaluator reproduces independently specified benchmark observations across the method's qualified domain and load channels.

The executable qualification chain is:

```text
correlation profile / coefficient dataset
    -> qualification suite
    -> execute exact benchmark requests
    -> typed engineering observations
    -> PASS / FAIL qualification evidence
    -> reproduce evidence from retained suite
    -> qualification approval record
    -> code-trusted approval-authority gate
    -> engineering method registry
```

The current trusted approval-authority set remains empty. Therefore a PASS software qualification suite does not authorize engineering use by itself.

## Suite binding

`local-attachment-correlation-qualification-suite/v1` retains:

- suite identity;
- method identity;
- method edition;
- coefficient dataset identity;
- coefficient dataset hash;
- exact profile semantic hash;
- benchmark cases;
- suite semantic hash.

Each case retains the exact correlation request and a set of explicit engineering observations. The suite is therefore independent of array position and does not use arbitrary JSON-path assertions.

## Observation types

The v1 observation vocabulary is:

- `QUALIFICATION_STATE` — exact accepted/rejected/out-of-domain state;
- `DIAGNOSTIC_CODE` — required diagnostic identity;
- `GEOMETRY_PARAMETER` — e.g. `d/D` or `D/t`;
- `CONTRIBUTION` — source load, normalized basis stress, interpolated coefficient or stress contribution for an exact response identity;
- `INTERPOLATION_AXIS` — retained knot value/brackets, weight or exact-knot flag for an exact response identity and axis;
- `TARGET_COMPONENT` — membrane, bending, shear, pressure, mechanical-surface or total-surface stress for an exact target and tensor component;
- `TARGET_PRINCIPAL` — one retained principal stress by index;
- `TARGET_VON_MISES` — retained target von Mises stress.

Numeric observations carry an explicit absolute arithmetic tolerance. Exact string/boolean observations carry `tolerance = null`.

The numerical tolerance is a software reconstruction tolerance. It is not a statement of empirical-method accuracy or source-data uncertainty.

## Evidence

`local-attachment-correlation-qualification-evidence/v1` is self-contained and retains:

- the exact qualification suite;
- suite identity and suite hash;
- exact method/profile/dataset binding;
- PASS/FAIL status;
- each case result;
- every expected and actual observation;
- evidence semantic hash.

A case passes only when all of its observations pass. The evidence passes only when all cases pass.

A qualification record created through `createCorrelationQualificationRecordFromEvidence()` must re-execute the retained suite against the exact profile and reproduce the identical evidence hash. A merely well-formed or re-hashed caller-supplied PASS blob is insufficient.

## Synthetic software-qualification suite

The retained synthetic fixture exercises the generic evaluator without claiming engineering authority.

### Midpoint hand calculation

```text
D = 300 mm
t = 10 mm
d = 75 mm

d/D = 0.25
D/t = 30
```

Loads:

```text
Fx = 90,000 N
Fy = 30,000 N
Fz = 60,000 N
Mx = 1,800,000 N.mm
My = 9,000,000 N.mm
Mz = 2,700,000 N.mm
```

Pressure contribution at the synthetic outer crown:

```text
sigma_x     = 15 MPa
sigma_theta = 30 MPa
sigma_r     = 0 MPa
tau_x_theta = 0 MPa
```

Expected total result:

```text
sigma_x      = 100 MPa
sigma_theta  = 59 MPa
sigma_r      = 0 MPa
tau_x_theta  = 2 MPa

sigma_1 = 100.09732992404598 MPa
sigma_2 = 58.90267007595402 MPa
sigma_3 = 0 MPa

sigma_vm = 87.13782186857783 MPa
```

The suite also verifies the midpoint interpolation weights `wx = wy = 0.5` and selected normalized-load/coefficient values.

### Exact lower knot

The exact-knot case uses:

```text
d/D = 0.20
D/t = 20
```

and requires retained `exactKnot = true` on both interpolation axes, together with the exact synthetic coefficients for the selected responses.

### Domain rejection

Separate cases require `OUTSIDE_DOMAIN` plus `OUTSIDE_CORRELATION_DOMAIN` for:

- `d/D` above the declared synthetic maximum;
- `D/t` above the declared synthetic maximum.

No extrapolated target stress may be accepted.

### Sign reversal

With all six mechanical loads reversed and pressure set to zero, the synthetic midpoint fixture requires:

```text
sigma_x      = -85 MPa
sigma_theta  = -29 MPa
tau_x_theta  = -2 MPa
sigma_vm     = 74.91995728776145 MPa
```

This prevents a coefficient/sign implementation from passing only on one load sense.

### Six load-isolation cases

The suite independently activates each mechanical channel with all other loads and pressure set to zero:

```text
Fx -> sigma_x      = 45 MPa
Fy -> sigma_theta  = 20 MPa
Fz -> sigma_x      = -10 MPa
Mx -> tau_x_theta  = 2 MPa
My -> sigma_x      = 50 MPa
Mz -> sigma_theta  = 9 MPa
```

This prevents cross-channel mistakes from cancelling inside a combined benchmark.

## Approval boundary

A PASS executable suite is necessary but not sufficient for engineering use.

The approval record must still be bound to the exact profile and evidence hash, declare engineering-use approval, and identify an approval authority that exists in the code-owned trusted-authority set. That set is currently empty.

A future real method therefore requires all of the following before activation:

1. exact method and edition;
2. legally usable coefficient data with source provenance;
3. deterministic dataset/package/profile identities;
4. an independently defined qualification suite appropriate to that method's published domain and response definitions;
5. reproducible PASS qualification evidence;
6. engineering review of applicability, source extraction and uncertainty;
7. explicit addition of the approved authority/method to the code-owned trust root.

Do not weaken the suite, interpolation policy, domain checks, tolerances, or trust gate merely to make a real dataset pass.
