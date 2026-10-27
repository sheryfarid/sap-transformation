import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

export function Exports(){
  const {S, D, log, toast} = useStore();
  const save = (filename, data) => {
    const type = filename.endsWith('.json') ? 'application/json' : filename.endsWith('.csv') ? 'text/csv' : 'text/markdown';
    const url = URL.createObjectURL(new Blob([data], { type: type + ';charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Downloaded ' + filename); log('Exported ' + filename);
  };
  const json = () => JSON.stringify({generated: today, synthetic: true, notice:'Synthetic demonstration data for ABC Manufacturing. Not customer facts.', summary: projectSummary(S, D),
    wricef: D.wr.map(o=>({id:o.id, tech:o.tech, type:o.type, module:o.module, disposition:o.disp, status:o.status, confidence:o.conf})),
    reports: D.rp.map(r=>({id:r.id, source:r.source, module:r.module, target:r.opt, status:r.status})),
    findings: D.fd.map(f=>({id:f.id, title:f.title, severity:f.severity, owner:f.owner, status:f.status})), approvals:S.approvals, risks:S.risks, audit:S.audit}, null, 2);
  const md = () => {
    const s = strategyScores(S, D);
    return `# Migration assessment: ABC Manufacturing (synthetic)\n\nGenerated ${today} by SAP Transformation Intelligence Studio. All figures are synthetic demonstration data.\n\n## Status\n\n- Readiness score: ${D.readiness}% (configurable rules)\n- Evidence completeness: ${D.evidenceComplete}%\n- Open blockers: ${D.blockers.length}\n- WRICEF: ${D.wr.length} objects, ${D.wrAccepted} accepted, ${D.wrPending} pending review, ${D.wrUnknown} without usage evidence\n- Reports: ${D.rp.length}, ${D.rpAccepted} targets accepted\n\n## Strategy\n\nLeading option: ${s.winner} (${(s.total[s.winner]/5*100).toFixed(0)}%). Decision: ${S.strat.decision || 'not yet approved'}. ${Math.round(s.evidenceShare*100)}% of the weighting comes from evidence.\n\n## WRICEF disposition\n\n${DISPOSITIONS.map(d=>`- ${d}: ${D.dispCounts[d]}`).join('\n')}\n\n## Deployment target\n\n${S.hyper.selected || 'Not selected'}${S.hyper.synthetic ? ' (synthetic workshop scores)' : ''}. SAP confirmation of region and model eligibility is required.\n\n## Decisions\n\n${S.approvals.map(a=>`- ${a.title}: ${a.status}`).join('\n') || '- None raised'}\n\n## Top risks\n\n${S.risks.slice().sort((a,b)=>b.l*b.i-a.l*a.i).slice(0,5).map(r=>`- ${r.title} (${r.l}×${r.i})`).join('\n')}\n`;
  };
  const csv = () => ['ID,Technical name,Type,Module,Disposition,Status,Confidence', ...D.wr.map(o=>[o.id,o.tech,WR_TYPES[o.type],o.module,o.disp,o.status,o.conf].join(','))].join('\n');
  const items = [
    ['Migration assessment (Markdown)','Executive summary of status, strategy, dispositions and risks.', () => save('migration-assessment.md', md())],
    ['WRICEF disposition matrix (CSV)','Every object with disposition, status and confidence. Opens in Excel.', () => save('wricef-disposition.csv', csv())],
    ['Structured assessment (JSON)','Full records, decisions and audit history for other tools.', () => save('assessment.json', json())],
  ];
  return <>
    <div className="page-head"><div><h1>Reports and exports</h1><p className="sub">Every export is stamped as synthetic and reflects the current state of the records.</p></div></div>
    <div className="grid g3">{items.map(([t,d,fn]) => <div key={t} className="panel" style={{margin:0}}><h3>{t}</h3><p className="small muted">{d}</p><button className="btn primary" onClick={fn}>Download</button></div>)}</div>
  </>;
}

