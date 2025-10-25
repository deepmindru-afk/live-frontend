// Simple authentication handlers without Apollo Client
// These make direct HTTP requests to the GraphQL backend

import { print } from 'graphql';
import Swal from 'sweetalert2';

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

console.log('🔗 GraphQL Endpoint:', GRAPHQL_ENDPOINT);

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
      displayName
      email
      systemRole
    }
  }
`;

// Make GraphQL request
export async function makeGraphQLRequest(query: string | any, variables: any = {}) {
  const token = getAuthToken();
  
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
  
  console.log('🔍 GraphQL Request:', {
    endpoint: GRAPHQL_ENDPOINT,
    hasToken: !!token,
    queryName: queryString.includes('getMeetingAttendance') ? 'getMeetingAttendance' : 'other',
    variables
  });

  const requestBody = {
    query: queryString,
    variables,
  };
  

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apollo-require-preflight': 'true',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('🔐 Using token for authentication');
  } else {
    console.warn('⚠️ No token found for GraphQL request');
  }
  
  console.log('📡 Making GraphQL request to:', GRAPHQL_ENDPOINT);
  console.log('📡 Request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  console.log('📡 Response status:', response.status);
  console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ GraphQL request failed:', {
      status: response.status,
      statusText: response.statusText,
      url: GRAPHQL_ENDPOINT,
      error: errorText
    });
    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }

  let data;
  try {
    data = await response.json();
    console.log('📊 GraphQL Response:', {
      hasData: !!data,
      hasErrors: !!data.errors,
      dataKeys: data ? Object.keys(data) : [],
      errors: data?.errors || null
    });
    
    if (data.errors) {
      console.error('❌ GraphQL Errors:', data.errors);
    }
  } catch (jsonError) {
    console.error('❌ JSON Parse Error:', jsonError);
    throw new Error('Invalid JSON response from server');
  }
  
  // Check for GraphQL errors after successful JSON parsing
  if (data.errors) {
    
    // Handle specific authentication errors
    const firstError = data.errors[0];
    
    if (firstError.message === 'Invalid credentials' || firstError.extensions?.code === 'UNAUTHENTICATED') {
      throw new Error('Invalid credentials');
    }
    
    // Handle JWT expiration
    if (firstError.message === 'jwt expired' || firstError.message.includes('jwt expired')) {
      throw new Error('JWT_EXPIRED');
    }
    
    // Handle token not exist
    if (firstError.message === 'TOKEN_NOT_EXIST' || firstError.extensions?.code === 'TOKEN_NOT_EXIST') {
      throw new Error('TOKEN_NOT_EXIST');
    }
    
    // Handle user not found error gracefully
    if (firstError.message === 'User not found' || firstError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
      clearAuthToken();
      return null;
    }
    
    // Handle authentication errors gracefully
    if (firstError.message.includes('Unauthorized') || firstError.message.includes('Forbidden')) {
      clearAuthToken();
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


    if (data.login && data.login.token) {
      // Save JWT to localStorage
      setAuthToken(data.login.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.login.user));
      
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


    if (data.tutorLogin && data.tutorLogin.token) {
      // Save JWT to localStorage
      setAuthToken(data.tutorLogin.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.tutorLogin.user));
      
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
    console.log('🔐 Starting SSO login with PHP token...');
    
    const data = await makeGraphQLRequest(SSO_LOGIN_MUTATION, {
      input: {
        token: phpToken
      }
    });

    console.log('🔐 SSO login response:', data);

    if (data.ssoLogin && data.ssoLogin.success && data.ssoLogin.token) {
      // Save JWT to localStorage
      setAuthToken(data.ssoLogin.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.ssoLogin.user));
      
      console.log(`✅ SSO login successful for ${data.ssoLogin.user.displayName} (${data.ssoLogin.existed ? 'existing' : 'new'} user)`);
      
      return true;
    } else {
      throw new Error('SSO login failed - no token received');
    }
  } catch (error: any) {
    console.error('❌ SSO login failed:', error);
    // Re-throw the error so the calling function can handle it
    throw error;
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    // Basic JWT token validation
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
};

// Get current user
export const getCurrentUser = async () => {
  if (!isAuthenticated()) return null;
  
  try {
    const data = await makeGraphQLRequest(GET_CURRENT_USER_QUERY);
    
    // Check if the response has the expected structure
    if (data && data.me) {
      return data.me;
    } else {
      return null;
    }
  } catch (error) {
    // Clear invalid token
    clearAuthToken();
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
      window.location.href = '/dashboard';
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

// Token management
export const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('jwt', token);
    localStorage.setItem('token', token); // Also store as 'token' for compatibility
  }
};

export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    // Try both 'jwt' and 'token' keys for compatibility
    const jwtToken = localStorage.getItem('jwt');
    const tokenKey = localStorage.getItem('token');
    const token = jwtToken || tokenKey;
    
    if (token) {
      return token;
    } else {
      return null;
    }
  }
  return null;
};

export const clearAuthToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('jwt');
    localStorage.removeItem('token'); // Clear both keys
    localStorage.removeItem('user'); // Also clear user data
  }
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
