import { effectivePreviewFields } from '../load-calc-preview-model.js';
import { esc, num } from '../load-calc-preview-table.js';
import { STAGES, CATEGORIES, reviewSummary, rowProblems, problemLabel } from './workbench-model.js';

export function shellMarkup(review, state, runAvailability = null) {
  const summary = reviewSummary(review, state.caseId, state.deferrals.skipped);
  const prepared = review.mode === 'prepared';
  const inputStatus = runAvailability?.ready && !review.unavailable ? 'Input Check ready · preview caveats separate' : 'Input review required';
  const headingStatus = prepared && runAvailability
    ? state.stage === 3 ? runAvailability.resultStatus || 'No current gravity receipt'
      : state.stage === 2 ? runAvailability.ready ? 'Ready for governed Run' : 'Run validates current inputs'
        : inputStatus
    : prepared && state.stage === 3 ? 'Separate result evidence' : 'Review required';
  return `<div class="workbench"><nav class="stage-nav" aria-label="Load calculation stages">
    <div class="nav-title">LOAD CALCULATION<small>${prepared ? 'Current prepared input review' : 'Sjson source review'}</small></div>
    ${STAGES.map((name, index) => `<button type="button" data-stage="${index}" ${index === state.stage ? 'aria-current="step"' : ''}><span class="step-number">${index + 1}</span><span>${esc(name)}<small>${esc(['Source & project basis', inputStatus, prepared ? 'Existing runner · separate authority' : 'Not connected in prototype', prepared ? runAvailability?.resultStatus || 'Existing results · separate evidence' : 'No calculated results'][index])}</small></span></button>`).join('')}
    <p class="nav-note">${runAvailability ? 'Four stages, with the existing input, calculation and export owners. Skips do not approve or exclude inputs.' : 'Specialist tools stay in the current application. This preview cannot approve inputs or execute a calculation.'}</p></nav>
    <main id="main" tabindex="-1"><header class="page-heading"><div><p class="eyebrow">SUPPORT LOAD WORKBENCH</p><h1>${STAGES[state.stage]}</h1></div><span class="status warning">${esc(headingStatus)}</span></header>
    ${prepared ? preparedNotice(review) : `<div class="source-note">Source-only: ${esc(review.dataset.sourceName)}. Saved project settings, accepted matches and proposals are not loaded here; your current app is unchanged.</div>`}
    <section class="readiness" aria-label="Review summary"><div><strong>${summary.groups.length}</strong><span>${prepared ? 'preview issue groups' : 'input issue groups'}</span></div><div><strong>${summary.affected}</strong><span>${prepared ? 'preview review items' : 'affected components'}</span></div><div><strong>${prepared ? review.checkerMassCoverage?.covered ?? 'Not reported' : summary.coverage}<small>${prepared ? review.checkerMassCoverage ? ` / ${review.checkerMassCoverage.total}` : '' : ` / ${summary.total}`}</small></strong><span>${prepared ? 'Checker mass coverage · selected methods' : `${state.caseId} mass evidence coverage`}</span></div><div><strong>${summary.deferred}</strong><span>deferred · still unresolved</span></div></section>
    ${runAvailability && state.toolTab ? toolMarkup(state.toolTab) : state.stage === 0 ? (prepared ? preparedSetupMarkup(review) : setupMarkup(review)) : state.stage === 1 ? reviewMarkup(review, state, summary, runAvailability) : prepared ? preparedStageMarkup(state.stage, review, runAvailability) : blockedMarkup(state.stage)}
    <footer>Weights are evidence previews, not support loads. ${prepared ? 'Existing owners supply input changes, calculated loads and evidence export; screening estimates remain separate from solved reactions.' : 'Fv, Fh, Fa, Fl and moments have not been calculated in this prototype.'}</footer>
    </main></div><dialog id="evidence-dialog" aria-labelledby="evidence-title"></dialog><dialog id="weight-dialog" aria-labelledby="weight-title"></dialog>`;
}

