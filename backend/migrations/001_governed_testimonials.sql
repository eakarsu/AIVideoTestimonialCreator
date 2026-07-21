BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS testimonial_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS testimonial_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS testimonial_memberships (
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  user_id uuid NOT NULL REFERENCES testimonial_users(id),
  role text NOT NULL CHECK (role IN ('owner','producer','editor','reviewer','legal','brand_reviewer','publisher')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS testimonial_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  title text NOT NULL,
  subject_name text NOT NULL,
  campaign text,
  status text NOT NULL CHECK (status IN ('draft','in_review','approved','publishing','published','archived')),
  created_by uuid NOT NULL REFERENCES testimonial_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS testimonial_assets (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  project_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('video','audio','image','caption','font','brand')),
  storage_key text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  mime_type text NOT NULL,
  duration_ms bigint NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  rights jsonb NOT NULL,
  consent jsonb NOT NULL,
  provenance jsonb NOT NULL,
  moderation_status text NOT NULL CHECK (moderation_status IN ('pending','approved','rejected')),
  scan_status text NOT NULL CHECK (scan_status IN ('pending','clean','quarantined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, project_id) REFERENCES testimonial_projects(tenant_id, id),
  UNIQUE (tenant_id, storage_key),
  UNIQUE (tenant_id, project_id, id)
);

CREATE TABLE IF NOT EXISTS testimonial_timeline_versions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  project_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  parent_version_id uuid REFERENCES testimonial_timeline_versions(id),
  manifest jsonb NOT NULL,
  manifest_digest text NOT NULL CHECK (manifest_digest ~ '^[a-f0-9]{64}$'),
  brand_profile_version text NOT NULL,
  duration_ms bigint NOT NULL CHECK (duration_ms > 0),
  status text NOT NULL CHECK (status IN ('draft','frozen','superseded')),
  created_by uuid NOT NULL REFERENCES testimonial_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, project_id) REFERENCES testimonial_projects(tenant_id, id),
  UNIQUE (tenant_id, project_id, sequence),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS testimonial_render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  timeline_version_id uuid NOT NULL REFERENCES testimonial_timeline_versions(id),
  status text NOT NULL CHECK (status IN ('queued','processing','succeeded','failed','cancelled')),
  provider text NOT NULL,
  preset text NOT NULL,
  idempotency_key text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  next_attempt_at timestamptz,
  requested_by uuid NOT NULL REFERENCES testimonial_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS testimonial_render_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  render_job_id uuid NOT NULL REFERENCES testimonial_render_jobs(id),
  attempt integer NOT NULL,
  status text NOT NULL CHECK (status IN ('claimed','accepted','failed','timed_out')),
  error_code text,
  retryable boolean,
  provider_receipt text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (render_job_id, attempt)
);

CREATE TABLE IF NOT EXISTS testimonial_quality_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  render_job_id uuid NOT NULL REFERENCES testimonial_render_jobs(id),
  passed boolean NOT NULL,
  failures jsonb NOT NULL,
  metrics jsonb NOT NULL,
  evaluator_version text NOT NULL,
  created_by uuid NOT NULL REFERENCES testimonial_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS testimonial_body_language_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  asset_id uuid NOT NULL REFERENCES testimonial_assets(id),
  observations jsonb NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  requires_human_review boolean NOT NULL,
  model_card_version text NOT NULL,
  created_by uuid NOT NULL REFERENCES testimonial_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS testimonial_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  timeline_version_id uuid NOT NULL REFERENCES testimonial_timeline_versions(id),
  reviewer_id uuid NOT NULL REFERENCES testimonial_users(id),
  role text NOT NULL CHECK (role IN ('owner','legal','brand_reviewer')),
  decision text NOT NULL CHECK (decision IN ('approved','changes_requested','rejected')),
  rationale text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (timeline_version_id, reviewer_id, role)
);

-- Upgrade older installations whose approvals table predates tenant scoping.
ALTER TABLE testimonial_approvals
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES testimonial_tenants(id);

CREATE TABLE IF NOT EXISTS testimonial_channel_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  channel text NOT NULL,
  disclosure_required boolean NOT NULL DEFAULT true,
  watermark_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  policy_version text NOT NULL,
  created_by uuid NOT NULL REFERENCES testimonial_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel, policy_version)
);

