import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { fmt } from './model.js';
import { Store, usePersistentState, useDerived } from './lib/store.jsx';
import { useAI } from './lib/ai.js';
import { nextActions } from './lib/engine.js';
import { Ring, Spark } from './components/ui.jsx';
import { Chat } from './components/Chat.jsx';
import { fmt } from './data/model.js';
import { Executive } from './screens/Executive.jsx';
import { Onboarding } from './screens/Onboarding.jsx';
import { Discovery } from './screens/Discovery.jsx';
import { Readiness } from './screens/Readiness.jsx';
import { Modules } from './screens/Modules.jsx';
import { Wricef } from './screens/Wricef.jsx';
import { Reports } from './screens/Reports.jsx';
import { Strategy } from './screens/Strategy.jsx';
import { Hyperscaler } from './screens/Hyperscaler.jsx';
import { Btp } from './screens/Btp.jsx';
import { Plan } from './screens/Plan.jsx';
import { Risk } from './screens/Risk.jsx';
import { Approvals } from './screens/Approvals.jsx';
import { Advisor } from './screens/Advisor.jsx';
import { Exports } from './screens/Exports.jsx';

const NAV = [
  {stage:'Mobilise', items:[['executive','Executive command centre'],['onboarding','Project onboarding']]},
  {stage:'Discover', items:[['discovery','SAP system discovery']]},
  {stage:'Assess', items:[['readiness','Readiness findings'],['modules','Functional modules'],['wricef','WRICEF intelligence'],['reports','Report migration workbench']]},
  {stage:'Decide', items:[['strategy','Migration strategy'],['hyperscaler','Hyperscaler comparison'],['btp','BTP architecture designer']]},
  {stage:'Plan', items:[['plan','SAP Activate plan']]},
  {stage:'Deliver', items:[['risk','Risk and cutover']]},
  {stage:'Always available', items:[['advisor','AI advisor'],['approvals','Approvals'],['exports','Reports and exports']]},
];

const LATER = ['Custom code remediation','Add-on compatibility','Interfaces and integrations','Data migration factory','Security and compliance','Licensing and commercial','Business case and ROI','Execution control tower','Administration'];

export const SCREENS = {executive:Executive, onboarding:Onboarding, discovery:Discovery, readiness:Readiness, modules:Modules, wricef:Wricef, reports:Reports, strategy:Strategy, hyperscaler:Hyperscaler, btp:Btp, plan:Plan, risk:Risk, advisor:Advisor, approvals:Approvals, exports:Exports};

const ROLES = ['Programme Director','CIO','Solution Architect','ABAP Lead','Analytics Lead'];

