import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { handleTutorLogin, isAuthenticated, getCurrentUser, redirectBasedOnRole } from '../../lib/simple-auth-handlers';
import { LoginCredentials } from '../../lib/simple-auth-handlers';
import Swal from 'sweetalert2';

const InstructorLoginPage: React.FC = () => {
  const [formData, setFormData] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<LoginCredentials>>({});

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      // Check if user has valid token AND user data in localStorage
      if (isAuthenticated()) {
        // Get user from localStorage directly (don't call API)
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            if (user && user._id && user.email) {
              console.log('✅ User already authenticated, redirecting...');
              redirectBasedOnRole(user);
              return;
            }
          } catch (e) {
            console.warn('⚠️ Failed to parse user data:', e);
          }
        }
        
        // If no valid user in localStorage but token exists, clear and stay on login
        console.warn('⚠️ Token exists but no valid user data, clearing...');
        localStorage.removeItem('jwt');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    };
    checkAuth();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const success = await handleTutorLogin(formData);
      if (success) {
        // handleTutorLogin already has delays built in, no need to add more
        // The token is already verified and saved in handleTutorLogin
        
        // Simply redirect based on the role (user data is already saved in localStorage)
        // Don't call getCurrentUser() here as it may try to fetch from API before token is fully ready
        console.log('✅ Login successful, redirecting to instructor dashboard');
        window.location.href = '/instructor';
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
        <title>HRDE - Instructor Login</title>
        <meta name="description" content="Instructor login to HRDE" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="auth-container instructor-auth">
        <div className="auth-modal">
          <div className="logo">
            <Image
              src="/logoHRDe.png"
              alt="HRDE"
              width={150}
              height={69}
              style={{
                objectFit: 'contain'
              }}
            />
          </div>

          <div className="form-section">
            <h2 className="form-title">강사 로그인</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">이메일</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-input"
                  placeholder="강사 이메일을 입력하세요"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">비밀번호</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="form-input"
                  placeholder="비밀번호를 입력하세요"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <button 
                type="submit" 
                className="submit-button"
                disabled={isLoading}
              >
                {isLoading ? '로그인 중...' : '강사 로그인'}
              </button>
            </form>
          </div>

          <div className="divider">
            <span className="divider-text">OR</span>
          </div>

          <div className="auth-options">
            <Link href="/instructor/signup" className="signup-link">
              강사 회원 가입
            </Link>
            <Link href="/login" className="link-button">
              일반 회원 로그인
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstructorLoginPage;