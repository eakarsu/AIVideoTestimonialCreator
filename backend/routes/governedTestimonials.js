'use strict';

const crypto = require('node:crypto');
const express = require('express');
const {
  DomainError, analyzeBodyLanguage, authorizePublication, createTimelineVersion,
  evaluateOutput, registerAsset, transitionRender,
} = require('../domain/testimonialWorkflow');
const { requireRole } = require('../middleware/auth');

async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

function audit(client, auth, action, entityType, entityId, evidence = {}) {
  return client.query(
    `INSERT INTO testimonial_audit_events
       (tenant_id, actor_id, action, entity_type, entity_id, evidence)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [auth.tenantId, auth.userId, action, entityType, entityId, JSON.stringify(evidence)],
  );
}

function verifyCallback(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const supplied = String(signature).replace(/^sha256=/, '');
  return expected.length === supplied.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

function createGovernedTestimonialsRouter(pool, env = process.env) {
  const router = express.Router();

  router.post('/projects', requireRole('owner', 'producer'), async (req, res, next) => {
    try {
      const result = await transaction(pool, async (client) => {
        const created = await client.query(
          `INSERT INTO testimonial_projects (tenant_id, title, subject_name, campaign, status, created_by)
           VALUES ($1,$2,$3,$4,'draft',$5) RETURNING *`,
          [req.auth.tenantId, req.body.title, req.body.subjectName, req.body.campaign || null, req.auth.userId],
        );
        await audit(client, req.auth, 'project.created', 'project', created.rows[0].id);
        return created.rows[0];
      });
      return res.status(201).json(result);
    } catch (error) { return next(error); }
  });

  router.post('/projects/:projectId/assets', requireRole('owner', 'producer', 'editor'), async (req, res, next) => {
    try {
      const asset = registerAsset({ ...req.body, tenantId: req.auth.tenantId });
      const result = await transaction(pool, async (client) => {
        const project = await client.query(
          'SELECT id FROM testimonial_projects WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
          [req.params.projectId, req.auth.tenantId],
        );
        if (!project.rowCount) throw new DomainError('project_not_found', 'Project was not found');
        const inserted = await client.query(
          `INSERT INTO testimonial_assets
             (id, tenant_id, project_id, kind, storage_key, sha256, mime_type, duration_ms,
              rights, consent, provenance, moderation_status, scan_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13) RETURNING *`,
          [asset.id, asset.tenantId, req.params.projectId, asset.kind, asset.storageKey, asset.sha256,
            asset.mimeType, asset.durationMs, JSON.stringify(asset.rights), JSON.stringify(asset.consent),
            JSON.stringify(asset.provenance), asset.moderationStatus, asset.scanStatus],
        );
        await audit(client, req.auth, 'asset.registered', 'asset', asset.id, { sha256: asset.sha256 });
        return inserted.rows[0];
      });
      return res.status(201).json(result);
    } catch (error) { return next(error); }
  });

  router.post('/projects/:projectId/timeline-versions', requireRole('owner', 'producer', 'editor'), async (req, res, next) => {
    try {
      const result = await transaction(pool, async (client) => {
        const assetsResult = await client.query(
          'SELECT * FROM testimonial_assets WHERE project_id=$1 AND tenant_id=$2 ORDER BY created_at',
          [req.params.projectId, req.auth.tenantId],
        );
        const assets = assetsResult.rows.map((row) => ({
          id: row.id, tenantId: row.tenant_id, durationMs: Number(row.duration_ms),
          rights: row.rights, consent: row.consent, moderationStatus: row.moderation_status, scanStatus: row.scan_status,
        }));
        const timeline = createTimelineVersion({
          ...req.body, tenantId: req.auth.tenantId, projectId: req.params.projectId,
        }, assets);
        const inserted = await client.query(
          `INSERT INTO testimonial_timeline_versions
             (id, tenant_id, project_id, sequence, parent_version_id, manifest, manifest_digest,
              brand_profile_version, duration_ms, status, created_by)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,'draft',$10) RETURNING *`,
          [timeline.id, timeline.tenantId, timeline.projectId, timeline.sequence, timeline.parentVersionId,
            JSON.stringify(timeline), timeline.manifestDigest, timeline.brandProfileVersion,
            timeline.durationMs, req.auth.userId],
        );
        await audit(client, req.auth, 'timeline.versioned', 'timeline_version', timeline.id, { digest: timeline.manifestDigest });
        return inserted.rows[0];
      });
      return res.status(201).json(result);
    } catch (error) { return next(error); }
  });

  router.post('/timeline-versions/:versionId/render-jobs', requireRole('owner', 'producer', 'editor'), async (req, res, next) => {
    try {
      const result = await transaction(pool, async (client) => {
        const timeline = await client.query(
          `SELECT v.* FROM testimonial_timeline_versions v
           WHERE v.id=$1 AND v.tenant_id=$2 FOR UPDATE`,
          [req.params.versionId, req.auth.tenantId],
        );
        if (!timeline.rowCount) throw new DomainError('timeline_not_found', 'Timeline version was not found');
        const unsafeAssets = await client.query(
          `SELECT id FROM testimonial_assets WHERE project_id=$1 AND tenant_id=$2
           AND (moderation_status <> 'approved' OR scan_status <> 'clean'
             OR consent->>'status' <> 'granted') LIMIT 1`,
          [timeline.rows[0].project_id, req.auth.tenantId],
        );
        if (unsafeAssets.rowCount) throw new DomainError('asset_gate_failed', 'All assets must pass scan, consent, and moderation gates');
        const idempotencyKey = req.get('Idempotency-Key');
        if (!idempotencyKey) throw new DomainError('idempotency_key_required', 'Idempotency-Key header is required');
        const inserted = await client.query(
          `INSERT INTO testimonial_render_jobs
             (tenant_id, timeline_version_id, status, provider, preset, idempotency_key, requested_by)
           VALUES ($1,$2,'queued',$3,$4,$5,$6)
           ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
           RETURNING *`,
          [req.auth.tenantId, req.params.versionId, req.body.provider, req.body.preset, idempotencyKey, req.auth.userId],
        );
        await client.query(
          `INSERT INTO testimonial_provider_outbox
             (tenant_id, capability, aggregate_id, command, idempotency_key)
           VALUES ($1,'render',$2,$3::jsonb,$4) ON CONFLICT DO NOTHING`,
          [req.auth.tenantId, inserted.rows[0].id, JSON.stringify({ timeline: timeline.rows[0].manifest, preset: req.body.preset }), idempotencyKey],
        );
        await audit(client, req.auth, 'render.queued', 'render_job', inserted.rows[0].id);
        return inserted.rows[0];
      });
      return res.status(202).json(result);
    } catch (error) { return next(error); }
  });

  router.post('/render-jobs/:jobId/provider-callback', async (req, res, next) => {
    try {
      const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      if (!verifyCallback(raw, req.get('X-Provider-Signature'), env.RENDER_CALLBACK_SECRET)) {
        return res.status(401).json({ error: 'invalid_callback_signature' });
      }
      const payload = JSON.parse(raw.toString('utf8'));
      const updated = await transaction(pool, async (client) => {
        const found = await client.query('SELECT * FROM testimonial_render_jobs WHERE id=$1 FOR UPDATE', [req.params.jobId]);
        if (!found.rowCount) throw new DomainError('render_not_found', 'Render job was not found');
        const nextJob = transitionRender({ status: found.rows[0].status }, payload.status, payload.evidence || {});
        const result = await client.query(
          `UPDATE testimonial_render_jobs SET status=$2, evidence=$3::jsonb, updated_at=now()
           WHERE id=$1 RETURNING *`,
          [req.params.jobId, nextJob.status, JSON.stringify(nextJob.evidence)],
        );
        await client.query(
          `INSERT INTO testimonial_provider_usage
             (tenant_id, render_job_id, provider, receipt_id, usage, response_digest)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT (provider, receipt_id) DO NOTHING`,
          [found.rows[0].tenant_id, req.params.jobId, found.rows[0].provider,
            payload.evidence?.providerReceipt, JSON.stringify(payload.usage || {}), payload.responseDigest || null],
        );
        return result.rows[0];
      });
      return res.json(updated);
    } catch (error) { return next(error); }
  });

  router.post('/assets/:assetId/body-language-observations', requireRole('owner', 'producer', 'reviewer'), async (req, res, next) => {
    try {
      const found = await pool.query(
        'SELECT id, consent FROM testimonial_assets WHERE id=$1 AND tenant_id=$2',
        [req.params.assetId, req.auth.tenantId],
      );
      if (!found.rowCount) throw new DomainError('asset_not_found', 'Asset was not found');
      const analysis = analyzeBodyLanguage({
        ...req.body,
        consentStatus: found.rows[0].consent.status,
        analysisAllowed: found.rows[0].consent.bodyLanguageAnalysis === true,
      });
      const inserted = await pool.query(
        `INSERT INTO testimonial_body_language_observations
           (tenant_id, asset_id, observations, confidence, requires_human_review, model_card_version, created_by)
         VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7) RETURNING *`,
        [req.auth.tenantId, req.params.assetId, JSON.stringify(analysis), analysis.confidence,
          analysis.requiresHumanReview, req.body.modelCardVersion, req.auth.userId],
      );
      return res.status(201).json(inserted.rows[0]);
    } catch (error) { return next(error); }
  });

  router.post('/render-jobs/:jobId/evaluations', requireRole('owner', 'producer', 'reviewer'), async (req, res, next) => {
    try {
      const evaluation = evaluateOutput(req.body || {});
      const inserted = await pool.query(
        `INSERT INTO testimonial_quality_evaluations
           (tenant_id, render_job_id, passed, failures, metrics, evaluator_version, created_by)
         SELECT tenant_id, id, $3, $4::jsonb, $5::jsonb, $6, $7
         FROM testimonial_render_jobs WHERE id=$1 AND tenant_id=$2 RETURNING *`,
        [req.params.jobId, req.auth.tenantId, evaluation.passed, JSON.stringify(evaluation.failures),
          JSON.stringify(evaluation.metrics), req.body.evaluatorVersion, req.auth.userId],
      );
      if (!inserted.rowCount) throw new DomainError('render_not_found', 'Render job was not found');
      return res.status(201).json(inserted.rows[0]);
    } catch (error) { return next(error); }
  });

  router.post('/timeline-versions/:versionId/approvals', requireRole('owner', 'legal', 'brand_reviewer'), async (req, res, next) => {
    try {
      const result = await pool.query(
        `INSERT INTO testimonial_approvals (tenant_id, timeline_version_id, reviewer_id, role, decision, rationale)
         SELECT $1, id, $3, $4, $5, $6 FROM testimonial_timeline_versions
         WHERE id=$2 AND tenant_id=$1
         ON CONFLICT (timeline_version_id, reviewer_id, role) DO UPDATE
           SET decision=EXCLUDED.decision, rationale=EXCLUDED.rationale, decided_at=now()
         RETURNING *`,
        [req.auth.tenantId, req.params.versionId, req.auth.userId, req.auth.role, req.body.decision, req.body.rationale],
      );
      if (!result.rowCount) throw new DomainError('timeline_not_found', 'Timeline version was not found');
      return res.status(201).json(result.rows[0]);
    } catch (error) { return next(error); }
  });

  router.post('/channel-policies', requireRole('owner', 'legal'), async (req, res, next) => {
    try {
      if (!req.body.channel || !req.body.policyVersion) {
        throw new DomainError('channel_policy_invalid', 'channel and policyVersion are required');
      }
      const result = await pool.query(
        `INSERT INTO testimonial_channel_policies
           (tenant_id, channel, disclosure_required, watermark_required, policy_version, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.auth.tenantId, req.body.channel, req.body.disclosureRequired !== false,
          req.body.watermarkRequired === true, req.body.policyVersion, req.auth.userId],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) { return next(error); }
  });

  router.post('/timeline-versions/:versionId/publications', requireRole('owner', 'publisher'), async (req, res, next) => {
    try {
      const result = await transaction(pool, async (client) => {
        const snapshot = await client.query(
          `SELECT v.id, v.project_id, r.id AS render_id, r.status AS render_status, r.evidence
           FROM testimonial_timeline_versions v
           JOIN testimonial_render_jobs r ON r.timeline_version_id=v.id
           WHERE v.id=$1 AND v.tenant_id=$2
           ORDER BY r.created_at DESC LIMIT 1 FOR UPDATE OF v, r`,
          [req.params.versionId, req.auth.tenantId],
        );
        if (!snapshot.rowCount) throw new DomainError('publication_snapshot_missing', 'Render and evaluation evidence are required');
        const row = snapshot.rows[0];
        const evaluation = await client.query(
          `SELECT passed, metrics FROM testimonial_quality_evaluations
           WHERE render_job_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`,
          [row.render_id, req.auth.tenantId],
        );
        const approvals = await client.query(
          `SELECT DISTINCT role FROM testimonial_approvals
           WHERE timeline_version_id=$1 AND tenant_id=$2 AND decision='approved'`,
          [row.id, req.auth.tenantId],
        );
        const assetGate = await client.query(
          `SELECT
             bool_and(moderation_status='approved') AS moderation_ok,
             bool_and(consent->>'status'='granted') AS consent_ok,
             bool_and(
               COALESCE((rights->'channels') ? $3, false)
               AND (rights->>'expiresAt' IS NULL OR (rights->>'expiresAt')::timestamptz > now())
             ) AS rights_ok
           FROM testimonial_assets WHERE project_id=$1 AND tenant_id=$2`,
          [row.project_id, req.auth.tenantId, req.body.channel],
        );
        const policy = await client.query(
          `SELECT disclosure_required, watermark_required FROM testimonial_channel_policies
           WHERE tenant_id=$1 AND channel=$2 AND status='active'`,
          [req.auth.tenantId, req.body.channel],
        );
        if (!policy.rowCount) throw new DomainError('channel_policy_missing', 'An active channel policy is required');
        const gate = assetGate.rows[0] || {};
        const metrics = evaluation.rows[0]?.metrics || {};
        const authorization = authorizePublication({
          tenantId: req.auth.tenantId, timelineVersionId: row.id,
          renderStatus: row.render_status, evaluation: { passed: evaluation.rows[0]?.passed === true },
          moderationStatus: gate.moderation_ok ? 'approved' : 'blocked',
          consentStatus: gate.consent_ok ? 'granted' : 'blocked',
          rightsStatus: gate.rights_ok ? 'verified' : 'blocked',
          approvals: approvals.rows.map(({ role }) => ({ role })),
          allowedChannels: gate.rights_ok ? [req.body.channel] : [], channel: req.body.channel,
          disclosureRequired: policy.rows[0].disclosure_required, disclosureApplied: metrics.disclosureApplied,
          watermarkRequired: policy.rows[0].watermark_required, watermarkApplied: metrics.watermarkApplied,
          outputSha256: row.evidence?.outputSha256,
        });
        const delivery = await client.query(
          `INSERT INTO testimonial_publications
             (id, tenant_id, timeline_version_id, render_job_id, channel, status, idempotency_key, policy_snapshot, requested_by)
           VALUES ($1,$2,$3,$4,$5,'queued',$6,$7::jsonb,$8) RETURNING *`,
          [authorization.publicationId, req.auth.tenantId, row.id, row.render_id, req.body.channel,
            authorization.idempotencyKey, JSON.stringify(req.body), req.auth.userId],
        );
        await client.query(
          `INSERT INTO testimonial_provider_outbox
             (tenant_id, capability, aggregate_id, command, idempotency_key)
           VALUES ($1,'publish',$2,$3::jsonb,$4) ON CONFLICT DO NOTHING`,
          [req.auth.tenantId, delivery.rows[0].id, JSON.stringify({ channel: req.body.channel, renderId: row.render_id }), authorization.idempotencyKey],
        );
        await audit(client, req.auth, 'publication.queued', 'publication', delivery.rows[0].id);
        return delivery.rows[0];
      });
      return res.status(202).json(result);
    } catch (error) { return next(error); }
  });

  router.get('/projects/:projectId/status', async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT p.id, p.title, p.status,
           (SELECT count(*) FROM testimonial_assets a WHERE a.project_id=p.id) asset_count,
           (SELECT count(*) FROM testimonial_timeline_versions v WHERE v.project_id=p.id) version_count,
           (SELECT count(*) FROM testimonial_publications x JOIN testimonial_timeline_versions v ON v.id=x.timeline_version_id WHERE v.project_id=p.id) publication_count
         FROM testimonial_projects p WHERE p.id=$1 AND p.tenant_id=$2`,
        [req.params.projectId, req.auth.tenantId],
      );
      return result.rowCount ? res.json(result.rows[0]) : res.status(404).json({ error: 'project_not_found' });
    } catch (error) { return next(error); }
  });

  return router;
}

module.exports = { createGovernedTestimonialsRouter, transaction, verifyCallback };
