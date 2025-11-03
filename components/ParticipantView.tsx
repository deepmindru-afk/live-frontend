import React, { useState } from 'react';

interface ParticipantViewProps {
  participants: any[];
  waitingParticipants: any[];
  onApproveParticipant: (participantId: string) => void;
  onRejectParticipant: (participantId: string) => void;
  onKickParticipant: (participantId: string) => void;
  isHost: boolean;
}

const ParticipantView: React.FC<ParticipantViewProps> = ({
  participants,
  waitingParticipants,
  onApproveParticipant,
  onRejectParticipant,
  onKickParticipant,
  isHost
}) => {
  return (
    <div>
      {isHost && (
        <>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#9ca3af' }}>
            참여 학생 ({participants.length})
          </h4>
          {participants.map((participant) => (
        <div
          key={participant._id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px',
            backgroundColor: '#333',
            borderRadius: '6px',
            marginBottom: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: participant.role === 'HOST' ? '#3b82f6' : '#f97316',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white'
            }}>
              {participant.user?.displayName?.charAt(0)?.toUpperCase() || participant.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>
                  {participant.user?.companyName || participant.displayName || participant.user?.displayName || '알 수 없음'}
                </span>
                {participant.role === 'HOST' && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    padding: '2px 6px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    borderRadius: '4px'
                  }}>
                    호스트
                  </span>
                )}
              </div>
              {participant.user?.companyName && (
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {participant.displayName || participant.user?.displayName}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>

            {/* Hand Raised Indicator */}
            {participant.hasHandRaised && (
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }} title="손 들림">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z"/>
                </svg>
              </div>
            )}

            {/* Kick Button - Host Only */}
            {isHost && participant.role !== 'HOST' && (
              <button
                onClick={() => onKickParticipant(participant._id)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                title="참가자 제거"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            )}
          </div>
        </div>
          ))}
        </>
      )}

      {/* Waiting Room */}
      {waitingParticipants.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#9ca3af' }}>
            대기실 ({waitingParticipants.length})
          </h4>
          {waitingParticipants.map((participant) => (
            <div
              key={participant._id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px',
                backgroundColor: '#333',
                borderRadius: '6px',
                marginBottom: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#6b7280',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white'
                }}>
                  {participant.user?.displayName?.charAt(0)?.toUpperCase() || participant.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>
                    {participant.displayName || participant.user?.displayName || '알 수 없음'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {participant.user?.email || '알 수 없음'}
                  </div>
                </div>
              </div>
              {isHost && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onApproveParticipant(participant._id)}
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    title="승인"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => onRejectParticipant(participant._id)}
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    title="거부"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParticipantView;
