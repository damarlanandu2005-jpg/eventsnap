import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const STATUS_LABEL = {
  processed: { text: 'Searchable', color: '#4ADE80' },
  pending:   { text: 'Queued', color: '#F0C060' },
  queued:    { text: 'Queued', color: '#F0C060' },
  processing:{ text: 'Processing', color: '#60A5FA' },
  failed:    { text: 'Failed', color: '#EF4444' },
  no_face:   { text: 'No Face', color: 'rgba(255,255,255,0.35)' },
};

export default function EventManagePage() {
  const router = useRouter();
  const { id } = router.query;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [token, setToken] = useState('');
  const [progress, setProgress] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);

  const fetchProgress = useCallback(async (tok) => {
    if (!id || !tok) return;
    try {
      const res = await fetch(`/api/events/${id}/progress`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.ok) setProgress(await res.json());
    } catch (_) {}
  }, [id]);

  const fetchPhotos = useCallback(async (tok) => {
    if (!id || !tok) return;
    setPhotosLoading(true);
    try {
      const res = await fetch(`/api/photographer/events/${id}/photos`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      }
    } catch (_) {}
    setPhotosLoading(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return; }
      const tok = session.access_token;
      setToken(tok);

      fetch('/api/photographer/events', {
        headers: { Authorization: `Bearer ${tok}` },
      }).then(r => r.json()).then(events => {
        const ev = Array.isArray(events) ? events.find(e => e.id === id) : null;
        if (ev) setEvent(ev);
        else router.push('/photographer');
        setLoading(false);
      }).catch(() => { setLoading(false); router.push('/photographer'); });

      fetchProgress(tok);
      fetchPhotos(tok);
    });
  }, [id]);

  useEffect(() => {
    if (!id || !token) return;
    const iv = setInterval(() => {
      fetchProgress(token);
      fetchPhotos(token);
    }, 4000);
    return () => clearInterval(iv);
  }, [id, token, fetchProgress, fetchPhotos]);

  const handleDeleteEvent = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/photographer/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: id }),
      });
      if (res.ok) {
        router.push('/photographer');
      } else {
        const data = await res.json();
        alert(data.error || 'Delete failed. Please try again.');
        setDeleting(false);
        setShowConfirm(false);
      }
    } catch {
      alert('Network error. Please try again.');
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    setDeletingPhotoId(photoId);
    try {
      const res = await fetch(`/api/photographer/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        fetchProgress(token);
      } else {
        const data = await res.json();
        alert(data.error || 'Delete failed.');
      }
    } catch {
      alert('Network error. Please try again.');
    }
    setDeletingPhotoId(null);
  };

  if (loading) {
    return (
      <div style={{ position:'fixed', inset:0, background:'#0D0A14', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#7C3AED,#E8A830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'white', fontWeight:700, margin:'0 auto 16px', boxShadow:'0 0 24px rgba(124,58,237,0.40)' }}>✦</div>
          <div style={{ width:28, height:28, border:'2px solid rgba(240,192,96,0.20)', borderTopColor:'#F0C060', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!event) return null;

  const photosCount = progress?.total ?? (event.event_photos?.[0]?.count || 0);
  const searchableCount = progress?.searchable ?? progress?.processed ?? 0;
  const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/event/${event.slug}`;
  const processingInProgress = progress && !progress.done && progress.total > 0;

  return (
    <>
      <Head>
        <title>{event.name} — EventSnap</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0D0A14; color: white; font-family: 'Inter', sans-serif; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
          .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,220,150,0.10); border-radius: 20px; padding: 28px 32px; }
          .btn-danger { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.30); color: #EF4444; padding: 12px 28px; border-radius: 12px; font-size: 0.95rem; font-weight: 600; cursor: pointer; font-family: 'Inter',sans-serif; transition: all 0.2s ease; }
          .btn-danger:hover { background: rgba(239,68,68,0.20); border-color: rgba(239,68,68,0.50); }
          .btn-ghost { background: transparent; border: 1px solid rgba(240,192,96,0.30); color: #F0C060; padding: 12px 28px; border-radius: 12px; font-size: 0.95rem; font-weight: 600; cursor: pointer; font-family: 'Inter',sans-serif; transition: all 0.2s ease; }
          .btn-ghost:hover { background: rgba(240,192,96,0.08); }
          .photo-card { position: relative; border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); aspect-ratio: 1; }
          .photo-card:hover .photo-overlay { opacity: 1; }
          .photo-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.70); opacity: 0; transition: opacity 0.2s ease; display: flex; align-items: center; justify-content: center; }
          .photo-del-btn { background: rgba(239,68,68,0.90); border: none; color: white; padding: 8px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: 'Inter',sans-serif; }
          .photo-del-btn:hover { background: #EF4444; }
        `}</style>
      </Head>

      {/* Navbar */}
      <nav style={{ borderBottom:'1px solid rgba(255,220,150,0.08)', padding:'16px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(13,10,20,0.90)', backdropFilter:'blur(20px)', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <Link href="/photographer" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none', color:'rgba(255,255,255,0.50)', fontSize:'0.9rem' }}>
            ← Dashboard
          </Link>
          <span style={{ color:'rgba(255,255,255,0.15)' }}>|</span>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#7C3AED,#E8A830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'white', fontWeight:700 }}>✦</div>
            <span style={{ fontFamily:'Playfair Display,serif', fontWeight:700, fontSize:'1.1rem', background:'linear-gradient(135deg,#F0C060,#F7D98A,#E8A830)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>EventSnap</span>
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth:900, margin:'0 auto', padding:'48px 24px', animation:'fadeUp 0.5s ease both' }}>

        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:event.is_active ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)', border:`1px solid ${event.is_active ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.12)'}`, borderRadius:20, padding:'4px 12px', fontSize:'0.7rem', fontWeight:600, color:event.is_active ? '#4ADE80' : 'rgba(255,255,255,0.40)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>
            {event.is_active ? '● Active' : '○ Inactive'}
          </span>
          <h1 style={{ fontFamily:'Playfair Display,serif', fontWeight:800, fontSize:'clamp(1.8rem,4vw,2.5rem)', letterSpacing:'-0.02em', marginBottom:8, background:'linear-gradient(135deg,#F0C060,#F7D98A,#E8A830)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            {event.name}
          </h1>
          <p style={{ color:'rgba(255,255,255,0.40)', fontSize:'0.9rem', fontFamily:'DM Mono,monospace' }}>/event/{event.slug}</p>
        </div>

        {/* Processing progress */}
        {processingInProgress && (
          <div style={{ marginBottom:24, background:'rgba(255,255,255,0.05)', padding:16, borderRadius:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:'0.85rem' }}>Indexing photos for face search…</span>
              <span style={{ fontSize:'0.85rem' }}>{progress.percent}%</span>
            </div>
            <div style={{ height:4, background:'rgba(255,255,255,0.1)', borderRadius:2 }}>
              <div style={{ height:'100%', width:`${progress.percent}%`, background:'#F0C060', borderRadius:2, transition:'width 0.3s ease' }} />
            </div>
            <div style={{ display:'flex', gap:16, marginTop:8, fontSize:'0.75rem', color:'rgba(255,255,255,0.5)', flexWrap:'wrap' }}>
              <span style={{ color:'#4ADE80' }}>{progress.processed} searchable</span>
              <span>{(progress.pending ?? 0) + (progress.queued ?? 0) + (progress.processing ?? 0)} pending</span>
              {progress.no_face > 0 && <span>{progress.no_face} no face</span>}
              {progress.failed > 0 && <span style={{ color:'#EF4444' }}>{progress.failed} failed</span>}
            </div>
            <p style={{ marginTop:8, fontSize:'0.75rem', color:'rgba(255,255,255,0.35)' }}>
              Only searchable photos appear in guest results. Processing continues in the background.
            </p>
          </div>
        )}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:16, marginBottom:28 }}>
          {[
            { label:'Uploaded', value:photosCount, icon:'📸' },
            { label:'Searchable', value:searchableCount, icon:'🔍' },
            { label:'Created', value:new Date(event.created_at).toLocaleDateString('en-IN'), icon:'📅' },
            { label:'Status', value:event.is_active ? 'Live' : 'Closed', icon:'🔘' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:'20px 22px', textAlign:'center' }}>
              <div style={{ fontSize:22, marginBottom:8 }}>{s.icon}</div>
              <p style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:4 }}>{s.value}</p>
              <p style={{ color:'rgba(255,255,255,0.40)', fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Share link */}
        <div className="card" style={{ marginBottom:28 }}>
          <p style={{ fontSize:'0.78rem', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', color:'rgba(255,255,255,0.40)', marginBottom:12 }}>Guest Link</p>
          <div style={{ display:'flex', gap:0 }}>
            <div style={{ flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px 0 0 10px', padding:'12px 16px', fontFamily:'DM Mono,monospace', fontSize:'0.82rem', color:'rgba(255,255,255,0.60)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {shareLink}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(shareLink); alert('Copied!'); }}
              style={{ background:'linear-gradient(135deg,#E8A830,#F0C060)', color:'#0D0A14', border:'none', borderRadius:'0 10px 10px 0', padding:'12px 20px', fontWeight:700, fontSize:'0.88rem', cursor:'pointer', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap' }}
            >Copy</button>
          </div>
        </div>

        {/* Photo Grid */}
        <div className="card" style={{ marginBottom:28 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <p style={{ fontWeight:600, fontSize:'1rem' }}>Photos ({photos.length})</p>
            {photosLoading && <span style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.4)' }}>Refreshing…</span>}
          </div>

          {photos.length === 0 && !photosLoading && (
            <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.9rem' }}>No photos uploaded yet.</p>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:10 }}>
            {photos.map((photo) => {
              const s = STATUS_LABEL[photo.status] || { text: photo.status, color: 'rgba(255,255,255,0.4)' };
              const isDeleting = deletingPhotoId === photo.id;
              return (
                <div key={photo.id} className="photo-card" style={{ opacity: isDeleting ? 0.4 : 1 }}>
                  {photo.thumbUrl
                    ? <img src={photo.thumbUrl} alt={photo.filename} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                    : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, color:'rgba(255,255,255,0.15)' }}>📷</div>
                  }
                  {/* Status badge */}
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(to top, rgba(0,0,0,0.80), transparent)', padding:'20px 6px 6px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                    <span style={{ fontSize:'0.6rem', fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'0.03em' }}>{s.text}</span>
                    {photo.faceCount > 0 && <span style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.5)' }}>{photo.faceCount} face{photo.faceCount !== 1 ? 's' : ''}</span>}
                  </div>
                  {/* Hover overlay with delete */}
                  <div className="photo-overlay">
                    <button
                      className="photo-del-btn"
                      onClick={() => handleDeletePhoto(photo.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delete Event Section */}
        <div className="card" style={{ borderColor:'rgba(239,68,68,0.15)' }}>
          <p style={{ fontWeight:600, fontSize:'1rem', marginBottom:8, color:'rgba(255,255,255,0.90)' }}>Delete Event</p>
          <p style={{ color:'rgba(255,255,255,0.50)', fontSize:'0.88rem', lineHeight:1.6, marginBottom:20 }}>
            Permanently delete this event and all its photos, face data, and guest matching history. This cannot be undone.
          </p>
          <button className="btn-danger" onClick={() => setShowConfirm(true)}>
            Delete Event
          </button>
        </div>
      </main>

      {/* Confirm Delete Modal */}
      {showConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.80)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20 }}>
          <div style={{ background:'#13101E', border:'1px solid rgba(239,68,68,0.25)', borderRadius:24, maxWidth:420, width:'100%', padding:36, textAlign:'center', boxShadow:'0 40px 100px rgba(0,0,0,0.70)', animation:'fadeUp 0.3s ease' }}>
            <div style={{ fontSize:48, marginBottom:20 }}>⚠️</div>
            <h2 style={{ fontFamily:'Playfair Display,serif', fontWeight:800, fontSize:'1.5rem', marginBottom:12, color:'white' }}>Delete &ldquo;{event.name}&rdquo;?</h2>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.9rem', lineHeight:1.7, marginBottom:28 }}>
              This will permanently delete the event, all {photosCount} uploaded photos, face recognition data, and guest match history. This cannot be undone.
            </p>
            <div style={{ display:'flex', gap:12 }}>
              <button className="btn-ghost" style={{ flex:1 }} onClick={() => setShowConfirm(false)} disabled={deleting}>Cancel</button>
              <button
                onClick={handleDeleteEvent}
                disabled={deleting}
                style={{ flex:1, background: deleting ? 'rgba(239,68,68,0.20)' : '#EF4444', border:'none', color:'white', padding:'12px 28px', borderRadius:12, fontSize:'0.95rem', fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily:'Inter,sans-serif', transition:'all 0.2s ease' }}
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
