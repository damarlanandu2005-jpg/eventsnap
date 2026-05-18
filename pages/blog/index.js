import Head from 'next/head';
import Link from 'next/link';

export default function BlogIndex() {
  return (
    <div style={{ minHeight: '100vh', background: '#0D0A14', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      <Head>
        <title>Stories & Insights — EventSnap</title>
        <style>{`
          .card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 20px;
            overflow: hidden;
            transition: transform 0.3s ease, border-color 0.3s ease;
            text-decoration: none;
            color: inherit;
            display: flex;
            flex-direction: column;
          }
          .card:hover {
            transform: translateY(-5px);
            border-color: rgba(240,192,96,0.3);
          }
          .tag {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-bottom: 16px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }
          .tag-gold { background: rgba(240,192,96,0.1); color: #F0C060; border: 1px solid rgba(240,192,96,0.2); }
          .tag-amber { background: rgba(251,191,36,0.1); color: #FBBF24; border: 1px solid rgba(251,191,36,0.2); }
          
          .grid {
            display: grid;
            gap: 32px;
          }
          @media (min-width: 1024px) {
            .grid { grid-template-columns: repeat(3, 1fr); }
            .card-featured { grid-column: span 3; display: grid; grid-template-columns: 1.5fr 1fr; align-items: stretch; }
          }
        `}</style>
      </Head>

      {/* Simplified Navbar */}
      <nav style={{ padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none' }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#E8A830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'white', fontWeight:700, boxShadow:'0 0 20px rgba(124,58,237,0.4)' }}>✦</div>
          <span style={{ fontFamily:'Playfair Display,serif', fontWeight:700, fontSize:'1.2rem', background:'linear-gradient(135deg,#F0C060,#F7D98A,#E8A830)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>EventSnap</span>
        </Link>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 700, marginBottom: '16px', color: '#F7D98A' }}>Stories & Insights</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
            On memories, moments, and the technology that helps preserve them.
          </p>
        </div>

        <div className="grid">
          {/* Card 1 FEATURED */}
          <Link href="/blog/the-photos-you-never-got" className="card card-featured">
            <div style={{ position: 'relative', height: '100%', minHeight: '300px' }}>
              <img src="https://picsum.photos/seed/blog1/800/400" alt="The EventSnap Story" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '40px' }}>
              <span className="tag tag-gold">The EventSnap Story</span>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', fontWeight: 700, marginBottom: '16px' }}>The Photos You Never Got</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '24px', fontSize: '1.1rem' }}>
                You showed up. You got dressed. You were there. And you went home with no photos of yourself.
              </p>
              <span style={{ color: '#F0C060', fontWeight: 600, fontSize: '1rem' }}>Read story →</span>
            </div>
          </Link>

          {/* Card 2 Coming Soon */}
          <div className="card" style={{ opacity: 0.8 }}>
            <div style={{ height: '200px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🤖</div>
            <div style={{ padding: '24px' }}>
              <span className="tag tag-amber">Technology</span>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>How AI Face Recognition Works at Indian Weddings</h3>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#FBBF24', fontSize: '0.85rem', fontWeight: 600 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FBBF24' }}></span>
                Coming soon
              </div>
            </div>
          </div>

          {/* Card 3 Coming Soon */}
          <div className="card" style={{ opacity: 0.8 }}>
            <div style={{ height: '200px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>📸</div>
            <div style={{ padding: '24px' }}>
              <span className="tag tag-gold" style={{ background: 'rgba(124,58,237,0.1)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.2)' }}>For photographers</span>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>A Photographer's Guide to Delivering 1,000 Photos in Under 10 Minutes</h3>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#FBBF24', fontSize: '0.85rem', fontWeight: 600 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FBBF24' }}></span>
                Coming soon
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
