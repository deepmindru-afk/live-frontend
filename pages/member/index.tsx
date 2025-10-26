import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser, handleLogout, showErrorAlert } from '../../lib/simple-auth-handlers';
import { makeGraphQLRequest } from '../../lib/simple-auth-handlers';
import { GET_MY_MEETINGS, GET_MEETING_BY_ID, GET_MEETING_STATS } from '../../apollo/meeting/queries';
import { JOIN_MEETING_BY_CODE } from '../../apollo/meeting/mutations';
import { GET_PARTICIPANTS_BY_MEETING, GET_PARTICIPANT_BY_USER_MEETING } from '../../apollo/livestream/queries';

import { UPDATE_PROFILE, UPLOAD_PROFILE_IMAGE, DELETE_PROFILE_IMAGE } from '../../apollo/member/mutations';
import Swal from 'sweetalert2';

interface Meeting {
  _id: string;
  title: string;
  status: 'STARTED' | 'SCHEDULED' | 'ENDED';
  schedule?: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  duration?: number;
}

interface User {
  _id: string;
  displayName: string;
  email: string;
  systemRole: string;
  avatarUrl?: string;
  department?: string;
  phone?: string;
}

const MemberDashboard: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'meetings' | 'join' | 'menu'>('meetings');
  const [showMeetingsDropdown, setShowMeetingsDropdown] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [profileData, setProfileData] = useState({
    displayName: '',
    department: '',
    phone: ''
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showAttendancePopup, setShowAttendancePopup] = useState(false);
  const [participantData, setParticipantData] = useState<any>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔍 Checking authentication...');
        console.log('🔍 isAuthenticated():', isAuthenticated());
        
        if (isAuthenticated()) {
          console.log('🔍 User is authenticated, getting user data...');
          const userData = await getCurrentUser();
          console.log('🔍 User data:', userData);
          
          if (userData && userData.systemRole === 'MEMBER') {
            console.log('🔍 User is a MEMBER, proceeding...');
            setUser(userData);
            setProfileData({
              displayName: userData.displayName || '',
              department: userData.department || '',
              phone: userData.phone || ''
            });
            await fetchMeetings();
          } else {
            // Redirect non-members to appropriate dashboard
            if (userData?.systemRole === 'TUTOR') {
              router.push('/instructor');
            } else if (userData?.systemRole === 'ADMIN') {
              router.push('/admin');
            } else {
              // User not found or invalid role
              await showErrorAlert('Authentication Error', 'User not found or invalid role. Please log in again.');
              router.push('/login');
            }
          }
        } else {
          router.push('/login');
        }
      } catch (error: any) {
        await showErrorAlert('Authentication Error', 'Failed to verify user. Please log in again.');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const fetchMeetings = async () => {
    try {
      // Check if user is authenticated before making the request
      if (!isAuthenticated()) {
        console.log('User not authenticated, redirecting to login');
        router.push('/login');
        return;
      }
      
      if (!GET_MY_MEETINGS) {
        console.log('GET_MY_MEETINGS query not found');
        setMeetings([]);
        return;
      }
      
      console.log('Making GraphQL request for meetings...');
      console.log('Using query:', GET_MY_MEETINGS);
      console.log('Query type:', typeof GET_MY_MEETINGS);
      
      // Wrap the GraphQL request in a try-catch to handle auth errors gracefully
      let result;
      try {
        result = await makeGraphQLRequest(GET_MY_MEETINGS, {
          input: {
            limit: 50,
            page: 1
          }
        });
        console.log('GraphQL request successful:', result);
      } catch (authError: any) {
        console.error('GraphQL request failed:', authError);
        // Handle authentication errors immediately
        if (authError.message === 'JWT_EXPIRED' || authError.message === 'TOKEN_NOT_EXIST' || authError.message === 'Invalid credentials') {
          console.log('Authentication error detected, showing login prompt');
          await Swal.fire({
            icon: 'warning',
            title: '세션이 만료되었습니다',
            text: '다시 로그인해 주세요.',
            confirmButtonText: '로그인',
            showCancelButton: true,
            cancelButtonText: '취소'
          }).then((result) => {
            if (result.isConfirmed) {
              // Clear any stored tokens
              localStorage.removeItem('jwt');
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              // Redirect to login
              window.location.href = '/login';
            } else {
              // Redirect to dashboard
              window.location.href = '/dashboard';
            }
          });
          return;
        }
        // Re-throw other errors
        throw authError;
      }
      
      
      if (result.getMeetings && result.getMeetings.meetings && Array.isArray(result.getMeetings.meetings)) {
        // For ENDED meetings, we need to check if the user actually participated
        const meetingsWithParticipation = await Promise.all(
          result.getMeetings.meetings.map(async (meeting: any) => {
            const meetingStatus = meeting.status === 'CREATED' ? 'STARTED' : 
                                  meeting.status === 'SCHEDULED' ? 'SCHEDULED' : 
                                  meeting.status === 'ENDED' ? 'ENDED' : 'STARTED';
            
            // For ENDED meetings, check if user participated
            if (meetingStatus === 'ENDED') {
              try {
                const participantResult = await makeGraphQLRequest(GET_PARTICIPANT_BY_USER_MEETING, {
                  meetingId: meeting._id
                });
                
                // Only include if user participated
                if (!participantResult?.getParticipantByUserAndMeeting) {
                  return null;
                }
              } catch (error) {
                console.log(`No participation found for meeting ${meeting._id}`);
                return null;
              }
            }
            
            return {
              _id: meeting._id,
              title: meeting.title,
              status: meetingStatus,
              schedule: meeting.scheduledFor,
              inviteCode: meeting.inviteCode,
              createdAt: meeting.createdAt,
              updatedAt: meeting.updatedAt || meeting.createdAt,
              participantCount: meeting.participantCount || 0,
              duration: meeting.duration
            };
          })
        );
        
        // Filter out null entries (meetings where user didn't participate)
        const validMeetings = meetingsWithParticipation.filter(m => m !== null);
        
        setMeetings(validMeetings);
        setFilteredMeetings(validMeetings);
      } else {
        setMeetings([]);
        setFilteredMeetings([]);
      }
    } catch (error: any) {
      
      // Handle authentication errors specifically
      if (error.message === 'JWT_EXPIRED' || error.message === 'TOKEN_NOT_EXIST' || error.message === 'Invalid credentials') {
        await Swal.fire({
          icon: 'warning',
          title: '세션이 만료되었습니다',
          text: '다시 로그인해 주세요.',
          confirmButtonText: '로그인',
          showCancelButton: true,
          cancelButtonText: '취소'
        }).then((result) => {
          if (result.isConfirmed) {
            // Clear any stored tokens
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Redirect to login
            window.location.href = '/login';
          } else {
            // Redirect to dashboard
            window.location.href = '/dashboard';
          }
        });
      }
      
      setMeetings([]);
      setFilteredMeetings([]);
    }
  };

  // Filter meetings based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMeetings(meetings);
    } else {
      const filtered = meetings.filter(meeting =>
        meeting.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMeetings(filtered);
    }
  }, [searchQuery, meetings]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMeetingsDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.meetings-dropdown')) {
          setShowMeetingsDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMeetingsDropdown]);

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: '입력 오류',
        text: '초대코드를 입력해주세요.',
        confirmButtonText: '확인'
      });
      return;
    }

    try {
      // First, try to get the meeting by invite code to check if user is already a participant
      let meetingResult;
      try {
        meetingResult = await makeGraphQLRequest(JOIN_MEETING_BY_CODE, { 
          input: { inviteCode } 
        });
      } catch (authError: any) {
        // Handle authentication errors immediately
        if (authError.message === 'JWT_EXPIRED' || authError.message === 'TOKEN_NOT_EXIST' || authError.message === 'Invalid credentials') {
          await Swal.fire({
            icon: 'warning',
            title: '세션이 만료되었습니다',
            text: '다시 로그인해 주세요.',
            confirmButtonText: '로그인',
            showCancelButton: true,
            cancelButtonText: '취소'
          }).then((result) => {
            if (result.isConfirmed) {
              // Clear any stored tokens
              localStorage.removeItem('jwt');
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              // Redirect to login
              window.location.href = '/login';
            }
          });
          return;
        }
        // Re-throw other errors
        throw authError;
      }
      
      if (meetingResult.joinMeetingByCode && meetingResult.joinMeetingByCode.success) {
        const meetingId = meetingResult.joinMeetingByCode.meeting._id;
        
        // Check if user is already a participant in this meeting
        try {
          const participantResult = await makeGraphQLRequest(GET_PARTICIPANT_BY_USER_MEETING, {
            meetingId: meetingId
          });
          
          if (participantResult.getParticipantByUserAndMeeting) {
            const participantStatus = participantResult.getParticipantByUserAndMeeting.status;
            
            if (participantStatus === 'WAITING') {
              // User is in waiting room, redirect to waiting page
              router.push(`/waiting?meetingId=${meetingId}&code=${inviteCode}`);
              return;
            } else if (participantStatus === 'ADMITTED') {
              // User is already admitted, go to prejoin
              router.push(`/prejoin/${meetingId}`);
              return;
            } else if (participantStatus === 'LEFT') {
              // User was previously in meeting but left, allow rejoin
              // Continue with normal join process below
            }
          }
        } catch (participantError) {
        }
        
        // User is new or not found, go to prejoin
        router.push(`/prejoin/${meetingId}`);
      } else {
        throw new Error(meetingResult.joinMeetingByCode?.message || '미팅 참여에 실패했습니다.');
      }
    } catch (error: any) {
      
      // Handle authentication errors specifically
      if (error.message === 'JWT_EXPIRED' || error.message === 'TOKEN_NOT_EXIST' || error.message === 'Invalid credentials') {
        await Swal.fire({
          icon: 'warning',
          title: '세션이 만료되었습니다',
          text: '다시 로그인해 주세요.',
          confirmButtonText: '로그인',
          showCancelButton: true,
          cancelButtonText: '취소'
        }).then((result) => {
          if (result.isConfirmed) {
            // Clear any stored tokens
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Redirect to login
            window.location.href = '/login';
          }
        });
      } else {
        await Swal.fire({
          icon: 'error',
          title: '미팅 참여 실패',
          text: error instanceof Error ? error.message : '미팅 참여 중 오류가 발생했습니다.',
          confirmButtonText: '확인'
        });
      }
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const result = await makeGraphQLRequest(UPDATE_PROFILE, {
        input: profileData
      });

      if (result.updateProfile && result.updateProfile.success) {
        await Swal.fire({
          icon: 'success',
          title: '프로필 업데이트',
          text: '프로필이 성공적으로 업데이트되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        setIsEditingProfile(false);
        // Refresh user data
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
        }
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: '업데이트 실패',
        text: '프로필 업데이트 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await makeGraphQLRequest(UPLOAD_PROFILE_IMAGE, {
        file: file
      });

      if (result.uploadProfileImage && result.uploadProfileImage.success) {
        await Swal.fire({
          icon: 'success',
          title: '이미지 업로드',
          text: '프로필 이미지가 성공적으로 업로드되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        // Refresh user data
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
        }
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: '업로드 실패',
        text: '이미지 업로드 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const handleDeleteImage = async () => {
    const result = await Swal.fire({
      title: '이미지 삭제',
      text: '프로필 이미지를 삭제하시겠습니까?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '삭제',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc3545'
    });

    if (result.isConfirmed) {
      try {
        await makeGraphQLRequest(DELETE_PROFILE_IMAGE);
        
        await Swal.fire({
          icon: 'success',
          title: '이미지 삭제',
          text: '프로필 이미지가 성공적으로 삭제되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        // Refresh user data
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
        }
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: '삭제 실패',
          text: '이미지 삭제 중 오류가 발생했습니다.',
          confirmButtonText: '확인'
        });
      }
    }
  };

  const handleLogoutClick = async () => {
    const result = await Swal.fire({
      title: '로그아웃',
      text: '정말 로그아웃하시겠습니까?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '로그아웃',
      cancelButtonText: '취소'
    });

    if (result.isConfirmed) {
      await handleLogout();
      router.push('/login');
    }
  };

  const fetchParticipantAttendance = async (meetingId: string) => {
    try {
      setLoadingAttendance(true);
      const result = await makeGraphQLRequest(GET_PARTICIPANT_BY_USER_MEETING, {
        meetingId: meetingId
      });
      console.log('Participant attendance data:', result);
      setParticipantData(result);
    } catch (error: any) {
      console.error('Error fetching participant attendance:', error);
      await showErrorAlert('Error', 'Failed to load attendance data');
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleAttendanceClick = async (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setShowAttendancePopup(true);
    await fetchParticipantAttendance(meeting._id);
  };

  const closeAttendancePopup = () => {
    setShowAttendancePopup(false);
    setSelectedMeeting(null);
    setParticipantData(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const formatTime = (timeString: string | Date | null | undefined) => {
    if (!timeString) return 'N/A';
    
    let date: Date;
    
    if (timeString instanceof Date) {
      date = timeString;
    } else if (typeof timeString === 'string') {
      // Handle Unix timestamp strings (milliseconds)
      if (/^\d+$/.test(timeString) && timeString.length > 10) {
        date = new Date(parseInt(timeString, 10));
      } else {
        date = new Date(timeString);
      }
    } else {
      return 'Invalid format';
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0분';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
    } else if (minutes > 0) {
      return secs > 0 ? `${minutes}분 ${secs}초` : `${minutes}분`;
    } else {
      return `${secs}초`;
    }
  };

  const calculateMeetingDuration = (meeting: Meeting) => {
    if (meeting.duration) {
      const hours = Math.floor(meeting.duration / 60);
      const minutes = meeting.duration % 60;
      return `${hours}시간 ${minutes}분`;
    }
    return 'N/A';
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        로딩 중...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>HRDe Live - Member Dashboard</title>
        <meta name="description" content="Member dashboard for HRDe Live" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="member-dashboard">
        {/* Mobile Header */}
        <div className="mobile-header">
          <div className="mobile-logo">
            <Image
              src="/logoHRDe.png"
              alt="HRDE"
              width={100}
              height={45}
              style={{
                objectFit: 'contain'
              }}
            />
          </div>
          <div className="mobile-profile">
            {user?.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt="Profile"
                className="mobile-avatar"
              />
            )}
            <button 
              className="mobile-logout-btn"
              onClick={handleLogoutClick}
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Mobile Welcome Section */}
        <div className="mobile-welcome">
          <div className="welcome-content">
            {user?.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt="Profile"
                className="welcome-avatar"
              />
            )}
            <div className="welcome-text">
              <h1 className="welcome-greeting">
                {user?.displayName}님, 안녕하세요 👋
              </h1>
              <p className="welcome-subtitle">Member Dashboard</p>
            </div>
          </div>
        </div>

        {/* Meetings Dropdown */}
        <div className="meetings-dropdown">
          <button
            onClick={() => setShowMeetingsDropdown(!showMeetingsDropdown)}
            className={`meetings-dropdown-toggle ${activeTab === 'meetings' || activeTab === 'join' ? 'active' : ''}`}
          >
            📅 내 미팅
            <span className={`dropdown-arrow ${showMeetingsDropdown ? 'open' : ''}`}>
              ▼
            </span>
          </button>
          {showMeetingsDropdown && (
            <div className="meetings-dropdown-menu">
              <button
                onClick={() => {
                  setActiveTab('meetings');
                  setShowMeetingsDropdown(false);
                }}
                className={`dropdown-item ${activeTab === 'meetings' ? 'active' : ''}`}
              >
                내 미팅
              </button>
              <button
                onClick={() => {
                  setActiveTab('join');
                  setShowMeetingsDropdown(false);
                }}
                className={`dropdown-item ${activeTab === 'join' ? 'active' : ''}`}
              >
                미팅 참여
              </button>
            </div>
          )}
        </div>


        {/* Main Content */}
        <div className="main-content" style={{ marginLeft: 0, width: '100%' }}>

          {/* Content based on active tab */}
          {activeTab === 'meetings' && (
            <div className="meetings-section">
              <div className="section-header">
                <button
                  onClick={fetchMeetings}
                  className="refresh-btn"
                >
                  새로고침
                </button>
              </div>

              {/* Search and Filters Container */}
              <div className="search-filters-container">
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="미팅 제목으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>

                {/* Filters */}
                <div className="filters-container">
                  <button 
                    className={`filter-btn ${searchQuery === '' ? 'active' : ''}`}
                    onClick={() => setSearchQuery('')}
                  >
                    전체
                  </button>
                  <button 
                    className={`filter-btn ${searchQuery === 'STARTED' ? 'active' : ''}`}
                    onClick={() => setSearchQuery('STARTED')}
                  >
                    진행 중
                  </button>
                  <button 
                    className={`filter-btn ${searchQuery === 'ENDED' ? 'active' : ''}`}
                    onClick={() => setSearchQuery('ENDED')}
                  >
                    종료됨
                  </button>
                </div>
              </div>

              {filteredMeetings.length > 0 ? (
                <div className="meetings-grid">
                  {filteredMeetings.map((meeting) => (
                    <div
                      key={meeting._id}
                      className="meeting-card"
                    >
                      <div className="meeting-card-header">
                        <h3 className="meeting-title">
                          {meeting.title}
                        </h3>
                        <span className={`status-badge ${meeting.status.toLowerCase()}`}>
                          {meeting.status === 'STARTED' ? '진행중' : 
                           meeting.status === 'SCHEDULED' ? '예약됨' : '종료됨'}
                        </span>
                      </div>
                      <div className="meeting-card-body">
                        <div className="meeting-info">
                          <div className="info-item">
                            <span className="info-label">초대코드:</span>
                            <span className="info-value">{meeting.inviteCode}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">참가자:</span>
                            <span className="info-value">{meeting.participantCount}명</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">생성일:</span>
                            <span className="info-value">{formatDate(meeting.createdAt)}</span>
                          </div>
                          {meeting.schedule && (
                            <div className="info-item">
                              <span className="info-label">예약일:</span>
                              <span className="info-value">{formatDate(meeting.schedule)}</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            if (meeting.status === 'ENDED') {
                              await handleAttendanceClick(meeting);
                            } else {
                              router.push(`/prejoin/${meeting._id}`);
                            }
                          }}
                          className={`join-btn ${meeting.status.toLowerCase()}`}
                        >
                          {meeting.status === 'STARTED' ? '참여하기' : 
                           meeting.status === 'SCHEDULED' ? '대기중' : '출석확인'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    {searchQuery.trim() ? '🔍' : '📅'}
                  </div>
                  <h3 className="empty-title">
                    {searchQuery.trim() 
                      ? `"${searchQuery}"에 대한 검색 결과가 없습니다.`
                      : '참여한 미팅이 없습니다.'
                    }
                  </h3>
                  {searchQuery.trim() && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="reset-search-btn"
                    >
                      검색 초기화
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'join' && (
            <div className="join-section">
              <div className="join-container">
                <div className="join-icon">
                  🔗
                </div>
                <h2 className="join-title">
                  초대코드로 미팅 참여
                </h2>
                <p className="join-description">
                  미팅 호스트로부터 받은 초대코드를 입력하세요.
                </p>
                <div className="join-form">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="초대코드 입력"
                    className="join-input"
                  />
                  <button
                    onClick={handleJoinByCode}
                    className="join-submit-btn"
                  >
                    참여하기
                  </button>
                </div>
                <div className="join-help">
                  <p className="help-text">
                    💡 초대코드는 미팅 호스트가 제공하는 고유한 코드입니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {false && activeTab === 'profile' && (
            <div className="profile-section">
              <div className="profile-container">
                <div className="profile-header">
                  <div className="avatar-section">
                    <div className="avatar-container">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt="Profile"
                          className="profile-avatar"
                        />
                      ) : (
                        <div className="default-avatar">
                          👤
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="avatar-upload"
                      />
                    </div>
                    <div className="avatar-info">
                      <h3 className="avatar-title">프로필 이미지</h3>
                      <p className="avatar-description">클릭하여 이미지 업로드</p>
                      {user?.avatarUrl && (
                        <button
                          onClick={handleDeleteImage}
                          className="avatar-delete-btn"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="profile-form">
                  <div className="form-group">
                    <label className="form-label">이름</label>
                    <input
                      type="text"
                      value={profileData.displayName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                      disabled={!isEditingProfile}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">이메일</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="form-input disabled"
                    />
                    <p className="form-help">
                      이메일은 변경할 수 없습니다.
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">부서</label>
                    <input
                      type="text"
                      value={profileData.department}
                      onChange={(e) => setProfileData(prev => ({ ...prev, department: e.target.value }))}
                      disabled={!isEditingProfile}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">전화번호</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditingProfile}
                      className="form-input"
                    />
                  </div>

                  <div className="form-actions">
                    {!isEditingProfile ? (
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="btn btn-primary"
                      >
                        편집하기
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleUpdateProfile}
                          className="btn btn-success"
                        >
                          저장하기
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingProfile(false);
                            setProfileData({
                              displayName: user?.displayName || '',
                              department: user?.department || '',
                              phone: user?.phone || ''
                            });
                          }}
                          className="btn btn-secondary"
                        >
                          취소
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {false && activeTab === 'attendance' && (
            <div className="attendance-section">
              <div className="attendance-container">
                <h2 className="attendance-title">
                  📋 출석 현황
                </h2>

                {/* Attendance Overview Cards - Single Row */}
                <div className="attendance-cards-row">
                  <div className="attendance-card">
                    <div className="card-icon">📅</div>
                    <div className="card-content">
                      <h3 className="card-title">참여한 미팅</h3>
                      <div className="card-value participated">
                        {meetings.filter(m => m.status === 'ENDED').length}개
                      </div>
                    </div>
                  </div>
                  
                  <div className="attendance-card">
                    <div className="card-icon">⏰</div>
                    <div className="card-content">
                      <h3 className="card-title">예정된 미팅</h3>
                      <div className="card-value scheduled">
                        {meetings.filter(m => m.status === 'SCHEDULED').length}개
                      </div>
                    </div>
                  </div>
                  
                  <div className="attendance-card">
                    <div className="card-icon">⏱️</div>
                    <div className="card-content">
                      <h3 className="card-title">총 참여 시간</h3>
                      <div className="card-value duration">
                        {meetings.reduce((sum, m) => sum + (m.duration || 0), 0) > 0 
                          ? `${Math.round(meetings.reduce((sum, m) => sum + (m.duration || 0), 0) / 60)}분`
                          : '0분'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="attendance-card">
                    <div className="card-icon">📊</div>
                    <div className="card-content">
                      <h3 className="card-title">참석률</h3>
                      <div className="card-value rate">
                        {meetings.length > 0 ? Math.round((meetings.filter(m => m.status === 'ENDED').length / meetings.length) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* My Meeting Attendance */}
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #dee2e6',
                    backgroundColor: '#f8f9fa'
                  }}>
                    <h3 style={{ margin: 0, color: '#333' }}>내 미팅 출석 기록</h3>
                    <p style={{ margin: '5px 0 0 0', color: '#666' }}>
                      참여한 미팅의 출석 현황을 확인하세요
                    </p>
                  </div>

                  {meetings.length > 0 ? (
                    <div style={{ padding: '20px' }}>
                      <div style={{
                        display: 'grid',
                        gap: '15px'
                      }}>
                        {meetings.map((meeting) => (
                          <div
                            key={meeting._id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '15px',
                              border: '1px solid #dee2e6',
                              borderRadius: '8px',
                              backgroundColor: '#f8f9fa'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>
                                {meeting.title}
                              </h4>
                              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                                ID: {meeting._id.slice(-8)} | 코드: {meeting.inviteCode}
                              </div>
                              <div style={{ fontSize: '12px', color: '#888' }}>
                                생성일: {new Date(meeting.createdAt).toLocaleDateString('ko-KR')}
                                {meeting.duration && ` | 소요시간: ${Math.round(meeting.duration / 60)}분`}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: meeting.status === 'ENDED' ? '#d4edda' : 
                                               meeting.status === 'SCHEDULED' ? '#fff3cd' : '#d1ecf1',
                                color: meeting.status === 'ENDED' ? '#155724' : 
                                       meeting.status === 'SCHEDULED' ? '#856404' : '#0c5460'
                              }}>
                                {meeting.status === 'ENDED' ? '완료' : 
                                 meeting.status === 'SCHEDULED' ? '예정' : '진행중'}
                              </span>
                                {meeting.status === 'ENDED' && (
                                  <button
                                    onClick={() => handleAttendanceClick(meeting)}
                                    style={{
                                      padding: '8px 16px',
                                      backgroundColor: '#dc3545',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    📊 출석상세
                                  </button>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '40px',
                      textAlign: 'center',
                      color: '#666'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
                      <h3 style={{ margin: '0 0 10px 0' }}>출석 기록이 없습니다</h3>
                      <p style={{ margin: 0 }}>아직 참여한 미팅이 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Attendance Popup */}
        {showAttendancePopup && selectedMeeting && (
          <div className="attendance-popup-overlay" onClick={closeAttendancePopup}>
            <div className="attendance-popup" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header">
                <h3 className="popup-title">📊 출석 상세 정보</h3>
                <button className="popup-close" onClick={closeAttendancePopup}>×</button>
              </div>
              
              <div className="popup-content">
                {loadingAttendance ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
                    <p>출석 정보를 불러오는 중...</p>
                  </div>
                ) : participantData?.getParticipantByUserAndMeeting ? (
                  <>
                    <div className="meeting-info">
                      <h4 className="meeting-title">{selectedMeeting.title}</h4>
                      <div className="meeting-meta">
                        <span className="meeting-date">
                          📅 {formatDate(selectedMeeting.createdAt)}
                        </span>
                        <span className="meeting-duration">
                          ⏱️ {calculateMeetingDuration(selectedMeeting)}
                        </span>
                      </div>
                    </div>

                    <div className="attendance-stats">
                      <div className="stat-card">
                        <div className="stat-icon">⏰</div>
                        <div className="stat-content">
                          <div className="stat-label">참여 시간</div>
                          <div className="stat-value">{participantData.getParticipantByUserAndMeeting.loginInfo?.totalDurationMinutes ? `${participantData.getParticipantByUserAndMeeting.loginInfo.totalDurationMinutes}분` : '0분'}</div>
                        </div>
                      </div>
                      
                      <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div className="stat-content">
                          <div className="stat-label">세션 수</div>
                          <div className="stat-value">{participantData.getParticipantByUserAndMeeting.loginInfo?.totalSessions || 0}회</div>
                        </div>
                      </div>
                    </div>

                    <div className="attendance-timeline">
                      <h5 className="timeline-title">참석 타임라인</h5>
                      <div className="timeline">
                        {participantData.getParticipantByUserAndMeeting.loginInfo?.sessions?.map((session: any, index: number) => (
                          <div key={index} className="timeline-item">
                            <div className="timeline-time">{formatTime(session.joinedAt)}</div>
                            <div className="timeline-content">
                              <div className="timeline-title">{index === 0 ? '미팅 참여' : `재입장 ${index}`}</div>
                              <div className="timeline-desc">
                                {session.leftAt ? `퇴장: ${formatTime(session.leftAt)} (${session.durationMinutes}분)` : '진행 중'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="attendance-summary">
                      <h5 className="summary-title">참석 요약</h5>
                      <div className="summary-content">
                        <div className="summary-item">
                          <span className="summary-label">참여 시간:</span>
                          <span className="summary-value">{participantData.getParticipantByUserAndMeeting.loginInfo?.totalDurationMinutes ? `${participantData.getParticipantByUserAndMeeting.loginInfo.totalDurationMinutes}분` : '0분'}</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">참여 시작:</span>
                          <span className="summary-value">{formatTime(participantData.getParticipantByUserAndMeeting.loginInfo?.firstLogin)}</span>
                        </div>
                        {participantData.getParticipantByUserAndMeeting.loginInfo?.lastLogin && (
                          <div className="summary-item">
                            <span className="summary-label">마지막 활동:</span>
                            <span className="summary-value">{formatTime(participantData.getParticipantByUserAndMeeting.loginInfo.lastLogin)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
                    <h3>출석 정보가 없습니다</h3>
                    <p>이 회의에 대한 참석 기록이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS Styles */}
      <style jsx>{`
        .member-dashboard {
          min-height: 100vh;
          background-color: #f8f9fa;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* Mobile Header - Show on all screen sizes */
        .mobile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 1rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .mobile-logo {
          display: flex;
          align-items: center;
        }

        .mobile-profile {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mobile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }

        .mobile-menu-toggle {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          color: #333;
        }

        /* Mobile Welcome Section - Show on all screen sizes */
        .mobile-welcome {
          display: block;
          background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
          color: white;
          padding: 2rem 1rem;
          text-align: center;
        }

        .welcome-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .welcome-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid rgba(255,255,255,0.3);
        }

        .welcome-greeting {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .welcome-subtitle {
          font-size: 1rem;
          margin: 0;
          opacity: 0.9;
        }

        /* Mobile Navigation - Show on all screen sizes */
        .mobile-nav {
          display: block;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 2000;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
        }

        .mobile-nav-open {
          opacity: 1;
          visibility: visible;
        }

        .mobile-nav-content {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 280px;
          background: white;
          padding: 0;
          transform: translateX(100%);
          transition: transform 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .mobile-nav-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 1rem;
          border-bottom: 1px solid #e1e5e9;
          background: #f8f9fa;
        }

        .mobile-nav-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #333;
        }

        .mobile-nav-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: #666;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .mobile-nav-close:hover {
          background: #e1e5e9;
          color: #333;
        }

        .mobile-nav-open .mobile-nav-content {
          transform: translateX(0);
        }

        .mobile-nav-item {
          display: block;
          width: 100%;
          padding: 1rem;
          background: none;
          border: none;
          text-align: left;
          font-size: 1.1rem;
          color: #333;
          cursor: pointer;
          border-radius: 8px;
          margin: 0.25rem 1rem;
          transition: all 0.2s ease;
        }

        .mobile-nav-item.active {
          background: #e3f2fd;
          color: #1976d2;
        }

        .mobile-nav-item:hover {
          background: #f5f5f5;
        }

        .mobile-logout-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: auto;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mobile-logout-btn:hover {
          background: #c82333;
          transform: translateY(-1px);
        }

        /* Desktop Logout Button */
        .desktop-logout-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .desktop-logout-btn:hover {
          background: #c82333;
          transform: translateY(-1px);
        }

        /* Responsive logout button */
        @media (max-width: 768px) {
          .mobile-logout-btn {
            padding: 6px 12px;
            font-size: 13px;
            height: 32px;
          }
        }

        @media (min-width: 769px) {
          .mobile-logout-btn {
            padding: 10px 20px;
            font-size: 15px;
            height: 40px;
          }
        }

        /* Desktop Sidebar - Hide on all screen sizes */
        .desktop-sidebar {
          display: none;
        }

        /* Meetings Dropdown */
        .meetings-dropdown {
          position: relative;
          margin: 20px;
        }

        .meetings-dropdown-toggle {
          width: 100%;
          padding: 15px 20px;
          background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 15px rgba(25, 118, 210, 0.3);
          transition: all 0.3s ease;
        }

        .meetings-dropdown-toggle:hover {
          background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(25, 118, 210, 0.4);
        }

        .meetings-dropdown-toggle.active {
          background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%);
        }

        .dropdown-arrow {
          transition: transform 0.3s ease;
          font-size: 14px;
        }

        .dropdown-arrow.open {
          transform: rotate(180deg);
        }

        .meetings-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          overflow: hidden;
          margin-top: 8px;
          border: 1px solid #e0e0e0;
        }

        .dropdown-item {
          width: 100%;
          padding: 15px 20px;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          font-size: 15px;
          color: #333;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dropdown-item:hover {
          background-color: #f5f5f5;
          color: #1976d2;
        }

        .dropdown-item.active {
          background-color: #e3f2fd;
          color: #1976d2;
          font-weight: 600;
        }

        .dropdown-item:first-child {
          border-bottom: 1px solid #e0e0e0;
        }

        /* Attendance Popup Styles */
        .attendance-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease;
          backdrop-filter: blur(5px);
        }

        .attendance-popup {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
          border: 1px solid #e0e0e0;
        }

        .popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e9ecef;
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
          color: white;
          border-radius: 16px 16px 0 0;
        }

        .popup-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
        }

        .popup-close {
          background: none;
          border: none;
          font-size: 24px;
          color: white;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .popup-close:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: rotate(90deg);
        }

        .popup-content {
          padding: 24px;
        }

        .meeting-info {
          margin-bottom: 24px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 12px;
          border-left: 4px solid #dc3545;
          animation: slideInLeft 0.6s ease;
        }

        .meeting-title {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .meeting-meta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .meeting-date, .meeting-duration {
          font-size: 14px;
          color: #666;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .attendance-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
          color: white;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          animation: fadeInUp 0.6s ease;
          transition: all 0.3s ease;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s;
        }

        .stat-card:hover::before {
          left: 100%;
        }

        .stat-card:hover {
          transform: translateY(-5px) scale(1.02);
          box-shadow: 0 10px 25px rgba(220, 53, 69, 0.3);
        }

        .stat-icon {
          font-size: 24px;
          margin-bottom: 8px;
          animation: bounce 2s infinite;
        }

        .stat-label {
          font-size: 12px;
          opacity: 0.9;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          animation: countUp 1s ease-out;
        }

        .attendance-timeline {
          margin-bottom: 24px;
        }

        .timeline-title {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .timeline {
          position: relative;
          padding-left: 20px;
        }

        .timeline::before {
          content: '';
          position: absolute;
          left: 8px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: linear-gradient(to bottom, #dc3545, #c82333);
          animation: drawLine 1s ease-out;
        }

        .timeline-item {
          position: relative;
          margin-bottom: 20px;
          animation: slideInLeft 0.6s ease;
          opacity: 0;
          animation-fill-mode: forwards;
        }

        .timeline-item:nth-child(1) { animation-delay: 0.2s; }
        .timeline-item:nth-child(2) { animation-delay: 0.4s; }
        .timeline-item:nth-child(3) { animation-delay: 0.6s; }

        .timeline-item::before {
          content: '';
          position: absolute;
          left: -16px;
          top: 6px;
          width: 12px;
          height: 12px;
          background: #dc3545;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 0 3px #dc3545;
          animation: pulse 2s infinite;
        }

        .timeline-time {
          font-size: 12px;
          color: #666;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .timeline-content {
          background: #f8f9fa;
          padding: 12px 16px;
          border-radius: 8px;
          border-left: 3px solid #dc3545;
          transition: all 0.2s ease;
        }

        .timeline-content:hover {
          background: #e9ecef;
          transform: translateX(5px);
        }

        .timeline-title {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          margin: 0 0 4px 0;
        }

        .timeline-desc {
          font-size: 12px;
          color: #666;
          margin: 0;
        }

        .attendance-summary {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #e9ecef;
          animation: slideInUp 0.8s ease;
        }

        .summary-title {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .summary-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
          transition: all 0.2s ease;
        }

        .summary-item:hover {
          background: #e9ecef;
          padding-left: 8px;
          border-radius: 4px;
        }

        .summary-item:last-child {
          border-bottom: none;
        }

        .summary-label {
          font-size: 14px;
          color: #666;
        }

        .summary-value {
          font-size: 14px;
          font-weight: 600;
          color: #dc3545;
        }

        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }

        @keyframes countUp {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes drawLine {
          from {
            height: 0;
          }
          to {
            height: 100%;
          }
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
          }
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .attendance-popup {
            width: 95%;
            margin: 20px;
          }
          
          .popup-content {
            padding: 16px;
          }
          
          .attendance-stats {
            grid-template-columns: 1fr;
          }
          
          .meeting-meta {
            flex-direction: column;
            gap: 8px;
          }
        }

        /* Main Content - Full width without sidebar */
        .main-content {
          width: 100%;
          background-color: white;
          padding: 30px;
        }

        /* Meetings Section */
        .meetings-section {
          max-width: 1200px;
          margin: 0 auto;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #333;
          margin: 0;
        }

        .refresh-btn {
          padding: 0.75rem 1.5rem;
          background-color: #1976d2;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .refresh-btn:hover {
          background-color: #1565c0;
        }

        /* Search and Filters Container */
        .search-filters-container {
          background: white;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          margin-bottom: 2rem;
          border: 1px solid #e1e5e9;
        }

        /* Search Container */
        .search-container {
          margin-bottom: 1.5rem;
        }

        .search-input {
          width: 100%;
          padding: 1rem 1.5rem;
          border: 2px solid #e1e5e9;
          border-radius: 12px;
          font-size: 1.1rem;
          background-color: #f8f9fa;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .search-input:focus {
          outline: none;
          border-color: #1976d2;
          background-color: white;
          box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
        }

        /* Filters */
        .filters-container {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 0.75rem 1.5rem;
          background-color: #f8f9fa;
          border: 2px solid #e1e5e9;
          border-radius: 25px;
          cursor: pointer;
          font-size: 1rem;
          color: #666;
          transition: all 0.2s ease;
        }

        .filter-btn.active {
          background-color: #1976d2;
          border-color: #1976d2;
          color: white;
        }

        .filter-btn:hover {
          border-color: #1976d2;
          color: #1976d2;
        }

        /* Meetings Grid */
        .meetings-grid {
          display: grid;
          gap: 1.5rem;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        }

        /* Meeting Card */
        .meeting-card {
          background: white;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border: 1px solid #e1e5e9;
          transition: all 0.3s ease;
        }

        .meeting-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .meeting-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .meeting-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #333;
          margin: 0;
          flex: 1;
          margin-right: 1rem;
        }

        .status-badge {
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .status-badge.started {
          background-color: #e8f5e8;
          color: #2e7d32;
        }

        .status-badge.scheduled {
          background-color: #fff3e0;
          color: #f57c00;
        }

        .status-badge.ended {
          background-color: #ffebee;
          color: #c62828;
        }

        .meeting-card-body {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .meeting-info {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.95rem;
        }

        .info-label {
          color: #666;
          font-weight: 500;
        }

        .info-value {
          color: #333;
          font-weight: 600;
        }

        .join-btn {
          width: 100%;
          padding: 1rem;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .join-btn.started {
          background-color: #4caf50;
          color: white;
        }

        .join-btn.scheduled {
          background-color: #ff9800;
          color: white;
        }

        .join-btn.ended {
          background-color: #f44336;
          color: white;
        }

        .join-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #666;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
        }

        .empty-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
        }

        .reset-search-btn {
          padding: 0.75rem 1.5rem;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
        }

        /* Join Section */
        .join-section {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 60vh;
          padding: 2rem 1rem;
        }

        .join-container {
          max-width: 500px;
          width: 100%;
          text-align: center;
          background: white;
          padding: 3rem 2rem;
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }

        .join-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
        }

        .join-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #333;
          margin: 0 0 1rem 0;
        }

        .join-description {
          font-size: 1.1rem;
          color: #666;
          margin: 0 0 2rem 0;
          line-height: 1.6;
        }

        .join-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .join-input {
          width: 100%;
          padding: 1rem 1.5rem;
          border: 2px solid #e1e5e9;
          border-radius: 12px;
          font-size: 1.1rem;
          background-color: #f8f9fa;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .join-input:focus {
          outline: none;
          border-color: #1976d2;
          background-color: white;
          box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
        }

        .join-submit-btn {
          width: 100%;
          padding: 1rem 1.5rem;
          background-color: #1976d2;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .join-submit-btn:hover {
          background-color: #1565c0;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
        }

        .join-help {
          margin-top: 1rem;
        }

        .help-text {
          font-size: 0.95rem;
          color: #666;
          margin: 0;
          padding: 1rem;
          background-color: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #1976d2;
        }

        /* Profile Section */
        .profile-section {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        .profile-container {
          background: white;
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }

        .profile-header {
          margin-bottom: 2rem;
        }

        .avatar-section {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .avatar-container {
          position: relative;
        }

        .profile-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid #e1e5e9;
        }

        .default-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background-color: #e1e5e9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          color: #666;
          border: 4px solid #e1e5e9;
        }

        .avatar-upload {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
          border-radius: 50%;
        }

        .avatar-info h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          color: #333;
        }

        .avatar-description {
          margin: 0 0 0.5rem 0;
          color: #666;
          font-size: 0.95rem;
        }

        .avatar-delete-btn {
          padding: 0.5rem 1rem;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label {
          font-weight: 600;
          color: #333;
          font-size: 1rem;
        }

        .form-input {
          width: 100%;
          padding: 1rem 1.25rem;
          border: 2px solid #e1e5e9;
          border-radius: 12px;
          font-size: 1rem;
          background-color: #f8f9fa;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .form-input:focus {
          outline: none;
          border-color: #1976d2;
          background-color: white;
          box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
        }

        .form-input.disabled {
          background-color: #f8f9fa;
          color: #666;
          cursor: not-allowed;
        }

        .form-help {
          margin: 0;
          font-size: 0.875rem;
          color: #666;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }

        .btn {
          padding: 1rem 2rem;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .btn-primary {
          background-color: #1976d2;
          color: white;
        }

        .btn-primary:hover {
          background-color: #1565c0;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
        }

        .btn-success {
          background-color: #28a745;
          color: white;
        }

        .btn-success:hover {
          background-color: #218838;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        }

        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background-color: #5a6268;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);
        }

        /* Attendance Section */
        .attendance-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        .attendance-container {
          background: white;
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }

        .attendance-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #333;
          margin: 0 0 2rem 0;
          text-align: center;
        }

        .attendance-cards-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .attendance-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border-radius: 16px;
          padding: 1.5rem;
          text-align: center;
          border: 1px solid #e1e5e9;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .attendance-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #1976d2, #1565c0);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .attendance-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.15);
        }

        .attendance-card:hover::before {
          opacity: 1;
        }

        .card-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          opacity: 0.8;
        }

        .card-content {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .card-title {
          font-size: 1rem;
          font-weight: 600;
          color: #666;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .card-value {
          font-size: 2rem;
          font-weight: 700;
          margin: 0;
          line-height: 1;
        }

        .card-value.participated {
          color: #1976d2;
        }

        .card-value.scheduled {
          color: #28a745;
        }

        .card-value.duration {
          color: #ff9800;
        }

        .card-value.rate {
          color: #6c757d;
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .main-content {
            padding: 1.5rem;
          }

          .meetings-grid {
            grid-template-columns: 1fr;
          }

          .section-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }

          .filters-container {
            justify-content: center;
          }

          .attendance-cards-row {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }

          .attendance-card {
            padding: 1.25rem;
          }

          .card-value {
            font-size: 1.75rem;
          }

          .card-icon {
            font-size: 2rem;
          }
        }

        @media (max-width: 768px) {
          .main-content {
            padding: 1rem;
          }

          .meeting-card {
            padding: 1.25rem;
          }

          .meeting-card-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }

          .meeting-title {
            margin-right: 0;
          }

          .section-title {
            font-size: 1.25rem;
          }

          .search-input {
            padding: 0.875rem 1.25rem;
            font-size: 1rem;
          }

          .filter-btn {
            padding: 0.625rem 1.25rem;
            font-size: 0.9rem;
          }

          .join-btn {
            padding: 0.875rem;
            font-size: 1rem;
          }

          .join-container {
            padding: 2rem 1.5rem;
          }

          .join-title {
            font-size: 1.5rem;
          }

          .join-description {
            font-size: 1rem;
          }

          .avatar-section {
            flex-direction: column;
            text-align: center;
            gap: 1rem;
          }

          .form-actions {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .mobile-welcome {
            padding: 1.5rem 1rem;
          }

          .welcome-greeting {
            font-size: 1.25rem;
          }

          .meeting-card {
            padding: 1rem;
          }

          .meeting-title {
            font-size: 1.1rem;
          }

          .info-item {
            font-size: 0.9rem;
          }

          .filters-container {
            gap: 0.5rem;
          }

          .filter-btn {
            padding: 0.5rem 1rem;
            font-size: 0.85rem;
          }

          .join-container {
            padding: 1.5rem 1rem;
            margin: 1rem;
          }

          .join-title {
            font-size: 1.25rem;
          }

          .join-description {
            font-size: 0.95rem;
          }

          .join-input, .join-submit-btn {
            padding: 0.875rem 1.25rem;
            font-size: 1rem;
          }

          .profile-container {
            padding: 1.5rem 1rem;
            margin: 1rem;
          }

          .profile-avatar, .default-avatar {
            width: 80px;
            height: 80px;
          }

          .form-input {
            padding: 0.875rem 1rem;
            font-size: 0.95rem;
          }

          .btn {
            padding: 0.875rem 1.5rem;
            font-size: 0.95rem;
          }

          .attendance-cards-row {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .attendance-card {
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            text-align: left;
          }

          .card-icon {
            font-size: 1.5rem;
            margin-bottom: 0;
            flex-shrink: 0;
          }

          .card-content {
            flex: 1;
            gap: 0.25rem;
          }

          .card-title {
            font-size: 0.9rem;
          }

          .card-value {
            font-size: 1.5rem;
          }

          .search-filters-container {
            padding: 1rem;
          }
        }
      `}</style>
    </>
  );
};

export default MemberDashboard;