import { gql } from '@apollo/client';

// Query to get meetings for a user
export const GET_MY_MEETINGS = gql`
  query GetMyMeetings($input: MeetingQueryInput!) {
    getMeetings(input: $input) {
      meetings {
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
      total
      limit
      offset
      hasMore
    }
  }
`;

// Query to get all meetings (for admin)
export const GET_ALL_MEETINGS = gql`
  query GetAllMeetings($input: MeetingQueryInput!) {
    getMeetings(input: $input) {
      meetings {
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
      total
      limit
      offset
      hasMore
    }
  }
`;

// Query to get meeting statistics
export const GET_MEETING_STATS = gql`
  query GetMeetingStats {
    getMeetingStats {
      totalMeetings
      activeMeetings
      endedMeetings
      totalParticipants
      averageDuration
    }
  }
`;


// Query to get meeting by ID (for meeting page)
export const GET_MEETING_BY_ID = gql`
  query GetMeetingById($meetingId: ID!) {
    getMeetingById(meetingId: $meetingId) {
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
`;

// Query to get participants by meeting
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

// Query to get waiting participants
export const GET_WAITING_PARTICIPANTS = gql`
  query GetWaitingParticipants($meetingId: ID!) {
    getWaitingParticipants(meetingId: $meetingId) {
      _id
      displayName
      email
      role
    }
  }
`;

// Query to get chat history
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

// Query to get raised hands
export const GET_RAISED_HANDS = gql`
  query GetRaisedHands($input: RaisedHandsInput!) {
    getRaisedHands(input: $input) {
      raisedHands {
        participantId
        reason
        raisedAt
      }
    }
  }
`;

// Query to get participant stats
export const GET_PARTICIPANT_STATS = gql`
  query GetParticipantStats($meetingId: ID!) {
    getParticipantStats(meetingId: $meetingId) {
      totalParticipants
      activeParticipants
      waitingParticipants
      mutedParticipants
      videoOffParticipants
    }
  }
`;

// Query to get chat stats
export const GET_CHAT_STATS = gql`
  query GetChatStats($meetingId: ID!) {
    getChatStats(meetingId: $meetingId) {
      totalMessages
      messagesPerMinute
      activeChatters
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
      reason
      raisedAt
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