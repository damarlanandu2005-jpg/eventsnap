import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ALL_PACKS, ADDONS, TRIAL } from '@/lib/pricing';

// ── Mini Chart ────────────────────────────────────────────────
function MiniChart() {
  const DATA = [42,61,55,78,91,83,104,117,99,128,142,138];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const max = Math.max(...DATA), min = Math.min(...DATA);
  const w = 100, h = 100;
  const pts = DATA.map((v,i) => [(i/(DATA.length-1))*w, h - ((v-min)/(max-min))*h*0.85]);
  const line = pts.map((p,i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = line + ` L${w},${h} L0,${h} Z`;
  return (
    <div className="card" style={{ padding:'24px 28px', marginBottom:24 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Guests Matched</p>
          <p style={{ fontFamily:'DM Mono,monospace', fontSize:'1.8rem', fontWeight:500 }} className="gold-text">2,419</p>
          <p style={{ fontSize:'0.78rem', color:'var(--color-success)', marginTop:4 }}>↑ 23% vs last month</p>
        </div>
      </div>
      <div style={{ height:120, position:'relative', marginTop:20 }}>
        <svg style={{ width:'100%', height:'100%', overflow:'visible' }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(240,192,96,0.30)"/>
              <stop offset="100%" stopColor="rgba(240,192,96,0)"/>
            </linearGradient>
          </defs>
          <path d={area} fill="url(#cg)"/>
          <path d={line} fill="none" stroke="#F0C060" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
          {pts.map(([x,y],i) => <circle key={i} cx={x} cy={y} r="2" fill="#F0C060" vectorEffect="non-scaling-stroke"/>)}
        </svg>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, flexWrap:'nowrap', overflow:'hidden' }}>
          {MONTHS.map(m => <span key={m} style={{ fontSize:'0.58rem', color:'var(--text-muted)', fontFamily:'DM Mono,monospace' }}>{m}</span>)}
        </div>
      </div>
    </div>
  );
}

// ── Create Event Modal ────────────────────────────────────────
function CreateEventModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (!name.trim()) return;
    setCreating(true); setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch('/api/photographer/events', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` },
        body: JSON.stringify({ name:name.trim(), slug:slug||name.toLowerCase().replace(/[^a-z0-9]/g,'-'), event_date:date||null }),
      });
      const data = await res.json();
      if (res.ok) { onCreate(data); }
      else { setError(data.error||'Failed to create event'); setCreating(false); }
    } catch { setError('Network error.'); setCreating(false); }
  };

  return (
    <div style={{ position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:'#13101E',border:'1px solid rgba(255,220,150,0.14)',borderRadius:24,maxWidth:440,width:'100%',padding:'32px 24px',boxShadow:'0 40px 100px rgba(0,0,0,0.70)',position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute',top:16,right:16,width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.10)',color:'rgba(255,255,255,0.40)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        <h2 style={{ fontFamily:'Playfair Display,serif',fontWeight:800,fontSize:'1.6rem',marginBottom:8,background:'linear-gradient(135deg,#F0C060,#F7D98A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>Create Event</h2>
        <p style={{ color:'rgba(255,255,255,0.40)',fontSize:'0.85rem',marginBottom:24 }}>QR code + guest link generated instantly</p>
        {error && <p style={{ color:'#F87171',fontSize:'0.85rem',marginBottom:16 }}>{error}</p>}
        <div style={{ marginBottom:16 }}>
          <label style={labelStyle}>Event name *</label>
          <input className="input-field" placeholder="e.g. Sharma Wedding" value={name}
            onChange={e => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g,'-')); }}
            onKeyDown={e => e.key==='Enter' && handle()} />
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={labelStyle}>URL Slug</label>
          <input className="input-field" placeholder="sharma-wedding" value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-'))} />
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={labelStyle}>Event date <span style={{ color:'rgba(255,255,255,0.25)',fontWeight:400 }}>(optional)</span></label>
          <input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ colorScheme:'dark' }} />
        </div>
        <button className="btn-primary" onClick={handle} disabled={!name.trim()||creating} style={{ width:'100%',padding:'14px',opacity:!name.trim()?0.45:1,cursor:!name.trim()?'not-allowed':'pointer' }}>
          {creating ? 'Creating…' : 'Create event & get QR →'}
        </button>
      </div>
    </div>
  );
}

const labelStyle = { display:'block',fontSize:'0.72rem',fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase',color:'rgba(255,255,255,0.40)',marginBottom:8,fontFamily:'Inter,sans-serif' };

// ── Share Modal ───────────────────────────────────────────────
function ShareModal({ event, onClose }) {
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin + '/event/' : 'https://eventsnap.in/event/';
  const eventUrl = baseUrl + event.slug;
  const copyLink = () => {
    navigator.clipboard.writeText(eventUrl).catch(()=>{});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:'#13101E',border:'1px solid rgba(255,220,150,0.14)',borderRadius:24,maxWidth:460,width:'100%',padding:'28px 24px',position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute',top:16,right:16,width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.10)',color:'rgba(255,255,255,0.40)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        <h2 style={{ fontFamily:'Playfair Display,serif',fontWeight:800,fontSize:'1.5rem',marginBottom:4 }} className="gold-text">Share — {event.name}</h2>
        <p style={{ color:'rgba(255,255,255,0.40)',fontSize:'0.82rem',marginBottom:20 }}>Share the event link with your guests</p>
        <div style={{ display:'flex',gap:0,marginBottom:20 }}>
          <div style={{ flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:'12px 0 0 12px',padding:'12px 14px',fontFamily:'DM Mono,monospace',fontSize:'0.78rem',color:'rgba(255,255,255,0.60)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{eventUrl}</div>
          <button onClick={copyLink} style={{ background:copied?'rgba(74,222,128,0.15)':'linear-gradient(135deg,#E8A830,#F0C060)',border:copied?'1px solid rgba(74,222,128,0.40)':'none',borderRadius:'0 12px 12px 0',padding:'12px 18px',color:copied?'#4ADE80':'#0D0A14',fontWeight:700,fontSize:'0.85rem',cursor:'pointer',whiteSpace:'nowrap',transition:'all 0.25s' }}>
            {copied?'✓ Copied!':'Copy'}
          </button>
        </div>
        <button className="btn-ghost" style={{ width:'100%' }} onClick={() => window.open(`/event/${event.slug}`,'_blank')}>👁 Preview guest page</button>
      </div>
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────
function SettingsPanel({ user }) {
  const [form, setForm] = useState({ fullName:user?.user_metadata?.full_name||'', studioName:user?.user_metadata?.studio_name||'', phone:user?.user_metadata?.phone||'', city:user?.user_metadata?.city||'' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name:form.fullName, studio_name:form.studioName, phone:form.phone, city:form.city } });
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(()=>setSaved(false),2500); }
  };

  return (
    <div style={{ padding:'0 0 80px' }}>
      <h2 style={{ fontFamily:'Playfair Display,serif',fontWeight:800,fontSize:'1.6rem',marginBottom:8 }} className="gold-text">Settings</h2>
      <p style={{ color:'rgba(255,255,255,0.50)',fontSize:'0.88rem',marginBottom:28 }}>Manage your profile and account preferences.</p>

      <div className="card" style={{ padding:'24px',marginBottom:20 }}>
        <h3 style={{ fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.1rem',marginBottom:20 }}>Profile Information</h3>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,marginBottom:16 }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input className="input-field" type="text" value={form.fullName} placeholder="Your name" onChange={e=>setForm({...form,fullName:e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Studio Name</label>
            <input className="input-field" type="text" value={form.studioName} placeholder="Your studio" onChange={e=>setForm({...form,studioName:e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input className="input-field" type="text" value={form.phone} placeholder="+91 98765 43210" onChange={e=>setForm({...form,phone:e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input className="input-field" type="text" value={form.city} placeholder="Your city" onChange={e=>setForm({...form,city:e.target.value})} />
          </div>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={labelStyle}>Email Address</label>
          <input className="input-field" type="email" value={user?.email||''} disabled style={{ opacity:0.5,cursor:'not-allowed' }} />
          <p style={{ color:'rgba(255,255,255,0.30)',fontSize:'0.72rem',marginTop:6 }}>Email cannot be changed. Contact support if needed.</p>
        </div>
        <div style={{ height:1,background:'linear-gradient(90deg,transparent,rgba(240,192,96,0.25),transparent)',margin:'20px 0' }} />
        <button onClick={handleSave} disabled={saving} style={{ display:'inline-flex',alignItems:'center',gap:8,background:'linear-gradient(135deg,#E8A830,#F0C060,#F7D98A)',color:'#0D0A14',fontWeight:700,fontFamily:'Inter,sans-serif',fontSize:'0.95rem',border:'none',borderRadius:12,padding:'12px 28px',cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1 }}>
          {saving?'Saving…':saved?'✓ Saved!':'Save Changes'}
        </button>
      </div>

      <div className="card" style={{ padding:'24px',marginBottom:20 }}>
        <h3 style={{ fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.1rem',marginBottom:8 }}>Security</h3>
        <p style={{ color:'rgba(255,255,255,0.50)',fontSize:'0.88rem',marginBottom:16,lineHeight:1.6 }}>Change your password by requesting a reset email.</p>
        <button onClick={async()=>{await supabase.auth.resetPasswordForEmail(user.email,{redirectTo:`${window.location.origin}/auth/callback`});alert('Password reset email sent!');}}
          style={{ background:'transparent',border:'1px solid rgba(240,192,96,0.30)',color:'#F0C060',fontFamily:'Inter,sans-serif',fontWeight:600,fontSize:'0.88rem',borderRadius:12,padding:'11px 22px',cursor:'pointer' }}>
          Send Password Reset Email
        </button>
      </div>

      <div className="card" style={{ padding:'24px',border:'1px solid rgba(248,113,113,0.15)' }}>
        <h3 style={{ fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.1rem',marginBottom:8,color:'#F87171' }}>Danger Zone</h3>
        <p style={{ color:'rgba(255,255,255,0.45)',fontSize:'0.88rem',marginBottom:16,lineHeight:1.6 }}>Permanently delete your account. This cannot be undone.</p>
        <button onClick={()=>alert('Please contact support@eventsnap.in to delete your account.')}
          style={{ background:'rgba(239,68,68,0.10)',border:'1px solid rgba(239,68,68,0.25)',color:'#F87171',fontFamily:'Inter,sans-serif',fontWeight:600,fontSize:'0.88rem',borderRadius:12,padding:'11px 22px',cursor:'pointer' }}>
          Delete Account
        </button>
      </div>
    </div>
  );
}

// ── Billing Panel ─────────────────────────────────────────────
function BillingPanel() {
  return (
    <div style={{ padding:'0 0 80px' }}>
      <h2 style={{ fontFamily:'Playfair Display,serif',fontWeight:800,fontSize:'1.6rem',marginBottom:8 }} className="gold-text">Billing</h2>
      <p style={{ color:'rgba(255,255,255,0.50)',fontSize:'0.88rem',marginBottom:28 }}>One-time event packs. No subscriptions. Packs never expire.</p>

      <div className="card" style={{ padding:'24px',border:'1px solid rgba(240,192,96,0.15)',marginBottom:24 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:16 }}>
          <div>
            <span className="badge badge-gold" style={{ marginBottom:12 }}>Active plan</span>
            <h3 style={{ fontSize:'1.4rem',fontWeight:700,marginTop:8 }}>Free Trial</h3>
            <p style={{ color:'rgba(255,255,255,0.60)',fontSize:'0.85rem',marginTop:6,lineHeight:1.6 }}>
              {TRIAL.events} event · {TRIAL.photos} photos · {TRIAL.guestScans} guest scans · {TRIAL.fileLimitMB} MB file limit · RAW supported.
            </p>
          </div>
          <a href="#packs" className="btn-primary" style={{ width:'auto',padding:'10px 20px',textDecoration:'none' }}>Choose a pack</a>
        </div>
      </div>

      <div id="packs" style={{ marginBottom:32 }}>
        <h3 style={{ fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.15rem',marginBottom:6 }}>Event packs</h3>
        <p style={{ color:'rgba(255,255,255,0.50)',fontSize:'0.82rem',marginBottom:16 }}>Buy once, use any time. All packs include RAW & 50 MB files.</p>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))',gap:14 }}>
          {ALL_PACKS.map((pack) => (
            <div key={pack.id} className="card" style={{ padding:'20px',display:'flex',flexDirection:'column',position:'relative',border: pack.badge ? '1px solid rgba(74,222,128,0.35)' : undefined }}>
              {pack.badge && (
                <span style={{ position:'absolute',top:-10,left:16,background:'#4ADE80',color:'#0D0A14',fontSize:'0.65rem',fontWeight:700,padding:'3px 10px',borderRadius:10,textTransform:'uppercase',letterSpacing:'0.05em' }}>{pack.badge}</span>
              )}
              <h4 style={{ fontSize:'1rem',fontWeight:700,marginBottom:6 }}>{pack.name}</h4>
              <p style={{ color:'rgba(255,255,255,0.50)',fontSize:'0.78rem',lineHeight:1.5,marginBottom:14,minHeight:34 }}>{pack.tagline}</p>
              <div style={{ marginBottom:14 }}>
                <span style={{ fontFamily:'DM Mono,monospace',fontSize:'1.5rem',fontWeight:500 }}>{pack.priceLabel}</span>
              </div>
              <ul style={{ listStyle:'none',padding:0,margin:'0 0 16px',display:'flex',flexDirection:'column',gap:6,flex:1 }}>
                <li style={{ fontSize:'0.78rem',color:'rgba(255,255,255,0.65)' }}>✓ {pack.events} event{pack.events>1?'s':''}</li>
                <li style={{ fontSize:'0.78rem',color:'rgba(255,255,255,0.65)' }}>✓ {(pack.photosPerEvent || pack.photos).toLocaleString('en-IN')} photos{pack.events>1?'/event':''}</li>
                <li style={{ fontSize:'0.78rem',color:'rgba(255,255,255,0.65)' }}>✓ {(pack.guestScansPerEvent || pack.guestScans).toLocaleString('en-IN')} guest scans{pack.events>1?'/event':''}</li>
                <li style={{ fontSize:'0.78rem',color:'rgba(255,255,255,0.65)' }}>✓ {pack.fileLimitMB} MB file limit · RAW</li>
              </ul>
              <button className="btn-primary" style={{ width:'100%',padding:'10px',fontSize:'0.85rem' }}>{pack.cta}</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:24 }}>
        <h3 style={{ fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.15rem',marginBottom:6 }}>Add-ons</h3>
        <p style={{ color:'rgba(255,255,255,0.50)',fontSize:'0.82rem',marginBottom:16 }}>Stack on top of any active pack.</p>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))',gap:14 }}>
          {ADDONS.map((a) => (
            <div key={a.id} className="card" style={{ padding:'20px',display:'flex',flexDirection:'column' }}>
              <h4 style={{ fontSize:'1rem',fontWeight:700,marginBottom:6 }}>{a.name}</h4>
              <p style={{ color:'rgba(255,255,255,0.55)',fontSize:'0.82rem',lineHeight:1.55,marginBottom:14,flex:1 }}>{a.description}</p>
              <div style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12 }}>
                <div>
                  <span style={{ fontFamily:'DM Mono,monospace',fontSize:'1.35rem',fontWeight:500 }}>{a.priceLabel}</span>
                  <span style={{ color:'rgba(255,255,255,0.45)',fontSize:'0.82rem' }}> {a.unitLabel}</span>
                </div>
                <button className="btn-ghost" style={{ padding:'8px 14px',fontSize:'0.82rem',borderColor:'rgba(255,255,255,0.2)',color:'#fff' }}>Add</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding:'20px' }}>
        <h3 style={{ fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1rem',marginBottom:8 }}>Billing history</h3>
        <p style={{ color:'rgba(255,255,255,0.50)',fontSize:'0.82rem',lineHeight:1.6 }}>Once you make your first purchase, your invoices will appear here.</p>
      </div>
    </div>
  );
}

// ── Delete Event Modal ────────────────────────────────────────
function DeleteEventModal({ event, onClose, onConfirm, deleting }) {
  return (
    <div style={{ position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.80)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={e => { if(e.target===e.currentTarget && !deleting) onClose(); }}>
      <div style={{ background:'#13101E',border:'1px solid rgba(239,68,68,0.20)',borderRadius:24,maxWidth:420,width:'100%',padding:'32px 24px',boxShadow:'0 40px 100px rgba(0,0,0,0.70)',position:'relative' }}>
        <button onClick={onClose} disabled={deleting} style={{ position:'absolute',top:16,right:16,width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.10)',color:'rgba(255,255,255,0.40)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        <div style={{ fontSize:36,marginBottom:14 }}>🗑️</div>
        <h2 style={{ fontFamily:'Playfair Display,serif',fontWeight:800,fontSize:'1.4rem',marginBottom:8,color:'#F87171' }}>Delete Event</h2>
        <p style={{ color:'rgba(255,255,255,0.55)',fontSize:'0.88rem',marginBottom:10,lineHeight:1.6 }}>You are permanently deleting:</p>
        <p style={{ fontWeight:700,fontSize:'1.05rem',color:'white',marginBottom:20 }}>"{event.name}"</p>
        <div style={{ padding:'12px 14px',background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.18)',borderRadius:10,marginBottom:24 }}>
          <p style={{ color:'rgba(255,255,255,0.50)',fontSize:'0.80rem',lineHeight:1.6 }}>⚠ All photos, face embeddings, and match history for this event will be permanently deleted. This cannot be undone.</p>
        </div>
        <div style={{ display:'flex',gap:12 }}>
          <button onClick={onClose} disabled={deleting} style={{ flex:1,padding:'13px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.80)',borderRadius:12,fontWeight:600,fontSize:'0.9rem',cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{ flex:1,padding:'13px',background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.40)',color:'#F87171',borderRadius:12,fontWeight:700,fontSize:'0.9rem',cursor:deleting?'not-allowed':'pointer',fontFamily:'Inter,sans-serif',opacity:deleting?0.6:1 }}>
            {deleting ? 'Deleting…' : 'Delete Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Panel ─────────────────────────────────────────────

function UploadPanel({ events, selectedEventId }) {
  const [eventId, setEventId] = useState(selectedEventId || '');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  // Sync when parent navigates to a specific event (e.g. clicking → in Events tab)
  useEffect(() => {
    if (selectedEventId) setEventId(selectedEventId);
  }, [selectedEventId]);

  const selectedEvent = events.find(ev => ev.id === eventId) || null;

  // Keep window.__APP_BUSY__ in sync with whether the user has work
  // in flight (files staged OR an upload running). _app.js reads this
  // flag and refuses to auto-reload while it's true, which prevents
  // the file-picker visibilitychange from yanking files out from
  // under the user.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__APP_BUSY__ = files.length > 0 || uploading;
    return () => { window.__APP_BUSY__ = false; };
  }, [files.length, uploading]);

  const handleFileChange = (e) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  // Direct-to-storage upload pipeline.
  //
  //   1. Ask /api/photographer/get-upload-url for N signed Supabase
  //      Storage upload URLs (cheap server work — no bytes touched).
  //   2. Upload each file directly to its signed URL with bounded
  //      concurrency (auto-throttled per device — desktops get more
  //      parallel slots than phones).
  //   3. Confirm the batch via /api/photographer/confirm-upload so the
  //      event_photos rows + processing queue rows are written.
  //
  // This bypasses the Vercel function for the actual byte transfer,
  // so 500+ photos no longer hit the 4.5MB body / 60s timeout limits.
  const handleUpload = async () => {
    if (!selectedEvent) return setError('Please select an event before uploading');
    if (!files.length) return setError('Please select photos');

    const targetEventId = selectedEvent.id;
    const targetEventName = selectedEvent.name;

    // Auto-throttle: phones get fewer parallel sockets than desktops.
    // navigator.connection?.effectiveType is "4g" / "3g" / "2g" — fall
    // back to user-agent sniff for older browsers.
    const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
    const slowConn = navigator.connection?.effectiveType && /2g|3g/.test(navigator.connection.effectiveType);
    const UPLOAD_CONCURRENCY = slowConn ? 2 : (isMobile ? 4 : 8);
    const PRESIGN_BATCH = 100;       // sign 100 URLs per server call
    const CONFIRM_BATCH = 100;       // confirm 100 uploads per server call

    setError(''); setResult(''); setUploading(true);

    let totalUploaded = 0;
    let totalFailed = 0;
    const totalFiles = files.length;
    let completed = 0;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Walk the file list in slices of PRESIGN_BATCH so the presign
      // and confirm payloads stay reasonable on any device.
      for (let i = 0; i < files.length; i += PRESIGN_BATCH) {
        const slice = files.slice(i, i + PRESIGN_BATCH);

        setProgress(`Preparing ${slice.length} of ${totalFiles - i} remaining…`);

        // Step 1 — get signed upload URLs for this slice.
        const presignRes = await fetch('/api/photographer/get-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            eventId: targetEventId,
            files: slice.map((f) => ({
              filename: f.name,
              contentType: f.type || 'application/octet-stream',
              fileSizeBytes: f.size,
            })),
          }),
        });

        if (!presignRes.ok) {
          const errData = await presignRes.json().catch(() => null);
          throw new Error(errData?.error || `Could not get upload URLs (HTTP ${presignRes.status})`);
        }

        const { uploads } = await presignRes.json();
        if (!Array.isArray(uploads) || uploads.length !== slice.length) {
          throw new Error('Upload URL response was malformed');
        }

        // Step 2 — upload each file directly to its signed URL with
        // bounded concurrency. Failures per-file are tracked, not fatal.
        const successfulUploads = [];

        let cursor = 0;
        async function uploadWorker() {
          while (cursor < slice.length) {
            const idx = cursor++;
            const file = slice[idx];
            const slot = uploads[idx];
            try {
              const putRes = await fetch(slot.signedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
                body: file,
              });
              if (!putRes.ok) throw new Error(`HTTP ${putRes.status}`);
              successfulUploads.push({
                photoId: slot.photoId,
                eventId: targetEventId,
                storagePath: slot.storagePath,
                originalFilename: file.name,
                fileSizeBytes: file.size,
                uploadSource: 'supabase',
              });
            } catch (uploadErr) {
              console.error('Direct upload failed for', file.name, uploadErr);
              totalFailed++;
            } finally {
              completed++;
              setProgress(`Uploading ${completed} of ${totalFiles} to "${targetEventName}"…`);
            }
          }
        }

        await Promise.all(
          Array.from({ length: Math.min(UPLOAD_CONCURRENCY, slice.length) }, uploadWorker)
        );

        // Step 3 — confirm successful uploads (in chunks if needed).
        for (let j = 0; j < successfulUploads.length; j += CONFIRM_BATCH) {
          const confirmSlice = successfulUploads.slice(j, j + CONFIRM_BATCH);
          const confirmRes = await fetch('/api/photographer/confirm-upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ uploads: confirmSlice }),
          });
          if (!confirmRes.ok) {
            const errData = await confirmRes.json().catch(() => null);
            console.error('Confirm batch failed:', errData?.error);
            // Don't throw — files are already in storage. Surface a soft
            // warning at the end and let the user retry the failed ones.
            totalFailed += confirmSlice.length;
            continue;
          }
          totalUploaded += confirmSlice.length;
        }
      }

      const failMsg = totalFailed ? ` (${totalFailed} failed — please retry those)` : '';
      setResult(`Uploaded ${totalUploaded} photo(s) to "${targetEventName}"${failMsg}. AI face indexing is running in the background.`);
      setFiles([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  return (
    <div style={{ padding:'0 0 80px' }}>
      <h2 style={{ fontFamily:'Playfair Display,serif',fontWeight:800,fontSize:'1.6rem',marginBottom:8 }} className="gold-text">Upload Photos</h2>
      <p style={{ color:'rgba(255,255,255,0.50)',fontSize:'0.88rem',marginBottom:28 }}>Add photos to an event for AI matching.</p>

      <div className="card" style={{ padding:'24px',marginBottom:20 }}>
        {error && <p style={{ color:'#F87171',fontSize:'0.85rem',marginBottom:16 }}>{error}</p>}
        {result && <p style={{ color:'#4ADE80',fontSize:'0.85rem',marginBottom:16 }}>{result}</p>}
        {progress && <p style={{ color:'var(--color-gold)',fontSize:'0.85rem',marginBottom:16 }}>{progress}</p>}

        <div style={{ marginBottom:20 }}>
          <label style={labelStyle}>Upload to Event *</label>
          <select className="input-field" value={eventId} onChange={e=>{ setEventId(e.target.value); setFiles([]); setError(''); setResult(''); }} style={{ colorScheme:'dark', width:'100%' }}>
            <option value="">— Select an event —</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          {selectedEvent ? (
            <div style={{ marginTop:10,padding:'10px 14px',background:'rgba(240,192,96,0.07)',border:'1px solid rgba(240,192,96,0.25)',borderRadius:10,display:'flex',alignItems:'center',gap:8 }}>
              <span>🎪</span>
              <div>
                <p style={{ fontSize:'0.82rem',fontWeight:700,color:'var(--color-gold)' }}>{selectedEvent.name}</p>
                <p style={{ fontSize:'0.70rem',color:'rgba(255,255,255,0.40)',marginTop:1 }}>Photos will be added to this event</p>
              </div>
            </div>
          ) : (
            <p style={{ fontSize:'0.75rem',color:'rgba(255,255,255,0.35)',marginTop:8 }}>⚠ Select an event to enable upload.</p>
          )}
        </div>

        <div style={{ marginBottom:24 }}>
          <label style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',border:`2px dashed ${selectedEvent?'rgba(240,192,96,0.30)':'rgba(255,255,255,0.08)'}`,borderRadius:16,padding:'40px 20px',cursor:selectedEvent?'pointer':'not-allowed',background:'rgba(255,255,255,0.02)',opacity:selectedEvent?1:0.5 }}>
            <div style={{ fontSize:32,marginBottom:12 }}>📷</div>
            <span style={{ fontWeight:600,color:'var(--text-primary)' }}>Tap to select from album</span>
            <span style={{ fontSize:'0.75rem',color:'var(--text-muted)',marginTop:4 }}>{files.length > 0 ? `${files.length} photos selected` : 'Choose any number — uploads run in parallel'}</span>
            <input type="file" accept="image/*,.cr2,.cr3,.crw,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.rw2,.orf,.pef,.srw,.rwl,.dcr,.kdc,.x3f,.mrw,.3fr,.iiq,.heic,.heif" multiple onChange={handleFileChange} disabled={!selectedEvent} style={{ display:'none' }} />
          </label>
        </div>

        <button
          className="btn-primary"
          onClick={handleUpload}
          disabled={uploading || !files.length || !selectedEvent}
          style={{ width:'100%',padding:'14px',opacity:(uploading || !files.length || !selectedEvent)?0.45:1,cursor:(uploading || !files.length || !selectedEvent)?'not-allowed':'pointer' }}
        >
          {uploading
            ? (progress || 'Uploading...')
            : selectedEvent && files.length
              ? `Upload ${files.length} Photo${files.length===1?'':'s'} to "${selectedEvent.name}" 📤`
              : 'Upload Photos 📤'}
        </button>
      </div>
    </div>
  );
}

// ── Events Panel ──────────────────────────────────────────────
function EventsPanel({ events, onShare, onCreateEvent, onUpload, onDeleteEvent }) {
  if (events.length === 0) {
    return (
      <div style={{ padding:'0 0 80px' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12 }}>
          <h2 style={{ fontFamily:'Playfair Display,serif',fontWeight:800,fontSize:'1.6rem' }} className="gold-text">My Events</h2>
          <button className="btn-primary" style={{ width:'auto',padding:'10px 20px',fontSize:'0.88rem' }} onClick={onCreateEvent}>+ New Event</button>
        </div>
        <div className="card" style={{ padding:40,textAlign:'center' }}>
          <div style={{ fontSize:40,marginBottom:16 }}>🎪</div>
          <p style={{ color:'var(--text-primary)',fontWeight:600,marginBottom:4 }}>No events yet</p>
          <p style={{ color:'var(--text-muted)',fontSize:'0.85rem',marginBottom:20 }}>Create your first event to start uploading photos</p>
          <button className="btn-primary" style={{ width:'auto',padding:'12px 24px' }} onClick={onCreateEvent}>Create First Event →</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding:'0 0 80px' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12 }}>
        <h2 style={{ fontFamily:'Playfair Display,serif',fontWeight:800,fontSize:'1.6rem' }} className="gold-text">My Events</h2>
        <button className="btn-primary" style={{ width:'auto',padding:'10px 20px',fontSize:'0.88rem' }} onClick={onCreateEvent}>+ New Event</button>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
        {events.map(ev => {
          const photosCount = ev.event_photos?.[0]?.count || 0;
          return (
            <div key={ev.id} className="card" style={{ padding:'16px 20px',display:'flex',alignItems:'center',gap:16 }}>
              <div style={{ width:44,height:44,borderRadius:10,overflow:'hidden',flexShrink:0,background:'rgba(124,58,237,0.2)' }}>
                <img src={`https://picsum.photos/seed/${ev.id}/80/80`} alt="" style={{ width:'100%',height:'100%',objectFit:'cover',filter:'brightness(0.7)' }} />
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontWeight:600,fontSize:'0.92rem',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{ev.name}</p>
                <p style={{ fontFamily:'DM Mono,monospace',fontSize:'0.72rem',color:'var(--text-muted)' }}>/{ev.slug} · {photosCount} photos</p>
              </div>
              <div style={{ display:'flex',gap:8,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end' }}>
                <span className={`badge ${ev.is_active?'badge-active':'badge-muted'}`} style={{ fontSize:'0.62rem' }}>{ev.is_active?'● Live':'○'}</span>
                <button onClick={()=>onShare(ev)} style={{ background:'rgba(240,192,96,0.10)',border:'1px solid rgba(240,192,96,0.25)',color:'#F0C060',borderRadius:8,padding:'6px 12px',fontSize:'0.75rem',fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Share</button>
                <button onClick={()=>onUpload(ev.id)} style={{ background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.10)',color:'white',borderRadius:8,padding:'6px 12px',fontSize:'0.75rem',fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center' }}>Upload</button>
                <button onClick={()=>onDeleteEvent(ev)} style={{ background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.22)',color:'#F87171',borderRadius:8,padding:'6px 12px',fontSize:'0.75rem',fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function PhotographerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [selectedUploadEvent, setSelectedUploadEvent] = useState(null);
  const [toast, setToast] = useState(null);
  const [shareEvent, setShareEvent] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [usage, setUsage] = useState(null);
  const [deleteEvent, setDeleteEvent] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 3000); };

  const totalPhotos = useMemo(() => events.reduce((a,ev)=>a+(ev.event_photos?.[0]?.count||0),0), [events]);

  const stats = useMemo(() => [
    { label:'Total Events', value:events.length.toString(), dir:'up', trend:'this month' },
    { label:'Photos Uploaded', value:totalPhotos.toLocaleString(), dir:'up', trend:'total' },
    { label:'Guests Matched', value:Math.floor(totalPhotos*1.5).toLocaleString(), dir:'up', trend:'AI matches' },
    { label:'Downloads', value:Math.floor(totalPhotos*2.8).toLocaleString(), dir:'up', trend:'photos saved' },
  ], [events, totalPhotos]);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    try {
      const { data:{ session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth/login'); return; }
      setUser(session.user);
      await fetchEvents(session.access_token);
      fetchUsage(session.access_token);
    } catch { router.push('/auth/login'); }
    finally { setLoading(false); }
  }

  async function fetchEvents(token) {
    const res = await fetch('/api/photographer/events', { headers:{ Authorization:`Bearer ${token}` } });
    if (res.ok) setEvents(await res.json());
  }

  async function fetchUsage(token) {
    try {
      const res = await fetch('/api/photographer/usage', { headers:{ Authorization:`Bearer ${token}` } });
      if (res.ok) setUsage(await res.json());
    } catch {}
  }

  async function handleDeleteEvent() {
    if (!deleteEvent) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch('/api/photographer/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ eventId: deleteEvent.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== deleteEvent.id));
        showToast(`"${deleteEvent.name}" deleted`);
        setDeleteEvent(null);
      } else {
        showToast('Delete failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      showToast('Delete failed: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div style={{ position:'fixed',inset:0,background:'#0D0A14',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16 }}>
        <div style={{ width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#7C3AED,#E8A830)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,color:'white',fontWeight:700 }}>✦</div>
        <div style={{ width:28,height:28,border:'2px solid rgba(240,192,96,0.20)',borderTopColor:'#F0C060',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Photographer';
  const userInitials = (userName.charAt(0)||'P').toUpperCase();

  const navItems = [
    { id:'dashboard', icon:'📊', label:'Dashboard' },
    { id:'events',    icon:'🎪', label:'Events' },
    { id:'upload',    icon:'📤', label:'Upload' },
    { id:'billing',   icon:'💳', label:'Billing' },
    { id:'settings',  icon:'⚙️',  label:'Settings' },
  ];

  return (
    <>
      <Head>
        <title>Dashboard — EventSnap</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0D0A14; color: rgba(255,255,255,0.95); font-family: 'Inter',sans-serif; overflow-x: hidden; }
          @keyframes spin { to{transform:rotate(360deg)} }
          @keyframes fade-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

          /* DESKTOP LAYOUT */
          .dash-layout { display: flex; min-height: 100vh; }

          /* SIDEBAR — desktop only */
          .sidebar {
            width: 240px; flex-shrink: 0;
            background: rgba(255,255,255,0.025);
            border-right: 1px solid rgba(255,220,150,0.08);
            display: flex; flex-direction: column;
            position: fixed; top: 0; left: 0; bottom: 0;
            z-index: 40; overflow-y: auto;
          }
          .sidebar-top { padding: 24px 20px 16px; border-bottom: 1px solid rgba(255,220,150,0.08); }
          .sidebar-nav { flex: 1; padding: 12px 10px; }
          .sidebar-nav-item {
            display: flex; align-items: center; gap: 12px;
            padding: 11px 14px; border-radius: 12px; margin-bottom: 2px;
            cursor: pointer; font-size: 0.88rem; font-weight: 500;
            color: rgba(255,255,255,0.55); text-decoration: none;
            transition: all 0.2s; border: none; background: none;
            width: 100%; font-family: 'Inter',sans-serif;
          }
          .sidebar-nav-item:hover { background: rgba(255,255,255,0.04); color: white; }
          .sidebar-nav-item.active { background: rgba(240,192,96,0.08); color: #F0C060; }
          .sidebar-bottom { padding: 16px 20px; border-top: 1px solid rgba(255,220,150,0.08); }

          /* MAIN CONTENT */
          .dash-main { margin-left: 240px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
          .dash-header {
            padding: 24px 32px 20px; border-bottom: 1px solid rgba(255,220,150,0.08);
            display: flex; align-items: flex-start; justify-content: space-between;
            position: sticky; top: 0; z-index: 20;
            background: rgba(13,10,20,0.90); backdrop-filter: blur(12px);
          }
          .dash-content { padding: 28px 32px; flex: 1; }
          .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 24px; }
          .stat-card { padding: 20px 22px; }
          .quick-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; margin-bottom: 28px; }

          /* BOTTOM NAV — mobile only */
          .bottom-nav {
            display: none;
            position: fixed; bottom: 0; left: 0; right: 0;
            background: rgba(13,10,20,0.96); backdrop-filter: blur(16px);
            border-top: 1px solid rgba(255,220,150,0.10);
            padding: 10px 8px; z-index: 100;
            padding-bottom: calc(10px + env(safe-area-inset-bottom));
          }
          .bottom-nav-inner { display: flex; justify-content: space-around; align-items: center; }
          .bottom-nav-btn {
            display: flex; flex-direction: column; align-items: center; gap: 4px;
            padding: 4px 12px; border-radius: 10px; cursor: pointer;
            border: none; background: none; color: rgba(255,255,255,0.45);
            font-family: 'Inter',sans-serif; transition: all 0.2s;
            font-size: 0.58rem; font-weight: 600; min-width: 44px;
          }
          .bottom-nav-btn.active { color: #F0C060; }
          .bottom-nav-btn .nav-icon-wrap {
            width: 36px; height: 36px; border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.1rem; transition: all 0.2s;
          }
          .bottom-nav-btn.active .nav-icon-wrap {
            background: rgba(240,192,96,0.12);
            border: 1px solid rgba(240,192,96,0.25);
          }

          /* MOBILE top header */
          .mobile-header {
            display: none;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255,220,150,0.08);
            background: rgba(13,10,20,0.90); backdrop-filter: blur(12px);
            position: sticky; top: 0; z-index: 20;
            align-items: center; justify-content: space-between;
          }

          /* RESPONSIVE BREAKPOINTS */
          @media (max-width: 768px) {
            .sidebar { display: none !important; }
            .dash-main { margin-left: 0 !important; padding-bottom: 80px; }
            .dash-header { display: none !important; }
            .mobile-header { display: flex !important; }
            .dash-content { padding: 16px !important; }
            .bottom-nav { display: block !important; }
            .stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 10px !important; }
            .stat-card { padding: 14px 16px !important; }
            .quick-grid { grid-template-columns: 1fr !important; }
          }

          @media (max-width: 480px) {
            .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          }

          @media (min-width: 769px) and (max-width: 1024px) {
            .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
            .sidebar { width: 200px; }
            .dash-main { margin-left: 200px; }
            .dash-content { padding: 20px 24px; }
          }
        `}</style>
      </Head>

      <div className="dash-layout">

        {/* ══ SIDEBAR (desktop) ══ */}
        <aside className="sidebar">
          <div className="sidebar-top">
            <Link href="/" style={{ display:'flex',alignItems:'center',gap:8,textDecoration:'none',marginBottom:18 }}>
              <div style={{ width:30,height:30,borderRadius:8,background:'linear-gradient(135deg,#7C3AED,#E8A830)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'white',fontWeight:700 }}>✦</div>
              <span style={{ fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1rem',background:'linear-gradient(135deg,#F0C060,#F7D98A,#E8A830)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>EventSnap</span>
            </Link>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:34,height:34,borderRadius:9,background:'linear-gradient(135deg,#7C3AED,#E8A830)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.88rem',color:'white',flexShrink:0 }}>{userInitials}</div>
              <div style={{ overflow:'hidden' }}>
                <p style={{ fontWeight:600,fontSize:'0.85rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130 }}>{userName}</p>
                <span className="badge badge-gold" style={{ fontSize:'0.58rem',padding:'2px 7px' }}>✦ Pro</span>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map(item => (
              <button key={item.id} className={`sidebar-nav-item ${activeNav===item.id?'active':''}`} onClick={()=>setActiveNav(item.id)}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
            <div style={{ height:1,background:'rgba(255,220,150,0.08)',margin:'12px 4px' }} />
            <button className="sidebar-nav-item" onClick={handleLogout}>
              <span>🚪</span>Logout
            </button>
          </nav>

          <div className="sidebar-bottom">
            {usage ? (
              <>
                <div style={{ marginBottom:10 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                    <span style={{ fontSize:'0.68rem',color:'var(--text-muted)' }}>Photos</span>
                    <span style={{ fontFamily:'DM Mono,monospace',fontSize:'0.66rem',color:'var(--color-gold)' }}>{usage.photos_used}/{usage.photos_limit}</span>
                  </div>
                  <div style={{ height:4,background:'rgba(255,255,255,0.08)',borderRadius:2,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${Math.min(100,usage.photos_pct)}%`,background:'linear-gradient(90deg,#7C3AED,#F0C060)',borderRadius:2 }} />
                  </div>
                </div>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <span style={{ fontSize:'0.68rem',color:'rgba(255,255,255,0.35)' }}>{usage.plan} plan</span>
                  <a href="/photographer/billing" style={{ fontSize:'0.68rem',color:'var(--color-gold)',textDecoration:'none',fontWeight:600 }}>Upgrade →</a>
                </div>
              </>
            ) : (
              <p style={{ color:'var(--text-muted)',fontSize:'0.72rem' }}>Loading...</p>
            )}
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <main className="dash-main">

          {/* Mobile top header */}
          <div className="mobile-header">
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <div style={{ width:28,height:28,borderRadius:7,background:'linear-gradient(135deg,#7C3AED,#E8A830)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'white',fontWeight:700 }}>✦</div>
              <span style={{ fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'0.95rem',background:'linear-gradient(135deg,#F0C060,#F7D98A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>
                {{dashboard:'Dashboard',events:'Events',upload:'Upload',billing:'Billing',settings:'Settings'}[activeNav]||'EventSnap'}
              </span>
            </div>
            <div style={{ display:'flex',gap:8,alignItems:'center' }}>
              <button className="btn-primary" style={{ padding:'8px 14px',fontSize:'0.78rem',borderRadius:10 }} onClick={()=>setShowCreate(true)}>+ Event</button>
              <div style={{ width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#7C3AED,#E8A830)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.82rem',color:'white' }}>{userInitials}</div>
            </div>
          </div>

          {/* Desktop header */}
          <div className="dash-header">
            <div>
              <h1 style={{ fontFamily:'Playfair Display,serif',fontSize:'1.6rem',fontWeight:700,letterSpacing:'-0.02em',marginBottom:3 }}>
                Good day, {userName.split(' ')[0]} 👋
              </h1>
              <p style={{ color:'var(--text-muted)',fontSize:'0.82rem' }}>
                {new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
              </p>
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button className="btn-ghost" style={{ padding:'9px 18px',fontSize:'0.85rem' }} onClick={()=>setShowCreate(true)}>+ New Event</button>
              <button className="btn-ghost" style={{ padding:'9px 18px',fontSize:'0.85rem' }} onClick={handleLogout}>Logout</button>
            </div>
          </div>

          {/* ══ CONTENT ══ */}
          <div className="dash-content">

            {/* DASHBOARD TAB */}
            {activeNav === 'dashboard' && (
              <div style={{ animation:'fade-up 0.4s ease both' }}>
                {/* Stats */}
                <div className="stats-grid">
                  {stats.map((s,i) => (
                    <div key={s.label} className="card stat-card">
                      <p style={{ fontSize:'0.70rem',color:'var(--text-muted)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10 }}>{s.label}</p>
                      <p style={{ fontFamily:'DM Mono,monospace',fontSize:'1.8rem',fontWeight:500,lineHeight:1,marginBottom:6,color:i===0||i===2?'var(--color-gold)':undefined }}>{s.value}</p>
                      <p style={{ fontSize:'0.72rem',color:'var(--color-success)' }}>↑ {s.trend}</p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                {events.length > 0 && <MiniChart />}

                {/* Quick actions */}
                <div className="quick-grid">
                  <div className="card" style={{ padding:'20px',display:'flex',alignItems:'center',gap:14,cursor:'pointer' }} onClick={()=>setShowCreate(true)}>
                    <div style={{ width:44,height:44,borderRadius:12,background:'rgba(240,192,96,0.12)',border:'1px solid rgba(240,192,96,0.20)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>🎪</div>
                    <div>
                      <p style={{ fontWeight:600,fontSize:'0.9rem',marginBottom:2 }}>Create Event</p>
                      <p style={{ color:'var(--text-muted)',fontSize:'0.78rem' }}>New event with QR code</p>
                    </div>
                  </div>
                  <div className="card" style={{ padding:'20px',display:'flex',alignItems:'center',gap:14,cursor:'pointer' }} onClick={()=>setActiveNav('upload')}>
                    <div style={{ width:44,height:44,borderRadius:12,background:'rgba(124,58,237,0.15)',border:'1px solid rgba(124,58,237,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>📤</div>
                    <div>
                      <p style={{ fontWeight:600,fontSize:'0.9rem',marginBottom:2 }}>Upload Photos</p>
                      <p style={{ color:'var(--text-muted)',fontSize:'0.78rem' }}>Add photos to an event</p>
                    </div>
                  </div>
                  <div className="card" style={{ padding:'20px',display:'flex',alignItems:'center',gap:14,cursor:'pointer' }} onClick={()=>setActiveNav('events')}>
                    <div style={{ width:44,height:44,borderRadius:12,background:'rgba(74,222,128,0.15)',border:'1px solid rgba(74,222,128,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>📋</div>
                    <div>
                      <p style={{ fontWeight:600,fontSize:'0.9rem',marginBottom:2 }}>View Events</p>
                      <p style={{ color:'var(--text-muted)',fontSize:'0.78rem' }}>Manage your events</p>
                    </div>
                  </div>
                </div>

                {/* Recent events preview */}
                {events.length > 0 && (
                  <>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
                      <p style={{ fontFamily:'Playfair Display,serif',fontSize:'1.2rem',fontWeight:700 }}>Recent Events</p>
                      <button onClick={()=>setActiveNav('events')} style={{ background:'none',border:'none',color:'var(--color-gold)',fontSize:'0.8rem',fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>View all →</button>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                      {events.slice(0,3).map(ev => {
                        const pc = ev.event_photos?.[0]?.count||0;
                        return (
                          <div key={ev.id} className="card" style={{ padding:'14px 18px',display:'flex',alignItems:'center',gap:14 }}>
                            <div style={{ width:38,height:38,borderRadius:9,overflow:'hidden',flexShrink:0,background:'rgba(124,58,237,0.2)' }}>
                              <img src={`https://picsum.photos/seed/${ev.id}/60/60`} alt="" style={{ width:'100%',height:'100%',objectFit:'cover',filter:'brightness(0.7)' }} />
                            </div>
                            <div style={{ flex:1,minWidth:0 }}>
                              <p style={{ fontWeight:600,fontSize:'0.88rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{ev.name}</p>
                              <p style={{ fontSize:'0.72rem',color:'var(--text-muted)' }}>{pc} photos</p>
                            </div>
                            <span className={`badge ${ev.is_active?'badge-active':'badge-muted'}`} style={{ fontSize:'0.60rem',flexShrink:0 }}>{ev.is_active?'● Live':'○'}</span>
                            <button onClick={()=>setDeleteEvent(ev)} style={{ background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.22)',color:'#F87171',borderRadius:8,padding:'6px 12px',fontSize:'0.75rem',fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0 }}>Delete</button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* EVENTS TAB */}
            {activeNav === 'events' && (
              <EventsPanel
                events={events}
                onShare={setShareEvent}
                onCreateEvent={()=>setShowCreate(true)}
                onUpload={(id) => { setSelectedUploadEvent(id); setActiveNav('upload'); }}
                onDeleteEvent={setDeleteEvent}
              />
            )}

            {/* UPLOAD TAB */}
            {activeNav === 'upload' && <UploadPanel events={events} selectedEventId={selectedUploadEvent} />}

            {/* BILLING TAB */}
            {activeNav === 'billing' && <BillingPanel />}

            {/* SETTINGS TAB */}
            {activeNav === 'settings' && <SettingsPanel user={user} />}

          </div>
        </main>

        {/* ══ BOTTOM NAV (mobile) ══ */}
        <div className="bottom-nav">
          <div className="bottom-nav-inner">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`bottom-nav-btn ${activeNav===item.id?'active':''}`}
                onClick={()=>setActiveNav(item.id)}
              >
                <div className="nav-icon-wrap">{item.icon}</div>
                {item.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ══ MODALS ══ */}
      {showCreate && (
        <CreateEventModal
          onClose={()=>setShowCreate(false)}
          onCreate={ev=>{ setEvents(p=>[ev,...p]); setShowCreate(false); showToast(`🎪 "${ev.name}" created!`); }}
        />
      )}
      {shareEvent && <ShareModal event={shareEvent} onClose={()=>setShareEvent(null)} />}
      {deleteEvent && (
        <DeleteEventModal
          event={deleteEvent}
          onClose={()=>{ if (!deleting) setDeleteEvent(null); }}
          onConfirm={handleDeleteEvent}
          deleting={deleting}
        />
      )}

      {/* ══ TOAST ══ */}
      {toast && (
        <div style={{ position:'fixed',top:24,right:24,zIndex:200,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(240,192,96,0.25)',borderRadius:14,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 8px 32px rgba(0,0,0,0.40)',animation:'fade-up 0.4s cubic-bezier(0.34,1.56,0.64,1)',maxWidth:320,backdropFilter:'blur(10px)' }}>
          <span style={{ fontSize:'1.1rem' }} className="gold-text">✦</span>
          <span style={{ fontSize:'0.88rem' }}>{toast}</span>
        </div>
      )}
    </>
  );
}
