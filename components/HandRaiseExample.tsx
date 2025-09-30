import React from 'react';
import { HandRaiseButton } from './HandRaiseButton';
import { RaisedHandsList } from './RaisedHandsList';
import { Socket } from 'socket.io-client';

interface HandRaiseExampleProps {
  socket: Socket | null;
  isConnected: boolean;
  meetingId: string;
  participantId: string;
  isHost: boolean;
  className?: string;
}

export const HandRaiseExample: React.FC<HandRaiseExampleProps> = ({
  socket,
  isConnected,
  meetingId,
  participantId,
  isHost,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Hand Raise Button for Participants */}
      <div className="flex justify-center">
        <HandRaiseButton
          socket={socket}
          isConnected={isConnected}
          meetingId={meetingId}
          participantId={participantId}
          isHost={isHost}
          className="px-6 py-3 text-lg"
        />
      </div>

      {/* Raised Hands List for Hosts */}
      {isHost && (
        <RaisedHandsList
          socket={socket}
          isConnected={isConnected}
          meetingId={meetingId}
          participantId={participantId}
          isHost={isHost}
          className="max-w-2xl mx-auto"
        />
      )}

      {/* Connection Status */}
      <div className="text-center">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
          isConnected 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </div>
  );
};

