# Load Calculation Workbench — full specification and implementation plan

Document: LC-WORKBENCH-SPEC-001 · Version 1.0 · 2026-10-01, Asia/Dubai

Status: implementation proposal prepared at the Owner's request. This is not a
production change, an engineering approval, an Owner Roadmap amendment, or a
claim that the full Sjson support loads have been calculated. The follow-up
“proceed” continues preparation of this specification; it does not silently
authorize all proposed engineering changes, deployment, or merge.

## 1. Outcome and scope

Give the user one understandable place to import a piping model, review the
values that will actually be used, resolve input problems, calculate using an
already-authorized method, and inspect/export trustworthy support loads.

Primary journey:

**Import & setup → Review inputs → Calculate → Results & export**

The revamp is not another tab beside the existing eight-stage workflow. The
four-stage workbench becomes the primary Load Calc experience. Existing
specialist tools remain accessible without dominating the normal journey.

Deliver two independently assessed outcomes:

1. **Usable workbench:** a coherent, responsive workflow with truthful states,
   actionable issues, shared review controls, and preserved engineering data.
2. **Calculated loads:** actual source-bound calculations and independently
   checked results for the permitted cases and quantities. UI completion does
   not satisfy this outcome.

First delivery covers AA's Load Calc workflow, its integration with import,
masters, enrichment, topology/support review, current-input preparation,
authorized execution, results and existing exports. It establishes reusable
UI patterns, not a whole-application framework rewrite.

Whole-app navigation improvements are limited initially to clearer module
entry and return paths. FEA, LFEA, LAFEA, WRC and EMP.1 redesigns require separate
scoping, audits and validation. Their mechanics and active chains are protected.

## 2. Evidence and planning basis

### 2.1 Observed experience

The browser audit is recorded in
[review-and-revamp.md](../../artifacts/ui-audit-20261001/review-and-revamp.md).
It walked standalone Source & Masters, populated “4 Preview,” and inspected
Weight Match; it did not execute all ten phases or final XML-to-CII conversion.
AA's Input Check, Preview and weight dialog were examined with the current
Sjson. A narrow-screen Input Check capture failed to show a usable body; its
copy findings were grounded in DOM/AX inspection, not a fabricated screenshot.

Use standalone's stable task navigation and consolidated per-branch review
pattern. Do not copy its contradictory numbering, master-readiness wording,
cache/hash noise, oversized table, or multiple specialist update actions.

Reference code: `C:/CodeA/3DC_809`. It is a design reference, not AA engineering
authority and not a source for silently replacing AA formulas or precedence.

### 2.2 Current repository baseline

- Repository: `C:/CodeA/AA`, `reallaksh19/Advanced_Analysis`.
- Observed branch: `main`; HEAD and local `origin/main`:
  `11eca8e40e560fc2e5f0866489f0b419e1b5afb1`.
- Working tree contains extensive pre-existing/uncommitted changes. This plan
  describes inspected working-copy behavior, not solely the committed HEAD.
  Reconcile ownership and exact diff before implementation; do not adopt all
  dirty changes into a revamp PR.
- Existing diagnostic chain: `LOAD-CALC-SJSON-AUTO-20261001`, EP-007. Full Sjson
  numerical work remains BLOCKED; no numerical approval is created here.
- Live Common `engineering-pr-delivery-v2` main skill and 18 required references
  were read at `149770a21ca073df49717a96e2106c967adddc2d`. Re-ground live policy
  at each future material boundary; this pin is planning provenance, not a
  perpetual implementation authorization.
- Root AGENTS.md applies. Located roadmap headings identify LFEA closure and
  LAFEA meshing programmes, not this Load Calc UX revamp. No applicable Load
  Calc Owner Roadmap was established for this document. Re-run roadmap and
  concurrent-chain discovery before production work; do not amend the existing
  Owner Roadmap as routine status bookkeeping.

### 2.3 Reproducible inputs

| Input | Locator | SHA-256 / role |
|---|---|---|
| AA Sjson | `public/fixtures/Sjson.json` | `1e75a288545b771d2292cf730ca19d943e40fa547244478038da65eb8e4fc39a` |
| Matching benchmark copy | `benchmarks/Sjson.json` | Same SHA-256 at planning time |
| Supplied BC4 line list | `public/fixtures/AML-91-PDFEED-PX-2345-00001-0000 BC4.xlsx` | `723518a16b1a744c9328539f1a25fe15ea246757930970603a89d3cea46e3f41` |
| Standalone audit model | `C:/CodeA/3DC_809/Benchmarks/XML-CII-2019/SYS-S8811956-01.xml` | Design-flow fixture only; not an AA numerical oracle |

EP-007/audit observations: 279 entities, 127 component review rows, 139 supports,
105 pending proposed fields, 98 accepted records, mass coverage 69/127 with 58
unresolved, and 6/8 checker entries ready with three reported issues. These
counts measure different populations and are not interchangeable. They are
historical baseline observations; recompute them on the exact captured state.
Do not hardcode them as permanent UI values or numerical expected results.

The September enrichment concept note in this folder is historical planning.
Its proposed architecture and precedence are not assumed current; use live
resolver/store contracts and the owning engineering artifacts instead.

## 3. Product principles and exclusions

1. One task, one workbench, one source of displayed readiness.
2. Explain what is missing, what it affects, and what to do next before showing
   internal codes.
3. Keep source, candidate, accepted evidence and effective calculation input
   visibly distinct.
4. Automate inspection and already-permitted preparation, not ambiguous
   engineering approval.
5. Preserve source immutability, exact identity, governed precedence, units,
   frames, load reference points, result hashes and publication boundaries.
6. Preserve missing, zero, not applicable, estimated and calculated as different
   states. Never fill an unresolved cell with zero for visual completeness.
7. Keep review context across actions; do not require repeated navigation.
8. Build incrementally around current owners. No new solver, duplicated formula
   engine, framework migration, dependency upgrade or generic platform project.

Out of scope for UI-only packages: mechanics changes, master-data authority
changes, new fitting methodology, sign/axis conventions, tolerance relaxation,
new partial calculation permissions, automatic acceptance, public deployment,
workflow-file changes and changes to neighbouring engineering modules.

## 4. Information architecture and navigation

### 4.1 Workbench shell

Use a task-specific full-width layout inside the AA application. Do not inherit
the permanent Dataset Tree / 3D centre / Properties & Loads three-column layout.

- Compact header: project/model name, input freshness, selected case(s), help,
  and return-to-model action.