CREATE TABLE IF NOT EXISTS testimonial_publications (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  timeline_version_id uuid NOT NULL REFERENCES testimonial_timeline_versions(id),
  render_job_id uuid NOT NULL REFERENCES testimonial_render_jobs(id),
  channel text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','publishing','published','failed','cancelled')),
  idempotency_key text NOT NULL,
  policy_snapshot jsonb NOT NULL,
  external_id text,
  provider_receipt text,
  error_code text,
  requested_by uuid NOT NULL REFERENCES testimonial_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS testimonial_provider_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  capability text NOT NULL CHECK (capability IN ('render','transcribe','translate','publish','store','moderate')),
  aggregate_id uuid NOT NULL,
  command jsonb NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','delivered','retry','dead_letter')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  claim_token uuid,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, capability, idempotency_key)
);

CREATE TABLE IF NOT EXISTS testimonial_provider_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  render_job_id uuid REFERENCES testimonial_render_jobs(id),
  provider text NOT NULL,
  receipt_id text NOT NULL,
  usage jsonb NOT NULL,
  response_digest text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, receipt_id)
);

CREATE TABLE IF NOT EXISTS testimonial_publish_receipts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  publication_id uuid NOT NULL REFERENCES testimonial_publications(id),
  provider text NOT NULL,
  receipt_id text NOT NULL,
  remote_status text NOT NULL,
  payload_digest text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, receipt_id)
);

CREATE TABLE IF NOT EXISTS testimonial_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  actor_id uuid REFERENCES testimonial_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION testimonial_reject_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'testimonial evidence is append-only';
END $$;

DROP TRIGGER IF EXISTS testimonial_assets_immutable ON testimonial_assets;
CREATE TRIGGER testimonial_assets_immutable BEFORE UPDATE OR DELETE ON testimonial_assets
FOR EACH ROW EXECUTE FUNCTION testimonial_reject_evidence_mutation();
DROP TRIGGER IF EXISTS testimonial_timelines_immutable ON testimonial_timeline_versions;
CREATE TRIGGER testimonial_timelines_immutable BEFORE UPDATE OR DELETE ON testimonial_timeline_versions
FOR EACH ROW EXECUTE FUNCTION testimonial_reject_evidence_mutation();
DROP TRIGGER IF EXISTS testimonial_evaluations_immutable ON testimonial_quality_evaluations;
CREATE TRIGGER testimonial_evaluations_immutable BEFORE UPDATE OR DELETE ON testimonial_quality_evaluations
FOR EACH ROW EXECUTE FUNCTION testimonial_reject_evidence_mutation();
DROP TRIGGER IF EXISTS testimonial_observations_immutable ON testimonial_body_language_observations;
CREATE TRIGGER testimonial_observations_immutable BEFORE UPDATE OR DELETE ON testimonial_body_language_observations
FOR EACH ROW EXECUTE FUNCTION testimonial_reject_evidence_mutation();
DROP TRIGGER IF EXISTS testimonial_usage_immutable ON testimonial_provider_usage;
CREATE TRIGGER testimonial_usage_immutable BEFORE UPDATE OR DELETE ON testimonial_provider_usage
FOR EACH ROW EXECUTE FUNCTION testimonial_reject_evidence_mutation();
DROP TRIGGER IF EXISTS testimonial_receipts_immutable ON testimonial_publish_receipts;
CREATE TRIGGER testimonial_receipts_immutable BEFORE UPDATE OR DELETE ON testimonial_publish_receipts
FOR EACH ROW EXECUTE FUNCTION testimonial_reject_evidence_mutation();
DROP TRIGGER IF EXISTS testimonial_audit_immutable ON testimonial_audit_events;
CREATE TRIGGER testimonial_audit_immutable BEFORE UPDATE OR DELETE ON testimonial_audit_events
FOR EACH ROW EXECUTE FUNCTION testimonial_reject_evidence_mutation();

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'testimonial_memberships','testimonial_projects','testimonial_assets','testimonial_timeline_versions',
    'testimonial_render_jobs','testimonial_render_attempts','testimonial_quality_evaluations',
    'testimonial_body_language_observations','testimonial_approvals','testimonial_channel_policies','testimonial_publications',
    'testimonial_provider_outbox','testimonial_provider_usage','testimonial_publish_receipts','testimonial_audit_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;

COMMIT;
