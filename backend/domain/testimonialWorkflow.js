'use strict';

const crypto = require('node:crypto');

const RENDER_TRANSITIONS = Object.freeze({
  queued: ['processing', 'cancelled'],
  processing: ['succeeded', 'failed'],
  failed: ['queued', 'cancelled'],
  succeeded: [],
  cancelled: [],
});

class DomainError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

function requireValue(value, code, message) {
  if (value === undefined || value === null || value === '') {
    throw new DomainError(code, message);
  }
  return value;
}

function assertTenant(expected, actual) {
  if (!expected || expected !== actual) {
    throw new DomainError('tenant_scope_violation', 'Resource is outside the authenticated tenant');
  }
}

function stableDigest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function registerAsset(input) {
  const rights = input.rights || {};
  const consent = input.consent || {};
  requireValue(input.tenantId, 'tenant_required', 'tenantId is required');
  requireValue(input.storageKey, 'storage_key_required', 'storageKey is required');
  if (!/^[a-f0-9]{64}$/i.test(input.sha256 || '')) {
    throw new DomainError('invalid_digest', 'sha256 must be a 64-character hexadecimal digest');
  }
  if (!['video', 'audio', 'image', 'caption', 'font', 'brand'].includes(input.kind)) {
    throw new DomainError('invalid_asset_kind', 'Asset kind is not supported');
  }
  if (!rights.licenseId || !rights.owner || !Array.isArray(rights.channels) || !rights.channels.length) {
    throw new DomainError('rights_incomplete', 'License, owner, and allowed channels are required');
  }
  if (rights.expiresAt && Date.parse(rights.expiresAt) <= Date.now()) {
    throw new DomainError('rights_expired', 'Asset rights have expired');
  }
  if (input.kind === 'video' && (!consent.id || consent.status !== 'granted')) {
    throw new DomainError('consent_missing', 'A granted, attributable release is required for video');
  }
  return Object.freeze({
    id: input.id || crypto.randomUUID(),
    tenantId: input.tenantId,
    kind: input.kind,
    storageKey: input.storageKey,
    sha256: input.sha256.toLowerCase(),
    mimeType: requireValue(input.mimeType, 'mime_type_required', 'mimeType is required'),
    durationMs: Number(input.durationMs || 0),
    rights: Object.freeze({ ...rights, channels: [...rights.channels].sort() }),
    consent: Object.freeze({ ...consent }),
    provenance: Object.freeze({
      source: requireValue(input.provenance?.source, 'provenance_required', 'Provenance source is required'),
      capturedAt: requireValue(input.provenance?.capturedAt, 'capture_time_required', 'Capture time is required'),
      ingestReceipt: requireValue(input.provenance?.ingestReceipt, 'receipt_required', 'Ingest receipt is required'),
    }),
    moderationStatus: input.moderationStatus || 'pending',
    scanStatus: input.scanStatus || 'pending',
  });
}

function createTimelineVersion(input, assets) {
  requireValue(input.tenantId, 'tenant_required', 'tenantId is required');
  requireValue(input.projectId, 'project_required', 'projectId is required');
  if (!Array.isArray(input.clips) || input.clips.length === 0) {
    throw new DomainError('clips_required', 'At least one clip is required');
  }
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  let previousEnd = 0;
  const clips = input.clips.map((clip, index) => {
    const asset = byId.get(clip.assetId);
    if (!asset) throw new DomainError('asset_not_found', `Clip ${index} references an unknown asset`);
    assertTenant(input.tenantId, asset.tenantId);
    const startMs = Number(clip.startMs);
    const endMs = Number(clip.endMs);
    const sourceStartMs = Number(clip.sourceStartMs || 0);
    if (![startMs, endMs, sourceStartMs].every(Number.isFinite) || startMs < 0 || endMs <= startMs) {
      throw new DomainError('invalid_clip_range', `Clip ${index} has an invalid range`);
    }
    if (startMs < previousEnd && clip.track === (input.clips[index - 1]?.track || 'video')) {
      throw new DomainError('overlapping_clip', `Clip ${index} overlaps its predecessor on the same track`);
    }
    if (asset.durationMs && sourceStartMs + (endMs - startMs) > asset.durationMs) {
      throw new DomainError('source_range_exceeded', `Clip ${index} exceeds source duration`);
    }
    previousEnd = Math.max(previousEnd, endMs);
    return Object.freeze({
      id: clip.id || crypto.randomUUID(), assetId: asset.id, track: clip.track || 'video',
      startMs, endMs, sourceStartMs, crop: clip.crop || null, transition: clip.transition || null,
    });
  });
  const timeline = {
    id: input.id || crypto.randomUUID(), tenantId: input.tenantId, projectId: input.projectId,
    sequence: Number(input.sequence || 1), parentVersionId: input.parentVersionId || null,
    clips, captions: input.captions || [], translations: input.translations || {},
    brandProfileVersion: requireValue(input.brandProfileVersion, 'brand_profile_required', 'A pinned brand profile is required'),
    durationMs: Math.max(...clips.map((clip) => clip.endMs)), status: 'draft',
  };
  return Object.freeze({ ...timeline, manifestDigest: stableDigest(timeline) });
}

