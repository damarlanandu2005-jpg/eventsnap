import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            background: #0D0A14 !important;
            color: rgba(255,255,255,0.95);
            min-height: 100vh;
            overflow-x: hidden;
          }
          #__next {
            background: #0D0A14;
            min-height: 100vh;
          }
        `}} />
      </Head>
      <body style={{ background: '#0D0A14' }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
