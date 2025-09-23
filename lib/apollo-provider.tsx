import React from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '../apollo/client';

interface ApolloProviderWrapperProps {
  children: React.ReactNode;
}

const ApolloProviderWrapper: React.FC<ApolloProviderWrapperProps> = ({ children }) => {
  return (
    <ApolloProvider client={apolloClient}>
      {children}
    </ApolloProvider>
  );
};

export default ApolloProviderWrapper;
