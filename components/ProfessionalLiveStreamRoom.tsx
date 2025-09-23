import React, { useState, useEffect, useRef } from 'react';

interface ProfessionalLiveStreamRoomProps {
  meetingId?: string;
  role?: 'HOST' | 'PARTICIPANT';
  userId?: string;
}

interface Meeting {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
}

interface ChatMessage {
  id: number;
  text: string;
  sender: string;
  timestamp: string;
}

const ProfessionalLiveStreamRoom: React.FC<ProfessionalLiveStreamRoomProps> = ({
  meetingId,
  role = 'HOST',
  userId = 'p1'
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  
  // Video refs and streams
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (meetingId) {
      // Simulate loading meeting data
      setTimeout(() => {
        setMeeting({
          _id: meetingId,
          title: `Meeting ${meetingId}`,
          status: 'ACTIVE',
          inviteCode: 'ABC123'
        });
        setLoading(false);
      }, 1000);
      
      // Initialize video stream
      initializeVideo();
    }

    // Cleanup function to stop streams when component unmounts
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [meetingId]);

  const initializeVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Store the stream reference
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      console.log('✅ Video stream initialized');
            } catch (error) {
      console.error('❌ Error accessing camera/microphone:', error);
      setError('Unable to access camera/microphone. Please check permissions.');
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted; // Enable if currently muted, disable if currently unmuted
      });
    }
    setIsMuted(!isMuted);
    console.log('🎤 Mute toggled:', !isMuted);
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isCameraOn; // Enable if currently off, disable if currently on
      });
    }
    setIsCameraOn(!isCameraOn);
    console.log('📹 Camera toggled:', !isCameraOn);
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, 
          audio: true 
        });
        
        // Store the remote stream reference
        remoteStreamRef.current = stream;
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(true);
        console.log('📺 Screen sharing started');
      } else {
        // Stop the screen sharing stream
        if (remoteStreamRef.current) {
          remoteStreamRef.current.getTracks().forEach(track => track.stop());
          remoteStreamRef.current = null;
        }
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        setIsScreenSharing(false);
        console.log('📺 Screen sharing stopped');
      }
    } catch (error) {
      console.error('❌ Error with screen sharing:', error);
    }
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        text: newMessage,
        sender: 'You',
        timestamp: new Date().toLocaleTimeString()
      };
      
      setChatMessages(prev => [...prev, message]);
      setNewMessage('');
      console.log('💬 Message sent:', message);
    }
  };

  const startMeeting = () => {
    console.log('🚀 Meeting started');
    // TODO: Implement actual meeting start
  };

  const endMeeting = () => {
    console.log('🛑 Meeting ended');
    // TODO: Implement actual meeting end
    window.location.href = '/dashboard';
  };

  if (loading) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '3px solid #333',
            borderTop: '3px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
        <p>Loading Live Stream Room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '20px' }}>Error</h2>
          <p style={{ marginBottom: '20px' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Meeting Not Found</h2>
          <p>Meeting ID: {meetingId}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      backgroundColor: '#1a1a1a',
      color: 'white',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        backgroundColor: '#2a2a2a'
        }}>
          <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>{meeting.title}</h1>
          <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '14px' }}>
            Meeting ID: {meetingId} | Status: {meeting.status} | Role: {role}
            </p>
          </div>
        <div style={{ display: 'flex', gap: '10px' }}>
                <button
            onClick={startMeeting}
                  style={{
                    padding: '8px 16px',
              backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
                  }}
                >
            🚀 Start Meeting
                </button>
          <button 
            onClick={endMeeting}
            style={{
                padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🛑 End Meeting
          </button>
          </div>
        </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        padding: '20px',
        gap: '20px'
      }}>
        {/* Video Area */}
        <div style={{
          flex: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Main Video */}
          <div style={{
            flex: 1,
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            {!isScreenSharing && (
                <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                  width: '200px',
                  height: '150px',
                  backgroundColor: '#333',
                  borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: isCameraOn ? 'block' : 'none'
                  }}
                />
                {!isCameraOn && (
                <div style={{
                    width: '100%',
                    height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                    backgroundColor: '#333',
                    color: '#888',
                    fontSize: '14px'
                }}>
                    Camera Off
                </div>
                )}
              </div>
            )}
        </div>

          {/* Video Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
            gap: '15px',
            padding: '15px',
          backgroundColor: '#2a2a2a',
            borderRadius: '8px'
        }}>
          <button
              onClick={toggleMute}
            style={{
                padding: '12px 20px',
                backgroundColor: isMuted ? '#dc3545' : '#28a745',
                color: 'white',
              border: 'none',
                borderRadius: '50px',
              cursor: 'pointer',
                fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
                gap: '8px'
            }}
          >
              {isMuted ? '🔇' : '🎤'} {isMuted ? 'Unmute' : 'Mute'}
          </button>
          
          <button
              onClick={toggleCamera}
            style={{
                padding: '12px 20px',
                backgroundColor: isCameraOn ? '#28a745' : '#dc3545',
              color: 'white',
              border: 'none',
                borderRadius: '50px',
              cursor: 'pointer',
                fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
                gap: '8px'
            }}
          >
              {isCameraOn ? '📹' : '📷'} {isCameraOn ? 'Camera On' : 'Camera Off'}
          </button>
          
          <button
              onClick={toggleScreenShare}
            style={{
                padding: '12px 20px',
                backgroundColor: isScreenSharing ? '#ffc107' : '#17a2b8',
                color: isScreenSharing ? 'black' : 'white',
              border: 'none',
                borderRadius: '50px',
              cursor: 'pointer',
                fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
                gap: '8px'
            }}
          >
              📺 {isScreenSharing ? 'Stop Share' : 'Share Screen'}
          </button>
        </div>
      </div>

        {/* Sidebar */}
        <div style={{
          width: '300px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Participants */}
          <div style={{
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            padding: '15px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Participants ({participants.length + 1})</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#007bff',
                borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px'
              }}>
                {role.charAt(0)}
              </div>
              <span>You ({role})</span>
            </div>
            {participants.map((participant, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                  backgroundColor: '#6c757d',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                  fontSize: '14px'
                      }}>
                  P
                      </div>
                <span>Participant {index + 1}</span>
                  </div>
                ))}
              </div>

          {/* Chat */}
          <div style={{
            flex: 1,
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            padding: '15px',
            display: 'flex',
            flexDirection: 'column'
          }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Chat</h3>
            
            {/* Chat Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                marginBottom: '15px',
              maxHeight: '200px'
            }}>
              {chatMessages.length === 0 ? (
                <p style={{ color: '#888', fontSize: '14px', textAlign: 'center' }}>No messages yet</p>
              ) : (
                chatMessages.map((message) => (
                  <div key={message.id} style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '2px' }}>
                      {message.sender} • {message.timestamp}
                    </div>
                    <div style={{ fontSize: '14px' }}>{message.text}</div>
                  </div>
                ))
              )}
              </div>
            
            {/* Chat Input */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: '#333',
                    color: 'white',
                    border: '1px solid #555',
                  borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
                <button
                onClick={sendMessage}
                  style={{
                  padding: '8px 12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                  borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalLiveStreamRoom;