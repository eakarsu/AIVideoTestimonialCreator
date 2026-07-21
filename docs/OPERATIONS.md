# Governed Video Testimonial Operations

## Supported lifecycle

The supported API is `/api/governed-testimonials`. It records a tenant-scoped project, immutable source assets with rights and consent provenance, immutable timeline versions, queued render work, provider attempts and usage, deterministic quality evaluations, descriptive body-language observations, independent approval, and queued publication delivery. The older generated feature and gap routes are not mounted.

Publication is fail-closed. A successful render receipt, passing accessibility/brand/export evaluation, approved moderation, current consent and channel rights, two independent approval roles, and required disclosure/watermark evidence must all be present. Model output never authorizes publication.

## Installation and startup

1. Run `scripts/bootstrap.sh` explicitly to install pinned backend and frontend dependencies.
2. Copy `.env.example` to `.env`; supply a strong JWT secret, a different strong callback secret, an approved PostgreSQL URL, and provider identifiers through the deployment secret manager.
3. Run `./start.sh migrate` as a migration principal. Review and back up the target before applying it.
4. Provision tenants, users, and memberships through an approved administrative process. No demo credentials are created.
5. Run `./start.sh check`, then `./start.sh start` under a least-privileged application identity.

Startup never installs packages, creates or seeds a database, starts PostgreSQL, kills ports or processes, or applies migrations. Production requires verified database TLS (`DATABASE_SSL=require`) and a trust store accepted by Node/PostgreSQL.

## Provider worker contract

Workers claim `testimonial_provider_outbox` rows with a lease, pass tenant and payload-bound idempotency keys, and store typed receipts and usage without secrets. A worker may retry retryable failures at most five times with bounded backoff; terminal items enter `dead_letter` and require an operator decision. Provider callbacks must be raw-body HMAC verified with `RENDER_CALLBACK_SECRET`. Rotate this secret with an overlap procedure at the gateway; never log it.

Storage adapters must verify content digests after upload and download. Render adapters must return an immutable output digest, storage key, receipt, codec/container facts, and usage. Transcription/translation adapters must return locale, timing, model/version, and usage evidence. Publishing adapters must return a remote identifier and receipt, and reconcile ambiguous timeouts before retrying.

## Operations and recovery

- Alert on outbox lease expiry, dead letters, callback signature failures, usage without receipts, rights/consent expiry, render backlog age, and publication reconciliation lag.
- Back up PostgreSQL and versioned object storage; restore into isolation and verify asset/output hashes before reopening delivery.
- On provider outage, stop claims for only that capability. Do not mark queued work complete. Reconcile receipts before replay.
- On a rights or consent withdrawal, suspend new publication, record the withdrawal, enqueue channel takedowns, retain receipts required for audit/legal hold, and redact subject data from ordinary reads.
- Audit events, media provenance, evaluations, usage, and delivery receipts are append-only. Corrections are new events or versions.

## External validation still required

Source code does not certify production readiness. Before launch, operators must apply the migration to a representative PostgreSQL environment; verify RLS with the actual application/migration roles; certify storage/CDN, render, transcription, translation, moderation, and each publishing adapter using vendor sandboxes; run real multilingual and accessibility evaluations; perform legal review of releases, licenses, disclosures, biometric/privacy treatment, retention, and takedown procedures; conduct security, load, browser, backup/restore, and incident exercises; and obtain brand/accessibility approval. Provider credentials, licensed assets, production infrastructure, and those professional decisions are intentionally not included.
