# Primary workbench migration — executable and browser evidence

Recorded 2026-10-02. Responsibility: owner-direct:advanced-analysis:sjson-routine-run-auto-20261001. ENGINEERING_CRITICAL. Protocol: Common engineering-pr-delivery-v3.2 at `149770a21ca073df49717a96e2106c967adddc2d`.

Executable migration commit: `7aea4c869d8f9e3b40211a2393a8d683497c8433`, based on turn-start draft head `7377ea0bf87ee7348cbe40ceabe5afb3ac6c6179`. The following evidence/continuity commit changes documentation and screenshots only. Official frontier observation is aligned to that tested executable commit; it is not a claim of completed engineering outcomes.

This is a partial STEP, not completed full-vector calculation, production qualification, merge, release or deployment. The preceding draft-PR evidence is historical; this document supersedes its statements that direct workbench Run is unwired and that bootstrap automatically accepts catalogue choices or renews old source approvals.

## Implementation boundary

The default Load Calc route is the prepared four-stage workbench: Import & setup, Review inputs, Calculate, Results & export. Existing Project Data, line-list/master mapping, enrichment, editable preview, topology, Input Check, scenario methods and sealed export are embedded through their existing owners. Run delegates to the same existing event and eligibility policy; there is no second runner, numerical store or exporter. Advanced/legacy access remains available. The standalone source-only prototype remains read-only and cannot run.

Bootstrap accepts only newly generated, exact, source-bound pipe-field proposals in an explicit allowlist. Accepted records and pending manual field/selector choices are preserved. It does not choose catalogue candidates or accept an unrelated pending review. Catalogue acceptance is explicit, source-bound, and refused when the source or master changes while the dialog is open.

Project Data validation is read-only. Loaded-file identity descriptors may track actual loaded bytes; dataset/master-backed numerical values, units, axes, maps and approvals keep their original provenance. Missing line-list evidence is not erased or silently made optional. No solver, stiffness, restraint, sign/axis transformation, moment transport, master-data value, governing formula, oracle/tolerance, result hash or publication authority is changed in this migration leg. Existing missing-insulation 0 mm fallback and standard-fitting estimation mechanics are retained, not requalified here.

## Browser connector evidence

Test target: isolated PR checkout served at `http://localhost:5174/AA3/`; original checkout and port 5173 were not overwritten. Final code was reloaded and the source reimported after the last JavaScript change.

- PASS: default four-stage route, embedded master review, Input Check, Calculate, results and export navigation. Workspace import panel remains visible after leaving Load Calc; hidden pre-mounted workbench no longer hides it.
- PASS: actual Sjson import, 279 entities, 127 components, 139 supports, 13 branches. Source SHA-256 `1e75a288545b771d2292cf730ca19d943e40fa547244478038da65eb8e4fc39a`; semantic binding `fnv1a64:46ec305d089d59eb`.
- PASS: user-supplied line list imported through existing mapping owner: `AML-91-PDFEED-PX-2345-00001-0000 BC4.xlsx`, 382 normalized rows, SHA-256 `723518a16b1a744c9328539f1a25fe15ea246757930970603a89d3cea46e3f41`. Piping class 10699 rows and catalogue weights 1595 rows loaded through their existing owner.
- PASS: 35 pipes / 105 weight-only section and density fields applied through the five existing grouped match confirmations using the owner's earlier explicit Sch120/DN150/200/250 weight-only approval. No material grade or fitting-weight approval inferred. With exact automatic fields, 172 accepted records / 0 pending proposals before catalogue review.
- PASS: manual catalogue dialog contains 31 manual-family items; no standard pipe/fitting added to this catalogue workflow. Visually matching catalogue choices staged and explicitly accepted for 23 items. Eight unsupported identity/approximation choices deliberately left blank, not zeroed or accepted. Final 195 accepted records / 0 pending proposals; checker mass coverage 119/127.
- PASS: editable insulation preview on DN200 pipe `PIPE AUTO /ASIM-1885-8"-S8810103-91261M7-HC-01/B1 1`: 0 mm fallback, core 128.1639 kg; 25 mm accepted override showed insulation 5.7045 kg and core 133.8683 kg; reset restored 0 mm fallback and core 128.1639 kg. Temporary override removed. This edit/reset test preceded the final pending-proposal bootstrap filter change; preview/edit code was unchanged. Final Run/navigation proof was repeated on the final code.
- PASS (negative/blocked path only): final Calculate button invokes existing gravity owner and visibly returns `A product screening snapshot requires a fully READY Common Input checker report.` Input Check shows 5/8 gates ready and two actionable causes: `STALE_SOURCE_HASH`, `MASS_COVERAGE_INCOMPLETE`.
- PASS (withholding only): results show no current gravity execution; export reaches existing Seal & Export owner, package BLOCKED, 0/2 methods ready, NOT_SEALED, 0 authorizations/executions. Seal, deterministic-export creation and Download JSON buttons are disabled. No uncalculated values or fabricated receipts published.
- NOT_RUN / BLOCKED: successful final Sjson calculation, fresh Fv/Fh/Fa/Fl/moments, seal and deterministic result export. The UI migration does not supply their missing engineering evidence.
- NOT_VERIFIED: accepted-override sidecar download was attempted earlier in this leg; connector download wait timed out without a verified local artifact. Routing/click is not download success.

