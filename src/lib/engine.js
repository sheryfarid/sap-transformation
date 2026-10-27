// Pure domain logic: derived metrics, guidance rules, scoring and planning. No React, no I/O.
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../data/model.js';

export const INITIAL_BTP = {
  nodes:[
    {id:'n1',label:'S/4HANA Cloud Private Edition',kind:'Core ERP',x:300,y:210,s4:true,ent:'Contracted'},
    {id:'n2',label:'SAP Integration Suite',kind:'Integration',x:40,y:60,ent:'Not verified'},
    {id:'n3',label:'Cloud Connector',kind:'Integration',x:40,y:210,ent:'Not verified'},
    {id:'n4',label:'SAP Build Process Automation',kind:'Automation',x:560,y:60,ent:'Not verified'},
    {id:'n5',label:'SAP Analytics Cloud',kind:'Data and analytics',x:560,y:360,ent:'Not verified'},
    {id:'n6',label:'External MES',kind:'External',x:40,y:380,ent:'n/a'},
    {id:'n7',label:'Identity Authentication',kind:'Security',x:300,y:420,ent:'Not verified'},
  ],
  edges:[['n2','n1'],['n3','n1'],['n6','n2'],['n4','n1'],['n5','n1'],['n7','n1']]
};

export function initialState(){
  return {
    v:1, role:'Programme Director',
    imports:[{id:'IMP-001',file:'readiness_check_ECP_2026-09-12.json',type:'Readiness Check export',rows:FINDINGS.length,date:'2026-09-12',by:'Tom Byrne (Basis lead)'},
             {id:'IMP-002',file:'atc_results_ECD.xlsx',type:'ATC results',rows:2400,date:'2026-09-15',by:'Ravi Iyer (ABAP lead)'}],
    wrUsage:{}, wr:{}, rp:{}, fd:{},
    rates:{...DEFAULT_RATES},
    strat:{weights:Object.fromEntries(STRAT_CRITERIA.map(c=>[c.k,c.w])), inputs:{redesign:4,history:3,downtime:2,timeline:3}, decision:null},
    hyper:{weights:Object.fromEntries(HYPER_CRITERIA.map(c=>[c.k,c.w])), scores:{}, synthetic:false, selected:null, region:'EU (Germany)'},
    btp:INITIAL_BTP,
    plan:{fte:18, start:'2027-01-11', phaseWeeks:{Discover:4,Prepare:6,Explore:10,Deploy:8,Run:6}, generated:false, baselined:false, crs:[]},
    approvals:[], risks:RISKS0, cutover:CUTOVER0,
    onboarding:{step:0, org:'ABC Manufacturing (synthetic)', industry:'Discrete manufacturing', countries:'Germany, United States', entities:'3', plants:'3', residency:'EU data must stay in the EU', mode:'A', done:true},
    audit:[{t:'2026-09-12',who:'Tom Byrne (Basis lead)',what:'Imported Readiness Check export for ECP'}]
  };
}

