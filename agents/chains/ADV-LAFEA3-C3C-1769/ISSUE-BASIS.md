# ADV-LAFEA3-C3C-1769 — Issue Basis

## Authority

- Issue: #1769
- Architecture parent: #1711
- Roadmap parent: #1710
- Predecessor: #1766 / PR #1782
- Stacked predecessor head: `6d7d099b201029e42e64927d932c2a2f14bef471`
- Reviewed main: `41df6e945789273fc327aaeca6686529a9ad8b39`

## Objective

Qualify the existing domain-first physical-intent compiler boundary before extending it. The governed path is:

`source/domain/geometry → qualified retained mesh → feature projection → canonical solver model → compiled loads/BCs → currentness/probes`

This chain must not duplicate solver or mesher mechanics already present.

## First material batch

1. Pin the current mapping/compiler/load/currentness/probe source epoch.
2. Execute the existing compiler/mapping/load/parity/currentness/probe checks as one exact-head campaign.
3. Preserve known unsupported semantics as explicit open findings.
4. Use the campaign to establish the source basis for the first production patch: a hash-addressed feature-projection/resultant evidence contract.

## Protected boundaries

- no C3-B mesher mutation;
- no element/formulation/quadrature mutation;
- no load/BC tolerance relaxation;
- no reinterpretation of ΔT as thermal strain;
- no response/stress/convergence authority;
- no release authority;
- no claim that the stacked dependency is already on `main`.
