// Synthetic demonstration data for ABC Manufacturing and the deterministic rule engines.
// Everything here is generated: it is not customer data.

/* ---------- deterministic synthetic data (ABC Manufacturing) ---------- */
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export const R = mulberry32(20261019);
export const pick = a => a[Math.floor(R()*a.length)];
export const wpick = pairs => { const tot = pairs.reduce((s,p)=>s+p[1],0); let x = R()*tot; for (const p of pairs){ if((x-=p[1])<=0) return p[0]; } return pairs[0][0]; };
export const pad = (n,w=4) => String(n).padStart(w,'0');
export const fmt = n => n==null ? '—' : Number(n).toLocaleString('en-GB');
export const today = '2026-10-19';
export const daysAgoDate = d => { const t = new Date(Date.parse(today) - d*864e5); return t.toISOString().slice(0,10); };

export const MODULES = ['FI','CO','MM','SD','PP','QM','PM','PS'];
export const MODULE_NAMES = {FI:'Financial Accounting',CO:'Controlling',MM:'Materials Management',SD:'Sales and Distribution',PP:'Production Planning',QM:'Quality Management',PM:'Plant Maintenance',PS:'Project System'};
export const OWNERS = {FI:'Amira Patel (Finance lead)',CO:'Amira Patel (Finance lead)',MM:'Jonas Weber (Supply chain lead)',SD:'Lucia Romero (Order-to-cash lead)',PP:'Kenji Mori (Manufacturing lead)',QM:'Kenji Mori (Manufacturing lead)',PM:'Grace Okafor (Asset lead)',PS:'Grace Okafor (Asset lead)'};
export const TECH = ['Ravi Iyer (ABAP lead)','Sofia Lind (Integration lead)','Tom Byrne (Basis lead)','Mei Chen (Analytics lead)'];

export const SYSTEMS = [
  {sid:'ECP',role:'Production',product:'SAP ECC 6.0',ehp:'EHP5',db:'Oracle Database',os:'Unix',unicode:'Yes',hosting:'On-premises data centre',clients:'100',kernel:null,addons:15,sizeTB:4.5,users:1800,evidence:'source',lastAssessed:'2026-09-12'},
  {sid:'ECQ',role:'Quality assurance',product:'SAP ECC 6.0',ehp:'EHP5',db:'Oracle Database',os:'Unix',unicode:'Yes',hosting:'On-premises data centre',clients:'200, 300',kernel:null,addons:15,sizeTB:2.1,users:140,evidence:'source',lastAssessed:'2026-09-12'},
  {sid:'ECD',role:'Development',product:'SAP ECC 6.0',ehp:'EHP6',db:'Oracle Database',os:'Unix',unicode:'Yes',hosting:'On-premises data centre',clients:'100, 110',kernel:null,addons:15,sizeTB:0.6,users:65,evidence:'source',lastAssessed:'2026-09-12'},
  {sid:'BWP',role:'Production',product:'SAP BW 7.4',ehp:'—',db:'Oracle Database',os:'Unix',unicode:'Yes',hosting:'On-premises data centre',clients:'100',kernel:null,addons:2,sizeTB:3.2,users:310,evidence:'unknown',lastAssessed:null},
  {sid:'PIP',role:'Production',product:'SAP PI/PO 7.5',ehp:'—',db:'Oracle Database',os:'Unix',unicode:'Yes',hosting:'On-premises data centre',clients:'001',kernel:null,addons:0,sizeTB:0.4,users:20,evidence:'unknown',lastAssessed:null},
];

