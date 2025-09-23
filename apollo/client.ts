import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// ===== APOLLO CLIENT CONFIGURATION =====

// HTTP Link for queries and mutations
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3007/graphql',
});

// WebSocket Link removed for now to fix build issues

// Auth Link to add token to requests
const authLink = setContext((_, { headers }) => {
  // Check if we're on the client side before accessing localStorage
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem('jwt');
      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : '',
        },
      };
    } catch (error) {
      console.warn('localStorage not available:', error);
      return { headers };
    }
  }
  return { headers };
});

// Error Link for handling errors
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    
    // Handle 401 errors (unauthorized)
    if ('statusCode' in networkError && networkError.statusCode === 401) {
      // Clear token and redirect to login (only on client side)
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('jwt');
          window.location.href = '/login';
        } catch (error) {
          console.warn('localStorage not available:', error);
        }
      }
    }
  }
});

// Cache configuration
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // Cache participants by meeting
        getParticipantsByMeeting: {
          keyArgs: ['meetingId'],
          merge(existing = [], incoming) {
            return incoming;
          },
        },
        // Cache chat history
        getChatHistory: {
          keyArgs: ['meetingId'],
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          },
        },
        // Cache VODs
        getAllVods: {
          keyArgs: ['query'],
          merge(existing = [], incoming) {
            return incoming;
          },
        },
      },
    },
  },
});

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache,
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});

// ===== HELPER FUNCTIONS =====

// Token management
export const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('jwt', token);
      // Reset Apollo Client cache to apply new token
      apolloClient.resetStore();
    } catch (error) {
      console.warn('localStorage not available:', error);
    }
  }
};

export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('jwt');
    } catch (error) {
      console.warn('localStorage not available:', error);
      return null;
    }
  }
  return null;
};

export const clearAuthToken = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('jwt');
      apolloClient.clearStore();
    } catch (error) {
      console.warn('localStorage not available:', error);
    }
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    // Basic JWT token validation (you might want to use a proper JWT library)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
};

// Get user info from token
export const getUserFromToken = (): any => {
  const token = getAuthToken();
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
};

// ===== EXPORTS =====
export default apolloClient;
