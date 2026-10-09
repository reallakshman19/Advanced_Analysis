# LFEA Input Sub-tabs and Common Element Table — UI Concept

**Document status:** Issued for review — design only, no production code changed
**Programme:** LFEA unified pipeline shell
**Target surface:** `src/workspace/lfea-pipeline-shell-view.js` · `src/main.js` · the three source panels
**Related concept:** `docs/enrichment-preflight-ui-concept.md` (review-by-exception pattern reused here)
**Decision proposed:** Split the single `SOURCE` host into three owned sub-tabs, give each its own error
check, and lift the element property table out of the ACCDB panel into one source-agnostic table.

---

## 1. ASCII UI

This section is the first deliverable and the thing to argue with. Everything after it exists to
justify these screens.

Legend used in the tab strip:

```text
▌   active sub-tab
·   empty        — nothing loaded on this tab
●   loaded       — model read, error check not cleared
✓   cleared      — error check passed or its limitations were accepted
✗   blocked      — error check BLOCK; this tab cannot reach Load case
```

### S1 · Input step, nothing loaded

The one screen where all three tabs are genuinely a choice.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ LFEA [Load sample] [Authority supplement: none] [Code checks] [Verify / QA] │
├─────────────────────────────────────────────────────────────────────────────┤
│ ①Input      ②Error check   ③Load case   ④Run     ⑤Output    ⑥Export         │
│ CURRENT     BLOCKED        BLOCKED      BLOCKED  BLOCKED    BLOCKED         │
│ Step 0 of 6 complete. Next: Input — import an InputXML, ACCDB or SJSON.     │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┬────────────┬─────────────────┐                            │
│ │ ▌InputXML   · │  ACCDB   · │  StagedJSON   · │                            │
│ ├───────────────┴────────────┴─────────────────┴──────────────────────────┐ │
│ │ CAESAR II InputXML — native source                                      │ │
│ │                                                                         │ │
│ │  [ Import InputXML ]   Analysis profile [ Disclosed approximation  ▾ ]  │ │
│ │                                                                         │ │
│ │  No native InputXML source is loaded.                                   │ │
│ │                                                                         │ │
│ │  This tab reads a CAESAR II .xml directly. Units come from the file's   │ │
│ │  own LENGTH declaration; if it does not declare one you will be asked   │ │
│ │  to choose mm or in explicitly — nothing is inferred from geometry.     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### S2 · Input step, InputXML loaded

Input is the file and what was read from it. No findings here — those live on Error check.
The other two tabs stay reachable but are marked as what they are: not the loaded model.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ①Input      ②Error check   ③Load case   ④Run     ⑤Output    ⑥Export         │
│ CURRENT ✓   READY          BLOCKED      BLOCKED  BLOCKED    BLOCKED         │
│ Step 1 of 6 complete. Next: Error check — review the disclosed limitations. │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┬────────────┬─────────────────┐                            │
│ │ ▌InputXML   ● │  ACCDB   · │  StagedJSON   · │                            │
│ ├───────────────┴────────────┴─────────────────┴──────────────────────────┐ │
│ │ CAESAR II InputXML — native source          [ Clear ]                   │ │
│ │                                                                         │ │
│ │   File          BM4_L.xml                                               │ │
│ │   Format        CAESAR II InputXML                                      │ │
│ │   SHA-256       9f2c4b…a11e                                             │ │
│ │   Length unit   mm — CAESAR_INPUTXML_DECLARED_LENGTH_UNIT               │ │
│ │   Profile       DISCLOSED_GENERIC_ANALYZER_APPROXIMATION                │ │
│ │   Nodes         142        Elements   139                               │ │
│ │   Available cases  W+T1+P1, W+P1, W                                     │ │
│ │   Pre-flight    WARN  → see Error check                                 │ │
│ │                                                                         │ │
│ │   [ Element table (139) ▸ ]      ← common table, §4                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  This model is loaded from InputXML. Switching tabs does not discard it;    │
│  importing on another tab will ask you to confirm the replacement.          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### S3 · Error check, InputXML sub-tab

