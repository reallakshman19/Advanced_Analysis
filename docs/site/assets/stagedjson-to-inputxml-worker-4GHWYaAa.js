(function(){"use strict";function l(r){return r==null?"":String(r)}function c(r,n,s){const e=l(s).trim();e&&r.push(`${n}=${e}`)}function i(r,n,s){const e=Number(s);Number.isFinite(e)&&r.push(n,String(e))}function E(r,n,s,e={}){const t=[r,"--input",n,"--output",s],o=l(e.inputxmlBookmark).trim(),d=l(e.inputxmlBookmarkJson).trim()||(o.startsWith("{")?o:""),f=o&&!o.startsWith("{")?o:"";return c(t,"--bookmark",f),c(t,"--bookmark-json",d),i(t,"--node-start",e.nodeStart),i(t,"--node-step",e.nodeStep),i(t,"--temperature1",e.temperature1),i(t,"--wall-thickness",e.wallThickness),i(t,"--modulus",e.modulus),i(t,"--material-num",e.materialNum),c(t,"--material-name",e.materialName),c(t,"--job-name",e.jobName),c(t,"--vertical-axis",e.verticalAxis),c(t,"--support-config-json",e.supportConfigJson),i(t,"--datum-e",e.datumE),i(t,"--datum-n",e.datumN),i(t,"--datum-u",e.datumU),e.inferOdFromNominalBore&&t.push("--infer-od-from-nominal-bore"),e.autoAnchors===!1&&t.push("--no-auto-anchors"),e.disableSupports&&t.push("--no-supports"),t}const x=new URL("vendor/pyodide/",new URL("/Advanced_Analysis/site/",self.location.href)).href,I=new URL("vendor/stagedjson-to-inputxml-scripts/",new URL("/Advanced_Analysis/site/",self.location.href)).href,j=Object.freeze(["inputxml_bookmark.py","stagedjson_inputxml_diagnostics.py","support_restraint.py","stagedjson_to_inputxml.py"]),T=`
import runpy
import sys
import traceback

exit_code = 0
sys.argv = list(job_argv)
try:
    runpy.run_path(job_script_path, run_name="__main__")
except SystemExit as exc:
    code = exc.code
    if code is None:
        exit_code = 0
    elif isinstance(code, int):
        exit_code = code
    else:
        print(code, file=sys.stderr)
        exit_code = 1
except Exception:
    traceback.print_exc()
    exit_code = 1

exit_code
`;let m=null,S=!1;async function $(){return m||(m=import(`${x}pyodide.mjs`).then(({loadPyodide:r})=>r({indexURL:x}))),m}async function F(r){if(!S){r.FS.mkdirTree("/scripts"),r.FS.mkdirTree("/work");for(const n of j){const s=await fetch(`${I}${n}`,{cache:"no-store"});if(!s.ok)throw new Error(`Failed to load converter script ${n}: HTTP ${s.status}`);const e=await s.text();if(!e.trim())throw new Error(`Converter script ${n} loaded as empty text.`);r.FS.writeFile(`/scripts/${n}`,e,{encoding:"utf8"})}r.runPython(`import sys
if "/scripts" not in sys.path:
    sys.path.insert(0, "/scripts")
`),S=!0}}function p(r){const n=String(r??"").trim();return n?n.replace(/[\\/:*?"<>|]/g,"_"):"staged.json"}function L(r){const n=p(r),s=n.lastIndexOf(".");return s>0?n.slice(0,s):n}async function v({stagedJsonText:r,sourceName:n,options:s,requestId:e}){const t=await $();await F(t);const o=`/work/${p(e)}`;t.FS.mkdirTree(o);const d=p(n||"staged.json"),f=L(d),y=`${o}/${d}`,g=`${f}_stagedjson_to_inputxml.xml`,b=`${o}/${g}`,N=`${g.replace(/\.xml$/i,"")}_stagedjson_to_inputxml_diagnostics.json`,P=`${o}/${N}`;t.FS.writeFile(y,new TextEncoder().encode(r));const k=E("/scripts/stagedjson_to_inputxml.py",y,b,s),_=[],h=[];t.setStdout({batched:a=>_.push(a)}),t.setStderr({batched:a=>h.push(a)}),t.globals.set("job_script_path",k[0]),t.globals.set("job_argv",k);const w=Number(await t.runPythonAsync(T));let u=null;try{u=JSON.parse(t.FS.readFile(P,{encoding:"utf8"}))}catch{u=null}if(w!==0){const a=new Error(u?"StagedJSON -> InputXML conversion failed; see diagnostics for details.":`StagedJSON -> InputXML conversion exited with code ${w}.`);throw a.code="STAGEDJSON_TO_INPUTXML_CONVERSION_FAILED",a.diagnostics=u,a.stdout=_,a.stderr=h,a}return{inputXmlText:t.FS.readFile(b,{encoding:"utf8"}),diagnostics:u,outputName:g,diagnosticsName:N,stdout:_,stderr:h}}globalThis.addEventListener("message",async r=>{const n=r.data??{};if(!(n.type!=="RUN"||typeof n.requestId!="string"))try{const s=await v({...n.input??{},requestId:n.requestId});globalThis.postMessage({type:"COMPLETE",requestId:n.requestId,result:s})}catch(s){globalThis.postMessage({type:"FAILURE",requestId:n.requestId,error:{name:s instanceof Error?s.name:"Error",message:s instanceof Error?s.message:"Unknown StagedJSON -> InputXML worker failure.",code:typeof s?.code=="string"?s.code:null,diagnostics:s?.diagnostics??null}})}})})();