function preparedNotice(review) {
  return `<div class="source-note" ${review.unavailable ? 'role="alert"' : ''}>${review.unavailable ? esc(review.unavailable) : `Current preparation: ${esc(review.dataset.sourceName)}. Effective winners and pending proposals are separate. Case-specific weight previews use the existing preview resolver, not checker coverage or Run eligibility.`}</div>
    <div class="preparation-controls"><button type="button" data-action="refresh">Refresh prepared inputs</button><button type="button" data-load-calc-tab="preflight">Open Input Check</button><button type="button" data-load-calc-tab="enrichment">Review master proposals</button></div>
    <details class="review-binding"><summary>${review.unavailable ? 'Current checker evidence unavailable · refresh required' : `Current checker evidence · ${review.status?.summary?.readyGateCount ?? 0}/8 gates ready · ${review.status?.summary?.masterProposalCount ?? 0} proposed fields · ${review.status?.summary?.acceptedEnrichmentRecordCount ?? 0} accepted records`}</summary><p>Request ${esc(review.requestHash || 'Not prepared')}<br>Report ${esc(review.reportHash || 'Not evaluated')}<br>Source ${esc(review.dataset.sharedModel?.semanticHash || 'Not loaded')}<br>Length unit ${esc(review.sourceLengthUnit)} · ${review.lengthUnitAuthority ? 'Existing approved project evidence' : 'Declared source / unresolved'}</p>${gateMarkup(review)}</details>`;
}

function gateMarkup(review) {
  return `<div class="gate-list">${(review.status?.gates || []).map((gate) => `<div><strong>${esc(gate.label || gate.gateId)} · ${esc(gate.state)}</strong><small>${esc(gate.message || '')}</small></div>`).join('')}</div>`;
}

function preparedStageMarkup(stage, review, runAvailability) {
  if (stage === 3) return review.unavailable
    ? '<section class="panel"><h2>Refresh current evidence</h2><p>Prepared input binding is unavailable. Previous loads and estimates are withheld; refresh prepared inputs.</p></section>'
    : '<div data-workbench-results></div>';
  if (runAvailability) return `<section class="panel"><h2>Calculate current inputs</h2><p>${esc(runAvailability.message)}</p><p>${runAvailability.ready ? 'Current checker is READY. The existing Run owner creates the required current seal and execution receipt.' : 'Run will validate first; missing or stale engineering evidence is not bypassed.'}</p><button type="button" class="primary" data-load-calc-run ${runAvailability.eligible ? '' : 'disabled'}>${esc(runAvailability.label)}</button><button type="button" data-load-calc-tab="preflight">Inspect Input Check</button><button type="button" data-load-calc-tab="scenario-setup">Set up calculation scenario</button><button type="button" data-load-calc-tab="restraints">Restraints</button><button type="button" data-load-calc-tab="load-cases">Load cases</button><button type="button" data-load-calc-tab="methods">Configured scenario methods</button></section>`;
  return `<section class="panel blocked"><h2>${stage === 2 ? 'Calculation stays in the existing governed workflow' : 'Results stay bound to their existing execution evidence'}</h2><p>This read-only integration supplies no approvals, authorization or calculated loads. A session skip cannot enable Run or export. Use the existing workspace to review eligibility and current evidence.</p><button type="button" disabled>${stage === 2 ? 'Run calculation — not available in review' : 'Export — not available in review'}</button><button type="button" data-load-calc-tab="${stage === 2 ? 'preflight' : 'results'}">${stage === 2 ? 'Open governed Input Check' : 'Open existing results'}</button><button type="button" data-stage="1">Return to input review</button></section>`;
}

function setupMarkup(review) {
  return `<section class="panel"><p class="eyebrow">01 / SOURCE & SETUP</p><h2>Start with what the source actually provides</h2><dl class="facts"><dt>File</dt><dd>${esc(review.dataset.sourceName)}</dd><dt>Entities</dt><dd>${review.dataset.entities.length}</dd><dt>Components / branches</dt><dd>${review.rows.length} / ${review.branches.length}</dd><dt>Support entities</dt><dd>${review.supports.length} · not validated here</dd><dt>Global length unit</dt><dd>${esc(review.sourceLengthUnit)} · no approved fallback</dd></dl><p>Project units, line-list mapping and master assignments will use the existing governed preparation path during production integration. This prototype does not write them.</p><button class="primary" data-stage="1">Review source inputs</button></section>`;
}

