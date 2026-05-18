import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import { PRIMARY_PLANS, STANDARD_EVENT, ADDONS } from '@/lib/pricing';

export default function Home() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [analytics, setAnalytics] = useState({ photos: '7,000+', photographers: '100+', accuracy: '99.8%' });
  const [showSignup, setShowSignup] = useState(false);
  const [signupStage, setSignupStage] = useState('form');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', city: '' });
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupSuccessName, setSignupSuccessName] = useState('');

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((data) => { setEvents(Array.isArray(data) ? data.filter((e) => e.is_active) : []); })
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));

    fetch('/api/admin/analytics')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.totalPhotos !== 'undefined') {
          const formatNum = (num) => {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M+';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k+';
            return num;
          };
          setAnalytics({
            photos: data.totalPhotos > 2000 ? formatNum(data.totalPhotos) : '7,000+',
            photographers: data.totalPhotographers > 100 ? formatNum(data.totalPhotographers) : '100+',
            accuracy: '99.8%'
          });
        }
      })
      .catch(console.error);
  }, []);

  const handleSignupChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const openSignup = () => {
    setShowSignup(true);
    setSignupStage('form');
    setForm({ fullName: '', email: '', password: '', city: '' });
    setSignupError('');
  };

  const closeSignup = () => setShowSignup(false);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSignupLoading(true);
    setSignupError('');
    if (!form.fullName || !form.email || !form.password) {
      setSignupError('Please fill in all required fields.');
      setSignupLoading(false);
      return;
    }
    if (form.password.length < 6) {
      setSignupError('Password must be at least 6 characters.');
      setSignupLoading(false);
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.fullName, city: form.city } },
    });
    if (authError) {
      setSignupError(authError.message);
      setSignupLoading(false);
      return;
    }
    if (authData.user) {
      try {
        await fetch('/api/photographer/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth_user_id: authData.user.id, email: form.email.trim(), full_name: form.fullName, business_name: form.fullName + ' Photography' }),
        });
      } catch (err) { console.error('Registration API error:', err); }
    }
    const firstName = form.fullName.split(' ')[0];
    setSignupSuccessName(firstName);
    setSignupStage('welcome');
    setSignupLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setSignupLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/photographer` } });
    if (error) { setSignupError(error.message); setSignupLoading(false); }
  };

  return (
    <>
      <Head>
        <title>EventSnap — Your Memories, Instantly Yours</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style>{`
          .nav {
            position: fixed; top: 0; left: 0; right: 0; z-index: 90;
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 24px;
            gap: 8px;
            min-height: 58px;
            background: rgba(13,10,20,0.80);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--color-border);
            transition: background 0.3s ease;
            overflow: visible;
            box-sizing: border-box;
          }
          .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
          .logo-mark {
            width: 36px; height: 36px; border-radius: 10px;
            background: linear-gradient(135deg, #7C3AED, #E8A830);
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; color: white; font-weight: 700;
            box-shadow: 0 0 20px rgba(124,58,237,0.4);
          }
          .nav-links { display: flex; gap: 16px; align-items: center; flex-shrink: 1; min-width: 0; overflow: hidden; }
          .nav-links a { color: var(--text-secondary); font-size: 0.82rem; font-weight: 500; text-decoration: none; transition: color 0.2s; white-space: nowrap; }
          .nav-links a:hover { color: var(--color-gold); }
          .nav-buttons { display: flex; gap: 8px; align-items: center; flex-shrink: 0; padding-right: 4px; }

          /* Nav primary button — always full gold glow, never clipped */
          .nav-find-btn {
            display: inline-flex; align-items: center; justify-content: center;
            background: linear-gradient(135deg, #E8A830 0%, #F0C060 50%, #F7D98A 100%);
            color: #0D0A14;
            font-weight: 700; font-family: 'Inter', sans-serif; font-size: 0.85rem;
            border: none; border-radius: 12px;
            padding: 10px 18px;
            cursor: pointer; white-space: nowrap;
            text-decoration: none;
            box-shadow: 0 0 24px rgba(240,192,96,0.45), 0 4px 14px rgba(240,192,96,0.30);
            transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
            flex-shrink: 0;
            width: auto;
          }
          .nav-find-btn:hover {
            transform: translateY(-1px) scale(1.02);
            box-shadow: 0 0 40px rgba(240,192,96,0.65), 0 6px 20px rgba(240,192,96,0.40);
          }

          @media (max-width: 1280px) {
            .nav { padding: 12px 20px; }
            .nav-links { gap: 14px; }
          }
          @media (max-width: 1100px) {
            .nav-btn-ghost-hide { display: none !important; }
            .nav-links { gap: 12px; }
            .nav-links a { font-size: 0.8rem; }
          }
          @media (max-width: 900px) {
            .nav { padding: 10px 16px; }
            .nav-links { display: none !important; }
          }
          @media (max-width: 768px) {
            .nav { padding: 10px 14px; }
          }

          .hero {
            min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
            text-align: center; padding: 120px 24px 80px; position: relative; overflow: hidden;
            background: radial-gradient(ellipse 70% 60% at 15% 20%, rgba(124,58,237,0.22) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 85% 80%, rgba(240,192,96,0.12) 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(124,58,237,0.08) 0%, transparent 50%), #0D0A14;
          }
          .photo-strip { position: absolute; top: 0; bottom: 0; width: 180px; display: flex; flex-direction: column; gap: 12px; padding: 80px 0; opacity: 0.12; pointer-events: none; filter: blur(2px); }
          .photo-strip.left { left: 0; transform: rotate(-3deg); }
          .photo-strip.right { right: 0; transform: rotate(3deg); }
          .photo-strip img { width: 100%; border-radius: 12px; animation: float 6s ease-in-out infinite; }
          .photo-strip img:nth-child(2) { animation-delay: -2s; }
          .photo-strip img:nth-child(3) { animation-delay: -4s; }
          .photo-strip img:nth-child(4) { animation-delay: -1s; }

          .hero-eyebrow { display: inline-flex; align-items: center; gap: 8px; background: rgba(240,192,96,0.08); border: 1px solid rgba(240,192,96,0.20); border-radius: 20px; padding: 6px 16px; margin-bottom: 32px; font-size: 0.82rem; font-weight: 600; color: var(--color-gold); letter-spacing: 0.04em; animation: fade-up 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
          .hero-headline { font-family: 'Playfair Display', serif; font-weight: 800; font-size: clamp(3rem, 6vw, 5.5rem); line-height: 1.08; letter-spacing: -0.03em; margin-bottom: 24px; animation: fade-up 0.6s 0.1s cubic-bezier(0.34,1.56,0.64,1) both; }
          .hero-sub { color: var(--text-secondary); font-size: clamp(1rem, 1.8vw, 1.2rem); line-height: 1.7; max-width: 520px; margin: 0 auto 40px; animation: fade-up 0.6s 0.2s cubic-bezier(0.34,1.56,0.64,1) both; }
          .hero-ctas { display: flex; gap: 14px; align-items: center; justify-content: center; flex-wrap: wrap; animation: fade-up 0.6s 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
          @media (max-width: 580px) {
            .hero { padding: 100px 16px 60px; }
            .hero-ctas { flex-direction: column; align-items: stretch; padding: 0 16px; width: 100%; }
            .hero-ctas a, .hero-ctas button { width: 100% !important; justify-content: center !important; text-align: center !important; }
            .photo-strip { display: none; }
          }

          .proof-bar { width: 100%; padding: 20px 0; text-align: center; background: rgba(13,10,20,0.6); animation: fade-in 0.8s 0.6s both; }
          .proof-inner { display: flex; align-items: center; justify-content: center; gap: 32px; flex-wrap: wrap; font-size: 0.88rem; color: var(--text-secondary); }
          .proof-stat { display: flex; align-items: center; gap: 8px; }
          .proof-num { font-family: 'DM Mono', monospace; font-size: 1rem; font-weight: 500; color: var(--color-gold-light); }
          .proof-dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(240,192,96,0.30); }
          @media (max-width: 580px) {
            .proof-inner { flex-direction: column; gap: 10px; }
            .proof-dot { display: none; }
          }

          .section { padding: 96px 48px; max-width: 1200px; margin: 0 auto; }
          .section-label { font-size: 0.78rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-violet-light); margin-bottom: 12px; }
          .section-title { font-family: 'Playfair Display', serif; font-weight: 700; font-size: clamp(2rem, 3.5vw, 3rem); letter-spacing: -0.02em; margin-bottom: 16px; }
          .section-sub { color: var(--text-secondary); font-size: 1.05rem; line-height: 1.7; max-width: 500px; }
          @media (max-width: 768px) { .section { padding: 56px 16px; } }

          .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 64px; }
          .feature-card { padding: 36px 32px; }
          .feature-icon { width: 56px; height: 56px; border-radius: 16px; background: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.25); display: flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 20px; }
          .feature-title { font-family: 'Playfair Display', serif; font-size: 1.3rem; font-weight: 700; margin-bottom: 10px; }
          .feature-desc { color: var(--text-secondary); font-size: 0.92rem; line-height: 1.7; }
          @media (max-width: 1024px) { .features-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 640px) { .features-grid { grid-template-columns: 1fr; gap: 14px; } .feature-card { padding: 24px 20px; } }

          .how-section { padding: 96px 48px; background: radial-gradient(ellipse 80% 60% at 80% 50%, rgba(124,58,237,0.12) 0%, transparent 60%), #0D0A14; }
          .steps-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-top: 64px; position: relative; }
          .steps-row::before { content: ''; position: absolute; top: 40px; left: calc(16.67% + 40px); right: calc(16.67% + 40px); height: 1px; background: linear-gradient(90deg, rgba(240,192,96,0.4), rgba(240,192,96,0.2), rgba(240,192,96,0.4)); }
          .step { text-align: center; padding: 0 32px; }
          .step-num { width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 24px; background: var(--color-surface); border: 1px solid rgba(240,192,96,0.25); display: flex; align-items: center; justify-content: center; font-family: 'DM Mono', monospace; font-size: 1.6rem; font-weight: 500; position: relative; z-index: 1; box-shadow: 0 0 30px rgba(240,192,96,0.10); }
          .step-title { font-family: 'Playfair Display', serif; font-size: 1.2rem; font-weight: 700; margin-bottom: 10px; }
          .step-desc { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.7; }
          @media (max-width: 768px) {
            .how-section { padding: 56px 16px; }
            .steps-row { grid-template-columns: 1fr; gap: 32px; }
            .steps-row::before { display: none; }
            .step { padding: 0; }
          }

          /* FIX: how-section CTA — auto width, centered */
          .how-section-cta { text-align: center; margin-top: 56px; }
          .how-section-cta .btn-primary { width: auto !important; padding: 14px 40px !important; font-size: 1rem !important; }

          .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 64px; }
          .testimonial-card { padding: 28px; }
          .t-stars { color: var(--color-gold); font-size: 0.9rem; margin-bottom: 16px; letter-spacing: 3px; }
          .t-quote { font-family: 'Playfair Display', serif; font-size: 1rem; font-style: italic; line-height: 1.7; color: var(--text-primary); margin-bottom: 20px; }
          .t-author { display: flex; align-items: center; gap: 12px; }
          .t-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--color-violet), var(--color-gold)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; color: white; flex-shrink: 0; }
          .t-name { font-weight: 600; font-size: 0.9rem; }
          .t-role { color: var(--text-muted); font-size: 0.78rem; }
          @media (max-width: 900px) { .testimonials-grid { grid-template-columns: 1fr; gap: 14px; } }

          .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-bottom: 24px; }
          @media (max-width: 600px) { .pricing-grid { grid-template-columns: 1fr; } }
          .pricing-card { padding: 36px 32px; position: relative; overflow: hidden; }
          .plan-name { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-gold-light); margin-bottom: 16px; }
          .plan-price { font-family: 'DM Mono', monospace; margin-bottom: 6px; }
          .plan-price .amount { font-size: 3rem; font-weight: 500; color: var(--text-primary); }
          .plan-price .period { font-size: 0.9rem; color: var(--text-muted); }
          .plan-desc { color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 28px; line-height: 1.6; }
          .plan-features { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
          .plan-features li { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; color: var(--text-secondary); }
          .plan-features li::before { content: '✦'; color: var(--color-gold); font-size: 0.7rem; flex-shrink: 0; }

          .cta-section { padding: 120px 48px; text-align: center; background: radial-gradient(ellipse 60% 80% at 50% 50%, rgba(124,58,237,0.15) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 20% 80%, rgba(240,192,96,0.08) 0%, transparent 55%), #0D0A14; }
          /* FIX: cta-btns — auto width buttons, collapse on mobile */
          .cta-btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; padding: 0 16px; }
          .cta-btns .btn-primary { width: auto !important; padding: 15px 34px !important; font-size: 1.05rem; }
          @media (max-width: 580px) {
            .cta-section { padding: 64px 16px; }
            .cta-btns { flex-direction: column; align-items: stretch; max-width: 360px; margin: 0 auto; }
            .cta-btns a, .cta-btns button { width: 100% !important; justify-content: center !important; text-align: center !important; }
          }

          footer { border-top: 1px solid var(--color-border); padding: 48px; }
          .footer-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; }
          .footer-brand-desc { color: var(--text-muted); font-size: 0.88rem; line-height: 1.7; margin-top: 12px; max-width: 260px; }
          .footer-col h4 { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 16px; }
          .footer-col a { display: block; color: var(--text-muted); font-size: 0.88rem; text-decoration: none; margin-bottom: 10px; transition: color 0.2s; }
          .footer-col a:hover { color: var(--color-gold); }
          .footer-bottom { max-width: 1200px; margin: 32px auto 0; padding-top: 24px; border-top: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
          .footer-bottom p { color: var(--text-muted); font-size: 0.8rem; }
          @media (max-width: 900px) { .footer-inner { grid-template-columns: repeat(2, 1fr); gap: 32px; } }
          @media (max-width: 580px) { footer { padding: 36px 16px; } .footer-inner { grid-template-columns: 1fr; gap: 24px; } .footer-bottom { flex-direction: column; text-align: center; } }

          /* SIGNUP MODAL */
          #signup-modal {
            position: fixed; inset: 0; z-index: 200;
            background: rgba(0,0,0,0.72); backdrop-filter: blur(10px);
            display: flex; align-items: center; justify-content: center;
            padding: 20px; animation: modal-fade-in 0.25s ease both;
          }
          @keyframes modal-fade-in { from{opacity:0} to{opacity:1} }
          @keyframes modal-slide-up { from{opacity:0;transform:translateY(28px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
          .signup-box {
            background: #13101E; border: 1px solid rgba(255,220,150,0.13); border-radius: 28px;
            max-width: 460px; width: 100%; max-height: 90vh; overflow-y: auto;
            box-shadow: 0 40px 100px rgba(0,0,0,0.70), 0 0 120px rgba(124,58,237,0.12);
            animation: modal-slide-up 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
            position: relative;
          }
          .signup-header { padding: 36px 36px 0; text-align: center; }
          .signup-body { padding: 28px 36px 36px; }
          @media (max-width: 520px) {
            .signup-box { border-radius: 20px; max-height: 92vh; margin: 0 4px; }
            .signup-header { padding: 24px 20px 0; }
            .signup-body { padding: 20px 20px 24px; }
          }
          .google-btn {
            width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px;
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
            border-radius: 14px; padding: 14px 20px; font-family: 'Inter', sans-serif;
            font-size: 0.97rem; font-weight: 600; color: white; cursor: pointer;
            transition: all 0.25s ease; margin-bottom: 24px;
          }
          .google-btn:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.22); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.30); }
          .divider-or { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
          .divider-or::before, .divider-or::after { content:''; flex:1; height:1px; background: rgba(255,220,150,0.12); }
          .divider-or span { color: rgba(255,255,255,0.30); font-size: 0.78rem; white-space: nowrap; }
          .input-field:focus { border-color: rgba(240,192,96,0.50) !important; box-shadow: 0 0 0 3px rgba(240,192,96,0.08) !important; outline: none !important; }
          .input-field::placeholder { color: rgba(255,255,255,0.25) !important; }
          .field-label { font-size: 0.75rem !important; font-weight: 600 !important; letter-spacing: 0.05em !important; text-transform: uppercase !important; color: rgba(255,255,255,0.38) !important; margin-bottom: 8px !important; display: block !important; font-family: 'Inter', sans-serif !important; }
          .field-wrap { margin-bottom: 16px !important; }
          .input-field { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.10) !important; border-radius: 12px !important; color: white !important; padding: 13px 16px !important; font-size: 16px !important; font-family: 'Inter', sans-serif !important; width: 100% !important; transition: border-color 0.2s ease !important; box-sizing: border-box !important; }
          .trust-micro { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-top: 20px; }
          .trust-micro span { color: rgba(255,255,255,0.28); font-size: 0.74rem; display: flex; align-items: center; gap: 4px; }
          .welcome-screen { text-align: center; padding: 52px 36px 48px; }
          .confetti-burst { font-size: 56px; margin-bottom: 20px; animation: modal-slide-up 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
          .modal-close { position: absolute; top: 20px; right: 20px; width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); color: rgba(255,255,255,0.40); font-size: 1rem; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; font-family: monospace; line-height: 1; z-index: 10; }
          .modal-close:hover { background: rgba(255,255,255,0.10); color: white; }

          /* Global overflow safety */
          html, body { overflow-x: hidden; max-width: 100vw; }
          img, video, svg { max-width: 100%; }
        `}</style>
      </Head>

      {/* ═══ NAV — FIXED: buttons group never clips ═══ */}
      <nav className="nav">
        <Link className="nav-logo" href="/">
          <div className="logo-mark">✦</div>
          <span style={{fontFamily:'Playfair Display,serif', fontWeight:700, fontSize:'1.2rem'}} className="gold-text">EventSnap</span>
        </Link>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link href="/photographer">Photographer Dashboard</Link>
        </div>
        {/* nav-buttons: flex-shrink:0 — never compressed, never clipped */}
        <div className="nav-buttons">
          <button className="btn-ghost nav-btn-ghost-hide" onClick={openSignup} style={{padding:'9px 18px', fontSize:'0.82rem', whiteSpace:'nowrap'}}>For Photographers</button>
          {/* nav-find-btn: its own CSS class — full gold glow, always fully visible */}
          <a className="nav-find-btn" href="#events">Find My Photos →</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="photo-strip left">
          <img src="https://picsum.photos/seed/h1/180/240" alt="" />
          <img src="https://picsum.photos/seed/h2/180/220" alt="" />
          <img src="https://picsum.photos/seed/h3/180/260" alt="" />
          <img src="https://picsum.photos/seed/h4/180/200" alt="" />
        </div>
        <div className="photo-strip right">
          <img src="https://picsum.photos/seed/h5/180/220" alt="" />
          <img src="https://picsum.photos/seed/h6/180/260" alt="" />
          <img src="https://picsum.photos/seed/h7/180/200" alt="" />
          <img src="https://picsum.photos/seed/h8/180/240" alt="" />
        </div>

        <div style={{position:'relative', zIndex:1, maxWidth:'760px'}}>
          <div className="hero-eyebrow">✦ &nbsp;AI-Powered Event Photography · India's #1</div>
          <h1 className="hero-headline">
            <span className="gold-text">Your Memories,</span><br />
            Instantly Yours.
          </h1>
          <p className="hero-sub">
            Upload a selfie. Our AI finds every photo of you<br />
            from the event in seconds. No app. No waiting.
          </p>
          <div className="hero-ctas">
            <a className="btn-primary" href="#events" style={{fontSize:'1.05rem', padding:'15px 34px'}}>
              Find My Photos →
            </a>
            <button className="btn-ghost" onClick={openSignup} style={{fontSize:'1.05rem', padding:'14px 30px'}}>
              For Photographers
            </button>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF BAR */}
      <div className="proof-bar">
        <div className="gold-divider" style={{margin:'0 0 20px'}}></div>
        <div className="proof-inner">
          <div className="proof-stat"><span className="proof-num">{analytics.photographers}</span><span>photographers trust us</span></div>
          <div className="proof-dot"></div>
          <div className="proof-stat"><span className="proof-num">{analytics.photos}</span><span>photos matched</span></div>
          <div className="proof-dot"></div>
          <div className="proof-stat"><span className="proof-num">15K+</span><span>happy guests</span></div>
          <div className="proof-dot"></div>
          <div className="proof-stat"><span>Available across</span><span className="proof-num">India</span></div>
        </div>
        <div className="gold-divider" style={{margin:'20px 0 0'}}></div>
      </div>

      {/* FEATURES */}
      <section className="section" id="features">
        <div style={{maxWidth:'1200px', margin:'0 auto'}}>
          <p className="section-label">Why EventSnap</p>
          <h2 className="section-title">Built for India's<br /><span className="gold-text">most precious moments</span></h2>
          <p className="section-sub">From grand weddings to intimate family gatherings — every moment deserves to be remembered.</p>
          <div className="features-grid">
            <div className="card feature-card">
              <div className="feature-icon">🎯</div>
              <p className="feature-title">AI Face Matching</p>
              <p className="feature-desc">Our model scans thousands of event photos in under 15 seconds, finding every frame you appear in — even in crowds.</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon" style={{background:'rgba(240,192,96,0.12)', borderColor:'rgba(240,192,96,0.25)'}}>🔒</div>
              <p className="feature-title">Privacy First</p>
              <p className="feature-desc">Your selfie is deleted immediately after matching. We store no face data, no biometrics. Zero data retained.</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon" style={{background:'rgba(240,192,96,0.12)', borderColor:'rgba(240,192,96,0.25)'}}>⚡</div>
              <p className="feature-title">Instant Delivery</p>
              <p className="feature-desc">Get your photos delivered directly to your device. No app download, no login — just your memories, instantly.</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon">⚡</div>
              <p className="feature-title">5,000 Photos in 15s</p>
              <p className="feature-desc">Powered by state-of-the-art face recognition optimised for Indian skin tones, lighting conditions, and event scenarios.</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon" style={{background:'rgba(240,192,96,0.12)', borderColor:'rgba(240,192,96,0.25)'}}>🌐</div>
              <p className="feature-title">No App Needed</p>
              <p className="feature-desc">Guests use a simple link — shared via wedding card QR code or direct link. Works on any phone, any browser.</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon" style={{background:'rgba(124,58,237,0.15)', borderColor:'rgba(124,58,237,0.25)'}}>📸</div>
              <p className="feature-title">Photographer Tools</p>
              <p className="feature-desc">Bulk upload, event management, guest analytics, and branded delivery pages — everything in one dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <div className="how-section" id="how">
        <div style={{maxWidth:'1200px', margin:'0 auto'}}>
          <p className="section-label" style={{textAlign:'center'}}>How it works</p>
          <h2 className="section-title" style={{textAlign:'center', marginBottom:'8px'}}>
            Three steps to<br /><span className="gold-text">find your photos</span>
          </h2>
          <div className="steps-row">
            <div className="step">
              <div className="step-num gold-text">01</div>
              <p className="step-title">Scan the QR code</p>
              <p className="step-desc">Find the EventSnap QR code at the venue or in your invitation. One tap opens your personalised event page.</p>
            </div>
            <div className="step">
              <div className="step-num gold-text">02</div>
              <p className="step-title">Take your selfie</p>
              <p className="step-desc">Take a quick selfie or upload one from your gallery. Our AI gets to work scanning every photo from the event.</p>
            </div>
            <div className="step">
              <div className="step-num gold-text">03</div>
              <p className="step-title">Get your memories</p>
              <p className="step-desc">Download all your photos directly from your personalized gallery. Save, share, and relive your favourite moments.</p>
            </div>
          </div>
          {/* FIX: was style={{textAlign:'center', marginTop:'56px'}} + full-width btn */}
          <div className="how-section-cta">
            <a className="btn-primary" href="#events">Try it now — it's free →</a>
          </div>
        </div>
      </div>

      {/* LIVE EVENTS */}
      <section className="section" id="events" style={{paddingTop:0}}>
        <div style={{maxWidth:'1200px', margin:'0 auto'}}>
          <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:'16px', marginBottom:'40px'}}>
            <div>
              <p className="section-label">Happening now</p>
              <h2 className="section-title" style={{marginBottom:0}}>
                Live events across<br /><span className="gold-text">India today</span>
              </h2>
            </div>
            <span className="badge badge-active" style={{fontSize:'0.78rem', padding:'7px 14px'}}>● {events.length} events live right now</span>
          </div>
          {loadingEvents ? (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'18px'}}>
              <div className="card" style={{height:'320px', background:'rgba(255,255,255,0.02)'}}></div>
              <div className="card" style={{height:'320px', background:'rgba(255,255,255,0.02)'}}></div>
              <div className="card" style={{height:'320px', background:'rgba(255,255,255,0.02)'}}></div>
            </div>
          ) : events.length === 0 ? (
            <div style={{textAlign:'center', padding:'40px 0'}}>
              <p style={{color:'var(--text-muted)'}}>No active events found at the moment.</p>
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'18px'}}>
              {events.map((event) => (
                <Link key={event.id} href={`/event/${event.slug}`} style={{textDecoration:'none'}} className="card">
                  <div style={{position:'relative', height:'160px', overflow:'hidden', borderRadius:'20px 20px 0 0'}}>
                    <img src={`https://picsum.photos/seed/${event.id}/600/320`} alt="" style={{width:'100%', height:'100%', objectFit:'cover', filter:'brightness(0.75)'}}/>
                    <div style={{position:'absolute', inset:0, background:'linear-gradient(transparent 40%,rgba(13,10,20,0.90))'}}></div>
                    <div style={{position:'absolute', top:'14px', left:'14px'}}>
                      <span className="badge badge-active" style={{fontSize:'0.68rem'}}>● Live</span>
                    </div>
                  </div>
                  <div style={{padding:'20px 22px 22px'}}>
                    <h3 style={{fontFamily:'Playfair Display,serif', fontSize:'1.15rem', fontWeight:700, marginBottom:'5px'}} className="gold-text">{event.name}</h3>
                    <p style={{color:'var(--text-muted)', fontSize:'0.8rem', marginBottom:'14px'}}>{event.event_date ? new Date(event.event_date).toLocaleDateString() : 'Active now'}</p>
                    <div className="gold-divider" style={{margin:'0 0 14px'}}></div>
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                      <div style={{width:'30px', height:'30px', borderRadius:'8px', background:'linear-gradient(135deg,#7C3AED,#E8A830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:700, color:'white', flexShrink:0}}>
                        {event.photographer_id?.substring(0,2).toUpperCase() || 'ES'}
                      </div>
                      <div>
                        <p style={{fontSize:'0.82rem', fontWeight:600}}>Event Photographer</p>
                        <p style={{fontSize:'0.72rem', color:'var(--text-muted)'}}>Waiting for photos</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section">
        <div style={{maxWidth:'1200px', margin:'0 auto'}}>
          <p className="section-label" style={{textAlign:'center'}}>Stories</p>
          <h2 className="section-title" style={{textAlign:'center'}}>Moments that<br /><span className="gold-text">stayed with them</span></h2>
          <div className="testimonials-grid">
            <div className="card testimonial-card">
              <div className="t-stars">★★★★★</div>
              <p className="t-quote">"I found 47 photos of myself from my sister's wedding. I had no idea there were so many. I cried going through them."</p>
              <div className="t-author">
                <div className="t-avatar">PR</div>
                <div><p className="t-name">Preethi Ramachandran</p><p className="t-role">Wedding guest · Chennai</p></div>
              </div>
            </div>
            <div className="card testimonial-card">
              <div className="t-stars">★★★★★</div>
              <p className="t-quote">"As a photographer, this changed everything. My clients love it. It used to take me hours to send photos — now it's automatic."</p>
              <div className="t-author">
                <div className="t-avatar">AK</div>
                <div><p className="t-name">Arjun Khanna</p><p className="t-role">Wedding photographer · Delhi</p></div>
              </div>
            </div>
            <div className="card testimonial-card">
              <div className="t-stars">★★★★★</div>
              <p className="t-quote">"Our convocation had 3,000 students. Every single one got their photos within minutes. No chaos. Pure magic."</p>
              <div className="t-author">
                <div className="t-avatar">SK</div>
                <div><p className="t-name">Srinivas Kumar</p><p className="t-role">Event coordinator · Hyderabad</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="section" id="pricing">
        <div style={{maxWidth:'1200px', margin:'0 auto'}}>
          <p className="section-label" style={{textAlign:'center'}}>Simple Pricing</p>
          <h2 className="section-title" style={{textAlign:'center'}}>Pay only for what<br/><span className="gold-text">you use</span></h2>
          <p className="section-sub" style={{textAlign:'center', margin:'0 auto 36px'}}>One-time event packs. No subscriptions. Packs never expire.</p>

          <div className="pricing-grid">
            {PRIMARY_PLANS.map((plan) => {
              const isStandard = plan.id === 'standard';
              return (
                <div
                  key={plan.id}
                  className="card"
                  style={isStandard ? {
                    padding:'24px 28px', display:'flex', flexDirection:'column', position:'relative',
                    borderColor:'var(--color-gold)',
                    boxShadow:'0 0 0 1px var(--color-gold), 0 16px 48px rgba(0,0,0,0.5)',
                    transform:'scale(1.02)',
                  } : { padding:'24px 28px', display:'flex', flexDirection:'column' }}
                >
                  {isStandard && (
                    <div style={{position:'absolute', top:-12, left:0, right:0, display:'flex', justifyContent:'center', gap:8, flexWrap:'wrap', padding:'0 12px'}}>
                      {plan.multiPackOffers.map((offer) => (
                        <span key={offer.label} style={{
                          background:'var(--color-gold)', color:'#0D0A14',
                          fontSize:'0.72rem', fontWeight:700,
                          padding:'4px 12px', borderRadius:'12px', whiteSpace:'nowrap',
                        }}>{offer.label} · {offer.discountLabel}</span>
                      ))}
                    </div>
                  )}

                  <div style={{marginBottom:16, marginTop: isStandard ? 8 : 0}}>
                    <span className={isStandard ? 'badge badge-gold' : 'badge badge-muted'}
                      style={isStandard ? {background:'rgba(240,192,96,0.1)', color:'var(--color-gold)', borderColor:'rgba(240,192,96,0.2)'} : undefined}>
                      {plan.name}
                    </span>
                  </div>
                  <h3 style={{fontSize:'1.3rem', fontWeight:700, marginBottom:8}}>{plan.name}</h3>
                  <p style={{color:'var(--text-secondary)', fontSize:'0.85rem', lineHeight:1.5, marginBottom:20, minHeight:40}}>{plan.tagline}</p>

                  <div style={{marginBottom:20}}>
                    <span style={{fontFamily:'DM Mono,monospace', fontSize:'2.2rem', fontWeight:500}}>{plan.priceLabel}</span>
                    <span style={{color:'var(--text-muted)', fontSize:'0.85rem'}}>
                      {plan.priceNumeric === 0 ? ' · no card needed' : ' / event'}
                    </span>
                  </div>
                  <p style={{color:'var(--text-muted)', fontSize:'0.75rem', marginBottom:24}}>
                    {plan.priceNumeric === 0 ? 'One-time trial only' : 'Pack never expires'}
                  </p>

                  <div className="gold-divider" style={{margin:'0 0 20px 0', opacity:0.5}} />

                  <div style={{display:'flex', flexDirection:'column', gap:12, flex:1, marginBottom:24}}>
                    <div style={{display:'flex', gap:10, fontSize:'0.85rem', color:'var(--text-secondary)'}}><span style={{color:'#4ADE80'}}>✓</span> {plan.events} event{plan.events>1?'s':''}</div>
                    <div style={{display:'flex', gap:10, fontSize:'0.85rem', color:'var(--text-secondary)'}}><span style={{color:'#4ADE80'}}>✓</span> {plan.photos.toLocaleString('en-IN')} photos</div>
                    <div style={{display:'flex', gap:10, fontSize:'0.85rem', color:'var(--text-secondary)'}}><span style={{color:'#4ADE80'}}>✓</span> {plan.guestScans.toLocaleString('en-IN')} guest scans</div>
                    <div style={{display:'flex', gap:10, fontSize:'0.85rem', color:'var(--text-secondary)'}}><span style={{color:'#4ADE80'}}>✓</span> {plan.fileLimitMB} MB file limit</div>
                    <div style={{display:'flex', gap:10, fontSize:'0.85rem', color:'var(--text-secondary)'}}><span style={{color:'#4ADE80'}}>✓</span> RAW files supported</div>
                  </div>

                  {isStandard && (
                    <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:20, padding:'12px 14px', background:'rgba(240,192,96,0.06)', border:'1px solid rgba(240,192,96,0.18)', borderRadius:12}}>
                      <p style={{fontSize:'0.72rem', color:'var(--color-gold)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', margin:0}}>Save with multi-event packs</p>
                      {plan.multiPackOffers.map((offer) => (
                        <div key={offer.label} style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8, fontSize:'0.8rem', color:'var(--text-secondary)'}}>
                          <span><strong style={{color:'var(--text-primary)'}}>{offer.label}</strong> · {offer.perEventLabel} · {offer.saveLabel}</span>
                          <span style={{fontFamily:'DM Mono,monospace', fontWeight:600, color:'var(--text-primary)'}}>{offer.priceLabel}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className={isStandard ? 'btn-primary' : 'btn-ghost'}
                    style={isStandard
                      ? {width:'100%', padding:'12px'}
                      : {width:'100%', borderColor:'rgba(255,255,255,0.2)', color:'var(--text-primary)'}}
                  >
                    {plan.cta} ↗
                  </button>
                </div>
              );
            })}
          </div>

          {/* ADD-ONS */}
          <div style={{marginTop:'48px', maxWidth:'900px', margin:'48px auto 0'}}>
            <p className="section-label" style={{textAlign:'center'}}>Add-ons</p>
            <h3 style={{textAlign:'center', fontFamily:'Playfair Display,serif', fontSize:'1.5rem', fontWeight:700, marginBottom:24}}>Stack any pack with more</h3>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16}}>
              {ADDONS.map((a) => (
                <div key={a.id} className="card" style={{padding:'22px 24px', display:'flex', flexDirection:'column'}}>
                  <h4 style={{fontSize:'1.05rem', fontWeight:700, marginBottom:8}}>{a.name}</h4>
                  <p style={{color:'var(--text-secondary)', fontSize:'0.85rem', lineHeight:1.55, marginBottom:16, flex:1}}>{a.description}</p>
                  <div>
                    <span style={{fontFamily:'DM Mono,monospace', fontSize:'1.7rem', fontWeight:500}}>{a.priceLabel}</span>
                    <span style={{color:'var(--text-muted)', fontSize:'0.85rem'}}> {a.unitLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p style={{textAlign:'center', fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.8, marginTop:32}}>
            All prices include GST · Packs never expire · No hidden fees
          </p>
        </div>
      </section>

      {/* CTA SECTION */}
      <div className="cta-section">
        <div className="gold-divider" style={{maxWidth:'300px', margin:'0 auto 60px'}}></div>
        <p style={{fontFamily:'Playfair Display,serif', fontSize:'clamp(2rem,4vw,3.5rem)', fontWeight:800, letterSpacing:'-0.02em', marginBottom:'16px'}} className="gold-text">
          Every photo tells a story.
        </p>
        <p style={{color:'var(--text-secondary)', fontSize:'1.1rem', marginBottom:'40px', lineHeight:1.7}}>
          Make sure yours isn't missed.<br />Join 500+ photographers already using EventSnap.
        </p>
        {/* FIX: was width:100% inline — now cta-btns class handles responsive */}
        <div className="cta-btns" style={{maxWidth:520, margin:'0 auto'}}>
          <a className="btn-primary" href="#events" style={{fontSize:'1.05rem', padding:'15px 34px'}}>Find My Photos →</a>
          <Link
            href="/auth/login"
            style={{
              display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
              background:'transparent', border:'2px solid rgba(240,192,96,0.50)', color:'#F0C060',
              fontWeight:700, fontFamily:'Inter,sans-serif', fontSize:'1.05rem', borderRadius:14,
              padding:'14px 32px', cursor:'pointer',
              transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow:'0 0 20px rgba(240,192,96,0.10)', whiteSpace:'nowrap', textDecoration:'none',
            }}
            onMouseOver={e => { e.currentTarget.style.background='rgba(240,192,96,0.10)'; e.currentTarget.style.borderColor='rgba(240,192,96,0.80)'; e.currentTarget.style.transform='translateY(-2px)'; }}
            onMouseOut={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='rgba(240,192,96,0.50)'; e.currentTarget.style.transform='translateY(0)'; }}
          >
            ✦ Photographer Sign In
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div>
            <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px'}}>
              <div className="logo-mark">✦</div>
              <span style={{fontFamily:'Playfair Display,serif', fontWeight:700, fontSize:'1.15rem'}} className="gold-text">EventSnap</span>
            </div>
            <p className="footer-brand-desc">AI-powered event photo delivery for Indian celebrations. Built with love for the moments that matter most.</p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <Link href="/#features">Features</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div className="footer-col">
            <h4>Photographers</h4>
            <Link href="/photographer">Dashboard</Link>
            <Link href="/auth/login">Sign in</Link>
            <Link href="/auth/signup">Create account</Link>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms of service</Link>
            <Link href="/refund">Refund policy</Link>
            <Link href="/contact">Contact us</Link>
          </div>
        </div>
        <div className="footer-bottom" style={{flexDirection:'column', alignItems:'center', gap:'8px', textAlign:'center'}}>
          <p style={{color:'rgba(255,255,255,0.25)', fontSize:'11px', fontFamily:'Inter,sans-serif'}}>© 2025 EventSnap · Made with ♥ for Indian celebrations</p>
          <p style={{color:'rgba(255,255,255,0.25)', fontSize:'11px', fontFamily:'Inter,sans-serif'}}>Operated by Dharmendra kumar, Mangalagiri AP 522503</p>
          <p style={{color:'rgba(255,255,255,0.25)', fontSize:'11px', fontFamily:'Inter,sans-serif'}}>support@eventsnap.in</p>
        </div>
        <div style={{textAlign:'center', marginTop:'32px'}}>
          <Link href="/admin" style={{color:'rgba(255,255,255,0.15)', fontSize:'10px', textDecoration:'none'}}>Admin</Link>
        </div>
      </footer>

      {/* SIGNUP MODAL */}
      {showSignup && (
        <div id="signup-modal" onClick={(e) => { if (e.target.id === 'signup-modal') closeSignup(); }}>
          <div className="signup-box">
            <button className="modal-close" onClick={closeSignup}>✕</button>
            {signupStage === 'form' ? (
              <div>
                <div className="signup-header">
                  <div style={{display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(240,192,96,0.08)', border:'1px solid rgba(240,192,96,0.20)', borderRadius:'20px', padding:'5px 14px', marginBottom:'20px', fontSize:'0.75rem', fontWeight:600, color:'var(--color-gold)', letterSpacing:'0.04em'}}>
                    ✦ &nbsp;Join 500+ photographers
                  </div>
                  <h2 style={{fontFamily:'Playfair Display,serif', fontWeight:800, fontSize:'1.85rem', letterSpacing:'-0.02em', lineHeight:1.15, marginBottom:'10px'}}>
                    <span className="gold-text">Start delivering</span><br/>your photos with AI
                  </h2>
                  <p style={{color:'rgba(255,255,255,0.50)', fontSize:'0.9rem', lineHeight:1.6, marginBottom:0}}>Free 14-day trial · No credit card required</p>
                </div>
                <div className="signup-body">
                  <button className="google-btn" onClick={handleGoogleSignIn}>
                    <svg width="20" height="20" viewBox="0 0 48 48">
                      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3-11.4-7.3l-6.5 5C9.5 39.4 16.3 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41 35.3 44 30 44 24c0-1.3-.1-2.7-.4-4z"/>
                    </svg>
                    Continue with Google
                  </button>
                  <div className="divider-or"><span>or fill in your details</span></div>
                  {signupError && <div style={{color:'var(--color-error)', fontSize:'0.8rem', marginBottom:'12px', textAlign:'center'}}>{signupError}</div>}
                  <form onSubmit={handleFormSubmit}>
                    <div className="field-wrap">
                      <label className="field-label">Your full name</label>
                      <input className="input-field" type="text" placeholder="Rahul Khanna" value={form.fullName} onChange={handleSignupChange('fullName')} />
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">Your email</label>
                      <input className="input-field" type="email" placeholder="rahul@example.com" value={form.email} onChange={handleSignupChange('email')} />
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">Password</label>
                      <input className="input-field" type="password" placeholder="Min 6 characters" value={form.password} onChange={handleSignupChange('password')} />
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">Your City <span style={{color:'rgba(255,255,255,0.20)', fontWeight:400, textTransform:'none', letterSpacing:0}}>(optional)</span></label>
                      <input className="input-field" type="text" placeholder="Enter your city" value={form.city} onChange={e => setForm({...form, city:e.target.value})} />
                    </div>
                    <button type="submit" className="btn-primary btn-full" disabled={signupLoading} style={{padding:'15px', fontSize:'1rem', borderRadius:14, opacity:signupLoading?0.7:1, cursor:signupLoading?'not-allowed':'pointer'}}>
                      {signupLoading ? 'Creating account…' : 'Create my free account →'}
                    </button>
                  </form>
                  <div className="trust-micro">
                    <span>🔒 Secure & encrypted</span>
                    <span>✦ No credit card</span>
                    <span>📱 Direct photo delivery</span>
                  </div>
                  <div style={{borderTop:'1px solid rgba(255,220,150,0.08)', marginTop:20, paddingTop:20, textAlign:'center'}}>
                    <p style={{color:'rgba(255,255,255,0.30)', fontSize:'0.82rem', marginBottom:12}}>Already have an account?</p>
                    <Link href="/auth/login" onClick={closeSignup} style={{display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.70)', fontWeight:600, fontFamily:'Inter,sans-serif', fontSize:'0.9rem', borderRadius:12, padding:'11px 28px', cursor:'pointer', transition:'all 0.25s ease', textDecoration:'none', width:'100%'}}>
                      Sign In →
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="welcome-screen">
                <div className="confetti-burst">🎉</div>
                <h2 style={{fontFamily:'Playfair Display,serif', fontWeight:800, fontSize:'2rem', letterSpacing:'-0.02em', marginBottom:'12px'}} className="gold-text">Welcome aboard!</h2>
                <p style={{color:'rgba(255,255,255,0.65)', fontSize:'1rem', lineHeight:1.7, marginBottom:'8px'}}>You're all set, {signupSuccessName}! Your 14-day Pro trial starts today.</p>
                <p style={{color:'rgba(255,255,255,0.40)', fontSize:'0.88rem', lineHeight:1.7, marginBottom:'32px'}}>Let's set up your first event.</p>
                <Link href="/photographer" className="btn-primary btn-full" style={{padding:'14px', fontSize:'1rem', borderRadius:'14px', textDecoration:'none', display:'flex', justifyContent:'center'}}>
                  Go to my dashboard →
                </Link>
                <button onClick={closeSignup} style={{background:'none', border:'none', color:'rgba(255,255,255,0.30)', fontSize:'0.82rem', marginTop:'14px', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>I'll explore later</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
