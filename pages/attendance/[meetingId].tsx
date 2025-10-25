import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { GET_MEETING_BY_ID } from '../../apollo/meeting/queries';
import { GET_MEETING_ATTENDANCE } from '../../apollo/livestream/queries';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';

// Beautiful Modern Card Component
const BeautifulStatsCard: React.FC<{
  label: string;
  value: number;
  max?: number;
  gradient: string[];
  icon: string;
  unit?: string;
}> = ({ label, value, max = 100, gradient, icon, unit = '' }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, y: 50 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.6,
        type: "spring",
        stiffness: 100
      }}
      whileHover={{ 
        scale: 1.03,
        y: -10,
        transition: { duration: 0.2 }
      }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
        borderRadius: '24px',
        padding: '32px',
        minWidth: '280px',
        boxShadow: `0 10px 40px ${gradient[0]}40`,
        cursor: 'pointer'
      }}
    >
      {/* Animated background particles */}
      <motion.div
        animate={{
          rotate: [0, 360],
          scale: [1, 1.2, 1]
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${gradient[0]}20 0%, transparent 70%)`,
          pointerEvents: 'none'
        }}
      />
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <div style={{
            fontSize: '48px',
            width: '60px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)'
          }}>
            {icon}
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              background: 'rgba(255, 255, 255, 0.25)',
              padding: '6px 14px',
              borderRadius: '20px',
              backdropFilter: 'blur(10px)'
            }}
          >
            {percentage.toFixed(1)}%
          </motion.div>
        </div>

        <div style={{ color: 'white' }}>
          <div style={{
            fontSize: '36px',
            fontWeight: 'bold',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px'
          }}>
            <CountUp
              end={value}
              duration={2}
              separator=","
            />
            {unit && <span style={{ fontSize: '20px', opacity: 0.9 }}>{unit}</span>}
          </div>
          <div style={{
            fontSize: '16px',
            opacity: 0.9,
            fontWeight: '500',
            marginBottom: '12px'
          }}>
            {label}
          </div>
          {max && max !== 100 && (
            <div style={{
              fontSize: '13px',
              opacity: 0.7,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div style={{
                flex: 1,
                height: '6px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                  style={{
                    height: '100%',
                    background: 'white',
                    borderRadius: '10px'
                  }}
                />
              </div>
              <span>/ {max}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

interface ParticipantAttendance {
  _id: string;
  displayName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  systemRole?: string;
  avatarUrl?: string;
  organization?: string;
  department?: string;
  role: string;
  joinedAt: string;
  leftAt?: string;
  totalTime: number; // in seconds
  sessionCount: number;
  isCurrentlyOnline: boolean;
  status: string;
  micState: string;
  cameraState: string;
  hasHandRaised: boolean;
  handRaisedAt?: string;
  handLoweredAt?: string;
        sessions: Array<{
          joinedAt: string;
          leftAt?: string;
          durationSec: number;
        }>;
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
  const [screenWidth, setScreenWidth] = useState<number>(0);

  useEffect(() => {
    // Set initial width
    setScreenWidth(typeof window !== 'undefined' ? window.innerWidth : 0);
    
    // Handle resize
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (router.isReady && meetingId) {
      loadMeetingData();
    }
  }, [router.isReady, meetingId]);

  const loadMeetingData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching attendance for', meetingId);
      
      // Check if user is authenticated
      const token = localStorage.getItem('token') || localStorage.getItem('jwt');
      if (!token) {
        console.error('❌ No authentication token found');
        Swal.fire({ 
          icon: 'error', 
          title: '인증 필요', 
          text: '로그인이 필요합니다. 로그인 페이지로 이동합니다.' 
        }).then(() => {
          router.push('/login');
        });
        return;
      }
      
      // Load meeting details
      try {
        const meetingResult = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
          meetingId: meetingId
        });
        
        if (meetingResult.getMeetingById) {
          const meeting = meetingResult.getMeetingById;
          console.log('🏢 Meeting info:', {
            id: meeting._id,
            title: meeting.title,
            hostId: meeting.hostId,
            currentHostId: meeting.currentHostId,
            status: meeting.status
          });
          setMeeting(meeting);
        }
      } catch (error) {
        console.error('❌ Meeting query failed:', error);
      }

      // Load attendance data
      try {
        // First, let's check the current user's info
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          console.log('👤 Current user info:', {
            id: user._id,
            displayName: user.displayName,
            systemRole: user.systemRole,
            email: user.email
          });
        }

        const attendanceResult = await enhancedMakeGraphQLRequest(GET_MEETING_ATTENDANCE, {
          meetingId: meetingId
        });
        
        console.log('📊 Attendance result:', attendanceResult);
        
        if (!attendanceResult?.getMeetingAttendance) {
          console.error('⚠️ No attendance data found:', attendanceResult);
          Swal.fire({ 
            icon: 'error', 
            title: '출석 데이터 없음', 
            text: '서버에서 출석 정보를 가져오지 못했습니다.' 
          });
          return;
        }
        setAttendance(attendanceResult.getMeetingAttendance);
      } catch (err) {
        console.error('❌ Attendance query failed:', err);
        
        // Check if it's a permission error
        if (err instanceof Error && err.message && err.message.includes('Only meeting hosts and tutors can view attendance')) {
          Swal.fire({ 
            icon: 'error', 
            title: '권한 없음', 
            text: '출석 정보를 볼 권한이 없습니다. 미팅 호스트이거나 강사여야 합니다.' 
          });
        } else {
          Swal.fire({ 
            icon: 'error', 
            title: '서버 오류', 
            text: '출석 정보를 불러오지 못했습니다.' 
          });
        }
        setAttendance(null);
      }
      
    } catch (error) {
      console.error('❌ Load meeting data failed:', error);
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
    if (!meeting) return 0;
    
    // Calculate meeting duration from actual start and end times
    if (meeting.actualStartAt && meeting.endedAt) {
      const startTime = new Date(meeting.actualStartAt).getTime();
      const endTime = new Date(meeting.endedAt).getTime();
      return Math.floor((endTime - startTime) / 1000); // Convert to seconds
    } else if (meeting.actualStartAt) {
      const startTime = new Date(meeting.actualStartAt).getTime();
      const currentTime = Date.now();
      return Math.floor((currentTime - startTime) / 1000); // Convert to seconds
    } else if (meeting.duration) {
      return meeting.duration * 60; // Convert minutes to seconds
    }
    
    return 0;
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
      ['No', '참가자', '이메일', '소속', '부서', '역할', '참석 시간', '퇴장 시간', '참여 시간', '재접속 횟수', '출석률 (%)', '상태', '마이크', '카메라', '손들기'],
      ...attendance.participants.map((participant, index) => {
        const attendancePercentage = calculateAttendancePercentage(participant.totalTime, totalMeetingDuration);
        return [
          index + 1,
          participant.displayName,
          participant.email || '',
          participant.organization || '',
          participant.department || '',
          participant.systemRole || '',
          formatTime(participant.joinedAt),
          participant.leftAt ? formatTime(participant.leftAt) : '진행 중',
          formatDuration(participant.totalTime),
          participant.sessionCount,
          attendancePercentage,
          participant.status === 'ONLINE' ? '온라인' : 
          participant.status === 'PRESENT' ? '참석' : 
          participant.status === 'LEFT' ? '퇴장' : '미정',
          participant.micState === 'ON' ? '켜짐' : '꺼짐',
          participant.cameraState === 'ON' ? '켜짐' : '꺼짐',
          participant.hasHandRaised ? '예' : '아니오'
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
        padding: '20px',
        position: 'relative'
      }}>
        {/* Animated Background Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)',
          pointerEvents: 'none'
        }} />
        {/* Header - Enhanced with Glassmorphism */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            padding: '30px',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            marginBottom: '30px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)'
                }}>
                  📊
                </div>
                <div>
                  <h1 style={{ margin: 0, fontSize: '32px', color: '#667eea', fontWeight: 'bold' }}>
                    출석 현황
                  </h1>
                  <p style={{ margin: '5px 0 0 0', color: '#764ba2', fontSize: '18px', fontWeight: '500' }}>
                    {meeting.title}
                  </p>
                </div>
              </div>
              
              <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                출석률은 참여 시간을 총 미팅 시간으로 나눈 비율입니다
              </p>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '15px'
              }}>
                <motion.div
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(102, 126, 234, 0.15)' }}
                  transition={{ duration: 0.2 }}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(102, 126, 234, 0.1)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    border: '1px solid rgba(102, 126, 234, 0.3)'
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#667eea', fontWeight: '600', marginRight: '6px' }}>📅</span>
                  <span style={{ fontSize: '12px', color: '#555' }}>{formatTime(meeting.createdAt).split(' ').slice(-2).join(' ')}</span>
                </motion.div>

                {meeting.actualStartAt && (
                  <motion.div
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(240, 147, 251, 0.15)' }}
                    transition={{ duration: 0.2 }}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(240, 147, 251, 0.1)',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      border: '1px solid rgba(240, 147, 251, 0.3)'
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#f093fb', fontWeight: '600', marginRight: '6px' }}>▶️</span>
                    <span style={{ fontSize: '12px', color: '#555' }}>{formatTime(meeting.actualStartAt).split(' ').slice(-2).join(' ')}</span>
                  </motion.div>
                )}

                {meeting.endedAt && (
                  <motion.div
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(79, 172, 254, 0.15)' }}
                    transition={{ duration: 0.2 }}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(79, 172, 254, 0.1)',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      border: '1px solid rgba(79, 172, 254, 0.3)'
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#4facfe', fontWeight: '600', marginRight: '6px' }}>⏸️</span>
                    <span style={{ fontSize: '12px', color: '#555' }}>{formatTime(meeting.endedAt).split(' ').slice(-2).join(' ')}</span>
                  </motion.div>
                )}

                <motion.div
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 215, 0, 0.15)' }}
                  transition={{ duration: 0.2 }}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(255, 215, 0, 0.1)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    border: '1px solid rgba(255, 215, 0, 0.3)'
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#ff8c00', fontWeight: '600', marginRight: '6px' }}>🔑</span>
                  <span style={{ fontSize: '12px', color: '#555', fontWeight: '600' }}>{meeting.inviteCode}</span>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    background: meeting.status === 'ENDED' ? 'rgba(220, 53, 69, 0.1)' :
                                meeting.status === 'LIVE' || meeting.status === 'STARTED' ? 'rgba(40, 167, 69, 0.1)' :
                                'rgba(108, 117, 125, 0.1)',
                    border: `1px solid ${meeting.status === 'ENDED' ? 'rgba(220, 53, 69, 0.3)' : 
                                          meeting.status === 'LIVE' || meeting.status === 'STARTED' ? 'rgba(40, 167, 69, 0.3)' : 
                                          'rgba(108, 117, 125, 0.3)'}`
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '600', marginRight: '6px' }}>
                    {meeting.status === 'ENDED' ? '🔴' : 
                     meeting.status === 'LIVE' || meeting.status === 'STARTED' ? '🟢' : '⚪'}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: meeting.status === 'ENDED' ? '#dc3545' : 
                           meeting.status === 'LIVE' || meeting.status === 'STARTED' ? '#28a745' : '#6c757d'
                  }}>
                    {meeting.status === 'ENDED' ? '종료' : 
                     meeting.status === 'LIVE' || meeting.status === 'STARTED' ? '진행중' : 
                     meeting.status === 'SCHEDULED' ? '예약됨' : '생성'}
                  </span>
                </motion.div>
              </div>
            </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToExcel}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease'
              }}
            >
              <span style={{ fontSize: '20px' }}>📊</span>
              Excel 다운로드
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(245, 87, 108, 0.4)',
                transition: 'all 0.3s ease'
              }}
            >
              🏠 대시보드로
            </motion.button>
          </div>
        </div>
        </motion.div>

        {/* Top 3 Circular Animated Counters with Vibrant Colors */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '30px',
            marginBottom: '40px',
            flexWrap: 'wrap'
          }}
        >
          <BeautifulStatsCard
            label="총 미팅 시간"
            value={Math.round(getTotalMeetingDuration() / 60)}
            max={120}
            gradient={['#667eea', '#764ba2']}
            icon="⏱️"
            unit="분"
          />
          <BeautifulStatsCard
            label="총 참가자"
            value={attendance?.totalParticipants || 0}
            max={Math.max(attendance?.totalParticipants || 1, 50)}
            gradient={['#f093fb', '#f5576c']}
            icon="👥"
            unit="명"
          />
          <BeautifulStatsCard
            label="평균 참여 시간"
            value={attendance?.averageAttendanceTime ? Math.round(attendance.averageAttendanceTime / 60) : 0}
            max={Math.round(getTotalMeetingDuration() / 60)}
            gradient={['#4facfe', '#00f2fe']}
            icon="🎯"
            unit="분"
          />
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

        {/* Attendance Table with Glassmorphism - Responsive */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            overflow: 'hidden'
          }}
        >
          {/* Desktop Table */}
          <div style={{ display: screenWidth <= 768 && screenWidth > 0 ? 'none' : 'block' }}>
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
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>상태</th>
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
                        <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {participant.avatarUrl && (
                            <img 
                              src={participant.avatarUrl} 
                              alt={participant.displayName}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                            />
                          )}
                          <div>
                            <div>{participant.displayName}</div>
                            {participant.email && (
                              <div style={{ fontSize: '12px', color: '#666' }}>{participant.email}</div>
                            )}
                            {participant.organization && (
                              <div style={{ fontSize: '11px', color: '#888' }}>{participant.organization}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-block',
                            backgroundColor: participant.status === 'ONLINE' ? '#28a745' : 
                                           participant.status === 'PRESENT' ? '#17a2b8' : 
                                           participant.status === 'LEFT' ? '#6c757d' : '#dc3545',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}>
                            {participant.status === 'ONLINE' ? '온라인' : 
                             participant.status === 'PRESENT' ? '참석' : 
                             participant.status === 'LEFT' ? '퇴장' : '미정'}
                          </span>
                          {participant.systemRole && (
                            <span style={{
                              display: 'inline-block',
                              backgroundColor: '#e9ecef',
                              color: '#495057',
                              padding: '2px 6px',
                              borderRadius: '8px',
                              fontSize: '10px'
                            }}>
                              {participant.systemRole}
                            </span>
                          )}
                          {participant.hasHandRaised && (
                            <span style={{
                              display: 'inline-block',
                              backgroundColor: '#ffc107',
                              color: '#212529',
                              padding: '2px 6px',
                              borderRadius: '8px',
                              fontSize: '10px'
                            }}>
                              ✋ 손들기
                            </span>
                          )}
                        </div>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: participant.micState === 'ON' ? '#28a745' : '#dc3545'
                          }} title={`마이크: ${participant.micState === 'ON' ? '켜짐' : '꺼짐'}`}></span>
                          <span style={{ fontSize: '12px' }}>마이크</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: participant.cameraState === 'ON' ? '#28a745' : '#dc3545'
                          }} title={`카메라: ${participant.cameraState === 'ON' ? '켜짐' : '꺼짐'}`}></span>
                          <span style={{ fontSize: '12px' }}>카메라</span>
                        </div>
                        {participant.sessionCount > 1 && (
                          <div style={{ fontSize: '11px', color: '#666' }}>
                            {participant.sessionCount}회 재접속
                          </div>
                        )}
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

          {/* Mobile Card View */}
          <div style={{ display: screenWidth <= 768 && screenWidth > 0 ? 'block' : 'none' }}>
            {filteredParticipants.map((participant, index) => {
              const totalMeetingDuration = getTotalMeetingDuration();
              const attendancePercentage = calculateAttendancePercentage(participant.totalTime, totalMeetingDuration);
              
              return (
                <div
                  key={participant._id}
                  onClick={() => handleParticipantClick(participant)}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '12px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    border: '1px solid #e9ecef',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
                  }}
                >
                  {/* Header with avatar and name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    {participant.avatarUrl ? (
                      <img 
                        src={participant.avatarUrl} 
                        alt={participant.displayName}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #e9ecef'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '20px',
                        fontWeight: 'bold'
                      }}>
                        {participant.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '16px', color: '#333', marginBottom: '4px' }}>
                        {participant.displayName}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: participant.status === 'ONLINE' ? 'rgba(40, 167, 69, 0.1)' : 
                                         participant.status === 'PRESENT' ? 'rgba(23, 162, 184, 0.1)' : 
                                         participant.status === 'LEFT' ? 'rgba(108, 117, 125, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                          color: participant.status === 'ONLINE' ? '#28a745' : 
                                 participant.status === 'PRESENT' ? '#17a2b8' : 
                                 participant.status === 'LEFT' ? '#6c757d' : '#dc3545'
                        }}>
                          {participant.status === 'ONLINE' ? '🟢 온라인' : 
                           participant.status === 'PRESENT' ? '🔵 참석' : 
                           participant.status === 'LEFT' ? '⚪ 퇴장' : '🔴 미정'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info Cards Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    {/* 참석 시간 */}
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      padding: '10px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>⏰ 참석</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>
                        {formatTime(participant.joinedAt).split(' ').slice(-2).join(' ')}
                      </div>
                    </div>

                    {/* 퇴장 시간 */}
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      padding: '10px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>🚪 퇴장</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>
                        {participant.leftAt ? formatTime(participant.leftAt).split(' ').slice(-2).join(' ') : '진행 중'}
                      </div>
                    </div>
                  </div>

                  {/* Attendance Rate with Progress Bar */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>📊 출석률</span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '700',
                        color: attendancePercentage >= 80 ? '#28a745' : 
                               attendancePercentage >= 50 ? '#ffc107' : '#dc3545'
                      }}>
                        {attendancePercentage}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '10px',
                      backgroundColor: '#e9ecef',
                      borderRadius: '10px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${Math.min(attendancePercentage, 100)}%`,
                        height: '100%',
                        background: attendancePercentage >= 80 ? 'linear-gradient(90deg, #28a745 0%, #20c997 100%)' :
                                   attendancePercentage >= 50 ? 'linear-gradient(90deg, #ffc107 0%, #ffb300 100%)' :
                                   'linear-gradient(90deg, #dc3545 0%, #c82333 100%)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      참여: {formatDuration(participant.totalTime)}
                    </div>
                  </div>

                  {/* Mic/Camera Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: '8px', borderTop: '1px solid #e9ecef' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px' }}>{participant.micState === 'ON' ? '🎤' : '🔇'}</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>마이크</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px' }}>{participant.cameraState === 'ON' ? '📹' : '📷'}</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>카메라</span>
                    </div>
                    {participant.hasHandRaised && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px' }}>✋</span>
                        <span style={{ fontSize: '12px', color: '#ffc107', fontWeight: '600' }}>손들기</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

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
                  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {selectedParticipant.avatarUrl && (
                      <img 
                        src={selectedParticipant.avatarUrl} 
                        alt={selectedParticipant.displayName}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{selectedParticipant.displayName}</div>
                      {selectedParticipant.email && (
                        <div style={{ fontSize: '14px', color: '#666' }}>{selectedParticipant.email}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>상태:</strong> 
                    <span style={{
                      display: 'inline-block',
                      backgroundColor: selectedParticipant.status === 'ONLINE' ? '#28a745' : 
                                     selectedParticipant.status === 'PRESENT' ? '#17a2b8' : 
                                     selectedParticipant.status === 'LEFT' ? '#6c757d' : '#dc3545',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      marginLeft: '8px'
                    }}>
                      {selectedParticipant.status === 'ONLINE' ? '온라인' : 
                       selectedParticipant.status === 'PRESENT' ? '참석' : 
                       selectedParticipant.status === 'LEFT' ? '퇴장' : '미정'}
                    </span>
                  </div>
                  {selectedParticipant.systemRole && (
                    <div style={{ marginBottom: '10px' }}>
                      <strong>역할:</strong> {selectedParticipant.systemRole}
                    </div>
                  )}
                  {selectedParticipant.organization && (
                    <div style={{ marginBottom: '10px' }}>
                      <strong>소속:</strong> {selectedParticipant.organization}
                    </div>
                  )}
                  {selectedParticipant.department && (
                    <div style={{ marginBottom: '10px' }}>
                      <strong>부서:</strong> {selectedParticipant.department}
                    </div>
                  )}
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
                    <strong>재접속 횟수:</strong> {selectedParticipant.sessionCount}회
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
                  <div style={{ marginBottom: '10px' }}>
                    <strong>미디어 상태:</strong>
                    <div style={{ marginTop: '5px', display: 'flex', gap: '10px' }}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        backgroundColor: selectedParticipant.micState === 'ON' ? '#d4edda' : '#f8d7da',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: selectedParticipant.micState === 'ON' ? '#28a745' : '#dc3545'
                        }}></span>
                        마이크 {selectedParticipant.micState === 'ON' ? '켜짐' : '꺼짐'}
                      </span>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        backgroundColor: selectedParticipant.cameraState === 'ON' ? '#d4edda' : '#f8d7da',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: selectedParticipant.cameraState === 'ON' ? '#28a745' : '#dc3545'
                        }}></span>
                        카메라 {selectedParticipant.cameraState === 'ON' ? '켜짐' : '꺼짐'}
                      </span>
                    </div>
                  </div>
                  {selectedParticipant.hasHandRaised && (
                    <div style={{ marginBottom: '10px' }}>
                      <strong>손들기:</strong> 
                      <span style={{
                        marginLeft: '8px',
                        padding: '4px 8px',
                        backgroundColor: '#fff3cd',
                        color: '#856404',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        ✋ {selectedParticipant.handRaisedAt ? formatTime(selectedParticipant.handRaisedAt) : '진행 중'}
                      </span>
                    </div>
                  )}
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
                            backgroundColor: participant.status === 'ONLINE' ? '#28a745' : 
                                           participant.status === 'PRESENT' ? '#17a2b8' : 
                                           participant.status === 'LEFT' ? '#6c757d' : '#dc3545',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontSize: '10px',
                            marginTop: '2px'
                          }}>
                            {participant.status === 'ONLINE' ? '온라인' : 
                             participant.status === 'PRESENT' ? '참석' : 
                             participant.status === 'LEFT' ? '퇴장' : '미정'}
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