- Stable task rail: exactly four numbered steps with consistent labels and
  status text. The active heading and rail derive from one configuration.
- Main content: stage-specific workspace; Review inputs receives the largest
  area.
- Context drawer: appears only for the selected review/result item. It is not
  an always-visible unrelated Empirical safety panel.
- Evidence & advanced menu: method basis, full input checker, explicit specialist
  scenario authorization, JSON trace, topology editor and legacy tools.
- One primary next action per stage; secondary actions are visually quieter.

All four stages remain navigable for inspection. Accessing Calculate or Results
while blocked shows a clear explanation; navigation itself never grants
calculation eligibility. Browser back/forward, refresh and direct links must
resolve to an appropriate stage without approving anything.

### 4.2 Legacy destination mapping

| Existing destination | New normal-user home | Specialist access |
|---|---|---|
| Import, Calculation Defaults, Masters | Import & setup | Detailed mapping/default editors |
| Topology, restraints, support investigation | Review inputs → Supports & topology | Existing governed 3D editor |
| Enrichment, Preview, Input Check | Review inputs | Full checker/trace in Evidence |
| Weights & contents popup | Review inputs → Weights & contents | Retained dedicated dialog |
| Verify / Run, methods | Calculate | Method/profile evidence and specialist scenarios |
| Loads, empirical results, evidence | Results & export | Detailed audit and 3D investigation |
| Seal & Export | Calculate evidence / Results export, according to payload | Explicit legacy partial-input path |

During migration retain legacy route IDs/selectors through a small navigation
mapping at the existing controller boundary. Do not render two conflicting
workflow bars. Legacy deep links must not redirect a specialist scenario into
a routine gravity run or silently reinterpret an export.

## 5. Stage 1 — Import & setup

Present model intake, master intake and calculation setup together.

### Required behavior

- Show current model file, format, entity/component/support counts and source
  identity. Offer replace/import and inspect; replacement has a clear warning
  about source-bound approvals/results becoming stale.
- Reuse existing supported model import formats. XML-to-CII in the reference
  does not imply a new XML converter is authorized for AA.
- Display line list, piping class, weight/material sources and other required
  master dependencies for the selected method/cases. A parsed file is “Loaded,”
  not automatically “Ready.” Show mapping errors and unresolved keys separately.
- Support the supplied BC4 workbook through the current intake pipeline. Show
  file/sheet, mapped columns, units and row counts; ambiguous mapping stays
  unresolved. Importing is not an engineering approval.
- Show gravity, load factor, units, cases and relevant fluid/insulation policies
  from existing Project Data/default contracts, with their provenance. Do not
  create hardcoded values just because a setup field is blank.
- Automatically inspect and prepare permitted suggestions after import, with
  visible progress and retry. Do not auto-run a solver or accept proposals.
- Main action: “Review inputs.” If import is missing, main action is “Import
  model”; master/setup problems may be carried into the review queue.

File errors retain the last usable dataset until the existing import transaction
commits successfully. Re-importing the identical bytes must follow the current
identity/currentness rules rather than invent a new semantic source.

## 6. Stage 2 — Review inputs, the central workbench

### 6.1 Structure

One readiness summary, one filter toolbar, one review table and one context
drawer. Category tabs change the view, not the underlying approval authority:

- All issues (default when required input is missing).
- Sections & materials.
- Weights & contents.
- Supports & topology.
- Other inputs (cases, source mapping, profile/authorization and remaining
  checker causes).

Filters: search, branch/line, component type, status, case and issue category.
Preserve selected row, category, search, sorting, case and scroll position when
opening a drawer/dialog or returning from 3D. Reset source-bound selections on
dataset replacement; do not carry approvals or deferrals to another source.

### 6.2 Readiness summary

Use the current governed input report as truth. Show separate labelled counts:

- Required issue groups.
- Unique affected components/supports.
- Fields awaiting review.
- Case-specific mass coverage.
- Deferred reviews, still unresolved where required.

Provide “Review next issue.” Group identical actionable causes by category,
field, evidence/candidate identity, exact selector scope, case and binding.
Do not group merely by matching message text. Deduplicate membership for counts
while preserving every underlying report cause and its affected IDs.

Prioritization is a UI ordering only: source/units, topology/support validity,
section/material evidence, mass/location/contents, method readiness, then
informational issues. Backend severity and dependency rules always win. Predicted
impact is “may resolve X affected rows”; only an actual reevaluation may claim
that an issue was cleared.

### 6.3 Review table

| Column | Required meaning |
|---|---|
| Item / group | Stable entity/support identity, readable type, branch/line; expandable group members |
| Source value | Original value/text with source locator; no inferred value masquerades as imported |
| Proposed value | Candidate/master suggestion, ranking explanation and pending/estimated label |
| Value used | Current effective resolver output, unit and winning evidence; blank when unavailable |
| Weight summary | Metal, contents, insulation and complete case total where available |
| Review state | Needs input / Needs review / Ready plus explicit Deferred or Outdated modifiers |
| Action | Review, supply existing permitted input, inspect location, restore deferral or view evidence |

Show relevant category columns, not every field in one enormous table. Fixed
item/action columns on desktop, sticky headers and explicit column groups are
preferred. Horizontal scroll stays within the table, never the whole page.

Collapsed weight rows retain metal/fluid/insulation values and a truthful total
state. Expanding is for evidence, not discovering the weight itself. An item
with a known dry estimate and missing application point displays both facts;
it must not be labelled ready or present that estimate as solver-consumed mass.

### 6.4 Evidence drawer

Display, in order: plain-language problem; affected object/field/case; source
value; proposed/effective value and authority; why this candidate was offered;
permitted corrective controls; provenance and technical trace.

Keep technical codes, hashes, source JSON and formula substitutions under
disclosures. Show a direct exact-entity 3D inspection action where available;
an approximate viewport target must not appear as an exact match.

Source fitting-description schedule is labelled as fitting evidence. A fitting
DTXR containing Sch 80 does not automatically assign Sch 80 to a straight pipe.
A pipe Sch 120 / 14.2748 mm suggestion remains a separate candidate. Compare
exact selectors and authority rather than declare contradiction from prose.

### 6.5 Review actions and batch safety

- Exact acceptance/rejection uses the existing enrichment store rules.
- Approximate acceptance requires the complete candidate bundle, explicit
  confirmation, an acceptance basis and current source binding. Ranking scores
  are not engineering confidence probabilities.
