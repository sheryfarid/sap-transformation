import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../data/model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Hyperscaler(){
  const {S, setS, D, ask, aiReady, log, toast} = useStore();
  const H = S.hyper;
  const [exp, setExp] = useState({busy:false,text:'',error:''});
  const tw = Object.values(H.weights).reduce((a,c)=>a+c,0) || 1;
  const scoreOf = p => { const s = H.scores[p] || {}; const done = HYPER_CRITERIA.every(c => s[c.k] != null); return {done, filled: HYPER_CRITERIA.filter(c=>s[c.k]!=null).length, v: done ? HYPER_CRITERIA.reduce((a,c)=>a+H.weights[c.k]*s[c.k],0)/tw : null}; };
  const ranked = HYPER.map(p => ({p, ...scoreOf(p)})).sort((a,b)=>(b.v||-1)-(a.v||-1));
  const allDone = ranked.every(r => r.done);
  const setScore = (p,k,v) => setS(s=>({...s, hyper:{...s.hyper, scores:{...s.hyper.scores, [p]:{...(s.hyper.scores[p]||{}), [k]: v === '' ? null : Number(v)}}}}));
  const pending = S.approvals.find(a => a.type === 'hyperscaler' && a.status === 'Pending');
  const raise = p => { setS(s => ({...s, approvals:[{id:'APR-' + pad(s.approvals.length+1,3), type:'hyperscaler', title:`Select ${p} as the preferred RISE deployment target`, detail:`Ranked first on weighted criteria${H.synthetic?' (synthetic workshop scores)':''}. SAP must confirm region and model eligibility.`, payload:p, approver:'Steering committee', requester:s.role, date:today, status:'Pending'}, ...s.approvals]})); log(`Raised hyperscaler decision: ${p}`); toast('Decision sent to the steering committee'); };
  const explain = async () => {
    setExp({busy:true,text:'',error:''});
    try { const {text} = await ask(`${AI_RULES}\n\nTask: explain this RISE deployment comparison. Name how sensitive the ranking is to the weights (which weight change would flip first and second place), the technical gaps, and the exact items SAP must confirm (region eligibility, deployment model, HA/DR options). Never quote prices and never treat public cloud calculators as RISE pricing.\n\nREGION: ${H.region}\nWEIGHTS: ${JSON.stringify(H.weights)}\nSCORES (1-5): ${JSON.stringify(H.scores)}\nSYNTHETIC SCORES: ${H.synthetic}\nRANKING: ${JSON.stringify(ranked.map(r=>({provider:r.p, score:r.v})))}`, {onText:({text})=>setExp(e=>({...e,text}))}); setExp({busy:false,text,error:''}); log('AI explained hyperscaler sensitivity'); }
    catch(e){ setExp(x=>({...x,busy:false,error:aiErrorText(e)})); }
  };
  return <>
    <div className="page-head"><div><h1>Hyperscaler comparison</h1><p className="sub">Infrastructure under RISE with SAP is operated by SAP; this compares the eligible deployment options for ABC Manufacturing. No provider is ranked until every cell has a score, and no prices are shown.</p></div>
      <div className="actions">
        {!H.synthetic && <button className="btn" onClick={()=>{setS(s=>({...s, hyper:{...s.hyper, scores:JSON.parse(JSON.stringify(SYNTH_HYPER)), synthetic:true}})); log('Loaded synthetic workshop scores for hyperscaler comparison');}}>Load synthetic workshop scores</button>}
        {aiReady && allDone && <button className="btn ai" onClick={explain} disabled={exp.busy}><Spark/>Explain sensitivity</button>}
      </div></div>
    <MetaStrip source={H.synthetic ? 'Synthetic workshop scores' : 'Architect inputs'} date={today} evidence={`${D.hyperFilled} of ${D.hyperTotal} cells scored`} conf={allDone ? 'architect' : 'unknown'} owner="Solution Architect" risk="Medium" action={allDone ? 'Raise selection decision' : 'Complete scoring'} review={H.selected ? 'Selected: ' + H.selected : pending ? 'Pending approval' : 'Draft'}/>
    <AIProposal title="Sensitivity explanation" text={exp.text} busy={exp.busy} error={exp.error} onDismiss={()=>setExp({busy:false,text:'',error:''})}/>
    <div className="grid g-main" style={{marginTop:12}}>
      <div className="panel" style={{overflowX:'auto'}}>
        <div className="row" style={{marginBottom:10}}><h2 style={{margin:0}}>Comparison matrix</h2><span className="spacer"/><label className="field" style={{flexDirection:'row',alignItems:'center'}}>Target region <input value={H.region} onChange={e=>setS(s=>({...s,hyper:{...s.hyper,region:e.target.value}}))} style={{width:160}}/></label></div>
        <table className="t" style={{minWidth:620}}><thead><tr><th>Criterion</th><th className="r">Weight</th>{HYPER.map(p=><th key={p}>{p}</th>)}</tr></thead>
          <tbody>{HYPER_CRITERIA.map(c => <tr key={c.k} style={{cursor:'default'}}><td>{c.label}</td><td className="r"><input type="number" min="0" max="60" value={H.weights[c.k]} onChange={e=>setS(s=>({...s,hyper:{...s.hyper,weights:{...s.hyper.weights,[c.k]:Number(e.target.value)}}}))} style={{width:56,height:28,border:'1px solid var(--line)',borderRadius:6,background:'var(--surface)',padding:'0 4px'}} aria-label={c.label + ' weight'}/></td>
            {HYPER.map(p => { const v = (H.scores[p]||{})[c.k]; return <td key={p} style={v==null?{background:'var(--hatch)'}:{}}><select value={v==null?'':v} onChange={e=>setScore(p,c.k,e.target.value)} aria-label={`${p} ${c.label}`} style={{height:28,border:'1px solid var(--line)',borderRadius:6,background:'var(--surface)'}}><option value="">Unknown</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></td>; })}</tr>)}
            <tr style={{cursor:'default'}}><td><b>Weighted score</b></td><td className="r num">{tw}</td>{HYPER.map(p => { const s = scoreOf(p); return <td key={p} className="num"><b>{s.done ? (s.v/5*100).toFixed(0) + '%' : `${s.filled}/6 scored`}</b></td>; })}</tr>
          </tbody></table>
        {H.synthetic && <p className="small" style={{color:'var(--warn)'}}>Scores are synthetic workshop values for the demo, not provider assessments.</p>}
      </div>
      <div>
        <div className="panel"><h2>Recommendation</h2>
          {allDone ? <>
            <p><b>{ranked[0].p}</b> ranks first at {(ranked[0].v/5*100).toFixed(0)}%, ahead of {ranked[1].p} at {(ranked[1].v/5*100).toFixed(0)}%.</p>
            {H.selected ? <span className="badge b-source">Selected: {H.selected}</span> : <button className="btn primary" disabled={!!pending} onClick={()=>raise(ranked[0].p)}>{pending ? 'Awaiting approval' : `Raise decision: ${ranked[0].p}`}</button>}
          </> : <p className="muted">Ranking appears when all {D.hyperTotal} cells are scored. {D.hyperTotal - D.hyperFilled} are unknown.</p>}
        </div>
        <div className="panel"><h2>Required SAP confirmation</h2>
          <ul className="small"><li>RISE availability of the chosen provider in {H.region}</li><li>Deployment model and SAP-managed responsibilities</li><li>High availability and disaster recovery options and RPO/RTO</li><li>Network connectivity options to the plants and data centre</li><li>Commercial terms in the RISE contract (not public cloud prices)</li></ul>
        </div>
      </div>
    </div>
  </>;
}

