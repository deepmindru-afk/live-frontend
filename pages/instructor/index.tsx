import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser, testAuthStatus, forceLogin, showErrorAlert, getAuthToken } from '../../lib/simple-auth-handlers';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { CREATE_MEETING, START_MEETING, END_MEETING, CreateMeetingInput, CreateMeetingResponse } from '../../apollo/meeting/mutations';
import { GET_TUTOR_MEETINGS, GET_ALL_MEETINGS, GET_MEETING_STATS } from '../../apollo/meeting/queries';
import { GET_VODS } from '../../apollo/vod/queries';
import { CREATE_VOD, UPDATE_VOD, DELETE_VOD, UPLOAD_VOD_FILE, CREATE_VOD_FROM_URL } from '../../apollo/vod/mutations';
import { handleLogout } from '../../lib/simple-auth-handlers';
import Swal from 'sweetalert2';
import { isValidObjectId } from '../../lib/validation';
import ThemeToggle from '../../components/ThemeToggle';
import { useTheme } from '../../lib/theme-context';

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
  meetingId?: string;
  source?: string;
  storageKey?: string;
  size: number;
  sizeBytes?: number;
  duration?: number;
  durationSec?: number;
  url?: string;
  filePath?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR';
  meeting?: {
    _id?: string;
    inviteCode?: string;
  };
}

