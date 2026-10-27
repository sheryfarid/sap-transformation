// Run with: npm test (uses the built-in node:test runner)
import test from 'node:test';
import assert from 'node:assert/strict';
import { wricefRule, reportRule, WRICEF, REPORTS, DISPOSITIONS } from '../src/data/model.js';
import { initialState, computeDerived, nextActions, strategyScores, planModel } from '../src/lib/engine.js';

const base = { id: 'X-1', type: 'R', module: 'FI', lastExecDays: 10, dependents: 0, atc: 0, critical: false, standardMatch: false, cleanCoreViolation: false, obsoleteTech: false, processChange: false };

test('objects without usage evidence go to manual review, never a guess', () => {
  const r = wricefRule({ ...base, lastExecDays: null });
  assert.equal(r.disp, 'MANUAL REVIEW');
  assert.equal(r.conf, 'unknown');
});

test('stale objects with no dependents are retirement candidates', () => {
  assert.equal(wricefRule({ ...base, lastExecDays: 800 }).disp, 'RETIRE');
});

test('business-critical objects are never proposed for retirement by rules', () => {
  assert.notEqual(wricefRule({ ...base, lastExecDays: 800, critical: true }).disp, 'RETIRE');
});

test('ATC findings lead to remediation', () => {
  assert.equal(wricefRule({ ...base, atc: 4 }).disp, 'REMEDIATE');
});

test('reports without usage get no target', () => {
  const r = reportRule({ id: 'R', source: 'ALV report', module: 'FI', runsPerMonth: null });
  assert.equal(r.opt, null);
});

test('synthetic inventories have the documented sizes', () => {
  assert.equal(WRICEF.length, 650);
  assert.equal(REPORTS.length, 420);
});

test('derived metrics count every object once', () => {
  const D = computeDerived(initialState());
  const total = DISPOSITIONS.reduce((n, d) => n + D.dispCounts[d], 0);
  assert.equal(total, 650);
  assert.ok(D.wrUnknown > 0, 'demo data should include unknown usage');
});

test('guidance asks for usage evidence first when it is missing', () => {
  const S = initialState();
  const a = nextActions(S, computeDerived(S));
  assert.equal(a[0].id, 'usage');
});

test('strategy weights of zero still give finite scores', () => {
  const S = initialState();
  S.strat.weights = Object.fromEntries(Object.keys(S.strat.weights).map((k) => [k, 0]));
  const r = strategyScores(S, computeDerived(S));
  Object.values(r.total).forEach((v) => assert.ok(Number.isFinite(v)));
});

test('plan Realize phase has a floor of 8 weeks', () => {
  const S = initialState();
  const M = planModel(S, computeDerived(S));
  assert.ok(M.weeks.Realize >= 8);
});
