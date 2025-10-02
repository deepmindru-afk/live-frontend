import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { enhancedMakeGraphQLRequest } from '../../../lib/mock-graphql-service';
import { JOIN_MEETING, LEAVE_MEETING } from '../../../apollo/meeting/mutations';
import { GET_MEETING_BY_ID, GET_CHAT_HISTORY } from '../../../apollo/meeting/queries';
import { useWebSocketChat } from '../../../hooks/useWebSocketChat';
import { useHandRaise } from '../../../hooks/useHandRaise';
import { HandRaiseButton } from '../../../components/HandRaiseButton';
import { RaisedHandsList } from '../../../components/RaisedHandsList';
import Swal from 'sweetalert2';
import PictureInPicture from '../../../components/PictureInPicture';
import { usePictureInPicture } from '../../../hooks/usePictureInPicture';

interface Participant {
  _id: string;
  displayName: string;
  email: string;
  isMuted: boolean;
  isCameraOff: boolean;
  joinedAt: string;
  isHost?: boolean;
}

interface ChatMessage {
  _id: string;
  message: string;
  sender: {
    _id: string;
    displayName: string;
  };
  createdAt: string;
  replyToMessageId?: string;
}

interface Meeting {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
  participants: Participant[];
  participantCount: number;
}

const MeetingPage: React.FC = memo(() => {
  const router = useRouter();
  const { meetingId } = router.query;
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showParticipantMenu, setShowParticipantMenu] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [showHostTransferModal, setShowHostTransferModal] = useState(false);
  const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);
  const [showHandRaisePanel, setShowHandRaisePanel] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<any>(null);

  // Picture-in-Picture functionality
  const {
    isPiPVisible,
    isPageHidden,
    backToRoom,
    closePiP,
    leaveMeetingFromPiP,
    isMobile
  } = usePictureInPicture({
    meetingId: meetingId as string,
    meetingTitle: meeting?.title || 'Meeting',
    participantCount,
    onLeaveMeeting: leaveMeeting
  });

  // WebSocket connection for chat and hand raise
  const {
    socket,
    isConnected: isSocketConnected,
    messages: webSocketMessages,
    participants: chatParticipants,
    sendMessage: sendChatMessage,
    error: socketError
  } = useWebSocketChat(meetingId ? meetingId as string : '', {
    onMessage: (message) => {
      console.log('New chat message:', message);
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    }
  });

  // Hand raise functionality
  const {
    raisedHands,
    myHandRaised,
    isLoading: isHandRaiseLoading,
    raiseHand,
    lowerHand,
    hostLowerHand,
    lowerAllHands
  } = useHandRaise({
    socket,
    isConnected: isSocketConnected,
    meetingId: meetingId ? meetingId as string : '',
    participantId: currentParticipantId || '',
    isHost,
    onHandRaised: (info) => {
      console.log('Hand raised:', info);
      Swal.fire({
        title: 'Hand Raised',
        text: `${info.displayName} raised their hand`,
        icon: 'info',
        timer: 3000,
        showConfirmButton: false
      });
    },
    onHandLowered: (info) => {
      console.log('Hand lowered:', info);
    },
    onHandLoweredByHost: (info) => {
      console.log('Hand lowered by host:', info);
      Swal.fire({
        title: 'Hand Lowered',
        text: `${info.displayName} lowered your hand`,
        icon: 'info',
        timer: 3000,
        showConfirmButton: false
      });
    },
    onAllHandsLowered: (info) => {
      console.log('All hands lowered:', info);
      Swal.fire({
        title: 'All Hands Lowered',
        text: `${info.hostDisplayName} lowered all hands`,
        icon: 'info',
        timer: 3000,
        showConfirmButton: false
      });
    },
    onError: (error) => {
      console.error('Hand raise error:', error);
      Swal.fire({
        title: 'Error',
        text: error,
        icon: 'error'
      });
    }
  });

  useEffect(() => {
    if (meetingId) {
      loadMeeting();
    }
  }, [meetingId]);

  useEffect(() => {
    if (isJoined) {
      startVideo();
      connectToSignaling();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isJoined]);

  const loadMeeting = async () => {
    try {
      setLoading(true);
      
      // Try to get meeting details
      try {
        const result = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
          meetingId: meetingId
        });
        
        if (result.meeting) {
          setMeeting(result.meeting);
          setParticipantCount(result.meeting.participantCount || 0);
          setParticipants(result.meeting.participants || []);
        }
      } catch (error) {
        console.warn('Failed to load meeting details:', error);
        // Fallback to mock data
        setMeeting({
          _id: meetingId as string,
          title: 'Test Meeting',
          status: 'STARTED',
          inviteCode: 'ABC123',
          participants: [
            {
              _id: 'host-1',
              displayName: '호스트',
              email: 'host@example.com',
              isMuted: false,
              isCameraOff: false,
              joinedAt: new Date().toISOString(),
              isHost: true
            }
          ],
          participantCount: 1
        });
        setParticipantCount(1);
        setParticipants([
          {
            _id: 'host-1',
            displayName: '호스트',
            email: 'host@example.com',
            isMuted: false,
            isCameraOff: false,
            joinedAt: new Date().toISOString(),
            isHost: true
          }
        ]);
      }

      // Load chat history
      loadChatHistory();
      
    } catch (error) {
      console.error('Error loading meeting:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatHistory = async () => {
    try {
      const result = await enhancedMakeGraphQLRequest(GET_CHAT_HISTORY, {
        meetingId: meetingId,
        pagination: { limit: 50, offset: 0 }
      });
      
      if (result.chatHistory) {
        setChatMessages(result.chatHistory);
      }
    } catch (error) {
      console.warn('Failed to load chat history:', error);
      // Mock chat messages
      setChatMessages([
        {
          _id: 'msg1',
          message: '안녕하세요! 미팅에 오신 것을 환영합니다.',
          sender: { _id: 'host', displayName: '호스트' },
          createdAt: new Date().toISOString()
        }
      ]);
    }
  };

  const connectToSignaling = () => {
    // Mock signaling connection
    console.log('🔌 Connecting to signaling server...');
    // In real implementation, you would connect to Socket.IO server
    // socketRef.current = io(process.env.NEXT_PUBLIC_SIGNALING_WS);
  };

  const joinMeeting = async () => {
    try {
      console.log('🎯 JOINING MEETING:', meetingId);
      
      // Get current user info
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const displayName = user?.displayName || 'Anonymous User';
      
      const result = await enhancedMakeGraphQLRequest(JOIN_MEETING, {
        input: {
          meetingId: meetingId,
          displayName: displayName,
          inviteCode: meeting?.inviteCode // Include invite code if meeting is private
        }
      });
      
      console.log('🎯 JOIN MEETING RESULT:', result);
      
      if (result.joinMeeting) {
        setIsJoined(true);
        setIsHost(result.joinMeeting.role === 'HOST');
        setParticipantCount(prev => prev + 1);
        setCurrentParticipantId(result.joinMeeting._id); // Store participant ID for leaving
        
        // Add current user to participants
        const currentUser: Participant = {
          _id: result.joinMeeting._id,
          displayName: result.joinMeeting.displayName,
          email: user?.email || 'me@example.com',
          isMuted: result.joinMeeting.micState === 'OFF',
          isCameraOff: result.joinMeeting.cameraState === 'OFF',
          joinedAt: new Date().toISOString(), // Use current time since createdAt is not available
          isHost: result.joinMeeting.role === 'HOST'
        };
        setParticipants(prev => [...prev, currentUser]);
        
        await Swal.fire({
          icon: 'success',
          title: '미팅 참여',
          text: '미팅에 성공적으로 참여했습니다!',
          timer: 2000,
          showConfirmButton: false
        });

        // Redirect to video room after successful join
        setTimeout(() => {
          router.push(`/meeting/${meetingId}/video-room`);
        }, 2000);
      } else {
        throw new Error('미팅 참여에 실패했습니다.');
      }
    } catch (error) {
      console.error('Join meeting error:', error);
      await Swal.fire({
        icon: 'error',
        title: '미팅 참여 실패',
        text: error.message || '미팅에 참여할 수 없습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const leaveMeeting = async () => {
    try {
      await Swal.fire({
        title: '미팅 종료',
        text: '정말로 미팅을 종료하시겠습니까?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '종료',
        cancelButtonText: '취소',
        confirmButtonColor: '#dc3545'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            if (currentParticipantId) {
              console.log('🎯 LEAVING MEETING:', currentParticipantId);
              await enhancedMakeGraphQLRequest(LEAVE_MEETING, {
                input: {
                  participantId: currentParticipantId
                }
              });
              console.log('✅ Successfully left meeting');
            } else {
              console.warn('No participant ID found, leaving without API call');
            }
          } catch (error) {
            console.warn('Failed to leave meeting via API:', error);
          }
          
          // Redirect based on user role
          const userStr = localStorage.getItem('user');
          const user = userStr ? JSON.parse(userStr) : null;
          const userRole = user?.systemRole;
          
          if (userRole === 'TUTOR') {
            router.push('/instructor');
          } else if (userRole === 'MEMBER') {
            router.push('/member');
          } else {
            router.push('/dashboard');
          }
        }
      });
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: !isCameraOff,
        audio: !isMuted
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error starting video:', error);
    }
  };

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    setIsCameraOff(prev => !prev);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = isCameraOff;
      });
    }
  }, [isCameraOff]);

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsScreenSharing(true);
      } else {
        // Stop screen sharing and return to camera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        await startVideo();
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      _id: 'msg-' + Date.now(),
      message: newMessage,
      sender: {
        _id: 'current-user',
        displayName: '나'
      },
      createdAt: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');

    // Here you would send to signaling server
    // socket.emit('CHAT_SEND', { roomName: meetingId, message: newMessage });
  };

  const forceMuteAll = () => {
    Swal.fire({
      title: '모두 음소거',
      text: '모든 참여자를 음소거하시겠습니까?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '음소거',
      cancelButtonText: '취소'
    }).then((result) => {
      if (result.isConfirmed) {
        // Here you would emit to signaling server
        // socket.emit('FORCE_MUTE', { roomName: meetingId });
        Swal.fire('음소거 완료', '모든 참여자가 음소거되었습니다.', 'success');
      }
    });
  };

  const forceMuteParticipant = (participantId: string) => {
    const participant = participants.find(p => p._id === participantId);
    if (!participant) return;

    Swal.fire({
      title: '참여자 음소거',
      text: `${participant.displayName}님을 음소거하시겠습니까?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '음소거',
      cancelButtonText: '취소'
    }).then((result) => {
      if (result.isConfirmed) {
        // Here you would emit to signaling server
        // socket.emit('FORCE_MUTE', { roomName: meetingId, targetUserId: participantId });
        Swal.fire('음소거 완료', `${participant.displayName}님이 음소거되었습니다.`, 'success');
        setShowParticipantMenu(null);
      }
    });
  };

  const forceCameraOff = () => {
    Swal.fire({
      title: '카메라 끄기',
      text: '특정 참여자의 카메라를 끄시겠습니까?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '끄기',
      cancelButtonText: '취소'
    }).then((result) => {
      if (result.isConfirmed) {
        // Here you would emit to signaling server
        // socket.emit('FORCE_CAMERA_OFF', { roomName: meetingId, targetUserId: 'specific-user' });
        Swal.fire('카메라 끄기 완료', '선택된 참여자의 카메라가 꺼졌습니다.', 'success');
      }
    });
  };

  const forceCameraOffParticipant = (participantId: string) => {
    const participant = participants.find(p => p._id === participantId);
    if (!participant) return;

    Swal.fire({
      title: '카메라 끄기',
      text: `${participant.displayName}님의 카메라를 끄시겠습니까?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '끄기',
      cancelButtonText: '취소'
    }).then((result) => {
      if (result.isConfirmed) {
        // Here you would emit to signaling server
        // socket.emit('FORCE_CAMERA_OFF', { roomName: meetingId, targetUserId: participantId });
        Swal.fire('카메라 끄기 완료', `${participant.displayName}님의 카메라가 꺼졌습니다.`, 'success');
        setShowParticipantMenu(null);
      }
    });
  };

  const kickUser = () => {
    Swal.fire({
      title: '참여자 내보내기',
      text: '특정 참여자를 내보내시겠습니까?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '내보내기',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc3545'
    }).then((result) => {
      if (result.isConfirmed) {
        // Here you would emit to signaling server
        // socket.emit('KICK_USER', { roomName: meetingId, targetUserId: 'specific-user' });
        Swal.fire('내보내기 완료', '선택된 참여자가 내보내졌습니다.', 'success');
      }
    });
  };

  const kickParticipant = (participantId: string) => {
    const participant = participants.find(p => p._id === participantId);
    if (!participant) return;

    Swal.fire({
      title: '참여자 내보내기',
      text: `${participant.displayName}님을 미팅에서 내보내시겠습니까?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '내보내기',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc3545'
    }).then((result) => {
      if (result.isConfirmed) {
        // Here you would emit to signaling server
        // socket.emit('KICK_USER', { roomName: meetingId, targetUserId: participantId });
        Swal.fire('내보내기 완료', `${participant.displayName}님이 미팅에서 내보내졌습니다.`, 'success');
        setShowParticipantMenu(null);
      }
    });
  };

  const makeHost = (participantId: string) => {
    const participant = participants.find(p => p._id === participantId);
    if (!participant) return;

    Swal.fire({
      title: '호스트 권한 부여',
      text: `${participant.displayName}님에게 호스트 권한을 부여하시겠습니까?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '부여',
      cancelButtonText: '취소'
    }).then((result) => {
      if (result.isConfirmed) {
        // Here you would emit to signaling server
        // socket.emit('MAKE_HOST', { roomName: meetingId, targetUserId: participantId });
        Swal.fire('권한 부여 완료', `${participant.displayName}님이 호스트가 되었습니다.`, 'success');
        setShowParticipantMenu(null);
      }
    });
  };

  const handleParticipantMenuClick = (participantId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const participant = participants.find(p => p._id === participantId);
    if (participant) {
      setSelectedParticipant(participant);
      setShowParticipantMenu(participantId);
    }
  };

  const closeParticipantMenu = () => {
    setShowParticipantMenu(null);
    setSelectedParticipant(null);
  };

  const forceEndMeeting = () => {
    Swal.fire({
      title: '미팅 강제 종료',
      text: '모든 참가자를 내보내고 미팅을 종료하시겠습니까?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '강제 종료',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc3545'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          // Here you would emit to signaling server
          // socket.emit('FORCE_END_MEETING', { roomName: meetingId });
          
          await Swal.fire({
            icon: 'success',
            title: '미팅 종료',
            text: '미팅이 강제 종료되었습니다.',
            timer: 2000,
            showConfirmButton: false
          });
          
          router.push('/dashboard');
        } catch (error) {
          console.error('Error force ending meeting:', error);
        }
      }
    });
  };

  const handleHostLeave = () => {
    const otherParticipants = participants.filter(p => !p.isHost);
    
    if (otherParticipants.length === 0) {
      // No other participants, just end the meeting
      forceEndMeeting();
      return;
    }

    setShowHostTransferModal(true);
  };

  const transferHostAndLeave = (newHostId: string) => {
    const newHost = participants.find(p => p._id === newHostId);
    if (!newHost) return;

    Swal.fire({
      title: '호스트 권한 이전',
      text: `${newHost.displayName}님에게 호스트 권한을 이전하고 미팅을 떠나시겠습니까?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '이전 후 떠나기',
      cancelButtonText: '취소'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          // Here you would emit to signaling server
          // socket.emit('TRANSFER_HOST', { roomName: meetingId, newHostId: newHostId });
          // socket.emit('LEAVE_MEETING', { roomName: meetingId });
          
          await Swal.fire({
            icon: 'success',
            title: '호스트 권한 이전',
            text: `${newHost.displayName}님이 새로운 호스트가 되었습니다.`,
            timer: 2000,
            showConfirmButton: false
          });
          
          router.push('/dashboard');
        } catch (error) {
          console.error('Error transferring host:', error);
        }
      }
      setShowHostTransferModal(false);
    });
  };

  const justLeaveMeeting = () => {
    Swal.fire({
      title: '미팅 떠나기',
      text: '호스트 권한을 이전하지 않고 미팅을 떠나시겠습니까? 미팅이 종료될 수 있습니다.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '떠나기',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc3545'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          // Here you would emit to signaling server
          // socket.emit('LEAVE_MEETING', { roomName: meetingId });
          
          await Swal.fire({
            icon: 'success',
            title: '미팅 떠나기',
            text: '미팅에서 나갔습니다.',
            timer: 2000,
            showConfirmButton: false
          });
          
          router.push('/dashboard');
        } catch (error) {
          console.error('Error leaving meeting:', error);
        }
      }
      setShowHostTransferModal(false);
    });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        fontSize: '18px'
      }}>
        미팅을 로딩 중...
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h1>미팅 참여</h1>
        <p>미팅: {meeting?.title}</p>
        <button
          onClick={joinMeeting}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          미팅 참여하기
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>미팅 - {meeting?.title}</title>
        <meta name="description" content="가상 미팅 참여" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Left Sidebar */}
        <div style={{
          width: '80px',
          backgroundColor: '#2c3e50',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0',
          gap: '20px'
        }}>
          {/* Top Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#3498db',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              👤
            </div>
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#95a5a6',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              📄
            </div>
            <span style={{ fontSize: '12px', textAlign: 'center' }}>문서</span>
          </div>

          {/* Control Icons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, justifyContent: 'center' }}>
            <button
              onClick={() => {}}
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: '#34495e',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ⚪
            </button>
            
            <button
              onClick={toggleMute}
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: isMuted ? '#e74c3c' : '#34495e',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isMuted ? '🎤' : '🎤'}
            </button>
            
            <button
              onClick={toggleCamera}
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: isCameraOff ? '#e74c3c' : '#34495e',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isCameraOff ? '📷' : '📷'}
            </button>
            
            <button
              onClick={toggleScreenShare}
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: isScreenSharing ? '#e74c3c' : '#34495e',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              📺
            </button>
            
            <button
              onClick={() => setShowChat(!showChat)}
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: showChat ? '#3498db' : '#34495e',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              💬
            </button>

            {/* Hand Raise Button */}
            <button
              onClick={() => {
                if (myHandRaised) {
                  lowerHand();
                } else {
                  raiseHand();
                }
              }}
              disabled={isHandRaiseLoading || !isSocketConnected}
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: myHandRaised ? '#e74c3c' : '#34495e',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                fontSize: '20px',
                cursor: isHandRaiseLoading || !isSocketConnected ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isHandRaiseLoading || !isSocketConnected ? 0.5 : 1
              }}
            >
              {isHandRaiseLoading ? '⏳' : '✋'}
            </button>

            {/* Hand Raise Panel Toggle (for hosts) */}
            {isHost && (
              <button
                onClick={() => setShowHandRaisePanel(!showHandRaisePanel)}
                style={{
                  width: '50px',
                  height: '50px',
                  backgroundColor: showHandRaisePanel ? '#f39c12' : '#34495e',
                  border: 'none',
                  borderRadius: '50%',
                  color: 'white',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                ✋
                {raisedHands.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {raisedHands.length}
                  </div>
                )}
              </button>
            )}
            
            <button
              onClick={() => {}}
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: '#34495e',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              📅
            </button>
          </div>

          {/* Leave Button */}
          <button
            onClick={isHost ? handleHostLeave : leaveMeeting}
            style={{
              width: '50px',
              height: '50px',
              backgroundColor: '#e74c3c',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isHost ? '미팅 종료/호스트 이전' : '미팅 떠나기'}
          >
            🚪
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* Video Grid Area */}
          <div style={{
            flex: 1,
            backgroundColor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Cg fill-opacity=\'0.1\'%3E%3Cpath d=\'M50 50c0-27.6-22.4-50-50-50v100c27.6 0 50-22.4 50-50z\' fill=\'%23fff\'/%3E%3Cpath d=\'M50 50c0 27.6 22.4 50 50 50V0c-27.6 0-50 22.4-50 50z\' fill=\'%23fff\'/%3E%3C/g%3E%3C/svg%3E")',
            backgroundSize: '50px 50px'
          }}>
            {/* Center Content */}
            <div style={{
              textAlign: 'center',
              color: '#888',
              fontSize: '48px',
              fontWeight: 'bold'
            }}>
              {participantCount}
            </div>

            {/* Video Element */}
            <video
              ref={videoRef}
              autoPlay
              muted
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                width: '200px',
                height: '150px',
                backgroundColor: '#333',
                borderRadius: '8px',
                objectFit: 'cover'
              }}
            />

            {/* Participant Video Grid */}
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px',
              maxWidth: '300px'
            }}>
              {participants.map((participant, index) => (
                <div
                  key={participant._id}
                  style={{
                    width: '150px',
                    height: '100px',
                    backgroundColor: '#333',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: participant.isHost ? '2px solid #f39c12' : '1px solid #555',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    textAlign: 'center',
                    color: '#888'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>
                      {participant.isCameraOff ? '📷' : '👤'}
                    </div>
                    <div style={{ fontSize: '10px' }}>
                      {participant.displayName}
                    </div>
                  </div>
                  
                  {/* Status indicators */}
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    display: 'flex',
                    gap: '2px'
                  }}>
                    {participant.isMuted && (
                      <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#e74c3c',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px'
                      }}>
                        🔇
                      </div>
                    )}
                    {participant.isCameraOff && (
                      <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#e74c3c',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px'
                      }}>
                        📷
                      </div>
                    )}
                    {raisedHands.some(hand => hand.participantId === participant._id) && (
                      <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#f39c12',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px'
                      }}>
                        ✋
                      </div>
                    )}
                  </div>

                  {/* Three-dot menu for host/admin */}
                  {isHost && (
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px'
                    }}>
                      <button
                        onClick={(e) => handleParticipantMenuClick(participant._id, e)}
                        style={{
                          width: '24px',
                          height: '24px',
                          backgroundColor: 'rgba(0, 0, 0, 0.7)',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px'
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Status Bar */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: '8px 20px',
            borderRadius: '20px',
            border: '2px solid #ffa500'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#28a745',
              borderRadius: '50%',
              marginRight: '10px'
            }}></div>
            <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
              {participantCount}
            </span>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#dc3545',
              borderRadius: '50%',
              marginLeft: '10px'
            }}></div>
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div style={{
            width: '300px',
            backgroundColor: '#2c3e50',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #34495e'
          }}>
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #34495e',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              채팅
            </div>
            
            <div style={{
              flex: 1,
              padding: '10px',
              overflowY: 'auto',
              maxHeight: '400px'
            }}>
              {chatMessages.map((msg) => (
                <div key={msg._id} style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#95a5a6' }}>
                    {msg.sender.displayName}
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{
              padding: '10px',
              borderTop: '1px solid #34495e',
              display: 'flex',
              gap: '10px'
            }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="메시지 입력..."
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#34495e',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={sendMessage}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                전송
              </button>
            </div>
          </div>
        )}

        {/* Hand Raise Panel (for hosts) */}
        {showHandRaisePanel && isHost && (
          <div style={{
            width: '300px',
            backgroundColor: '#2c3e50',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #34495e'
          }}>
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #34495e',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>Raised Hands ({raisedHands.length})</span>
              <button
                onClick={() => setShowHandRaisePanel(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#95a5a6',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{
              flex: 1,
              padding: '10px',
              overflowY: 'auto',
              maxHeight: '400px'
            }}>
              {raisedHands.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: '#95a5a6',
                  fontSize: '14px',
                  marginTop: '50px'
                }}>
                  No hands raised
                </div>
              ) : (
                raisedHands.map((hand) => (
                  <div key={hand.participantId} style={{
                    padding: '12px',
                    backgroundColor: '#34495e',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                        ✋ {hand.displayName}
                      </div>
                      {hand.reason && (
                        <div style={{ fontSize: '12px', color: '#95a5a6', marginTop: '4px' }}>
                          "{hand.reason}"
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#95a5a6', marginTop: '4px' }}>
                        {new Date(hand.raisedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      onClick={() => hostLowerHand(hand.participantId)}
                      disabled={isHandRaiseLoading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isHandRaiseLoading ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        opacity: isHandRaiseLoading ? 0.5 : 1
                      }}
                    >
                      Lower
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {raisedHands.length > 0 && (
              <div style={{
                padding: '10px',
                borderTop: '1px solid #34495e'
              }}>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to lower all hands?')) {
                      lowerAllHands();
                    }
                  }}
                  disabled={isHandRaiseLoading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isHandRaiseLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: isHandRaiseLoading ? 0.5 : 1
                  }}
                >
                  Lower All Hands
                </button>
              </div>
            )}
          </div>
        )}

        {/* Admin Controls */}
        {isHost && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            display: 'flex',
            gap: '10px',
            zIndex: 1000
          }}>
            <button
              onClick={forceMuteAll}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f39c12',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              모두 음소거
            </button>
            <button
              onClick={forceCameraOff}
              style={{
                padding: '8px 12px',
                backgroundColor: '#e67e22',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              카메라 끄기
            </button>
            <button
              onClick={kickUser}
              style={{
                padding: '8px 12px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              참여자 내보내기
            </button>
            <button
              onClick={forceEndMeeting}
              style={{
                padding: '8px 12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              강제 종료
            </button>
          </div>
        )}

        {/* Participant Menu Dropdown */}
        {showParticipantMenu && selectedParticipant && (
          <div style={{
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            zIndex: 2000
          }} onClick={closeParticipantMenu}>
            <div style={{
              position: 'absolute',
              top: '100px',
              left: '50px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              padding: '8px 0',
              minWidth: '200px',
              zIndex: 2001
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #eee',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333'
              }}>
                {selectedParticipant.displayName}
              </div>
              
              <button
                onClick={() => forceMuteParticipant(selectedParticipant._id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span>🔇</span>
                {selectedParticipant.isMuted ? '음소거 해제' : '음소거'}
              </button>
              
              <button
                onClick={() => forceCameraOffParticipant(selectedParticipant._id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span>📷</span>
                {selectedParticipant.isCameraOff ? '카메라 켜기' : '카메라 끄기'}
              </button>
              
              {!selectedParticipant.isHost && (
                <button
                  onClick={() => makeHost(selectedParticipant._id)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span>👑</span>
                  호스트 권한 부여
                </button>
              )}
              
              <div style={{
                height: '1px',
                backgroundColor: '#eee',
                margin: '4px 0'
              }}></div>
              
              <button
                onClick={() => kickParticipant(selectedParticipant._id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#dc3545',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span>🚪</span>
                미팅에서 내보내기
              </button>
            </div>
          </div>
        )}

        {/* Host Transfer Modal */}
        {showHostTransferModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h2 style={{ margin: 0 }}>호스트 권한 이전</h2>
                <button
                  onClick={() => setShowHostTransferModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#6c757d'
                  }}
                >
                  ×
                </button>
              </div>

              <p style={{ marginBottom: '20px', color: '#666' }}>
                미팅을 떠나기 전에 호스트 권한을 다른 참가자에게 이전하거나 미팅을 종료할 수 있습니다.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>호스트 권한 이전</h3>
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {participants
                    .filter(p => !p.isHost)
                    .map((participant) => (
                      <div
                        key={participant._id}
                        onClick={() => transferHostAndLeave(participant._id)}
                        style={{
                          padding: '12px',
                          border: '1px solid #dee2e6',
                          borderRadius: '6px',
                          marginBottom: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: '#007bff',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '16px'
                        }}>
                          👤
                        </div>
                        <div>
                          <div style={{ fontWeight: '500' }}>{participant.displayName}</div>
                          <div style={{ fontSize: '14px', color: '#666' }}>{participant.email}</div>
                        </div>
                        <div style={{ marginLeft: 'auto', color: '#007bff', fontSize: '14px' }}>
                          선택
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <button
                  onClick={justLeaveMeeting}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  권한 이전 없이 떠나기
                </button>
                <button
                  onClick={forceEndMeeting}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  미팅 강제 종료
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Picture-in-Picture Component */}
        <PictureInPicture
          videoRef={videoRef}
          meetingId={meetingId as string}
          meetingTitle={meeting?.title || 'Meeting'}
          participantCount={participantCount}
          onLeaveMeeting={leaveMeetingFromPiP}
          onBackToRoom={backToRoom}
          isVisible={isPiPVisible}
          onClose={closePiP}
        />
      </div>
    </>
  );
});

MeetingPage.displayName = 'MeetingPage';

export default MeetingPage;