Each tab's error check is the review of *its own* model, in one shape shared by all three:
counts → grouped findings → the one control that moves it forward.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ①Input ✓    ②Error check   ③Load case   ④Run     ⑤Output    ⑥Export         │
│             CURRENT        BLOCKED      BLOCKED  BLOCKED    BLOCKED         │
│ Step 1 of 6 complete. Next: Error check — accept the notes, then Load case. │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┬────────────┬─────────────────┐                            │
│ │ ▌InputXML   ● │  ACCDB   · │  StagedJSON   · │                            │
│ ├───────────────┴────────────┴─────────────────┴──────────────────────────┐ │
│ │ Error check — BM4_L.xml           Profile [ Disclosed approximation ▾ ] │ │
│ │                                                                         │ │
│ │  Stops the analysis  0     Needs acceptance  6     Recorded only  23    │ │
│ │                                                                         │ │
│ │  ▾ Needs acceptance — 6                                                 │ │
│ │    ▸ Bend radius taken from the code default        4 elements  [view]  │ │
│ │    ▸ Rigid element mass applied at end nodes        2 elements  [view]  │ │
│ │  ▸ Recorded only — 23                                                   │ │
│ │  ▸ Unit diagnostics — 0                                                 │ │
│ │                                                                         │ │
│ │  These are simplifications this tool makes, not faults in your model.   │ │
│ │  Your name and reason are recorded with the acceptance.                 │ │
│ │    Your name [ ......................... ]                              │ │
│ │    Reason    [ ......................... ]                              │ │
│ │    [ Accept these notes and continue ]                                  │ │
│ │                                                                         │ │
│ │  [ Element table (139) ▸ ]   [ Repair model ▸ ]                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### S4 · Error check, ACCDB sub-tab

Same three bands. ACCDB adds the capability table, because an ACCDB import genuinely
carries less than an InputXML one and the engineer has to be told which parts.

```text
│ ┌───────────────┬────────────┬─────────────────┐                            │
│ │  InputXML   · │ ▌ACCDB   ● │  StagedJSON   · │                            │
│ ├───────────────┴────────────┴─────────────────┴──────────────────────────┐ │
│ │ Error check — BM4_L.ACCDB         Profile [ Disclosed approximation ▾ ] │ │
│ │                                                                         │ │
│ │  Stops the analysis  0     Needs acceptance  4     Recorded only  11    │ │
│ │                                                                         │ │
│ │  What this model can and cannot do, for the profile selected above      │ │
│ │    Pipe runs and bends .................... available                   │ │
│ │    Restraints ............................. available                   │ │
│ │    Expansion joints ....................... not used by this profile    │ │
│ │    Nonlinear friction ..................... not available — does not    │ │
│ │                                             stop an analysis            │ │
│ │                                                                         │ │
│ │  ▾ Needs acceptance — 4                                                 │ │
│ │    ▸ Element identity is synthetic PIPINGELEMENT[i]  139 elements       │ │
│ │    ▸ Wall thickness inherited from previous element   7 elements        │ │
│ │  ▸ Recorded only — 11                                                   │ │
│ │                                                                         │ │
│ │    Your name [ ......... ]  Reason [ ......... ]  [ Accept and continue]│ │
│ │                                                                         │ │
│ │  [ Element table (139) ▸ ]   ← editable on this tab (field overrides)   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
```

### S5 · Error check, StagedJSON sub-tab — two bands, stated honestly

StagedJSON is not a peer source: it is a **converter into InputXML**. Its error check therefore
has two gates, and pretending it has one is the current design's core mistake. Band A is the
conversion; band B is the pre-flight on what the conversion produced. Band B cannot be reached
until band A is READY.

