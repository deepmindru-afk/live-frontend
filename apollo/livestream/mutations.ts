import { gql } from '@apollo/client';

// Meeting Management Mutations
export const START_MEETING = gql`
  mutation StartMeeting($meetingId: ID!) {
    startMeeting(meetingId: $meetingId) {
      success
      message
      meeting {
        _id
        status
        actualStartAt
        inviteCode
      }
    }
  }
`;

export const END_MEETING = gql`
  mutation EndMeeting($meetingId: ID!) {
    endMeeting(meetingId: $meetingId) {
      success
      message
      meeting {
        _id
        status
        endedAt
        durationMin
      }
    }
  }
`;

export const ROTATE_INVITE_CODE = gql`
  mutation RotateInviteCode($meetingId: ID!) {
    rotateInviteCode(meetingId: $meetingId) {
      success
      message
      meeting {
        _id
        inviteCode
      }
    }
  }
`;

export const DELETE_MEETING = gql`
  mutation DeleteMeeting($meetingId: ID!) {
    deleteMeeting(meetingId: $meetingId) {
      success
      message
    }
  }
`;

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

// Participant Management Mutations
export const APPROVE_PARTICIPANT = gql`
  mutation ApproveParticipant($input: ApproveParticipantInput!) {
    approveParticipant(input: $input) {
      success
      message
      participant {
        _id
        displayName
        status
      }
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
      participant {
        _id
        displayName
        status
      }
    }
  }
`;

export const REMOVE_PARTICIPANT = gql`
  mutation RemoveParticipant($participantId: ID!) {
    removeParticipant(participantId: $participantId) {
      success
      message
    }
  }
`;

export const JOIN_MEETING = gql`
  mutation JoinMeeting($input: JoinMeetingInput!) {
    joinMeeting(input: $input) {
      success
      message
      participant {
        _id
        displayName
        status
      }
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
      session {
        _id
        joinedAt
        leftAt
        durationSec
      }
    }
  }
`;

export const PRE_MEETING_SETUP = gql`
  mutation PreMeetingSetup($input: PreMeetingSetupInput!) {
    preMeetingSetup(input: $input) {
      success
      message
      participant {
        _id
        displayName
        status
      }
    }
  }
`;

export const TRANSFER_HOST = gql`
  mutation TransferHost($input: TransferHostInput!) {
    transferHost(input: $input) {
      success
      message
      meeting {
        _id
        hostId
      }
    }
  }
`;

// Media Control Mutations
export const FORCE_MUTE = gql`
  mutation ForceMute($input: ForceMuteInput!) {
    forceMute(input: $input) {
      success
      message
      participant {
        _id
        displayName
        micState
      }
    }
  }
`;

export const FORCE_CAMERA_OFF = gql`
  mutation ForceCameraOff($input: ForceCameraOffInput!) {
    forceCameraOff(input: $input) {
      success
      message
      participant {
        _id
        displayName
        cameraState
      }
    }
  }
`;

export const FORCE_SCREEN_SHARE_CONTROL = gql`
  mutation ForceScreenShareControl($input: ForceScreenShareControlInput!) {
    forceScreenShareControl(input: $input) {
      success
      message
      participant {
        _id
        displayName
        screenState
        screenShareInfo
      }
    }
  }
`;

// Raised Hands Management Mutations
export const RAISE_HAND = gql`
  mutation RaiseHand($input: RaiseHandInput!) {
    raiseHand(input: $input) {
      success
      message
      participantId
      hasHandRaised
      handRaisedAt
    }
  }
`;

export const LOWER_HAND = gql`
  mutation LowerHand($input: LowerHandInput!) {
    lowerHand(input: $input) {
      success
      message
      participantId
      hasHandRaised
      handLoweredAt
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
      participantId
      hasHandRaised
      handLoweredAt
    }
  }
`;

// Chat Management Mutations
export const DELETE_CHAT_MESSAGE = gql`
  mutation DeleteChatMessage($input: DeleteChatMessageInput!) {
    deleteChatMessage(input: $input) {
      success
      message
    }
  }
`;

// Recording Management Mutations
export const START_MEETING_RECORDING = gql`
  mutation StartMeetingRecording($input: StartRecordingInput!) {
    startMeetingRecording(input: $input) {
      success
      message
      recordingId
      status
      startedAt
    }
  }
`;

export const STOP_MEETING_RECORDING = gql`
  mutation StopMeetingRecording($input: StopRecordingInput!) {
    stopMeetingRecording(input: $input) {
      success
      message
      recordingId
      status
      stoppedAt
      durationSec
    }
  }
`;

export const PAUSE_MEETING_RECORDING = gql`
  mutation PauseMeetingRecording($input: PauseRecordingInput!) {
    pauseMeetingRecording(input: $input) {
      success
      message
      recordingId
      status
      pausedAt
    }
  }
`;

export const RESUME_MEETING_RECORDING = gql`
  mutation ResumeMeetingRecording($input: ResumeRecordingInput!) {
    resumeMeetingRecording(input: $input) {
      success
      message
      recordingId
      status
      resumedAt
    }
  }
`;

// LiveKit Management Mutations
export const END_LIVEKIT_ROOM = gql`
  mutation EndLivekitRoom($meetingId: ID!) {
    endLivekitRoom(meetingId: $meetingId) {
      success
      message
    }
  }
`;

export const KICK_LIVEKIT_PARTICIPANT = gql`
  mutation KickLivekitParticipant($meetingId: ID!, $identity: String!) {
    kickLivekitParticipant(meetingId: $meetingId, identity: $identity) {
      success
      message
    }
  }
`;

// VOD Management Mutations
export const UPLOAD_VOD_FILE = gql`
  mutation UploadVodFile($input: UploadVodFileInput!, $file: Upload!) {
    uploadVodFile(input: $input, file: $file) {
      success
      message
      vod {
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
      }
    }
  }
`;

export const CREATE_VOD_URL = gql`
  mutation CreateVodUrl($input: CreateVodUrlInput!) {
    createVodUrl(input: $input) {
      success
      message
      vod {
        _id
        title
        meetingId
        source
        storageKey
        downloadUrl
      }
    }
  }
`;

export const UPDATE_VOD = gql`
  mutation UpdateVod($input: UpdateVodInput!) {
    updateVod(input: $input) {
      success
      message
      vod {
        _id
        title
        meetingId
        source
        storageKey
        sizeBytes
        durationSec
        notes
        updatedAt
      }
    }
  }
`;

export const DELETE_VOD = gql`
  mutation DeleteVod($vodId: ID!) {
    deleteVod(vodId: $vodId) {
      success
      message
    }
  }
`;
