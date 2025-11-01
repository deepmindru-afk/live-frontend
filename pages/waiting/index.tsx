import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { makeGraphQLRequest } from '../../lib/simple-auth-handlers';
import { GET_MEETING_BY_ID } from '../../apollo/meeting/queries';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';

interface MeetingInfo {
  _id: string;
  title: string;
  status: 'STARTED' | 'SCHEDULED' | 'ENDED' | 'ACTIVE';
  inviteCode: string;
}

const WaitingRoomPage: React.FC = () => {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [isWaitingForMeeting, setIsWaitingForMeeting] = useState(false);
  const [waitingMessage, setWaitingMessage] = useState('호스트가 미팅을 시작할 때까지 기다려주세요...');
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [hasRedirectedToLive, setHasRedirectedToLive] = useState<boolean>(false);

  useEffect(() => {
    // Check if there's an invite code in the URL query params
    const { code, meetingId } = router.query;
    if (code && typeof code === 'string') {
      setInviteCode(code);
      if (meetingId) {
        // Coming from pre-join page, check meeting status
        checkMeetingStatus(meetingId as string);
      }
    }
    
    // Don't clear redirect flags on mount - this was causing infinite loops
    // The flags will be cleared when user successfully joins the live room
    
    // Cleanup function to clear any intervals and emit LEAVE_WAITING_ROOM
    return () => {
      // Cleanup will be handled by the monitoring function
      // Emit LEAVE_WAITING_ROOM when component unmounts (user navigates away)
      if (participantId && meetingId) {
        // We can't use socket here since it's in cleanup, but the presence system will handle it
      }
    };
  }, [router.query, participantId]);

  const checkMeetingStatus = async (meetingId: string) => {
    try {
      // Check if user is authenticated and get their role
      const { isAuthenticated, getCurrentUser } = await import('../../lib/simple-auth-handlers');
      
      if (isAuthenticated()) {
        const currentUser = await getCurrentUser();
        
        // If user is TUTOR (host), go directly to meeting room
        if (currentUser && currentUser.systemRole === 'TUTOR') {
          router.push(`/meeting/${meetingId}`);
          return;
        }
      }

      // Fetch real meeting data from backend
      
      const result = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
        meetingId: meetingId
      });
      
      
      if (result.getMeetingById) {
        const meeting: MeetingInfo = {
          _id: result.getMeetingById._id,
          title: result.getMeetingById.title,
          status: result.getMeetingById.status === 'CREATED' ? 'SCHEDULED' : 
                  result.getMeetingById.status === 'SCHEDULED' ? 'SCHEDULED' : 
                  result.getMeetingById.status === 'LIVE' ? 'STARTED' :
                  result.getMeetingById.status === 'ENDED' ? 'ENDED' : 'SCHEDULED',
          inviteCode: result.getMeetingById.inviteCode
        };
        setMeetingInfo(meeting);
        
        // Check if meeting is LIVE - redirect immediately to live room
        if (result.getMeetingById.status === 'LIVE') {
          
          // Prevent infinite redirect loop using localStorage with timestamp
          const redirectKey = `redirected_to_live_${meetingId}`;
          const lastRedirectTime = localStorage.getItem(redirectKey);
          const now = Date.now();
          const REDIRECT_COOLDOWN = 30000; // 10 seconds cooldown
          
          
          if (!lastRedirectTime || (now - parseInt(lastRedirectTime)) > REDIRECT_COOLDOWN) {
            localStorage.setItem(redirectKey, now.toString());
            router.push(`/livestream/${meetingId}`);
          } else {
          }
          return;
        }
        
        // Check if meeting is ended
        if (meeting.status === 'ENDED') {
          // Meeting is ended, show error or redirect
          await Swal.fire({
            icon: 'info',
            title: '미팅 종료',
            text: '이미 종료된 미팅입니다.',
            confirmButtonText: '확인'
          });
          router.push('/member');
        } else {
        // Meeting is created/scheduled, show waiting room
        setIsWaitingForMeeting(true);
        
        // Start real-time WebSocket monitoring
        startWebSocketMonitoring(meetingId);
        }
      } else {
        throw new Error('Meeting not found');
      }
    } catch (error) {
    }
  };

  // REAL-TIME WebSocket-based monitoring instead of polling
  const startWebSocketMonitoring = (meetingId: string) => {
    
    // Import WebSocket functionality
    const setupWebSocket = async () => {
      try {
        const { getAuthToken } = await import('../../lib/simple-auth-handlers');
        const token = getAuthToken();
        
        if (!token) {
          return startPollingFallback(meetingId);
        }

        // Create WebSocket connection for waiting room updates
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3007';
        
        const socket = io(`${backendUrl}/signaling`, {
          auth: { token },
          transports: ['websocket'],
          upgrade: true,
        });

        socket.on('connect', () => {
          
          // Join waiting room for this meeting
          socket.emit('JOIN_WAITING_ROOM', { 
            meetingId, 
            participantId 
          });
        });

        socket.on('WAITING_ROOM_JOINED', (data) => {
        });

        // Listen for meeting status changes
        socket.on('MEETING_STATUS_CHANGED', (data) => {
          
          if (data.status === 'LIVE' || data.status === 'STARTED' || data.status === 'ACTIVE') {
            
            // Prevent infinite redirect loop
            const redirectKey = `redirected_to_live_${meetingId}`;
            const lastRedirectTime = localStorage.getItem(redirectKey);
            const now = Date.now();
            const REDIRECT_COOLDOWN = 30000; // 10 seconds cooldown
            
            if (!lastRedirectTime || (now - parseInt(lastRedirectTime)) > REDIRECT_COOLDOWN) {
              localStorage.setItem(redirectKey, now.toString());
              socket.disconnect();
              router.push(`/livestream/${meetingId}`);
            }
          }
        });

        // Listen for participant approval
        socket.on('PARTICIPANT_APPROVED', (data) => {
          
          if (data.participantId === participantId) {
            socket.disconnect();
            router.push(`/livestream/${meetingId}`);
          }
        });

        // Listen for waiting room updates
        socket.on('WAITING_ROOM_UPDATE', (data) => {
          
          if (data.type === 'PARTICIPANT_APPROVED' && data.participantId === participantId) {
            socket.disconnect();
            router.push(`/livestream/${meetingId}`);
          }
        });

        // Listen for participant admitted to meeting
        socket.on('PARTICIPANT_ADMITTED_TO_MEETING', (data) => {
          
          if (data.participantId === participantId) {
            socket.disconnect();
            router.push(`/livestream/${meetingId}`);
          }
        });

        // Listen for all participants admitted (when meeting starts)
        socket.on('ALL_PARTICIPANTS_ADMITTED', (data) => {
          socket.disconnect();
          router.push(`/livestream/${meetingId}`);
        });

        socket.on('disconnect', () => {
        });

        socket.on('error', (error) => {
        });

        // Return socket for cleanup
        return socket;
      } catch (error) {
        // Fallback to polling if WebSocket fails
        return startPollingFallback(meetingId);
      }
    };

    // Fallback polling method (keep existing logic as backup)
    const startPollingFallback = (meetingId: string) => {
      
      const interval = setInterval(async () => {
        try {
          const result = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
            meetingId: meetingId
          });
          
          if (result.getMeetingById) {
            
            if (result.getMeetingById.status === 'LIVE' || result.getMeetingById.status === 'STARTED' || result.getMeetingById.status === 'ACTIVE') {
              clearInterval(interval);
              router.push(`/livestream/${meetingId}`);
            }
          }
        } catch (error) {
        }
      }, 2000);

      return () => clearInterval(interval);
    };

    return setupWebSocket();
  };

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteCode.trim()) {
      setError('초대코드를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      
      // For now, redirect to prejoin page with the invite code
      // In a full implementation, you would validate the invite code here
      router.push(`/prejoin/${inviteCode}`);
    } catch (error: any) {
      
      let errorMessage = '미팅 참여 중 오류가 발생했습니다.';
      
      if (error.message && error.message.includes('Invalid invite code')) {
        errorMessage = '유효하지 않은 초대코드입니다.';
      } else if (error.message && error.message.includes('Meeting not found')) {
        errorMessage = '해당 미팅을 찾을 수 없습니다.';
      } else if (error.message && error.message.includes('Meeting has ended')) {
        errorMessage = '이미 종료된 미팅입니다.';
      }
      
      setError(errorMessage);
      
      await Swal.fire({
        icon: 'error',
        title: '미팅 참여 실패',
        text: errorMessage,
        confirmButtonText: '확인',
        confirmButtonColor: '#d32f2f'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInviteCode(e.target.value);
    if (error) setError('');
  };

  const handleLeaveWaitingRoom = async () => {
    try {
      const { code, meetingId } = router.query;
      if (participantId && meetingId) {
        
        // Emit LEAVE_WAITING_ROOM WebSocket event
        try {
          const { getAuthToken } = await import('../../lib/simple-auth-handlers');
          const token = getAuthToken();
          
          if (token) {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3007';
            const socket = io(`${backendUrl}/signaling`, {
              auth: { token },
              transports: ['websocket'],
            });

            socket.on('connect', () => {
              socket.emit('LEAVE_WAITING_ROOM', { 
                meetingId, 
                participantId 
              });
              
              // Wait a moment for the event to be processed, then disconnect
              setTimeout(() => {
                socket.disconnect();
              }, 1000);
            });

            socket.on('WAITING_ROOM_LEFT', (data) => {
            });

            socket.on('error', (error) => {
            });
          }
        } catch (socketError) {
        }
        
        // Redirect to dashboard
        router.push('/member');
      }
    } catch (error) {
    }
  };

  return (
    <>
      <Head>
        <title>HRDE - 미팅 참여</title>
        <meta name="description" content="초대코드로 미팅에 참여하세요" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="auth-container">
        <div className="auth-modal">
          <div className="form-section">
            <div className="logo-section">
              <Image
                src="/logoHRDe.png"
                alt="HRDE"
                width={120}
                height={55}
                style={{
                  objectFit: 'contain'
                }}
              />
            </div>

            <h2 className="form-title">
              {isWaitingForMeeting ? '미팅 대기 중' : '미팅 참여'}
            </h2>
            
            {isWaitingForMeeting ? (
              <div className="waiting-content">
                {meetingInfo && (
                  <div className="meeting-info-card">
                    <h3>{meetingInfo.title}</h3>
                    <p className="meeting-status">
                      {meetingInfo.status === 'SCHEDULED' ? '대기 중' : meetingInfo.status}
                    </p>
                    <div className="invite-code-section">
                      <label className="invite-code-label">초대코드</label>
                      <div className="invite-code-container">
                        <span className="invite-code">{meetingInfo.inviteCode}</span>
                        <button 
                          className="copy-button"
                          onClick={() => {
                            navigator.clipboard.writeText(meetingInfo.inviteCode);
                            // Show temporary success message
                            const button = document.querySelector('.copy-button') as HTMLButtonElement;
                            if (button) {
                              const originalText = button.textContent;
                              button.textContent = '복사됨!';
                              button.style.background = '#10b981';
                              setTimeout(() => {
                                button.textContent = originalText;
                                button.style.background = '';
                              }, 2000);
                            }
                          }}
                          title="초대코드 복사"
                        >
                          복사
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="waiting-animation">
                  <div className="spinner"></div>
                  <p>미팅이 시작될 때까지 잠시 기다려주세요</p>
                </div>
                
                <div className="navigation-buttons">
                  <button 
                    onClick={async () => {
                      try {
                        await handleLeaveWaitingRoom();
                        
                        const { isAuthenticated, getCurrentUser } = await import('../../lib/simple-auth-handlers');
                        if (isAuthenticated()) {
                          const currentUser = await getCurrentUser();
                          if (currentUser?.systemRole === 'TUTOR') {
                            router.push('/instructor');
                          } else if (currentUser?.systemRole === 'ADMIN') {
                            router.push('/instructor');
                          } else {
                            router.push('/member');
                          }
                        } else {
                          router.push('/member');
                        }
                      } catch (error) {
                        router.push('/member');
                      }
                    }}
                    className="nav-button exit"
                  >
                    나가기
                  </button>
                </div>
              </div>
            ) : (
              <div className="join-form">
                <p className="form-description">
                  호스트로부터 받은 초대코드를 입력하여 미팅에 참여하세요
                </p>
                <form onSubmit={handleJoinMeeting}>
                  <div className="form-group">
                    <label htmlFor="inviteCode">초대코드</label>
                    <input
                      type="text"
                      id="inviteCode"
                      name="inviteCode"
                      className={`form-input ${error ? 'error' : ''}`}
                      placeholder="초대코드를 입력하세요"
                      value={inviteCode}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      style={{
                        textAlign: 'center',
                        fontSize: '18px',
                        letterSpacing: '2px',
                        textTransform: 'uppercase'
                      }}
                    />
                    {error && <div className="error-message">{error}</div>}
                  </div>

                  <button 
                    type="submit" 
                    className="submit-button"
                    disabled={isLoading || !inviteCode.trim()}
                  >
                    {isLoading ? '참여 중...' : '장치 확인 후 참여'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {!isWaitingForMeeting && (
            <>
              <div className="divider">
                <span className="divider-text">OR</span>
              </div>

              <div className="auth-options">
                <a 
                  href="/login" 
                  className="signup-link"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    marginBottom: '15px'
                  }}
                >
                  회원으로 로그인
                </a>
                <a 
                  href="/instructor/login" 
                  className="link-button"
                  style={{
                    display: 'block',
                    textAlign: 'center'
                  }}
                >
                  강사 로그인
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: relative;
          overflow: hidden;
          padding: 20px;
        }

        .auth-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><filter id="blur"><feGaussianBlur stdDeviation="10"/></filter></defs><circle cx="200" cy="200" r="100" fill="%23ff6b6b" filter="url(%23blur)"/><circle cx="800" cy="300" r="150" fill="%234ecdc4" filter="url(%23blur)"/><circle cx="400" cy="700" r="120" fill="%2345b7d1" filter="url(%23blur)"/><circle cx="700" cy="600" r="80" fill="%2396ceb4" filter="url(%23blur)"/></svg>') no-repeat center center;
          background-size: cover;
          filter: blur(20px);
          opacity: 0.3;
        }

        .auth-modal {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          width: 100%;
          max-width: 450px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 1;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .logo-section {
          text-align: center;
          margin-bottom: 40px;
        }

        .form-section {
          margin-bottom: 30px;
        }

        .form-title {
          font-size: 1.6rem;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 16px;
          text-align: center;
        }

        .form-description {
          text-align: center;
          color: #64748b;
          margin-bottom: 32px;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .join-form {
          padding: 0;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .form-input {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.2s ease;
          background: #fff;
          box-sizing: border-box;
        }

        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-input.error {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .form-input::placeholder {
          color: #999;
        }

        .submit-button {
          width: 100%;
          padding: 14px 24px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 8px;
        }

        .submit-button:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .divider {
          position: relative;
          text-align: center;
          margin: 30px 0;
        }

        .divider::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: #e1e5e9;
        }

        .divider-text {
          background: rgba(255, 255, 255, 0.95);
          padding: 0 20px;
          color: #666;
          font-size: 0.9rem;
          font-weight: 500;
          position: relative;
          z-index: 1;
        }

        .auth-options {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .signup-link {
          text-align: center;
          color: #4A90E2;
          text-decoration: underline;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.3s ease;
        }

        .signup-link:hover {
          color: #357ABD;
        }

        .link-button {
          width: 100%;
          padding: 15px;
          background: white;
          color: #4A90E2;
          border: 2px solid #e1e5e9;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          text-align: center;
          display: block;
        }

        .link-button:hover {
          border-color: #4A90E2;
          background: #f8f9ff;
          transform: translateY(-1px);
        }

        .error-message {
          background: #fef2f2;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
          margin: 12px 0;
          border: 1px solid #fecaca;
          font-size: 0.9rem;
          text-align: center;
          font-weight: 500;
        }

        .waiting-content {
          text-align: center;
          padding: 0;
        }

        .meeting-info-card {
          background: #f8fafc;
          padding: 24px;
          border-radius: 16px;
          margin-bottom: 40px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .meeting-info-card h3 {
          margin: 0 0 8px 0;
          color: #1e293b;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .meeting-status {
          margin: 0 0 20px 0;
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .invite-code-section {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }

        .invite-code-label {
          display: block;
          font-size: 0.85rem;
          color: #64748b;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .invite-code-container {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
        }

        .invite-code {
          flex: 1;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.9rem;
          font-weight: 600;
          color: #1e293b;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .copy-button {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .copy-button:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }

        .waiting-animation {
          margin: 40px 0;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 2px solid #e2e8f0;
          border-top: 2px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .waiting-animation p {
          color: #64748b;
          font-size: 0.95rem;
          margin: 0;
          font-weight: 500;
        }

        .navigation-buttons {
          display: flex;
          justify-content: center;
          margin-top: 40px;
        }

        .nav-button {
          padding: 12px 32px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #f8fafc;
          color: #64748b;
          border-color: #e2e8f0;
          min-width: 120px;
        }

        .nav-button.exit {
          background: #f8fafc;
          color: #64748b;
          border-color: #e2e8f0;
        }

        .nav-button.exit:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          transform: translateY(-1px);
        }

        @media (max-width: 480px) {
          .auth-container {
            padding: 16px;
          }

          .auth-modal {
            padding: 24px 20px;
          }

          .form-title {
            font-size: 1.4rem;
          }

          .logo-section {
            margin-bottom: 30px;
          }

          .meeting-info-card {
            padding: 20px;
            margin-bottom: 30px;
          }

          .waiting-animation {
            margin: 30px 0;
          }

          .navigation-buttons {
            margin-top: 30px;
          }

          .nav-button {
            width: 100%;
            max-width: 200px;
          }

          .invite-code-container {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }

          .invite-code {
            text-align: center;
            padding: 8px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
          }

          .copy-button {
            width: 100%;
            padding: 8px 12px;
          }
        }
      `}</style>
    </>
  );
};

export default WaitingRoomPage;
