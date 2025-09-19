import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser } from '../../lib/simple-auth-handlers';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { CREATE_MEETING, START_MEETING, END_MEETING, ROTATE_INVITE_CODE } from '../../apollo/meeting/mutations';
import { GET_MY_MEETINGS, GET_ALL_MEETINGS, GET_MEETING_STATS } from '../../apollo/meeting/queries';
import { GET_VODS } from '../../apollo/vod/queries';
import { CREATE_VOD, UPDATE_VOD, DELETE_VOD, UPLOAD_VOD_FILE, CREATE_VOD_FROM_URL } from '../../apollo/vod/mutations';
import ProfileDropdown from '../../components/ProfileDropdown';
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

interface VOD {
  _id: string;
  title: string;
  size: number;
  duration?: number;
  url?: string;
  filePath?: string;
  createdAt: string;
  updatedAt: string;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR';
}

const Dashboard: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'STARTED' | 'SCHEDULED' | 'ENDED' | 'VOD'>('STARTED');
  const [searchQuery, setSearchQuery] = useState('');
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  
  // VOD state
  const [vods, setVods] = useState<VOD[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showURLModal, setShowURLModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [showVODMenu, setShowVODMenu] = useState<string | null>(null);
  const [selectedVOD, setSelectedVOD] = useState<VOD | null>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        const userData = await getCurrentUser();
        
        // Redirect users to their appropriate dashboard based on role
        if (userData?.systemRole === 'MEMBER') {
          router.push('/member');
          return;
        } else if (userData?.systemRole === 'ADMIN') {
          router.push('/admin');
          return;
        } else if (userData?.systemRole === 'TUTOR') {
          router.push('/instructor');
          return;
        }
        
        // Only allow access to dashboard if user has no specific role or is a legacy user
        setUser(userData);
        await testBackendConnection();
        await fetchMeetings();
        await loadVODs();
      } else {
        window.location.href = '/login';
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // Close VOD menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showVODMenu && !(event.target as Element).closest('.vod-menu') && !(event.target as Element).closest('.three-dots')) {
        closeVODMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVODMenu]);

  const testBackendConnection = async () => {
    try {
      console.log('🔍 BACKEND TEST: Testing backend connection...');
      
      // Test with a simple query that should exist
      const result = await enhancedMakeGraphQLRequest(`
        query TestQuery {
          health
        }
      `);
      
      console.log('🔍 BACKEND TEST: Backend is reachable:', result);
      
    } catch (error) {
      console.error('🔍 BACKEND TEST: Backend connection failed:', error);
    }
  };

  const fetchMeetings = async () => {
    try {
      console.log('📊 DASHBOARD: Fetching meetings from backend...');
      
      const result = await enhancedMakeGraphQLRequest(GET_MY_MEETINGS, {
        input: {
          limit: 50,
          offset: 0
        }
      });
      
      console.log('📊 DASHBOARD: Backend response:', result);
      
      if (result.getMeetings && result.getMeetings.meetings && Array.isArray(result.getMeetings.meetings)) {
        const meetings: Meeting[] = result.getMeetings.meetings.map((meeting: any) => ({
          _id: meeting._id,
          title: meeting.title,
          status: meeting.status === 'CREATED' ? 'STARTED' : 
                  meeting.status === 'SCHEDULED' ? 'SCHEDULED' : 
                  meeting.status === 'ENDED' ? 'ENDED' : 'STARTED',
          schedule: meeting.scheduledFor,
          inviteCode: meeting.inviteCode,
          createdAt: meeting.createdAt,
          updatedAt: meeting.updatedAt || meeting.createdAt,
          participantCount: meeting.participantCount || 0,
          duration: meeting.duration
        }));
        
        setMeetings(meetings);
        console.log('📊 DASHBOARD: Successfully loaded meetings from backend:', meetings.length);
      } else {
        console.warn('📊 DASHBOARD: No meetings found in response');
        setMeetings([]);
      }
      
    } catch (error) {
      console.error('📊 DASHBOARD: Error fetching meetings:', error);
      setMeetings([]);
    }
  };

  const handleCreateRoom = async () => {
    if (!newMeetingTitle.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: '입력 필요',
        text: '방 이름을 입력해주세요.',
        confirmButtonText: '확인'
      });
      return;
    }

    try {
      console.log('🏠 CREATE MEETING: Creating meeting with title:', newMeetingTitle);
      console.log('🏠 CREATE MEETING: Schedule:', meetingSchedule);

      // Validate and format the date
      let formattedSchedule = null;
      if (meetingSchedule && meetingSchedule.trim()) {
        try {
          const date = new Date(meetingSchedule);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
          }
          formattedSchedule = date.toISOString();
          console.log('🏠 CREATE MEETING: Formatted schedule:', formattedSchedule);
        } catch (dateError) {
          console.error('🏠 CREATE MEETING: Date validation error:', dateError);
          await Swal.fire({
            icon: 'error',
            title: '날짜 오류',
            text: '올바른 날짜 형식을 입력해주세요.',
            confirmButtonText: '확인'
          });
          return;
        }
      }

      // Try to create meeting via GraphQL first
      try {
        console.log('🏠 CREATE MEETING: Attempting GraphQL request...');
        const result = await enhancedMakeGraphQLRequest(CREATE_MEETING, {
          input: {
            title: newMeetingTitle,
            scheduledFor: formattedSchedule,
            isPrivate: false,
            notes: null
          }
        });

        console.log('🏠 CREATE MEETING: GraphQL response received:', result);

        if (result.createMeeting && result.createMeeting._id) {
          const newMeeting: Meeting = {
            _id: result.createMeeting._id,
            title: result.createMeeting.title,
            status: result.createMeeting.status === 'CREATED' ? 'STARTED' : 
                    result.createMeeting.status === 'SCHEDULED' ? 'SCHEDULED' : 'STARTED',
            schedule: result.createMeeting.scheduledFor,
            inviteCode: result.createMeeting.inviteCode,
            createdAt: result.createMeeting.createdAt,
            updatedAt: result.createMeeting.createdAt,
            participantCount: 0,
          };

          // Add to existing meetings
          setMeetings(prev => [newMeeting, ...prev]);

          await Swal.fire({
            icon: 'success',
            title: '성공',
            text: '방이 성공적으로 생성되었습니다!',
            confirmButtonText: '확인'
          });

          // Clear form
          setNewMeetingTitle('');
          setMeetingSchedule('');

          console.log('🏠 CREATE MEETING: Meeting created via GraphQL:', newMeeting);
          return;
        }
      } catch (graphqlError) {
        console.warn('🏠 CREATE MEETING: GraphQL request failed:', graphqlError);
      }

      // If GraphQL fails, show error
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: '방 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
        confirmButtonText: '확인'
      });

    } catch (error: unknown) {
      console.error('🏠 CREATE MEETING: Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: `방 생성 중 오류가 발생했습니다: ${errorMessage}`,
        confirmButtonText: '확인'
      });
    }
  };

  const handleStartMeeting = async (meetingId: string) => {
    try {
      console.log('▶️ START MEETING: Starting meeting:', meetingId);
      
      // Try to start meeting via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(START_MEETING, { meetingId });
        
        if (result.startMeeting && result.startMeeting._id) {
          // Update meeting status in local state
          setMeetings(prev => prev.map(meeting => 
            meeting._id === meetingId 
              ? { ...meeting, status: 'STARTED' as const }
              : meeting
          ));

          await Swal.fire({
            icon: 'success',
            title: '성공',
            text: '회의가 시작되었습니다!',
            confirmButtonText: '확인'
          });

          console.log('▶️ START MEETING: Meeting started via GraphQL:', meetingId);
          return;
        }
      } catch (graphqlError) {
        console.warn('▶️ START MEETING: GraphQL request failed, falling back to local update:', graphqlError);
      }
      
      // Fallback to local state update if GraphQL fails
      setMeetings(prev => prev.map(meeting => 
        meeting._id === meetingId 
          ? { ...meeting, status: 'STARTED' as const }
          : meeting
      ));

      await Swal.fire({
        icon: 'success',
        title: '성공',
        text: '회의가 시작되었습니다!',
        confirmButtonText: '확인'
      });

      console.log('▶️ START MEETING: Mock meeting started:', meetingId);

    } catch (error: unknown) {
      console.error('▶️ START MEETING: Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: `회의 시작 중 오류가 발생했습니다: ${errorMessage}`,
        confirmButtonText: '확인'
      });
    }
  };

  const handleEndMeeting = async (meetingId: string) => {
    try {
      console.log('⏹️ END MEETING: Ending meeting:', meetingId);
      
      // Try to end meeting via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(END_MEETING, { meetingId });
        
        if (result.endMeeting && result.endMeeting._id) {
          // Update meeting status in local state
          setMeetings(prev => prev.map(meeting => 
            meeting._id === meetingId 
              ? { ...meeting, status: 'ENDED' as const, duration: result.endMeeting.duration || 3600 }
              : meeting
          ));

          await Swal.fire({
            icon: 'success',
            title: '성공',
            text: '회의가 종료되었습니다!',
            confirmButtonText: '확인'
          });

          console.log('⏹️ END MEETING: Meeting ended via GraphQL:', meetingId);
          return;
        }
      } catch (graphqlError) {
        console.warn('⏹️ END MEETING: GraphQL request failed, falling back to local update:', graphqlError);
      }
      
      // Fallback to local state update if GraphQL fails
      setMeetings(prev => prev.map(meeting => 
        meeting._id === meetingId 
          ? { ...meeting, status: 'ENDED' as const, duration: 3600 }
          : meeting
      ));

      await Swal.fire({
        icon: 'success',
        title: '성공',
        text: '회의가 종료되었습니다!',
        confirmButtonText: '확인'
      });

      console.log('⏹️ END MEETING: Mock meeting ended:', meetingId);

    } catch (error: unknown) {
      console.error('⏹️ END MEETING: Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: `회의 종료 중 오류가 발생했습니다: ${errorMessage}`,
        confirmButtonText: '확인'
      });
    }
  };

  const copyInviteCode = async (inviteCode: string) => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      await Swal.fire({
        icon: 'success',
        title: '복사 완료',
        text: '초대코드가 클립보드에 복사되었습니다!',
        confirmButtonText: '확인'
      });
    } catch (error) {
      console.error('Copy failed:', error);
      await Swal.fire({
        icon: 'error',
        title: '복사 실패',
        text: '초대코드 복사에 실패했습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const handleSearch = async () => {
    // For now, just filter the existing meetings client-side
    // In the future, this could be moved to server-side filtering
    await fetchMeetings();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  // VOD Functions
  const loadVODs = async () => {
    try {
      const result = await enhancedMakeGraphQLRequest(GET_VODS, {
        pagination: { limit: 50, offset: 0 }
      });
      
      if (result.vods) {
        setVods(result.vods);
      }
    } catch (error) {
      console.warn('Failed to load VODs:', error);
      setVods([]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = () => {
    console.log('📁 FILE UPLOAD: Opening file upload modal');
    setShowUploadModal(true);
  };

  const handleURLUpload = () => {
    console.log('🔗 URL UPLOAD: Opening URL upload modal');
    setShowURLModal(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async () => {
    console.log('📁 UPLOAD FILE: Starting file upload');
    if (!selectedFile) {
      console.log('📁 UPLOAD FILE: No file selected');
      return;
    }

    console.log('📁 UPLOAD FILE: Selected file:', selectedFile.name);

    try {
      const result = await enhancedMakeGraphQLRequest(UPLOAD_VOD_FILE, {
        file: selectedFile,
        title: selectedFile.name
      });

      console.log('📁 UPLOAD FILE: GraphQL result:', result);

      if (result.uploadVODFile && result.uploadVODFile.success) {
        await Swal.fire({
          icon: 'success',
          title: '파일 업로드',
          text: 'VOD 파일이 성공적으로 업로드되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        setShowUploadModal(false);
        setSelectedFile(null);
        loadVODs();
      }
    } catch (error) {
      console.error('📁 UPLOAD FILE: Upload error:', error);
      await Swal.fire({
        icon: 'error',
        title: '업로드 실패',
        text: '파일 업로드 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const uploadFromURL = async () => {
    console.log('🔗 UPLOAD URL: Starting URL upload');
    console.log('🔗 UPLOAD URL: Title:', urlTitle, 'URL:', urlInput);
    
    if (!urlInput.trim() || !urlTitle.trim()) {
      console.log('🔗 UPLOAD URL: Missing title or URL');
      await Swal.fire({
        icon: 'warning',
        title: '입력 오류',
        text: 'URL과 제목을 모두 입력해주세요.',
        confirmButtonText: '확인'
      });
      return;
    }

    try {
      const result = await enhancedMakeGraphQLRequest(CREATE_VOD_FROM_URL, {
        url: urlInput,
        title: urlTitle
      });

      console.log('🔗 UPLOAD URL: GraphQL result:', result);

      if (result.createVODFromURL && result.createVODFromURL.success) {
        await Swal.fire({
          icon: 'success',
          title: 'URL 등록',
          text: 'VOD URL이 성공적으로 등록되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        setShowURLModal(false);
        setUrlInput('');
        setUrlTitle('');
        loadVODs();
      }
    } catch (error) {
      console.error('🔗 UPLOAD URL: Upload error:', error);
      await Swal.fire({
        icon: 'error',
        title: '등록 실패',
        text: 'URL 등록 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const handleVODMenuClick = (vodId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    console.log('👤 VOD MENU: Clicking VOD menu for:', vodId);
    const vod = vods.find(v => v._id === vodId);
    if (vod) {
      console.log('👤 VOD MENU: Found VOD:', vod.title);
      setSelectedVOD(vod);
      setShowVODMenu(vodId);
    } else {
      console.log('👤 VOD MENU: VOD not found for ID:', vodId);
    }
  };

  const closeVODMenu = () => {
    setShowVODMenu(null);
    setSelectedVOD(null);
  };

  const deleteVOD = async (vodId: string) => {
    console.log('🗑️ DELETE VOD: Starting delete for VOD ID:', vodId);
    const vod = vods.find(v => v._id === vodId);
    if (!vod) {
      console.log('🗑️ DELETE VOD: VOD not found for ID:', vodId);
      return;
    }

    console.log('🗑️ DELETE VOD: Found VOD:', vod.title);

    const result = await Swal.fire({
      title: 'VOD 삭제',
      text: `"${vod.title}"을(를) 삭제하시겠습니까?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '삭제',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc3545'
    });

    if (result.isConfirmed) {
      console.log('🗑️ DELETE VOD: User confirmed deletion');
      try {
        const deleteResult = await enhancedMakeGraphQLRequest(DELETE_VOD, { id: vodId });
        console.log('🗑️ DELETE VOD: GraphQL result:', deleteResult);
        
        await Swal.fire({
          icon: 'success',
          title: '삭제 완료',
          text: 'VOD가 성공적으로 삭제되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        loadVODs();
      } catch (error) {
        console.error('🗑️ DELETE VOD: Delete error:', error);
        await Swal.fire({
          icon: 'error',
          title: '삭제 실패',
          text: 'VOD 삭제 중 오류가 발생했습니다.',
          confirmButtonText: '확인'
        });
      }
    } else {
      console.log('🗑️ DELETE VOD: User cancelled deletion');
    }
    closeVODMenu();
  };

  const filteredMeetings = meetings.filter(meeting => {
    // Filter by status
    if (activeTab === 'VOD') return false;
    if (activeTab !== 'STARTED' && activeTab !== 'SCHEDULED' && activeTab !== 'ENDED') return true;
    
    const statusMatch = meeting.status === activeTab;
    
    // Filter by search query
    const searchMatch = !searchQuery || 
      meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.inviteCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    return statusMatch && searchMatch;
  });

  const filteredVODs = vods.filter(vod =>
    !searchQuery || vod.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>HRDe Live - Dashboard</title>
        <meta name="description" content="Virtual meeting dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="logo" onClick={() => router.push('/dashboard')}>
            <Image
              src="/logoHRDe.png"
              alt="HRDe Live"
              width={120}
              height={40}
            />
          </div>
          <div className="header-actions">
            <ProfileDropdown user={user} />
          </div>
        </div>

        {/* Main Content */}
        <div className="dashboard-main">
          <div className="meetings-panel">
            {/* Tabs */}
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'STARTED' ? 'active' : ''}`}
                onClick={() => setActiveTab('STARTED')}
              >
                진행중 ({meetings.filter(m => m.status === 'STARTED').length})
              </button>
              <button
                className={`tab ${activeTab === 'SCHEDULED' ? 'active' : ''}`}
                onClick={() => setActiveTab('SCHEDULED')}
              >
                예약됨 ({meetings.filter(m => m.status === 'SCHEDULED').length})
              </button>
              <button
                className={`tab ${activeTab === 'ENDED' ? 'active' : ''}`}
                onClick={() => setActiveTab('ENDED')}
              >
                종료됨 ({meetings.filter(m => m.status === 'ENDED').length})
              </button>
              <button
                className={`tab ${activeTab === 'VOD' ? 'active' : ''}`}
                onClick={() => setActiveTab('VOD')}
              >
                VOD 관리
              </button>
            </div>

            {/* Search */}
            <div className="search-bar">
              <input
                type="text"
                placeholder="회의 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button onClick={handleSearch}>🔍</button>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'VOD' ? (
              /* VOD Management Section */
              <div>
                <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                  <button onClick={handleFileUpload} className="btn-primary">
                    📁 파일 등록
                  </button>
                  <button onClick={handleURLUpload} className="btn-secondary">
                    🔗 URL 등록
                  </button>
                </div>
                <div className="meetings-table">
                  {filteredVODs.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>VOD 제목</th>
                          <th>용량</th>
                          <th>비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVODs.map((vod, index) => (
                          <tr key={vod._id}>
                            <td>{index + 1}</td>
                            <td>
                              <div>
                                <div style={{ fontWeight: '500', marginBottom: '4px' }}>{vod.title}</div>
                                <div style={{ fontSize: '14px', color: '#666' }}>
                                  {vod.duration && formatDuration(vod.duration)}
                                  {vod.status === 'UPLOADING' && ' (업로드 중...)'}
                                  {vod.status === 'PROCESSING' && ' (처리 중...)'}
                                  {vod.status === 'ERROR' && ' (오류)'}
                                </div>
                              </div>
                            </td>
                            <td>{formatFileSize(vod.size)}</td>
                            <td>
                              <button
                                className="three-dots"
                                onClick={(e) => handleVODMenuClick(vod._id, e)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '18px',
                                  padding: '4px 8px'
                                }}
                              >
                                ⋯
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">✗</div>
                      <p>등록된 VOD가 없습니다</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Meetings Table */
              <div className="meetings-table">
                {filteredMeetings.length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th>방 이름</th>
                        <th>상태</th>
                        <th>초대코드</th>
                        <th>참가자</th>
                        <th>생성일</th>
                        <th>액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMeetings.map((meeting) => (
                        <tr key={meeting._id}>
                          <td>
                            <div className="meeting-title">{meeting.title}</div>
                            {meeting.schedule && (
                              <div className="meeting-schedule">
                                예약: {formatDate(meeting.schedule)}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge status-${meeting.status.toLowerCase()}`}>
                              {meeting.status === 'STARTED' ? '진행중' : 
                               meeting.status === 'SCHEDULED' ? '예약됨' : '종료됨'}
                            </span>
                          </td>
                          <td>
                            <div className="invite-code">
                              <span>{meeting.inviteCode}</span>
                              <button
                                onClick={() => copyInviteCode(meeting.inviteCode)}
                                className="copy-btn"
                              >
                                복사
                              </button>
                            </div>
                          </td>
                          <td>{meeting.participantCount}명</td>
                          <td>{formatDate(meeting.createdAt)}</td>
                          <td>
                            <div className="action-buttons">
                              {meeting.status === 'SCHEDULED' && (
                                <button
                                  onClick={() => handleStartMeeting(meeting._id)}
                                  className="btn-start"
                                >
                                  시작
                                </button>
                              )}
                              {meeting.status === 'STARTED' && (
                                <button
                                  onClick={() => handleEndMeeting(meeting._id)}
                                  className="btn-end"
                                >
                                  종료
                                </button>
                              )}
                              <button
                                onClick={() => router.push(`/meeting/${meeting._id}`)}
                                className="btn-join"
                              >
                                참여
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📅</div>
                    <p>회의가 없습니다</p>
                  </div>
                )}
              </div>
            )}

            {/* Create Meeting Form */}
            {activeTab !== 'VOD' && (
              <div className="create-meeting-form">
                <h3>새 회의 만들기</h3>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="회의 제목을 입력하세요"
                    value={newMeetingTitle}
                    onChange={(e) => setNewMeetingTitle(e.target.value)}
                  />
                  <input
                    type="datetime-local"
                    value={meetingSchedule}
                    onChange={(e) => setMeetingSchedule(e.target.value)}
                    placeholder="예약 시간 (선택사항)"
                  />
                  <button onClick={handleCreateRoom} className="btn-create">
                    회의 만들기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>파일 업로드</h2>
            <div className="file-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="fileInput"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="file-select-btn"
              >
                {selectedFile ? selectedFile.name : '파일을 선택하세요'}
              </button>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowUploadModal(false)} className="btn-cancel">
                취소
              </button>
              <button onClick={uploadFile} disabled={!selectedFile} className="btn-upload">
                업로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL Upload Modal */}
      {showURLModal && (
        <div className="modal-overlay" onClick={() => setShowURLModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>URL 등록</h2>
            <div className="form-group">
              <label>VOD 제목</label>
              <input
                type="text"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="VOD 제목을 입력하세요"
              />
              <label>URL</label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/video.mp4"
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowURLModal(false)} className="btn-cancel">
                취소
              </button>
              <button onClick={uploadFromURL} className="btn-upload">
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOD Menu Dropdown */}
      {showVODMenu && selectedVOD && (
        <div className="modal-overlay" onClick={closeVODMenu}>
          <div 
            className="vod-menu"
            style={{
              position: 'absolute',
              top: '100px',
              left: '50px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              padding: '8px 0',
              minWidth: '200px',
              zIndex: 2001
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #eee',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}>
              {selectedVOD.title}
            </div>
            
            <button
              onClick={() => deleteVOD(selectedVOD._id)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                backgroundColor: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#dc3545',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span>🗑️</span>
              삭제
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;




