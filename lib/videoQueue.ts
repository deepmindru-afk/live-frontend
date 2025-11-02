/**
 * Video Queue Management System
 * 
 * Purpose: Manages the order and display priority of video participants
 * for both thumbnail grid and main video stage
 * 
 * Queue Priority Rules:
 * 1. Host always stays first (position 0)
 * 2. Second position: Speaking participant
 * 3. Third position: Hand-raised participants (oldest to newest by who raised first)
 * 4. Fourth: Participants with camera ON (sorted by join time)
 * 5. Last: Participants with camera OFF (sorted by join time)
 */

export interface VideoQueueConfig {
  // Configuration options can be added here in the future
}

// Participant interface definition (to avoid circular dependency)
export interface Participant {
  _id: string;
  displayName: string;
  email: string;
  isMuted: boolean;
  isCameraOff: boolean;
  joinedAt: string;
  isHost?: boolean;
  role?: 'HOST' | 'PARTICIPANT';
  hasHandRaised?: boolean;
  handRaisedAt?: string;
  isSpeaking?: boolean;
  audioLevel?: number;
  lastActivity?: string;
  originalJoinOrder?: number;
  identity?: string;
  backendId?: string;
  user?: {
    _id: string;
    displayName?: string;
    email?: string;
  };
  userId?: string;
}

/**
 * Sorts participants for thumbnail display according to priority rules:
 * 1. Host first
 * 2. Speaking participants next
 * 3. Hand-raised participants (oldest first)
 * 4. Camera ON participants (earlier join first)
 * 5. Camera OFF participants (earlier join first)
 */
export function sortThumbnailQueue(participants: Participant[]): Participant[] {
  if (!participants || participants.length === 0) {
    return [];
  }

  // Separate host from other participants
  const host = participants.find(p => p.isHost);
  const nonHosts = participants.filter(p => !p.isHost);

  // Sort non-host participants by priority
  const sortedNonHosts = [...nonHosts].sort((a, b) => {
    // Priority 1: Speaking participants come first
    if (a.isSpeaking && !b.isSpeaking) return -1;
    if (!a.isSpeaking && b.isSpeaking) return 1;
    
    // Priority 2: If both speaking, check hand raise status
    if (a.isSpeaking && b.isSpeaking) {
      if (a.hasHandRaised && !b.hasHandRaised) return -1;
      if (!a.hasHandRaised && b.hasHandRaised) return 1;
      if (a.hasHandRaised && b.hasHandRaised) {
        // Sort by handRaisedAt (oldest first)
        const timeA = new Date(a.handRaisedAt || '').getTime();
        const timeB = new Date(b.handRaisedAt || '').getTime();
        if (!isNaN(timeA) && !isNaN(timeB)) return timeA - timeB;
        return 0;
      }
    }

    // Priority 3: If neither speaking, check hand raise
    if (!a.isSpeaking && !b.isSpeaking) {
      if (a.hasHandRaised && !b.hasHandRaised) return -1;
      if (!a.hasHandRaised && b.hasHandRaised) return 1;
      if (a.hasHandRaised && b.hasHandRaised) {
        // Sort by handRaisedAt (oldest first)
        const timeA = new Date(a.handRaisedAt || '').getTime();
        const timeB = new Date(b.handRaisedAt || '').getTime();
        if (!isNaN(timeA) && !isNaN(timeB)) return timeA - timeB;
        return 0;
      }
    }

    // Priority 4: Sort by camera status (ON before OFF)
    if (!a.isCameraOff && b.isCameraOff) return -1;
    if (a.isCameraOff && !b.isCameraOff) return 1;

    // Priority 5: Sort by join time (earlier join first)
    const joinTimeA = new Date(a.joinedAt || '').getTime();
    const joinTimeB = new Date(b.joinedAt || '').getTime();
    if (!isNaN(joinTimeA) && !isNaN(joinTimeB)) {
      return joinTimeA - joinTimeB;
    }

    // Fallback: maintain original order
    return 0;
  });

  // Return host first, then sorted non-hosts
  if (host) {
    return [host, ...sortedNonHosts];
  }
  
  return sortedNonHosts;
}

/**
 * Determines the main stage participant based on priority rules:
 * 1. Screen sharing participant (highest priority)
 * 2. Speaking participant
 * 3. Host (if no speaker)
 * 4. Most active participant (hand raised, camera on, etc.)
 * 
 * @param participants - All participants
 * @param screenShareParticipantId - ID of participant currently screen sharing (optional)
 * @returns Main stage participant or null
 */
export function getMainStageParticipant(
  participants: Participant[], 
  screenShareParticipantId?: string | null
): Participant | null {
  if (!participants || participants.length === 0) {
    return null;
  }

  // Priority 1: Screen sharing participant
  if (screenShareParticipantId) {
    const screenSharer = participants.find(
      p => p._id === screenShareParticipantId || p.identity === screenShareParticipantId || p.userId === screenShareParticipantId
    );
    if (screenSharer) {
      return screenSharer;
    }
  }

  // Priority 2: Speaking participant
  const speakers = participants.filter(p => p.isSpeaking);
  if (speakers.length > 0) {
    // If multiple speakers, prioritize by:
    // 1. Hand-raised speakers (oldest first)
    // 2. Audio level (louder first)
    // 3. Most recent activity
    const sortedSpeakers = speakers.sort((a, b) => {
      if (a.hasHandRaised && !b.hasHandRaised) return -1;
      if (!a.hasHandRaised && b.hasHandRaised) return 1;
      if (a.hasHandRaised && b.hasHandRaised) {
        const timeA = new Date(a.handRaisedAt || '').getTime();
        const timeB = new Date(b.handRaisedAt || '').getTime();
        if (!isNaN(timeA) && !isNaN(timeB)) return timeA - timeB;
      }
      
      const audioDiff = (b.audioLevel || 0) - (a.audioLevel || 0);
      if (Math.abs(audioDiff) > 5) return audioDiff;
      
      const aActivity = new Date(a.lastActivity || a.joinedAt).getTime();
      const bActivity = new Date(b.lastActivity || b.joinedAt).getTime();
      return bActivity - aActivity;
    });
    return sortedSpeakers[0];
  }

  // Priority 3: Host
  const host = participants.find(p => p.isHost);
  if (host) {
    return host;
  }

  // Priority 4: Most active participant (follow thumbnail priority)
  const sorted = sortThumbnailQueue(participants);
  return sorted.length > 0 ? sorted[0] : null;
}

/**
 * VideoQueue Class for managing participant queue with advanced features
 */
export class VideoQueue {
  private participants: Participant[] = [];

  constructor(config?: VideoQueueConfig) {
    // Future configuration can be applied here
  }

  /**
   * Add or update participants in the queue
   */
  updateParticipants(newParticipants: Participant[]): void {
    this.participants = [...newParticipants];
  }

  /**
   * Get sorted participants for thumbnail display
   */
  getSortedForThumbnails(): Participant[] {
    return sortThumbnailQueue(this.participants);
  }

  /**
   * Get the main stage participant based on priority rules
   */
  getMainStageParticipant(screenShareParticipantId?: string | null): Participant | null {
    return getMainStageParticipant(this.participants, screenShareParticipantId);
  }

  /**
   * Get thumbnail participants (excluding main stage)
   */
  getThumbnailParticipants(): Participant[] {
    const sorted = this.getSortedForThumbnails();
    return sorted.slice(1); // Skip the first one (main stage)
  }

  /**
   * Get participant by ID
   */
  getParticipantById(participantId: string): Participant | undefined {
    return this.participants.find(p => p._id === participantId || p.userId === participantId);
  }
}

