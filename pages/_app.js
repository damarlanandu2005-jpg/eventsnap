import '@/styles/globals.css';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ToastProvider } from '@/components/Toast';
import CookieBanner from '@/components/CookieBanner';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const handleStart = () => setTransitioning(true);
    const handleDone = () => setTransitioning(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleDone);
    router.events.on('routeChangeError', handleDone);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleDone);
      router.events.off('routeChangeError', handleDone);
    };
  }, [router]);

  // Auto-reload when a fresher build is deployed.
  //
  // Without this, mobile browsers can hold the old JS bundle for hours
  // — users keep hitting deprecated code paths and bugs that have
  // already been fixed. On every visibility/focus return AND on chunk
  // load errors, we compare the bundle's build SHA to the server's. If
  // they differ AND no upload is in flight (window.__APP_BUSY__),
  // refresh silently.
  //
  // Both sides MUST use the same identifier or this loops forever:
  // Vercel's NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is inlined into the
  // bundle at build time and also readable from /api/version at
  // runtime, so it's the canonical "what build am I" answer.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is inlined by webpack
    // at build time (see Vercel docs). Falls through to undefined on
    // local dev / non-Vercel builds, in which case we skip the check
    // entirely (no SHA → can't reliably compare).
    const myBuildSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    if (!myBuildSha) return;

    let timer = null;

    async function checkVersion() {
      if (window.__APP_BUSY__) return; // never interrupt an upload
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = await res.json();
        // Only reload if BOTH sides have a real SHA AND they differ.
        // Defensive against any edge case where the server returns a
        // sentinel like 'dev' or undefined.
        if (buildId && buildId !== 'dev' && buildId !== myBuildSha) {
          window.location.reload();
        }
      } catch (_) {
        // Network blip — try again next focus cycle.
      }
    }

    // Check on focus / visibility return (cheap and high signal)
    const onVisibility = () => { if (document.visibilityState === 'visible') checkVersion(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', checkVersion);

    // Belt-and-suspenders: also catch dynamic-chunk load failures
    // (happen after a deploy when an old page tries to lazy-load a
    // chunk that has been deleted) and force a reload.
    const onError = (e) => {
      const msg = (e?.message || '').toLowerCase();
      const name = e?.error?.name || '';
      if (name === 'ChunkLoadError' || /chunk.*load|loading css|loading chunk/.test(msg)) {
        if (!window.__APP_BUSY__) window.location.reload();
      }
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', (e) => onError({ error: e?.reason, message: e?.reason?.message }));

    // Also poll every 5 minutes as a backstop for tabs that stay
    // visible the whole time.
    timer = setInterval(checkVersion, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', checkVersion);
      window.removeEventListener('error', onError);
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <ToastProvider>
      {transitioning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#0D0A14',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#7C3AED,#E8A830)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              color: 'white',
              fontWeight: 700,
              boxShadow: '0 0 20px rgba(124,58,237,0.35)',
            }}>✦</div>
            <div style={{
              width: 24,
              height: 24,
              border: '2px solid rgba(240,192,96,0.20)',
              borderTopColor: '#F0C060',
              borderRadius: '50%',
              animation: 'appSpin 0.7s linear infinite',
            }} />
          </div>
          <style>{`@keyframes appSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <Component {...pageProps} />
      <CookieBanner />
    </ToastProvider>
  );
}
