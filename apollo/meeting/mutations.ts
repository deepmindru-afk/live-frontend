import { gql } from '@apollo/client';

// Mutation to create a new meeting
export const CREATE_MEETING = gql`
  mutation CreateMeeting($input: CreateMeetingInput!) {
    createMeeting(input: $input) {
      success
      message
      meeting {
        _id
        title
        status
        schedule
        inviteCode
        createdAt
      }
    }
  }
`;

// Mutation to start a meeting
export const START_MEETING = gql`
  mutation StartMeeting($meetingId: ID!) {
    startMeeting(meetingId: $meetingId) {
      success
      message
      meeting {
        _id
        title
        status
        inviteCode
        startedAt
      }
    }
  }
`;

// Mutation to end a meeting
export const END_MEETING = gql`
  mutation EndMeeting($meetingId: ID!) {
    endMeeting(meetingId: $meetingId) {
      success
      message
      meeting {
        _id
        title
        status
        endedAt
        duration
      }
    }
  }
`;

// Mutation to rotate invite code
export const ROTATE_INVITE_CODE = gql`
  mutation RotateInviteCode($meetingId: ID!) {
    rotateInviteCode(meetingId: $meetingId) {
      success
      message
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
