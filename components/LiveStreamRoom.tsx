import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Swal from 'sweetalert2';
import {
  getMeetingById,
  getParticipantsByMeeting,
  getWaitingParticipants,
  getParticipantStats,
  getChatHistory,
  getRaisedHands,
  getScreenShareStatus,
  getRecordingInfo,
  approveParticipant,
  rejectParticipant,
  removeParticipant,
  forceMute,
  forceCameraOff,
  hostLowerHand,
  lowerAllHands,
  startMeetingRecording,
  stopMeetingRecording,
  pauseMeetingRecording,
  resumeMeetingRecording,
  createLiveKitToken,
  type Meeting,
  type Participant,
  type ChatMessage,
  type Recording
} from '../lib/livestream-service';

interface LiveStreamRoomProps {
  meetingId: string;
  user: {
    _id: string;
    displayName: string;
    email: string;
    systemRole: string;
  };
}

const LiveStreamRoom: React.FC<LiveStreamRoomProps> = ({ meetingId, user }) => {
  // State
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [participantStats, setParticipantStats] = useState<any>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [activeTab, setActiveTab] = useState<'participants' | 'waiting' | 'chat' | 'analytics'>('participants');
  const [loading, setLoading] = useState(true);
  const [isRecordingActive, setIsRecordingActive] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
    startPolling();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [meetingId]);

  const loadInitialData = async () => {
    try {
      console.log('🔄 Loading initial data for meeting:', meetingId);
      
      const [meetingData, participantsData, waitingData, statsData, chatData, recordingData] = await Promise.all([
        getMeetingById(meetingId).catch(err => {
          console.error('❌ Error fetching meeting data:', err);
          return null;
        }),
        getParticipantsByMeeting(meetingId).catch(err => {
          console.error('❌ Error fetching participants:', err);
          return [];
        }),
        getWaitingParticipants(meetingId).catch(err => {
          console.error('❌ Error fetching waiting participants:', err);
          return [];
        }),
        getParticipantStats(meetingId).catch(err => {
          console.error('❌ Error fetching participant stats:', err);
          return null;
        }),
        getChatHistory(meetingId).catch(err => {
          console.error('❌ Error fetching chat history:', err);
          return [];
        }),
        getRecordingInfo(meetingId).catch(err => {
          console.error('❌ Error fetching recording info:', err);
          return null;
        })
      ]);

      console.log('✅ Initial data loaded successfully');
      setMeeting(meetingData);
      setParticipants(participantsData);
      setWaitingParticipants(waitingData);
      setParticipantStats(statsData);
      setChatMessages(chatData);
      setRecording(recordingData);
      setIsRecordingActive(recordingData?.status === 'RECORDING');
      setLoading(false);
    } catch (error) {
      console.error('❌ Critical error loading initial data:', error);
      setLoading(false);
    }
  };

  const startPolling = () => {
    intervalRef.current = setInterval(async () => {
      try {
        const [participantsData, waitingData, chatData] = await Promise.all([
          getParticipantsByMeeting(meetingId),
          getWaitingParticipants(meetingId),
          getChatHistory(meetingId)
        ]);

        setParticipants(participantsData);
        setWaitingParticipants(waitingData);
        setChatMessages(chatData);
      } catch (error) {
        console.error('Error polling data:', error);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Participant Management
  const handleApproveParticipant = async (participantId: string) => {
    try {
      const success = await approveParticipant(participantId);
      if (success) {
        await loadInitialData();
        await Swal.fire({
          icon: 'success',
          title: 'Participant Approved',
          text: 'The participant has been admitted to the meeting.',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to approve participant.',
        confirmButtonText: 'OK'
      });
    }
  };

  const handleRejectParticipant = async (participantId: string) => {
    const result = await Swal.fire({
      title: 'Reject Participant',
      text: 'Are you sure you want to reject this participant?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, reject',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        const success = await rejectParticipant(participantId);
        if (success) {
          await loadInitialData();
          await Swal.fire({
            icon: 'success',
            title: 'Participant Rejected',
            text: 'The participant has been rejected.',
            confirmButtonText: 'OK'
          });
        }
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to reject participant.',
          confirmButtonText: 'OK'
        });
      }
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    const result = await Swal.fire({
      title: 'Remove Participant',
      text: 'Are you sure you want to remove this participant from the meeting?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        const success = await removeParticipant(participantId);
        if (success) {
          await loadInitialData();
          await Swal.fire({
            icon: 'success',
            title: 'Participant Removed',
            text: 'The participant has been removed from the meeting.',
            confirmButtonText: 'OK'
          });
        }
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to remove participant.',
          confirmButtonText: 'OK'
        });
      }
    }
  };

  // Media Controls
  const handleForceMute = async (participantId: string) => {
    try {
      const success = await forceMute(meetingId, participantId);
      if (success) {
        await loadInitialData();
        await Swal.fire({
          icon: 'success',
          title: 'Participant Muted',
          text: 'The participant has been muted.',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to mute participant.',
        confirmButtonText: 'OK'
      });
    }
  };

  const handleForceCameraOff = async (participantId: string) => {
    try {
      const success = await forceCameraOff(meetingId, participantId);
      if (success) {
        await loadInitialData();
        await Swal.fire({
          icon: 'success',
          title: 'Camera Turned Off',
          text: 'The participant\'s camera has been turned off.',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to turn off camera.',
        confirmButtonText: 'OK'
      });
    }
  };


  // Recording Controls
  const handleStartRecording = async () => {
    try {
      const success = await startMeetingRecording(meetingId);
      if (success) {
        setIsRecordingActive(true);
        await loadInitialData();
        await Swal.fire({
          icon: 'success',
          title: 'Recording Started',
          text: 'Meeting recording has been started.',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to start recording.',
        confirmButtonText: 'OK'
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      const success = await stopMeetingRecording(meetingId);
      if (success) {
        setIsRecordingActive(false);
        await loadInitialData();
        await Swal.fire({
          icon: 'success',
          title: 'Recording Stopped',
          text: 'Meeting recording has been stopped.',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to stop recording.',
        confirmButtonText: 'OK'
      });
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
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
          <p>The meeting you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Left Sidebar - Video and Controls */}
      <div style={{
        width: '300px',
        backgroundColor: '#2d2d2d',
        borderRight: '1px solid #444',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #444',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <Image
              src="/logoHRDe.png"
              alt="HRDE"
              width={40}
              height={18}
              style={{ marginRight: '10px' }}
            />
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Live Room</span>
          </div>
          <h3 style={{ margin: '0', fontSize: '16px', color: '#fff' }}>
            {meeting.title}
          </h3>
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#ccc' }}>
            {meeting.inviteCode}
          </p>
          {meeting.isLocked && (
            <span style={{
              display: 'inline-block',
              padding: '2px 6px',
              backgroundColor: '#dc3545',
              color: 'white',
              fontSize: '10px',
              borderRadius: '3px',
              marginTop: '5px'
            }}>
              🔒 LOCKED
            </span>
          )}
        </div>

        {/* Video Area */}
        <div style={{
          flex: 1,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{
            width: '200px',
            height: '150px',
            backgroundColor: '#333',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #555',
            position: 'relative'
          }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '8px',
                objectFit: 'cover'
              }}
            />
            {isRecordingActive && (
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                backgroundColor: '#dc3545',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 'bold'
              }}>
                ● REC
              </div>
            )}
          </div>

          {/* User Info */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h4 style={{ margin: '0', fontSize: '14px' }}>{user.displayName}</h4>
            <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#ccc' }}>
              {user.systemRole} • Host
            </p>
          </div>

          {/* Recording Controls */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px'
          }}>
            <button
              onClick={isRecordingActive ? handleStopRecording : handleStartRecording}
              style={{
                padding: '8px 16px',
                backgroundColor: isRecordingActive ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isRecordingActive ? '#fff' : '#dc3545'
              }}></span>
              {isRecordingActive ? 'Stop Recording' : 'Start Recording'}
            </button>
          </div>

        </div>

        {/* Bottom Info */}
        <div style={{
          padding: '15px',
          borderTop: '1px solid #444',
          fontSize: '12px',
          color: '#ccc'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>Participants:</span>
            <span>{participants.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>Waiting:</span>
            <span>{waitingParticipants.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Connected:</span>
            <span style={{ color: participants.filter(p => p.socketId).length > 0 ? '#28a745' : '#ccc' }}>
              {participants.filter(p => p.socketId).length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Navigation */}
        <div style={{
          backgroundColor: '#2d2d2d',
          borderBottom: '1px solid #444',
          padding: '0 20px'
        }}>
          <div style={{
            display: 'flex',
            gap: '30px'
          }}>
            {[
              { key: 'participants', label: 'Participants', count: participants.length },
              { key: 'waiting', label: 'Waiting Room', count: waitingParticipants.length },
              { key: 'chat', label: 'Chat', count: chatMessages.length },
              { key: 'analytics', label: 'Analytics' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  padding: '15px 0',
                  backgroundColor: 'transparent',
                  color: activeTab === tab.key ? '#007bff' : '#ccc',
                  border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid #007bff' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: activeTab === tab.key ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span style={{
                    backgroundColor: activeTab === tab.key ? '#007bff' : '#666',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '12px'
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto'
        }}>
          {activeTab === 'participants' && (
            <div>
              <h3 style={{ marginBottom: '20px', color: '#fff' }}>Participants ({participants.length})</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '15px'
              }}>
                {participants.map(participant => (
                  <div
                    key={participant._id}
                    style={{
                      backgroundColor: '#333',
                      padding: '15px',
                      borderRadius: '8px',
                      border: '1px solid #555'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px'
                    }}>
                      <h4 style={{ margin: '0', fontSize: '14px' }}>{participant.displayName}</h4>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <span style={{
                          fontSize: '12px',
                          color: participant.status === 'ADMITTED' ? '#28a745' : '#ffc107',
                          backgroundColor: participant.status === 'ADMITTED' ? 'rgba(40, 167, 69, 0.2)' : 'rgba(255, 193, 7, 0.2)',
                          padding: '2px 6px',
                          borderRadius: '3px'
                        }}>
                          {participant.role}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Mic: {participant.micState === 'ON' ? '🔊' : '🔇'}</span>
                        <span>Camera: {participant.cameraState === 'ON' ? '📹' : '📷'}</span>
                      </div>
                      {participant.user?.email && (
                        <div style={{ marginTop: '5px', color: '#666' }}>
                          Email: {participant.user.email}
                        </div>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '5px',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => handleForceMute(participant._id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Mute
                      </button>
                      <button
                        onClick={() => handleForceCameraOff(participant._id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Camera
                      </button>
                      <button
                        onClick={() => handleRemoveParticipant(participant._id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'waiting' && (
            <div>
              <h3 style={{ marginBottom: '20px', color: '#fff' }}>Waiting Room ({waitingParticipants.length})</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '15px'
              }}>
                {waitingParticipants.map(participant => (
                  <div
                    key={participant._id}
                    style={{
                      backgroundColor: '#333',
                      padding: '15px',
                      borderRadius: '8px',
                      border: '1px solid #555'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px'
                    }}>
                      <h4 style={{ margin: '0', fontSize: '14px' }}>{participant.displayName}</h4>
                      <span style={{
                        fontSize: '12px',
                        color: '#ffc107',
                        backgroundColor: 'rgba(255, 193, 7, 0.2)',
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}>
                        WAITING
                      </span>
                    </div>
                    
                    <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '10px' }}>
                      <div>Email: {participant.email}</div>
                      <div>Joined: {new Date(participant.joinedAt).toLocaleString()}</div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '5px'
                    }}>
                      <button
                        onClick={() => handleApproveParticipant(participant._id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          flex: 1
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectParticipant(participant._id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          flex: 1
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div>
              <h3 style={{ marginBottom: '20px', color: '#fff' }}>Chat ({chatMessages.length})</h3>
              <div style={{
                backgroundColor: '#333',
                padding: '20px',
                borderRadius: '8px',
                height: '400px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  marginBottom: '15px',
                  padding: '10px',
                  backgroundColor: '#2d2d2d',
                  borderRadius: '5px'
                }}>
                  {chatMessages.map(message => (
                    <div key={message._id} style={{ marginBottom: '10px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '5px'
                      }}>
                        <span style={{ fontWeight: 'bold', color: '#007bff' }}>
                          {message.senderId.displayName}
                        </span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ color: '#ccc', fontSize: '14px' }}>
                        {message.text}
                      </div>
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <p style={{ color: '#666', textAlign: 'center', fontSize: '14px' }}>
                      No messages yet. Start the conversation!
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#2d2d2d',
                      color: 'white',
                      border: '1px solid #555',
                      borderRadius: '5px',
                      fontSize: '14px'
                    }}
                  />
                  <button style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div>
              <h3 style={{ marginBottom: '20px', color: '#fff' }}>Meeting Analytics</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px',
                marginBottom: '30px'
              }}>
                <div style={{
                  backgroundColor: '#333',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h4 style={{ margin: '0 0 10px', color: '#007bff' }}>Total Participants</h4>
                  <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>{participants.length}</p>
                </div>
                <div style={{
                  backgroundColor: '#333',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h4 style={{ margin: '0 0 10px', color: '#28a745' }}>Active Now</h4>
                  <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>
                    {participants.filter(p => p.status === 'ADMITTED').length}
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#333',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h4 style={{ margin: '0 0 10px', color: '#ffc107' }}>Waiting</h4>
                  <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>{waitingParticipants.length}</p>
                </div>
                <div style={{
                  backgroundColor: '#333',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h4 style={{ margin: '0 0 10px', color: '#17a2b8' }}>Socket Connected</h4>
                  <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>
                    {participants.filter(p => p.socketId).length}
                  </p>
                </div>
              </div>

              {participantStats && (
                <div style={{
                  backgroundColor: '#333',
                  padding: '20px',
                  borderRadius: '8px'
                }}>
                  <h4 style={{ margin: '0 0 15px', color: '#fff' }}>Detailed Stats</h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '15px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#007bff' }}>
                        {participantStats.mutedParticipants || 0}
                      </div>
                      <div style={{ fontSize: '12px', color: '#ccc' }}>Muted</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#6c757d' }}>
                        {participantStats.cameraOffParticipants || 0}
                      </div>
                      <div style={{ fontSize: '12px', color: '#ccc' }}>Camera Off</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>
                        {participantStats.screenSharersCount || 0}
                      </div>
                      <div style={{ fontSize: '12px', color: '#ccc' }}>Screen Sharing</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#17a2b8' }}>
                        {participants.filter(p => p.socketId).length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#ccc' }}>Socket Connected</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LiveStreamRoom;
