import { supabaseAdmin } from '@/lib/supabase';

// GET /api/photographer/queue-status?eventId=xxx
// Returns indexing progress for a specific event.
// Polled by the frontend every 3 seconds during upload.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { eventId } = req.query;
  if (!eventId) return res.status(400).json({ error: 'eventId required' });

  const { data, error } = await supabaseAdmin
    .from('photo_processing_queue')
    .select('status')
    .eq('event_id', eventId);

  if (error) return res.status(500).json({ error: error.message });

  const total     = data.length;
  const pending   = data.filter((r) => r.status === 'pending').length;
  const processing = data.filter((r) => r.status === 'processing').length;
  const done      = data.filter((r) => r.status === 'done').length;
  const failed    = data.filter((r) => r.status === 'failed').length;

  return res.status(200).json({ total, pending, processing, done, failed });
}
