import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

// ── Confetti ──────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#F0C060','#F7D98A','#A78BFA','#7C3AED','#4ADE80','#fff','#E8A830'];

function ConfettiPiece({ color, left, delay, duration, size, shape }) {
  return (
    <div className="confetti-piece" style={{
      left: `${left}%`,
      backgroundColor: color,
      width: size,
      height: shape === 'circle' ? size : size * 0.6,
      borderRadius: shape === 'circle' ? '50%' : '2px',
      animationDuration: `${duration}ms`,
      animationDelay: `${delay}ms`,
    }} />
  );
}

function Confetti({ active }) {
  const [pieces, setPieces] = useState([]);
  
  useEffect(() => {
    if (active) {
      setPieces(Array.from({ length: 45 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left: Math.random() * 100,
        delay: Math.random() * 1200,
        duration: 2200 + Math.random() * 1800,
        size: 8 + Math.random() * 8,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      })));
    } else {
      setPieces([]);
    }
  }, [active]);

  if (!active) return null;
  return <>{pieces.map(p => <ConfettiPiece key={p.id} {...p} />)}</>;
}

// ── Photo Grid ────────────────────────────────────────────────────────────────
async function downloadSinglePhoto(photo, fallbackIndex) {
  const src = photo.fullUrl || photo.signedUrl || photo.url || photo.src;
  if (!src) return;

  const filename = photo.filename || `event-photo-${fallbackIndex + 1}.jpg`;
  const res = await fetch(src);
  if (!res.ok) throw new Error('Photo download failed');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function PhotoGrid({ photos }) {
  const [visible, setVisible] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  useEffect(() => {
    setVisible([]);
    photos.forEach((p, i) => {
      setTimeout(() => setVisible(v => [...v, p.id || i]), i * 80);
    });
  }, [photos]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 16,
    }}>
      {photos.map((photo, i) => {
        const id = photo.id || i;
        const confidence = photo.similarity ? photo.similarity : (photo.confidence ? Math.round(photo.confidence) : 95);
        const src = photo.thumbUrl || photo.fullUrl || photo.signedUrl || photo.url || photo.src || `https://picsum.photos/seed/res${i}/600/450`;
        const isDownloading = downloadingId === id;
        
        return (
          <div
            key={id}
            className="photo-card"
            style={{
              aspectRatio: '4/3',
              opacity: visible.includes(id) ? 1 : 0,
              transform: visible.includes(id) ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(12px)',
              transition: `opacity 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)`,
            }}
          >
            <div className="confidence-bar">
              <div className="confidence-fill" style={{ width: `${confidence}%` }} />
            </div>
            <img src={src} alt={`Photo ${i + 1}`} loading="lazy" />
            <div className="hover-overlay">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.78rem',
                  fontFamily: 'DM Mono, monospace',
                }}>{confidence}% match</span>
                <button
                  className="save-btn"
                  disabled={isDownloading}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setDownloadingId(id);
                    try {
                      await downloadSinglePhoto(photo, i);
                    } catch {
                      alert('Photo download failed. Please try again.');
                    } finally {
                      setDownloadingId(null);
                    }
                  }}
                >
                  {isDownloading ? 'Saving...' : 'Download'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipMessage, setZipMessage] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    try {
      const stored = sessionStorage.getItem(`scan_${sessionId}`);
      if (!stored) throw new Error('This link may be invalid or expired.');
      const data = JSON.parse(stored);
      setSession(data);
      if (data.photos && data.photos.length > 0) {
        setTimeout(() => setConfetti(true), 200);
        setTimeout(() => setConfetti(false), 5000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleDownloadAll = async () => {
    setDownloadingZip(true);
    setZipMessage('Preparing your zip file...');
    try {
      const res = await fetch('/api/download/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: session.photos.map(p => p.id),
          eventId: session.eventId || session.photos[0]?.eventId || session.id, // need eventId
          guestEmail: null
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to prepare zip');

      if (data.mode === 'client_zip') {
         const JSZip = (await import('jszip')).default;
         const zip = new JSZip();
         setZipMessage('Downloading photos...');
         
         await Promise.all(data.urls.map(async (u) => {
           const imgRes = await fetch(u.url);
           const blob = await imgRes.blob();
           zip.file(u.filename, blob);
         }));

         setZipMessage('Generating zip...');
         const content = await zip.generateAsync({ type: 'blob' });
         const link = document.createElement('a');
         link.href = URL.createObjectURL(content);
         link.download = 'EventSnap-Photos.zip';
         link.click();
         setDownloadingZip(false);
         setZipMessage('');
      } else {
         setZipMessage(data.message || 'Zip is being prepared...');
         const iv = setInterval(async () => {
           const pollRes = await fetch(`/api/download/${data.jobId}`);
           if (!pollRes.ok) return;
           const pollData = await pollRes.json();
           if (pollData.status === 'ready') {
             clearInterval(iv);
             window.location.href = pollData.download_url;
             setDownloadingZip(false);
             setZipMessage('');
           } else if (pollData.status === 'failed') {
             clearInterval(iv);
             alert('Zip generation failed. Please try again.');
             setDownloadingZip(false);
             setZipMessage('');
           }
         }, 3000);
      }
    } catch (err) {
      alert(err.message || 'Failed to request download. Please try again.');
      setDownloadingZip(false);
      setZipMessage('');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid rgba(240,192,96,0.2)', borderTopColor: '#F0C060', borderRadius: '50%', animation: 'spin-slow 1s linear infinite' }} />
        <p style={{ marginTop: 20, color: 'var(--text-secondary)', fontSize: '0.95rem', fontStyle: 'italic' }}>Finding your memories...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 56, marginBottom: 16 }}>⌛</p>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', marginBottom: 8 }}>Link Expired</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error || 'This link may be invalid or expired.'}</p>
          <button onClick={() => router.push('/')} className="btn-primary" style={{ marginTop: 20, width: 'auto' }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const photoCount = session.photos?.length || 0;

  return (
    <>
      <Head>
        <title>Your Photos — EventSnap</title>
        <meta name="description" content="Your AI-matched photos, ready to download." />
        <style>{`
          @keyframes fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes confetti-fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
          @keyframes celebration-pop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
          .confetti-piece { position: fixed; width: 10px; height: 10px; borderRadius: 2px; top: -20px; animation: confetti-fall linear both; z-index: 10; pointer-events: none; }
          .photo-card { position: relative; border-radius: 16px; overflow: hidden; cursor: pointer; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
          .photo-card:hover { transform: scale(1.03) !important; box-shadow: 0 0 0 2px rgba(240,192,96,0.50), 0 16px 40px rgba(0,0,0,0.60); z-index: 2; }
          .photo-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .confidence-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.1); }
          .confidence-fill { height: 100%; background: linear-gradient(90deg, #E8A830, #F7D98A); border-radius: 2px; }
          .hover-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px; background: linear-gradient(transparent, rgba(0,0,0,0.8)); display: flex; justify-content: flex-end; alignItems: flex-end; transform: translateY(100%); transition: transform 0.25s ease; }
          .photo-card:hover .hover-overlay { transform: translateY(0); }
          .save-btn { background: rgba(240,192,96,0.90); color: #0D0A14; border: none; border-radius: 8px; padding: 7px 14px; font-size: 0.8rem; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; }
          .save-btn:hover { background: #F7D98A; }
          .save-btn:disabled { opacity: 0.7; cursor: wait; }
          .sticky-bar { position: sticky; top: 0; z-index: 50; padding: 12px 20px; background: rgba(13,10,20,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,220,150,0.10); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        `}</style>
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse 80% 50% at 20% 10%, rgba(124,58,237,0.20) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(240,192,96,0.10) 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 50% 50%, rgba(124,58,237,0.05) 0%, transparent 70%), #0D0A14' }}>
        <Confetti active={confetti} />
        
        {photoCount === 0 ? (
          <>
            <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid var(--color-border)' }}>
              <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #7C3AED, #E8A830)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'white' }}>✦</div>
                <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.01em' }} className="gold-text">EventSnap</span>
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-active">● Live</span>
              </div>
            </nav>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, background: 'rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 56, marginBottom: 16 }}>😔</p>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', marginBottom: 8 }}>
                  {session.noFaceDetected ? 'No face detected in your selfie.' : 'No matching photos found.'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: 300, margin: '0 auto' }}>
                  {session.noFaceDetected
                    ? 'Please try again with a clear, well-lit front-facing photo.'
                    : 'Your face may not appear in the event gallery, or photos are still being processed.'}
                </p>
                <button onClick={() => router.push('/')} className="btn-primary" style={{ marginTop: 24, width: 'auto' }}>
                  Try Again
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1 }}>
            <div className="sticky-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', fontWeight: 700 }} className="gold-text">EventSnap</span>
                <span className="badge badge-active" style={{ fontSize: '0.65rem' }}>✦ Live</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <button onClick={handleDownloadAll} disabled={downloadingZip} className="btn-primary" style={{ width: 'auto', padding: '10px 22px', fontSize: '0.9rem', borderRadius: 10, opacity: downloadingZip ? 0.7 : 1 }}>
                  {downloadingZip ? 'Processing...' : `⬇ Save All ${photoCount} Photos`}
                </button>
                {zipMessage && <span style={{ fontSize: '0.75rem', color: 'var(--color-gold)' }}>{zipMessage}</span>}
              </div>
            </div>

            <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 80px' }}>
              <div style={{ textAlign: 'center', marginBottom: 40, animation: 'celebration-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.02em', marginBottom: 10 }} className="gold-text">
                  We found {photoCount} beautiful photos of you!
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
                  Your selfie has been deleted for privacy.
                </p>
              </div>

              <div className="gold-divider" style={{ margin: '1.5rem 0' }} />

              <PhotoGrid photos={session.photos} />

              <div className="gold-divider" style={{ margin: '2.5rem 0' }} />

              {/* WhatsApp card removed */}

              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <button className="btn-ghost" onClick={() => router.push('/')} style={{ fontSize: '0.85rem' }}>← Try another selfie</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
