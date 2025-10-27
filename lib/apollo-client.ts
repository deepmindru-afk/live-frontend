import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3007/graphql',
});

const authLink = setContext((_, { headers }) => {
  // Check if we're on the client side before accessing localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
      'apollo-require-preflight': 'true', // Required for CSRF protection
    }
  };
});

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
    });
  }

  if (networkError) {
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});
