'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DomainError, analyzeBodyLanguage, authorizePublication, createTimelineVersion,
  evaluateOutput, registerAsset, transitionRender,
} = require('../domain/testimonialWorkflow');

function asset(overrides = {}) {
  return registerAsset({
    id: '51fcbd95-f565-4ee5-b5ad-740a252c7606', tenantId: 'tenant-a', kind: 'video',
    storageKey: 'tenant-a/source/clip.mp4', sha256: 'a'.repeat(64), mimeType: 'video/mp4', durationMs: 12_000,
    rights: { licenseId: 'license-1', owner: 'subject', channels: ['web', 'youtube'], expiresAt: '2099-01-01T00:00:00Z' },
    consent: { id: 'release-1', status: 'granted', bodyLanguageAnalysis: true },
    provenance: { source: 'direct-upload', capturedAt: '2026-07-18T12:00:00Z', ingestReceipt: 'ingest-1' },
    moderationStatus: 'approved', scanStatus: 'clean', ...overrides,
  });
}

test('asset registration preserves attributable rights, consent, provenance, and digest', () => {
  const result = asset();
  assert.equal(result.rights.licenseId, 'license-1');
  assert.equal(result.consent.status, 'granted');
  assert.equal(result.sha256.length, 64);
  assert.ok(Object.isFrozen(result));
});

test('asset registration rejects missing consent and expired rights', () => {
  assert.throws(() => asset({ consent: {} }), (error) => error.code === 'consent_missing');
  assert.throws(() => asset({ rights: { licenseId: 'x', owner: 'x', channels: ['web'], expiresAt: '2020-01-01' } }),
    (error) => error.code === 'rights_expired');
});

test('timeline version is deterministic, editable by version, and tenant scoped', () => {
  const source = asset();
  const timeline = createTimelineVersion({
    id: 'version-1', tenantId: 'tenant-a', projectId: 'project-1', sequence: 2,
    parentVersionId: 'version-0', brandProfileVersion: 'brand-v3',
    clips: [{ id: 'clip-1', assetId: source.id, startMs: 0, endMs: 5_000, sourceStartMs: 1_000 }],
    captions: [{ startMs: 0, endMs: 5_000, text: 'Hello' }], translations: { es: 'Hola' },
  }, [source]);
  assert.equal(timeline.durationMs, 5_000);
  assert.match(timeline.manifestDigest, /^[a-f0-9]{64}$/);
  assert.equal(timeline.parentVersionId, 'version-0');
  assert.throws(() => createTimelineVersion({ ...timeline, tenantId: 'tenant-b' }, [source]),
    (error) => error.code === 'tenant_scope_violation');
});

test('timeline rejects overlaps and source ranges beyond the media', () => {
  const source = asset();
  assert.throws(() => createTimelineVersion({
    tenantId: 'tenant-a', projectId: 'p', brandProfileVersion: 'b', clips: [
      { assetId: source.id, track: 'video', startMs: 0, endMs: 6_000 },
      { assetId: source.id, track: 'video', startMs: 5_000, endMs: 7_000 },
    ],
  }, [source]), (error) => error.code === 'overlapping_clip');
  assert.throws(() => createTimelineVersion({
    tenantId: 'tenant-a', projectId: 'p', brandProfileVersion: 'b',
    clips: [{ assetId: source.id, startMs: 0, endMs: 8_000, sourceStartMs: 5_000 }],
  }, [source]), (error) => error.code === 'source_range_exceeded');
});

test('quality evaluation measures accessibility, brand, timing, locale, and export compatibility', () => {
  const passing = evaluateOutput({
    durationMs: 10_000, captionedMs: 10_000, contrastMinimum: 7,
    safeAreaViolations: 0, brandViolations: 0, audioPeakDb: -2,
    timingDriftMs: 30, requiredLocales: ['en', 'es'], deliveredLocales: ['en', 'es'],
    codec: 'h264', container: 'mp4',
  });
  assert.equal(passing.passed, true);
  const failing = evaluateOutput({ durationMs: 10_000, captionedMs: 5_000, audioPeakDb: 0, codec: 'raw' });
  assert.equal(failing.passed, false);
  assert.ok(failing.failures.includes('caption_coverage'));
  assert.ok(failing.failures.includes('codec'));
});

test('body-language analysis is consented, descriptive, quality-aware, and forbids sensitive inference', () => {
  const result = analyzeBodyLanguage({
    consentStatus: 'granted', analysisAllowed: true,
    frames: [
      { quality: 0.9, cameraFacing: 1, stablePosture: 0.8, gestureActivity: 0.3 },
      { quality: 0.4, cameraFacing: 0, stablePosture: 0, gestureActivity: 0 },
    ],
  });
  assert.equal(result.observations.analyzedFrames, 1);
  assert.equal(result.requiresHumanReview, true);
  assert.ok(result.prohibitedInferences.includes('truthfulness'));
  assert.match(result.notice, /not an authenticity/);
  assert.throws(() => analyzeBodyLanguage({ consentStatus: 'pending', analysisAllowed: true, frames: [{}] }),
    (error) => error.code === 'analysis_consent_required');
});

test('render lifecycle requires typed success/failure evidence and allows bounded retry state', () => {
  const processing = transitionRender({ status: 'queued' }, 'processing');
  const failed = transitionRender(processing, 'failed', { errorCode: 'timeout', retryable: true });
  assert.equal(failed.status, 'failed');
  assert.equal(transitionRender(failed, 'queued').status, 'queued');
  assert.throws(() => transitionRender({ status: 'processing' }, 'succeeded', {}),
    (error) => error.code === 'render_evidence_required');
  assert.throws(() => transitionRender({ status: 'succeeded' }, 'queued'),
    (error) => error.code === 'invalid_render_transition');
});

test('publication is blocked until render, quality, rights, consent, policy, and dual approval pass', () => {
  const input = {
    tenantId: 'tenant-a', timelineVersionId: 'version-1', renderStatus: 'succeeded',
    evaluation: { passed: true }, moderationStatus: 'approved', consentStatus: 'granted',
    rightsStatus: 'verified', approvals: [{ role: 'legal' }, { role: 'brand_reviewer' }],
    allowedChannels: ['web'], channel: 'web', disclosureRequired: true, disclosureApplied: true,
    watermarkRequired: true, watermarkApplied: true, outputSha256: 'b'.repeat(64),
  };
  const result = authorizePublication(input);
  assert.equal(result.authorized, true);
  assert.match(result.idempotencyKey, /^[a-f0-9]{64}$/);
  assert.throws(() => authorizePublication({ ...input, approvals: [{ role: 'legal' }], disclosureApplied: false }),
    (error) => error instanceof DomainError && error.details.blockers.includes('dual_approval_required'));
});
