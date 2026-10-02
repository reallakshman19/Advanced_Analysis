# STEP evidence — current-source normalization and actual Run readiness

Recorded 2026-10-02. Responsibility `owner-direct:advanced-analysis:sjson-routine-run-auto-20261001`; ENGINEERING_CRITICAL. Common v3.2 `149770a21ca073df49717a96e2106c967adddc2d`. Same draft PR #1915, isolated worktree `C:/Users/reall/.codex/worktrees/load-calc-draft-validation/AA`. No original-checkout edits, merge, release or workflow changes.

## Outcome and boundary

Cleared the retained unit/up-axis stale-source blocker using actual current source evidence. All 223 `attributes.POSI` strings explicitly use mm and agree with numeric `attributes.POS`: E/W ↔ x, N/S ↔ y, U/D ↔ z with matching signs, zero contradictions. This verification is byte-bound to Sjson SHA-256 `1e75a288545b771d2292cf730ca19d943e40fa547244478038da65eb8e4fc39a`. It verifies those source coordinates, not solver accuracy or universal source metadata. No coordinate/sign convention changed; no generic hash auto-renewal introduced.

Browser editing exposed a presentation defect: raw JSON textareas were `display:none`, while their summary spans could not receive focus. Replaced value/evidence wrappers with native keyboard-accessible details/summary controls; outstanding-field navigation opens all ancestor disclosures. Existing Project Data update, approval and revision handlers are retained. This is not a numerical/authority repair.

Source fields updated explicitly through the existing Advanced editor after source inspection; old approval withdrawn and current-source evidence approved. Actual exported profile revision **12**, semantic hash `fnv1a64:c155f4fb720f96a0`; values remain mm/Z. The bundled approved profile and its qualification/oracle evidence were not edited. Current UI edits alone do not alter that bundled artifact; the actual exported profile is saved below.

## Browser run on the final code

1. The development refresh cleared in-memory dataset/review state. Re-imported actual Sjson and restored the same previously owner-approved five pipe-only groups: 35 pipes, 105 OD/wall/density fields; exact proposal values checked against the earlier explicit weight-only approval. No new grade or fitting approval inferred.
2. Restored 23 matching manual catalogue choices. Cleared all eight unsupported default suggestions before applying; accepted only those 23 proposals. Final **195 accepted records, zero proposals, 119/127 mass coverage**.
3. Ran the real **Run gravity calculation** action. It returned `A product screening snapshot requires a fully READY Common Input checker report.`
4. Input Check now shows **Project Data READY, Masters READY, 6/8 gates ready**. `STALE_SOURCE_HASH` is gone. Only one actionable cause remains: `MASS_COVERAGE_INCOMPLETE`, shared by the two requested methods. UI counts three blocking area receipts, not three independent missing-input causes.
5. Configured methods view is **NOT_CONFIGURED**, no runtime profile bound; clone/authorize/configured Calculate disabled. Registration of existing restricted methods is not authority to combine arbitrary Fa/Fl/moments.
6. Results show **no gravity execution**. Seal state NOT_SEALED, deterministic export NOT_CREATED, authorizations/executions zero; Seal/Create/Download disabled. Fv/Fh/Fa/Fl/moments on this actual dataset and force/moment equilibrium are **NOT_RUN / BLOCKED**, not PASS or zero.

Browser proof: [current Input Check](load-calc-run-readiness-v32-current.jpg), localhost:5174/AA3/, retained tab 14. Original localhost:5173 was untouched.

## Exact remaining manual evidence

Read-only inspection of `public/fixtures/wtValveweights.xlsx`, sheet `wtValveweights`, A1:L1596 (1,595 data rows), with the bundled Spreadsheet artifact runtime. No workbook edits. All eight source records carry zero placeholders (`CMPWEIGHTDRY=0`, `PSIWEIGHT=0kg`, `WEIGHT=0`), not qualified nonzero mass.

| Source entity =1006649732/… | Identity | Bore | Why not resolved |
| --- | --- | --- | --- |
| 51250 | 88-UZV-11951, ESDV | DN150 | 2× control-valve factor is not matching vendor/catalogue identity |
| 51274 | 88-FI-11360 ultrasonic flow meter | DN80 | interpolation is not matching flow-meter evidence |
| 51284 | 88-HCV-11067 angle control valve | DN150 | straight flanged control-valve row is not the angle-body identity; port distance 424.264 mm versus row 714/718 mm |
| 51462 | Lap-joint flange | DN50 | no lap-joint row; interpolation not exact identity |
| 51463 | 88-TG-10052 temperature instrument | DN50 | wafer valve/blind-flange suggestions are unrelated |
| 51476 | Blind flange | DN20 | workbook row 249 is DN20 weldneck (4 kg), not blind; DN50 blind row 389 (14 kg) is wrong bore |
| 51483 | Blind flange | DN20 | same missing DN20 blind identity |
| 51485 | 88-PG-10052 pressure gauge | DN15 | weldneck-flange suggestion is unrelated |

