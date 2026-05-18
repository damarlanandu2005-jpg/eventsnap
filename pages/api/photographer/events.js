import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { r2Delete } from '@/lib/r2';

// GET  — list all events for this photographer
// POST — create new event  (enforces events_per_month plan limit)
// DELETE — delete event (full cleanup: storage, R2, embeddings, queue)
export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { photographer } = auth;
  const photographerId = photographer.id;

  // ── GET: list events ───────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('*, event_photos(count), photo_processing_queue(count)')
      .eq('photographer_id', photographerId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── POST: create event ─────────────────────────────────────
  if (req.method === 'POST') {
    const { name, slug, event_date } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });

    // Enforce events_per_month plan limit
    const { data: subRow } = await supabaseAdmin
      .from('subscriptions')
      .select('events_per_month')
      .eq('photographer_id', photographerId)
      .single();

    const eventsPerMonth = subRow?.events_per_month ?? 1;

    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const { data: ledger } = await supabaseAdmin
      .from('usage_ledger')
      .select('events_used')
      .eq('photographer_id', photographerId)
      .gte('period_start', periodStart.toISOString().slice(0, 10))
      .single();

    const eventsUsed = ledger?.events_used ?? 0;
    if (eventsUsed >= eventsPerMonth) {
      return res.status(403).json({
        error: `Event limit reached. Your plan allows ${eventsPerMonth} event(s) per month. You have created ${eventsUsed} this month.`,
      });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        name,
        slug: cleanSlug,
        photographer_id: photographerId,
        event_date: event_date || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'This URL slug is already taken. Choose another.' });
      // 23502 = NOT NULL violation — usually a legacy column that wasn't
      // migrated (e.g. rekognition_collection_id from the pre-InsightFace
      // era). Give the operator a clear next step instead of leaking raw SQL.
      if (error.code === '23502') {
        return res.status(500).json({
          error: 'Database schema is out of date. Please re-run lib/migrations/002_fixes.sql in the Supabase SQL Editor.',
        });
      }
      return res.status(500).json({ error: error.message });
    }

    // Increment events_used (non-blocking; supabase-js v2 .rpc() is a
    // thenable, not a real Promise — wrap in async IIFE so .catch() works).
    (async () => {
      try { await supabaseAdmin.rpc('increment_events_used', { p_photographer_id: photographerId }); }
      catch (_) {}
    })();

    return res.status(201).json(data);
  }

  // ── DELETE: delete event ───────────────────────────────────
  if (req.method === 'DELETE') {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    // Verify ownership
    const { data: ev } = await supabaseAdmin
      .from('events')
      .select('id, photographer_id')
      .eq('id', eventId)
      .single();

    if (!ev || ev.photographer_id !== photographerId) {
      return res.status(403).json({ error: 'Not authorized to delete this event' });
    }

    try {
      // Fetch all photo records for cleanup
      const { data: photos } = await supabaseAdmin
        .from('event_photos')
        .select('storage_path, thumbnail_path, r2_key, r2_thumb_key')
        .eq('event_id', eventId);

      // Delete Supabase Storage files
      if (photos?.length > 0) {
        const supabasePaths = photos
          .flatMap((p) => [p.storage_path, p.thumbnail_path])
          .filter(Boolean)
          .filter((p) => !p.startsWith('events/') || true); // all supabase paths
        if (supabasePaths.length > 0) {
          await supabaseAdmin.storage.from('event-photos').remove(supabasePaths);
        }

        // Delete R2 files
        const r2Keys = photos
          .flatMap((p) => [p.r2_key, p.r2_thumb_key])
          .filter(Boolean);
        await Promise.allSettled(r2Keys.map((k) => r2Delete(k)));
      }

      // Delete face_embeddings (biometric data — do before cascade)
      await supabaseAdmin.from('face_embeddings').delete().eq('event_id', eventId);

      // Delete photo_processing_queue rows
      await supabaseAdmin.from('photo_processing_queue').delete().eq('event_id', eventId);

      // Delete match_requests and related download_tokens (cascade handles tokens)
      await supabaseAdmin.from('match_requests').delete().eq('event_id', eventId);

      // Delete zip_jobs
      await supabaseAdmin.from('zip_jobs').delete().eq('event_id', eventId);

      // Delete event row (cascades to event_photos)
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
