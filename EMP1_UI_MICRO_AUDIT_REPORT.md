# EMP.1 / WRC UI/UX Verification and Micro-Audit Report

## Executive Matrix

| ID | Surface | CONTROL main | PR #1836 | Severity | Classification | Evidence |
| -- | ------- | ------------ | -------- | -------- | -------------- | -------- |
| U-01 | Pressure Radii Recovery | Blocked with "Undo" as only option; radii not editable | Exposes "Set radii to current wall" recovery button; editable in Loads | P0 | CONFIRMED_WORKFLOW_BUG | `04-radius-blocker.png`, `05-radius-recovery.png` |
| #1853 | Section Check Progression | "Run section check" loops indefinitely; B never rebinds to A | `runEmp1SectionCheck` rebinds B to qualified A; workflow completes | P0 | CONFIRMED_WORKFLOW_BUG | `06-section-check-rerun.png`, `post-fix-05-section-check-advanced.png` |
| U-03 | Governing WRC Result Headline | No result in Step 6 primary pane; table buried at 2342px | Governing headline at top: 515px (above fold at 1280x800); evidence console auto-opens | P0 | CONFIRMED_UI_BUG | `07-local-result.png`, `post-fix-02-step6-headline-above-fold.png` |
| U-04 | Stress Table Units & Precision | Headers omit units; values display as raw floats (e.g. -44.51629933) | Headers display `(N/mm²)`; values formatted to 4 s.f.; raw float in data attribute | P0 | CONFIRMED_UI_BUG | `j07-eight-point-table.png`, `j07-candidate-stress-table.png` |
| U-02 / U-16 | Out-of-Domain Refusal | Abrupt error message without boundary or comparison context | Plain-language terminal refusal with qualified vs comparison context | P0 | EXPECTED_FAIL_CLOSED_BEHAVIOR | `08-gamma-refusal.png` |
| #1834 | Non-tabulated $\gamma$ Authority | Refuses execution for $\gamma \neq 5$ | Preserves refusal for engineering use; comparison-qualified route available | P0 | OWNER_DECISION_REQUIRED | `08-gamma-refusal.png`, `09-benchmark-authority.png` |
| #1852 | Cross-Engine ResultHash Policy | fnv1a64 hash generated per engine | Preserves existing hash generation; divergence untouched | P0 | OWNER_DECISION_REQUIRED | `scripts/emp1-stress-units-presentation-check.mjs` |
| #1854 | Pressure Radius Row-Order Edit | Radii uneditable | Radii editable; descending sort ensures stable edits without row jumping | P1 | CONFIRMED_UI_BUG | `candidate-comparison-results.json` |
| U-05 | Dirty Edit / Silent Loss | Edits silently discarded when switching steps without Apply | Edits silently discarded when switching steps without Apply | P1 | CONFIRMED_UI_BUG | `phase2-reproduction-results.json` (j04) |
| U-06 | Step Landing Scroll Position | Re-entering step retains prior inner scroll position mid-form | Re-entering step retains prior inner scroll position mid-form | P1 | CONFIRMED_UI_BUG | `j05-step-landing.png` |
| U-07 | Raw Float Precision in Inputs | Attachment OD renders as 35.42857142857143 | Attachment OD renders as 35.42857142857143 | P1 | CONFIRMED_UI_BUG | `metrics.json` |
| U-08 | Concatenated Header Status Text | "CalculatedAssessment calculated...use.Result...resultUse" run-together | "CalculatedAssessment calculated...use.Result...resultUse" run-together | P1 | CONFIRMED_UI_BUG | `post-fix-01-outcome-banner.png` |
| U-09 | Repeated Status Vocabulary | Status repeated in 4 distinct UI locations with divergent terminology | Status repeated in 4 distinct UI locations with divergent terminology | P1 | ENGINEERING_COMMUNICATION_DEFECT | `metrics.json` |
| U-10 | Readiness Dashboard Wrap Alignment | Label and value wrap independently in multi-column flow | Label and value wrap independently in multi-column flow | P1 | RESPONSIVE_DEFECT | `metrics.json` |
| U-11 | Navigation-Layer Overload | 5 stacked interactive navigation layers visible simultaneously | 5 stacked interactive navigation layers visible simultaneously | P2 | CONFIRMED_UI_BUG | `phase2-reproduction-results.json` (j12) |
| U-12 | Hidden-Control Accessibility Mismatch | Mode tabs `display:none` at 1600px but retain `role="tab"` and `aria-selected="true"` | Mode tabs `display:none` at 1600px but retain `role="tab"` and `aria-selected="true"` | P2 | ACCESSIBILITY_DEFECT | `phase2-reproduction-results.json` (j13) |
| U-13 | Narrow-Width Information Loss | Visible tables drop from 1 to 0 on Start and Local Check at 900px | Visible tables drop from 1 to 0 on Start and Local Check at 900px | P2 | RESPONSIVE_DEFECT | `j14-narrow-local-check.png` |
| U-14 | Semi-Raw Status Tokens | 125 visible occurrences of `SCREAMING_SNAKE_CASE` / internal tokens | 125 visible occurrences of `SCREAMING_SNAKE_CASE` / internal tokens | P2 | ENGINEERING_COMMUNICATION_DEFECT | `phase2-reproduction-results.json` (j15) |
| U-15 | Unimplemented Product Affordance | Tab bar advertises "LAFEA.6 Weld profile · FEA (Not implemented)" | Tab bar advertises "LAFEA.6 Weld profile · FEA (Not implemented)" | P2 | CONFIRMED_UI_BUG | `phase2-reproduction-results.json` (j18) |
| CI-01 | Hosted Playwright E2E Harness | WebServer fails due to `base: '/AA3/'` mismatch in playwright dev server | WebServer fails due to `base: '/AA3/'` mismatch in playwright dev server | P1 | INFRASTRUCTURE_NOT_RUN | `error-context.md` |

