BEGIN;

CREATE TABLE IF NOT EXISTS testimonial_ai_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES testimonial_tenants(id),
  user_id uuid NOT NULL REFERENCES testimonial_users(id),
  endpoint text NOT NULL,
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS testimonial_ai_results_history_idx
  ON testimonial_ai_results(tenant_id, user_id, created_at DESC);

ALTER TABLE testimonial_ai_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON testimonial_ai_results;
CREATE POLICY tenant_isolation ON testimonial_ai_results
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;
