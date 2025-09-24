import React, { useEffect } from 'react';
import { GetServerSideProps } from 'next';
import ProfessionalLiveStreamRoom from '../../components/ProfessionalLiveStreamRoom';

interface LiveStreamRoomPageProps {
  meetingId: string;
}

const LiveStreamRoomPage: React.FC<LiveStreamRoomPageProps> = ({ meetingId }) => {
  // Debug logging
  console.log('🔍 LIVESTREAM PAGE: Render - meetingId:', meetingId);

  // Force client-side rendering
  useEffect(() => {
    console.log('🔍 LIVESTREAM PAGE: Client-side effect running with meetingId:', meetingId);
  }, [meetingId]);

  if (!meetingId || meetingId === 'livestream') {
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
          <p style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>
            Meeting ID: {meetingId || 'None'}
          </p>
        </div>
      </div>
    );
  }

  console.log('🔍 LIVESTREAM PAGE: Rendering component with meetingId:', meetingId);
  return <ProfessionalLiveStreamRoom meetingId={meetingId} />;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { meetingId } = context.params!;
  
  console.log('🔍 SERVER SIDE: Meeting ID from params:', meetingId);
  
  return {
    props: {
      meetingId: meetingId as string,
    },
  };
};

export default LiveStreamRoomPage;
