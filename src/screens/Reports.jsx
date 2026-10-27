import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

const FIELD_MAP = {
  FI:[['BUKRS','CompanyCode',false],['HKONT','GLAccount',false],['DMBTR','AmountInCompanyCodeCurrency',true],['BSEG/BKPF join','I_JournalEntryItem (ACDOCA-based)',true],['GJAHR/MONAT','FiscalYear / FiscalPeriod',false]],
  CO:[['KOSTL','CostCenter',false],['COEP line items','Universal Journal line items',true],['KSTAR','CostElement → GLAccount',true],['WRTTP','Value type mapping',true]],
  MM:[['MATNR (18)','Product (40 characters)',true],['MSEG/MKPF','MATDOC-based views',true],['WERKS','Plant',false],['LGORT','StorageLocation',false]],
  SD:[['KUNNR','Customer → Business Partner',true],['VBAK/VBAP','Sales order item views',false],['NETWR','NetAmount',false],['Credit fields','Credit management views',true]],
  PP:[['AUFNR','ManufacturingOrder',false],['MATNR (18)','Product (40 characters)',true],['ARBPL','WorkCenter',false]],
  QM:[['PRUEFLOS','InspectionLot',false],['QMNUM','QualityNotification',false]],
  PM:[['AUFNR','MaintenanceOrder',false],['EQUNR','Equipment',false]],
  PS:[['PSPNR','WBSElement',false],['Budget tables','Project budget views',true]]
};

const RECON = ['Totals match','Currencies and exchange rates','Fiscal periods','Filters and selections','Authorisations','Row-level visibility'];

function ladder(r){
  return Object.entries(REPORT_OPTIONS).map(([k, label]) => {
    let why = '';
    if (k === 'A') why = r.standardMatch ? 'Candidate standard app found' : 'No standard app match recorded';
    if (k === 'B' || k === 'C') why = ['Classic ABAP report','ALV report','SAP Query','Excel extract'].includes(r.source) ? 'Report reads transactional data' : 'Depends on presentation or history';
    if (k === 'D') why = 'Only if CDS and embedded options cannot meet the logic';
    if (k === 'E') why = ['BusinessObjects WebI','Crystal Reports','Analysis for Office'].includes(r.source) ? 'Presentation-layer report' : 'Not a presentation-layer report';
    if (k === 'F' || k === 'G') why = r.source === 'BEx query' ? (r.needsHistory ? 'Needs history outside S/4HANA' : 'BW query without deep history') : 'Not a BW report';
    if (k === 'H') why = 'Last resort: custom app adds run cost';
    if (k === 'I') why = 'Only where the source stays supported';
    if (k === 'J') why = r.runsPerMonth === 0 ? 'No runs in 12 months' : r.duplicateGroup ? 'Near-duplicate group ' + r.duplicateGroup : 'Report is used';
    return {k, label, why};
  });
}