function reviewMarkup(review, state, summary, runAvailability) {
  const componentCategory = !['supports', 'other'].includes(state.category);
  return `<details class="issue-disclosure"><summary>Next: ${esc(summary.groups[0]?.title || 'Review execution qualification')} · view ${summary.groups.length} input issue groups</summary><section class="issues" aria-label="Next input issues">${summary.groups.map((group) => `<button type="button" class="issue-card" data-category="${group.id}"><strong>${esc(group.title)}<span>${group.count} components</span></strong><small>${esc(group.detail)}</small></button>`).join('') || '<p>No source mass issues reported. Execution qualification is separate and is not evaluated here.</p>'}</section></details>
    <section class="panel review-panel"><div class="section-heading"><div><h2>Input preview</h2></div><div class="actions">${runAvailability ? '<button type="button" data-load-calc-tab="preview">Edit insulation & inspect weights</button><button type="button" data-load-calc-weight-review>Weights & contents…</button><button type="button" data-load-calc-tab="enrichment">Review catalogue / master matches</button>' : `<button type="button" data-action="weights" ${componentCategory ? '' : 'disabled'}>Weights & contents…</button>`}<button type="button" data-action="next" ${componentCategory ? '' : 'disabled'}>Next unresolved item</button></div></div>
    <nav class="category-nav" aria-label="Input review categories">${CATEGORIES.map(([id, title]) => `<button type="button" data-category="${id}" aria-pressed="${state.category === id}">${title}</button>`).join('')}</nav>
    <div class="filters"><label>Search components<input type="search" data-filter="query" placeholder="Entity, line, description" value="${esc(state.query)}"></label><label>Branch<select data-filter="branch"><option value="">All branches</option>${review.branches.map((id) => `<option value="${esc(id)}" ${state.branch === id ? 'selected' : ''}>${esc(id)}</option>`).join('')}</select></label><label>Weight case<select data-filter="caseId">${['EMPTY', 'OPE', 'HYD'].map((id) => `<option ${state.caseId === id ? 'selected' : ''}>${id}</option>`).join('')}</select></label><label class="check"><input type="checkbox" data-filter="unresolvedOnly" ${state.unresolvedOnly ? 'checked' : ''}>Unresolved only</label></div>
    <div id="review-content"></div></section>`;
}

function blockedMarkup(stage) {
  return `<section class="panel blocked"><p class="eyebrow">${stage === 2 ? '03 / EXECUTION' : '04 / RESULTS'}</p><h2>${stage === 2 ? 'Calculation is not connected yet' : 'No support loads to publish'}</h2><p>${stage === 2 ? 'This first slice tests the review workflow. It cannot choose an unqualified method, accept a master, seal a report or authorize an empirical package.' : 'A populated input preview is not a completed calculation. Results and exports remain unavailable until an authorized execution produces current, verified evidence.'}</p><button type="button" disabled>${stage === 2 ? 'Run calculation — unavailable in prototype' : 'Export support loads — unavailable'}</button><button type="button" class="primary" data-stage="1">Return to input review</button><details><summary>Remaining production integration</summary><p>Current-input adapter, qualified automatic method selection, readiness gating, existing authorized runner, quantity/axis contracts, evidence-bound results and export.</p></details></section>`;
}

export function rowsMarkup(rows, state, total) {
  return `<p class="row-count" role="status" aria-live="polite">${rows.length} of ${total} components · ${state.caseId} weight evidence · kg</p><div class="table-scroll" tabindex="0" role="region" aria-label="Source and effective input comparison"><table><thead><tr><th scope="col">Component</th><th scope="col">Source basis</th><th scope="col">Effective section</th><th scope="col">Proposed match</th><th scope="col">Weights · kg</th><th scope="col">Review / action</th></tr></thead><tbody>${rows.map((row) => componentMarkup(row, state)).join('') || '<tr><td colspan="6">No matching components. Change the search or filters.</td></tr>'}</tbody></table></div>`;
}

function componentMarkup(row, state) {
  const fields = effectivePreviewFields(row).slice(0, 3);
  const reason = state.deferrals.skipped.get(row.entityId);
  return `<tr><td><strong>${esc(row.entityId)}</strong><span>${esc(row.type)} · ${esc(row.component.identity?.lineId || 'No line')}</span><small>${esc(row.branchId)}</small></td><td><span>Source bore <b>${row.sourceBoreMm === null ? 'Not supplied' : `${num(row.sourceBoreMm)} mm`}</b></span><span>${row.type === 'PIPE' ? 'Pipe' : 'Fitting'} description Sch <b>${esc(row.sourceSchedule || 'Not supplied')}</b></span><small>${esc(row.description || 'No source description')}</small></td><td>${fields.map((field) => `<span>${esc(field.label)} <b>${num(field.value)}</b></span>`).join('')}<small>${row.derived ? 'Borrowed section · dry estimate only' : 'Effective evidence'}</small></td><td>${proposalMarkup(row)}</td><td>${massMarkup(row, state.caseId)}</td><td><span class="status warning">${reason ? 'Deferred · unresolved' : row.cases[state.caseId].ok ? 'Evidence available · not execution' : 'Needs input review'}</span><small>${esc(reason || problemLabel(rowProblems(row, state.caseId)[0] || 'Review source evidence'))}</small><button type="button" data-review="${esc(row.entityId)}">Review evidence</button></td></tr>`;
}

