import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Readiness(){
  const {S, setS, D, ask, aiReady, log, toast, selection, setSelection} = useStore();
  const [f, setF] = useState({sev:'', mod:'', cat:'', owner:'', q:''});
  const [page, setPage] = useState(0);
  const [exp, setExp] = useState({text:'',busy:false,error:''});
  const rows = D.fd.filter(x => (!f.sev || x.severity === f.sev) && (!f.mod || x.module === f.mod) && (!f.cat || x.category === f.cat) && (!f.owner || (f.owner === 'none' ? !x.owner : !!x.owner)) && (!f.q || (x.title + x.id).toLowerCase().includes(f.q.toLowerCase())));
  const sel = selection && selection.kind === 'finding' ? D.fd.find(x => x.id === selection.id) : null;
  const upd = (id, patch) => setS(s => ({...s, fd:{...s.fd, [id]:{...(s.fd[id]||{}), ...patch}}}));
  const cats = [...new Set(FINDINGS.map(x=>x.category))];
  const explain = async () => {
    setExp({text:'',busy:true,error:''});
    try { const {text} = await ask(`${AI_RULES}\n\nTask: explain this readiness finding to a business owner in plain language: what changes, business impact, what to decide, and which evidence to collect. Do not invent SAP note numbers.\n\nFINDING: ${JSON.stringify(sel)}`, {onText:({text})=>setExp(e=>({...e,text}))}); setExp({text,busy:false,error:''}); }
    catch(e){ setExp(x=>({...x,busy:false,error:aiErrorText(e)})); }
  };
  const assignOwners = () => {
    const ids = D.noOwner.map(x=>x.id);
    setS(s => { const fd = {...s.fd}; ids.forEach(id => { const m = FINDINGS.find(x=>x.id===id).module; fd[id] = {...(fd[id]||{}), owner: OWNERS[m]}; }); return {...s, fd}; });
    log(`Assigned module owners to ${ids.length} findings (rule: owner by module)`); toast(`${ids.length} findings assigned to module leads`);
  };
  useEffect(() => setExp({text:'',busy:false,error:''}), [sel && sel.id]);
  const per = 15;
  return <>
    <div className="page-head"><div><h1>Readiness findings</h1><p className="sub">Findings parsed from the uploaded Readiness Check export for ECP. The Studio analysed the export; it did not run the check.</p></div>
      <div className="actions">{D.noOwner.length > 0 && <button className="btn primary" onClick={assignOwners}>Assign module owners to {D.noOwner.length} findings</button>}</div></div>
    <MetaStrip source="readiness_check_ECP_2026-09-12.json" date="2026-09-12" evidence="Source export" conf="source" owner="Solution Architect" risk={D.blockers.length ? 'High' : 'Medium'} action={D.noOwner.length ? 'Assign owners' : 'Plan remediation'} review={`${D.fd.filter(x=>x.status!=='Open').length} of ${D.fd.length} triaged`}/>
    <div className="kpis">{cats.map(c => <button key={c} className="kpi" onClick={()=>{setF(x=>({...x,cat:c})); setPage(0);}}><span className="v num">{D.fd.filter(x=>x.category===c).length}</span><span className="l">{c}</span></button>)}</div>
    <div className="filters">
      <input placeholder="Search findings" value={f.q} onChange={e=>{setF(x=>({...x,q:e.target.value}));setPage(0);}} aria-label="Search findings"/>
      <select value={f.sev} onChange={e=>{setF(x=>({...x,sev:e.target.value}));setPage(0);}} aria-label="Severity"><option value="">All severities</option>{['Critical','High','Medium','Low'].map(s=><option key={s}>{s}</option>)}</select>
      <select value={f.mod} onChange={e=>{setF(x=>({...x,mod:e.target.value}));setPage(0);}} aria-label="Module"><option value="">All modules</option>{MODULES.map(m=><option key={m}>{m}</option>)}</select>
      <select value={f.cat} onChange={e=>{setF(x=>({...x,cat:e.target.value}));setPage(0);}} aria-label="Category"><option value="">All categories</option>{cats.map(m=><option key={m}>{m}</option>)}</select>
      <select value={f.owner} onChange={e=>{setF(x=>({...x,owner:e.target.value}));setPage(0);}} aria-label="Owner"><option value="">Any owner</option><option value="none">No owner</option><option value="has">Has owner</option></select>
    </div>
    <div className="tw"><table className="t"><thead><tr><th>ID</th><th>Finding</th><th>Module</th><th>Severity</th><th>SAP reference</th><th>Owner</th><th className="r">Effort (pd)</th><th>Status</th></tr></thead>
      <tbody>{rows.slice(page*per, page*per+per).map(x => <tr key={x.id} className={sel && sel.id===x.id?'sel':''} onClick={()=>setSelection({kind:'finding',id:x.id})}>
        <td>{x.id}</td><td>{x.title}</td><td>{x.module}</td><td className={'sev-'+x.severity}>{x.severity}</td><td className="small muted">{x.sapRef}</td><td>{x.owner || <Badge conf="unknown">No owner</Badge>}</td><td className="r num">{x.effortDays}</td><td>{x.status}</td></tr>)}</tbody></table></div>
    <Pager page={page} setPage={setPage} total={rows.length} per={per}/>
    {sel && <Drawer title={sel.id + ' · ' + sel.category} onClose={()=>setSelection(null)}>
      <p><b>{sel.title}</b></p>
      <dl className="kv">{[['System',sel.system],['Module',sel.module + ' ' + MODULE_NAMES[sel.module]],['Severity',sel.severity],['Impact',sel.impact],['SAP reference',sel.sapRef],['Estimated effort',sel.effortDays + ' person-days (rate-card estimate)']].map(([k,v])=><React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}
        <dt>Confidence</dt><dd><Badge conf={sel.conf}/></dd></dl>
      <div className="grid g2">
        <label className="field">Owner<select value={sel.owner || ''} onChange={e=>{upd(sel.id,{owner:e.target.value||null}); log(`Set owner of ${sel.id}`);}}><option value="">No owner</option>{[...new Set(Object.values(OWNERS).concat(TECH))].map(o=><option key={o}>{o}</option>)}</select></label>
        <label className="field">Status<select value={sel.status} onChange={e=>{upd(sel.id,{status:e.target.value}); log(`Set ${sel.id} to ${e.target.value}`);}}>{['Open','In remediation','False positive','Resolved'].map(o=><option key={o}>{o}</option>)}</select></label>
      </div>
      <div className="row" style={{margin:'12px 0'}}>
        {aiReady && <button className="btn ai" onClick={explain} disabled={exp.busy}><Spark/>Explain for the business owner</button>}
        <button className="btn" onClick={()=>{log(`Created remediation task for ${sel.id}`); toast('Remediation task added to the backlog');}}>Create remediation task</button>
      </div>
      <AIProposal title="Plain-language explanation" text={exp.text} busy={exp.busy} error={exp.error}/>
    </Drawer>}
  </>;
}

