import React, { useState, useEffect } from 'react';

interface ProfessionalLiveStreamRoomProps {
  meetingId?: string;
}

const ProfessionalLiveStreamRoom: React.FC<ProfessionalLiveStreamRoomProps> = ({ meetingId }) => {
  const [actualMeetingId, setActualMeetingId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'participants' | 'waiting' | 'chat' | 'analytics'>('participants');
  const [chatOpen, setChatOpen] = useState(false);
  const [raiseHands, setRaiseHands] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [participantChat, setParticipantChat] = useState<{[key: string]: any[]}>({});
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'students'>('students');
  const [mainVideoParticipant, setMainVideoParticipant] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Mock data
  const mockMeetingData = {
    _id: meetingId || '68cb9c9cd2d6ea30031d018a',
    title: 'Demo Meeting',
    inviteCode: 'DEMO123'
  };

  const mockParticipants = [
    { _id: 'p1', email: 'student1@demo.com', displayName: 'Demo Student 1', micState: 'MUTED', cameraState: 'ON', role: 'PARTICIPANT' },
    { _id: 'p2', email: 'student2@demo.com', displayName: 'Demo Student 2', micState: 'MUTED', cameraState: 'ON', role: 'PARTICIPANT' }
  ];

  // Mock raised hands data
  const mockRaisedHands = ['p1']; // Student 1 has raised hand

  const mockWaitingParticipants = [
    { _id: 'w1', email: 'student3@demo.com', displayName: 'Demo Student 3', joinedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() }
  ];

  const mockChatMessages = [
    { _id: 'c1', text: 'Welcome to the demo meeting!', displayName: 'Admin', createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
    { _id: 'c2', text: 'Hello everyone!', displayName: 'Demo Student 1', createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
    { _id: 'c3', text: 'Ready to start the session', displayName: 'Demo Student 2', createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() }
  ];

  // Mock private chat messages for participants
  const mockPrivateChats = {
    'p1': [
      { _id: 'pc1', text: 'Hi, I have a question about the assignment', displayName: 'Demo Student 1', createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
      { _id: 'pc2', text: 'Sure, what would you like to know?', displayName: 'Host', createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString() },
      { _id: 'pc3', text: 'Can you explain the grading criteria?', displayName: 'Demo Student 1', createdAt: new Date(Date.now() - 13 * 60 * 1000).toISOString() }
    ],
    'p2': [
      { _id: 'pc4', text: 'Hello, I need help with the project', displayName: 'Demo Student 2', createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
      { _id: 'pc5', text: 'I can help you with that. What specific part?', displayName: 'Host', createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString() }
    ]
  };

  useEffect(() => {
    if (!meetingId && typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const id = pathParts[pathParts.length - 1];
      if (id && id !== 'livestream') {
        setActualMeetingId(id);
      } else {
        setActualMeetingId('68cb9c9cd2d6ea30031d018a');
      }
    } else if (meetingId) {
      setActualMeetingId(meetingId);
    } else {
      setActualMeetingId('68cb9c9cd2d6ea30031d018a');
    }

    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, [meetingId]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        flexDirection: 'column'
      }}>
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
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#f5f5f5',
      color: '#2c3e50',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden'
    }}>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transition: 'margin-right 0.3s ease',
        marginRight: ((activeTab && activeTab !== 'chat' && !selectedParticipant) || selectedParticipant) ? '320px' : '0px',
        minWidth: 0
      }}>
        {/* Top Header */}
        <div style={{
          height: '60px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e1e8ed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          minHeight: '60px',
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px',
            minWidth: 0,
            flex: 1
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <img 
                src="/logoHRDe.png" 
                alt="HRDE" 
                style={{ 
                  width: '28px', 
                  height: '28px',
                  objectFit: 'contain'
                }} 
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '16px', 
                color: '#2c3e50', 
                fontWeight: '600',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {mockMeetingData.title}
              </h3>
              <p style={{ 
                margin: 0, 
                fontSize: '12px', 
                color: '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                ID: {mockMeetingData.inviteCode}
              </p>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px',
            flexShrink: 0
          }}>
            <div style={{
              backgroundColor: isRecording ? (isRecordingPaused ? '#f59e0b' : '#ef4444') : '#6b7280',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: 'white', borderRadius: '50%' }}></span>
              {isRecording ? (isRecordingPaused ? 'Paused' : 'Recording') : 'Live'}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setIsRecording(!isRecording)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: isRecording ? '#ef4444' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isRecording ? 'Stop' : 'Start'}
              </button>
              
              {isRecording && (
                <button
                  onClick={() => setIsRecordingPaused(!isRecordingPaused)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: isRecordingPaused ? '#10b981' : '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isRecordingPaused ? 'Resume' : 'Pause'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Visual Separator */}
        <div style={{
          height: '2px',
          backgroundColor: '#e2e8f0',
          margin: '0 12px',
          borderRadius: '1px',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#f5f5f5',
            padding: '0 15px',
            fontSize: '10px',
            color: '#94a3b8',
            fontWeight: '500'
          }}>
            • • •
          </div>
        </div>

        {/* Participants Video Grid - Top Position */}
        <div style={{
          height: '100px',
          backgroundColor: '#f8fafc',
          margin: '20px 12px 12px 12px',
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          border: '1px solid #e2e8f0',
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          {/* Host Video */}
          <div 
            onClick={() => setMainVideoParticipant(null)}
            style={{
              minWidth: '80px',
              width: '80px',
              height: '80px',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: mainVideoParticipant === null ? '2px solid #10b981' : '2px solid #3b82f6',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = mainVideoParticipant === null ? '#10b981' : '#3b82f6';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', marginBottom: '3px', color: '#6c757d' }}>👨‍🏫</div>
              <p style={{ margin: 0, fontSize: '9px', color: '#333' }}>Host</p>
            </div>
            <div style={{
              position: 'absolute',
              bottom: '2px',
              left: '2px',
              backgroundColor: '#007bff',
              color: 'white',
              padding: '2px 4px',
              borderRadius: '2px',
              fontSize: '7px',
              fontWeight: 'bold'
            }}>
              HOST
            </div>
          </div>

          {/* Participant Videos */}
          {mockParticipants.map((participant) => (
            <div 
              key={participant._id} 
              onClick={() => setMainVideoParticipant(mainVideoParticipant === participant._id ? null : participant._id)}
              style={{
                minWidth: '80px',
                width: '80px',
                height: '80px',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                border: mainVideoParticipant === participant._id ? '2px solid #3b82f6' : (mockRaisedHands.includes(participant._id) ? '2px solid #f59e0b' : '2px solid #94a3b8'),
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = mainVideoParticipant === participant._id ? '#3b82f6' : (mockRaisedHands.includes(participant._id) ? '#f59e0b' : '#94a3b8');
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', marginBottom: '3px', color: '#6c757d' }}>👤</div>
                <p style={{ margin: 0, fontSize: '8px', color: '#333' }}>
                  {participant.displayName.split(' ')[1]}
                </p>
              </div>
              <div style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                display: 'flex',
                gap: '2px'
              }}>
                <span style={{ 
                  color: participant.micState === 'MUTED' ? '#dc3545' : '#28a745',
                  fontSize: '8px',
                  position: 'relative'
                }}>
                  {participant.micState === 'MUTED' ? (
                    <>
                      🎙
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(45deg)',
                        width: '10px',
                        height: '1px',
                        backgroundColor: '#dc3545'
                      }}></div>
                    </>
                  ) : '🎙'}
                </span>
                <span style={{ 
                  color: participant.cameraState === 'ON' ? '#007bff' : '#dc3545',
                  fontSize: '8px',
                  position: 'relative'
                }}>
                  {participant.cameraState === 'ON' ? '📹' : (
                    <>
                      📹
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(45deg)',
                        width: '10px',
                        height: '1px',
                        backgroundColor: '#dc3545'
                      }}></div>
                    </>
                  )}
                </span>
              </div>
              {mockRaisedHands.includes(participant._id) && (
                <button 
                  onClick={() => {
                    // Lower hand
                    setRaiseHands(prev => prev.filter(id => id !== participant._id));
                  }}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#ffc107',
                    color: '#212529',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Lower Hand"
                >
                  ✋
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Main Teaching Area */}
        <div style={{
          flex: 1,
          backgroundColor: '#ffffff',
          margin: '0 12px 12px 12px',
          marginRight: (activeTab && activeTab !== 'chat' && !selectedParticipant) || selectedParticipant ? '12px' : '12px',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid #e2e8f0',
          transition: 'margin-right 0.3s ease',
          minHeight: 0,
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          {/* Screen Share/Teaching Content */}
          <div style={{
            flex: 1,
            backgroundColor: '#1a1a1a',
            margin: '15px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            minHeight: '400px',
            overflow: 'hidden'
          }}>
            {isScreenSharing ? (
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#2c2c2c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                📺 Screen Sharing Content
              </div>
            ) : mainVideoParticipant ? (
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#2c2c2c',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                position: 'relative'
              }}>
                <div style={{
                  width: '200px',
                  height: '200px',
                  backgroundColor: '#495057',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                  marginBottom: '20px'
                }}>
                  👤
                </div>
                <h3 style={{ margin: 0, fontSize: '24px', color: 'white' }}>
                  {mockParticipants.find(p => p._id === mainVideoParticipant)?.displayName || 'Participant'}
                </h3>
                <p style={{ margin: '10px 0 0 0', fontSize: '16px', color: '#adb5bd' }}>
                  {mockParticipants.find(p => p._id === mainVideoParticipant)?.email || 'participant@demo.com'}
                </p>
                
                {/* Video Controls Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '10px'
                }}>
                  <div style={{
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <span style={{ color: mockParticipants.find(p => p._id === mainVideoParticipant)?.micState === 'MUTED' ? '#dc3545' : '#28a745' }}>
                      {mockParticipants.find(p => p._id === mainVideoParticipant)?.micState === 'MUTED' ? '🔇' : '🎙'}
                    </span>
                    <span style={{ color: mockParticipants.find(p => p._id === mainVideoParticipant)?.cameraState === 'ON' ? '#007bff' : '#dc3545' }}>
                      {mockParticipants.find(p => p._id === mainVideoParticipant)?.cameraState === 'ON' ? '📹' : '📷'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#2c2c2c',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                position: 'relative'
              }}>
                <div style={{
                  width: '200px',
                  height: '200px',
                  backgroundColor: '#495057',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                  marginBottom: '20px'
                }}>
                  👨‍🏫
                </div>
                <h3 style={{ margin: 0, fontSize: '24px', color: 'white' }}>Host</h3>
                <p style={{ margin: '10px 0 0 0', fontSize: '16px', color: '#adb5bd' }}>host@demo.com</p>
                
                {/* Host Controls Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '10px'
                }}>
                  <div style={{
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <span style={{ color: '#28a745' }}>🎙</span>
                    <span style={{ color: '#007bff' }}>📹</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Status Indicator */}
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: 'white', borderRadius: '50%' }}></span>
              {isScreenSharing ? 'Screen Sharing' : (mainVideoParticipant ? 'Participant Video' : 'Host Video')}
            </div>

            {/* Raised Hands Indicator */}
            {mockRaisedHands.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: '#ffc107',
                color: '#212529',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                ✋ {mockRaisedHands.length} hand{mockRaisedHands.length > 1 ? 's' : ''} raised
              </div>
            )}
          </div>

        </div>

        {/* Bottom Control Panel - Minimalistic */}
        <div className="control-panel" style={{
          height: '70px',
          backgroundColor: '#ffffff',
          margin: '0 12px 12px 12px',
          marginRight: ((activeTab && activeTab !== 'chat' && !selectedParticipant) || selectedParticipant) ? '12px' : '12px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          transition: 'margin-right 0.3s ease',
          flexShrink: 0,
          minHeight: '70px'
        }}>
          {/* Left - Empty */}
          <div className="control-left" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          </div>

          {/* Center - All Controls */}
          <div className="control-center" style={{ 
            display: 'flex', 
            gap: '8px',
            flexWrap: 'nowrap',
            justifyContent: 'center',
            overflowX: 'auto',
            padding: '0 10px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            minWidth: 0,
            flex: 1,
            alignItems: 'center'
          }}>
            {/* Participant Count */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              minWidth: '60px',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                backgroundColor: '#10b981',
                borderRadius: '50%'
              }}></div>
              <span style={{ 
                fontSize: '14px', 
                color: '#059669',
                fontWeight: '500'
              }}>
                {mockParticipants.length + mockWaitingParticipants.length}
              </span>
            </div>
            <button style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#f8fafc',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease'
            }}>
              🎤
            </button>
            <button style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#f8fafc',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease'
            }}>
              📹
            </button>
            <button 
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: isScreenSharing ? '#ef4444' : '#f8fafc',
                color: isScreenSharing ? 'white' : '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              🖥️
            </button>
            <button
              onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: activeTab === 'chat' ? '#3b82f6' : '#f8fafc',
                color: activeTab === 'chat' ? 'white' : '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              💬
            </button>
            {/* Participants Panel Button */}
            <button
              onClick={() => setActiveTab(activeTab === 'participants' ? null : 'participants')}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: activeTab === 'participants' ? '#10b981' : '#f8fafc',
                color: activeTab === 'participants' ? 'white' : '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              👥
            </button>

            {/* End Call */}
            <button style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease'
            }}>
              📞
            </button>

          </div>

          {/* Right - Empty */}
          <div className="control-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          </div>
        </div>


        {/* Private Chat Panel */}
        {selectedParticipant && (
          <div style={{
            position: 'fixed',
            right: '0',
            top: '0',
            width: '320px',
            height: '100vh',
            backgroundColor: 'white',
            borderLeft: '1px solid #e9ecef',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001,
            boxShadow: '-4px 0 12px rgba(0,0,0,0.15)',
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px'
          }}>
            {/* Private Chat Header */}
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#007bff',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: 'white'
                }}>
                  👤
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#333', fontSize: '14px' }}>
                    {mockParticipants.find(p => p._id === selectedParticipant)?.displayName}
                  </h3>
                  <p style={{ margin: 0, color: '#6c757d', fontSize: '12px' }}>Private Chat</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedParticipant(null)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#6c757d',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Private Chat Messages */}
            <div style={{
              flex: 1,
              padding: '15px',
              overflowY: 'auto',
              backgroundColor: 'white'
            }}>
              {(mockPrivateChats[selectedParticipant] || []).map((message) => (
                <div key={message._id} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#007bff' }}>
                      {message.displayName}
                    </span>
                    <span style={{ fontSize: '10px', color: '#6c757d' }}>
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '13px', 
                    lineHeight: '1.4', 
                    color: '#333',
                    backgroundColor: message.displayName === 'Host' ? '#e3f2fd' : '#f5f5f5',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    maxWidth: '80%',
                    alignSelf: message.displayName === 'Host' ? 'flex-end' : 'flex-start'
                  }}>
                    {message.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Private Chat Input */}
            <div style={{
              padding: '15px',
              borderTop: '1px solid #e9ecef',
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Type a private message..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #dee2e6',
                    backgroundColor: 'white',
                    color: '#333',
                    fontSize: '13px'
                  }}
                />
                <button style={{
                  padding: '8px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {activeTab === 'chat' && !selectedParticipant && (
          <div style={{
            position: 'fixed',
            right: '0',
            top: '0',
            width: '320px',
            height: '100vh',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px',
            maxWidth: '90vw'
          }}>
            {/* Chat Header */}
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8f9fa'
            }}>
              <h3 style={{ margin: 0, color: '#333', fontSize: '16px' }}>💬 Chat</h3>
              <button
                onClick={() => setActiveTab(null)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#6c757d',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Chat Content */}
            <div style={{ flex: 1, padding: '15px', overflow: 'auto', backgroundColor: 'white' }}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Chat Messages */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  marginBottom: '15px',
                  padding: '10px',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa'
                }}>
                  {mockChatMessages.map((message, index) => {
                    const isOwnMessage = message.displayName === 'Host';
                    return (
                      <div key={index} style={{
                        display: 'flex',
                        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                        marginBottom: '10px'
                      }}>
                        <div style={{
                          maxWidth: '70%',
                          backgroundColor: isOwnMessage ? '#007bff' : '#e9ecef',
                          color: isOwnMessage ? 'white' : '#333',
                          padding: '8px 12px',
                          borderRadius: isOwnMessage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          fontSize: '14px',
                          position: 'relative',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          {!isOwnMessage && (
                            <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
                              {message.displayName}
                            </div>
                          )}
                          <div>{message.text}</div>
                          <div style={{ fontSize: '10px', color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#999', marginTop: '2px' }}>
                            {message.timestamp}
                          </div>
                          {isOwnMessage && (
                            <button
                              onClick={() => console.log('Delete message:', message.text)}
                              style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-5px',
                                width: '16px',
                                height: '16px',
                                backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#dc3545',
                                color: isOwnMessage ? '#dc3545' : 'white',
                                border: 'none',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Chat Input */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #dee2e6',
                      borderRadius: '20px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button style={{
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Side Panel for Participants/Waiting/Analytics */}
        {activeTab && activeTab !== 'chat' && !selectedParticipant && (
          <div style={{
            position: 'fixed',
            right: '0',
            top: '0',
            width: '320px',
            height: '100vh',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px',
            maxWidth: '90vw'
          }}>
            {/* Panel Header */}
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8f9fa'
            }}>
              <h3 style={{ margin: 0, color: '#333', fontSize: '16px' }}>
                {activeTab === 'participants' && '👥 Participants & Waiting Room'}
                {activeTab === 'analytics' && '📊 Analytics'}
              </h3>
              <button
                onClick={() => setActiveTab(null)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#6c757d',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Tabs for Chat and Active Students */}
            {activeTab === 'participants' && (
              <div style={{
                display: 'flex',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #e9ecef'
              }}>
                <button
                  onClick={() => setRightPanelTab('students')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'students' ? 'white' : 'transparent',
                    color: rightPanelTab === 'students' ? '#007bff' : '#6c757d',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    borderBottom: rightPanelTab === 'students' ? '2px solid #007bff' : '2px solid transparent'
                  }}
                >
                  👥 Active Students ({mockParticipants.length})
                </button>
                <button
                  onClick={() => setRightPanelTab('chat')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'chat' ? 'white' : 'transparent',
                    color: rightPanelTab === 'chat' ? '#007bff' : '#6c757d',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    borderBottom: rightPanelTab === 'chat' ? '2px solid #007bff' : '2px solid transparent'
                  }}
                >
                  💬 Chat ({mockChatMessages.length})
                </button>
              </div>
            )}

            {/* Panel Content */}
            <div style={{ flex: 1, padding: '15px', overflow: 'auto', backgroundColor: 'white' }}>
              {activeTab === 'participants' && rightPanelTab === 'students' && (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Top Half - Active Participants */}
                  <div style={{ flex: 1, marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px', fontWeight: 'bold' }}>
                      👥 Active Participants ({mockParticipants.length})
                    </h4>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {mockParticipants.map((participant) => (
                        <div key={participant._id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          marginBottom: '8px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: '#e9ecef',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: '8px',
                            fontSize: '12px',
                            color: '#6c757d'
                          }}>
                            👤
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 2px 0', fontWeight: 'bold', fontSize: '12px', color: '#333' }}>
                              {participant.displayName.split(' ')[1]}
                            </p>
                            <p style={{ margin: 0, fontSize: '10px', color: '#6c757d' }}>
                              {participant.email}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* Mic Control */}
                            <button 
                              onClick={() => {
                                // Toggle mic mute
                                console.log(`Force mute ${participant.displayName}`);
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                backgroundColor: participant.micState === 'MUTED' ? '#fef2f2' : '#f0fdf4',
                                color: participant.micState === 'MUTED' ? '#ef4444' : '#10b981',
                                border: participant.micState === 'MUTED' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease'
                              }}
                              title={participant.micState === 'MUTED' ? 'Unmute' : 'Force Mute'}
                            >
                              {participant.micState === 'MUTED' ? (
                                <>
                                  🎙
                                  <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%) rotate(45deg)',
                                    width: '16px',
                                    height: '2px',
                                    backgroundColor: '#dc3545',
                                    zIndex: 1
                                  }}></div>
                                </>
                              ) : '🎙'}
                            </button>
                            
                            {/* Camera Control */}
                            <button 
                              onClick={() => {
                                // Toggle camera
                                console.log(`Force camera off ${participant.displayName}`);
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                backgroundColor: participant.cameraState === 'ON' ? '#eff6ff' : '#fef2f2',
                                color: participant.cameraState === 'ON' ? '#3b82f6' : '#ef4444',
                                border: participant.cameraState === 'ON' ? '1px solid #bfdbfe' : '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease'
                              }}
                              title={participant.cameraState === 'ON' ? 'Camera Off' : 'Camera On'}
                            >
                              {participant.cameraState === 'ON' ? '📹' : (
                                <>
                                  📹
                                  <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%) rotate(45deg)',
                                    width: '16px',
                                    height: '2px',
                                    backgroundColor: '#dc3545',
                                    zIndex: 1
                                  }}></div>
                                </>
                              )}
                            </button>
                            
                            {/* Remove Button */}
                            <button 
                              onClick={() => {
                                console.log(`Remove ${participant.displayName}`);
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease'
                              }}
                              title="Remove Participant"
                            >
                              🗑️
                            </button>
                            
                            {/* Hand Control - Only show when raised */}
                            {mockRaisedHands.includes(participant._id) && (
                              <button 
                                onClick={() => {
                                  // Lower hand
                                  setRaiseHands(prev => prev.filter(id => id !== participant._id));
                                }}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  backgroundColor: '#fef3c7',
                                  color: '#d97706',
                                  border: '1px solid #fde68a',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                  transition: 'all 0.2s ease'
                                }}
                                title="Lower Hand"
                              >
                                ✋
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Enhanced Divider Line */}
                  <div style={{
                    height: '2px',
                    backgroundColor: '#e2e8f0',
                    margin: '20px 0',
                    width: '100%',
                    borderRadius: '1px',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: '#ffffff',
                      padding: '0 10px',
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      • • •
                    </div>
                  </div>

                  {/* Bottom Half - Waiting Room */}
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px', fontWeight: 'bold' }}>
                      ⏳ Waiting Room ({mockWaitingParticipants.length})
                    </h4>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {mockWaitingParticipants.map((participant) => (
                        <div key={participant._id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px',
                          backgroundColor: '#fff3cd',
                          borderRadius: '4px',
                          border: '1px solid #ffeaa7'
                        }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: '#ffc107',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: '8px',
                            fontSize: '12px',
                            color: '#212529'
                          }}>
                            ⏳
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 2px 0', fontWeight: 'bold', fontSize: '12px', color: '#333' }}>
                              {participant.displayName.split(' ')[1]}
                            </p>
                            <p style={{ margin: 0, fontSize: '10px', color: '#6c757d' }}>
                              {participant.email}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button style={{
                              padding: '4px 8px',
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '9px'
                            }}>
                              ✅ Approve
                            </button>
                            <button style={{
                              padding: '4px 8px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '9px'
                            }}>
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'participants' && rightPanelTab === 'chat' && (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Chat Messages */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    marginBottom: '15px',
                    padding: '10px'
                  }}>
                    {mockChatMessages.map((message, index) => {
                      const isOwnMessage = message.displayName === 'Host'; // Assuming host messages are "own" messages
                      return (
                        <div key={message._id} style={{ 
                          marginBottom: '12px',
                          display: 'flex',
                          justifyContent: isOwnMessage ? 'flex-end' : 'flex-start'
                        }}>
                          <div style={{
                            maxWidth: '70%',
                            backgroundColor: isOwnMessage ? '#007bff' : '#e9ecef',
                            color: isOwnMessage ? 'white' : '#333',
                            padding: '8px 12px',
                            borderRadius: isOwnMessage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            position: 'relative',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}>
                            {!isOwnMessage && (
                              <div style={{
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: '#007bff',
                                marginBottom: '4px'
                              }}>
                                {message.displayName}
                              </div>
                            )}
                            <div style={{
                              fontSize: '14px',
                              lineHeight: '1.4',
                              wordWrap: 'break-word'
                            }}>
                              {message.text}
                            </div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginTop: '4px',
                              fontSize: '10px',
                              opacity: 0.7
                            }}>
                              <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                              {isOwnMessage && (
                                <button 
                                  onClick={() => {
                                    console.log(`Delete message: ${message.text}`);
                                  }}
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    backgroundColor: 'transparent',
                                    color: 'rgba(255,255,255,0.7)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    marginLeft: '8px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                                    e.currentTarget.style.color = 'white';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                                  }}
                                  title="Delete Message"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chat Input */}
                  <div style={{
                    borderTop: '1px solid #e9ecef',
                    paddingTop: '15px'
                  }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Type a message..."
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #dee2e6',
                          backgroundColor: 'white',
                          color: '#333',
                          fontSize: '14px'
                        }}
                      />
                      <button style={{
                        padding: '8px 12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
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
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px'
                  }}>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '15px',
                      textAlign: 'center',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#007bff', fontSize: '14px' }}>Total Participants</h4>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                        {mockParticipants.length + mockWaitingParticipants.length}
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '15px',
                      textAlign: 'center',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#28a745', fontSize: '14px' }}>Active Users</h4>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                        {mockParticipants.length}
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '15px',
                      textAlign: 'center',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#ffc107', fontSize: '14px' }}>Waiting</h4>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                        {mockWaitingParticipants.length}
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '15px',
                      textAlign: 'center',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#6f42c1', fontSize: '14px' }}>Messages</h4>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                        {mockChatMessages.length}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Mobile Responsive Styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .main-content {
            margin-right: 0 !important;
          }
          
          .side-panel {
            width: 100vw !important;
            max-width: 100vw !important;
            border-radius: 0 !important;
          }
          
          .header-content {
            flex-direction: column !important;
            gap: 10px !important;
            padding: 10px !important;
          }
          
          .header-left {
            width: 100% !important;
          }
          
          .header-right {
            width: 100% !important;
            justify-content: center !important;
          }
          
          .control-panel {
            flex-direction: row !important;
            height: 70px !important;
            padding: 8px 12px !important;
            gap: 8px !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            justify-content: flex-start !important;
            align-items: center !important;
          }
          
          .control-left {
            order: 1 !important;
            flex-shrink: 0 !important;
            min-width: fit-content !important;
          }
          
          .control-center {
            order: 2 !important;
            flex: 1 !important;
            justify-content: flex-start !important;
            min-width: 0 !important;
            overflow-x: auto !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          
          .control-right {
            order: 3 !important;
            flex-shrink: 0 !important;
            gap: 6px !important;
            min-width: fit-content !important;
          }
          
          .video-grid {
            height: 80px !important;
            padding: 5px !important;
          }
          
          .video-tile {
            width: 60px !important;
            height: 60px !important;
            min-width: 60px !important;
          }
          
          .main-video {
            margin: 5px !important;
          }
          
          .participant-card {
            flex-direction: column !important;
            text-align: center !important;
            padding: 10px !important;
          }
          
          .participant-controls {
            justify-content: center !important;
            margin-top: 10px !important;
          }
        }
        
        @media (max-width: 480px) {
          .header-title {
            font-size: 14px !important;
          }
          
          .header-subtitle {
            font-size: 10px !important;
          }
          
          .recording-status {
            font-size: 10px !important;
            padding: 3px 6px !important;
          }
          
          .control-button {
            width: 35px !important;
            height: 35px !important;
            font-size: 14px !important;
          }
          
          .video-tile {
            width: 50px !important;
            height: 50px !important;
            min-width: 50px !important;
          }
          
          .main-video-avatar {
            width: 150px !important;
            height: 150px !important;
          }
          
          .control-panel {
            flex-direction: column !important;
            height: auto !important;
            padding: 10px !important;
            gap: 10px !important;
          }
          
          .control-center {
            overflow-x: auto !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          
          .control-center::-webkit-scrollbar {
            display: none !important;
          }
        }
        
        /* Hide scrollbars for horizontal scrolling */
        .control-center::-webkit-scrollbar {
          display: none;
        }
        
        .control-center {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default ProfessionalLiveStreamRoom;
