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

// GraphQL endpoint
const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3007/graphql';

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
      console.error('🌐 GRAPHQL: Invalid query object:', query);
      throw new Error('Invalid GraphQL query: query is undefined or not a valid GraphQL AST');
    }
  }
  
  console.log('🌐 GRAPHQL: Making request to:', GRAPHQL_ENDPOINT);
  console.log('🌐 GRAPHQL: Query type:', typeof queryString);
  console.log('🌐 GRAPHQL: Query:', queryString.substring(0, 200) + '...');
  console.log('🌐 GRAPHQL: Variables:', variables);
  console.log('🌐 GRAPHQL: Token available:', !!token);
  console.log('🌐 GRAPHQL: Token preview:', token ? token.substring(0, 50) + '...' : 'null');
  console.log('🌐 GRAPHQL: Environment check - NEXT_PUBLIC_GRAPHQL_URL:', process.env.NEXT_PUBLIC_GRAPHQL_URL);

  const requestBody = {
    query: queryString,
    variables,
  };

  console.log('🌐 GRAPHQL: Request body preview:', JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apollo-require-preflight': 'true',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('🌐 GRAPHQL: Authorization header added');
  } else {
    console.warn('🌐 GRAPHQL: No token available - request will be unauthenticated');
  }
  
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  console.log('🌐 GRAPHQL: Response status:', response.status);
  console.log('🌐 GRAPHQL: Response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('🌐 GRAPHQL: Error response:', errorText);
    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }

  let data;
  try {
    console.log('🌐 GRAPHQL: About to parse JSON response...');
    data = await response.json();
    console.log('🌐 GRAPHQL: Response data preview:', JSON.stringify(data, null, 2).substring(0, 1000) + '...');
  } catch (jsonError) {
    console.error('🌐 GRAPHQL: Failed to parse JSON response:', jsonError);
    throw new Error('Invalid JSON response from server');
  }
  
  // Check for GraphQL errors after successful JSON parsing
  if (data.errors) {
    console.error('🌐 GRAPHQL: GraphQL errors in response:', data.errors);
    
    // Handle specific authentication errors
    const firstError = data.errors[0];
    console.log('🌐 GRAPHQL: First error details:', {
      message: firstError.message,
      code: firstError.extensions?.code
    });
    
    if (firstError.message === 'Invalid credentials' || firstError.extensions?.code === 'UNAUTHENTICATED') {
      console.log('🌐 GRAPHQL: Throwing Invalid credentials error');
      throw new Error('Invalid credentials');
    }
    
    // Handle JWT expiration
    if (firstError.message === 'jwt expired' || firstError.message.includes('jwt expired')) {
      console.log('🌐 GRAPHQL: JWT token expired');
      throw new Error('JWT_EXPIRED');
    }
    
    // Handle token not exist
    if (firstError.message === 'TOKEN_NOT_EXIST' || firstError.extensions?.code === 'TOKEN_NOT_EXIST') {
      console.log('🌐 GRAPHQL: Token does not exist');
      throw new Error('TOKEN_NOT_EXIST');
    }
    
    // Handle user not found error gracefully
    if (firstError.message === 'User not found' || firstError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
      console.log('🌐 GRAPHQL: User not found, clearing auth and returning null');
      clearAuthToken();
      return null;
    }
    
    // Handle authentication errors gracefully
    if (firstError.message.includes('Unauthorized') || firstError.message.includes('Forbidden')) {
      console.log('🌐 GRAPHQL: Unauthorized access, clearing auth and returning null');
      clearAuthToken();
      return null;
    }
    
    // For other GraphQL errors, show user-friendly error
    console.log('🌐 GRAPHQL: Throwing user-friendly GraphQL error');
    const errorMessage = firstError.message || 'An error occurred';
    throw new Error(errorMessage);
  }
  
  console.log('🌐 GRAPHQL: No errors found, returning data');
  

  return data.data;
}

