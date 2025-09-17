import { gql } from '@apollo/client';

// Query to get user's meetings with filtering
export const GET_MY_MEETINGS = gql`
  query GetMyMeetings($input: MeetingQueryInput!) {
    getMeetings(input: $input) {
      total
      meetings {
        _id
        title
        status
        scheduledFor
        inviteCode
        createdAt
        updatedAt
        participantCount
        duration
        notes
        isPrivate
        maxParticipants
      }
    }
  }
`;

// Simple query to test if meetings exist
export const GET_ALL_MEETINGS = gql`
  query GetAllMeetings($input: MeetingQueryInput!) {
    getMeetings(input: $input) {
      total
      meetings {
        _id
        title
        status
        inviteCode
        createdAt
      }
    }
  }
`;

// Query to get meeting statistics
export const GET_MEETING_STATS = gql`
  query GetMeetingStats {
    getMeetingStats {
      totalMeetings
      activeMeetings
      scheduledMeetings
      endedMeetings
      totalParticipants
      totalDuration
    }
  }
`;

// Query to get a specific meeting
export const GET_MEETING = gql`
  query GetMeeting($meetingId: ID!) {
    getMeeting(meetingId: $meetingId) {
      _id
      title
      status
      schedule
      inviteCode
      createdAt
      updatedAt
      participantCount
      duration
      participants {
        _id
        displayName
        email
        joinedAt
      }
    }
  }
`;

// Query to get meeting by ID (for meeting page)
export const GET_MEETING_BY_ID = gql`
  query GetMeetingById($meetingId: ID!) {
    meeting(meetingId: $meetingId) {
      _id
      title
      status
      schedule
      inviteCode
      createdAt
      updatedAt
      participantCount
      duration
      participants {
        _id
        displayName
        email
        isMuted
        isCameraOff
        joinedAt
        isHost
      }
    }
  }
`;

// Query to get chat history
export const GET_CHAT_HISTORY = gql`
  query GetChatHistory($meetingId: ID!, $pagination: PaginationInput!) {
    chatHistory(meetingId: $meetingId, pagination: $pagination) {
      _id
      message
      sender {
        _id
        displayName
      }
      createdAt
      replyToMessageId
    }
  }
`;

// Query to get participants by meeting
export const GET_PARTICIPANTS_BY_MEETING = gql`
  query GetParticipantsByMeeting($meetingId: ID!) {
    participantsByMeeting(meetingId: $meetingId) {
      _id
      displayName
      email
      joinedAt
      leftAt
      isHost
      totalTime
    }
  }
`;

// Query to get participant stats
export const GET_PARTICIPANT_STATS = gql`
  query GetParticipantStats($meetingId: ID!) {
    participantStats(meetingId: $meetingId) {
      totalParticipants
      averageAttendanceTime
      hostAttendanceTime
      longestAttendance
      shortestAttendance
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
      user {
        _id
        displayName
        email
      }
    }
  }
`;
