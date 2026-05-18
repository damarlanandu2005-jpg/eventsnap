import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(13, 10, 20, 0.95)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '16px 24px',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '16px'
    }}>
      <p style={{
        margin: 0,
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '13px',
        fontFamily: 'Inter, sans-serif',
        lineHeight: '1.5',
        maxWidth: '600px'
      }}>
        We use cookies to improve your experience and process payments via Razorpay. No tracking cookies.
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Link href="/privacy" style={{
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.4)',
          textDecoration: 'none',
          padding: '8px 12px',
          borderRadius: '8px',
          transition: 'color 0.2s'
        }} onMouseOver={e => e.currentTarget.style.color = 'white'} onMouseOut={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'}>
          Learn more
        </Link>
        <button
          onClick={handleAccept}
          style={{
            background: 'linear-gradient(135deg, #E8A830, #F0C060)',
            color: '#0D0A14',
            border: 'none',
            padding: '8px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'transform 0.1s'
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
