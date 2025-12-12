// Simple authentication handlers without Apollo Client
// These make direct HTTP requests to the GraphQL backend

import { print } from 'graphql';
import Swal from 'sweetalert2';

const JWT_LAST_TIME_USE_KEY = 'jwt_last_time_use';
const JWT_USAGE_WINDOW_MS = 3 * 60 * 60 * 1000;

function getStoredJwtToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('jwt') || window.localStorage.getItem('token');
}

function getJwtLastTimeUse(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(JWT_LAST_TIME_USE_KEY);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function setJwtLastTimeUse(timestamp: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(JWT_LAST_TIME_USE_KEY, timestamp.toString());
}

function clearJwtLastTimeUse(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(JWT_LAST_TIME_USE_KEY);
}

function hasJwtUsageWindowExpired(): boolean {
  if (typeof window === 'undefined') return false;
  const lastUse = getJwtLastTimeUse();
  if (!lastUse) return false;
  return Date.now() - lastUse > JWT_USAGE_WINDOW_MS;
}

function purgeJwtCredentials(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('jwt');
  window.localStorage.removeItem('token');
  window.localStorage.removeItem('user');
  clearJwtLastTimeUse();
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Utility function to show SweetAlert errors
export const showErrorAlert = async (title: string, message: string) => {
  await Swal.fire({
    title: title,
    text: message,
    icon: 'error',
    confirmButtonText: 'OK'
  });
};

export interface SignupData {
  displayName: string;
  email: string;
  password: string;
  department?: string;
}

// GraphQL endpoint - with better fallback handling
const GRAPHQL_ENDPOINT = (() => {
  // Check for environment variables first
  if (process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT) {
    return process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
  }
  if (process.env.NEXT_PUBLIC_GRAPHQL_URL) {
    return process.env.NEXT_PUBLIC_GRAPHQL_URL;
  }
  
  // Default to localhost for development
  return 'http://localhost:3007/graphql';
})();


// Login mutation
const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        _id
        displayName
        email
        systemRole
      }
    }
  }
`;

const TUTOR_LOGIN_MUTATION = `
  mutation TutorLogin($input: LoginInput!) {
    tutorLogin(input: $input) {
      token
      user {
        _id
        displayName
        email
        systemRole
      }
    }
  }
`;

// Signup mutation
const SIGNUP_MUTATION = `
  mutation Signup($displayName: String!, $email: String!, $password: String!) {
    signup(input: { displayName: $displayName, email: $email, password: $password }) {
      token
      user {
        _id
        displayName
        email
        systemRole
      }
    }
  }
`;

const TUTOR_SIGNUP_MUTATION = `
  mutation TutorSignup($displayName: String!, $email: String!, $password: String!, $department: String) {
    tutorSignup(input: { displayName: $displayName, email: $email, password: $password, department: $department }) {
      token
      user {
        _id
        displayName
        email
        systemRole
      }
    }
  }
`;

// SSO Login mutation
const SSO_LOGIN_MUTATION = `
  mutation SSOLogin($input: SSOLoginInput!) {
    ssoLogin(input: $input) {
      success
      existed
      user {
        _id
        user_id
        displayName
        email
        systemRole
        lastSeenAt
        isBlocked
      }
      token
      message
    }
  }
`;

// Get current user query
const GET_CURRENT_USER_QUERY = `
  query GetCurrentUser {
    me {
      _id
      user_id
      displayName
      email
      systemRole
    }
  }