---

## Detailed Defect Records

### 1. U-01: Pressure Radii Dead-End on Geometry Edit
- **Tested SHA**: CONTROL `99776d6f190cdc70c27a632c57db74068fde9630` vs CANDIDATE `4c4d21babe5df67481e9ed0880fab67b4b428f0b`
- **Viewport**: 1280×800
- **Precondition**: Qualification sample loaded and calculated.
- **Exact Browser Steps**:
  1. Click Step 2 Geometry.
  2. In Pipe Geometry, change Outside Diameter from `220` to `1844`.
  3. Click "Apply Pipe geometry changes".
  4. Navigate to Step 4 Load transfer.
- **Expected Behavior**: System indicates that the evaluation radii lie outside the new pipe wall and provides an in-place recovery affordance to refit radii to the new bore and outer surface.
- **Actual Behavior (CONTROL)**: Displays blocking error: *"Pressure evaluation radii no longer fit inside the current pipe wall. Use Undo to restore the previous geometry, or import coordinated assessment data before calculating."* The radii are not editable anywhere in the UI, leaving Undo as the sole recourse.
- **Actual Behavior (CANDIDATE)**: Displays governed notice: *"Pressure evaluation radii are outside the current pipe wall"*, with an active action button *"Set radii to current wall"*. Clicking the button updates radii to [902, 922] mm and immediately clears the blocker.
- **First Wrong Visible State**: Error message on Step 4 with no recovery button.
- **Relevant DOM Selector**: `[data-role="lafea-1-pressure-radius-recovery"]`, `[data-role="lafea-1-pressure-radius-refit"]`
- **Console / Network Evidence**: 0 console errors.
- **Screenshot Evidence**: `04-radius-blocker.png` (CONTROL), `05-radius-recovery.png` (CANDIDATE / POST-FIX)
- **Likely Owning File**: `src/workspace/lafea-1-pressure-radius-validation.js`, `src/workspace/lafea-analytical-calc-content.js`
- **Reproduction on main**: Confirmed.
- **PR #1836 Status**: Resolved cleanly.
- **Risk to Engineering Interpretation**: HIGH. Prevents engineers from analyzing any real-world piping geometry whose dimensions differ from the hardcoded sample radii.
- **Recommended Fix Boundary**: Presentation/workspace layer only. Expose pressure radius descriptors and provide one-click refit.
- **Post-Fix Result**: Fully resolved on branch `fix/emp1-ui-audit-remediation`.

---

### 2. #1853: Section Check Progression Staleness Loop
- **Tested SHA**: CONTROL `99776d6f190cdc70c27a632c57db74068fde9630` vs CANDIDATE `4c4d21babe5df67481e9ed0880fab67b4b428f0b`
- **Viewport**: 1280×800
- **Precondition**: Qualification sample loaded and calculated.
- **Exact Browser Steps**:
  1. Click Step 3 Loads.
  2. Change Load Case 1 force $F_x$ from `-400` to `-450`.
  3. Click "Apply Load cases changes".
  4. Click primary toolbar action "Run load transfer".
  5. Primary action changes to "Run section check". Click "Run section check".
