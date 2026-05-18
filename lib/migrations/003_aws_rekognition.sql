-- ============================================================
-- Migration 003 — AWS Rekognition support
--
-- Re-introduces the AWS Rekognition data path that was retired when the
-- system moved to InsightFace + pgvector. Both providers now coexist behind
-- the FACE_PROVIDER env var so we can swap back to InsightFace in future
-- without further schema work.
--
-- Safe to re-run.
-- ============================================================

-- 1. The legacy rekognition_collection_id column was kept around as a
--    nullable TEXT default ''. Make sure it actually exists (older
--    deployments may have a different baseline) and is indexed for the
--    common "find by collection" lookup.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS rekognition_collection_id TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_events_rekognition_collection_id
  ON events(rekognition_collection_id)
  WHERE rekognition_collection_id IS NOT NULL AND rekognition_collection_id <> '';

-- 2. event_photos.rekognition_face_ids stores the list of FaceIds that
--    AWS Rekognition returned for the photo. We use it to delete face
--    rows from the collection when a photo is removed.
ALTER TABLE event_photos
  ADD COLUMN IF NOT EXISTS rekognition_face_ids TEXT[] DEFAULT '{}';

-- 3. GIN index so deletes / lookups by FaceId stay fast at scale.
CREATE INDEX IF NOT EXISTS idx_event_photos_rekognition_face_ids
  ON event_photos USING GIN (rekognition_face_ids);

-- 4. The face_embeddings table stays in place for the InsightFace path,
--    but make it explicit that it's optional now.
COMMENT ON TABLE face_embeddings IS
  'InsightFace 512-dim embeddings. Only populated when FACE_PROVIDER=insightface. AWS Rekognition uses event_photos.rekognition_face_ids instead.';
