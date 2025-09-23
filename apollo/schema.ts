import { gql } from '@apollo/client';

export const typeDefs = gql`
  scalar Upload

  input ChatHistoryInput {
    meetingId: ID!
    before: String
    limit: Int
    offset: Int
    cursor: String
  }

  input ChatSearchInput {
    meetingId: ID!
    q: String!
    limit: Int
    offset: Int
  }

  input VodQueryInput {
    q: String
    source: String
    meetingId: ID
    limit: Int
    offset: Int
  }

  input GetRaisedHandsInput {
    meetingId: ID!
    limit: Int
    offset: Int
  }

  input GetScreenShareStatusInput {
    meetingId: ID!
  }

  input LeaveMeetingInput {
    participantId: ID!
    meetingId: ID!
  }

  input DeleteMessageInput {
    messageId: ID!
    meetingId: ID!
  }

  input JoinParticipantInput {
    meetingId: ID!
    displayName: String!
    role: String!
  }

  input UpdateSessionInput {
    participantId: ID!
    meetingId: ID!
    micState: String
    cameraState: String
  }

  input ForceMuteInput {
    meetingId: ID!
    participantId: ID!
    track: String!
  }

  input ForceCameraOffInput {
    meetingId: ID!
    participantId: ID!
  }

  input ApproveParticipantInput {
    meetingId: ID!
    participantId: ID!
  }

  input RejectParticipantInput {
    meetingId: ID!
    participantId: ID!
    reason: String!
  }

  input RaiseHandInput {
    participantId: ID!
    meetingId: ID!
    reason: String!
  }

  input LowerHandInput {
    participantId: ID!
    meetingId: ID!
  }

  input HostLowerHandInput {
    meetingId: ID!
    participantId: ID!
  }

  input CreateVodFileInput {
    title: String!
    notes: String
    meetingId: ID
    durationSec: Int
  }

  input CreateVodUrlInput {
    title: String!
    url: String!
    notes: String
    meetingId: ID
    durationSec: Int
  }

  input UpdateVodInput {
    vodId: ID!
    title: String
    notes: String
    durationSec: Int
  }

  input CreateVodInput {
    title: String!
    meetingId: ID
    source: String
    storageKey: String
    sizeBytes: Int
    durationSec: Int
    notes: String
  }

  input GenerateTokenInput {
    meetingId: ID!
    participantName: String!
    participantIdentity: String!
  }

  input GetRecordingInput {
    meetingId: ID!
  }

  input DeviceTestInput {
    deviceType: String!
    capabilities: [String!]
  }
`;
