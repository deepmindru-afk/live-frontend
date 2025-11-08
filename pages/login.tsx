import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { handleLogin, isAuthenticated, getCurrentUser, redirectBasedOnRole } from '../lib/simple-auth-handlers';
import { LoginCredentials } from '../lib/simple-auth-handlers';
import Swal from 'sweetalert2';

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<LoginCredentials>>({});
  
  const router = useRouter();

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        const user = await getCurrentUser();
        if (user) {
          redirectBasedOnRole(user);
        }
      }
    };
    checkAuth();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginCredentials> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[name as keyof LoginCredentials]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const success = await handleLogin(formData);
      if (success) {
        // handleLogin already has delays and token verification built in
        // User data is already saved to localStorage during login
        // Simply redirect to member dashboard
        router.push('/member');
      }
    } catch (error: any) {
      
      // Handle different types of errors with SweetAlert
      let errorMessage = '로그인 중 오류가 발생했습니다.';
      
      if (error.message && error.message.includes('Invalid credentials')) {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
      } else if (error.message && error.message.includes('UNAUTHENTICATED')) {
        errorMessage = '인증에 실패했습니다. 다시 시도해주세요.';
      } else if (error.message && error.message.includes('GraphQL errors')) {
        errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }
      
      await Swal.fire({
        icon: 'error',
        title: '로그인 실패',
        text: errorMessage,
        confirmButtonText: '확인',
        confirmButtonColor: '#d32f2f'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>HRDE - Member Login</title>
        <meta name="description" content="Login to HRDE" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="auth-container">
        <div className="auth-modal">
          <div className="logo">
            <Image
              src="/Icons/HRDeOnAirLogo.svg"
              alt="HRDE"
              width={150}
              height={69}
              style={{
                objectFit: 'contain'
              }}
            />
          </div>

          <div className="form-section">
            <h2 className="form-title">로그인</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">이메일</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  placeholder="이메일을 입력하세요"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
                {errors.email && <div className="error-message">{errors.email}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="password">비밀번호</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="비밀번호를 입력하세요"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
                {errors.password && <div className="error-message">{errors.password}</div>}
              </div>

              <button 
                type="submit" 
                className="submit-button"
                disabled={isLoading}
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </button>
            </form>
          </div>

          <div className="divider">
            <span className="divider-text">OR</span>
          </div>

          <div className="auth-options">
            <Link href="/signup" className="signup-link">
              회원 가입
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;