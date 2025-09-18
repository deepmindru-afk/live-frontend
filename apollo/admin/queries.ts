import { gql } from '@apollo/client';

// Query to get all meetings with filters
export const GET_ALL_MEETINGS_ADMIN = gql`
  query GetAllMeetingsAdmin($input: MeetingQueryInput!) {
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
        host {
          _id
          displayName
          email
          systemRole
        }
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
      completedMeetings
      totalParticipants
      averageMeetingDuration
    }
  }
`;

// Query to get VOD statistics
export const GET_VOD_STATS = gql`
  query GetVodStats {
    getVodStats {
      totalVods
      fileVods
      urlVods
      totalSizeBytes
      averageDuration
    }
  }
`;

// Query to get chat statistics
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

// Query to get all members (Admin only)
export const GET_MEMBERS = gql`
  query GetMembers {
    members {
      _id
      email
      displayName
      systemRole
      isBlocked
      blockedAt
      blockReason
      lastSeenAt
    }
  }
`;

// Query to get all users/members
export const GET_ALL_MEMBERS = gql`
  query GetAllMembers {
    members {
      _id
      email
      displayName
      systemRole
    }
  }
`;

// Query to get meeting participants
export const GET_MEETING_PARTICIPANTS = gql`
  query GetMeetingParticipants($meetingId: ID!) {
    getParticipantsByMeeting(meetingId: $meetingId) {
      _id
      displayName
      email
      role
      micState
      cameraState
      joinedAt
      leftAt
      totalDurationSec
      userId {
        _id
        displayName
        email
        systemRole
      }
    }
  }
`;
