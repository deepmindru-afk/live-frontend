import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { makeGraphQLRequest } from '../../lib/simple-auth-handlers';
import { GET_MEETING_BY_ID } from '../../apollo/meeting/queries';
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
    
    // Cleanup function to clear any intervals
    return () => {
      // Cleanup will be handled by the monitoring function
    };
  }, [router.query]);

  const checkMeetingStatus = async (meetingId: string) => {
    try {
      // Check if user is authenticated and get their role
      const { isAuthenticated, getCurrentUser } = await import('../../lib/simple-auth-handlers');
      
      if (isAuthenticated()) {
        const currentUser = await getCurrentUser();
        
        // If user is TUTOR (host), go directly to meeting room
        if (currentUser && currentUser.systemRole === 'TUTOR') {
          console.log('🎯 WAITING: User is TUTOR, going directly to meeting room');
          router.push(`/meeting/${meetingId}`);
          return;
        }
      }

      // Fetch real meeting data from backend
      console.log('🚪 WAITING: Fetching meeting info for ID:', meetingId);
      
      const result = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
        meetingId: meetingId
      });
      
      console.log('🚪 WAITING: Backend response:', result);
      
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
        console.log('🚪 WAITING: Successfully loaded meeting:', meeting);
        
        // Check if meeting is LIVE - redirect immediately to live room
        if (result.getMeetingById.status === 'LIVE') {
          console.log('🎯 WAITING: Meeting is LIVE, redirecting to live room immediately');
          
          // Prevent infinite redirect loop using localStorage with timestamp
          const redirectKey = `redirected_to_live_${meetingId}`;
          const lastRedirectTime = localStorage.getItem(redirectKey);
          const now = Date.now();
          const REDIRECT_COOLDOWN = 10000; // 10 seconds cooldown
          
          console.log('🔍 WAITING: Initial redirect check:', {
            meetingId,
            participantId,
            redirectKey,
            lastRedirectTime,
            timeSinceLastRedirect: lastRedirectTime ? now - parseInt(lastRedirectTime) : 'never',
            cooldownPeriod: REDIRECT_COOLDOWN,
            backendStatus: result.getMeetingById.status
          });
          
          if (!lastRedirectTime || (now - parseInt(lastRedirectTime)) > REDIRECT_COOLDOWN) {
            localStorage.setItem(redirectKey, now.toString());
            console.log('🚀 WAITING: Initial redirect to live room (cooldown period passed)');
            router.push(`/livestream/${meetingId}`);
          } else {
            console.log('⚠️ WAITING: Initial redirect cooldown active, staying in waiting room to prevent loop');
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
        
        // Start monitoring meeting status
        startMeetingStatusMonitoring(meetingId);
        }
      } else {
        throw new Error('Meeting not found');
      }
    } catch (error) {
      console.error('Error checking meeting status:', error);
    }
  };

  // Monitor meeting status and participant approval
  const startMeetingStatusMonitoring = (meetingId: string) => {
    const interval = setInterval(async () => {
      try {
        // Check meeting status
        const result = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
          meetingId: meetingId
        });
        
        if (result.getMeetingById) {
          console.log('🔄 WAITING: Monitoring meeting status:', result.getMeetingById.status);
          
          const currentStatus = result.getMeetingById.status === 'CREATED' ? 'SCHEDULED' : 
                               result.getMeetingById.status === 'SCHEDULED' ? 'SCHEDULED' : 
                               result.getMeetingById.status === 'LIVE' ? 'STARTED' :
                               result.getMeetingById.status === 'STARTED' ? 'STARTED' :
                               result.getMeetingById.status === 'ACTIVE' ? 'ACTIVE' :
                               result.getMeetingById.status === 'ENDED' ? 'ENDED' : 'SCHEDULED';
          
          console.log('🔄 WAITING: Mapped status:', currentStatus, 'from backend status:', result.getMeetingById.status);
          
          // Update meeting info
          setMeetingInfo(prev => prev ? { ...prev, status: currentStatus } : null);
          
          // If meeting is LIVE or started/active, redirect to live room
          if (result.getMeetingById.status === 'LIVE' || currentStatus === 'STARTED' || currentStatus === 'ACTIVE') {
            clearInterval(interval);
            console.log('🚀 WAITING: Meeting started (backend status:', result.getMeetingById.status, 'mapped status:', currentStatus, '), redirecting to live room');
            
            // Prevent infinite redirect loop using localStorage with timestamp
            const redirectKey = `redirected_to_live_${meetingId}`;
            const lastRedirectTime = localStorage.getItem(redirectKey);
            const now = Date.now();
            const REDIRECT_COOLDOWN = 10000; // 10 seconds cooldown
            
            console.log('🔍 WAITING: Redirect check:', {
              meetingId,
              participantId,
              redirectKey,
              lastRedirectTime,
              timeSinceLastRedirect: lastRedirectTime ? now - parseInt(lastRedirectTime) : 'never',
              cooldownPeriod: REDIRECT_COOLDOWN,
              backendStatus: result.getMeetingById.status,
              mappedStatus: currentStatus
            });
            
            if (!lastRedirectTime || (now - parseInt(lastRedirectTime)) > REDIRECT_COOLDOWN) {
              localStorage.setItem(redirectKey, now.toString());
              console.log('🚀 WAITING: Redirecting to live room (cooldown period passed)');
              router.push(`/livestream/${meetingId}`);
            } else {
              console.log('⚠️ WAITING: Redirect cooldown active, staying in waiting room to prevent loop');
            }
          }
          
          // Check if participant is approved (if we have participantId)
          if (participantId) {
            // TODO: Add participant approval check query
            // For now, we'll assume all participants are approved when meeting starts
          }
        }
      } catch (error) {
        console.error('Error monitoring meeting status:', error);
      }
    }, 2000); // Check every 2 seconds for faster response
    
    // Store interval ID for cleanup
    return () => clearInterval(interval);
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
      console.log('🚪 WAITING ROOM: Attempting to join meeting with code:', inviteCode);
      
      // For now, redirect to prejoin page with the invite code
      // In a full implementation, you would validate the invite code here
      router.push(`/prejoin/${inviteCode}`);
    } catch (error: any) {
      console.error('🚪 WAITING ROOM: Join meeting error:', error);
      
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

  return (
    <>
      <Head>
        <title>HRDE - 미팅 참여</title>
        <meta name="description" content="초대코드로 미팅에 참여하세요" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="auth-container">
        <div className="auth-modal">
          <div className="logo">
            <Image
              src="/logoHRDe.png"
              alt="HRDE"
              width={150}
              height={69}
              style={{
                objectFit: 'contain'
              }}
            />
          </div>

          <div className="form-section">
            <h2 className="form-title">
              {isWaitingForMeeting ? '미팅 대기 중' : '미팅 참여'}
            </h2>
            <p style={{
              textAlign: 'center',
              color: '#666',
              marginBottom: '30px',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              {isWaitingForMeeting 
                ? '미팅이 시작될 때까지 잠시 기다려주세요. 호스트가 미팅을 시작하면 자동으로 입장됩니다.'
                : '호스트로부터 받은 초대코드를 입력하여 미팅에 참여하세요.'
              }
            </p>
            
            {isWaitingForMeeting ? (
              <div className="waiting-content">
                {/* Header with tagline and logo */}
                <div className="waiting-header">
                  <div className="tagline">Let's go together</div>
                  <div className="logo-section">
                    <div className="logo-icon">O</div>
                    <span className="logo-text">HRDe</span>
                  </div>
                </div>

                {meetingInfo && (
                  <div className="meeting-info-card">
                    <h3>{meetingInfo.title}</h3>
                    <p>Meeting ID: {meetingInfo._id}</p>
                    <p>Status: {meetingInfo.status === 'SCHEDULED' ? 'Pending' : meetingInfo.status}</p>
                  </div>
                )}
                
                <div className="waiting-animation">
                  <div className="spinner"></div>
                  <p>Waiting for the meeting to start...</p>
                </div>
                
                <div className="navigation-buttons">
                  <button 
                    onClick={async () => {
                      try {
                        const { isAuthenticated, getCurrentUser } = await import('../../lib/simple-auth-handlers');
                        if (isAuthenticated()) {
                          const currentUser = await getCurrentUser();
                          if (currentUser?.systemRole === 'TUTOR') {
                            router.push('/instructor');
                          } else if (currentUser?.systemRole === 'ADMIN') {
                            router.push('/admin');
                          } else {
                            router.push('/member');
                          }
                        } else {
                          router.push('/member');
                        }
                      } catch (error) {
                        console.error('Error getting user role:', error);
                        router.push('/member');
                      }
                    }}
                    className="nav-button dashboard"
                  >
                    Back to Dashboard
                  </button>
                  <button 
                    onClick={() => router.push(`/prejoin/${meetingInfo?._id}`)}
                    className="nav-button test"
                  >
                    Back to Test
                  </button>
                </div>
              </div>
            ) : (
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
                  style={{
                    marginTop: '20px'
                  }}
                >
                  {isLoading ? '참여 중...' : '장치 확인 후 참여'}
                </button>
              </form>
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

        .logo {
          text-align: center;
          margin-bottom: 30px;
        }

        .form-section {
          margin-bottom: 30px;
        }

        .form-title {
          font-size: 1.8rem;
          font-weight: 700;
          color: #333;
          margin-bottom: 20px;
          text-align: center;
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
          padding: 15px;
          border: 2px solid #e1e5e9;
          border-radius: 10px;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: #fff;
          box-sizing: border-box;
        }

        .form-input:focus {
          outline: none;
          border-color: #4A90E2;
          box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
        }

        .form-input.error {
          border-color: #e74c3c;
          box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1);
        }

        .form-input::placeholder {
          color: #999;
        }

        .submit-button {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #4A90E2, #357ABD);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .submit-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #357ABD, #2E6BA8);
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(74, 144, 226, 0.3);
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
          background: #fee;
          color: #c33;
          padding: 12px;
          border-radius: 8px;
          margin: 15px 0;
          border: 1px solid #fcc;
          font-size: 0.9rem;
          text-align: center;
        }

        .waiting-content {
          text-align: center;
          padding: 0 20px;
        }

        .waiting-header {
          margin-bottom: 30px;
        }

        .tagline {
          font-family: 'Brush Script MT', cursive;
          font-size: 1.2rem;
          color: #666;
          margin-bottom: 15px;
          font-weight: 300;
        }

        .logo-section {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .logo-icon {
          width: 40px;
          height: 40px;
          background: #4A90E2;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 1.2rem;
        }

        .logo-text {
          font-size: 1.5rem;
          font-weight: bold;
          color: #4A90E2;
        }

        .meeting-info-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 30px;
          border: 1px solid #e9ecef;
        }

        .meeting-info-card h3 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 1.3rem;
          font-weight: bold;
        }

        .meeting-info-card p {
          margin: 5px 0;
          color: #666;
          font-size: 0.95rem;
        }

        .waiting-animation {
          margin: 30px 0;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f0f0f0;
          border-top: 3px solid #4A90E2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 15px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .waiting-animation p {
          color: #666;
          font-size: 1rem;
          margin: 0;
        }

        .navigation-buttons {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin-top: 30px;
        }

        .nav-button {
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 140px;
        }

        .nav-button.dashboard {
          background: #6c757d;
          color: white;
        }

        .nav-button.dashboard:hover {
          background: #5a6268;
          transform: translateY(-1px);
        }

        .nav-button.test {
          background: #007bff;
          color: white;
        }

        .nav-button.test:hover {
          background: #0056b3;
          transform: translateY(-1px);
        }

        @media (max-width: 480px) {
          .auth-container {
            padding: 16px;
          }

          .navigation-buttons {
            flex-direction: column;
            align-items: center;
          }

          .nav-button {
            width: 100%;
            max-width: 200px;
          }

          .waiting-header {
            margin-bottom: 20px;
          }

          .tagline {
            font-size: 1rem;
          }

          .logo-section {
            margin-bottom: 15px;
          }

          .logo-icon {
            width: 35px;
            height: 35px;
            font-size: 1rem;
          }

          .logo-text {
            font-size: 1.3rem;
          }
        }

          .auth-modal {
            padding: 30px 20px;
          }

          .form-title {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </>
  );
};

export default WaitingRoomPage;
