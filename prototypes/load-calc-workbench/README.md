# Load Calc workbench — P1 isolated prototype

Open with the existing Vite development server:
http://localhost:5173/AA3/prototypes/load-calc-workbench/index.html

This is the first coding slice of
`docs/load calc/load-calc-workbench-spec-and-implementation-plan.md`:
four-stage navigation, unified input comparison, review categories, case/branch/
search filters, a component evidence dialog, collapsed weight summaries and
session-only defer/restore. Calculate and export are intentionally disconnected.

It reads the actual hash-bound Sjson fixture through the existing immutable
dataset adapter, source projection and preview/weight owners. It does not load
the main application's settings, accepted records or proposal stores. Thus its
source-only counts are not the historical EP-007 accepted-state counts. Unknown
global source units remain blocked; no approved unit fallback is invented.
Its table is evidence inspection, not current-input qualification or engineering
acceptance. Source fitting schedules remain descriptions, not pipe assignments.
No whole-system result or Fv/Fh/Fa/Fl/moment output is claimed.

Files:

- `index.html`: independent entry; existing application is unchanged.
- `workbench-model.js`: reexports the shared observational model, filters and UI deferrals.
- `workbench-view.js`: reexports the shared escaped stage/table/dialog presentation.
- `workbench.js`: frontend events, pinned fixture fetch and modal focus behavior.
- `workbench.css`: AA-aligned responsive layout; large tables scroll internally.
- `check.mjs`: fixture, data immutability, case blocking, filter, deferral and
  source/UI boundary checks. Run `node prototypes/load-calc-workbench/check.mjs`.

Source files are outside the ignored artifacts folder so they remain visible
to Git review. Browser screenshots stay in artifacts/load-calc-workbench-prototype.
This entry is development-only; it is not included in the production build.

## Opt-in prepared-input integration

The application at http://localhost:5173/AA3/ now has a **New workbench · read-only**
entry inside Load Calc. It shares the model/view above but uses the existing
current-input preparation and checker owners, not the prototype fixture fetch.
The default guided workflow remains available and unchanged in authority.

Current winners, pending proposals and checker mass coverage are separate from
case-specific weight-preview availability. Failed or changed request/source/report
bindings withhold previous weights and checker metadata. Session skips clear on
candidate changes and never become exclusions, approvals or Run eligibility.

Run `node scripts/load-calc-workbench-check.mjs` for the integration's pure
adapter/currentness/negative/independent-mass checks. See EP-010 in the active
chain for browser evidence and validation limits. The broad Non-FEA suite currently
fails at a missing owned BM2 XML fixture; full Sjson load execution remains blocked.
No Run/export connection or default-workflow adoption is claimed by this slice.
