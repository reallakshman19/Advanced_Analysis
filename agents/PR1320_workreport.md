# PR1320 — work report

**Identity:** `PR1320` (allocated from `WIP-LFEA-INPUT-SUBTABS`)
**Pull request:** https://github.com/reallaksh19/Advanced_Analysis/pull/1320 (draft)
**Branch:** `claude/input-tabs-error-check-p78jbg`
**Base at start:** `49c9228` (`main`)
**Criticality:** `ENGINEERING_CRITICAL` (LFEA source intake / pre-flight surface)
**Authority exercised:** `DESIGN_AND_REVIEW_ONLY` — no production file changed
**State:** `DESIGN_ISSUED_FOR_REVIEW`

---

## 1. Mission

Owner request (verbatim):

> Review the input tabs, need to create 3 subtabs for inputxml/accdb/stagged isjon and each
> should have their own error check. how to plan common element table? Need to fist create
> ascii UI

Four deliverables: (a) an ASCII UI **first**, (b) a review of the input tabs as they stand,
(c) a plan for three sub-tabs each owning its own error check, (d) a plan for a common element
table.

## 2. Delivered

`docs/lfea-input-subtabs-ui-concept.md` — one document, ASCII UI first:

| § | Content |
|---|---|
| 1 | Six ASCII screens: Input (empty), Input (loaded), Error check × InputXML/ACCDB/StagedJSON, common element table (InputXML read-only and ACCDB editable variants) |
| 2 | Review of today's input tabs — findings F-1 … F-7, each with file:line evidence |
| 3 | Three-sub-tab target design: state model, ownership, one-model recommendation, stepper projection, StagedJSON's two-band error check |
| 4 | Common element table: what already exists, what to lift, columns, per-source differences, editability, drift guard |
| 5 | Six-phase delivery sequencing with per-phase validation |
| 6 | Four open owner decisions (D-1 … D-4) |
| 7 | Validation status table per `AGENTS.md` §9 |

No production code, test, workflow or fixture was modified. `git diff --stat` against
`49c9228` shows documentation and agent artifacts only.

## 3. Findings register

| Id | Severity | Finding |
|---|---|---|
| F-1 | high | A StagedJSON conversion hides its own diagnostics at the moment it produces them: the handoff sets `data-active-source="INPUTXML"`, whose CSS rule hides the StagedJSON panel, and the panel then renders its diagnostics into the hidden subtree. |
| F-2 | high | StagedJSON has no error check — the `ERROR_CHECK` CSS rule hides its panel outright, and the conversion diagnostics are the only place conversion warnings exist. |
| F-3 | medium | `refreshLfeaStepGuidance()` is an if/else chain; InputXML always wins, so a converted StagedJSON session reports the InputXML verdict only. Same arbitrary precedence in `activeLfeaPreFlight()`. |
| F-4 | medium | Sub-tab selection is not state — visibility is derived from what is loaded, so no tab can be opened for inspection while a model is loaded. |
| F-5 | medium | Three different review vocabularies for one step (flat `<ul>` / grouped sections + capabilities / severity-grouped records). |
| F-6 | low | The InputXML finding list has no grouping and no cap; the other two panels each solved this separately. |
| F-7 | medium | Only ACCDB has an element table, although the underlying bundle is identically shaped for all three sources. |

## 4. Key technical fact established

`parseInputXmlModelHealthSource()` and `parseAccdbModelHealthSource()` emit the **same bundle
shape** with the **same fourteen field names** and the same `fieldEvidence` record.
`buildAccdbElementPropertyRows()` already reads only source-agnostic fields except one
(`accdbElementId`). The common element table therefore requires **no new parse path and no new
authority** — it is a relocation plus one generalised identity column. This is the substantive
answer to the owner's "how to plan common element table?".

The InputXML bundle is reachable at `preFlight.diagnostics.sourceBundle`, retained by
`diagnosticsEvidence()` in `inputxml-linear-prefea-diagnostics.js:196-201`.

## 5. Risks

| Id | Risk |
|---|---|
| RISK-1 | F-1's predicted breakage of `e2e/lfea-pipeline-stagedjson-input.spec.js:45` is **NOT_RUN**. `node_modules` is absent here; no browser was run. Treat as a prediction until executed. |
| RISK-2 | The two element field-spec lists are declared independently and only ACCDB's is exported. They are identical today; nothing enforces that. A "common" table built before the drift guard could silently show different column sets per source. |
| RISK-3 | D-1 (one loaded model vs three) changes the shape of P1. Starting P1 before that decision risks rework of the session state. |

## 6. Decisions requested from the owner

- **D-1** One model loaded across the three sub-tabs (recommended) vs one per tab with an
  explicit active-model selector.
- **D-2** StagedJSON continues to hand its converted text to `linearPipingInputXmlSource.loadSource()` (recommended yes; only view ownership moves).
- **D-3** Element-table editing stays ACCDB-only (recommended) until an InputXML writeback authority is separately approved.
- **D-4** Confirm the four field-group boundaries in §4.4.

## 7. Validation

| Item | STATUS | OBSERVATION | ORACLE |
|---|---|---|---|
| F-1 mechanism | PASS | inspection of the call chain and the CSS rule; corroborated by `8399b69`'s commit message | implementation-coupled |
| F-1 spec-failure prediction | NOT_RUN | `node_modules` absent; no browser run | would be independent |
| F-2 … F-7 | PASS | inspection, file:line cited inline in the concept doc | implementation-coupled |
| Shared bundle shape / 14 identical field names | PASS | side-by-side reading of both adapters | implementation-coupled |
| Any proposed behaviour | NOT_RUN | nothing implemented | — |

No tolerance was weakened, no expected value changed, no benchmark touched, no test skipped.

## 8. Changed-file ledger

| File | Change |
|---|---|
| `docs/lfea-input-subtabs-ui-concept.md` | new — the deliverable |
| `agents/PR1320_workreport.md` | new — this report |
| `agents/status/PR1320.yaml` | new |
| `agents/claims/PR1320.yaml` | new |

## 9. EXACT_NEXT_ACTION

```bash
npm ci && npx playwright test e2e/lfea-pipeline-stagedjson-input.spec.js
```

Converts RISK-1 from `NOT_RUN` to `PASS`/`FAIL`. Then take the owner's D-1 decision before
starting phase P1 (`docs/lfea-input-subtabs-ui-concept.md` §5).
