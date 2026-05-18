-- ============================================================
-- EventSnap Migration 002 — Production fixes
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE)
-- ============================================================

-- 1. Add r2_thumb_key to event_photos (mirrors r2_key for thumbnails stored in R2)
ALTER TABLE event_photos ADD COLUMN IF NOT EXISTS r2_thumb_key TEXT;

-- 2. Add processed_at to photo_processing_queue if missing
ALTER TABLE photo_processing_queue ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 3. Add attempts column if missing
ALTER TABLE photo_processing_queue ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

-- 4. Composite index for efficient queue draining
CREATE INDEX IF NOT EXISTS idx_queue_claim
  ON photo_processing_queue(status, attempts, created_at)
  WHERE status IN ('pending', 'failed');

-- 5. Index for per-event photo lookups (event_id + processing_status)
CREATE INDEX IF NOT EXISTS idx_event_photos_event_status
  ON event_photos(event_id, processing_status);

-- ============================================================
-- RPC: Atomic queue batch claim
-- Prevents duplicate processing when multiple workers/cron triggers run concurrently.
-- Returns the claimed rows so callers can process them without a second SELECT.
-- ============================================================
CREATE OR REPLACE FUNCTION claim_queue_batch(
  p_batch_size  INTEGER DEFAULT 40,
  p_event_id    UUID    DEFAULT NULL
)
RETURNS TABLE (
  id                UUID,
  event_id          UUID,
  storage_path      TEXT,
  original_filename TEXT,
  photo_id          UUID,
  attempts          INTEGER,
  upload_source     TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM photo_processing_queue q
    WHERE q.status IN ('pending', 'failed')
      AND q.attempts < 3
      AND (p_event_id IS NULL OR q.event_id = p_event_id)
    ORDER BY q.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE photo_processing_queue q
    SET
      status        = 'processing',
      attempts      = q.attempts + 1,
      error_message = NULL
    FROM candidates c
    WHERE q.id = c.id
    RETURNING q.id, q.event_id, q.storage_path, q.original_filename,
              q.photo_id, q.attempts, q.upload_source
  )
  SELECT u.id, u.event_id, u.storage_path, u.original_filename,
         u.photo_id, u.attempts, u.upload_source
  FROM updated u;
END;
$$;

-- ============================================================
-- RPC: Remove a single photo_id from all match_requests.matched_photo_ids
-- Called by per-photo delete to keep cached result arrays consistent.
-- ============================================================
CREATE OR REPLACE FUNCTION remove_photo_from_match_requests(p_photo_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE match_requests
  SET matched_photo_ids = array_remove(matched_photo_ids, p_photo_id)
  WHERE p_photo_id = ANY(matched_photo_ids);
END;
$$;

-- ============================================================
-- RPC: increment_scans_used — accepts p_event_id (not p_photographer_id+p_event_id)
-- Matches the call signature used in scan.js
-- ============================================================
CREATE OR REPLACE FUNCTION increment_scans_used(p_event_id UUID)
RETURNS void AS $$
DECLARE
  v_photographer_id UUID;
BEGIN
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

-- ============================================================
-- Ensure face_embeddings.photographer_id is nullable (worker inserts it)
-- ============================================================
ALTER TABLE face_embeddings ALTER COLUMN photographer_id DROP NOT NULL;

-- ============================================================
-- Additional event_photos columns (idempotent)
-- ============================================================
ALTER TABLE event_photos ADD COLUMN IF NOT EXISTS r2_thumb_key TEXT;
ALTER TABLE event_photos ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_event_photos_photographer_id ON event_photos(photographer_id);

-- ============================================================
-- Additional photo_processing_queue columns (idempotent)
-- ============================================================
ALTER TABLE photo_processing_queue ADD COLUMN IF NOT EXISTS photo_id UUID REFERENCES event_photos(id) ON DELETE SET NULL;
ALTER TABLE photo_processing_queue ADD COLUMN IF NOT EXISTS photographer_id UUID REFERENCES photographers(id) ON DELETE SET NULL;
ALTER TABLE photo_processing_queue ADD COLUMN IF NOT EXISTS upload_source TEXT DEFAULT 'manual';
ALTER TABLE photo_processing_queue ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0;
ALTER TABLE photo_processing_queue ADD COLUMN IF NOT EXISTS error_message TEXT;
CREATE INDEX IF NOT EXISTS idx_queue_photo_id ON photo_processing_queue(photo_id);

-- ============================================================
-- Legacy AWS Rekognition columns (pre-InsightFace era)
-- Migration to InsightFace removed all writes to these columns,
-- but the original schema declared rekognition_collection_id as
-- NOT NULL — so any new event insert fails with:
--   "null value in column 'rekognition_collection_id' of relation
--    'events' violates not-null constraint"
-- Drop the NOT NULL and add a safe default so old constraints
-- can never break new InsightFace-era operations again.
-- (Columns kept rather than dropped, in case any historical row
-- has data we want to retain.)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'rekognition_collection_id'
  ) THEN
    ALTER TABLE events ALTER COLUMN rekognition_collection_id DROP NOT NULL;
    ALTER TABLE events ALTER COLUMN rekognition_collection_id SET DEFAULT '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_photos' AND column_name = 'rekognition_face_ids'
  ) THEN
    ALTER TABLE event_photos ALTER COLUMN rekognition_face_ids DROP NOT NULL;
    ALTER TABLE event_photos ALTER COLUMN rekognition_face_ids SET DEFAULT '{}';
  END IF;
END $$;

-- Force PostgREST to reload its schema cache so the new columns are
-- visible to the API immediately (otherwise inserts fail until the
-- next periodic refresh).
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Backfill: free subscriptions for existing photographers
-- (subscriptions, usage_ledger, zip_jobs created in 001_infrastructure_overhaul.sql)
-- ============================================================
INSERT INTO subscriptions (photographer_id, plan_name, events_per_month, photos_per_event, scans_per_event)
SELECT id, 'free', 1, 100, 200
FROM photographers p
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.photographer_id = p.id
);
