import { gql } from '@apollo/client';

// Recording Mutations
export const START_RECORDING = gql`
  mutation StartRecording($input: StartMeetingRecordingInput!) {
    startMeetingRecording(input: $input) {
      success
      message
      recordingId
    }
  }
`;

export const STOP_RECORDING = gql`
  mutation StopRecording($input: StopMeetingRecordingInput!) {
    stopMeetingRecording(input: $input) {
      success
      message
      recordingId
    }
  }
`;

export const PAUSE_RECORDING = gql`
  mutation PauseRecording($input: PauseMeetingRecordingInput!) {
    pauseMeetingRecording(input: $input) {
      success
      message
    }
  }
`;

export const RESUME_RECORDING = gql`
  mutation ResumeRecording($input: ResumeMeetingRecordingInput!) {
    resumeMeetingRecording(input: $input) {
      success
      message
    }
  }
`;

// Participant Management Mutations
export const APPROVE_PARTICIPANT = gql`
  mutation ApproveParticipant($input: ApproveParticipantInput!) {
    approveParticipant(input: $input) {
      success
      message
      participantId
    }
  }
`;

export const REJECT_PARTICIPANT = gql`
  mutation RejectParticipant($input: RejectParticipantInput!) {
    rejectParticipant(input: $input) {
      success
      message
      participantId
    }
  }
`;

export const REMOVE_PARTICIPANT = gql`
  mutation RemoveParticipant($input: RejectParticipantInput!) {
    removeParticipant(input: $input) {
      success
      message
      participantId
    }
  }
`;

export const FORCE_MUTE = gql`
  mutation ForceMute($input: ForceMuteInput!) {
    forceMuteParticipant(input: $input) {
      success
      message
      participantId
    }
  }
`;

export const FORCE_CAMERA_OFF = gql`
  mutation ForceCameraOff($input: ForceCameraOffInput!) {
    forceCameraOffParticipant(input: $input) {
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
      newHostId
    }
  }
`;

// Hand Management Mutations
export const HOST_LOWER_HAND = gql`
  mutation HostLowerHand($input: HostLowerHandInput!) {
    hostLowerHand(input: $input) {
      success
      message
      participantId
    }
  }
`;

export const LOWER_ALL_HANDS = gql`
  mutation LowerAllHands($meetingId: ID!) {
    lowerAllHands(meetingId: $meetingId) {
      success
      message
    }
  }
`;

// Room Management Mutations
export const LOCK_ROOM = gql`
  mutation LockRoom($meetingId: ID!) {
    lockRoom(meetingId: $meetingId) {
      success
      message
    }
  }
`;

export const UNLOCK_ROOM = gql`
  mutation UnlockRoom($meetingId: ID!) {
    unlockRoom(meetingId: $meetingId) {
      success
      message
    }
  }
`;

// Meeting Management Mutations
export const START_MEETING = gql`
  mutation StartMeeting($meetingId: ID!) {
    startMeeting(meetingId: $meetingId) {
      success
      message
    }
  }
`;

export const END_MEETING = gql`
  mutation EndMeeting($meetingId: ID!) {
    endMeeting(meetingId: $meetingId) {
      success
      message
    }
  }
`;

