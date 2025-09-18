import { gql } from '@apollo/client';

// Mutation to create a new meeting
export const CREATE_MEETING = gql`
  mutation CreateMeeting($input: CreateMeetingInput!) {
    createMeeting(input: $input) {
      _id
      title
      status
      scheduledFor
      inviteCode
      createdAt
      notes
      isPrivate
      duration
      maxParticipants
      host {
        _id
        displayName
        email
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
      startedAt
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
      endedAt
      duration
    }
  }
`;

// Mutation to rotate invite code
export const ROTATE_INVITE_CODE = gql`
  mutation RotateInviteCode($meetingId: ID!) {
    rotateInviteCode(meetingId: $meetingId) {
      inviteCode
    }
  }
`;

// Mutation to join meeting by code
export const JOIN_MEETING_BY_CODE = gql`
  mutation JoinMeetingByCode($inviteCode: String!) {
    joinMeetingByCode(inviteCode: $inviteCode) {
      success
      message
      meeting {
        _id
        title
        status
        inviteCode
      }
    }
  }
`;

// Mutation to join meeting by ID
export const JOIN_MEETING = gql`
  mutation JoinMeeting($input: JoinMeetingInput!) {
    joinMeeting(input: $input) {
      _id
      meetingId
      displayName
      role
      micState
      cameraState
      userId
    }
  }
`;

// Mutation to leave meeting
export const LEAVE_MEETING = gql`
  mutation LeaveMeeting($input: LeaveMeetingInput!) {
    leaveMeeting(input: $input) {
      success
      message
    }
  }
`;

// Mutation to delete chat message
export const DELETE_CHAT_MESSAGE = gql`
  mutation DeleteChatMessage($messageId: ID!) {
    deleteChatMessage(messageId: $messageId) {
      success
      message
    }
  }
`;
