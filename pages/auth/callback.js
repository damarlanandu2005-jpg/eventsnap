import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';

// OAuth callback page — handles the redirect from Google/GitHub login
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Supabase automatically handles the OAuth token exchange
    // when the page loads with the hash fragment from the provider.
    // We just need to wait for the session to be established.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Create photographer record if it doesn't exist
        fetch('/api/photographer/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auth_user_id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
          }),
        }).finally(() => {
          router.push('/photographer');
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}
