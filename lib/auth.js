import { supabaseAdmin } from './supabase';

// ─────────────────────────────────────────────────────────────
// lib/auth.js
//
// Server-side authentication helpers for photographer accounts.
// Uses Supabase Auth — extracts JWT from cookies or Authorization header.
// ─────────────────────────────────────────────────────────────

/**
 * Extract the authenticated Supabase user from a Next.js API request.
 * Checks both the Authorization header and sb-access-token cookie.
 * Returns the user object or null if not authenticated.
 */
export async function getServerSideUser(req) {
  let token = null;

  // 1. Try Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // 2. Try cookie (set by Supabase client-side auth)
  if (!token) {
    const cookies = parseCookies(req.headers.cookie || '');
    // Supabase stores the access token in sb-<project-ref>-auth-token
    for (const [key, value] of Object.entries(cookies)) {
      if (key.includes('auth-token')) {
        try {
          const parsed = JSON.parse(decodeURIComponent(value));
          token = parsed?.access_token || parsed?.[0]?.access_token;
        } catch {
          // Not JSON, try as raw token
          token = value;
        }
        if (token) break;
      }
    }
  }

  if (!token) return null;

  // Verify the token with Supabase
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

/**
 * Get the photographer record for an authenticated user.
 * Creates one automatically if it doesn't exist (first login).
 */
export async function getPhotographer(authUserId, email) {
  // Try to find existing photographer
  const { data, error } = await supabaseAdmin
    .from('photographers')
    .select('*')
    .eq('id', authUserId)
    .single();

  if (data) return data;

  // Auto-create photographer record on first authenticated request
  if (email) {
    const { data: newPhotographer, error: insertError } = await supabaseAdmin
      .from('photographers')
      .upsert({
        id: authUserId,
        name: email?.split('@')[0] || 'Photographer',
        email,
        plan: 'free',
      }, { onConflict: 'id' })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create photographer record:', insertError);
      return null;
    }
    return newPhotographer;
  }

  return null;
}

/**
 * Middleware: require authentication for an API route.
 * Returns the user + photographer or sends 401.
 */
export async function requireAuth(req, res) {
  const user = await getServerSideUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return null;
  }

  const photographer = await getPhotographer(user.id, user.email);
  if (!photographer) {
    res.status(403).json({ error: 'Photographer account not found.' });
    return null;
  }

  return { user, photographer };
}

// ─── Cookie parser ────────────────────────────────────────────
function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  cookieString.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name.trim()] = rest.join('=').trim();
    }
  });
  return cookies;
}
