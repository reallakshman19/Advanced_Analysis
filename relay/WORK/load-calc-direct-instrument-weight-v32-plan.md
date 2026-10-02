# IMPLEMENTATION_PLAN — direct instrument catalogue rows

Same responsibility and draft PR #1915; ENGINEERING_CRITICAL. Common v3.2 exact basis `149770a21ca073df49717a96e2106c967adddc2d`.

Read-only source diagnosis found that both weight workbooks include row 1484, NPS6 / DN150, rating900, `Instrument-ESDV/UZV`, 548kg, without a face-to-face length. The standalone enriched model supplies only zero placeholders for the eight retained items. The current popup runs a length-only ranker first and only consults normalized bore/rating rows if that ranker returns nothing, hiding the direct UZV family row behind a synthetic factor candidate.

Bounded fix: expose direct ESDV/UZV family catalogue rows with exact normalized bore/rating before length-derived suggestions. Preserve the master hash, original row provenance, reviewer staging/acceptance and numerical population. Do not relabel generic XCV, straight control bodies, weldneck flanges, interpolation or zero placeholders as an exact identity for the seven other items. Add a focused real-Sjson / full-master regression plus ambiguity and mismatch negatives. Verify the current browser review and actual Run using existing input owners. Inspect configured scenario prerequisites without inventing restraints/stiffness or expanding restricted qualification. Update this draft only, no merge/release.

Expected bounded outcome: one positive source-backed catalogue mass, not completed Fv/Fh/Fa/Fl/moments. Full calculation remains unavailable unless every required input is legitimately ready. No repeated qualification questions.

Browser single-factor falsifier: the actual auto-mapping maps both DN and NPS; the instrument row has a blank DN cell. Existing normalization derives DN only when the entire DN column is unmapped. Reuse/export its existing NPS-to-DN helper solely for blank-DN direct instrument catalogue lookup. Preserve every supplied DN (invalid/zero included), do not change global normalization/default precedence. Regression must use the actual mapping, not NPS-only normalization.
