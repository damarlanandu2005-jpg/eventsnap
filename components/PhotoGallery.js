import { useState, useEffect } from 'react';

export default function PhotoGallery({ photos, sessionId }) {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    if (!photos) return;
    photos.forEach((p, i) => {
      setTimeout(() => setVisible(v => [...v, p.id || i]), i * 80);
    });
  }, [photos]);

  const handleDownloadSingle = async (photo) => {
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.filename || 'photo.jpg';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download photo.');
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 16,
    }}>
      {photos.map((photo, i) => {
        const key = photo.id || i;
        const isVisible = visible.includes(key);
        // Ensure confidence is between 0 and 100 for display
        const conf = photo.similarity ? Math.round(photo.similarity) : 95;

        return (
          <div
            key={key}
            style={{
              position: 'relative',
              borderRadius: 16,
              overflow: 'hidden',
              cursor: 'pointer',
              aspectRatio: '4/3',
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(12px)',
              transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.03)';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(240,192,96,0.50), 0 16px 40px rgba(0,0,0,0.60)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 3,
              background: 'rgba(255,255,255,0.1)',
            }}>
              <div style={{
                height: '100%',
                width: `${conf}%`,
                background: 'linear-gradient(90deg, #E8A830, #F7D98A)',
                borderRadius: 2,
              }} />
            </div>
            <img src={photo.url} alt={`Photo ${i + 1}`} loading="lazy" style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block'
            }} />
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              padding: 12,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'flex-end',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.78rem',
                  fontFamily: 'DM Mono, monospace',
                }}>{conf}% match</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownloadSingle(photo); }}
                  style={{
                    background: 'rgba(240,192,96,0.90)',
                    color: '#0D0A14',
                    border: 'none',
                    borderRadius: 8,
                    padding: '7px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#F0C060'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(240,192,96,0.90)'}
                >⬇ Save photo</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
