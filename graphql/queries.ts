import { gql } from '@apollo/client';

export const LOAD_MEETING_DATA = gql`
  query LoadMeetingData($meetingId: ID!) {
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
      maxParticipants
      notes
      participantCount
      createdAt
      updatedAt
    }
  }
`;

export const LOAD_PARTICIPANTS_DATA = gql`
  query LoadParticipantsData($meetingId: ID!) {
    getParticipantsByMeeting(meetingId: $meetingId) {
      _id
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

export const LOAD_PARTICIPANT_STATS = gql`
  query LoadParticipantStats($meetingId: ID!) {
    getParticipantStats(meetingId: $meetingId) {
      totalParticipants
      currentlyOnline
      totalSessions
      averageSessionDuration
      totalMeetingDuration
      activeParticipants
      mutedParticipants
      cameraOffParticipants
      raisedHandsCount
      screenSharersCount
    }
  }
`;

export const LOAD_WAITING_ROOM_DATA = gql`
  query LoadWaitingRoomData($meetingId: ID!) {
    getWaitingParticipants(meetingId: $meetingId) {
      _id
      displayName
      role
      micState
      cameraState
      status
      email
      joinedAt
      createdAt
    }
  }
`;

export const LOAD_CHAT_HISTORY = gql`
  query LoadChatHistory($input: ChatHistoryInput!) {
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
          createdAt
        }
        createdAt
        updatedAt
      }
      total
      hasMore
    }
  }
`;

export const LOAD_RECORDING_INFO = gql`
  query LoadRecordingInfo($input: GetRecordingInput!) {
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

export const GET_SCREEN_SHARE_STATUS = gql`
  query GetScreenShareStatus($input: GetScreenShareStatusInput!) {
    getScreenShareStatus(input: $input) {
      meetingId
      participants {
        _id
        displayName
        isScreenSharing
        screenShareStartedAt
        screenShareEndedAt
      }
      totalParticipants
      activeScreenSharers
      totalScreenShares
    }
  }
`;

export const GET_RAISED_HANDS = gql`
  query GetRaisedHands($input: GetRaisedHandsInput!) {
    getRaisedHands(input: $input) {
      meetingId
      participants {
        _id
        displayName
        hasHandRaised
        handRaisedAt
        handLoweredAt
        reason
      }
      totalParticipants
      raisedHandsCount
      totalRaisedHands
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
      participants {
        _id
        displayName
        status
        joinedAt
        leftAt
        durationSec
      }
      attendanceRate
      averageAttendanceDuration
      totalAttendanceDuration
    }
  }
`;
