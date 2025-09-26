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
      <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#ccc' }}>
        Active Participants ({participants.length})
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#666',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'white'
            }}>
              {participant.user?.displayName?.charAt(0) || participant.displayName?.charAt(0) || 'U'}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {participant.displayName || participant.user?.displayName || 'Unknown'}
              </div>
              <div style={{ fontSize: '12px', color: '#ccc' }}>
                {participant.user?.email || 'Unknown'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: participant.micState === 'ON' ? '#28a745' : '#dc3545',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              cursor: 'pointer'
            }} title={`Mic ${participant.micState === 'ON' ? 'On' : 'Off'}`}>
              {participant.micState === 'ON' ? '🎤' : '🔇'}
            </div>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: participant.cameraState === 'ON' ? '#28a745' : '#dc3545',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              cursor: 'pointer'
            }} title={`Camera ${participant.cameraState === 'ON' ? 'On' : 'Off'}`}>
              {participant.cameraState === 'ON' ? '📹' : '📷'}
            </div>
            {participant.hasHandRaised && (
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#ffc107',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                cursor: 'pointer'
              }} title="Hand Raised">
                ✋
              </div>
            )}
            {isHost && participant.role !== 'HOST' && (
              <button
                onClick={() => onKickParticipant(participant._id)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#dc3545',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px'
                }}
                title="Kick Participant"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Waiting Room */}
      {waitingParticipants.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#ccc' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#666',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: 'white'
                }}>
                  {participant.user?.displayName?.charAt(0) || participant.displayName?.charAt(0) || 'U'}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    {participant.displayName || participant.user?.displayName || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#ccc' }}>
                    {participant.user?.email || 'Unknown'}
                  </div>
                </div>
              </div>
              {isHost && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onApproveParticipant(participant._id)}
                    style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => onRejectParticipant(participant._id)}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    × Reject
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
