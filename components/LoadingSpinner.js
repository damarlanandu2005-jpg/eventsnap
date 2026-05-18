export default function LoadingSpinner({ message = 'Finding your memories...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div className="mandala-loader" style={{ width: 72, height: 72, position: 'relative' }}>
        <div
          className="mandala-ring ring-outer"
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent',
            borderTopColor: 'rgba(240,192,96,0.8)', borderRightColor: 'rgba(240,192,96,0.3)',
            animation: 'spin-slow 1.4s linear infinite'
          }}
        />
        <div
          className="mandala-ring ring-mid"
          style={{
            position: 'absolute', inset: 10, borderRadius: '50%', border: '2px solid transparent',
            borderTopColor: 'rgba(167,139,250,0.7)', borderLeftColor: 'rgba(167,139,250,0.3)',
            animation: 'spin-slow 1s linear infinite reverse'
          }}
        />
        <div
          className="mandala-ring ring-inner"
          style={{
            position: 'absolute', inset: 22, borderRadius: '50%', border: '2px solid transparent',
            borderTopColor: 'rgba(240,192,96,0.9)',
            animation: 'spin-slow 0.7s linear infinite'
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, color: 'var(--color-gold)'
        }}>✦</div>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontStyle: 'italic' }}>{message}</p>
    </div>
  );
}