`;

// Make GraphQL request
export async function makeGraphQLRequest(query: string | any, variables: any = {}) {
  if (typeof window !== 'undefined') {
    const storedToken = getStoredJwtToken();
    if (storedToken && hasJwtUsageWindowExpired()) {
      purgeJwtCredentials();
      throw new Error('JWT_EXPIRED');
    }
  }
  
  // Convert GraphQL AST to string if needed
  let queryString = query;
  if (typeof query !== 'string') {
    // If it's a GraphQL AST object, convert it to string using print
    if (query && typeof query === 'object' && query.kind) {
      queryString = print(query);
    } else {
      throw new Error('Invalid GraphQL query: query is undefined or not a valid GraphQL AST');
    }
  }
  
  // Determine query name for better debugging
  let queryName = 'unknown';
  if (queryString.includes('GetMyMeetings')) {
    queryName = 'GetMyMeetings';
  } else if (queryString.includes('GetTutorMeetings')) {
    queryName = 'GetTutorMeetings';
  } else if (queryString.includes('getMeetingAttendance')) {
    queryName = 'getMeetingAttendance';
  } else if (queryString.includes('GetAllMeetings')) {
    queryName = 'GetAllMeetings';
  }


  const requestBody = {
    query: queryString,
    variables,
  };
  

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apollo-require-preflight': 'true',
  };
  
  // Always try to get the token fresh
  const freshToken = getAuthToken();
  if (freshToken) {
    headers['Authorization'] = `Bearer ${freshToken}`;
  } else {
    // Debug: Check localStorage directly
    if (typeof window !== 'undefined') {
    }
  }
  

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });


  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }

  let data;
  try {
    data = await response.json();
    
    if (data.errors) {
    }
  } catch (jsonError) {
    throw new Error('Invalid JSON response from server');
  }
  
  // Check for GraphQL errors after successful JSON parsing
  if (data.errors) {
    
    // Handle specific authentication errors
    const firstError = data.errors[0];
    
    // Log the actual error message for debugging
    
    // Also log message separately to make sure it's visible
    
    if (firstError.message === 'Invalid credentials' || firstError.extensions?.code === 'UNAUTHENTICATED') {
      throw new Error('Invalid credentials');
    }
    
    // Handle JWT expiration
    if (firstError.message === 'jwt expired' || firstError.message.includes('jwt expired')) {
      throw new Error('JWT_EXPIRED');
    }
    
    // Handle token not exist - DON'T clear tokens automatically, let caller handle
    if (firstError.message === 'TOKEN_NOT_EXIST' || firstError.extensions?.code === 'TOKEN_NOT_EXIST') {
      // DON'T clear tokens here - caller should handle it properly
      // Return null instead of throwing to allow caller to handle gracefully
      return null;
    }
    
    // Handle role permission errors gracefully
    if (firstError.message === 'ONLY_SPECIFIC_ROLES_ALLOWED' || 
        firstError.message.includes('ONLY_SPECIFIC_ROLES_ALLOWED') ||
        firstError.extensions?.code === 'ONLY_SPECIFIC_ROLES_ALLOWED') {
      // Return an error object that can be caught and handled
      const error = new Error('ONLY_SPECIFIC_ROLES_ALLOWED');
      (error as any).status = 403;
      throw error;
    }
    
    // Handle user not found error gracefully
    if (firstError.message === 'User not found' || firstError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
      // Don't clear tokens - let caller handle
      return null;
    }
    
    // Handle authentication errors gracefully
    if (firstError.message.includes('Unauthorized') || firstError.message.includes('Forbidden')) {
      // Don't clear tokens - let caller handle
      return null;
    }
    
    // For other GraphQL errors, show user-friendly error
    const errorMessage = firstError.message || 'An error occurred';
    throw new Error(errorMessage);
  }
  
  

  return data.data;
}

// Handle login
export const handleLogin = async (credentials: LoginCredentials): Promise<boolean> => {
  try {
    
    const data = await makeGraphQLRequest(LOGIN_MUTATION, {
      email: credentials.email,
      password: credentials.password,
    });

    // Check if data is null (authentication error)
    if (!data) {
      throw new Error('Invalid credentials');
    }

    if (data.login && data.login.token) {
      // Save JWT to localStorage
      setAuthToken(data.login.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.login.user));
      
      // Verify token is saved
      const savedToken = getAuthToken();
      
      // 🕒 Small delay to ensure storage sync
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Double-check token exists before redirect
      const verifyToken = localStorage.getItem('jwt');
      if (!verifyToken) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      
      
      // Show success message
      alert(`Welcome back, ${data.login.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Login failed - no token received');
    }
  } catch (error: any) {
    // Re-throw the error so the calling function can handle it with SweetAlert
    throw error;
  }
};

