import '../styles/auth.scss';
import '../styles/dashboard.scss';
import '../pages/app/globals.css';
import ApolloProviderWrapper from '../lib/apollo-provider';
import { useEffect } from 'react';

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