- Batch review begins with a concrete list of affected IDs, before/after values,
  authority conflicts, cases and predicted impact. Require explicit confirmation.
- Use existing transactional review APIs where applicable. Do not implement
  generic “accept all” with a loop that can partially commit an invalid bundle.
  Where no safe batch API exists, keep individual review until a bounded store
  contract extension is separately implemented and tested.
- If source, master, proposal or effective-input binding changes while reviewing,
  disable the stale action, preserve the explanation and require refresh.
- Rejection removes a candidate, not the required engineering field. Clear it
  only if another valid evidence source satisfies the requirement.
- Removing an accepted record uses the current owner operation, confirmation,
  and invalidation. Undo never forges a prior approved state or freshness.

Acceptance never automatically starts calculation. A user may resolve the whole
review queue and then choose Calculate.

## 7. Dedicated weight popup and shared weight presentation

Retain “Weights & contents…” as an explicit entry from Review inputs. It opens
a dedicated accessible dialog for focused weight review; it is not the only
place where weights are visible.

The table and popup consume the same presentation rows and resolver evidence.
No popup-only formulas, rounding authority, source precedence or approvals.
The dialog contains case selection, search/type/status filters, labelled
coverage/totals, collapsed per-item summaries, expand-for-trace controls,
defer/restore and contextual resolution actions. If a full correction belongs
in the drawer, opening it preserves case, item and return position.

Display mass in kg and, for distributed items, kg/m as a labelled secondary
value. Weight force uses N or configured display units; never label kg as
force. Pending terms show “Needs input,” not “0.” “Not applicable” differs from
an explicit zero. Totals that are incomplete show known subtotal plus unresolved
count; no misleading grand total of only the resolved components.

### 7.1 Pipe mass requirements

Reuse `src/core/model-loads/formulas.js` and the current resolver. For the
existing density path, show its trace for pipe metal, fluid contents and
insulation. As currently implemented, with dimensions converted to metres:

- Metal mass per length: `π × t × (OD − t) × metal density`.
- Fluid mass per length: `π/4 × ID² × case fluid density`, `ID = OD − 2t`.
- Insulation mass per length: `π/4 × ((OD + 2ti)² − OD²) × insulation density`.
- Component distributed mass: governed mass per length × source length.
- Force: governed mass × configured gravity × applicable existing load factor.

These are descriptions of current code, not a new methodology. Authorized
direct unit-mass evidence may already take precedence; the UI must show that
choice rather than force density recomputation or double-count both paths.
EMPTY omits fluid; OPE/HYD use their respective governed evidence. Explicit
zero insulation thickness is valid existing evidence, not a blanket fallback
for missing insulation data. Display precision never changes canonical values.

### 7.2 Fittings: tee, olet, reducer, end cap and elbow

Owner intent is to include density-based fitting weight treatment alongside
pipe metal, fluid and insulation review. Reusing density principles does not
make every fitting a straight cylindrical pipe of an arbitrary length.

Current inspected helper `elbow-derived-mass.js` handles elbow, tee, olet and
reducer dry previews with effective-length factors. Olet/reducer factors are
explicit estimates. End caps are not registered in that generic helper; search
other owners before deciding a capability is absent. The helper's same-branch
sibling selection does not by itself prove bore compatibility or adjacency.

Required fitting acceptance evidence:

- Exact fitting type, material, run/branch/inlet/outlet sizes as applicable.
- Source-qualified section and shape/volume or permitted equivalent-length
  basis, with explicit estimate/applicability status.
- No blind use of a same-branch pipe for reducing/mixed-bore components.
- Metal, contents and insulation coverage per selected case, with clear scope
  if only dry mass is available.
- Authorized application point/CoG and coordinate/reference basis where needed.
- No overlap with pipe lengths or separately counted catalog weights.
- Existing explicit mass evidence retains its governed precedence.

The source DN150 elbow `/51228` preview borrowing a DN80 section (88.9 mm OD)
is a required negative case. Its prior 2.0368 kg preview is unqualified and must
not become an expected production answer. Resolve selection/section authority
and mass placement separately with single-factor falsifiers. Do not “fix” the
UI by hiding the warning or supplying a made-up CoG.

Fitting methodology/capability gaps belong to engineering package E2, not the
UI-only workbench package. Until resolved, show partial/estimated evidence and
the remaining blocker honestly.

### 7.3 Skips / deferrals

Button text: “Defer review”; helper text: “Keep this issue unresolved and return
to it later.” A reason is required. Deferred items remain searchable and counted.
Restore is available in the row and popup. Deferral never excludes a component,
supplies zero, accepts a proposal, changes a result hash or makes Run eligible.

Initial implementation reuses the session-only `WeightReviewSession`, bound to
the exact report/candidate. Reset deferrals on binding change and disclose that
they are session-only. Durable deferrals are optional later UI metadata with
separate source/report binding, versioned storage and migration tests; they are
not engineering records. Existing governed topology skip semantics are separate:
do not weaken or replace them with weight deferral behavior.

## 8. Stage 3 — Calculate and safe automation

### 8.1 Two visibly distinct actions

- **Check inputs:** allowed with incomplete data. Evaluates current inputs,
  prepares permitted suggestions and refreshes readiness. Does not seal,
  authorize, calculate or accept anything.
- **Calculate loads:** available only when the existing backend says the
  requested mode/cases are eligible and current. Recheck at click time.

When blocked, show “Resolve X required issue groups” with the exact next action.
Do not label an input-validation attempt “One-click Run” or “Ready.” A pending,
unknown, failed or stale readiness evaluation is never presumed ready.

### 8.2 Automatic method selection

Reuse the existing governed method-selection/default mechanism. Present a
human-readable selected method, purpose, supported cases/quantities and basis.
Automatic selection is permitted only where that mechanism already authorizes
a deterministic choice. If selection is missing, ambiguous, out-of-scope or
unqualified, show the cause and specialist review action; do not choose a method
because it has fewer blockers or because another method would produce numbers.

Routine gravity and explicit specialist empirical scenarios remain distinct
modes. The selected mode determines readiness and run authority. A currently
eligible specialist scenario must not be replaced by a routine gravity default.
Method changes invalidate dependent preparation/results through their existing
owners; they are not cosmetic dropdown changes.

### 8.3 Execution transaction

Call the existing controller's run orchestration. The proposed UI sequence is:

1. Capture current dataset, effective input, case and method identities.
2. Evaluate current readiness and recheck the authoritative eligibility.
3. For the existing routine path only, create/reuse the READY-only system
   snapshot through its current owner. System provenance is not human approval.