- **Expected Behavior**: Primary action advances to "Recalculate local check", allowing the assessment to return to "CALCULATED · CURRENT".
- **Actual Behavior (CONTROL)**: Primary action remains permanently on "Run section check". Custody card remains `STALE_A_EVIDENCE_REFRESH_AVAILABLE`. B is never rebound to newly-calculated A result. Assessment remains permanently stuck in `STALE`.
- **Actual Behavior (CANDIDATE)**: `runEmp1SectionCheck` rebinds stage B to current qualified stage A evidence; primary action advances to "Recalculate local check", then "Review assessment", returning status to `CALCULATED · CURRENT`.
- **First Wrong Visible State**: Primary action button stuck on "Run section check" after clicking.
- **Relevant DOM Selector**: `[data-emp1-primary-action="true"]`, `[data-role="emp1-b-source-currentness"]`
- **Console / Network Evidence**: 0 console errors.
- **Screenshot Evidence**: `06-section-check-rerun.png`, `post-fix-05-section-check-advanced.png`
- **Likely Owning File**: `src/workspace/lafea-workbench-controller.js`, `src/workspace/lafea-workbench-view.js`
- **Reproduction on main**: Confirmed.
- **PR #1836 Status**: Resolved cleanly.
- **Risk to Engineering Interpretation**: CRITICAL. Completely blocks recalculation and re-verification after any load modification.
- **Recommended Fix Boundary**: Controller orchestration seam (`runEmp1SectionCheck`). No numerical calculation altered.
- **Post-Fix Result**: Fully resolved on branch `fix/emp1-ui-audit-remediation`.

---

### 3. U-03: Governing Result Headline Inaccessibility
- **Tested SHA**: CONTROL `99776d6f190cdc70c27a632c57db74068fde9630` vs CANDIDATE `4c4d21babe5df67481e9ed0880fab67b4b428f0b`
- **Viewport**: 1280×800 and 1600×1000
- **Precondition**: Qualification sample loaded and calculated.
- **Exact Browser Steps**:
  1. Click Step 6 Local check.
  2. Inspect primary visible pane above the fold without clicking disclosures.
- **Expected Behavior**: Governing WRC stress intensity, governing point (Au), units, and envelope scope limitation are immediately visible above the fold.
- **Actual Behavior (CONTROL)**: Step 6 primary pane contains only run configuration inputs and route metadata. Zero calculated stress results are visible. The 8-point stress table is buried at 2342px behind a collapsed "Results & evidence" toggle on the third tab.
- **Actual Behavior (CANDIDATE)**: Headline renders at `top: 515px` (well above the 800px fold) stating: *"Au · stress intensity 72.67 N/mm²"* with explicit note: *"Maximum over the eight evaluated WRC points only — not a continuous or global shell maximum."* In addition, the evidence console automatically opens on Step 6.
- **First Wrong Visible State**: Empty result area in Step 6 primary pane.
- **Relevant DOM Selector**: `[data-role="emp1-c-governing-result-headline"]`
- **Screenshot Evidence**: `07-local-result.png`, `post-fix-02-step6-headline-above-fold.png`
- **Likely Owning File**: `src/workspace/emp1-workbench-run-view.js`, `src/workspace/emp1-analytical-layout.js`
- **Reproduction on main**: Confirmed.
- **PR #1836 Status**: Resolved cleanly.
- **Risk to Engineering Interpretation**: HIGH. Leads engineers to assume the calculation failed or produced no output.
- **Recommended Fix Boundary**: Presentation layer.
- **Post-Fix Result**: Fully resolved on branch `fix/emp1-ui-audit-remediation`.

---

### 4. U-04: Unlabeled Stress Table and Raw Float Display
- **Tested SHA**: CONTROL `99776d6f190cdc70c27a632c57db74068fde9630` vs CANDIDATE `4c4d21babe5df67481e9ed0880fab67b4b428f0b`
- **Viewport**: 1280×800
- **Precondition**: Sample calculated; evidence console opened.
- **Exact Browser Steps**:
  1. Click Step 6 Local check.
  2. Open "Results & evidence" -> "Local check evidence".
  3. Inspect eight-point stress table columns and cell values.
