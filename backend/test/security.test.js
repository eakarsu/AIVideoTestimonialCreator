const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('auth secret fails closed with no hard-coded fallback', () => {
  const body = fs.readFileSync(__dirname + '/../routes/autoEditingAssistant.js', 'utf8');
  assert.ok(body.includes('JWT_SECRET must be set'), 'must require JWT_SECRET');
  assert.ok(!/(JWT_SECRET|SESSION_SECRET)\s*\|\|\s*['"][^'"]+['"]/.test(body), 'no fallback secret');
});
