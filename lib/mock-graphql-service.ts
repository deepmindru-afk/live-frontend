// Mock GraphQL service to simulate missing backend meeting functionality
// This provides the missing meeting mutations and queries that the backend doesn't have

import { print } from 'graphql';
// Import will be done dynamically to avoid circular dependency

interface MockMeeting {
  _id: string;
  title: string;
  status: 'STARTED' | 'SCHEDULED' | 'ENDED';
  schedule?: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  duration?: number;
  hostId: string;
  isPrivate?: boolean;
  notes?: string;
}

// In-memory storage for mock meetings - using real meeting data from backend
let mockMeetings: MockMeeting[] = [
  {
    _id: '68cb9c9cd2d6ea30031d018a',
    title: 'meeting',
    status: 'STARTED',
    inviteCode: 'PYNALUPQ',
    createdAt: '2025-09-18T05:46:04.097Z',
    updatedAt: '2025-09-19T00:43:57.895Z',
    participantCount: 0,
    duration: 3600,
    hostId: 'current-user',
    isPrivate: false,
    notes: 'Real meeting from backend'
  },
  {
    _id: '68cb8e150d96a87a2d5f58e4',
    title: 'here is',
    status: 'STARTED',
    inviteCode: 'JV9CW0CN',
    createdAt: '2025-09-18T04:44:05.894Z',
    updatedAt: '2025-09-19T00:43:57.895Z',
    participantCount: 0,
    hostId: 'current-user',
    isPrivate: false,
    notes: 'Real meeting from backend'
  },
  {
    _id: '68cb734d0d96a87a2d5f5803',
    title: 'Scheduled Team Meeting',
    status: 'STARTED',
    inviteCode: 'LNZ8A1ET',
    createdAt: '2025-09-18T02:49:49.399Z',
    updatedAt: '2025-09-19T00:43:57.895Z',
    participantCount: 0,
    hostId: 'current-user',
    isPrivate: false,
    notes: 'Real meeting from backend'
  },
  {
    _id: '68ca40f6638593a6ba193d54',
    title: 'Video Room Test Meeting',
    status: 'STARTED',
    inviteCode: '9NRA56HS',
    createdAt: '2025-09-17T05:02:46.877Z',
    updatedAt: '2025-09-19T00:43:57.895Z',
    participantCount: 0,
    hostId: 'current-user',
    isPrivate: false,
    notes: 'Real meeting from backend'
  },
  {
    _id: '68ca3f2b638593a6ba193d47',
    title: 'this is my meeting',
    status: 'STARTED',
    inviteCode: 'DTFWAQZ7',
    createdAt: '2025-09-17T04:55:07.175Z',
    updatedAt: '2025-09-19T00:43:57.895Z',
    participantCount: 0,
    hostId: 'current-user',
    isPrivate: false,
    notes: 'Real meeting from backend'
  },
  {
    _id: '68ca3ee5638593a6ba193d3e',
    title: 'Test Meeting for Auto-Redirect',
    status: 'STARTED',
    inviteCode: 'HJLMLCQ7',
    createdAt: '2025-09-17T04:53:57.332Z',
    updatedAt: '2025-09-19T00:43:57.895Z',
    participantCount: 0,
    hostId: 'current-user',
    isPrivate: false,
    notes: 'Real meeting from backend'
  },
  {
    _id: '68ca367d816edcdb0d1f8505',
    title: 'Test Host Data',
    status: 'STARTED',
    inviteCode: '6EZFB1ZF',
    createdAt: '2025-09-17T04:18:05.577Z',
    updatedAt: '2025-09-19T00:43:57.895Z',
    participantCount: 0,
    hostId: 'current-user',
    isPrivate: false,
    notes: 'Real meeting from backend'
  },
  {
    _id: '68ca2ea924ac8ec19bfc6f9b',
    title: 'Test Valid Date',
    status: 'SCHEDULED',
    schedule: '2025-12-25T15:30:00.000Z',
    inviteCode: 'S1MWMOXZ',
    createdAt: '2025-09-17T03:44:41.276Z',
    updatedAt: '2025-09-19T00:43:57.895Z',
    participantCount: 0,
    hostId: 'current-user',
    isPrivate: false,
    notes: 'Real meeting from backend'
  },
  {
    _id: '68ca2e9c24ac8ec19bfc6f97',
    title: 'Test Invalid Date Fixed',
    status: 'STARTED',
    inviteCode: '1AK19MQY',
    createdAt: '2025-09-17T03:44:28.573Z',
    updatedAt: '2025-09-19T00:43:57.895Z',
    participantCount: 0,
    hostId: 'current-user',
    isPrivate: false,
    notes: 'Real meeting from backend'
  },
  {
    _id: '68ca2e8624ac8ec19bfc6f93',
    title: 'this is delete?',
    status: 'STARTED',
    inviteCode: 'B5LV5X3Q',
    createdAt: '2025-09-17T03:44:06.558Z',
    updatedAt: '2025-09-19T00:43:57.895Z',
    participantCount: 0,
    hostId: 'current-user',
    isPrivate: false,
    notes: 'Real meeting from backend'
  }
];

