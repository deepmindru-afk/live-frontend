import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser, testAuthStatus, forceLogin, showErrorAlert } from '../../lib/simple-auth-handlers';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { CREATE_MEETING, START_MEETING, END_MEETING, ROTATE_INVITE_CODE, CreateMeetingInput, CreateMeetingResponse } from '../../apollo/meeting/mutations';
import { GET_TUTOR_MEETINGS, GET_ALL_MEETINGS, GET_MEETING_STATS } from '../../apollo/meeting/queries';
import { GET_VODS } from '../../apollo/vod/queries';
import { CREATE_VOD, UPDATE_VOD, DELETE_VOD, UPLOAD_VOD_FILE, CREATE_VOD_FROM_URL } from '../../apollo/vod/mutations';
import { handleLogout } from '../../lib/simple-auth-handlers';
import Swal from 'sweetalert2';
import { isValidObjectId } from '../../lib/validation';

interface Meeting {
  _id: string;
  title: string;
  status: 'LIVE' | 'STARTED' | 'SCHEDULED' | 'ENDED';
  schedule?: string;
  inviteCode: string;
  courseCode?: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  duration?: number;
  isCurrentUserHost?: boolean; // Add this for debugging
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
  const [activeTab, setActiveTab] = useState<'LIVE' | 'SCHEDULED' | 'ENDED' | 'VOD'>('LIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  
  // VOD state
  const [vods, setVods] = useState<VOD[]>([]);
  const [vodAccessDenied, setVodAccessDenied] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showURLModal, setShowURLModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [showVODMenu, setShowVODMenu] = useState<string | null>(null);
  const [selectedVOD, setSelectedVOD] = useState<VOD | null>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Screen width for responsive design
  const [screenWidth, setScreenWidth] = useState<number>(0);

  useEffect(() => {
    // Set initial width
    setScreenWidth(typeof window !== 'undefined' ? window.innerWidth : 0);
    
    // Handle resize
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        
        // Add a delay to ensure localStorage is accessible after redirect
        // Increased delay to allow token to be properly saved
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if user is authenticated
        const authStatus = isAuthenticated();
        
        if (!authStatus) {
          // Clear any stale/invalid tokens
          localStorage.removeItem('jwt');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }

        // Get user data directly from localStorage (no API call)
        // This is faster and avoids token race conditions
        let userData = null;
        const userStr = localStorage.getItem('user');
        
        if (userStr) {
          try {
            userData = JSON.parse(userStr);
          } catch (e) {
          }
        }
        
        
        if (!userData) {
          // Clear any stale data
          localStorage.removeItem('jwt');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }

        
        // Allow TUTOR and ADMIN roles to access this instructor dashboard
        // Admins should have full access to instructor features including meeting creation
        if (userData.systemRole === 'TUTOR' || userData.systemRole === 'ADMIN') {
          setUser(userData);
          await testBackendConnection();
          await fetchMeetings();
          // Skip loading VODs since we only show meetings in VOD tab now
          // Set empty VOD list to avoid errors
          setVods([]);
        } else {
          // Redirect based on role
          if (userData.systemRole === 'MEMBER') {
            window.location.href = '/member';
          } else {
            // User not found or invalid role
            await showErrorAlert('Authentication Error', 'Invalid user role. Please log in again.');
            window.location.href = '/login';
          }
        }
      } catch (error: any) {
        await showErrorAlert('Authentication Error', 'Failed to verify user. Please log in again.');
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
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

  // Load VODs when VOD tab is selected
  useEffect(() => {
    if (activeTab === 'VOD') {
      // Define loadVODs inline to avoid dependency issues
      const fetchVODs = async () => {
        try {
          const result = await enhancedMakeGraphQLRequest(GET_VODS, {
            input: { limit: 50, offset: 0 }
          });
          
          if (result && result.getAllVods && result.getAllVods.vods) {
            setVods(result.getAllVods.vods);
          } else {
            setVods([]);
          }
        } catch (error: any) {
          // Handle role permission error gracefully
          if (error && (error.message === 'ONLY_SPECIFIC_ROLES_ALLOWED' || error.message?.includes('ONLY_SPECIFIC_ROLES_ALLOWED') || error.status === 403)) {
            setVods([]);
            setVodAccessDenied(true); // Mark that VOD access is denied
            return;
          }
          setVods([]);
        }
      };
      fetchVODs();
    }
  }, [activeTab]);

  const testBackendConnection = async () => {
    try {
      
      // Test with a simple query that should exist
      const result = await enhancedMakeGraphQLRequest(`
        query TestQuery {
          health
        }
      `);
      
      
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
      } catch (schemaError) {
      }
      
    } catch (error) {
    }
  };

  const fetchMeetings = async () => {
    try {
      // Add a small delay to ensure token is saved
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if token exists
      const { getAuthToken } = await import('../../lib/simple-auth-handlers');
      const token = getAuthToken();
      
      if (!token) {
        setMeetings([]);
        return;
      }
      
      // Get current user info
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?._id;
      
      if (!currentUserId) {
        setMeetings([]);
        return;
      }
      
      // Try to fetch meetings via GraphQL first (use real backend)
      try {
        const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
        const result = await makeGraphQLRequest(GET_TUTOR_MEETINGS, {
          input: {
            limit: 50, // Get more meetings
            page: 1 // Use page instead of offset
          }
        });
        
        // Check if result is null
        if (!result) {
          // Don't redirect to login - just show empty state
          // The actual GraphQL error handling happens in makeGraphQLRequest
          setMeetings([]);
          return;
        }
        
        if (result.getMeetings && result.getMeetings.meetings && Array.isArray(result.getMeetings.meetings)) {
          const meetings: Meeting[] = result.getMeetings.meetings.map((meeting: any) => {
            // Check if current user is still the host of this meeting
            const isCurrentUserHost = meeting.host && meeting.host._id === currentUserId;
            
            // Debug logging
            
            // Determine status based on whether user is still host
            let status: 'LIVE' | 'STARTED' | 'SCHEDULED' | 'ENDED';
            if (isCurrentUserHost) {
              // User is still the host, show actual meeting status
              status = meeting.status === 'LIVE' ? 'LIVE' :
                      meeting.status === 'CREATED' ? 'LIVE' : 
                      meeting.status === 'SCHEDULED' ? 'SCHEDULED' : 
                      meeting.status === 'ENDED' ? 'ENDED' : 'LIVE';
            } else {
              // User is no longer the host (transferred), show as ENDED
              status = 'ENDED';
            }
            
            
            return {
              _id: meeting._id,
              title: meeting.title,
              status: status,
              schedule: meeting.scheduledFor,
              inviteCode: meeting.inviteCode,
              courseCode: meeting.courseCode,
              createdAt: meeting.createdAt,
              updatedAt: meeting.updatedAt || meeting.createdAt,
              participantCount: meeting.participantCount || 0,
              duration: meeting.durationMin,
              isCurrentUserHost: isCurrentUserHost // Add this for debugging
            };
          });
          
          setMeetings(meetings);
          return;
        }
      } catch (graphqlError: any) {
        
        // For ALL errors, just show empty state - don't redirect
        // The auth check at page load will handle authentication issues
        setMeetings([]);
        
        // Only show error modal for actual connection issues (not auth issues)
        if (!graphqlError.message?.includes('TOKEN_NOT_EXIST') && !graphqlError.message?.includes('Authentication')) {
          Swal.fire({
            title: 'Unable to Load Meetings',
            text: 'There was an issue connecting to the server. Please check your connection and try again.',
            icon: 'warning',
            confirmButtonText: 'OK',
            allowOutsideClick: true
          });
        }
      }
      
      // If GraphQL fails, show empty state (no mock data to avoid showing all meetings)
      setMeetings([]);
      
    } catch (error: any) {
      
      // For ALL errors, just show empty state - don't redirect
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

      // Validate and format the date
      let formattedSchedule = null;
      if (meetingSchedule && meetingSchedule.trim()) {
        try {
          const date = new Date(meetingSchedule);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
          }
          formattedSchedule = date.toISOString();
        } catch (dateError) {
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
        
        const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
        const result = await makeGraphQLRequest(CREATE_MEETING, {
          input: {
            title: newMeetingTitle,
            notes: 'Professional live streaming session',
            scheduledFor: formattedSchedule,
            isPrivate: false,
            courseCode: courseCode.trim() || undefined
          }
        });


        if (result.createMeeting && result.createMeeting._id) {
          const newMeeting: Meeting = {
            _id: result.createMeeting._id,
            title: result.createMeeting.title,
            status: result.createMeeting.status,
            schedule: result.createMeeting.scheduledFor,
            inviteCode: result.createMeeting.inviteCode,
            courseCode: result.createMeeting.courseCode,
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
          setCourseCode('');

          
          // Only redirect to pre-join page for immediate meetings (not scheduled)
          if (!formattedSchedule) {
            window.location.href = `/prejoin/${newMeeting._id}`;
          } else {
            // Refresh the meetings list to show the new scheduled meeting
            await fetchMeetings();
          }
          return;
        }
      } catch (graphqlError) {
        
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

        return;
      }

    } catch (error: unknown) {
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
            text: '회의가 시작되었습니다! 프리조인 페이지로 이동합니다.',
            confirmButtonText: '확인'
          });

          
          // Navigate to prejoin room
          router.push(`/prejoin/${meetingId}`);
          return;
        }
      } catch (graphqlError) {
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
        text: '회의가 시작되었습니다! 프리조인 페이지로 이동합니다. (모의 서비스)',
        confirmButtonText: '확인'
      });

      
      // Navigate to prejoin room even for mock service
      router.push(`/prejoin/${meetingId}`);

    } catch (error: unknown) {
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
        
        // Check if result is null (which happens when auth is cleared)
        if (result === null) {
          throw new Error('Authentication cleared during request');
        }
        
        // Check if the result has the expected structure
        if (result && result.endMeeting && result.endMeeting._id) {
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

          return;
        } else {
          throw new Error('Invalid response structure');
        }
      } catch (graphqlError: any) {
        
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
        
        // Check if this is an authentication error that cleared the token
        if (graphqlError.message && 
            (graphqlError.message.includes('Invalid credentials') || 
             graphqlError.message.includes('JWT_EXPIRED') ||
             graphqlError.message.includes('TOKEN_NOT_EXIST'))) {
          // Don't show error to user, just fall back to local update
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
        input: { limit: 50, offset: 0 }
      });
      
      if (result && result.getAllVods && result.getAllVods.vods) {
        setVods(result.getAllVods.vods);
      } else {
        setVods([]);
      }
    } catch (error: any) {
      
      // Check if it's a role permission error
      if (error && (error.message?.includes('ONLY_SPECIFIC_ROLES_ALLOWED') || 
                    error.message?.includes('Authentication') ||
                    error.message?.includes('TOKEN_NOT_EXIST') ||
                    error.status === 403)) {
        setVods([]);
        return; // Don't show error for permission issues
      }
      
      // Check for 400 errors
      if (error && error.status === 400) {
        setVods([]);
        return;
      }
      
      // Check for 500 server errors
      if (error && error.status === 500) {
        setVods([]);
        return;
      }
      
      // For other errors, just show empty state
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
    setShowUploadModal(true);
  };

  const handleURLUpload = () => {
    setShowURLModal(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      return;
    }


    try {
      const result = await enhancedMakeGraphQLRequest(UPLOAD_VOD_FILE, {
        file: selectedFile,
        title: selectedFile.name
      });


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
      await Swal.fire({
        icon: 'error',
        title: '업로드 실패',
        text: '파일 업로드 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const uploadFromURL = async () => {
    
    if (!urlInput.trim() || !urlTitle.trim()) {
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
    const vod = vods.find(v => v._id === vodId);
    if (vod) {
      setSelectedVOD(vod);
      setShowVODMenu(vodId);
    } else {
    }
  };

  const closeVODMenu = () => {
    setShowVODMenu(null);
    setSelectedVOD(null);
  };

  const deleteVOD = async (vodId: string) => {
    const vod = vods.find(v => v._id === vodId);
    if (!vod) {
      return;
    }

    try {
      const deleteResult = await enhancedMakeGraphQLRequest(DELETE_VOD, { id: vodId });
      
      await Swal.fire({
        icon: 'success',
        title: '삭제 완료',
        text: 'VOD가 성공적으로 삭제되었습니다.',
        timer: 2000,
        showConfirmButton: false
      });
      
      loadVODs();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: '삭제 실패',
        text: 'VOD 삭제 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    }
    closeVODMenu();
  };

  const filteredMeetings = meetings.filter(meeting => {
    // For VOD tab, show all meetings (no status filter)
    if (activeTab === 'VOD') {
      const searchMatch = !searchQuery || 
        meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.inviteCode.toLowerCase().includes(searchQuery.toLowerCase());
      return searchMatch;
    }
    
    // Filter by status for other tabs
    if (activeTab !== 'LIVE' && activeTab !== 'SCHEDULED' && activeTab !== 'ENDED') return true;
    
    // Map statuses for filtering
    let statusMatch = false;
    if (activeTab === 'LIVE') {
      statusMatch = meeting.status === 'LIVE' || meeting.status === 'STARTED';
    } else {
      statusMatch = meeting.status === activeTab;
    }
    
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
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 30px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
        }}>
          <div 
            onClick={() => router.push('/dashboard')}
            style={{ cursor: 'pointer' }}
          >
            <Image
              src="/logoHRDe.png"
              alt="HRDe Live"
              width={120}
              height={40}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <button
            onClick={async () => {
              try {
                // Ask for confirmation before logout
                const result = await Swal.fire({
                  title: '로그아웃 하시겠습니까?',
                  text: '정말 로그아웃 하시겠습니까?',
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonText: '예, 로그아웃',
                  cancelButtonText: '취소',
                  confirmButtonColor: '#d33',
                  cancelButtonColor: '#3085d6'
                });

                // Only logout if user confirmed
                if (result.isConfirmed) {
                  await handleLogout();
                  router.push('/');
                }
              } catch (error) {
              }
            }}
            style={{
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16,17 21,12 16,7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>로그아웃</span>
          </button>
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
              <input
                type="text"
                placeholder="강의 코드 (선택사항)"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                style={{ 
                  marginTop: '12px',
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase'
                }}
              />
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
              {/* Tabs with Icons - Single Line */}
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                flexWrap: 'wrap',
                marginBottom: '20px',
                paddingBottom: '12px',
                borderBottom: '2px solid #e9ecef'
              }}>
                <button
                  onClick={() => setActiveTab('LIVE')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    backgroundColor: activeTab === 'LIVE' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                    background: activeTab === 'LIVE' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
                    color: activeTab === 'LIVE' ? 'white' : '#666',
                  }}
                >
                  <span>📹</span>
                  <span>진행중</span>
                </button>
                <button
                  onClick={() => setActiveTab('SCHEDULED')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    backgroundColor: activeTab === 'SCHEDULED' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                    background: activeTab === 'SCHEDULED' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
                    color: activeTab === 'SCHEDULED' ? 'white' : '#666',
                  }}
                >
                  <span>📅</span>
                  <span>예약됨</span>
                </button>
                <button
                  onClick={() => setActiveTab('ENDED')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    backgroundColor: activeTab === 'ENDED' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                    background: activeTab === 'ENDED' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
                    color: activeTab === 'ENDED' ? 'white' : '#666',
                  }}
                >
                  <span>✅</span>
                  <span>종료됨</span>
                </button>
                <button
                  onClick={() => setActiveTab('VOD')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    backgroundColor: activeTab === 'VOD' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                    background: activeTab === 'VOD' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
                    color: activeTab === 'VOD' ? 'white' : '#666',
                  }}
                >
                  <span>🎬</span>
                  <span>VOD</span>
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
                  {/* Warning Banner for VOD Access */}
                  {vodAccessDenied && (
                    <div style={{
                      backgroundColor: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <span style={{ fontSize: '20px' }}>⚠️</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#856404', fontSize: '14px', marginBottom: '4px' }}>
                          기록 상태 확인 불가
                        </div>
                        <div style={{ color: '#856404', fontSize: '13px' }}>
                          강사 권한으로는 녹화 상태를 확인할 수 없습니다. 관리자에게 문의하세요.
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Meetings Table with Recording Status - Responsive */}
                  <div className="meetings-table" style={{ overflowX: 'auto' }}>
                    {filteredMeetings.length > 0 ? (
                      <>
                        {/* Desktop Table */}
                        <div style={{ display: screenWidth <= 768 && screenWidth > 0 ? 'none' : 'block' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>No.</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>회의 제목</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>회의시간</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>기록 상태</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredMeetings.map((meeting, index) => {
                                const hasRecording = vods.some(vod => vod.meetingId === meeting._id);
                                return (
                                  <tr key={meeting._id} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    <td style={{ padding: '12px' }}>{index + 1}</td>
                                    <td style={{ padding: '12px', fontWeight: '500' }}>{meeting.title}</td>
                                    <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>
                                      {formatDate(meeting.createdAt)}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                      {vodAccessDenied ? (
                                        <span
                                          style={{
                                            padding: '6px 12px',
                                            borderRadius: '20px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            backgroundColor: 'rgba(108, 117, 125, 0.1)',
                                            color: '#6c757d',
                                            border: '1px solid #6c757d',
                                            display: 'inline-block'
                                          }}
                                        >
                                          ⚠️ 확인 불가
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            padding: '6px 12px',
                                            borderRadius: '20px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            backgroundColor: hasRecording ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                                            color: hasRecording ? '#28a745' : '#dc3545',
                                            border: `1px solid ${hasRecording ? '#28a745' : '#dc3545'}`,
                                            display: 'inline-block'
                                          }}
                                        >
                                          {hasRecording ? '✅ 기록됨' : '❌ 기록 안됨'}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Card View */}
                        <div style={{ display: screenWidth <= 768 && screenWidth > 0 ? 'block' : 'none' }}>
                          {filteredMeetings.map((meeting, index) => {
                            const hasRecording = vods.some(vod => vod.meetingId === meeting._id);
                            return (
                              <div
                                key={meeting._id}
                                style={{
                                  backgroundColor: 'white',
                                  borderRadius: '12px',
                                  padding: '16px',
                                  marginBottom: '12px',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                  border: '1px solid #e9ecef'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                                  <div>
                                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>#{index + 1}</div>
                                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#333' }}>{meeting.title}</div>
                                  </div>
                                  <span
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: '20px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      backgroundColor: vodAccessDenied ? 'rgba(108, 117, 125, 0.1)' : (hasRecording ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)'),
                                      color: vodAccessDenied ? '#6c757d' : (hasRecording ? '#28a745' : '#dc3545'),
                                      border: `1px solid ${vodAccessDenied ? '#6c757d' : (hasRecording ? '#28a745' : '#dc3545')}`
                                    }}
                                  >
                                    {vodAccessDenied ? '⚠️' : (hasRecording ? '✅' : '❌')}
                                  </span>
                                </div>
                                <div style={{ fontSize: '13px', color: '#666' }}>
                                  📅 {formatDate(meeting.createdAt)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="empty-state">
                        <div className="empty-icon">✗</div>
                        <p>등록된 회의가 없습니다</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Meetings Table - Beautiful Design with SVG Icons */
                <div className="meetings-table" style={{ overflowX: 'auto' }}>
                  {filteredMeetings.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">✗</div>
                      <p>등록된 회의가 없습니다</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div style={{ display: screenWidth <= 768 && screenWidth > 0 ? 'none' : 'block' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>No.</th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>회의 제목</th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>회의시간</th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>상태</th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>초대코드</th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>강의코드</th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>비고</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMeetings.map((meeting, index) => (
                              <tr 
                                key={meeting._id}
                                style={{ 
                                  borderBottom: '1px solid #e9ecef',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                              >
                                <td style={{ padding: '12px', color: '#666' }}>{index + 1}</td>
                                <td style={{ padding: '12px', fontWeight: '500', color: '#333' }}>{meeting.title}</td>
                                <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                                  {meeting.schedule 
                                    ? formatDate(meeting.schedule)
                                    : formatDate(meeting.createdAt)
                                  }
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span 
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '20px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      color: 'white',
                                      background: meeting.status === 'LIVE' ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 
                                                 meeting.status === 'STARTED' ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' :
                                                 meeting.status === 'SCHEDULED' ? 'linear-gradient(135deg, #ffc107 0%, #ffb300 100%)' : 
                                                 meeting.status === 'ENDED' ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                                    }}
                                  >
                                    {meeting.status === 'LIVE' ? '🟢 진행중' :
                                     meeting.status === 'STARTED' ? '🟢 진행중' : 
                                     meeting.status === 'SCHEDULED' ? '⏰ 예정' : 
                                     meeting.status === 'ENDED' ? '✅ 종료' : '🟢 진행중'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span 
                                    className="invite-code"
                                    onClick={() => copyInviteCode(meeting.inviteCode)}
                                    style={{
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                      color: 'white',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'scale(1.05)';
                                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'scale(1)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                  >
                                    🔑 {meeting.inviteCode}
                                  </span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  {meeting.courseCode ? (
                                    <span 
                                      style={{
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                        color: 'white',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        display: 'inline-block'
                                      }}
                                    >
                                      📚 {meeting.courseCode}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#999', fontSize: '12px' }}>-</span>
                                  )}
                                </td>
                            <td>
                              <div className="actions">
                                {meeting.status === 'SCHEDULED' && (
                                  <>
                                    <button 
                                      onClick={() => handleStartMeeting(meeting._id)}
                                      style={{
                                        padding: '8px 16px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        background: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)',
                                        color: 'white',
                                        boxShadow: '0 4px 12px rgba(86, 171, 47, 0.3)',
                                        marginRight: '8px',
                                        transition: 'all 0.3s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(86, 171, 47, 0.4)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(86, 171, 47, 0.3)';
                                      }}
                                    >
                                      ▶️ 시작
                                    </button>
                                    <button 
                                      onClick={() => router.push(`/attendance/${meeting._id}`)}
                                      style={{
                                        padding: '8px 16px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                        color: 'white',
                                        boxShadow: '0 4px 12px rgba(79, 172, 254, 0.3)',
                                        transition: 'all 0.3s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(79, 172, 254, 0.4)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 172, 254, 0.3)';
                                      }}
                                    >
                                      📊 상세
                                    </button>
                                  </>
                                )}
                                {(meeting.status === 'LIVE' || meeting.status === 'STARTED') && (
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
                                        padding: '8px 16px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                                        marginRight: '8px',
                                        transition: 'all 0.3s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                                      }}
                                    >
                                      🎥 참여
                                    </button>
                                    <button 
                                      onClick={() => handleEndMeeting(meeting._id)}
                                      style={{
                                        padding: '8px 16px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                        color: 'white',
                                        boxShadow: '0 4px 12px rgba(245, 87, 108, 0.3)',
                                        marginRight: '8px',
                                        transition: 'all 0.3s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 87, 108, 0.4)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 87, 108, 0.3)';
                                      }}
                                    >
                                      ⛔ 종료
                                    </button>
                                    <button 
                                      onClick={() => router.push(`/attendance/${meeting._id}`)}
                                      style={{
                                        padding: '8px 16px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                        color: 'white',
                                        boxShadow: '0 4px 12px rgba(79, 172, 254, 0.3)',
                                        transition: 'all 0.3s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(79, 172, 254, 0.4)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 172, 254, 0.3)';
                                      }}
                                    >
                                      📊 상세
                                    </button>
                                  </>
                                )}
                                {meeting.status === 'ENDED' && (
                                  <>
                                    <button 
                                      onClick={() => router.push(`/attendance/${meeting._id}`)}
                                      style={{
                                        padding: '8px 16px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                                        transition: 'all 0.3s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                                      }}
                                    >
                                      📊 출석 현황
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                      </div>

                      {/* Mobile Card View */}
                      <div style={{ display: screenWidth <= 768 && screenWidth > 0 ? 'block' : 'none' }}>
                        {filteredMeetings.map((meeting, index) => (
                          <div
                            key={meeting._id}
                            style={{
                              backgroundColor: 'white',
                              borderRadius: '16px',
                              padding: '16px',
                              marginBottom: '12px',
                              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                              border: '1px solid #e9ecef',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
                            }}
                          >
                                                         {/* Header */}
                             <div style={{ marginBottom: '12px' }}>
                               <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>#{index + 1}</div>
                               <div style={{ fontWeight: '600', fontSize: '16px', color: '#333', marginBottom: '8px' }}>
                                 {meeting.title}
                               </div>
                               <div style={{ fontSize: '13px', color: '#666' }}>
                                 📅 {meeting.schedule ? formatDate(meeting.schedule) : formatDate(meeting.createdAt)}
                               </div>
                             </div>

                            {/* Invite Code */}
                            <div style={{ marginBottom: '12px' }}>
                              <span 
                                onClick={() => copyInviteCode(meeting.inviteCode)}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  color: 'white',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                🔑 {meeting.inviteCode}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {meeting.status === 'SCHEDULED' && (
                                <>
                                  <button 
                                    onClick={() => handleStartMeeting(meeting._id)}
                                    style={{
                                      padding: '8px 16px',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      background: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)',
                                      color: 'white',
                                      flex: 1,
                                      minWidth: '120px'
                                    }}
                                  >
                                    ▶️ 시작
                                  </button>
                                  <button 
                                    onClick={() => router.push(`/attendance/${meeting._id}`)}
                                    style={{
                                      padding: '8px 16px',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                      color: 'white',
                                      flex: 1,
                                      minWidth: '120px'
                                    }}
                                  >
                                    📊 상세
                                  </button>
                                </>
                              )}
                              {(meeting.status === 'LIVE' || meeting.status === 'STARTED') && (
                                <>
                                  <button 
                                    onClick={() => {
                                      if (isValidObjectId(meeting._id)) {
                                        window.location.href = `/prejoin/${meeting._id}`;
                                      }
                                    }}
                                    style={{
                                      padding: '8px 16px',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                      color: 'white',
                                      flex: 1,
                                      minWidth: '120px'
                                    }}
                                  >
                                    🎥 참여
                                  </button>
                                  <button 
                                    onClick={() => handleEndMeeting(meeting._id)}
                                    style={{
                                      padding: '8px 16px',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                      color: 'white',
                                      flex: 1,
                                      minWidth: '120px'
                                    }}
                                  >
                                    ⛔ 종료
                                  </button>
                                  <button 
                                    onClick={() => router.push(`/attendance/${meeting._id}`)}
                                    style={{
                                      padding: '8px 16px',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                      color: 'white',
                                      flex: 1,
                                      minWidth: '120px'
                                    }}
                                  >
                                    📊 상세
                                  </button>
                                </>
                              )}
                              {meeting.status === 'ENDED' && (
                                <button 
                                  onClick={() => router.push(`/attendance/${meeting._id}`)}
                                  style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    width: '100%'
                                  }}
                                >
                                  📊 출석 현황
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
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