- **Expected Behavior**: Every stress column header indicates its unit (e.g. `N/mm²`); values are formatted to readable engineering precision (4 s.f.); full precision is preserved in underlying data attributes.
- **Actual Behavior (CONTROL)**: Column headers are plain symbols: `["Location", "σφ", "σx", "τ", "Stress intensity", ...]` with no units. Numerical values render as raw IEEE-754 floats: `-44.51629933358771`, `-61.1959258532143`.
- **Actual Behavior (CANDIDATE)**: Headers display: `["Location", "σφ (N/mm²)", "σx (N/mm²)", "τ (N/mm²)", "Stress intensity (N/mm²)", ...]`. Numbers display formatted as `-44.52`, `-61.2`, `72.67`. Exact values are retained in `data-emp1-exact-value`.
- **First Wrong Visible State**: Unlabeled header `σφ`.
- **Relevant DOM Selector**: `[data-role="emp1-c-eight-point-stress"] th`
- **Screenshot Evidence**: `j07-eight-point-table.png`, `j07-candidate-stress-table.png`
- **Likely Owning File**: `src/workspace/emp1-professional-result-presentation.js`, `src/workspace/emp1-engineering-evidence-view.js`
- **Reproduction on main**: Confirmed.
- **PR #1836 Status**: Resolved cleanly.
- **Risk to Engineering Interpretation**: SEVERE. Unlabeled stress values cannot be signed off or reviewed for code compliance.
- **Recommended Fix Boundary**: Presentation layer. Numerical source values and resultHash remain untouched.
- **Post-Fix Result**: Fully resolved on branch `fix/emp1-ui-audit-remediation`.

---

### 5. U-08: Concatenated Outcome Status Text
- **Tested SHA**: CONTROL `99776d6f190cdc70c27a632c57db74068fde9630` & CANDIDATE `4c4d21babe5df67481e9ed0880fab67b4b428f0b`
- **Viewport**: All viewports
- **Precondition**: Sample calculated.
- **Exact Browser Steps**:
  1. Inspect `[data-role="emp1-assessment-outcome"]` in the header/workflow card.
- **Expected Behavior**: Cleanly separated tokens, e.g.: `Calculated: Assessment calculated — review the result. It is not approved for final use. · Result · Current assessment result · Use · Not approved for final use`.
- **Actual Behavior (CONTROL & CANDIDATE)**: Inline child spans are rendered without whitespace or delimiters, producing concatenated text: `CalculatedAssessment calculated — review the result. It is not approved for final use.Result · Current assessment resultUse · Not approved for final use`.
- **First Wrong Visible State**: "CalculatedAssessment" string.
- **Relevant DOM Selector**: `[data-role="emp1-assessment-outcome"]`
- **Screenshot Evidence**: `post-fix-01-outcome-banner.png`
- **Likely Owning File**: `src/workspace/emp1-presentation-finalizer.js`
- **Reproduction on main**: Confirmed.
- **PR #1836 Status**: Present in PR #1836 (unfixed).
- **Risk to Engineering Interpretation**: Medium (human readability defect).
- **Recommended Fix Boundary**: Modify child node population in `normalizeWorkflow` in `emp1-presentation-finalizer.js`.
- **Post-Fix Result**: Fixed and verified on branch `fix/emp1-ui-audit-remediation`.

---

### 6. U-12: Desktop Visually-Hidden Mode Tabs in Accessibility Tree
- **Tested SHA**: CONTROL & CANDIDATE
- **Viewport**: 1600×1000
- **Precondition**: Any loaded state.
- **Exact Browser Steps**:
  1. Set viewport to 1600×1000.
  2. Inspect `[data-role="emp1-console-mode-tabs"]` and buttons `[data-role="emp1-console-mode-tab"]`.
- **Expected Behavior**: When the tablist is visually hidden via CSS (`display: none`), assistive technologies should not receive active `role="tab"` elements with `aria-selected="true"`.
- **Actual Behavior**: Elements have `display: inline-block` with `0×0` dimensions (or `display: none` on parent), while retaining `role="tab"`, `tabindex="0"`, and `aria-selected="true"`.
- **Relevant DOM Selector**: `[data-role="emp1-console-mode-tab"]`
- **Likely Owning File**: `src/workspace/emp1-analytical-layout.js`, `src/workspace/emp1-analytical-layout-styles.js`
- **Classification**: ACCESSIBILITY_DEFECT.

---

### 7. U-05: Dirty Edit Silent Loss
- **Tested SHA**: CONTROL & CANDIDATE
- **Viewport**: 1280×800
- **Exact Browser Steps**:
  1. Navigate to Step 2 Geometry.
  2. Enter `999` into Outside Diameter. Do NOT click Apply.
  3. Click Step 3 Loads.
  4. Click Step 2 Geometry.
- **Expected Behavior**: Either uncommitted edits persist in draft form, or a dirty navigation confirmation warns the engineer.
- **Actual Behavior**: Uncommitted edits are silently wiped out, reverting to `220`.
- **Classification**: CONFIRMED_UI_BUG.

---

## Calculation / UI Separation

