import { gql } from '@apollo/client';

// TypeScript interfaces for meeting creation
export interface CreateMeetingInput {
  title: string;
  notes?: string;
  isPrivate?: boolean;
  scheduledFor?: string;
  durationMin?: number;
}

export interface CreateMeetingResponse {
  createMeeting: {
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
      systemRole: string;
      avatarUrl?: string;
      department?: string;
      organization?: string;
    };
  };
}

// Mutation to create a new meeting
export const CREATE_MEETING = gql`
  mutation CreateMeeting($input: CreateMeetingInput!) {
    createMeeting(input: $input) {
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

// Mutation to start a meeting
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

// Mutation to end a meeting
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

// Mutation to join a meeting
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
    }
  }
`;

// Mutation to leave a meeting
export const LEAVE_MEETING = gql`
  mutation LeaveMeeting($input: LeaveMeetingInput!) {
    leaveMeeting(input: $input) {
      success
      message
    }
  }
`;

// Mutation to join meeting by code
export const JOIN_MEETING_BY_CODE = gql`
  mutation JoinMeetingByCode($input: JoinMeetingInput!) {
    joinMeetingByCode(input: $input) {
      success
      message
      meeting {
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
          avatarUrl
          department
          organization
        }
      }
    }
  }
`;

// Mutation to update participant
export const UPDATE_PARTICIPANT = gql`
  mutation UpdateParticipant($input: UpdateParticipantInput!) {
    updateParticipant(input: $input) {
      _id
      displayName
      role
      micState
      cameraState
    }
  }
`;

// Mutation to approve participant
export const APPROVE_PARTICIPANT = gql`
  mutation ApproveParticipant($input: ApproveParticipantInput!) {
    approveParticipant(input: $input) {
      success
      message
    }
  }
`;

// Mutation to reject participant
export const REJECT_PARTICIPANT = gql`
  mutation RejectParticipant($input: RejectParticipantInput!) {
    rejectParticipant(input: $input) {
      success
      message
    }
  }
`;

// Mutation to force mute
export const FORCE_MUTE = gql`
  mutation ForceMute($input: ForceMuteInput!) {
    forceMute(input: $input) {
      success
      message
    }
  }
`;

// Mutation to force camera off
export const FORCE_CAMERA_OFF = gql`
  mutation ForceCameraOff($input: ForceCameraOffInput!) {
    forceCameraOff(input: $input) {
      success
      message
    }
  }
`;

// Mutation to transfer host
export const TRANSFER_HOST = gql`
  mutation TransferHost($input: TransferHostInput!) {
    transferHost(input: $input) {
      success
      message
    }
  }
`;

// Mutation to raise hand
export const RAISE_HAND = gql`
  mutation RaiseHand($input: RaiseHandInput!) {
    raiseHand(input: $input) {
      success
      message
    }
  }
`;

// Mutation to lower hand
export const LOWER_HAND = gql`
  mutation LowerHand($input: LowerHandInput!) {
    lowerHand(input: $input) {
      success
      message
    }
  }
`;

// Mutation to send chat message
export const SEND_CHAT_MESSAGE = gql`
  mutation SendChatMessage($input: ChatMessageInput!) {
    sendChatMessage(input: $input) {
      _id
      text
      displayName
      createdAt
    }
  }
`;

// Mutation to delete chat message
export const DELETE_CHAT_MESSAGE = gql`
  mutation DeleteChatMessage($input: DeleteMessageInput!) {
    deleteChatMessage(input: $input) {
      success
      message
    }
  }
`;

// Mutation to start recording
export const START_RECORDING = gql`
  mutation StartRecording($input: StartRecordingInput!) {
    startRecording(input: $input) {
      success
      message
      recordingId
    }
  }
`;

// Mutation to stop recording
export const STOP_RECORDING = gql`
  mutation StopRecording($input: StopRecordingInput!) {
    stopRecording(input: $input) {
      success
      message
    }
  }
`;

// Mutation to pause recording
export const PAUSE_RECORDING = gql`
  mutation PauseRecording($input: PauseRecordingInput!) {
    pauseRecording(input: $input) {
      success
      message
    }
  }
`;

// Mutation to resume recording
export const RESUME_RECORDING = gql`
  mutation ResumeRecording($input: ResumeRecordingInput!) {
    resumeRecording(input: $input) {
      success
      message
    }
  }
`;