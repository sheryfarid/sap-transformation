import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../data/model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Onboarding(){
  const {S, setS, go, log, toast} = useStore();
  const o = S.onboarding;
  const set = (k, v) => setS(s => ({...s, onboarding:{...s.onboarding, [k]: v}}));
  const steps = ['Customer','Jurisdictions','Landscape','Technical metadata','Assessment mode','Team'];
  const need = ['Readiness Check export per production system','Maintenance Planner output (add-ons, stack)','ATC results for S/4HANA readiness','Usage data (SCMON or UPL), at least 12 months','Interface inventory from PI/PO','BW query usage statistics'];
  return <>
    <div className="page-head"><div><h1>Project onboarding</h1><p className="sub">Six short steps. After each one, the guide lists the evidence the assessment will need next.</p></div></div>
    <div className="steps">{steps.map((s,i) => <button key={s} aria-current={o.step===i?'step':undefined} className={i<o.step?'done':''} onClick={()=>set('step',i)}>{i+1}. {s}</button>)}</div>
    <div className="grid g-main">
      <div className="panel">
        {o.step === 0 && <div className="grid g2">
          <label className="field">Organisation<input value={o.org} onChange={e=>set('org',e.target.value)}/></label>
          <label className="field">Industry<input value={o.industry} onChange={e=>set('industry',e.target.value)}/></label>
          <label className="field">Legal entities<input value={o.entities} onChange={e=>set('entities',e.target.value)}/></label>
          <label className="field">Plants and warehouses<input value={o.plants} onChange={e=>set('plants',e.target.value)}/></label></div>}
        {o.step === 1 && <div className="grid g2">
          <label className="field">Countries and jurisdictions<input value={o.countries} onChange={e=>set('countries',e.target.value)}/></label>
          <label className="field">Data residency needs<input value={o.residency} onChange={e=>set('residency',e.target.value)}/></label></div>}
        {o.step === 2 && <div><p>Registered systems:</p><ul>{SYSTEMS.map(s=><li key={s.sid}><b>{s.sid}</b> — {s.product} {s.ehp !== '—' ? s.ehp : ''}, {s.role}</li>)}</ul><button className="btn" onClick={()=>go('discovery')}>Open system discovery</button></div>}
        {o.step === 3 && <p>Technical metadata (kernel, components, business functions) is filled from uploaded evidence. Missing values show as <Badge conf="unknown">Unknown</Badge> and lower completeness.</p>}
        {o.step === 4 && <div className="grid g2">
          <label className="field"><span><input type="radio" checked={o.mode==='A'} onChange={()=>set('mode','A')}/> Mode A: offline evidence</span><span className="muted small">Upload sanctioned exports. Fully supported.</span></label>
          <label className="field"><span><input type="radio" disabled/> Mode B: connected assessment</span><span className="muted small">Unavailable until a read-only connector is authenticated (Phase 3).</span></label></div>}
        {o.step === 5 && <table className="t"><tbody>{Object.entries(MODULE_NAMES).map(([m,n])=><tr key={m}><td>{m} {n}</td><td>{OWNERS[m]}</td></tr>)}</tbody></table>}
        <div className="row" style={{marginTop:16}}>
          <button className="btn" disabled={o.step===0} onClick={()=>set('step',o.step-1)}>Back</button><span className="spacer"/>
          {o.step < 5 ? <button className="btn primary" onClick={()=>set('step',o.step+1)}>Continue</button> :
            <button className="btn primary" onClick={()=>{ set('done',true); log('Completed onboarding'); toast('Onboarding complete'); go('executive'); }}>Finish onboarding</button>}
        </div>
      </div>
      <div className="rule-card">
        <h3>Evidence request pack</h3>
        <p className="small muted">Detected ECC 6.0 EHP5 on Oracle, so the assessment needs:</p>
        <ul className="small">{need.map(n=><li key={n}>{n}</li>)}</ul>
        <button className="btn sm" onClick={()=>{ log('Sent evidence request pack to workstream owners'); toast('Evidence requests created for 6 owners'); }}>Create evidence requests</button>
      </div>
    </div>
  </>;
}

