import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { handleLogout } from '../lib/simple-auth-handlers';

interface ProfileDropdownProps {
  user: {
    _id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
    systemRole: string;
  };
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogoutClick = async () => {
    try {
      await handleLogout();
      router.push('/');
    } catch (error) {
    }
  };

  const handleMyPageClick = () => {
    setIsOpen(false);
    router.push('/my-page');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <button
        className="profile-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Profile menu"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="profile-avatar"
          />
        ) : (
          <div className="profile-avatar-placeholder">
            {getInitials(user.displayName)}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="profile-dropdown-menu">
          <div className="profile-dropdown-item" onClick={handleMyPageClick}>
            <div className="profile-dropdown-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <span>내 프로필</span>
          </div>
          
          <div className="profile-dropdown-item logout-item" onClick={handleLogoutClick}>
            <div className="profile-dropdown-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16,17 21,12 16,7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            <span>로그아웃</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .profile-dropdown {
          position: relative;
          display: inline-block;
        }

        .profile-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          border-radius: 50%;
          transition: transform 0.2s ease;
        }

        .profile-button:hover {
          transform: scale(1.05);
        }

        .profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .profile-avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .profile-dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          border: 1px solid #e0e0e0;
          min-width: 160px;
          z-index: 1000;
          overflow: hidden;
        }

        .profile-dropdown-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          cursor: pointer;
          transition: background-color 0.2s ease;
          border-bottom: 1px solid #f0f0f0;
        }

        .profile-dropdown-item:last-child {
          border-bottom: none;
        }

        .profile-dropdown-item:hover {
          background-color: #f8f9fa;
        }

        .logout-item:hover {
          background-color: #ffebee;
        }

        .logout-item:hover span {
          color: #d32f2f;
        }

        .profile-dropdown-icon {
          margin-right: 12px;
          color: #666;
          display: flex;
          align-items: center;
        }

        .profile-dropdown-item span {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default ProfileDropdown;