Eight missing COMPONENT_WEIGHT targets (prefix `=1006649732/`): `51250` UZV, `51274` ultrasonic flow meter, `51284` angle-control instrument, `51462` lap-joint flange, `51463` temperature instrument, `51476` and `51483` blind flanges, `51485` pressure gauge. Candidate ranking/one-candidate status is not proof of matching item identity. These are five INST and three FLAN items, not standard pipe-component blockers.

Retained length-unit and source-up-axis evidence references old Sjson hash `6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288`, not current bytes `1e75a288545b771d2292cf730ca19d943e40fa547244478038da65eb8e4fc39a`. Normalization audit has two stale fields; loads and topology audits are READY. Those old approvals were not renewed by copying hashes. Successful calculation needs current source-qualified normalization evidence and the remaining manual mass evidence through their owning workflows; this document grants neither.

Screenshots: [final-build Input Check](load-calc-ui-migration-v32-current.jpg), [manual weight popup and collapsed weights](load-calc-ui-migration-v32-weights.jpg). The weight-popup screenshot precedes only the pending-proposal preservation fix; its rendering and weight logic are identical. Browser viewport restored to normal after wide-layout inspection. User-facing tab retained.

## Executable validation

| Check | Result | Scope / limitation |
| --- | --- | --- |
| All 23 `scripts/load-calc-*-check.mjs` | 22 PASS, 1 FAIL | Final tree. Migration, workbench currentness/results, insulation, weights, scenario and authority-focused checks included. |
| `load-calc-five-step-workflow-check.mjs` | FAIL | Retained expectation of five wrapper steps; unchanged production wrapper already renders eight at turn-start HEAD. No test or workflow rewrite to hide it. |
| `non-fea-project-data-authority-check.mjs` | PASS | Final tree; defaults/qualification and source authority. |
| `non-fea-ancillary-default-authority-check.mjs` | PASS | Final tree; partial coverage fails closed. |
| `npm run check:imports` | PASS | Final tree. |
| `node scripts/advanced-shell-contract-check.mjs` | PASS | Final tree. |
| `npm run build` | PASS | Final executable tree; 2096 modules, 83 chunks. Existing circular/externalized/large-chunk warnings retained. |
| `git diff --check` | PASS | No whitespace errors; Windows CRLF notices are not failures. |
| `node scripts/run-non-fea-checks.mjs` | FAIL | 66 checks pass then check 67 stops at missing `benchmarks/LFEA/BM2/Input_BM2.xml`; remaining checks NOT_RUN. Run preceded last bootstrap pending-choice preservation change; no full-suite pass claimed. |
| Three earlier draft guards | NOT_RUN this leg | Prior FAIL retained: master containment regex parse, calc-workspace missing visible profile, shared-model sha256Hex source-size guard. Historical evidence is not a fresh pass. |