export function Reports(){
  const {S, setS, D, ask, aiReady, log, toast, selection, setSelection} = useStore();
  const [f, setF] = useState({src:'', mod:'', q:'', status:''});
  const [page, setPage] = useState(0);
  const [ai, setAi] = useState({busy:false,text:'',error:'',out:null});
  const [spec, setSpec] = useState({busy:false,text:'',error:''});
  const rows = D.rp.filter(r => (!f.src || r.source === f.src) && (!f.mod || r.module === f.mod) && (!f.status || r.status === f.status) && (!f.q || (r.id + r.name).toLowerCase().includes(f.q.toLowerCase())));
  const sel = selection && selection.kind === 'report' ? D.rp.find(r => r.id === selection.id) : rows[0];
  const ov = sel ? (S.rp[sel.id] || {}) : {};
  const setOv = (patch, what) => { setS(s => ({...s, rp:{...s.rp, [sel.id]:{...(s.rp[sel.id]||{}), ...patch, by:s.role}}})); if (what) log(what); };
  useEffect(() => { setAi({busy:false,text:'',error:'',out:null}); setSpec({busy:false,text:'',error:''}); }, [sel && sel.id]);
  const recommend = async () => {
    setAi({busy:true,text:'',error:'',out:null});
    try {
      const out = await ask.json(`${AI_RULES}\n\nTask: recommend a target for this legacy report using the standard-first ladder A→J: ${JSON.stringify(REPORT_OPTIONS)}. Prefer standard (A) or close-to-transactional options (B, C) before SAC, Datasphere, BW/4HANA or BTP. If runsPerMonth is null, answer option null and ask for usage evidence.\nReply with only JSON: {"option":"A".."J" or null,"rationale":"<max 40 words>","ruledOut":"<why higher options were ruled out, max 30 words>","fieldsAtRisk":["..."],"confidence":"High|Medium|Low"}.\n\nREPORT: ${JSON.stringify(sel)}\nFIELD MAPPING CANDIDATES: ${JSON.stringify(FIELD_MAP[sel.module])}`, {modelTier:'default'});
      setAi({busy:false,error:'',out,text:`Option ${out.option || 'none'}${out.option ? ' — ' + REPORT_OPTIONS[out.option] : ''}\n${out.rationale}\nRuled out above: ${out.ruledOut}\nFields at risk: ${(out.fieldsAtRisk||[]).join(', ') || 'none named'}\nConfidence: ${out.confidence}`});
    } catch(e) { setAi({busy:false,text:'',error:aiErrorText(e),out:null}); }
  };
  const draftSpec = async () => {
    setSpec({busy:true,text:'',error:''});
    try { const {text} = await ask(`You write SAP functional specifications. Using ONLY the data below (synthetic), draft a concise functional specification for migrating this report to option ${sel.opt} (${REPORT_OPTIONS[sel.opt] || 'undecided'}). Sections: Purpose, Users and frequency, Data sources and field mapping, Calculations to confirm, Authorisations, Reconciliation tests, Open questions. Mark anything not in the data as "To confirm". Plain text, under 300 words.\n\nREPORT: ${JSON.stringify(sel)}\nFIELD MAPPING: ${JSON.stringify(FIELD_MAP[sel.module])}`, {onText:({text})=>setSpec(s=>({...s,text}))}); setSpec({busy:false,text,error:''}); log('AI drafted functional spec for ' + sel.id); }
    catch(e) { setSpec(s=>({...s,busy:false,error:aiErrorText(e)})); }
  };
  const chk = ov.chk || {};
  const allChecked = RECON.every(c => chk[c]);
  const per = 14;
  return <>
    <div className="page-head"><div><h1>Report migration workbench</h1><p className="sub">420 legacy reports. Each one climbs a standard-first ladder before anything is rebuilt; a report counts as migrated only after its business owner approves the acceptance tests.</p></div></div>
    <MetaStrip source="BW statistics, ST03N extracts (synthetic)" date="2026-09-20" evidence={`${D.rp.length - D.rpUnknown} of ${D.rp.length} with usage`} conf="source" owner="Mei Chen (Analytics lead)" risk="Medium" action={`Confirm ${D.rpPending} targets`} review={`${D.rpAccepted} accepted, ${D.rp.filter(r=>r.status==='migrated').length} migrated`}/>
    <div className="grid" style={{gridTemplateColumns:'minmax(0,1fr) minmax(0,1.3fr)'}}>
      <div>
        <div className="filters">
          <input placeholder="Search reports" value={f.q} onChange={e=>{setF(x=>({...x,q:e.target.value}));setPage(0);}} aria-label="Search reports"/>
          <select value={f.src} onChange={e=>{setF(x=>({...x,src:e.target.value}));setPage(0);}} aria-label="Source"><option value="">All sources</option>{REPORT_SOURCES.map(s=><option key={s}>{s}</option>)}</select>
          <select value={f.mod} onChange={e=>{setF(x=>({...x,mod:e.target.value}));setPage(0);}} aria-label="Module"><option value="">All modules</option>{MODULES.map(m=><option key={m}>{m}</option>)}</select>
          <select value={f.status} onChange={e=>{setF(x=>({...x,status:e.target.value}));setPage(0);}} aria-label="Status"><option value="">All statuses</option>{[['proposed','Rule proposal'],['manual','Manual review'],['accepted','Accepted'],['migrated','Migrated']].map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="tw"><table className="t"><thead><tr><th>Report</th><th>Source</th><th className="r">Runs/mo</th><th>Target</th></tr></thead>
          <tbody>{rows.slice(page*per,page*per+per).map(r => <tr key={r.id} className={sel && sel.id===r.id?'sel':''} onClick={()=>setSelection({kind:'report',id:r.id})}><td>{r.name}<div className="small muted">{r.id} · {r.module}{r.ujAffected?' · Universal Journal':''}</div></td><td className="small">{r.source}</td><td className="r num">{r.runsPerMonth==null?<Badge conf="unknown">?</Badge>:r.runsPerMonth}</td><td>{r.opt ? r.opt : '—'} {r.status==='migrated'?<span className="badge b-source">Migrated</span>:<StatusBadge s={r.status}/>}</td></tr>)}</tbody></table></div>
        <Pager page={page} setPage={setPage} total={rows.length} per={per}/>
      </div>
      {sel && <div>
        <div className="panel">
          <div className="row"><h2 style={{margin:0}}>{sel.name}</h2><span className="muted small">{sel.id}</span></div>
          <p className="small muted">{sel.source} · {MODULE_NAMES[sel.module]} · owner {sel.owner} · {sel.runsPerMonth==null?'usage unknown':sel.runsPerMonth + ' runs a month'}{sel.regulatory?' · regulatory':''}{sel.needsHistory?' · needs history':''}</p>
          <h3>Standard-first ladder</h3>
          <div className="tw"><table className="t"><tbody>{ladder(sel).map(x => <tr key={x.k} className={sel.opt===x.k?'sel':''} onClick={()=>setOv({o:x.k, s:'proposed', c:'architect'}, `Set ${sel.id} target to ${x.k}`)}><td style={{width:28}}><b>{x.k}</b></td><td>{x.label}</td><td className="small muted">{x.why}</td></tr>)}</tbody></table></div>
          <div className="rule-card" style={{marginTop:12}}><b>Rule proposal: {sel.rule.opt ? sel.rule.opt + ' ' + REPORT_OPTIONS[sel.rule.opt] : 'none'}</b><p className="small" style={{margin:'4px 0 0'}}>{sel.rule.rule}</p></div>
          <div className="row" style={{marginTop:12}}>
            <button className="btn primary" disabled={!sel.opt || sel.status==='accepted' || sel.status==='migrated'} onClick={()=>setOv({o:sel.opt, s:'accepted', c:'architect'}, `Accepted target ${sel.opt} for ${sel.id}`)}>Accept target {sel.opt || ''}</button>
            {aiReady && <button className="btn ai" onClick={recommend} disabled={ai.busy}><Spark/>Recommend target</button>}
            {aiReady && sel.opt && <button className="btn ai" onClick={draftSpec} disabled={spec.busy}><Spark/>Draft functional spec</button>}
          </div>
          <div style={{marginTop:12}}><AIProposal title="Target recommendation" text={ai.text} busy={ai.busy} error={ai.error} onAccept={ai.out && ai.out.option && REPORT_OPTIONS[ai.out.option] && sel.runsPerMonth != null ? () => setOv({o:ai.out.option, s:'ai', c:'ai', r:ai.out.rationale}, `Recorded AI target ${ai.out.option} for ${sel.id}`) : null}/></div>
          <div style={{marginTop:12}}><AIProposal title="Functional specification (draft)" text={spec.text} busy={spec.busy} error={spec.error}/></div>
        </div>
        <div className="panel">
          <h3>Field mapping</h3>
          <div className="tw"><table className="t"><thead><tr><th>Legacy</th><th>Target</th><th>Data-model change</th></tr></thead><tbody>{(FIELD_MAP[sel.module]||[]).map(([a,b,c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c ? <span className="badge b-unknown">Validate</span> : <span className="small muted">None recorded</span>}</td></tr>)}</tbody></table></div>
          <h3 style={{marginTop:16}}>Reconciliation and acceptance</h3>
          <p className="small muted" style={{marginTop:-4}}>Automated comparison needs an approved data connection; none is configured, so results are recorded manually.</p>
          {RECON.map(c => <label key={c} className="row small" style={{marginBottom:4}}><input type="checkbox" checked={!!chk[c]} onChange={e=>setOv({chk:{...chk,[c]:e.target.checked}})}/> {c}</label>)}
          <div className="row" style={{marginTop:8}}>
            <button className="btn primary" disabled={!allChecked || sel.status !== 'accepted'} onClick={()=>{setOv({s:'migrated'}, `Business owner approved acceptance tests for ${sel.id}`); toast('Marked migrated after owner approval');}}>Business owner approves tests</button>
            {!allChecked && <span className="small muted">All six checks must pass first.</span>}
            {allChecked && sel.status !== 'accepted' && sel.status !== 'migrated' && <span className="small muted">Accept a target first.</span>}
          </div>
        </div>
      </div>}
    </div>
  </>;
}

