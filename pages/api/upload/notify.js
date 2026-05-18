/**
 * DEPRECATED — DO NOT USE
 *
 * Paired with the deprecated /api/upload/presign flow (BullMQ-based). Both are
 * replaced by /api/photographer/upload-photos which handles upload + queueing
 * atomically and verifies event ownership server-side.
 *
 * Hard-disabled so stale browser bundles cannot enqueue work for the wrong event.
 */
export default async function handler(req, res) {
  return res.status(410).json({
    error: 'This upload endpoint has been removed. Please refresh the page (Ctrl+Shift+R) to load the updated app.',
    deprecated: true,
  });
}
