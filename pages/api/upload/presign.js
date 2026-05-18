/**
 * DEPRECATED — DO NOT USE
 *
 * This endpoint previously generated R2 presigned URLs and upserted event_photos
 * records on every call. It was the root cause of photos appearing in the wrong
 * event: the upsert ran BEFORE the actual file upload, and the old client code
 * was sending an incorrect default eventId, so cross-event records leaked in.
 *
 * Replaced by /api/photographer/upload-photos (server-side multipart upload that
 * verifies event ownership and writes event_photos atomically with the storage
 * upload).
 *
 * Hard-disabled so any stale browser bundles that still call it cannot pollute
 * the database.
 */
export default async function handler(req, res) {
  return res.status(410).json({
    error: 'This upload endpoint has been removed. Please refresh the page (Ctrl+Shift+R) to load the updated app.',
    deprecated: true,
  });
}
