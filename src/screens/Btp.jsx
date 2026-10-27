import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Btp(){
  const {S, setS, D, ask, aiReady, log} = useStore();
  const B = S.btp; const cv = useRef(null);
  const [sel, setSel] = useState(null); const [connect, setConnect] = useState(null);
  const [chk, setChk] = useState({busy:false,text:'',error:''});
  const drag = useRef(null);
  const setB = fn => setS(s => ({...s, btp: fn(s.btp)}));
  const down = (e, n) => { e.stopPropagation(); if (connect) { if (connect !== n.id) { setB(b => ({...b, edges:[...b.edges, [connect, n.id]]})); log(`Connected ${B.nodes.find(x=>x.id===connect).label} to ${n.label}`); } setConnect(null); return; } setSel(n.id); const r = cv.current.getBoundingClientRect(); drag.current = {id:n.id, dx:e.clientX - r.left - n.x, dy:e.clientY - r.top - n.y}; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = e => { if (!drag.current) return; const r = cv.current.getBoundingClientRect(); const x = Math.max(0, Math.min(r.width - 160, e.clientX - r.left - drag.current.dx)), y = Math.max(0, Math.min(r.height - 50, e.clientY - r.top - drag.current.dy)); const id = drag.current.id; setB(b => ({...b, nodes:b.nodes.map(n => n.id === id ? {...n, x, y} : n)})); };
  const up = () => { drag.current = null; };
  const add = ([label, kind, s4]) => { const id = 'n' + Date.now(); setB(b => ({...b, nodes:[...b.nodes, {id, label, kind, x:200 + Math.random()*200, y:40 + Math.random()*120, s4:!!s4, ent: kind === 'External' ? 'n/a' : 'Not verified'}]})); setSel(id); log('Added ' + label + ' to the architecture'); };
  const node = B.nodes.find(n => n.id === sel);
  const levels = [
    ['Standard S/4HANA functionality', D.wr.filter(o=>o.disp==='REPLACE').length, 'Objects replaced by standard'],
    ['Key-user extensibility', 0, 'None identified yet: review REPLACE items in fit-to-standard'],
    ['On-stack developer extensibility', D.wr.filter(o=>o.disp==='REBUILD ON-STACK').length, 'Released APIs and extension points'],
    ['Side-by-side BTP extension', D.wr.filter(o=>o.disp==='REBUILD ON BTP').length, 'Integration Suite, CAP or Build apps'],
    ['External integrated application', D.wr.filter(o=>o.type==='I' && o.disp==='RETAIN').length, 'Existing third-party systems kept'],
  ];
  const check = async () => {
    setChk({busy:true,text:'',error:''});
    try { const {text} = await ask(`${AI_RULES}\n\nTask: run a clean-core review of this target architecture. For each BTP component say what it is for here and flag any that may be unnecessary given the extension counts. For side-by-side candidates ask whether standard or key-user extensibility was ruled out. List entitlements to verify. Do not assume any BTP service is included in RISE.\n\nNODES: ${JSON.stringify(B.nodes.map(n=>({label:n.label,kind:n.kind,entitlement:n.ent})))}\nFLOWS: ${JSON.stringify(B.edges.map(([a,b])=>[B.nodes.find(n=>n.id===a)?.label, B.nodes.find(n=>n.id===b)?.label]))}\nEXTENSION LEVELS: ${JSON.stringify(levels.map(l=>({level:l[0],objects:l[1]})))}`, {onText:({text})=>setChk(c=>({...c,text}))}); setChk({busy:false,text,error:''}); log('AI ran clean-core check on BTP architecture'); }
    catch(e){ setChk(c=>({...c,busy:false,error:aiErrorText(e)})); }
  };
  const centre = n => [n.x + 80, n.y + 22];
  return <>
    <div className="page-head"><div><h1>SAP BTP architecture designer</h1><p className="sub">Drag components to arrange them. Use “Connect” and then two components to draw a flow. Every service shows whether its entitlement has been verified against the contract.</p></div>
      <div className="actions">{aiReady && <button className="btn ai" onClick={check} disabled={chk.busy}><Spark/>Clean-core check</button>}</div></div>
    <MetaStrip source="Architect design, WRICEF dispositions" date={today} evidence={`${B.nodes.filter(n=>n.ent==='Contracted').length} of ${B.nodes.filter(n=>n.ent!=='n/a').length} entitlements verified`} conf="architect" owner="Enterprise Architect" risk="Medium" action="Verify entitlements" review="Draft"/>
    <AIProposal title="Clean-core review" text={chk.text} busy={chk.busy} error={chk.error} onDismiss={()=>setChk({busy:false,text:'',error:''})}/>
    <div style={{marginTop:12}}>
      <div className="palette" aria-label="Add a component">{BTP_PALETTE.map(p => <button key={p[0]} onClick={()=>add(p)}>+ {p[0]}</button>)}</div>
      <div className="row" style={{marginBottom:8}}>
        <button className="btn sm" aria-pressed={!!connect} onClick={()=>setConnect(connect ? null : sel)} disabled={!sel && !connect}>{connect ? 'Now choose the target component' : 'Connect from selected'}</button>
        <button className="btn sm danger" disabled={!sel} onClick={()=>{setB(b=>({nodes:b.nodes.filter(n=>n.id!==sel), edges:b.edges.filter(e=>e[0]!==sel&&e[1]!==sel)})); log('Removed ' + node.label); setSel(null);}}>Remove selected</button>
        <span className="small muted">{B.nodes.length} components · {B.edges.length} flows</span>
      </div>
      <div className="canvas" ref={cv} onPointerMove={move} onPointerUp={up} onClick={()=>setSel(null)}>
        <svg width="100%" height="100%" style={{position:'absolute',inset:0,pointerEvents:'none'}}><defs><marker id="btp-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink-3)"/></marker></defs>
          {B.edges.map(([a,b],i) => { const A = B.nodes.find(n=>n.id===a), C = B.nodes.find(n=>n.id===b); if (!A||!C) return null; const [x1,y1]=centre(A),[cx,cy]=centre(C); const dx=cx-x1, dy=cy-y1; const k=Math.min(Math.abs(dx)>0?84/Math.abs(dx):9, Math.abs(dy)>0?32/Math.abs(dy):9, 1); const x2=cx-dx*k, y2=cy-dy*k; return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-3)" strokeWidth="1.25" markerEnd="url(#btp-ar)"/>; })}</svg>
        {B.nodes.map(n => <div key={n.id} className={'node' + (n.s4?' s4':'') + (sel===n.id?' sel':'')} style={{left:n.x, top:n.y}} onPointerDown={e=>down(e,n)} onClick={e=>e.stopPropagation()} tabIndex={0} role="button" aria-label={n.label} onKeyDown={e=>{ if(e.key==='Enter') setSel(n.id); }}>
          <div className="k">{n.kind}</div><b>{n.label}</b>{n.ent !== 'n/a' && <div style={{marginTop:4}}><span className={'badge ' + (n.ent==='Contracted'?'b-source':'b-unknown')}>{n.ent === 'Contracted' ? 'Entitlement verified' : 'Entitlement not verified'}</span></div>}
        </div>)}
      </div>
      <div className="grid g2" style={{marginTop:16}}>
        {node ? <div className="panel" style={{margin:0}}><h3>{node.label}</h3><p className="small muted">{node.kind}</p>
          {node.ent !== 'n/a' && <label className="field">Entitlement<select value={node.ent} onChange={e=>{const v=e.target.value; setB(b=>({...b,nodes:b.nodes.map(n=>n.id===node.id?{...n,ent:v}:n)})); log(`Set entitlement for ${node.label}: ${v}`);}}><option>Not verified</option><option>Contracted</option><option>Not available</option></select></label>}
          <p className="small">Flows in: {B.edges.filter(e=>e[1]===node.id).length} · out: {B.edges.filter(e=>e[0]===node.id).length}</p></div> : <div className="panel" style={{margin:0}}><p className="small muted">Select a component to see its entitlement and flows.</p></div>}
        <div className="panel" style={{margin:0}}><h3>Why each extension sits where it does</h3>{levels.map(([l,n,h]) => <div key={l} style={{marginBottom:8}}><div className="row small"><b style={{flex:1}}>{l}</b><span className="num">{n} objects</span></div><div className="small muted">{h}</div></div>)}</div>
      </div>
    </div>
  </>;
}

