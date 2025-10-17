import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { handleSignup, isAuthenticated, getCurrentUser, redirectBasedOnRole } from '../lib/simple-auth-handlers';
import { SignupData } from '../lib/simple-auth-handlers';
import Swal from 'sweetalert2';

const SignupPage: React.FC = () => {
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
          redirectBasedOnRole(user);
        }
      }
    };
    checkAuth();
  }, []);

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
      // Only send required fields to backend
      const signupData = {
        displayName: formData.displayName,
        email: formData.email,
        password: formData.password,
      };
      
      const success = await handleSignup(signupData);
      if (success) {
        // Get user data and redirect
        const user = await getCurrentUser();
        if (user) {
          redirectBasedOnRole(user);
        } else {
          router.push('/');
        }
      }
    } catch (error: any) {
      
      // Handle different types of errors with SweetAlert
      let errorMessage = '회원가입 중 오류가 발생했습니다.';
      
      if (error.message && error.message.includes('Email already exists')) {
        errorMessage = '이미 사용 중인 이메일입니다.';
      } else if (error.message && error.message.includes('Invalid email')) {
        errorMessage = '올바른 이메일 형식을 입력해주세요.';
      } else if (error.message && error.message.includes('Password too weak')) {
        errorMessage = '비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.';
      } else if (error.message && error.message.includes('GraphQL errors')) {
        errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }
      
      await Swal.fire({
        icon: 'error',
        title: '회원가입 실패',
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
        <title>HRDE - Member Signup</title>
        <meta name="description" content="Sign up for HRDE" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="auth-container">
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
            <h2 className="form-title">회원 가입</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="displayName">이름 *</label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  className={`form-input ${errors.displayName ? 'error' : ''}`}
                  placeholder="이름을 입력하세요"
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
                  placeholder="이메일을 입력하세요"
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
                <label htmlFor="organization">조직 (선택사항)</label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  className="form-input"
                  placeholder="조직명을 입력하세요"
                  value={formData.organization}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="department">부서 (선택사항)</label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  className="form-input"
                  placeholder="부서명을 입력하세요"
                  value={formData.department}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">전화번호 (선택사항)</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="form-input"
                  placeholder="전화번호를 입력하세요"
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
                {isLoading ? '가입 중...' : '회원가입'}
              </button>
            </form>
          </div>

          <div className="divider">
            <span className="divider-text">OR</span>
          </div>

          <div className="auth-options">
            <Link href="/login" className="signup-link">
              이미 계정이 있으신가요? 로그인
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