export function computeDerived(S){
  {
    const wr = WRICEF.map(o => {
      const usage = S.wrUsage[o.id];
      const base = usage != null ? {...o, lastExecDays: usage, usageSrc:'import'} : o;
      const rule = wricefRule(base);
      const ov = S.wr[o.id];
      const disp = ov && ov.d ? ov.d : rule.disp;
      const status = ov ? ov.s : (rule.disp === 'MANUAL REVIEW' ? 'manual' : 'proposed');
      const conf = ov && ov.c ? ov.c : rule.conf;
      return {...base, rule, disp, status, conf, rationale: ov && ov.r, by: ov && ov.by};
    });
    const rp = REPORTS.map(r => {
      const rule = reportRule(r); const ov = S.rp[r.id];
      return {...r, rule, opt: ov && ov.o !== undefined ? ov.o : rule.opt, status: ov ? ov.s : (rule.opt ? 'proposed' : 'manual'), conf: ov && ov.c ? ov.c : rule.conf, rationale: ov && ov.r, by: ov && ov.by};
    });
    const fd = FINDINGS.map(f => ({...f, ...(S.fd[f.id] || {})}));
    const count = (arr, fn) => arr.reduce((n, x) => n + (fn(x) ? 1 : 0), 0);
    const wrUnknown = count(wr, o => o.lastExecDays == null);
    const wrPending = count(wr, o => o.status === 'proposed' || o.status === 'ai');
    const wrAccepted = count(wr, o => o.status === 'accepted');
    const rpUnknown = count(rp, r => r.runsPerMonth == null);
    const rpPending = count(rp, r => r.status === 'proposed' || r.status === 'ai');
    const rpAccepted = count(rp, r => r.status === 'accepted');
    const blockers = fd.filter(f => f.blocker && f.status !== 'Resolved');
    const noOwner = fd.filter(f => !f.owner && f.status !== 'Resolved');
    const dispCounts = Object.fromEntries(DISPOSITIONS.map(d => [d, count(wr, o => o.disp === d)]));
    const effort = wr.reduce((s, o) => s + (S.rates[o.disp] || 0), 0);
    const effortAccepted = wr.filter(o => o.status === 'accepted').reduce((s, o) => s + (S.rates[o.disp] || 0), 0);
    const hyperFilled = HYPER.reduce((n,p) => n + HYPER_CRITERIA.filter(c => S.hyper.scores[p] && S.hyper.scores[p][c.k] != null).length, 0);
    const hyperTotal = HYPER.length * HYPER_CRITERIA.length;
    // domain heatmap
    const domainOf = m => ({FI:'Finance',CO:'Finance',MM:'Procurement',SD:'Sales',PP:'Manufacturing',QM:'Manufacturing',PM:'Manufacturing',PS:'Manufacturing'})[m];
    const domains = ['Finance','Procurement','Sales','Manufacturing','Warehouse','HR','Analytics','Integrations','Security','Infrastructure'];
    const heat = domains.map(d => {
      let items = [], f = [];
      if (['Finance','Procurement','Sales','Manufacturing'].includes(d)) { items = wr.filter(o => domainOf(o.module) === d); f = fd.filter(x => domainOf(x.module) === d); }
      if (d === 'Warehouse') { f = fd.filter(x => /Warehouse|Inventory/.test(x.title)); items = []; }
      if (d === 'Analytics') items = rp.map(r => ({lastExecDays: r.runsPerMonth, status: r.status}));
      if (d === 'Integrations') items = wr.filter(o => o.type === 'I');
      if (d === 'Infrastructure') items = SYSTEMS.map(s => ({lastExecDays: s.evidence === 'source' ? 1 : null, status:'accepted'}));
      const completeness = items.length ? Math.round(100 * items.filter(i => i.lastExecDays != null).length / items.length) : (f.length ? 40 : 0);
      const crit = f.filter(x => (x.severity === 'Critical' || x.severity === 'High') && x.status !== 'Resolved').length;
      const readiness = completeness === 0 ? null : Math.max(5, Math.min(95, Math.round(completeness * 0.6 + Math.max(0, 40 - crit * 4))));
      const reviewed = items.length ? Math.round(100 * items.filter(i => i.status === 'accepted').length / items.length) : 0;
      return {d, completeness, readiness, crit, reviewed, n: items.length};
    });
    const evidenceComplete = Math.round(heat.reduce((s,h)=>s+h.completeness,0) / heat.length);
    const readiness = Math.round(heat.filter(h=>h.readiness!=null).reduce((s,h)=>s+h.readiness,0) / Math.max(1, heat.filter(h=>h.readiness!=null).length));
    return {wr, rp, fd, wrUnknown, wrPending, wrAccepted, rpUnknown, rpPending, rpAccepted, blockers, noOwner, dispCounts, effort, effortAccepted, hyperFilled, hyperTotal, heat, evidenceComplete, readiness};
  }
}

