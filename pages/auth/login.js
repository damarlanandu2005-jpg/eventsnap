import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/photographer');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign In — EventSnap</title>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{
        minHeight: '100vh',
        background: '#0D0A14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif'
      }}>

        {/* Background glows */}
        <div style={{ position:'fixed', top:'-20%', left:'-10%', width:'500px', height:'500px', background:'radial-gradient(circle, rgba(240,192,96,0.08) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />
        <div style={{ position:'fixed', bottom:'-20%', right:'-10%', width:'400px', height:'400px', background:'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />

        <div style={{ width:'100%', maxWidth:440, position:'relative', zIndex:1 }}>

          {/* Back home */}
          <div style={{ marginBottom:24 }}>
            <Link href="/" style={{ color:'rgba(255,255,255,0.40)', textDecoration:'none', fontSize:'0.88rem', display:'inline-flex', alignItems:'center', gap:6 }}>
              ← Back to home
            </Link>
          </div>

          {/* Logo */}
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:10, textDecoration:'none' }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#7C3AED,#E8A830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:'white', fontWeight:700, boxShadow:'0 0 20px rgba(124,58,237,0.4)' }}>✦</div>
              <span style={{ fontFamily:'Playfair Display,serif', fontWeight:800, fontSize:'1.5rem', background:'linear-gradient(135deg,#F0C060,#F7D98A,#E8A830)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>EventSnap</span>
            </Link>
            <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.8rem', marginTop:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Photographer Portal</p>
          </div>

          {/* Card */}
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,220,150,0.12)', borderRadius:24, padding:'36px 32px', boxShadow:'0 40px 100px rgba(0,0,0,0.50), 0 0 80px rgba(124,58,237,0.08) inset' }}>

            <h1 style={{ fontFamily:'Playfair Display,serif', fontWeight:800, fontSize:'1.75rem', letterSpacing:'-0.02em', marginBottom:8, textAlign:'center', color:'white' }}>
              Welcome back
            </h1>
            <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'0.88rem', textAlign:'center', marginBottom:28, lineHeight:1.6 }}>
              Sign in to your EventSnap account
            </p>

            {/* Google */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:12, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:14, padding:'13px 20px', fontSize:'0.95rem', fontWeight:600, color:'white', cursor:'pointer', transition:'all 0.25s ease', marginBottom:22, fontFamily:'Inter,sans-serif' }}
              onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.10)'}
              onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3-11.4-7.3l-6.5 5C9.5 39.4 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41 35.3 44 30 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
              <div style={{ flex:1, height:1, background:'rgba(255,220,150,0.12)' }} />
              <span style={{ color:'rgba(255,255,255,0.25)', fontSize:'0.78rem' }}>or sign in with email</span>
              <div style={{ flex:1, height:1, background:'rgba(255,220,150,0.12)' }} />
            </div>

            {error && (
              <div style={{ background:'rgba(248,113,113,0.10)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:10, padding:'12px 16px', color:'#F87171', fontSize:'0.85rem', marginBottom:18 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ display:'block', fontSize:'0.78rem', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', color:'rgba(255,255,255,0.40)', marginBottom:8 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@studio.com"
                  style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:12, color:'white', padding:'13px 16px', fontSize:'1rem', fontFamily:'Inter,sans-serif', outline:'none', transition:'border-color 0.2s ease', boxSizing:'border-box' }}
                  onFocus={e => e.target.style.borderColor='rgba(240,192,96,0.50)'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.10)'}
                />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'0.78rem', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', color:'rgba(255,255,255,0.40)', marginBottom:8 }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:12, color:'white', padding:'13px 16px', fontSize:'1rem', fontFamily:'Inter,sans-serif', outline:'none', transition:'border-color 0.2s ease', boxSizing:'border-box' }}
                  onFocus={e => e.target.style.borderColor='rgba(240,192,96,0.50)'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.10)'}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width:'100%', background:'linear-gradient(135deg,#E8A830,#F0C060,#F7D98A)', color:'#0D0A14', border:'none', borderRadius:14, padding:'14px', fontSize:'1rem', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'Inter,sans-serif', opacity: loading ? 0.7 : 1, transition:'all 0.3s ease', marginTop:4, boxShadow:'0 0 30px rgba(240,192,96,0.25)' }}
              >
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>
            </form>

            <div style={{ textAlign:'center', marginTop:20 }}>
              <Link href="/" style={{ color:'rgba(255,255,255,0.30)', textDecoration:'none', fontSize:'0.82rem', transition:'color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.color='rgba(255,255,255,0.60)'}
                onMouseOut={e => e.currentTarget.style.color='rgba(255,255,255,0.30)'}
              >
                ← Back to home
              </Link>
            </div>
          </div>

          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.20)', fontSize:'0.75rem', marginTop:20 }}>
            Guest? Your photographer will share an event link with you.
          </p>
        </div>
      </div>
    </>
  );
}
