/**
 * DEPRECATED — DO NOT USE
 *
 * The web UploadPanel and companion app now use the direct-to-Supabase
 * upload pipeline:
 *   POST /api/photographer/get-upload-url     (presign)
 *   PUT  <signed Supabase URL>                (direct upload)
 *   POST /api/photographer/confirm-upload     (register + queue)
 *
 * That path bypasses the Vercel function for the byte transfer, so it
 * scales cleanly to 500+ photos per session. This server-side multipart
 * route hit the 60s timeout / 4.5MB body limit on Hobby and was only
 * kept as a fallback during the migration.
 *
 * Hard-disabled now so any browser stuck on a stale JS bundle gets a
 * clear "please refresh" error instead of a confusing "batch X too
 * large" / "504 timeout" / "413 payload too large" failure.
 */
export default async function handler(req, res) {
  return res.status(410).json({
    error: 'This upload endpoint is no longer available. Please refresh the page (Ctrl+Shift+R, or close and reopen the tab on mobile) to load the latest version of the app.',
    deprecated: true,
  });
}