export function nextActions(S, D){
  const a = [];
  const pendingApprovals = S.approvals.filter(x => x.status === 'Pending');
  if (!S.onboarding.done) a.push({id:'onb', score:100, title:'Finish project onboarding', why:'Every later step needs the landscape and owners.', go:'onboarding', roles:'*'});
  if (D.wrUnknown > 0) a.push({id:'usage', score:90, title:`Import usage evidence for ${D.wrUnknown} custom objects`, why:'Without usage data these objects stay in manual review and retirement savings cannot be estimated.', go:'discovery', roles:['Programme Director','ABAP Lead','Solution Architect']});
  if (D.noOwner.length) a.push({id:'own', score:85, title:`Assign owners to ${D.noOwner.length} readiness findings`, why:`${D.noOwner.filter(f=>f.blocker).length} of them are blockers. Unowned blockers stop the strategy decision.`, go:'readiness', roles:['Programme Director','Solution Architect']});
  if (D.wrPending > 0) a.push({id:'wrrev', score:75, title:`Review ${D.wrPending} WRICEF disposition proposals`, why:'Proposals do not count toward the plan until a person accepts them.', go:'wricef', roles:['ABAP Lead','Solution Architect','Programme Director']});
  if (D.rpPending > 0) a.push({id:'rprev', score:65, title:`Confirm targets for ${D.rpPending} legacy reports`, why:'Standard-first review avoids rebuilding reports that SAP already provides.', go:'reports', roles:['Analytics Lead','Solution Architect','Programme Director']});
  if (!S.strat.decision) a.push({id:'strat', score:60, title:'Compare migration strategies and raise a decision', why:'The plan and architecture depend on brownfield, greenfield or selective transition.', go:'strategy', roles:['Solution Architect','Programme Director','CIO']});
  if (D.hyperFilled < D.hyperTotal) a.push({id:'hyp', score:50, title:`Complete hyperscaler scoring (${D.hyperFilled} of ${D.hyperTotal} cells)`, why:'Unknown cells keep the comparison from ranking providers.', go:'hyperscaler', roles:['Solution Architect','CIO','Programme Director']});
  if (!S.plan.baselined) a.push({id:'plan', score:40, title: S.plan.generated ? 'Submit the Activate plan for baseline approval' : 'Generate the SAP Activate plan', why:'A baselined plan is needed before delivery tracking starts.', go:'plan', roles:['Programme Director']});
  if (pendingApprovals.length) a.push({id:'appr', score: S.role === 'CIO' ? 110 : 55, title:`Decide ${pendingApprovals.length} pending approval${pendingApprovals.length>1?'s':''}`, why:'Decisions waiting for you hold up downstream work.', go:'approvals', roles:'*'});
  return a.filter(x => x.roles === '*' || x.roles.includes(S.role)).sort((x,y)=>y.score-x.score);
}

export function projectSummary(S, D){
  return {
    company:'ABC Manufacturing (synthetic demo data)', source:'SAP ECC 6.0 EHP5 on Oracle, on-premises', target:'SAP S/4HANA Cloud Private Edition (RISE with SAP)',
    systems: SYSTEMS.map(s=>({sid:s.sid, role:s.role, product:s.product, evidence:s.evidence})),
    evidenceCompletenessPct: D.evidenceComplete, readinessScore: D.readiness,
    findings:{total:D.fd.length, openBlockers:D.blockers.length, withoutOwner:D.noOwner.length},
    wricef:{total:D.wr.length, unknownUsage:D.wrUnknown, pendingReview:D.wrPending, accepted:D.wrAccepted, byDisposition:D.dispCounts, effortPersonDaysAllProposals:Math.round(D.effort), rateCardIsEstimate:true},
    reports:{total:D.rp.length, unknownUsage:D.rpUnknown, pendingReview:D.rpPending, accepted:D.rpAccepted},
    heatmap: D.heat.map(h=>({domain:h.d, completeness:h.completeness, readiness:h.readiness, openHighOrCritical:h.crit})),
    strategyDecision: S.strat.decision, hyperscaler:{scoredCells:D.hyperFilled, totalCells:D.hyperTotal, selected:S.hyper.selected, synthetic:S.hyper.synthetic},
    plan:{generated:S.plan.generated, baselined:S.plan.baselined, fte:S.plan.fte},
    pendingApprovals: S.approvals.filter(a=>a.status==='Pending').map(a=>a.title),
    topRisks: S.risks.slice().sort((a,b)=>b.l*b.i-a.l*a.i).slice(0,5).map(r=>({id:r.id,title:r.title,score:r.l*r.i}))
  };
}

