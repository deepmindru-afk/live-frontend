import React, { useState } from 'react';
import Head from 'next/head';
import SimpleLiveKitRoom from '../components/SimpleLiveKitRoom';

const TestLiveKitPage: React.FC = () => {
  const [meetingId] = useState('test-meeting-12345');
  const [participantName] = useState('Test User');
  const [meetingRole] = useState<'HOST' | 'PARTICIPANT'>('HOST');
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);

  const handleToggle = (enabled: boolean) => {
    setIsVideoEnabled(enabled);
    console.log('Video enabled:', enabled);
  };

  return (
    <>
      <Head>
        <title>LiveKit Test - HRDe</title>
        <meta name="description" content="Test LiveKit video integration" />
      </Head>

      <div style={{
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          backgroundColor: '#2a2a2a',
          borderBottom: '1px solid #333',
        }}>
          <h1 style={{ margin: 0, fontSize: '24px', marginBottom: '8px' }}>
            LiveKit Integration Test
          </h1>
          <div style={{ fontSize: '14px', color: '#ccc' }}>
            Meeting ID: {meetingId} | Role: {meetingRole} | Participant: {participantName}
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#333',
          borderBottom: '1px solid #444',
          fontSize: '14px',
        }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            Setup Instructions:
          </div>
          <ol style={{ margin: 0, paddingLeft: '20px', color: '#ccc' }}>
            <li>Make sure your backend server is running on port 3007</li>
            <li>Configure your LiveKit server credentials in .env files</li>
            <li>Click "Enable Video" to start the video call</li>
            <li>Allow camera and microphone permissions when prompted</li>
            <li>Open this page in multiple browser tabs to test multiple participants</li>
          </ol>
        </div>

        {/* LiveKit Integration */}
        <div style={{ flex: 1, height: 'calc(100vh - 200px)' }}>
          <SimpleLiveKitRoom
            meetingId={meetingId}
            participantName={participantName}
            meetingRole={meetingRole}
            onConnected={() => console.log('Connected to LiveKit')}
            onDisconnected={() => console.log('Disconnected from LiveKit')}
            onError={(error) => console.error('LiveKit error:', error)}
            style={{ height: '100%' }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#2a2a2a',
          borderTop: '1px solid #333',
          fontSize: '12px',
          color: '#888',
          textAlign: 'center',
        }}>
          LiveKit Integration Test - Check browser console for detailed logs
        </div>
      </div>
    </>
  );
};

export default TestLiveKitPage;
