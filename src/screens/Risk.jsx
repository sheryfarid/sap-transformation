import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../data/model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Risk(){
  const {S, setS, log, toast, ask, aiReady} = useStore();
  const [nr, setNr] = useState({title:'', l:3, i:3, owner:'Programme Director'});
  const [mit, setMit] = useState({id:null,busy:false,text:'',error:''});
  const grid = []; for (let i = 5; i >= 1; i--) for (let l = 1; l <= 5; l++) grid.push({l, i, n: S.risks.filter(r => r.l === l && r.i === i)});
  const tone = s => s >= 15 ? 'var(--bad-weak)' : s >= 8 ? 'var(--warn-weak)' : 'var(--good-weak)';
  const setCut = (id, patch, what) => { setS(s => ({...s, cutover: s.cutover.map(c => c.id === id ? {...c, ...patch} : c)})); log(what); };
  const draft = async r => {
    setMit({id:r.id,busy:true,text:'',error:''});
    try { const {text} = await ask(`${AI_RULES}\n\nTask: propose three concrete mitigation actions and one early-warning indicator for this programme risk. Keep it under 120 words.\n\nRISK: ${JSON.stringify(r)}`, {onText:({text})=>setMit(m=>({...m,text}))}); setMit(m=>({...m,busy:false})); }
    catch(e){ setMit(m=>({...m,busy:false,error:aiErrorText(e)})); }
  };
  return <>
    <div className="page-head"><div><h1>Risk and cutover</h1><p className="sub">The RAID log and the cutover runbook. Go/no-go gates stay locked until every step before them is signed off by its owner.</p></div></div>
    <MetaStrip source="RAID log, cutover runbook" date={today} evidence="Manual entries" conf="architect" owner="Programme Director" risk={S.risks.some(r=>r.l*r.i>=15) ? 'High' : 'Medium'} action="Review high risks weekly" review={`${S.cutover.filter(c=>c.signed).length} of ${S.cutover.length} steps signed`}/>
    <div className="grid g-main">
      <div className="panel">
        <h2>Risk register</h2>
        <div className="tw"><table className="t"><thead><tr><th>ID</th><th>Risk</th><th>Owner</th><th className="r">L×I</th><th></th></tr></thead>
          <tbody>{S.risks.slice().sort((a,b)=>b.l*b.i-a.l*a.i).map(r => <React.Fragment key={r.id}><tr style={{cursor:'default'}}><td>{r.id}</td><td>{r.title}</td><td className="small">{r.owner}</td><td className="r num" style={{background:tone(r.l*r.i)}}>{r.l}×{r.i}</td><td>{aiReady && <button className="btn ai sm" onClick={()=>draft(r)}><Spark/>Mitigations</button>}</td></tr>
            {mit.id === r.id && <tr><td colSpan="5"><AIProposal title="Mitigation ideas" text={mit.text} busy={mit.busy} error={mit.error} onDismiss={()=>setMit({id:null,busy:false,text:'',error:''})}/></td></tr>}</React.Fragment>)}</tbody></table></div>
        <div className="row" style={{marginTop:12}}>
          <input placeholder="New risk" value={nr.title} onChange={e=>setNr({...nr,title:e.target.value})} style={{flex:1,height:32,border:'1px solid var(--line)',borderRadius:6,padding:'0 8px',background:'var(--surface)'}} aria-label="New risk"/>
          <select value={nr.l} onChange={e=>setNr({...nr,l:Number(e.target.value)})} aria-label="Likelihood">{[1,2,3,4,5].map(n=><option key={n} value={n}>L{n}</option>)}</select>
          <select value={nr.i} onChange={e=>setNr({...nr,i:Number(e.target.value)})} aria-label="Impact">{[1,2,3,4,5].map(n=><option key={n} value={n}>I{n}</option>)}</select>
          <button className="btn" disabled={!nr.title.trim()} onClick={()=>{setS(s=>({...s,risks:[...s.risks,{id:'RSK-'+pad(s.risks.length+1,2),title:nr.title,l:nr.l,i:nr.i,owner:nr.owner,area:'General'}]})); log('Added risk: ' + nr.title); setNr({...nr,title:''});}}>Add risk</button>
        </div>
      </div>
      <div className="panel"><h2>Likelihood × impact</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:3}}>{grid.map(c => <div key={c.l+'-'+c.i} style={{background:tone(c.l*c.i),borderRadius:4,height:44,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600}} className="num" title={c.n.map(r=>r.title).join('\n')}>{c.n.length || ''}</div>)}</div>
        <div className="row small muted" style={{marginTop:6}}><span>Likelihood →</span><span className="spacer"/><span>Impact ↑</span></div>
      </div>
    </div>
    <div className="panel">
      <h2>Cutover runbook</h2>
      <div className="tw"><table className="t"><thead><tr><th>Step</th><th>Task</th><th>Owner</th><th>Done</th><th>Owner sign-off</th></tr></thead>
        <tbody>{S.cutover.map((c, idx) => { const isGate = c.group === 'Gate'; const blocked = isGate && S.cutover.slice(0, idx).some(x => !x.signed); return <tr key={c.id} style={{cursor:'default', fontWeight: isGate ? 600 : 400}}>
          <td>{c.id}</td><td>{c.task}{blocked && <div className="small" style={{color:'var(--warn)',fontWeight:400}}>Locked until earlier steps are signed</div>}</td><td className="small">{c.owner}</td>
          <td><input type="checkbox" checked={c.done} disabled={blocked} onChange={e=>setCut(c.id,{done:e.target.checked, signed: e.target.checked ? c.signed : false}, `${e.target.checked?'Completed':'Reopened'} ${c.id}`)} aria-label={'Done: ' + c.task}/></td>
          <td><input type="checkbox" checked={c.signed} disabled={!c.done || blocked} onChange={e=>setCut(c.id,{signed:e.target.checked}, `${e.target.checked?'Signed off':'Withdrew sign-off for'} ${c.id} as ${S.role}`)} aria-label={'Signed: ' + c.task}/></td></tr>; })}</tbody></table></div>
    </div>
  </>;
}

