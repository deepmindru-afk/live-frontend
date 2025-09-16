import { apolloClient } from '../apollo/client';
import { LOGIN, SIGNUP } from '../apollo/auth/mutations';
import { GET_CURRENT_USER } from '../apollo/auth/queries';
import Swal from 'sweetalert2';

// ===== AUTHENTICATION HANDLERS =====

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  displayName: string;
  organization?: string;
  department?: string;
  phone?: string;
  language?: string;
  timezone?: string;
}

// Login handler
export const handleLogin = async (credentials: LoginCredentials): Promise<boolean> => {
  try {
    const { data } = await apolloClient.mutate({
      mutation: LOGIN,
      variables: {
        email: credentials.email,
        password: credentials.password,
      },
    });

    if (data.login.success && data.login.token) {
      // Save JWT to localStorage
      localStorage.setItem('jwt', data.login.token);
      
      // Show success message
      await Swal.fire({
        icon: 'success',
        title: 'Login Successful!',
        text: `Welcome back, ${data.login.user.displayName}!`,
        timer: 2000,
        showConfirmButton: false,
      });

      return true;
    } else {
      throw new Error(data.login.message || 'Login failed');
    }
  } catch (error: any) {
    console.error('Login error:', error);
    
    // Show error with SweetAlert2
    await Swal.fire({
      icon: 'error',
      title: 'Login Failed',
      text: error.message || 'Invalid email or password. Please try again.',
      confirmButtonText: 'Try Again',
    });

    return false;
  }
};

// Signup handler
export const handleSignup = async (signupData: SignupData): Promise<boolean> => {
  try {
    const input = {
      email: signupData.email,
      password: signupData.password,
      displayName: signupData.displayName,
      organization: signupData.organization,
      department: signupData.department,
      phone: signupData.phone,
      language: signupData.language || 'en',
      timezone: signupData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    const { data } = await apolloClient.mutate({
      mutation: SIGNUP,
      variables: { input },
    });

    if (data.signup.success && data.signup.token) {
      // Save JWT to localStorage
      localStorage.setItem('jwt', data.signup.token);
      
      // Show success message
      await Swal.fire({
        icon: 'success',
        title: 'Signup Successful!',
        text: `Welcome to Meet: mate, ${data.signup.user.displayName}!`,
        timer: 2000,
        showConfirmButton: false,
      });

      return true;
    } else {
      throw new Error(data.signup.message || 'Signup failed');
    }
  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Show error with SweetAlert2
    await Swal.fire({
      icon: 'error',
      title: 'Signup Failed',
      text: error.message || 'Failed to create account. Please try again.',
      confirmButtonText: 'Try Again',
    });

    return false;
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('jwt');
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
  try {
    if (!isAuthenticated()) {
      return null;
    }

    const { data } = await apolloClient.query({
      query: GET_CURRENT_USER,
      fetchPolicy: 'cache-first',
    });

    return data.me;
  } catch (error: any) {
    console.error('Get current user error:', error);
    return null;
  }
};

// Logout handler
export const handleLogout = (): void => {
  localStorage.removeItem('jwt');
  apolloClient.clearStore();
  
  // Show logout message
  Swal.fire({
    icon: 'info',
    title: 'Logged Out',
    text: 'You have been successfully logged out.',
    timer: 1500,
    showConfirmButton: false,
  });
};

// Redirect based on user role
export const redirectBasedOnRole = (user: any): void => {
  if (typeof window === 'undefined') return;

  switch (user.systemRole) {
    case 'ADMIN':
      window.location.href = '/admin';
      break;
    case 'TUTOR':
      window.location.href = '/instructor/dashboard';
      break;
    case 'MEMBER':
    default:
      window.location.href = '/';
      break;
  }
};
