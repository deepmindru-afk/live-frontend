// Mock GraphQL service to simulate missing backend meeting functionality
// This provides the missing meeting mutations and queries that the backend doesn't have

import { print } from 'graphql';

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

// In-memory storage for mock meetings
let mockMeetings: MockMeeting[] = [
  {
    _id: 'mock-1',
    title: '팀 미팅',
    status: 'STARTED',
    inviteCode: 'ABC123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participantCount: 5,
    duration: 3600,
    hostId: 'current-user',
    isPrivate: false
  },
  {
    _id: 'mock-2',
    title: '프로젝트 리뷰',
    status: 'SCHEDULED',
    schedule: new Date(Date.now() + 86400000).toISOString(),
    inviteCode: 'DEF456',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participantCount: 0,
    hostId: 'current-user',
    isPrivate: false
  },
  {
    _id: 'mock-3',
    title: '클라이언트 데모',
    status: 'ENDED',
    inviteCode: 'GHI789',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    participantCount: 10,
    duration: 7200,
    hostId: 'current-user',
    isPrivate: false
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
    'getMeetingStats',
    'getMeeting',
    'rotateInviteCode',
    'joinMeetingByCode'
  ];
  
  return meetingOperations.some(op => query.includes(op));
}

// Mock GraphQL request handler
export async function mockGraphQLRequest(query: string, variables: any = {}) {
  console.log('🎭 MOCK GRAPHQL: Handling mock request for:', query.substring(0, 100) + '...');
  console.log('🎭 MOCK GRAPHQL: Variables:', variables);

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

  // Handle meetings query
  if (query.includes('meetings') && !query.includes('createMeeting')) {
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
  if (query.includes('meeting(meetingId:') || query.includes('GetMeetingById')) {
    const { meetingId } = variables;
    const meeting = mockMeetings.find(m => m._id === meetingId);
    
    if (meeting) {
      return {
        meeting: {
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

    return {
      meeting: null
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
    const { meetingId } = variables;
    const meeting = mockMeetings.find(m => m._id === meetingId);
    
    if (meeting) {
      return {
        participantsByMeeting: [
          {
            _id: 'participant-1',
            displayName: '김철수',
            email: 'kim@example.com',
            joinedAt: '2025-01-15T09:00:00Z',
            leftAt: '2025-01-15T10:30:00Z',
            isHost: true,
            totalTime: 90
          },
          {
            _id: 'participant-2',
            displayName: '이영희',
            email: 'lee@example.com',
            joinedAt: '2025-01-15T09:15:00Z',
            leftAt: '2025-01-15T10:15:00Z',
            isHost: false,
            totalTime: 60
          },
          {
            _id: 'participant-3',
            displayName: '박민수',
            email: 'park@example.com',
            joinedAt: '2025-01-15T09:30:00Z',
            leftAt: '2025-01-15T10:00:00Z',
            isHost: false,
            totalTime: 30
          },
          {
            _id: 'participant-4',
            displayName: '정수진',
            email: 'jung@example.com',
            joinedAt: '2025-01-15T09:45:00Z',
            leftAt: '2025-01-15T10:45:00Z',
            isHost: false,
            totalTime: 60
          }
        ]
      };
    }

    return {
      participantsByMeeting: []
    };
  }

  // Handle participantStats query
  if (query.includes('participantStats')) {
    const { meetingId } = variables;
    
    return {
      participantStats: {
        totalParticipants: 4,
        averageAttendanceTime: 60, // minutes
        hostAttendanceTime: 90, // minutes
        longestAttendance: 90, // minutes
        shortestAttendance: 30 // minutes
      }
    };
  }

  // Handle VOD operations
  if (query.includes('vods') || query.includes('GetVODs')) {
    return {
      vods: [
        {
          _id: 'vod-1',
          title: 'Sample VOD 1',
          size: 1024000000, // 1GB
          duration: 3600, // 1 hour
          url: 'https://example.com/vod1.mp4',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'READY'
        },
        {
          _id: 'vod-2',
          title: 'Sample VOD 2',
          size: 512000000, // 512MB
          duration: 1800, // 30 minutes
          url: 'https://example.com/vod2.mp4',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'READY'
        }
      ]
    };
  }

  if (query.includes('createVODFromURL')) {
    const { url, title } = variables;
    return {
      createVODFromURL: {
        success: true,
        message: 'VOD URL이 성공적으로 등록되었습니다.',
        vod: {
          _id: 'vod-' + Date.now(),
          title: title,
          url: url,
          createdAt: new Date().toISOString(),
          status: 'READY'
        }
      }
    };
  }

  if (query.includes('uploadVODFile')) {
    const { title } = variables;
    return {
      uploadVODFile: {
        success: true,
        message: 'VOD 파일이 성공적으로 업로드되었습니다.',
        vod: {
          _id: 'vod-' + Date.now(),
          title: title,
          size: 1024000000, // Mock 1GB
          duration: 3600, // Mock 1 hour
          filePath: '/uploads/vod-' + Date.now() + '.mp4',
          createdAt: new Date().toISOString(),
          status: 'READY'
        }
      }
    };
  }

  if (query.includes('deleteVOD')) {
    return {
      deleteVOD: {
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

  // Always use the real backend now that meeting APIs are working
  console.log('🌐 REAL GRAPHQL: Using real backend for all operations');
  
  // Import the real makeGraphQLRequest function
  const { makeGraphQLRequest } = await import('./simple-auth-handlers');
  return await makeGraphQLRequest(queryString, variables);
}
