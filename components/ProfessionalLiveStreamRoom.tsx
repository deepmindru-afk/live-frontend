import React, { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { isAuthenticated, getCurrentUser } from '../lib/simple-auth-handlers';
import { useWebSocketChat } from '../hooks/useWebSocketChat';
import { useHandRaise } from '../hooks/useHandRaise';
import Swal from 'sweetalert2';
import { GET_MEETING_BY_ID } from '../apollo/livestream/queries';
import {
  GET_PARTICIPANTS_BY_MEETING,
  GET_WAITING_PARTICIPANTS,
  START_MEETING,
  END_MEETING,
  JOIN_MEETING,
  LEAVE_MEETING,
  APPROVE_PARTICIPANT,
  REJECT_PARTICIPANT,
  RAISE_HAND,
  LOWER_HAND,
  TRANSFER_HOST,
  TRANSFER_HOST_AND_LEAVE,
  REMOVE_PARTICIPANT,
} from '../apollo/livestream/mutations';
import ParticipantView from './ParticipantView';
import ChatView from './ChatView';
import WebSocketChatView from './WebSocketChatView';
import ChatDebug from './ChatDebug';
import MinimalistChat from './MinimalistChat';

// Additional mutations for leave functionality
const FORCE_LEAVE_MEETING = gql`
  mutation ForceLeaveMeeting($meetingId: ID!) {
    forceLeaveMeeting(meetingId: $meetingId)
  }
`;

const GET_PARTICIPANT_BY_USER_MEETING = gql`
  query GetParticipantByUserAndMeeting($meetingId: ID!) {
    getParticipantByUserAndMeeting(meetingId: $meetingId) {
      _id
      displayName
      role
      micState
      cameraState
      user {
        _id
        displayName
        email
      }
    }
  }
`;

interface ProfessionalLiveStreamRoomProps {
  meetingId?: string;
  role?: 'HOST' | 'PARTICIPANT';
  userId?: string;
}

const ProfessionalLiveStreamRoom: React.FC<ProfessionalLiveStreamRoomProps> = memo(({
  meetingId: propMeetingId,
  role = 'HOST',
  userId = 'p1'
}) => {
  // State management
  const [actualMeetingId, setActualMeetingId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('participants');
  const [isRecording, setIsRecording] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHandsCount, setRaisedHandsCount] = useState(0);
  const [raisedHands, setRaisedHands] = useState<{[participantId: string]: boolean}>({});
  const [isAuth, setIsAuth] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [actualUserId, setActualUserId] = useState<string>('');
  const [currentParticipant, setCurrentParticipant] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<any[]>([]);
  const [meetingStatus, setMeetingStatus] = useState<string>('CREATED');
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  
  // GraphQL Queries
  const { data: meetingData, loading: meetingLoading, error: meetingError, refetch: refetchMeeting } = useQuery(GET_MEETING_BY_ID, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    pollInterval: 2000,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all'
  });

  const { data: participantsData, loading: participantsLoading, error: participantsError, refetch: refetchParticipants } = useQuery(GET_PARTICIPANTS_BY_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    pollInterval: 1500,
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false
  });

  const { data: waitingData, loading: waitingLoading, error: waitingError } = useQuery(GET_WAITING_PARTICIPANTS, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !isAuth,
    pollInterval: 2000,
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false
  });

  const { data: currentParticipantData, loading: currentParticipantLoading, error: currentParticipantError, refetch: refetchCurrentParticipant } = useQuery(GET_PARTICIPANT_BY_USER_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !isAuth,
    pollInterval: 1000,
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false
  });

  // GraphQL Mutations
  const [startMeeting] = useMutation(START_MEETING);
  const [endMeeting] = useMutation(END_MEETING);
  const [joinMeeting] = useMutation(JOIN_MEETING);
  const [leaveMeeting] = useMutation(LEAVE_MEETING);
  const [forceLeaveMeeting] = useMutation(FORCE_LEAVE_MEETING);
  const [approveParticipant] = useMutation(APPROVE_PARTICIPANT);
  const [rejectParticipant] = useMutation(REJECT_PARTICIPANT);
  const [raiseHand] = useMutation(RAISE_HAND);
  const [lowerHand] = useMutation(LOWER_HAND);
  const [transferHost] = useMutation(TRANSFER_HOST);
  const [removeParticipant] = useMutation(REMOVE_PARTICIPANT);

  // WebSocket connection for real-time features
  const { socket, isConnected: wsConnected } = useWebSocketChat({
    meetingId: actualMeetingId,
    token: currentUser?.token || '',
    onMessage: (message) => {
      console.log('📨 Chat message received:', message);
    },
    onParticipantJoined: (participant) => {
      console.log('👋 Participant joined:', participant);
    },
    onParticipantLeft: (participant) => {
      console.log('👋 Participant left:', participant);
    },
    onError: (error) => {
      console.error('🔌 WebSocket error:', error);
    },
    // Hand raise events are handled through participants data changes
  });

  // Debug WebSocket connection
  useEffect(() => {
    console.log('🔌 WebSocket Debug:', {
      socket: !!socket,
      isConnected: wsConnected,
      token: currentUser?.token ? 'present' : 'missing',
      currentUser: currentUser ? 'present' : 'missing',
      meetingId: actualMeetingId
    });
  }, [socket, wsConnected, currentUser, actualMeetingId]);

  // Hand raise functionality
  const { raisedHands: wsRaisedHands, myHandRaised: wsMyHandRaised, raiseHand: wsRaiseHand, lowerHand: wsLowerHand } = useHandRaise({
    socket,
    isConnected: wsConnected,
    meetingId: actualMeetingId,
    participantId: currentParticipant?._id || '',
    isHost: currentParticipant?.role === 'HOST',
    onHandRaised: (info) => {
      console.log('✋ Hand raised:', info);
      setRaisedHands(prev => ({
        ...prev,
        [info.participantId]: true
      }));
    },
    onHandLowered: (info) => {
      console.log('✋ Hand lowered:', info);
      setRaisedHands(prev => {
        const newState = { ...prev };
        delete newState[info.participantId];
        return newState;
      });
    },
    onHandLoweredByHost: (info) => {
      console.log('✋ Hand lowered by host:', info);
      setRaisedHands(prev => {
        const newState = { ...prev };
        delete newState[info.participantId];
        return newState;
      });
    },
    onAllHandsLowered: (info) => {
      console.log('✋ All hands lowered:', info);
      setRaisedHands({});
    },
    onError: (error) => {
      console.error('✋ Hand raise error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Hand Raise Error',
        text: error
      });
    }
  });

  // Initialize meeting ID and authentication
  useEffect(() => {
    const initializeMeeting = async () => {
      try {
        const meetingIdToUse = propMeetingId || 'DEMO123';
        setActualMeetingId(meetingIdToUse);

        const authStatus = await isAuthenticated();
        setIsAuth(authStatus);
        
        if (authStatus) {
          const user = await getCurrentUser();
            setCurrentUser(user);
          setActualUserId(user?.id || userId);
          } else {
          const mockUser = {
            id: userId,
            displayName: role === 'HOST' ? 'Host User' : 'Participant User',
            email: role === 'HOST' ? 'host@demo.com' : 'participant@demo.com',
            role: role,
            token: 'mock-token'
          };
          setCurrentUser(mockUser);
          setActualUserId(userId);
        }
        
        setAuthComplete(true);
        setLoading(false);
    } catch (error) {
        console.error('Error initializing meeting:', error);
        setLoading(false);
      }
    };

    initializeMeeting();
  }, [propMeetingId, userId, role]);

  // Update meeting data
  useEffect(() => {
    if (meetingData && typeof meetingData === 'object' && 'getMeetingById' in meetingData && meetingData.getMeetingById) {
      const meeting = meetingData.getMeetingById as any;
      setMeetingStatus(meeting.status || 'CREATED');
      setIsLive(meeting.status === 'LIVE');
    }
  }, [meetingData]);

  // Auto-redirect when meeting ends
  useEffect(() => {
    if (meetingStatus === 'ENDED') {
      // Auto-redirect all participants to dashboard when meeting ends
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }
  }, [meetingStatus]);

  // Handle GraphQL errors
  useEffect(() => {
    if (meetingError) {
      console.error('GraphQL Meeting Error:', meetingError);
      // If there's a GraphQL error, it might be because the meeting ended
      // Check if the error is related to null title field
      if (meetingError.message.includes('Cannot return null for non-nullable field MeetingWithHost.title')) {
        console.log('Meeting ended - title field is null, redirecting to dashboard');
        setMeetingStatus('ENDED');
        setIsLive(false);
        // Auto-redirect to dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      }
    }
  }, [meetingError]);

  // Update participants data
  useEffect(() => {
    if (participantsData && typeof participantsData === 'object' && 'getParticipantsByMeeting' in participantsData && participantsData.getParticipantsByMeeting) {
      const participantsList = participantsData.getParticipantsByMeeting as any[];
      const previousParticipants = participants;
      
      setParticipants(participantsList);
      
      const raisedCount = participantsList.filter((p: any) => p.hasHandRaised).length;
      setRaisedHandsCount(raisedCount);

      // Check for new participants (joined)
      if (previousParticipants.length > 0) {
        const newParticipants = participantsList.filter((newP: any) => 
          !previousParticipants.find((oldP: any) => oldP._id === newP._id)
        );
        
        newParticipants.forEach((participant: any) => {
          console.log('🎉 New participant joined meeting:', participant);
          // This will be handled by the chat component
        });

        // Check for left participants
        const leftParticipants = previousParticipants.filter((oldP: any) => 
          !participantsList.find((newP: any) => newP._id === oldP._id)
        );
        
        leftParticipants.forEach((participant: any) => {
          console.log('👋 Participant left meeting:', participant);
          // This will be handled by the chat component
        });
      }
    }
  }, [participantsData, participants]);

  // Update waiting participants data
  useEffect(() => {
    if (waitingData && typeof waitingData === 'object' && 'getWaitingParticipants' in waitingData && waitingData.getWaitingParticipants) {
      setWaitingParticipants(waitingData.getWaitingParticipants as any[]);
    }
  }, [waitingData]);

  // Update current participant data
  useEffect(() => {
    if (currentParticipantData && typeof currentParticipantData === 'object' && 'getParticipantByUserAndMeeting' in currentParticipantData && currentParticipantData.getParticipantByUserAndMeeting) {
      setCurrentParticipant(currentParticipantData.getParticipantByUserAndMeeting as any);
    }
  }, [currentParticipantData]);

  // Event handlers
  const handleStartMeeting = async () => {
    try {
        await startMeeting({
        variables: { meetingId: actualMeetingId }
        });
        setMeetingStatus('LIVE');
        setIsLive(true);
      Swal.fire({
        icon: 'success',
        title: 'Meeting Started',
        text: 'The meeting has been started successfully!',
        timer: 2000,
        showConfirmButton: false
      });
      } catch (error) {
      console.error('Error starting meeting:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to start the meeting. Please try again.'
      });
    }
  };

  const handleEndMeeting = async () => {
    try {
      await endMeeting({
        variables: { meetingId: actualMeetingId }
      });
      setMeetingStatus('ENDED');
      setIsLive(false);
      
      // Auto-redirect to dashboard immediately without showing success message
      // This ensures all participants are redirected automatically
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (error) {
      console.error('Error ending meeting:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to end the meeting. Please try again.'
      });
    }
  };

  const handleLeaveMeeting = async () => {
    // Only show host options if user is actually a host based on participant data
    if (currentParticipant?.role === 'HOST') {
        await handleForceExit();
    } else {
      // All other users (participants) get simple leave dialog
      await handleParticipantLeave();
    }
  };

  const handleParticipantLeave = async () => {
    try {
      const result = await Swal.fire({
        title: 'Leave Meeting',
        text: 'Do you want to leave the meeting?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
      });

            if (result.isConfirmed) {
        // Check if we have current participant data
        if (!currentParticipant?._id) {
          console.error('No current participant found');
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Unable to leave meeting. Please refresh and try again.'
          });
          return;
        }

      await leaveMeeting({
        variables: { 
          input: { 
              participantId: currentParticipant._id
          }
        }
      });
      
        // Auto-redirect immediately after leaving
      setTimeout(() => {
        window.location.href = '/';
        }, 500);
      }
              } catch (error) {
      console.error('Error leaving meeting:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to leave the meeting. Please try again.'
      });
    }
  };

  const handleTransferHost = async () => {
    try {
        const nonHostParticipants = participants.filter(p => p.role !== 'HOST');
      
      if (nonHostParticipants.length === 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'No Participants',
          text: 'There are no other participants to transfer host role to.',
          confirmButtonText: 'OK'
        });
        return;
      }

      // Create participant selection options
      const participantOptions = nonHostParticipants.map((participant, index) => ({
        value: participant._id,
        text: `${participant.displayName || participant.user?.displayName || 'Participant'} (${participant.user?.email || 'participant@demo.com'})`
      }));

      const { value: selectedParticipantId } = await Swal.fire({
          title: 'Transfer Host Role',
        text: 'Select the participant who will become the new host:',
        icon: 'question',
        input: 'select',
        inputOptions: participantOptions.reduce((acc, option) => {
          acc[option.value] = option.text;
          return acc;
        }, {} as Record<string, string>),
        inputPlaceholder: 'Choose a participant...',
          showCancelButton: true,
        confirmButtonText: 'Transfer Host',
          cancelButtonText: 'Cancel',
            confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        inputValidator: (value) => {
          if (!value) {
            return 'You need to select a participant!';
          }
          return null;
        }
      });

      if (selectedParticipantId) {
        const selectedParticipant = nonHostParticipants.find(p => p._id === selectedParticipantId);
        
        if (selectedParticipant) {
          // First transfer the host role
          await transferHost({
              variables: {
              input: {
                  meetingId: actualMeetingId,
                newHostParticipantId: selectedParticipantId,
                reason: 'Host transferring role'
              }
            }
          });

          // Refetch data to update host status
          await Promise.all([
            refetchCurrentParticipant(),
            refetchParticipants()
          ]);

          // Then leave the meeting
          await leaveMeeting({
            variables: { 
              input: { 
                participantId: currentParticipant._id
              }
              }
            });
            
            Swal.fire({
              icon: 'success',
              title: 'Host Transferred',
            text: `Host role has been transferred to ${selectedParticipant.displayName || selectedParticipant.user?.displayName || 'the selected participant'}.`,
              timer: 2000,
              showConfirmButton: false
            });
            
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
          }
      }
    } catch (error) {
      console.error('Error during host transfer:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to transfer host role. Please try again.'
      });
    }
  };

  const handleForceExit = async () => {
    try {
      if (isHost && participants.length > 1) {
        // Show options for host
        const result = await Swal.fire({
          title: 'Exit Meeting',
          text: 'As the host, you can end the meeting for everyone or transfer host role:',
          icon: 'question',
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: 'End Meeting for All',
          denyButtonText: 'Transfer Host & Leave',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#dc3545',
          denyButtonColor: '#6c757d',
          cancelButtonColor: '#007bff'
        });

        if (result.isConfirmed) {
          await handleEndMeeting();
        } else if (result.isDenied) {
          await handleTransferHost();
        }
      } else if (isHost) {
        // Host with no other participants - just end meeting
        await handleEndMeeting();
      }
    } catch (error) {
      console.error('Error during force exit:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to leave the meeting. Please try again.'
      });
    }
  };

  const handleMicToggle = async () => {
    setMicEnabled(!micEnabled);
    console.log('Mic toggled:', !micEnabled);
  };

  const handleCameraToggle = async () => {
    setCameraEnabled(!cameraEnabled);
    console.log('Camera toggled:', !cameraEnabled);
  };

  const handleScreenShareToggle = async () => {
    setScreenSharing(!screenSharing);
    console.log('Screen share toggled:', !screenSharing);
  };

  const handleRaiseHand = async () => {
    try {
      if (!currentParticipant?._id) {
        console.error('No current participant found');
              return;
            }
          
      if (wsMyHandRaised) {
        // Use WebSocket-based hand lower
        wsLowerHand('Lowered by user');
        setHandRaised(false);
      } else {
        // Use WebSocket-based hand raise
        wsRaiseHand('Student needs help');
        setHandRaised(true);
      }
    } catch (error) {
      console.error('Error toggling hand raise:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to toggle hand raise. Please try again.'
      });
    }
  };

  const handleKickParticipant = async (participantId: string) => {
    try {
      console.log('=== KICK PARTICIPANT DEBUG ===');
      console.log('Attempting to kick participant:', participantId);
      console.log('Current user isHost:', isHost);
      console.log('Current participant:', currentParticipant);
      console.log('Current participant role:', currentParticipant?.role);
      console.log('Current participant ID:', currentParticipant?._id);
      console.log('Current user data:', currentUser);
      console.log('Current user ID:', currentUser?.id);
      console.log('Current user _id:', currentUser?._id);
      console.log('Meeting ID:', actualMeetingId);
      console.log('All participants:', participants);
      console.log('Participants with HOST role:', participants.filter(p => p.role === 'HOST'));
      console.log('Expected currentHostId from DB: 68d9e0cfc34987bba949048a');
      console.log('===============================');
      
      // Refresh current participant data to ensure we have the latest role
      console.log('🔄 Refreshing current participant data...');
      const refreshResult = await refetchCurrentParticipant();
      console.log('🔄 Refresh result:', refreshResult);
      
      // Get the updated participant data
      const updatedParticipant = (refreshResult.data as any)?.getParticipantByUserAndMeeting;
      console.log('🔄 Updated participant data:', updatedParticipant);
      
      // Double-check if user is actually a host after refresh
      const updatedIsHost = updatedParticipant?.role === 'HOST';
      console.log('🔄 Updated isHost status:', updatedIsHost);
      console.log('🔄 Updated participant role:', updatedParticipant?.role);
      
      if (!updatedIsHost) {
        console.log('❌ User is not recognized as host after refresh, cannot kick participant');
        Swal.fire({
          icon: 'error',
          title: 'Permission Denied',
          text: 'Only the meeting host can remove participants.'
        });
        return;
      }
      
      console.log('✅ User is recognized as host, proceeding with kick...');
      console.log('🔄 About to call removeParticipant with participantId:', participantId);
      
      // Check if current user ID matches the currentHostId from database
      const currentUserId = currentUser?.id || currentUser?._id;
      const expectedCurrentHostId = meeting?.currentHostId;
      console.log('🔍 Current user ID from frontend:', currentUserId);
      console.log('🔍 Expected currentHostId from DB:', expectedCurrentHostId);
      console.log('🔍 IDs match:', currentUserId === expectedCurrentHostId);
      console.log('🔍 Meeting data:', meeting);
      console.log('🔍 Meeting hostId (original):', meeting?.hostId);
      console.log('🔍 Meeting currentHostId (transferred):', meeting?.currentHostId);
      console.log('🔍 Is current user the original host?', currentUserId === meeting?.hostId);
      console.log('🔍 Is current user the current host?', currentUserId === meeting?.currentHostId);
      console.log('🔍 Expected original hostId from DB: 68d9e0ffc34987bba94904e2');
      console.log('🔍 Expected currentHostId from DB: 68d9e0cfc34987bba949048a');
      console.log('🔍 Frontend user ID matches original?', currentUserId === '68d9e0ffc34987bba94904e2');
      console.log('🔍 Frontend user ID matches current?', currentUserId === '68d9e0cfc34987bba949048a');
      
      // Check if user is either the original host or the current host
      const isOriginalHost = currentUserId === meeting?.hostId;
      const isCurrentHost = currentUserId === meeting?.currentHostId;
      
      if (!isOriginalHost && !isCurrentHost) {
        console.log('❌ User is neither original host nor current host!');
        console.log('❌ Frontend user ID:', currentUserId);
        console.log('❌ Original hostId:', meeting?.hostId);
        console.log('❌ Current hostId:', meeting?.currentHostId);
        Swal.fire({
          icon: 'error',
          title: 'Permission Error',
          text: 'Only the meeting host can remove participants.'
        });
        return;
      }
      
      if (isOriginalHost) {
        console.log('✅ User is the original host, can kick participants');
      }
      if (isCurrentHost) {
        console.log('✅ User is the current host (transferred), can kick participants');
        console.log('⚠️  WARNING: Backend may still reject this request');
        console.log('⚠️  Backend checks against hostId, not currentHostId');
        console.log('⚠️  This is a backend permission logic issue');
      }
      
      // Check if the participant we're trying to kick is actually in the participants list
      const targetParticipant = participants.find(p => p._id === participantId);
      console.log('🎯 Target participant to kick:', targetParticipant);
      
      if (!targetParticipant) {
        console.log('❌ Target participant not found in participants list');
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Participant not found in the meeting.'
        });
        return;
      }
      
      // Add a small delay to ensure backend has processed the host transfer
      console.log('⏳ Waiting 2 seconds for backend to process host transfer...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('🚀 Calling removeParticipant mutation...');
      console.log('🚀 Variables:', { 
        participantId: participantId
      });
      console.log('🚀 Current user context:', {
        id: currentUser?.id,
        _id: currentUser?._id,
        displayName: currentUser?.displayName,
        email: currentUser?.email
      });
      console.log('🚀 JWT Token context (if available):', {
        token: localStorage.getItem('token'),
        tokenPreview: localStorage.getItem('token')?.substring(0, 50) + '...'
      });
      console.log('🚀 Meeting context:', {
        meetingId: actualMeetingId,
        hostId: meeting?.hostId,
        currentHostId: meeting?.currentHostId
      });
      
      const result = await removeParticipant({
        variables: { 
          participantId: participantId
        }
      });
      
      console.log('🚀 Mutation result:', result);
      console.log('🚀 Mutation success:', (result.data as any)?.removeParticipant?.success);
      console.log('🚀 Mutation message:', (result.data as any)?.removeParticipant?.message);
      
      if ((result.data as any)?.removeParticipant?.success) {
        // Emit KICKED event to notify the removed participant
        const removedParticipant = (result.data as any)?.removeParticipant?.removedParticipant;
        if (removedParticipant?.userId && socket) {
          console.log('📤 Emitting KICKED event for removed participant:', removedParticipant);
          socket.emit('KICKED', {
            userId: removedParticipant.userId,
            meetingId: removedParticipant.meetingId,
            reason: 'Removed by host'
          });
        }
        
      Swal.fire({
        icon: 'success',
        title: 'Participant Removed',
        text: 'The participant has been removed from the meeting.',
        timer: 2000,
        showConfirmButton: false
      });
      } else {
        throw new Error((result.data as any)?.removeParticipant?.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Check if this is a permission error for transferred host
      const currentUserId = currentUser?.id || currentUser?._id;
      const isCurrentHost = currentUserId === meeting?.currentHostId;
      const isOriginalHost = currentUserId === meeting?.hostId;
      
      if (isCurrentHost && !isOriginalHost) {
        Swal.fire({
          icon: 'error',
          title: 'Backend Permission Issue',
          html: `
            <p>As a transferred host, you should be able to kick participants, but the backend is rejecting the request.</p>
            <p><strong>Issue:</strong> Backend checks against original hostId, not currentHostId</p>
            <p><strong>Your ID:</strong> ${currentUserId}</p>
            <p><strong>Original Host ID:</strong> ${meeting?.hostId}</p>
            <p><strong>Current Host ID:</strong> ${meeting?.currentHostId}</p>
            <p>This needs to be fixed in the backend permission logic.</p>
          `,
          confirmButtonText: 'Understood'
        });
      } else {
        // Show more specific error message
        const errorMessage = (error as any)?.message || 'Unknown error occurred';
      Swal.fire({
        icon: 'error',
        title: 'Error',
          text: `Failed to remove participant: ${errorMessage}`
      });
      }
    }
  };

  // Get meeting data
  const meeting = meetingData && typeof meetingData === 'object' && 'getMeetingById' in meetingData ? meetingData.getMeetingById as any : null;
  const isHost = currentParticipant?.role === 'HOST';

  // Enhance participants with real-time hand raise status
  const participantsWithHandRaise = useMemo(() => {
    return participants.map(participant => ({
      ...participant,
      hasHandRaised: raisedHands[participant._id] || false
    }));
  }, [participants, raisedHands]);

  // Loading state
  if (loading || !authComplete) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        backgroundColor: '#f8f9fa',
        color: '#333'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e9ecef',
            borderTop: '3px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ fontSize: '16px', margin: 0 }}>Loading meeting...</p>
        </div>
      </div>
    );
  }

  // Meeting ended state
  if (meetingStatus === 'ENDED') {
    return (
      <div style={{
          display: 'flex',
        flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        backgroundColor: '#f8f9fa',
        color: '#333',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.6 }}>📹</div>
        <h2 style={{ fontSize: '24px', marginBottom: '10px', fontWeight: '600' }}>Meeting Ended</h2>
        <p style={{ fontSize: '16px', marginBottom: '30px', color: '#666' }}>
          This meeting has been ended by the host.
        </p>
        <button 
          onClick={() => window.location.href = '/'}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '16px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Return to Home
        </button>
      </div>
    );
  }

    return (
      <>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        
        @media (max-width: 768px) {
          .mobile-hidden { display: none !important; }
          .mobile-full { width: 100% !important; }
          .mobile-stack { flex-direction: column !important; }
          .mobile-small { font-size: 14px !important; }
          .mobile-tiny { font-size: 12px !important; }
          }
        `}</style>
        
        <div style={{
          display: 'flex',
          height: '100vh',
        backgroundColor: '#ffffff',
        color: '#333',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative'
      }}>
      {/* Header */}
          <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
          height: '64px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e9ecef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
          padding: '0 24px',
        zIndex: 1000,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#007bff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '600',
              fontSize: '14px'
            }}>
              HRDe
        </div>
          <div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#333' }}>
              {meeting?.title || 'Meeting'}
      </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                ID: {meeting?.inviteCode || actualMeetingId}
            </div>
          </div>
        </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: meetingStatus === 'LIVE' ? '#d4edda' : '#f8d7da',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500',
              color: meetingStatus === 'LIVE' ? '#155724' : '#721c24'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: meetingStatus === 'LIVE' ? '#28a745' : '#dc3545'
              }}></div>
              {meetingStatus === 'LIVE' ? 'Live' : 'Stopped'}
            </div>
          
          {isHost && (
            <button
                onClick={() => {
                  if (meetingStatus === 'CREATED' || meetingStatus === 'PAUSED') {
                    handleStartMeeting();
                  } else if (meetingStatus === 'LIVE') {
                    handleEndMeeting();
                  }
                }}
              style={{
                  backgroundColor: meetingStatus === 'LIVE' ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                  borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                  fontWeight: '500',
                cursor: 'pointer'
          }}
        >
                {meetingStatus === 'LIVE' ? 'End' : 'Start'}
            </button>
          )}
      </div>
      </div>

        {/* Main Content */}
      <div style={{
        flex: 1,
          paddingTop: '64px',
          display: 'flex',
          flexDirection: 'column'
      }}>
          {/* Thumbnails Row */}
    <div style={{
            height: '100px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e9ecef',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: '12px',
            overflowX: 'auto'
          }}>
            {participantsWithHandRaise.map((participant) => (
              <div
                key={participant._id}
                onClick={() => setSelectedParticipant(participant)}
                style={{
                  minWidth: '70px',
                  height: '70px',
                  backgroundColor: selectedParticipant?._id === participant._id ? '#e3f2fd' : '#f8f9fa',
          borderRadius: '8px',
                  border: participant.role === 'HOST' ? '2px solid #007bff' : '1px solid #e9ecef',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
              >
                {participant.role === 'HOST' && (
        <div style={{
              position: 'absolute',
                    top: '-6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#007bff',
              color: 'white',
                    fontSize: '10px',
                    fontWeight: '600',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    HOST
        </div>
          )}
                {participant.hasHandRaised && (
            <div style={{
              position: 'absolute',
                    top: '-6px',
                    right: '-6px',
              backgroundColor: '#ffc107',
              color: '#000',
                    fontSize: '12px',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
        display: 'flex',
            alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>
                    ✋
          </div>
                )}
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                  {participant.role === 'HOST' ? '👨‍🏫' : '👨‍🎓'}
          </div>
                <div style={{ fontSize: '10px', fontWeight: '500', textAlign: 'center' }}>
                  {participant.displayName || (participant.role === 'HOST' ? 'Host' : 'Student')}
                  </div>
                <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                  <span style={{ fontSize: '8px', opacity: participant.micState === 'ON' ? 1 : 0.3 }}>
                    {participant.micState === 'ON' ? '🎤' : '🔇'}
                  </span>
                  <span style={{ fontSize: '8px', opacity: participant.cameraState === 'ON' ? 1 : 0.3 }}>
                    {participant.cameraState === 'ON' ? '📹' : '📷'}
                  </span>
          </div>
              </div>
            ))}
        </div>

          {/* Main Stage */}
        <div style={{
            flex: 1,
            backgroundColor: '#f8f9fa',
          display: 'flex',
            flexDirection: 'column',
          alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: '40px'
          }}>
            {Object.keys(raisedHands).length > 0 && (
          <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
            display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#856404'
              }}>
                ✋ {Object.keys(raisedHands).length} hand{Object.keys(raisedHands).length > 1 ? 's' : ''} raised
              </div>
            )}
            
            <div style={{
              width: '280px',
              height: '280px',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              border: '2px solid #e9ecef',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
              fontSize: '60px',
              color: '#666',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              {selectedParticipant ? (
                selectedParticipant.role === 'HOST' ? '👨‍🏫' : '👨‍🎓'
              ) : (
                '👨‍🏫'
              )}
                      <div style={{
                    position: 'absolute',
                bottom: '12px',
                right: '12px',
                backgroundColor: '#28a745',
                    color: 'white',
                fontSize: '14px',
                borderRadius: '6px',
                padding: '4px 8px',
                fontWeight: '500'
              }}>
                📹
                </div>
            </div>
            
                    <div style={{
              marginTop: '24px',
                      textAlign: 'center'
                    }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                {selectedParticipant ? (
                  selectedParticipant.displayName || 'Selected Participant'
                ) : (
                  'Host'
                )}
              </h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                {selectedParticipant ? (
                  selectedParticipant.user?.email || selectedParticipant.email || 'participant@demo.com'
                ) : (
                  'host@demo.com'
                )}
              </p>
              </div>
        </div>

          {/* Bottom Control Bar */}
        <div style={{
            height: '80px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e9ecef',
          display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>
                {participants.length} participants
              </div>
          <button
              onClick={handleMicToggle}
            style={{
                  width: '44px',
                  height: '44px',
              borderRadius: '50%',
                backgroundColor: micEnabled ? '#28a745' : '#dc3545',
                  border: 'none',
              cursor: 'pointer',
                  fontSize: '18px',
                  color: 'white',
              display: 'flex',
              alignItems: 'center',
                justifyContent: 'center'
            }}
          >
                {micEnabled ? '🎤' : '🔇'}
          </button>
          <button
              onClick={handleCameraToggle}
            style={{
                  width: '44px',
                  height: '44px',
              borderRadius: '50%',
                backgroundColor: cameraEnabled ? '#28a745' : '#dc3545',
                  border: 'none',
              cursor: 'pointer',
                  fontSize: '18px',
                  color: 'white',
              display: 'flex',
              alignItems: 'center',
                justifyContent: 'center'
            }}
          >
                {cameraEnabled ? '📹' : '📷'}
          </button>
          <button
              onClick={handleScreenShareToggle}
            style={{
                  width: '44px',
                  height: '44px',
              borderRadius: '50%',
                  backgroundColor: screenSharing ? '#007bff' : '#f8f9fa',
                  border: '1px solid #e9ecef',
              cursor: 'pointer',
                  fontSize: '18px',
                  color: screenSharing ? 'white' : '#666',
              display: 'flex',
              alignItems: 'center',
                justifyContent: 'center'
            }}
          >
              📺
          </button>
          <button
                onClick={handleRaiseHand}
            style={{
                  width: '44px',
                  height: '44px',
              borderRadius: '50%',
                  backgroundColor: wsMyHandRaised ? '#ffc107' : '#f8f9fa',
                  border: '1px solid #e9ecef',
              cursor: 'pointer',
                  fontSize: '18px',
                  color: wsMyHandRaised ? '#000' : '#666',
              display: 'flex',
              alignItems: 'center',
                  justifyContent: 'center'
            }}
          >
                ✋
          </button>
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: sidebarOpen ? '#007bff' : '#f8f9fa',
                  border: '1px solid #e9ecef',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: sidebarOpen ? 'white' : '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                👥
                {unreadMessageCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '9px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </span>
                )}
              </button>
                </div>
            <button
              onClick={handleLeaveMeeting}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Leave
          </button>
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
      <div style={{
          position: 'fixed',
          right: 0,
            top: '164px',
            width: '360px',
            height: 'calc(100vh - 244px)',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e9ecef',
            zIndex: 999,
        display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{
            padding: '20px',
              borderBottom: '1px solid #e9ecef',
          display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333' }}>
                Participants & Chat
              </h3>
          <button
              onClick={() => setSidebarOpen(false)}
            style={{
                  backgroundColor: 'transparent',
                  color: '#666',
              border: 'none',
                  fontSize: '20px',
              cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px'
            }}
          >
              ×
          </button>
        </div>

                      <div style={{
                        display: 'flex',
              borderBottom: '1px solid #e9ecef'
          }}>
          <button
              onClick={() => setActiveTab('participants')}
                  style={{
                flex: 1,
                  padding: '16px',
              border: 'none',
                backgroundColor: activeTab === 'participants' ? '#007bff' : 'transparent',
                  color: activeTab === 'participants' ? 'white' : '#666',
                    cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderBottom: activeTab === 'participants' ? '2px solid #007bff' : '2px solid transparent'
                }}
              >
                Participants ({participants.length})
            </button>
              <button
                onClick={() => setActiveTab('chat')}
                style={{
                  flex: 1,
                  padding: '16px',
                  border: 'none',
                  backgroundColor: activeTab === 'chat' ? '#007bff' : 'transparent',
                  color: activeTab === 'chat' ? 'white' : '#666',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderBottom: activeTab === 'chat' ? '2px solid #007bff' : '2px solid transparent',
                  position: 'relative'
                }}
              >
                Chat
                {unreadMessageCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '10px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
        </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
            {activeTab === 'participants' && (
                <div style={{ padding: '16px' }}>
                  {participantsWithHandRaise.map((participant) => (
                    <div key={participant._id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      border: '1px solid #e9ecef'
                    }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#e9ecef',
                          display: 'flex',
                          alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px'
                      }}>
                        {participant.role === 'HOST' ? '👨‍🏫' : '👨‍🎓'}
                          </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px', color: '#333' }}>
                          {participant.displayName || (participant.role === 'HOST' ? 'Host' : 'Student')}
                          </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {participant.user?.email || participant.email || 'student@demo.com'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', opacity: participant.micState === 'ON' ? 1 : 0.3 }}>
                          {participant.micState === 'ON' ? '🎤' : '🔇'}
                        </span>
                        <span style={{ fontSize: '14px', opacity: participant.cameraState === 'ON' ? 1 : 0.3 }}>
                          {participant.cameraState === 'ON' ? '📹' : '📷'}
                        </span>
                        {isHost && participant.role !== 'HOST' && (
                          <button
                            onClick={() => handleKickParticipant(participant._id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#dc3545',
                              padding: '4px',
                              borderRadius: '4px'
                            }}
                          >
                            🗑️
                          </button>
                        )}
                        {participant.hasHandRaised && (
                          <span style={{ fontSize: '14px', color: '#ffc107' }}>✋</span>
                        )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            {activeTab === 'chat' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}>
                  <MinimalistChat
                    meetingId={actualMeetingId}
                    currentUser={currentUser}
                    isHost={isHost}
                    token={localStorage.getItem('jwt') || ''}
                    participants={participants}
                    onUnreadCountChange={setUnreadMessageCount}
                  />
                </div>
            )}
              </div>
            </div>
          )}
        </div>
      </>
    );
  });

ProfessionalLiveStreamRoom.displayName = 'ProfessionalLiveStreamRoom';

export default ProfessionalLiveStreamRoom;