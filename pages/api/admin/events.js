import { supabaseAdmin } from '@/lib/supabase';
import { r2Delete } from '@/lib/r2';

export default async function handler(req, res) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return res.status(500).json({ error: 'ADMIN_SECRET is not configured' });
  }
  if (req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('*, event_photos(count)')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    try {
      // Fetch photos for storage cleanup
      const { data: photos } = await supabaseAdmin
        .from('event_photos')
        .select('storage_path, thumbnail_path, r2_key, r2_thumb_key')
        .eq('event_id', eventId);

      if (photos?.length > 0) {
        // Delete Supabase Storage files
        const supabasePaths = photos
          .flatMap((p) => [p.storage_path, p.thumbnail_path])
          .filter(Boolean);
        if (supabasePaths.length > 0) {
          await supabaseAdmin.storage.from('event-photos').remove(supabasePaths);
        }

        // Delete R2 files
        const r2Keys = photos
          .flatMap((p) => [p.r2_key, p.r2_thumb_key])
          .filter(Boolean);
        await Promise.allSettled(r2Keys.map((k) => r2Delete(k)));
      }

      // Delete face embeddings (biometric data)
      await supabaseAdmin.from('face_embeddings').delete().eq('event_id', eventId);

      // Delete photo_processing_queue rows
      await supabaseAdmin.from('photo_processing_queue').delete().eq('event_id', eventId);

      // Delete match_requests (cascade deletes download_tokens)
      await supabaseAdmin.from('match_requests').delete().eq('event_id', eventId);

      // Delete zip_jobs
      await supabaseAdmin.from('zip_jobs').delete().eq('event_id', eventId);

      // Delete event (cascades to event_photos)
      const { error } = await supabaseAdmin.from('events').delete().eq('id', eventId);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ success: true, photosDeleted: photos?.length ?? 0 });
    } catch (err) {
      console.error('Delete event error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