4. Refresh/validate required execution authorization through the current owner.
5. Execute once; show available real progress states rather than fake percentages.
6. Accept/display only the execution associated with the captured current binding.
7. Navigate to Results on actual calculated status; show exceptions/failure
   explicitly, keeping their engineering meaning and export restrictions.

Disable duplicate clicks while a run is active. Dataset/input changes during
preparation abort or discard the outdated continuation. If the backend cannot
cancel an active solver, the UI must say so and reject late results as current;
do not offer a fake cancellation guarantee. A failed attempt preserves evidence
and any previous result as historical/outdated, not current.

Routine automation cannot use partially-ready seals or silently acknowledge
blocked methods. Any existing human partial-acceptance workflow remains an
explicit specialist action and does not become routine eligibility.

## 9. Stage 4 — Results & export

### 9.1 Results workspace

Header: actual run status, freshness, case/method, model binding and timestamp.
Show coverage, equilibrium/unallocated-demand summary and exceptions before
allowing a clean completion interpretation.

Table: support site, restraint/entity identity, case, contact/state, global
FX/FY/FZ, global MX/MY/MZ, supported local projections, units, coverage and
inspection action. Filters preserve case, support/branch, selection and sorting.
Row details show contributors, local basis, reference point, moment transport,
input/result lineage and existing audit evidence. 3D inspection is optional;
it must preserve the return context.

### 9.2 Quantity contract

| Quantity | Contract required for display/export |
|---|---|
| FX/FY/FZ | Existing global reaction force fields, canonical frame/sign and force units |
| MX/MY/MZ | Existing global reaction moments, reference point and moment units |
| Fv | Existing restraint-basis rest projection when present, labelled with that basis |
| Fl | Existing guide-axis projection when present; not an invented general horizontal resultant |
| Fa | Existing line-stop projection when present; basis must be shown |
| Fh | Definition/producer not established by this inspection; separate quantity decision before implementation |

The current scenario view reads `globalReaction.forceN`,
`globalReaction.momentNm` and `anchorDecomposition.componentsN.rest/guide/lineStop`.
The gravity distribution view also contains vertical force and transfer-moment
demand in N and N·mm. These are not automatically the same complete reaction
contract. The UI must not relabel a transfer demand as a recovered support moment.

Resolve whether requested Fh is a signed local horizontal component, a horizontal
resultant, or an alias used by a source report. Bind its exact frame/sign/units,
producer and authority; do not infer a formula or show zero when unsupported.
Missing basis projections display “Unavailable — basis not supplied.” A gravity
run does not imply every horizontal/axial/lateral load has been computed.

Imported source load values and extracted line-list/source forces are shown in a
separate “Imported reference loads” view with provenance. They are never used
as substitutes for computed support reactions or as the engine's own oracle.

### 9.3 Export behavior

- Use current export owners and formats first; discover exact supported formats
  in package P5 rather than promise a new solver result schema.
- Distinguish review/input evidence exports from calculated result exports.
- Result payload names/schema identify case, units, frames/reference point,
  method, source/effective-input/run binding, freshness, status and exceptions
  according to the existing contract. Any contract extension gets separate review.
- Stale/blocked/failed results are not exported as current engineering results.
  Permitted historical/audit exports retain explicit status and lineage.
- A calculated-with-exceptions result stays labelled that way; apply current
  publication rules rather than invent “pass because table has numbers.”
- Verify download contents, not just that a button was clicked. Round-trip
  existing staged JSON through its current validator where that export applies.

## 10. State model and user-facing vocabulary

Do not compress all authority into one green badge. Keep dimensions separate:
input evaluation, review state, freshness, execution status and publication
eligibility. Derive labels from current contracts, never DOM visits or local
optimistic counters.

| Condition | UI label / action |
|---|---|
| No model | Import model |
| Preparation/evaluation pending | Checking inputs; Calculate unavailable |
| Required value/evidence absent | Needs input; relevant correction action |
| Candidate requires a decision | Needs review; review candidate |
| Current backend input eligible | Ready to calculate |
| Review deliberately postponed | Deferred review, with underlying unresolved state |
| Source/master/policy/method changed | Outdated; refresh/review affected input |
| Active backend run | Calculating; real phase text |
| Actual calculated current result | Calculated, subject to publication rules |
| Actual calculated-with-exceptions | Calculated with exceptions; inspect coverage |
| Failure / unknown / blocked | Calculation failed / Status unavailable / Needs input |

Setup may say “Files loaded” while review still needs input. Navigation completion
means the stage's real requirement was satisfied, not that a screen was opened.
Preserve backend codes/statuses in evidence, including unknown codes. Unknown
severity or missing eligibility fails closed with an actionable refresh/report
message; do not invent a permissive default.

## 11. Presentation data contracts and state ownership

New contracts below are proposed UI DTOs, not new numerical/source authorities.
Prefer existing object identities and structured fields. Add no alternate
semantic hash algorithm; display existing request/report/result identities.

### 11.1 WorkbenchSnapshot, presentation-only

Required fields: schema version; dataset identity/source binding; current
request/report binding; preparation/evaluation/error state; active cases/mode;
method selection and reason; backend eligibility; issue groups; review rows;
case mass coverage; current/historical execution references; freshness;
action availability and reason codes.

Build from a coherent set of owner snapshots captured against the same binding.
Reject mixed revisions. Readiness and result status are copied/projected from
their owners, not recomputed with a parallel engineering checker.

### 11.2 ReviewRow and IssueGroup

ReviewRow: stable entity/component/support key; source identity; branch/line/type;
category; source fields; effective fields with provenance; candidate bundle IDs;
per-case weight evidence; underlying issues; review/freshness modifiers; permitted
action references and exact selector/binding.

Weight field: value or null; unit; evidence state (source/accepted/derived preview/
unresolved/not applicable); authority/trace reference; case; application-point
coverage; complete-total eligibility. Zero is a value, not a missing-state marker.

IssueGroup: stable presentation key within a binding; original cause codes;
category/field/case; exact affected IDs; action target; required-versus-informational
classification from backend; evidence/candidate identity; expected impact text.
Filtering groups must not remove obligations from the authoritative report.

### 11.3 WorkbenchUiState, non-engineering

Own only stage/category/filter/sort/case/selection/drawer/dialog/scroll state,
draft review rationale and session deferrals. It cannot contain accepted records,
eligibility flags or patched model values as its own authority. Persist only
non-sensitive UI preferences with a version/dataset boundary where needed.

