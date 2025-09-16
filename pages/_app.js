import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '../apollo/client';
import '../public/sass/auth.scss';
import '../pages/app/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <ApolloProvider client={apolloClient}>
      <Component {...pageProps} />
    </ApolloProvider>
  );
}