import React, { useState } from 'react';
import ClientSideRecording from './ClientSideRecording';

interface RecordingIntegrationProps {
  meetingId: string;
  userId: string;
  isHost?: boolean;
}

const RecordingIntegration: React.FC<RecordingIntegrationProps> = ({
  meetingId,
  userId,
  isHost = false,
}) => {
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRecordingComplete = (url: string) => {
    setRecordingUrl(url);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setRecordingUrl(null);
  };

  if (!isHost) {
    return (
      <div className="recording-notice">
        <p>Only the meeting host can start recording.</p>
      </div>
    );
  }

  return (
    <div className="recording-integration">
      <h3>Meeting Recording</h3>
      
      <ClientSideRecording
        meetingId={meetingId}
        userId={userId}
        onRecordingComplete={handleRecordingComplete}
        onError={handleError}
      />

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      {recordingUrl && (
        <div className="recording-success">
          <p>✅ Recording saved successfully!</p>
          <p>
            <strong>Recording URL:</strong>{' '}
            <a 
              href={recordingUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="recording-link"
            >
              {recordingUrl}
            </a>
          </p>
        </div>
      )}

      <style jsx>{`
        .recording-integration {
          margin: 20px 0;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f9f9f9;
        }

        .recording-notice {
          padding: 16px;
          background: #e8f4fd;
          border: 1px solid #b3d9ff;
          border-radius: 4px;
          color: #0066cc;
        }

        .error-message {
          margin-top: 16px;
          padding: 12px;
          background: #ffeaea;
          border: 1px solid #ffb3b3;
          border-radius: 4px;
          color: #cc0000;
        }

        .recording-success {
          margin-top: 16px;
          padding: 12px;
          background: #eafaf1;
          border: 1px solid #b3e6b3;
          border-radius: 4px;
          color: #006600;
        }

        .recording-link {
          color: #0066cc;
          text-decoration: none;
          word-break: break-all;
        }

        .recording-link:hover {
          text-decoration: underline;
        }

        h3 {
          margin: 0 0 16px 0;
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default RecordingIntegration;