```text
│ ┌───────────────┬────────────┬─────────────────┐                            │
│ │  InputXML   · │  ACCDB   · │ ▌StagedJSON   ● │                            │
│ ├───────────────┴────────────┴─────────────────┴──────────────────────────┐ │
│ │ Error check — Sjson.json → Sjson.converted.xml                          │ │
│ │                                                                         │ │
│ │  ┌ A · Conversion  SJSON → InputXML ───────────────────── READY ──────┐ │ │
│ │  │  Errors 0    Warnings 37    Info 612    OK 143    Total 792        │ │ │
│ │  │  ▾ Warnings — 37                                                   │ │ │
│ │  │    ▸ OD inferred from nominal bore      29 records   (opt-in on)   │ │ │
│ │  │    ▸ Material name not in master         8 records                 │ │ │
│ │  │      showing 20 of 29 · [ export all ]                             │ │ │
│ │  │  ▸ Info — 612       ▸ OK — 143                                     │ │ │
│ │  └────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │  ┌ B · Pre-flight on the converted InputXML ─────────────── WARN ─────┐ │ │
│ │  │  Stops the analysis  0   Needs acceptance  6   Recorded only  23   │ │ │
│ │  │  ▾ Needs acceptance — 6                                            │ │ │
│ │  │    ▸ Bend radius taken from the code default      4 elements       │ │ │
│ │  │      ↳ from SJSON record  lines[12].components[3]                  │ │ │
│ │  │    ▸ Rigid element mass applied at end nodes      2 elements       │ │ │
│ │  │    Your name [ ....... ] Reason [ ....... ] [ Accept and continue ]│ │ │
│ │  └────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │  [ Element table (139) ▸ ]   [ View converted InputXML ▸ ]              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
```

If band A had errors, band B is not rendered at all and says why:

```text
│ ┌ B · Pre-flight on the converted InputXML ───────── NOT REACHED ─────┐     │
│ │  The conversion produced 3 errors. There is no InputXML to check    │     │
│ │  yet — resolve band A above, then re-import.                        │     │
│ └─────────────────────────────────────────────────────────────────────┘     │
```

### S6 · Common element table — one table, reached from any sub-tab

Defaults to **exceptions only**, following the review-by-exception pattern already adopted in
`docs/enrichment-preflight-ui-concept.md`. 139 elements × 14 fields is 1 946 evidence cells;
nobody reads that, and a table that shows it all hides the eleven that matter.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Element table — BM4_L.xml · InputXML                             [ close ]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Rows  (•) Exceptions only   ( ) All 139       Fields [ Geometry ▾ ]         │
│ Exception = a field that is ABSENT, sentinel-blank, INVALID, or named       │
│ by a retained finding. Canonical value shown; raw is on the ↳ line.         │
│                                                                             │
│  ┌───────────────────┬──────┬─────┬───────┬───────────┬────────────┐        │
│  │ Element           │ From │ To  │ Type  │ DIAMETER  │ WALL_THICK │        │
│  ├───────────────────┼──────┼─────┼───────┼───────────┼────────────┤        │
│  │ PIPINGELEMENT[11] │ 120  │ 130 │ BEND  │ 168.3     │ 7.11       │        │
│  │   ↳ DIAMETER    ABSENT · inherited from PIPINGELEMENT[9]        │        │
│  │ PIPINGELEMENT[24] │ 240  │ 250 │ RUN   │ 168.3     │ 7.11       │        │
│  │   ↳ WALL_THICK  ABSENT · inherited from PIPINGELEMENT[22]       │        │
│  │ PIPINGELEMENT[31] │ 310  │ 320 │ RUN   │ 168.3     │ —          │        │
│  │   ↳ WALL_THICK  raw 0.0 INVALID · LPX_WALL_THICK_NON_POSITIVE   │        │
│  └───────────────────┴──────┴─────┴───────┴───────────┴────────────┘        │
│                                                                             │
│  3 of 139 elements have an exception in the Geometry field group.           │
│  Field groups: Geometry · Material · Operating · Insulation & corrosion     │
│                                                                             │
│  Editing: not available for an InputXML source. The file owns these         │
│  values; correct them in CAESAR II and re-import, or use Repair model.      │
└─────────────────────────────────────────────────────────────────────────────┘
```

Same table, ACCDB source — identical columns, one extra identity column, and editing enabled:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Element table — BM4_L.ACCDB · ACCDB                              [ close ]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┬─────────┬──────┬─────┬─────────────┬─────────────┐   │
│  │ Element           │ ACCDB id│ From │ To  │ DIAMETER    │ WALL_THICK  │   │
│  ├───────────────────┼─────────┼──────┼─────┼─────────────┼─────────────┤   │
│  │ PIPINGELEMENT[11] │  1012   │ 120  │ 130 │ [ 168.275 ] │ [  7.11   ] │   │
│  │   ↳ DIAMETER  raw −1.01010000705719 = ACCDB blank sentinel           │   │
│  └───────────────────┴─────────┴──────┴─────┴─────────────┴─────────────┘   │
│                                                                             │
│  Edits rewrite the imported table cell and re-run the whole import.         │
│  Every override is disclosed and carries your name and reason.              │
│    Approver [ ......... ]  Reason [ ......... ]  [ Apply 1 override ]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Review of the input tabs as they stand today

Verified by inspection of the code on `claude/input-tabs-error-check-p78jbg` at
`49c9228`. Each finding names its evidence.

### How it works now

There are no input sub-tabs. `LFEA_PIPELINE_STEPS` has six steps
(`src/workspace/lfea-pipeline-step-registry.js:10-17`); `INPUT` and `ERROR_CHECK` share one
`SOURCE` host. All three source panels mount as siblings into that single host
(`src/main.js:63`, `:80`, `:92`) and are shown or hidden entirely by CSS, keyed on two attributes
the shell stamps on the host:

| Attribute | Set by | Values |
|---|---|---|
| `data-active-step` | `LfeaPipelineShellView.render()` (`lfea-pipeline-shell-view.js:196`) | `INPUT` \| `ERROR_CHECK` \| … |
| `data-active-source` | `refreshLfeaStepGuidance()` (`src/main.js:260-262`) | `NONE` \| `INPUTXML` \| `ACCDB` |

The rules live in `src/workspace/lfea-pipeline-shell.css:505-550`.

### F-1 · A StagedJSON conversion hides its own diagnostics at the moment they are produced

**Severity: high. This is the finding that most justifies the sub-tab split.**

`data-active-source` has no `STAGEDJSON` value. It is derived from *what is loaded*, and a
StagedJSON conversion loads its output into the InputXML panel, so the session becomes
`INPUTXML`. The stylesheet then hides the StagedJSON panel outright:

```css
/* lfea-pipeline-shell.css:540-545 */
[data-host-group="SOURCE"][data-active-source="INPUTXML"]
  [data-role="lfea-pipeline-stagedjson-input-panel"] { display: none; }