export default function App(){
  const [S, setS, persist] = usePersistentState();
  const D = useDerived(S);
  const ai = useAI();
  const [screen, setScreen] = useState('executive');
  const [selection, setSelection] = useState(null);
  const [filterHint, setFilterHint] = useState(null);
  const [rail, setRail] = useState(() => window.innerWidth > 1180);
  const [railTab, setRailTab] = useState('copilot');
  const [navOpen, setNavOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [chat, setChat] = useState([]);
  const [q, setQ] = useState('');
  const [dismissed, setDismissed] = useState({});
  const mainRef = useRef(null);
  const toastTimer = useRef(null);
  const toast = useCallback(m => { setToastMsg(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastMsg(null), 2600); }, []);
  const log = useCallback(what => setS(s => ({...s, audit:[{t:new Date().toISOString().slice(0,16).replace('T',' '), who:s.role, what}, ...s.audit].slice(0,250)})), [setS]);
  const go = useCallback(sc => { setScreen(sc); setSelection(null); setNavOpen(false); mainRef.current && mainRef.current.scrollTo(0,0); }, []);
  const ask = ai.ask;
  const actions = nextActions(S, D).filter(a => !dismissed[a.id]);
  const nba = actions[0];
  const stagePct = {
    'Mobilise': S.onboarding.done ? 100 : 30, 'Discover': D.evidenceComplete,
    'Assess': Math.round(100 * ((D.wrAccepted / D.wr.length) + (D.rpAccepted / D.rp.length) + (1 - D.noOwner.length / D.fd.length)) / 3),
    'Decide': Math.round(((S.strat.decision ? 1 : 0) + (S.hyper.selected ? 1 : D.hyperFilled / D.hyperTotal * 0.5) + (S.btp.nodes.filter(n=>n.ent==='Contracted').length / Math.max(1, S.btp.nodes.filter(n=>n.ent!=='n/a').length))) / 3 * 100),
    'Plan': S.plan.baselined ? 100 : S.plan.generated ? 50 : 0, 'Deliver': Math.round(100 * S.cutover.filter(c=>c.signed).length / S.cutover.length)
  };
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = q.toLowerCase(); const out = [];
    for (const o of D.wr) if ((o.id + ' ' + o.tech + ' ' + o.name).toLowerCase().includes(t)) { out.push({k:'wricef', id:o.id, label:o.name, sub:o.id + ' · ' + o.tech}); if (out.length > 5) break; }
    for (const r of D.rp) if ((r.id + ' ' + r.name).toLowerCase().includes(t)) { out.push({k:'report', id:r.id, label:r.name, sub:r.id + ' · ' + r.source}); if (out.length > 9) break; }
    for (const f of D.fd) if ((f.id + ' ' + f.title).toLowerCase().includes(t)) { out.push({k:'finding', id:f.id, label:f.title, sub:f.id + ' · ' + f.category}); if (out.length > 13) break; }
    return out;
  }, [q, D]);
  const openResult = r => { const sc = r.k === 'wricef' ? 'wricef' : r.k === 'report' ? 'reports' : 'readiness'; setScreen(sc); setSelection({kind:r.k, id:r.id}); setQ(''); };
  const setTheme = t => { if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); };
  const Screen = SCREENS[screen] || Executive;
  const store = {S, setS, D, go, ask, aiReady: ai.status === 'ready', aiStatus: ai.status, log, toast, selection, setSelection, filterHint, setFilterHint, chat, setChat, persist};
  return <Store.Provider value={store}>
    <div className={'app' + (navOpen ? ' nav-open' : '')}>
      <header className="hdr">
        <button className="btn ghost sm mobile-only" onClick={()=>setNavOpen(!navOpen)} aria-expanded={navOpen} aria-label="Toggle navigation">Menu</button>
        <div className="brand"><b>Transformation Intelligence Studio</b><span>Assess. Analyse. Architect. Migrate. Optimise.</span></div>
        <div className="search"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search objects, reports and findings" aria-label="Global search"/>
          {results.length > 0 && <div className="results">{results.map(r => <button key={r.k + r.id} onClick={()=>openResult(r)}><span className="badge b-rule">{r.k}</span><span><b>{r.label}</b><div className="small muted">{r.sub}</div></span></button>)}</div>}</div>
        <div className="hdr-right">
          <span className="synthetic" title="All records are generated demonstration data">Synthetic data</span>
          <select value={S.role} onChange={e=>{const r=e.target.value; setS(s=>({...s, role:r}));}} aria-label="Acting role" style={{height:32,border:'1px solid var(--line)',borderRadius:6,background:'var(--surface)'}}>{ROLES.map(r=><option key={r}>{r}</option>)}</select>
          <select onChange={e=>setTheme(e.target.value)} aria-label="Theme" defaultValue="" style={{height:32,border:'1px solid var(--line)',borderRadius:6,background:'var(--surface)'}}><option value="">Auto theme</option><option value="light">Light</option><option value="dark">Dark</option></select>
          <button className={'btn ' + (rail ? 'ai' : '')} onClick={()=>setRail(!rail)} aria-pressed={rail}><Spark/>Copilot</button>
        </div>
      </header>
      <div className="nba" role="status">
        {nba ? <>
          <span className="lead">Next best action</span>
          <div className="grow"><b>{nba.title}</b><br/><span className="why">{nba.why}</span></div>
          <button className="btn primary sm" onClick={()=>go(nba.go)}>Go to step</button>
          <button className="btn ghost sm" onClick={()=>setDismissed(d=>({...d,[nba.id]:true}))}>Later</button>
          {actions.length > 1 && <span className="small muted">{actions.length - 1} more</span>}
        </> : <><span className="lead">All caught up</span><span className="why">No open actions for {S.role}. Switch role to see other owners’ next steps.</span></>}
      </div>
      <nav className="side" aria-label="Transformation journey">
        {NAV.map(g => <div key={g.stage} className="stage">
          <div className="stage-h">{g.stage}{stagePct[g.stage] != null && <Ring pct={stagePct[g.stage]}/>}</div>
          {g.items.map(([k, l]) => <button key={k} className={'nav-item' + (nba && nba.go === k && screen !== k ? ' recommended' : '')} aria-current={screen===k?'page':undefined} onClick={()=>go(k)}>{l}{k==='approvals' && S.approvals.filter(a=>a.status==='Pending').length > 0 && <span className="count">{S.approvals.filter(a=>a.status==='Pending').length}</span>}</button>)}
        </div>)}
        <div className="stage"><div className="stage-h">Phase 2 modules</div>{LATER.map(l => <button key={l} className="nav-item" disabled title="Planned for Phase 2: assessment engine">{l}</button>)}</div>
        <p className="small muted" style={{padding:'8px 10px'}}>Saved {persist === 'server' ? 'on the server' : 'in this browser only'}.</p>
      </nav>
      <main className="main" ref={mainRef}><Screen/></main>
      <aside className={'rail' + (rail ? '' : ' closed')} aria-label="Copilot and context">
        {rail && <>
          <div className="rail-tabs" role="tablist">{[['copilot','Copilot'],['evidence','Evidence'],['activity','Activity']].map(([k,l]) => <button key={k} role="tab" aria-selected={railTab===k} onClick={()=>setRailTab(k)}>{l}</button>)}<button onClick={()=>setRail(false)} aria-label="Close the side panel" style={{flex:'0 0 auto'}}>Close</button></div>
          {railTab === 'copilot' && <Chat screen={screen}/>}
          {railTab === 'evidence' && <div style={{padding:12,overflow:'auto'}}>{S.imports.map(i => <div key={i.id} style={{padding:'8px 0',borderBottom:'1px solid var(--line-2)'}}><b className="small">{i.file}</b><div className="small muted">{i.type} · {fmt(i.rows)} rows · {i.date} · {i.by}</div></div>)}<p className="small muted">Every score in the Studio links back to one of these files or to a named person’s assessment.</p></div>}
          {railTab === 'activity' && <div style={{padding:12,overflow:'auto'}}>{S.audit.slice(0,80).map((a,i) => <div key={i} style={{padding:'6px 0',borderBottom:'1px solid var(--line-2)'}} className="small"><b>{a.what}</b><div className="muted">{a.who} · {a.t}</div></div>)}</div>}
        </>}
      </aside>
    </div>
    {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
  </Store.Provider>;
}