export const FINDING_TEMPLATES = [
  ['Business Partner approach (customer/vendor integration) is mandatory','Business Partner / CVI','SD',"Critical"],
  ['Customer and vendor master records not yet synchronised to Business Partner','Business Partner / CVI','MM',"Critical"],
  ['Universal Journal changes the finance data model','Finance data model','FI',"High"],
  ['Classic General Ledger in use: migration to new GL approach required','Finance data model','FI',"Critical"],
  ['Asset Accounting moves to the new asset accounting approach','Finance data model','FI',"High"],
  ['Credit management moves to FIN-FSCM credit management','Simplification item','SD',"High"],
  ['Rebate processing replaced by settlement management','Simplification item','SD',"Medium"],
  ['Material number field length extended to 40 characters','Simplification item','MM',"Medium"],
  ['Inventory management uses a simplified data model','Simplification item','MM',"Medium"],
  ['MRP Live replaces classic MRP transactions','Simplification item','PP',"Medium"],
  ['Output management changes for forms and messages','Simplification item','SD',"Medium"],
  ['Warehouse Management (LE-WM) is not the target architecture','Simplification item','MM',"High"],
  ['Foreign trade functionality replaced','Simplification item','SD',"Low"],
  ['Add-on has no confirmed compatibility with the target release','Add-on compatibility','MM',"Critical"],
  ['Business function active that is not supported in the target','Business function','FI',"High"],
  ['Inconsistent financial data found in reconciliation checks','Financial data quality','FI',"High"],
  ['Custom code uses tables replaced by compatibility views','Custom code','CO',"Medium"],
  ['Project System functionality requires review for simplifications','Simplification item','PS',"Low"],
  ['Quality notification transactions changed','Simplification item','QM',"Low"],
  ['Plant Maintenance transactions superseded by Fiori apps','Simplification item','PM',"Low"],
];
export const FINDINGS = [];
(() => {
  let n = 1;
  for (let rep = 0; rep < 5; rep++) {
    for (const [title, cat, mod, sev] of FINDING_TEMPLATES) {
      if (rep > 0 && R() < 0.35) continue;
      const m = rep === 0 ? mod : (R() < 0.6 ? mod : pick(MODULES));
      const s = rep === 0 ? sev : wpick([[sev,5],['Medium',3],['Low',2]]);
      FINDINGS.push({
        id: 'F-' + pad(n, 3), title: rep === 0 ? title : title + ' (' + pick(['company code 1000','company code 2000','plant 1100','plant 1200','plant 1300','sales org 1000']) + ')',
        category: cat, module: m, system: 'ECP', severity: s,
        sapRef: 'Synthetic ref SI-' + pad(100 + n, 4), conf: 'source',
        effortDays: s === 'Critical' ? 10 + Math.floor(R()*20) : s === 'High' ? 5 + Math.floor(R()*10) : 1 + Math.floor(R()*5),
        owner: R() < 0.55 ? OWNERS[m] : null, status: 'Open', blocker: s === 'Critical',
        impact: s === 'Critical' ? 'Blocks conversion until resolved' : s === 'High' ? 'Mandatory change with process impact' : 'Change with limited process impact'
      });
      n++;
    }
  }
})();

export const WR_TYPES = {W:'Workflow',R:'Report',I:'Interface',C:'Conversion',E:'Enhancement',F:'Form'};
export const WR_NAMES = {
  W:['Purchase requisition approval','Invoice parking release','Credit block release','Material master change approval','Maintenance order approval','Journal entry approval'],
  R:['Open items ageing','Stock valuation by plant','Sales margin analysis','Vendor payment forecast','Cost centre variance','Production order backlog','Scrap rate by line','GR/IR clearing analysis','Inspection lot summary','WBS budget vs actual'],
  I:['Bank statement inbound','EDI orders inbound (ORDERS)','EDI invoice outbound (INVOIC)','MES confirmation inbound','Carrier shipment outbound','Payroll posting inbound','Price list from PLM','Tax engine call','CRM customer sync','Supplier portal PO outbound'],
  C:['Customer master load','Vendor master load','Open PO load','Fixed asset load','BOM load','Routing load','Open AR items load','Inventory balance load'],
  E:['Pricing user exit','Delivery split BAdI','Output determination exit','MIGO validation','Credit check enhancement','Batch determination exit','Asset posting substitution','Sales order screen enhancement'],
  F:['Invoice form','Delivery note','Purchase order form','Pick list','Quality certificate','Payment advice']
};
export const DISPOSITIONS = ['RETIRE','RETAIN','REMEDIATE','REPLACE','REBUILD ON BTP','REBUILD ON-STACK','REENGINEER','MANUAL REVIEW'];
export const DEFAULT_RATES = {'RETIRE':0.5,'RETAIN':0.5,'REMEDIATE':3,'REPLACE':4,'REBUILD ON BTP':12,'REBUILD ON-STACK':8,'REENGINEER':15,'MANUAL REVIEW':1};

