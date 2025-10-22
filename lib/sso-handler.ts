import { handleSSOLogin, redirectBasedOnRole, isAuthenticated } from './simple-auth-handlers';

/**
 * Check for SSO token in URL parameters and handle automatic login
 * This should be called on page load to handle redirects from PHP website
 */
export const checkAndHandleSSOLogin = async (): Promise<boolean> => {
  // Only run on client side
  if (typeof window === 'undefined') return false;

  try {
    // Check if user is already authenticated
    if (isAuthenticated()) {
      console.log('✅ User already authenticated, skipping SSO check');
      return true;
    }

    // Get JWT token from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      console.log('ℹ️ No SSO token found in URL parameters');
      return false;
    }

    console.log('🔐 SSO token found in URL, attempting automatic login...');

    // Attempt SSO login
    const success = await handleSSOLogin(token);

    if (success) {
      // Get user data and redirect based on role
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        console.log('✅ SSO login successful, redirecting user:', user);
        
        // Redirect based on user role
        redirectBasedOnRole(user);
        return true;
      }
    }

    return false;
  } catch (error: any) {
    console.error('❌ SSO login failed:', error);
    return false;
  }
};

/**
 * Get JWT token from PHP website's localStorage
 * This can be used if the PHP website stores the token in a specific key
 */
export const getPHPTokenFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    // Try different possible keys where PHP might store the JWT token
    const possibleKeys = [
      'jwt',
      'token',
      'auth_token',
      'php_jwt',
      'hrde_token',
      'user_token'
    ];

    for (const key of possibleKeys) {
      const token = localStorage.getItem(key);
      if (token && token.startsWith('eyJ')) { // JWT tokens start with 'eyJ'
        console.log(`🔍 Found JWT token in localStorage key: ${key}`);
        return token;
      }
    }

    console.log('ℹ️ No JWT token found in localStorage');
    return null;
  } catch (error) {
    console.error('❌ Error reading localStorage:', error);
    return null;
  }
};

/**
 * Handle SSO login with token from localStorage
 */
export const handleSSOLoginFromStorage = async (): Promise<boolean> => {
  try {
    const token = getPHPTokenFromStorage();
    
    if (!token) {
      console.log('ℹ️ No JWT token found in localStorage');
      return false;
    }

    console.log('🔐 Attempting SSO login with token from localStorage...');
    
    const success = await handleSSOLogin(token);
    
    if (success) {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        console.log('✅ SSO login successful from localStorage, redirecting user:', user);
        redirectBasedOnRole(user);
        return true;
      }
    }

    return false;
  } catch (error: any) {
    console.error('❌ SSO login from localStorage failed:', error);
    return false;
  }
};

/**
 * Clean up URL parameters after successful SSO login
 */
export const cleanupSSOUrl = () => {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    
    // Update URL without the token parameter
    window.history.replaceState({}, document.title, url.pathname + url.search);
    console.log('🧹 Cleaned up SSO token from URL');
  } catch (error) {
    console.error('❌ Error cleaning up URL:', error);
  }
};


