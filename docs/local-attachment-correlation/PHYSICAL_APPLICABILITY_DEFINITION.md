# Local Attachment Correlation — Physical Applicability Definition

## Purpose

The correlation profile already retains an `applicabilityProfileId`, and the engineering assessment requires the caller to acknowledge that exact identity. An identity string alone, however, does not define the physical cases for which an empirical method is valid.

This increment introduces a separate, immutable physical applicability definition and makes it part of the engineering approval chain.

## Contracts

### Applicability definition

`local-attachment-correlation-applicability-definition/v1`

The definition retains:

- definition identity;
- exact method identity and edition;
- exact coefficient dataset hash;
- exact applicability-profile identity;
- source reference and source edition;
- host-shell family;
- attachment family;
- intersection orientation;
- load-reference convention;
- permitted recovery targets;
- dimensionless parameter limits;
- explicit exclusions;
- semantic hash.

The current geometry contract can authoritatively derive only:

- `DIAMETER_RATIO = d / D`;
- `DIAMETER_THICKNESS_RATIO = D / t`.

Any real empirical method requiring additional geometry ratios must extend the source-bound geometry contract first. The evaluator deliberately rejects unsupported applicability parameters instead of accepting caller-computed substitutes.

### Physical applicability result

`local-attachment-correlation-physical-applicability/v1`

The result retains:

- exact applicability-definition hash;
- method/edition/dataset/profile identity;
- exact LAFEA.2 geometry-evidence hash;
- topology checks;
- source-derived parameter values and boundary checks;
- requested-target checks;
- diagnostics;
- deterministic semantic hash.

A result is either `ACCEPTED` or `REJECTED`.

## Authority chain

Physical applicability is not caller-supplied runtime policy.

The engineering authority chain is now:

```text
coefficient dataset package
→ correlation profile
→ physical applicability definition
→ executable numerical qualification evidence
→ approval record bound to BOTH numerical evidence and applicability definition
→ immutable release candidate
→ trusted-authority projection
→ engineering registry
```

The qualification approval record advances to v2 and retains `applicabilityDefinitionHash`.

The engineering registry advances to v3 and retains the exact applicability definition beside each profile, qualification record and executable evidence package.

The release candidate advances to v2 and retains the same definition and hash.

There is intentionally no compatibility path that permits an engineering method to enter registry v3 with only an opaque applicability-profile string.

## Project execution order

The project path is:

```text
registered trusted method/profile
→ exact applicability-profile acknowledgment
→ source-bound LAFEA.2 geometry evidence
→ approved physical applicability evaluation
→ correlation request
→ correlation calculation
```

The geometry evidence is created before the numeric applicability evaluation because `d/D` and `D/t` must be calculated from retained project geometry, not from duplicate caller values.

The correlation request is not created when physical applicability is rejected.

## Synthetic qualification case

The internal software-only fixture defines:

```text
host shell family           = CYLINDRICAL_SHELL
attachment family           = CIRCULAR_ATTACHMENT
intersection orientation    = NORMAL_TO_HOST_MIDSURFACE
load reference convention   = ATTACHMENT_SHELL_INTERFACE
permitted target            = CROWN_OUTER
0.20 <= d/D <= 0.30
20 <= D/t <= 40
```

Quantitative regression points are:

| Case | D | t | d | d/D | D/t | Expected |
|---|---:|---:|---:|---:|---:|---|
| midpoint | 300 | 10 | 75 | 0.25 | 30 | ACCEPTED |
| lower boundary | 300 | 15 | 60 | 0.20 | 20 | ACCEPTED |
| upper boundary | 300 | 7.5 | 90 | 0.30 | 40 | ACCEPTED |
| diameter-ratio exceedance | 300 | 10 | 93 | 0.31 | 30 | REJECTED |
| D/t exceedance | 300 | 300/41 | 75 | 0.25 | 41 | REJECTED |

Wrong attachment topology and an unapproved recovery target are independently rejected.

These values are synthetic software-qualification data only. They are not values from any published engineering method.

## Real-method source boundary

Public catalog information identifies WRC Bulletin 537, 4th Edition, February 2026 as a current publication for local stresses in spherical and cylindrical shells due to external loadings for implementation of WRC Bulletin 107. Public catalog information also identifies WRC Bulletin 297 as specifically addressing local stresses in cylindrical shells due to external loadings on nozzles.

That public scope information is useful for method-family selection, but it is not sufficient to populate a production applicability definition.

Before a real WRC-derived definition can be added, the project needs a legally usable source package that permits the implementation team to extract and independently verify the exact:

- attachment and shell configurations;
- geometry definitions and reference dimensions;
- dimensionless limits and boundary inclusivity;
- load-reference location and sign convention;
- stress recovery locations;
- restrictions, exclusions and special cases;
- any permitted interpolation or extrapolation behavior;
- benchmark examples required for qualification.

No numerical limit or coefficient from a WRC publication is embedded by this PR.

## Current limitation

The current physical evaluator supports only geometry that can be proved from existing LAFEA.2 custody: `D`, `t`, and `d`.

If the selected real method requires nozzle thickness, reinforcement dimensions, attachment width/length, fillet dimensions, shell radius definitions different from current `D`, intersection angle, or other parameters, the correct next step is to extend the geometry-evidence schema and source references. Those values must not be accepted as unbound UI inputs merely to make a method execute.
