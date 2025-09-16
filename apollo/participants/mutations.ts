import { gql } from '@apollo/client';

// ===== PARTICIPANT MUTATIONS =====

export const CREATE_PARTICIPANT = gql`
  mutation CreateParticipant($input: CreateParticipantInput!) {
    createParticipant(input: $input) {
      _id
      meetingId
      userId
      displayName
      role
      micState
      cameraState
      status
      createdAt
    }
  }
`;

export const UPDATE_PARTICIPANT = gql`
  mutation UpdateParticipant($input: UpdateParticipantInput!) {
    updateParticipant(input: $input) {
      _id
      displayName
      role
      micState
      cameraState
      status
      updatedAt
    }
  }
`;

export const REMOVE_PARTICIPANT = gql`
  mutation RemoveParticipant($id: ID!) {
    removeParticipant(id: $id) {
      success
      message
    }
  }
`;

export const JOIN_MEETING = gql`
  mutation JoinMeeting($input: JoinMeetingInput!) {
    joinMeeting(input: $input) {
      _id
      meetingId
      displayName
      role
      micState
      cameraState
      status
      createdAt
    }
  }
`;

export const LEAVE_MEETING = gql`
  mutation LeaveMeeting($input: LeaveMeetingInput!) {
    leaveMeeting(input: $input) {
      success
      message
    }
  }
`;

export const UPDATE_SESSION = gql`
  mutation UpdateSession($input: UpdateSessionInput!) {
    updateSession(input: $input) {
      success
      message
    }
  }
`;

export const FORCE_MUTE_PARTICIPANT = gql`
  mutation ForceMute($input: ForceMuteInput!) {
    forceMute(input: $input) {
      success
      message
    }
  }
`;

export const FORCE_VIDEO_OFF_PARTICIPANT = gql`
  mutation ForceCameraOff($input: ForceCameraOffInput!) {
    forceCameraOff(input: $input) {
      success
      message
    }
  }
`;

export const TRANSFER_HOST = gql`
  mutation TransferHost($input: TransferHostInput!) {
    transferHost(input: $input) {
      success
      message
    }
  }
`;

export const PRE_MEETING_SETUP = gql`
  mutation PreMeetingSetup($input: PreMeetingSetupInput!) {
    preMeetingSetup(input: $input) {
      success
      message
      participantId
      waitingRoomStatus
      deviceTestResults {
        mic {
          isWorking
          deviceName
          volumeLevel
          errorMessage
        }
        camera {
          isWorking
          deviceName
          errorMessage
        }
        speaker {
          isWorking
          deviceName
          volumeLevel
          errorMessage
        }
      }
    }
  }
`;

export const APPROVE_PARTICIPANT = gql`
  mutation ApproveParticipant($input: ApproveParticipantInput!) {
    approveParticipant(input: $input) {
      success
      message
    }
  }
`;

export const REJECT_PARTICIPANT = gql`
  mutation RejectParticipant($input: RejectParticipantInput!) {
    rejectParticipant(input: $input) {
      success
      message
    }
  }
`;

export const ADMIT_PARTICIPANT = gql`
  mutation AdmitParticipant($input: AdmitParticipantInput!) {
    admitParticipant(input: $input) {
      success
      message
    }
  }
`;