function evaluateOutput(input) {
  const durationMs = Number(input.durationMs || 0);
  const captionedMs = Number(input.captionedMs || 0);
  const captionCoverage = durationMs > 0 ? captionedMs / durationMs : 0;
  const requiredLocales = input.requiredLocales || [];
  const deliveredLocales = new Set(input.deliveredLocales || []);
  const missingLocales = requiredLocales.filter((locale) => !deliveredLocales.has(locale));
  const metrics = {
    captionCoverage: Number(captionCoverage.toFixed(4)),
    contrastMinimum: Number(input.contrastMinimum || 0),
    safeAreaViolations: Number(input.safeAreaViolations || 0),
    brandViolations: Number(input.brandViolations || 0),
    audioPeakDb: Number(input.audioPeakDb),
    timingDriftMs: Number(input.timingDriftMs || 0),
    missingLocales,
    codec: input.codec || null,
    container: input.container || null,
    disclosureApplied: input.disclosureApplied === true,
    watermarkApplied: input.watermarkApplied === true,
  };
  const failures = [];
  if (captionCoverage < 0.99) failures.push('caption_coverage');
  if (metrics.contrastMinimum < 4.5) failures.push('caption_contrast');
  if (metrics.safeAreaViolations > 0) failures.push('safe_area');
  if (metrics.brandViolations > 0) failures.push('brand');
  if (!Number.isFinite(metrics.audioPeakDb) || metrics.audioPeakDb > -1) failures.push('audio_peak');
  if (Math.abs(metrics.timingDriftMs) > 80) failures.push('timing_drift');
  if (missingLocales.length) failures.push('translations');
  if (!['h264', 'hevc', 'vp9', 'av1'].includes(metrics.codec)) failures.push('codec');
  if (!['mp4', 'webm'].includes(metrics.container)) failures.push('container');
  return Object.freeze({ passed: failures.length === 0, failures, metrics, evaluatedAt: new Date().toISOString() });
}

function analyzeBodyLanguage(input) {
  if (input.consentStatus !== 'granted' || input.analysisAllowed !== true) {
    throw new DomainError('analysis_consent_required', 'Explicit consent for body-language analysis is required');
  }
  const frames = input.frames || [];
  if (!frames.length) throw new DomainError('frames_required', 'Pose observations are required');
  const validFrames = frames.filter((frame) => Number(frame.quality) >= 0.6);
  if (!validFrames.length) throw new DomainError('insufficient_quality', 'No frames meet the analysis quality floor');
  const average = (key) => validFrames.reduce((sum, frame) => sum + Number(frame[key] || 0), 0) / validFrames.length;
  const quality = average('quality');
  const observations = {
    cameraFacingRatio: Number(average('cameraFacing').toFixed(3)),
    stablePostureRatio: Number(average('stablePosture').toFixed(3)),
    gestureActivity: Number(average('gestureActivity').toFixed(3)),
    analyzedFrames: validFrames.length,
    excludedFrames: frames.length - validFrames.length,
  };
  return Object.freeze({
    observations,
    confidence: Number((quality * validFrames.length / frames.length).toFixed(3)),
    requiresHumanReview: quality < 0.8 || validFrames.length / frames.length < 0.8,
    prohibitedInferences: ['emotion', 'truthfulness', 'personality', 'protected-trait', 'mental-health'],
    notice: 'Descriptive pose observations only; this is not an authenticity, emotion, or truthfulness determination.',
  });
}

function transitionRender(job, nextStatus, evidence = {}) {
  const allowed = RENDER_TRANSITIONS[job.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new DomainError('invalid_render_transition', `${job.status} cannot transition to ${nextStatus}`);
  }
  if (nextStatus === 'succeeded' && (!evidence.outputSha256 || !evidence.storageKey || !evidence.providerReceipt)) {
    throw new DomainError('render_evidence_required', 'Successful renders require digest, storage key, and provider receipt');
  }
  if (nextStatus === 'failed' && (!evidence.errorCode || evidence.retryable === undefined)) {
    throw new DomainError('failure_evidence_required', 'Failed renders require typed failure evidence');
  }
  return Object.freeze({ ...job, status: nextStatus, evidence: Object.freeze({ ...evidence }), updatedAt: new Date().toISOString() });
}

function authorizePublication(input) {
  const blockers = [];
  if (input.renderStatus !== 'succeeded') blockers.push('render_not_succeeded');
  if (input.evaluation?.passed !== true) blockers.push('quality_gate_failed');
  if (input.moderationStatus !== 'approved') blockers.push('moderation_not_approved');
  if (input.consentStatus !== 'granted') blockers.push('consent_not_granted');
  if (input.rightsStatus !== 'verified') blockers.push('rights_not_verified');
  if (!Array.isArray(input.approvals) || new Set(input.approvals.map((approval) => approval.role)).size < 2) {
    blockers.push('dual_approval_required');
  }
  if (!(input.allowedChannels || []).includes(input.channel)) blockers.push('channel_not_licensed');
  if (input.disclosureRequired && !input.disclosureApplied) blockers.push('disclosure_missing');
  if (input.watermarkRequired && !input.watermarkApplied) blockers.push('watermark_missing');
  if (blockers.length) throw new DomainError('publication_blocked', 'Publication requirements are not satisfied', { blockers });
  return Object.freeze({
    authorized: true,
    publicationId: input.publicationId || crypto.randomUUID(),
    tenantId: input.tenantId,
    timelineVersionId: input.timelineVersionId,
    channel: input.channel,
    idempotencyKey: stableDigest([input.tenantId, input.timelineVersionId, input.channel, input.outputSha256]),
  });
}

module.exports = {
  DomainError, RENDER_TRANSITIONS, analyzeBodyLanguage, assertTenant, authorizePublication,
  createTimelineVersion, evaluateOutput, registerAsset, stableDigest, transitionRender,
};
