import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Modules(){
  const {S, setS, D, ask, aiReady, log} = useStore();
  const [sel, setSel] = useState(null);
  const [ws, setWs] = useState({busy:false,text:'',error:''});
  const stats = MODULES.map(m => {
    const f = D.fd.filter(x => x.module === m), w = D.wr.filter(o => o.module === m), r = D.rp.filter(x => x.module === m);
    const crit = f.filter(x => x.severity === 'Critical' || x.severity === 'High').length;
    const cx = Math.min(5, Math.max(1, Math.round((crit * 0.5 + w.length / 40 + r.length / 40)))) ;
    const fts = (S.fd['FTS-' + m] || {}).pct || 0;
    return {m, f, w, r, crit, cx, fts};
  });
  const s = sel ? stats.find(x => x.m === sel) : null;
  const setFts = (m, pct) => { setS(st => ({...st, fd:{...st.fd, ['FTS-' + m]:{pct}}})); log(`Fit-to-standard progress for ${m} set to ${pct}%`); };
  const prep = async () => {
    setWs({busy:true,text:'',error:''});
    try { const {text} = await ask(`${AI_RULES}\n\nTask: prepare a fit-to-standard workshop for the ${s.m} (${MODULE_NAMES[s.m]}) module. Base it on the actual findings and custom objects below, not on the module name alone. Give: agenda (5 items), likely process changes, questions to ask the business, decisions needed, evidence still missing.\n\nFINDINGS: ${JSON.stringify(s.f.map(x=>({id:x.id,title:x.title,severity:x.severity})).slice(0,25))}\nCUSTOM OBJECTS SUMMARY: ${JSON.stringify(Object.fromEntries(DISPOSITIONS.map(d=>[d,s.w.filter(o=>o.disp===d).length])))}\nREPORTS: ${s.r.length}`, {onText:({text})=>setWs(w=>({...w,text}))}); setWs({busy:false,text,error:''}); log('AI prepared fit-to-standard workshop for ' + s.m); }
    catch(e) { setWs(w=>({...w,busy:false,error:aiErrorText(e)})); }
  };
  useEffect(() => setWs({busy:false,text:'',error:''}), [sel]);
  return <>
    <div className="page-head"><div><h1>Functional module assessment</h1><p className="sub">Complexity comes from each module’s actual findings, custom objects and reports, never from the module name alone. Fit-to-standard progress is recorded by the module lead.</p></div></div>
    <MetaStrip source="Readiness findings, WRICEF and report inventories" date="2026-09-15" evidence="Derived" conf="architect" owner="Functional leads" risk="Medium" action="Run fit-to-standard workshops" review={`${stats.filter(x=>x.fts===100).length} of 8 modules complete`}/>
    <div className="grid g3">{stats.map(x => <button key={x.m} className="panel" style={{textAlign:'left',cursor:'pointer',margin:0}} onClick={()=>setSel(x.m)}>
      <div className="row"><b>{x.m}</b><span className="muted">{MODULE_NAMES[x.m]}</span></div>
      <div className="row small" style={{marginTop:8}}><span>Complexity</span><span className="spacer"/><span className="num">{x.cx} of 5</span></div>
      <div className="row small"><span>Findings (high or critical)</span><span className="spacer"/><span className="num">{x.f.length} ({x.crit})</span></div>
      <div className="row small"><span>Custom objects · reports</span><span className="spacer"/><span className="num">{x.w.length} · {x.r.length}</span></div>
      <div className="row small" style={{marginTop:6}}><span>Fit-to-standard</span><span className="spacer"/><span className="num">{x.fts}%</span></div>
      <div className="bar-h"><i style={{width:x.fts+'%'}}/></div>
    </button>)}</div>
    {s && <Drawer title={`${s.m} · ${MODULE_NAMES[s.m]}`} onClose={()=>setSel(null)}>
      <dl className="kv">
        <dt>Business owner</dt><dd>{OWNERS[s.m]}</dd>
        <dt>Legacy version</dt><dd>ECC 6.0 EHP5 (ECP)</dd>
        <dt>Simplification items</dt><dd>{[...new Set(s.f.map(x=>x.title.replace(/ \(.*\)$/,'')))].slice(0,4).join('; ') || 'None recorded'}</dd>
        <dt>Custom-code remediation</dt><dd>{s.w.filter(o=>['REMEDIATE','REBUILD ON-STACK'].includes(o.disp)).length} objects</dd>
        <dt>BTP extension candidates</dt><dd>{s.w.filter(o=>o.disp==='REBUILD ON BTP').length} objects</dd>
        <dt>Licensing dependencies</dt><dd><Badge conf="unknown">Unknown</Badge> needs contract review</dd>
        <dt>Target alternative</dt><dd>S/4HANA standard for {MODULE_NAMES[s.m]} <Badge conf="architect"/></dd>
      </dl>
      <label className="field">Fit-to-standard progress<select value={s.fts} onChange={e=>setFts(s.m, Number(e.target.value))}>{[0,25,50,75,100].map(v=><option key={v} value={v}>{v}%</option>)}</select></label>
      <div className="row" style={{margin:'12px 0'}}>{aiReady && <button className="btn ai" onClick={prep} disabled={ws.busy}><Spark/>Prepare fit-to-standard workshop</button>}</div>
      <AIProposal title="Workshop pack (draft)" text={ws.text} busy={ws.busy} error={ws.error}/>
    </Drawer>}
  </>;
}

