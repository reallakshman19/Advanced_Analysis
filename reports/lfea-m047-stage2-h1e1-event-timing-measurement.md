# M047 Stage 2 — H1 event timing and H1E1 measurement

## Event-timing diagnostic

Exact H1 reproduction passed at `fnv1a64:77eea847870b228b` in 249 iterations. Run `31703797032`, artifact `9182396949`, digest `sha256:06fb8a2f046e579cd289b3c128d011414116a147e3a60aeb7b39ab9f9145a428`.

Across 18 restraints with a last `SLIDE→STICK` event, six remain H1 failures. A one-time projection on the first active-STICK equilibrium reduces that six-row median from **75.49% to 17.01%** and puts **2/6** inside ±10%. It preserves both rows newly repaired by H1 in that snapshot, but two other existing H1-pass controls (21470 and 21800) exceed ±10%, so the strict snapshot pre-gate does not pass.

Because the snapshot is not a final nonlinear equilibrium, exactly one RCA-only timing candidate was run with the real promotion gates unchanged.

## H1E1 real nonlinear result

H1E1 changes one mechanic relative to H1: defer H1's final return-map commit from the `SLIDE→STICK` detection iteration to the first subsequent equilibrium solve with STICK active, apply it once only, then resume ordinary evolution.

Run `31704443801`, artifact `9182702291`, digest `sha256:6b245a8fe2057614dcee795c643fced8f9c2a2bd885d826ae53ecf90cba7ba74`.

| Metric | H1 | H1E1 |
|---|---:|---:|
| vectors within ±10% | **15/23** | **15/23** |
| normals within ±10% | **23/23** | **23/23** |
| median vector error | 8.352% | **8.278%** |
| H1 pass losses | — | **0** |
| new passes | — | **0** |
| iterations | 249 | **182** |

Both H1E1 repeats are deterministic with row hash `fnv1a64:0013b48ecff68f0b`, converge with physical equilibrium PASS, and reproduce 27 first-locked finalization events.

Named residuals: 22140 improves **177.69%→170.77%**; 21740 **32.61%→31.70%**; 22370 **63.29%→63.03%**. But 22070 worsens **87.70%→95.50%**, 22220 is essentially unchanged **106.24%→106.40%**, and the raw worst row worsens to **652.69%**. No new row enters ±10%.

**Decision:** reject H1E1 for promotion. Keep H1 as the leading review candidate at 15/23, while D1 remains the accepted experimental baseline at 13/23. No production friction mechanics, tolerances, comparison rules, or downstream cases are changed.
