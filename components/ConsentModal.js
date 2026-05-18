import { useState } from 'react';

export default function ConsentModal({ onAccept, onClose, eventName }) {
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const canProceed = checked1 && checked2;

  function Check({ checked, onChange, label }) {
    return (
      <label className="consent-check" onClick={() => onChange(!checked)}>
        <div className={`check-box ${checked ? 'checked' : ''}`}>
          <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
            <path
              className={`check-svg ${checked ? 'drawn' : ''}`}
              d="M1 5L5 9L12 1"
              stroke="#F0C060"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>{label}</span>
      </label>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <h2 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.6rem',
            fontWeight: 700,
            marginBottom: 8,
          }} className="gold-text">Your Privacy First</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Before we find your photos{eventName ? ` from ${eventName}` : ''}, please review how we handle your selfie.
          </p>
        </div>

        <div className="gold-divider" style={{ margin: '1.5rem 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <Check
            checked={checked1}
            onChange={setChecked1}
            label="I understand my selfie will be used only to find my photos and will be deleted immediately after matching."
          />
          <Check
            checked={checked2}
            onChange={setChecked2}
            label="I consent to EventSnap processing my photo for face recognition at this event only."
          />
        </div>

        <div style={{
          background: 'rgba(240,192,96,0.05)',
          border: '1px solid rgba(240,192,96,0.15)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          ✦ No face data is stored · Your selfie is deleted in &lt;60 seconds · No third parties
        </div>

        <button
          className="btn-primary"
          onClick={onAccept}
          disabled={!canProceed}
          style={{ marginBottom: 10, width: '100%' }}
        >
          Continue to Find My Photos →
        </button>
        {onClose && (
          <button className="btn-ghost" onClick={onClose} style={{ width: '100%' }}>
            Maybe later
          </button>
        )}
      </div>
    </div>
  );
}
