import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../data/model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Strategy(){
  const {S, setS, D, ask, aiReady, log, toast} = useStore();
  const R0 = strategyScores(S, D);
  const [exp, setExp] = useState({busy:false,text:'',error:''});
  const setW = (k,v) => setS(s=>({...s, strat:{...s.strat, weights:{...s.strat.weights,[k]:v}}}));
  const setI = (k,v) => setS(s=>({...s, strat:{...s.strat, inputs:{...s.strat.inputs,[k]:v}}}));
  const tips = ['redesign','history','downtime','timeline'].map(k => {
    const res = [1,5].map(v => strategyScores(S, D, {...S.strat.inputs, [k]: v}).winner);
    const crit = STRAT_CRITERIA.find(c=>c.k===k);
    return res.some(w => w !== R0.winner) ? `If “${crit.label}” moved to ${res[0] !== R0.winner ? 'its lowest' : 'its highest'} setting, ${res[0] !== R0.winner ? res[0] : res[1]} would lead.` : null;
  }).filter(Boolean);
  const pending = S.approvals.find(a => a.type === 'strategy' && a.status === 'Pending');
  const raise = () => {
    setS(s => ({...s, approvals:[{id:'APR-' + pad(s.approvals.length+1,3), type:'strategy', title:`Adopt ${R0.winner} as the migration strategy`, detail:`Weighted score ${(R0.total[R0.winner]/5*100).toFixed(0)}%; ${Math.round(R0.evidenceShare*100)}% of weight from evidence.`, payload:R0.winner, approver:'Steering committee', requester:s.role, date:today, status:'Pending'}, ...s.approvals]}));
    log(`Raised strategy decision: ${R0.winner}`); toast('Decision sent to the steering committee');
  };
  const explain = async () => {
    setExp({busy:true,text:'',error:''});
    try { const {text} = await ask(`${AI_RULES}\n\nTask: explain the brownfield vs greenfield vs selective data transition comparison below to a steering committee. State the recommendation, the two or three facts that drive it, the main trade-offs, and which missing evidence would most change the answer. Do not give cost, duration or downtime figures.\n\nSCORES (0-5, weighted): ${JSON.stringify(R0.total)}\nPER CRITERION: ${JSON.stringify(R0.sc)}\nWEIGHTS: ${JSON.stringify(S.strat.weights)}\nASSUMPTION INPUTS (1-5): ${JSON.stringify(S.strat.inputs)}\nEVIDENCE: open blockers ${R0.b}, reusable custom code share ${(R0.reuse*100).toFixed(0)}%, open data-quality and BP findings ${R0.dqIssues}, objects without usage ${D.wrUnknown}\nTIPPING POINTS: ${JSON.stringify(tips)}`, {onText:({text})=>setExp(e=>({...e,text}))}); setExp({busy:false,text,error:''}); log('AI explained strategy trade-offs'); }
    catch(e) { setExp(x=>({...x,busy:false,error:aiErrorText(e)})); }
  };
  const inputLabels = {redesign:['Process redesign appetite','1 keep processes · 5 redesign broadly'], history:['Historical data needed in S/4HANA','1 open items only · 5 full history'], downtime:['Downtime tolerance','1 minimal window · 5 long window acceptable'], timeline:['Timeline pressure','1 flexible · 5 fixed deadline']};
  return <>
    <div className="page-head"><div><h1>Migration strategy comparison</h1><p className="sub">Brownfield, greenfield and selective data transition scored against weighted criteria. Evidence-based criteria come from the assessment; the rest are labelled assumptions you set.</p></div>
      <div className="actions">{aiReady && <button className="btn ai" onClick={explain} disabled={exp.busy}><Spark/>Explain trade-offs</button>}
        {S.strat.decision ? <span className="badge b-source">Decided: {S.strat.decision}</span> : <button className="btn primary" onClick={raise} disabled={!!pending}>{pending ? 'Awaiting approval' : 'Raise decision for approval'}</button>}</div></div>
    <MetaStrip source="Assessment data plus assumption inputs" date={today} evidence={`${Math.round(R0.evidenceShare*100)}% of weight from evidence`} conf={R0.evidenceShare >= 0.5 ? 'architect' : 'unknown'} owner="Steering committee" risk="High" action={S.strat.decision ? 'Plan delivery' : 'Raise decision'} review={S.strat.decision ? 'Approved' : pending ? 'Pending approval' : 'Draft'}/>
    <AIProposal title="Trade-off explanation" text={exp.text} busy={exp.busy} error={exp.error} onDismiss={()=>setExp({busy:false,text:'',error:''})}/>
    <div className="grid g3" style={{marginTop:12}}>{Object.entries(R0.total).map(([k,v]) => <div key={k} className="panel" style={{margin:0, borderColor: k===R0.winner?'var(--blue)':'var(--line)', borderWidth: k===R0.winner?2:1}}>
      <div className="row"><h2 style={{margin:0}}>{k}</h2>{k===R0.winner && <span className="badge b-architect">Leading</span>}</div>
      <div className="num" style={{fontSize:28,fontWeight:600,margin:'6px 0'}}>{(v/5*100).toFixed(0)}%</div>
      {STRAT_CRITERIA.map(c => <div key={c.k} style={{marginBottom:4}}><div className="row small"><span>{c.label}</span><span className="spacer"/><span className="num">{R0.sc[k][c.k].toFixed(1)}</span></div><div className="bar-h"><i style={{width:(R0.sc[k][c.k]/5*100)+'%', background:c.src==='evidence'?'var(--blue)':'var(--ink-3)'}}/></div></div>)}
      <p className="small muted" style={{marginTop:8}}>Indicative cost and duration: not estimated. Add commercial inputs and generate the plan; downtime ranges need mock-run measurements.</p>
    </div>)}</div>
    <div className="grid g2" style={{marginTop:16}}>
      <div className="panel"><h2>Criteria weights</h2>
        {STRAT_CRITERIA.map(c => <label key={c.k} className="row small" style={{marginBottom:8}}><span style={{width:210}}>{c.label} <span className={'badge ' + (c.src==='evidence'?'b-source':'b-rule')}>{c.src}</span></span><input type="range" min="0" max="40" value={S.strat.weights[c.k]} onChange={e=>setW(c.k, Number(e.target.value))} style={{flex:1}} aria-label={c.label + ' weight'}/><span className="num" style={{width:28,textAlign:'right'}}>{S.strat.weights[c.k]}</span></label>)}
      </div>
      <div className="panel"><h2>Assumption inputs</h2>
        {Object.entries(inputLabels).map(([k,[l,h]]) => <label key={k} className="field" style={{marginBottom:10}}><span>{l} <span className="muted">({h})</span></span><input type="range" min="1" max="5" value={S.strat.inputs[k]} onChange={e=>setI(k, Number(e.target.value))} aria-label={l}/></label>)}
        <h3>What would change the answer</h3>
        {tips.length ? <ul className="small">{tips.map(t=><li key={t}>{t}</li>)}</ul> : <p className="small muted">No single assumption flips the ranking at its extremes.</p>}
        <h3>Evidence behind the scores</h3>
        <ul className="small"><li>{R0.b} open blockers from the Readiness Check export</li><li>{(R0.reuse*100).toFixed(0)}% of custom objects with known usage can be kept or remediated</li><li>{R0.dqIssues} open data-quality and Business Partner findings</li><li>{D.wrUnknown} objects still lack usage evidence, which lowers confidence</li></ul>
      </div>
    </div>
  </>;
}

