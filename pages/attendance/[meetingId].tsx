import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { enhancedMakeGraphQLRequest } from '../../../lib/mock-graphql-service';
import { GET_MEETING_BY_ID } from '../../../apollo/meeting/queries';
import Swal from 'sweetalert2';

interface Participant {
  _id: string;
  displayName: string;
  email: string;
  joinedAt: string;
  leftAt?: string;
  isHost?: boolean;
  totalTime?: number; // in minutes
}

interface Meeting {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
  participants: Participant[];
  participantCount: number;
  duration?: number; // in seconds
  createdAt: string;
  endedAt?: string;
}

const AttendancePage: React.FC = () => {
  const router = useRouter();
  const { meetingId } = router.query;
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [showParticipantModal, setShowParticipantModal] = useState(false);

  useEffect(() => {
    if (meetingId) {
      loadMeetingData();
    }
  }, [meetingId]);

  const loadMeetingData = async () => {
    try {
      setLoading(true);
      
      // Try to get meeting details
      try {
        const result = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
          meetingId: meetingId
        });
        
        if (result.meeting) {
          setMeeting(result.meeting);
        }
      } catch (error) {
        console.warn('Failed to load meeting details:', error);
        // Fallback to mock data
        setMeeting({
          _id: meetingId as string,
          title: 'Test Meeting',
          status: 'ENDED',
          inviteCode: 'ABC123',
          participants: [
            {
              _id: 'participant-1',
              displayName: '김철수',
              email: 'kim@example.com',
              joinedAt: '2025-01-15T09:00:00Z',
              leftAt: '2025-01-15T10:30:00Z',
              isHost: true,
              totalTime: 90
            },
            {
              _id: 'participant-2',
              displayName: '이영희',
              email: 'lee@example.com',
              joinedAt: '2025-01-15T09:15:00Z',
              leftAt: '2025-01-15T10:15:00Z',
              isHost: false,
              totalTime: 60
            },
            {
              _id: 'participant-3',
              displayName: '박민수',
              email: 'park@example.com',
              joinedAt: '2025-01-15T09:30:00Z',
              leftAt: '2025-01-15T10:00:00Z',
              isHost: false,
              totalTime: 30
            },
            {
              _id: 'participant-4',
              displayName: '정수진',
              email: 'jung@example.com',
              joinedAt: '2025-01-15T09:45:00Z',
              leftAt: '2025-01-15T10:45:00Z',
              isHost: false,
              totalTime: 60
            }
          ],
          participantCount: 4,
          duration: 5400, // 90 minutes in seconds
          createdAt: '2025-01-15T09:00:00Z',
          endedAt: '2025-01-15T10:30:00Z'
        });
      }
      
    } catch (error) {
      console.error('Error loading meeting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  const calculateTotalTime = (joinedAt: string, leftAt?: string) => {
    const start = new Date(joinedAt);
    const end = leftAt ? new Date(leftAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return diffMinutes;
  };

  const filteredParticipants = meeting?.participants.filter(participant =>
    participant.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    participant.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleParticipantClick = (participant: Participant) => {
    setSelectedParticipant(participant);
    setShowParticipantModal(true);
  };

  const exportToExcel = () => {
    if (!meeting) return;

    const csvContent = [
      ['No', '참가자', '이메일', '참석 시간', '퇴장 시간', '참여 시간', '호스트 여부'],
      ...meeting.participants.map((participant, index) => [
        index + 1,
        participant.displayName,
        participant.email,
        formatTime(participant.joinedAt),
        participant.leftAt ? formatTime(participant.leftAt) : '진행 중',
        formatDuration(calculateTotalTime(participant.joinedAt, participant.leftAt)),
        participant.isHost ? '예' : '아니오'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${meeting.title}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
      icon: 'success',
      title: '엑셀 다운로드',
      text: '출석 데이터가 성공적으로 다운로드되었습니다.',
      timer: 2000,
      showConfirmButton: false
    });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        출석 데이터를 로딩 중...
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h1>미팅을 찾을 수 없습니다</h1>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          대시보드로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>출석 현황 - {meeting.title}</title>
        <meta name="description" content="미팅 출석 현황 및 참가자 정보" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8f9fa',
        padding: '20px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#333' }}>
              출석 현황
            </h1>
            <p style={{ margin: '5px 0 0 0', color: '#666' }}>
              {meeting.title}
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            ← 대시보드로 돌아가기
          </button>
        </div>

        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>참가자 수</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#007bff' }}>
              {meeting.participantCount}명
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>진행 시간</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#28a745' }}>
              {meeting.duration ? formatDuration(Math.floor(meeting.duration / 60)) : 'N/A'}
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>미팅 상태</h3>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              color: meeting.status === 'ENDED' ? '#dc3545' : '#28a745'
            }}>
              {meeting.status === 'ENDED' ? '종료됨' : meeting.status === 'STARTED' ? '진행 중' : '예약됨'}
            </div>
          </div>
        </div>

        {/* Search and Export */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          gap: '20px'
        }}>
          <div style={{ flex: 1, maxWidth: '400px' }}>
            <input
              type="text"
              placeholder="참가자 이름 또는 이메일로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
          </div>
          <button
            onClick={exportToExcel}
            style={{
              padding: '12px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📊 엑셀 다운로드
          </button>
        </div>

        {/* Attendance Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>No.</th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>참가자</th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>참석 시간</th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>퇴장 시간</th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>참여 시간</th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>비고</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((participant, index) => {
                const totalTime = calculateTotalTime(participant.joinedAt, participant.leftAt);
                return (
                  <tr 
                    key={participant._id}
                    style={{ 
                      borderBottom: '1px solid #dee2e6',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    onClick={() => handleParticipantClick(participant)}
                  >
                    <td style={{ padding: '15px' }}>{index + 1}</td>
                    <td style={{ padding: '15px' }}>
                      <div>
                        <div style={{ fontWeight: '500' }}>{participant.displayName}</div>
                        <div style={{ fontSize: '14px', color: '#666' }}>{participant.email}</div>
                        {participant.isHost && (
                          <span style={{
                            display: 'inline-block',
                            backgroundColor: '#ffc107',
                            color: '#000',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            marginTop: '4px'
                          }}>
                            호스트
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>{formatTime(participant.joinedAt)}</td>
                    <td style={{ padding: '15px' }}>
                      {participant.leftAt ? formatTime(participant.leftAt) : (
                        <span style={{ color: '#28a745', fontWeight: '500' }}>진행 중</span>
                      )}
                    </td>
                    <td style={{ padding: '15px' }}>{formatDuration(totalTime)}</td>
                    <td style={{ padding: '15px' }}>
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '18px',
                          color: '#6c757d'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleParticipantClick(participant);
                        }}
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Participant Detail Modal */}
        {showParticipantModal && selectedParticipant && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h2 style={{ margin: 0 }}>참가자 상세 정보</h2>
                <button
                  onClick={() => setShowParticipantModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#6c757d'
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>기본 정보</h3>
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>이름:</strong> {selectedParticipant.displayName}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>이메일:</strong> {selectedParticipant.email}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>역할:</strong> {selectedParticipant.isHost ? '호스트' : '참가자'}
                  </div>
                </div>

                <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>참여 정보</h3>
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>참석 시간:</strong> {formatTime(selectedParticipant.joinedAt)}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>퇴장 시간:</strong> {selectedParticipant.leftAt ? formatTime(selectedParticipant.leftAt) : '진행 중'}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>총 참여 시간:</strong> {formatDuration(calculateTotalTime(selectedParticipant.joinedAt, selectedParticipant.leftAt))}
                  </div>
                </div>

                <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>같은 미팅 참가자</h3>
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px'
                }}>
                  {meeting.participants
                    .filter(p => p._id !== selectedParticipant._id)
                    .map((participant, index) => (
                      <div key={participant._id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: index < meeting.participants.length - 2 ? '1px solid #dee2e6' : 'none'
                      }}>
                        <div>
                          <div style={{ fontWeight: '500' }}>{participant.displayName}</div>
                          <div style={{ fontSize: '14px', color: '#666' }}>{participant.email}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px' }}>
                            {formatDuration(calculateTotalTime(participant.joinedAt, participant.leftAt))}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {participant.isHost ? '호스트' : '참가자'}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button
                  onClick={() => setShowParticipantModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AttendancePage;