### 11.4 Mutation boundary

Views dispatch typed intents to existing controller/store operations. Intent
parameters include exact target, candidate IDs and expected current binding.
Owners revalidate before mutation. UI success is acknowledged only after a
committed owner snapshot; failures cannot optimistically clear required issues.

Source/master/policy/accepted-record/topology/support/method changes invalidate
their actual dependent snapshots and executions. UI filtering, opening a popup,
sorting, navigation and deferral must not change engineering hashes.

## 12. Architecture and existing code reuse

Use the current vanilla JavaScript/Vite architecture. Do not add a UI framework
or state library merely for the revamp. Extract cohesive seams where needed;
do not split stable files solely to meet a line-count target.

| Existing owner | Reuse / bounded change |
|---|---|
| `load-calc-consumer-controller.js` | Host navigation/intent integration and existing `runCurrentCalculation`; avoid a second run pipeline |
| `load-calc-current-system-view.js`, `load-calc-consumer-view.js` | Migrate eight/legacy stage rendering to one four-stage shell behind opt-in; keep engineering result consumers |
| `load-calc-preview-model.js` | Reuse source/effective/proposal separation; generalize presentation rows only where needed |
| `load-calc-preview-table.js`, `load-calc-preview-view.js` | Extract reusable review row/drawer rendering; eliminate detached duplicate Preview flow |
| `load-calc-weight-review-model.js`, `load-calc-weight-review-dialog.js` | Shared weight projection/dialog and current session deferrals; preserve preview versus consumable mass distinctions |
| `non-fea-common-input-check-adapter.js`, `non-fea-common-input-store.js` | Authoritative readiness/report source |
| `non-fea-common-input-runtime.js` | Existing evaluation and READY-only routine snapshot owner; explicit partial path stays separate |
| `enrichment/non-fea-enrichment-store.js` | Existing exact/approximate reviewed acceptance, rejection and invalidation |
| Project Data/master intake stores/controllers | Existing source custody, approved defaults, mapping and persistence |
| `engineering-model-store.js`, empirical scenario/authorization owners | Eligibility, execution and result/currentness owners |
| `load-calc-result-presentation.js` | Preserve calculated/exception/failed/blocked/unknown semantics |
| `workspace-layout.js`, `workspace-shell-controller.js` | Scoped task layout switch; restore normal model layout on exit |
| `src/core/model-loads/**`, engineering mass/execution modules | Numerical owners; unchanged in UI-only packages |

Candidate new cohesive modules, created only when their real consumer is added:

- `src/workspace/load-calc-workbench-model.js`: pure coherent snapshot projection,
  grouping and action reasons, with injected owner snapshots.
- `src/workspace/load-calc-workbench-view.js` plus scoped CSS: stage shell and
  layout; read-only presentation.
- `src/workspace/load-calc-review-view.js`: table/drawer controls if existing
  Preview seams cannot serve the new surface cleanly.
- `src/workspace/load-calc-workbench-ui-state.js`: optional UI state owner if
  context preservation cannot fit the current controller without mixing authority.

Names are implementation candidates, not permission to scaffold unused modules.
New modules normally stay within 300 physical lines; functions normally within
40 logical lines, with justified cohesive exceptions. No pass-through services,
new implicit singleton authority, duplicate engineering calculations or circular
owner dependencies. Every changed file must have a stated reason.

## 13. Visual, responsive and accessibility specification

- Retain AA's identity/dark palette initially; improve hierarchy and spacing.
  Final colour/font/token selection is a prototype decision, not an assumption
  that the audit screenshot is an approved visual design.
- Base body text target 14–16 px; use smaller text sparingly for secondary trace.
  Controls/labels should not be truncated into ambiguous ellipses.
- Desktop ≥1200 px: compact rail, flexible review workspace and optional
  contextual drawer. Rail target ~200 px, drawer ~360–420 px; the table remains
  usable with the drawer open.
- 768–1199 px: compact/collapsible rail; drawer overlays or replaces a bounded
  part of content; no permanent Properties panel.
- <768 px, including the observed 714 px viewport: compact four-step navigation,
  single-column workspace, full-width drawer/dialog and key row summary with
  detail access. Horizontal table scroll is contained and labelled.
- Verify 390, 714, 1024, 1280 and 1920 px widths plus 200% zoom. One primary
  content scroller; avoid nested blank panels and inaccessible footer actions.
- Semantic headings, labelled navigation/table/filter controls, visible keyboard
  focus, text-plus-colour statuses and appropriate live status announcements.
- Dialog focus trap, Escape close, focus return and no accidental dismissal of
  an in-progress confirmation. Drawer does not steal focus on background refresh.
- Keyboard-operable row actions, group expansion, filters, horizontal scroll and
  next-issue navigation. Announce updated counts without flooding the reader.
- Numeric cells have explicit units in header/details and accessible meaning
  for missing/unavailable values; not unexplained dashes only.
- Measure contrast and keyboard/screen-reader behavior during implementation;
  this document makes no WCAG compliance claim.

## 14. Errors, recovery, persistence and performance

### Recovery

Handle malformed import, unavailable master, mapping ambiguity, failed
preparation/checker, stale draft, invalid review transaction, unsupported fitting,
missing mass location, unqualified method, run error and failed download as
explicit states. Each message has a retry or exact review target plus technical
detail. Do not clear the previous usable data on a presentation error.

Escape imported text; filenames/descriptions/codes are untrusted display data.
No HTML insertion from raw source text. Do not expose full local file paths or
large source JSON in an export unless the existing payload requires them and
the user selects the evidence export.

### Persistence

Reuse current approved-record/source persistence. Do not migrate accepted
evidence in the shell package. Refresh rehydrates owners then evaluates
currentness; stored UI state never restores eligibility. Dataset changes clear
incompatible row selection/drafts/session deferrals. Any new persisted schema
requires versioned validation, migration/rollback tests and ownership review.

### Performance targets, proposed for measurement

- For the current 127-row review dataset, filter/sort response p95 ≤200 ms and
  drawer/popup visible response ≤300 ms after data is prepared, on the recorded
  local test environment. These are targets, not measured results.
- Capture preparation/run durations separately from render latency; no promise
  of solver duration or a fake progress percentage.
- Avoid rebuilding topology/mass/preparation on purely visual actions. Reuse
  revision-bound snapshots and real dependency metadata.
