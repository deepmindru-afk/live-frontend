import { gql } from '@apollo/client';

// Query to get user's meetings with filtering
export const GET_MY_MEETINGS = gql`
  query GetMyMeetings {
    meetings {
      _id
      title
      status
      schedule
      inviteCode
      createdAt
      updatedAt
      participantCount
      duration
    }
  }
`;

// Simple query to test if meetings exist
export const GET_ALL_MEETINGS = gql`
  query GetAllMeetings {
    meetings {
      _id
      title
      status
      inviteCode
      createdAt
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
