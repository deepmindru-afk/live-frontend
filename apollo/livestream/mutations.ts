import { gql } from '@apollo/client';

// Queries
export const GET_PARTICIPANTS_BY_MEETING = gql`
  query GetParticipantsByMeeting($meetingId: ID!) {
    getParticipantsByMeeting(meetingId: $meetingId) {
      _id
      displayName
      role
      micState
      cameraState
      user {
        _id
        email
        displayName
      }
    }
  }
`;

export const GET_WAITING_PARTICIPANTS = gql`
  query GetWaitingParticipants($meetingId: ID!) {
    getWaitingParticipants(meetingId: $meetingId) {
      _id
      displayName
      email
      status
      joinedAt
      avatarUrl
      micState
      cameraState
      socketId
    }
  }
`;

export const GET_CHAT_HISTORY = gql`
  query GetChatHistory($input: ChatHistoryInput!) {
    getChatHistory(input: $input) {
      messages {
        _id
        text
        displayName
        createdAt
      }
    }
  }
`;

export const GET_RAISED_HANDS = gql`
  query GetRaisedHands($input: GetRaisedHandsInput!) {
    getRaisedHands(input: $input) {
      raisedHands {
        participantId
        displayName
        hasHandRaised
        handRaisedAt
        handLoweredAt
        handRaiseDuration
        isWaitingForResponse
        reason
      }
      totalRaisedHands
      meetingId
      timestamp
    }
  }
`;

export const GET_PARTICIPANT_STATS = gql`
  query GetParticipantStats($meetingId: ID!) {
    getParticipantStats(meetingId: $meetingId) {
      totalParticipants
      currentlyOnline
      totalSessions
      averageSessionDuration
      totalMeetingDuration
    }
  }
`;

export const GET_CHAT_STATS = gql`
  query GetChatStats($meetingId: ID!) {
    getChatStats(meetingId: $meetingId) {
      totalMessages
      messagesToday
      activeUsers
      averageMessagesPerUser
    }
  }
`;

// Mutations
export const START_MEETING = gql`
  mutation StartMeeting($meetingId: ID!) {
    startMeeting(meetingId: $meetingId) {
      _id
      title
      status
      inviteCode
      isPrivate
      scheduledFor
      actualStartAt
      endedAt
      durationMin
      notes
      participantCount
      createdAt
      updatedAt
      hostId
      host {
        _id
        email
        displayName
        systemRole
        avatarUrl
        department
        organization
      }
    }
  }
`;

export const END_MEETING = gql`
  mutation EndMeeting($meetingId: ID!) {
    endMeeting(meetingId: $meetingId) {
      _id
      title
      status
      inviteCode
      isPrivate
      scheduledFor
      actualStartAt
      endedAt
      durationMin
      notes
      participantCount
      createdAt
      updatedAt
      hostId
      host {
        _id
        email
        displayName
        systemRole
        avatarUrl
        department
        organization
      }
    }
  }
`;

export const JOIN_MEETING = gql`
  mutation JoinMeeting($input: JoinParticipantInput!) {
    joinMeeting(input: $input) {
      _id
      displayName
      role
      micState
      cameraState
      userId
      meetingId
      status
    }
  }
`;

export const LEAVE_MEETING = gql`
  mutation LeaveMeeting($input: LeaveMeetingInput!) {
    leaveMeeting(input: $input) {
      message
    }
  }
`;

export const UPDATE_SESSION = gql`
  mutation UpdateSession($input: UpdateSessionInput!) {
    updateSession(input: $input) {
      success
      message
    }
  }
`;

export const FORCE_MUTE = gql`
  mutation ForceMute($input: ForceMuteInput!) {
    forceMute(input: $input) {
      success
      message
    }
  }
`;

export const FORCE_CAMERA_OFF = gql`
  mutation ForceCameraOff($input: ForceCameraOffInput!) {
    forceCameraOff(input: $input) {
      success
      message
    }
  }
`;

export const REMOVE_PARTICIPANT = gql`
  mutation RemoveParticipant($participantId: ID!) {
    removeParticipant(participantId: $participantId) {
      success
      message
    }
  }
`;

export const APPROVE_PARTICIPANT = gql`
  mutation ApproveParticipant($input: ApproveParticipantInput!) {
    approveParticipant(input: $input) {
      success
      message
    }
  }
`;

export const REJECT_PARTICIPANT = gql`
  mutation RejectParticipant($input: RejectParticipantInput!) {
    rejectParticipant(input: $input) {
      success
      message
    }
  }
`;

export const RAISE_HAND = gql`
  mutation RaiseHand($input: RaiseHandInput!) {
    raiseHand(input: $input) {
      success
      message
    }
  }
`;

export const LOWER_HAND = gql`
  mutation LowerHand($input: LowerHandInput!) {
    lowerHand(input: $input) {
      success
      message
    }
  }
`;

export const HOST_LOWER_HAND = gql`
  mutation HostLowerHand($input: HostLowerHandInput!) {
    hostLowerHand(input: $input) {
      success
      message
    }
  }
`;

