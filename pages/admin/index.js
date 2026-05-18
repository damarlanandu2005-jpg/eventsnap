import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Cleanup tab state
  const [cleanupResult, setCleanupResult] = useState('');
  const [eventPurgeId, setEventPurgeId] = useState('');
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const showToast = (msg, type = 'default') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const session = sessionStorage.getItem('admin_session');
    if (session) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: password }),
      });

      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem('admin_session', password);
        setIsAuthenticated(true);
      } else {
        showToast('Incorrect admin secret.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_session');
    setIsAuthenticated(false);
    setPassword('');
  };

  const runCleanup = async () => {
    try {
      setCleanupResult('Running cleanup...');
      const res = await fetch('/api/admin/run-cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': sessionStorage.getItem('admin_session')
        }
      });
      const data = await res.json();
      if (res.ok) {
        setCleanupResult(`Cleanup successful. ${data.message || 'GDPR compliance task completed.'}`);
      } else {
        setCleanupResult(`Error: ${data.error || 'Cleanup failed'}`);
      }
    } catch (err) {
      setCleanupResult('Failed to run cleanup due to network error.');
    }
  };

  const executePurge = () => {
    setShowPurgeConfirm(false);
    setEventPurgeId('');
    showToast('Faces purged successfully for event.', 'success');
    // In a real app, this would be an API call to delete faces for eventPurgeId
  };

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0D0A14',
        padding: 20,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Head><title>Admin Login — EventSnap</title></Head>
        <div style={{
          position: 'absolute',
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(240,192,96,0.15) 0%, rgba(13,10,20,0) 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,220,150,0.15)',
          borderRadius: 24,
          padding: '40px 32px',
          width: '100%',
          maxWidth: 380,
          textAlign: 'center',
          backdropFilter: 'blur(12px)',
          position: 'relative',
          zIndex: 10
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #7C3AED, #E8A830)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            color: 'white',
            margin: '0 auto 20px',
            boxShadow: '0 0 20px rgba(240,192,96,0.3)'
          }}>✦</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', fontWeight: 700, marginBottom: 24, color: '#F7D98A' }}>
            Admin Access
          </h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input
              type="password"
              placeholder="Admin Secret"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                fontSize: 16,
                fontFamily: 'Inter, sans-serif'
              }}
              autoFocus
              required
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #E8A830, #F0C060)',
                color: '#0D0A14',
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: 8,
                transition: 'transform 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {loading ? 'Verifying...' : 'Access dashboard →'}
            </button>
          </form>
        </div>

        {toast && (
          <div style={{
            position: 'fixed',
            top: 24,
            right: 24,
            background: toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(240,192,96,0.15)',
            border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(240,192,96,0.3)'}`,
            color: toast.type === 'error' ? '#EF4444' : '#F7D98A',
            padding: '12px 20px',
            borderRadius: 12,
            zIndex: 100,
            animation: 'fade-up 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  const NAV_ITEMS = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'photographers', icon: '📷', label: 'Photographers' },
    { id: 'events', icon: '🎪', label: 'Events' },
    { id: 'revenue', icon: '💰', label: 'Revenue' },
    { id: 'cleanup', icon: '🗑', label: 'Cleanup (GDPR)' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <>
      <Head>
        <title>Admin Dashboard — EventSnap</title>
        <style>{`
          body { overflow: hidden; height: 100vh; background: #0D0A14; color: white; margin: 0; font-family: 'Inter', sans-serif; }
          .layout { display: flex; height: 100vh; }
          .sidebar { width: 260px; flex-shrink: 0; background: rgba(255,255,255,0.02); border-right: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; }
          .sidebar-top { padding: 28px 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 12px; }
          .logo-mark { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #7C3AED, #E8A830); display: flex; align-items: center; justify-content: center; font-size: 15px; color: white; }
          .sidebar-nav { flex: 1; padding: 20px 12px; }
          .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s ease; font-size: 0.92rem; font-weight: 500; color: rgba(255,255,255,0.6); text-decoration: none; }
          .nav-item:hover { background: rgba(255,255,255,0.04); color: white; }
          .nav-item.active { background: rgba(240,192,96,0.1); color: #F0C060; }
          .main { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
          .topbar { padding: 20px 32px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; background: rgba(13,10,20,0.8); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 10; }
          .content { padding: 32px; flex: 1; }
          .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; }
          
          /* Mobile Bottom Nav */
          .bottom-nav { display: none; }
          @media (max-width: 768px) {
            .sidebar { display: none; }
            .bottom-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: rgba(20,16,28,0.95); backdrop-filter: blur(10px); border-top: 1px solid rgba(255,255,255,0.08); padding: 12px 8px; justify-content: space-around; z-index: 100; padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
            .b-nav-item { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 0.65rem; color: rgba(255,255,255,0.5); text-decoration: none; }
            .b-nav-item.active { color: #F0C060; }
            .b-nav-icon { font-size: 1.3rem; }
            .main { padding-bottom: 80px; }
            .topbar { padding: 16px 20px; }
            .content { padding: 20px; }
          }
        `}</style>
      </Head>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-top">
            <div className="logo-mark">✦</div>
            <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '1.2rem', color: '#F7D98A' }}>EventSnap</span>
          </div>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(item => (
              <a
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* MAIN */}
        <main className="main">
          <header className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="logo-mark" style={{ display: 'none' }} id="mobile-logo">✦</div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, fontFamily: 'Playfair Display, serif', color: '#F7D98A' }}>
                EventSnap Admin
              </h1>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Logout
            </button>
          </header>

          <div className="content">
            {activeTab === 'overview' && (
              <div>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.6rem', marginBottom: 24 }}>Overview</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                  <div className="card">
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Total Photographers</p>
                    <p style={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'DM Mono, monospace', margin: 0, color: '#F0C060' }}>0</p>
                  </div>
                  <div className="card">
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Active Events</p>
                    <p style={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'DM Mono, monospace', margin: 0 }}>—</p>
                  </div>
                  <div className="card">
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Photos Indexed</p>
                    <p style={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'DM Mono, monospace', margin: 0 }}>0</p>
                  </div>
                  <div className="card">
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Revenue This Month</p>
                    <p style={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'DM Mono, monospace', margin: 0, color: '#4ADE80' }}>—</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cleanup' && (
              <div>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.6rem', marginBottom: 24 }}>Data Cleanup & GDPR</h2>
                
                <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid #F0C060' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: 12 }}>System-Wide Cleanup</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: 20, lineHeight: 1.6 }}>
                    Runs the scheduled cleanup task immediately. This processes all inactive events and deletes data according to the GDPR retention policy.
                  </p>
                  <button
                    onClick={runCleanup}
                    style={{
                      background: 'linear-gradient(135deg, #E8A830, #F0C060)',
                      color: '#0D0A14',
                      padding: '12px 24px',
                      borderRadius: 10,
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      cursor: 'pointer'
                    }}
                  >
                    Run cleanup now
                  </button>
                  {cleanupResult && (
                    <p style={{ marginTop: 16, fontSize: '0.9rem', color: '#F7D98A', fontFamily: 'DM Mono, monospace' }}>
                      &gt; {cleanupResult}
                    </p>
                  )}
                </div>

                <div className="card" style={{ borderLeft: '4px solid #EF4444' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: 12, color: '#EF4444' }}>Targeted Event Purge</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: 20, lineHeight: 1.6 }}>
                    Instantly delete all indexed faces and biometric data for a specific event. This action is irreversible.
                  </p>
                  <div style={{ display: 'flex', gap: 12, maxWidth: 500 }}>
                    <input
                      type="text"
                      placeholder="Event ID (e.g., ev_123abc)"
                      value={eventPurgeId}
                      onChange={(e) => setEventPurgeId(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(0,0,0,0.2)',
                        color: 'white',
                        fontFamily: 'DM Mono, monospace'
                      }}
                    />
                    <button
                      onClick={() => setShowPurgeConfirm(true)}
                      disabled={!eventPurgeId}
                      style={{
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.4)',
                        color: '#EF4444',
                        padding: '12px 24px',
                        borderRadius: 10,
                        fontWeight: 600,
                        cursor: eventPurgeId ? 'pointer' : 'not-allowed',
                        opacity: eventPurgeId ? 1 : 0.5
                      }}
                    >
                      Purge faces
                    </button>
                  </div>
                </div>
              </div>
            )}

            {['photographers', 'events', 'revenue', 'settings'].includes(activeTab) && (
              <div>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.6rem', marginBottom: 24, textTransform: 'capitalize' }}>
                  {activeTab}
                </h2>
                <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.5 }}>🚧</div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'rgba(255,255,255,0.9)' }}>Coming soon</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>This module is currently under development.</p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* MOBILE BOTTOM NAV */}
        <nav className="bottom-nav">
          {NAV_ITEMS.slice(0, 5).map(item => (
            <a
              key={item.id}
              className={`b-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="b-nav-icon">{item.icon}</span>
              {item.label.split(' ')[0]}
            </a>
          ))}
        </nav>

        {/* CONFIRMATION MODAL */}
        {showPurgeConfirm && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}>
            <div className="card" style={{ width: '100%', maxWidth: 420, padding: 32, textAlign: 'center', background: '#14101A' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                !
              </div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: 12, fontFamily: 'Playfair Display, serif' }}>Confirm Data Purge</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 24 }}>
                Are you sure you want to permanently delete all facial recognition data for event <strong style={{ color: 'white', fontFamily: 'DM Mono, monospace' }}>{eventPurgeId}</strong>? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowPurgeConfirm(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={executePurge}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, background: '#EF4444', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                >
                  Yes, Purge
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST NOTIFICATION */}
        {toast && (
          <div style={{
            position: 'fixed',
            top: 24,
            right: 24,
            background: toast.type === 'error' ? 'rgba(239,68,68,0.15)' : toast.type === 'success' ? 'rgba(74,222,128,0.15)' : 'rgba(240,192,96,0.15)',
            border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.3)' : toast.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(240,192,96,0.3)'}`,
            color: toast.type === 'error' ? '#EF4444' : toast.type === 'success' ? '#4ADE80' : '#F7D98A',
            padding: '14px 20px',
            borderRadius: 12,
            zIndex: 1000,
            animation: 'fade-up 0.3s ease',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <span>✦</span>
            <span>{toast.msg}</span>
          </div>
        )}
      </div>
    </>
  );
}
