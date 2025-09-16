import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { handleLogin, isAuthenticated, getCurrentUser, redirectBasedOnRole } from '../../../lib/auth-handlers';
import { LoginCredentials } from '../../../lib/auth-handlers';

const InstructorLoginPage: React.FC = () => {
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
          // Check if user is instructor or admin
          if (user.systemRole === 'TUTOR' || user.systemRole === 'ADMIN') {
            redirectBasedOnRole(user);
          } else {
            // Redirect to member login if not instructor
            router.push('/login');
          }
        }
      }
    };
    checkAuth();
  }, [router]);

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
        // Get user data and check if instructor
        const user = await getCurrentUser();
        if (user) {
          if (user.systemRole === 'TUTOR' || user.systemRole === 'ADMIN') {
            redirectBasedOnRole(user);
          } else {
            // Show error if not instructor
            const { default: Swal } = await import('sweetalert2');
            await Swal.fire({
              icon: 'error',
              title: 'Access Denied',
              text: 'This account is not authorized for instructor access.',
              confirmButtonText: 'OK',
            });
            // Redirect to member login
            router.push('/login');
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Meet: mate - Instructor Login</title>
        <meta name="description" content="Instructor login to Meet: mate" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="auth-container instructor-auth">
        <div className="auth-modal">
          <div className="logo">
            <h1 className="app-name">
              <span className="meet">Meet:</span>
              <span className="mate">
                <span className="stylized-m">m</span>ate
              </span>
            </h1>
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
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  placeholder="강사 이메일을 입력하세요"
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
