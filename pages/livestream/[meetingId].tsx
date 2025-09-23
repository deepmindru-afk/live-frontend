import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ProfessionalLiveStreamRoom from '../../components/ProfessionalLiveStreamRoom';

const LiveStreamRoomPage: React.FC = () => {
  const router = useRouter();
  const { meetingId } = router.query;
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
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

  if (!meetingId) {
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
          <h2>Meeting ID Required</h2>
          <p>Please provide a valid meeting ID.</p>
        </div>
      </div>
    );
  }

  return <ProfessionalLiveStreamRoom meetingId={meetingId as string} />;
};

export default LiveStreamRoomPage;
