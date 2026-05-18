-- ============================================================
-- EventSnap Infrastructure Overhaul — Supabase Migrations
-- Run this in Supabase SQL Editor (Settings → SQL Editor)
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Face embeddings table (InsightFace buffalo_l → 512-dim vectors)
CREATE TABLE IF NOT EXISTS face_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photo_id        UUID NOT NULL REFERENCES event_photos(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL,
  embedding       vector(512),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat index for fast cosine similarity search
-- Adjust 'lists' based on number of rows: sqrt(num_rows) is a good starting point
CREATE INDEX IF NOT EXISTS face_embeddings_embedding_idx
  ON face_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS face_embeddings_event_id_idx
  ON face_embeddings(event_id);

CREATE INDEX IF NOT EXISTS face_embeddings_photo_id_idx
  ON face_embeddings(photo_id);

-- 3. Add new columns to event_photos table (if they don't exist)
ALTER TABLE event_photos
  ADD COLUMN IF NOT EXISTS r2_key             TEXT,
  ADD COLUMN IF NOT EXISTS r2_thumb_key       TEXT,
  ADD COLUMN IF NOT EXISTS processing_status  TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS face_count         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photographer_id    UUID;

-- Status values: 'pending' | 'queued' | 'processing' | 'processed' | 'failed' | 'no_face'
CREATE INDEX IF NOT EXISTS event_photos_processing_status_idx
  ON event_photos(processing_status);

CREATE INDEX IF NOT EXISTS event_photos_event_id_processing_idx
  ON event_photos(event_id, processing_status);

-- 4. Usage ledger for subscription enforcement
CREATE TABLE IF NOT EXISTS usage_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start     DATE NOT NULL DEFAULT date_trunc('month', NOW())::DATE,
  events_used      INTEGER DEFAULT 0,
  photos_used      INTEGER DEFAULT 0,
  scans_used       INTEGER DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photographer_id, period_start)
);

-- 5. Zip job tracking
CREATE TABLE IF NOT EXISTS zip_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL,
  guest_scan_id UUID,
  photo_ids     UUID[] NOT NULL,
  status        TEXT DEFAULT 'queued',  -- queued | processing | ready | failed
  r2_zip_key    TEXT,
  download_url  TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zip_jobs_status_idx ON zip_jobs(status);

-- 6. Subscriptions table (if not already present)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name           TEXT NOT NULL DEFAULT 'free',
  status              TEXT NOT NULL DEFAULT 'active',  -- active | cancelled | past_due
  events_per_month    INTEGER DEFAULT 1,
  photos_per_event    INTEGER DEFAULT 100,
  scans_per_event     INTEGER DEFAULT 200,
  razorpay_sub_id     TEXT,
  current_period_end  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photographer_id)
);

-- 7. Enable Realtime on event_photos for live progress bar
ALTER TABLE event_photos REPLICA IDENTITY FULL;

-- ============================================================
-- Supabase RPC Functions
-- ============================================================

-- Increment photos used in current period
CREATE OR REPLACE FUNCTION increment_photos_used(p_photographer_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO usage_ledger (photographer_id, period_start, photos_used)
  VALUES (p_photographer_id, date_trunc('month', NOW())::DATE, 1)
  ON CONFLICT (photographer_id, period_start)
  DO UPDATE SET
    photos_used = usage_ledger.photos_used + 1,
    updated_at  = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment events used
CREATE OR REPLACE FUNCTION increment_events_used(p_photographer_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO usage_ledger (photographer_id, period_start, events_used)
  VALUES (p_photographer_id, date_trunc('month', NOW())::DATE, 1)
  ON CONFLICT (photographer_id, period_start)
  DO UPDATE SET
    events_used = usage_ledger.events_used + 1,
    updated_at  = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment scans used
CREATE OR REPLACE FUNCTION increment_scans_used(p_photographer_id UUID, p_event_id UUID)
RETURNS void AS $$
DECLARE
  v_photographer_id UUID;
BEGIN
  -- Look up who owns the event
  SELECT photographer_id INTO v_photographer_id
  FROM events WHERE id = p_event_id LIMIT 1;

  IF v_photographer_id IS NOT NULL THEN
    INSERT INTO usage_ledger (photographer_id, period_start, scans_used)
    VALUES (v_photographer_id, date_trunc('month', NOW())::DATE, 1)
    ON CONFLICT (photographer_id, period_start)
    DO UPDATE SET
      scans_used = usage_ledger.scans_used + 1,
      updated_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- pgvector face similarity search
-- Searches only within a specific event's face embeddings
CREATE OR REPLACE FUNCTION match_faces(
  query_embedding  vector(512),
  event_id_filter  UUID,
  match_threshold  FLOAT   DEFAULT 0.50,
  match_count      INTEGER DEFAULT 50
)
RETURNS TABLE (photo_id UUID, similarity FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.photo_id,
    (1 - (fe.embedding <=> query_embedding))::FLOAT AS similarity
  FROM face_embeddings fe
  WHERE fe.event_id = event_id_filter
    AND (1 - (fe.embedding <=> query_embedding)) > match_threshold
  ORDER BY fe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Row Level Security (add policies as needed)
-- ============================================================

ALTER TABLE face_embeddings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE zip_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — worker uses service role key
-- Photographers can read their own usage
DO $$ BEGIN
  CREATE POLICY "photographers_read_own_usage"
    ON usage_ledger FOR SELECT
    USING (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "photographers_read_own_subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