- Debounce expensive search work, unsubscribe on unmount, and ignore outdated
  async completions. Introduce pagination/virtualization only after larger
  fixture measurement, with keyboard/selection/evidence behavior preserved.

## 15. Delivery packages and dependencies

No calendar estimate is promised before baseline and engineering gaps are
measured. Sequence is dependency-based. UI packages may proceed with honest
blocked data; full-result closure depends on engineering packages.

| Package | Scope / dependencies | Exit evidence |
|---|---|---|
| P0 Baseline and ownership | Freeze exact dirty-worktree/input/report basis; current policy, roadmap and active-chain checks | Reproducible state capture; owned paths; unresolved/NOT_RUN ledger |
| P1 Design prototype | Four-stage shell and unified Review using captured actual blocked Sjson; no engineering mutation | Owner-selected design; desktop/narrow captures; next-blocker usability walkthrough |
| P2 Read-only production workbench | Coherent snapshot adapter, issue grouping, table/drawer, weight dialog, scoped layout; P0/P1 | Pure-model/immutability tests, parity with current owners, responsive browser walkthrough |
| P3 Review controls | Existing acceptance/rejection, approximate confirmation, exact batch review where supported, session deferrals, context preservation; P2 | Transaction/currentness/negative tests; accepted records only change on explicit permitted action |
| P4 Calculate integration | Check/Calculate separation, existing method selection/run owner, concurrency/currentness; P2 plus eligible bounded fixture | Ready/blocked/stale/failed browser paths; exactly one execution; no approval bypass |
| P5 Results and exports | Current results, projections, exceptions, units/lineage and existing export owners; P4, E3 for Fh | Result-contract parity, actual download inspection, stale/unsupported negative cases |
| P6 Qualification and opt-in rollout | UI regression/accessibility/performance, existing suite, real connector flows; P2–P5 | Explicit evidence matrix; no new default until agreed adoption criteria met |
| E1 Input/section closure | Review pending pipe candidates against approved source/master basis; independent of visual shell | Exact selectors, source precedence and acceptance evidence; no indiscriminate accept-all |
| E2 Fitting/mass/location closure | Isolate mixed-bore selection, authorized fitting basis including caps where required, contents/insulation and placement; E1 where needed | Independent mass/location evidence, negative controls and focused production-route validation |
| E3 Requested load semantics | Establish Fh and all requested axes/signs/moment reference/units; reuse existing producers | Approved quantity mapping and oracle cases; unsupported states remain explicit |
| E4 Real Sjson numerical E2E | Current qualified inputs/method plus E1/E2/E3 and P4/P5 | Actual requested cases, coverage/equilibrium/oracle evidence and inspected exports |

E1–E4 are bounded engineering work packages, not automatic permission to change
protected mechanics. Search existing capability first. Stop at an unapproved
method/source/benchmark/precedence change and present the exact required
decision. Do not block P1/P2 merely because full Sjson numerics are unresolved.

### Implementation tasks by package

P0: capture hashes/counts and current reports; identify independent fixtures;
inventory existing run/result/export owners; establish surgical changed-path
ownership; preserve dirty changes and protected sibling domains.

P1: create an isolated frontend prototype with actual captured unresolved states
and no write connections; implement one complete review interaction; compare
with standalone consolidation; approve layout/copy before production migration.
Any illustrative result numbers must be clearly mock-only, not Sjson results.

P2: implement and test snapshot projection first; add scoped shell and review
rendering; reuse shared weight rows; wire readonly event refresh; add stable
selection/context; keep legacy experience accessible through opt-in.

P3: connect one exact reviewed action before batches; connect approximate bundle
confirmation; test stale binding transaction failures; integrate deferral/restore;
add grouped batch preview only for supported atomic owner operations.

P4: reuse existing run orchestration with explicit UI intent/availability; test
readiness failure without seal/run; test qualified bounded run; handle repeated
clicks and source changes without competing executions or stale completion.

P5: project current/historical results without new mechanics; distinguish reaction
and transfer demand; wire existing export APIs and inspect payloads; implement
Fh only after E3; retain imported reference loads in a separate view.

P6: execute connector walkthroughs and applicable regression suites at exact
head/input basis; record limits; trial the opt-in workbench; adopt only after
Owner acceptance. Legacy removal is a later separately scoped cleanup.

## 16. Requirements and acceptance traceability

| ID | Requirement | Package / acceptance evidence |
|---|---|---|
| R01 | Four stable, consistently numbered stages; no duplicate workflow bars | P1/P2, navigation browser tests |
| R02 | Full-width task layout with normal model layout restored on exit | P2/P6, width/exit captures |
| R03 | Model/master/default intake is source-bound and visibly incomplete when necessary | P2/P3, import/mapping/currentness tests |
| R04 | Source/proposed/accepted-effective values remain separate | P2/P3, exact field provenance tests |
| R05 | One readiness projection with distinct issue/field/entity/coverage counts | P2, report comparison and dedup tests |
| R06 | Review next issue opens exact corrective evidence without workspace hopping | P2/P3, connector walkthrough |
| R07 | Filter/case/row/scroll context survives popup/drawer/3D return | P2/P3/P5, browser tests |
| R08 | Metal/fluid/insulation summaries remain visible collapsed | P2, weight display tests/captures |
| R09 | Dedicated weight popup shares the same row data and units | P2, popup/table parity tests |
| R10 | Pipe density-derived evidence uses current formula owner and case policy | P2/E1, resolver trace/independent check |
| R11 | Fittings including cap needs are reviewed with compatible basis/location | E2, per-type qualified/negative fixtures |
| R12 | Deferrals remain unresolved and cannot change numerical hashes/readiness | P3, skip/restore/stale tests |
| R13 | Approximate matches require explicit complete-bundle review and rationale | P3, store transaction tests |
| R14 | Batch actions list exact targets and are atomic within current binding | P3, partial-failure/staleness tests |
| R15 | Method selection is automatic only under existing authorized rules | P4, deterministic/ambiguous/unqualified tests |
| R16 | Input checks cannot seal, approve or execute | P4, owner-call and mutation assertions |
| R17 | Calculate is eligible/current and executes only once | P4, race/double-click tests |
| R18 | Late/stale results cannot appear current | P4/P5, binding/invalidation tests |
| R19 | Calculated, exceptions, blocked, failed and unknown remain distinct | P5, result-presentation tests |
| R20 | Fv/Fa/Fl and global quantities show defined basis/units; Fh has a decided contract | P5/E3, quantity/axis/sign tests |
| R21 | Imported forces are separate from calculated reactions | P5, source/result custody test |
| R22 | Exports preserve lineage/status and enforce existing publication rules | P5, download/round-trip inspection |
| R23 | Narrow-screen, keyboard, focus and readable status flows work | P6, measured accessibility/browser evidence |
| R24 | UI-only changes leave source/accepted/numerical/result authority unchanged | P2–P6, parity/hash/no-write tests |
| R25 | Full Sjson cases and requested loads are genuinely run and independently checked | E4, numerical evidence plus connector E2E |
| R26 | Clear retry/recovery and no lost usable data on failures | P2–P6, negative browser/import tests |
| R27 | No protected neighbouring domain or Owner Roadmap is silently changed | All packages, diff/authority review |

