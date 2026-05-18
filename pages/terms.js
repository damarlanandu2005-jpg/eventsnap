import Head from 'next/head';
import Link from 'next/link';

export default function TermsOfService() {
  return (
    <>
      <Head>
        <title>Terms of Service — EventSnap</title>
        <meta name="description" content="EventSnap Terms of Service." />
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
              }}>Terms of Service</h1>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '13px',
                color: 'rgba(255,255,255,0.40)', margin: '0 0 24px'
              }}>Last updated: April 2025</p>
              <div style={{
                height: '1px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(240,192,96,0.5) 30%, rgba(240,192,96,0.8) 50%, rgba(240,192,96,0.5) 70%, transparent 100%)'
              }} />
            </div>

            {/* Sections */}
            {[
              {
                num: '1.', title: 'Acceptance of Terms',
                body: 'By using EventSnap, you agree to these terms. If you do not agree, please do not use our service. These terms apply to all visitors, photographers, and guests who use EventSnap in any capacity.'
              },
              {
                num: '2.', title: 'Description of Service',
                body: 'EventSnap provides AI-powered event photo matching and delivery services. Photographers upload event galleries. Guests upload a selfie to find their photos. The service is accessed via web browser — no app download required.'
              },
              {
                num: '3.', title: 'Photographer Accounts',
                body: 'Photographers must register with accurate information. You are responsible for all content uploaded to your account. EventSnap reserves the right to suspend accounts that violate these terms or upload illegal, harmful, or infringing content.'
              },
              {
                num: '4.', title: 'Guest Use',
                body: 'Guests use the service free of charge to find photos from events they attended. Selfies submitted are used only for face matching and are deleted immediately after matching completes. No account creation is required for guests.'
              },
              {
                num: '5.', title: 'Payments and Billing',
                body: 'EventSnap is sold as one-time event packs and add-ons. There are no recurring subscriptions. All payments are processed by Razorpay and are subject to our Refund Policy. Prices are in Indian Rupees and include GST where applicable. EventSnap reserves the right to change pricing with 30 days notice; previously-purchased packs are honoured at their original price.'
              },
              {
                num: '6.', title: 'Intellectual Property',
                body: 'Photographers retain full ownership of all photos they upload. EventSnap does not claim ownership of any uploaded content. By uploading, photographers grant EventSnap a limited licence to process and deliver photos to guests as instructed.'
              },
              {
                num: '7.', title: 'Privacy and Data',
                body: 'Your data is handled as described in our Privacy Policy. Face matching data is never stored beyond the matching session. We comply with India\'s Digital Personal Data Protection Act (DPDPA) 2023.'
              },
              {
                num: '8.', title: 'Limitation of Liability',
                body: 'EventSnap is not liable for loss of data, missed events, or service interruptions beyond amounts paid in the preceding 30 days. The service is provided as-is without warranties of any kind.'
              },
              {
                num: '9.', title: 'Governing Law',
                body: 'These terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of courts in Andhra Pradesh, India.'
              },
            ].map((section, i) => (
              <div key={i} style={{ marginBottom: '40px' }}>
                <h2 style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontWeight: '700', fontSize: '22px',
                  color: 'rgba(255,255,255,0.95)',
                  margin: '0 0 12px'
                }}>{section.num} {section.title}</h2>
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '15px',
                  color: 'rgba(255,255,255,0.70)',
                  lineHeight: '1.8', margin: '0'
                }}>{section.body}</p>
              </div>
            ))}

            {/* Contact */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: '700', fontSize: '22px',
                color: 'rgba(255,255,255,0.95)', margin: '0 0 12px'
              }}>10. Contact</h2>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8', margin: '0 0 8px'
              }}>For legal or terms-related questions:</p>
              <a href="mailto:legal@eventsnap.in" style={{
                color: '#F0C060', fontFamily: 'Inter, sans-serif',
                fontSize: '15px', textDecoration: 'none'
              }}>legal@eventsnap.in</a>
            </div>

            {/* Divider */}
            <div style={{
              height: '1px', margin: '40px 0',
              background: 'linear-gradient(90deg, transparent 0%, rgba(240,192,96,0.5) 30%, rgba(240,192,96,0.8) 50%, rgba(240,192,96,0.5) 70%, transparent 100%)'
            }} />

            {/* Navigation links */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <Link href="/" style={{ color: 'rgba(255,255,255,0.40)', fontFamily: 'Inter, sans-serif', fontSize: '14px', textDecoration: 'none' }}>← Back to home</Link>
              <Link href="/refund" style={{ color: '#F0C060', fontFamily: 'Inter, sans-serif', fontSize: '14px', textDecoration: 'none' }}>Refund Policy →</Link>
              <Link href="/privacy" style={{ color: '#F0C060', fontFamily: 'Inter, sans-serif', fontSize: '14px', textDecoration: 'none' }}>Privacy Policy →</Link>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
