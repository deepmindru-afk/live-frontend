import React, { useEffect } from 'react';
import Head from 'next/head';
import { isAuthenticated, redirectBasedOnRole, handleSSOLogin } from '../lib/simple-auth-handlers';
import { checkAndHandleSSOLogin, handleSSOLoginFromStorage } from '../lib/sso-handler';

const HomePage: React.FC = () => {
  useEffect(() => {
    const handleInitialLoad = async () => {
      // First, check for SSO login from URL parameters
      const ssoResult = await checkAndHandleSSOLogin();

      if (ssoResult === 'failed') {
        window.location.href = 'https://beta.hrdeedu.co.kr';
        return;
      }

      if (ssoResult === 'success') {
        return;
      }

      // If no SSO token present, check if user is already authenticated locally
      if (isAuthenticated()) {
        window.location.href = '/dashboard';
      }
    };

    handleInitialLoad();
  }, []);

  const handleLiveClass = async () => {
    try {
      // Ensure any cookie-provided token is exchanged and stored
      await handleSSOLoginFromStorage();

      // If we already have a valid auth token, go straight to the dashboard
      if (isAuthenticated()) {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          redirectBasedOnRole(user);
          return;
        }

        // Fallback in case user data is missing
        window.location.href = '/dashboard';
        return;
      }

      // No token in localStorage yet—try to read JWT from cookies via API helper
      const response = await fetch('/api/auth/session-jwt', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data && data.success && data.token) {
          const loginOk = await handleSSOLogin(data.token);
          if (loginOk) {
            const userStr = localStorage.getItem('user');
            if (userStr) {
              const user = JSON.parse(userStr);
              redirectBasedOnRole(user);
              return;
            }
            window.location.href = '/dashboard';
            return;
          }
        }
      }
    } catch (error) {
      // ignore and fall through to redirect
    }

    window.location.href = 'https://beta.hrdeedu.co.kr';
  };

  return (
    <>
      <Head>
        <title>HRDe On Air</title>
        <meta name="description" content="HRDe On Air - Seamless live learning experience" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="onair-home">
        <div className="onair-ambient">
          <span className="onair-cube cube-lg" aria-hidden="true"></span>
          <span className="onair-cube cube-md" aria-hidden="true"></span>
          <span className="onair-cube cube-sm" aria-hidden="true"></span>
        </div>
        <div className="onair-overlay">
          <div className="onair-hero">
            <div className="onair-logo" aria-label="HRDe On Air">
              <span className="onair-logo-mark" aria-hidden="true"></span>
              <span className="onair-logo-name">
                HRDe <span className="onair-logo-highlight">ON AIR<span className="onair-live-dot" aria-hidden="true"></span></span>
              </span>
            </div>
            <h1>라이브 학습을 경험하세요</h1>
          </div>

          <div className="onair-cta">
            <button
              type="button"
              className="onair-button primary onair-live-button"
              onClick={handleLiveClass}
            >
              Live Class
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;