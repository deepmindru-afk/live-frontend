import { gql } from '@apollo/client';

// Meeting Subscriptions
export const MEETING_UPDATED = gql`
  subscription MeetingUpdated($meetingId: ID!) {
    meetingUpdated(meetingId: $meetingId) {
      _id
      status
      endedAt
      durationMin
      participantCount
    }
  }
`;

// Participant Subscriptions
export const PARTICIPANT_JOINED = gql`
  subscription ParticipantJoined($meetingId: ID!) {
    participantJoined(meetingId: $meetingId) {
      _id
      displayName
      role
      micState
      cameraState
      user {
        _id
        email
        displayName
        systemRole
      }
    }
  }
`;

export const PARTICIPANT_LEFT = gql`
  subscription ParticipantLeft($meetingId: ID!) {
    participantLeft(meetingId: $meetingId) {
      _id
      displayName
      role
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
      user {
        _id
        email
        displayName
        systemRole
      }
    }
  }
`;

// Chat Subscriptions
export const CHAT_MESSAGE_ADDED = gql`
  subscription ChatMessageAdded($meetingId: ID!) {
    chatMessageAdded(meetingId: $meetingId) {
      _id
      message
      senderId
      senderName
      timestamp
    }
  }
`;

// Hand Management Subscriptions
export const HAND_RAISED = gql`
  subscription HandRaised($meetingId: ID!) {
    handRaised(meetingId: $meetingId) {
      participantId
      participantName
      timestamp
    }
  }
`;

export const HAND_LOWERED = gql`
  subscription HandLowered($meetingId: ID!) {
    handLowered(meetingId: $meetingId) {
      participantId
      participantName
      timestamp
    }
  }
`;
