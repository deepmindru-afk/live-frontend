import { gql } from '@apollo/client';

// ===== LIVEKIT MUTATIONS =====

export const CREATE_LIVEKIT_TOKEN = gql`
  mutation CreateLivekitToken($input: GenerateTokenInput!) {
    createLivekitToken(input: $input) {
      wsUrl
      token
    }
  }
`;

export const END_LIVEKIT_ROOM = gql`
  mutation EndLivekitRoom($meetingId: String!) {
    endLivekitRoom(meetingId: $meetingId) {
      success
      message
    }
  }
`;

export const KICK_LIVEKIT_PARTICIPANT = gql`
  mutation KickLivekitParticipant($meetingId: String!, $identity: String!) {
    kickLivekitParticipant(meetingId: $meetingId, identity: $identity) {
      success
      message
    }
  }
`;

export const MUTE_PARTICIPANT = gql`
  mutation MuteParticipant($input: MuteParticipantInput!) {
    muteParticipant(input: $input) {
      success
      message
    }
  }
`;

export const UPDATE_PARTICIPANT_METADATA = gql`
  mutation UpdateParticipantMetadata($input: UpdateParticipantMetadataInput!) {
    updateParticipantMetadata(input: $input) {
      success
      message
    }
  }
`;

export const START_RECORDING = gql`
  mutation StartRecording($input: StartRecordingInput!) {
    startRecording(input: $input) {
      success
      message
      recordingId
    }
  }
`;

export const STOP_RECORDING = gql`
  mutation StopRecording($input: StopRecordingInput!) {
    stopRecording(input: $input) {
      success
      message
    }
  }
`;
