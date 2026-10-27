import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../data/model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

const CAN_APPROVE = {'Steering committee':['CIO','Programme Director'], 'Programme Director':['Programme Director']};

export function Approvals(){
  const {S, setS, log, toast} = useStore();
  const decide = (a, ok) => {
    setS(s => {
      const next = {...s, approvals: s.approvals.map(x => x.id === a.id ? {...x, status: ok ? 'Approved' : 'Rejected', decidedBy: s.role, decidedOn: today} : x)};
      if (ok && a.type === 'strategy') next.strat = {...s.strat, decision: a.payload};
      if (ok && a.type === 'hyperscaler') next.hyper = {...s.hyper, selected: a.payload};
      if (ok && a.type === 'plan') next.plan = {...s.plan, baselined: true};
      return next;
    });
    log(`${ok ? 'Approved' : 'Rejected'}: ${a.title}`); toast(ok ? 'Approved and recorded' : 'Rejected and recorded');
  };
  return <>
    <div className="page-head"><div><h1>Approvals and decisions</h1><p className="sub">Every decision with its requester, approver and outcome. Switch role in the header to act as a different approver.</p></div></div>
    {S.approvals.length === 0 ? <div className="panel empty">No decisions raised yet. Raise one from the strategy, hyperscaler or plan screens.</div> :
    <div className="tw"><table className="t"><thead><tr><th>ID</th><th>Decision</th><th>Requested by</th><th>Approver</th><th>Status</th><th></th></tr></thead>
      <tbody>{S.approvals.map(a => { const can = (CAN_APPROVE[a.approver] || []).includes(S.role); return <tr key={a.id} style={{cursor:'default'}}><td>{a.id}</td><td><b>{a.title}</b><div className="small muted">{a.detail}</div></td><td className="small">{a.requester}<div className="muted">{a.date}</div></td><td className="small">{a.approver}</td>
        <td>{a.status === 'Pending' ? <span className="badge b-unknown">Pending</span> : <span className={'badge ' + (a.status==='Approved'?'b-source':'b-rule')}>{a.status}</span>}{a.decidedBy && <div className="small muted">{a.decidedBy}, {a.decidedOn}</div>}</td>
        <td>{a.status === 'Pending' && (can ? <div className="row"><button className="btn primary sm" onClick={()=>decide(a,true)}>Approve</button><button className="btn sm" onClick={()=>decide(a,false)}>Reject</button></div> : <span className="small muted">Needs {(CAN_APPROVE[a.approver]||[]).join(' or ')}</span>)}</td></tr>; })}</tbody></table></div>}
  </>;
}

