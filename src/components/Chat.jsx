import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../data/model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from './ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export const SUGGESTIONS = {
  executive:['What should I decide this week?','Where is the evidence weakest?'],
  discovery:['Which evidence is still missing for ECP?','What does the EHP mismatch mean for us?'],
  readiness:['Which blockers matter most for the strategy?','Group the open findings into work packages'],
  wricef:['Which objects are safest to retire?','Why are so many objects in manual review?'],
  reports:['Which FI reports are affected by the Universal Journal?','Which reports could use standard apps?'],
  modules:['Which module is most complex and why?'],
  strategy:['What would make greenfield the better option?','What evidence would raise confidence?'],
  hyperscaler:['What must SAP confirm before we choose?'],
  btp:['Is every BTP component justified?'],
  plan:['What threatens the critical path?'],
  risk:['Which risks need action before the first mock conversion?'],
  advisor:['Which WRICEF objects should we retire or rebuild on BTP?','Which critical-path dependencies put go-live at risk?','Summarise programme status for the CIO'],
};

export function Chat({screen, full}){
  const {S, D, ask, aiReady, aiStatus, selection, log, toast, chat, setChat} = useStore();
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const ctl = useRef(null); const end = useRef(null);
  useEffect(() => { end.current && end.current.scrollIntoView({block:'end'}); }, [chat]);
  const selRec = selection ? (selection.kind === 'wricef' ? D.wr.find(o=>o.id===selection.id) : selection.kind === 'report' ? D.rp.find(r=>r.id===selection.id) : D.fd.find(f=>f.id===selection.id)) : null;
  const send = async text => {
    const msg = (text || q).trim(); if (!msg || busy) return;
    setQ(''); const turns = [...chat.filter(m=>m.role!=='sys'), {role:'user', content:msg}];
    setChat([...chat, {role:'user', content:msg}, {role:'assistant', content:'', pending:true}]); setBusy(true);
    ctl.current = new AbortController();
    const context = `${AI_RULES}\n\nThe user is on the "${screen}" screen with role "${S.role}".${selRec ? `\nSelected record: ${JSON.stringify(selRec)}` : ''}\nPROJECT DATA (JSON): ${JSON.stringify(projectSummary(S, D))}`;
    try {
      const {text: out} = await ask([{role:'user', content: context}, ...turns.slice(-8).map(m=>({role:m.role, content:m.content}))], {cache:false, signal:ctl.current.signal, onText:({text}) => setChat(c => c.map((m,i)=> i===c.length-1 ? {...m, content:text} : m))});
      setChat(c => c.map((m,i)=> i===c.length-1 ? {role:'assistant', content:out} : m)); log('Asked the AI advisor: ' + msg.slice(0,80));
    } catch(e) {
      setChat(c => c.map((m,i)=> i===c.length-1 ? {role:'sys', content: (e && e.text ? e.text + '\n\n' : '') + aiErrorText(e)} : m));
    } finally { setBusy(false); }
  };
  if (aiStatus === 'off') return <div className="chat"><div className="chat-log"><div className="msg sys">AI is not configured on this server, so the advisor is off. An administrator can enable it by setting ANTHROPIC_API_KEY. The rules-based guide in the bar above still works.</div></div></div>;
  return <div className="chat" style={full ? {height:'calc(100vh - 230px)', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)'} : {}}>
    <div className="chat-log" aria-live="polite">
      {chat.length === 0 && <div className="msg sys">Ask about this project. Answers use only the Studio’s data, cite record IDs and say which approval is needed. Questions and the project summary are sent to the AI service configured by your administrator.</div>}
      {chat.map((m,i) => <div key={i} className={'msg ' + (m.role==='user'?'user':m.role==='sys'?'sys':'ai')}>{m.pending && !m.content ? 'Thinking…' : m.content}
        {m.role === 'assistant' && !m.pending && m.content && <div className="row" style={{marginTop:8}}><button className="btn sm" onClick={()=>{log('Created task from AI answer'); toast('Task added to the remediation backlog');}}>Create task</button><button className="btn sm" onClick={()=>{log('Added AI answer to decision register as a draft'); toast('Draft added to the decision register');}}>Add to decision draft</button></div>}
      </div>)}
      <div ref={end}/>
    </div>
    <div className="suggest">{(SUGGESTIONS[screen] || SUGGESTIONS.advisor).map(s => <button key={s} onClick={()=>send(s)} disabled={busy}>{s}</button>)}</div>
    <div className="chat-in">
      <textarea value={q} onChange={e=>setQ(e.target.value)} placeholder={aiReady ? 'Ask about this screen or the whole programme' : 'Connecting…'} onKeyDown={e=>{ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }} aria-label="Ask the AI advisor"/>
      {busy ? <button className="btn" onClick={()=>ctl.current && ctl.current.abort()}>Stop</button> : <button className="btn primary" onClick={()=>send()} disabled={!aiReady || !q.trim()}>Ask</button>}
    </div>
  </div>;
}
