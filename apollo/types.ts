// GraphQL Input Types
export interface ChatHistoryInput {
  meetingId: string;
  before?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface ChatSearchInput {
  meetingId: string;
  q: string;
  limit?: number;
  offset?: number;
}

export interface VodQueryInput {
  q?: string;
  source?: string;
  meetingId?: string;
  limit?: number;
  offset?: number;
}

export interface GetRaisedHandsInput {
  meetingId: string;
  limit?: number;
  offset?: number;
}

export interface GetScreenShareStatusInput {
  meetingId: string;
}

export interface LeaveMeetingInput {
  participantId: string;
  meetingId: string;
}

export interface DeleteMessageInput {
  messageId: string;
  meetingId: string;
}

export interface JoinParticipantInput {
  meetingId: string;
  displayName: string;
  role: string;
}

export interface UpdateSessionInput {
  participantId: string;
  meetingId: string;
  micState?: string;
  cameraState?: string;
}

export interface ForceMuteInput {
  meetingId: string;
  participantId: string;
  track: string;
}

export interface ForceCameraOffInput {
  meetingId: string;
  participantId: string;
}

export interface ApproveParticipantInput {
  meetingId: string;
  participantId: string;
}

export interface RejectParticipantInput {
  meetingId: string;
  participantId: string;
  reason: string;
}

export interface RaiseHandInput {
  participantId: string;
  meetingId: string;
  reason: string;
}

export interface LowerHandInput {
  participantId: string;
  meetingId: string;
}

export interface HostLowerHandInput {
  meetingId: string;
  participantId: string;
}

export interface CreateVodFileInput {
  title: string;
  notes?: string;
  meetingId?: string;
  durationSec?: number;
}

export interface CreateVodUrlInput {
  title: string;
  url: string;
  notes?: string;
  meetingId?: string;
  durationSec?: number;
}

export interface UpdateVodInput {
  vodId: string;
  title?: string;
  notes?: string;
  durationSec?: number;
}

export interface CreateVodInput {
  title: string;
  meetingId?: string;
  source?: string;
  storageKey?: string;
  sizeBytes?: number;
  durationSec?: number;
  notes?: string;
}

export interface GenerateTokenInput {
  meetingId: string;
  participantName: string;
  participantIdentity: string;
}