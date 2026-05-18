import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Contact() {
  const [toast, setToast] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setToast('Message sent successfully! We will get back to you soon.');
    setTimeout(() => setToast(''), 3000);
    e.target.reset();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0D0A14', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      <Head>
        <title>Contact Us — EventSnap</title>
        <style>{`
          .input-field {
            width: 100%; padding: 12px 16px; border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);
            color: white; font-size: 0.95rem; font-family: 'Inter', sans-serif;
            margin-bottom: 16px; transition: border-color 0.2s;
          }
          .input-field:focus { outline: none; border-color: rgba(240,192,96,0.5); }
          .btn-primary {
            background: linear-gradient(135deg, #E8A830, #F0C060);
            color: #0D0A14; padding: 14px 24px; border-radius: 12px;
            border: none; font-weight: 700; font-size: 1rem;
            cursor: pointer; transition: transform 0.2s; width: 100%;
          }
          .btn-primary:hover { transform: scale(1.02); }
        `}</style>
      </Head>

      {/* Simplified Navbar */}
      <nav style={{ padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none' }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#E8A830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'white', fontWeight:700, boxShadow:'0 0 20px rgba(124,58,237,0.4)' }}>✦</div>
          <span style={{ fontFamily:'Playfair Display,serif', fontWeight:700, fontSize:'1.2rem', background:'linear-gradient(135deg,#F0C060,#F7D98A,#E8A830)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>EventSnap</span>
        </Link>
      </nav>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '3rem', fontWeight: 700, marginBottom: '40px', color: '#F7D98A', textAlign: 'center' }}>Contact Us</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          
          {/* Left Column: Contact Details */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '32px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '24px', color: 'white' }}>Get in Touch</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Email</p>
              <a href="mailto:support@eventsnap.in" style={{ color: '#F0C060', textDecoration: 'none', fontSize: '1rem', fontWeight: 500 }}>support@eventsnap.in</a>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Phone</p>
              <p style={{ color: 'white', fontSize: '1rem', margin: 0 }}>+91 98765 43210</p>
            </div>

            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Address</p>
              <p style={{ color: 'white', fontSize: '1rem', lineHeight: '1.6', margin: 0 }}>Mangalagiri<br />Andhra Pradesh 522503<br />India</p>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '32px' }}>
            <form onSubmit={handleSubmit}>
              <input type="text" placeholder="Your Name" required className="input-field" />
              <input type="email" placeholder="Email Address" required className="input-field" />
              
              <select required className="input-field" defaultValue="">
                <option value="" disabled style={{ color: 'black' }}>Select Subject</option>
                <option value="support" style={{ color: 'black' }}>General Support</option>
                <option value="billing" style={{ color: 'black' }}>Billing & Refunds</option>
                <option value="sales" style={{ color: 'black' }}>Sales Inquiry</option>
              </select>

              <textarea placeholder="Your Message" required rows="5" className="input-field" style={{ resize: 'vertical' }}></textarea>

              <button type="submit" className="btn-primary">Send Message</button>
            </form>
          </div>

        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px',
          background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)',
          color: '#4ADE80', padding: '14px 20px', borderRadius: '12px',
          zIndex: 1000, animation: 'fade-up 0.3s ease', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <span>✦</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