export const WRICEF = [];
(() => {
  const counts = {W:30,R:220,I:130,C:60,E:150,F:60};
  let n = 1;
  for (const [t, c] of Object.entries(counts)) {
    for (let i = 0; i < c; i++) {
      const mod = wpick([['FI',18],['CO',10],['MM',18],['SD',20],['PP',14],['QM',6],['PM',8],['PS',6]]);
      const unknownUsage = R() < 0.16;
      const stale = R() < 0.28;
      const last = unknownUsage ? null : Math.round(stale ? 400 + R()*1400 : R()*360);
      WRICEF.push({
        id: t + '-' + pad(n), type: t, module: mod,
        tech: 'Z' + mod + '_' + t + '_' + pad(n),
        name: pick(WR_NAMES[t]) + (R() < 0.5 ? '' : ' — ' + pick(['variant A','plant specific','legacy copy','v2','EU','US'])),
        package: 'Z' + mod + '_' + pick(['CORE','EXT','RPT','INT']),
        bizOwner: OWNERS[mod], techOwner: t === 'I' ? TECH[1] : t === 'R' ? (R()<0.5?TECH[3]:TECH[0]) : TECH[0],
        lastExecDays: last,
        dependents: Math.floor(Math.pow(R(), 3) * 9),
        atc: R() < 0.45 ? 1 + Math.floor(R()*14) : 0,
        critical: R() < 0.11,
        standardMatch: (t === 'R' || t === 'F' || t === 'W') ? R() < 0.22 : R() < 0.06,
        cleanCoreViolation: t === 'E' ? R() < 0.55 : R() < 0.12,
        obsoleteTech: t === 'I' ? R() < 0.35 : false,
        processChange: R() < 0.05,
        tables: pick(['BSEG, BKPF','MSEG, MKPF','VBAK, VBAP','EKKO, EKPO','AFKO, AFPO','QALS','AUFK','PRPS','KNA1, LFA1','COEP'])
      });
      n++;
    }
  }
})();

export function wricefRule(o) {
  if (o.lastExecDays == null) return {disp:'MANUAL REVIEW', rule:'No usage evidence for this object, so no disposition can be proposed.', conf:'unknown'};
  if (o.processChange) return {disp:'REENGINEER', rule:'Flagged for process redesign in fit-to-standard.', conf:'architect'};
  if (o.lastExecDays > 395 && o.dependents === 0 && !o.critical) return {disp:'RETIRE', rule:`Not executed for ${o.lastExecDays} days and no dependent objects.`, conf:'source'};
  if (o.standardMatch) return {disp:'REPLACE', rule:'Reference catalogue lists a candidate standard function for this purpose (to be validated in fit-to-standard).', conf:'architect'};
  if (o.type === 'I' && o.obsoleteTech) return {disp:'REBUILD ON BTP', rule:'Uses an interface technique flagged for replacement; candidate for Integration Suite.', conf:'architect'};
  if (o.type === 'E' && o.cleanCoreViolation) return {disp:'REBUILD ON-STACK', rule:'Modification-style enhancement; rebuild with released extension points.', conf:'source'};
  if (o.atc > 0) return {disp:'REMEDIATE', rule:`${o.atc} ATC findings for S/4HANA readiness.`, conf:'source'};
  return {disp:'RETAIN', rule:'Used, no ATC findings, no clean-core violation recorded.', conf:'source'};
}

