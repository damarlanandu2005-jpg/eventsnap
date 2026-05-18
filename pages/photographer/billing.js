import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ALL_PACKS, ADDONS, TRIAL } from '@/lib/pricing';

export default function BillingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/login');
      return;
    }
    setUser(session.user);
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D0A14' }}>
        <div style={{ width: 32, height: 32, border: '2px solid rgba(240,192,96,0.2)', borderTopColor: '#F0C060', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0A14', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      <Head>
        <title>Billing — EventSnap</title>
      </Head>

      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(13,10,20,0.8)', backdropFilter: 'blur(12px)', sticky: 'top', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/photographer" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.9rem' }}>← Dashboard</Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <span style={{ fontWeight: 600 }}>Billing & Subscription</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{user?.email}</span>
        </div>
      </nav>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px' }}>
        <header style={{ marginBottom: '40px' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2.5rem', fontWeight: 700, marginBottom: '8px' }} className="gold-text">Billing</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>One-time event packs. No subscriptions. Packs never expire.</p>
        </header>

        <section style={{ marginBottom: '48px' }}>
          <div className="card" style={{ padding: '32px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(240,192,96,0.1)', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap:'wrap', gap:16 }}>
              <div>
                <span className="badge badge-gold" style={{ marginBottom: '12px' }}>Active plan</span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '8px' }}>Free Trial</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop:8, lineHeight:1.6 }}>
                  {TRIAL.events} event · {TRIAL.photos} photos · {TRIAL.guestScans} guest scans · {TRIAL.fileLimitMB} MB file limit · RAW supported.
                </p>
              </div>
              <a href="#packs" className="btn-primary" style={{ width: 'auto', padding: '10px 20px', textDecoration:'none' }}>Choose a pack</a>
            </div>
          </div>
        </section>

        <section id="packs" style={{ marginBottom: '48px' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>Event packs</h3>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.85rem', marginBottom:'20px' }}>All packs include RAW & 50 MB file limit.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'14px' }}>
            {ALL_PACKS.map((pack) => (
              <div key={pack.id} className="card" style={{ padding:'20px', display:'flex', flexDirection:'column', position:'relative', border: pack.badge ? '1px solid rgba(74,222,128,0.35)' : '1px solid rgba(255,255,255,0.05)', borderRadius:'16px' }}>
                {pack.badge && (
                  <span style={{ position:'absolute', top:-10, left:16, background:'#4ADE80', color:'#0D0A14', fontSize:'0.65rem', fontWeight:700, padding:'3px 10px', borderRadius:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>{pack.badge}</span>
                )}
                <h4 style={{ fontSize:'1rem', fontWeight:700, marginBottom:6 }}>{pack.name}</h4>
                <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.78rem', lineHeight:1.5, marginBottom:14, minHeight:34 }}>{pack.tagline}</p>
                <div style={{ marginBottom:14 }}>
                  <span style={{ fontFamily:'DM Mono,monospace', fontSize:'1.5rem', fontWeight:500 }}>{pack.priceLabel}</span>
                </div>
                <ul style={{ listStyle:'none', padding:0, margin:'0 0 16px', display:'flex', flexDirection:'column', gap:6, flex:1 }}>
                  <li style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.65)' }}>✓ {pack.events} event{pack.events>1?'s':''}</li>
                  <li style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.65)' }}>✓ {(pack.photosPerEvent || pack.photos).toLocaleString('en-IN')} photos{pack.events>1?'/event':''}</li>
                  <li style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.65)' }}>✓ {(pack.guestScansPerEvent || pack.guestScans).toLocaleString('en-IN')} guest scans{pack.events>1?'/event':''}</li>
                  <li style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.65)' }}>✓ {pack.fileLimitMB} MB file limit · RAW</li>
                </ul>
                <button className="btn-primary" style={{ width:'100%', padding:'10px', fontSize:'0.85rem' }}>{pack.cta}</button>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom:'48px' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>Add-ons</h3>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.85rem', marginBottom:'20px' }}>Stack on top of any active pack.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:'14px' }}>
            {ADDONS.map((a) => (
              <div key={a.id} className="card" style={{ padding:'20px', display:'flex', flexDirection:'column', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'16px' }}>
                <h4 style={{ fontSize:'1rem', fontWeight:700, marginBottom:6 }}>{a.name}</h4>
                <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.82rem', lineHeight:1.55, marginBottom:14, flex:1 }}>{a.description}</p>
                <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12 }}>
                  <div>
                    <span style={{ fontFamily:'DM Mono,monospace', fontSize:'1.35rem', fontWeight:500 }}>{a.priceLabel}</span>
                    <span style={{ color:'rgba(255,255,255,0.45)', fontSize:'0.82rem' }}> {a.unitLabel}</span>
                  </div>
                  <button className="btn-primary" style={{ padding:'8px 14px', fontSize:'0.82rem', width:'auto' }}>Add</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '48px' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>Billing history</h3>
          <div style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', color:'rgba(255,255,255,0.55)', fontSize:'0.9rem', lineHeight:1.6 }}>
            Once you make your first purchase, your invoices will appear here.
          </div>
        </section>
      </main>

      <style jsx global>{`
        .gold-text { background: linear-gradient(135deg, #F0C060 0%, #E8A830 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid transparent; }
        .badge-gold { background: rgba(240,192,96,0.1); color: #F0C060; border-color: rgba(240,192,96,0.2); }
        .btn-primary { background: linear-gradient(135deg, #F0C060 0%, #E8A830 100%); color: #0D0A14; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s ease; width: 100%; box-shadow: 0 4px 12px rgba(240,192,96,0.2); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(240,192,96,0.3); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
