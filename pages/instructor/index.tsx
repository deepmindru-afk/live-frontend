import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser, testAuthStatus, forceLogin } from '../../lib/simple-auth-handlers';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { CREATE_MEETING, START_MEETING, END_MEETING, ROTATE_INVITE_CODE, CreateMeetingInput, CreateMeetingResponse } from '../../apollo/meeting/mutations';
import { GET_MY_MEETINGS, GET_ALL_MEETINGS, GET_MEETING_STATS } from '../../apollo/meeting/queries';
import { GET_VODS } from '../../apollo/vod/queries';
import { CREATE_VOD, UPDATE_VOD, DELETE_VOD, UPLOAD_VOD_FILE, CREATE_VOD_FROM_URL } from '../../apollo/vod/mutations';
import ProfileDropdown from '../../components/ProfileDropdown';
import Swal from 'sweetalert2';
import { isValidObjectId } from '../../lib/validation';

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
        
        // Only allow TUTOR role to access this instructor dashboard
        if (userData && userData.systemRole === 'TUTOR') {
        setUser(userData);
          await testBackendConnection();
          await fetchMeetings();
          await loadVODs();
        } else {
          // Redirect based on role
          if (userData && userData.systemRole === 'MEMBER') {
            window.location.href = '/member';
          } else if (userData && userData.systemRole === 'ADMIN') {
            window.location.href = '/dashboard';
          } else {
            window.location.href = '/login';
          }
        }
      } else {
        window.location.href = '/login';
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

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
      
      // Test if meeting mutations exist
      try {
        await enhancedMakeGraphQLRequest(`
          query TestMeetingQuery {
            __schema {
              mutationType {
                fields {
                  name
                }
              }
            }
          }
        `);
        console.log('🔍 BACKEND TEST: GraphQL schema accessible');
      } catch (schemaError) {
        console.warn('🔍 BACKEND TEST: Cannot access GraphQL schema:', schemaError);
      }
      
    } catch (error) {
      console.error('🔍 BACKEND TEST: Backend connection failed:', error);
    }
  };

  const fetchMeetings = async () => {
    try {
      console.log('📊 DASHBOARD: Fetching meetings...');
      
      // Get current user info
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?._id;
      
      if (!currentUserId) {
        console.warn('📊 DASHBOARD: No user ID found, cannot fetch meetings');
        setMeetings([]);
        return;
      }
      
      // Try to fetch meetings via GraphQL first (use real backend)
      try {
        const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
        const result = await makeGraphQLRequest(GET_MY_MEETINGS, {
          input: {
            hostId: currentUserId // Filter by current user
          }
        });
        
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
            duration: meeting.durationMin
          }));
          
          setMeetings(meetings);
          console.log('📊 DASHBOARD: Successfully loaded meetings from GraphQL:', meetings.length);
          return;
        }
      } catch (graphqlError) {
        console.warn('📊 DASHBOARD: GraphQL request failed, falling back to mock data:', graphqlError);
      }
      
      // If GraphQL fails, show empty state (no mock data to avoid showing all meetings)
      console.warn('📊 DASHBOARD: No meetings found in response');
      setMeetings([]);
      
    } catch (error) {
      console.error('📊 DASHBOARD: Error fetching meetings:', error);
      
      // Show error but don't block the UI
      await Swal.fire({
        icon: 'warning',
        title: '연결 오류',
        text: '서버에 연결할 수 없습니다. 오프라인 모드로 실행됩니다.',
        confirmButtonText: '확인'
      });
      
      // Set empty array for now - in production you might want to show cached data
      setMeetings([]);
    }
  };

  const handleCreateMeeting = async () => {
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

      // Try to create meeting via GraphQL first (use real backend for meeting creation)
      try {
        console.log('🏠 CREATE MEETING: Attempting GraphQL request to real backend...');
        console.log('🏠 CREATE MEETING: Input data:', {
          title: newMeetingTitle,
          notes: 'Professional live streaming session',
          scheduledFor: formattedSchedule,
          isPrivate: false
        });
        
        const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
        const result = await makeGraphQLRequest(CREATE_MEETING, {
          input: {
            title: newMeetingTitle,
            notes: 'Professional live streaming session',
            scheduledFor: formattedSchedule,
            isPrivate: false
          }
        });

        console.log('🏠 CREATE MEETING: GraphQL response received:', result);
        console.log('🏠 CREATE MEETING: Response data:', result.createMeeting);

        if (result.createMeeting && result.createMeeting._id) {
          const newMeeting: Meeting = {
            _id: result.createMeeting._id,
            title: result.createMeeting.title,
            status: result.createMeeting.status,
            schedule: result.createMeeting.scheduledFor,
            inviteCode: result.createMeeting.inviteCode,
            createdAt: result.createMeeting.createdAt,
            updatedAt: result.createMeeting.updatedAt,
            participantCount: result.createMeeting.participantCount || 0,
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
          
          // Only redirect to pre-join page for immediate meetings (not scheduled)
          if (!formattedSchedule) {
            console.log('🏠 CREATE MEETING: Immediate meeting, redirecting to pre-join page:', newMeeting._id);
            window.location.href = `/prejoin/${newMeeting._id}`;
          } else {
            console.log('🏠 CREATE MEETING: Scheduled meeting created, staying on dashboard');
            // Refresh the meetings list to show the new scheduled meeting
            await fetchMeetings();
          }
          return;
        }
      } catch (graphqlError) {
        console.error('🏠 CREATE MEETING: GraphQL request failed:', graphqlError);
        
        // Show proper error message instead of creating mock meeting
        let errorMessage = 'Failed to create meeting. ';
        
        if (graphqlError instanceof Error) {
          if (graphqlError.message.includes('TOKEN_NOT_EXIST')) {
            errorMessage += 'Please log in first.';
          } else if (graphqlError.message.includes('Cannot query field')) {
            errorMessage += 'Backend API not available.';
          } else if (graphqlError.message.includes('NetworkError') || graphqlError.message.includes('fetch')) {
            errorMessage += 'Cannot connect to backend server.';
          } else {
            errorMessage += graphqlError.message;
          }
        } else {
          errorMessage += 'Unknown error occurred.';
        }

        await Swal.fire({
          icon: 'error',
          title: 'Meeting Creation Failed',
          text: errorMessage,
          confirmButtonText: '확인'
        });

        console.log('🏠 CREATE MEETING: Meeting creation failed, no mock meeting created');
        return;
      }

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
        text: '회의가 시작되었습니다! (모의 서비스)',
        confirmButtonText: '확인'
      });

      console.log('▶️ START MEETING: Meeting started:', meetingId);

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
      
      // Validate meeting ID format
      if (!meetingId || meetingId.length < 10) {
        await Swal.fire({
          icon: 'error',
          title: '잘못된 회의 ID',
          text: '유효하지 않은 회의 ID입니다.',
          confirmButtonText: '확인'
        });
        return;
      }
      
      // Try to end meeting via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(END_MEETING, { meetingId });
        
        if (result.endMeeting && result.endMeeting._id) {
          // Update meeting status in local state
          setMeetings(prev => prev.map(meeting => 
            meeting._id === meetingId 
              ? { ...meeting, status: 'ENDED' as const, duration: result.endMeeting.durationMin || 3600 }
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
      } catch (graphqlError: any) {
        console.warn('⏹️ END MEETING: GraphQL request failed:', graphqlError);
        
        // Check if it's a specific error about meeting not found
        if (graphqlError.message && graphqlError.message.includes('Meeting not found')) {
          await Swal.fire({
            icon: 'error',
            title: '회의를 찾을 수 없음',
            text: '해당 회의를 찾을 수 없습니다. 회의가 이미 삭제되었거나 존재하지 않습니다.',
            confirmButtonText: '확인'
          });
          return;
        }
        
        // Check for other specific errors
        if (graphqlError.message && graphqlError.message.includes('Invalid meeting ID')) {
          await Swal.fire({
            icon: 'error',
            title: '잘못된 회의 ID',
            text: '유효하지 않은 회의 ID입니다.',
            confirmButtonText: '확인'
          });
          return;
        }
        
        // Generic GraphQL error
        await Swal.fire({
          icon: 'error',
          title: '서버 오류',
          text: `회의 종료 중 서버 오류가 발생했습니다: ${graphqlError.message || '알 수 없는 오류'}`,
          confirmButtonText: '확인'
        });
        return;
      }
      
      // If we reach here, something unexpected happened
      await Swal.fire({
        icon: 'error',
        title: '예상치 못한 오류',
        text: '회의 종료 중 예상치 못한 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });

    } catch (error: unknown) {
      console.error('⏹️ END MEETING: Unexpected error:', error);
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
        <title>HRDe Live - Instructor Dashboard</title>
        <meta name="description" content="Instructor Dashboard for HRDe Live" />
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
              className="logo-image"
            />
          </div>
          <div className="user-info">
            {user && <ProfileDropdown user={user} />}
          </div>
        </div>

        <div className="dashboard-content">
          {/* Left Sidebar */}
          <div className="dashboard-sidebar">
            <div className="greeting">
              <h2>{user?.displayName}님, 안녕하세요 👋</h2>
            </div>

            {/* Create Room Panel */}
            <div className="action-panel create-room">
              <h3>방 만들기</h3>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="방 이름을 입력하세요"
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                />
                <button onClick={handleCreateMeeting}>→</button>
              </div>
            </div>

            {/* Schedule Panel */}
            <div className="action-panel schedule">
              <h3>예약하기</h3>
              <p>원하는 시간에 회의를 할 수 있습니다</p>
              <div className="input-group">
                <input
                  type="datetime-local"
                  value={meetingSchedule}
                  onChange={(e) => setMeetingSchedule(e.target.value)}
                />
                <button onClick={handleCreateMeeting}>→</button>
              </div>
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
                  시작된 회의
                </button>
                <button
                  className={`tab ${activeTab === 'SCHEDULED' ? 'active' : ''}`}
                  onClick={() => setActiveTab('SCHEDULED')}
                >
                  예약된 회의
                </button>
                <button
                  className={`tab ${activeTab === 'ENDED' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ENDED')}
                >
                  종료된 회의
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
                  placeholder="검색어를 입력하세요"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button 
                  className="search-button"
                  onClick={handleSearch}
                  title="검색"
                >
                  🔍
                </button>
              </div>

              {/* Content based on active tab */}
              {activeTab === 'VOD' ? (
                /* VOD Management Section */
                <div>
                  {/* Upload Options */}
                  <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                    <button
                      onClick={handleFileUpload}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: 'white',
                        border: '2px solid #1976d2',
                        borderRadius: '8px',
                        color: '#1976d2',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}
                    >
                      📁 파일 등록
                    </button>
                    <button
                      onClick={handleURLUpload}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: 'white',
                        border: '2px solid #1976d2',
                        borderRadius: '8px',
                        color: '#1976d2',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}
                    >
                      🔗 URL 등록
                    </button>
                  </div>

                  {/* VOD Table */}
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
                                    color: '#6c757d'
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
                  {filteredMeetings.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">✗</div>
                      <p>등록된 회의가 없습니다</p>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>회의 제목</th>
                          <th>회의시간</th>
                          <th>초대코드</th>
                          <th>비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMeetings.map((meeting, index) => (
                          <tr key={meeting._id}>
                            <td>{index + 1}</td>
                            <td>{meeting.title}</td>
                            <td>
                              {meeting.schedule 
                                ? formatDate(meeting.schedule)
                                : formatDate(meeting.createdAt)
                              }
                            </td>
                            <td>
                              <span 
                                className="invite-code"
                                onClick={() => copyInviteCode(meeting.inviteCode)}
                              >
                                {meeting.inviteCode}
                              </span>
                            </td>
                            <td>
                              <div className="actions">
                                {meeting.status === 'SCHEDULED' && (
                                  <button 
                                    onClick={() => handleStartMeeting(meeting._id)}
                                    style={{
                                      padding: '6px 12px',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      background: '#28a745',
                                      color: 'white',
                                      marginRight: '8px'
                                    }}
                                  >
                                    시작
                                  </button>
                                )}
                                {meeting.status === 'STARTED' && (
                                  <>
                                    <button 
                                      onClick={() => {
        if (isValidObjectId(meeting._id)) {
          window.location.href = `/prejoin/${meeting._id}`;
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Invalid Meeting',
            text: 'This meeting has an invalid ID format. Please create a new meeting.',
            confirmButtonText: 'OK'
          });
        }
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        background: '#007bff',
                                        color: 'white',
                                        marginRight: '8px'
                                      }}
                                    >
                                      참여
                                    </button>
                                    <button 
                                      onClick={() => handleEndMeeting(meeting._id)}
                                      style={{
                                        padding: '6px 12px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        background: '#dc3545',
                                        color: 'white'
                                      }}
                                    >
                                      종료
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ margin: '0 0 20px 0' }}>파일 업로드</h2>
            <div style={{ marginBottom: '20px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="fileInput"
              />
              <button
                onClick={() => {
                  console.log('📁 FILE INPUT: Clicking file input');
                  fileInputRef.current?.click();
                }}
                style={{
                  width: '100%',
                  padding: '20px',
                  border: '2px dashed #ddd',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#666'
                }}
              >
                {selectedFile ? selectedFile.name : '파일을 선택하세요'}
              </button>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={uploadFile}
                disabled={!selectedFile}
                style={{
                  padding: '10px 20px',
                  backgroundColor: !selectedFile ? '#ccc' : '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: !selectedFile ? 'not-allowed' : 'pointer'
                }}
              >
                업로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL Upload Modal */}
      {showURLModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ margin: '0 0 20px 0' }}>URL 등록</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                VOD 제목
              </label>
              <input
                type="text"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="VOD 제목을 입력하세요"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  marginBottom: '15px'
                }}
              />
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                URL
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="VOD URL을 입력하세요"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setShowURLModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={uploadFromURL}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOD Menu Dropdown */}
      {showVODMenu && selectedVOD && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2000
        }} onClick={closeVODMenu}>
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