An explicit audit boundary was maintained throughout this investigation:
1. **Numerical Integrity**:
   - Zero changes were made to WRC equations, Table-5 mechanics, load sign conventions, or stress recovery matrices.
   - The eight-point stresses on Au/Al/Bu/Bl/Cu/Cl/Du/Dl remain mathematically identical between CONTROL, CANDIDATE, and POST-FIX (e.g. governing Au stress intensity $= 72.67281563686576	ext{ N/mm}^2$).
   - The result hash (`fnv1a64:5546c1b48b1cd434`) remains completely stable and identical across all runs.
2. **Presentation / Orchestration Only**:
   - Fixes U-01, U-03, U-04, and U-08 are purely presentation layer: displaying units in `<th>`, rounding displayed text to 4 s.f. while retaining exact values in attributes, placing governing headlines above the fold, and inserting string delimiters.
   - Fix #1853 is lifecycle orchestration: ensuring that when an upstream stage A is re-run, stage B's custody state is updated to point to the new A result before execution, matching the engine's contract.

---

## Do Not Fix as UI

The following items are protected engineering boundaries and must NOT be resolved as UI fixes:
1. **#1834 Non-tabulated $\gamma$ Authority**:
   - When $gamma 
eq 5$, WRC 537 supplies no codified interpolation equation.
   - Although the engine includes an interpolated comparison route matching CAUx within 2%, designating this as engineering-authorized code compliance requires formal owner governance approval, NOT a UI-level bypass.
2. **#1852 ResultHash Cross-Engine Policy**:
   - Divergence between analytical and FEA resultHash calculation remains strictly an owner-reserved architectural policy.
3. **CAUx Benchmark Values and Tolerances**:
   - External oracle comparison values must never be relaxed or altered to force a "green" state.
4. **WRC Mechanics and Source Semantics**:
   - Envelope limitations (eight points vs continuous shell) must always be explicitly stated alongside results.

---

## Top 5 Human-Factor Failures

Ranked strictly by engineering risk and review friction:

1. **U-01 · Pressure-radii dead-end on geometry edit**:
   - *Impact*: Blocks the engineer from analyzing real vessel geometries; forces an "Undo" loop with no indication that evaluation radii can be coordinated.
2. **#1853 · Permanent staleness after load change**:
   - *Impact*: Silently disables recalculation; clicking the primary action produces no result, misleading the user into believing the model is invalid.
3. **U-04 · Missing stress units on the primary deliverable**:
   - *Impact*: An engineering stress table without units ($N/	ext{mm}^2$ vs $	ext{kPa}$ vs $	ext{psi}$) cannot be approved, checked, or used in regulatory submissions.
4. **U-03 · Governing result hidden behind multi-step disclosures**:
   - *Impact*: The primary answer of Step 6 is absent from the viewport; engineers must open nested disclosures and scroll past 2000px to locate the result.
5. **U-05 · Silent loss of unapplied form edits**:
   - *Impact*: Typing a parameter and switching tabs silently discards the user's input with zero warning, risking incorrect assessment submissions based on stale data.

---

## Recommended Patch Order

1. **Blocks Completion**:
   - U-01 (Pressure radii refit recovery affordance)
   - #1853 (Stage B rebind to current qualified stage A)
2. **Prevents Reliance on Stale / Wrongly-Understood Results**:
   - U-03 (Governing result headline with 8-point limitation above the fold)
   - U-04 (Mandatory engineering units in stress table headers and 4 s.f. presentation)
3. **Hides Engineering Meaning**:
   - U-02 / U-16 (Plain-language boundary explanations on out-of-domain refusal)
   - U-08 (Outcome text delimiter formatting)
4. **Navigation & Accessibility Friction**:
   - U-05 (Dirty edit warning / navigation guard)
   - U-12 (Accessibility tree alignment for desktop mode tabs)
5. **Cosmetic Polish**:
   - U-15 (Retire unimplemented product tab)
   - U-07 (Input field display precision)

---

## Repository & PR Status

- **Control Base**: `99776d6f190cdc70c27a632c57db74068fde9630` (`main`)
- **Remediation Branch**: `fix/emp1-ui-audit-remediation`
- **Remote Tracking**: Pushed to `origin/fix/emp1-ui-audit-remediation`
- **PR URL**: `https://github.com/reallaksh19/Advanced_Analysis/pull/new/fix/emp1-ui-audit-remediation`
- **Build Status**: `build:lafea` PASS, `check:emp1-ui` 6/6 PASS, ESLint 0 errors / 0 warnings, Bundle-chunk hard ceiling PASS.
