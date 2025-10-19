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

// Production error handling
if (typeof window !== 'undefined') {
  // Global error handler for production
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Don't show error alerts in production
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Don't show error alerts in production
  });
}