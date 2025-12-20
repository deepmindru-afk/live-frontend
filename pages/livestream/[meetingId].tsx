import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { isAuthenticated } from '../../lib/simple-auth-handlers';
import ProfessionalLiveStreamRoom from '../../components/ProfessionalLiveStreamRoom';

const REDIRECT_URL = 'https://beta.hrdeedu.co.kr';

const LiveStreamRoomPage: React.FC = () => {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // CRITICAL FIX: Derive meetingId directly from router.query instead of storing in state
  // This prevents infinite re-render loops caused by router.query updates
  const meetingId = router.query.meetingId as string;

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check authentication and redirect if not authenticated
  useEffect(() => {
    const checkAuth = async () => {
      if (isClient && meetingId) {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
          // Redirect to hrdeedu.co.kr if not authenticated
          window.location.href = REDIRECT_URL;
          return;
        }
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, [isClient, meetingId]);

  if (!isClient || !meetingId || !authChecked) {
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

  return <ProfessionalLiveStreamRoom meetingId={meetingId} />;
};

export default LiveStreamRoomPage;
