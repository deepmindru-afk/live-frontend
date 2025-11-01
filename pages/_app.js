import '../styles/auth.scss';
import '../styles/dashboard.scss';
import '../pages/app/globals.css';
import ApolloProviderWrapper from '../lib/apollo-provider';
import { useEffect } from 'react';
import { handleSSOLogin } from '../lib/simple-auth-handlers';

// Cleanup duplicate tokens on app start
function cleanupDuplicateTokens() {
  if (typeof window === 'undefined') return;

  try {
    const jwt = localStorage.getItem('jwt');
    const token = localStorage.getItem('token');

    console.log('🔍 Token check - jwt:', jwt ? 'exists' : 'missing', 'token:', token ? 'exists' : 'missing');

    // ✅ If both exist, keep both (no deletion)
    if (jwt && token) return;

    // ✅ If only token exists, rename it to jwt
    if (!jwt && token) {
      localStorage.setItem('jwt', token);
      console.log('✅ Migrated token → jwt (kept old one)');
    }

    // ✅ If only jwt exists, do nothing
  } catch (error) {
    console.error('❌ Token cleanup error:', error);
  }
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Track if SSO check has run this page load
    const ssoCheckKey = '__sso_check_done__';
    const hasCheckedSSO = sessionStorage.getItem(ssoCheckKey);
    
    // 1) Check cookies to handle SSO login from PHP (only once per page load)
    const ensureJwtFromCookies = async () => {
      try {
        if (typeof window === 'undefined') return;

        const resp = await fetch('/api/auth/session-jwt', { credentials: 'include' });
        if (!resp.ok) {
          // No cookie token available, do nothing
          return;
        }
        
        const data = await resp.json();
        if (data && data.success && data.token) {
          const existing = localStorage.getItem('jwt');
          const existingUser = localStorage.getItem('user');
          
          // Try to extract user_id from both tokens to compare
          let shouldReAuth = true;
          
          if (existing && existingUser) {
            try {
              // Validate JWT format (should have 3 parts separated by dots)
              const phpTokenParts = data.token.split('.');
              if (phpTokenParts.length !== 3) {
                throw new Error('Invalid JWT format in PHP token');
              }
              
              // Decode PHP JWT to get user_id
              const phpPayload = JSON.parse(atob(phpTokenParts[1]));
              const phpUserId = phpPayload.user_id;
              
              // Parse existing user to get user_id from localStorage
              const parsedUser = JSON.parse(existingUser);
              
              // Compare: if PHP user_id matches existing user_id, no need to re-authenticate
              if (phpUserId && parsedUser.user_id && phpUserId === parsedUser.user_id) {
                shouldReAuth = false;
                console.log('✅ PHP cookie is for same user, no need to re-authenticate');
              }
            } catch (e) {
              console.warn('⚠️ Could not decode tokens for comparison, will re-authenticate:', e);
              shouldReAuth = true;
            }
          }
          
          // Only call SSO if we need to re-authenticate
          if (shouldReAuth) {
            // CRITICAL: PHP token is different - update session to handle user switching
            // IMPORTANT: Do NOT use the PHP token directly for GraphQL calls.
            // Exchange it via ssoLogin so backend creates/fetches the user and returns its own JWT.
            try {
              const ok = await handleSSOLogin(data.token);
              if (ok) {
                if (existing) {
                  console.log('✅ Updated SSO session from PHP cookie (user switched)');
                } else {
                  console.log('✅ Completed SSO exchange and cached backend JWT');
                }
              }
            } catch (e) {
              console.warn('⚠️ SSO exchange failed:', e);
              // Only fall back if we don't have an existing token
              if (!existing) {
                localStorage.setItem('jwt', data.token);
              }
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Unable to cache JWT from cookies:', e);
      }
    };

    // Only run SSO check once per page load to avoid infinite loops
    if (!hasCheckedSSO) {
      sessionStorage.setItem(ssoCheckKey, 'true');
      ensureJwtFromCookies();
    }

    // Disable cleanup completely on login + home page
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname.includes('/login') || pathname === '/' || pathname.includes('/signup')) {
        console.log('🚫 Skipping token cleanup on auth pages');
        return;
      }
    }

    // Track if cleanup already ran
    const cleanupKey = '__token_cleanup_done__';
    const hasRun = sessionStorage.getItem(cleanupKey);
    
    if (!hasRun) {
      // Mark as run
      sessionStorage.setItem(cleanupKey, 'true');
      
      // Run cleanup once per browser session
      let mounted = true;
      const timeout = setTimeout(() => {
        if (mounted) {
          console.log('🔧 Running token cleanup on app mount...');
          cleanupDuplicateTokens();
        }
      }, 1000); // 1 second delay to avoid interfering with login
      
      return () => {
        mounted = false;
        clearTimeout(timeout);
      };
    }
  }, []); // Empty deps - only run once

  return (
    <ApolloProviderWrapper>
      <Component {...pageProps} />
    </ApolloProviderWrapper>
  );
}

// Production error handling
if (typeof window !== 'undefined') {
  // Global error handler for production
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Don't show error alerts in production
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Don't show error alerts in production
  });
}