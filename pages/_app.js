import '../styles/auth.scss';
import '../styles/dashboard.scss';
import '../pages/app/globals.css';
import ApolloProviderWrapper from '../lib/apollo-provider';

export default function App({ Component, pageProps }) {
  return (
    <ApolloProviderWrapper>
      <Component {...pageProps} />
    </ApolloProviderWrapper>
  );
}