These are five instrument-family items and three flanges, not standard pipe-like fittings or missing insulation. Need identity-matched positive mass evidence or an explicit, separately labelled owner-authorized approximation through the existing review owner. This leg does not grant one. No repeated qualification question was asked.

Existing empirical logic was retained and its fixture regression executed. The concept note requires solved normal reactions/movement direction for friction screening; its separate moment/combined-result boundaries were not bypassed to manufacture Fh/Fa/Fl/moments while gravity is blocked.

## Verified INPUT downloads (not result exports)

The connector's accepted-sidecar download wait timed out. Filesystem read-only verification found the actual browser download at `C:/Users/reall/Downloads/non-fea-enrichment-sidecar (4).json` (21:49:13 Dubai time), then the profile at `C:/Users/reall/Downloads/non-fea-project-data-profile.json` (21:50:38). Exact copies saved in this leg:

- [Current-source Project Data](load-calc-run-readiness-v32-project-data.json): revision 12, semantic hash above, approved current mm/Z evidence. Normalization against actual source hash passes; altered hash and withdrawn approval negative checks fail closed.
- [195 accepted records](load-calc-run-readiness-v32-accepted-inputs.json): source semantic hash `fnv1a64:46ec305d089d59eb`, sidecar hash `fnv1a64:4da82326de7182e1`. Existing constructor rebuilds the exact artifact; 23 positive reviewed catalogue weights, all eight unsupported weights absent (not zero).

Thus downloads are **PASS by file/custody verification**, while connector notification delivery is **TIMEOUT**. They preserve inputs for explicit re-import and are not a sealed common package or calculated-result export.

## Current validation

PASS (executed):

- `node scripts/non-fea-project-data-editor-disclosure-check.mjs`
- `node scripts/load-calc-sjson-normalization-evidence-check.mjs`
- `node scripts/load-calc-run-readiness-artifacts-check.mjs`
- `node scripts/non-fea-project-data-authority-check.mjs`
- `node scripts/non-fea-calculation-defaults-basic-ux-check.mjs`
- `node scripts/non-fea-calculation-defaults-scoped-ux-check.mjs`
- `node scripts/non-fea-calculation-defaults-observability-check.mjs`
- `node scripts/load-calc-workbench-migration-check.mjs`
- `node scripts/load-calc-current-common-input-run-routing-check.mjs`
- `node scripts/load-calc-empirical-screening-check.mjs`
- `npm run check:imports`
- `node scripts/advanced-shell-contract-check.mjs`
- `npm run build` (existing externalization/circular/chunk warnings retained; bundle check PASS)
- `git diff --check`

The new disclosure test initially failed because its fake textarea lacked a `dataset` property. Corrected the test fixture, not production authority or mechanics; final rerun PASS. Node-only migration/routing tests log the existing relative-URL async master-seed warning; assertions complete and exit 0. These fixture passes do not prove actual Sjson gravity/Fh execution.

NOT_RUN this leg: complete non-FEA suite and unchanged legacy guards. Previous five-step wrapper FAIL, missing BM2 fixture suite FAIL and earlier draft guard failures remain [recorded](load-calc-ui-migration-v32-evidence.md); not promoted to PASS.

## Changed-file purpose

| File | Purpose |
| --- | --- |
| `src/workspace/project-data/non-fea-project-data-view-v2.js` | Reachable native evidence/value disclosures, labelled editors, nested navigation; existing data/approval owner retained |
| `scripts/non-fea-project-data-editor-disclosure-check.mjs` | Render/navigation/edit boundary regression; opening cannot edit/approve data, intentional evidence edits preserve other fields |
| `scripts/load-calc-sjson-normalization-evidence-check.mjs` | Byte-bound 223-pair source verification plus unsupported/duplicate-axis negatives; read-only |
| `scripts/load-calc-run-readiness-artifacts-check.mjs` | Verify real exported input custody, stale/unapproved negatives, 195 records and absence of eight unresolved weights |
| `relay/WORK/load-calc-run-readiness-v32-plan.md` | Published bounded leg and discovered UI repair |
| `relay/WORK/load-calc-run-readiness-v32-project-data.json` | Exact browser-exported current-source input profile; no automatic bootstrap import |
| `relay/WORK/load-calc-run-readiness-v32-accepted-inputs.json` | Exact browser-exported reviewed input sidecar; no automatic approval/import |
| `relay/WORK/load-calc-run-readiness-v32-current.jpg` | Actual final checker/Run blocker proof |
| `relay/WORK/load-calc-run-readiness-v32-evidence.md` | This evidence and honest limits |
| `relay/WORK/load-calc-ui-migration-v32-pr-body.md` | Same draft PR updated with current leg, earlier failures retained |
| `relay/GENERATED/tasks/load-calc-sjson.continuity.json` | Same responsibility, official STEP result/frontier projection; no fabricated completion |

ResultScope **STEP**, ResponsibilityComplete **NO**. FULL_VECTOR_LOADS/RUNNABLE_WORKBENCH remain pending; declared progress/evidence remains 1/3 (33%/33%). Safe diagnosis/input-custody work achieved; proceeding to fabricated vendor masses or new scenario authority is outside this leg.
