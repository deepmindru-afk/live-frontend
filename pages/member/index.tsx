import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser, handleLogout, showErrorAlert, getAuthToken, makeGraphQLRequest } from '../../lib/simple-auth-handlers';
import { GET_MY_MEETINGS, GET_MEETING_BY_ID, GET_MEETING_STATS, GET_ALL_MEETINGS } from '../../apollo/meeting/queries';
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
  courseCode?: string;
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
  const [downloadingMeetingId, setDownloadingMeetingId] = useState<string | null>(null);

  const heroSearchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        
        if (isAuthenticated()) {
          const userData = await getCurrentUser();
          
          if (userData && userData.systemRole === 'MEMBER') {
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
              router.push('/instructor');
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
        router.push('/login');
        return;
      }
      
      if (!GET_MY_MEETINGS) {
        setMeetings([]);
        return;
      }
      
      
      // Wrap the GraphQL request in a try-catch to handle auth errors gracefully
      let result;
      try {
        // Try GET_MY_MEETINGS first, fallback to GET_ALL_MEETINGS
        let queryToUse = GET_MY_MEETINGS;
        let variables = {
          input: {
            limit: 100,
            page: 1
          }
        };
        
        
        result = await makeGraphQLRequest(queryToUse, variables);
        if (result?.getMeetings) {
        }
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
      
      
      
      // Check if meetings is actually an empty array vs undefined
      if (result.getMeetings) {
      }
      
      if (result.getMeetings && result.getMeetings.meetings && Array.isArray(result.getMeetings.meetings)) {
        
        // Show ALL meetings - LIVE (STARTED), SCHEDULED, and ENDED (participated or not)
        const allMeetings = result.getMeetings.meetings.map((meeting: any) => {
          const meetingStatus = meeting.status === 'CREATED' ? 'STARTED' : 
                                meeting.status === 'SCHEDULED' ? 'SCHEDULED' : 
                                meeting.status === 'ENDED' ? 'ENDED' : 
                                meeting.status === 'LIVE' ? 'STARTED' : 'STARTED';
          
          
          return {
            _id: meeting._id,
            title: meeting.title,
            status: meetingStatus,
            schedule: meeting.scheduledFor,
            inviteCode: meeting.inviteCode,
            courseCode: meeting.courseCode,
            createdAt: meeting.createdAt,
            updatedAt: meeting.updatedAt || meeting.createdAt,
            participantCount: meeting.participantCount || 0,
            duration: meeting.durationMin || meeting.duration
          };
        });
        
        setMeetings(allMeetings);
        setFilteredMeetings(allMeetings);
      } else if (result.getMeetings && result.getMeetings.meetings && result.getMeetings.meetings.length === 0) {
        setMeetings([]);
        setFilteredMeetings([]);
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
      const [participantResult, meetingResult] = await Promise.all([
        makeGraphQLRequest(GET_PARTICIPANT_BY_USER_MEETING, {
          meetingId: meetingId
        }),
        makeGraphQLRequest(GET_MEETING_BY_ID, {
          meetingId: meetingId
        })
      ]);

      setParticipantData({
        participant: participantResult?.getParticipantByUserAndMeeting ?? null,
        meeting: meetingResult?.getMeetingById ?? null
      });
    } catch (error: any) {
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

  const sanitizeFileName = (name: string) => {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'meeting';
  };

  const getFileNameFromHeaders = (contentDisposition: string | null, fallback: string) => {
    if (!contentDisposition) {
      return fallback;
    }

    try {
      const filenameStarMatch = contentDisposition.match(/filename\*\s*=\s*[^']*'[^']*'([^;]+)/i);
      if (filenameStarMatch && filenameStarMatch[1]) {
        return sanitizeFileName(decodeURIComponent(filenameStarMatch[1]));
      }

      const filenameMatch = contentDisposition.match(/filename\s*=\s*"?(?:UTF-8'')?([^";]+)"?/i);
      if (filenameMatch && filenameMatch[1]) {
        return sanitizeFileName(decodeURIComponent(filenameMatch[1]));
      }
    } catch (error) {
    }

    return fallback;
  };

  const handleDownloadMeetingFile = async (meeting: Meeting) => {
    if (downloadingMeetingId) {
      return;
    }

    setDownloadingMeetingId(meeting._id);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${baseUrl}/meeting-materials/${meeting._id}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          await Swal.fire({
            icon: 'info',
            title: '자료 없음',
            text: '이 미팅에 업로드된 자료가 없습니다.',
            confirmButtonText: '확인'
          });
          return;
        }

        throw new Error(`Failed to download material (status ${response.status})`);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition');
      const inferredFileName = getFileNameFromHeaders(contentDisposition, `${sanitizeFileName(meeting.title)}_자료`);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = inferredFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: '다운로드 실패',
        text: '미팅 자료를 다운로드하는 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    } finally {
      setDownloadingMeetingId(null);
    }
  };

  const closeAttendancePopup = () => {
    setShowAttendancePopup(false);
    setSelectedMeeting(null);
    setParticipantData(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHour = hours % 12 || 12;
    
    return `${year}. ${month}. ${day}. ${ampm} ${displayHour}:${minutes}`;
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
      minute: '2-digit',
      hour12: true
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
      // Convert minutes to hours and minutes
      const hours = Math.floor(meeting.duration / 60);
      const minutes = meeting.duration % 60;
      if (hours > 0 && minutes > 0) {
        return `${hours}시간 ${minutes}분`;
      } else if (hours > 0) {
        return `${hours}시간`;
      } else {
        return `${minutes}분`;
      }
    }
    return '정보 없음';
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
        <header className="dashboard-topbar">
          <div className="topbar-inner">
            <div className="topbar-logo">
              <Image
                src="/Icons/HRDeOnAirLogo.svg"
                alt="HRDe"
                width={96}
                height={40}
                priority
              />
            </div>
            <button
              type="button"
              className="topbar-logout"
              onClick={handleLogoutClick}
            >
              <Image
                src="/Icons/dashboard/logout.svg"
                alt="로그아웃"
                width={20}
                height={20}
              />
              <span>로그아웃</span>
            </button>
          </div>
        </header>

        <section className="dashboard-hero">
          <div className="hero-inner">
            <span className="hero-eyebrow">학생 대시보드</span>
            <h1 className="hero-heading">
              {(user?.displayName || '회원')}님, 안녕하세요 👋
            </h1>
            <p className="hero-subtext">나의 라이브 미팅을 빠르게 찾고 바로 참여하세요.</p>
            <div className="hero-search">
              <input
                ref={heroSearchInputRef}
                type="text"
                placeholder="미팅 제목으로 검색하세요."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="hero-search-input"
              />
              <button
                type="button"
                className="hero-search-button"
                aria-label="미팅 검색"
                onClick={() => heroSearchInputRef.current?.focus()}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.134 17 3 13.866 3 10C3 6.13401 6.134 3 10 3C13.866 3 17 6.13401 17 10Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="hero-tabs">
              <button
                type="button"
                className={`hero-tab ${activeTab === 'meetings' ? 'active' : ''}`}
                onClick={() => setActiveTab('meetings')}
              >
                내 미팅
              </button>
              <button
                type="button"
                className={`hero-tab ${activeTab === 'join' ? 'active' : ''}`}
                onClick={() => setActiveTab('join')}
              >
                미팅 참여
              </button>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="main-content" style={{ marginLeft: 0, width: '100%' }}>

          {/* Content based on active tab */}
          {activeTab === 'meetings' && (
            <div className="meetings-section">
              <div className="section-header">
                <button
                  onClick={fetchMeetings}
                  className="refresh-chip"
                  type="button"
                >
                  <Image
                    src="/Icons/dashboard/reset.svg"
                    alt="초기화"
                    width={16}
                    height={16}
                  />
                  <span>초기화</span>
                </button>
              </div>

              {filteredMeetings.length > 0 ? (
                <div className="meetings-grid">
                  {filteredMeetings.map((meeting) => {
                    return (
                    <div
                      key={meeting._id}
                      className={`meeting-card ${meeting.status.toLowerCase()}`}
                    >
                      <div className="meeting-card-status">
                        <span className={`status-pill ${meeting.status.toLowerCase()}`}>
                          {meeting.status === 'STARTED' ? '진행중' : 
                           meeting.status === 'SCHEDULED' ? '예약' : '종료'}
                        </span>
                        {(meeting.status === 'SCHEDULED' || meeting.status === 'STARTED') && (
                          <button
                            type="button"
                            className="card-icon-button"
                            aria-label="미팅 자료 다운로드"
                            onClick={() => handleDownloadMeetingFile(meeting)}
                            disabled={downloadingMeetingId === meeting._id}
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M12 4V14M12 14L16 10M12 14L8 10"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M6 18H18"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                      <h3 className="meeting-card-title">
                        {meeting.title}
                      </h3>
                      <p className="meeting-card-description">강의 제목: {meeting.title}</p>
                      <div className="meeting-card-body">
                        <div className="meeting-info">
                          <div className="info-item">
                            <span className="info-label">초대코드</span>
                            <span className="info-value">{meeting.inviteCode}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">강의코드</span>
                            <span className="info-value">{meeting.courseCode || '-'}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">생성일</span>
                            <span className="info-value">{formatDate(meeting.createdAt)}</span>
                          </div>
                          {meeting.schedule && (
                            <div className="info-item">
                              <span className="info-label">예약일</span>
                              <span className="info-value">{formatDate(meeting.schedule)}</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            if (meeting.status === 'ENDED') {
                              await handleAttendanceClick(meeting);
                            } else if (meeting.status === 'STARTED') {
                              router.push(`/prejoin/${meeting._id}`);
                            } else if (meeting.status === 'SCHEDULED') {
                              await Swal.fire({
                                icon: 'info',
                                title: '예정된 미팅',
                                text: '이 미팅은 아직 시작되지 않았습니다.',
                                confirmButtonText: '확인'
                              });
                            }
                          }}
                          className={`meeting-action ${meeting.status.toLowerCase()}`}
                        >
                          {meeting.status === 'STARTED' ? '출석 확인' : 
                           meeting.status === 'SCHEDULED' ? '대기중' : '출석 확인'}
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    {searchQuery.trim() ? '🔍' : '📅'}
                  </div>
                  <h3 className="empty-title">
                    {searchQuery.trim() 
                      ? `"${searchQuery}"에 대한 검색 결과가 없습니다.`
                      : '검색된 미팅이 없습니다.'
                    }
                  </h3>
                  <p style={{ color: '#666', marginTop: '10px', fontSize: '14px' }}>
                    {searchQuery.trim() 
                      ? '다른 검색어를 시도해보세요.'
                      : '아직 참여한 미팅이 없습니다. 호스트로부터 초대코드를 받아 참여해보세요.'}
                  </p>
                  {searchQuery.trim() && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="reset-search-btn"
                      style={{
                        marginTop: '20px',
                        padding: '10px 20px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
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
                <div className="join-visual">
                  <div className="join-visual-circle">
                    <Image
                      src="/Icons/dashboard/joinByCode.svg"
                      alt="초대코드 아이콘"
                      width={40}
                      height={40}
                    />
                  </div>
                </div>
                <h2 className="join-title">초대코드로 미팅 참여</h2>
                <p className="join-description">미팅 호스트로부터 받은 초대코드를 입력하세요.</p>
                <div className="join-form">
                  <label className="join-label" htmlFor="invite-code-input">초대코드</label>
                  <input
                    id="invite-code-input"
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
                  <span className="join-help-icon">💡</span>
                  <p className="help-text">초대코드는 미팅 호스트가 제공하는 고유한 코드입니다.</p>
                </div>
              </div>
            </div>
          )}

          {/* @ts-ignore - This section is disabled */}
          {false && activeTab === 'profile' && (
            <div className="profile-section">
              <div className="profile-container">
                <div className="profile-header">
                  <div className="avatar-section">
                    <div className="avatar-container">
                      {user?.avatarUrl ? (
                        <img
                          src={user?.avatarUrl || ''}
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

          {/* @ts-ignore - This section is disabled */}
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
              {loadingAttendance ? (
                <div className="attendance-loading">
                  <div className="attendance-loading-icon">⏳</div>
                  <p className="attendance-loading-text">출석 정보를 불러오는 중...</p>
                </div>
              ) : participantData?.participant ? (() => {
                const participantInfo = participantData.participant;
                const meetingInfo = participantData.meeting || selectedMeeting;

                const parseDateTime = (value: any): number | null => {
                  if (value === null || value === undefined) return null;
                  if (typeof value === 'number') return value;
                  if (typeof value === 'string') {
                    if (/^\d+$/.test(value)) {
                      const numeric = parseInt(value, 10);
                      return Number.isFinite(numeric) ? numeric : null;
                    }
                    const parsed = new Date(value).getTime();
                    return Number.isFinite(parsed) ? parsed : null;
                  }
                  if (value instanceof Date) {
                    return value.getTime();
                  }
                  const parsed = new Date(value as any).getTime();
                  return Number.isFinite(parsed) ? parsed : null;
                };

                const calculateMeetingDurationSeconds = () => {
                  if (!meetingInfo) return 0;
                  const start = parseDateTime(meetingInfo.actualStartAt);
                  const end = parseDateTime(meetingInfo.endedAt);
                  if (start !== null && end !== null && end > start) {
                    return Math.floor((end - start) / 1000);
                  }
                  const scheduledMinutes = meetingInfo.durationMin || meetingInfo.duration || selectedMeeting.duration;
                  if (scheduledMinutes) {
                    return Math.max(Math.floor(scheduledMinutes * 60), 0);
                  }
                  return 0;
                };

                const calculateParticipantDurationSeconds = () => {
                  const sessions = participantInfo?.loginInfo?.sessions || [];
                  if (!Array.isArray(sessions) || sessions.length === 0) {
                    const fallbackMinutes = participantInfo?.loginInfo?.totalDurationMinutes || 0;
                    return Math.max(Math.floor(fallbackMinutes * 60), 0);
                  }

                  const meetingEndedAt = parseDateTime(meetingInfo?.endedAt);
                  const meetingStatus = meetingInfo?.status || selectedMeeting.status;
                  let totalSeconds = 0;

                  sessions.forEach((session: any) => {
                    const joined = parseDateTime(session?.joinedAt);
                    if (joined === null) return;

                    let left = parseDateTime(session?.leftAt);
                    if (left === null) {
                      if (meetingEndedAt !== null) {
                        left = meetingEndedAt;
                      } else if (meetingStatus !== 'ENDED') {
                        left = Date.now();
                      }
                    }

                    if (left !== null && left > joined) {
                      const duration = Math.floor((left - joined) / 1000);
                      if (duration > 0 && duration < 86400) {
                        totalSeconds += duration;
                      }
                    }
                  });

                  if (totalSeconds === 0) {
                    const fallbackMinutes = participantInfo?.loginInfo?.totalDurationMinutes || 0;
                    totalSeconds = Math.max(Math.floor(fallbackMinutes * 60), 0);
                  }

                  return totalSeconds;
                };

                const meetingDurationSeconds = calculateMeetingDurationSeconds();
                const participantDurationSeconds = calculateParticipantDurationSeconds();
                const fallbackMeetingSeconds = selectedMeeting.duration ? selectedMeeting.duration * 60 : 0;
                const safeMeetingDurationSeconds = meetingDurationSeconds > 0 ? meetingDurationSeconds : fallbackMeetingSeconds;
                const attendancePercentage = safeMeetingDurationSeconds > 0
                  ? Math.round((participantDurationSeconds / safeMeetingDurationSeconds) * 100)
                  : 0;
                const normalizedAttendancePercentage = Math.max(0, Math.min(attendancePercentage, 100));

                const meetingDate = (meetingInfo && (meetingInfo.actualStartAt || meetingInfo.scheduledFor)) || selectedMeeting.schedule || selectedMeeting.createdAt;

                return (
                  <div className="attendance-card">
                    <h3 className="attendance-heading">출석상세정보</h3>
                    <p className="attendance-meeting-title">강의 제목: {selectedMeeting.title}</p>
                    <p className="attendance-meeting-date">{meetingDate ? formatDate(meetingDate) : '-'}</p>
                    <div className="attendance-divider" />
                    <div className="attendance-stats">
                      <div className="attendance-row">
                        <span>총 미팅시간</span>
                        <strong>{formatDuration(safeMeetingDurationSeconds)}</strong>
                      </div>
                      <div className="attendance-row">
                        <span>참석시간</span>
                        <strong>{formatDuration(participantDurationSeconds)}</strong>
                      </div>
                      <div className="attendance-row">
                        <span>출석률</span>
                        <strong>{normalizedAttendancePercentage} %</strong>
                      </div>
                    </div>
                    <div className="attendance-progress">
                      <div className="attendance-progress-track">
                        <div
                          className="attendance-progress-bar"
                          style={{ width: `${normalizedAttendancePercentage}%` }}
                        />
                      </div>
                      <span className="attendance-progress-value">{normalizedAttendancePercentage} %</span>
                    </div>
                    <button className="attendance-close-btn" onClick={closeAttendancePopup}>닫기</button>
                  </div>
                );
              })() : (
                <div className="attendance-loading">
                  <div className="attendance-loading-icon">📋</div>
                  <p className="attendance-loading-text">출석 정보가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CSS Styles */}
      <style jsx>{`
        .member-dashboard {
          min-height: 100vh;
          background-color: #161616;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* Dashboard Topbar */
        .dashboard-topbar {
          position: sticky;
          top: 0;
          z-index: 1100;
          background: linear-gradient(160deg, #111111 0%, #1a1a1a 60%, #0e0e0f 100%);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
        }

        .dashboard-topbar::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 4px;
          background: linear-gradient(90deg, #4A6CF7 0%, #8C5AEF 100%);
        }

        .topbar-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.1rem 2.5rem;
        }

        .topbar-logo :global(img) {
          width: auto;
          height: 36px;
          object-fit: contain;
          filter: drop-shadow(0 6px 18px rgba(74, 108, 247, 0.35));
        }

        .topbar-logout {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.85);
          padding: 0.65rem 1.4rem;
          border-radius: 999px;
          font-size: 0.95rem;
          font-weight: 500;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .topbar-logout:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(12, 39, 99, 0.35);
        }

        .topbar-logout :global(img) {
          width: 18px;
          height: 18px;
        }

        @media (max-width: 768px) {
          .topbar-inner {
            padding: 0.9rem 1.25rem;
          }

          .topbar-logo :global(img) {
            height: 32px;
          }

          .topbar-logout {
            padding: 0.55rem 1.1rem;
            font-size: 0.9rem;
          }
        }

        /* Dashboard Hero */
        .dashboard-hero {
          position: relative;
          padding: 5rem 1.5rem 4rem;
          margin: 0;
          background-image: linear-gradient(140deg, rgba(74, 108, 247, 0.78) 0%, rgba(140, 90, 239, 0.82) 40%, rgba(12, 18, 54, 0.9) 100%), url('/background.jpg');
          background-size: cover;
          background-position: center;
          color: #ffffff;
        }

        .dashboard-hero::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(10, 12, 32, 0.35) 0%, rgba(10, 12, 32, 0.75) 100%);
          mix-blend-mode: screen;
          pointer-events: none;
        }

        .hero-inner {
          position: relative;
          z-index: 1;
          max-width: 880px;
          margin: 0 auto;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
        }

        .hero-eyebrow {
          display: inline-block;
          font-size: 0.95rem;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.8);
        }

        .hero-heading {
          font-size: 2.75rem;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .hero-subtext {
          margin: 0 auto;
          max-width: 540px;
          font-size: 1.05rem;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.6;
        }

        .hero-search {
          display: flex;
          align-items: center;
          background: rgba(9, 9, 9, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 48px;
          padding: 0.5rem 0.5rem 0.5rem 1.5rem;
          box-shadow: 0 24px 55px rgba(8, 8, 16, 0.45);
        }

        .hero-search-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 1.05rem;
          padding: 0.75rem 0;
        }

        .hero-search-input::placeholder {
          color: rgba(255, 255, 255, 0.55);
        }

        .hero-search-input:focus {
          outline: none;
        }

        .hero-search-button {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #4A6CF7 0%, #8C5AEF 100%);
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 16px 30px rgba(74, 108, 247, 0.45);
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .hero-search-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 40px rgba(74, 108, 247, 0.55);
        }

        .hero-tabs {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          padding: 0.45rem;
          margin: 0 auto;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.15);
        }

        .hero-tab {
          position: relative;
          border: none;
          border-radius: 999px;
          padding: 0.65rem 1.75rem;
          font-size: 0.95rem;
          font-weight: 600;
          letter-spacing: 0.03em;
          background: transparent;
          color: rgba(255, 255, 255, 0.75);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .hero-tab.active {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
        }

        .hero-tab:hover {
          color: #ffffff;
        }

        @media (max-width: 768px) {
          .dashboard-hero {
            padding: 4rem 1.25rem 3rem;
          }

          .hero-heading {
            font-size: 2.1rem;
          }

          .hero-search {
            padding: 0.45rem 0.45rem 0.45rem 1.25rem;
          }

          .hero-search-button {
            width: 48px;
            height: 48px;
          }

          .hero-tabs {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .hero-tab {
            padding: 0.55rem 1.35rem;
          }
        }

        @media (max-width: 480px) {
          .hero-heading {
            font-size: 1.8rem;
          }

          .hero-eyebrow {
            font-size: 0.85rem;
            letter-spacing: 0.25em;
          }

          .hero-search {
            flex-direction: row;
          }

          .hero-search-input {
            font-size: 0.95rem;
          }
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
          background: #161616;
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

        /* Desktop Sidebar - Hide on all screen sizes */
        .desktop-sidebar {
          display: none;
        }

        /* Attendance Popup Styles */
        .attendance-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(6px);
        }

        .attendance-popup {
          position: relative;
          width: 420px;
          max-width: calc(100% - 40px);
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
          padding: 28px 30px 26px;
        }

        .attendance-close {
          position: absolute;
          top: 18px;
          right: 18px;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 50%;
          background: rgba(22, 22, 22, 0.06);
          color: #161616;
          font-size: 18px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .attendance-close:hover {
          background: rgba(22, 22, 22, 0.12);
        }

        .attendance-card {
          display: flex;
          flex-direction: column;
          gap: 18px;
          color: #161616;
        }

        .attendance-heading {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
        }

        .attendance-meeting-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #161616;
        }

        .attendance-meeting-date {
          margin: -4px 0 0;
          font-size: 0.85rem;
          color: #737373;
        }

        .attendance-divider {
          height: 1px;
          background: #e5e5e5;
          margin: 12px 0 8px;
        }

        .attendance-divider {
          height: 1px;
          background: #e5e5e5;
          margin: 4px 0 12px;
        }

        .attendance-stats {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .attendance-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.95rem;
          color: #737373;
        }

        .attendance-row strong {
          color: #161616;
          font-weight: 700;
        }

        .attendance-progress {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
        }

        .attendance-progress-track {
          flex: 1;
          height: 12px;
          border-radius: 999px;
          background: #d9d9d9;
          overflow: hidden;
        }

        .attendance-progress-bar {
          height: 100%;
          background: #73428f;
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        .attendance-progress-value {
          font-size: 0.85rem;
          font-weight: 600;
          color: #737373;
        }

        .attendance-close-btn {
          align-self: flex-end;
          margin-top: 20px;
          padding: 0.55rem 1.4rem;
          border: 1px solid #d9d9d9;
          border-radius: 999px;
          background: #ffffff;
          color: #161616;
          font-weight: 500;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .attendance-close-btn:hover {
          background: #f5f5f5;
        }

        .attendance-loading {
          text-align: center;
          padding: 40px 20px;
          color: #737373;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }

        .attendance-loading-icon {
          font-size: 2.5rem;
        }

        .attendance-loading-text {
          margin: 0;
          font-size: 1rem;
        }

        @media (max-width: 768px) {
          .attendance-popup {
            padding: 24px 20px;
          }
        }
        /* Responsive Design */
        @media (max-width: 768px) {
          .attendance-popup {
            width: 95%;
            margin: 20px;
            max-height: 90vh;
          }
          
          .popup-content {
            padding: 20px;
          }
          
          .attendance-main-stats {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          
          .meeting-info-card {
            padding: 20px;
          }
          
          .meeting-title {
            font-size: 18px;
          }
          
          .stat-icon-large {
            font-size: 28px;
          }
          
          .stat-value-large {
            font-size: 24px;
          }
          
          .main-stat-card {
            padding: 20px;
          }
        }

        /* Main Content - Full width without sidebar */
        .main-content {
          width: 100%;
          background-color: #161616;
          padding: 30px;
        }

        /* Meetings Section */
        .meetings-section {
          max-width: 1200px;
          margin: 0 auto;
        }

        .section-header {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin-bottom: 2rem;
        }

        .refresh-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1.4rem;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #161616;
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .refresh-chip:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 30px rgba(0, 0, 0, 0.45);
        }

        .refresh-chip :global(span) {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }

        /* Meetings Grid */
        .meetings-grid {
          display: grid;
          gap: 2rem;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        }

        /* Meeting Card */
        .meeting-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding: 1.8rem;
          border-radius: 24px;
          background: linear-gradient(155deg, rgba(59, 59, 59, 0.95) 0%, rgba(41, 41, 41, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 22px 45px rgba(0, 0, 0, 0.45);
          color: rgba(255, 255, 255, 0.92);
        }

        .meeting-card.started {
          border-color: rgba(30, 161, 65, 0.45);
        }

        .meeting-card.scheduled {
          border-color: rgba(220, 196, 155, 0.45);
        }

        .meeting-card.ended {
          border-color: rgba(31, 107, 224, 0.45);
        }

        .meeting-card-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.35rem 0.85rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .status-pill.started {
          background: rgba(30, 161, 65, 0.22);
          color: #28c76f;
          border: 1px solid rgba(30, 161, 65, 0.45);
        }

        .status-pill.scheduled {
          background: rgba(220, 196, 155, 0.25);
          color: #e0b276;
          border: 1px solid rgba(220, 196, 155, 0.45);
        }

        .status-pill.ended {
          background: rgba(237, 111, 115, 0.25);
          color: #ff7b82;
          border: 1px solid rgba(237, 111, 115, 0.45);
        }

        .card-icon-button {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.8);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .card-icon-button:hover {
          background: rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }

        .meeting-card-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
          color: #ffffff;
        }

        .meeting-card-description {
          margin: 0;
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.7);
        }

        .meeting-card-body {
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
        }

        .meeting-info {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.8);
        }

        .info-label {
          color: rgba(255, 255, 255, 0.55);
          font-weight: 500;
        }

        .info-label::after {
          content: ' :';
          color: rgba(255, 255, 255, 0.35);
          margin-left: 0.2rem;
        }

        .info-value {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
        }

        .meeting-action {
          width: 100%;
          padding: 0.95rem;
          border: none;
          border-radius: 14px;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          letter-spacing: 0.03em;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .meeting-action.started {
          background: #1ea141;
          box-shadow: 0 12px 25px rgba(30, 161, 65, 0.35);
        }

        .meeting-action.scheduled {
          background: #737373;
          box-shadow: 0 12px 25px rgba(115, 115, 115, 0.35);
        }

        .meeting-action.ended {
          background: #1f6be0;
          box-shadow: 0 12px 25px rgba(31, 107, 224, 0.4);
        }

        .meeting-action:hover {
          transform: translateY(-2px);
        }
        /* Join Section */
        .join-section {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 60vh;
          padding: 3rem 1rem;
        }

        .join-container {
          max-width: 520px;
          width: 100%;
          text-align: center;
          background: linear-gradient(150deg, rgba(59, 59, 59, 0.95) 0%, rgba(38, 38, 38, 0.95) 100%);
          padding: 3rem 2.75rem;
          border-radius: 32px;
          box-shadow: 0 28px 60px rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .join-visual {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .join-visual-circle {
          width: 76px;
          height: 76px;
          border-radius: 26px;
          background: linear-gradient(145deg, rgba(114, 114, 114, 0.35) 0%, rgba(38, 38, 38, 0.9) 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 6px 16px rgba(255, 255, 255, 0.04), 0 18px 30px rgba(0, 0, 0, 0.35);
        }

        .join-title {
          font-size: 1.65rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 0.75rem 0;
        }

        .join-description {
          font-size: 1rem;
          color: #929397;
          margin: 0;
          line-height: 1.6;
        }

        .join-form {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          margin-top: 2.25rem;
        }

        .join-label {
          text-align: left;
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: 0.05em;
        }

        .join-input {
          width: 100%;
          padding: 1rem 1.35rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          font-size: 1.05rem;
          background-color: #262626;
          color: #ffffff;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .join-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .join-input:focus {
          outline: none;
          border-color: rgba(74, 108, 247, 0.85);
          box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.25);
        }

        .join-submit-btn {
          width: 100%;
          padding: 1rem 1.35rem;
          background: linear-gradient(135deg, #2478df 0%, #1f5ec4 100%);
          color: white;
          border: none;
          border-radius: 16px;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.04em;
        }

        .join-submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 32px rgba(36, 120, 223, 0.45);
        }

        .join-help {
          margin-top: 2rem;
          padding: 1rem 1.25rem;
          border-radius: 16px;
          background: rgba(22, 22, 22, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          color: #929397;
          text-align: left;
        }

        .join-help-icon {
          font-size: 1.2rem;
          line-height: 1;
        }

        .help-text {
          margin: 0;
          font-size: 0.95rem;
          color: #929397;
        }

        /* Profile Section */
        .profile-section {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        .profile-container {
          background: #161616;
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
          background-color: #161616;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .form-input:focus {
          outline: none;
          border-color: #1976d2;
          background-color: #161616;
          box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
        }

        .form-input.disabled {
          background-color: #161616;
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
          background: #161616;
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

        }
      `}</style>
    </>
  );
};

export default MemberDashboard;