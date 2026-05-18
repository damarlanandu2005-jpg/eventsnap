import Head from 'next/head';
import Link from 'next/link';
import { ALL_PACKS, ADDONS } from '@/lib/pricing';

export default function RefundPolicy() {
  return (
    <>
      <Head>
        <title>Refund Policy — EventSnap</title>
        <meta name="description" content="EventSnap Refund Policy — when and how refunds are processed." />
      </Head>

      <div style={{ background: '#0D0A14', minHeight: '100vh' }}>

        {/* Navbar */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(13,10,20,0.90)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          height: '64px', display: 'flex', alignItems: 'center',
          padding: '0 24px'
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#E8A830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'white', fontWeight:700, boxShadow:'0 0 20px rgba(124,58,237,0.4)' }}>✦</div>
            <span style={{ fontFamily:'Playfair Display,serif', fontWeight:700, fontSize:'1.2rem', background:'linear-gradient(135deg,#F0C060,#F7D98A,#E8A830)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>EventSnap</span>
          </Link>
        </nav>

        {/* Background glow */}
        <div style={{
          background: `
            radial-gradient(ellipse 70% 50% at 15% 15%, rgba(124,58,237,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 85% 85%, rgba(240,192,96,0.10) 0%, transparent 55%),
            #0D0A14`,
          minHeight: 'calc(100vh - 64px)',
          padding: '80px 24px'
        }}>
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <h1 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: '700', fontSize: 'clamp(2rem, 5vw, 2.75rem)',
                color: 'rgba(255,255,255,0.95)', margin: '0 0 12px'
              }}>Refund Policy</h1>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '13px',
                color: 'rgba(255,255,255,0.40)', margin: '0 0 24px'
              }}>Last updated: April 2025</p>
              <div style={{
                height: '1px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(240,192,96,0.5) 30%, rgba(240,192,96,0.8) 50%, rgba(240,192,96,0.5) 70%, transparent 100%)'
              }} />
            </div>

            {/* Overview */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: '700', fontSize: '22px',
                color: 'rgba(255,255,255,0.95)', margin: '0 0 12px'
              }}>Overview</h2>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8', margin: '0'
              }}>At EventSnap, we want you to be completely satisfied with our service. This policy explains when and how refunds are processed. Please read it carefully before making a purchase.</p>
            </div>

            {/* Event packs */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(240,192,96,0.15)',
              borderRadius: '16px', padding: '24px',
              marginBottom: '40px'
            }}>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: '700', fontSize: '22px',
                color: 'rgba(255,255,255,0.95)', margin: '0 0 12px'
              }}>Event Packs — One-Time Purchases</h2>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8', margin: '0 0 16px'
              }}>We sell event packs as one-time purchases. There are no recurring subscriptions. All packs include 50 MB file uploads and RAW file support.</p>

              {/* Pack list */}
              {ALL_PACKS.map((pack, i) => (
                <div key={pack.id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '10px 0',
                  borderBottom: i < ALL_PACKS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'
                }}>
                  <div>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.90)' }}>{pack.name}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.40)', display: 'block' }}>
                      {pack.events} event{pack.events > 1 ? 's' : ''}, {(pack.photosPerEvent || pack.photos).toLocaleString('en-IN')} photos{pack.events > 1 ? '/event' : ''}, {(pack.guestScansPerEvent || pack.guestScans).toLocaleString('en-IN')} guest scans{pack.events > 1 ? '/event' : ''}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: '700', color: '#F0C060' }}>{pack.priceLabel}</span>
                </div>
              ))}

              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8',
                margin: '16px 0 0'
              }}>Unused event packs — where no event has been created and no photos have been uploaded — are eligible for a full refund within 7 days of purchase. Once an event has been created or photos have been uploaded and indexed, the pack is considered used and no refund will be issued.</p>
            </div>

            {/* Add-ons */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: '700', fontSize: '22px',
                color: 'rgba(255,255,255,0.95)', margin: '0 0 12px'
              }}>Add-ons</h2>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8', margin: '0 0 16px'
              }}>Add-ons are non-refundable once applied to an event. Unused add-ons that have not yet been associated with an event may be refunded within 7 days of purchase.</p>
              {ADDONS.map((a, i) => (
                <div key={a.id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '10px 0',
                  borderBottom: i < ADDONS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'
                }}>
                  <div>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.90)' }}>{a.name}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.40)', display: 'block' }}>{a.description}</span>
                  </div>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: '700', color: '#F0C060', whiteSpace: 'nowrap' }}>{a.priceLabel} <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', fontWeight:500 }}>{a.unitLabel}</span></span>
                </div>
              ))}
            </div>

            {/* Technical failures */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: '700', fontSize: '22px',
                color: 'rgba(255,255,255,0.95)', margin: '0 0 12px'
              }}>Technical Failures</h2>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8', margin: '0 0 12px'
              }}>If EventSnap experiences a technical failure that prevents you from using a paid service for more than 24 consecutive hours, you are entitled to a pro-rated credit for the affected period. This credit is applied to your next billing cycle, not issued as a cash refund.</p>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8', margin: '0'
              }}>If face matching fails consistently due to a bug on our end, we will investigate and provide a credit or refund at our discretion after review.</p>
            </div>

            {/* How to request */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: '700', fontSize: '22px',
                color: 'rgba(255,255,255,0.95)', margin: '0 0 12px'
              }}>How to Request a Refund</h2>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8', margin: '0 0 16px'
              }}>Email us at <a href="mailto:refunds@eventsnap.in" style={{ color: '#F0C060', textDecoration: 'none' }}>refunds@eventsnap.in</a> with the following information:</p>

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', padding: '16px 20px'
              }}>
                {[
                  'Your registered email address',
                  'Order ID or subscription ID (from your billing dashboard)',
                  'Reason for the refund request',
                  'Date of purchase',
                ].map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '10px',
                    padding: '6px 0',
                    borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none'
                  }}>
                    <span style={{ color: '#F0C060', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>•</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.70)' }}>{item}</span>
                  </div>
                ))}
              </div>

              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8',
                margin: '16px 0 0'
              }}>We will respond within 3 business days. Approved refunds are processed within 5–7 business days and credited to the original payment method.</p>
            </div>

            {/* Chargebacks */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: '700', fontSize: '22px',
                color: 'rgba(255,255,255,0.95)', margin: '0 0 12px'
              }}>Chargebacks</h2>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8', margin: '0'
              }}>We encourage customers to contact us before initiating a chargeback. Chargebacks filed without contacting us first may result in account suspension pending investigation. We are always happy to resolve genuine issues directly and quickly.</p>
            </div>

            {/* Contact */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: '700', fontSize: '22px',
                color: 'rgba(255,255,255,0.95)', margin: '0 0 12px'
              }}>Contact Us</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: 'rgba(255,255,255,0.70)' }}>
                  Refund queries: <a href="mailto:refunds@eventsnap.in" style={{ color: '#F0C060', textDecoration: 'none' }}>refunds@eventsnap.in</a>
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: 'rgba(255,255,255,0.70)' }}>
                  General support: <a href="mailto:support@eventsnap.in" style={{ color: '#F0C060', textDecoration: 'none' }}>support@eventsnap.in</a>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{
              height: '1px', margin: '40px 0',
              background: 'linear-gradient(90deg, transparent 0%, rgba(240,192,96,0.5) 30%, rgba(240,192,96,0.8) 50%, rgba(240,192,96,0.5) 70%, transparent 100%)'
            }} />

            {/* Navigation */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <Link href="/" style={{ color: 'rgba(255,255,255,0.40)', fontFamily: 'Inter, sans-serif', fontSize: '14px', textDecoration: 'none' }}>← Back to home</Link>
              <Link href="/terms" style={{ color: '#F0C060', fontFamily: 'Inter, sans-serif', fontSize: '14px', textDecoration: 'none' }}>Terms of Service →</Link>
              <Link href="/privacy" style={{ color: '#F0C060', fontFamily: 'Inter, sans-serif', fontSize: '14px', textDecoration: 'none' }}>Privacy Policy →</Link>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
