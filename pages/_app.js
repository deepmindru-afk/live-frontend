// Import base styles (dark mode) - MUST come first
import '../styles/auth.scss';
import '../styles/dashboard.scss';
import '../pages/app/globals.css';
// Import light mode styles (will be scoped with data-theme='light') - MUST come after dark mode
import '../styles/light-mode/auth.scss';
import '../styles/light-mode/dashboard.scss';
import '../pages/lightMode/instructor.scss';
import '../pages/lightMode/theme-toggle.scss';
import '../pages/lightMode/attendance.scss';
import '../pages/lightMode/member.scss';
import '../pages/lightMode/prejoin.scss';
// Import Excalidraw styles
import '@excalidraw/excalidraw/index.css';
import ApolloProviderWrapper from '../lib/apollo-provider';
import { ThemeProvider } from '../lib/theme-context';
import { useEffect } from 'react';
import { handleSSOLogin, redirectBasedOnRole } from '../lib/simple-auth-handlers';

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
              } else {
                // Different user_id - user is switching
                shouldReAuth = true;
              }
            } catch (e) {
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
                // ✅ SSO login successful - get user and redirect
                const userStr = localStorage.getItem('user');
                if (userStr) {
                  try {
                    const user = JSON.parse(userStr);
                    redirectBasedOnRole(user);
                    return; // Exit early after redirect
                  } catch (parseError) {
                    console.error('Failed to parse user data:', parseError);
                  }
                }
              }
            } catch (e) {
              // Only fall back if we don't have an existing token
              if (!existing) {
                localStorage.setItem('jwt', data.token);
              }
            }
          }
        }
      } catch (e) {
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
    <ThemeProvider>
      <ApolloProviderWrapper>
        <Component {...pageProps} />
      </ApolloProviderWrapper>
    </ThemeProvider>
  );
}

// Production error handling
if (typeof window !== 'undefined') {
  // Global error handler for production
  window.addEventListener('error', (event) => {
    // Don't show error alerts in production
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    // Don't show error alerts in production
  });
}