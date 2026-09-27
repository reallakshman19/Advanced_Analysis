import{d as A}from"./engineering-loads-beam-contact-runtime-8kaGjG8C.js";import{d as $,s as x}from"./core-application-BwujTsgG.js";import"./empirical-engineering-authority-DxrUzpd3.js";import"./core-linear-fea-EDVTdPhM.js";import"./core-local-stress-CleCuBLX.js";import"./core-attachment-screening-Fj-arh5v.js";import"./core-fea-benchmarks-CuwNvj2Y.js";import"./core-element-fea-BL3sWl6c.js";import"./runtime-B88We3ra.js";const O="non-fea-3d-investigation-projection/v1";function R(t={}){const e=t.snapshot||{},n=t.proposal||null,i=t.execution||null,s=Array.isArray(n?.adaptedRequest?.restraintOccurrences)?n.adaptedRequest.restraintOccurrences:[],r=[],u=M(s,d=>c(d?.restraintId)),g=k(i),l=s.filter(d=>{const p=c(d?.restraintId);return p?(u.get(p)||0)!==1?(r.push(I("RESTRAINT_ID_AMBIGUOUS",`Restraint ${p} occurs more than once; no result-to-entity navigation target is selected.`,p)),!1):!0:(r.push(I("RESTRAINT_ID_REQUIRED","A restraint occurrence without exact restraintId cannot participate in 3D investigation.")),!1)}).map(d=>D(d,g,r)).sort((d,p)=>y(d.restraintId,p.restraintId));for(const d of g.keys())u.has(d)||r.push(I("RESULT_RESTRAINT_ID_NOT_BOUND",`Result restraint ${d} has no exact current restraint occurrence binding.`,d));const m=P(r).sort((d,p)=>y(`${d.code}|${d.restraintId||""}|${d.message}`,`${p.code}|${p.restraintId||""}|${p.message}`)),_=l.filter(d=>d.navigationEntityId).length,N={schema:O,state:l.length===0?m.length?"BLOCKED":"EMPTY":m.length?"PARTIALLY_READY":"READY",executionCurrentness:H(e,i),scenarioId:c(n?.scenarioId)||null,methodId:c(n?.method)||c(i?.method)||null,executionId:c(i?.executionId)||null,executionSemanticHash:c(i?.semanticHash)||null,resultSemanticHash:c(i?.coreResult?.semanticHash)||null,rows:l,blockers:m,summary:{restraintOccurrenceCount:s.length,investigationRowCount:l.length,navigableCount:_,resultBoundCount:l.filter(d=>d.resultRefs.length>0).length,blockerCount:m.length},policy:{readOnly:!0,exactIdentityOnly:!0,coordinateMatchingPermitted:!1,geometryMutationPermitted:!1,resultSchemaTranslationPermitted:!1,resultInterpretationAuthority:!1,calculationAuthority:!1,authorizationAuthority:!1,executionAuthority:!1}};return $({...N,semanticHash:x(N)})}function D(t,e,n){const i=c(t.restraintId),s=L(t);return s.entityId||n.push(I(s.code,s.message,i)),$({supportSiteId:c(t.supportSiteId)||null,restraintId:i,navigationEntityId:s.entityId,navigationBasis:s.basis,sourceDirection:c(t.sourceDirection)||null,effectiveDirection:c(t.effectiveDirection)||null,resultRefs:$([...e.get(i)||[]])})}function L(t){const e=j(t?.sourceEntityIds);if(e.length===1)return{entityId:e[0],basis:"EXACT_SOURCE_ENTITY_ID"};const n=c(t?.hostSourceEntityId);if(n)return{entityId:n,basis:"EXACT_HOST_SOURCE_ENTITY_ID"};const i=c(t?.hostEntityId);return i?{entityId:i,basis:"EXACT_HOST_ENTITY_ID"}:e.length>1?{entityId:null,basis:null,code:"NAVIGATION_ENTITY_ID_AMBIGUOUS",message:`Restraint ${c(t?.restraintId)||"UNKNOWN"} has multiple exact source entity IDs and no explicit host identity.`}:{entityId:null,basis:null,code:"NAVIGATION_ENTITY_ID_REQUIRED",message:`Restraint ${c(t?.restraintId)||"UNKNOWN"} has no exact workspace entity identity for 3D navigation.`}}function k(t){const e=new Map;for(const n of t?.coreResult?.loadCases||[]){const i=c(n?.loadCaseId);for(const s of n?.supportResults||[]){const r=c(s?.restraintId);if(!r)continue;const u=e.get(r)||[];u.push($({loadCaseId:i||null,loadCaseStatus:c(n?.status)||null,contactState:c(s?.contactState)||null})),e.set(r,u)}}for(const[n,i]of e)e.set(n,$(i.sort((s,r)=>y(`${s.loadCaseId}|${s.contactState}`,`${r.loadCaseId}|${r.contactState}`))));return e}function H(t,e){return e?t?.state==="EXECUTED_CURRENT"?"CURRENT":t?.state==="EXECUTED_STALE"?"STALE":"HISTORICAL_NOT_CURRENT":"NOT_AVAILABLE"}function M(t,e){const n=new Map;return t.forEach(i=>{const s=e(i);s&&n.set(s,(n.get(s)||0)+1)}),n}function I(t,e,n=null){return $({code:t,message:e,restraintId:n})}function P(t){const e=new Set;return t.filter(n=>{const i=`${n.code}|${n.restraintId||""}|${n.message}`;return e.has(i)?!1:(e.add(i),!0)})}function j(t){return Array.isArray(t)?[...new Set(t.map(c).filter(Boolean))].sort(y):[]}function c(t){return typeof t=="string"?t.trim():""}function y(t,e){return t<e?-1:t>e?1:0}function rt(t,e){if(!t)return;const{snapshot:n,proposal:i}=f(e);t.innerHTML=`
    <section class="engineering-card" data-empirical-scenario-overview>
      <div class="engineering-card__header">
        <div>
          <p class="eyebrow">Method-bound scenario</p>
          <h3>Empirical calculation overview</h3>
        </div>
        ${S(n.state)}
      </div>
      ${i?U(n,i):b("No empirical scenario is configured.","Supply the normalized SJSON adapter request, locked runtime profile and exact source authorities before authorization.")}
    </section>
  `}function ot(t,e){if(!t)return;const{proposal:n,selectedEntityId:i}=f(e),s=n?.adaptedRequest?.restraintOccurrences||[];t.innerHTML=`
    <section class="engineering-card" data-empirical-scenario-restraints>
      <div class="engineering-card__header">
        <div><p class="eyebrow">Source and effective custody</p><h3>Restraints</h3></div>
        <span class="status-badge">${s.length} occurrences</span>
      </div>
      ${s.length?`
        <div class="table-scroll">
          <table class="engineering-table">
            <thead><tr>
              <th>Support site</th><th>Restraint</th><th>Source</th><th>Effective</th>
              <th>Host</th><th>Gap</th><th>Stiffness</th><th>Override</th><th>Geometry</th>
            </tr></thead>
            <tbody>${s.map(r=>F(r,i)).join("")}</tbody>
          </table>
        </div>
      `:b("No restraint occurrences are available.","Configure an empirical scenario to inspect stable source/effective restraint identity.")}
    </section>
  `}function ct(t,e){if(!t)return;const{proposal:n}=f(e),i=new Map((n?.caseConfigurations||[]).map(r=>[r.loadCaseId,r])),s=n?.adaptedRequest?.loadCases||[];t.innerHTML=`
    <section class="engineering-card" data-empirical-scenario-load-cases>
      <div class="engineering-card__header">
        <div><p class="eyebrow">Explicit ownership</p><h3>Load cases</h3></div>
        <span class="status-badge">${s.length} cases</span>
      </div>
      ${s.length?`
        <div class="table-scroll"><table class="engineering-table">
          <thead><tr><th>Case</th><th>Result class</th><th>Weight</th><th>Thermal</th>
          <th>Pressure compatibility</th><th>Pressure stress</th><th>Configuration</th></tr></thead>
          <tbody>${s.map(r=>B(r,i.get(r.loadCaseId))).join("")}</tbody>
        </table></div>
        ${X(n.adaptedRequest.combinationPolicy)}
      `:b("No empirical load cases are configured.","Load ownership must be explicit before authorization.")}
    </section>
  `}function dt(t,e){if(!t)return;const{snapshot:n,proposal:i}=f(e);t.innerHTML=`
    <section class="engineering-card" data-empirical-scenario-methods>
      <div class="engineering-card__header">
        <div><p class="eyebrow">Runtime registry</p><h3>Methods and profile authority</h3></div>
        ${S(n.state)}
      </div>
      <div class="method-card-grid">
        ${A.methods.map(s=>z(s,n.method)).join("")}
      </div>
      ${i?q(n,i.runtimeProfile):b("No runtime profile is bound.","Qualified profiles are locked. Editing begins by cloning to a new unqualified version.")}
      <div class="engineering-actions" data-empirical-scenario-actions>
        <button type="button" class="button button--secondary" data-empirical-clone-profile
          ${i?"":"disabled"}>Clone profile</button>
        <button type="button" class="button button--secondary" data-empirical-authorize
          ${n.state==="DRAFT_READY"?"":"disabled"}>Authorize scenario</button>
        <button type="button" class="button button--primary" data-empirical-calculate
          title="Execute the explicitly configured empirical scenario method. The header gravity action uses its separate authorization state."
          ${n.calculationEligible?"":"disabled"}>Calculate — Configured Scenario</button>
      </div>
    </section>
  `}function lt(t,e){if(!t)return;const n=f(e),{execution:i,snapshot:s,selectedEntityId:r}=n,u=i?.coreResult||null,g=u?.loadCases||[],l=R(n);t.innerHTML=`
    <section class="engineering-card" data-empirical-scenario-results>
      <div class="engineering-card__header">
        <div><p class="eyebrow">Separate result family</p><h3>Beam/contact results</h3></div>
        ${S(u?.status||s.state)}
      </div>
      <p class="engineering-note">Result values remain method-owned. “Inspect 3D” uses only exact restraint-to-workspace identity and does not reinterpret reactions or make stale results current.</p>
      ${g.length?g.map(m=>Y(m,l,r)).join(""):b("No current empirical execution is available.","Authorization and calculation are separate explicit actions. Stale results are not presented as current.")}
    </section>
  `}function ut(t,e){if(!t)return;const{snapshot:n,proposal:i,authorization:s,execution:r,overlaySnapshot:u}=f(e),g={snapshot:n,proposal:i?{method:i.method,scenarioId:i.scenarioId,semanticHash:i.semanticHash,bindings:i.bindings,blockerCount:i.blockers.length,overrideJournal:i.overrideJournal}:null,authorization:s,resultOverlay:u,execution:r?{method:r.method,executionId:r.executionId,executedAt:r.executedAt,semanticHash:r.semanticHash,sourceLoadPrimitiveSetSemanticHash:r.sourceLoadPrimitiveSetSemanticHash,adaptedLoadPrimitiveSetSemanticHash:r.adaptedLoadPrimitiveSetSemanticHash,coreResultSemanticHash:r.coreResult.semanticHash}:null};t.innerHTML=`
    <section class="engineering-card" data-empirical-scenario-evidence>
      <div class="engineering-card__header">
        <div><p class="eyebrow">Immutable trace</p><h3>Empirical evidence</h3></div>
        ${S(n.state)}
      </div>
      <pre class="json-trace"><code>${a(JSON.stringify(g,null,2))}</code></pre>
    </section>
  `}function ht(t,e){if(!t)return;const n=R(f(e));t.innerHTML=`
    <section class="engineering-card" data-empirical-scenario-model-3d data-investigation-state="${a(n.state)}" data-investigation-semantic-hash="${a(n.semanticHash)}">
      <div class="engineering-card__header">
        <div><p class="eyebrow">Read-only 3D investigation</p><h3>Model / 3D</h3></div>
        <span class="status-badge">${n.summary.navigableCount}/${n.summary.investigationRowCount} exact targets</span>
      </div>
      <p class="engineering-note">The shared SJSON renderer displays governed geometry evidence but is not engineering, calculation or result authority. Navigation uses exact workspace identity only; no coordinate/proximity matching or topology repair is performed.</p>
      <dl class="engineering-fact-grid">
        ${o("Projection",n.schema)}
        ${o("Result currentness",n.executionCurrentness)}
        ${o("Execution",n.executionId||"NOT_AVAILABLE")}
        ${o("Execution hash",n.executionSemanticHash||"NOT_AVAILABLE")}
        ${o("Result hash",n.resultSemanticHash||"NOT_AVAILABLE")}
        ${o("Blockers",n.summary.blockerCount)}
      </dl>
      ${n.rows.length?G(n):b("No exact 3D investigation rows are available.","Configure a scenario with exact restraint occurrence identity before cross-navigation.")}
      ${n.blockers.length?E(n.blockers):""}
      <div class="engineering-actions">
        <button type="button" class="button button--secondary" data-empirical-open-sjson-viewport>Open shared governed SJSON viewport</button>
      </div>
    </section>
  `}function U(t,e){const n=e.adaptedRequest;return`
    <dl class="engineering-fact-grid">
      ${o("Dataset",n.datasetId)}
      ${o("Scenario",n.scenarioId)}
      ${o("Method",n.method)}
      ${o("Coordinate basis",n.coordinateFrame.sourceBasis)}
      ${o("Vertical vector",K(n.coordinateFrame.verticalUnitVector))}
      ${o("Force convention",n.coordinateFrame.forceOutputConvention)}
      ${o("Profile",`${e.runtimeProfile.profileId} v${e.runtimeProfile.profileVersion}`)}
      ${o("Qualification",e.runtimeProfile.qualification)}
      ${o("Locked",e.runtimeProfile.locked?"Yes":"No")}
      ${o("Authorization state",t.state)}
      ${o("Overrides",e.overrideJournal.length)}
      ${o("Blockers",e.blockers.length)}
    </dl>
    ${e.blockers.length?E(e.blockers):'<p class="engineering-success">Scenario is ready for explicit authorization.</p>'}
  `}function F(t,e){const n=T(t,e);return`<tr data-restraint-id="${a(t.restraintId)}" data-support-site-id="${a(t.supportSiteId)}" data-viewport-selected="${n}"${n?' class="engineering-table__row--selected"':""}>
    <td>${a(t.supportSiteId)}</td>
    <td><button type="button" class="table-link" data-empirical-restraint-select="${a(t.restraintId)}">${a(t.restraintId)}</button></td>
    <td>${a(t.sourceDirection||"—")}</td>
    <td>${a(t.effectiveDirection||"—")}</td>
    <td>${a(t.hostEntityId||"—")}</td>
    <td>${C(t.effectiveCapability?.gapMm," mm")}</td>
    <td>${C(t.effectiveCapability?.stiffnessNPerM," N/m")}</td>
    <td>${t.overrideId?`${a(t.overrideId)}<br><small>${a(t.overrideReason||"")}</small>`:"None"}</td>
    <td>${t.geometryChanged?"<strong>Changed</strong>":"No"}</td>
  </tr>`}function B(t,e){return`<tr>
    <td><strong>${a(t.loadCaseId)}</strong><br><small>${a(t.label)}</small></td>
    <td>${a(t.resultClass)}</td>
    <td>${v(t.effects.weight)}</td>
    <td>${v(t.effects.thermalStrain)}</td>
    <td>${v(t.effects.pressureCompatibility)}</td>
    <td>${v(t.effects.pressureStress)}</td>
    <td>${e?a(Q(e)):"Missing"}</td>
  </tr>`}function z(t,e){const n=t.methodId===e;return`<article class="method-card${n?" method-card--selected":""}" data-method-id="${a(t.methodId)}">
    <div class="method-card__header"><strong>${a(t.methodId)}</strong>${n?'<span class="status-badge">Selected</span>':""}</div>
    <p>${a(t.purpose)}</p>
    <dl>${o("Runtime",t.runtimeStatus)}${o("Qualification",t.qualificationStatus)}${o("DOFs",t.qualifiedDofs.join(", "))}</dl>
  </article>`}function q(t,e){return`<div class="engineering-subcard" data-empirical-profile>
    <h4>Profile</h4>
    <dl class="engineering-fact-grid">
      ${o("Identity",e.profileId)}
      ${o("Version",e.profileVersion)}
      ${o("Qualification",e.qualification)}
      ${o("Locked",e.locked?"Yes":"No")}
      ${o("Semantic hash",e.semanticHash)}
      ${o("Scenario state",t.state)}
    </dl>
    <p class="engineering-note">A locked qualified profile is read-only. Cloning creates a new unlocked, unqualified version and does not change the authorized scenario.</p>
  </div>`}function Y(t,e,n){if(t.status==="BLOCKED")return`<article class="engineering-subcard"><h4>${a(t.loadCaseId)} — blocked</h4>${E(t.blockers||[])}</article>`;const i=(t.supportResults||[]).some(s=>s.anchorDecomposition);return`<article class="engineering-subcard" data-result-load-case="${a(t.loadCaseId)}">
    <div class="engineering-card__header"><h4>${a(t.loadCaseId)}</h4><span class="status-badge">${a(t.status)}</span></div>
    <div class="table-scroll"><table class="engineering-table">
      <thead><tr><th>Support</th><th>Restraint</th><th>State</th><th>FX</th><th>FY</th><th>FZ</th><th>MX</th><th>MY</th><th>MZ</th><th class="proj-loads-header" title="Projected load on restraint basis — vertical axis">Fv (N)</th><th class="proj-loads-header" title="Projected load on restraint basis — guide axis">Fl·Guide (N)</th><th class="proj-loads-header" title="Projected load on restraint basis — lineStop axis">Fa·LineStop (N)</th><th>3D</th></tr></thead>
      <tbody>${(t.supportResults||[]).map(s=>V(s,e,n)).join("")}</tbody>
    </table></div>
    ${i?'<p class="engineering-note proj-loads-note">Fv = rest axis · Fl = guide axis · Fa = lineStop axis — from anchorDecomposition per restraint basis vectors</p>':""}
  </article>`}function V(t,e,n){const i=T(t,n),s=t.globalReaction?.forceN||{},r=t.globalReaction?.momentNm||{},u=e.rows.find(m=>m.restraintId===t.restraintId),g=u?.navigationEntityId?`<button type="button" class="table-link" data-non-fea-investigation-entity-id="${a(u.navigationEntityId)}">Inspect 3D</button>`:"Unavailable",l=t.anchorDecomposition?.componentsN||null;return`<tr data-result-restraint-id="${a(t.restraintId)}" data-viewport-selected="${i}"${i?' class="engineering-table__row--selected"':""}>
    <td>${a(t.supportSiteId)}</td><td>${a(t.restraintId)}</td>
    <td>${a(t.contactState)}</td>
    <td>${h(s.x)}</td><td>${h(s.y)}</td><td>${h(s.z)}</td>
    <td>${h(r.x)}</td><td>${h(r.y)}</td><td>${h(r.z)}</td>
    <td class="proj-load${l?"":" proj-load--none"}">${l?h(l.rest):"—"}</td>
    <td class="proj-load${l?"":" proj-load--none"}">${l?h(l.guide):"—"}</td>
    <td class="proj-load${l?"":" proj-load--none"}">${l?h(l.lineStop):"—"}</td>
    <td>${g}</td>
  </tr>`}function G(t){return`<div class="table-scroll" data-role="non-fea-3d-investigation"><table class="engineering-table">
    <thead><tr><th>Support site</th><th>Restraint</th><th>Exact workspace target</th><th>Result references</th><th>Currentness</th><th>3D</th></tr></thead>
    <tbody>${t.rows.map(e=>`<tr data-investigation-restraint-id="${a(e.restraintId)}">
      <td>${a(e.supportSiteId||"—")}</td><td>${a(e.restraintId)}</td>
      <td>${a(e.navigationEntityId||"UNAVAILABLE")}<br><small>${a(e.navigationBasis||"NO_EXACT_TARGET")}</small></td>
      <td>${a(J(e.resultRefs))}</td><td>${a(t.executionCurrentness)}</td>
      <td>${e.navigationEntityId?`<button type="button" class="table-link" data-non-fea-investigation-entity-id="${a(e.navigationEntityId)}">Inspect in shared 3D</button>`:"Unavailable"}</td>
    </tr>`).join("")}</tbody>
  </table></div>`}function J(t){return t.length?t.map(e=>`${e.loadCaseId||"UNBOUND"} · ${e.loadCaseStatus||"UNKNOWN"} · ${e.contactState||"UNKNOWN"}`).join("; "):"No method result row"}function f(t){return{snapshot:t?.snapshot||{state:"NOT_CONFIGURED",calculationEligible:!1,method:null},proposal:t?.proposal||null,authorization:t?.authorization||null,execution:t?.execution||null,overlaySnapshot:t?.overlaySnapshot||null,selectedEntityId:t?.selectedEntityId||null}}function T(t,e){return e?t.hostEntityId===e||t.hostSourceEntityId===e||(t.sourceEntityIds||[]).includes(e):!1}function X(t){const e=t==="SEPARATE_UNTIL_QUALIFIED";return`<p class="engineering-note${e?" engineering-note--warning":""}">Combination policy: <strong>${a(t)}</strong>${e?" — vertical and line-stop results must not be vector-combined.":""}</p>`}function E(t){return`<ul class="engineering-blocker-list">${t.map(e=>`<li><strong>${a(e.code)}</strong> — ${a(e.message)} <small>${a(e.scope||"")}</small></li>`).join("")}</ul>`}function b(t,e){return`<div class="empty-state"><strong>${a(t)}</strong><p>${a(e)}</p></div>`}function S(t){return`<span class="status-badge">${a(t||"UNKNOWN")}</span>`}function o(t,e){return`<div><dt>${a(String(t))}</dt><dd>${a(String(e??"—"))}</dd></div>`}function K(t){return Array.isArray(t)?`[${t.map(h).join(", ")}]`:"—"}function Q(t){const e=[];return t.weightPrimitiveCaseId&&e.push(`weight=${t.weightPrimitiveCaseId}`),t.referenceTemperatureC!==null&&e.push(`Tref=${t.referenceTemperatureC}°C`),t.analysisTemperatureC!==null&&e.push(`T=${t.analysisTemperatureC}°C`),e.join(", ")||"No owned effects"}function v(t){return t?"Yes":"No"}function C(t,e){return Number.isFinite(t)?`${h(t)}${e}`:"Rigid / none"}function h(t){return Number.isFinite(t)?Number(t).toLocaleString(void 0,{maximumFractionDigits:3}):"—"}function a(t){return String(t??"").replace(/[&<>'"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[e])}export{ut as renderEmpiricalScenarioEvidence,ct as renderEmpiricalScenarioLoadCases,dt as renderEmpiricalScenarioMethods,ht as renderEmpiricalScenarioModel3d,rt as renderEmpiricalScenarioOverview,ot as renderEmpiricalScenarioRestraints,lt as renderEmpiricalScenarioResults};
