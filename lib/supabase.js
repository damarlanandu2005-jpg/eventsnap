import { createClient } from '@supabase/supabase-js';

// ── Client-side (anon key only — safe for browser) ────────────
// Lazily constructed so that Next.js static-page builds don't
// throw when environment variables aren't present at build time.
//
// IMPORTANT: NEXT_PUBLIC_* must be referenced as literal property
// access (process.env.NEXT_PUBLIC_FOO), not bracket access. Webpack's
// DefinePlugin only inlines literal references at build time. Bracket
// access leaves the lookup to runtime, where browser `process.env`
// is empty — falling through to the placeholder URL and breaking auth.
let _anonClient = null;
function buildAnonClient() {
  if (_anonClient) return _anonClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.');
    // Return a dummy client during build so Next.js can still trace the module
    // without crashing. Real runtime will have the vars set.
    return createClient('https://placeholder.supabase.co', 'placeholder', {
      auth: { persistSession: false },
    });
  }

  _anonClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _anonClient;
}

export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = buildAnonClient();
    const val = client[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});

// ── Server-side admin client (service role — API routes only) ─
// Never bundles the service key into browser code.
// Throws clearly at call-time if the key is missing on the server.
let _adminClient = null;
function buildAdminClient() {
  if (_adminClient) return _adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      '[supabase] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to your Vercel server-only environment variables.'
    );
  }
  if (!url) {
    throw new Error('[supabase] NEXT_PUBLIC_SUPABASE_URL is not set.');
  }

  _adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _adminClient;
}

export const supabaseAdmin = new Proxy({}, {
  get(_target, prop) {
    const client = buildAdminClient();
    const val = client[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});
