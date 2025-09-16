// ===== GRAPHQL TYPES AND INTERFACES =====

export interface User {
  _id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  organization?: string;
  department?: string;
  phone?: string;
  language?: string;
  timezone?: string;
  systemRole: 'ADMIN' | 'TUTOR' | 'MEMBER';
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

export interface Participant {
  _id: string;
  meetingId: string;
  userId?: string;
  displayName: string;
  role: 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER';
  micState: 'ON' | 'OFF' | 'MUTED' | 'MUTED_BY_HOST';
  cameraState: 'ON' | 'OFF' | 'OFF_BY_HOST';
  status: 'WAITING' | 'APPROVED' | 'REJECTED' | 'ADMITTED' | 'LEFT';
  socketId?: string;
  totalDurationSec: number;
  sessions: Session[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  joinedAt: Date;
  leftAt?: Date;
  durationSec: number;
}

export interface Vod {
  _id: string;
  title: string;
  meetingId?: string;
  source: 'FILE' | 'URL';
  storageKey?: string;
  sizeBytes?: number;
  url: string;
  durationSec?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  _id: string;
  meetingId: string;
  userId: string;
  displayName: string;
  message: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  isModerated: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LivekitTokenResponse {
  wsUrl: string;
  token: string;
}

export interface RoomInfo {
  name: string;
  numParticipants: number;
  maxParticipants: number;
  creationTime: string;
  turnPassword: string;
  enabledCodecs: string[];
  metadata: string;
}

export interface ParticipantInfo {
  identity: string;
  name: string;
  isSubscriber: boolean;
  isMuted: boolean;
  isCameraEnabled: boolean;
  joinedAt: string;
}

export interface RoomStats {
  roomName: string;
  participantCount: number;
  activeParticipants: number;
  totalDuration: number;
  startTime: string;
  endTime?: string;
  participants: ParticipantInfo[];
}

export interface RecordingInfo {
  recordingId: string;
  roomName: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  filePath?: string;
  fileSize?: number;
  createdAt: string;
}

// ===== INPUT TYPES =====

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  organization?: string;
  department?: string;
  phone?: string;
  language?: string;
  timezone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateMemberInput {
  displayName?: string;
  avatarUrl?: string;
  organization?: string;
  department?: string;
  phone?: string;
  language?: string;
  timezone?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface CreateParticipantInput {
  meetingId: string;
  userId?: string;
  displayName: string;
  role?: 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER';
}

export interface UpdateParticipantInput {
  participantId: string;
  displayName?: string;
  role?: 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER';
  micState?: 'ON' | 'OFF' | 'MUTED' | 'MUTED_BY_HOST';
  cameraState?: 'ON' | 'OFF' | 'OFF_BY_HOST';
}

export interface JoinMeetingInput {
  meetingId: string;
  displayName: string;
  inviteCode?: string;
}

export interface LeaveMeetingInput {
  participantId: string;
}

export interface UpdateSessionInput {
  participantId: string;
  action: string;
}

export interface ForceMuteInput {
  meetingId: string;
  participantId: string;
  track: 'MIC' | 'CAMERA' | 'SCREEN';
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

export interface PreMeetingSetupInput {
  meetingId: string;
  displayName: string;
  inviteCode?: string;
  joinWithCameraOff?: boolean;
  joinWithMicOff?: boolean;
  joinWithSpeakerOff?: boolean;
}

export interface ApproveParticipantInput {
  meetingId: string;
  participantId: string;
  reason?: string;
}

export interface RejectParticipantInput {
  meetingId: string;
  participantId: string;
  reason?: string;
}

export interface AdmitParticipantInput {
  meetingId: string;
  participantId: string;
  reason?: string;
}

export interface DeviceTestInput {
  deviceType: 'MIC' | 'CAMERA' | 'SPEAKER';
  testDuration?: number;
}

export interface VodQueryInput {
  meetingId?: string;
  source?: 'FILE' | 'URL';
  limit?: number;
  offset?: number;
}

export interface CreateVodUrlInput {
  title: string;
  url: string;
  meetingId?: string;
  durationSec?: number;
  notes?: string;
}

export interface UpdateVodInput {
  title?: string;
  notes?: string;
}

export interface GenerateTokenInput {
  roomName: string;
  participantName: string;
  meetingRole: string;
}

export interface MuteParticipantInput {
  roomName: string;
  participantIdentity: string;
  track: 'MIC' | 'CAMERA' | 'SCREEN';
  muted: boolean;
}

export interface UpdateParticipantMetadataInput {
  roomName: string;
  participantIdentity: string;
  metadata: string;
}

export interface StartRecordingInput {
  roomName: string;
  output: {
    fileType: 'MP4' | 'WEBM';
    filepath: string;
  };
}

export interface StopRecordingInput {
  roomName: string;
}

// ===== RESPONSE TYPES =====

export interface MessageResponse {
  success: boolean;
  message: string;
}

export interface ParticipantMessageResponse {
  success: boolean;
  message: string;
}

export interface ChatMessageResponse {
  success: boolean;
  message: string;
}

export interface WaitingRoomResponse {
  success: boolean;
  message: string;
  participantId?: string;
  waitingRoomStatus?: string;
  deviceTestResults?: {
    mic: DeviceTestResult;
    camera: DeviceTestResult;
    speaker: DeviceTestResult;
  };
}

export interface DeviceTestResult {
  isWorking: boolean;
  deviceName: string;
  volumeLevel?: number;
  errorMessage?: string;
}

export interface WaitingParticipant {
  _id: string;
  displayName: string;
  userId?: string;
  joinedAt: Date;
  status: 'WAITING' | 'APPROVED' | 'REJECTED' | 'ADMITTED' | 'LEFT';
  micState: 'ON' | 'OFF' | 'MUTED' | 'MUTED_BY_HOST';
  cameraState: 'ON' | 'OFF' | 'OFF_BY_HOST';
}

export interface WaitingRoomStats {
  totalWaiting: number;
  approvedCount: number;
  rejectedCount: number;
  admittedCount: number;
  averageWaitTime: number;
}
