import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { handleSSOLogin, redirectBasedOnRole } from '../lib/simple-auth-handlers';
import Swal from 'sweetalert2';

const SSOLoginPage: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processSSOLogin = async () => {
      try {
        // Get JWT token from URL parameters
        const { token } = router.query;
        
        if (!token || typeof token !== 'string') {
          throw new Error('No JWT token provided in URL parameters');
        }

        console.log('🔐 Processing SSO login with token:', token.substring(0, 50) + '...');

        // Attempt SSO login
        const success = await handleSSOLogin(token);
        
        if (success) {
          // Get user data and redirect based on role
          const userData = localStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            console.log('✅ SSO login successful, redirecting user:', user);
            
            // Show success message
            await Swal.fire({
              icon: 'success',
              title: '로그인 성공!',
              text: `환영합니다, ${user.displayName}님!`,
              timer: 2000,
              showConfirmButton: false
            });
            
            // Redirect based on user role
            redirectBasedOnRole(user);
          } else {
            throw new Error('User data not found after successful login');
          }
        } else {
          throw new Error('SSO login failed');
        }
      } catch (error: any) {
        console.error('❌ SSO login error:', error);
        setError(error.message);
        
        // Show error message
        await Swal.fire({
          icon: 'error',
          title: 'SSO 로그인 실패',
          text: error.message || 'SSO 로그인 중 오류가 발생했습니다.',
          confirmButtonText: '로그인 페이지로 이동',
          confirmButtonColor: '#d32f2f'
        }).then(() => {
          // Redirect to regular login page
          router.push('/login');
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Only process SSO login if we have query parameters
    if (router.isReady) {
      processSSOLogin();
    }
  }, [router.isReady, router.query]);

  if (isLoading) {
    return (
      <>
        <Head>
          <title>HRDE - SSO 로그인</title>
          <meta name="description" content="SSO Login to HRDE" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                SSO 로그인 처리 중...
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                잠시만 기다려주세요.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>HRDE - SSO 로그인 오류</title>
          <meta name="description" content="SSO Login Error" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-red-600">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                SSO 로그인 오류
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {error}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => router.push('/login')}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  로그인 페이지로 이동
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null; // This should not be reached
};

export default SSOLoginPage;




