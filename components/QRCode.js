import { useEffect, useState, useRef } from 'react';
import QRCodeLib from 'qrcode';

// ─────────────────────────────────────────────────────────────
// QRCode component
// Generates a QR code for a given URL and renders it as a canvas.
// Includes a download button for saving as PNG.
//
// Usage:
//   <QRCode url="https://eventsnap.com/event/wedding" label="Scan to find your photos" />
// ─────────────────────────────────────────────────────────────

export default function QRCode({ url, label, size = 200 }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) return;

    QRCodeLib.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: {
        dark: '#1e1b4b',   // indigo-950
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    }).catch(() => setError(true));
  }, [url, size]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `eventsnap-qr-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  if (error) return null;

  return (
    <div className="text-center">
      <div className="inline-block p-3 bg-white rounded-2xl shadow-lg">
        <canvas ref={canvasRef} className="rounded-lg" />
      </div>
      {label && <p className="text-xs text-white/40 mt-2">{label}</p>}
      <button
        onClick={handleDownload}
        className="mt-2 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
      >
        Download QR Code
      </button>
    </div>
  );
}