export function massMarkup(row, caseId) {
  const mass = row.mass[caseId];
  return `<span>Dry / metal <b>${num(mass.metalKg)}</b>${row.derived ? ' · estimate' : ''}</span><span>${caseId} fluid <b>${num(mass.fluidKg)}</b></span><span>Insulation <b>${row.type === 'PIPE' ? num(mass.insulationKg) : 'Not derived'}</b></span><span>${caseId} core <b>${num(mass.coreMassKg)}</b>${mass.dryOnly ? ' · dry only' : ''}</span>`;
}

export function evidenceMarkup(row, state) {
  const fields = effectivePreviewFields(row);
  const problems = rowProblems(row, state.caseId);
  const reason = state.deferrals.skipped.get(row.entityId);
  return `<header class="section-heading"><div><p class="eyebrow">COMPONENT EVIDENCE</p><h2 id="evidence-title">${esc(row.entityId)}</h2></div><button type="button" data-close="evidence-dialog" aria-label="Close evidence">Close</button></header><p>${esc(row.type)} · ${esc(row.branchId)}</p><div class="source-note">Review only. Changing this view does not accept a value or remove a blocker. Case weights use the existing preview resolver; checker coverage is separate.</div><h3>Source basis</h3><p>${esc(row.description || 'No description supplied')}<br>Source bore: ${num(row.sourceBoreMm)} mm · source description Sch: ${esc(row.sourceSchedule || 'Not supplied')}</p><h3>Effective inputs</h3><dl class="facts">${fields.map((field) => `<dt>${esc(field.label)}</dt><dd>${num(field.value)}<small>${esc(field.evidence?.sourcePath || field.evidence?.source || field.evidence?.sourceKind || 'No effective evidence')}</small></dd>`).join('')}</dl><h3>${state.caseId} weight evidence · kg</h3><div class="mass-list">${massMarkup(row, state.caseId)}</div><h3>Pending proposals · not applied</h3>${proposalMarkup(row)}<h3>Review reasons</h3><ul>${problems.map((code) => `<li>${esc(problemLabel(code))} <code>${esc(code)}</code></li>`).join('') || '<li>No mass blockers reported for this case; execution authority is not evaluated.</li>'}</ul><details><summary>Source trace & application point</summary><p>JSON pointer: ${esc(row.component.sourceReferences?.jsonPointer || 'Not supplied')}<br>Source entity: ${esc(row.source?.sourceEntityId || row.entityId)}<br>Length: ${num(row.component.geometry.sourceLengthM)} m<br>Application point: ${esc(row.component.geometry.applicationPoint ? JSON.stringify(row.component.geometry.applicationPoint) : 'Not qualified / missing')}</p>${row.derived ? `<p>Borrowed pipe: ${esc(row.derived.derivation.sourceComponentKey)}<br>Borrowed bore: ${num(row.borrowedBoreMm)} mm. This is not its own accepted section or a qualified point mass.</p>` : ''}</details>${deferralMarkup(row, reason)}<p id="deferral-status" role="status" aria-live="polite"></p>`;
}

function deferralMarkup(row, reason) {
  return `<section class="deferral"><h3>Skip for this review session</h3><p>A deferral is not an exclusion. It supplies no zero mass and does not enable calculation. Source/candidate changes or a page reload clear it.</p>${reason ? `<p>Reason: ${esc(reason)}</p><button type="button" data-restore="${esc(row.entityId)}">Restore review item</button>` : `<form data-defer="${esc(row.entityId)}"><label>Reason for deferring<input name="reason" required maxlength="300" autocomplete="off"></label><button type="submit">Defer review item</button></form>`}</section>`;
}

