## 1. Problem Statement & Audit Summary

During a comprehensive mechanical engineering audit of the **Load Calc** module using benchmark `benchmarks/Sjson.json` (SHA-256: `6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288`), an end-to-end walkthrough was conducted through all 8 steps of the guided workflow.

While the underlying analytical statics kernel (`CHAINAGE_TRIBUTARY_SPAN_V2`) closes in static equilibrium with machine precision (force residual $< 10^{-10}\ \text{N}$, moment residual $< 10^{-6}\ \text{N}\cdot\text{mm}$), the product UI blocks the user from executing the calculation out-of-the-box due to 5 distinct integration bottlenecks between master data, enrichment, route partitioning, and preflight qualification.

---

## 2. Root Cause Analysis

1. **RC-1: Master Source Hash Staleness (`STALE_SOURCE_HASH`):**
   The static profile `project-data/1885s-project-data-profile.json` specifies SHA-256 `72e266002256e2ac0b0c0c9c722dde2bb65e93deec2075d209c7ab78d219cda2` (corresponding to legacy `wtValveweights.json`), whereas uploading the official master spreadsheet `public/fixtures/wtValveweights.xlsx` yields SHA-256 `49b9e1c655c7124fbe471e988894ae200a978f640dc3119e36eba582fcfb7c78`. The preflight validator marks the evidence stale, blocking calculation eligibility.
2. **RC-2: Narrow Enrichment Scope (Pipe-Only Master Matching):**
   `src/workspace/load-calc-master-candidates.js` only targets components with `type === 'PIPE'`. Non-pipe fittings in SJSON (14 elbows, 22 flanges, 4 valves, 5 instruments, 10 olets, 4 reducers, 3 tees) receive no proposals and have no `CATALOG_KEY` in source SJSON. Consequently, 62 physical components trigger `MASS_COVERAGE: BLOCKED` in Preflight and `MISSING_COMPONENT_MASS` in the solver.
3. **RC-3: Incomplete Multi-Line Operating Fluid Density Coverage:**
   The project profile only defines operating fluid density for line `S8811951` ($67\ \text{kg/m}^3$). Lines `S8810101`, `S8810103`, `S8810111`, and `S8810112` lack exact values and lack a `DEFAULT` fallback in the static profile, triggering `MISSING_FLUID_DENSITY` for the OPERATING (OPE) load case despite the Line List (`AML-91-PDFEED-PX-2345-00001-0000 BC4.xlsx`) declaring mixed-phase density $67\ \text{kg/m}^3$ across all 5 lines.
4. **RC-4: Zero-Length Point Route Chainage Missing (`MISSING_ROUTE_CHAINAGE`):**
   Branch `/ASIM-1885-10"-S8810101-91261M7-HC-01/B5` consists solely of a zero-length pressure gauge `88-PG-10052` (`=1006649732/51485`) without a pipe centerline segment. In `src/workspace/routes/route-partition-model.js`, `topologyEdges.length === 0`, causing `entityChainages` to be empty (`[]`). When evaluated by `support-load-distribution-v3.js`, the entity is in `physicalEdgeIds` but has no chainage coordinate, resulting in a fatal `MISSING_ROUTE_CHAINAGE` failure.
5. **RC-5: Multi-Step Friction in Guided Run Trigger:**
   In the UI Verify & Run tab, the Run button requires an exact sequence of manual visits to Defaults, Masters, Enrichment ("Accept all unblocked"), and Preflight ("Seal") before the button enables. If any step is incomplete, the user is blocked without clear automatic convergence.

---

## 3. Verified Mechanical Engineering Solution Basis

The analytical statics formulation was independently verified with full fitting masses and fluid densities:
- **37 Physical Support Locations:** Clustered from 139 elements (30 vertical resting supports, 7 directional guides/stops).
- **Static Equilibrium Verification:**
  - **EMPTY:** Applied $73,437.9\ \text{N}$, Reactions $63,793.9\ \text{N}$, Residual $\Delta F_z = -4.37 \times 10^{-11}\ \text{N}$, $\Delta M = -1.19 \times 10^{-7}\ \text{N}\cdot\text{mm}$ (**PASSED**).
  - **OPERATING:** Applied $74,721.3\ \text{N}$, Reactions $65,067.4\ \text{N}$, Residual $\Delta F_z = 0.00\ \text{N}$, $\Delta M = 0.00\ \text{N}\cdot\text{mm}$ (**PASSED**).
  - **HYDROTEST:** Applied $92,592.0\ \text{N}$, Reactions $82,800.8\ \text{N}$, Residual $\Delta F_z = -1.16 \times 10^{-10}\ \text{N}$, $\Delta M = 0.00\ \text{N}\cdot\text{mm}$ (**PASSED**).
