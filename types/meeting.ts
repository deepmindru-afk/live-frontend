export interface Meeting {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
  courseCode?: string;
  isPrivate: boolean;
  scheduledFor?: string;
  actualStartAt?: string;
  endedAt?: string;
  durationMin?: number;
  notes?: string;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
  hostId: string; // Original tutor/creator (never changes)
  currentHostId?: string; // Current host for meeting management (can change)
  host: {
    _id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    department?: string;
    organization?: string;
  };
}

export interface Participant {
  _id: string;
  displayName: string;
  role: string;
  micState: string;
  cameraState: string;
  user: {
    _id: string;
    email: string;
    displayName: string;
  };
}

export interface WaitingParticipant {
  _id: string;
  displayName: string;
  email: string;
  role: string;
}

export interface ChatMessage {
  _id: string;
  text: string;
  displayName: string;
  createdAt: string;
}

export interface RaisedHand {
  participantId: string;
  reason: string;
  raisedAt: string;
}

export interface ParticipantStats {
  totalParticipants: number;
  activeParticipants: number;
  waitingParticipants: number;
  mutedParticipants: number;
  videoOffParticipants: number;
}

export interface ChatStats {
  totalMessages: number;
  messagesPerMinute: number;
  activeChatters: number;
}

// Input types
export interface CreateMeetingInput {
  title: string;
  notes?: string;
  isPrivate?: boolean;
  scheduledFor?: string;
  durationMin?: number;
}

export interface JoinParticipantInput {
  meetingId: string;
  displayName: string;
  role: string;
}

export interface JoinMeetingInput {
  inviteCode: string;
}

export interface ChatHistoryInput {
  meetingId: string;
  limit?: number;
  offset?: number;
}

export interface RaisedHandsInput {
  meetingId: string;
}

export interface LeaveMeetingInput {
  meetingId: string;
  participantId: string;
}

export interface UpdateParticipantInput {
  meetingId: string;
  participantId: string;
  displayName?: string;
  role?: string;
  micState?: string;
  cameraState?: string;
}

export interface ApproveParticipantInput {
  meetingId: string;
  participantId: string;
}

export interface RejectParticipantInput {
  meetingId: string;
  participantId: string;
  reason?: string;
}

export interface ForceMuteInput {
  meetingId: string;
  participantId: string;
  track: string;
  reason?: string;
}

export interface ForceCameraOffInput {
  meetingId: string;
  participantId: string;
  reason?: string;
}

export interface TransferHostInput {
  meetingId: string;
  newHostParticipantId: string;
  reason?: string;
}

export interface RaiseHandInput {
  participantId: string;
  reason?: string;
}

export interface LowerHandInput {
  participantId: string;
}

export interface ChatMessageInput {
  meetingId: string;
  text: string;
  replyTo?: string;
}

export interface DeleteMessageInput {
  meetingId: string;
  messageId: string;
}

export interface StartRecordingInput {
  meetingId: string;
  participantId: string;
}

export interface StopRecordingInput {
  meetingId: string;
  recordingId: string;
}

export interface PauseRecordingInput {
  meetingId: string;
  recordingId: string;
}

export interface ResumeRecordingInput {
  meetingId: string;
  recordingId: string;
}
