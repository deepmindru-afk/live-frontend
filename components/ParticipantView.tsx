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
      <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#9ca3af' }}>
        Active Students ({participants.length})
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
                  {participant.user?.companyName || participant.displayName || participant.user?.displayName || 'Unknown'}
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
                    HOST
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
            {/* Mic Status */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: participant.micState === 'ON' ? '#22c55e' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }} title={`Mic ${participant.micState === 'ON' ? 'On' : 'Off'}`}>
              {participant.micState === 'ON' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                </svg>
              )}
            </div>
            
            {/* Camera Status */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: participant.cameraState === 'ON' ? '#22c55e' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }} title={`Camera ${participant.cameraState === 'ON' ? 'On' : 'Off'}`}>
              {participant.cameraState === 'ON' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                </svg>
              )}
            </div>

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
              }} title="Hand Raised">
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
                title="Remove Participant"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Waiting Room */}
      {waitingParticipants.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#9ca3af' }}>
            Waiting Room ({waitingParticipants.length})
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
                    {participant.displayName || participant.user?.displayName || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {participant.user?.email || 'Unknown'}
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
                    title="Approve"
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
                    title="Reject"
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
