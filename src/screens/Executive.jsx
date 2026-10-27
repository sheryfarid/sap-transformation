import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../data/model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Executive(){
  const {S, D, go, ask, aiReady, log} = useStore();
  const [brief, setBrief] = useState({text:'',busy:false,error:''});
  const pend = S.approvals.filter(a => a.status === 'Pending');
  const runBrief = async () => {
    setBrief({text:'',busy:true,error:''});
    try {
      const {text} = await ask(`${AI_RULES}\n\nTask: write a five-sentence executive status brief for the CIO. Each sentence must cite the figure it is based on. End with the single decision the CIO should make this week.\n\nPROJECT DATA (JSON):\n${JSON.stringify(projectSummary(S, D))}`, {onText:({text}) => setBrief(b => ({...b, text}))});
      setBrief({text, busy:false, error:''}); log('AI drafted executive brief');
    } catch(e) { setBrief(b => ({...b, busy:false, error: aiErrorText(e)})); }
  };
  const k = [
    ['SAP systems', SYSTEMS.length, '3 ECC, 1 BW, 1 PI/PO', 'discovery'],
    ['Custom ABAP objects', 2400, 'From ATC export', 'wricef'],
    ['WRICEF objects', D.wr.length, `${D.wrUnknown} without usage`, 'wricef'],
    ['Interfaces', 180, 'Inventory pending', 'wricef'],
    ['Legacy reports', D.rp.length, `${D.rpUnknown} without usage`, 'reports'],
    ['Add-ons', 15, '3 compatibility unknown', 'readiness'],
    ['Database size', '4.5 TB', 'ECP, synthetic', 'discovery'],
    ['Open blockers', D.blockers.length, `${D.blockers.filter(b=>!b.owner).length} without owner`, 'readiness'],
    ['Readiness score', D.readiness + '%', 'Configurable rules', 'readiness'],
    ['Evidence completeness', D.evidenceComplete + '%', 'Unknowns lower this', 'discovery'],
    ['Estimated effort', S.plan.generated ? fmt(Math.round(D.effortAccepted)) + ' pd' : 'Not estimated', S.plan.generated ? 'Accepted scope only' : 'Generate the plan first', 'plan'],
    ['Estimated cost', 'Needs inputs', 'No prices are invented', 'strategy'],
    ['Open risks', S.risks.length, `${S.risks.filter(r=>r.l*r.i>=15).length} rated high`, 'risk'],
    ['Go-live', S.plan.baselined ? 'Baselined' : 'Not set', S.plan.baselined ? 'See plan' : 'Needs a baselined plan', 'plan'],
  ];
  const cls = v => v == null ? 'unk' : v >= 70 ? 'good' : v >= 40 ? 'mid' : 'bad';
  const goFor = d => ({Finance:'readiness',Procurement:'readiness',Sales:'readiness',Manufacturing:'readiness',Warehouse:'readiness',HR:'discovery',Analytics:'reports',Integrations:'wricef',Security:'discovery',Infrastructure:'discovery'})[d];
  return <>
    <div className="page-head"><div><h1>Executive command centre</h1><p className="sub">Programme status for ABC Manufacturing’s move from ECC 6.0 to S/4HANA Cloud Private Edition. Select any figure to see the records behind it.</p></div>
      <div className="actions">{aiReady && <button className="btn ai" onClick={runBrief} disabled={brief.busy}><Spark/>Draft executive brief</button>}</div></div>
    <MetaStrip source="Readiness Check export, ATC results, workshop inputs" date="2026-09-15" evidence={D.evidenceComplete + '% complete'} conf="source" owner={S.role} risk={D.blockers.length > 10 ? 'High' : 'Medium'} action={(nextActions(S,D)[0]||{}).title || 'None'} review="Live"/>
    <AIProposal title="Executive brief (draft)" text={brief.text} busy={brief.busy} error={brief.error} onDismiss={() => setBrief({text:'',busy:false,error:''})}/>
    <div style={{height:brief.text||brief.busy?16:0}}/>
    <div className="kpis">{k.map(([l, v, n, to]) => <button key={l} className="kpi" onClick={() => go(to)}><span className={'v num' + (typeof v === 'string' && v.length > 6 ? ' txt' : '')}>{typeof v === 'number' ? fmt(v) : v}</span><span className="l">{l}</span><span className="n">{n}</span></button>)}</div>
    <div className="grid g-main">
      <div className="panel">
        <h2>Readiness by domain</h2>
        <p className="muted small" style={{marginTop:-6}}>Hatched cells have no evidence yet; they never count as a pass.</p>
        <div className="heat" role="grid">
          <div className="hd">Domain</div><div className="hd">Evidence</div><div className="hd">Readiness</div><div className="hd">Reviewed</div>
          {D.heat.map(h => <React.Fragment key={h.d}>
            <div className="rowname">{h.d}</div>
            <button className={'cell ' + cls(h.completeness || null)} onClick={() => go(goFor(h.d))}><span className="num">{h.completeness ? h.completeness + '%' : 'Unknown'}</span></button>
            <button className={'cell ' + cls(h.readiness)} onClick={() => go(goFor(h.d))}><span className="num">{h.readiness != null ? h.readiness + '%' : 'Unknown'}</span>{h.crit ? <span className="small muted"> · {h.crit} high/critical</span> : null}</button>
            <button className={'cell ' + (h.n ? cls(h.reviewed) : 'unk')} onClick={() => go(goFor(h.d))}><span className="num">{h.n ? h.reviewed + '%' : 'Unknown'}</span></button>
          </React.Fragment>)}
        </div>
      </div>
      <div>
        <div className="panel">
          <h2>Decisions waiting</h2>
          {pend.length === 0 ? <p className="muted">No approvals pending. Decisions appear here when a strategy, cloud choice or plan baseline is submitted.</p> :
            pend.map(a => <div key={a.id} className="row" style={{padding:'8px 0',borderBottom:'1px solid var(--line-2)'}}><div style={{flex:1}}><b>{a.title}</b><div className="small muted">{a.approver} · raised {a.date}</div></div><button className="btn sm" onClick={() => go('approvals')}>Open</button></div>)}
        </div>
        <div className="panel">
          <h2>Top risks</h2>
          {S.risks.slice().sort((a,b)=>b.l*b.i-a.l*a.i).slice(0,5).map(r => <div key={r.id} className="row" style={{padding:'6px 0',borderBottom:'1px solid var(--line-2)'}}><span className={'num ' + (r.l*r.i>=15?'sev-High':'sev-Medium')} style={{width:28}}>{r.l*r.i}</span><span style={{flex:1}}>{r.title}</span></div>)}
          <button className="btn sm" style={{marginTop:8}} onClick={() => go('risk')}>Open risk and cutover</button>
        </div>
        <div className="panel">
          <h2>WRICEF disposition</h2>
          {DISPOSITIONS.map(d => <div key={d} style={{marginBottom:6}}><div className="row small"><span>{d}</span><span className="spacer"/><span className="num">{D.dispCounts[d]}</span></div><div className="bar-h"><i style={{width: (100*D.dispCounts[d]/D.wr.length) + '%', background: d==='MANUAL REVIEW'?'var(--warn)':d==='RETIRE'?'var(--good)':'var(--blue)'}}/></div></div>)}
          <p className="small muted">{D.wrAccepted} of {D.wr.length} accepted by a person; the rest are proposals.</p>
        </div>
      </div>
    </div>
  </>;
}

