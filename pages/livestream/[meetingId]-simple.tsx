import React from 'react';
import { useRouter } from 'next/router';
import WorkingLiveStreamRoom from '../../components/WorkingLiveStreamRoom';

const SimpleLiveStreamRoomPage: React.FC = () => {
  const router = useRouter();
  const { meetingId } = router.query;

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

  return <WorkingLiveStreamRoom meetingId={meetingId as string} />;
};

export default SimpleLiveStreamRoomPage;
