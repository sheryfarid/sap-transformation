import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Plan(){
  const {S, setS, D, log, toast, ask, aiReady} = useStore();
  const P = S.plan; const M = planModel(S, D);
  const [cr, setCr] = useState(''); const [risk, setRisk] = useState({busy:false,text:'',error:''});
  const pending = S.approvals.find(a => a.type === 'plan' && a.status === 'Pending');
  const setP = patch => setS(s => ({...s, plan:{...s.plan, ...patch}}));
  const lock = P.baselined;
  const generate = () => { setP({generated:true}); log(`Generated Activate plan: ${M.total} weeks, ${Math.round(M.realizeEffort)} person-days in Realize (estimate)`); toast('Plan generated from accepted scope'); };
  const submit = () => { setS(s => ({...s, approvals:[{id:'APR-' + pad(s.approvals.length+1,3), type:'plan', title:'Baseline the SAP Activate plan', detail:`${M.total} weeks from ${P.start}, ${P.fte} FTE, Realize ${M.weeks.Realize} weeks (estimate).`, approver:'Programme Director', requester:s.role, date:today, status:'Pending'}, ...s.approvals]})); log('Submitted plan for baseline approval'); toast('Plan submitted for baseline approval'); };
  const riskCheck = async () => {
    setRisk({busy:true,text:'',error:''});
    try { const {text} = await ask(`${AI_RULES}\n\nTask: review this generated plan for critical-path risks, resource overloads and missing entry criteria before each gate. Recommend changes as change requests (the plan may be baselined). Use only the data.\n\nPLAN: ${JSON.stringify({start:P.start, fte:P.fte, phases:M.ph, criticalWorkstreams:M.critical, realizeEffortPersonDays:Math.round(M.realizeEffort), acceptedWricef:D.wrAccepted, pendingWricef:D.wrPending, unknownUsage:D.wrUnknown, strategyDecision:S.strat.decision, openBlockers:D.blockers.length})}`, {onText:({text})=>setRisk(r=>({...r,text}))}); setRisk({busy:false,text,error:''}); }
    catch(e){ setRisk(r=>({...r,busy:false,error:aiErrorText(e)})); }
  };
  const pct = wk => (wk / M.total * 100) + '%';
  return <>
    <div className="page-head"><div><h1>SAP Activate plan</h1><p className="sub">Generated from accepted scope and labelled estimates. After the programme director baselines it, nobody, including the AI, can change it directly; changes go through change requests.</p></div>
      <div className="actions">
        {!P.generated ? <button className="btn primary" onClick={generate}>Generate plan</button> : !lock && <button className="btn primary" onClick={submit} disabled={!!pending}>{pending ? 'Awaiting baseline approval' : 'Submit for baseline'}</button>}
        {P.generated && aiReady && <button className="btn ai" onClick={riskCheck} disabled={risk.busy}><Spark/>Check critical path</button>}
      </div></div>
    <MetaStrip source="Accepted WRICEF scope, open findings, rate card" date={today} evidence={`${D.wrAccepted} of ${D.wr.length} objects accepted`} conf={D.wrAccepted > 300 ? 'architect' : 'unknown'} owner="Programme Director" risk={S.strat.decision ? 'Medium' : 'High'} action={lock ? 'Track delivery' : P.generated ? 'Submit for baseline' : 'Generate plan'} review={lock ? 'Baselined' : pending ? 'Pending approval' : 'Draft'}/>
    {!S.strat.decision && <div className="rule-card" style={{marginBottom:12}}><b>No approved strategy yet.</b> <span className="small">The plan uses a generic conversion structure until the steering committee approves a strategy.</span></div>}
    {D.wrPending > 0 && <div className="rule-card" style={{marginBottom:12}}><b>{D.wrPending} WRICEF proposals are not yet accepted</b> <span className="small">and are excluded from Realize effort. Accepting them will lengthen Realize.</span></div>}
    <AIProposal title="Critical-path review" text={risk.text} busy={risk.busy} error={risk.error} onDismiss={()=>setRisk({busy:false,text:'',error:''})}/>
    <div className="grid" style={{marginTop:12}}>
      <div className="panel" style={{overflowX:'auto'}}>
        {P.generated ? <div className="gantt" style={{minWidth:640}}>
          <div className="row" style={{display:'grid',gridTemplateColumns:'170px 1fr'}}><div/><div style={{position:'relative',height:36}}>{M.ph.map(x => <div key={x.p} style={{position:'absolute',left:pct(x.s),width:`calc(${pct(x.e-x.s)} - 2px)`,top:0,background:'var(--surface-2)',borderRadius:4,padding:'2px 6px',fontSize:11.5,overflow:'hidden',whiteSpace:'nowrap'}}><b>{x.p}</b><div className="muted">{x.e-x.s} wk</div></div>)}</div></div>
          {WORKSTREAMS.map(w => <div key={w} className="row" style={{display:'grid',gridTemplateColumns:'170px 1fr'}}><div className="small">{w}{M.critical.includes(w) && <span className="sev-High"> ●</span>}</div><div className="lane">
            <div className={'bar' + (M.critical.includes(w)?' crit':'')} style={{left:pct(M.ws[w].s), width:pct(M.ws[w].e - M.ws[w].s)}} title={`${w}: ${M.dateAt(M.ws[w].s)} to ${M.dateAt(M.ws[w].e)}`}/></div></div>)}
          <div className="row" style={{display:'grid',gridTemplateColumns:'170px 1fr'}}><div className="small"><b>Quality gates</b></div><div className="lane">{M.ph.map(x => <div key={x.p} className="bar gate" style={{left:`calc(${pct(x.e)} - 8px)`}} title={`Gate after ${x.p}: ${M.dateAt(x.e)}`}/>)}</div></div>
          <p className="small muted" style={{marginTop:8}}>● critical path · ◆ quality gate. {M.total} weeks from {P.start} to {M.dateAt(M.total)}; Realize sized from {fmt(Math.round(M.realizeEffort))} person-days ({fmt(Math.round(D.effortAccepted))} WRICEF + {fmt(M.findingEffort)} findings) at {P.fte} FTE × 4 productive days a week. All durations are estimates.</p>
        </div> : <div className="empty">Generate the plan to see phases, workstreams, the critical path and quality gates.</div>}
      </div>
      <div>
        <div className="panel"><h2>Assumptions</h2><div className="grid g3">
          <label className="field">Start date<input type="date" value={P.start} disabled={lock} onChange={e=>setP({start:e.target.value})}/></label>
          <label className="field">Delivery team (FTE)<input type="number" min="1" value={P.fte} disabled={lock} onChange={e=>setP({fte:Number(e.target.value)})}/></label>
          {Object.keys(P.phaseWeeks).map(p => <label key={p} className="field">{p} (weeks)<input type="number" min="1" value={P.phaseWeeks[p]} disabled={lock} onChange={e=>setP({phaseWeeks:{...P.phaseWeeks,[p]:Number(e.target.value)}})}/></label>)}
          </div><p className="small muted">Realize is calculated from accepted effort and team size, not entered.</p>
        </div>
        {lock && <div className="panel"><h2>Change requests</h2>
          <label className="field">Describe the change<textarea rows="3" value={cr} onChange={e=>setCr(e.target.value)}/></label>
          <button className="btn sm" style={{marginTop:8}} disabled={!cr.trim()} onClick={()=>{setS(s=>({...s,plan:{...s.plan,crs:[{id:'CR-'+pad(s.plan.crs.length+1,3),text:cr,by:s.role,date:today,status:'Open'},...s.plan.crs]}})); log('Raised change request: ' + cr); setCr('');}}>Raise change request</button>
          {P.crs.map(c => <div key={c.id} className="small" style={{marginTop:8,borderTop:'1px solid var(--line-2)',paddingTop:6}}><b>{c.id}</b> {c.text}<div className="muted">{c.by} · {c.date} · {c.status}</div></div>)}
        </div>}
      </div>
    </div>
  </>;
}

