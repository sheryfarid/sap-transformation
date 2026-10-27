import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import { fmt } from '../data/model.js';
export const CONF = {
  source:['b-source','Confirmed: source evidence'], sap:['b-sap','Confirmed: SAP guidance'], architect:['b-architect','Architect assessment'],
  ai:['b-ai','AI recommendation'], unknown:['b-unknown','Unknown: needs evidence'], rule:['b-rule','Rule proposal']
};

export function Badge({conf, children}){ const c = CONF[conf] || CONF.unknown; return <span className={'badge ' + c[0]}>{conf === 'ai' && <Spark/>}{children || c[1]}</span>; }

export function Spark(){ return <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0l1.8 5.2L15 7l-5.2 1.8L8 14l-1.8-5.2L1 7l5.2-1.8z"/></svg>; }

export function StatusBadge({s}){
  const m = {proposed:['b-rule','Rule proposal'], ai:['b-ai','AI proposal'], accepted:['b-source','Accepted'], rejected:['b-unknown','Rejected'], manual:['b-unknown','Manual review']};
  const c = m[s] || m.proposed; return <span className={'badge ' + c[0]}>{s === 'ai' && <Spark/>}{c[1]}</span>;
}

export function MetaStrip({source, date, evidence, conf, owner, risk, action, review}){
  return <div className="meta" role="note" aria-label="Assessment metadata">
    <span>Source <b>{source}</b></span>
    <span>Last assessed <b>{date || 'Not yet'}</b></span>
    <span>Evidence <b>{evidence}</b></span>
    <span>Confidence <Badge conf={conf}/></span>
    <span>Decision owner <b>{owner}</b></span>
    <span>Risk <b>{risk}</b></span>
    <span>Recommended action <b>{action}</b></span>
    <span>Review <b>{review}</b></span>
  </div>;
}

export function Ring({pct, size=18}){
  const r = (size-4)/2, c = 2*Math.PI*r, v = Math.max(0, Math.min(100, pct||0));
  return <svg width={size} height={size} className="ring" role="img" aria-label={`${v}% complete`}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth="3"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={v>=70?'var(--good)':v>=40?'var(--warn)':'var(--bad)'} strokeWidth="3" strokeDasharray={`${c*v/100} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`}/></svg>;
}

export function Drawer({title, onClose, children}){
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="drawer-bg" onClick={onClose}><div className="drawer" role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}>
    <div className="row" style={{marginBottom:8}}><h2 style={{margin:0}}>{title}</h2><span className="spacer"/><button className="btn ghost" onClick={onClose} aria-label="Close">Close</button></div>
    {children}
  </div></div>;
}

export function Pager({page, setPage, total, per}){
  const pages = Math.max(1, Math.ceil(total/per));
  return <div className="pager"><span>{fmt(total)} records</span>
    <button className="btn sm" disabled={page<=0} onClick={()=>setPage(page-1)}>Previous</button>
    <span>Page {page+1} of {pages}</span>
    <button className="btn sm" disabled={page>=pages-1} onClick={()=>setPage(page+1)}>Next</button></div>;
}

export function AIProposal({title, text, busy, onAccept, onDismiss, error, acceptLabel = 'Record as proposal for review'}){
  if (!busy && !text && !error) return null;
  return <div className="proposal" aria-live="polite">
    <h4><Spark/>{title || 'AI proposal'}<span className="spacer"/><span className="badge b-ai">Needs human review</span></h4>
    {error ? <div className="body" style={{color:'var(--bad)'}}>{error}</div> : <div className="body">{text || 'Thinking…'}</div>}
    {(onAccept || onDismiss) && text && !busy && <div className="row" style={{marginTop:10}}>
      {onAccept && <button className="btn primary sm" onClick={onAccept}>{acceptLabel}</button>}
      {onDismiss && <button className="btn sm" onClick={onDismiss}>Dismiss</button>}
    </div>}
  </div>;
}

