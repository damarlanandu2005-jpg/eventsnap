/**
 * DELETE /api/photographer/photos/[photoId]
 *
 * Deletes a single event photo and all associated data:
 * - Supabase Storage (storage_path, thumbnail_path)
 * - R2 (r2_key, r2_thumb_key)
 * - face_embeddings rows for this photo
 * - photo_processing_queue rows for this photo
 * - event_photos row
 * - Removes photo_id from match_requests.matched_photo_ids where present
 *
 * Requires JWT auth and event ownership.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { r2Delete } from '@/lib/r2';
import { provider as faceProvider, providerName } from '@/lib/face';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { photographer } = auth;

  const { photoId } = req.query;
  if (!photoId) {
    return res.status(400).json({ error: 'photoId is required' });
  }

  // Fetch the photo and verify event ownership
  const { data: photo, error: photoError } = await supabaseAdmin
    .from('event_photos')
    .select('id, event_id, storage_path, thumbnail_path, r2_key, r2_thumb_key, rekognition_face_ids')
    .eq('id', photoId)
    .single();

  if (photoError || !photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  // Verify the event belongs to this photographer
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, photographer_id')
    .eq('id', photo.event_id)
    .single();

  if (!event || event.photographer_id !== photographer.id) {
    return res.status(403).json({ error: 'Not authorized to delete this photo' });
  }

  try {
    // Delete from Supabase Storage
    const supabasePaths = [photo.storage_path, photo.thumbnail_path].filter(Boolean);
    if (supabasePaths.length > 0) {
      await supabaseAdmin.storage.from('event-photos').remove(supabasePaths);
    }

    // Delete from R2
    const r2Keys = [photo.r2_key, photo.r2_thumb_key].filter(Boolean);
    await Promise.allSettled(r2Keys.map((k) => r2Delete(k)));

    // Delete face data from the active provider. For AWS we delete just the
    // FaceIds tied to this photo (cheap, scoped). InsightFace stores
    // embeddings in pgvector keyed by photo_id — we wipe those below.
    if (providerName === 'aws' && photo.rekognition_face_ids?.length && faceProvider.deletePhotoFaces) {
      try {
        await faceProvider.deletePhotoFaces({
          eventId: photo.event_id,
          faceIds: photo.rekognition_face_ids,
        });
      } catch (faceErr) {
        console.warn('Rekognition face delete failed:', faceErr.message);
      }
    }

    // Always wipe pgvector rows — they may exist from a prior InsightFace run.
    const { count: embeddingsDeleted } = await supabaseAdmin
      .from('face_embeddings')
      .delete({ count: 'exact' })
      .eq('photo_id', photoId);

    // Delete photo_processing_queue rows
    await supabaseAdmin
      .from('photo_processing_queue')
      .delete()
      .eq('photo_id', photoId);

    // Remove photo_id from match_requests.matched_photo_ids using RPC
    await supabaseAdmin
      .rpc('remove_photo_from_match_requests', { p_photo_id: photoId })
      .catch(() => {});

    // Delete the event_photos row
    const { error: deleteError } = await supabaseAdmin
      .from('event_photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    return res.status(200).json({
      success: true,
      embeddingsDeleted: embeddingsDeleted ?? 0,
    });
  } catch (err) {
    console.error('Photo delete error:', err);
    return res.status(500).json({ error: err.message });
  }
}