// Handle tutor login
export const handleTutorLogin = async (credentials: LoginCredentials): Promise<boolean> => {
  try {
    
    const data = await makeGraphQLRequest(TUTOR_LOGIN_MUTATION, {
      input: {
        email: credentials.email,
        password: credentials.password,
      }
    });

    // Check if data is null (authentication error)
    if (!data) {
      throw new Error('Invalid credentials');
    }

    if (data.tutorLogin && data.tutorLogin.token) {
      // Save JWT to localStorage
      setAuthToken(data.tutorLogin.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.tutorLogin.user));
      
      // Verify token is saved
      const savedToken = getAuthToken();
      
      // 🕒 Small delay to ensure storage sync
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Double-check token exists before redirect
      const verifyToken = localStorage.getItem('jwt');
      if (!verifyToken) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      
      
      // Show success message
      alert(`Welcome back, Tutor ${data.tutorLogin.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Tutor login failed - no token received');
    }
  } catch (error: any) {
    // Re-throw the error so the calling function can handle it with SweetAlert
    throw error;
  }
};

// Handle signup
export const handleSignup = async (input: SignupData): Promise<boolean> => {
  try {
    
    const data = await makeGraphQLRequest(SIGNUP_MUTATION, {
      displayName: input.displayName,
      email: input.email,
      password: input.password,
    });


    if (data.signup && data.signup.token) {
      // Save JWT to localStorage
      setAuthToken(data.signup.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.signup.user));
      
      // Show success message
      alert(`Welcome to HRDe Live, ${data.signup.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Signup failed - no token received');
    }
  } catch (error: any) {
    // Re-throw the error so the calling function can handle it with SweetAlert
    throw error;
  }
};

// Handle tutor signup
export const handleTutorSignup = async (input: SignupData): Promise<boolean> => {
  try {
    
    const data = await makeGraphQLRequest(TUTOR_SIGNUP_MUTATION, {
      displayName: input.displayName,
      email: input.email,
      password: input.password,
      department: input.department || '',
    });


    if (data.tutorSignup && data.tutorSignup.token) {
      // Save JWT to localStorage
      setAuthToken(data.tutorSignup.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.tutorSignup.user));
      
      // Show success message
      alert(`Welcome to HRDe Live as a Tutor, ${data.tutorSignup.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Tutor signup failed - no token received');
    }
  } catch (error: any) {
    // Re-throw the error so the calling function can handle it with SweetAlert
    throw error;
  }
};

// Handle SSO login from PHP website
export const handleSSOLogin = async (phpToken: string): Promise<boolean> => {
  try {
    
    const data = await makeGraphQLRequest(SSO_LOGIN_MUTATION, {
      input: {
        token: phpToken
      }
    });


    if (data.ssoLogin && data.ssoLogin.success && data.ssoLogin.token) {
      // Save JWT to localStorage
      setAuthToken(data.ssoLogin.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.ssoLogin.user));
      
      
      return true;
    } else {
      throw new Error('SSO login failed - no token received');
    }
  } catch (error: any) {
    // Re-throw the error so the calling function can handle it
    throw error;
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const token = getAuthToken();
  
  if (!token) {
    return false;
  }
  
  try {
    // Basic JWT token validation
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    const isValid = payload.exp > now;
    return isValid;
  } catch (error) {
    return false;
  }
};

// Get current user
export const getCurrentUser = async () => {
  // Check localStorage FIRST - this is the primary source after login
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      // Verify user has required fields
      if (user && user._id && user.email) {
        return user;
      }
    } catch (e) {
    }
  }
  
  // If no user in localStorage, check authentication status
  if (!isAuthenticated()) {
    return null;
  }
  
  // Fallback: try to fetch from backend (ONLY if we have a valid token)
  try {
    const data = await makeGraphQLRequest(GET_CURRENT_USER_QUERY);
    
    // Check if the response has the expected structure
    if (data && data.me) {
      // Save user to localStorage for next time
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(data.me));
      }
      return data.me;
    } else {
      // If backend returns null or "User not found", attempt SSO exchange using cookie token, then retry once
      try {
        const resp = await fetch('/api/auth/session-jwt', { credentials: 'include' });
        if (resp.ok) {
          const json = await resp.json();
          if (json && json.success && json.token) {
            const ssoOk = await handleSSOLogin(json.token);
            if (ssoOk) {
              const retry = await makeGraphQLRequest(GET_CURRENT_USER_QUERY);
              if (retry && retry.me) {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('user', JSON.stringify(retry.me));
                }
                return retry.me;
              }
            }
          }
        }
      } catch (e) {
        // ignore and fall through
      }
      return null;
    }
  } catch (error) {
    // Don't clear token on error - let the page handle it
    return null;
  }
};

// Handle logout
export const handleLogout = async (): Promise<boolean> => {
  try {
    
    // Make logout request to backend
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthToken() ? `Bearer ${getAuthToken()}` : '',
      },
      body: JSON.stringify({
        query: `
          mutation Logout {
            logout {
              success
              message
              timestamp
            }
          }
        `,
      }),
    });

    const data = await response.json();

    // Clear token regardless of response
    clearAuthToken();
    
    if (data.data?.logout?.success) {
      alert('You have been successfully logged out.');
      return true;
    } else {
      alert('Logout completed.');
      return true;
    }
  } catch (error) {
    // Still clear the token even if request fails
    clearAuthToken();
    alert('You have been logged out.');
    return true;
  }
};

// Redirect based on user role
export const redirectBasedOnRole = (user: any): void => {
  if (typeof window === 'undefined') return;


  switch (user.systemRole) {
    case 'ADMIN':
      window.location.href = '/instructor';
      break;
    case 'TUTOR':
      window.location.href = '/instructor';
      break;
    case 'MEMBER':
      window.location.href = '/member';
      break;
    default:
      window.location.href = '/dashboard';
      break;
  }
};

// Token management - Use only jwt key
export const setAuthToken = (token: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('jwt', token);
    window.localStorage.removeItem('token');
    setJwtLastTimeUse();
  } catch (error) {
  }
};

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  let token = window.localStorage.getItem('jwt');

  if (!token) {
    const legacyToken = window.localStorage.getItem('token');
    if (legacyToken) {
      window.localStorage.setItem('jwt', legacyToken);
      window.localStorage.removeItem('token');
      token = legacyToken;
    }
  }

  if (!token) {
    return null;
  }

  if (hasJwtUsageWindowExpired()) {
    purgeJwtCredentials();
    return null;
  }

  setJwtLastTimeUse();
  return window.localStorage.getItem('jwt');
};

export const clearAuthToken = () => {
  if (typeof window === 'undefined') return;
  purgeJwtCredentials();
};

// Force login for testing
export const forceLogin = async (email: string = 'tutor2@example.com', password: string = 'test123'): Promise<boolean> => {
  
  try {
    const result = await handleTutorLogin({ email, password });
    if (result) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
};

// Test authentication status
export const testAuthStatus = (): { isAuth: boolean; token: string | null; user: any } => {
  const isAuth = isAuthenticated();
  const token = getAuthToken();
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  let user = null;
  
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
    }
  }
  
  return { isAuth, token, user };
};
