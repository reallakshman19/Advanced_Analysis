#!/usr/bin/env python3
import argparse, importlib, json, os, re, subprocess, sys, tempfile
from pathlib import Path
import yaml

REPO='reallaksh19/Advanced_Analysis'; PR=1847; ROUTE='SERIAL:EP-0001'; EPID='EP-0001'
EPP='agents/relay/execution-packages/EP-0001.yaml'; BR='fix/lafea4-trunk-green-b5-execution'
WF='LAFEA.4 shell scalability exact-head validation'; PREP='chatgpt-preparer-ep0001-20260919'

def load(p):
 d=yaml.safe_load(Path(p).read_text());
 if not isinstance(d,dict): raise ValueError(f'{p}: expected mapping')
 return d

def req(c,m):
 if not c: raise ValueError(m)

def cmd(cwd,*a,check=True):
 p=subprocess.run(a,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if check and p.returncode: raise ValueError(f"command failed ({p.returncode}): {' '.join(a)}\n{p.stderr.strip()}")
 return p

def git(cwd,*a,check=True): return cmd(cwd,'git',*a,check=check)
def gh(cwd,e): return json.loads(cmd(cwd,'gh','api',e).stdout)
def O(n,v,*b): return {'name':n,'value':v,'basis':list(b)}
def S(i,o,*b): return {'id':i,'status':'PASS','outputs':o,'basis':list(b)}
def atomic(p,s):
 p.parent.mkdir(parents=True,exist_ok=True); fd,t=tempfile.mkstemp(prefix=p.name+'.',dir=p.parent)
 try:
  with os.fdopen(fd,'w') as f:f.write(s)
  os.replace(t,p)
 except Exception:
  try: os.unlink(t)
  except FileNotFoundError: pass
  raise

def vr(p):
 t=Path(p).read_text(); h=None; d=None
 for k in ('MATERIAL_HEAD','EXECUTION_HEAD'):
  m=re.search(rf'^{k}:\s*([^\s]+)',t,re.M)
  if m:h=m.group(1);break
 for k in ('CONCLUSION','RESULT','DISPOSITION'):
  m=re.search(rf'^{k}:\s*([^\n]+)',t,re.M)
  if m:d=m.group(1).strip();break
 return {'head':h,'disposition':d}

def main():
 a=argparse.ArgumentParser(); a.add_argument('repo_root',nargs='?',default='.'); a.add_argument('--common-root',required=True); a.add_argument('--candidate-id',required=True); a.add_argument('--disc-id'); a.add_argument('--output'); x=a.parse_args()
 root=Path(x.repo_root).resolve(); common=Path(x.common_root).resolve(); cand=x.candidate_id.strip(); req(cand,'invalid candidate id')
 scripts=common/'skills/engineering-pr-delivery-v2.5/scripts'; req(scripts.is_dir(),f'missing Common scripts: {scripts}'); sys.path.insert(0,str(scripts))
 tl=importlib.import_module('takeoverlib'); vd=importlib.import_module('validate_discovery_receipt')
 st=load(root/'agents/relay/REPO_STATE.yaml'); pin=str((st.get('relay_protocol') or {}).get('basis_ref') or ''); req(pin,'missing protocol basis'); ch=git(common,'rev-parse','HEAD').stdout.strip(); req(ch==pin,f'Common HEAD {ch} != pinned {pin}')
 routes=tl.current_routes(root,st); req(len(routes)==1,'expected exactly one current route'); r=routes[0]; req(tl.route_key(r)==ROUTE and r.get('ep_id')==EPID and r.get('ep_path')==EPP,'route is not SERIAL:EP-0001')
 ep=load(root/EPP); ids={str(z.get('id')) for z in ep.get('repository_discovery',[]) if isinstance(z,dict)}; req({f'DSTEP-0{i}' for i in range(1,7)}<=ids,'missing DSTEP-01..06')
 d1=S('DSTEP-01',[O('active EP id and path',{'id':(st.get('active_ep')or{}).get('id'),'path':(st.get('active_ep')or{}).get('path')},'REPO_STATE'),O('roadmap id and revision',{'id':(st.get('roadmap')or{}).get('id'),'revision':(st.get('roadmap')or{}).get('revision')},'REPO_STATE'),O('current work package',(st.get('current_position')or{}).get('work_package'),'REPO_STATE'),O('material authority',((st.get('status_planes')or{}).get('execution')or{}).get('material_authority'),'REPO_STATE')],'REPO_STATE parsed')
 br=git(root,'branch','--show-current').stdout.strip(); head=git(root,'rev-parse','HEAD').stdout.strip(); gb=ep.get('git_basis')or{}; mat=str(gb.get('material_ref')or''); base=str(gb.get('base_observed_ref')or''); base_branch=str(gb.get('base_branch')or'main'); req(br==BR,f'wrong branch {br}'); anc=git(root,'merge-base','--is-ancestor',mat,head,check=False).returncode==0; req(anc,'material ref is not ancestor of HEAD')
 livebase=str(((gh(root,f'repos/{REPO}/branches/{base_branch}').get('commit')or{}).get('sha'))or''); req(livebase,'missing live main SHA'); drift='UNCHANGED_FROM_EP_BASE_OBSERVED_REF' if livebase==base else 'CHANGED_REQUIRES_V2_5_DRIFT_RECONCILIATION'
 d2=S('DSTEP-02',[O('checked-out branch',br,'git branch --show-current'),O('current HEAD',head,'git rev-parse HEAD'),O('material-ref ancestry result',anc,'git merge-base --is-ancestor'),O('current main base ref',livebase,f'GitHub branches/{base_branch}'),O('base drift result',drift,f'EP base={base}',f'live base={livebase}')],'live Git + GitHub base')
 changed=[q for q in git(root,'diff','--name-only',f'{base}...HEAD').stdout.splitlines() if q]; core=[q for q in changed if q.startswith('src/core/')]; req(not core,f'unplanned src/core changes: {core}'); b5=git(root,'diff','--stat',f'{base}...HEAD','--','scripts/lafea.4-a4-thickness-applicability-check.mjs').stdout.strip() or 'NO_B5_CHECKER_DELTA'; custody=[q for q in changed if q.startswith('agents/')]
 d3=S('DSTEP-03',[O('changed file list',changed,f'git diff --name-only {base}...HEAD'),O('presence or absence of src/core changes',{'present':bool(core),'files':core},'changed-file classification'),O('B5 checker delta',b5,'targeted B5 diff'),O('custody/relay delta',custody,'agents/** diff')],'base-observed...HEAD diff')
 vt=(root/'src/core/local-shell/result-validation.js').read_text(); ct=(root/'scripts/lafea.4-a4-thickness-applicability-check.mjs').read_text(); m=re.search(r'const DIRECT_SOLVER_EVIDENCE\s*=\s*\[([^\]]+)\]',vt,re.S); req(m,'DIRECT_SOLVER_EVIDENCE missing'); keys=re.findall(r"['\"]([^'\"]+)['\"]",m.group(1)); req('accepted' not in keys and ('\'accepted\'' in vt or '"accepted"' in vt),'solver evidence schema mismatch'); req("if (evidence.method === 'DETERMINISTIC_JACOBI_PCG')" in ct and 'evidence.accepted, undefined' in ct,'solverSnapshot repair missing'); req('shearEnergyFractionAbsoluteError: shearFractionAbsoluteError' in ct,'shear binding repair missing')
 d4=S('DSTEP-04',[O('direct solver evidence keys',keys,'result-validation DIRECT_SOLVER_EVIDENCE'),O('iterative evidence acceptance fields',['accepted','finalResidualInfinity','convergenceTarget'],'result-validation PCG evidence'),O('repaired solverSnapshot rule','PCG accepted+residual; dense Cholesky no accepted field + pivot record','B5 solverSnapshot'),O('retained shear-fraction variable name','shearFractionAbsoluteError','B5 retained row')],'production contract + checker inspection')
 vrroot=root/'agents/chains/ADV-LAFEA4-A4-1763/validation'; v={n:vr(vrroot/n) for n in ('VR-0001.md','VR-0002.md','VR-0003.md','VR-0004.md','VR-0010.md')}; ph=[v[n]['head'] for n in ('VR-0001.md','VR-0002.md','VR-0003.md')]; req(all(ph),'historical PASS head missing')
 d5=S('DSTEP-05',[O('historical PASS heads',ph,'VR-0001..3'),O('historical zero-step NOT_RUN basis',v['VR-0004.md'],'VR-0004'),O('current VR-0010 disposition',v['VR-0010.md'],'VR-0010')],'repository receipts')
 pr=gh(root,f'repos/{REPO}/pulls/{PR}'); live=str(((pr.get('head')or{}).get('sha'))or''); req(live==head,f'live PR head {live} != checkout {head}'); runs=gh(root,f'repos/{REPO}/actions/runs?event=pull_request&head_sha={live}&per_page=100').get('workflow_runs')or[]; sr=[z for z in runs if z.get('name')==WF]; rids=[z.get('id') for z in sr]; jp=[]
 for z in sr:
  for j in gh(root,f'repos/{REPO}/actions/runs/{z.get("id")}/jobs?per_page=100').get('jobs')or[]:
   ss=j.get('steps')or[]; jp.append({'run_id':z.get('id'),'job_id':j.get('id'),'job_name':j.get('name'),'step_count':len(ss),'has_executable_steps':bool(ss),'conclusion':j.get('conclusion')})
 d6=S('DSTEP-06',[O('live PR head SHA',live,f'GitHub pulls/{PR}'),O('workflow run ids',rids or ['NONE_FOUND'],'GitHub workflow runs'),O('job step presence/absence',jp or [{'status':'NO_MATCHING_WORKFLOW_JOB_FOUND'}],'GitHub job step arrays')],'authenticated live GitHub observation')
 basis=tl.expected_basis(root,st,r); bf={k:basis[k] for k in ('roadmap_id','roadmap_revision','relay_protocol_basis_ref','material_ref','ep_contract_digest','repo_profile_digest','predecessor_baton')}; did=x.disc_id or f'DISC-{cand}'; req(did.startswith('DISC-'),'bad DISC id')
 receipt={'schema_version':'relay-v2.5-discovery','id':did,'candidate':{'agent_instance_id':cand},'route':{'route_key':ROUTE,'mode':'SERIAL','execution_ref':EPID,'ep_id':EPID,'ep_path':EPP,'plan_id':None,'plan_path':None,'lane_id':None},'basis':bf,'steps':[d1,d2,d3,d4,d5,d6],'result':'PASS','conversation_context_used':False}
 rel=x.output or f'agents/relay/certifications/discovery/{did}.yaml'; op=(root/rel).resolve(); req(root in op.parents,'output must remain inside repo'); req(not op.exists(),f'output exists: {rel}')
 fd,t=tempfile.mkstemp(prefix='disc-',suffix='.yaml',dir=root); os.close(fd); tp=Path(t)
 try:
  tp.write_text(json.dumps(receipt,indent=2)+'\n'); errors,warns=vd.validate_file(root,tp,st,r,cand); req(not errors,'Common rejected DISC:\n'+'\n'.join(errors+warns)); atomic(op,json.dumps(receipt,indent=2)+'\n')
 finally: tp.unlink(missing_ok=True)
 print(json.dumps({'discovery_receipt':op.relative_to(root).as_posix(),'candidate':cand,'head':head,'base_drift':drift,'pinned_common_head':ch,'common_discovery_validation':'PASS','admission_mutated':False,'conversation_context_used':False},indent=2)); return 0
if __name__=='__main__': raise SystemExit(main())
