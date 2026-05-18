import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import SelfieUploader from '@/components/SelfieUploader';

// ── Mandala Loader ────────────────────────────────────────────────────────────
function MandalaLoader({ text = 'Finding your memories...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div className="mandala-loader">
        <div className="mandala-ring ring-outer" />
        <div className="mandala-ring ring-mid" />
        <div className="mandala-ring ring-inner" />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✦</div>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontStyle: 'italic' }}>{text}</p>
    </div>
  );
}

// ── Gold Divider ──────────────────────────────────────────────────────────────
function GoldDivider({ margin = '1.5rem 0' }) {
  return <div className="gold-divider" style={{ margin }} />;
}

// ── Consent Modal ─────────────────────────────────────────────────────────────
function ConsentModal({ onAccept, onClose }) {
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const canProceed = checked1 && checked2;

  function Check({ checked, onChange, label }) {
    return (
      <label className="consent-check" onClick={() => onChange(!checked)}>
        <div className={`check-box ${checked ? 'checked' : ''}`}>
          <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
            <path className={`check-svg ${checked ? 'drawn' : ''}`} d="M1 5L5 9L12 1" stroke="#F0C060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>{label}</span>
      </label>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.6rem', fontWeight: 700, marginBottom: 8 }} className="gold-text">Your Privacy First</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>Before we find your photos, please review how we handle your selfie.</p>
        </div>
        <GoldDivider />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <Check checked={checked1} onChange={setChecked1} label="I understand my selfie will be used only to find my photos and will be deleted immediately after matching." />
          <Check checked={checked2} onChange={setChecked2} label="I consent to EventSnap processing my photo for face recognition at this event only." />
        </div>
        <div style={{ background: 'rgba(240,192,96,0.05)', border: '1px solid rgba(240,192,96,0.15)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          ✦ No face data is stored · Your selfie is deleted in &lt;60 seconds · No third parties
        </div>
        <button className="btn-primary" onClick={onAccept} disabled={!canProceed} style={{ marginBottom: 10 }}>Continue to Find My Photos →</button>
        <button className="btn-ghost" onClick={onClose} style={{ width: '100%' }}>Maybe later</button>
      </div>
    </div>
  );
}


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EventPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [stage, setStage] = useState('idle'); // idle | matching
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [showConsent, setShowConsent] = useState(false);
  const [matchingStep, setMatchingStep] = useState(0);

  const matchingMessages = [
    'Capturing your moment...',
    'Scanning photos...',
    'Running AI face matching...',
    'Finding your memories...',
    'Almost there...',
  ];

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/events/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Event not found or no longer active.');
        return res.json();
      })
      .then((data) => setEvent(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleFileSelect = useCallback((dataUrl) => {
    setSelfiePreview(dataUrl);
    setError(null);
  }, []);

  // SelfieUploader calls this when user has a selfie ready — go straight to consent
  const handleCapture = useCallback((base64Data) => {
    const dataUrl = 'data:image/jpeg;base64,' + base64Data;
    setSelfiePreview(dataUrl);
    setError(null);
    setShowConsent(true);
  }, []);

  const handleConsentAccept = useCallback(async () => {
    setShowConsent(false);
    setStage('matching');
    setMatchingStep(0);
    setError(null);

    // Start faux matching animation
    let step = 0;
    const iv = setInterval(() => {
      if (step < matchingMessages.length - 2) {
        step++;
        setMatchingStep(step);
      }
    }, 900);

    try {
      // Actually upload and match
      const byteString = atob(selfiePreview.split(',')[1]);
      const byteArray = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('selfie', blob, 'selfie.jpg');
      formData.append('eventId', event.id);

      const scanRes = await fetch('/api/scan', { method: 'POST', body: formData });
      const scanData = await scanRes.json();

      if (!scanRes.ok) throw new Error(scanData.error || 'Scan failed. Please try again.');

      clearInterval(iv);
      setMatchingStep(matchingMessages.length - 1); // Almost there
      
      const token = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem(`scan_${token}`, JSON.stringify({
        photos: scanData.photos,
        eventId: event.id,
        noFaceDetected: scanData.noFaceDetected
      }));

      setTimeout(() => {
        router.push(`/results/${token}`);
      }, 500);

    } catch (err) {
      clearInterval(iv);
      setError(err.message);
      setStage('idle');
    }
  }, [selfiePreview, slug, router, event]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid rgba(240,192,96,0.2)', borderTopColor: '#F0C060', borderRadius: '50%', animation: 'spin-slow 1s linear infinite' }} />
      </div>
    );
  }

  if (error && !selfiePreview) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 56, marginBottom: 16 }}>😔</p>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', marginBottom: 8 }}>Event Not Found</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{event ? event.name : 'Find Your Photos'} — EventSnap</title>
        <style>{`
          @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.08); opacity: 0.2; } 100% { transform: scale(1); opacity: 0.6; } }
          @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes spin-reverse { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
          @keyframes fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
          @keyframes shimmer { from { background-position: -200% center; } to { background-position: 200% center; } }
          @keyframes stroke-draw { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
          @keyframes glow-pulse { 0%, 100% { box-shadow: 0 0 30px rgba(240,192,96,0.20), 0 4px 16px rgba(240,192,96,0.10); } 50% { box-shadow: 0 0 50px rgba(240,192,96,0.40), 0 4px 24px rgba(240,192,96,0.20); } }
          .progress-shimmer { height: 4px; border-radius: 2px; background: linear-gradient(90deg, rgba(240,192,96,0.3) 0%, rgba(240,192,96,0.8) 40%, rgba(247,217,138,1) 50%, rgba(240,192,96,0.8) 60%, rgba(240,192,96,0.3) 100%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
          .consent-check { display: flex; gap: 12px; align-items: flex-start; cursor: pointer; }
          .check-box { width: 22px; height: 22px; border-radius: 6px; border: 1.5px solid rgba(240,192,96,0.40); background: rgba(240,192,96,0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; transition: all 0.2s ease; }
          .check-box.checked { background: rgba(240,192,96,0.15); border-color: rgba(240,192,96,0.70); }
          .check-svg { stroke-dasharray: 40; stroke-dashoffset: 40; }
          .check-svg.drawn { animation: stroke-draw 0.35s ease forwards; }
          .mandala-loader { width: 72px; height: 72px; position: relative; }
          .mandala-ring { position: absolute; border-radius: 50%; border: 2px solid transparent; }
          .ring-outer { inset: 0; border-top-color: rgba(240,192,96,0.8); border-right-color: rgba(240,192,96,0.3); animation: spin-slow 1.4s linear infinite; }
          .ring-mid { inset: 10px; border-top-color: rgba(167,139,250,0.7); border-left-color: rgba(167,139,250,0.3); animation: spin-reverse 1s linear infinite; }
          .ring-inner { inset: 22px; border-top-color: rgba(240,192,96,0.9); animation: spin-slow 0.7s linear infinite; }
          .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.70); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; animation: fade-in 0.2s ease; }
          .modal-box { background: var(--color-surface); border: 1px solid rgba(255,220,150,0.12); border-radius: 24px; padding: 36px 32px; max-width: 420px; width: 100%; box-shadow: 0 32px 80px rgba(0,0,0,0.70), 0 0 100px rgba(124,58,237,0.15); animation: fade-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        `}</style>
      </Head>

      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 80% 50% at 20% 10%, rgba(124,58,237,0.20) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(240,192,96,0.10) 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 50% 50%, rgba(124,58,237,0.05) 0%, transparent 70%), #0D0A14' }}>
        
        {showConsent && <ConsentModal onAccept={handleConsentAccept} onClose={() => setShowConsent(false)} />}

        {/* ── MATCHING STATE ──────────────────────────────────────── */}
        {stage === 'matching' && (
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'fade-in 0.3s ease' }}>
            <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
              <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto 36px' }}>
                <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'rgba(240,192,96,0.8)', borderRightColor: 'rgba(240,192,96,0.3)', animation: 'spin-slow 1.4s linear infinite' }} />
                <div style={{ position: 'absolute', inset: -18, borderRadius: '50%', border: '1.5px solid transparent', borderTopColor: 'rgba(167,139,250,0.6)', borderLeftColor: 'rgba(167,139,250,0.2)', animation: 'spin-reverse 2s linear infinite' }} />
                <img src={selfiePreview} alt="Your selfie" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(240,192,96,0.40)' }} />
              </div>

              <MandalaLoader text={matchingMessages[Math.min(matchingStep, matchingMessages.length - 1)]} />

              <div style={{ marginTop: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', height: 4 }}>
                <div className="progress-shimmer" style={{ width: `${Math.min(100, (matchingStep / (matchingMessages.length - 1)) * 100)}%`, transition: 'width 0.8s ease' }} />
              </div>
            </div>
          </div>
        )}

        {/* ── IDLE STATE ──────────────────────────────────────────── */}
        {stage === 'idle' && (
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #7C3AED, #E8A830)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✦</div>
                <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.01em' }} className="gold-text">EventSnap</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>हिंदी · తెలుగు · தமிழ்</span>
                <span className="badge badge-active">● Live</span>
              </div>
            </nav>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
              <div style={{ maxWidth: 480, width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
                
                <div style={{ textAlign: 'center', marginBottom: 32, animation: 'fade-up 0.6s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                  <span className="badge badge-gold" style={{ marginBottom: 16, display: 'inline-flex' }}>✦ {event?.name}</span>
                  <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 800, fontSize: 'clamp(2rem, 5vw, 2.8rem)', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 10 }} className="gold-text">
                    Your event<br/>memories await
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.7 }}>
                    Upload a selfie — our AI finds every<br/>photo of you from {event?.event_date ? new Date(event.event_date).toLocaleDateString() : 'today'} in seconds.
                  </p>
                </div>

                <div className="card" style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 24, animation: 'fade-up 0.6s 0.1s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                  <SelfieUploader onCapture={handleCapture} />

                  {error && (
                    <div style={{ padding: 16, borderRadius: 12, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: '0.9rem', textAlign: 'center' }}>
                      {error}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 28, animation: 'fade-up 0.6s 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                  <GoldDivider margin="0 0 20px 0" />
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
                    {['🔒 Selfie deleted instantly', '🤖 AI powered matching', '✨ Direct delivery'].map(item => (
                      <span key={item} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>{item}</span>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            <footer style={{ padding: '20px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>© 2025 EventSnap · Made with ♥ for Indian celebrations</p>
              <div style={{ display: 'flex', gap: 16 }}>
                {[{ label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }, { label: 'Help', href: '/contact' }].map(({ label, href }) => (
                  <Link key={label} href={href} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'none' }} onMouseOver={e => e.target.style.color = 'var(--color-gold)'} onMouseOut={e => e.target.style.color = 'var(--text-muted)'}>{label}</Link>
                ))}
              </div>
            </footer>
          </div>
        )}
      </div>
    </>
  );
}