```

The exact ordering makes this worse than a stale panel. In
`LfeaPipelineStagedJsonInputPanelController.convertSelectedFile()`:

```text
convert()  →  options.onConversionComplete(result)              main.js:82
           →  linearPipingInputXmlSource.loadSource(...)        workflow.js:81
           →  prepareSource() → render()                        workflow.js:344
           →  onStateChanged(snapshot)                          workflow.js:362
           →  refreshLfeaStepGuidance()                         main.js:245
           →  setActiveSourceKind('INPUTXML')                   main.js:260
           →  CSS hides the StagedJSON panel
finally    →  this.render()   ← writes the diagnostics into the hidden panel
```

The 792-record diagnostics sidecar for `public/Sjson.json` — 37 warnings on that fixture — is
rendered into an element that was hidden two statements earlier. The commit that introduced the
rule states the behaviour plainly ("once its conversion lands the InputXML panel owns the model
and the StagedJSON panel steps aside with the rest", `8399b69`), so this is intended by that
commit and simply not reconciled with the fact that the StagedJSON panel is the *only* place
conversion warnings are ever shown.

**Predicted consequence, not executed:** `e2e/lfea-pipeline-stagedjson-input.spec.js:45` clicks
`[data-action="clear-lfea-pipeline-stagedjson-source"]`, which by then sits inside a
`display: none` subtree. Playwright's click requires actionability, so that spec is expected to
fail on the current head. Its earlier assertions survive because `toContainText` reads
`textContent` and does not require visibility. `8399b69` updated the ACCDB and analysis-run
specs and did not touch this one. **STATUS: NOT_RUN** — `node_modules` is absent in this
environment; confirm by running that single spec before relying on it.

### F-2 · StagedJSON has no error check at all

```css
/* lfea-pipeline-shell.css:523-526 */
[data-host-group="SOURCE"][data-active-step="ERROR_CHECK"]
  [data-role="lfea-pipeline-stagedjson-input-panel"] { display: none; }
