import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { JOIN_MEETING_BY_CODE } from '../../apollo/meeting/queries';
import Swal from 'sweetalert2';

interface MeetingInfo {
  _id: string;
  title: string;
  status: 'STARTED' | 'SCHEDULED' | 'ENDED';
  inviteCode: string;
}

const WaitingRoomPage: React.FC = () => {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [isWaitingForMeeting, setIsWaitingForMeeting] = useState(false);

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
  }, [router.query]);

  const checkMeetingStatus = async (meetingId: string) => {
    try {
      // This would be a real GraphQL query in production
      // For now, we'll use mock data
      const mockMeeting: MeetingInfo = {
        _id: meetingId,
        title: 'Sample Meeting',
        status: 'SCHEDULED', // This would come from the backend
        inviteCode: inviteCode
      };
      setMeetingInfo(mockMeeting);
      
      if (mockMeeting.status === 'STARTED') {
        // Meeting is already started, redirect to meeting
        router.push(`/meeting/${meetingId}`);
      } else {
        // Meeting not started yet, show waiting room
        setIsWaitingForMeeting(true);
      }
    } catch (error) {
      console.error('Error checking meeting status:', error);
    }
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
      
      const result = await enhancedMakeGraphQLRequest(JOIN_MEETING_BY_CODE, { 
        inviteCode: inviteCode.trim() 
      });
      
      console.log('🚪 WAITING ROOM: Backend response:', result);

      if (result.joinMeetingByCode && result.joinMeetingByCode.success) {
        // Redirect to pre-join device check page
        const meetingId = result.joinMeetingByCode.meeting._id;
        console.log('🚪 WAITING ROOM: Redirecting to pre-join page:', meetingId);
        router.push(`/prejoin/${meetingId}`);
      } else {
        throw new Error(result.joinMeetingByCode?.message || '미팅 참여에 실패했습니다.');
      }
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
                {meetingInfo && (
                  <div className="meeting-info">
                    <h3>{meetingInfo.title}</h3>
                    <p>미팅 ID: {meetingInfo._id.slice(-8)}</p>
                    <p>상태: 대기 중</p>
                  </div>
                )}
                
                <div className="waiting-animation">
                  <div className="spinner"></div>
                  <p>미팅 시작을 기다리는 중...</p>
                </div>
                
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="back-button"
                >
                  대시보드로 돌아가기
                </button>
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
        }

        .meeting-info {
          background: #f8f9ff;
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 30px;
          border: 1px solid #e1e5e9;
        }

        .meeting-info h3 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 1.2rem;
        }

        .meeting-info p {
          margin: 5px 0;
          color: #666;
          font-size: 0.9rem;
        }

        .waiting-animation {
          margin: 30px 0;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e1e5e9;
          border-top: 4px solid #4A90E2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
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

        .back-button {
          background: #6c757d;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 20px;
        }

        .back-button:hover {
          background: #5a6268;
          transform: translateY(-1px);
        }

        @media (max-width: 480px) {
          .auth-container {
            padding: 16px;
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