export const REPORT_SOURCES = ['Classic ABAP report','ALV report','SAP Query','BEx query','BusinessObjects WebI','Crystal Reports','Analysis for Office','Excel extract'];
export const REPORT_OPTIONS = {
  A:'Standard Fiori analytical app', B:'S/4HANA Embedded Analytics', C:'CDS analytical query', D:'ABAP Cloud custom report',
  E:'SAP Analytics Cloud', F:'SAP Datasphere', G:'SAP BW/4HANA', H:'BTP analytical app', I:'Retain existing', J:'Retire'
};
export const REPORTS = [];
(() => {
  for (let i = 1; i <= 420; i++) {
    const src = wpick([['Classic ABAP report',22],['ALV report',20],['SAP Query',10],['BEx query',18],['BusinessObjects WebI',12],['Crystal Reports',5],['Analysis for Office',8],['Excel extract',5]]);
    const mod = wpick([['FI',22],['CO',14],['MM',16],['SD',20],['PP',12],['QM',5],['PM',6],['PS',5]]);
    const runs = R() < 0.12 ? null : (R() < 0.22 ? 0 : Math.round(Math.pow(R(),2)*300));
    REPORTS.push({
      id:'RPT-' + pad(i), name: pick(WR_NAMES.R) + ' ' + pick(['(monthly)','(daily)','by company code','by plant','summary','detail']),
      source: src, module: mod, owner: OWNERS[mod], runsPerMonth: runs,
      standardMatch: R() < 0.24, needsHistory: src === 'BEx query' ? R() < 0.6 : R() < 0.15,
      ujAffected: (mod === 'FI' || mod === 'CO') && R() < 0.65,
      duplicateGroup: R() < 0.1 ? 'DG-' + (1 + Math.floor(R()*14)) : null,
      regulatory: R() < 0.08
    });
  }
})();
export function reportRule(r) {
  if (r.runsPerMonth == null) return {opt:null, rule:'No usage evidence: confirm usage before choosing a target.', conf:'unknown'};
  if (r.runsPerMonth === 0 && !r.regulatory) return {opt:'J', rule:'No executions in the last 12 months and no regulatory flag.', conf:'source'};
  if (r.duplicateGroup && !r.regulatory) return {opt:'J', rule:`Near-duplicate of other reports in ${r.duplicateGroup}; consolidate into one target.`, conf:'architect'};
  if (r.standardMatch) return {opt:'A', rule:'A standard Fiori analytical app is a candidate match (validate fields and KPIs).', conf:'architect'};
  if ((r.source === 'BEx query') && r.needsHistory) return {opt:'G', rule:'BW query that depends on historical data kept outside S/4HANA.', conf:'architect'};
  if (r.source === 'BEx query') return {opt:'F', rule:'BW query without deep history: candidate for Datasphere.', conf:'architect'};
  if (['BusinessObjects WebI','Crystal Reports','Analysis for Office'].includes(r.source)) return {opt:'E', rule:'Presentation-layer report: candidate for SAP Analytics Cloud on top of CDS views.', conf:'architect'};
  if (['Classic ABAP report','ALV report','SAP Query','Excel extract'].includes(r.source)) return {opt:'C', rule:'Operational report close to transactional data: CDS analytical query.', conf:'architect'};
  return {opt:'B', rule:'Embedded analytics fits the reporting purpose.', conf:'architect'};
}