The new migration validator executes read-only validation/revision/notification assertions, identity-only source binding and idempotence, absent required-source rejection, accepted/pending field reservation, exact pipe-only acceptance, existing Run event delegation, default and embedded routes, prototype no-run, active-route CSS containment, and source/master replacement refusal in catalogue review. These are boundary tests, not numerical qualification of the actual Sjson run. The obsolete header-label guard was updated to execute the actual primary-header/legacy-Run routing contract without changing engineering expected values or tolerances.

## Every changed file in this leg

| File | Reason |
| --- | --- |
| `src/workspace/load-calc-consumer-controller.js` | Default prepared workbench, embed existing tools, inject existing Run eligibility, preserve source-import route. |
| `src/workspace/load-calc-consumer-view.js` | Primary workbench heading and explicit legacy access; keep existing legacy Run. |
| `src/workspace/load-calc-workbench/workbench-controller.js` | Tool/availability seams, owner event bubbling, explicit refresh when changing stages. |
| `src/workspace/load-calc-workbench/workbench-runtime.js` | Inject production owners without making prototype writable. |
| `src/workspace/load-calc-workbench/workbench-view.js` | Four-stage actions, embedded owner panel, existing Calculate button and truthful boundaries. |
| `src/workspace/load-calc-workbench/results-view.js` | Route input-evidence export to existing seal/export owner. |
| `src/workspace/load-calc-workbench/workbench-shell.css` | Scope panel hiding to active Load Calc route, restoring Workspace import UI. |
| `src/workspace/load-calc-workbench/workbench.css` | Contain embedded existing tool layouts. |
| `src/workspace/load-calc-source-custody.js` | Pure identity updates, exact pipe allowlist and pending/accepted target reservation. |
| `src/workspace/master-data-ui.js` | Remove automatic catalogue/old-review acceptance and engineering hash renewal; preserve curated choices. |
| `src/workspace/project-data/project-data-store.js` | Remove mutating source-hash synchronization from validation. |
| `src/workspace/project-data/project-data-contract.js` | Restore missing active line-list hash rejection when required provenance exists. |
| `src/workspace/load-calc-fitting-weight-dialog.js` | Refuse applying stale source/master-bound review. |
| `src/workspace/load-calc-fitting-weight-review.js` | Carry source semantic binding on reviewed records. |
| `src/workspace/enrichment/non-fea-enrichment-view.js` | Supply current dataset/master revision binding to manual dialog. |
| `scripts/load-calc-workbench-migration-check.mjs` | Executable positive/negative migration custody and owner-routing checks. |
| `scripts/load-calc-ui-clarity-check.mjs` | Replace obsolete header labels with actual primary/legacy header and existing Run contract assertions. |
| `relay/WORK/load-calc-ui-migration-v32-plan.md` | Approved material-leg scope and truthful completion boundary. |
| `relay/WORK/load-calc-ui-migration-v32-evidence.md` | This scope, validation and remaining engineering gaps. |
| `relay/WORK/load-calc-ui-migration-v32-pr-body.md` | Current draft-PR description superseding historical bootstrap/unwired-Run claims. |
| `relay/WORK/load-calc-ui-migration-v32-current.jpg` | Final executable-tree browser proof. |
| `relay/WORK/load-calc-ui-migration-v32-weights.jpg` | Manual review/collapsed-weight UI proof. |
| `relay/GENERATED/tasks/load-calc-sjson.continuity.json` | Same responsibility, new plan/evidence, STEP/NO, official result/frontier projection; no fabricated unit completion. |

No workflow file, original-checkout unrelated 3D work, historical agentchain/workreport, external issue authority or merge/release state changed. Draft PR #1915 remains draft. FULL_VECTOR_LOADS and RUNNABLE_WORKBENCH remain pending; one of three responsibility units completed/evidenced (33% / 33%).
