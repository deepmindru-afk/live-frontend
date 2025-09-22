import React from 'react';

interface SimpleLiveStreamRoomProps {
  meetingId: string;
}

const SimpleLiveStreamRoom: React.FC<SimpleLiveStreamRoomProps> = ({ meetingId }) => {
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
      <h1>Live Stream Room</h1>
      <p>Meeting ID: {meetingId}</p>
      <p>This is a test component to verify the import/export is working.</p>
      <div style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#2c2c2c',
        borderRadius: '8px',
        border: '1px solid #444'
      }}>
        <h3>Real Data Implementation Status:</h3>
        <ul style={{ textAlign: 'left' }}>
          <li>✅ Apollo Client configured</li>
          <li>✅ GraphQL queries defined</li>
          <li>✅ Component structure created</li>
          <li>✅ Import/export working</li>
        </ul>
      </div>
    </div>
  );
};

export default SimpleLiveStreamRoom;