export const RISKS0 = [
  {id:'RSK-01',title:'Business Partner conversion errors delay the first mock conversion',l:4,i:5,owner:'Lucia Romero (Order-to-cash lead)',area:'Data'},
  {id:'RSK-02',title:'Three add-ons without confirmed compatibility',l:3,i:5,owner:'Tom Byrne (Basis lead)',area:'Technical'},
  {id:'RSK-03',title:'Usage evidence missing for 16% of custom objects',l:4,i:3,owner:'Ravi Iyer (ABAP lead)',area:'Custom code'},
  {id:'RSK-04',title:'PI/PO interface documentation incomplete',l:3,i:4,owner:'Sofia Lind (Integration lead)',area:'Integration'},
  {id:'RSK-05',title:'Finance key users unavailable during year-end close',l:3,i:3,owner:'Amira Patel (Finance lead)',area:'People'},
  {id:'RSK-06',title:'BW historical data retention requirements unknown',l:3,i:3,owner:'Mei Chen (Analytics lead)',area:'Analytics'},
  {id:'RSK-07',title:'Downtime window not agreed with plants',l:2,i:5,owner:'Kenji Mori (Manufacturing lead)',area:'Cutover'},
  {id:'RSK-08',title:'Entitlements for BTP services not verified against contract',l:3,i:2,owner:'Programme Director',area:'Commercial'},
];
export const CUTOVER0 = [
  ['Freeze legacy production changes','Tom Byrne (Basis lead)','Freeze'],
  ['Final backup of ECP and BWP','Tom Byrne (Basis lead)','Freeze'],
  ['Final open-item extracts','Amira Patel (Finance lead)','Extract'],
  ['Run conversion or migration sequence','Tom Byrne (Basis lead)','Convert'],
  ['Technical validation checklist','Tom Byrne (Basis lead)','Validate'],
  ['Financial reconciliation sign-off','Amira Patel (Finance lead)','Validate'],
  ['Inventory reconciliation by plant','Jonas Weber (Supply chain lead)','Validate'],
  ['Go/no-go gate 1: data and finance','Programme Director','Gate'],
  ['Activate interfaces in sequence','Sofia Lind (Integration lead)','Activate'],
  ['Reporting validation for critical reports','Mei Chen (Analytics lead)','Validate'],
  ['User access and roles enabled','Security lead','Activate'],
  ['Go/no-go gate 2: go-live approval','Steering committee','Gate'],
  ['Hypercare activation','Programme Director','Hypercare'],
].map((r,i)=>({id:'CUT-'+pad(i+1,2),task:r[0],owner:r[1],group:r[2],done:false,signed:false}));

/* ---------- strategy and hyperscaler models ---------- */
export const STRAT_CRITERIA = [
  {k:'eligibility',label:'Technical eligibility',w:15,src:'evidence'},
  {k:'reuse',label:'Reuse of existing custom code',w:15,src:'evidence'},
  {k:'redesign',label:'Process redesign goals',w:20,src:'assumption'},
  {k:'history',label:'Historical data requirements',w:15,src:'assumption'},
  {k:'downtime',label:'Downtime tolerance',w:10,src:'assumption'},
  {k:'timeline',label:'Timeline and budget pressure',w:15,src:'assumption'},
  {k:'dq',label:'Data quality',w:10,src:'evidence'},
];
export const HYPER = ['AWS','Microsoft Azure','Google Cloud','SAP data centre'];
export const HYPER_CRITERIA = [
  {k:'tech',label:'Technical suitability',w:30},
  {k:'compliance',label:'Compliance and data residency',w:20},
  {k:'commercial',label:'Commercial impact',w:20},
  {k:'integration',label:'Existing enterprise integration',w:15},
  {k:'resilience',label:'Resilience and operations',w:10},
  {k:'complexity',label:'Migration complexity',w:5},
];
export const SYNTH_HYPER = {
  'AWS':{tech:4,compliance:4,commercial:3,integration:2,resilience:4,complexity:4},
  'Microsoft Azure':{tech:4,compliance:4,commercial:4,integration:5,resilience:4,complexity:4},
  'Google Cloud':{tech:4,compliance:3,commercial:3,integration:2,resilience:4,complexity:3},
  'SAP data centre':{tech:3,compliance:4,commercial:3,integration:2,resilience:3,complexity:4},
};
export const BTP_PALETTE = [
  ['S/4HANA Cloud Private Edition','Core ERP','s4'],['SAP Integration Suite','Integration'],['Cloud Connector','Integration'],['API Management','Integration'],
  ['Event Mesh','Integration'],['SAP Build Process Automation','Automation'],['SAP Build Apps','Development'],['BTP ABAP Environment','Development'],
  ['Cloud Foundry runtime (CAP)','Development'],['SAP Datasphere','Data and analytics'],['SAP Analytics Cloud','Data and analytics'],['SAP HANA Cloud','Data and analytics'],
  ['SAP AI Core','AI'],['Identity Authentication','Security'],['External MES','External'],['Bank network','External'],['EDI provider','External']
];
export const PHASES = ['Discover','Prepare','Explore','Realize','Deploy','Run'];
export const WORKSTREAMS = ['Programme Management','SAP Basis','Functional Design','Custom Code','Data Migration','Integrations','Reporting','Security','Testing','Business Change','Cutover','Hypercare'];
