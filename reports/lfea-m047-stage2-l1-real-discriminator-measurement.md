# M047 Stage 2 — L1 hydrotest real-file discriminator measurement

**Decision:** density path rejected; `Include Insulation in Hydrotest = False` nominated **only as a separate production candidate**. No candidates are combined.

- Fresh local pinned `BM4_L.ACCDB` SHA-256: `64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8` (5,136,384 bytes).
- ZIP SHA-256: `978617cba50fa0b1a16c2fa71dc1e0d38e55ac834b191f887d100c6951abd8b9` (582,488 bytes).
- Hydrotest invariant held in every run: 1000 kg/m³ test fluid, `HP -> HYDRO_PRESSURE`, L1 remains HYD `WW+HP`.
- Production R2 numerical mechanics held: `CAESAR-ACCDB-FRICTION-SOLVER-R2`, D1, `mu`, `k_f`, return map, acceleration, 800-iteration ceiling and convergence gates unchanged.
- The post-reset local source reconstruction reproduced the committed R2 L1 baseline accuracy exactly; production promotion remains unauthorized until the nominated change is implemented and rerun through the exact frozen production boundary and controls.

## Aggregate result

| Metric | fresh R2 L1 | density-only | insulation-false |
|---|---:|---:|---:|
| converged | yes | yes | yes |
| normals within ±10% | 8/23 | 7/23 | 22/23 |
| worst normal error | 159.439450% | 155.264570% | 13.953465% |
| tangential vectors within ±10% | 4/23 | 4/23 | 7/23 |
| worst tangential relative error | 5.853476 | 5.652362 | 67.528024 |

### Frozen nomination checks

- Density-only changed 24 rigid/reducer sources; normals within goal changed **-1**, worst normal changed **-4.174879 pp**, improved/worsened = **8/15**. **Rejected.**
- Insulation-false changed 96 insulation-bearing element rows; normals within goal changed **+14**, worst normal changed **-145.485985 pp**, improved/worsened = **21/2**. **Nominated for a separate production implementation only.**

Both experimental solves have nonlinear convergence `CONVERGED`, recovered equilibrium `PASS`, execution `QUALIFIED`, and zero failed gates.

## Per-restraint normal comparison

| restraint | R2 err % | density err % | insulation-false err % | density direction | insulation direction |
|---|---:|---:|---:|---|---|
| `20090:REST_PTR2:TYPE3:UY` | 0.995 | 2.164 | 2.186 | worsened | worsened |
| `20170:REST_PTR3:TYPE3:UY` | 11.831 | 12.394 | 1.295 | worsened | improved |
| `20250:REST_PTR4:TYPE3:UY` | 8.007 | 8.479 | 0.842 | worsened | improved |
| `20350:REST_PTR6:TYPE3:UY` | 24.202 | 24.160 | -0.963 | improved | improved |
| `20440:REST_PTR8:TYPE3:UY` | 21.620 | 21.615 | -0.007 | improved | improved |
| `20520:REST_PTR9:TYPE3:UY` | 22.885 | 22.888 | -0.071 | worsened | improved |
| `20550:REST_PTR10:TYPE3:UY` | 21.330 | 21.331 | 0.098 | worsened | improved |
| `20580:REST_PTR11:TYPE3:UY` | 24.961 | 24.951 | -0.471 | improved | improved |
| `20710:REST_PTR13:TYPE3:UY` | 15.233 | 14.785 | 3.047 | improved | improved |
| `21470:REST_PTR14:TYPE3:UY` | -5.908 | -5.265 | 1.246 | improved | improved |
| `21610:REST_PTR16:TYPE3:UY` | 159.439 | 155.265 | -13.953 | improved | improved |
| `21740:REST_PTR18:TYPE3:UY` | 9.730 | 11.326 | -2.092 | worsened | improved |
| `21800:REST_PTR19:TYPE3:UY` | 4.507 | 6.544 | -2.019 | worsened | improved |
| `21860:REST_PTR20:TYPE3:UY` | 4.544 | 5.849 | -1.259 | worsened | improved |
| `21930:REST_PTR21:TYPE3:UY` | 6.911 | 8.758 | -1.602 | worsened | improved |
| `22020:REST_PTR22:TYPE3:UY` | 15.921 | 18.687 | -3.917 | worsened | improved |
| `22070:REST_PTR23:TYPE3:UY` | 12.033 | 13.927 | -2.884 | worsened | improved |
| `22120:REST_PTR24:TYPE3:UY` | -0.300 | 1.816 | -1.881 | worsened | worsened |
| `22140:REST_PTR25:TYPE3:UY` | 16.310 | 16.956 | -0.487 | worsened | improved |
| `22220:REST_PTR26:TYPE3:UY` | 21.958 | 21.956 | -0.135 | improved | improved |
| `22260:REST_PTR27:TYPE3:UY` | 22.060 | 22.072 | 0.051 | worsened | improved |
| `22310:REST_PTR28:TYPE3:UY` | 22.368 | 22.342 | 0.059 | improved | improved |
| `22370:REST_PTR29:TYPE3:UY` | 22.022 | 22.033 | 0.008 | worsened | improved |

## Reproducibility / hashes

- R2 L1 local artifact SHA-256: `e3390ebdfeb539d013bbca0d5af16d66ff9930051e595660bde5bbcac4f84d09`.
- Density local artifact SHA-256: `dcf6b547c0008ead5d12e6075529b001c50359a8c11c6dd97b47b5e50e84f00b`; final rows `fnv1a64:879f317d87fc25ac`.
- Insulation local artifact SHA-256: `e4aa16212ab40d078c809fbb4604cb2e9a3a8707c50e652f6d83ad5c223fb8c0`; final rows `fnv1a64:2e80e62c024d7f81`.
- Production promotion authorized: **false**.
- Next action: implement only `Include Insulation in Hydrotest=False` as a separate production candidate, then run frozen L2–L6/L14 controls and fresh nominal qualification/repeats before any promotion.
