// ===== APOLLO USAGE EXAMPLES =====

import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  // Auth
  GET_CURRENT_USER, 
  LOGIN, 
  SIGNUP,
  
  // Participants
  GET_PARTICIPANTS_BY_MEETING,
  FORCE_MUTE_PARTICIPANT,
  TRANSFER_HOST,
  
  // VOD
  GET_ALL_VODS,
  UPLOAD_VOD_FILE,
  
  // Chat
  GET_CHAT_HISTORY,
  
  // LiveKit
  GET_LIVEKIT_TOKEN,
  START_RECORDING,
  
  // Types
  type User,
  type Participant,
  type Vod
} from '../index';

// ===== AUTHENTICATION EXAMPLES =====

export const useAuth = () => {
  const { data: user, loading, error } = useQuery(GET_CURRENT_USER);
  const [login] = useMutation(LOGIN);
  const [signup] = useMutation(SIGNUP);
  
  return {
    user: user?.me as User | undefined,
    loading,
    error,
    login,
    signup
  };
};

// ===== PARTICIPANT EXAMPLES =====

export const useParticipants = (meetingId: string) => {
  const { data, loading, error } = useQuery(GET_PARTICIPANTS_BY_MEETING, {
    variables: { meetingId }
  });
  
  const [forceMute] = useMutation(FORCE_MUTE_PARTICIPANT);
  const [transferHost] = useMutation(TRANSFER_HOST);
  
  const handleForceMute = async (participantId: string, track: 'MIC' | 'CAMERA' | 'SCREEN') => {
    try {
      await forceMute({
        variables: {
          input: {
            meetingId,
            participantId,
            track,
            reason: 'Host requested mute'
          }
        }
      });
    } catch (err) {
      console.error('Failed to mute participant:', err);
    }
  };
  
  const handleTransferHost = async (newHostParticipantId: string) => {
    try {
      await transferHost({
        variables: {
          input: {
            meetingId,
            newHostParticipantId,
            reason: 'Host transferring control'
          }
        }
      });
    } catch (err) {
      console.error('Failed to transfer host:', err);
    }
  };
  
  return {
    participants: data?.getParticipantsByMeeting as Participant[] || [],
    loading,
    error,
    forceMute: handleForceMute,
    transferHost: handleTransferHost
  };
};

// ===== VOD EXAMPLES =====

export const useVODs = () => {
  const { data, loading, error } = useQuery(GET_ALL_VODS);
  const [uploadVod] = useMutation(UPLOAD_VOD_FILE);
  
  const handleUpload = async (file: File, title: string, meetingId?: string) => {
    try {
      const { data: result } = await uploadVod({
        variables: {
          file,
          title,
          meetingId,
          notes: 'Uploaded via Apollo client'
        }
      });
      
      console.log('Upload successful:', result?.uploadVodFile);
      return result?.uploadVodFile;
    } catch (err) {
      console.error('Upload failed:', err);
      throw err;
    }
  };
  
  return {
    vods: data?.getAllVods as Vod[] || [],
    loading,
    error,
    uploadVod: handleUpload
  };
};

// ===== CHAT EXAMPLES =====

export const useChat = (meetingId: string) => {
  const { data, loading, error } = useQuery(GET_CHAT_HISTORY, {
    variables: { meetingId, limit: 50 }
  });
  
  return {
    messages: data?.getChatHistory || [],
    loading,
    error
  };
};

// ===== LIVEKIT EXAMPLES =====

export const useLiveKit = () => {
  const [getToken] = useMutation(GET_LIVEKIT_TOKEN);
  const [startRecording] = useMutation(START_RECORDING);
  
  const getLiveKitToken = async (roomName: string, participantName: string, meetingRole: string) => {
    try {
      const { data } = await getToken({
        variables: {
          input: {
            roomName,
            participantName,
            meetingRole
          }
        }
      });
      
      return data?.createLivekitToken;
    } catch (err) {
      console.error('Failed to get LiveKit token:', err);
      throw err;
    }
  };
  
  const startMeetingRecording = async (roomName: string) => {
    try {
      const { data } = await startRecording({
        variables: {
          input: {
            roomName,
            output: {
              fileType: 'MP4',
              filepath: `/recordings/${roomName}-${Date.now()}.mp4`
            }
          }
        }
      });
      
      console.log('Recording started:', data?.startRecording);
      return data?.startRecording;
    } catch (err) {
      console.error('Failed to start recording:', err);
      throw err;
    }
  };
  
  return {
    getLiveKitToken,
    startRecording: startMeetingRecording
  };
};

// ===== REACT COMPONENT EXAMPLES =====

export const ExampleComponents = {
  // Login Component
  LoginForm: () => {
    const { login, loading } = useAuth();
    
    const handleSubmit = async (email: string, password: string) => {
      try {
        const { data } = await login({
          variables: { email, password }
        });
        
        if (data?.login?.success) {
          console.log('Login successful:', data.login.user);
          // Redirect or update UI
        }
      } catch (err) {
        console.error('Login failed:', err);
      }
    };
    
    return { handleSubmit, loading };
  },
  
  // Participants List Component
  ParticipantsList: ({ meetingId }: { meetingId: string }) => {
    const { participants, forceMute, transferHost, loading } = useParticipants(meetingId);
    
    return {
      participants,
      forceMute,
      transferHost,
      loading
    };
  },
  
  // VOD Manager Component
  VODManager: () => {
    const { vods, uploadVod, loading } = useVODs();
    
    return {
      vods,
      uploadVod,
      loading
    };
  }
};

// ===== UTILITY FUNCTIONS =====

export const apolloUtils = {
  // Format participant data for display
  formatParticipant: (participant: Participant) => ({
    id: participant._id,
    name: participant.displayName,
    role: participant.role,
    isMuted: participant.micState === 'MUTED' || participant.micState === 'MUTED_BY_HOST',
    isCameraOff: participant.cameraState === 'OFF' || participant.cameraState === 'OFF_BY_HOST',
    status: participant.status,
    duration: participant.totalDurationSec
  }),
  
  // Format VOD data for display
  formatVOD: (vod: Vod) => ({
    id: vod._id,
    title: vod.title,
    duration: vod.durationSec ? `${Math.floor(vod.durationSec / 60)}:${(vod.durationSec % 60).toString().padStart(2, '0')}` : 'Unknown',
    size: vod.sizeBytes ? `${(vod.sizeBytes / 1024 / 1024).toFixed(2)} MB` : 'Unknown',
    url: vod.url,
    createdAt: new Date(vod.createdAt).toLocaleDateString()
  }),
  
  // Check if user can perform action
  canPerformAction: (user: User, action: string) => {
    switch (action) {
      case 'forceMute':
      case 'transferHost':
        return user.systemRole === 'ADMIN' || user.systemRole === 'TUTOR';
      case 'uploadVOD':
        return user.systemRole === 'ADMIN' || user.systemRole === 'TUTOR';
      case 'deleteMessage':
        return user.systemRole === 'ADMIN' || user.systemRole === 'TUTOR';
      default:
        return false;
    }
  }
};
