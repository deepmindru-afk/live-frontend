import { gql } from '@apollo/client';

// ===== PARTICIPANT QUERIES =====

export const GET_PARTICIPANTS_BY_MEETING = gql`
  query GetParticipantsByMeeting($meetingId: ID!) {
    getParticipantsByMeeting(meetingId: $meetingId) {
      _id
      meetingId
      userId
      displayName
      role
      micState
      cameraState
      status
      socketId
      hasHandRaised
      handRaisedAt
      handLoweredAt
      totalDurationSec
      sessions {
        joinedAt
        leftAt
        durationSec
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_PARTICIPANT_STATS = gql`
  query GetParticipantStats($meetingId: ID!) {
    getParticipantStats(meetingId: $meetingId) {
      totalParticipants
      activeParticipants
      mutedParticipants
      participantsWithCameraOff
      averageSessionDuration
      totalMeetingDuration
    }
  }
`;

export const GET_PARTICIPANT_BY_ID = gql`
  query GetParticipantById($id: ID!) {
    getParticipantById(id: $id) {
      _id
      meetingId
      userId
      displayName
      role
      micState
      cameraState
      status
      socketId
      hasHandRaised
      handRaisedAt
      handLoweredAt
      totalDurationSec
      sessions {
        joinedAt
        leftAt
        durationSec
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
      userId
      joinedAt
      status
      micState
      cameraState
    }
  }
`;

export const GET_WAITING_ROOM_STATS = gql`
  query GetWaitingRoomStats($meetingId: ID!) {
    getWaitingRoomStats(meetingId: $meetingId) {
      totalWaiting
      approvedCount
      rejectedCount
      admittedCount
      averageWaitTime
    }
  }
`;

export const TEST_DEVICE = gql`
  query TestDevice($input: DeviceTestInput!) {
    testDevice(input: $input) {
      isWorking
      deviceName
      volumeLevel
      errorMessage
    }
  }
`;

export const CAN_BE_HOST = gql`
  query CanBeHost {
    canBeHost
  }
`;

export const GET_MEETING_ATTENDANCE = gql`
  query GetMeetingAttendance($meetingId: ID!) {
    getMeetingAttendance(meetingId: $meetingId)
  }
`;
