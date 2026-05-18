-- ============================================================
-- Migration 004 — Realtime cost & purchase tracking
--
-- 1. cost_events — append-only log of paid infrastructure calls
--    (Rekognition IndexFaces / SearchFacesByImage today; storage
--    delta entries can be added later). Each row carries the
--    paise-denominated cost so the admin dashboard can show
--    "today / 7d / 30d" without hitting AWS bills.
--
-- 2. process_queue_runs — heartbeat for the self-chained
--    /api/cron/process-queue. Lets confirm-upload skip triggering
--    a fresh run if one started in the last few seconds.
--
-- 3. purchases — one-time event-pack & add-on purchases so we can
--    drive real revenue numbers in admin analytics (the previous
--    hard-coded "events × ₹800" placeholder is removed).
--
-- Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS cost_events (
  id              BIGSERIAL PRIMARY KEY,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider        TEXT NOT NULL,                -- 'aws_rekognition' | 'insightface' | 'storage_r2' | 'storage_supabase' | 'twilio_otp' | 'resend_email'
  operation       TEXT NOT NULL,                -- 'index_faces' | 'search_faces' | 'create_collection' | 'delete_collection' | 'storage_put' | …
  units           NUMERIC NOT NULL DEFAULT 1,   -- e.g. faces indexed, calls, MB stored
  cost_paise      BIGINT NOT NULL DEFAULT 0,    -- ₹ × 100 to stay integer
  event_id        UUID,
  photographer_id UUID,
  meta            JSONB
);

CREATE INDEX IF NOT EXISTS idx_cost_events_occurred_at ON cost_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_events_provider_op ON cost_events(provider, operation);
CREATE INDEX IF NOT EXISTS idx_cost_events_event_id ON cost_events(event_id) WHERE event_id IS NOT NULL;

-- 2. Process-queue run heartbeat
CREATE TABLE IF NOT EXISTS process_queue_runs (
  id           BIGSERIAL PRIMARY KEY,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  source       TEXT,         -- 'confirm_upload' | 'self_chain' | 'manual'
  event_id     UUID,
  processed    INTEGER DEFAULT 0,
  succeeded    INTEGER DEFAULT 0,
  failed       INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_process_queue_runs_started_at
  ON process_queue_runs(started_at DESC);

-- 3. Purchase ledger
CREATE TABLE IF NOT EXISTS purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sku             TEXT NOT NULL,                -- 'small' | 'standard' | 'pack-5' | 'pack-10' | 'grand' | 'extend-30-days' | 'extra-photos'
  kind            TEXT NOT NULL DEFAULT 'pack', -- 'pack' | 'addon'
  amount_paise    BIGINT NOT NULL,              -- ₹ × 100
  currency        TEXT NOT NULL DEFAULT 'INR',
  status          TEXT NOT NULL DEFAULT 'paid', -- 'paid' | 'refunded' | 'pending'
  provider_ref    TEXT,                         -- razorpay payment_id, etc.
  meta            JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_photographer_id ON purchases(photographer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_sku ON purchases(sku);

ALTER TABLE cost_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_queue_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases             ENABLE ROW LEVEL SECURITY;

-- Service-role bypass; no client ever writes here.
DO $$ BEGIN
  CREATE POLICY "service_role cost_events" ON cost_events       FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "service_role queue_runs"  ON process_queue_runs FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "service_role purchases"   ON purchases          FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Aggregate helper used by /api/admin/analytics ─────────────
CREATE OR REPLACE FUNCTION cost_summary(p_since TIMESTAMPTZ)
RETURNS TABLE (
  provider     TEXT,
  operation    TEXT,
  units        NUMERIC,
  cost_paise   BIGINT
) AS $$
  SELECT provider,
         operation,
         SUM(units)::NUMERIC      AS units,
         SUM(cost_paise)::BIGINT  AS cost_paise
    FROM cost_events
   WHERE occurred_at >= p_since
   GROUP BY provider, operation
   ORDER BY cost_paise DESC;
$$ LANGUAGE sql STABLE;