- **Overhang / Cantilever Transfer:** $9,644.0\ \text{N}$ and $3.63 \times 10^6\ \text{N}\cdot\text{mm}$ of cantilever moment correctly accounted for on unsupported terminal stubs.

---

## 4. Phase-Wise Implementation Plan

### Phase 1: Dynamic Master Hash Synchronization & Provenance Binding
- **Component:** `src/workspace/master-data-ui.js`, `src/workspace/project-data/`
- **Scope:**
  - Implement `autoBindMasterSources()` in `master-data-ui.js` to reconcile uploaded spreadsheet SHA-256 hashes (`wtValveweights.xlsx`, `Piping class master.xlsx`, `lineList`) with active `sourcesAndUnits` entries in `projectDataStore`.
  - Retain strict immutable audit provenance without mutating historical benchmark baselines.

### Phase 2: Comprehensive Fitting & Valve Mass Resolution in Enrichment
- **Component:** `src/workspace/load-calc-master-candidates.js`, `src/workspace/enrichment/`
- **Scope:**
  - Extend `buildLoadCalcMasterEnrichmentProposals` to process fittings (`ELBO`, `FLAN`, `TEE`, `REDU`, `OLET`, `VALV`, `INST`) alongside straight pipes.
  - Map fitting weights from `wtValveweights` and standard ASME B16.9 / B16.5 catalogs based on component type, nominal bore, and rating class.
  - Generate explicit, reviewable enrichment proposals with traceable derivation metadata.

### Phase 3: Multi-Line Operating Fluid Density Extractor & Default Binding
- **Component:** `src/workspace/load-calc-master-candidates.js`, `src/workspace/project-data/`
- **Scope:**
  - Auto-extract operating fluid density for all lines present in the active dataset from the Line List normalized rows.
  - Populate `loadCalculation.operatingFluidDensitiesKgPerM3` for each line key (e.g. `S8810101`, `S8810103`, `S8810111`, `S8810112`, `S8811951`) with mixed phase density $67\ \text{kg/m}^3$, plus an approved project default fallback.

### Phase 4: Zero-Length Point Route Chainage in Route Partitioning
- **Component:** `src/workspace/routes/route-partition-model.js`
- **Scope:**
  - In `buildLinearChainage`, check for terminal branches consisting solely of point components (such as instrument tap B5).
  - Assign valid point chainage ($0\ \text{mm}$) referencing the branch attachment point so that point components have valid route chainages rather than triggering `MISSING_ROUTE_CHAINAGE`.

### Phase 5: Automated Preflight Convergence & Guided One-Click Execution
- **Component:** `src/workspace/load-calc-consumer-controller.js`, `src/workspace/load-calc-current-system-view.js`
- **Scope:**
  - In `runCurrentCalculation()`, implement automated convergence:
    1. Synchronize master hashes and stage unblocked proposals.
    2. Accept unblocked proposals into the effective value ledger.
    3. Evaluate 8-gate preflight.
    4. Generate READY system seal (`createNonFeaReadyProductScreeningConfirmation`).
    5. Execute `CHAINAGE_TRIBUTARY_SPAN_V2` statics and transition cleanly to the Loads view.

### Phase 6: Automated Verification & Regression Guardrails
- **Component:** `e2e/audit-loadcalc-sjson.spec.js`, `tests/`
- **Scope:**
  - Update `e2e/audit-loadcalc-sjson.spec.js` to assert that all 8 steps pass in the browser UI, all 4 gates on the Verify tab show green, and all 37 support reactions are rendered.
  - Run full test suite:
    ```bash
    node scripts/run-non-fea-checks.mjs
    npm run check:imports
    node scripts/advanced-shell-contract-check.mjs
    npm run build
    git diff --check
    ```

---

## 5. Acceptance Criteria
- [ ] `benchmarks/Sjson.json` loads and evaluates through the Load Calc guided workflow without manual JSON patching.
- [ ] Preflight validation transitions to `READY` with 100% mass and fluid density coverage.
- [ ] Static equilibrium closes within tolerances ($\Delta F_z \le 10^{-8}\ \text{N}$, $\Delta M \le 10^{-5}\ \text{N}\cdot\text{mm}$) for EMPTY, OPE, and HYD.
- [ ] All 37 support locations display accurate reaction forces in the UI Loads tab.
- [ ] Zero regressions in existing test suite and protected FEA/LFEA boundaries.