## 17. Test and validation plan

### 17.1 Pure presentation and contracts

Test deterministic grouping, unique counts, duplicate causes, missing/unknown
codes, supported/unsupported actions, exact identity, source/proposal/effective
separation, null versus zero, partial mass, units, escaped content, coherent
revision capture and immutability. UI filters/dialog/deferral must leave owner
semantic hashes and accepted records unchanged.

Tests should compare new UI projections with owner contracts, not private DOM
implementation details alone. Existing tests that hardcode seven/eight-stage
labels need deliberate route-contract migration; do not delete their authority,
staleness or fail-closed assertions to make the new layout pass.

Proposed additions: `scripts/load-calc-workbench-check.mjs`,
`tests/load-calc-workbench-state.test.mjs`, and
`e2e/load-calc-workbench.spec.js`, each tied to a production seam.

### 17.2 Existing focused checks, selected by changed boundary

```text
node scripts/load-calc-preview-check.mjs
node scripts/load-calc-weight-review-check.mjs
node scripts/load-calc-approximate-match-preview-check.mjs
node scripts/load-calc-result-presentation-check.mjs
node scripts/load-calc-run-ready-snapshot-check.mjs
node scripts/load-calc-current-common-input-run-routing-check.mjs
node --test tests/load-calc-dependency-invalidation.test.mjs
node scripts/current-common-input-empirical-mass-projection-check.mjs
node scripts/current-common-input-empirical-support-load-execution-check.mjs
node scripts/current-common-input-handcalc-mass-support-parity-check.mjs
node scripts/run-playwright.mjs e2e/non-fea-input-check-load-calc.spec.js
node scripts/run-playwright.mjs e2e/w10.9-load-calc-consumer.spec.js
```

A focused fixture pass is not full Sjson numerical PASS. Engineering packages
must use the owning source/runtime/hand-calc/oracle checks for their actual
boundary, including independent expected values and existing tolerance authority.

Then apply relevant project regressions:

```text
node scripts/run-non-fea-checks.mjs
npm run check:imports
node scripts/advanced-shell-contract-check.mjs
npm run build
git diff --check
```

No workflow-file changes are proposed. Unavailable runner, skipped test, failed
transport, inspection, or a zero-step job is NOT_RUN/FAIL as appropriate, not
executable engineering PASS.

### 17.3 Browser connector scenarios

1. Empty project → import → visible setup/review with no auto acceptance/run.
2. Actual Sjson + BC4 → unresolved queue; verify each count against owners.
3. Source fitting Sch 80 / pipe Sch 120 candidate → exact scope comparison;
   no automatic source override or false contradiction.
4. Collapsed pipe/fitting weights → popup → case change → close; same values,
   preserved context and no mutation.
5. DN150 `/51228` versus DN80 borrowed section → warning/evidence remains;
   preview does not imply qualified mass or ready loads.
6. Defer with/without reason → restore → refresh/binding change; no readiness
   bypass, hidden exclusion or zero insertion.
7. Exact/approximate acceptance in a controlled fixture → existing receipt;
   source remains immutable; results become outdated through current owners.
8. Batch confirmation with one conflict or a changed binding → no partial commit.
9. Check inputs while blocked → relevant issues; no system seal or execution.
10. Qualified bounded fixture → Calculate once → real current result → inspect
    units/basis/coverage/equilibrium → download and inspect actual payload.
11. Change master/policy/topology after a run → Outdated, blocked current export;
    permitted historical evidence remains clearly labelled.
12. Duplicate Calculate clicks/source change during preparation/run → correct
    concurrency/currentness and no falsely current late result.
13. Failed/unknown/exception result and unsupported Fh projection → explicit
    states; no fabricated numbers or clean-success badge.
14. 390/714/1024/1280/1920 px and keyboard/zoom → usable review, dialog focus
    return, no blank grid or inaccessible primary action.
15. Exit to model and return → normal viewport layout restored, review context
    retained; specialist modules continue working.
16. After E1–E3 closure, repeat actual Sjson end to end for all authorized requested
    cases; inspect support load evidence/export, not just successful navigation.

A final claim of completed loads requires scenario 16 plus engineering validation,
not merely a successful small fixture or UI screenshot.

### 17.4 Numerical verification boundary

Keep independent verification separate from production calculation: hand/closed-
form pipe masses with explicit units/cases; source-qualified fitting mass and
application points; gravity/force and force/moment balance; transformations and
reference-point transport; exact case/support coverage and unallocated demand;
published/cross-solver evidence only where the owning authority permits it.

Isolate the first wrong boundary before patching. Freeze authorized expected
values and tolerances; never derive the oracle from the output being tested.
Keep source/geometry, mass projection, mechanics, result contract and UI display
checks separately locatable.

## 18. Migration, rollout and rollback

Use an opt-in local application workbench flag/entry (not a workflow edit),
default off until accepted. The flag changes presentation/navigation only;
there is still one engineering input/run authority.

Migration order: baseline → prototype selection → read-only new UI → review
controls → run/results → qualification → agreed default. Keep the old view
available during trial. Do not fork stores or migrate numerical contracts to
support the flag. Legacy button/route shims are temporary bounded compatibility.

Before adoption compare old/new against identical captured inputs: owner
request/report/result identities, accepted record contents, case coverage,
readiness, execution availability and exported engineering values. Any difference
requires explaining its real boundary, not masking it as presentation cleanup.

Rollback: disable the presentation flag/entry and restore old navigation using
the same owner stores. No deletion of accepted records, source files or results;
no destructive repository reset. A persistence or numerical change cannot rely
on a UI flag for rollback and needs its own reviewed migration strategy.

## 19. Decisions and risks

