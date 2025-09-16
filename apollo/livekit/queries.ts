import { gql } from '@apollo/client';

// ===== LIVEKIT QUERIES =====

export const GET_LIVEKIT_TOKEN = gql`
  query GetLivekitToken($roomName: String!, $participantName: String!, $meetingRole: String!) {
    getLivekitToken(roomName: $roomName, participantName: $participantName, meetingRole: $meetingRole) {
      wsUrl
      token
    }
  }
`;

export const GET_ROOM_INFO = gql`
  query GetRoomInfo($roomName: String!) {
    getRoomInfo(roomName: $roomName) {
      name
      numParticipants
      maxParticipants
      creationTime
      turnPassword
      enabledCodecs
      metadata
    }
  }
`;

export const GET_ROOM_STATS = gql`
  query GetRoomStats($roomName: String!) {
    getRoomStats(roomName: $roomName) {
      roomName
      participantCount
      activeParticipants
      totalDuration
      startTime
      endTime
      participants {
        identity
        name
        isSubscriber
        isMuted
        isCameraEnabled
        joinedAt
      }
    }
  }
`;

export const GET_RECORDINGS = gql`
  query GetRecordings($roomName: String) {
    getRecordings(roomName: $roomName) {
      recordingId
      roomName
      status
      startTime
      endTime
      duration
      filePath
      fileSize
      createdAt
    }
  }
`;
