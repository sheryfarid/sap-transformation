import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function parseCSV(text){
  const lines = text.replace(/\r/g,'').split('\n').filter(l => l.trim());
  const split = l => { const out=[]; let cur='', q=false; for (const ch of l){ if (ch==='"') q=!q; else if (ch===',' && !q){ out.push(cur); cur=''; } else cur+=ch; } out.push(cur); return out.map(s=>s.trim()); };
  const headers = split(lines[0] || ''); return {headers, rows: lines.slice(1).map(split)};
}

export function sampleUsageCSV(){
  const rows = ['OBJ_NAME,OBJ_TYPE,LAST_USED,EXEC_COUNT_12M'];
  WRICEF.filter(o => o.lastExecDays == null).forEach((o,i) => {
    const never = i % 4 === 0; const d = never ? '' : daysAgoDate(10 + (i*37)%330);
    rows.push(`${o.tech},PROG,${d},${never?0:3 + (i*7)%90}`);
  });
  ['ZTMP_TEST_01','ZOLD_COPY_99','ZXX_DEMO','ZFI_UNKNOWN_1','ZSD_SCRATCH'].forEach(t => rows.push(`${t},PROG,${daysAgoDate(700)},0`));
  return rows.join('\n');
}

export function Discovery(){
  const {S, setS, D, ask, aiReady, log, toast} = useStore();
  const [sel, setSel] = useState(null);
  const [file, setFile] = useState(null); // {name, headers, rows}
  const [map, setMap] = useState({obj:'', last:''});
  const [aiMap, setAiMap] = useState({busy:false, text:'', error:''});
  const guess = headers => ({obj: headers.find(h=>/obj|name|program|tech/i.test(h)) || '', last: headers.find(h=>/last|date|used/i.test(h)) || ''});
  const load = (name, text) => { const p = parseCSV(text); setFile({name, ...p}); setMap(guess(p.headers)); setAiMap({busy:false,text:'',error:''}); };
  const onFile = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => load(f.name, String(r.result)); r.readAsText(f); };
  const byTech = useMemo(() => Object.fromEntries(WRICEF.map(o => [o.tech, o])), []);
  const preview = useMemo(() => {
    if (!file || !map.obj) return null;
    const oi = file.headers.indexOf(map.obj), li = file.headers.indexOf(map.last);
    let matched=[], unmatched=0, invalid=0;
    for (const r of file.rows) {
      const o = byTech[r[oi]]; if (!o) { unmatched++; continue; }
      const v = li >= 0 ? r[li] : '';
      if (!v) { matched.push([o.id, 999]); continue; }
      const t = Date.parse(v); if (isNaN(t)) { invalid++; continue; }
      matched.push([o.id, Math.max(0, Math.round((Date.parse(today) - t)/864e5))]);
    }
    return {matched, unmatched, invalid};
  }, [file, map, byTech]);
  const suggest = async () => {
    setAiMap({busy:true,text:'',error:''});
    try {
      const out = await ask.json(`Map the columns of an uploaded SAP usage export to fields. Reply with only JSON: {"objectField": "<header>", "lastUsedField": "<header>", "reason": "<one sentence>"}.\nFields needed: objectField = the custom object technical name (e.g. ZFI_R_0001); lastUsedField = the last execution date.\nHeaders: ${JSON.stringify(file.headers)}\nFirst rows: ${JSON.stringify(file.rows.slice(0,3))}`, {modelTier:'quick'});
      if (out && file.headers.includes(out.objectField)) setMap({obj: out.objectField, last: file.headers.includes(out.lastUsedField) ? out.lastUsedField : ''});
      setAiMap({busy:false, text:`Mapped object → ${out.objectField}, last used → ${out.lastUsedField}. ${out.reason || ''}\nCheck the preview before importing.`, error:''});
    } catch(e) { setAiMap({busy:false,text:'',error:aiErrorText(e)}); }
  };
  const doImport = () => {
    const upd = Object.fromEntries(preview.matched);
    setS(s => ({...s, wrUsage:{...s.wrUsage, ...upd}, imports:[{id:'IMP-' + pad(s.imports.length+1,3), file:file.name, type:'Usage export (SCMON/UPL)', rows:file.rows.length, date:today, by:s.role}, ...s.imports]}));
    log(`Imported usage evidence from ${file.name}: ${preview.matched.length} objects updated`);
    toast(`${preview.matched.length} objects updated from ${file.name}`); setFile(null);
  };
  return <>
    <div className="page-head"><div><h1>SAP system discovery</h1><p className="sub">The landscape and the evidence behind it. Upload exports to the evidence inbox; each import is checked before it changes any record.</p></div></div>
    <MetaStrip source={S.imports.length + ' evidence files'} date={S.imports[0] && S.imports[0].date} evidence={D.evidenceComplete + '% complete'} conf="source" owner="Tom Byrne (Basis lead)" risk="Medium" action={D.wrUnknown ? 'Import usage evidence' : 'Confirm BW and PI/PO metadata'} review="In progress"/>
    <div className="grid g-main">
      <div>
        <div className="tw"><table className="t"><thead><tr><th>SID</th><th>Role</th><th>Product</th><th>Database</th><th>Kernel</th><th>Size</th><th>Evidence</th></tr></thead>
          <tbody>{SYSTEMS.map(s => <tr key={s.sid} onClick={()=>setSel(s)}><td><b>{s.sid}</b></td><td>{s.role}</td><td>{s.product} {s.ehp!=='—'?s.ehp:''}</td><td>{s.db}</td><td><Badge conf="unknown">Unknown</Badge></td><td className="num">{s.sizeTB} TB</td><td><Badge conf={s.evidence}/></td></tr>)}</tbody></table></div>
        <div className="panel" style={{marginTop:16}}>
          <h2>Evidence inbox</h2>
          <div className="row" style={{marginBottom:12}}>
            <label className="btn primary">Upload CSV<input type="file" accept=".csv,text/csv" hidden onChange={onFile}/></label>
            <button className="btn" onClick={()=>load('scmon_usage_ECP_synthetic.csv', sampleUsageCSV())}>Load sample usage file (synthetic)</button>
          </div>
          {file && <div className="rule-card" style={{marginBottom:12}}>
            <div className="row"><b>{file.name}</b><span className="muted small">{file.rows.length} rows · {file.headers.length} columns · detected: usage export</span></div>
            <div className="grid g2" style={{marginTop:10}}>
              <label className="field">Object technical name<select value={map.obj} onChange={e=>setMap(m=>({...m,obj:e.target.value}))}><option value="">Choose a column</option>{file.headers.map(h=><option key={h}>{h}</option>)}</select></label>
              <label className="field">Last execution date<select value={map.last} onChange={e=>setMap(m=>({...m,last:e.target.value}))}><option value="">Choose a column</option>{file.headers.map(h=><option key={h}>{h}</option>)}</select></label>
            </div>
            {aiReady && <button className="btn ai sm" style={{marginTop:10}} onClick={suggest} disabled={aiMap.busy}><Spark/>Suggest mapping</button>}
            <div style={{marginTop:10}}><AIProposal title="Column mapping" text={aiMap.text} busy={aiMap.busy} error={aiMap.error}/></div>
            {preview && <div style={{marginTop:10}} className="small">
              <b>Validation:</b> {preview.matched.length} rows match known objects · {preview.unmatched} unmatched (kept out) · {preview.invalid} invalid dates. Blank dates are read as “not executed in the monitoring window”.
              <div className="row" style={{marginTop:8}}><button className="btn primary" disabled={!preview.matched.length} onClick={doImport}>Import {preview.matched.length} records</button><button className="btn" onClick={()=>setFile(null)}>Discard</button></div>
            </div>}
          </div>}
          <div className="tw"><table className="t"><thead><tr><th>File</th><th>Type</th><th className="r">Rows</th><th>Imported</th><th>By</th></tr></thead>
            <tbody>{S.imports.map(i => <tr key={i.id}><td>{i.file}</td><td>{i.type}</td><td className="r num">{fmt(i.rows)}</td><td>{i.date}</td><td>{i.by}</td></tr>)}</tbody></table></div>
        </div>
      </div>
      <div className="rule-card">
        <h3>What the guide checks here</h3>
        <ul className="small">
          <li>ECD reports EHP6 while ECP and ECQ report EHP5. Confirm the stack before readiness analysis.</li>
          <li>Kernel versions are unknown for all systems. Upload a Maintenance Planner output.</li>
          <li>BWP and PIP have no assessment evidence yet, so Analytics and Integrations stay partly unknown.</li>
          <li>{D.wrUnknown} custom objects have no usage data.</li>
        </ul>
      </div>
    </div>
    {sel && <Drawer title={sel.sid + ' · ' + sel.role} onClose={()=>setSel(null)}>
      <dl className="kv">{[['Product',sel.product],['Enhancement package',sel.ehp],['Database',sel.db],['Operating system',sel.os],['Unicode',sel.unicode],['Clients',sel.clients],['Hosting',sel.hosting],['Add-ons',sel.addons],['Database size',sel.sizeTB+' TB (synthetic)'],['Users',fmt(sel.users)+' (synthetic)'],['Last assessed',sel.lastAssessed||'Not yet']].map(([k,v])=><React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}
        <dt>Kernel</dt><dd><Badge conf="unknown">Unknown</Badge> <button className="btn sm" onClick={()=>{log(`Requested kernel version for ${sel.sid} from Tom Byrne`); toast('Request sent to Tom Byrne (Basis lead)');}}>Request from owner</button></dd></dl>
      <Badge conf={sel.evidence}/>
    </Drawer>}
  </>;
}

