'use strict';

const crypto = require('node:crypto');

class ProviderError extends Error {
  constructor(code, message, { retryable = false, status = 502, retryAfterMs = null } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function requireAdapter(adapters, capability) {
  const adapter = adapters[capability];
  if (!adapter || typeof adapter.execute !== 'function') {
    throw new ProviderError('provider_not_configured', `${capability} provider is not configured`, { status: 503 });
  }
  return adapter;
}

async function executeProvider(adapters, capability, command, context = {}) {
  const adapter = requireAdapter(adapters, capability);
  if (!context.tenantId || !context.idempotencyKey) {
    throw new ProviderError('provider_context_invalid', 'Tenant and idempotency context are required', { status: 400 });
  }
  const timeoutMs = Math.min(Math.max(Number(context.timeoutMs || 30_000), 1_000), 120_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const result = await adapter.execute(command, {
      tenantId: context.tenantId,
      idempotencyKey: context.idempotencyKey,
      signal: controller.signal,
    });
    if (!result || !result.receiptId) {
      throw new ProviderError('provider_receipt_missing', `${capability} provider returned no receipt`);
    }
    return Object.freeze({
      capability,
      provider: adapter.name || 'unnamed',
      receiptId: result.receiptId,
      externalId: result.externalId || null,
      status: result.status || 'accepted',
      usage: Object.freeze(result.usage || {}),
      elapsedMs: Date.now() - startedAt,
      responseDigest: crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex'),
    });
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error.name === 'AbortError') {
      throw new ProviderError('provider_timeout', `${capability} provider timed out`, { retryable: true, status: 504 });
    }
    throw new ProviderError(
      error.code || 'provider_failure',
      `${capability} provider failed`,
      { retryable: Boolean(error.retryable), retryAfterMs: error.retryAfterMs || null },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function nextRetry(attempt, retryAfterMs = null) {
  const count = Number(attempt || 0);
  if (count >= 5) return null;
  const exponential = Math.min(60_000, 1_000 * (2 ** count));
  return Math.max(exponential, Number(retryAfterMs || 0));
}

module.exports = { ProviderError, executeProvider, nextRetry, requireAdapter };
