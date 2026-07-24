'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createPool } = require('./db');
const { assertAuthConfiguration, authentication } = require('./middleware/auth');
const { createAuthRouter } = require('./routes/auth');
const { createGovernedTestimonialsRouter } = require('./routes/governedTestimonials');
const { createRuntimeAiRouter } = require('./routes/runtimeAi');
const { DomainError } = require('./domain/testimonialWorkflow');

function assertConfiguration(env = process.env) {
  assertAuthConfiguration(env);
  if (!env.CLIENT_URL) throw new Error('CLIENT_URL is required');
  if (!env.RENDER_CALLBACK_SECRET || env.RENDER_CALLBACK_SECRET.length < 32) {
    throw new Error('RENDER_CALLBACK_SECRET must contain at least 32 characters');
  }
}

function createApp({ pool, env = process.env }) {
  assertConfiguration(env);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true, methods: ['GET', 'POST'] }));
  app.use(express.json({
    limit: '2mb',
    verify(req, _res, buffer) { req.rawBody = Buffer.from(buffer); },
  }));
  app.use(rateLimit({ windowMs: 60_000, limit: Number(env.RATE_LIMIT_PER_MINUTE || 120), standardHeaders: true }));
  const health = async (_req, res, next) => {
    try { await pool.query('SELECT 1'); return res.json({ status: 'ok' }); } catch (error) { return next(error); }
  };
  app.get('/healthz', health);
  app.get('/api/health', health);
  app.use('/api/auth', createAuthRouter(pool, env));
  app.use('/api/governed-testimonials', authentication(pool, env), createGovernedTestimonialsRouter(pool, env));
  app.use('/api/ai', authentication(pool, env), createRuntimeAiRouter(pool, env));
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof DomainError) {
      const status = error.code.endsWith('_not_found') ? 404 : error.code.includes('blocked') ? 409 : 422;
      return res.status(status).json({ error: error.code, message: error.message, details: error.details });
    }
    console.error({ name: error.name, message: error.message });
    return res.status(500).json({ error: 'internal_error' });
  });
  return app;
}

async function main() {
  assertConfiguration(process.env);
  const pool = createPool(process.env);
  const app = createApp({ pool, env: process.env });
  const server = app.listen(Number(process.env.BACKEND_PORT || 3001), process.env.BIND_HOST || '127.0.0.1');
  const shutdown = async () => {
    server.close(async () => { await pool.end(); process.exit(0); });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { assertConfiguration, createApp };
