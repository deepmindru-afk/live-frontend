import { gql } from '@apollo/client';

// Meeting Queries
export const GET_MEETING_BY_ID = gql`
  query GetMeetingById($meetingId: ID!) {
    getMeetingById(meetingId: $meetingId) {
      _id
      title
      status
      inviteCode
      isPrivate
      isLocked
      scheduledFor
      actualStartAt
      endedAt
      durationMin
      participantCount
      hostId
      createdAt
      updatedAt
    }
  }
`;

export const GET_MEETING_STATS = gql`
  query GetMeetingStats {
    getMeetingStats {
      totalMeetings
      activeMeetings
      scheduledMeetings
      endedMeetings
      totalParticipants
      averageMeetingDuration
      totalMeetingTime
    }
  }
`;

// Participant Queries
export const GET_PARTICIPANTS_BY_MEETING = gql`
  query GetParticipantsByMeeting($meetingId: ID!) {
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
        avatarUrl
        organization
        department
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_WAITING_PARTICIPANTS = gql`
  query GetWaitingParticipants($meetingId: ID!) {
    getWaitingParticipants(meetingId: $meetingId) {
      _id
      displayName
      status
      joinedAt
      email
      avatarUrl
      micState
      cameraState
      socketId
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

export const GET_MEETING_ATTENDANCE = gql`
  query GetMeetingAttendance($meetingId: ID!) {
    getMeetingAttendance(meetingId: $meetingId) {
      meetingId
      totalParticipants
      presentParticipants
      absentParticipants
      averageAttendanceTime
      attendanceRate
      participants {
        _id
        displayName
        joinedAt
        leftAt
        totalTime
        status
      }
    }
  }
`;

// Chat Queries
export const GET_CHAT_HISTORY = gql`
  query GetChatHistory($input: ChatHistoryInput!) {
    getChatHistory(input: $input) {
      messages {
        _id
        text
        userId
        displayName
        user {
          _id
          displayName
          avatarUrl
        }
        replyToMessageId
        replyToMessage {
          _id
          text
          displayName
        }
        createdAt
        updatedAt
      }
      total
      hasMore
      limit
      nextCursor
    }
  }
`;

export const SEARCH_CHAT_MESSAGES = gql`
  query SearchChatMessages($input: ChatSearchInput!) {
    searchChatMessages(input: $input) {
      messages {
        _id
        text
        userId
        displayName
        user {
          _id
          displayName
          avatarUrl
        }
        createdAt
      }
      total
      limit
      offset
      hasMore
      query
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

// Raised Hands Queries
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

export const GET_PARTICIPANT_HAND_STATUS = gql`
  query GetParticipantHandStatus($participantId: ID!) {
    getParticipantHandStatus(participantId: $participantId) {
      hasHandRaised
      handRaisedAt
      handLoweredAt
      handRaiseDuration
      isWaitingForResponse
      reason
    }
  }
`;

// Screen Sharing Queries
export const GET_SCREEN_SHARE_STATUS = gql`
  query GetScreenShareStatus($input: GetScreenShareStatusInput!) {
    getScreenShareStatus(input: $input) {
      meetingId
      participants {
        participantId
        displayName
        screenState
        screenShareInfo
        screenShareStartedAt
        screenShareDuration
        isCurrentlySharing
      }
      totalParticipants
      currentlySharingCount
    }
  }
`;

export const GET_ACTIVE_SCREEN_SHARERS = gql`
  query GetActiveScreenSharers($meetingId: ID!) {
    getActiveScreenSharers(meetingId: $meetingId) {
      participantId
      displayName
      screenState
      screenShareInfo
      screenShareStartedAt
      screenShareDuration
      isCurrentlySharing
    }
  }
`;

// Recording Queries
export const GET_RECORDING_INFO = gql`
  query GetRecordingInfo($input: GetRecordingInput!) {
    getRecordingInfo(input: $input) {
      meetingId
      isRecording
      recordingId
      recordingUrl
      recordingStartedAt
      recordingEndedAt
      recordingPausedAt
      recordingResumedAt
      recordingDuration
      recordingStatus
      quality
      format
      status
      recordingType
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

export const GET_RECORDING_STATS = gql`
  query GetRecordingStats {
    getRecordingStats {
      totalRecordings
      activeRecordings
      pausedRecordings
      totalRecordingTime
      averageRecordingDuration
    }
  }
`;

// VOD Queries
export const GET_ALL_VODS = gql`
  query GetAllVods($input: VodQueryInput!) {
    getAllVods(input: $input) {
      vods {
        _id
        title
        meetingId
        source
        storageKey
        sizeBytes
        durationSec
        notes
        createdAt
        updatedAt
        meeting {
          _id
          title
          status
          inviteCode
        }
      }
      total
      hasMore
    }
  }
`;

export const GET_VOD_BY_ID = gql`
  query GetVodById($vodId: ID!) {
    getVodById(vodId: $vodId) {
      _id
      title
      meetingId
      source
      storageKey
      sizeBytes
      durationSec
      notes
      createdAt
      updatedAt
      meeting {
        _id
        title
        status
        inviteCode
      }
    }
  }
`;

export const GET_VOD_STATS = gql`
  query GetVodStats {
    getVodStats {
      totalVods
      totalSize
      totalDuration
      averageDuration
    }
  }
`;

// Waiting Room Stats
export const GET_WAITING_ROOM_STATS = gql`
  query GetWaitingRoomStats($meetingId: ID!) {
    getWaitingRoomStats(meetingId: $meetingId) {
      meetingId
      totalWaiting
      approvedCount
      rejectedCount
      averageWaitTime
      longestWaitTime
      recentActivity
    }
  }
`;

// Device & System Queries
export const TEST_DEVICE = gql`
  query TestDevice($input: DeviceTestInput!) {
    testDevice(input: $input) {
      deviceType
      isSupported
      capabilities
      error
    }
  }
`;

export const HEALTH_CHECK = gql`
  query Health {
    health {
      status
      timestamp
      uptime
      version
    }
  }
`;

// LiveKit Queries
export const CREATE_LIVEKIT_TOKEN = gql`
  mutation CreateLivekitToken($input: GenerateTokenInput!) {
    createLivekitToken(input: $input) {
      wsUrl
      token
    }
  }
`;
