import { supabaseAdmin } from '@/lib/supabase';

// POST /api/photographer/register
// Creates a photographer record linked to a Supabase Auth user.
// Called during signup and OAuth callback. Idempotent — safe to call multiple times.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { auth_user_id, email, full_name, business_name } = req.body;

  if (!auth_user_id || !email) {
    return res.status(400).json({ error: 'auth_user_id and email are required' });
  }

  try {
    // Check if photographer already exists (idempotent)
    const { data: existing } = await supabaseAdmin
      .from('photographers')
      .select('id')
      .eq('id', auth_user_id)
      .single();

    if (existing) {
      return res.status(200).json({ success: true, photographer: existing, message: 'Already registered' });
    }

    // Create new photographer record
    const { data, error } = await supabaseAdmin
      .from('photographers')
      .upsert({
        id: auth_user_id,
        email,
        name: full_name || email.split('@')[0],
        studio_name: business_name || null,
        plan: 'free',
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Photographer registration error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ success: true, photographer: data });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message });
  }
}