// Handle login
export const handleLogin = async (credentials: LoginCredentials): Promise<boolean> => {
  try {
    console.log('🔐 LOGIN: Attempting login with:', credentials);
    console.log('🔐 LOGIN: GraphQL endpoint:', GRAPHQL_ENDPOINT);
    
    const data = await makeGraphQLRequest(LOGIN_MUTATION, {
      email: credentials.email,
      password: credentials.password,
    });

    console.log('🔐 LOGIN: Response received:', data);

    if (data.login && data.login.token) {
      // Save JWT to localStorage
      setAuthToken(data.login.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.login.user));
      console.log('🔐 LOGIN: User data stored in localStorage');
      
      // Show success message
      alert(`Welcome back, ${data.login.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Login failed - no token received');
    }
  } catch (error: any) {
    console.error('Login error:', error);
    // Re-throw the error so the calling function can handle it with SweetAlert
    throw error;
  }
};

// Handle tutor login
export const handleTutorLogin = async (credentials: LoginCredentials): Promise<boolean> => {
  try {
    console.log('🎓 TUTOR LOGIN: Attempting tutor login with:', credentials);
    console.log('🎓 TUTOR LOGIN: GraphQL endpoint:', GRAPHQL_ENDPOINT);
    
    const data = await makeGraphQLRequest(TUTOR_LOGIN_MUTATION, {
      input: {
        email: credentials.email,
        password: credentials.password,
      }
    });

    console.log('🎓 TUTOR LOGIN: Response received:', data);

    if (data.tutorLogin && data.tutorLogin.token) {
      // Save JWT to localStorage
      setAuthToken(data.tutorLogin.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.tutorLogin.user));
      console.log('🎓 TUTOR LOGIN: User data stored in localStorage');
      
      // Show success message
      alert(`Welcome back, Tutor ${data.tutorLogin.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Tutor login failed - no token received');
    }
  } catch (error: any) {
    console.error('🎓 TUTOR LOGIN: Caught error in handleTutorLogin:', error);
    console.error('🎓 TUTOR LOGIN: Error message:', error.message);
    console.error('🎓 TUTOR LOGIN: Error type:', typeof error);
    // Re-throw the error so the calling function can handle it with SweetAlert
    throw error;
  }
};

// Handle signup
export const handleSignup = async (input: SignupData): Promise<boolean> => {
  try {
    console.log('🚀 SIGNUP: Attempting signup with:', input);
    console.log('🚀 SIGNUP: GraphQL endpoint:', GRAPHQL_ENDPOINT);
    
    const data = await makeGraphQLRequest(SIGNUP_MUTATION, {
      displayName: input.displayName,
      email: input.email,
      password: input.password,
    });

    console.log('🚀 SIGNUP: Response received:', data);

    if (data.signup && data.signup.token) {
      // Save JWT to localStorage
      setAuthToken(data.signup.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.signup.user));
      console.log('🚀 SIGNUP: User data stored in localStorage');
      
      // Show success message
      alert(`Welcome to HRDe Live, ${data.signup.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Signup failed - no token received');
    }
  } catch (error: any) {
    console.error('Signup error:', error);
    // Re-throw the error so the calling function can handle it with SweetAlert
    throw error;
  }
};

// Handle tutor signup
export const handleTutorSignup = async (input: SignupData): Promise<boolean> => {
  try {
    console.log('🎓 TUTOR SIGNUP: Attempting tutor signup with:', input);
    console.log('🎓 TUTOR SIGNUP: GraphQL endpoint:', GRAPHQL_ENDPOINT);
    
    const data = await makeGraphQLRequest(TUTOR_SIGNUP_MUTATION, {
      displayName: input.displayName,
      email: input.email,
      password: input.password,
      department: input.department || '',
    });

    console.log('🎓 TUTOR SIGNUP: Response received:', data);

    if (data.tutorSignup && data.tutorSignup.token) {
      // Save JWT to localStorage
      setAuthToken(data.tutorSignup.token);
      
      // Save user data to localStorage
      localStorage.setItem('user', JSON.stringify(data.tutorSignup.user));
      console.log('🎓 TUTOR SIGNUP: User data stored in localStorage');
      
      // Show success message
      alert(`Welcome to HRDe Live as a Tutor, ${data.tutorSignup.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Tutor signup failed - no token received');
    }
  } catch (error: any) {
    console.error('Tutor signup error:', error);
    // Re-throw the error so the calling function can handle it with SweetAlert
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
    console.log('👤 GET_USER: Response data:', data);
    
    // Check if the response has the expected structure
    if (data && data.me) {
      return data.me;
    } else {
      console.warn('👤 GET_USER: No user data in response:', data);
      return null;
    }
  } catch (error) {
    console.error('👤 GET_USER: Error fetching current user:', error);
    // Clear invalid token
    clearAuthToken();
    return null;
  }
};

// Handle logout
export const handleLogout = async (): Promise<boolean> => {
  try {
    console.log('🚪 LOGOUT: Attempting logout');
    
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
    console.log('🚪 LOGOUT: Response received:', data);

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
    console.error('🚪 LOGOUT: Error during logout:', error);
    // Still clear the token even if request fails
    clearAuthToken();
    alert('You have been logged out.');
    return true;
  }
};

// Redirect based on user role
export const redirectBasedOnRole = (user: any): void => {
  if (typeof window === 'undefined') return;

  console.log('🔄 REDIRECT: Redirecting user based on role:', user.systemRole);

  switch (user.systemRole) {
    case 'ADMIN':
      console.log('🔄 REDIRECT: Admin user - redirecting to dashboard');
      window.location.href = '/dashboard';
      break;
    case 'TUTOR':
      console.log('🔄 REDIRECT: Tutor user - redirecting to instructor dashboard');
      window.location.href = '/instructor';
      break;
    case 'MEMBER':
      console.log('🔄 REDIRECT: Member user - redirecting to member dashboard');
      window.location.href = '/member';
      break;
    default:
      console.log('🔄 REDIRECT: Unknown role - redirecting to dashboard');
      window.location.href = '/dashboard';
      break;
  }
};

// Token management
export const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('jwt', token);
    localStorage.setItem('token', token); // Also store as 'token' for compatibility
    console.log('🔐 AUTH: Token stored in localStorage');
  }
};

export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    // Try both 'jwt' and 'token' keys for compatibility
    const jwtToken = localStorage.getItem('jwt');
    const tokenKey = localStorage.getItem('token');
    const token = jwtToken || tokenKey;
    
    if (token) {
      console.log('🔐 AUTH: Token found in localStorage');
      return token;
    } else {
      console.log('🔐 AUTH: No token found in localStorage');
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
    console.log('🔐 AUTH: All auth data cleared from localStorage');
  }
};

// Force login for testing
export const forceLogin = async (email: string = 'tutor2@example.com', password: string = 'test123'): Promise<boolean> => {
  console.log('🔐 FORCE LOGIN: Attempting forced login...');
  
  try {
    const result = await handleTutorLogin({ email, password });
    if (result) {
      console.log('🔐 FORCE LOGIN: Success! User logged in');
      return true;
    } else {
      console.log('🔐 FORCE LOGIN: Failed to login');
      return false;
    }
  } catch (error) {
    console.error('🔐 FORCE LOGIN: Error:', error);
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
      console.error('Failed to parse user data:', e);
    }
  }
  
  console.log('🔐 AUTH STATUS:', { isAuth, token: token ? token.substring(0, 50) + '...' : null, user });
  return { isAuth, token, user };
};