```

Deliberate — the comment says StagedJSON "has no review of its own" — but it is only true of the
*pre-flight*. The conversion has its own severity-graded diagnostics with its own `outputReady`
gate (`stagedjson-conversion-diagnostics-view.js:37-63`), and that is exactly an error check.
Combined with F-1 there is no step on which a converted model's conversion warnings can be read.

### F-3 · The stepper can only describe one source at a time, and InputXML always wins

`refreshLfeaStepGuidance()` is an if/else chain: `if (inputXmlLoaded) { … return; }` then
`if (accdbLoaded) { … }` (`src/main.js:272-313`). For a converted StagedJSON model the first
branch always fires, so `ERROR_CHECK` reports the InputXML pre-flight verdict and the conversion
result is never projected onto the stepper. The same precedence is baked into
`activeLfeaPreFlight()` (`src/main.js:226`), whose own comment concedes the tiebreak is arbitrary
("The InputXML workflow wins when both are").

### F-4 · Sub-tab selection does not exist as state, so it cannot be chosen

Which panel is visible is a *consequence* of what is loaded, never a choice. An engineer cannot
open the ACCDB tab to check what it would require while an InputXML model is loaded, and cannot
compare two imports of the same model. `Clear` is the only way to see the other panels.

### F-5 · Three different review vocabularies for one step

| Sub-tab | Error-check shape today | Evidence |
|---|---|---|
| InputXML | flat `<ul>`, one `<li>` per finding, `disposition · code · message`, no grouping, no counts | `linear-piping-inputxml-source-workflow.js:541-558` |
| ACCDB | capability table + grouped finding sections + plain language + acceptance custody | `lfea-pipeline-accdb-input-panel.js:579-737` |
| StagedJSON | severity-grouped conversion records, summary table, capped at 20 rows per code | `stagedjson-conversion-diagnostics-view.js` |

The ACCDB panel is the most developed and is the right model for the others: it already speaks in
engineer's terms ("does not stop an analysis") rather than raw disposition codes.

### F-6 · The InputXML finding list does not scale

`renderReviewFindings` emits one `<li>` per non-PASS finding with no grouping and no cap. The
StagedJSON view solved this problem for its own records (`MAX_DETAIL_ROWS_PER_CODE = 20`) and the
ACCDB view solved it with grouped sections; the InputXML view has neither.

### F-7 · Only one of three sources has an element table

`buildAccdbElementPropertyRows()` (`lfea-pipeline-accdb-view-model.js:268-287`) gives ACCDB a
14-field raw/canonical/disposition table with editable overrides. InputXML and StagedJSON show
nothing equivalent, although — see §4 — the data behind that table is present and identically
shaped for all three. The same model imported two ways gives two different levels of visibility.

---

## 3. Target design — three owned sub-tabs

### 3.1 What a sub-tab owns

Each sub-tab owns one source format end to end: its import control, its source statistics, its
error check, its gate, and its element table. Nothing about a sub-tab is decided by what another
sub-tab is holding.

```text
sub-tab
  ├─ Input half        import control · source statistics · element-table entry
  ├─ Error check half  counts → grouped findings → the one control that proceeds
  └─ gate              PASS | WARN(accepted) | BLOCK | NOT_PREPARED
```

`INPUT` and `ERROR_CHECK` keep sharing the `SOURCE` host and keep being separated by
`data-active-step`. That split is sound and is not what this change touches.

### 3.2 State model

Add one field to the pipeline session — the sub-tab the engineer selected — and stop deriving
visibility from what is loaded:

```text
lfea-pipeline-session/v2
  activeStepId        INPUT | ERROR_CHECK | …            (unchanged)
  activeSourceTab     INPUTXML | ACCDB | STAGEDJSON      (new — a choice, not a derivation)
  sourceTabState      per tab: { loaded, gate, fileName, blockedReason }   (new)
  loadedSourceTab     INPUTXML | ACCDB | STAGEDJSON | NONE (new — who owns the model)
