# PLAN_UPDATE — automatic empirical screening inputs

Responsibility: owner-direct:advanced-analysis:sjson-routine-run-auto-20261001
Protocol: reallaksh19/Common@149770a21ca073df49717a96e2106c967adddc2d:skills/engineering-pr-delivery-v3.2
Basis: HEAD 6518a502d0c86524e4ad45801f4be35817622b5c plus existing dirty work; preserve all previous changes.
Classification: ENGINEERING_CRITICAL, bounded read-only screening presentation/input binding.

## Scope

Reuse the unchanged ACCESS_TEMP_WALL_WEIGHTED_V1 formula with current OPE reference rows. Match a support site to a unique physical straight-pipe segment on an existing READY route, using existing route coordinates and configured port tolerance, never nearest-pipe or fuzzy line matching. Multiple candidates remain explicitly unresolved. Read OD/wall from the exact current sealed enriched model. Read operating temperature from the existing mapped line-list operating column, not generic T1/design maximum. Preserve full line key, row/sheet/header/source hash and section evidence.

The supplied workbook LineList rows 313, 318, 319, 325, 326 identify S8810101, S8810103, S8811951, S8810111 and S8810112 with working temperature 309 C and design maximum 325 C. Source inspection only; no workbook edits or new engineering authority. Existing UI mapping uses t2 for working temperature and t1 for design maximum. Inspect column semantics rather than hard-code t2 for every workbook.

Automatic per-support estimates are separate from solved vectors and from gravity receipt/export. Provide automatic input restore plus editable local what-if preview; edited values must lose their automatic-source label. Missing/ambiguous/stale inputs produce row-local reasons, not zero and not a gravity blocker. No material-grade qualification, support creation, sign/vector convention, source/master precedence, profile coefficient, numerical authority, publication, workflow or solver change.

## Implementation and validation

1. Pure automatic binding adapter, explicit current receipt/common-input/dataset/route custody checks and conservative support-to-pipe identity.
2. Pass current snapshots from controller to Results without store mutations. Render automatic estimates and provenance for every current OPE reference. Selecting a reference fills exact available inputs; restore automatic inputs replaces local edits only.
3. Focused arithmetic/binding/UI tests: design vs operating, duplicate line/pipe/site/route identities, missing/invalid temperature, stale source/hash, invalid section, endpoints, zero/lift-off, escaped labels, local override/restore, source immutability.
4. Applicable currentness/import/shell/build regressions and real connector browser test. Preserve truthful legacy runner FAIL and NOT_RUN for full vectors.
5. Durable TASK_EVIDENCE and scoped STEP result; no progress credit until a declared outcome unit is complete.

## Bounded provenance correction discovered in browser

The supplied sheet's used range begins at row 4. The existing three-row reader
numbered from the returned array rather than the worksheet range, reporting S8811951
at row 316 instead of Excel row 319. Correct only worksheet-address metadata by
including the decoded range offset and preserving blank rows during extraction.
Keep headers, source bytes/hash, cell values, source authority and numerical methods
unchanged. Verify the five exact workbook rows and a shifted synthetic range with
blank rows. Re-import the unchanged workbook through the UI, then re-run normal
gravity; old persisted row metadata is not silently upgraded or trusted.
