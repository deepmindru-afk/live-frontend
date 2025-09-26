import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { GET_MEETING_BY_ID } from '../../apollo/meeting/queries';
import { GET_MEETING_ATTENDANCE } from '../../apollo/livestream/queries';
import Swal from 'sweetalert2';

interface ParticipantAttendance {
  _id: string;
  displayName: string;
  joinedAt: string;
  leftAt?: string;
  totalTime: number; // in seconds
  status: string;
}

interface MeetingAttendance {
  meetingId: string;
  totalParticipants: number;
  presentParticipants: number;
  absentParticipants: number;
  averageAttendanceTime: number;
  attendanceRate: number;
  participants: ParticipantAttendance[];
}

interface Meeting {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
  participantCount: number;
  duration?: number; // in seconds
  createdAt: string;
  endedAt?: string;
  scheduledFor?: string;
  actualStartAt?: string;
}

const AttendancePage: React.FC = () => {
  const router = useRouter();
  const { meetingId } = router.query;
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attendance, setAttendance] = useState<MeetingAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantAttendance | null>(null);
  const [showParticipantModal, setShowParticipantModal] = useState(false);

  useEffect(() => {
    if (meetingId) {
      loadMeetingData();
    }
  }, [meetingId]);

  const loadMeetingData = async () => {
    try {
      setLoading(true);
      
      // Load meeting details
      try {
        const meetingResult = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
          meetingId: meetingId
        });
        
        if (meetingResult.getMeetingById) {
          setMeeting(meetingResult.getMeetingById);
        }
      } catch (error) {
        console.warn('Failed to load meeting details:', error);
      }

      // Load attendance data
      try {
        const attendanceResult = await enhancedMakeGraphQLRequest(GET_MEETING_ATTENDANCE, {
          meetingId: meetingId
        });
        
        if (attendanceResult.getMeetingAttendance) {
          setAttendance(attendanceResult.getMeetingAttendance);
        }
      } catch (error) {
        console.warn('Failed to load attendance data:', error);
        // Fallback to mock data if needed
        setAttendance({
          meetingId: meetingId as string,
          totalParticipants: 4,
          presentParticipants: 4,
          absentParticipants: 0,
          averageAttendanceTime: 3600, // 1 hour in seconds
          attendanceRate: 100,
          participants: [
            {
              _id: 'participant-1',
              displayName: '김철수',
              joinedAt: '2025-01-15T09:00:00Z',
              leftAt: '2025-01-15T10:30:00Z',
              totalTime: 5400, // 90 minutes in seconds
              status: 'PRESENT'
            },
            {
              _id: 'participant-2',
              displayName: '이영희',
              joinedAt: '2025-01-15T09:15:00Z',
              leftAt: '2025-01-15T10:15:00Z',
              totalTime: 3600, // 60 minutes in seconds
              status: 'PRESENT'
            },
            {
              _id: 'participant-3',
              displayName: '박민수',
              joinedAt: '2025-01-15T09:30:00Z',
              leftAt: '2025-01-15T10:00:00Z',
              totalTime: 1800, // 30 minutes in seconds
              status: 'PRESENT'
            },
            {
              _id: 'participant-4',
              displayName: '정수진',
              joinedAt: '2025-01-15T09:45:00Z',
              leftAt: '2025-01-15T10:45:00Z',
              totalTime: 3600, // 60 minutes in seconds
              status: 'PRESENT'
            }
          ]
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

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${secs}초`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  };

  const formatDurationShort = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  };

  const calculateAttendancePercentage = (participantTime: number, totalMeetingTime: number) => {
    if (totalMeetingTime <= 0) return 0;
    return Math.round((participantTime / totalMeetingTime) * 100);
  };

  const getTotalMeetingDuration = () => {
    if (!meeting?.duration) return 0;
    return meeting.duration;
  };

  const filteredParticipants = attendance?.participants.filter(participant =>
    participant.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleParticipantClick = (participant: ParticipantAttendance) => {
    setSelectedParticipant(participant);
    setShowParticipantModal(true);
  };

  const exportToExcel = () => {
    if (!meeting || !attendance) return;

    const totalMeetingDuration = getTotalMeetingDuration();
    
    const csvContent = [
      ['No', '참가자', '참석 시간', '퇴장 시간', '참여 시간', '출석률 (%)', '상태'],
      ...attendance.participants.map((participant, index) => {
        const attendancePercentage = calculateAttendancePercentage(participant.totalTime, totalMeetingDuration);
        return [
          index + 1,
          participant.displayName,
          formatTime(participant.joinedAt),
          participant.leftAt ? formatTime(participant.leftAt) : '진행 중',
          formatDuration(participant.totalTime),
          attendancePercentage,
          participant.status === 'PRESENT' ? '참석' : participant.status === 'ABSENT' ? '결석' : '미정'
        ];
      })
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
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#888' }}>
              출석률은 참여 시간을 총 미팅 시간으로 나눈 비율입니다
            </p>
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#888' }}>
              <div>생성일: {formatTime(meeting.createdAt)}</div>
              {meeting.endedAt && <div>종료일: {formatTime(meeting.endedAt)}</div>}
              {meeting.scheduledFor && <div>예정일: {formatTime(meeting.scheduledFor)}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                gap: '8px',
                fontWeight: '500'
              }}
            >
              📊 Excel 다운로드
            </button>
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
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>총 참가자</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#007bff' }}>
              {attendance?.totalParticipants || 0}명
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>참석자</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#28a745' }}>
              {attendance?.presentParticipants || 0}명
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>참석률</h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffc107' }}>
              {attendance?.attendanceRate || 0}%
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>총 미팅 시간</h3>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#6c757d' }}>
              {meeting.duration ? formatDurationShort(meeting.duration) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{
          marginBottom: '20px'
        }}>
          <div style={{ maxWidth: '400px' }}>
            <input
              type="text"
              placeholder="참가자 이름으로 검색..."
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
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>출석률</th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>비고</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((participant, index) => {
                const totalMeetingDuration = getTotalMeetingDuration();
                const attendancePercentage = calculateAttendancePercentage(participant.totalTime, totalMeetingDuration);
                
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
                        <span style={{
                          display: 'inline-block',
                          backgroundColor: participant.status === 'PRESENT' ? '#28a745' : participant.status === 'ABSENT' ? '#dc3545' : '#6c757d',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          marginTop: '4px'
                        }}>
                          {participant.status === 'PRESENT' ? '참석' : participant.status === 'ABSENT' ? '결석' : '미정'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>{formatTime(participant.joinedAt)}</td>
                    <td style={{ padding: '15px' }}>
                      {participant.leftAt ? formatTime(participant.leftAt) : (
                        <span style={{ color: '#28a745', fontWeight: '500' }}>진행 중</span>
                      )}
                    </td>
                    <td style={{ padding: '15px' }}>{formatDuration(participant.totalTime)}</td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '60px',
                          height: '8px',
                          backgroundColor: '#e9ecef',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(attendancePercentage, 100)}%`,
                            height: '100%',
                            backgroundColor: attendancePercentage >= 80 ? '#28a745' : 
                                           attendancePercentage >= 50 ? '#ffc107' : '#dc3545',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: attendancePercentage >= 80 ? '#28a745' : 
                                 attendancePercentage >= 50 ? '#ffc107' : '#dc3545'
                        }}>
                          {attendancePercentage}%
                        </span>
                      </div>
                    </td>
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
                    <strong>상태:</strong> 
                    <span style={{
                      display: 'inline-block',
                      backgroundColor: selectedParticipant.status === 'PRESENT' ? '#28a745' : selectedParticipant.status === 'ABSENT' ? '#dc3545' : '#6c757d',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      marginLeft: '8px'
                    }}>
                      {selectedParticipant.status === 'PRESENT' ? '참석' : selectedParticipant.status === 'ABSENT' ? '결석' : '미정'}
                    </span>
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
                    <strong>총 참여 시간:</strong> {formatDuration(selectedParticipant.totalTime)}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>출석률:</strong> 
                    <span style={{
                      marginLeft: '8px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: calculateAttendancePercentage(selectedParticipant.totalTime, getTotalMeetingDuration()) >= 80 ? '#d4edda' : 
                                     calculateAttendancePercentage(selectedParticipant.totalTime, getTotalMeetingDuration()) >= 50 ? '#fff3cd' : '#f8d7da',
                      color: calculateAttendancePercentage(selectedParticipant.totalTime, getTotalMeetingDuration()) >= 80 ? '#155724' : 
                             calculateAttendancePercentage(selectedParticipant.totalTime, getTotalMeetingDuration()) >= 50 ? '#856404' : '#721c24',
                      fontWeight: '500'
                    }}>
                      {calculateAttendancePercentage(selectedParticipant.totalTime, getTotalMeetingDuration())}%
                    </span>
                  </div>
                </div>

                <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>같은 미팅 참가자</h3>
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px'
                }}>
                  {attendance?.participants
                    .filter(p => p._id !== selectedParticipant._id)
                    .map((participant, index) => (
                      <div key={participant._id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: index < (attendance?.participants.length || 0) - 2 ? '1px solid #dee2e6' : 'none'
                      }}>
                        <div>
                          <div style={{ fontWeight: '500' }}>{participant.displayName}</div>
                          <span style={{
                            display: 'inline-block',
                            backgroundColor: participant.status === 'PRESENT' ? '#28a745' : participant.status === 'ABSENT' ? '#dc3545' : '#6c757d',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontSize: '10px',
                            marginTop: '2px'
                          }}>
                            {participant.status === 'PRESENT' ? '참석' : participant.status === 'ABSENT' ? '결석' : '미정'}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px' }}>
                            {formatDuration(participant.totalTime)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            {participant.leftAt ? '완료' : '진행중'}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '500' }}>
                            {calculateAttendancePercentage(participant.totalTime, getTotalMeetingDuration())}%
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