// Generate unique invite code
function generateInviteCode(): string {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Check if a GraphQL query/mutation is a meeting-related operation
function isMeetingOperation(query: string): boolean {
  const meetingOperations = [
    'createMeeting',
    'startMeeting', 
    'endMeeting',
    'meetings',
    'getMyMeetings',
    'getAllMeetings',
    'getMeetings', // Add this to handle the actual query
    'getMeetingStats',
    'getMeeting',
    'rotateInviteCode',
    'joinMeetingByCode'
  ];
  
  return meetingOperations.some(op => query.includes(op));
}

// Mock GraphQL request handler
export async function mockGraphQLRequest(query: string, variables: any = {}) {

  // Handle createMeeting mutation
  if (query.includes('createMeeting')) {
    const { input } = variables;
    const newMeeting: MockMeeting = {
      _id: `mock-${Date.now()}`,
      title: input.title,
      status: input.scheduledFor ? 'SCHEDULED' : 'STARTED',
      schedule: input.scheduledFor,
      inviteCode: generateInviteCode(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      participantCount: 0,
      hostId: 'current-user',
      isPrivate: input.isPrivate || false,
      notes: input.notes
    };

    mockMeetings.unshift(newMeeting);

    return {
      createMeeting: {
        success: true,
        message: 'Meeting created successfully',
        meeting: {
          _id: newMeeting._id,
          title: newMeeting.title,
          status: newMeeting.status,
          schedule: newMeeting.schedule,
          inviteCode: newMeeting.inviteCode,
          createdAt: newMeeting.createdAt
        }
      }
    };
  }

  // Handle startMeeting mutation
  if (query.includes('startMeeting')) {
    const { meetingId } = variables;
    const meeting = mockMeetings.find(m => m._id === meetingId);
    
    if (meeting) {
      meeting.status = 'STARTED';
      meeting.updatedAt = new Date().toISOString();
      
      return {
        startMeeting: {
          success: true,
          message: 'Meeting started successfully',
          meeting: {
            _id: meeting._id,
            title: meeting.title,
            status: meeting.status,
            inviteCode: meeting.inviteCode,
            startedAt: new Date().toISOString()
          }
        }
      };
    }

    return {
      startMeeting: {
        success: false,
        message: 'Meeting not found'
      }
    };
  }

  // Handle endMeeting mutation
  if (query.includes('endMeeting')) {
    const { meetingId } = variables;
    const meeting = mockMeetings.find(m => m._id === meetingId);
    
    if (meeting) {
      meeting.status = 'ENDED';
      meeting.updatedAt = new Date().toISOString();
      meeting.duration = 3600; // Mock duration
      
      return {
        endMeeting: {
          success: true,
          message: 'Meeting ended successfully',
          meeting: {
            _id: meeting._id,
            title: meeting.title,
            status: meeting.status,
            endedAt: new Date().toISOString(),
            duration: meeting.duration
          }
        }
      };
    }

    return {
      endMeeting: {
        success: false,
        message: 'Meeting not found'
      }
    };
  }

  // Handle getMeetings query (for member dashboard)
  if (query.includes('getMeetings') && !query.includes('getMeetingStats')) {
    return {
      getMeetings: {
        total: mockMeetings.length,
        meetings: mockMeetings.map(meeting => ({
          _id: meeting._id,
          title: meeting.title,
          status: meeting.status,
          scheduledFor: meeting.schedule, // Map schedule to scheduledFor
          inviteCode: meeting.inviteCode,
          createdAt: meeting.createdAt,
          updatedAt: meeting.updatedAt,
          participantCount: meeting.participantCount,
          duration: meeting.duration,
          notes: meeting.notes,
          isPrivate: meeting.isPrivate,
          maxParticipants: 50 // Default max participants
        }))
      }
    };
  }

  // Handle meetings query (legacy)
  if (query.includes('meetings') && !query.includes('createMeeting') && !query.includes('getMeetings')) {
    return {
      meetings: mockMeetings.map(meeting => ({
        _id: meeting._id,
        title: meeting.title,
        status: meeting.status,
        schedule: meeting.schedule,
        inviteCode: meeting.inviteCode,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
        participantCount: meeting.participantCount,
        duration: meeting.duration
      }))
    };
  }

  // Handle getMeetingStats query
  if (query.includes('getMeetingStats')) {
    const totalMeetings = mockMeetings.length;
    const activeMeetings = mockMeetings.filter(m => m.status === 'STARTED').length;
    const scheduledMeetings = mockMeetings.filter(m => m.status === 'SCHEDULED').length;
    const endedMeetings = mockMeetings.filter(m => m.status === 'ENDED').length;
    const totalParticipants = mockMeetings.reduce((sum, m) => sum + m.participantCount, 0);
    const averageDuration = mockMeetings
      .filter(m => m.duration)
      .reduce((sum, m) => sum + (m.duration || 0), 0) / mockMeetings.filter(m => m.duration).length || 0;

    return {
      getMeetingStats: {
        totalMeetings,
        activeMeetings,
        scheduledMeetings,
        completedMeetings: endedMeetings,
        totalParticipants,
        averageMeetingDuration: averageDuration
      }
    };
  }

  // Handle rotateInviteCode mutation
  if (query.includes('rotateInviteCode')) {
    const { meetingId } = variables;
    const meeting = mockMeetings.find(m => m._id === meetingId);
    
    if (meeting) {
      meeting.inviteCode = generateInviteCode();
      meeting.updatedAt = new Date().toISOString();
      
      return {
        rotateInviteCode: {
          success: true,
          message: 'Invite code rotated successfully',
          inviteCode: meeting.inviteCode
        }
      };
    }

    return {
      rotateInviteCode: {
        success: false,
        message: 'Meeting not found'
      }
    };
  }

  // Handle joinMeetingByCode mutation
  if (query.includes('joinMeetingByCode')) {
    const { inviteCode } = variables;
    const meeting = mockMeetings.find(m => m.inviteCode === inviteCode);
    
    if (meeting) {
      return {
        joinMeetingByCode: {
          success: true,
          message: 'Successfully joined meeting',
          meeting: {
            _id: meeting._id,
            title: meeting.title,
            status: meeting.status,
            inviteCode: meeting.inviteCode
          },
          participant: {
            _id: 'participant-' + Date.now(),
            displayName: 'Test Participant',
            email: 'participant@example.com',
            joinedAt: new Date().toISOString()
          }
        }
      };
    }

    return {
      joinMeetingByCode: {
        success: false,
        message: 'Invalid invite code'
      }
    };
  }

  // Handle joinMeeting mutation
  if (query.includes('joinMeeting')) {
    const { meetingId } = variables;
    const meeting = mockMeetings.find(m => m._id === meetingId);
    
    if (meeting) {
      return {
        joinMeeting: {
          success: true,
          message: 'Successfully joined meeting',
          isHost: true, // Mock as host for demo
          participant: {
            _id: 'participant-' + Date.now(),
            displayName: 'Test Participant',
            email: 'participant@example.com'
          }
        }
      };
    }

    return {
      joinMeeting: {
        success: false,
        message: 'Meeting not found'
      }
    };
  }

  // Handle leaveMeeting mutation
  if (query.includes('leaveMeeting')) {
    const { meetingId } = variables;
    
    return {
      leaveMeeting: {
        success: true,
        message: 'Successfully left meeting'
      }
    };
  }

  // Handle getMeetingById query
  if (query.includes('getMeetingById(meetingId:') || query.includes('GetMeetingById')) {
    const { meetingId } = variables;
    
    // Try to find in mock meetings first
    const meeting = mockMeetings.find(m => m._id === meetingId);
    
    if (meeting) {
      return {
        getMeetingById: {
          _id: meeting._id,
          title: meeting.title,
          status: meeting.status,
          schedule: meeting.schedule,
          inviteCode: meeting.inviteCode,
          createdAt: meeting.createdAt,
          updatedAt: meeting.updatedAt,
          participantCount: meeting.participantCount,
          duration: meeting.duration,
          participants: [
            {
              _id: 'participant-1',
              displayName: 'Test Participant 1',
              email: 'participant1@example.com',
              isMuted: false,
              isCameraOff: false,
              joinedAt: new Date().toISOString(),
              isHost: true
            },
            {
              _id: 'participant-2',
              displayName: 'Test Participant 2',
              email: 'participant2@example.com',
              isMuted: true,
              isCameraOff: false,
              joinedAt: new Date().toISOString(),
              isHost: false
            }
          ]
        }
      };
    }

    // Meeting not found in mock data, try to fetch from real backend
    
    try {
      const { makeGraphQLRequest } = await import('./simple-auth-handlers');
      const { GET_MEETING_BY_ID } = await import('../apollo/meeting/queries');
      
      const realResult = await makeGraphQLRequest(GET_MEETING_BY_ID, { meetingId });
      
      if (realResult.getMeetingById) {
        return realResult;
      }
    } catch (error) {
    }

    // If real backend also fails, create a dynamic meeting
    
    return {
      getMeetingById: {
        _id: meetingId,
        title: 'New Meeting',
        status: 'STARTED', // Assume newly created meetings are ready to start
        schedule: null,
        inviteCode: 'NEW' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        participantCount: 0,
        duration: 3600,
        participants: []
      }
    };
  }

  // Handle chatHistory query
  if (query.includes('chatHistory')) {
    const { meetingId } = variables;
    
    return {
      chatHistory: [
        {
          _id: 'msg-1',
          message: '안녕하세요! 미팅에 오신 것을 환영합니다.',
          sender: {
            _id: 'host',
            displayName: '호스트'
          },
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          replyToMessageId: null
        },
        {
          _id: 'msg-2',
          message: '네, 안녕하세요!',
          sender: {
            _id: 'participant-1',
            displayName: '참여자 1'
          },
          createdAt: new Date(Date.now() - 1800000).toISOString(),
          replyToMessageId: null
        },
        {
          _id: 'msg-3',
          message: '오늘 미팅 주제는 무엇인가요?',
          sender: {
            _id: 'participant-2',
            displayName: '참여자 2'
          },
          createdAt: new Date(Date.now() - 900000).toISOString(),
          replyToMessageId: null
        }
      ]
    };
  }

  // Handle participantsByMeeting query
  if (query.includes('participantsByMeeting')) {
    // Return empty array - let real data come from backend
    return {
      participantsByMeeting: []
    };
  }

  // Handle participantStats query
  if (query.includes('participantStats')) {
    // Return empty stats - let real data come from backend
    return {
      participantStats: {
        totalParticipants: 0,
        averageAttendanceTime: 0,
        hostAttendanceTime: 0,
        longestAttendance: 0,
        shortestAttendance: 0
      }
    };
  }

  // Handle VOD operations - Updated to match new schema
  if (query.includes('getAllVods') || query.includes('GetAllVods')) {
    return {
      getAllVods: {
        vods: [
          {
            _id: 'vod-1',
            title: 'Sample VOD 1',
            meetingId: 'meeting-1',
            source: 'FILE',
            storageKey: 'vod-1.mp4',
            sizeBytes: 1024000000, // 1GB
            durationSec: 3600, // 1 hour
            notes: 'Sample VOD file',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            meeting: {
              _id: 'meeting-1',
              title: 'Sample Meeting 1',
              status: 'ENDED',
              inviteCode: 'ABC123'
            }
          },
          {
            _id: 'vod-2',
            title: 'Sample VOD 2',
            meetingId: 'meeting-2',
            source: 'URL',
            storageKey: 'https://example.com/vod2.mp4',
            sizeBytes: 512000000, // 512MB
            durationSec: 1800, // 30 minutes
            notes: 'Sample VOD URL',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            meeting: {
              _id: 'meeting-2',
              title: 'Sample Meeting 2',
              status: 'ENDED',
              inviteCode: 'DEF456'
            }
          }
        ],
        total: 2,
        hasMore: false
      }
    };
  }

  if (query.includes('createVodFromUrl')) {
    const { input } = variables;
    return {
      createVodFromUrl: {
        success: true,
        message: 'VOD URL이 성공적으로 등록되었습니다.',
        vod: {
          _id: 'vod-' + Date.now(),
          title: input.title,
          meetingId: null,
          source: 'URL',
          storageKey: input.url,
          sizeBytes: 0,
          durationSec: 0,
          notes: input.notes || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          meeting: null
        }
      }
    };
  }

  if (query.includes('uploadVodFile')) {
    const { input } = variables;
    return {
      uploadVodFile: {
        success: true,
        message: 'VOD 파일이 성공적으로 업로드되었습니다.',
        vod: {
          _id: 'vod-' + Date.now(),
          title: input.title,
          meetingId: null,
          source: 'FILE',
          storageKey: 'vod-' + Date.now() + '.mp4',
          sizeBytes: 1024000000, // Mock 1GB
          durationSec: 3600, // Mock 1 hour
          notes: input.notes || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          meeting: null
        }
      }
    };
  }

  if (query.includes('deleteVod')) {
    return {
      deleteVod: {
        success: true,
        message: 'VOD가 성공적으로 삭제되었습니다.'
      }
    };
  }

  // Handle member profile operations
  if (query.includes('updateProfile')) {
    const { input } = variables;
    return {
      updateProfile: {
        success: true,
        message: '프로필이 성공적으로 업데이트되었습니다.',
        user: {
          _id: 'user-123',
          displayName: input.displayName,
          email: 'member@example.com',
          department: input.department,
          phone: input.phone,
          avatarUrl: null,
          systemRole: 'MEMBER'
        }
      }
    };
  }

  if (query.includes('uploadProfileImage')) {
    return {
      uploadProfileImage: {
        success: true,
        message: '프로필 이미지가 성공적으로 업로드되었습니다.',
        user: {
          _id: 'user-123',
          displayName: 'Test Member',
          email: 'member@example.com',
          avatarUrl: 'https://example.com/avatar.jpg'
        }
      }
    };
  }

  if (query.includes('deleteProfileImage')) {
    return {
      deleteProfileImage: {
        success: true,
        message: '프로필 이미지가 성공적으로 삭제되었습니다.',
        user: {
          _id: 'user-123',
          displayName: 'Test Member',
          email: 'member@example.com',
          avatarUrl: null
        }
      }
    };
  }

  // Default response for unknown operations
  return {
    error: 'Unknown mock operation'
  };
}

// Enhanced makeGraphQLRequest function that uses real backend for all operations
export async function enhancedMakeGraphQLRequest(query: string | any, variables: any = {}) {
  // Convert GraphQL AST to string if needed
  let queryString = query;
  if (typeof query !== 'string') {
    queryString = print(query);
  }

  // ALWAYS use real backend - disable mock service to fix participant join issues
  
  // Import the real makeGraphQLRequest function
  const { makeGraphQLRequest } = await import('./simple-auth-handlers');
  return await makeGraphQLRequest(queryString, variables);
}