export const clamp = (v, a=1, b=5) => Math.max(a, Math.min(b, v));

export function strategyScores(S, D, inputs){
  const I = inputs || S.strat.inputs;
  const known = D.wr.length - D.dispCounts['MANUAL REVIEW'];
  const reuse = known ? (D.dispCounts['RETAIN'] + D.dispCounts['REMEDIATE'] + D.dispCounts['REBUILD ON-STACK']) / known : 0.5;
  const dqIssues = D.fd.filter(f => (f.category === 'Financial data quality' || f.category === 'Business Partner / CVI') && f.status !== 'Resolved').length;
  const dq = clamp(5 - dqIssues / 3);
  const b = D.blockers.length;
  const sc = {
    Brownfield:{eligibility:clamp(5 - b/4), reuse:1+4*reuse, redesign:6-I.redesign, history:I.history, downtime:I.downtime, timeline:clamp(2+I.timeline*0.6), dq:dq},
    Greenfield:{eligibility:5, reuse:1+4*(1-reuse), redesign:I.redesign, history:6-I.history, downtime:4, timeline:6-I.timeline, dq:clamp(2+(5-dq)*0.75)},
    'Selective data transition':{eligibility:clamp(4.5 - b/8), reuse:2+2*reuse, redesign:3.5, history:4, downtime:3, timeline:3, dq:3.5},
  };
  const W = S.strat.weights, tw = Object.values(W).reduce((a,c)=>a+c,0) || 1;
  const total = Object.fromEntries(Object.entries(sc).map(([k, v]) => [k, STRAT_CRITERIA.reduce((a,c)=>a+W[c.k]*v[c.k],0)/tw]));
  const evidenceShare = STRAT_CRITERIA.filter(c=>c.src==='evidence').reduce((a,c)=>a+W[c.k],0)/tw;
  const winner = Object.entries(total).sort((a,b)=>b[1]-a[1])[0][0];
  return {sc, total, winner, evidenceShare, reuse, dqIssues, b};
}

export function planModel(S, D){
  const P = S.plan;
  const findingEffort = D.fd.filter(f=>f.status!=='Resolved').reduce((a,f)=>a+f.effortDays,0);
  const realizeEffort = D.effortAccepted + findingEffort;
  const realize = Math.max(8, Math.ceil(realizeEffort / Math.max(1, P.fte * 4)));
  const weeks = {...P.phaseWeeks, Realize: realize};
  let w = 0; const ph = PHASES.map(p => { const s = w; w += weeks[p]; return {p, s, e:w}; });
  const span = (a, b) => ({s: ph.find(x=>x.p===a).s, e: ph.find(x=>x.p===b).e});
  const ws = {
    'Programme Management':span('Discover','Run'), 'SAP Basis':span('Prepare','Deploy'), 'Functional Design':span('Explore','Realize'),
    'Custom Code':span('Realize','Realize'), 'Data Migration':span('Explore','Deploy'), 'Integrations':span('Explore','Realize'), 'Reporting':span('Realize','Deploy'),
    'Security':span('Explore','Deploy'), 'Testing':{s:ph[3].s + Math.floor(weeks.Realize/2), e:ph[4].e}, 'Business Change':span('Explore','Run'), 'Cutover':span('Deploy','Deploy'), 'Hypercare':span('Run','Run')
  };
  const critical = ['Custom Code','Data Migration','Testing','Cutover'];
  const dateAt = wk => { const d = new Date(Date.parse(P.start) + wk*7*864e5); return d.toISOString().slice(0,10); };
  return {ph, ws, critical, total:w, realizeEffort, findingEffort, dateAt, weeks};
}
