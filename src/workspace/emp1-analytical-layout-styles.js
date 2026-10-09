export const EMP1_ANALYTICAL_LAYOUT_STYLES = `
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
[data-role="emp1-workflow-compact-status"],
[data-role="emp1-assessment-outcome"]{display:flex;flex-wrap:wrap;gap:5px 12px;align-items:center;margin:4px 0}
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
`;
