import { useQuery } from '@apollo/client/react';
import { 
  GET_MEETING_INFO,
  GET_PARTICIPANTS,
  GET_WAITING_PARTICIPANTS,
  GET_CHAT_HISTORY,
  GET_RECORDING_INFO,
  GET_PARTICIPANT_STATS
} from '../graphql/live-room-queries';

export interface LiveRoomData {
  meeting: any;
  participants: any[];
  waitingParticipants: any[];
  chatMessages: any[];
  recording: any;
  stats: any;
  loading: boolean;
  error: any;
}

export const useLiveRoomData = (meetingId: string): LiveRoomData => {
  // Meeting data - poll every 10 seconds
  const { data: meetingData, loading: meetingLoading, error: meetingError } = useQuery(GET_MEETING_INFO, {
    variables: { meetingId },
    pollInterval: 10000,
    errorPolicy: 'all',
    onError: (error: any) => {
      console.error('Error fetching meeting data:', error);
    }
  });

  // Participants data - poll every 3 seconds for real-time updates
  const { data: participantsData, loading: participantsLoading, error: participantsError } = useQuery(GET_PARTICIPANTS, {
    variables: { meetingId },
    pollInterval: 3000,
    errorPolicy: 'all',
    onError: (error: any) => {
      console.error('Error fetching participants:', error);
    }
  });

  // Waiting participants - poll every 5 seconds
  const { data: waitingData, loading: waitingLoading, error: waitingError } = useQuery(GET_WAITING_PARTICIPANTS, {
    variables: { meetingId },
    pollInterval: 5000,
    errorPolicy: 'all',
    onError: (error: any) => {
      console.error('Error fetching waiting participants:', error);
    }
  });

  // Chat history - poll every 2 seconds for real-time chat
  const { data: chatData, loading: chatLoading, error: chatError } = useQuery(GET_CHAT_HISTORY, {
    variables: { 
      input: { 
        meetingId, 
        limit: 50, 
        offset: 0 
      } 
    },
    pollInterval: 2000,
    errorPolicy: 'all',
    onError: (error: any) => {
      console.error('Error fetching chat history:', error);
    }
  });

  // Recording info - poll every 10 seconds
  const { data: recordingData, loading: recordingLoading, error: recordingError } = useQuery(GET_RECORDING_INFO, {
    variables: { input: { meetingId } },
    pollInterval: 10000,
    errorPolicy: 'all',
    onError: (error: any) => {
      console.error('Error fetching recording info:', error);
    }
  });

  // Participant stats - poll every 15 seconds
  const { data: statsData, loading: statsLoading, error: statsError } = useQuery(GET_PARTICIPANT_STATS, {
    variables: { meetingId },
    pollInterval: 15000,
    errorPolicy: 'all',
    onError: (error: any) => {
      console.error('Error fetching participant stats:', error);
    }
  });

  const loading = meetingLoading || participantsLoading || waitingLoading || chatLoading || recordingLoading || statsLoading;
  const error = meetingError || participantsError || waitingError || chatError || recordingError || statsError;

  return {
    meeting: meetingData?.getMeetingById,
    participants: participantsData?.getParticipantsByMeeting || [],
    waitingParticipants: waitingData?.getWaitingParticipants || [],
    chatMessages: (() => {
      try {
        const messages = chatData?.getChatHistory?.messages;
        return Array.isArray(messages) ? messages : [];
      } catch (error) {
        console.error('Error processing chat messages:', error);
        return [];
      }
    })(),
    recording: recordingData?.getRecordingInfo,
    stats: statsData?.getParticipantStats,
    loading,
    error
  };
};