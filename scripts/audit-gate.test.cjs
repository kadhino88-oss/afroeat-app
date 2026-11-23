const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAuditReport, IGNORED } = require('./audit-gate.cjs');

const report = (vulns) => JSON.stringify({ metadata: { vulnerabilities: {} }, vulnerabilities: vulns });

test('fails closed on empty or invalid npm audit output', () => {
  assert.equal(evaluateAuditReport('').ok, false);
  assert.equal(evaluateAuditReport(undefined).ok, false);
  assert.equal(evaluateAuditReport('   \n').ok, false);
  assert.equal(evaluateAuditReport('not json').ok, false);
  assert.equal(evaluateAuditReport('{}').ok, false);
  assert.equal(evaluateAuditReport(JSON.stringify({ error: { summary: 'offline' } })).ok, false);
});

test('passes a clean report and blocks high/critical advisories', () => {
  assert.equal(evaluateAuditReport(report({})).ok, true);
  const high = { pkg: { via: [{ severity: 'high', title: 't', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' }] } };
  assert.equal(evaluateAuditReport(report(high)).ok, false);
  const moderate = { pkg: { via: [{ severity: 'moderate', title: 't', url: 'https://x/GHSA-1' }] } };
  assert.equal(evaluateAuditReport(report(moderate)).ok, true);
});

test('only explicit exceptions are skipped, and the stale picomatch one is gone', () => {
  const high = { pkg: { via: [{ severity: 'high', title: 't', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' }] } };
  assert.equal(evaluateAuditReport(report(high), { 'GHSA-aaaa-bbbb-cccc': 'why' }).ok, true);
  assert.equal('GHSA-fc5q-39xc-vjpf' in IGNORED, false);
});
