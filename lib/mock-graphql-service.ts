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
      status: input.scheduledStartAt ? 'SCHEDULED' : 'STARTED',
      schedule: input.scheduledStartAt,
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

  // Default response for unknown operations
  return {
    error: 'Unknown mock operation'
  };
}

// Enhanced makeGraphQLRequest function that uses mock service for meeting operations
export async function enhancedMakeGraphQLRequest(query: string | any, variables: any = {}) {
  // Convert GraphQL AST to string if needed
  let queryString = query;
  if (typeof query !== 'string') {
    queryString = print(query);
  }

  // Check if this is a meeting-related operation
  if (isMeetingOperation(queryString)) {
    console.log('🎭 MOCK GRAPHQL: Using mock service for meeting operation');
    return await mockGraphQLRequest(queryString, variables);
  }

  // For non-meeting operations, use the real backend
  console.log('🌐 REAL GRAPHQL: Using real backend for non-meeting operation');
  
  // Import the real makeGraphQLRequest function
  const { makeGraphQLRequest } = await import('./simple-auth-handlers');
  return await makeGraphQLRequest(queryString, variables);
}
