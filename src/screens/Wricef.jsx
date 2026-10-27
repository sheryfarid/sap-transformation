import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../data/model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Wricef(){
  const {S, setS, D, ask, aiReady, log, toast, selection, setSelection, filterHint, setFilterHint} = useStore();
  const [tab, setTab] = useState('inventory');
  const [f, setF] = useState({type:'', mod:'', disp:'', status:'', q:'', usage:''});
  const [page, setPage] = useState(0);
  const [aiBatch, setAiBatch] = useState({busy:false, text:'', error:''});
  const [one, setOne] = useState({busy:false, text:'', error:'', out:null});
  useEffect(() => { if (filterHint && filterHint.screen === 'wricef') { setF(x => ({...x, ...filterHint.f})); setTab('inventory'); setFilterHint(null); } }, [filterHint]);
  const rows = D.wr.filter(o => (!f.type || o.type === f.type) && (!f.mod || o.module === f.mod) && (!f.disp || o.disp === f.disp) && (!f.status || o.status === f.status) && (!f.usage || (f.usage === 'unknown' ? o.lastExecDays == null : o.lastExecDays != null)) && (!f.q || (o.id + o.tech + o.name).toLowerCase().includes(f.q.toLowerCase())));
  const sel = selection && selection.kind === 'wricef' ? D.wr.find(o => o.id === selection.id) : null;
  const setOv = (id, patch, what) => { setS(s => ({...s, wr:{...s.wr, [id]:{...(s.wr[id]||{}), ...patch, by:s.role}}})); if (what) log(what); };
  const acceptSafe = () => {
    const ids = D.wr.filter(o => o.status === 'proposed' && o.conf === 'source' && !o.critical && o.disp !== 'RETIRE').map(o => o.id);
    setS(s => { const wr = {...s.wr}; ids.forEach(id => { const o = D.wr.find(x=>x.id===id); wr[id] = {...(wr[id]||{}), d:o.disp, s:'accepted', c:'architect', by:s.role}; }); return {...s, wr}; });
    log(`Bulk-accepted ${ids.length} rule proposals backed by source evidence (non-critical, excluding RETIRE)`); toast(`${ids.length} proposals accepted`);
  };
  const aiReview = async () => {
    const batch = rows.filter(o => o.status === 'proposed' || o.status === 'manual').slice(0, 25);
    if (!batch.length) { setAiBatch({busy:false,text:'',error:'No open proposals in the current filter.'}); return; }
    setAiBatch({busy:true, text:`Reviewing ${batch.length} objects…`, error:''});
    const slim = batch.map(o => ({id:o.id, type:WR_TYPES[o.type], module:o.module, name:o.name, lastExecDays:o.lastExecDays, dependents:o.dependents, atcFindings:o.atc, businessCritical:o.critical, standardCandidate:o.standardMatch, cleanCoreViolation:o.cleanCoreViolation, obsoleteInterfaceTech:o.obsoleteTech, ruleProposal:o.rule.disp}));
    try {
      const out = await ask.json(`${AI_RULES}\n\nTask: review these WRICEF objects (synthetic data) and propose one disposition each from: ${DISPOSITIONS.join(', ')}.\nHard rules: if lastExecDays is null the disposition MUST be "MANUAL REVIEW". Never propose RETIRE for a businessCritical object. Prefer REPLACE when standardCandidate is true, and clean-core options for enhancements.\nReply with only a JSON array: [{"id":"R-0001","disposition":"REMEDIATE","rationale":"<max 25 words citing the fields>","confidence":"High|Medium|Low"}].\n\nOBJECTS: ${JSON.stringify(slim)}`, {modelTier:'default'});
      const arr = Array.isArray(out) ? out : [];
      let n = 0;
      setS(s => { const wr = {...s.wr}; arr.forEach(x => { const o = batch.find(b => b.id === x.id); if (!o || !DISPOSITIONS.includes(x.disposition)) return; let d = x.disposition; if (o.lastExecDays == null) d = 'MANUAL REVIEW'; if (o.critical && d === 'RETIRE') d = 'MANUAL REVIEW'; wr[o.id] = {...(wr[o.id]||{}), d, s:'ai', c:'ai', r:`${x.rationale} (AI confidence: ${x.confidence})`, by:'AI WRICEF Classifier'}; n++; }); return {...s, wr}; });
      setAiBatch({busy:false, text:`${arr.length} AI proposals added. They are marked “AI proposal” and need a person to accept them. Guardrails applied: no usage → manual review; no retirement of business-critical objects.`, error:''});
      log(`AI WRICEF Classifier proposed dispositions for ${arr.length} objects`);
    } catch(e) { setAiBatch({busy:false,text:'',error:aiErrorText(e)}); }
  };
  const aiOne = async () => {
    setOne({busy:true,text:'',error:'',out:null});
    try {
      const out = await ask.json(`${AI_RULES}\n\nTask: propose a disposition for this WRICEF object from ${DISPOSITIONS.join(', ')}. If lastExecDays is null you must answer MANUAL REVIEW. Reply with only JSON: {"disposition":"...","rationale":"<max 40 words>","confidence":"High|Medium|Low","validationSteps":["...","..."]}.\n\nOBJECT: ${JSON.stringify({...sel, rule:sel.rule})}`, {modelTier:'default'});
      setOne({busy:false, error:'', out, text:`${out.disposition}: ${out.rationale}\nConfidence: ${out.confidence}\nValidation steps:\n- ${(out.validationSteps||[]).join('\n- ')}`});
    } catch(e) { setOne({busy:false,text:'',error:aiErrorText(e),out:null}); }
  };
  useEffect(() => setOne({busy:false,text:'',error:'',out:null}), [sel && sel.id]);
  const per = 15;
  return <>
    <div className="page-head"><div><h1>WRICEF intelligence</h1><p className="sub">650 workflows, reports, interfaces, conversions, enhancements and forms. Rules propose a disposition from the evidence; the AI can review proposals; only a person can accept one.</p></div>
      <div className="actions">
        <button className="btn" onClick={acceptSafe}>Accept evidence-backed proposals</button>
        {aiReady && <button className="btn ai" onClick={aiReview} disabled={aiBatch.busy}><Spark/>AI review of filtered proposals (25)</button>}
      </div></div>
    <MetaStrip source="ATC results, repository export, usage imports" date={S.imports[0] && S.imports[0].date} evidence={`${D.wr.length - D.wrUnknown} of ${D.wr.length} with usage`} conf="source" owner="Ravi Iyer (ABAP lead)" risk={D.wrUnknown > 50 ? 'High' : 'Medium'} action={D.wrUnknown ? 'Import usage evidence' : `Review ${D.wrPending} proposals`} review={`${D.wrAccepted} accepted`}/>
    <AIProposal title="AI batch review" text={aiBatch.text} busy={aiBatch.busy} error={aiBatch.error} onDismiss={()=>setAiBatch({busy:false,text:'',error:''})}/>
    <div className="pill-tabs" role="tablist" style={{marginTop:12}}>{[['inventory','Inventory'],['review',`Bulk review (${D.wrPending})`],['matrix','Disposition matrix']].map(([k,l]) => <button key={k} aria-pressed={tab===k} onClick={()=>setTab(k)}>{l}</button>)}</div>
    {tab === 'inventory' && <>
      <div className="filters">
        <input placeholder="Search ID, name or technical name" value={f.q} onChange={e=>{setF(x=>({...x,q:e.target.value}));setPage(0);}} aria-label="Search"/>
        <select value={f.type} onChange={e=>{setF(x=>({...x,type:e.target.value}));setPage(0);}} aria-label="Type"><option value="">All types</option>{Object.entries(WR_TYPES).map(([k,v])=><option key={k} value={k}>{k} {v}</option>)}</select>
        <select value={f.mod} onChange={e=>{setF(x=>({...x,mod:e.target.value}));setPage(0);}} aria-label="Module"><option value="">All modules</option>{MODULES.map(m=><option key={m}>{m}</option>)}</select>
        <select value={f.disp} onChange={e=>{setF(x=>({...x,disp:e.target.value}));setPage(0);}} aria-label="Disposition"><option value="">All dispositions</option>{DISPOSITIONS.map(m=><option key={m}>{m}</option>)}</select>
        <select value={f.status} onChange={e=>{setF(x=>({...x,status:e.target.value}));setPage(0);}} aria-label="Status"><option value="">All statuses</option>{[['proposed','Rule proposal'],['ai','AI proposal'],['accepted','Accepted'],['rejected','Rejected'],['manual','Manual review']].map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        <select value={f.usage} onChange={e=>{setF(x=>({...x,usage:e.target.value}));setPage(0);}} aria-label="Usage evidence"><option value="">Any usage evidence</option><option value="unknown">No usage evidence</option><option value="known">Has usage evidence</option></select>
        {(f.type||f.mod||f.disp||f.status||f.q||f.usage) && <button className="btn ghost sm" onClick={()=>setF({type:'',mod:'',disp:'',status:'',q:'',usage:''})}>Clear filters</button>}
      </div>
      <div className="tw"><table className="t"><thead><tr><th>ID</th><th>Type</th><th>Name</th><th>Module</th><th className="r">Last run (days)</th><th className="r">Dependents</th><th className="r">ATC</th><th>Disposition</th><th>Status</th></tr></thead>
        <tbody>{rows.slice(page*per, page*per+per).map(o => <tr key={o.id} className={sel && sel.id===o.id?'sel':''} onClick={()=>setSelection({kind:'wricef',id:o.id})}>
          <td>{o.id}</td><td>{o.type}</td><td>{o.name}<div className="small muted">{o.tech}{o.critical ? ' · business-critical' : ''}</div></td><td>{o.module}</td>
          <td className="r num">{o.lastExecDays == null ? <Badge conf="unknown">Unknown</Badge> : o.lastExecDays === 999 ? 'Never' : o.lastExecDays}</td><td className="r num">{o.dependents}</td><td className="r num">{o.atc}</td><td>{o.disp}</td><td><StatusBadge s={o.status}/></td></tr>)}</tbody></table></div>
      <Pager page={page} setPage={setPage} total={rows.length} per={per}/>
    </>}
    {tab === 'review' && <BulkReview/>}
    {tab === 'matrix' && <Matrix onPick={(t,d)=>{setF({type:t,mod:'',disp:d,status:'',q:'',usage:''}); setTab('inventory'); setPage(0);}}/>}
    {sel && <Drawer title={sel.id + ' · ' + WR_TYPES[sel.type]} onClose={()=>setSelection(null)}>
      <p><b>{sel.name}</b><br/><span className="muted">{sel.tech} in package {sel.package}</span></p>
      <dl className="kv">{[['Module',sel.module + ' ' + MODULE_NAMES[sel.module]],['Business owner',sel.bizOwner],['Technical owner',sel.techOwner],['Last execution',sel.lastExecDays==null?'Unknown: no usage evidence':sel.lastExecDays===999?'Not executed in monitoring window':sel.lastExecDays + ' days ago' + (sel.usageSrc?' (imported)':'')],['Dependent objects',sel.dependents],['ATC findings',sel.atc],['Referenced tables',sel.tables],['Business-critical',sel.critical?'Yes':'No'],['Effort at current disposition',(S.rates[sel.disp]||0) + ' person-days (rate-card estimate)']].map(([k,v])=><React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
      <div className="rule-card" style={{marginBottom:12}}><h3>Rule proposal: {sel.rule.disp}</h3><p className="small" style={{margin:0}}>{sel.rule.rule}</p><div style={{marginTop:6}}><Badge conf={sel.rule.conf}/></div></div>
      {sel.rationale && <div className="proposal" style={{marginBottom:12}}><h4><Spark/>AI rationale</h4><div className="body">{sel.rationale}</div></div>}
      <div className="grid g2">
        <label className="field">Disposition<select value={sel.disp} onChange={e=>setOv(sel.id,{d:e.target.value, s:'proposed', c:'architect'}, `Changed ${sel.id} disposition to ${e.target.value}`)}>{DISPOSITIONS.map(d=><option key={d}>{d}</option>)}</select></label>
        <div className="field">Status<div><StatusBadge s={sel.status}/> {sel.by && <span className="small muted">by {sel.by}</span>}</div></div>
      </div>
      <div className="row" style={{margin:'12px 0'}}>
        <button className="btn primary" disabled={sel.disp==='MANUAL REVIEW'} onClick={()=>setOv(sel.id,{d:sel.disp,s:'accepted',c:sel.conf==='ai'?'architect':sel.conf},`Accepted ${sel.disp} for ${sel.id}`)}>Accept {sel.disp}</button>
        <button className="btn danger" onClick={()=>setOv(sel.id,{s:'rejected'},`Rejected proposal for ${sel.id}`)}>Reject</button>
        {aiReady && <button className="btn ai" onClick={aiOne} disabled={one.busy}><Spark/>Ask AI for a second opinion</button>}
      </div>
      {sel.critical && sel.disp === 'RETIRE' && <p className="small" style={{color:'var(--bad)'}}>Business-critical objects need the business owner’s individual sign-off to retire.</p>}
      <AIProposal title="Second opinion" text={one.text} busy={one.busy} error={one.error}
        onAccept={one.out && DISPOSITIONS.includes(one.out.disposition) ? () => setOv(sel.id,{d: sel.lastExecDays==null?'MANUAL REVIEW':one.out.disposition, s:'ai', c:'ai', r:one.out.rationale},'Recorded AI second opinion for ' + sel.id) : null}/>
    </Drawer>}
  </>;
}

function BulkReview(){
  const {S, setS, D, log} = useStore();
  const queue = useMemo(() => D.wr.filter(o => o.status === 'proposed' || o.status === 'ai').sort((a,b) => (b.critical - a.critical) || ((a.conf==='source') - (b.conf==='source'))), [D]);
  const [i, setI] = useState(0); const [edit, setEdit] = useState(false);
  const o = queue[Math.min(i, queue.length-1)];
  const decide = (s, d) => { if (!o) return; setS(st => ({...st, wr:{...st.wr, [o.id]:{...(st.wr[o.id]||{}), d: d || o.disp, s, c: s==='accepted' ? 'architect' : o.conf, by:st.role}}})); log(`${s === 'accepted' ? 'Accepted' : 'Rejected'} ${d || o.disp} for ${o.id} in bulk review`); setEdit(false); };
  useEffect(() => {
    const k = e => { if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return; const key = e.key.toLowerCase();
      if (key === 'a' && o && o.disp !== 'MANUAL REVIEW') decide('accepted'); else if (key === 'r') decide('rejected'); else if (key === 'n') setI(x => Math.min(x+1, queue.length-1)); else if (key === 'e') setEdit(true); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  if (!o) return <div className="panel empty">No proposals left to review. Accepted dispositions now feed the Activate plan.</div>;
  return <div className="grid g-main">
    <div className="tw" style={{maxHeight:560,overflow:'auto'}}><table className="t"><thead><tr><th>ID</th><th>Name</th><th>Proposal</th><th>Status</th></tr></thead>
      <tbody>{queue.slice(0,200).map((q,idx) => <tr key={q.id} className={q.id===o.id?'sel':''} onClick={()=>setI(idx)}><td>{q.id}{q.critical?' ●':''}</td><td>{q.name}</td><td>{q.disp}</td><td><StatusBadge s={q.status}/></td></tr>)}</tbody></table></div>
    <div className="panel">
      <div className="row"><h2 style={{margin:0}}>{o.id}</h2><StatusBadge s={o.status}/>{o.critical && <span className="badge b-unknown">Business-critical</span>}</div>
      <p>{o.name}<br/><span className="small muted">{o.tech} · {WR_TYPES[o.type]} · {o.module}</span></p>
      <dl className="kv"><dt>Last run</dt><dd>{o.lastExecDays==null?'Unknown':o.lastExecDays===999?'Never in window':o.lastExecDays+' days'}</dd><dt>Dependents</dt><dd>{o.dependents}</dd><dt>ATC findings</dt><dd>{o.atc}</dd><dt>Evidence</dt><dd><Badge conf={o.conf}/></dd></dl>
      <div className="rule-card"><b>{o.disp}</b><p className="small" style={{margin:'4px 0 0'}}>{o.rationale || o.rule.rule}</p></div>
      {edit ? <div className="row" style={{marginTop:12}}><select autoFocus defaultValue={o.disp} id="bulk-edit" aria-label="New disposition">{DISPOSITIONS.map(d=><option key={d}>{d}</option>)}</select><button className="btn primary sm" onClick={()=>decide('accepted', document.getElementById('bulk-edit').value)}>Accept edited</button><button className="btn sm" onClick={()=>setEdit(false)}>Cancel</button></div> :
      <div className="row" style={{marginTop:12}}>
        <button className="btn primary" onClick={()=>decide('accepted')} disabled={o.disp==='MANUAL REVIEW'}>Accept <span className="kbd">A</span></button>
        <button className="btn" onClick={()=>setEdit(true)}>Edit <span className="kbd">E</span></button>
        <button className="btn danger" onClick={()=>decide('rejected')}>Reject <span className="kbd">R</span></button>
        <button className="btn ghost" onClick={()=>setI(x=>Math.min(x+1,queue.length-1))}>Next <span className="kbd">N</span></button>
      </div>}
      <p className="small muted" style={{marginTop:12}}>{queue.length} proposals left. Business-critical and lower-confidence items come first.</p>
    </div>
  </div>;
}

function Matrix({onPick}){
  const {S, setS, D, log} = useStore();
  const types = Object.keys(WR_TYPES);
  return <div className="grid g-main">
    <div className="panel" style={{overflowX:'auto'}}>
      <h2>Disposition by object type</h2>
      <div className="matrix" style={{gridTemplateColumns:`120px repeat(${DISPOSITIONS.length}, minmax(64px,1fr))`, minWidth:760}}>
        <div className="h"></div>{DISPOSITIONS.map(d=><div key={d} className="h" style={{textAlign:'right'}}>{d}</div>)}
        {types.map(t => <React.Fragment key={t}><div className="h">{t} {WR_TYPES[t]}</div>{DISPOSITIONS.map(d => { const n = D.wr.filter(o=>o.type===t && o.disp===d).length; return <button key={d} className="num" onClick={()=>onPick(t,d)} aria-label={`${n} ${WR_TYPES[t]} objects with ${d}`}>{n || ''}</button>; })}</React.Fragment>)}
        <div className="h">Effort (pd)</div>{DISPOSITIONS.map(d=><div key={d} className="num" style={{textAlign:'right',fontWeight:600}}>{fmt(Math.round(D.dispCounts[d]*S.rates[d]))}</div>)}
      </div>
      <p className="small muted">Total {fmt(Math.round(D.effort))} person-days across all proposals; {fmt(Math.round(D.effortAccepted))} for accepted scope. Rates are labelled estimates you can change.</p>
    </div>
    <div className="panel">
      <h2>Rate card (person-days per object)</h2>
      {DISPOSITIONS.map(d => <label key={d} className="row small" style={{marginBottom:6}}><span style={{flex:1}}>{d}</span><input type="number" min="0" step="0.5" value={S.rates[d]} onChange={e=>{const v=Number(e.target.value); setS(s=>({...s, rates:{...s.rates,[d]:v}}));}} style={{width:80,height:28,border:'1px solid var(--line)',borderRadius:6,padding:'0 6px',background:'var(--surface)'}} aria-label={'Rate for ' + d}/></label>)}
      <button className="btn sm" onClick={()=>{setS(s=>({...s,rates:{...DEFAULT_RATES}})); log('Reset rate card');}}>Reset to defaults</button>
    </div>
  </div>;
}

