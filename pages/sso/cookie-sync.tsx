import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const CookieSyncPage: React.FC = () => {
  const router = useRouter();
  const [status, setStatus] = useState<string>('Initializing...');
  const [tokenPreview, setTokenPreview] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      try {
        setStatus('Reading JWT from cookies via /api/auth/session-jwt ...');
        const resp = await fetch('/api/auth/session-jwt', { credentials: 'include' });
        const data = await resp.json();
        if (!resp.ok || !data?.success || !data?.token) {
          setStatus(`Failed: ${data?.message || 'JWT not found in cookies'}`);
          return;
        }

        const token: string = data.token;
        setTokenPreview(token.substring(0, 30) + '...');

        // Save to localStorage under the key used by the app
        localStorage.setItem('jwt', token);
        setStatus('Saved JWT to localStorage. Verifying...');

        const verify = localStorage.getItem('jwt');
        if (!verify) {
          setStatus('Failed to verify jwt in localStorage');
          return;
        }

        setStatus('Success! Redirecting to home...');
        // Redirect user to the app main page (adjust if needed)
        setTimeout(() => router.push('/'), 800);
      } catch (e: any) {
        setStatus(`Error: ${e?.message || 'Unexpected error'}`);
      }
    };
    run();
  }, [router]);

  return (
    <>
      <Head>
        <title>Cookie → LocalStorage Sync</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxWidth: 560, width: '100%' }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Cookie → LocalStorage JWT Sync</h1>
          <p style={{ marginTop: 12, color: '#475569' }}>{status}</p>
          {tokenPreview && (
            <p style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, color: '#0f172a' }}>token: {tokenPreview}</p>
          )}
          <p style={{ marginTop: 16, color: '#64748b' }}>This page reads the JWT from httpOnly cookies via an API, writes it to localStorage as <strong>jwt</strong>, then redirects.</p>
        </div>
      </div>
    </>
  );
};

export default CookieSyncPage;


