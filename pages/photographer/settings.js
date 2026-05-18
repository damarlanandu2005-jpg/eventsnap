import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ fullName: '', studioName: '', phone: '', city: '' });

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return; }
      setUser(session.user);
      setForm({
        fullName: session.user.user_metadata?.full_name || '',
        studioName: session.user.user_metadata?.studio_name || '',
        phone: session.user.user_metadata?.phone || '',
        city: session.user.user_metadata?.city || '',
      });
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: form.fullName, studio_name: form.studioName, phone: form.phone, city: form.city },
    });
    setSaving(false);
    if (error) showToast(error.message, 'error');
    else showToast('Settings saved successfully!');
  };

  const handlePasswordChange = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) showToast(error.message, 'error');
    else showToast('Password reset email sent!');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure? This will permanently delete your account and all events.')) return;
    showToast('Please contact support to delete your account.', 'error');
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0D0A14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2px solid rgba(240,192,96,0.2)', borderTopColor: '#F0C060', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12, color: 'white', padding: '13px 16px', fontSize: '0.95rem',
    fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'border-color 0.2s ease',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', marginBottom: 8, fontFamily: 'Inter, sans-serif',
  };

  return (
    <>
      <Head>
        <title>Settings — EventSnap</title>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ minHeight: '100vh', background: '#0D0A14', color: 'rgba(255,255,255,0.95)', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: `radial-gradient(ellipse 60% 40% at 15% 10%, rgba(124,58,237,0.15) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 85% 85%, rgba(240,192,96,0.08) 0%, transparent 55%)` }} />
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid rgba(255,220,150,0.08)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(13,10,20,0.90)', backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/photographer" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none', fontSize: '0.88rem' }}>← Dashboard</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #7C3AED, #E8A830)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 700, boxShadow: '0 0 14px rgba(124,58,237,0.4)' }}>✦</div>
              <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '1rem', background: 'linear-gradient(135deg, #F0C060, #F7D98A, #E8A830)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EventSnap</span>
            </Link>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.40)', fontSize: '0.82rem' }}>{user?.email}</span>
        </nav>

        <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px', position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 40 }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A78BFA', marginBottom: 10 }}>Account</p>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', letterSpacing: '-0.02em', marginBottom: 8, background: 'linear-gradient(135deg, #F0C060, #F7D98A, #E8A830)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Settings</h1>
            <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '0.95rem' }}>Manage your profile, studio details, and account preferences.</p>
          </div>

          {/* Profile */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,220,150,0.10)', borderRadius: 20, padding: '28px 32px', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '1.15rem', marginBottom: 24 }}>Profile Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} type="text" value={form.fullName} placeholder="Your full name"
                  onChange={e => setForm({ ...form, fullName: e.target.value })}
                  onFocus={e => e.target.style.borderColor = 'rgba(240,192,96,0.50)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'} />
              </div>
              <div>
                <label style={labelStyle}>Studio Name</label>
                <input style={inputStyle} type="text" value={form.studioName} placeholder="Your photography studio"
                  onChange={e => setForm({ ...form, studioName: e.target.value })}
                  onFocus={e => e.target.style.borderColor = 'rgba(240,192,96,0.50)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} type="text" value={form.phone} placeholder="+91 98765 43210"
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  onFocus={e => e.target.style.borderColor = 'rgba(240,192,96,0.50)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'} />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input style={inputStyle} type="text" value={form.city} placeholder="Your city"
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  onFocus={e => e.target.style.borderColor = 'rgba(240,192,96,0.50)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} type="email" value={user?.email || ''} disabled />
              <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: '0.75rem', marginTop: 6 }}>Email cannot be changed. Contact support if needed.</p>
            </div>
            <div style={{ height: 1, margin: '24px 0', background: 'linear-gradient(90deg, transparent 0%, rgba(240,192,96,0.25) 50%, transparent 100%)' }} />
            <button onClick={handleSave} disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #E8A830, #F0C060, #F7D98A)', color: '#0D0A14', fontWeight: 700, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', border: 'none', borderRadius: 12, padding: '12px 28px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 0 24px rgba(240,192,96,0.25)', transition: 'all 0.2s ease' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Security */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,220,150,0.10)', borderRadius: 20, padding: '28px 32px', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '1.15rem', marginBottom: 8 }}>Security</h2>
            <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.6 }}>Change your password by requesting a reset email.</p>
            <button onClick={handlePasswordChange}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid rgba(240,192,96,0.30)', color: '#F0C060', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.9rem', borderRadius: 12, padding: '11px 24px', cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(240,192,96,0.08)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              Send Password Reset Email
            </button>
          </div>

          {/* Danger zone */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 20, padding: '28px 32px' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '1.15rem', marginBottom: 8, color: '#F87171' }}>Danger Zone</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.6 }}>Permanently delete your account and all associated events, photos, and data. This action cannot be undone.</p>
            <button onClick={handleDeleteAccount}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.9rem', borderRadius: 12, padding: '11px 24px', cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.10)'}>
              Delete Account
            </button>
          </div>
        </main>

        {toast && (
          <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: toast.type === 'error' ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.12)', border: `1px solid ${toast.type === 'error' ? 'rgba(248,113,113,0.30)' : 'rgba(74,222,128,0.30)'}`, color: toast.type === 'error' ? '#F87171' : '#4ADE80', padding: '14px 20px', borderRadius: 14, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.40)', animation: 'fadeUp 0.4s cubic-bezier(0.34,1.56,0.64,1)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 500 }}>
            <span>{toast.type === 'error' ? '✕' : '✓'}</span>
            {toast.msg}
          </div>
        )}

        <style>{`
          @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
          @media (max-width: 600px) {
            main { padding: 32px 16px 60px !important; }
            nav  { padding: 14px 16px !important; }
          }
          @media (max-width: 680px) {
            .grid-2 { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </>
  );
}
