'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('migration defines durable workflow, integration, receipt, and append-only evidence state', () => {
  const sql = read('backend/migrations/001_governed_testimonials.sql');
  for (const table of [
    'testimonial_tenants', 'testimonial_memberships', 'testimonial_projects', 'testimonial_assets',
    'testimonial_timeline_versions', 'testimonial_render_jobs', 'testimonial_render_attempts',
    'testimonial_quality_evaluations', 'testimonial_body_language_observations', 'testimonial_approvals', 'testimonial_channel_policies',
    'testimonial_publications', 'testimonial_provider_outbox', 'testimonial_provider_usage',
    'testimonial_publish_receipts', 'testimonial_audit_events',
  ]) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /evidence is append-only/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM/);
});

test('server exposes only governed routes with fail-closed configuration and verified TLS', () => {
  const server = read('backend/server.js');
  const db = read('backend/db.js');
  const auth = read('backend/middleware/auth.js');
  assert.match(server, /\/api\/governed-testimonials/);
  assert.doesNotMatch(server, /gapNoVision|OPENROUTER|register/);
  assert.match(server, /RENDER_CALLBACK_SECRET.*32/);
  assert.match(db, /rejectUnauthorized: true/);
  assert.doesNotMatch(auth, /dev-secret|JWT_SECRET\s*\|\|\s*['"]/);
  assert.match(auth, /issuer: env\.JWT_ISSUER/);
  assert.match(auth, /active_membership_required/);
});

test('launcher is nondestructive and separates bootstrap, migration, seed, and start', () => {
  const launcher = read('start.sh');
  assert.doesNotMatch(launcher, /npm install|npm ci|createdb|CREATE DATABASE|seed\.js|kill -9|pkill|lsof -ti|brew services/);
  assert.match(launcher, /check\|migrate\|start/);
  assert.match(read('scripts/seed-development.sh'), /ALLOW_DEVELOPMENT_SEED/);
  assert.match(read('scripts/migrate.sh'), /ON_ERROR_STOP=1/);
});

test('CI runs tests, actual migration, frontend build, syntax, and launcher checks', () => {
  const workflow = read('.github/workflows/ci.yml');
  assert.match(workflow, /postgres:16/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /psql.*001_governed_testimonials\.sql/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /node --check/);
  assert.match(workflow, /bash -n/);
});

test('operations document provider recovery, takedown, external certification, and generated-route quarantine', () => {
  const ops = read('docs/OPERATIONS.md');
  const quarantine = read('docs/QUARANTINED_GENERATED_SURFACES.md');
  assert.match(ops, /reconcile ambiguous timeouts/i);
  assert.match(ops, /rights or consent withdrawal/i);
  assert.match(ops, /External validation still required/);
  assert.match(quarantine, /truthfulness/);
  assert.match(quarantine, /does not mount/);
});
