// Simple authentication handlers without Apollo Client
// These make direct HTTP requests to the GraphQL backend

import { print } from 'graphql';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  displayName: string;
  email: string;
  password: string;
}

// GraphQL endpoint
const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3007/graphql';

// Login mutation
const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
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
    queryString = print(query);
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
    data = await response.json();
    console.log('🌐 GRAPHQL: Response data preview:', JSON.stringify(data, null, 2).substring(0, 1000) + '...');
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('🌐 GRAPHQL: GraphQL errors in response:', data.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    
  } catch (jsonError) {
    console.error('🌐 GRAPHQL: Failed to parse JSON response:', jsonError);
    throw new Error('Invalid JSON response from server');
  }
  
  if (data.errors) {
    console.error('🌐 GRAPHQL: GraphQL errors:', data.errors);
    const errorMessage = data.errors[0]?.message || 'Unknown GraphQL error';
    throw new Error(errorMessage);
  }

  return data.data;
}

// Handle login
export const handleLogin = async (credentials: LoginCredentials): Promise<boolean> => {
  try {
    console.log('🔐 LOGIN: Attempting login with:', credentials);
    console.log('🔐 LOGIN: GraphQL endpoint:', GRAPHQL_ENDPOINT);
    
    const data = await makeGraphQLRequest(LOGIN_MUTATION, {
      input: {
        email: credentials.email,
        password: credentials.password,
      }
    });

    console.log('🔐 LOGIN: Response received:', data);

    if (data.login && data.login.token) {
      // Save JWT to localStorage
      setAuthToken(data.login.token);
      
      // Show success message
      alert(`Welcome back, ${data.login.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Login failed - no token received');
    }
  } catch (error: any) {
    console.error('Login error:', error);
    alert(`Login failed: ${error.message}`);
    return false;
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
      
      // Show success message
      alert(`Welcome back, Tutor ${data.tutorLogin.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Tutor login failed - no token received');
    }
  } catch (error: any) {
    console.error('Tutor login error:', error);
    alert(`Tutor login failed: ${error.message}`);
    return false;
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
      
      // Show success message
      alert(`Welcome to Meet: mate, ${data.signup.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Signup failed - no token received');
    }
  } catch (error: any) {
    console.error('Signup error:', error);
    alert(`Signup failed: ${error.message}`);
    return false;
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
      
      // Show success message
      alert(`Welcome to Meet: mate as a Tutor, ${data.tutorSignup.user.displayName}!`);
      
      return true;
    } else {
      throw new Error('Tutor signup failed - no token received');
    }
  } catch (error: any) {
    console.error('Tutor signup error:', error);
    alert(`Tutor signup failed: ${error.message}`);
    return false;
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
