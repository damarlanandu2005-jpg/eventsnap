import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PhotographerLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/auth/login');
  }, [router]);
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0A14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: 32, height: 32,
        border: '2px solid rgba(240,192,96,0.2)',
        borderTopColor: '#F0C060',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
