import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useLiveRoomData } from '../hooks/useLiveRoomData';
import { 
  START_RECORDING, 
  STOP_RECORDING, 
  APPROVE_PARTICIPANT,
  REJECT_PARTICIPANT,
  REMOVE_PARTICIPANT,
  FORCE_MUTE,
  FORCE_CAMERA_OFF,
  HOST_LOWER_HAND,
  LOWER_ALL_HANDS,
  LOCK_ROOM,
  UNLOCK_ROOM,
  START_MEETING,
  END_MEETING
} from '../graphql/live-room-mutations';
import Swal from 'sweetalert2';

interface RealLiveStreamRoomProps {
  meetingId: string;
}

export const RealLiveStreamRoom: React.FC<RealLiveStreamRoomProps> = ({ meetingId }) => {
  const {
    meeting,
    participants,
    waitingParticipants,
    chatMessages,
    recording,
    stats,
    loading,
    error
  } = useLiveRoomData(meetingId);

  // Mutations
  const [startRecording] = useMutation(START_RECORDING);
  const [stopRecording] = useMutation(STOP_RECORDING);
  const [approveParticipant] = useMutation(APPROVE_PARTICIPANT);
  const [rejectParticipant] = useMutation(REJECT_PARTICIPANT);
  const [removeParticipant] = useMutation(REMOVE_PARTICIPANT);
  const [forceMute] = useMutation(FORCE_MUTE);
  const [forceCameraOff] = useMutation(FORCE_CAMERA_OFF);
  const [hostLowerHand] = useMutation(HOST_LOWER_HAND);
  const [lowerAllHands] = useMutation(LOWER_ALL_HANDS);
  const [lockRoom] = useMutation(LOCK_ROOM);
  const [unlockRoom] = useMutation(UNLOCK_ROOM);
  const [startMeeting] = useMutation(START_MEETING);
  const [endMeeting] = useMutation(END_MEETING);

  const [showChat, setShowChat] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);

  // Recording Controls
  const handleStartRecording = async () => {
    try {
      await startRecording({
        variables: {
          input: {
            meetingId,
            quality: '720p',
            format: 'mp4'
          }
        }
      });
      await Swal.fire('Success', 'Recording started successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      await Swal.fire('Error', `Failed to start recording: ${error.message}`, 'error');
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopRecording({
        variables: {
          input: {
            meetingId,
            reason: 'Host stopped recording'
          }
        }
      });
      await Swal.fire('Success', 'Recording stopped successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      await Swal.fire('Error', `Failed to stop recording: ${error.message}`, 'error');
    }
  };

  // Participant Controls
  const handleMuteParticipant = async (participantId: string, currentState: string) => {
    try {
      await forceMute({
        variables: {
          input: {
            participantId,
            micState: currentState === 'MUTED' ? 'UNMUTED' : 'MUTED',
            reason: `Host ${currentState === 'MUTED' ? 'unmuted' : 'muted'} participant`
          }
        }
      });
    } catch (error: any) {
      console.error('Failed to toggle mute:', error);
      await Swal.fire('Error', `Failed to toggle mute: ${error.message}`, 'error');
    }
  };

  const handleCameraToggle = async (participantId: string, currentState: string) => {
    try {
      await forceCameraOff({
        variables: {
          input: {
            participantId,
            cameraState: currentState === 'OFF' ? 'ON' : 'OFF',
            reason: `Host ${currentState === 'OFF' ? 'turned on' : 'turned off'} camera`
          }
        }
      });
    } catch (error: any) {
      console.error('Failed to toggle camera:', error);
      await Swal.fire('Error', `Failed to toggle camera: ${error.message}`, 'error');
    }
  };

  const handleApproveParticipant = async (participantId: string) => {
    try {
      await approveParticipant({
        variables: {
          input: {
            meetingId,
            participantId,
            reason: 'Approved by host'
          }
        }
      });
      await Swal.fire('Success', 'Participant approved!', 'success');
    } catch (error: any) {
      console.error('Failed to approve participant:', error);
      await Swal.fire('Error', `Failed to approve participant: ${error.message}`, 'error');
    }
  };

  const handleRejectParticipant = async (participantId: string) => {
    try {
      await rejectParticipant({
        variables: {
          input: {
            meetingId,
            participantId,
            reason: 'Rejected by host'
          }
        }
      });
      await Swal.fire('Success', 'Participant rejected!', 'success');
    } catch (error: any) {
      console.error('Failed to reject participant:', error);
      await Swal.fire('Error', `Failed to reject participant: ${error.message}`, 'error');
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      await removeParticipant({
        variables: {
          input: {
            meetingId,
            participantId,
            reason: 'Removed by host'
          }
        }
      });
      await Swal.fire('Success', 'Participant removed!', 'success');
    } catch (error: any) {
      console.error('Failed to remove participant:', error);
      await Swal.fire('Error', `Failed to remove participant: ${error.message}`, 'error');
    }
  };

  // Room Controls
  const handleLockRoom = async () => {
    try {
      await lockRoom({
        variables: { meetingId }
      });
      await Swal.fire('Success', 'Room locked!', 'success');
    } catch (error: any) {
      console.error('Failed to lock room:', error);
      await Swal.fire('Error', `Failed to lock room: ${error.message}`, 'error');
    }
  };

  const handleUnlockRoom = async () => {
    try {
      await unlockRoom({
        variables: { meetingId }
      });
      await Swal.fire('Success', 'Room unlocked!', 'success');
    } catch (error: any) {
      console.error('Failed to unlock room:', error);
      await Swal.fire('Error', `Failed to unlock room: ${error.message}`, 'error');
    }
  };

  const handleEndMeeting = async () => {
    const result = await Swal.fire({
      title: 'End Meeting?',
      text: 'Are you sure you want to end this meeting for everyone?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, end meeting!'
    });

    if (result.isConfirmed) {
      try {
        await endMeeting({
          variables: { meetingId }
        });
        await Swal.fire('Meeting Ended', 'The meeting has been ended for all participants.', 'success');
        // Redirect to dashboard or meeting list
        window.location.href = '/instructor';
      } catch (error: any) {
        console.error('Failed to end meeting:', error);
        await Swal.fire('Error', `Failed to end meeting: ${error.message}`, 'error');
      }
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div style={{ 
          width: '50px', 
          height: '50px', 
          border: '5px solid #f3f3f3',
          borderTop: '5px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '20px', fontSize: '18px' }}>Loading live room data...</p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
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
        flexDirection: 'column'
      }}>
        <h2 style={{ color: '#e74c3c' }}>Error Loading Live Room</h2>
        <p style={{ color: '#7f8c8d', marginTop: '10px' }}>
          {error.message || 'An error occurred while loading the live room data.'}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
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
      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#2c2c2c',
          borderBottom: '1px solid #444'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px' }}>
                {meeting?.title || 'Live Meeting Room'}
              </h1>
              <p style={{ margin: '5px 0 0 0', color: '#bdc3c7' }}>
                Meeting ID: {meeting?.inviteCode || 'Loading...'} | 
                Status: <span style={{ 
                  color: meeting?.status === 'LIVE' ? '#27ae60' : '#f39c12' 
                }}>
                  {meeting?.status || 'Loading...'}
                </span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {recording?.status === 'RECORDING' ? (
                <button 
                  onClick={handleStopRecording}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  🔴 Stop Recording
                </button>
              ) : (
                <button 
                  onClick={handleStartRecording}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  ⚫ Start Recording
                </button>
              )}
              {meeting?.isLocked ? (
                <button 
                  onClick={handleUnlockRoom}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  🔓 Unlock Room
                </button>
              ) : (
                <button 
                  onClick={handleLockRoom}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f39c12',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  🔒 Lock Room
                </button>
              )}
              <button 
                onClick={handleEndMeeting}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🏁 End Meeting
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Bar */}
        <div style={{ 
          padding: '15px 20px', 
          backgroundColor: '#34495e',
          display: 'flex',
          gap: '30px',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ color: '#bdc3c7' }}>Participants: </span>
            <strong style={{ color: '#3498db' }}>{stats?.totalParticipants || 0}</strong>
          </div>
          <div>
            <span style={{ color: '#bdc3c7' }}>Online: </span>
            <strong style={{ color: '#27ae60' }}>{stats?.currentlyOnline || 0}</strong>
          </div>
          <div>
            <span style={{ color: '#bdc3c7' }}>Waiting: </span>
            <strong style={{ color: '#f39c12' }}>{waitingParticipants.length}</strong>
          </div>
          <div>
            <span style={{ color: '#bdc3c7' }}>Chat Messages: </span>
            <strong style={{ color: '#9b59b6' }}>{chatMessages.length}</strong>
          </div>
          {recording?.status === 'RECORDING' && (
            <div>
              <span style={{ color: '#bdc3c7' }}>Recording: </span>
              <strong style={{ color: '#e74c3c' }}>
                {recording.durationSec ? 
                  `${Math.floor(recording.durationSec / 60)}:${(recording.durationSec % 60).toFixed(0).padStart(2, '0')}` : 
                  'Active'
                }
              </strong>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Main Content */}
          <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
            {/* Participants Grid */}
            <div style={{ marginBottom: '30px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '15px'
              }}>
                <h2>Participants ({participants.length})</h2>
                <button 
                  onClick={() => setShowParticipants(!showParticipants)}
                  style={{
                    padding: '5px 15px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  {showParticipants ? 'Hide' : 'Show'}
                </button>
              </div>
              
              {showParticipants && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                  gap: '15px' 
                }}>
                  {participants.map((participant) => (
                    <div 
                      key={participant._id} 
                      style={{ 
                        backgroundColor: '#2c2c2c',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid #444'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '16px' }}>
                            {participant.displayName || participant.user?.displayName || 'Unknown'}
                          </h3>
                          <p style={{ margin: '5px 0', fontSize: '12px', color: '#bdc3c7' }}>
                            Role: {participant.role} | ID: {participant._id.slice(-8)}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <span style={{ 
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            backgroundColor: participant.micState === 'MUTED' ? '#e74c3c' : '#27ae60'
                          }}>
                            🎤 {participant.micState || 'UNKNOWN'}
                          </span>
                          <span style={{ 
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            backgroundColor: participant.cameraState === 'OFF' ? '#e74c3c' : '#27ae60'
                          }}>
                            📹 {participant.cameraState || 'UNKNOWN'}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ 
                        marginTop: '10px', 
                        display: 'flex', 
                        gap: '5px',
                        flexWrap: 'wrap'
                      }}>
                        <button 
                          onClick={() => handleMuteParticipant(participant._id, participant.micState)}
                          style={{
                            padding: '5px 10px',
                            fontSize: '12px',
                            backgroundColor: participant.micState === 'MUTED' ? '#27ae60' : '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          {participant.micState === 'MUTED' ? 'Unmute' : 'Mute'}
                        </button>
                        <button 
                          onClick={() => handleCameraToggle(participant._id, participant.cameraState)}
                          style={{
                            padding: '5px 10px',
                            fontSize: '12px',
                            backgroundColor: participant.cameraState === 'OFF' ? '#27ae60' : '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          {participant.cameraState === 'OFF' ? 'Camera On' : 'Camera Off'}
                        </button>
                        <button 
                          onClick={() => handleRemoveParticipant(participant._id)}
                          style={{
                            padding: '5px 10px',
                            fontSize: '12px',
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Waiting Room */}
            {waitingParticipants.length > 0 && (
              <div style={{ marginBottom: '30px' }}>
                <h2>Waiting Room ({waitingParticipants.length})</h2>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                  gap: '15px' 
                }}>
                  {waitingParticipants.map((participant) => (
                    <div 
                      key={participant._id} 
                      style={{ 
                        backgroundColor: '#8e44ad',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid #9b59b6'
                      }}
                    >
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
                        {participant.displayName || 'Unknown'}
                      </h3>
                      <p style={{ margin: '5px 0', fontSize: '12px', color: '#ecf0f1' }}>
                        Email: {participant.email || 'N/A'}
                      </p>
                      <div style={{ 
                        marginTop: '10px', 
                        display: 'flex', 
                        gap: '10px'
                      }}>
                        <button 
                          onClick={() => handleApproveParticipant(participant._id)}
                          style={{
                            padding: '8px 15px',
                            backgroundColor: '#27ae60',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                        >
                          ✅ Approve
                        </button>
                        <button 
                          onClick={() => handleRejectParticipant(participant._id)}
                          style={{
                            padding: '8px 15px',
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ 
            width: '350px', 
            backgroundColor: '#2c2c2c',
            borderLeft: '1px solid #444',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Chat Section */}
            <div style={{ 
              borderBottom: '1px solid #444',
              padding: '15px'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <h3 style={{ margin: 0 }}>Chat ({chatMessages.length})</h3>
                <button 
                  onClick={() => setShowChat(!showChat)}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {showChat ? 'Hide' : 'Show'}
                </button>
              </div>
              
              {showChat && (
                <div style={{ 
                  height: '300px', 
                  overflowY: 'auto',
                  backgroundColor: '#1a1a1a',
                  padding: '10px',
                  borderRadius: '5px',
                  marginBottom: '10px'
                }}>
                  {chatMessages.length === 0 ? (
                    <p style={{ color: '#7f8c8d', textAlign: 'center', margin: '20px 0' }}>
                      No chat messages yet
                    </p>
                  ) : (
                    chatMessages.map((message) => (
                      <div 
                        key={message._id} 
                        style={{ 
                          marginBottom: '10px',
                          padding: '8px',
                          backgroundColor: '#34495e',
                          borderRadius: '5px'
                        }}
                      >
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '5px'
                        }}>
                          <strong style={{ color: '#3498db' }}>
                            {message.displayName || message.user?.displayName || 'Unknown'}
                          </strong>
                          <small style={{ color: '#95a5a6', fontSize: '10px' }}>
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </small>
                        </div>
                        <p style={{ margin: 0, fontSize: '14px' }}>
                          {message.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Recording Status */}
            {recording && (
              <div style={{ 
                padding: '15px',
                borderBottom: '1px solid #444'
              }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Recording Status</h4>
                <div style={{ 
                  padding: '10px',
                  backgroundColor: recording.status === 'RECORDING' ? '#27ae60' : '#95a5a6',
                  borderRadius: '5px',
                  textAlign: 'center'
                }}>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>
                    {recording.status === 'RECORDING' ? '🔴 RECORDING' : '⚫ STOPPED'}
                  </p>
                  {recording.durationSec && (
                    <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}>
                      Duration: {Math.floor(recording.durationSec / 60)}:{(recording.durationSec % 60).toFixed(0).padStart(2, '0')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Meeting Info */}
            <div style={{ padding: '15px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Meeting Info</h4>
              <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                <p style={{ margin: '5px 0' }}>
                  <strong>Status:</strong> {meeting?.status || 'Unknown'}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Private:</strong> {meeting?.isPrivate ? 'Yes' : 'No'}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Locked:</strong> {meeting?.isLocked ? 'Yes' : 'No'}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Created:</strong> {meeting?.createdAt ? 
                    new Date(meeting.createdAt).toLocaleString() : 'Unknown'}
                </p>
                {meeting?.scheduledFor && (
                  <p style={{ margin: '5px 0' }}>
                    <strong>Scheduled:</strong> {new Date(meeting.scheduledFor).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealLiveStreamRoom;
