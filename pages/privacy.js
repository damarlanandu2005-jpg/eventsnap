import Head from 'next/head';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — EventSnap</title>
        <meta name="description" content="EventSnap Privacy Policy — how we handle your data." />
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
              }}>Privacy Policy</h1>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '13px',
                color: 'rgba(255,255,255,0.40)', margin: '0 0 24px',
                letterSpacing: '0.05em', textTransform: 'uppercase'
              }}>Last updated: April 2025</p>
              {/* Gold divider */}
              <div style={{
                height: '1px', margin: '0 auto',
                background: 'linear-gradient(90deg, transparent 0%, rgba(240,192,96,0.5) 30%, rgba(240,192,96,0.8) 50%, rgba(240,192,96,0.5) 70%, transparent 100%)'
              }} />
            </div>

            {/* Sections */}
            {[
              {
                title: 'What We Collect',
                body: 'When a guest uploads a selfie, we temporarily process it to find matching event photos. The selfie is deleted immediately after matching completes. We do not store face vectors, biometric templates, or any identifying data beyond what is needed to complete the match.'
              },
              {
                title: 'What We Do NOT Store',
                body: 'We do not retain selfies after matching. We do not build facial databases. We do not share data with third parties beyond AWS Rekognition, which processes matching and is bound by its own Data Processing Agreement. No biometric profile is ever created or stored for any guest.'
              },
              {
                title: 'Photographer Data',
                body: 'Photographers provide their name, email address, and phone number during registration. This information is used only to manage their EventSnap account and send essential service communications. We do not sell or share photographer data with any third party.'
              },
              {
                title: 'Payments',
                body: 'Payment information is processed entirely by Razorpay, India\'s leading payment gateway. EventSnap never stores card numbers, UPI IDs, or any payment credentials. All transactions are PCI DSS compliant and settled in Indian Rupees to your registered bank account.'
              },
              {
                title: 'Cookies',
                body: 'EventSnap uses minimal cookies required for authentication and payment processing. We do not use advertising cookies or tracking cookies. You may accept or decline non-essential cookies via the banner shown on your first visit.'
              },
              {
                title: 'Your Rights',
                body: 'Under India\'s Digital Personal Data Protection Act (DPDPA) 2023, you have the right to access, correct, and request deletion of your personal data. To exercise these rights, contact us at the email below. We will respond within 7 business days.'
              },
            ].map((section, i) => (
              <div key={i} style={{ marginBottom: '40px' }}>
                <h2 style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontWeight: '700', fontSize: '22px',
                  color: 'rgba(255,255,255,0.95)',
                  margin: '0 0 12px'
                }}>{section.title}</h2>
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '15px',
                  color: 'rgba(255,255,255,0.70)',
                  lineHeight: '1.8', margin: '0'
                }}>{section.body}</p>
              </div>
            ))}

            {/* Contact section */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: '700', fontSize: '22px',
                color: 'rgba(255,255,255,0.95)', margin: '0 0 12px'
              }}>Contact</h2>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '15px',
                color: 'rgba(255,255,255,0.70)', lineHeight: '1.8', margin: '0 0 8px'
              }}>For privacy questions or data deletion requests:</p>
              <a href="mailto:privacy@eventsnap.in" style={{
                color: '#F0C060', fontFamily: 'Inter, sans-serif',
                fontSize: '15px', textDecoration: 'none'
              }}>privacy@eventsnap.in</a>
            </div>

            {/* Gold divider */}
            <div style={{
              height: '1px', margin: '40px 0',
              background: 'linear-gradient(90deg, transparent 0%, rgba(240,192,96,0.5) 30%, rgba(240,192,96,0.8) 50%, rgba(240,192,96,0.5) 70%, transparent 100%)'
            }} />

            {/* Back link */}
            <Link href="/" style={{
              color: 'rgba(255,255,255,0.40)', fontFamily: 'Inter, sans-serif',
              fontSize: '14px', textDecoration: 'none'
            }}>← Back to home</Link>

          </div>
        </div>
      </div>
    </>
  );
}