export function weightsMarkup(rows, state) {
  return `<header class="section-heading"><div><p class="eyebrow">WEIGHTS & CONTENTS</p><h2 id="weight-title">${state.caseId} · component weight evidence</h2></div><button type="button" data-close="weight-dialog" aria-label="Close weights">Close</button></header><p>Same filtered rows and case as the input preview. Weights remain visible when each item is collapsed. Pending is not zero.</p><p>${rows.length} components · ${state.deferrals.skipped.size} session deferrals · support loads not calculated</p><div class="weight-items">${rows.map((row) => `<details><summary><strong>${esc(row.entityId)} · ${esc(row.type)}</strong><div class="weight-summary">${massMarkup(row, state.caseId)}</div><small>${state.deferrals.skipped.has(row.entityId) ? 'Deferred · still unresolved' : row.cases[state.caseId].ok ? 'Mass evidence available · not execution' : 'Needs input review'}</small></summary><p>${esc(row.description || 'No source description')}</p><p>${esc(rowProblems(row, state.caseId).map(problemLabel).join(' · '))}</p><button type="button" data-weight-review="${esc(row.entityId)}">Review this component</button></details>`).join('') || '<p>No components match the current filters.</p>'}</div>`;
}

export function specialCategoryMarkup(review, category) {
  if (review.mode === 'prepared') return preparedCategoryMarkup(review, category);
  return category === 'other'
    ? `<section class="category-message"><h3>Project inputs need a governed preparation</h3><p>Global source length unit: <b>${esc(review.sourceLengthUnit)}</b>. No approved fallback, ancillary defaults, load-case approval or calculation method selection is applied here.</p><p>Source coordinates with mm text do not replace global source-unit authority.</p></section>`
    : `<section class="category-message"><h3>${review.supports.length} support entities in the source</h3><p>Presence is not readiness. Topology, restraints, route partitioning and support qualification are not evaluated by this prototype.</p><div class="table-scroll"><table><thead><tr><th>Support entity</th><th>Branch</th><th>Status</th></tr></thead><tbody>${review.supports.map((entity) => `<tr><td>${esc(entity.entityId)}</td><td>${esc(entity.branchId)}</td><td>Source only · not validated</td></tr>`).join('')}</tbody></table></div></section>`;
}
function proposalMarkup(row) {
  return row.proposed.map(({ record }) => `<span>${esc(record.fieldId)} <b>${esc(record.value)} ${esc(record.unit)}</b></span><small>Source ${esc(record.sourceId)} · revision ${esc(record.revision)} · not applied</small>`).join('')
    || '<span>No pending proposal for this entity</span><small>Source description ≠ accepted master. No automatic acceptance.</small>';
}

function preparedSetupMarkup(review) {
  return `<section class="panel"><h2>Current source & preparation</h2><dl class="facts"><dt>File</dt><dd>${esc(review.dataset.sourceName)}</dd><dt>Entities</dt><dd>${review.dataset.entities.length}</dd><dt>Components / branches</dt><dd>${review.rows.length} / ${review.branches.length}</dd><dt>Length unit</dt><dd>${esc(review.sourceLengthUnit)}</dd></dl><button type="button" data-load-calc-import>Import source JSON</button><p>Project settings, line-list and master changes use their existing owners. Replacing a file does not reapprove old engineering values.</p><button type="button" data-load-calc-tab="masters">Import & map line list / masters</button><button type="button" data-load-calc-tab="project-data">Project inputs & defaults</button><button type="button" data-load-calc-tab="topology">Check topology</button><button type="button" data-stage="1">Review prepared inputs</button></section>`;
}

function toolMarkup(tab) {
  const titles = { preview: 'Editable input preview', enrichment: 'Master & catalogue weight review',
    masters: 'Line list & master mapping', 'project-data': 'Project inputs & defaults',
    preflight: 'Current Input Check', 'seal-export': 'Current input evidence export', 'scenario-setup': 'Calculation scenario setup' };
  return `<section class="panel workbench-tool"><header class="section-heading"><h2>${esc(titles[tab] || tab)}</h2><button type="button" data-action="close-tool">Back to stage</button></header><div data-workbench-tool></div></section>`;
}

function preparedCategoryMarkup(review, category) {
  return `<section class="category-message"><h3>${category === 'other' ? 'Project & method basis' : 'Supports & topology'}</h3><p>${category === 'other' ? 'Existing checker gate states, not inferred readiness.' : `${review.supports.length} source support entities. Presence alone is not readiness.`}</p>${gateMarkup(review)}<button type="button" data-load-calc-tab="${category === 'other' ? 'project-data' : 'topology'}">Open existing ${category === 'other' ? 'Project Data' : 'Topology'} review</button></section>`;
}
