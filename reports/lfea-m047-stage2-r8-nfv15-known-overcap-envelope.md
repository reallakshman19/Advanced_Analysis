# M047 Stage 2 — R8 NFV15 bounded reference-envelope diagnostic

**Boundary:** committed-real-result arithmetic only. This is **not** a nonlinear re-solve, not an exhaustive restraint scan, and not production authority.

For a CAESAR reference utilization

`u = |Ft_ref| / (mu * |N_final|)`,

a retained normal basis that would reproduce that magnitude is `N_basis = u * |N_final|`. The normal-force change from that required basis to the published final normal, measured against the retained basis as the documented NFV threshold is defined, is

`|N_final - N_basis| / |N_basis| = |u - 1| / u`.

The six over-final-normal-cap states already named in committed Stage 2 evidence are:

| case | node | reference utilization | required basis-to-final variation | within 15% envelope |
|---|---:|---:|---:|---|
| L7 | 22020 | 1.107455561873484 | 9.702923% | yes |
| L7 | 20440 | 1.0657858859335987 | 6.172524% | yes |
| L7 | 22070 | 1.0220684284870714 | 2.159193% | yes |
| L7 | 22120 | 1.0000000427885043 | 0.000004% | yes |
| L13 | 20710 | 1.106335582585517 | 9.611512% | yes |
| L1 | 20710 | 1.1089723315242446 | 9.826425% | yes |

Sources are the committed production-R2 evidence under `reports/lfea-m047-stage2-r2-rebaseline/` and issue #1083's R8 addendum. Model `mu` and every production R2 mechanic remain unchanged.

## Interpretation

All six named over-cap states are **compatible** with a 15% retained-normal basis in magnitude. This removes the objection that the documented threshold is too small to explain the named over-cap observations.

Compatibility is only a necessary condition. It does not prove that CAESAR's nonlinear path actually seeded and retained the required normal basis, and it does not predict the final tangential direction or stick/slide regime. The already-recorded L7 diagnostic replay also shows that applying a simple 15% retained-normal diagnostic to an existing path does not trivially reproduce CAESAR regimes.

Therefore the decision is unchanged: R8/NFV15 remains the next friction nonlinear discriminator, but only a fresh custody-verified `BM4_L.ACCDB` solve with the retained-normal state machine active can nominate it. No production promotion is authorized by this report.
