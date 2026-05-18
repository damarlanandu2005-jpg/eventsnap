-- ============================================================
-- EventSnap / WeddingSnap — COMPLETE SCHEMA v3
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS / DO EXCEPTION blocks)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- PHOTOGRAPHERS (linked to Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS photographers (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  studio_name   TEXT,
  phone         TEXT,
  plan          TEXT DEFAULT 'free',
  monthly_upload_mb NUMERIC DEFAULT 0,
  storage_limit_mb  NUMERIC DEFAULT 1024,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE photographers ADD COLUMN IF NOT EXISTS monthly_upload_mb NUMERIC DEFAULT 0;
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS storage_limit_mb NUMERIC DEFAULT 1024;

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photographer_id           UUID REFERENCES photographers(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  slug                      TEXT UNIQUE NOT NULL,
  rekognition_collection_id TEXT DEFAULT '',
  event_date                DATE,
  is_active                 BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE events ALTER COLUMN rekognition_collection_id DROP NOT NULL;
ALTER TABLE events ALTER COLUMN rekognition_collection_id SET DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_events_slug             ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_photographer_id  ON events(photographer_id);

-- ============================================================
-- EVENT PHOTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS event_photos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photographer_id       UUID REFERENCES photographers(id) ON DELETE SET NULL,
  storage_path          TEXT NOT NULL,
  r2_key                TEXT,
  thumbnail_path        TEXT,
  rekognition_face_ids  TEXT[] DEFAULT '{}',
  original_filename     TEXT,
  processing_status     TEXT DEFAULT 'pending',
  face_count            INTEGER DEFAULT 0,
  processed_at          TIMESTAMPTZ,
  uploaded_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE event_photos ADD COLUMN IF NOT EXISTS photographer_id UUID REFERENCES photographers(id) ON DELETE SET NULL;
ALTER TABLE event_photos ADD COLUMN IF NOT EXISTS r2_key TEXT;
ALTER TABLE event_photos ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';
ALTER TABLE event_photos ADD COLUMN IF NOT EXISTS face_count INTEGER DEFAULT 0;
ALTER TABLE event_photos ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_event_photos_event_id ON event_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_event_photos_processing_status ON event_photos(processing_status);

-- ============================================================
-- PHOTO PROCESSING QUEUE (for background Rekognition indexing)
-- ============================================================
CREATE TABLE IF NOT EXISTS photo_processing_queue (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  storage_path      TEXT NOT NULL,
  original_filename TEXT,
  status            TEXT DEFAULT 'pending',   -- pending | processing | done | failed
  error_message     TEXT,
  photo_id          UUID,                     -- set after event_photos row is created
  file_size_bytes   BIGINT DEFAULT 0,
  upload_source     TEXT DEFAULT 'manual',
  attempts          INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  processed_at      TIMESTAMPTZ
);
ALTER TABLE photo_processing_queue ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0;
ALTER TABLE photo_processing_queue ADD COLUMN IF NOT EXISTS upload_source TEXT DEFAULT 'manual';
CREATE INDEX IF NOT EXISTS idx_queue_status   ON photo_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_event_id ON photo_processing_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_queue_status_attempts_created ON photo_processing_queue(status, attempts, created_at);

-- ============================================================
-- MATCH REQUESTS (guest selfie upload → face search)
-- ============================================================
CREATE TABLE IF NOT EXISTS match_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          UUID REFERENCES events(id) ON DELETE SET NULL,
  selfie_path       TEXT NOT NULL,
  status            TEXT DEFAULT 'pending',   -- pending | processing | complete | failed
  matched_photo_ids UUID[] DEFAULT '{}',
  whatsapp_number   TEXT,
  consent_given     BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOWNLOAD TOKENS (24-hour secure links)
-- ============================================================
CREATE TABLE IF NOT EXISTS download_tokens (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_request_id UUID NOT NULL REFERENCES match_requests(id) ON DELETE CASCADE,
  token            UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  expires_at       TIMESTAMPTZ NOT NULL,
  used             BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token);

-- ============================================================
-- FACE EMBEDDINGS (InsightFace + pgvector)
-- Stores 512-dim embeddings for all faces in event photos.
-- Used for cosine similarity search instead of AWS Rekognition.
-- ============================================================
CREATE TABLE IF NOT EXISTS face_embeddings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photo_id       UUID NOT NULL REFERENCES event_photos(id) ON DELETE CASCADE,
  photographer_id UUID REFERENCES photographers(id) ON DELETE SET NULL,
  embedding      VECTOR(512) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_event_id ON face_embeddings(event_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_photo_id ON face_embeddings(photo_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_embedding
  ON face_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE photographers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_tokens        ENABLE ROW LEVEL SECURITY;

-- Service role bypass (API routes use service role key)
DO $$ BEGIN
  CREATE POLICY "Service role bypass photographers"
    ON photographers FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role bypass events"
    ON events FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role bypass event_photos"
    ON event_photos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role bypass photo_processing_queue"
    ON photo_processing_queue FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role bypass match_requests"
    ON match_requests FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role bypass download_tokens"
    ON download_tokens FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE face_embeddings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role bypass face_embeddings"
    ON face_embeddings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- QUOTA HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION check_and_reserve_upload_quota(
  p_photographer_id UUID,
  p_file_size_mb NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_used NUMERIC;
  v_limit NUMERIC;
BEGIN
  SELECT
    COALESCE(monthly_upload_mb, 0),
    COALESCE(storage_limit_mb, 1024)
  INTO v_used, v_limit
  FROM photographers
  WHERE id = p_photographer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Photographer profile not found', 'used', 0, 'limit', 0);
  END IF;

  IF v_used + p_file_size_mb > v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Upload quota exceeded', 'used', v_used, 'limit', v_limit);
  END IF;

  UPDATE photographers
  SET monthly_upload_mb = v_used + p_file_size_mb
  WHERE id = p_photographer_id;

  RETURN jsonb_build_object('allowed', true, 'used', v_used + p_file_size_mb, 'limit', v_limit);
END;
$$;

CREATE OR REPLACE FUNCTION rollback_upload_quota(
  p_photographer_id UUID,
  p_file_size_mb NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE photographers
  SET monthly_upload_mb = GREATEST(COALESCE(monthly_upload_mb, 0) - p_file_size_mb, 0)
  WHERE id = p_photographer_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_photographer_usage_summary(
  p_photographer_id UUID
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'usedMb', COALESCE(monthly_upload_mb, 0),
    'limitMb', COALESCE(storage_limit_mb, 1024),
    'plan', COALESCE(plan, 'free')
  )
  FROM photographers
  WHERE id = p_photographer_id;
$$;

-- ============================================================
-- FACE MATCHING FUNCTION (pgvector cosine similarity)
-- Called by /api/match and /api/scan with a selfie embedding.
-- Returns photo_ids ranked by similarity (highest first).
-- ============================================================
CREATE OR REPLACE FUNCTION match_faces(
  query_embedding  VECTOR(512),
  event_id_filter  UUID,
  match_threshold  FLOAT DEFAULT 0.50,
  match_count      INT   DEFAULT 50
)
RETURNS TABLE (photo_id UUID, similarity FLOAT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (fe.photo_id)
    fe.photo_id,
    (1 - (fe.embedding <=> query_embedding))::FLOAT AS similarity
  FROM face_embeddings fe
  WHERE fe.event_id = event_id_filter
    AND (1 - (fe.embedding <=> query_embedding)) >= match_threshold
  ORDER BY fe.photo_id, similarity DESC
  LIMIT match_count;
END;
$$;

-- ============================================================
-- STORAGE BUCKETS (create manually in Supabase Dashboard → Storage)
-- 1. "event-photos"  → private
-- 2. "selfies"       → private (deleted after matching)
-- ============================================================
