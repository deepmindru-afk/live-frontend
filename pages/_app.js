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

    // ✅ If both exist, keep both (no deletion)
    if (jwt && token) return;

    // ✅ If only token exists, rename it to jwt
    if (!jwt && token) {
      localStorage.setItem('jwt', token);
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
    
    console.log('🔐 [_app.js] useEffect starting, hasCheckedSSO:', hasCheckedSSO);
    
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
          console.log('🔐 [_app.js] PHP cookie token found, checking if re-auth needed...');
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
              
              console.log('🔍 [_app.js] Comparison:', { 
                phpUserId, 
                existingUserId: parsedUser.user_id,
                phpEmail: phpPayload.email,
                existingEmail: parsedUser.email
              });
              
              // Compare: if PHP user_id matches existing user_id, no need to re-authenticate
              if (phpUserId && parsedUser.user_id && phpUserId === parsedUser.user_id) {
                shouldReAuth = false;
                console.log('✅ [_app.js] Same user_id, skipping SSO');
              } 
              // Also check email match as secondary validation
              else if (phpPayload.email && parsedUser.email && 
                       phpPayload.email.toLowerCase() === parsedUser.email.toLowerCase()) {
                // Emails match but user_ids don't - this might be a case where user_id wasn't set yet
                // Check if both have user_id field and they're different
                if (phpUserId && parsedUser.user_id) {
                  // Both have user_id but different - user is switching
                  console.log('⚠️ [_app.js] Different user_ids with same email - switching user');
                  shouldReAuth = true;
                } else {
                  // At least one doesn't have user_id - safe to skip re-auth
                  console.log('✅ [_app.js] Same email, no user_id conflicts, skipping SSO');
                  shouldReAuth = false;
                }
              }
            } catch (e) {
              console.warn('⚠️ Could not decode tokens for comparison, will re-authenticate:', e);
              shouldReAuth = true;
            }
          }
          
          console.log('🔍 [_app.js] shouldReAuth:', shouldReAuth);
          
          // Only call SSO if we need to re-authenticate
          if (shouldReAuth) {
            console.log('🔄 [_app.js] Triggering SSO login...');
            // CRITICAL: PHP token is different - update session to handle user switching
            // IMPORTANT: Do NOT use the PHP token directly for GraphQL calls.
            // Exchange it via ssoLogin so backend creates/fetches the user and returns its own JWT.
            try {
              const ok = await handleSSOLogin(data.token);
              if (!ok) {
                console.warn('⚠️ SSO login failed');
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