'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ProviderError, executeProvider, nextRetry } = require('../services/providerBoundary');

test('provider boundary requires configured typed adapters and tenant/idempotency context', async () => {
  await assert.rejects(() => executeProvider({}, 'render', {}, { tenantId: 't', idempotencyKey: 'k' }),
    (error) => error instanceof ProviderError && error.code === 'provider_not_configured');
  await assert.rejects(() => executeProvider({ render: { execute() {} } }, 'render', {}, {}),
    (error) => error.code === 'provider_context_invalid');
});

test('provider boundary returns receipts, usage, and a response digest without secrets', async () => {
  const result = await executeProvider({
    render: { name: 'sandbox-renderer', async execute() { return { receiptId: 'receipt-1', externalId: 'job-1', usage: { seconds: 12 } }; } },
  }, 'render', { version: 'v1' }, { tenantId: 'tenant-a', idempotencyKey: 'key-1' });
  assert.equal(result.receiptId, 'receipt-1');
  assert.equal(result.usage.seconds, 12);
  assert.match(result.responseDigest, /^[a-f0-9]{64}$/);
});

test('retry policy is bounded and honors provider delay', () => {
  assert.equal(nextRetry(0), 1_000);
  assert.equal(nextRetry(2, 9_000), 9_000);
  assert.equal(nextRetry(5), null);
});
