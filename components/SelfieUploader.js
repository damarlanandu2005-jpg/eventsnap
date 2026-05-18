import { useState, useRef, useCallback } from 'react';

export default function SelfieUploader({ onCapture }) {
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [mode, setMode] = useState('idle'); // idle | camera | preview
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const videoRef = useRef();
  const canvasRef = useRef();
  const fileInputRef = useRef();

  // ── Start camera ────────────────────────────────────────────
  const startCamera = useCallback(async (facing = 'user') => {
    setCameraError(null);
    // Stop any existing stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      setMode('camera');
      // Attach to video element after render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      let msg = 'Camera not available.';
      if (err.name === 'NotAllowedError') msg = 'Camera permission denied. Please allow camera access or use the upload option.';
      else if (err.name === 'NotFoundError') msg = 'No camera found on this device. Please upload a photo instead.';
      else if (err.name === 'NotReadableError') msg = 'Camera is in use by another application.';
      setCameraError(msg);
      setMode('idle');
    }
  }, [cameraStream]);

  // ── Stop camera ─────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setMode(selfiePreview ? 'preview' : 'idle');
  }, [cameraStream, selfiePreview]);

  // ── Capture from camera ─────────────────────────────────────
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    // Mirror if front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setSelfiePreview(dataUrl);
    stopCamera();
    setMode('preview');
  }, [facingMode, stopCamera]);

  // ── File upload ─────────────────────────────────────────────
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate it's an image. RAW files often come through with empty or
    // non-image MIME types depending on browser/OS, so we also accept any
    // file whose extension looks like a known RAW format.
    const RAW_RE = /\.(cr2|cr3|crw|nef|nrw|arw|srf|sr2|dng|raf|rw2|orf|pef|srw|rwl|dcr|kdc|x3f|mrw|3fr|iiq|heic|heif)$/i;
    if (!file.type.startsWith('image/') && !RAW_RE.test(file.name || '')) {
      setCameraError('Please select a valid image file.');
      return;
    }
    // Validate size (max 50MB so RAW + high-MP JPEGs are accepted)
    if (file.size > 50 * 1024 * 1024) {
      setCameraError('Image too large. Please choose a file under 50MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      setSelfiePreview(ev.target.result);
      setMode('preview');
      setCameraError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Flip camera ─────────────────────────────────────────────
  const flipCamera = useCallback(() => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    startCamera(newFacing);
  }, [facingMode, startCamera]);

  // ── Retake ─────────────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setSelfiePreview(null);
    setMode('idle');
    setCameraError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Find photos ────────────────────────────────────────────
  const handleFindPhotos = useCallback(() => {
    if (!selfiePreview) return;
    // Strip the data URL prefix
    const base64Data = selfiePreview.split(',')[1];
    onCapture(base64Data);
  }, [selfiePreview, onCapture]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 420 }}>
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── CAMERA MODE ── */}
      {mode === 'camera' && (
        <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              display: 'block',
            }}
          />
          {/* Camera overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.5))',
            pointerEvents: 'none',
          }} />
          {/* Face guide */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -58%)',
            width: 160, height: 200,
            border: '2px solid rgba(240,192,96,0.6)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }} />
          {/* Controls */}
          <div style={{
            position: 'absolute', bottom: 16, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20,
          }}>
            <button
              onClick={stopCamera}
              style={iconBtnStyle}
              title="Cancel"
            >✕</button>
            <button
              onClick={capturePhoto}
              style={{
                width: 68, height: 68, borderRadius: '50%',
                background: 'white', border: '4px solid rgba(240,192,96,0.8)',
                cursor: 'pointer', transition: 'transform 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26,
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              title="Capture"
            >📸</button>
            <button
              onClick={flipCamera}
              style={iconBtnStyle}
              title="Flip camera"
            >🔄</button>
          </div>
        </div>
      )}

      {/* ── PREVIEW MODE ── */}
      {mode === 'preview' && selfiePreview && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            position: 'relative',
            width: 220, height: 220, borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid rgba(240,192,96,0.70)',
            boxShadow: '0 0 30px rgba(240,192,96,0.25)',
          }}>
            <img
              src={selfiePreview}
              alt="Your selfie"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <button
            onClick={handleRetake}
            className="btn-ghost"
            style={{ fontSize: '0.85rem', padding: '8px 22px' }}
          >
            Retake
          </button>
        </div>
      )}

      {/* ── IDLE MODE ── */}
      {mode === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Empty circle prompt */}
          <div style={{
            position: 'relative',
            width: 200, height: 200, borderRadius: '50%',
            border: '2px dashed rgba(240,192,96,0.40)',
            background: 'radial-gradient(circle, rgba(240,192,96,0.06) 0%, rgba(124,58,237,0.05) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Pulse rings */}
            <div style={{ position:'absolute', inset:-12, borderRadius:'50%', border:'1px solid rgba(240,192,96,0.20)', animation:'pulse-ring 2.5s ease-in-out infinite' }} />
            <div style={{ position:'absolute', inset:-24, borderRadius:'50%', border:'1px solid rgba(240,192,96,0.10)', animation:'pulse-ring 2.5s ease-in-out 0.5s infinite' }} />
            <div style={{ textAlign:'center', padding: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>🤳</div>
              <p style={{ color:'var(--color-gold)', fontSize:'0.82rem', fontWeight:600, lineHeight:1.4 }}>
                Take or upload<br/>your selfie
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ── Error message ── */}
      {cameraError && (
        <div style={{
          background: 'rgba(248,113,113,0.10)',
          border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 10,
          padding: '10px 14px',
          color: '#F87171',
          fontSize: '0.82rem',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          {cameraError}
        </div>
      )}

      {/* ── Privacy note ── */}
      <p style={{ color:'var(--text-muted)', fontSize:'0.76rem', textAlign:'center', lineHeight:1.6 }}>
        Your selfie is deleted after matching · Private &amp; secure
      </p>

      {/* Divider */}
      {mode === 'preview' && selfiePreview && (
        <div className="gold-divider" style={{ margin: '0' }} />
      )}

      {/* ── Find Photos button ── */}
      <button
        className="btn-primary"
        onClick={handleFindPhotos}
        disabled={!selfiePreview || mode === 'camera'}
        style={{
          animation: selfiePreview ? 'glow-pulse 2s ease-in-out infinite' : 'none',
          opacity: (!selfiePreview || mode === 'camera') ? 0.5 : 1,
        }}
      >
        Find My Photos →
      </button>

      {mode === 'preview' && selfiePreview && (
        <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'0.78rem', marginTop:-12 }}>
          Takes 5–15 seconds
        </p>
      )}

      {mode === 'idle' && (
        <div style={{ display:'flex', gap:10, width:'100%', maxWidth:320 }}>
          <button
            onClick={() => startCamera('user')}
            style={{
              flex: 1,
              background: 'rgba(240,192,96,0.10)',
              border: '1px solid rgba(240,192,96,0.35)',
              borderRadius: 12,
              padding: '12px 8px',
              color: '#F0C060',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(240,192,96,0.18)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(240,192,96,0.10)'}
          >
            <span style={{ fontSize: 22 }}>📷</span>
            Open Camera
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              background: 'rgba(124,58,237,0.10)',
              border: '1px solid rgba(124,58,237,0.35)',
              borderRadius: 12,
              padding: '12px 8px',
              color: '#A78BFA',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(124,58,237,0.18)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(124,58,237,0.10)'}
          >
            <span style={{ fontSize: 22 }}>🖼️</span>
            Upload Photo
          </button>
        </div>
      )}
    </div>
  );
}

const iconBtnStyle = {
  width: 44, height: 44, borderRadius: '50%',
  background: 'rgba(255,255,255,0.15)',
  border: '1px solid rgba(255,255,255,0.25)',
  color: 'white', fontSize: '1rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'all 0.2s',
  backdropFilter: 'blur(10px)',
};
