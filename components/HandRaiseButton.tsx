import React, { useState } from 'react';
import { useHandRaise } from '../hooks/useHandRaise';
import { Socket } from 'socket.io-client';

interface HandRaiseButtonProps {
  socket: Socket | null;
  isConnected: boolean;
  meetingId: string;
  participantId: string;
  isHost: boolean;
  className?: string;
  disabled?: boolean;
}

export const HandRaiseButton: React.FC<HandRaiseButtonProps> = ({
  socket,
  isConnected,
  meetingId,
  participantId,
  isHost,
  className = '',
  disabled = false,
}) => {
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reason, setReason] = useState('');

  const {
    myHandRaised,
    isLoading,
    raiseHand,
    lowerHand,
  } = useHandRaise({
    socket,
    isConnected,
    meetingId,
    participantId,
    isHost,
    onHandRaised: (info) => {
    },
    onHandLowered: (info) => {
    },
    onError: (error) => {
    },
  });

  const handleRaiseHand = () => {
    if (myHandRaised) {
      lowerHand();
    } else {
      setShowReasonModal(true);
    }
  };

  const handleConfirmRaise = () => {
    raiseHand(reason || undefined);
    setShowReasonModal(false);
    setReason('');
  };

  const handleCancelRaise = () => {
    setShowReasonModal(false);
    setReason('');
  };

  return (
    <>
      <button
        onClick={handleRaiseHand}
        disabled={disabled || isLoading || !isConnected}
        className={`
          px-4 py-2 rounded-lg font-medium transition-all duration-200
          ${myHandRaised
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
          }
          ${disabled || isLoading || !isConnected
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:shadow-md'
          }
          ${className}
        `}
      >
        {isLoading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            {myHandRaised ? '손 내리는 중...' : '손 드는 중...'}
          </div>
        ) : (
          <div className="flex items-center">
            <span className="text-lg mr-2">
              {myHandRaised ? '✋' : '✋'}
            </span>
            {myHandRaised ? '손 내리기' : '손 들기'}
          </div>
        )}
      </button>

      {/* Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">손 들기</h3>
            <p className="text-gray-600 mb-4">
              손을 드는 이유를 입력하시겠습니까? (선택 사항)
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="이유를 입력하세요 (선택 사항)..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none"
              rows={3}
              maxLength={200}
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={handleCancelRaise}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmRaise}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                손 들기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};




