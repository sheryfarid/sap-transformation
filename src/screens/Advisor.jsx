import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BTP_PALETTE, CUTOVER0, DEFAULT_RATES, DISPOSITIONS, FINDINGS, FINDING_TEMPLATES, HYPER, HYPER_CRITERIA, MODULES, MODULE_NAMES, OWNERS, PHASES, R, REPORTS, REPORT_OPTIONS, REPORT_SOURCES, RISKS0, STRAT_CRITERIA, SYNTH_HYPER, SYSTEMS, TECH, WORKSTREAMS, WRICEF, WR_NAMES, WR_TYPES, daysAgoDate, fmt, mulberry32, pad, pick, reportRule, today, wpick, wricefRule
} from '../model.js';
import { Badge, Spark, StatusBadge, MetaStrip, Ring, Drawer, Pager, AIProposal } from '../components/ui.jsx';
import { useStore } from '../lib/store.jsx';
import { projectSummary, strategyScores, planModel, nextActions, clamp } from '../lib/engine.js';
import { AI_RULES, aiErrorText } from '../lib/ai.js';

import { Chat } from '../components/Chat.jsx';

export function Advisor(){
  const {setChat} = useStore();
  return <>
    <div className="page-head"><div><h1>AI transformation advisor</h1><p className="sub">Questions are answered from the Studio’s own records and cited by ID. The advisor cannot see SAP systems directly and never approves anything.</p></div>
      <div className="actions"><button className="btn" onClick={()=>setChat([])}>Clear conversation</button></div></div>
    <Chat screen="advisor" full/>
  </>;
}
