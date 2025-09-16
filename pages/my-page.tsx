import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { getCurrentUser, isAuthenticated, makeGraphQLRequest } from '../lib/simple-auth-handlers';
import { UPLOAD_PROFILE_IMAGE, DELETE_PROFILE_IMAGE, UPDATE_PROFILE, CHANGE_PASSWORD } from '../apollo/auth/mutations';
import Swal from 'sweetalert2';

interface User {
  _id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  systemRole: string;
  organization?: string;
  department?: string;
  phone?: string;
  language?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

const MyPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    organization: '',
    department: '',
    phone: '',
    language: 'en',
    timezone: 'UTC',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        router.push('/login');
        return;
      }

      try {
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
          setFormData({
            displayName: userData.displayName || '',
            email: userData.email || '',
            organization: userData.organization || '',
            department: userData.department || '',
            phone: userData.phone || '',
            language: userData.language || 'en',
            timezone: userData.timezone || 'UTC',
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('👤 PROFILE UPDATE: Starting update with data:', formData);
      
      // Make GraphQL request
      const data = await makeGraphQLRequest(UPDATE_PROFILE, {
        input: {
          displayName: formData.displayName,
          organization: formData.organization,
          department: formData.department,
          phone: formData.phone,
          language: formData.language,
          timezone: formData.timezone
        }
      });
      
      console.log('👤 PROFILE UPDATE: Response received:', data);
      
      if (data.updateProfile) {
          // Update user state with new data
          setUser(prev => prev ? {
            ...prev,
            ...data.updateProfile
          } : null);
        
        await Swal.fire({
          icon: 'success',
          title: '성공',
          text: '프로필이 성공적으로 업데이트되었습니다.',
          confirmButtonText: '확인'
        });
        
        setIsEditing(false);
      } else {
        throw new Error('Profile update failed');
      }
    } catch (error: unknown) {
      console.error('👤 PROFILE UPDATE: Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: `프로필 업데이트 중 오류가 발생했습니다: ${errorMessage}`,
        confirmButtonText: '확인'
      });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: '새 비밀번호와 확인 비밀번호가 일치하지 않습니다.',
        confirmButtonText: '확인'
      });
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: '새 비밀번호는 최소 6자 이상이어야 합니다.',
        confirmButtonText: '확인'
      });
      return;
    }
    
    try {
      console.log('🔐 PASSWORD CHANGE: Starting password change');
      
      // Make GraphQL request
      const data = await makeGraphQLRequest(CHANGE_PASSWORD, {
        input: {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        }
      });
      
      console.log('🔐 PASSWORD CHANGE: Response received:', data);
      
      if (data.changePassword && data.changePassword.success) {
        await Swal.fire({
          icon: 'success',
          title: '성공',
          text: '비밀번호가 성공적으로 변경되었습니다.',
          confirmButtonText: '확인'
        });
        
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        throw new Error(data.changePassword?.message || 'Password change failed');
      }
    } catch (error: unknown) {
      console.error('🔐 PASSWORD CHANGE: Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: `비밀번호 변경 중 오류가 발생했습니다: ${errorMessage}`,
        confirmButtonText: '확인'
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        await Swal.fire({
          icon: 'error',
          title: '오류',
          text: '이미지 파일만 업로드할 수 있습니다.',
          confirmButtonText: '확인'
        });
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        await Swal.fire({
          icon: 'error',
          title: '오류',
          text: '파일 크기는 5MB 이하여야 합니다.',
          confirmButtonText: '확인'
        });
        return;
      }
      
      try {
        console.log('📤 IMAGE UPLOAD: Starting upload for file:', file.name);
        
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const base64String = event.target?.result as string;
            console.log('📤 IMAGE UPLOAD: File converted to base64, length:', base64String.length);
            
            // Make GraphQL request
            const data = await makeGraphQLRequest(UPLOAD_PROFILE_IMAGE, {
              file: base64String
            });
            
            console.log('📤 IMAGE UPLOAD: Response received:', data);
            
            if (data.uploadProfileImage && data.uploadProfileImage.success) {
              // Update user state with new avatar URL
              setUser(prev => prev ? {
                ...prev,
                avatarUrl: data.uploadProfileImage.avatarUrl
              } : null);
              
              await Swal.fire({
                icon: 'success',
                title: '성공',
                text: '프로필 이미지가 성공적으로 업로드되었습니다.',
                confirmButtonText: '확인'
              });
            } else {
              throw new Error(data.uploadProfileImage?.message || 'Upload failed');
            }
          } catch (error: unknown) {
            console.error('📤 IMAGE UPLOAD: Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await Swal.fire({
              icon: 'error',
              title: '오류',
              text: `이미지 업로드 중 오류가 발생했습니다: ${errorMessage}`,
              confirmButtonText: '확인'
            });
          }
        };
        
        reader.onerror = () => {
          Swal.fire({
            icon: 'error',
            title: '오류',
            text: '파일을 읽는 중 오류가 발생했습니다.',
            confirmButtonText: '확인'
          });
        };
        
        reader.readAsDataURL(file);
      } catch (error: unknown) {
        console.error('📤 IMAGE UPLOAD: Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await Swal.fire({
          icon: 'error',
          title: '오류',
          text: `이미지 업로드 중 오류가 발생했습니다: ${errorMessage}`,
          confirmButtonText: '확인'
        });
      }
    }
  };

  const handleImageDelete = async () => {
    try {
      const result = await Swal.fire({
        title: '프로필 이미지 삭제',
        text: '프로필 이미지를 삭제하시겠습니까?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '삭제',
        cancelButtonText: '취소',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
      });
      
      if (result.isConfirmed) {
        console.log('🗑️ IMAGE DELETE: Starting delete request');
        
        // Make GraphQL request
        const data = await makeGraphQLRequest(DELETE_PROFILE_IMAGE);
        
        console.log('🗑️ IMAGE DELETE: Response received:', data);
        
        if (data.deleteProfileImage && data.deleteProfileImage.success) {
          // Update user state to remove avatar URL
          setUser(prev => prev ? {
            ...prev,
            avatarUrl: undefined
          } : null);
          
          await Swal.fire({
            icon: 'success',
            title: '성공',
            text: '프로필 이미지가 삭제되었습니다.',
            confirmButtonText: '확인'
          });
        } else {
          throw new Error(data.deleteProfileImage?.message || 'Delete failed');
        }
      }
    } catch (error: unknown) {
      console.error('🗑️ IMAGE DELETE: Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: `이미지 삭제 중 오류가 발생했습니다: ${errorMessage}`,
        confirmButtonText: '확인'
      });
    }
  };

  if (loading) {
    return (
      <div className="my-page-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="my-page-container">
        <div className="error">사용자 데이터를 불러올 수 없습니다</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>내 페이지 - Meet: mate</title>
        <meta name="description" content="프로필 및 계정 설정 관리" />
      </Head>
      
      <div className="my-page-container">
        <header className="my-page-header">
          <div className="header-content">
            <button 
              className="back-button"
              onClick={() => router.push('/dashboard')}
              title="대시보드로 돌아가기"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            
            <div className="logo-container" onClick={() => router.push('/dashboard')}>
              <Image
                src="/logoHRDe.png"
                alt="Meet: mate"
                width={140}
                height={45}
                className="logo"
              />
            </div>
            
            <div className="user-info">
              <div className="user-avatar">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} />
                ) : (
                  <div className="avatar-placeholder">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="user-details">
                <h2 className="user-name">{user.displayName}</h2>
                <p className="user-email">{user.email}</p>
                <span className="user-role">{user.systemRole}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="my-page-content">
          <nav className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              프로필
            </button>
            <button
              className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              보안
            </button>
          </nav>

          <div className="tab-content">
            {activeTab === 'profile' && (
              <div className="profile-section">
                <div className="section-header">
                  <h3>프로필 정보</h3>
                  <button
                    className="edit-button"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? '취소' : '편집'}
                  </button>
                </div>

                <div className="profile-image-section">
                  <div className="profile-image">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} />
                    ) : (
                      <div className="image-placeholder">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="image-actions">
                    <label className="upload-button">
                      이미지 업로드
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {user.avatarUrl && (
                      <button className="delete-button" onClick={handleImageDelete}>
                        이미지 삭제
                      </button>
                    )}
                  </div>
                </div>

                <form onSubmit={handleProfileUpdate} className="profile-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="displayName">이름</label>
                      <input
                        type="text"
                        id="displayName"
                        name="displayName"
                        value={formData.displayName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="email">이메일</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="organization">조직</label>
                      <input
                        type="text"
                        id="organization"
                        name="organization"
                        value={formData.organization}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="department">부서</label>
                      <input
                        type="text"
                        id="department"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="phone">전화번호</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  {isEditing && (
                    <div className="form-actions">
                      <button type="submit" className="save-button">
                        변경사항 저장
                      </button>
                    </div>
                  )}
                </form>
                
                {/* Logout Button Section */}
                <div className="logout-section">
                  <button 
                    className="logout-button-main"
                    onClick={async () => {
                      try {
                        await Swal.fire({
                          title: '로그아웃',
                          text: '정말 로그아웃하시겠습니까?',
                          icon: 'warning',
                          showCancelButton: true,
                          confirmButtonText: '로그아웃',
                          cancelButtonText: '취소',
                          confirmButtonColor: '#d32f2f',
                          cancelButtonColor: '#757575'
                        }).then(async (result) => {
                          if (result.isConfirmed) {
                            // Import handleLogout from simple-auth-handlers
                            const { handleLogout } = await import('../lib/simple-auth-handlers');
                            await handleLogout();
                            router.push('/login');
                          }
                        });
                      } catch (error) {
                        console.error('Logout error:', error);
                      }
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16,17 21,12 16,7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    로그아웃
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="security-section">
                <h3>비밀번호 변경</h3>
                <form onSubmit={handlePasswordChange} className="password-form">
                  <div className="form-group">
                    <label htmlFor="currentPassword">현재 비밀번호</label>
                    <input
                      type="password"
                      id="currentPassword"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="newPassword">새 비밀번호</label>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordInputChange}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="confirmPassword">새 비밀번호 확인</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordInputChange}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="save-button">
                      비밀번호 변경
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>

      <style jsx>{`
        .my-page-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 50%, #e8f5e8 100%);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
        }

        .logout-section {
          margin-top: 30px;
          padding: 20px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
          display: flex;
          justify-content: center;
        }

        .logout-button-main {
          background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 25px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(211, 47, 47, 0.3);
        }

        .logout-button-main:hover {
          background: linear-gradient(135deg, #b71c1c 0%, #8d1a1a 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(211, 47, 47, 0.4);
        }

        .logout-button-main:active {
          transform: translateY(0);
        }

        .my-page-header {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(15px);
          padding: 20px 0;
          border-bottom: 2px solid rgba(66, 165, 245, 0.3);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
        }

        .back-button {
          position: absolute;
          left: 20px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
          padding: 12px;
          border-radius: 50%;
          transition: all 0.3s ease;
          color: #333;
          backdrop-filter: blur(10px);
        }

        .back-button:hover {
          background-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .logo-container {
          cursor: pointer;
          transition: transform 0.3s ease;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        .logo-container:hover {
          transform: translateX(-50%) scale(1.05);
        }

        .logo {
          max-width: 120px;
          height: auto;
        }

        .page-title {
          font-size: 32px;
          font-weight: 700;
          color: #333;
          margin: 0;
        }

        .logout-section {
          margin-top: 30px;
          padding: 20px;
          background: rgba(139, 0, 0, 0.1);
          border: 1px solid rgba(220, 53, 69, 0.3);
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }

        .logout-button {
          display: flex;
          align-items: center;
          gap: 12px;
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
        }

        .logout-button:hover {
          background: linear-gradient(135deg, #c82333 0%, #a71e2a 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(220, 53, 69, 0.4);
        }

        .logout-button:active {
          transform: translateY(0);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .user-avatar img,
        .user-avatar .avatar-placeholder {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          object-fit: cover;
        }

        .avatar-placeholder {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 20px;
        }

        .user-details h2 {
          margin: 0;
          font-size: 18px;
          color: #333;
        }

        .user-details p {
          margin: 2px 0;
          color: #666;
          font-size: 14px;
        }

        .user-role {
          background: #e3f2fd;
          color: #1976d2;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .my-page-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 20px;
          margin-top: 20px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(66, 165, 245, 0.2);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .tab-navigation {
          display: flex;
          gap: 10px;
          margin-bottom: 30px;
          border-bottom: 1px solid #e0e0e0;
        }

        .tab-button {
          background: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(66, 165, 245, 0.2);
          padding: 12px 24px;
          font-size: 16px;
          cursor: pointer;
          color: #333;
          border-radius: 8px 8px 0 0;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .tab-button.active {
          color: #1976d2;
          background: rgba(66, 165, 245, 0.1);
          border-color: rgba(66, 165, 245, 0.4);
          font-weight: 600;
        }

        .tab-button:hover:not(.active) {
          color: #1976d2;
          background-color: rgba(66, 165, 245, 0.05);
        }

        .tab-content {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(15px);
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(66, 165, 245, 0.2);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .section-header h3 {
          margin: 0;
          font-size: 24px;
          color: #333;
        }

        .edit-button {
          background: linear-gradient(135deg, #64b5f6 0%, #42a5f5 100%);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(100, 181, 246, 0.3);
        }

        .edit-button:hover {
          background: linear-gradient(135deg, #42a5f5 0%, #2196f3 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(100, 181, 246, 0.4);
        }

        .profile-image-section {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
          padding-bottom: 30px;
          border-bottom: 1px solid #e0e0e0;
        }

        .profile-image img,
        .profile-image .image-placeholder {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
        }

        .image-placeholder {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 32px;
        }

        .image-actions {
          display: flex;
          gap: 10px;
        }

        .upload-button,
        .delete-button {
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .upload-button {
          background: #4caf50;
          color: white;
          border: none;
        }

        .upload-button:hover {
          background: #45a049;
        }

        .delete-button {
          background: #f44336;
          color: white;
          border: none;
        }

        .delete-button:hover {
          background: #da190b;
        }

        .profile-form,
        .password-form,
        .preferences-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .form-group input,
        .form-group select {
          padding: 12px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
          background: #ffffff;
          color: #333;
          transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #42a5f5;
          box-shadow: 0 0 0 2px rgba(66, 165, 245, 0.2);
        }

        .form-group input:disabled {
          background-color: #f5f5f5;
          color: #999;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .save-button {
          background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        }

        .save-button:hover {
          background: linear-gradient(135deg, #45a049 0%, #388e3c 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
        }

        .loading,
        .error {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
          font-size: 18px;
          color: #333;
        }

        .error {
          color: #ff6b6b;
        }

        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .header-content {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }
          
          .profile-image-section {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </>
  );
};

export default MyPage;