export const LOWER_ALL_HANDS = gql`
  mutation LowerAllHands($meetingId: ID!) {
    lowerAllHands(meetingId: $meetingId) {
      success
      message
    }
  }
`;

export const DELETE_CHAT_MESSAGE = gql`
  mutation DeleteChatMessage($input: DeleteMessageInput!) {
    deleteChatMessage(input: $input) {
      success
      message
    }
  }
`;

export const TRANSFER_HOST = gql`
  mutation TransferHost($input: TransferHostInput!) {
    transferHost(input: $input) {
      success
      message
    }
  }
`;

export const TRANSFER_HOST_AND_LEAVE = gql`
  mutation TransferHostAndLeave(
    $meetingId: ID!
    $newHostParticipantId: ID!
    $reason: String
  ) {
    transferHostAndLeave(
      meetingId: $meetingId
      newHostParticipantId: $newHostParticipantId
      reason: $reason
    ) {
      success
      message
      meetingEnded
    }
  }
`;

// Subscriptions
export const MEETING_UPDATED = gql`
  subscription MeetingUpdated($meetingId: ID!) {
    meetingUpdated(meetingId: $meetingId) {
      _id
      status
      participantCount
    }
  }
`;

export const PARTICIPANT_JOINED = gql`
  subscription ParticipantJoined($meetingId: ID!) {
    participantJoined(meetingId: $meetingId) {
      _id
      displayName
      role
      micState
      cameraState
    }
  }
`;

export const PARTICIPANT_LEFT = gql`
  subscription ParticipantLeft($meetingId: ID!) {
    participantLeft(meetingId: $meetingId) {
      _id
      displayName
    }
  }
`;

export const PARTICIPANT_UPDATED = gql`
  subscription ParticipantUpdated($meetingId: ID!) {
    participantUpdated(meetingId: $meetingId) {
      _id
      displayName
      role
      micState
      cameraState
    }
  }
`;

export const CHAT_MESSAGE_ADDED = gql`
  subscription ChatMessageAdded($meetingId: ID!) {
    chatMessageAdded(meetingId: $meetingId) {
      _id
      text
      displayName
      createdAt
    }
  }
`;

export const HAND_RAISED = gql`
  subscription HandRaised($meetingId: ID!) {
    handRaised(meetingId: $meetingId) {
      participantId
      displayName
      hasHandRaised
      handRaisedAt
      handLoweredAt
      handRaiseDuration
      isWaitingForResponse
      reason
    }
  }
`;

export const HAND_LOWERED = gql`
  subscription HandLowered($meetingId: ID!) {
    handLowered(meetingId: $meetingId) {
      participantId
    }
  }
`;

// Types
export interface Meeting {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
  isPrivate: boolean;
  scheduledFor?: string;
  actualStartAt?: string;
  endedAt?: string;
  durationMin?: number;
  notes?: string;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
  hostId: string;
  host: {
    _id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    department?: string;
    organization?: string;
  };
}

export interface Participant {
  _id: string;
  displayName: string;
  role: string;
  micState: string;
  cameraState: string;
  user: {
    _id: string;
    email: string;
    displayName: string;
  };
}

export interface ChatMessage {
  _id: string;
  text: string;
  displayName: string;
  createdAt: string;
}

export interface WaitingParticipant {
  _id: string;
  displayName: string;
  email: string;
  status: string;
  joinedAt: string;
  avatarUrl?: string;
  micState: string;
  cameraState: string;
  socketId: string;
}

export interface ParticipantStats {
  totalParticipants: number;
  currentlyOnline: number;
  totalSessions: number;
  averageSessionDuration: number;
  totalMeetingDuration: number;
}

export interface ChatStats {
  totalMessages: number;
  messagesToday: number;
  activeUsers: number;
  averageMessagesPerUser: number;
}

// Input types
export interface JoinParticipantInput {
  meetingId: string;
  displayName: string;
  role: string;
}

export interface UpdateSessionInput {
  participantId: string;
  meetingId: string;
  micState?: string;
  cameraState?: string;
}

export interface ForceMuteInput {
  meetingId: string;
  participantId: string;
  track: string;
}

export interface ForceCameraOffInput {
  meetingId: string;
  participantId: string;
}

export interface ApproveParticipantInput {
  meetingId: string;
  participantId: string;
}

export interface RejectParticipantInput {
  meetingId: string;
  participantId: string;
  reason: string;
}

export interface RaiseHandInput {
  participantId: string;
  reason: string;
}

export interface LowerHandInput {
  participantId: string;
}

export interface HostLowerHandInput {
  meetingId: string;
  participantId: string;
}

export interface DeleteMessageInput {
  messageId: string;
  meetingId: string;
}

export interface TransferHostInput {
  meetingId: string;
  newHostParticipantId: string;
  reason?: string;
}

export interface TransferHostAndLeaveInput {
  meetingId: string;
  newHostParticipantId: string;
  reason?: string;
}