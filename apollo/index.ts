// ===== APOLLO GRAPHQL EXPORTS =====

// Client
export { default as apolloClient, setAuthToken, getAuthToken, clearAuthToken, isAuthenticated, getUserFromToken } from './client';

// Types
export * from './types';

// Auth (selective exports to avoid conflicts)
export { GET_CURRENT_USER, GET_ALL_MEMBERS, GET_MEMBER_BY_ID } from './auth/queries';
export * from './auth/mutations';

// Livestream (Primary exports - used by main application)
// Export queries first
export * from './livestream/queries';

// Export only mutations (not queries) from mutations file to avoid duplicates
export {
  // Meetings
  START_MEETING,
  END_MEETING,
  TRANSFER_HOST,
  TRANSFER_HOST_AND_LEAVE,
  UPDATE_SESSION,
  // Participants
  APPROVE_PARTICIPANT,
  REJECT_PARTICIPANT,
  REMOVE_PARTICIPANT,
  FORCE_MUTE,
  FORCE_CAMERA_OFF,
  JOIN_MEETING,
  LEAVE_MEETING,
  // Hand Raise
  RAISE_HAND,
  LOWER_HAND,
  HOST_LOWER_HAND,
  LOWER_ALL_HANDS,
  // Chat
  DELETE_CHAT_MESSAGE,
  // Subscriptions
  MEETING_UPDATED,
  PARTICIPANT_JOINED,
  PARTICIPANT_LEFT,
  PARTICIPANT_UPDATED,
  HAND_RAISED,
  HAND_LOWERED,
  CHAT_MESSAGE_ADDED
} from './livestream/mutations';

// Note: To avoid duplicate export conflicts, other apollo folders (chat, vod, meeting, 
// participants, admin, member, livekit) are not exported here. The livestream module contains
// all necessary exports including LiveKit token generation. If you need specific queries/mutations 
// from other folders, import them directly from their respective paths.
