/**
 * GET /api/photographer/events/[eventId]/photos
 *
 * Lists all photos for an event owned by the authenticated photographer.
 * Returns: id, filename, processing_status, face_count, uploaded_at, thumbUrl
 *
 * Requires JWT auth and event ownership.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { photographer } = auth;

  const { eventId } = req.query;
  if (!eventId) {
    return res.status(400).json({ error: 'eventId is required' });
  }

  // Verify event ownership
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, photographer_id')
    .eq('id', eventId)
    .single();

  if (!event || event.photographer_id !== photographer.id) {
    return res.status(403).json({ error: 'Not authorized to view this event' });
  }

  const { data: photos, error } = await supabaseAdmin
    .from('event_photos')
    .select('id, original_filename, processing_status, face_count, uploaded_at, thumbnail_path, r2_key, r2_thumb_key, storage_path')
    .eq('event_id', eventId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

  const result = (photos || []).map((p) => {
    const thumbKey = p.r2_thumb_key || p.thumbnail_path;
    const fullKey = p.r2_key || p.storage_path;
    const thumbUrl = thumbKey && publicBase ? `${publicBase}/${thumbKey}` : null;
    const fullUrl = fullKey && publicBase ? `${publicBase}/${fullKey}` : null;

    return {
      id: p.id,
      filename: p.original_filename,
      status: p.processing_status,
      faceCount: p.face_count ?? 0,
      uploadedAt: p.uploaded_at,
      thumbUrl,
      fullUrl,
    };
  });

  return res.status(200).json({ photos: result, total: result.length });
}
