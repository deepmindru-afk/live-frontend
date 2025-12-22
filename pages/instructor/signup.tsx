import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { handleTutorSignup, isAuthenticated, getCurrentUser, redirectBasedOnRole } from '../../lib/simple-auth-handlers';
import { SignupData } from '../../lib/simple-auth-handlers';
import { useTheme } from '../../lib/theme-context';

const InstructorSignupPage: React.FC = () => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState<SignupData>({
    displayName: '',
    email: '',
    password: '',
    organization: '',
    department: '',
    phone: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<SignupData & { confirmPassword: string }>>({});
  
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
            // Redirect to member signup if not instructor
            router.push('/signup');
          }
        }
      }
    };
    checkAuth();
  }, [router]);

  const validateForm = (): boolean => {
    const newErrors: Partial<SignupData & { confirmPassword: string }> = {};

    if (!formData.displayName) {
      newErrors.displayName = 'Display name is required';
    } else if (formData.displayName.length < 2) {
      newErrors.displayName = 'Display name must be at least 2 characters';
    }

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

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name as keyof (SignupData & { confirmPassword: string })]) {
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
      // Use tutor signup function which will assign TUTOR role
      const success = await handleTutorSignup(formData);
      if (success) {
        // Get user data and redirect based on role
        const user = await getCurrentUser();
        if (user) {
          redirectBasedOnRole(user);
        } else {
          // Fallback redirect
          window.location.href = '/instructor';
        }
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>HRDE - Instructor Signup</title>
        <meta name="description" content="Instructor signup for HRDE" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="auth-container instructor-auth">
        <div className="auth-modal">
          <div className="logo">
            <Image
              src={theme === 'dark' ? '/darkMode.png' : '/mainLogo.png'}
              alt="HRDE"
              width={150}
              height={69}
              style={{
                objectFit: 'contain'
              }}
            />
          </div>

          <div className="form-section">
            <h2 className="form-title">강사 회원 가입</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="displayName">강사명 *</label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  className={`form-input ${errors.displayName ? 'error' : ''}`}
                  placeholder="강사명을 입력하세요"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
                {errors.displayName && <div className="error-message">{errors.displayName}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="email">이메일 *</label>
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
                <label htmlFor="password">비밀번호 *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="비밀번호를 입력하세요 (최소 6자)"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
                {errors.password && <div className="error-message">{errors.password}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">비밀번호 확인 *</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
                {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="organization">소속 기관 *</label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  className="form-input"
                  placeholder="소속 기관을 입력하세요"
                  value={formData.organization}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="department">부서/학과</label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  className="form-input"
                  placeholder="부서 또는 학과를 입력하세요"
                  value={formData.department}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">연락처</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="form-input"
                  placeholder="연락처를 입력하세요"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <button 
                type="submit" 
                className="submit-button"
                disabled={isLoading}
              >
                {isLoading ? '가입 중...' : '강사 회원가입'}
              </button>
            </form>
          </div>

          <div className="divider">
            <span className="divider-text">OR</span>
          </div>

          <div className="auth-options">
            <Link href="/instructor/login" className="signup-link">
              이미 강사 계정이 있으신가요? 로그인
            </Link>
            <Link href="/signup" className="link-button">
              일반 회원 가입
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstructorSignupPage;
