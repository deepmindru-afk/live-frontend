import { gql } from '@apollo/client';

// Meeting Information Query
export const GET_MEETING_INFO = gql`
  query GetMeetingInfo($meetingId: ID!) {
    getMeetingById(meetingId: $meetingId) {
      _id
      title
      status
      hostId
      inviteCode
      isPrivate
      isLocked
      scheduledFor
      actualStartAt
      endedAt
      durationMin
      participantCount
      createdAt
      updatedAt
    }
  }
`;

// Participants Query
export const GET_PARTICIPANTS = gql`
  query GetParticipants($meetingId: ID!) {
    getParticipantsByMeeting(meetingId: $meetingId) {
      _id
      meetingId
      displayName
      role
      micState
      cameraState
      socketId
      user {
        _id
        email
        displayName
      }
      createdAt
      updatedAt
    }
  }
`;

// Waiting Participants Query
export const GET_WAITING_PARTICIPANTS = gql`
  query GetWaitingParticipants($meetingId: ID!) {
    getWaitingParticipants(meetingId: $meetingId) {
      _id
      displayName
      email
      role
      micState
      cameraState
      joinedAt
    }
  }
`;

// Chat History Query
export const GET_CHAT_HISTORY = gql`
  query GetChatHistory($input: ChatHistoryInput!) {
    getChatHistory(input: $input) {
      messages {
        _id
        text
        userId
        displayName
        createdAt
        user {
          _id
          displayName
        }
        replyToMessage {
          _id
          text
          displayName
        }
      }
      total
      hasMore
    }
  }
`;

// Recording Information Query
export const GET_RECORDING_INFO = gql`
  query GetRecordingInfo($input: GetRecordingInput!) {
    getRecordingInfo(input: $input) {
      recordingId
      status
      recordingType
      quality
      startedAt
      stoppedAt
      pausedAt
      resumedAt
      durationSec
      fileSize
      downloadUrl
    }
  }
`;

// Participant Statistics Query
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

// Meeting Statistics Query
export const GET_MEETING_STATS = gql`
  query GetMeetingStats($meetingId: ID!) {
    getMeetingStats(meetingId: $meetingId) {
      totalParticipants
      activeParticipants
      totalDuration
      averageSessionDuration
    }
  }
`;
