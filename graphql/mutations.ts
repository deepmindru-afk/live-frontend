import { gql } from '@apollo/client';

export const START_RECORDING = gql`
  mutation StartRecording($input: StartMeetingRecordingInput!) {
    startMeetingRecording(input: $input) {
      success
      message
      meetingId
      recordingId
      recordingUrl
      recording {
        meetingId
        isRecording
        recordingId
        recordingUrl
        recordingStatus
        status
        recordingType
        startedAt
        durationSec
      }
    }
  }
`;

export const STOP_RECORDING = gql`
  mutation StopRecording($input: StopMeetingRecordingInput!) {
    stopMeetingRecording(input: $input) {
      success
      message
      meetingId
      recordingId
      recordingUrl
      recording {
        meetingId
        isRecording
        recordingId
        recordingUrl
        recordingStatus
        status
        recordingType
        stoppedAt
        durationSec
        fileSize
        downloadUrl
      }
    }
  }
`;

export const PAUSE_RECORDING = gql`
  mutation PauseRecording($input: PauseMeetingRecordingInput!) {
    pauseMeetingRecording(input: $input) {
      success
      message
      meetingId
      recordingId
      recording {
        meetingId
        isRecording
        recordingId
        recordingStatus
        status
        pausedAt
        durationSec
      }
    }
  }
`;

export const RESUME_RECORDING = gql`
  mutation ResumeRecording($input: ResumeMeetingRecordingInput!) {
    resumeMeetingRecording(input: $input) {
      success
      message
      meetingId
      recordingId
      recording {
        meetingId
        isRecording
        recordingId
        recordingStatus
        status
        resumedAt
        durationSec
      }
    }
  }
`;

export const FORCE_MUTE_PARTICIPANT = gql`
  mutation ForceMuteParticipant($input: ForceMuteInput!) {
    forceMuteParticipant(input: $input) {
      success
      message
      participantId
      micState
    }
  }
`;

export const FORCE_CAMERA_OFF = gql`
  mutation ForceCameraOff($input: ForceCameraOffInput!) {
    forceCameraOffParticipant(input: $input) {
      success
      message
      participantId
      cameraState
    }
  }
`;

export const APPROVE_PARTICIPANT = gql`
  mutation ApproveParticipant($input: ApproveParticipantInput!) {
    approveParticipant(input: $input) {
      success
      message
      participantId
      status
    }
  }
`;

export const REJECT_PARTICIPANT = gql`
  mutation RejectParticipant($input: RejectParticipantInput!) {
    rejectParticipant(input: $input) {
      success
      message
      participantId
      status
    }
  }
`;

export const REMOVE_PARTICIPANT = gql`
  mutation RemoveParticipant($input: RemoveParticipantInput!) {
    removeParticipant(input: $input) {
      success
      message
      participantId
    }
  }
`;

export const TRANSFER_HOST = gql`
  mutation TransferHost($input: TransferHostInput!) {
    transferHost(input: $input) {
      success
      message
      meetingId
      newHostId
      previousHostId
    }
  }
`;

export const HOST_LOWER_HAND = gql`
  mutation HostLowerHand($input: HostLowerHandInput!) {
    hostLowerHand(input: $input) {
      success
      message
      participantId
      hasHandRaised
      handLoweredAt
    }
  }
`;

export const LOWER_ALL_HANDS = gql`
  mutation LowerAllHands($meetingId: ID!) {
    lowerAllHands(meetingId: $meetingId) {
      success
      message
      meetingId
      loweredHandsCount
    }
  }
`;

export const FORCE_SCREEN_SHARE_CONTROL = gql`
  mutation ForceScreenShareControl($input: ForceScreenShareControlInput!) {
    forceScreenShareControl(input: $input) {
      success
      message
      participantId
      screenShareState
    }
  }
`;

export const DELETE_CHAT_MESSAGE = gql`
  mutation DeleteChatMessage($input: DeleteChatMessageInput!) {
    deleteChatMessage(input: $input) {
      success
      message
      messageId
    }
  }
`;

export const CREATE_LIVEKIT_TOKEN = gql`
  mutation CreateLiveKitToken($meetingId: ID!) {
    createLiveKitToken(meetingId: $meetingId) {
      success
      message
      token
      roomName
      participantName
      participantIdentity
    }
  }
`;

export const END_LIVEKIT_ROOM = gql`
  mutation EndLiveKitRoom($meetingId: ID!) {
    endLiveKitRoom(meetingId: $meetingId) {
      success
      message
      meetingId
      endedAt
    }
  }
`;

export const KICK_LIVEKIT_PARTICIPANT = gql`
  mutation KickLiveKitParticipant($meetingId: ID!, $identity: String!) {
    kickLiveKitParticipant(meetingId: $meetingId, identity: $identity) {
      success
      message
      participantId
      kickedAt
    }
  }
`;

export const LOCK_ROOM = gql`
  mutation LockRoom($meetingId: ID!) {
    lockRoom(meetingId: $meetingId) {
      success
      message
      meetingId
      isLocked
    }
  }
`;

export const UNLOCK_ROOM = gql`
  mutation UnlockRoom($meetingId: ID!) {
    unlockRoom(meetingId: $meetingId) {
      success
      message
      meetingId
      isLocked
    }
  }
`;

