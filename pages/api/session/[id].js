import { supabaseAdmin } from '@/lib/supabase';
import { createSignedUrls } from '@/lib/storage';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    // Get match session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('match_sessions')
      .select('*, events(name)')
      .eq('id', id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let matches = [];
    
    // If there are matched photos, fetch their details and generate signed URLs
    if (session.matched_photo_ids && session.matched_photo_ids.length > 0) {
      const { data: photos } = await supabaseAdmin
        .from('event_photos')
        .select('id, storage_path, original_filename')
        .in('id', session.matched_photo_ids);

      if (photos && photos.length > 0) {
        const paths = photos.map((p) => p.storage_path);
        const signedUrlData = await createSignedUrls('event-photos', paths, 3600);

        matches = photos.map((photo, idx) => ({
          id: photo.id,
          filename: photo.original_filename,
          url: signedUrlData[idx]?.signedUrl || null,
          // Similarity is not stored in DB, so we omit it here for re-fetches
        }));
      }
    }

    return res.status(200).json({
      id: session.id,
      event: {
        id: session.events?.id,
        name: session.events?.name
      },
      matches
    });
  } catch (err) {
    console.error('Fetch session error:', err);
    return res.status(500).json({ error: err.message });
  }
}
