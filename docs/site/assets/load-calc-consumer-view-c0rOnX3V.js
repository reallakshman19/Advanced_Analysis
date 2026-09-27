const me=6,Ee=25;function fe(e){const t=Number(e);if(!Number.isFinite(t)||t<=0||t>6)throw new RangeError("TopoFix gap tolerance must be greater than 0 and no more than 6 mm.");return t}function be(e,t){const a=e.createElement("section");return a.className="load-calc-consumer empirical-load-calc",a.dataset.role="load-calc-consumer",a.innerHTML=`${P(t)}<div data-load-calc-pane class="empirical-load-calc__pane"></div>`,a}function U(e,t){const a=e?.reasonCode||t?.reasonCode||"";return{EMPIRICAL_SCENARIO_REQUIRED:"Configure a scenario in the Methods tab",EMPIRICAL_SCENARIO_BLOCKED:"Scenario has blockers — check Methods tab",EMPIRICAL_SCENARIO_NOT_READY:"Scenario not ready — authorize first",EMPIRICAL_SCENARIO_AUTHORIZATION_REQUIRED:"Authorize the scenario first",EMPIRICAL_SCENARIO_AUTHORIZATION_STALE:"Authorization is stale — re-authorize",NO_ACTIVE_DATASET:"No dataset loaded — import SJSON first",EMPIRICAL_RUNTIME_ACTIVE_MODEL_MISSING:"Load a dataset first",EMPIRICAL_INPUT_NOT_READY:"Check Verify & Run tab — some inputs are missing",EMPIRICAL_MODELS_NOT_READY:"Topology models not ready"}[a]||(a?a.replace(/_/g," ").toLowerCase():"Not ready")}function F(e){const t=e.empiricalScenarioState,a=e.authorizationState;return t?.calculationEligible?{label:"Run Load Calc",eligible:!0,reason:"Execute configured empirical scenario",action:"empirical"}:a?.calculationEligible?{label:"Run Load Calc — Gravity",eligible:!0,reason:"Execute authorized gravity load calc",action:"gravity"}:{label:"Run Load Calc",eligible:!1,reason:U(t,a),action:"none"}}function P(e){const t=e.distribution?.freshness?.status||"NOT_CALCULATED",a=e.authorizationState||{},n=e.commonInputState||{},i=n.commonInput?n.staleness?.stale?"STALE":"CURRENT":"NOT_SEALED",s=F(e),r=i==="CURRENT"?"ok":i==="NOT_SEALED"?"warn":"fail",c=a.state||"NOT_CONFIGURED",l=c==="EXECUTED_CURRENT"||c==="AUTHORIZED_CURRENT"?"ok":c.includes("AWAITING")||c==="DRAFT_READY"?"warn":"fail",d=t==="CURRENT"?"ok":t==="NOT_CALCULATED"?"warn":"fail",A={CURRENT:"Sealed ✓",STALE:"Seal stale ⚠",NOT_SEALED:"Not sealed"},_={EXECUTED_CURRENT:"Authorized ✓",AUTHORIZED_CURRENT:"Authorized ✓",DRAFT_READY:"Ready to authorize",DRAFT_BLOCKED:"Scenario blocked",AUTHORIZED_STALE:"Stale — re-authorize",EXECUTED_STALE:"Results stale",NOT_CONFIGURED:"No scenario",AWAITING_AUTHORIZATION:"Awaiting auth"},I={CURRENT:"Results ready ✓",NOT_CALCULATED:"Not run yet",STALE:"Results stale"},m=A[i]||i,h=_[c]||c,E=I[t]||t;return`<header class="empirical-load-calc__header">
    <div><span class="panel-eyebrow">GUIDED WORKFLOW</span><h1>Support Load Calculation</h1></div>
    <div class="empirical-load-calc__facts">
      <span data-pill-status="${r}">${o(m)}</span>
      <span data-pill-status="${l}">${o(h)}</span>
      <span data-pill-status="${d}">${o(E)}</span>
    </div>
    ${G(e,s)}
    <div class="empirical-load-calc__actions">
      <button type="button" class="button button--primary" 
        ${s.eligible?"":"disabled"}
        data-load-calc-run
        title="${o(s.reason)}">
        ▶ ${o(s.label)}
      </button>
      <output data-engineering-load-status aria-live="polite">${o(e.message||(s.eligible?"":s.reason))}</output>
    </div>
  </header>`}const x=new Set(["topology","project-data","masters","preflight","verify","loads"]),N=Object.freeze([Object.freeze({id:"import",label:"Import JSON",tab:null}),Object.freeze({id:"topology",label:"Topology Fix",tab:"topology"}),Object.freeze({id:"project-data",label:"Project Data",tab:"project-data"}),Object.freeze({id:"masters",label:"Import Masters",tab:"masters"}),Object.freeze({id:"preflight",label:"Validate Input",tab:"preflight"}),Object.freeze({id:"verify",label:"Run Calc",tab:"verify"}),Object.freeze({id:"loads",label:"View Loads",tab:"loads"})]);function G(e,t){return`<nav class="empirical-load-calc__workflow" aria-label="Load calculation process">
    ${N.map((a,n)=>H(a,n,e,t)).join("")}
    ${j(e)}
  </nav>`}const D=Object.freeze({overview:"Overview",enrichment:"Enrichment & Overrides",restraints:"Restraints","load-cases":"Load Cases",methods:"Methods",results:"Results",evidence:"Evidence","method-basis":"Method Basis","seal-export":"Seal & Export","json-trace":"JSON Trace","3d":"Model / 3D"}),B=Object.keys(D).length;function j(e){const t=!x.has(e.activeTab),a=t?D[e.activeTab]||"Open":`${B} views`;return`<details class="empirical-load-calc__advanced" ${t?"open":""}>
    <summary class="empirical-load-calc__workflow-step ${t?"is-active":""}" data-step-state="${t?"current":"pending"}">
      <span class="empirical-load-calc__workflow-index">8</span>
      <span class="empirical-load-calc__workflow-label">Advanced Tools</span>
      <span class="empirical-load-calc__workflow-status">${o(a)}</span>
    </summary>
    <nav class="empirical-load-calc__tabs" aria-label="Advanced load calculation views">
      ${b("Setup",[["overview","Overview"],["enrichment","Enrichment & Overrides"]],e.activeTab)}
      ${b("Scenario",[["restraints","Restraints"],["load-cases","Load Cases"],["methods","Methods"]],e.activeTab)}
      ${b("Output",[["results","Results"],["evidence","Evidence"]],e.activeTab)}
      ${b("Diagnostics",[["method-basis","Method Basis"],["seal-export","Seal & Export"],["json-trace","JSON Trace"]],e.activeTab)}
      ${b("Model",[["3d","Model / 3D"]],e.activeTab)}
    </nav>
  </details>`}function H(e,t,a,n){const i=a.currentWorkflowStepId||"import",s=e.id===i,r=z(e.id,t,i,a,n),c=e.id==="import"?"data-load-calc-import":`data-load-calc-tab="${o(e.tab)}"`;return`<button type="button" class="empirical-load-calc__workflow-step ${s?"is-active":""}" ${c}
    data-step-state="${o(r.state)}" aria-current="${s?"step":"false"}">
    <span class="empirical-load-calc__workflow-index">${t+1}</span>
    <span class="empirical-load-calc__workflow-label">${o(e.label)}</span>
    <span class="empirical-load-calc__workflow-status">${o(r.label)}</span>
  </button>`}function f(e,t){return{state:e,label:`${t} action${t===1?"":"s"} required`}}function z(e,t,a,n,i){const s=n.workflowReadiness||{},r=N.findIndex(l=>l.id===a),c={import:s.datasetReady,topology:s.topologyCheckReady,"project-data":s.projectDataReady,masters:s.masterDataReady,preflight:s.validationReady,verify:s.resultsCurrent,loads:s.resultsCurrent}[e]===!0;return e===a?e==="import"&&!s.datasetReady?{state:"blocked",label:"Import required"}:e==="topology"&&s.topologyBlockerCount>0?f("blocked",s.topologyBlockerCount):e==="topology"&&s.topologyReviewIssueCount>0?f("review",s.topologyReviewIssueCount):e==="verify"&&i.eligible?{state:"ready",label:"Ready"}:e==="preflight"&&!s.validationEvaluated?{state:"blocked",label:"Check required"}:e==="preflight"&&s.validationBlockerCount>0?f("blocked",s.validationBlockerCount):e==="preflight"&&s.validationState&&s.validationState!=="NOT_EVALUATED"?{state:"blocked",label:"Review"}:e==="project-data"&&s.projectDataActionCount>0?f("blocked",s.projectDataActionCount):e==="masters"&&s.masterDataActionCount>0?f("blocked",s.masterDataActionCount):(e==="verify"||e==="loads")&&!s.resultsCurrent?{state:"blocked",label:"Action required"}:{state:"current",label:"Current"}:r>=0&&t<r?c?{state:"complete",label:"Done"}:{state:"blocked",label:"Required"}:r<0&&c?{state:"complete",label:"Done"}:{state:"pending",label:"Next"}}function b(e,t,a){return`<span class="empirical-load-calc__tab-group" role="group" aria-label="${o(e)}">
    <span class="panel-eyebrow">${o(e)}</span>
    ${t.map(([n,i])=>Y(n,i,a)).join("")}
  </span>`}function Y(e,t,a){const n=e===a;return`<button type="button" data-load-calc-tab="${e}" aria-selected="${n}" class="${n?"is-active":""}">${t}</button>`}function ge(e,t,a,n,i=null,s=null){e&&(e.innerHTML=`${ne(t,a,n,i,s)}${re(t,a)}`)}function Ae(e,t,a,n,i,s=null){if(!e)throw new TypeError("Load Calc Topology Fix requires a container.");const r=K(t,a),c=n?.blockingFindings||[],l=n?.reviewFindings||[],d=n?.findings||[],A=d.filter(M=>!T(M)),_=d.filter(T),m=!(t?.status==="READY"&&a?.status==="READY")||r.length>0||c.length>0,h=!m&&(l.length>0||(n?.skippedIssueCount||0)>0),E=m?"BLOCKED":h?"REVIEW_REQUIRED":"READY",y=n?.autoFix?.certifiedExactGapCount||0,C=n?.autoFix?.exactToleranceMm||6,k=h?"Acknowledge review & continue":"Continue to Project Data",w=`<div class="load-calc-error-check__actions">
    ${d.length?'<button type="button" class="button" data-load-calc-tab="3d">Review findings in 3D</button>':""}
    ${m?"":`<button type="button" class="button button--primary" data-load-calc-tab="project-data">${k}</button>`}
  </div>`;e.innerHTML=`<section class="load-calc-error-check load-calc-topology" data-role="load-calc-topology" data-status="${E}">
    <header>
      <div><span class="panel-eyebrow">STEP 2</span><h2>Topology Fix</h2>
        <p>${oe(E,n)}</p></div>
      ${w}
    </header>
    ${q(C,y,i)}
    <div class="load-calc-error-check__summary">
      ${u("Support locations",t?.status||"NOT_AVAILABLE",t?.summary?.physicalLocationCount)}
      ${u("Routes",a?.status||"NOT_AVAILABLE",a?.summary?.routeCount)}
      ${u("Geometry findings",R(A),A.length)}
      ${u("Support semantic reviews",R(_),_.length)}
      ${u("Certified gap auto-fixes",y?"REVIEW_REQUIRED":"READY",y)}
      ${u("Skipped findings",n?.skippedIssueCount?"REVIEW_REQUIRED":"READY",n?.skippedIssueCount||0)}
    </div>
    ${W(r)}
    ${V(d,n,s)}
    ${ie(E,n)}
  </section>`}function u(e,t,a){return`<article data-status="${t==="READY"?"ready":t==="REVIEW_REQUIRED"?"review":"blocked"}"><span>${o(e)}</span><strong>${o(Number.isInteger(a)?a:t)}</strong><small>${o(t)}</small></article>`}function R(e){return e.some(t=>t.disposition==="BLOCK"&&t.reviewDisposition!=="SKIPPED")?"BLOCKED":e.length?"REVIEW_REQUIRED":"READY"}function K(e,t){return[...e?.blockers||[],...t?.blockers||[]]}function W(e){return e.length?`<section class="load-calc-error-check__group"><h3>Load-model blockers</h3>
    <ul class="load-calc-error-check__issues">${e.map(t=>`<li><strong>${o(t.code||"TOPOLOGY_BLOCKED")}</strong><span>${o(t.message||t.path||t.routeId||t.projectDataPath||"Topology evidence is incomplete.")}</span></li>`).join("")}</ul>
  </section>`:""}function q(e,t,a){const n=t>0?`${t} certified source-backed endpoint gap(s) are eligible. Select Prepare auto-fix to create a 3D draft.`:"No certified source-backed endpoint gaps are eligible. Changing the limit does not make other finding types auto-fixable.",i=t>0?`Prepare ${t} certified gap fix candidate(s) in 3D Edit.`:"No certified source-backed endpoint gap is available at the active limit.";return`<section class="load-calc-topology-policy" aria-label="Automatic topology fix policy" data-topology-review-section="geometry-autofix">
    <div><strong>Automatic gap fix</strong><span>Geometry only. Set the limit first, then prepare an eligible certified 3D draft.</span></div>
    <label>Fix gaps strictly below
      <input type="number" min="0.1" max="6" step="0.1" value="${o(e)}" data-load-calc-topology-gap-mm aria-label="Automatic gap fix tolerance in millimetres">
      mm
    </label>
    <button type="button" class="button" data-load-calc-topology-gap-apply>Set limit</button>
    <button type="button" class="button button--primary" data-load-calc-topology-autofix
      ${t>0?"":"disabled"} title="${o(i)}">Prepare auto-fix (${o(t)})</button>
    <output class="load-calc-topology-policy__status" data-load-calc-topology-policy-status aria-live="polite">${o(a||n)}</output>
    <small>Maximum setting: 6 mm. Gaps equal to the limit are excluded. Explicit Commit draft remains required. Support-semantic reviews are never made auto-fixable by changing this limit.</small>
  </section>`}function V(e,t,a){if(!e.length)return"";const n=e.filter(s=>!T(s)),i=e.filter(T);return`<div class="load-calc-topology-review-sections">
    ${O({title:"Geometry & gap findings",description:"Geometric findings are reviewed here. Only certified source-backed positive SNAP_GAP findings below the active limit can enter AutoFix.",findings:n,topologyCheck:t,sectionId:"geometry",skipError:a})}
    ${O({title:"Support semantics — engineering review",description:"These are source/classification questions. Gap tolerance and AutoFix do not apply to this section; resolve them only from source or approved master evidence.",findings:i,topologyCheck:t,sectionId:"support-semantics",skipError:a})}
    <button type="button" class="button" data-load-calc-topology-review-download>Download review record</button>
  </div>`}function O({title:e,description:t,findings:a,topologyCheck:n,sectionId:i,skipError:s}){if(!a.length)return"";const r=new Set(n?.autoFix?.exactGapIssueIds||[]),c=X(a);return`<section class="load-calc-error-check__group" data-topology-review-section="${o(i)}"><h3>${o(e)}</h3>
    <p>${o(t)} ${a.length} finding(s) grouped into ${c.length} similar type(s).</p>
    <div class="load-calc-topology-groups">${c.map(l=>Z(l,r,s)).join("")}</div>
  </section>`}function T(e){return e?.reviewCategory==="SUPPORT_SEMANTICS"||e?.kind==="UNKNOWN_RESTRAINT_FAMILY"}function X(e){return[...e.reduce((a,n)=>{const i=`${n.severity}:${n.kind}`;return a.has(i)||a.set(i,[]),a.get(i).push(n),a},new Map).entries()].map(([a,n])=>({key:a,rows:n})).sort((a,n)=>a.key.localeCompare(n.key))}function Z(e,t,a){const n=e.rows[0],i=e.rows.filter(l=>l.reviewDisposition!=="SKIPPED").length,s=e.rows.filter(l=>l.disposition==="BLOCK"&&l.reviewDisposition!=="SKIPPED").length,r=e.rows.filter(l=>l.reviewDisposition==="SKIPPED").length;return`<details class="load-calc-topology-group" data-status="${s>0?"blocked":i>0||r>0?"review":"ready"}"${i>0?" open":""}>
    <summary><strong>${o(`${n.severity} ${n.kind}`)}</strong><span>${e.rows.length} finding(s) · ${i} open${r?` · ${r} skipped`:""}</span></summary>
    <ul class="load-calc-error-check__issues">${e.rows.map(l=>ee(l,t.has(l.id),a)).join("")}</ul>
  </details>`}const J=Object.freeze({REVIEW_CERTIFIED_GAP_FIX:{summary:"Two pipe ends are slightly apart. Use the certified auto-fix if one is available, or review it manually.",fix:"If a certified auto-fix is listed above, apply it. Otherwise, correct the pipe endpoints in the source model so they meet within the gap tolerance, then re-import the dataset."},CLASSIFY_RESTRAINT_FAMILY:{summary:"This support's type (guide, spring, hanger, anchor, etc.) isn't stated in the source data, so it needs to be classified before it can be used in the load calculation.",fix:"Edit this support in the source model so one of its fields (Support Type, Support Kind, MDSSUPPTYPE, or CMPSUPTYPE) clearly states its type — e.g. Guide, Anchor, Spring, Hanger, Line Stop, or Rest — then re-import. If you already know the correct type from engineering judgment or approved master data, use Skip below to record that decision and continue."},ENGINEERING_REVIEW:{summary:"This needs an engineer to look at it.",fix:"Have an engineer review this finding. If it is acceptable as-is, use Skip below to record the decision and continue."}});function S(e){return J[e.userAction]||{summary:e.disposition==="BLOCK"?"This must be resolved before you can continue.":"This needs review, but it will not stop you from continuing.",fix:e.disposition==="BLOCK"?"Resolve the underlying issue in the source model, then re-import the dataset.":"Review the finding. If it is acceptable as-is, use Skip below to record the decision and continue."}}function Q(e){const{summary:t}=S(e),a=e.disposition==="BLOCK"?"Blocks progress until it is resolved.":"Does not block progress, but is kept in the review record.";return`${t} ${a}`}function ee(e,t,a){const n=ae(e),i=t?`Auto-fix candidate at ${Number(e.distanceMm).toFixed(3)} mm`:e.kind==="SNAP_GAP"?"No certified gap fix below the current limit":e.kind==="UNKNOWN_RESTRAINT_FAMILY"?"Source or approved master classification required; the gap limit does not apply":"Engineering review required; the gap limit does not apply",s=e.reviewDisposition==="SKIPPED"?`SKIPPED · ${e.skipReason} · receipt ${e.skipReceiptId}`:`${e.disposition} · ${i}`,r=e.sourceLabel?`<small class="load-calc-topology-source-label">Source evidence: ${o(e.sourceLabel)}</small>`:"",c=e.reviewDisposition==="SKIPPED"?"":`<p class="load-calc-topology-possible-fix"><strong>Possible fix:</strong> ${o(S(e).fix)}</p>`;return`<li data-topology-finding-id="${o(e.id)}">
    <span><strong>${o(n)}</strong>${r}<p class="load-calc-topology-plain-summary">${o(Q(e))}</p>${c}<small class="load-calc-topology-technical-detail">${o(e.message)}</small><small>${o(s)}</small></span>
    ${te(e,t,a)}
  </li>`}function te(e,t,a){if(!["BLOCK","REVIEW"].includes(e.disposition)||e.id.startsWith("system:"))return"";if(e.reviewDisposition==="SKIPPED"){const i=e.disposition==="BLOCK"?"Restore blocker":"Restore for review";return`<button type="button" class="button" data-load-calc-topology-restore="${o(e.id)}">${i}</button>`}return t?'<span class="load-calc-topology-fix-label">Use certified AutoFix above</span>':`<div class="load-calc-topology-skip">
    ${a&&a.findingId===e.id?`<p class="load-calc-topology-skip-error" role="alert">${o(a.message)}</p>`:""}
    <select data-load-calc-topology-skip-reason aria-label="Reason for skipping this finding">
      <option value="">Pick a reason first (required)…</option>
      <option value="CONFIRMED_VALID_SOURCE_GEOMETRY">Confirmed valid source geometry</option>
      <option value="INTENTIONAL_INDEPENDENT_SYSTEM">Intentional independent system</option>
      <option value="KNOWN_SOURCE_DATA_LIMITATION">Known source-data limitation</option>
      <option value="ACCEPTED_FOR_CURRENT_CALCULATION">Accepted for current calculation</option>
      <option value="CONFIRMED_BY_ENGINEER_OUTSIDE_TOOL">Confirmed by engineer using source or approved master data</option>
    </select>
    <button type="button" class="button" data-load-calc-topology-skip="${o(e.id)}">Skip</button>
  </div>`}function ae(e){const t=e.sourceScope?.branchIds||[],a=e.sourceScope?.lineKeys||[];return t.length?`Branch ${t.join(", ")}`:a.length?`Line ${a.join(", ")}`:"Model scope"}function oe(e,t){const a=t?.skippedIssueCount||0,n=a?` ${a} finding(s) have been marked as reviewed and skipped.`:"";if(e==="BLOCKED"){const i=t?.blockingIssueCount||0;return`${i} issue${i===1?"":"s"} must be fixed before you can continue.${n}`}if(e==="REVIEW_REQUIRED"){const i=t?.reviewIssueCount||0;return`${i>0?`${i} item${i===1?"":"s"} need review, but you can continue for now.`:"You can continue for now."}${n}`}return"No issues found. You can continue to the next step."}function ie(e,t){if(e==="BLOCKED"){const a=t?.autoFix?.certifiedExactGapCount||0,n=t?.autoFix?.exactToleranceMm||6,i=a?` ${a} source-backed gap fix(es) strictly below ${o(n)} mm can be prepared automatically.`:" No source-backed automatic fix is available for the current findings.";return`<p class="load-calc-error-check__blocked-plain">Some findings must be resolved before you can continue.${a?" You can use the certified auto-fix below to resolve some of them automatically.":" None of them can be fixed automatically, so they need manual attention."}</p><p class="load-calc-error-check__blocked">Topology is blocked. Resolve HIGH findings and load-model prerequisites before continuing.${i}</p>`}if(e==="REVIEW_REQUIRED"){const a=t?.reviewIssueCount||0,n=Object.entries(t?.countsByKind||{}).filter(([,r])=>Number(r)>0).sort(([r],[c])=>r.localeCompare(c)).map(([r,c])=>`${c} ${r}`).join(", "),i=t?.autoFix?.exactToleranceMm||6,s=n?` (${o(n)})`:"";return`<p class="load-calc-error-check__review-plain">These findings only need a review — they will not stop you from continuing. The tool cannot fix them automatically (the ${o(i)} mm gap limit does not apply to them), so each one is either corrected in the source data or signed off by you. To sign one off, open a finding below, pick a reason and press "Skip". To move on without deciding yet, press "Acknowledge review &amp; continue".</p><details class="load-calc-error-check__review-detail"><summary>Why these are flagged (technical)</summary><p class="load-calc-error-check__review">Review required: ${a} unresolved topology finding(s)${s}; ${t?.skippedIssueCount||0} recorded skip(s). Geometry findings remain governed by source-backed TopoFix policy. Support-semantic reviews require source or approved-master evidence and are never made repairable by changing the ${o(i)} mm gap limit. TopoFix only prepares certified positive SNAP_GAP merges strictly below that limit and never joins separate routes by inference.</p></details>`}return'<p class="load-calc-error-check__passed">Topology check passed. Continue to the next step.</p>'}function ne(e,t,a,n,i){const s=t?.status||"NOT_AVAILABLE",r=a?.status||"NOT_AVAILABLE",c=e?.status||"NOT_CALCULATED";return`<section class="load-contract-summary"><h2>Calculation authority</h2>
    <dl><dt>Support sites</dt><dd>${o(s)}</dd><dt>Route partitions</dt><dd>${o(r)}</dd><dt>Distribution</dt><dd>${o(c)}</dd><dt>Authorization</dt><dd>${o(i?.state||"NOT_CONFIGURED")}</dd><dt>Authorization freshness</dt><dd>${o(i?.authorizationFreshness||"NOT_APPLICABLE")}</dd><dt>Execution freshness</dt><dd>${o(i?.executionFreshness||"NOT_APPLICABLE")}</dd></dl>
    ${se(n,e,i)}
    ${L(e?.blockers||[...t?.blockers||[],...a?.blockers||[]])}
  </section>`}function se(e,t,a){if(!e){const n=a?.packageSemanticHash?"AUTHORIZED_HANDOFF_NOT_EXECUTED":t?"UNAUTHORIZED_LEGACY_RESULT":"NOT_CALCULATED";return`<p data-empirical-authority="${n}">Authority: ${n}. ${o(le(a))}</p>${v(a)}`}return`<details open data-empirical-authority="AUTHORIZED_HANDOFF">
    <summary>Authorized execution receipt: ${o(e.executionId)}</summary>
    <dl>
      <dt>Authorization state</dt><dd>${o(a?.state||"UNKNOWN")}</dd>
      <dt>Freshness</dt><dd>${o(t?.freshness?.status||"UNKNOWN")}</dd>
      <dt>Status</dt><dd>${o(e.status)}</dd>
      <dt>Executed</dt><dd>${o(e.executedAt)}</dd>
      <dt>Project</dt><dd>${o(e.projectId)}</dd>
      <dt>Baseline</dt><dd><code>${o(e.baselineSemanticHash)}</code></dd>
      <dt>Handoff</dt><dd><code>${o(e.handoffSemanticHash)}</code></dd>
      <dt>Projection</dt><dd><code>${o(e.projectionPayloadSemanticHash)}</code></dd>
      <dt>Input</dt><dd><code>${o(e.authorizedInputSemanticHash)}</code></dd>
      <dt>Distribution</dt><dd><code>${o(e.distributionSemanticHash)}</code></dd>
      <dt>Receipt</dt><dd><code>${o(e.semanticHash)}</code></dd>
    </dl>
    ${v(a)}
  </details>`}function v(e){if(!e)return"";const t=e.details?.length?`<pre>${o(JSON.stringify(e.details,null,2))}</pre>`:"";return`<details ${e.calculationEligible?"":"open"} class="empirical-authorization-state"><summary>${o(e.state)}${e.reasonCode?` — ${o(e.reasonCode)}`:""}</summary>${t}</details>`}function re(e,t){if(!e?.loadCases?.length)return'<p class="panel-empty">A current authorized empirical package is required before calculation.</p>';const a=new Map((t?.sites||[]).map(i=>[i.siteId,i.primaryEntityId])),n=e.freshness?.status==="CURRENT";return e.loadCases.map(i=>{const s=n&&$(i.status);return`<section class="load-case-evidence" data-load-case-status="${o(i.status)}">
    <h2>${o(i.loadCaseId)} <span>${o(i.status)}${n?"":" / STALE"}</span></h2>
    ${ce(i.completenessAudit,i.status,n)}
    ${L(i.blockers)}
    <table><thead><tr><th>Support site</th><th>Status</th><th>Vertical force (N, source Z-up)</th><th>Transfer moment demand (N·mm)</th><th>Contributors</th></tr></thead>
    <tbody>${i.supportResults.map(r=>`<tr><td><button type="button" data-load-support-entity-id="${o(a.get(r.supportSiteId)||"")}">${o(r.supportSiteId)}</button></td><td>${o(r.status)}${n?"":" / STALE"}</td><td>${de(r.verticalForceN,s&&$(r.status))}</td><td>${ue(r.cantileverMomentDemandNmm,s&&$(r.status))}</td><td>${p(r.contributorIds?.length)}</td></tr>`).join("")}</tbody></table>
    <details ${i.status==="CALCULATED_WITH_EXCEPTIONS"?"open":""}><summary>Exceptions (${p(i.exceptionLedger?.length)})</summary><pre>${o(JSON.stringify(i.exceptionLedger||[],null,2))}</pre></details>
    <details><summary>Contribution ledger (${p(i.contributionLedger?.length)})</summary><pre>${o(JSON.stringify(i.contributionLedger||[],null,2))}</pre></details>
    <details><summary>Excluded inputs (${p(i.excludedInputs?.length)})</summary><pre>${o(JSON.stringify(i.excludedInputs||[],null,2))}</pre></details>
    <details><summary>Equilibrium / route closure</summary><pre>${o(JSON.stringify(i.equilibrium||null,null,2))}</pre></details>
  </section>`}).join("")}function ce(e,t,a){return e?`<section class="load-case-completeness" data-completeness-state="${t==="CALCULATED_WITH_EXCEPTIONS"?"exceptions":t==="CALCULATED"?"complete":"failed"}">
    <strong>${a?"Current result":"Historical result"} · ${o(t)}</strong>
    <dl>
      <dt>Evaluated force</dt><dd>${g(e.evaluatedForceN,"N")}</dd>
      <dt>Allocated force</dt><dd>${g(e.allocatedForceN,"N")}</dd>
      <dt>Unallocated force</dt><dd>${g(e.unallocatedForceN,"N")}</dd>
      <dt>Coverage</dt><dd>${pe(e.coverageRatio)}</dd>
      <dt>Boundary-transfer moment</dt><dd>${g(e.boundaryTransferMomentNmm,"N·mm")}</dd>
      <dt>Unallocated first moment</dt><dd>${g(e.unallocatedFirstMomentNmm,"N·mm")}</dd>
      <dt>Exceptions</dt><dd>${p(e.exceptionCount)}</dd>
      <dt>Excluded inputs</dt><dd>${p(e.excludedContributionCount)}</dd>
    </dl>
  </section>`:""}function L(e){return e?.length?`<details open class="load-blockers"><summary>Blocking failures (${e.length})</summary><ul>${e.map(t=>`<li><strong>${o(t.code||"BLOCKED")}</strong> ${o(t.path||t.routeId||"")} ${o(t.message||"")}</li>`).join("")}</ul></details>`:""}function le(e){if(!e)return"Authorized empirical package is not configured.";const t={NO_ACTIVE_DATASET:"An active normalized dataset is required.",EMPIRICAL_PACKAGE_REQUIRED:"An explicitly authorized empirical package is required.",AUTHORIZATION_BINDINGS_CHANGED:"The retained authorization is stale against current mechanical or authority inputs.",PROJECT_DATA_CHANGED:"Project Data changed after authorization.",MASTER_DATA_CHANGED:"Master data changed after authorization.",DATASET_EDITED:"The active dataset changed after authorization.",DATASET_REBUILT:"The active dataset model was rebuilt after authorization.",DATASET_REPLACED:"A different dataset is active."};return t[e.reasonCode]?t[e.reasonCode]:e.state==="NOT_CONFIGURED"||e.state==="AWAITING_AUTHORIZATION"?"An explicitly authorized empirical package is required.":e.state==="BLOCKED_NOT_READY"?"The current empirical inputs are not readiness-qualified.":e.state==="AUTHORIZED_STALE"||e.state==="EXECUTED_STALE"?"The retained authorized empirical evidence is stale.":e.calculationEligible===!0?"Authorized empirical calculation is available.":"Authorized empirical calculation is disabled."}function $(e){return e==="CALCULATED"||e==="CALCULATED_WITH_EXCEPTIONS"}function de(e,t){return t?Number.isFinite(e)?e.toFixed(3):"—":Number.isFinite(e)?`${e.toFixed(3)} (HISTORICAL)`:"FAILED"}function ue(e,t){return t?Number.isFinite(e)?e.toFixed(3):"—":Number.isFinite(e)?`${e.toFixed(3)} (HISTORICAL)`:"—"}function g(e,t){return Number.isFinite(e)?`${e.toFixed(3)} ${t}`:"—"}function pe(e){return Number.isFinite(e)?`${(e*100).toFixed(1)} %`:"—"}function p(e){return Number.isInteger(e)?String(e):"—"}function o(e){return String(e??"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t])}export{me as T,ge as a,Ae as b,Ee as c,fe as d,be as r};
