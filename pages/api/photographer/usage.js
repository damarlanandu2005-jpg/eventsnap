import { supabaseAdmin } from '@/lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error: usageError } = await supabaseAdmin
    .rpc('get_photographer_usage_summary', {
      p_photographer_id: user.id,
    });

  if (usageError)
    return res.status(500).json({ error: usageError.message });

  return res.status(200).json(data);
}
