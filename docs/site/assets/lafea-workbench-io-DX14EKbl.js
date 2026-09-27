import{L as l,a as p}from"./application-shell-css-Ci61W-Lx.js";const d=`
.lafea-ui-icon{
  width:16px;
  height:16px;
  flex:0 0 auto;
  color:#9fb8cf;
}
.lafea-workbench{
  gap:10px!important;
  padding:14px 16px 20px!important;
}
.lafea-workbench__header{
  padding:2px 2px 12px;
  border-bottom:1px solid #223247;
}
.lafea-workbench__header h1{
  margin:3px 0 4px!important;
  font-size:22px;
  letter-spacing:-.01em;
}
.lafea-workbench__status{
  border-radius:5px!important;
  padding:5px 8px!important;
  font-size:11px;
  letter-spacing:.025em;
}
[data-lafea-slot="navigation"]{
  min-width:0;
  overflow:hidden;
}
.lafea-workbench__stages{
  display:flex!important;
  flex-wrap:nowrap!important;
  gap:4px!important;
  min-width:0;
  overflow-x:auto;
  padding:2px 0 4px;
  scrollbar-width:thin;
}
.lafea-workbench__stages button{
  flex:0 0 auto;
  min-height:32px;
  padding:6px 9px!important;
  border-radius:4px!important;
  background:#091322!important;
  border-color:#26364d!important;
  color:#9fb0c5!important;
  font-size:11px;
  font-weight:650;
}
.lafea-workbench__stages button[aria-current="step"]{
  border-color:#0284c7!important;
  background:#0b1d2f!important;
  color:#e0f2fe!important;
  box-shadow:inset 0 -2px 0 #38bdf8;
}
[data-lafea-slot="toolbar"]{
  padding:7px 8px;
  border:1px solid #223247;
  border-radius:6px;
  background:#07111c;
}
[data-lafea-slot="toolbar"] .lafea-workbench__toolbar{
  gap:6px!important;
}
[data-lafea-slot="toolbar"] button,
[data-lafea-slot="toolbar"] label,
[data-lafea-slot="toolbar"] input{
  font-size:11px;
}
.lafea-engineering-overview{
  gap:11px!important;
  padding:13px!important;
  border-color:#26384b!important;
  border-radius:8px!important;
  background:#0a1422!important;
  box-shadow:none!important;
}
.lafea-engineering-overview__heading h2{
  font-size:18px!important;
}
.lafea-engineering-overview__card{
  border-radius:6px!important;
  background:#08121f!important;
}
.lafea-guided-shell{
  grid-template-columns:minmax(0,1fr)!important;
  gap:12px!important;
}
.lafea-guided-shell__nav{
  position:sticky!important;
  top:0!important;
  z-index:8;
  max-height:none!important;
  overflow:visible!important;
  display:block!important;
  padding:8px 10px!important;
  border-color:#26364d!important;
  border-radius:8px!important;
  background:#081322!important;
}
.lafea-guided-workflow{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto;
  gap:6px 12px!important;
  align-items:start;
}
.lafea-guided-workflow>h2{display:none}
.lafea-guided-workflow__areas{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:6px!important;
}
.lafea-guided-workflow__areas>li{min-width:0;align-content:start}
.lafea-guided-workflow__area{
  grid-template-columns:18px minmax(0,1fr) auto!important;
  min-height:40px;
  padding:7px 9px!important;
}
.lafea-guided-workflow__icon{
  width:15px;
  height:15px;
  color:#7dd3fc;
}
.lafea-guided-workflow__reasons{
  display:block!important;
  max-width:100%;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.lafea-guided-workflow__technical{
  display:block!important;
}
.lafea-guided-workflow__technical>summary{
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.lafea-guided-workflow__release{
  display:none!important;
}
.lafea-cae-workspace{
  grid-template-columns:minmax(0,1fr) minmax(340px,380px)!important;
  gap:14px!important;
}
.lafea-cae-workspace__viewport-card .lafea-workbench__svg{
  min-height:520px!important;
}
.lafea-button--primary{
  min-height:34px!important;
  border-color:#0284c7!important;
  background:#075985!important;
  color:#e0f2fe!important;
  font-weight:750!important;
}
.lafea-button--primary:hover:not(:disabled){
  border-color:#38bdf8!important;
  background:#0c4a6e!important;
}
.lafea-button--primary:focus-visible{
  outline:2px solid #7dd3fc;
  outline-offset:2px;
}
.lafea-mesh-workspace-summary__state[data-tone="positive"]{color:#86efac}
.lafea-mesh-workspace-summary__state[data-tone="warning"]{color:#fde68a}
.lafea-mesh-workspace-summary__state[data-tone="critical"]{color:#fca5a5}
.lafea-discretization__reason-list{
  display:grid;
  gap:5px;
  margin:0 0 8px;
  padding-left:18px;
  color:#fbbf24;
  font-size:11px;
}
.lafea-discretization__advanced-evidence{
  border-top:1px solid #26364d;
  padding-top:8px;
}
.lafea-discretization__advanced-evidence>summary{
  cursor:pointer;
  color:#9fb8cf;
  font-size:11px;
  font-weight:700;
}
.lafea-discretization__advanced-evidence-body{
  display:grid;
  gap:8px;
  margin-top:8px;
}
.lafea-discretization__advanced-evidence-body>.lafea-discretization__section{
  margin:0;
  background:#07111c;
}
.lafea-numerical-verification{
  display:grid;
  gap:8px;
}
.lafea-numerical-verification__intro{
  margin:0;
  color:#9fb0c5;
  font-size:11px;
}
.lafea-numerical-verification__summary{
  display:grid;
  gap:7px;
}
.lafea-numerical-verification__summary>h3{
  margin:0;
  font-size:13px;
}
.lafea-numerical-verification__summary-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
  gap:6px;
}
.lafea-numerical-verification__summary-item{
  display:grid;
  gap:2px;
  padding:7px 8px;
  border:1px solid #26364d;
  border-radius:5px;
  background:#07111c;
}
.lafea-numerical-verification__summary-item>span{
  color:#9fb0c5;
  font-size:10px;
}
.lafea-numerical-verification__summary-item>strong{
  font-size:12px;
}
.lafea-numerical-verification__summary-item>strong[data-tone="positive"]{color:#86efac}
.lafea-numerical-verification__summary-item>strong[data-tone="warning"]{color:#fde68a}
.lafea-numerical-verification__summary-item>strong[data-tone="critical"]{color:#fca5a5}
.lafea-numerical-verification__evidence{
  border-top:1px solid #26364d;
  padding-top:7px;
}
.lafea-numerical-verification__evidence>summary{
  cursor:pointer;
  color:#9fb8cf;
  font-size:11px;
  font-weight:700;
}
.lafea-numerical-verification__evidence>section{
  margin-top:8px;
}
.lafea-cae-workspace__context{
  display:grid;
  grid-template-columns:minmax(0,1fr);
  gap:16px;
}
.lafea-engineering-evidence-drawer{
  border:1px solid rgba(148,163,184,.22);
  border-radius:8px;
  background:rgba(15,23,42,.58);
  overflow:hidden;
}
.lafea-engineering-evidence-drawer__summary{
  display:grid;
  grid-template-columns:18px minmax(0,1fr) auto;
  align-items:center;
  gap:12px;
  padding:14px 16px;
  cursor:pointer;
  list-style:none;
}
.lafea-engineering-evidence-drawer__summary::-webkit-details-marker{display:none}
.lafea-engineering-evidence-drawer__icon{
  width:16px;
  height:16px;
  color:#7dd3fc;
}
.lafea-engineering-evidence-drawer__heading{
  display:grid;
  gap:2px;
  min-width:0;
}
.lafea-engineering-evidence-drawer__heading strong{font-size:14px}
.lafea-engineering-evidence-drawer__heading span{
  color:#94a3b8;
  font-size:12px;
  line-height:1.35;
}
.lafea-engineering-evidence-drawer__count{
  flex:0 0 auto;
  color:#cbd5e1;
  font-size:12px;
  font-variant-numeric:tabular-nums;
}
.lafea-engineering-evidence-drawer[open]>.lafea-engineering-evidence-drawer__summary{
  border-bottom:1px solid rgba(148,163,184,.18);
}
.lafea-engineering-evidence-drawer__body{
  display:grid;
  gap:12px;
  padding:12px;
}
.lafea-engineering-evidence-drawer__body>.lafea-workbench__card{
  margin:0;
  box-shadow:none;
}
.lafea-next-action-banner[data-intent="model"]{border-left:3px solid #64748b!important}
.lafea-next-action-banner[data-intent="mesh"]{border-left:3px solid #0284c7!important}
.lafea-next-action-banner[data-intent="solve"][data-run-eligible="false"]{border-left:3px solid #d97706!important}
.lafea-next-action-banner[data-intent="solve"][data-run-eligible="true"]{border-left:3px solid #15803d!important}
.lafea-next-action-banner[data-intent="results"]{border-left:3px solid #15803d!important}
.lafea-diagnostics__list{
  display:grid;
  gap:7px;
  margin:8px 0 0;
  padding:0;
  list-style:none;
}
.lafea-diagnostics__item{
  display:grid;
  grid-template-columns:auto minmax(0,1fr);
  gap:4px 8px;
  padding:8px 9px;
  border-left:3px solid #475569;
  background:#0b1628;
}
.lafea-diagnostics__item[data-severity="WARNING"],
.lafea-diagnostics__item[data-severity="WARN"]{border-left-color:#d97706}
.lafea-diagnostics__item[data-severity="ERROR"],
.lafea-diagnostics__item[data-severity="CRITICAL"]{border-left-color:#b91c1c}
.lafea-diagnostics__item>strong{font-size:11px}
.lafea-diagnostics__item>span{font-size:11px;line-height:1.4;color:#cbd5e1}
.lafea-diagnostics__item>code{
  grid-column:2;
  color:#7f91a6;
  font-size:10px;
  overflow-wrap:anywhere;
}
@media (min-width:1180px){
  .lafea-cae-workspace__context{
    grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  }
  .lafea-cae-workspace__context>[data-guided-target="results"],
  .lafea-cae-workspace__context>.lafea-engineering-evidence-drawer{
    grid-column:1/-1;
  }
}
@media (max-width:1100px){
  .lafea-cae-workspace{
    grid-template-columns:minmax(0,1fr)!important;
  }
  .lafea-cae-workspace__inspector{
    position:static!important;
    max-height:none!important;
    overflow:visible!important;
  }
}
@media (max-width:760px){
  .lafea-guided-workflow{
    grid-template-columns:minmax(0,1fr)!important;
  }
  .lafea-guided-workflow__areas{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
  .lafea-cae-workspace__viewport-card .lafea-workbench__svg{
    min-height:360px!important;
  }
}
@media (max-width:520px){
  .lafea-guided-workflow__areas{
    grid-template-columns:minmax(0,1fr);
  }
}
`;function s(){return`
.fea-benchmark{display:grid;gap:12px;padding:14px;border:1px solid var(--workspace-border,#334155);border-radius:8px;background:var(--workspace-panel,#101b2e);color:var(--workspace-text,#e5edf8)}
.fea-benchmark__header{display:flex;justify-content:space-between;gap:16px;align-items:start}.fea-benchmark__header h2{margin:4px 0;font-size:16px}.fea-benchmark__header p{margin:0;max-width:64ch;color:var(--workspace-muted,#94a3b8);font-size:12px}
.fea-benchmark__status{padding:7px 12px;border:1px solid #334155;border-radius:999px;font-weight:800;white-space:nowrap}.fea-benchmark__status[data-status="PASSED"]{color:#86efac;border-color:#15803d}.fea-benchmark__status[data-status="FAILED"]{color:#fca5a5;border-color:#b91c1c}.fea-benchmark__status[data-status="RUNNING"]{color:#fcd34d;border-color:#b45309}
.fea-benchmark__controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.fea-benchmark button{border:1px solid #334155;border-radius:5px;padding:8px 12px;background:#0b1628;color:inherit;font-weight:600}.fea-benchmark button:disabled{opacity:.45}.fea-benchmark__hash{font:11px ui-monospace,monospace;color:#94a3b8}
.fea-benchmark__scroll{max-height:340px;overflow:auto}.fea-benchmark table{width:100%;border-collapse:collapse;font-size:12px}.fea-benchmark th,.fea-benchmark td{padding:5px 7px;border:1px solid #334155;text-align:left;vertical-align:top}.fea-benchmark__cell-number{text-align:right;font:12px ui-monospace,monospace;white-space:nowrap}.fea-benchmark__cell-status{font-weight:800}.fea-benchmark tr[data-status="PASS"] .fea-benchmark__cell-status{color:#86efac}.fea-benchmark tr[data-status="FAIL"] .fea-benchmark__cell-status{color:#fca5a5}
.fea-benchmark__case{padding:9px;border:1px solid #263449;border-radius:6px;background:#0b1628}.fea-benchmark__case+.fea-benchmark__case{margin-top:8px}.fea-benchmark__case summary{cursor:pointer;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.fea-benchmark__badge{padding:2px 7px;border-radius:4px;font-size:11px;font-weight:800}.fea-benchmark__badge[data-status="PASS"]{background:#14532d;color:#86efac}.fea-benchmark__badge[data-status="FAIL"]{background:#7f1d1d;color:#fecaca}.fea-benchmark__badge[data-status="ERROR"]{background:#78350f;color:#fed7aa}
.fea-benchmark__reference{margin:8px 0;padding:7px 9px;border-left:3px solid #f59e0b;background:#16223a;font-size:12px}.fea-benchmark__error{color:#fca5a5;font-weight:700}.fea-benchmark__summary td:first-child{font-weight:600}
@media(max-width:700px){.fea-benchmark__header{display:grid}}
`}const c=s(),m=`
.lafea-analytical-calc{display:grid;gap:10px;min-width:0}
.lafea-analytical-calc[data-emp1-split-console]{position:relative;grid-template-rows:auto auto minmax(0,1fr) auto;height:clamp(500px,70dvh,760px);max-height:calc(100dvh - 160px);min-height:0;overflow:hidden;overscroll-behavior:contain}
.emp1-analytical-layout__lanes{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(360px,1fr);gap:10px;align-items:stretch;min-width:0;min-height:0;overflow:hidden}
.emp1-analytical-layout__region{display:grid;gap:10px;align-content:start;min-width:0}
.emp1-analytical-layout__region>[data-emp1-layout-surface]{min-width:0}
.emp1-analytical-layout__region[data-emp1-layout-region="ACTIVE_TASK"]{grid-column:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding-right:2px}
.emp1-analytical-layout__region[data-emp1-layout-region="BASIS_RAIL"]{grid-column:2;grid-template-rows:auto minmax(0,1fr);min-height:0;overflow:hidden;padding-right:2px}
.emp1-analytical-layout__region[data-emp1-layout-region="BASIS_RAIL"]>[data-emp1-layout-surface]:not([hidden]){min-height:0;overflow:auto;overscroll-behavior:contain}
.emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"]{box-sizing:border-box;width:100%;min-width:0;max-height:min(42vh,440px);overflow:auto;overscroll-behavior:contain;border-top:1px solid currentColor;padding-top:6px}
.emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"][data-emp1-evidence-open="false"]{overflow:hidden}
.emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"]>.lafea-workbench__card,
.emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"]>[data-emp1-layout-surface]{max-width:100%;overflow-x:auto}
.lafea-analytical-calc [data-emp1-layout-surface][hidden],
.lafea-analytical-calc .lafea-doc-table-section[hidden],
.lafea-analytical-calc [data-role="emp1-inspector-tab"][hidden]{display:none!important}
.emp1-split-console__task-context{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:baseline;padding:2px 2px 6px;border-bottom:1px solid currentColor}
.emp1-split-console__task-context-eyebrow{grid-column:1 / -1;font-size:.78em;text-transform:uppercase;letter-spacing:.06em;opacity:.72}
.emp1-split-console__task-context [data-role="emp1-active-task-title"]{font-size:1.05em}
.emp1-split-console__task-context [data-role="emp1-active-task-note"]{font-size:.88em;opacity:.78;justify-self:end;text-align:right}
.emp1-split-console__mode-tabs{display:none;gap:6px;align-items:center;min-width:0}
.emp1-split-console__mode-tabs [data-role="emp1-console-mode-tab"],
.emp1-split-console__inspector-tabs [data-role="emp1-inspector-tab"],
.emp1-task-shell__evidence-tabs [data-role="emp1-evidence-tab"]{min-height:34px;padding:6px 10px;border-radius:6px;white-space:nowrap}
.emp1-split-console__mode-tabs [aria-selected="true"],
.emp1-split-console__inspector-tabs [aria-selected="true"],
.emp1-task-shell__evidence-tabs [aria-selected="true"]{font-weight:700;box-shadow:inset 0 -2px currentColor}
.emp1-split-console__inspector-tabs{display:flex;gap:6px;overflow-x:auto;align-items:center;z-index:2;padding:4px 2px 6px;scrollbar-width:thin;border-bottom:1px solid currentColor;background:#07111f}
.emp1-split-console__evidence-toggle{justify-self:stretch;min-height:36px;padding:7px 10px;font-weight:700;text-align:left}
.emp1-task-shell__evidence-tabs{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:2px 0}
.emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"][data-emp1-evidence-open="false"]>.emp1-task-shell__evidence-tabs,
.emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"][data-emp1-evidence-open="false"]>[data-emp1-layout-surface]{display:none!important}
.lafea-analytical-calc[data-emp1-console-mode="EVIDENCE"]>.emp1-analytical-layout__lanes{display:none}
.lafea-analytical-calc[data-emp1-console-mode="EVIDENCE"]>.emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"]{grid-row:3 / span 2;height:100%;max-height:none;overflow:auto}
[data-role="emp1-c-route-capability-tabs"]{display:flex;gap:6px;overflow-x:auto;align-items:center;padding:2px 0 4px;scrollbar-width:thin}
[data-role="emp1-c-route-capability-tab"]{min-height:34px;padding:6px 10px;white-space:nowrap}
[data-role="emp1-c-route-capability-tab"][aria-selected="true"]{font-weight:700;box-shadow:inset 0 -2px currentColor}
[data-role="emp1-c-route-capability-panel"][hidden]{display:none!important}
[data-role="emp1-c-route-limitations"],
[data-role="emp1-c-route-detail"]{margin-top:6px}
[data-role="emp1-workflow"]{position:relative;z-index:4}
[data-role="emp1-workflow"]>[class=""]{min-width:0}
[data-role="emp1-professional-workflow-steps"]{display:flex;gap:6px;overflow-x:auto;list-style:none;margin:6px 0;padding:2px 0 4px;scrollbar-width:thin}
[data-role="emp1-professional-workflow-steps"]>li{flex:1 0 92px;min-width:0}
[data-role="emp1-professional-workflow-steps"] button{width:100%;min-height:36px;padding:5px 8px;line-height:1.2;text-align:left}
[data-role="emp1-professional-workflow-steps"] button[aria-current="step"]{font-weight:700;box-shadow:inset 0 -2px currentColor}
[data-role="emp1-workflow-compact-status"]{display:flex;flex-wrap:wrap;gap:5px 12px;align-items:center;margin:4px 0}
[data-role="emp1-workflow-details"]{margin-top:4px}
[data-role="emp1-workflow-details"]>summary{cursor:pointer;font-weight:600}
[data-role="emp1-workflow-details"][open]{position:absolute;inset-inline:0;top:calc(100% + 6px);z-index:30;max-height:min(56vh,520px);overflow:auto;overscroll-behavior:contain;padding:10px;border:1px solid currentColor;border-radius:8px;background:#07111f;box-shadow:0 12px 32px rgba(0,0,0,.45)}
[data-role="emp1-workflow-details"][open]>summary{position:sticky;top:-10px;z-index:1;margin:-10px -10px 8px;padding:10px;background:#07111f;border-bottom:1px solid currentColor}
[data-role="emp1-workflow"]:has([data-role="emp1-workflow-details"][open])::after{content:"";display:block;height:18px}
@media(max-width:1050px){
  .lafea-analytical-calc[data-emp1-split-console]{grid-template-rows:auto auto minmax(0,1fr);height:clamp(420px,72dvh,680px);max-height:calc(100dvh - 120px);min-height:0}
  .emp1-split-console__mode-tabs{display:flex;overflow-x:auto;scrollbar-width:thin}
  .emp1-analytical-layout__lanes{grid-template-columns:minmax(0,1fr);min-height:0}
  .emp1-analytical-layout__region[data-emp1-layout-region="ACTIVE_TASK"],
  .emp1-analytical-layout__region[data-emp1-layout-region="BASIS_RAIL"]{grid-column:1;min-height:0;height:100%;overflow:auto;padding-right:0}
  .emp1-analytical-layout__region[data-emp1-layout-region="BASIS_RAIL"]{grid-template-rows:auto minmax(0,1fr);overflow:hidden}
  .emp1-analytical-layout__region[data-emp1-layout-region="BASIS_RAIL"]>[data-emp1-layout-surface]:not([hidden]){overflow:auto}
  .lafea-analytical-calc[data-emp1-console-mode="WORK"] .emp1-analytical-layout__region[data-emp1-layout-region="BASIS_RAIL"]{display:none}
  .lafea-analytical-calc[data-emp1-console-mode="BASIS"] .emp1-analytical-layout__region[data-emp1-layout-region="ACTIVE_TASK"]{display:none}
  .lafea-analytical-calc[data-emp1-console-mode="WORK"] .emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"],
  .lafea-analytical-calc[data-emp1-console-mode="BASIS"] .emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"]{display:none}
  .lafea-analytical-calc[data-emp1-console-mode="EVIDENCE"] .emp1-analytical-layout__lanes{display:none}
  .lafea-analytical-calc[data-emp1-console-mode="EVIDENCE"] .emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"]{display:grid;grid-row:3;height:100%;max-height:none;overflow:auto}
  .lafea-analytical-calc[data-emp1-console-mode="EVIDENCE"] .emp1-split-console__evidence-toggle{display:none}
  .lafea-analytical-calc[data-emp1-console-mode="EVIDENCE"] .emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"]>.emp1-task-shell__evidence-tabs{display:flex!important}
  .lafea-analytical-calc[data-emp1-console-mode="EVIDENCE"] .emp1-analytical-layout__region[data-emp1-layout-region="EVIDENCE_WORKSPACE"]>[data-emp1-layout-surface]:not([hidden]){display:block!important}
  .emp1-split-console__task-context{grid-template-columns:1fr}
  .emp1-split-console__task-context [data-role="emp1-active-task-note"]{justify-self:start;text-align:left}
  [data-role="emp1-professional-workflow-steps"]>li{flex-basis:96px}
  [data-role="emp1-workflow-details"][open]{top:calc(100% + 4px);max-height:58vh}
}
`,f=5*1024*1024,_=Object.freeze(["application/json","text/json"]),g="lafea-workbench-document/v1",x="lafea-workbench-document/",u=/\.json$/iu;function S(e){if(!e||e.querySelector("[data-lafea-workbench-styles]"))return;const t=e.createElement("style");t.dataset.lafeaWorkbenchStyles="true",t.textContent=`${l}
${p}
${d}
${c}
${m}`,e.head?.append(t)}async function L(e,t={}){const a=y(e,t.maxBytes??f),r=e.slice(0,a.maxBytes+1);if(!r||typeof r.arrayBuffer!="function")throw o(TypeError,"LAFEA_JSON_FILE_BYTE_READER_REQUIRED","Selected LAFEA JSON must provide a bounded byte reader.");const i=await r.arrayBuffer();if(!(i instanceof ArrayBuffer))throw o(TypeError,"LAFEA_JSON_FILE_BYTE_READER_INVALID","Selected LAFEA JSON byte reader returned an invalid payload.");if(i.byteLength>a.maxBytes)throw o(RangeError,"LAFEA_JSON_FILE_TOO_LARGE",`Selected LAFEA JSON exceeds the ${a.maxBytes}-byte intake limit.`);if(i.byteLength!==a.declaredBytes)throw o(RangeError,"LAFEA_JSON_FILE_SIZE_MISMATCH","Selected LAFEA JSON byte length does not match its declared file size.");let n;try{n=new TextDecoder("utf-8",{fatal:!0}).decode(i)}catch{throw o(TypeError,"LAFEA_JSON_UTF8_INVALID","Selected LAFEA JSON is not valid UTF-8.")}return h(n,"Selected LAFEA JSON"),n}function h(e,t="LAFEA JSON"){if(typeof e!="string")throw o(TypeError,"LAFEA_JSON_TEXT_REQUIRED",`${t} text is required.`);let a;try{a=JSON.parse(e)}catch{throw o(SyntaxError,"LAFEA_JSON_MALFORMED",`${t} is malformed JSON.`)}if(!b(a))throw o(TypeError,"LAFEA_JSON_OBJECT_REQUIRED",`${t} must be a JSON object.`);return w(a),a}function I(e,t,a){if(!e||typeof Blob>"u"||typeof URL>"u")return;const r=URL.createObjectURL(new Blob([JSON.stringify(t,null,2)],{type:"application/json"})),i=e.createElement("a");i.href=r,i.download=a,i.hidden=!0,e.body?.append(i),i.click(),i.remove(),A(r)}function N(e){return e.toLowerCase().replace(".","-")}function b(e){return!!e&&typeof e=="object"&&!Array.isArray(e)}function y(e,t){if(!e||typeof e!="object")throw o(TypeError,"LAFEA_JSON_FILE_REQUIRED","A selected LAFEA JSON file is required.");const a=k(t,"LAFEA_JSON_FILE_LIMIT_INVALID"),r=typeof e.name=="string"?e.name.trim():"";if(!r||!u.test(r))throw o(TypeError,"LAFEA_JSON_FILE_EXTENSION_REJECTED","Selected LAFEA source must use the .json file extension.");const i=E(e.type);if(i&&!_.includes(i))throw o(TypeError,"LAFEA_JSON_FILE_MIME_REJECTED","Selected LAFEA source must use a JSON media type.");const n=Number(e.size);if(!Number.isInteger(n)||n<0)throw o(TypeError,"LAFEA_JSON_FILE_SIZE_REQUIRED","Selected LAFEA JSON file size is unavailable or invalid.");if(n>a)throw o(RangeError,"LAFEA_JSON_FILE_TOO_LARGE",`Selected LAFEA JSON exceeds the ${a}-byte intake limit.`);if(typeof e.slice!="function")throw o(TypeError,"LAFEA_JSON_FILE_BYTE_READER_REQUIRED","Selected LAFEA JSON must provide a bounded byte reader.");return Object.freeze({maxBytes:a,declaredBytes:n,mime:i})}function w(e){const t=typeof e?.schema=="string"?e.schema.trim():"";if(t.startsWith(x)&&t!==g)throw o(TypeError,"LAFEA_WORKBENCH_DOCUMENT_SCHEMA_UNSUPPORTED","LAFEA workbench document envelope schema is unsupported.")}function E(e){return typeof e=="string"?e.split(";",1)[0].trim().toLowerCase():""}function k(e,t){const a=Number(e);if(!Number.isInteger(a)||a<=0)throw o(TypeError,t,"LAFEA JSON intake byte limit must be a positive integer.");return a}function o(e,t,a){const r=new e(a);return r.code=t,r}function A(e){let t=!1;const a=()=>{t||(t=!0,URL.revokeObjectURL(e),globalThis.clearTimeout(r),globalThis.removeEventListener?.("focus",a))},r=globalThis.setTimeout(a,3e4);globalThis.addEventListener?.("focus",a,{once:!0})}export{c as F,b as a,I as d,S as i,N as l,h as p,L as r};
