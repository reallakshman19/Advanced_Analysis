# M047 Stage 2 — R8/NFV15 fresh local L13 measurement

**Decision:** `R8_NFV15_REJECTED_AT_L13_BY_FROZEN_ACCURACY_METRICS`

- Measurement boundary: fresh local real pinned `BM4_L.ACCDB`; historical Actions artifact used only to transport source bytes, never as solve authority.
- ACCDB SHA-256: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8` (5,136,384 bytes).
- ZIP SHA-256: `978617cba50fa0b1a16c2fa71dc1e0d38e55ac834b191f887d100c6951abd8b9` (582,488 bytes).
- Frozen production solver Git blob: `5b3ba1ce89f6ff7509bf8be82361993a32497ad2` (`CAESAR-ACCDB-FRICTION-SOLVER-R2`).
- R8 changes one mechanic only: retained own-normal capacity basis while sliding, threshold `0.15`, refresh strictly when relative variation `> 0.15`.
- D1 direction, `mu`, friction stiffness, return mapping, hysteresis, acceleration, max iterations, load stepping, convergence tolerances and comparison goal are unchanged.

## Result

| Metric | fresh R2 baseline | R8/NFV15 | delta |
|---|---:|---:|---:|
| normals within ±10% | 23/23 | 23/23 | 0 |
| tangential vectors within ±10% | 13/23 | 9/23 | -4 |
| worst normal error | 1.794642% | 7.559587% | +5.764945 pp |
| worst tangential vector relative error | 7.219149 | 10.178755 | +2.959607 |

R8 converged in **42 iterations**. Nonlinear gates: **CONVERGED**; recovered equilibrium: **PASS**; execution: **QUALIFIED**. `NFV15_RETAINED_NORMAL_STATE` is **PASS** with zero failures.

Frozen nomination requires tangential count improvement and no normal-count degradation. Tangential accuracy fell by 4 restraints, so R8 is rejected immediately. **Do not run R8 L7 or L15.**

## Per-restraint comparison

| restraint | base N err % | R8 N err % | base Ft rel err | R8 Ft rel err | retained N entering | current N | variation | refresh |
|---|---:|---:|---:|---:|---:|---:|---:|:---:|
| `20090:REST_PTR2:TYPE3:UY` | 1.795 | 1.885 | 0.0838 | 0.0864 | — | 7162.704 | 0.00000 | no |
| `20170:REST_PTR3:TYPE3:UY` | 0.870 | 0.429 | 0.0877 | 0.0860 | 12995.113 | 12982.842 | 0.00094 | no |
| `20250:REST_PTR4:TYPE3:UY` | -0.005 | 0.001 | 0.0169 | 0.0191 | — | 11215.030 | 0.00000 | no |
| `20350:REST_PTR6:TYPE3:UY` | -0.151 | -0.088 | 0.0128 | 0.0174 | — | 3091.803 | 0.00000 | no |
| `20440:REST_PTR8:TYPE3:UY` | -0.026 | -0.158 | 0.1096 | 0.1835 | — | 2020.377 | 0.00000 | no |
| `20520:REST_PTR9:TYPE3:UY` | -0.052 | 0.127 | 0.0543 | 0.0363 | — | 2330.214 | 0.00000 | no |
| `20550:REST_PTR10:TYPE3:UY` | 0.035 | -0.258 | 0.0420 | 0.0079 | — | 2769.955 | 0.00000 | no |
| `20580:REST_PTR11:TYPE3:UY` | -0.125 | 1.526 | 0.0026 | 0.6752 | — | 2231.440 | 0.00000 | no |
| `20710:REST_PTR13:TYPE3:UY` | 0.642 | -7.560 | 0.0903 | 1.0306 | — | 1740.011 | 0.00000 | no |
| `21470:REST_PTR14:TYPE3:UY` | -0.133 | -0.234 | 0.0876 | 0.1778 | — | 2069.349 | 0.00000 | no |
| `21610:REST_PTR16:TYPE3:UY` | -1.578 | 5.557 | 0.0576 | 0.2104 | — | 899.634 | 0.00000 | no |
| `21740:REST_PTR18:TYPE3:UY` | -0.111 | 1.564 | 0.3528 | 0.0337 | — | 4542.727 | 0.00000 | no |
| `21800:REST_PTR19:TYPE3:UY` | -0.047 | -0.240 | 0.0718 | 0.6480 | — | 3406.856 | 0.00000 | no |
| `21860:REST_PTR20:TYPE3:UY` | 0.058 | 0.081 | 0.7177 | 0.6341 | — | 7768.880 | 0.00000 | no |
| `21930:REST_PTR21:TYPE3:UY` | 0.266 | 0.289 | 7.2191 | 10.1788 | — | 4537.179 | 0.00000 | no |
| `22020:REST_PTR22:TYPE3:UY` | -1.117 | -1.241 | 0.0128 | 0.0133 | 1296.441 | 1295.486 | 0.00074 | no |
| `22070:REST_PTR23:TYPE3:UY` | -1.579 | -1.429 | 0.8766 | 0.9011 | — | 1689.745 | 0.00000 | no |
| `22120:REST_PTR24:TYPE3:UY` | 0.177 | 0.152 | 0.0845 | 0.0087 | 5496.851 | 5498.026 | 0.00021 | no |
| `22140:REST_PTR25:TYPE3:UY` | 0.776 | 0.731 | 1.7622 | 1.8896 | — | 2355.847 | 0.00000 | no |
| `22220:REST_PTR26:TYPE3:UY` | -0.227 | -0.216 | 1.1157 | 1.6558 | — | 1424.042 | 0.00000 | no |
| `22260:REST_PTR27:TYPE3:UY` | 0.048 | 0.047 | 0.1126 | 0.1075 | — | 1791.567 | 0.00000 | no |
| `22310:REST_PTR28:TYPE3:UY` | 0.051 | 0.047 | 0.2329 | 0.2083 | — | 2327.551 | 0.00000 | no |
| `22370:REST_PTR29:TYPE3:UY` | -0.011 | -0.009 | 0.6923 | 0.6879 | — | 1816.690 | 0.00000 | no |

## Reproducibility / artifact hashes

- Fresh local R2 compact artifact SHA-256: `052f083f8001786264eecdecb3e8698af2c781ce273a52c6698247d4e28e3d2c`.
- Fresh local R8 raw evidence SHA-256: `da8dc91a8b0158a6ae25a38cd36c8e8fe38b3052e157ad01832746c26baca056`.
- R8 experimental solver SHA-256: `7cd5030f102aeaf629dcef0f2e8be848033a19e2f519ccce2f3b3e3c5e9eaba6`.
- Final R8 rows semantic hash: `fnv1a64:031ccdb65d2143cd`.
- Production promotion authorized: **false**.
- Friction Angle Variation run in this measurement: **false**.