```

`activeSourceTab` and `loadedSourceTab` are deliberately separate. Today they are the same
variable, which is precisely F-4.

### 3.3 One loaded model at a time — recommended

**Recommendation: exactly one model may be loaded across the three sub-tabs.** Importing on a
second tab asks the engineer to confirm the replacement, then clears the first.

The reason is not UI tidiness. Everything downstream of Error check consumes one *sealed*
pre-flight — `activeLfeaPreFlight()`, `runLfeaPipelineAnalysis()`, the run request, the results
workbench. Letting three coexist would need an "active model" pointer that the sealed-authority
chain has no concept of, and the existing arbitrary `inputXml ?? accdb` tiebreak (F-3) is what
that ambiguity already looks like at one-third scale.

The alternative — each tab holds its own model, with an explicit active-model selector — buys
side-by-side comparison of the same model imported two ways. That is a real engineering use
(it is how you would find an ACCDB/InputXML extraction discrepancy), but it is a larger change
that touches authority selection, and it should be its own assignment if the owner wants it.
**This is an owner decision; §6 D-1.**

### 3.4 Stepper projection

`refreshLfeaStepGuidance()` stops being an if/else chain over what is loaded and becomes: read
the gate of the **loaded** tab; if nothing is loaded, `ERROR_CHECK` is blocked with
"Load a model on the Input step first" (which it already says correctly today).

Each sub-tab additionally publishes its own gate into `sourceTabState`, which is what draws the
`· ● ✓ ✗` glyphs in the tab strip. The stepper still shows one status, because there is still one
model — but the tab strip shows where that model came from without the engineer having to guess.

### 3.5 StagedJSON's two bands

The StagedJSON tab's gate is the **conjunction** of two gates:

| Band | Gate source | Blocks |
|---|---|---|
| A · Conversion | `diagnostics.outputReady` + `summary.error` (`stagedjson-conversion-diagnostics-view.js:42-44`) | band B |
| B · Pre-flight | the InputXML pre-flight over the converted text | Load case |

Band B renders only when band A is READY, and says why when it does not (screen S5). This is
the honest shape; a single merged verdict would have to pick one of two unrelated failure modes
to report and hide the other.

The converted model keeps being handed to `linearPipingInputXmlSource.loadSource()` exactly as
today — that handoff is correct and should not change. What changes is that the *view* of the
resulting pre-flight is rendered inside the StagedJSON tab, so `loadedSourceTab` is `STAGEDJSON`
rather than being laundered into `INPUTXML`.

---

## 4. The common element table

### 4.1 The table already exists — it is misfiled, not missing

`parseInputXmlModelHealthSource()` and `parseAccdbModelHealthSource()` produce **the same bundle
shape**, deliberately: the ACCDB adapter's own header says it assigns synthetic
`PIPINGELEMENT[i]` identities "only to satisfy the shared model-health contract InputXML and
StagedJSON already use" (`accdb-source-binding.js:11-30`). Both declare the **same fourteen
fields, by the same names**:

```text
DIAMETER  WALL_THICK  MATERIAL_NAME  MODULUS  POISSONS  TEMP_EXP_C1  TEMP_EXP_C2
PRESSURE1  HYDRO_PRESSURE  FLUID_DENSITY  PIPE_DENSITY  INSUL_THICK
INSUL_DENSITY  CORR_ALLOW
```

(`inputxml-model-health-source.js:20-35` and `accdb-source-binding.js:102-117`.)

Both attach the same per-field evidence record:

```text
fieldEvidence[NAME] = {
  disposition            EXPLICIT | INHERITED | ABSENT | INVALID | *_INHERITED
  rawAttributeName       the source's own field name
  rawValue               as read, before canonicalization
  effectiveSourceFeatureId   which element the effective value actually came from
  canonicalValue         the mechanically meaningful value
}
```

And `buildAccdbElementPropertyRows(sourceBundle)` reads only `sourceFeatureId`, `accdbElementId`,
`fromNodeId`, `toNodeId`, `canonicalSegmentType` and `fieldEvidence`. **Thirteen of those
fourteen inputs are already source-agnostic.** The function is ACCDB-only in name and location,
not in behaviour.

So the plan is not "design a common element table". It is:

1. move that builder to a shared module under a source-neutral name;
2. generalise its one ACCDB-specific column;
3. feed it the InputXML bundle, which is already retained and reachable;
4. stop the two field-spec lists from drifting apart.

### 4.2 Where each source's bundle comes from

| Sub-tab | Bundle | Reachable at |
|---|---|---|
| InputXML | `preFlight.diagnostics.sourceBundle` | retained by `diagnosticsEvidence()`, `inputxml-linear-prefea-diagnostics.js:196-201`; surfaced through `linearPipingInputXmlSource.getPreFlight()` |
| ACCDB | `controller.sourceBundle` | built in the panel by `parseAccdbModelHealthSource` |
| StagedJSON | the InputXML bundle of the converted text | same as InputXML, once the handoff lands |

No new parse path is needed for any of the three. That matters: a second parse would be a second
authority for the same numbers, which §7/§9 of `AGENTS.md` forbid.

### 4.3 Columns

```text
identity      sourceFeatureId          all sources    PIPINGELEMENT[i]
              nativeRecordId           per source     ACCDB: accdbElementId
                                                      InputXML: sourceIndex / NAME attribute
                                                      StagedJSON: SJSON record pointer
