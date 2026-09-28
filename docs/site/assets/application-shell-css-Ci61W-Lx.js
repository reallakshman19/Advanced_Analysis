function l(){return`
.lafea-workbench{display:grid;gap:14px;max-width:1700px;margin:0 auto;padding:18px;color:var(--workspace-text,#e5edf8);background:var(--workspace-canvas,#08111f)}
.lafea-workbench__header{display:flex;justify-content:space-between;gap:18px;align-items:start}.lafea-workbench__header h1{margin:4px 0}.lafea-workbench__header p{margin:0;color:var(--workspace-muted,#94a3b8)}.lafea-workbench__title-row{display:flex;align-items:center;flex-wrap:wrap;gap:12px}.lafea-workbench__stage-badge{display:inline-block;background:#1e3a8a;border:1px solid #38bdf8;color:#f8fafc;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700;box-shadow:0 0 10px rgba(56,189,248,0.25)}
.lafea-workbench__status{padding:7px 10px;border:1px solid #334155;border-radius:999px;font-weight:800}.lafea-workbench__status[data-status="QUALIFIED"]{color:#86efac;border-color:#15803d}.lafea-workbench__status[data-status="FAILED"]{color:#fca5a5;border-color:#b91c1c}
.lafea-workbench__stages,.lafea-workbench__toolbar,.lafea-workbench__record-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.lafea-doc-identity{display:block;color:#9fb2c8;font-size:11px;margin-top:2px}
.lafea-doc-path{display:block;color:#647d96;font-size:10px;margin-top:1px;opacity:.72;max-width:34ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lafea-doc-grid th[scope="row"] strong{font-size:13px}
.lafea-workbench__toolbar-group{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:4px 10px 4px 0;border-right:1px solid #24374d}
.lafea-workbench__toolbar-group:last-child{border-right:0;padding-right:0}
.lafea-workbench__toolbar-group-label{color:#7f93ab;font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;margin-right:2px}
.lafea-workbench__toolbar-group [data-toolbar-primary="true"]{border-color:#38bdf8;background:#123047;color:#f0f9ff;font-weight:800;box-shadow:0 0 0 1px #38bdf8 inset}
@media(max-width:900px){.lafea-workbench__toolbar-group{border-right:0;padding-right:0}}
.lafea-workbench button,.lafea-workbench select,.lafea-workbench input{border:1px solid #334155;border-radius:5px;padding:8px;background:#0b1628;color:inherit}.lafea-workbench button[aria-current="step"]{border-color:#f59e0b;color:#fde68a}.lafea-workbench button:disabled{opacity:.45}
.lafea-workbench [data-role="lafea-run"]{background:#0f766e;border-color:#2dd4bf;color:#ecfeff;font-weight:800;padding-inline:16px}.lafea-workbench [data-role="lafea-run"]:disabled{background:#0b1628;border-color:#334155;color:#94a3b8}
.lafea-workbench__grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.lafea-workbench__card{min-width:0;padding:14px;border:1px solid var(--workspace-border,#334155);border-radius:8px;background:var(--workspace-panel,#101b2e)}.lafea-workbench__card h2{margin:0 0 10px;font-size:15px}.lafea-workbench__section-intro{margin:0 0 12px;color:#a9b8cc;line-height:1.5}
.lafea-workbench textarea{box-sizing:border-box;width:100%;min-height:220px;padding:10px;border:1px solid #334155;border-radius:5px;background:#050b14;color:#dbeafe;font:12px/1.5 ui-monospace,monospace;resize:vertical}.lafea-workbench__editor,.lafea-workbench__collections{display:grid;gap:9px}
.lafea-workbench__svg{min-height:360px;border:1px solid #334155;border-radius:7px;background:#050a12;overflow:hidden}.lafea-workbench__svg svg{display:block;width:100%;height:auto}.lafea-workbench-svg__element{fill:rgba(59,130,246,.12);stroke:#60a5fa;stroke-width:2;cursor:pointer}.lafea-workbench-svg__node circle{fill:#f8fafc;stroke:#0f172a;stroke-width:2;cursor:pointer}.lafea-workbench-svg__node text,.lafea-workbench-svg__empty{fill:#cbd5e1;font-size:12px}.lafea-workbench-svg__node.lafea-svg-highlighted circle{fill:#f59e0b;stroke:#fbbf24;stroke-width:3;filter:drop-shadow(0 0 6px #fbbf24)}.lafea-workbench-svg__element.lafea-svg-highlighted{stroke:#f59e0b;stroke-width:4;fill:rgba(245,158,11,.28);filter:drop-shadow(0 0 6px #fbbf24)}
.lafea-workbench__table{max-height:230px;overflow:auto}.lafea-workbench table{width:100%;border-collapse:collapse;font-size:12px}.lafea-workbench th,.lafea-workbench td{padding:6px;border:1px solid #334155;text-align:left;vertical-align:top}.lafea-workbench tr[data-selected="true"],.lafea-workbench tr.lafea-row-selected{outline:2px solid #fbbf24;outline-offset:-2px;background:rgba(245,158,11,0.22)!important}
.lafea-workbench__pagination,.lafea-result-legend ol{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.lafea-result-legend li{display:flex;gap:6px;align-items:center}.lafea-result-legend li span{width:22px;height:12px;border:1px solid #cbd5e1}.lafea-workbench__result-plot svg{display:block;width:100%;min-height:260px}
.lafea-workbench pre{max-height:430px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.lafea-workbench__authority{padding:10px 12px;border-left:4px solid #2dd4bf;background:#102334;font-weight:700}
.lafea-workbench__failure{padding:10px 12px;border-left:4px solid #f87171;background:#2a1114;color:#fecaca;font-weight:700;border-radius:0 6px 6px 0}
.lafea-workbench__failure strong{display:block;color:#fca5a5;font-size:13px;letter-spacing:.02em;margin-bottom:3px}
.lafea-workbench__failure p{margin:4px 0 0;font-weight:600;color:#f3d3d3}
@media(max-width:1000px){.lafea-workbench__grid{grid-template-columns:1fr}}@media(max-width:640px){.lafea-workbench__header{display:grid}}
.lafea-workbench__benchmark{grid-column:1/-1}
.lafea-doc-table-view{display:flex;flex-direction:column;gap:12px;max-height:520px;overflow:auto;border:1px solid #1e293b;padding:12px;border-radius:6px;background:#070e1a}
.lafea-doc-table-toolbar{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #1e293b;padding-bottom:10px}
.lafea-doc-table-tabs{display:flex;gap:6px}.lafea-doc-apply-btn{background:#1e3a8a !important;border-color:#3b82f6 !important;color:#93c5fd !important;font-weight:700}
.lafea-doc-table-section{margin-bottom:14px}.lafea-doc-table-section h4{margin:0 0 8px;color:#38bdf8;font-size:13px;font-weight:700}
.lafea-doc-grid{width:100%;border-collapse:collapse;font-size:12px;background:#0d172a}
.lafea-doc-grid th{background:#1e293b;color:#94a3b8;font-weight:600;padding:6px;border:1px solid #334155;text-align:left}
.lafea-doc-grid td{padding:4px;border:1px solid #1e293b;vertical-align:middle}
.lafea-doc-grid input[type="text"],.lafea-doc-grid input[type="number"]{width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid #334155;border-radius:3px;background:#040912;color:#f8fafc;font:inherit}
.lafea-doc-grid input:focus{border-color:#38bdf8;outline:none;background:#0a1324}
.lafea-result-table--english{border-collapse:collapse;width:100%;font-size:13px;line-height:1.4}.lafea-result-table--english th{background:#1e293b;color:#38bdf8;padding:8px 10px;font-weight:700;border:1px solid #334155}.lafea-result-table--english td{padding:8px 10px;border:1px solid #1e293b;vertical-align:middle}.lafea-result-table--english tr:nth-child(even){background:rgba(255,255,255,0.02)}
.lafea-mesh-config__form{display:grid;gap:12px;margin-bottom:14px;border-bottom:1px solid #1e293b;padding-bottom:14px}
.lafea-mesh-config__group{display:grid;gap:6px}.lafea-mesh-config__label{font-weight:700;font-size:12px;color:#cbd5e1}
.lafea-mesh-config__button-row{display:flex;flex-wrap:wrap;gap:6px}.lafea-mesh-config__chip{background:#0b1628;border:1px solid #334155;border-radius:4px;padding:6px 10px;color:#94a3b8;cursor:pointer;font-size:12px}.lafea-mesh-config__chip.is-active{background:#1e3a8a;border-color:#38bdf8;color:#f8fafc;font-weight:700}
.lafea-mesh-config__gates-title{margin:0 0 8px;color:#38bdf8;font-size:13px;font-weight:700}
.lafea-mesh-config__actions{display:flex;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid #1e293b}.lafea-mesh-config__btn{padding:8px 14px;border-radius:5px;font-weight:600;cursor:pointer}.lafea-mesh-config__btn--primary{background:#1e3a8a;border-color:#3b82f6;color:#93c5fd}
.lafea-result-limitations-title{margin:14px 0 6px;color:#38bdf8;font-size:13px;font-weight:700}
.lafea-result-limitations{margin:0 0 10px;padding-left:20px;color:#94a3b8;line-height:1.6}
.lafea-result-limitations li[data-draft="true"]{color:#fbbf24}
.lafea-result-limitation-draft{display:inline-block;margin-right:8px;padding:1px 7px;border:1px solid #fbbf24;border-radius:3px;color:#fbbf24;background:rgba(251,191,36,.12);font-size:10px;font-weight:700;letter-spacing:.08em;vertical-align:1px}
.lafea-engineering-overview{display:grid;gap:14px;padding:16px;border:1px solid #294158;border-radius:10px;background:linear-gradient(180deg,#0c1a2b 0%,#0a1422 100%);box-shadow:0 12px 32px rgba(0,0,0,.16)}
.lafea-engineering-overview__heading{display:flex;justify-content:space-between;gap:16px;align-items:center}.lafea-engineering-overview__heading h2{margin:2px 0 4px;font-size:20px}.lafea-engineering-overview__heading p{margin:0;color:#9fb0c5}.lafea-engineering-overview__run{background:#0f766e!important;border-color:#2dd4bf!important;color:#ecfeff!important;font-weight:800;padding:10px 18px!important;white-space:nowrap}.lafea-engineering-overview__run:disabled{background:#0b1628!important;border-color:#334155!important;color:#94a3b8!important}
.lafea-engineering-overview__strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.lafea-engineering-overview__card{min-width:0;padding:12px;border:1px solid #24384e;border-radius:8px;background:#091321}.lafea-engineering-overview__card-header{display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:10px}.lafea-engineering-overview__card h3{margin:0;font-size:14px}.lafea-engineering-overview__badge{max-width:58%;overflow:hidden;text-overflow:ellipsis;padding:3px 6px;border:1px solid #36536e;border-radius:999px;color:#9fd4ff;font-size:10px;white-space:nowrap}.lafea-engineering-overview__card[data-status="ACCEPTED"] .lafea-engineering-overview__badge,.lafea-engineering-overview__card[data-status="CURRENT"] .lafea-engineering-overview__badge,.lafea-engineering-overview__card[data-status="LOADED"] .lafea-engineering-overview__badge{border-color:#16835f;color:#86efac}
.lafea-engineering-overview__facts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:6px 8px;margin:0;font-size:11px}.lafea-engineering-overview__facts dt{color:#8395ab}.lafea-engineering-overview__facts dd{margin:0;text-align:right;color:#edf5ff;overflow-wrap:anywhere}.lafea-engineering-overview__qualification{border-top:1px solid #24384e;padding-top:10px}.lafea-engineering-overview__qualification summary{cursor:pointer;color:#c8e6ff;font-weight:700}.lafea-engineering-overview__qualification-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.lafea-engineering-overview__qualification-grid>div{display:grid;gap:4px;padding:8px;border-radius:6px;background:#08111d}.lafea-engineering-overview__qualification-grid span{color:#a8bad0;font-size:12px}
.lafea-viewport-mode-panel{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}.lafea-viewport-mode-panel__item{display:grid;gap:3px;padding:9px 10px;border:1px solid #293d52;border-radius:7px;background:#0a1422}.lafea-viewport-mode-panel__item strong{font-size:12px}.lafea-viewport-mode-panel__item span{color:#8296ad;font-size:10px}.lafea-viewport-mode-panel__item[data-active="true"]{border-color:#0f9f8e;background:#0b2327}.lafea-viewport-mode-panel__item[data-active="true"] span{color:#8af0dd}.lafea-workbench__truth{margin-top:10px;border-top:1px solid #263a4e;padding-top:8px}.lafea-workbench__truth summary{cursor:pointer;color:#9fb8cf;font-weight:700}
.lafea-result-empty{padding:18px;border:1px dashed #334155;border-radius:8px;background:#091321}.lafea-result-empty p{margin-bottom:0;color:#9fb0c5}.lafea-result-highlights{display:grid;gap:12px;margin:12px 0 18px;padding:14px;border:1px solid #285064;border-radius:9px;background:#091722}.lafea-result-highlights__heading{display:flex;justify-content:space-between;gap:12px}.lafea-result-highlights__heading h3{margin:0 0 3px}.lafea-result-highlights__heading p{margin:0;color:#9db1c7}.lafea-result-highlights__status{align-self:start;padding:4px 8px;border:1px solid #16835f;border-radius:999px;color:#86efac;font-size:11px}
.lafea-result-highlights__status[data-authorized="false"]{border-color:#b45309;color:#fcd34d;background:#2a1e07}.lafea-result-highlights__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.lafea-result-highlight{display:grid;gap:4px;padding:11px;border:1px solid #263e52;border-radius:7px;background:#07111c}.lafea-result-highlight__label{color:#8ea5ba;font-size:11px}.lafea-result-highlight__value{font-size:18px;color:#f4fbff}.lafea-result-highlight__location{color:#6f879d;font-size:10px;overflow-wrap:anywhere}.lafea-result-highlights__solver,.lafea-result-highlights__recovery{margin:0;color:#9db1c7;font-size:12px}.lafea-result-highlights__recovery{padding:8px;border-left:3px solid #f59e0b;background:#151c28;color:#d7c398}
.lafea-mesh-workspace-summary{display:grid;gap:10px;margin-bottom:14px;padding:12px;border:1px solid #29475c;border-radius:8px;background:#081722}.lafea-mesh-workspace-summary__heading{display:flex;justify-content:space-between;gap:12px;align-items:start}.lafea-mesh-workspace-summary__heading h3{margin:0 0 3px}.lafea-mesh-workspace-summary__heading p{margin:0;color:#93a9bd;line-height:1.4}.lafea-mesh-workspace-summary__state{padding:4px 8px;border:1px solid #36536e;border-radius:999px;color:#9fd4ff;font-size:10px}.lafea-mesh-workspace-summary__grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}.lafea-mesh-workspace-summary__metric{display:grid;gap:3px;padding:8px;border-radius:6px;background:#07111c}.lafea-mesh-workspace-summary__metric span{color:#8096aa;font-size:10px}.lafea-mesh-workspace-summary__metric strong{overflow-wrap:anywhere;font-size:12px}
@media(max-width:1200px){.lafea-engineering-overview__strip{grid-template-columns:repeat(2,minmax(0,1fr))}.lafea-engineering-overview__qualification-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lafea-mesh-workspace-summary__grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.lafea-engineering-overview__heading,.lafea-mesh-workspace-summary__heading{display:grid}.lafea-engineering-overview__strip,.lafea-engineering-overview__qualification-grid,.lafea-viewport-mode-panel,.lafea-result-highlights__grid,.lafea-mesh-workspace-summary__grid{grid-template-columns:1fr}.lafea-engineering-overview__run{width:100%}}
`}const d=l(),n=`
.lafea-guided-shell{display:grid;grid-template-columns:minmax(188px,216px) minmax(0,1fr);gap:14px;align-items:start}
.lafea-guided-shell__nav{position:sticky;top:12px;display:grid;gap:8px;padding:12px;border:1px solid #334155;border-radius:8px;background:#0b1628;max-height:calc(100vh - 24px);overflow:auto}
.lafea-guided-shell__main{display:block;min-width:0}
.lafea-cae-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,340px);gap:12px;align-items:start;min-width:0}
.lafea-cae-workspace__viewport{min-width:0}.lafea-cae-workspace__viewport-card{min-width:0}
.lafea-cae-workspace__viewport-card .lafea-workbench__svg{min-height:440px}
.lafea-cae-workspace__inspector{position:sticky;top:12px;display:grid;gap:12px;align-content:start;max-height:calc(100vh - 24px);overflow:auto;min-width:0}
.lafea-cae-workspace__inspector-card{min-width:0}
.lafea-cae-workspace__context{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px;min-width:0}
.lafea-cae-workspace__context>[data-guided-target="results"],.lafea-cae-workspace__context>[data-guided-target="lineage"]{grid-column:1/-1}
.lafea-guided-workflow{display:grid;gap:9px}.lafea-guided-workflow h2{margin:0 0 2px;font-size:13px;letter-spacing:.02em;color:#dbeafe}.lafea-guided-workflow__areas{display:grid;gap:7px;margin:0;padding:0;list-style:none}.lafea-guided-workflow__areas>li{display:grid;gap:4px}
.lafea-guided-workflow__area{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;width:100%;padding:9px 10px!important;background:#091322!important;border-color:#26364d!important}.lafea-guided-workflow__area:hover:not(:disabled){border-color:#4b647f!important;background:#0d1b2d!important}.lafea-guided-workflow__label{min-width:0;font-size:12px;font-weight:700;line-height:1.35}.lafea-guided-workflow__state{justify-self:end;padding:2px 6px;border:1px solid #3a4d63;border-radius:999px;color:#b9c8d8;font-size:10px;font-weight:700;white-space:nowrap}.lafea-guided-workflow__state[data-tone="positive"]{border-color:#16835f;color:#86efac}.lafea-guided-workflow__state[data-tone="warning"]{border-color:#b7791f;color:#fde68a}.lafea-guided-workflow__state[data-tone="critical"]{border-color:#b91c1c;color:#fca5a5}
.lafea-guided-workflow__area[data-ui-status="COMPLETE"]{border-left:3px solid #15803d!important}.lafea-guided-workflow__area[data-ui-status="WARNING"]{border-left:3px solid #d97706!important}.lafea-guided-workflow__area[data-ui-status="BLOCKED"]{border-left:3px solid #b91c1c!important}.lafea-guided-workflow__reasons{display:block;margin:0 4px 1px;padding-left:8px;border-left:2px solid #334155;color:#94a3b8;font-size:10px;line-height:1.4}.lafea-guided-workflow__technical{margin:0 4px;color:#8fa3b8;font-size:10px}.lafea-guided-workflow__technical summary{cursor:pointer;padding:2px 0}.lafea-guided-workflow__technical ol{display:grid;gap:3px;margin:4px 0 0;padding:0;list-style:none}.lafea-guided-workflow__technical-step{width:100%;padding:5px 6px!important;text-align:left;background:#07111c!important;border-color:#223247!important;color:#9fb0c5!important;font-size:10px!important;line-height:1.3}.lafea-guided-workflow__technical-step[data-status="BLOCKED"]{border-left:2px solid #b91c1c!important}.lafea-guided-workflow__technical-step[data-status="WARNING"]{border-left:2px solid #d97706!important}.lafea-guided-workflow__technical-step[data-status="COMPLETE"]{border-left:2px solid #15803d!important}.lafea-guided-workflow__release{margin:1px 0 0;padding-top:8px;border-top:1px solid #26364d;color:#a8bad0;font-size:11px}.lafea-guided-workflow__release[data-qualified="true"]{color:#86efac}
.lafea-workbench__custody{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.lafea-workbench__custody span{padding:4px 7px;border:1px solid #334155;border-radius:999px;font-size:11px;background:#0b1628}
.lafea-discretization{display:grid;gap:12px}.lafea-discretization__section{padding:10px;border:1px solid #26364d;border-radius:6px;background:#091322}.lafea-discretization__section h3{margin:0 0 8px;color:#38bdf8;font-size:13px}
.lafea-discretization__modes,.lafea-discretization__actions,.lafea-discretization__facts{display:grid;gap:7px}.lafea-discretization__mode{display:flex;justify-content:space-between;gap:8px;align-items:center}.lafea-discretization__mode code{font-size:11px}.lafea-discretization__reason{color:#fbbf24;font-size:11px}.lafea-discretization__facts{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.lafea-discretization__fact{padding:6px;border-left:3px solid #334155;background:#0b1628;overflow-wrap:anywhere}
.lafea-discretization__state{font-weight:800}.lafea-discretization__state[data-state="CURRENT_PASS"]{color:#86efac}.lafea-discretization__state[data-state="CURRENT_WARNING"]{color:#fde68a}.lafea-discretization__state[data-state="CURRENT_BLOCK"],.lafea-discretization__state[data-state="INVALID"]{color:#fca5a5}.lafea-discretization__state[data-state="STALE"]{color:#fdba74}
.lafea-discretization__finding-list{display:flex;flex-wrap:wrap;gap:6px;padding:0;list-style:none}.lafea-discretization__finding-list button{padding:5px 7px;font-size:11px}
.lafea-discretization__generation-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:end}.lafea-discretization__generation-controls label{display:grid;gap:4px;font-size:11px;color:#94a3b8}.lafea-discretization__generation-controls input{width:120px}
.lafea-discretization__profile-binding{display:grid;gap:9px}.lafea-discretization__profile-binding>label{display:grid;gap:5px}.lafea-discretization__profile-binding input,.lafea-discretization__profile-binding select{width:100%;box-sizing:border-box}
.lafea-discretization__technical-evidence{margin-bottom:8px}.lafea-discretization__technical-evidence summary{cursor:pointer;color:#9fb8cf;font-size:11px;font-weight:700}
.lafea-discretization__plan{margin-top:9px;padding:8px;border-left:3px solid #38bdf8;background:#0b1628}.lafea-discretization__plan[data-disposition="BLOCK"]{border-color:#b91c1c}.lafea-discretization__plan[data-strategy="CONSTRAINED_DELAUNAY"]{border-color:#d97706}
.lafea-discretization__disclosure{margin:8px 0 0;color:#fbbf24;font-size:11px}.lafea-discretization__status{margin:8px 0 0;color:#cbd5e1;font-size:12px}
.lafea-discretization__section[data-generation-available="false"] .lafea-discretization__status{color:#fbbf24}
.lafea-guided-summary{display:grid;gap:6px}.lafea-guided-summary__row{padding:7px;border-left:3px solid #334155;background:#0b1628}.lafea-guided-summary__row[data-status="BLOCKED"]{border-color:#b91c1c}.lafea-guided-summary__row[data-status="WARNING"]{border-color:#d97706}.lafea-guided-summary__row[data-status="COMPLETE"]{border-color:#15803d}
.lafea-retained-mesh__element{fill:rgba(56,189,248,.04);stroke:#38bdf8;stroke-width:1.25;vector-effect:non-scaling-stroke;pointer-events:stroke}.lafea-retained-mesh__element--warning{stroke:#f59e0b;stroke-width:2}.lafea-retained-mesh__element--block{stroke:#ef4444;stroke-width:2.5}.lafea-retained-mesh__element--focused{stroke:#f8fafc;stroke-width:4;filter:drop-shadow(0 0 5px #38bdf8)}

/* Primary-action hierarchy: one dominant contextual CTA; compatibility Run controls remain secondary. */
.lafea-next-action-banner{min-height:48px!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;margin:0 0 12px!important;padding:10px 12px!important;background:#0b1628!important;border:1px solid #334155!important;border-radius:6px!important;color:#dbeafe!important;box-shadow:none!important}
.lafea-next-action-banner>strong{font-size:12px;font-weight:700;letter-spacing:.01em;color:#cbd5e1}
.lafea-next-action-banner__button{min-height:34px;padding:7px 12px!important;border:1px solid #0ea5e9!important;border-radius:5px!important;background:#0c4a6e!important;color:#e0f2fe!important;font-size:12px!important;font-weight:750!important;cursor:pointer!important;box-shadow:none!important}
.lafea-next-action-banner__button:hover:not(:disabled){background:#075985!important;border-color:#38bdf8!important}.lafea-next-action-banner__button:focus-visible{outline:2px solid #7dd3fc;outline-offset:2px}.lafea-next-action-banner__button:disabled{cursor:not-allowed!important;background:#172033!important;border-color:#334155!important;color:#7f91a6!important}
.lafea-engineering-overview__run,[data-lafea-slot="toolbar"] [data-role="lafea-run"]{background:transparent!important;border-color:#41536a!important;color:#a8bad0!important;box-shadow:none!important;font-weight:650!important}.lafea-engineering-overview__run:hover:not(:disabled),[data-lafea-slot="toolbar"] [data-role="lafea-run"]:hover:not(:disabled){background:#101d2d!important;border-color:#64748b!important;color:#e2e8f0!important}
.lafea-engineering-overview__run:disabled,[data-lafea-slot="toolbar"] [data-role="lafea-run"]:disabled{opacity:.58}

@media(max-width:1360px){.lafea-guided-shell{grid-template-columns:minmax(180px,205px) minmax(0,1fr)}.lafea-cae-workspace{grid-template-columns:minmax(0,1fr) minmax(280px,310px)}.lafea-cae-workspace__context{grid-template-columns:1fr}}
@media(max-width:1100px){.lafea-cae-workspace{grid-template-columns:1fr}.lafea-cae-workspace__inspector{position:static;max-height:none;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}}
@media(max-width:900px){.lafea-guided-shell{grid-template-columns:1fr}.lafea-guided-shell__nav{position:static;max-height:none}.lafea-cae-workspace__inspector{grid-template-columns:1fr}.lafea-cae-workspace__viewport-card .lafea-workbench__svg{min-height:360px}.lafea-next-action-banner{align-items:stretch!important;flex-direction:column!important}.lafea-next-action-banner__button{width:100%}}
`,t="topology-edit-object-tree-styles";function p(e){if(!e?.head||e.getElementById(t))return;const o=e.createElement("style");o.id=t,o.textContent=`
    .topology-edit-object-tree {
      display: grid;
      gap: 0.65rem;
      padding: 0.75rem;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      border-radius: 0.55rem;
      background: color-mix(in srgb, Canvas 96%, currentColor 4%);
      contain: layout style;
    }
    .topology-edit-object-tree__header {
      display: grid;
      gap: 0.45rem;
    }
    .topology-edit-object-tree__heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .topology-edit-object-tree__heading strong {
      font-size: 0.88rem;
    }
    .topology-edit-object-tree__heading output,
    .topology-edit-object-tree__status {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.7rem;
      overflow-wrap: anywhere;
    }
    .topology-edit-object-tree__filter {
      width: 100%;
      min-width: 0;
    }
    .topology-edit-object-tree__groups {
      display: grid;
      gap: 0.35rem;
      max-height: min(58vh, 34rem);
      overflow: auto;
      scrollbar-gutter: stable;
      contain: layout style paint;
    }
    .topology-edit-object-tree__group {
      border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
      border-radius: 0.4rem;
      overflow: clip;
      content-visibility: auto;
      contain-intrinsic-size: auto 320px;
    }
    .topology-edit-object-tree__group > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.4rem 0.5rem;
      cursor: pointer;
      font-size: 0.76rem;
      font-weight: 700;
      background: color-mix(in srgb, Canvas 90%, currentColor 10%);
    }
    .topology-edit-object-tree__list {
      display: grid;
      gap: 1px;
      margin: 0;
      padding: 0;
      list-style: none;
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    .topology-edit-object-tree__item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.35rem;
      padding: 0.35rem;
      background: Canvas;
      contain: layout style paint;
    }
    .topology-edit-object-tree__select {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.1rem;
      min-width: 0;
      padding: 0.35rem 0.45rem;
      border: 0;
      border-radius: 0.3rem;
      text-align: left;
      color: inherit;
      background: transparent;
      cursor: pointer;
    }
    .topology-edit-object-tree__select:hover,
    .topology-edit-object-tree__select:focus-visible {
      background: color-mix(in srgb, #38bdf8 12%, Canvas 88%);
    }
    .topology-edit-object-tree__select[aria-pressed="true"] {
      outline: 1px solid color-mix(in srgb, #0ea5e9 72%, currentColor 28%);
      background: color-mix(in srgb, #0ea5e9 18%, Canvas 82%);
    }
    .topology-edit-object-tree__label,
    .topology-edit-object-tree__id,
    .topology-edit-object-tree__description {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .topology-edit-object-tree__label {
      font-size: 0.76rem;
      font-weight: 700;
    }
    .topology-edit-object-tree__id,
    .topology-edit-object-tree__description {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.64rem;
      opacity: 0.72;
    }
    .topology-edit-object-tree__actions {
      display: flex;
      flex-wrap: wrap;
      align-content: center;
      justify-content: end;
      gap: 0.25rem;
      max-width: 12rem;
    }
    .topology-edit-object-tree__actions button {
      padding: 0.25rem 0.4rem;
      font-size: 0.65rem;
    }
    .topology-edit-object-tree__actions button[data-object-tree-action="delete-edge"] {
      color: #b91c1c;
    }
    .topology-edit-object-tree__more {
      width: 100%;
      min-height: 2rem;
      border: 0;
      border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent);
      border-radius: 0;
      font-size: 0.7rem;
      font-weight: 700;
      color: #0ea5e9;
      background: color-mix(in srgb, Canvas 94%, #0ea5e9 6%);
      cursor: pointer;
    }
    .topology-edit-object-tree__more:hover,
    .topology-edit-object-tree__more:focus-visible {
      background: color-mix(in srgb, Canvas 86%, #0ea5e9 14%);
    }
    .topology-edit-object-tree__empty {
      margin: 0;
      padding: 0.65rem;
      font-size: 0.72rem;
      opacity: 0.72;
    }
    .topology-edit-object-tree[data-busy="true"] button {
      cursor: progress;
    }
  `,e.head.append(o)}const a="topology-edit-professional-operation-styles";function g(e){if(!e?.head||e.getElementById(a))return;const o=e.createElement("style");o.id=a,o.textContent=`
    .topology-edit-professional-operation {
      display: grid;
      gap: 0.75rem;
      padding: 0.85rem;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      border-radius: 0.55rem;
      background: color-mix(in srgb, Canvas 96%, currentColor 4%);
    }
    .topology-edit-professional-operation__header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 1rem;
    }
    .topology-edit-professional-operation__header p {
      margin: 0.25rem 0 0;
      max-width: 68ch;
      opacity: 0.75;
    }
    .topology-edit-professional-operation__header output {
      max-width: 38ch;
      overflow-wrap: anywhere;
      font-size: 0.82rem;
    }
    .topology-edit-component-hud {
      display: grid;
      gap: 0.55rem;
      padding: 0.7rem;
      border: 1px solid color-mix(in srgb, #38bdf8 45%, currentColor 18%);
      border-radius: 0.5rem;
      background: color-mix(in srgb, #0ea5e9 8%, Canvas 92%);
    }
    .topology-edit-component-hud > header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .topology-edit-component-hud > header div {
      display: grid;
      gap: 0.15rem;
      min-width: 0;
    }
    .topology-edit-component-hud > header span,
    .topology-edit-component-hud > header output,
    .topology-edit-component-hud > small {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.72rem;
      overflow-wrap: anywhere;
    }
    .topology-edit-component-hud > header output {
      padding: 0.15rem 0.4rem;
      border: 1px solid currentColor;
      border-radius: 999px;
      font-weight: 700;
    }
    .topology-edit-component-hud > p {
      margin: 0;
      font-size: 0.78rem;
      opacity: 0.8;
    }
    .topology-edit-component-hud > dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
      gap: 0.4rem;
      margin: 0;
    }
    .topology-edit-component-hud > dl div {
      display: grid;
      gap: 0.15rem;
      padding: 0.4rem;
      border-radius: 0.35rem;
      background: color-mix(in srgb, Canvas 88%, currentColor 12%);
    }
    .topology-edit-component-hud dt {
      font-size: 0.7rem;
      font-weight: 650;
      opacity: 0.75;
    }
    .topology-edit-component-hud dd {
      display: grid;
      gap: 0.1rem;
      margin: 0;
      font-weight: 650;
    }
    .topology-edit-component-hud dd small {
      font-size: 0.62rem;
      font-weight: 500;
      opacity: 0.65;
    }
    .topology-edit-professional-operation__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11.5rem, 1fr));
      gap: 0.55rem;
    }
    .topology-edit-professional-operation__grid label {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
      font-size: 0.78rem;
    }
    .topology-edit-professional-operation__grid input,
    .topology-edit-professional-operation__grid select {
      width: 100%;
      min-width: 0;
    }
    .topology-edit-professional-operation__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }
    .topology-edit-professional-operation__evidence {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
      gap: 0.4rem 0.8rem;
      margin: 0;
      font-size: 0.75rem;
    }
    .topology-edit-professional-operation__evidence div {
      display: grid;
      grid-template-columns: minmax(7rem, auto) 1fr;
      gap: 0.45rem;
      min-width: 0;
    }
    .topology-edit-professional-operation__evidence dt {
      font-weight: 650;
    }
    .topology-edit-professional-operation__evidence dd {
      margin: 0;
      overflow-wrap: anywhere;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    @media (max-width: 720px) {
      .topology-edit-professional-operation__header,
      .topology-edit-component-hud > header {
        display: grid;
      }
    }
  `,e.head.append(o)}const i="topology-edit-authoring-styles";function s(e=globalThis.document){if(!e?.head||e.getElementById(i))return;const o=e.createElement("style");o.id=i,o.textContent=`
    .topology-edit-authoring-hud {
      display: grid;
      gap: 0.75rem;
      min-width: 0;
      font-size: 0.78rem;
    }
    .topology-edit-authoring-hud__tools,
    .topology-edit-authoring-hud__actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.4rem;
    }
    .topology-edit-authoring-hud button {
      min-height: 2rem;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 0.45rem;
      background: rgba(15, 23, 42, 0.86);
      color: inherit;
      cursor: pointer;
    }
    .topology-edit-authoring-hud button[aria-pressed="true"],
    .topology-edit-authoring-hud__actions button:not(:disabled):first-child {
      border-color: rgba(56, 189, 248, 0.8);
      background: rgba(14, 116, 144, 0.35);
    }
    .topology-edit-authoring-hud button:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    .topology-edit-authoring-hud__status,
    .topology-edit-authoring-hud__target,
    .topology-edit-authoring-hud__evidence {
      display: grid;
      gap: 0.3rem;
      padding: 0.55rem 0.65rem;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 0.45rem;
      background: rgba(15, 23, 42, 0.45);
      overflow-wrap: anywhere;
    }
    .topology-edit-authoring-hud__phase {
      width: max-content;
      padding: 0.15rem 0.45rem;
      border-radius: 999px;
      background: rgba(56, 189, 248, 0.16);
      color: #7dd3fc;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .topology-edit-authoring-hud__target code {
      white-space: normal;
      color: #bae6fd;
    }
    .topology-edit-authoring-hud__form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
    }
    .topology-edit-authoring-hud__form label {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.28rem 0.4rem;
      align-items: center;
      min-width: 0;
    }
    .topology-edit-authoring-hud__form input,
    .topology-edit-authoring-hud__form select {
      grid-column: 1 / -1;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      min-height: 2rem;
      padding: 0.35rem 0.45rem;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 0.35rem;
      background: rgba(2, 6, 23, 0.72);
      color: inherit;
    }
    .topology-edit-authoring-hud__authority {
      justify-self: end;
      padding: 0.1rem 0.3rem;
      border-radius: 999px;
      background: rgba(100, 116, 139, 0.2);
      color: #cbd5e1;
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .topology-edit-authoring-hud__actions {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .topology-edit-authoring-hud__error {
      margin: 0;
      padding: 0.55rem 0.65rem;
      border: 1px solid rgba(248, 113, 113, 0.55);
      border-radius: 0.45rem;
      background: rgba(127, 29, 29, 0.28);
      color: #fecaca;
    }
    .topology-edit-authoring-hud ul {
      margin: 0;
      padding-left: 1.15rem;
      color: #fecaca;
    }
    .topology-edit-authoring-hud__evidence {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      color: #94a3b8;
      font-size: 0.68rem;
    }
    @media (max-width: 900px) {
      .topology-edit-authoring-hud__form,
      .topology-edit-authoring-hud__tools,
      .topology-edit-authoring-hud__actions,
      .topology-edit-authoring-hud__evidence {
        grid-template-columns: 1fr;
      }
    }
  `,e.head.append(o)}let r=!1;function c(e){if(!e||r||e.getElementById("topology-edit-table-styles"))return;const o=e.createElement("style");o.id="topology-edit-table-styles",o.textContent=`
    .topology-edit-table-window { position:absolute; top:58px; right:14px; z-index:90; width:min(1120px,calc(100% - 28px)); height:min(720px,calc(100% - 82px)); min-width:420px; min-height:42px; max-width:calc(100% - 8px); max-height:calc(100% - 54px); overflow:hidden; resize:both; border:1px solid #315070; border-radius:8px; background:#06101c; box-shadow:0 18px 52px rgba(0,0,0,.58); color:#cbd5e1; box-sizing:border-box; }
    .topology-edit-table-window[open] { display:grid; grid-template-columns:minmax(0,1fr); grid-template-rows:36px minmax(0,1fr); }
    .topology-edit-table-window:not([open]) { top:auto; right:32%; bottom:0; width:220px; height:32px; min-width:0; min-height:32px; resize:none; }
    .topology-edit-table-window__titlebar { display:flex; align-items:center; gap:.55rem; min-width:0; height:36px; padding:0 8px; border-bottom:1px solid #1e344c; background:linear-gradient(180deg,#10233a,#0a1626); cursor:move; user-select:none; list-style:none; box-sizing:border-box; }
    .topology-edit-table-window__titlebar::-webkit-details-marker { display:none; }
    .topology-edit-table-window__titlebar::after { content:'▾'; margin-left:auto; color:#7dd3fc; font-size:11px; }
    .topology-edit-table-window:not([open]) .topology-edit-table-window__titlebar::after { content:'▸'; }
    .topology-edit-table-window__titlebar strong { flex:0 0 auto; color:#f8fafc; font-size:11px; letter-spacing:.01em; }
    .topology-edit-table-window__titlebar span { min-width:0; overflow:hidden; color:#94a3b8; font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
    .topology-edit-table-window[data-table-window-dragging="true"] .topology-edit-table-window__titlebar { cursor:grabbing; }
    .topology-edit-table-window__body { position:absolute; inset:36px 0 0; display:flex; min-width:0; min-height:0; overflow:hidden; padding:5px; background:#07101c; box-sizing:border-box; }
    .topology-edit-table-window__body > [data-role="topology-edit-table"] { display:flex; flex:1 1 0; flex-direction:column; min-width:0; min-height:0; }
    .topology-edit-table { display:grid; gap:.4rem; min-width:0; min-height:0; height:100%; overflow:auto; scrollbar-gutter:stable; font-size:11px; line-height:1.25; color:#cbd5e1; }
    .topology-edit-table-window__body > [data-role="topology-edit-table"] > .topology-edit-table--populated { flex:1 1 0; min-width:0; min-height:0; height:auto; }
    .topology-edit-table--populated { display:flex; flex-direction:column; gap:0; overflow:hidden; }
    .topology-edit-table--populated > .topology-edit-table__header { flex:0 0 auto; margin-bottom:.4rem; }
    .topology-edit-table--empty-model { align-content:start; height:auto; min-height:100%; }
    .topology-edit-table__header { display:flex; align-items:end; justify-content:space-between; gap:.55rem; }
    .topology-edit-table__header > div { display:flex; flex-direction:column; gap:.1rem; min-width:0; }
    .topology-edit-table__header > div span { overflow:hidden; color:#94a3b8; text-overflow:ellipsis; white-space:nowrap; }
    .topology-edit-table__header label { display:grid; gap:.15rem; min-width:12rem; }
    .topology-edit-table input, .topology-edit-table select, .topology-edit-table textarea, .topology-edit-table button { font:inherit; }
    .topology-edit-table input, .topology-edit-table select, .topology-edit-table textarea { min-height:24px; min-width:0; width:100%; box-sizing:border-box; border:1px solid #315070; border-radius:.25rem; background:#07101c; color:#e2e8f0; padding:2px 5px; }
    .topology-edit-table textarea { resize:vertical; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; line-height:1.3; }
    .topology-edit-table button { min-height:26px; border:1px solid #315070; border-radius:.25rem; background:#0a1322; color:#cbd5e1; padding:2px 7px; cursor:pointer; }
    .topology-edit-table button:hover:not(:disabled), .topology-edit-table button:focus-visible { border-color:#60a5fa; background:#142239; color:#f8fafc; outline:none; }
    .topology-edit-table button:disabled { opacity:.45; cursor:not-allowed; }
    .topology-edit-table__upper { display:flex; flex:1 1 0; flex-direction:column; min-width:0; min-height:120px; overflow:hidden; }
    .topology-edit-table__scroll { min-width:0; min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-gutter:stable both-edges; border:1px solid #1e344c; border-radius:.3rem; background:#050c16; }
    .topology-edit-table__upper > .topology-edit-table__scroll { flex:1 1 0; }
    .topology-edit-table__window-notice { flex:0 0 auto; margin:.25rem 2px 0; padding:0 2px; }
    .topology-edit-table__splitter { position:relative; flex:0 0 8px; min-height:8px; margin:2px 0; cursor:row-resize; touch-action:none; outline:none; }
    .topology-edit-table__splitter::before { content:''; position:absolute; left:0; right:0; top:50%; height:1px; background:#315070; transform:translateY(-50%); }
    .topology-edit-table__splitter > span { position:absolute; top:50%; left:50%; width:44px; height:4px; border:1px solid #315070; border-radius:999px; background:#0b1a2d; transform:translate(-50%,-50%); pointer-events:none; box-sizing:border-box; }
    .topology-edit-table__splitter:hover::before, .topology-edit-table__splitter:focus-visible::before, .topology-edit-table--populated[data-table-splitter-resizing="true"] .topology-edit-table__splitter::before { height:2px; background:#38bdf8; }
    .topology-edit-table__splitter:hover > span, .topology-edit-table__splitter:focus-visible > span, .topology-edit-table--populated[data-table-splitter-resizing="true"] .topology-edit-table__splitter > span { border-color:#38bdf8; background:#10233a; }
    .topology-edit-table__splitter:focus-visible { box-shadow:0 0 0 1px #38bdf8 inset; }
    .topology-edit-table--populated[data-table-splitter-resizing="true"], .topology-edit-table--populated[data-table-splitter-resizing="true"] * { cursor:row-resize !important; user-select:none !important; }
    .topology-edit-table__lower { display:grid; gap:.4rem; min-width:0; min-height:96px; overflow:auto; overscroll-behavior:contain; scrollbar-gutter:stable; padding-right:2px; }
    .topology-edit-table--populated > .topology-edit-table__lower { flex:0 1 var(--topology-edit-table-detail-height,210px); }
    .topology-edit-table table { width:max-content; min-width:100%; border-collapse:separate; border-spacing:0; font-variant-numeric:tabular-nums; }
    .topology-edit-table th, .topology-edit-table td { padding:3px 5px; border-bottom:1px solid #14273c; white-space:nowrap; text-align:left; }
    .topology-edit-table tbody tr:not(.topology-edit-table__window-spacer) { height:33px; }
    .topology-edit-table__window-spacer, .topology-edit-table__window-spacer td { pointer-events:none; background:#050c16; }
    .topology-edit-table tbody tr:hover { background:#0b1a2d; }
    .topology-edit-table tbody tr[data-selected="true"] { background:#0b2941; box-shadow:inset 3px 0 #38bdf8; }
    .topology-edit-table thead { position:sticky; top:0; z-index:4; background:#0c192b; }
    .topology-edit-table th button { min-height:20px; border:0; background:transparent; padding:0; font-weight:700; }
    .topology-edit-table__cell-input { width:88px !important; min-height:20px !important; padding:0 4px !important; border-color:transparent !important; background:transparent !important; font-variant-numeric:tabular-nums; }
    .topology-edit-table__cell-input:focus { border-color:#60a5fa !important; background:#0a1727 !important; outline:none; }
    .topology-edit-table [data-table-compound-edit] { min-height:20px; border:0; background:transparent; padding:0 2px; color:#bae6fd; }
    .topology-edit-table [data-table-cell-state="needs-input"] { box-shadow:inset 0 0 0 1px #315070; }
    .topology-edit-table [data-table-cell-state="draft"] { box-shadow:inset 0 0 0 1px #38bdf8; }
    .topology-edit-table [data-table-cell-state="staged"] { box-shadow:inset 0 0 0 1px #34d399; }
    .topology-edit-table [data-table-cell-state="invalid"] { box-shadow:inset 0 0 0 1px #f87171; }
    .topology-edit-table [data-table-cell-state="invalid"] .topology-edit-table__cell-input { color:#fecaca; }
    .topology-edit-table [data-table-cell-state="stale"] { box-shadow:inset 0 0 0 1px #f59e0b; }
    .topology-edit-table [data-table-frozen] { position:sticky; box-sizing:border-box; }
    .topology-edit-table [data-table-frozen="select"] { left:0; width:58px; min-width:58px; max-width:58px; }
    .topology-edit-table [data-table-frozen="tag"] { left:58px; width:132px; min-width:132px; max-width:132px; overflow:hidden; text-overflow:ellipsis; }
    .topology-edit-table [data-table-frozen="elementType"] { left:190px; width:78px; min-width:78px; max-width:78px; overflow:hidden; text-overflow:ellipsis; }
    .topology-edit-table [data-table-frozen="connectFrom"] { left:268px; width:128px; min-width:128px; max-width:128px; overflow:hidden; text-overflow:ellipsis; }
    .topology-edit-table [data-table-frozen="connectTo"] { left:396px; width:128px; min-width:128px; max-width:128px; overflow:hidden; text-overflow:ellipsis; }
    .topology-edit-table thead [data-table-frozen] { z-index:6; background:#0c192b; }
    .topology-edit-table tbody [data-table-frozen] { z-index:2; background:#050c16; }
    .topology-edit-table tbody tr:hover [data-table-frozen] { background:#0b1a2d; }
    .topology-edit-table tbody tr[data-selected="true"] [data-table-frozen] { background:#0b2941; }
    .topology-edit-table tr[data-staged="true"] { outline:1px solid #38bdf8; outline-offset:-1px; }
    .topology-edit-table [data-table-select] { min-height:20px; border:0; background:transparent; padding:0 2px; color:#7dd3fc; }
    .topology-edit-table__editor, .topology-edit-table__staged, .topology-edit-table__all-properties { display:grid; gap:.4rem; padding:.45rem; border:1px solid #1e344c; border-radius:.3rem; background:#081321; }
    .topology-edit-table__identity { display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; min-width:0; }
    .topology-edit-table__identity code { max-width:100%; overflow:hidden; color:#7dd3fc; opacity:.9; text-overflow:ellipsis; }
    .topology-edit-table__editor-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.4rem; align-items:end; }
    .topology-edit-table__editor-grid label { display:grid; gap:.15rem; min-width:0; }
    .topology-edit-table__editor-grid .topology-edit-table__wide { grid-column:1 / -1; }
    .topology-edit-table__editor-grid > button { grid-column:1 / -1; width:100%; }
    .topology-edit-table__first-pipe { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.5rem; }
    .topology-edit-table__first-pipe fieldset { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.3rem; min-width:0; margin:0; padding:.45rem; border:1px solid #1e344c; border-radius:.3rem; }
    .topology-edit-table__first-pipe legend { padding:0 .2rem; color:#bae6fd; font-weight:700; }
    .topology-edit-table__first-pipe label { display:grid; gap:.15rem; min-width:0; }
    .topology-edit-table__first-pipe > .topology-edit-table__wide { grid-column:1 / -1; }
    .topology-edit-table__custody { display:flex; gap:.55rem; flex-wrap:wrap; color:#94a3b8; font-size:10px; }
    .topology-edit-table__staged ul, .topology-edit-table__conflict ul { margin:.15rem 0 0; padding-left:1rem; }
    .topology-edit-table__conflict { padding:.4rem; border:1px solid #f59e0b; border-radius:.3rem; color:#fde68a; }
    .topology-edit-table__workflow { display:flex; gap:.3rem; flex-wrap:wrap; position:sticky; bottom:0; z-index:5; padding:.3rem 0; background:linear-gradient(180deg,rgba(7,16,28,.78),#07101c 35%); }
    .topology-edit-table__workflow [data-table-action="apply"] { border-color:#047857; background:#064e3b; color:#d1fae5; }
    .topology-edit-table__status, .topology-edit-table__notice, .topology-edit-table__empty { color:#94a3b8; }
    .topology-edit-table__all-properties > header { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }
    .topology-edit-table__all-properties > header span { color:#94a3b8; font-size:10px; }
    .topology-edit-table__property-group { border:1px solid #1a3047; border-radius:.3rem; background:#060f1a; overflow:hidden; }
    .topology-edit-table__property-group > summary { padding:.3rem .4rem; cursor:pointer; color:#bae6fd; font-weight:700; background:#0a1727; }
    .topology-edit-table__property-scroll { max-height:14rem; overflow:auto; scrollbar-gutter:stable; }
    .topology-edit-table__property-group table { width:100%; min-width:560px; table-layout:auto; }
    .topology-edit-table__property-group tbody th { color:#bae6fd; font-weight:600; }
    .topology-edit-table__property-group td:nth-child(2) { max-width:44rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .topology-edit-table__property-group td:nth-child(3) { color:#94a3b8; }
    @media (max-width:900px) { .topology-edit-table-window { left:6px !important; right:6px !important; width:auto; max-width:none; } }
    @media (max-width:760px) { .topology-edit-table__header { align-items:stretch; flex-direction:column; } .topology-edit-table__header label { min-width:0; } .topology-edit-table__editor-grid, .topology-edit-table__first-pipe { grid-template-columns:1fr; } .topology-edit-table__editor-grid .topology-edit-table__wide, .topology-edit-table__editor-grid > button, .topology-edit-table__first-pipe > .topology-edit-table__wide { grid-column:1; } }
  `,e.head?.append(o),r=!0}export{d as L,n as a,g as b,s as c,c as d,p as e,l};
