import React, { useState } from 'react';
import { useHandRaise } from '../hooks/useHandRaise';
import { Socket } from 'socket.io-client';

interface RaisedHandsListProps {
  socket: Socket | null;
  isConnected: boolean;
  meetingId: string;
  participantId: string;
  isHost: boolean;
  className?: string;
}

export const RaisedHandsList: React.FC<RaisedHandsListProps> = ({
  socket,
  isConnected,
  meetingId,
  participantId,
  isHost,
  className = '',
}) => {
  const [showLowerModal, setShowLowerModal] = useState<string | null>(null);
  const [lowerReason, setLowerReason] = useState('');

  const {
    raisedHands,
    isLoading,
    hostLowerHand,
    lowerAllHands,
  } = useHandRaise({
    socket,
    isConnected,
    meetingId,
    participantId,
    isHost,
    onHandRaised: (info) => {
      console.log('Hand raised:', info);
    },
    onHandLowered: (info) => {
      console.log('Hand lowered:', info);
    },
    onHandLoweredByHost: (info) => {
      console.log('Hand lowered by host:', info);
    },
    onAllHandsLowered: (info) => {
      console.log('All hands lowered:', info);
    },
    onError: (error) => {
      console.error('Hand raise error:', error);
    },
  });

  const handleLowerHand = (targetParticipantId: string) => {
    setShowLowerModal(targetParticipantId);
  };

  const handleConfirmLower = () => {
    if (showLowerModal) {
      hostLowerHand(showLowerModal, lowerReason || undefined);
      setShowLowerModal(null);
      setLowerReason('');
    }
  };

  const handleCancelLower = () => {
    setShowLowerModal(null);
    setLowerReason('');
  };

  const handleLowerAllHands = () => {
    if (window.confirm('Are you sure you want to lower all raised hands?')) {
      lowerAllHands();
    }
  };

  if (!isHost) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            Raised Hands ({raisedHands.length})
          </h3>
          {raisedHands.length > 0 && (
            <button
              onClick={handleLowerAllHands}
              disabled={isLoading || !isConnected}
              className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Lower All
            </button>
          )}
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {raisedHands.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No hands raised
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {raisedHands.map((hand) => (
              <div key={hand.participantId} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">✋</span>
                    <div>
                      <p className="font-medium text-gray-800">
                        {hand.displayName}
                      </p>
                      {hand.reason && (
                        <p className="text-sm text-gray-600 mt-1">
                          "{hand.reason}"
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Raised {new Date(hand.raisedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLowerHand(hand.participantId)}
                    disabled={isLoading || !isConnected}
                    className="px-3 py-1 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Lower
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lower Hand Modal */}
      {showLowerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Lower Hand</h3>
            <p className="text-gray-600 mb-4">
              Would you like to provide a reason for lowering this hand? (Optional)
            </p>
            <textarea
              value={lowerReason}
              onChange={(e) => setLowerReason(e.target.value)}
              placeholder="Enter reason (optional)..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none"
              rows={3}
              maxLength={200}
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={handleCancelLower}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLower}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Lower Hand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