topology      fromNodeId, toNodeId     all sources
              canonicalSegmentType     all sources    RUN | BEND | REDUCER | RIGID | …
              canonicalStatus          all sources    RECONCILED | UNRESOLVED
evidence      14 × { rawValue, canonicalValue, disposition, effectiveSourceFeatureId }
```

`nativeRecordId` is the single generalisation required: today's `accdbElementId` becomes a
`{ label, value }` the adapter supplies, so the column header reads "ACCDB id" or "XML index"
rather than one source's vocabulary being imposed on the others.

### 4.4 Fitting 14 fields on a screen

14 fields × 3 evidence cells = 42 columns per row. Two mechanisms, both already house style:

- **Exceptions only by default** — a row appears if any field is `ABSENT`, `INVALID`, carries the
  ACCDB blank sentinel (`-1.01010000705719`, `accdb-source-binding.js:135`), or is named by a
  retained finding. `All rows` is one toggle away. This is the review-by-exception model already
  adopted in `docs/enrichment-preflight-ui-concept.md` §1.
- **Field groups** — Geometry (`DIAMETER`, `WALL_THICK`) · Material (`MATERIAL_NAME`, `MODULUS`,
  `POISSONS`) · Operating (`TEMP_EXP_C1/C2`, `PRESSURE1`, `HYDRO_PRESSURE`, `FLUID_DENSITY`,
  `PIPE_DENSITY`) · Insulation & corrosion (`INSUL_THICK`, `INSUL_DENSITY`, `CORR_ALLOW`).

### 4.5 What is *not* common — declare it, do not smooth it over

| Difference | InputXML | ACCDB | StagedJSON |
|---|---|---|---|
| Editable | no | yes — `accdb-field-overrides.js` re-runs the import from edited cells | no |
| Blank encoding | attribute absent | `-1.01010000705719` sentinel | inherited from the converted XML |
| Native identity | XML attribute order | `accdbElementId` | SJSON record pointer |
| Extra provenance | — | — | SJSON → XML record mapping |

**Editability is a per-source capability flag on the table, not a property of the table.** The
ACCDB override path works because the panel still holds the imported tables and can re-run the
whole import from them; InputXML has no equivalent in this panel, and inventing one here would be
a new writeback authority — out of scope, and `topology-edit/export/topology-edit-inputxml-writeback.js`
is a different surface with its own governance. The table renders read-only cells unless the
mounting sub-tab declares `editable: true` and supplies the override handler.

### 4.6 Drift guard

The two field-spec lists are declared independently and only one is exported: ACCDB's is
`ACCDB_ELEMENT_FIELD_SPECS` (`accdb-source-binding.js:127`); InputXML's is a module-private
`FIELD_SPECS`. They are identical today and nothing prevents them diverging tomorrow — at which
point the "common" table would silently show fourteen columns for one source and thirteen for
another.

Fix in the same change: one shared `SOURCE_ELEMENT_FIELD_SPECS` both adapters import, plus a
real-code check (`scripts/`, alongside `lfea-pipeline-step-guidance-check.mjs`) asserting that
the `fieldEvidence` key set of a parsed InputXML bundle and a parsed ACCDB bundle are equal.

---

## 5. Delivery sequencing

Each phase is separately reviewable and leaves the app working.

| Phase | Change | Validation |
|---|---|---|
| P1 | Sub-tab strip + `activeSourceTab` in the session; visibility driven by the selected tab instead of `data-active-source` | new `scripts/lfea-pipeline-source-tab-check.mjs`; existing `lfea-pipeline-step-guidance-check.mjs` unchanged and green |
| P2 | StagedJSON keeps its own tab after conversion (fixes F-1, F-2); two-band error check (S5) | repair + re-assert `e2e/lfea-pipeline-stagedjson-input.spec.js`, incl. visibility of the diagnostics *after* conversion |
| P3 | One review shape across the three tabs — counts → grouped findings → gate; InputXML adopts grouping and caps (F-5, F-6) | `e2e/lfea-pipeline-inputxml-matrix.spec.js` extended with the grouped-section assertions the ACCDB spec already makes |
| P4 | Stepper projects from the loaded tab's gate, not an if/else precedence (F-3) | `lfea-pipeline-step-guidance-check.mjs` extended for a StagedJSON-loaded session |
| P5 | Lift `buildAccdbElementPropertyRows` → shared builder; `nativeRecordId`; shared field specs + drift check | drift check; ACCDB element-table spec must pass unchanged |
| P6 | Element table mounted on the InputXML and StagedJSON tabs, read-only; exceptions-only default and field groups | new e2e: same model via InputXML and via ACCDB yields the same 14 field names and the same canonical values |

P5 and P6 are the answer to "how to plan the common element table" and depend only on P1.

---

## 6. Open decisions for the owner

- **D-1 · One model or three?** §3.3 recommends one loaded model across the sub-tabs, with an
  explicit replace confirmation. Three simultaneous models would enable same-model cross-format
  comparison but needs an active-model authority the sealed chain does not have today. Recommend
  one; ship comparison separately if wanted.
- **D-2 · Does StagedJSON keep handing off to the InputXML panel's `loadSource()`?** Recommend
  yes — it is the correct reuse, and only the *view* ownership moves. Confirm.
- **D-3 · Element-table editing.** Recommend it stays ACCDB-only until an InputXML writeback
  authority is separately approved. Anything else creates a second source of truth for values the
  file owns.
- **D-4 · Field-group boundaries** in §4.4 are a proposal from the field names; an engineer should
  confirm the Operating grouping in particular.

---

## 7. Validation status

Per `AGENTS.md` §9. No production code was changed by this document.

| Item | STATUS | OBSERVATION | ORACLE |
|---|---|---|---|
| F-1 hide-after-conversion mechanism | PASS | inspection of the call chain `main.js:82 → workflow.js:81/344/362 → main.js:245/259` against `lfea-pipeline-shell.css:540-545`; corroborated by `8399b69`'s own commit message | implementation-coupled (source reading) |
| F-1 predicted spec failure at `stagedjson-input.spec.js:45` | NOT_RUN | `node_modules` absent in this environment; no browser run attempted | would be independent (Playwright actionability) |
| F-2 … F-7 | PASS | inspection, each with the file/line cited inline | implementation-coupled |
| Shared bundle shape / identical 14 field names | PASS | side-by-side reading of `inputxml-model-health-source.js:20-35` and `accdb-source-binding.js:102-117` | implementation-coupled |
| InputXML bundle reachable via `preFlight.diagnostics.sourceBundle` | PASS | `inputxml-linear-prefea-diagnostics.js:196-201`, `linear-piping-inputxml-prefea.js:211-213` | implementation-coupled |
| Any behaviour of the proposed design | NOT_RUN | nothing implemented | — |

**Exact next action:** run `npx playwright test e2e/lfea-pipeline-stagedjson-input.spec.js` on this
head to convert the F-1 spec prediction from NOT_RUN to PASS/FAIL, then take the owner's D-1
decision before starting P1.
