import Head from 'next/head';
import Link from 'next/link';

export default function BlogPost() {
  return (
    <div style={{ minHeight: '100vh', background: '#0D0A14', color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif' }}>
      <Head>
        <title>The Photos You Never Got — EventSnap Blog</title>
        <style>{`
          .article-content h2 {
            font-family: 'Playfair Display', serif;
            font-size: 1.75rem;
            color: #F7D98A;
            margin-top: 48px;
            margin-bottom: 20px;
            font-weight: 700;
          }
          .article-content p {
            font-size: 1.05rem;
            line-height: 1.8;
            margin-bottom: 24px;
            color: rgba(255,255,255,0.8);
          }
          .opening-closing {
            font-family: 'Playfair Display', serif;
            font-size: 20px;
            font-style: italic;
            line-height: 1.7;
            color: #F0C060;
            margin: 40px 0;
          }
          .btn-outline {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1);
            color: white;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.2s;
          }
          .btn-outline:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.2); }
          .btn-gold {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 12px;
            background: linear-gradient(135deg, #E8A830, #F0C060);
            color: #0D0A14;
            text-decoration: none;
            font-weight: 700;
            transition: transform 0.2s;
          }
          .btn-gold:hover { transform: scale(1.05); }
        `}</style>
      </Head>

      {/* Simplified Navbar */}
      <nav style={{ padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none' }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#E8A830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'white', fontWeight:700, boxShadow:'0 0 20px rgba(124,58,237,0.4)' }}>✦</div>
          <span style={{ fontFamily:'Playfair Display,serif', fontWeight:700, fontSize:'1.2rem', background:'linear-gradient(135deg,#F0C060,#F7D98A,#E8A830)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>EventSnap</span>
        </Link>
      </nav>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 24px 100px' }}>
        <div style={{ marginBottom: '40px' }}>
          <span style={{ background: 'rgba(240,192,96,0.1)', color: '#F0C060', padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', border: '1px solid rgba(240,192,96,0.2)' }}>
            The EventSnap Story
          </span>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, margin: '24px 0 16px', lineHeight: 1.2, color: 'white' }}>
            The Photos You Never Got — And Why We Built EventSnap to Change That
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', fontWeight: 500 }}>
            EventSnap Team · April 2025 · 5 min read
          </p>
        </div>

        <img src="https://picsum.photos/seed/bloghero/720/380" alt="The Photos You Never Got" style={{ width: '100%', borderRadius: '24px', marginBottom: '40px' }} />

        <div className="article-content">
          <p className="opening-closing">
            "Picture this: You woke up at 5am to get ready for your cousin's wedding. You spent two hours getting dressed. You looked absolutely beautiful. You were present at every moment — the mehendi, the ceremony, the reception. You danced until midnight. And then you went home. And you never saw a single photo of yourself."
          </p>

          <h2>This happens at almost every event in India</h2>
          <p>
            In India, events are not just gatherings; they are grand celebrations of culture, family, and milestones. At a typical 500-guest wedding, multiple photographers capture anywhere between 3,000 to 8,000 high-quality photos. These professionals work tirelessly to document the emotions, the laughter, and the details. Yet, for the vast majority of guests, these memories remain invisible.
          </p>
          <p>
            The current system of photo distribution is fundamentally broken. Photographers often resort to dumping thousands of files into Google Drive links, which are shared through layers of family WhatsApp groups. Guests are forced to scroll through endless thumbnails, hunting for a glimpse of themselves among strangers. Eventually, most people simply give up, leaving their most precious moments to gather digital dust in an inaccessible folder.
          </p>

          <h2>The effort nobody talks about</h2>
          <p>
            Think about the immense personal effort that goes into attending a special event. A guest might spend ₹15,000 on a new lehenga or sherwani, dedicate three hours at a salon, and brave an hour of chaotic traffic just to be there for a loved one. They arrive looking their absolute best, ready to celebrate and create memories that should last a lifetime.
          </p>
          <p>
            But without a way to access the professional photos, that effort goes largely undocumented. Whether it is a wedding, a university graduation, a high-stakes corporate day, or a college fest, guests often leave with nothing more than four blurry photos taken on a smartphone in poor lighting. It is a heartbreaking gap between the beauty of the experience and the permanence of the record.
          </p>

          <h2>Why existing solutions don't work</h2>
          <p>
            Google Drive and Dropbox were built for file storage, not for guest experiences. Expecting a guest to manually scan through 5,000 photos to find five of themselves is unreasonable. WhatsApp broadcasts are equally inefficient, requiring photographers to perform hours of manual labor to send individual photos, often resulting in heavy compression that ruins the image quality.
          </p>
          <p>
            Other platforms, like Facebook or specialized gallery sites, often require users to create new accounts or navigate complex interfaces. None of these solutions were truly designed with the guest in mind. They place the burden of effort on the user, creating friction where there should be seamless joy.
          </p>

          <h2>What we built — and why it matters</h2>
          <p>
            We built EventSnap to solve this problem once and for all. Our process is simple: guests scan a QR code at the venue, take a quick selfie, and within 15 seconds, our AI identifies every professional photo they appear in. It is magic in the palm of your hand. Most importantly, we prioritize privacy—the reference selfie is deleted immediately after processing, and no biometric data is ever stored.
          </p>
          <p>
            When we designed EventSnap, we kept the diverse reality of India in mind. We built it to be so intuitive that a 60-year-old aunt with a poor internet connection on a cracked-screen phone could use it effortlessly. By removing all barriers—no apps to download, no logins to remember—we've made professional memories accessible to everyone.
          </p>

          <h2>The problem is bigger than technology</h2>
          <p>
            The scale of Indian events is unlike anything else in the world. Whether it is a 500-guest wedding, a 3,000-student graduation ceremony, or a 1,500-employee corporate day, the volume of human interaction is staggering. These are not just photos; they are the images that will hang on walls for decades, the ones that families will look back on for generations.
          </p>
          <p>
            Technology should serve to bring these memories home. At EventSnap, we believe that every person who put in the effort to be present deserves to have their presence recorded and delivered. We are not just building a face-matching tool; we are building a bridge between the professional's lens and the guest's heart.
          </p>

          <h2>What this means for photographers</h2>
          <p>
            For photographers, EventSnap is a game-changer. Traditionally, a photographer's work is seen only by the couple or the host who hired them. But when every guest receives a personalized gallery of 47 high-quality photos where they look their best, the photographer's reach explodes. Every guest becomes a walking, talking advertisement.
          </p>
          <p>
            When guests share these professional photos on social media, they naturally tag the photographer and recommend them to their own circles. EventSnap turns guests into a powerful distribution channel, ensuring that the photographer's best work is seen, appreciated, and shared by the people who matter most. It is the ultimate tool for building a reputation in a competitive market.
          </p>

          <p className="opening-closing">
            "You showed up. You got dressed. You were there. You deserved those photos. Now you can have them."
          </p>

          {/* Author Card */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '32px', marginTop: '64px', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #E8A830)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>✦</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px', color: 'white' }}>EventSnap Team</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Building the future of event photography distribution in India.
              </p>
            </div>
          </div>

          <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/blog" className="btn-outline">← Back to blog</Link>
            <Link href="/" className="btn-gold">Try EventSnap free →</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
