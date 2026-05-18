import { supabaseAdmin } from '@/lib/supabase';

// GET /api/events/[eventId]
// Public lookup by slug or UUID — returns active event data for the guest scan page.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { eventId } = req.query;

  // Support both UUID (direct ID) and slug lookup
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);

  let query = supabaseAdmin
    .from('events')
    .select('id, name, slug, event_date, is_active, created_at')
    .eq('is_active', true);

  if (isUUID) {
    query = query.eq('id', eventId);
  } else {
    query = query.eq('slug', eventId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return res.status(404).json({ error: 'Event not found' });
  }

  return res.status(200).json(data);
}