const Dashboard: React.FC = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LIVE' | 'SCHEDULED' | 'ENDED' | 'VOD'>('LIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const [isSchedulePickerActive, setIsSchedulePickerActive] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [classMaterialFile, setClassMaterialFile] = useState<File | null>(null);
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
  const materialInputRef = useRef<HTMLInputElement>(null);
  
  // Screen width for responsive design
  const [screenWidth, setScreenWidth] = useState<number>(0);
  const PAGE_SIZE = 15;
  const [currentPage, setCurrentPage] = useState<number>(1);

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
        await loadVODs();
        return;
      }
      
      // Get current user info
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?._id;
      
      if (!currentUserId) {
        setMeetings([]);
        await loadVODs();
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
          await loadVODs();
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
          await loadVODs();
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
      await loadVODs();
      
    } catch (error: any) {
      
      // For ALL errors, just show empty state - don't redirect
      setMeetings([]);
      await loadVODs();
    }
  };

  const uploadMeetingMaterial = async (meetingId: string, file: File) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const formData = new FormData();
    formData.append('material', file);

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}/meeting-materials/${meetingId}`, {
      method: 'POST',
      headers,
      body: formData,
    }).catch((error) => {
      throw new Error(`자료 업로드 요청에 실패했습니다: ${error.message}`);
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        errorText || '수업 자료 업로드에 실패했습니다. 나중에 다시 시도해주세요.',
      );
    }

    return response.json().catch(() => ({}));
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

          let successMessage = '방이 성공적으로 생성되었습니다!';

          if (classMaterialFile) {
            try {
              await uploadMeetingMaterial(newMeeting._id, classMaterialFile);
              successMessage += '\n선택한 수업 자료도 함께 업로드되었습니다.';
            } catch (materialError: any) {
              const materialErrorMessage = materialError?.message || '수업 자료 업로드에 실패했습니다.';
              successMessage += `\n단, 자료 업로드 중 문제가 발생했습니다: ${materialErrorMessage}`;
            } finally {
              setClassMaterialFile(null);
              if (materialInputRef.current) {
                materialInputRef.current.value = '';
              }
            }
          }

          await Swal.fire({
            icon: 'success',
            title: '성공',
            text: successMessage,
            confirmButtonText: '확인'
          });

          // Clear form
          setNewMeetingTitle('');
      setMeetingSchedule('');
      setIsSchedulePickerActive(false);
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
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  // VOD Functions
  const loadVODs = useCallback(async () => {
    try {
      const result = await enhancedMakeGraphQLRequest(GET_VODS, {
        input: { limit: 50, offset: 0 }
      });

      if (result && result.getAllVods && Array.isArray(result.getAllVods.vods)) {
        setVodAccessDenied(false);
        setVods(result.getAllVods.vods);
      } else {
        setVodAccessDenied(false);
        setVods([]);
      }
    } catch (error: any) {
      const message: string | undefined = error?.message;
      const status: number | undefined = error?.status;

      if (
        message?.includes('ONLY_SPECIFIC_ROLES_ALLOWED') ||
        message?.includes('Only the meeting host can view recording info') ||
        message?.includes('Authentication') ||
        message?.includes('TOKEN_NOT_EXIST') ||
        status === 403
      ) {
        setVodAccessDenied(true);
        setVods([]);
        return;
      }

      if (status === 400 || status === 500) {
        setVodAccessDenied(false);
        setVods([]);
        return;
      }

      setVodAccessDenied(false);
      setVods([]);
    }
  }, []);

  // Load VODs when VOD tab is selected
  useEffect(() => {
    if (activeTab === 'VOD') {
      loadVODs();
    }
  }, [activeTab, loadVODs]);

  // Refresh VODs when recording completes (triggered via localStorage flag)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const STORAGE_KEY = 'hrde_vod_sync';

    const refreshFromStorage = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return;
        }

        // Remove flag immediately to avoid duplicate reloads
        window.localStorage.removeItem(STORAGE_KEY);

        // Fire-and-forget refresh; await is unnecessary in event handler
        loadVODs();
      } catch (error) {
      }
    };

    // Check immediately on mount (handles same-tab navigation return)
    refreshFromStorage();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        refreshFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadVODs]);

  const normalizeId = (id: unknown): string => {
    if (id === null || id === undefined) return '';
    if (typeof id === 'string') return id.trim();
    return String(id).trim();
  };

  const getVodsForMeeting = (meetingId: string) => {
    const normalizedMeetingId = normalizeId(meetingId);
    if (!normalizedMeetingId) return [];

    return vods.filter((vod) => {
      const candidateIds = [
        normalizeId(vod.meetingId),
        normalizeId((vod as any)?.meeting_id),
        normalizeId((vod as any)?.meetingID),
        normalizeId(vod.meeting?._id),
        normalizeId((vod as any)?.meeting?._id),
        normalizeId((vod as any)?.meeting?.id),
        normalizeId((vod as any)?.meeting?.meetingId),
      ];
      return candidateIds.some(
        (candidateId) => candidateId && candidateId === normalizedMeetingId
      );
    });
  };

  const getRecordingBadge = (meetingId: string) => {
    if (vodAccessDenied) {
      return {
        className: 'chip chip--muted',
        label: '확인 불가'
      };
    }

    const matchedVods = getVodsForMeeting(meetingId);

    if (matchedVods.length === 0) {
      return {
        className: 'chip chip--danger',
        label: '기록 없음'
      };
    }

    const hasReadyVod = matchedVods.some((vod) => vod.status === 'READY');
    const hasProcessingVod = matchedVods.some(
      (vod) => vod.status === 'UPLOADING' || vod.status === 'PROCESSING'
    );

    if (hasReadyVod) {
      return {
        className: 'chip chip--success',
        label: '기록됨'
      };
    }

    if (hasProcessingVod) {
      return {
        className: 'chip chip--muted',
        label: '처리중'
      };
    }

    return {
      className: 'chip chip--success',
      label: '기록됨'
    };
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

  const totalItems = filteredMeetings.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const baseIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE;
  const pageStart = totalItems === 0 ? 0 : baseIndex + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(totalItems, baseIndex + PAGE_SIZE);
  const paginatedMeetings = filteredMeetings.slice(baseIndex, baseIndex + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(prev => {
      const nextPage = Math.min(Math.max(page, 1), totalPages);
      return nextPage === prev ? prev : nextPage;
    });
  };

  const filteredVODs = vods.filter(vod =>
    !searchQuery || vod.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const searchResultsCount = activeTab === 'VOD' ? filteredVODs.length : filteredMeetings.length;

  const getStatusBadge = (status: Meeting['status']) => {
    switch (status) {
      case 'LIVE':
      case 'STARTED':
        return { label: '진행중', className: 'status-badge status-badge--live' };
      case 'SCHEDULED':
        return { label: '예약됨', className: 'status-badge status-badge--scheduled' };
      case 'ENDED':
      default:
        return { label: '종료', className: 'status-badge status-badge--ended' };
    }
  };

  const pagination = totalItems > 0 ? (
    <div className="pagination-bar">
      <span className="pagination-info">
        {pageStart}-{pageEnd} of {totalItems}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className={`pagination-button ${safeCurrentPage === 1 ? 'disabled' : ''}`}
          onClick={() => handlePageChange(1)}
          disabled={safeCurrentPage === 1}
        >
          «
        </button>
        <button
          type="button"
          className={`pagination-button ${safeCurrentPage === 1 ? 'disabled' : ''}`}
          onClick={() => handlePageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
        >
          ‹
        </button>
        <button
          type="button"
          className={`pagination-button ${safeCurrentPage === totalPages ? 'disabled' : ''}`}
          onClick={() => handlePageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages}
        >
          ›
        </button>
        <button
          type="button"
          className={`pagination-button ${safeCurrentPage === totalPages ? 'disabled' : ''}`}
          onClick={() => handlePageChange(totalPages)}
          disabled={safeCurrentPage === totalPages}
        >
          »
        </button>
      </div>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  const displayName =
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.nickname ||
    user?.username ||
    (user?.email ? user.email.split('@')[0] : '강사');

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
          <div className="theme-toggle-wrapper">
            <ThemeToggle />
          </div>
          <div
            className="dashboard-header-logo"
            onClick={() => router.push('/dashboard')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                router.push('/dashboard');
              }
            }}
          >
            <Image
              src={theme === 'dark' ? '/darkMode.png' : '/mainLogo.png'}
              alt="HRDe Live"
              width={120}
              height={40}
              className="dashboard-header-logo-image"
            />
          </div>
          <div className="dashboard-header-greeting">
            <div className="dashboard-header-pill">
              <span className="dashboard-header-pill-text">
                {`${displayName}님, 안녕하세요 👋`}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="dashboard-header-logout"
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
          >
            <svg
              className="dashboard-header-logout-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
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

            {/* Create Room Panel */}
            <div className="action-panel create-room">
              <div className="panel-header">
                <div className="icon-wrapper">
                  <Image
                    src="/Icons/dashboard/Vector.svg"
                    alt="Create meeting"
                    width={20}
                    height={20}
                  />
                </div>
                <div className="text-group">
                  <h3>방 만들기</h3>
                  <p>LIVE방을 생성합니다.</p>
                </div>
              </div>

              <label htmlFor="meeting-title">
                방 제목 *
              </label>
              <input
                id="meeting-title"
                type="text"
                placeholder="방 제목"
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
              />

              <label htmlFor="course-code">
                강의코드 (선택)
              </label>
              <input
                id="course-code"
                type="text"
                placeholder="강의코드"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase' }}
              />

              <div className="file-upload-section">
                <label htmlFor="class-material-upload">
                  수업자료 업로드 (선택)
                </label>
                <input
                  id="class-material-upload"
                  ref={materialInputRef}
                  type="file"
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.xlsx,.xls,.zip,.png,.jpg,.jpeg"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setClassMaterialFile(file);
                    } else {
                      setClassMaterialFile(null);
                    }
                  }}
                />
                <div className="file-upload-controls">
                  <button
                    type="button"
                    className="file-select-btn"
                    onClick={() => materialInputRef.current?.click()}
                  >
                    파일선택
                  </button>
                  <span
                    className="file-name"
                    title={classMaterialFile?.name || ''}
                  >
                    {classMaterialFile ? classMaterialFile.name : '선택된 파일 없음'}
                  </span>
                  {classMaterialFile && (
                    <button
                      type="button"
                      className="file-remove-btn"
                      onClick={() => {
                        setClassMaterialFile(null);
                        if (materialInputRef.current) {
                          materialInputRef.current.value = '';
                        }
                      }}
                    >
                      제거
                    </button>
                  )}
                </div>
                <p className="file-upload-info">
                  PDF, 문서, 이미지 등 25MB까지 업로드 가능합니다.
                </p>
              </div>

              <button
                onClick={handleCreateMeeting}
                className="create-btn"
              >
                생성하기
              </button>
            </div>

            {/* Schedule Panel */}
            <div className="action-panel schedule">
              <div className="panel-header">
                <div className="icon-wrapper">
                  <Image
                    src="/Icons/dashboard/scheduleMeet.svg"
                    alt="예약하기"
                    width={48}
                    height={48}
                  />
                </div>
                <div className="text-group">
                  <h3>예약하기</h3>
                  <p>원하는 시간에 회의를 할 수 있습니다</p>
                </div>
              </div>
              <div className="input-group">
                <input
                  type={isSchedulePickerActive || meetingSchedule ? 'datetime-local' : 'text'}
                  lang="ko-KR"
                  placeholder="연도-월-일  --:--"
                  value={meetingSchedule}
                  onChange={(e) => setMeetingSchedule(e.target.value)}
                  onFocus={() => setIsSchedulePickerActive(true)}
                  onBlur={(e) => {
                    if (!e.target.value) {
                      setIsSchedulePickerActive(false);
                    }
                  }}
                />
              </div>
              <button 
                className="schedule-action-btn"
                onClick={handleCreateMeeting}
              >
                예약하기
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="dashboard-main">
            <div className="meetings-panel">
              {/* Tabs with Icons - Single Line */}
              <div className="tabs-container">
                <button
                  onClick={() => setActiveTab('LIVE')}
                  className={`tab-button ${activeTab === 'LIVE' ? 'active' : ''}`}
                >
                  <span>진행중</span>
                </button>
                <button
                  onClick={() => setActiveTab('SCHEDULED')}
                  className={`tab-button ${activeTab === 'SCHEDULED' ? 'active' : ''}`}
                >
                  <span>예약됨</span>
                </button>
                <button
                  onClick={() => setActiveTab('ENDED')}
                  className={`tab-button ${activeTab === 'ENDED' ? 'active' : ''}`}
                >
                  <span>종료됨</span>
                </button>
                <button
                  onClick={() => setActiveTab('VOD')}
                  className={`tab-button ${activeTab === 'VOD' ? 'active' : ''}`}
                >
                  <span>VOD</span>
                </button>
              </div>

              {/* Search */}
              <div className="search-bar">
                <div className="search-meta">
                  <span className="search-meta-label">총</span>
                  <span className="search-meta-count">{searchResultsCount.toLocaleString()}</span>
                </div>
                <div className="search-input-wrapper">
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
                    type="button"
                  >
                    <Image
                      src="/Icons/dashboard/searchLoop.svg"
                      alt="검색"
                      width={16}
                      height={16}
                    />
                  </button>
                </div>
              </div>

              {/* Content based on active tab */}
              {activeTab === 'VOD' ? (
                /* VOD Management Section */
                <div>
                  {/* Warning Banner for VOD Access */}
                  {vodAccessDenied && (
                    <div className="warning-banner">
                      <span className="warning-icon">⚠️</span>
                      <div className="warning-content">
                        <div className="warning-title">
                          기록 상태 확인 불가
                        </div>
                        <div className="warning-text">
                          강사 권한으로는 녹화 상태를 확인할 수 없습니다. 관리자에게 문의하세요.
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Meetings Table with Recording Status - Responsive */}
                  <div className="meetings-table" style={{ overflowX: 'auto' }}>
                    {totalItems > 0 ? (
                      <>
                        {/* Desktop Table */}
                        <div style={{ display: screenWidth <= 768 && screenWidth > 0 ? 'none' : 'block' }}>
                          <div className="table-shell table-shell--compact">
                            <table className="modern-table modern-table--compact">
                              <thead>
                                <tr>
                                  <th>No.</th>
                                  <th>회의 제목</th>
                                  <th>회의시간</th>
                                  <th>기록 상태</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedMeetings.map((meeting, index) => {
                                  const { className: recordingClass, label: recordingLabel } = getRecordingBadge(meeting._id);
                                  const rowNumber = baseIndex + index + 1;

                                  return (
                                    <tr key={meeting._id}>
                                      <td className="modern-table__cell modern-table__cell--number">{rowNumber}</td>
                                      <td className="modern-table__cell modern-table__cell--title">
                                        <span className="meeting-title-text">{meeting.title}</span>
                                      </td>
                                      <td className="modern-table__cell modern-table__cell--time">
                                        <span className="muted-text">{formatDate(meeting.createdAt)}</span>
                                      </td>
                                      <td className="modern-table__cell modern-table__cell--status">
                                        <span className={recordingClass}>{recordingLabel}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Mobile Card View */}
                        <div style={{ display: screenWidth <= 768 && screenWidth > 0 ? 'block' : 'none' }}>
                          {paginatedMeetings.map((meeting, index) => {
                            const { className, label } = getRecordingBadge(meeting._id);
                            const recordingClass = `${className} chip--tight mobile-meeting-card__badge`;
                            const recordingLabel = label;
                            const rowNumber = baseIndex + index + 1;

                            return (
                              <div key={meeting._id} className="mobile-meeting-card">
                                <div className="mobile-meeting-card__header">
                                  <div>
                                    <div className="mobile-meeting-card__index">#{rowNumber}</div>
                                    <div className="mobile-meeting-card__title">{meeting.title}</div>
                                  </div>
                                  <span className={recordingClass}>{recordingLabel}</span>
                                </div>
                                <div className="mobile-meeting-card__meta">
                                  <span>📅 {formatDate(meeting.createdAt)}</span>
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
                    {pagination}
                  </div>
                </div>
              ) : (
                /* Meetings Table - Beautiful Design with SVG Icons */
                <div className="meetings-table" style={{ overflowX: 'auto' }}>
                  {totalItems === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">✗</div>
                      <p>등록된 회의가 없습니다</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div style={{ display: screenWidth <= 768 && screenWidth > 0 ? 'none' : 'block' }}>
                        <div className="table-shell">
                          <table className="modern-table">
                            <thead>
                              <tr>
                                <th>No.</th>
                                <th>회의 제목</th>
                                <th>회의시간</th>
                                <th>상태</th>
                                <th>초대코드</th>
                                <th>강의코드</th>
                                <th>비고</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedMeetings.map((meeting, index) => {
                                const statusInfo = getStatusBadge(meeting.status);
                                const meetingDate = meeting.schedule ? formatDate(meeting.schedule) : formatDate(meeting.createdAt);
                                const rowNumber = baseIndex + index + 1;

                                return (
                                  <tr key={meeting._id}>
                                    <td className="modern-table__cell modern-table__cell--number">{rowNumber}</td>
                                    <td className="modern-table__cell modern-table__cell--title">
                                      <span className="meeting-title-text">{meeting.title}</span>
                                    </td>
                                    <td className="modern-table__cell modern-table__cell--time">
                                      <span className="muted-text">{meetingDate}</span>
                                    </td>
                                    <td className="modern-table__cell modern-table__cell--status">
                                      <span className={statusInfo.className}>{statusInfo.label}</span>
                                    </td>
                                    <td className="modern-table__cell modern-table__cell--code">
                                      <button
                                        type="button"
                                        className="chip chip--invite"
                                        onClick={() => copyInviteCode(meeting.inviteCode)}
                                      >
                                        <span className="chip__label">{meeting.inviteCode}</span>
                                      </button>
                                    </td>
                                    <td className="modern-table__cell modern-table__cell--code">
                                      {meeting.courseCode ? (
                                        <span className="chip chip--course">
                                          <span className="chip__label">{meeting.courseCode}</span>
                                        </span>
                                      ) : (
                                        <span className="chip chip--muted">없음</span>
                                      )}
                                    </td>
                            <td className="modern-table__cell modern-table__cell--actions">
                              <div className="actions">
                                {meeting.status === 'SCHEDULED' && (
                                  <>
                                    <button 
                                      onClick={() => handleStartMeeting(meeting._id)}
                                      className="action-btn btn-start"
                                    >
                                      시작
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
                                      className="action-btn btn-join"
                                    >
                                      참여
                                    </button>
                                    <button 
                                      onClick={() => handleEndMeeting(meeting._id)}
                                      className="action-btn btn-end"
                                    >
                                      종료
                                    </button>
                                  </>
                                )}
                                {meeting.status === 'ENDED' && (
                                  <>
                                    <button 
                                      onClick={() => router.push(`/attendance/${meeting._id}`)}
                                      className="action-btn btn-attendance"
                                    >
                                      출석 현황
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>
                </div>

                      {/* Mobile Card View */}
                      <div style={{ display: screenWidth <= 768 && screenWidth > 0 ? 'block' : 'none' }}>
                        {paginatedMeetings.map((meeting, index) => {
                          const statusInfo = getStatusBadge(meeting.status);
                          const meetingDate = meeting.schedule ? formatDate(meeting.schedule) : formatDate(meeting.createdAt);
                          const rowNumber = baseIndex + index + 1;
                          return (
                            <div key={meeting._id} className="mobile-meeting-card">
                              <div className="mobile-meeting-card__header">
                                <div>
                                  <div className="mobile-meeting-card__index">#{rowNumber}</div>
                                  <div className="mobile-meeting-card__title">{meeting.title}</div>
                                </div>
                                <span className={`${statusInfo.className} chip--tight mobile-meeting-card__badge`}>
                                  {statusInfo.label}
                                </span>
                              </div>

                              <div className="mobile-meeting-card__meta">
                                <span>📅 {meetingDate}</span>
                                {meeting.courseCode && (
                                  <span className="chip chip--course chip--tight">
                                    <span className="chip__label">{meeting.courseCode}</span>
                                  </span>
                                )}
                              </div>

                              <div className="mobile-meeting-card__meta" style={{ gap: '0.6rem' }}>
                                <button
                                  type="button"
                                  className="chip chip--invite chip--tight"
                                  onClick={() => copyInviteCode(meeting.inviteCode)}
                                >
                                  <span className="chip__label">{meeting.inviteCode}</span>
                                </button>
                              </div>

                              <div className="mobile-meeting-card__actions">
                              {meeting.status === 'SCHEDULED' && (
                                <>
                                  <button 
                                    onClick={() => handleStartMeeting(meeting._id)}
                                    className="action-btn btn-start"
                                  >
                                    시작
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
                                    className="action-btn btn-join"
                                  >
                                    참여
                                  </button>
                                  <button 
                                    onClick={() => handleEndMeeting(meeting._id)}
                                    className="action-btn btn-end"
                                  >
                                    종료
                                  </button>
                                </>
                              )}
                              {meeting.status === 'ENDED' && (
                                <button 
                                  onClick={() => router.push(`/attendance/${meeting._id}`)}
                                  className="action-btn btn-attendance"
                                  style={{ width: '100%' }}
                                >
                                  출석 현황
                                </button>
                              )}
                            </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {pagination}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>파일 업로드</h2>
            <div className="modal-input-section">
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
                className="modal-file-button"
              >
                {selectedFile ? selectedFile.name : '파일을 선택하세요'}
              </button>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setShowUploadModal(false)}
                className="btn-cancel"
              >
                취소
              </button>
              <button
                onClick={uploadFile}
                disabled={!selectedFile}
                className="btn-primary"
              >
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
            <div className="modal-input-section">
              <label className="modal-label">
                VOD 제목
              </label>
              <input
                type="text"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="VOD 제목을 입력하세요"
                className="modal-input modal-input--spaced"
              />
              <label className="modal-label">
                URL
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="VOD URL을 입력하세요"
                className="modal-input"
              />
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setShowURLModal(false)}
                className="btn-cancel"
              >
                취소
              </button>
              <button
                onClick={uploadFromURL}
                className="btn-primary"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOD Menu Dropdown */}
      {showVODMenu && selectedVOD && (
        <div className="vod-menu-overlay" onClick={closeVODMenu}>
          <div 
            className="vod-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vod-menu-header">
              {selectedVOD.title}
            </div>
            
            <button
              onClick={() => deleteVOD(selectedVOD._id)}
              className="vod-menu-item"
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
