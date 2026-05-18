import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DashboardRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/photographer');
  }, [router]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0D0A14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'linear-gradient(135deg,#7C3AED,#E8A830)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          color: 'white',
          fontWeight: 700,
          margin: '0 auto 16px',
          boxShadow: '0 0 24px rgba(124,58,237,0.40)',
        }}>✦</div>
        <div style={{
          width: 28,
          height: 28,
          border: '2px solid rgba(240,192,96,0.20)',
          borderTopColor: '#F0C060',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto',
        }} />
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  );
}
