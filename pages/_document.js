import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon - Standard and Apple Touch Icons */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/mainLogo.png" />
        
        {/* Mobile web app optimization */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HRDe Live" />
        <meta name="theme-color" content="#000000" />
        
        {/* Prevent zoom on input focus (iOS Safari) */}
        <meta name="format-detection" content="telephone=no" />
        
        {/* Security headers for media access */}
        <meta httpEquiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=()" />
        
        {/* Preconnect to external domains for better performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        <style jsx global>{`
          /* Hide browser chrome on mobile when in fullscreen */
          @media (display-mode: fullscreen) {
            body {
              overflow: hidden !important;
            }
          }
          
          /* Prevent overscroll on mobile */
          html, body {
            overscroll-behavior: none;
            -webkit-overflow-scrolling: touch;
          }
          
          /* Hide browser UI elements on iOS */
          @supports (-webkit-touch-callout: none) {
            body {
              -webkit-touch-callout: none;
              -webkit-user-select: none;
              user-select: none;
            }
          }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}