| Decision / risk | Proposed disposition | When required |
|---|---|---|
| Whole-app versus Load Calc scope | Deliver Load Calc first; separate neighbouring modules | Before P0 implementation |
| Visual layout/copy | Review an actual blocked-state prototype; avoid blind clone | P1 exit |
| Requested cases | Use current authorized active cases; explicitly agree final Sjson case set | Before E4 |
| Fh meaning and complete requested quantities | Exact producer/basis decision; unsupported is not zero | E3 before affected P5/E4 acceptance |
| Fitting density methodology/caps | Reuse qualified existing basis or obtain explicit engineering decision | E2 |
| Mixed-bore borrowed section / CoG | Independent diagnosis, exact source-backed resolution | E2/E4 |
| Batch API limitations | Individual actions until an atomic owner contract exists | P3 |
| Persistent deferrals | Session-only first; optional versioned UI metadata later | Only if durable deferral requested |
| Existing partial seals | Specialist explicit path only, not routine-ready shortcut | P4 |
| Dirty worktree / sibling domains | Capture ownership and surgical diff before code | Every material package |
| Existing tests coupled to legacy UI | Migrate labels/selectors while retaining engineering assertions | P2–P6 |
| Displayed partial weight vs solver mass | Label and compare actual consumer inputs, no authority promotion | P2/E2 |
| Missing cancellation/export capability | State limits; add only separately scoped validated capability | P4/P5 |

No user decision is needed to finish this planning document. Decisions above
are stage gates for future implementation; they are not reasons to invent
engineering assumptions or stop read-only UI work prematurely.

## 20. Definition of done and truthful handoff

### Workbench done

The four-stage experience is adopted only after the selected design is built,
the user can find and act on the next blocker without switching workspaces,
collapsed/shared weights work, context and deferrals behave safely, existing
authority/currentness contracts remain intact, applicable regressions pass,
and connector/responsive/accessibility evidence is captured at the exact basis.

### Full task done

In addition, all required Sjson input/mass/location/method obligations have
explicit evidence-backed dispositions; authorized cases were actually executed;
requested available quantities and unresolved/unsupported quantities are
distinguished; independent equilibrium/oracle checks pass within existing
approved tolerances; actual exported contents preserve source/run lineage and
publication rules. No full Fv/Fh/Fa/Fl/moment completion claim before this gate.

### Specification delivery status (2026-10-01; historical)

This turn delivers the specification/plan only. Production implementation,
new prototype, revised browser journey, new tests/build and full Sjson numerical
execution are NOT_RUN for this specification. Earlier evidence retains its
exact historical scope and does not become validation of the proposed revamp.
Existing numerical blockers and chain custody are unchanged.

Next implementation action, when separately directed: P0 baseline reconciliation
followed by P1's isolated four-stage/Review inputs prototype using actual blocked
Sjson evidence. Do not start by rewriting mechanics or accepting all candidates.

## 21. Implementation progress — 2026-10-02

After the Owner's “start coding”, an isolated source-only P1 review UI slice is
implemented in [prototypes/load-calc-workbench](../../prototypes/load-calc-workbench/README.md).
It includes four-stage navigation, input categories, source/effective/proposed
separation, branch/search/case filters, context evidence, a shared weight popup
with collapsed weights, session-only defer/restore, and truthful disconnected
Calculate/Results states. This is not adoption of the replacement primary workflow.

The fixture is hash-bound and uses the existing observational projection/weight
owners with no approved global-unit fallback or accepted sidecar. Therefore its
source-only mass coverage is 0/127, not EP-007's historical prepared-state 69/127.
No project values, master proposals, defaults, approvals or calculation results
are invented. The existing app remains unchanged. Source code is visible to Git
review; the independent entry is not part of the production build.

PASS: prototype fixture/model/deferral/escaping/boundary tests; existing Preview
and weight-review tests; imports; shell contract; syntax and whitespace checks;
production build regression (with existing warnings). PASS: browser interaction
checks and 714px/390px containment. Exact scope and screenshots are recorded in
[EP-008](../../agents/chains/LOAD-CALC-SJSON-AUTO-20261001/endpoints/EP-008.md).
NOT_RUN: full aggregate regressions, current prepared-input adapter, authoring,
production adoption/deployment and full Sjson numerical execution.

Next gate: review this layout and reconcile the bounded production read-only
adapter/integration scope. The actual prepared snapshot, engineering authority
and freshness must flow from their existing owners before production use.

### P2 bounded read-only integration — 2026-10-02

The Owner's subsequent “ok proceed” authorizes the opt-in prepared-input slice.
EP-009 was committed as a relay-only write-ahead checkpoint before this leg's
material edits. The app's **New workbench · read-only** entry now mounts shared
four-stage presentation against the existing current preparation/checker owners.
It is not a second input store, runner, approval path or replacement default.

Implemented: source/effective/pending comparisons; exact proposal values and
source revisions; approved existing unit fallback disclosure; canonical checker
coverage alongside explicitly separate case-preview weights; modal collapsed
contributions, reasoned session deferral/restore; filters and safe round-trip
context; fail-closed source/request/report/error handling and candidate reset.
The source-only prototype reuses the same presentation without app-store access.

PASS: integration adapter positives/negatives and independent annular-mass oracle;
existing prototype/Preview/weight checks; imports, shell contract and production
build. PASS: connector tests on actual Sjson for four stages, current proposals,
filters, blank reason rejection, defer/restore, Escape/modal focus, unchanged
refresh and Input Check round-trip, plus 714px/390px layout containment.
The displayed checker remains 6/8 ready, 3 issues, 69/127 mass coverage,
105 proposed fields and 98 accepted records. Request/report hashes do not change
across tested review actions. Browser console has no captured errors/warnings
at the final current state. Screenshots and exact bindings are in
[EP-010](../../agents/chains/LOAD-CALC-SJSON-AUTO-20261001/endpoints/EP-010.md).

FAIL: aggregate Non-FEA suite stops at empirical restraint-network V1 because
`benchmarks/LFEA/BM2/Input_BM2.xml` is absent; subsequent checks are NOT_RUN.
NOT_RUN: browser injection of changed owner bindings (covered by the injected
controller/pure adapter tests), full Sjson load execution, authoring controls,
Run/export integration, default adoption, deployment and merge. This partial P2
slice does not complete P2–P6 or the full numerical definition of done.

Next: reconcile/accept this presentation slice and restore the missing benchmark
fixture through its owning custody, then scope the remaining governed review
actions and engineering blocker diagnosis. Do not silently convert the existing
weight-preview policy to canonical checker policy or auto-accept master proposals.
