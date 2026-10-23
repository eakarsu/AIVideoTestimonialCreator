'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fp = require('../featurepack');

const rows = [
  { id: '1', title: 'Founder story', subject_name: 'Ada', campaign: 'Launch', status: 'draft', created_at: '2026-01-01' },
  { id: '2', title: 'Customer win', subject_name: '', campaign: '', status: 'ready', created_at: '2026-01-02' },
];

test('tasks validate, create, list-filter and update', () => {
  const store = fp.createTaskStore();
  assert.throws(() => store.create('t:u', { title: '' }), /required/);
  const saved = store.create('t:u', { title: ' Review draft ', status: 'open', linkedId: '1' });
  const updated = store.update('t:u', saved.id, { status: 'done' });
  assert.equal(updated.status, 'done');
  assert.equal(store.list('t:u', { status: 'done' }).length, 1);
  assert.equal(store.list('t:other', {}).length, 0);
  assert.equal(store.update('t:u', 'missing', { title: 'x' }), null);
});

test('search/filter and CSV/JSON export preserve values', () => {
  assert.equal(fp.filterRecords(rows, { search: 'founder' }).length, 1);
  assert.equal(fp.filterRecords(rows, { status: 'ready' }).length, 1);
  assert.match(fp.recordsToCsv(rows), /Founder story/);
  const json = fp.recordsToJson(rows);
  assert.equal(json.count, 2); assert.equal(json.data[1].subject_name, '');
});

test('AI insights are domain-grounded and fallback-labelled without a key', async () => {
  const fallback = fp.buildInsights(rows);
  assert.equal(fallback.projectPipeline.totalProjects, 2);
  assert.equal(fallback.campaignCoverage.projectsMissingCampaign, 1);
  assert.equal(fallback.subjectCoverage.readyForReview, false);
  const result = await fp.runAiInsights({ fallback, system: 's', user: 'u', env: {}, fetchFn: async () => { throw new Error('must not be called'); } });
  assert.equal(result.aiGenerated, false);
  assert.match(result.note, /Deterministic fallback/);
  assert.deepEqual(fp.aiSections({ zero: 0, flag: false, empty: '' }).map((s) => s.lines[0]), ['0', 'false', '(empty)']);
});

test('authenticated router: tasks, records search/export, AI insights', async () => {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => req.headers.authorization === 'Bearer test' ? (req.auth = { tenantId: 't', userId: 'u' }, next()) : res.status(401).json({ error: 'unauthorized' }));
  app.use('/api/featurepack', fp.createFeaturePackRouter({ listRecords: async () => rows, env: {} }));
  const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}/api/featurepack`;
  try {
    assert.equal((await fetch(`${base}/tasks`)).status, 401);
    const h = { authorization: 'Bearer test', 'content-type': 'application/json' };
    const created = await (await fetch(`${base}/tasks`, { method: 'POST', headers: h, body: JSON.stringify({ title: 'Check consent' }) })).json();
    assert.equal(created.status, 'open');
    const updated = await (await fetch(`${base}/tasks/${created.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'done' }) })).json();
    assert.equal(updated.status, 'done');
    assert.equal((await (await fetch(`${base}/records?search=founder`, { headers: h })).json()).data.length, 1);
    assert.match(await (await fetch(`${base}/records/export?format=csv`, { headers: h })).text(), /Founder story/);
    assert.equal((await (await fetch(`${base}/records/export?format=json`, { headers: h })).json()).count, 2);
    const ai = await (await fetch(`${base}/ai/insights`, { method: 'POST', headers: h, body: JSON.stringify({}) })).json();
    assert.equal(ai.aiGenerated, false); assert.ok(ai.sections.length >= 3);
  } finally { server.close(); }
});
