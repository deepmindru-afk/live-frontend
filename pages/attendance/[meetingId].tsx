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
  showProgress?: boolean;
}> = ({ label, value, max = 100, gradient, icon, unit = '', showProgress = true }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ 
        scale: 1.02,
        y: -2,
        transition: { duration: 0.2 }
      }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#ffffff',
        borderRadius: '12px',
        padding: screenWidth <= 768 ? '16px' : '20px',
        minWidth: screenWidth <= 768 ? '100%' : '200px',
        flex: '1',
        maxWidth: screenWidth <= 768 ? '100%' : '300px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        border: '1px solid #f0f0f0',
        cursor: 'pointer'
      }}
    >
      {/* Subtle gradient accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: `linear-gradient(90deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`
      }} />
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <div style={{
            fontSize: screenWidth <= 768 ? '20px' : '24px',
            width: screenWidth <= 768 ? '36px' : '40px',
            height: screenWidth <= 768 ? '36px' : '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${gradient[0]}15 0%, ${gradient[1]}15 100%)`,
            borderRadius: '8px'
          }}>
            {icon}
          </div>
        </div>

        <div>
          <div style={{
            fontSize: screenWidth <= 768 ? '24px' : '28px',
            fontWeight: '700',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'baseline',
            gap: '4px',
            color: '#1a1a1a',
            lineHeight: '1'
          }}>
            <CountUp
              end={value}
              duration={1.5}
              separator=","
            />
            {unit && <span style={{ fontSize: screenWidth <= 768 ? '14px' : '16px', fontWeight: '500', color: '#666' }}>{unit}</span>}
          </div>
          <div style={{
            fontSize: screenWidth <= 768 ? '12px' : '13px',
            color: '#666',
            fontWeight: '500'
          }}>
            {label}
          </div>
          {showProgress && max && max !== 100 && (
            <div style={{
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px',
              color: '#999'
            }}>
              <div style={{
                flex: 1,
                height: '4px',
                background: '#f0f0f0',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{
                    height: '100%',
                    background: `linear-gradient(90deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
                    borderRadius: '2px'
                  }}
                />
              </div>
              <span style={{ fontSize: '11px' }}>/ {max}</span>
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
  duration?: number; // in minutes
  durationMin?: number; // in minutes (alternative field name)
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
      // Check if user is authenticated
      const token = localStorage.getItem('token') || localStorage.getItem('jwt');
      if (!token) {
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
          setMeeting(meeting);
        }
      } catch (error) {
      }

      // Load attendance data
      try {
        // First, let's check the current user's info
        const userStr = localStorage.getItem('user');
        const attendanceResult = await enhancedMakeGraphQLRequest(GET_MEETING_ATTENDANCE, {
          meetingId: meetingId
        });
        
        if (!attendanceResult?.getMeetingAttendance) {
          Swal.fire({ 
            icon: 'error', 
            title: '출석 데이터 없음', 
            text: '서버에서 출석 정보를 가져오지 못했습니다.' 
          });
          return;
        }
        
        setAttendance(attendanceResult.getMeetingAttendance);
      } catch (err) {
        
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
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string | Date | null | undefined) => {
    if (!timeString) return 'N/A';
    
    let date: Date;
    
    if (timeString instanceof Date) {
      date = timeString;
    } else if (typeof timeString === 'string') {
      // Handle Unix timestamp strings (milliseconds)
      if (/^\d+$/.test(timeString) && timeString.length > 10) {
        // It's a timestamp in milliseconds
        date = new Date(parseInt(timeString, 10));
      } else {
        // It's an ISO string
        date = new Date(timeString);
      }
    } else {
      return 'Invalid format';
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleString('ko-KR', {
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
    
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분`;
    } else {
      return `0분`;
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

  // ✅ Calculate actual attendance duration from joinedAt and leftAt times
  // PRIORITY: Always calculate from participant's joinedAt/leftAt first (most accurate)
  const calculateParticipantDuration = (participant: ParticipantAttendance): number => {
    // PRIORITY 1: Calculate directly from participant's joinedAt and leftAt (most reliable)
    if (participant.joinedAt) {
      try {
        const joinTime = new Date(participant.joinedAt).getTime();
        // Check if joinTime is valid
        if (!isNaN(joinTime) && joinTime > 0) {
          // Use leftAt if available, otherwise use current time (for ongoing participants)
          const leftTimeRaw = participant.leftAt || (meeting?.status === 'ENDED' || meeting?.status === 'END' ? meeting?.endedAt : null);
          const leftTime = leftTimeRaw ? new Date(leftTimeRaw).getTime() : Date.now();
          
          // Check if leftTime is valid
          if (!isNaN(leftTime) && leftTime > 0 && leftTime >= joinTime) {
            const duration = Math.floor((leftTime - joinTime) / 1000);
            // Only return if duration is positive and reasonable (not negative)
            if (duration >= 0 && duration < 86400) { // Less than 24 hours (reasonable max)
              // Debug log (can be removed in production)
              if (process.env.NODE_ENV === 'development') {
                console.log(`[Attendance Calc] ${participant.displayName}: joinedAt=${participant.joinedAt}, leftAt=${participant.leftAt || 'N/A'}, calculated=${duration}s (${Math.floor(duration/60)}min)`);
              }
              return duration;
            }
          }
        }
      } catch (error) {
        console.error(`[Attendance Calc Error] Failed to calculate duration for ${participant.displayName}:`, error);
      }
    }
    
    // PRIORITY 2: If direct calculation failed, try sessions (sum of all session durations)
    if (participant.sessions && participant.sessions.length > 0) {
      let totalDuration = 0;
      let hasValidSession = false;
      
      for (const session of participant.sessions) {
        // Try to calculate from session's joinedAt and leftAt first
        if (session.joinedAt) {
          const sessionJoinTime = new Date(session.joinedAt).getTime();
          if (!isNaN(sessionJoinTime) && sessionJoinTime > 0) {
            const sessionLeftTime = session.leftAt ? new Date(session.leftAt).getTime() : Date.now();
            if (!isNaN(sessionLeftTime) && sessionLeftTime > 0) {
              const sessionDuration = Math.floor((sessionLeftTime - sessionJoinTime) / 1000);
              if (sessionDuration > 0 && sessionDuration < 86400) {
                totalDuration += sessionDuration;
                hasValidSession = true;
                continue; // Skip to next session
              }
            }
          }
        }
        
        // Fallback to durationSec only if session times are not available
        if (session.durationSec && session.durationSec > 0 && session.durationSec < 86400) {
          totalDuration += session.durationSec;
          hasValidSession = true;
        }
      }
      
      if (hasValidSession && totalDuration > 0) {
        return totalDuration;
      }
    }
    
    // Last resort: use totalTime from backend (but only if it seems reasonable)
    // WARNING: Backend totalTime is often incorrect (may be the meeting duration instead of participant duration)
    // Only use it if we have no other option and it's not suspiciously equal to common meeting durations
    if (participant.totalTime && participant.totalTime > 0) {
      // If totalTime seems suspicious (like it's exactly the meeting duration), try to verify
      // But we'll use it anyway as a last resort since we have no other data
      console.warn(`[Attendance Calc] Using backend totalTime for ${participant.displayName}: ${participant.totalTime}s (this may be incorrect if it matches meeting duration)`);
      return participant.totalTime;
    }
    
    return 0;
  };

  // ✅ Helper: Get capped attendance time (never exceeds total meeting duration)
  const getCappedAttendanceTime = (participantTotalTime: number, totalMeetingDuration: number) => {
    if (totalMeetingDuration <= 0) return participantTotalTime;
    return Math.min(participantTotalTime, totalMeetingDuration);
  };

  const calculateAttendancePercentage = (participantTime: number, totalMeetingTime: number) => {
    if (totalMeetingTime <= 0) return 0;
    // Cap at 100% to prevent values over 100%
    const percentage = Math.round((participantTime / totalMeetingTime) * 100);
    return Math.min(percentage, 100);
  };

  const getTotalMeetingDuration = () => {
    if (!meeting) return 0;
    
    // Priority 1: Calculate from actual start and end times (most accurate)
    if (meeting.actualStartAt && meeting.endedAt) {
      const startTime = new Date(meeting.actualStartAt).getTime();
      const endTime = new Date(meeting.endedAt).getTime();
      const durationSeconds = Math.floor((endTime - startTime) / 1000);
      
      // Only use this if it makes sense (not negative or zero)
      if (durationSeconds > 0) {
        return durationSeconds;
      }
    }
    
      // Priority 2: Use scheduled duration from backend  
      if (meeting.duration || meeting.durationMin) {
        // meeting.duration is in minutes, convert to seconds
        const durationMinutes = meeting.duration || meeting.durationMin || 0;
        const durationSeconds = durationMinutes * 60;
        return durationSeconds;
    }
    
    // Priority 3: Calculate from actual start time to now (for ongoing meetings)
    if (meeting.actualStartAt) {
      const startTime = new Date(meeting.actualStartAt).getTime();
      const currentTime = Date.now();
      const durationSeconds = Math.floor((currentTime - startTime) / 1000);
      return durationSeconds;
    }
    
    // Fallback: return 0
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
      ['No', '참가자', '이메일', '소속', '부서', '역할', '참석 시간', '퇴장 시간', '참여 시간', '재접속 횟수', '출석률 (%)', '상태', '손들기'],
      ...attendance.participants.map((participant, index) => {
        // ✅ FIX: Calculate actual attendance duration from joinedAt/leftAt times
        const actualDuration = calculateParticipantDuration(participant);
        const cappedTime = getCappedAttendanceTime(actualDuration, totalMeetingDuration);
        const attendancePercentage = Math.min(calculateAttendancePercentage(cappedTime, totalMeetingDuration), 100);
        return [
          index + 1,
          participant.displayName,
          participant.email || '',
          participant.organization || '',
          participant.department || '',
          participant.systemRole || '',
          formatTime(participant.joinedAt),
          participant.leftAt ? formatTime(participant.leftAt) : 
          (meeting?.status === 'ENDED' || meeting?.status === 'END' ? '퇴장 정보 없음' : '진행 중'),
          formatDuration(cappedTime),
          participant.sessionCount,
          attendancePercentage,
          participant.status === 'ONLINE' ? '온라인' : 
          participant.status === 'PRESENT' ? '참석' : 
          participant.status === 'LEFT' ? '퇴장' : '미정',
          participant.hasHandRaised ? '예' : '아니오'
        ];
      })
    ].map(row => row.join(',')).join('\n');

    // Add UTF-8 BOM for proper Korean character encoding in Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
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
        padding: screenWidth <= 768 ? '10px' : '20px',
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
            backgroundColor: '#ffffff',
            padding: screenWidth <= 768 ? '16px' : '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            marginBottom: screenWidth <= 768 ? '16px' : '20px',
            border: '1px solid #f0f0f0'
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexDirection: screenWidth <= 768 ? 'column' : 'row',
            gap: screenWidth <= 768 ? '20px' : '0'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: screenWidth <= 768 ? '36px' : '40px',
                  height: screenWidth <= 768 ? '36px' : '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: screenWidth <= 768 ? '18px' : '20px',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.25)'
                }}>
                  📊
                </div>
                <div>
                  <h1 style={{ margin: 0, fontSize: screenWidth <= 768 ? '20px' : '24px', color: '#1a1a1a', fontWeight: '600' }}>
                    출석 현황
                  </h1>
                  <p style={{ margin: '2px 0 0 0', color: '#666', fontSize: screenWidth <= 768 ? '12px' : '13px', fontWeight: '400' }}>
                    {meeting.title}
                  </p>
                </div>
              </div>
              
              <p style={{ margin: '0 0 12px 0', fontSize: screenWidth <= 768 ? '11px' : '12px', color: '#888' }}>
                출석률은 참여 시간을 총 미팅 시간으로 나눈 비율입니다
              </p>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginTop: '10px'
              }}>
                <div
                  style={{
                    padding: '4px 10px',
                    background: '#f5f5f5',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '11px' }}>📅</span>
                  <span style={{ fontSize: screenWidth <= 768 ? '10px' : '11px', color: '#666', fontWeight: '400' }}>{formatTime(meeting.createdAt).split(' ').slice(-2).join(' ')}</span>
                </div>

                 {meeting.actualStartAt && (
                   <div
                     style={{
                       padding: '4px 10px',
                       background: '#f5f5f5',
                       borderRadius: '6px',
                       border: '1px solid #e0e0e0',
                       display: 'inline-flex',
                       alignItems: 'center',
                       gap: '4px'
                     }}
                   >
                     <span style={{ fontSize: '11px' }}>▶️</span>
                     <span style={{ fontSize: screenWidth <= 768 ? '10px' : '11px', color: '#666' }}>{formatTime(meeting.actualStartAt).split(' ').slice(-2).join(' ')}</span>
                   </div>
                 )}

                 {meeting.endedAt && (
                   <div
                     style={{
                       padding: '4px 10px',
                       background: '#f5f5f5',
                       borderRadius: '6px',
                       border: '1px solid #e0e0e0',
                       display: 'inline-flex',
                       alignItems: 'center',
                       gap: '4px'
                     }}
                   >
                     <span style={{ fontSize: '11px' }}>⏸️</span>
                     <span style={{ fontSize: screenWidth <= 768 ? '10px' : '11px', color: '#666' }}>{formatTime(meeting.endedAt).split(' ').slice(-2).join(' ')}</span>
                   </div>
                 )}

                 <div
                   style={{
                     padding: '4px 10px',
                     background: '#f5f5f5',
                     borderRadius: '6px',
                     border: '1px solid #e0e0e0',
                     display: 'inline-flex',
                     alignItems: 'center',
                     gap: '4px'
                   }}
                 >
                   <span style={{ fontSize: '11px' }}>🔑</span>
                   <span style={{ fontSize: screenWidth <= 768 ? '10px' : '11px', color: '#666', fontWeight: '500', fontFamily: 'monospace' }}>{meeting.inviteCode}</span>
                 </div>

                 <div
                   style={{
                     padding: '4px 10px',
                     borderRadius: '6px',
                     background: meeting.status === 'ENDED' ? '#fee' :
                                 meeting.status === 'LIVE' || meeting.status === 'STARTED' ? '#efe' :
                                 '#f5f5f5',
                     border: meeting.status === 'ENDED' ? '1px solid #fcc' :
                             meeting.status === 'LIVE' || meeting.status === 'STARTED' ? '1px solid #cfc' :
                             '1px solid #e0e0e0',
                     display: 'inline-flex',
                     alignItems: 'center',
                     gap: '4px'
                   }}
                 >
                   <span style={{ 
                     width: '6px',
                     height: '6px',
                     borderRadius: '50%',
                     background: meeting.status === 'ENDED' ? '#dc3545' : 
                                meeting.status === 'LIVE' || meeting.status === 'STARTED' ? '#28a745' : '#6c757d'
                   }} />
                   <span style={{
                     fontSize: screenWidth <= 768 ? '10px' : '11px',
                     fontWeight: '500',
                     color: meeting.status === 'ENDED' ? '#dc3545' : 
                            meeting.status === 'LIVE' || meeting.status === 'STARTED' ? '#28a745' : '#6c757d'
                   }}>
                     {meeting.status === 'ENDED' ? '종료' : 
                      meeting.status === 'LIVE' || meeting.status === 'STARTED' ? '진행중' : 
                      meeting.status === 'SCHEDULED' ? '예약됨' : '생성'}
                   </span>
                 </div>
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              alignItems: 'center',
              flexDirection: screenWidth <= 768 ? 'column' : 'row',
              width: screenWidth <= 768 ? '100%' : 'auto'
            }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={exportToExcel}
                style={{
                  padding: screenWidth <= 768 ? '8px 16px' : '10px 20px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: screenWidth <= 768 ? '12px' : '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '500',
                  boxShadow: '0 2px 6px rgba(102, 126, 234, 0.3)',
                  transition: 'all 0.2s ease',
                  width: screenWidth <= 768 ? '100%' : 'auto'
                }}
              >
                <span style={{ fontSize: '14px' }}>📊</span>
                Excel 다운로드
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/dashboard')}
                style={{
                  padding: screenWidth <= 768 ? '8px 16px' : '10px 20px',
                  background: '#ffffff',
                  color: '#666',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: screenWidth <= 768 ? '12px' : '13px',
                  fontWeight: '500',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease',
                  width: screenWidth <= 768 ? '100%' : 'auto'
                }}
              >
                🏠 대시보드로
              </motion.button>
          </div>
        </div>
        </motion.div>

        {/* Top 2 Stats Cards - Total Duration and Total Members */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: screenWidth <= 768 ? '1fr' : 'repeat(2, 1fr)',
            gap: screenWidth <= 768 ? '12px' : '16px',
            marginBottom: screenWidth <= 768 ? '16px' : '24px',
            maxWidth: '600px',
            margin: `0 auto ${screenWidth <= 768 ? '16px' : '24px'} auto`
          }}
        >
          <BeautifulStatsCard
            label="총 미팅 시간"
            value={Math.round(getTotalMeetingDuration() / 60)}
            max={120}
            gradient={['#667eea', '#764ba2']}
            icon="⏱️"
            unit="분"
            showProgress={false}
          />
          <BeautifulStatsCard
            label="총 참가자"
            value={attendance?.totalParticipants || 0}
            max={100}
            gradient={['#f093fb', '#f5576c']}
            icon="👥"
            unit="명"
            showProgress={true}
          />
        </div>

        {/* Search */}
        <div style={{
          marginBottom: '20px'
        }}>
          <div style={{ maxWidth: screenWidth <= 768 ? '100%' : '400px' }}>
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
                fontSize: screenWidth <= 768 ? '14px' : '16px'
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
                <th style={{ padding: screenWidth <= 768 ? '8px' : '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>No.</th>
                <th style={{ padding: screenWidth <= 768 ? '8px' : '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>참가자</th>
                <th style={{ padding: screenWidth <= 768 ? '8px' : '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>참여 시간</th>
                <th style={{ padding: screenWidth <= 768 ? '8px' : '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>퇴장 시간</th>
                <th style={{ padding: screenWidth <= 768 ? '8px' : '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>참석 시간</th>
                <th style={{ padding: screenWidth <= 768 ? '8px' : '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>출석률</th>
                <th style={{ padding: screenWidth <= 768 ? '8px' : '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>비고</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((participant, index) => {
                const totalMeetingDuration = getTotalMeetingDuration();
                // ✅ FIX: Calculate actual attendance duration from joinedAt/leftAt times
                const actualDuration = calculateParticipantDuration(participant);
                // ✅ FIX: Cap participant attendance time to not exceed total meeting duration
                const cappedAttendanceTime = getCappedAttendanceTime(actualDuration, totalMeetingDuration);
                const attendancePercentage = calculateAttendancePercentage(cappedAttendanceTime, totalMeetingDuration);
                
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
                    <td style={{ padding: screenWidth <= 768 ? '8px' : '15px', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>{index + 1}</td>
                    <td style={{ padding: screenWidth <= 768 ? '8px' : '15px', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>
                      <div>
                        <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          {participant.avatarUrl && (
                            <img 
                              src={participant.avatarUrl} 
                              alt={participant.displayName}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                            />
                          )}
                          <span style={{ fontSize: '15px' }}>{participant.displayName}</span>
                        </div>
                        {participant.systemRole && (
                          <div style={{ fontSize: '12px', color: '#666', marginLeft: participant.avatarUrl ? '40px' : '0' }}>
                            {participant.systemRole}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: screenWidth <= 768 ? '8px' : '15px', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>{formatTime(participant.joinedAt)}</td>
                    <td style={{ padding: screenWidth <= 768 ? '8px' : '15px', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>
                      {participant.leftAt ? formatTime(participant.leftAt) : (
                        <span style={{ color: '#28a745', fontWeight: '500' }}>진행 중</span>
                      )}
                    </td>
                    <td style={{ padding: screenWidth <= 768 ? '8px' : '15px', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>{formatDuration(cappedAttendanceTime)}</td>
                    <td style={{ padding: screenWidth <= 768 ? '8px' : '15px', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: screenWidth <= 768 ? '40px' : '60px',
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
                          fontSize: screenWidth <= 768 ? '12px' : '14px',
                          fontWeight: '500',
                          color: attendancePercentage >= 80 ? '#28a745' : 
                                 attendancePercentage >= 50 ? '#ffc107' : '#dc3545'
                        }}>
                          {Math.min(attendancePercentage, 100)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: screenWidth <= 768 ? '8px' : '15px', fontSize: screenWidth <= 768 ? '12px' : '14px' }}>
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
              // ✅ FIX: Calculate actual attendance duration from joinedAt/leftAt times
              const actualDuration = calculateParticipantDuration(participant);
              const cappedAttendanceTime = getCappedAttendanceTime(actualDuration, totalMeetingDuration);
              const attendancePercentage = calculateAttendancePercentage(cappedAttendanceTime, totalMeetingDuration);
              
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
                        {participant.leftAt ? formatTime(participant.leftAt).split(' ').slice(-2).join(' ') : 
                         (meeting?.status === 'ENDED' || meeting?.status === 'END' ? '정보 없음' : '진행 중')}
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
                      참여: {formatDuration(cappedAttendanceTime)}
                    </div>
                  </div>

                  {/* Hand Raise Status (if raised) */}
                  {participant.hasHandRaised && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '8px', borderTop: '1px solid #e9ecef' }}>
                      <span style={{ fontSize: '16px' }}>✋</span>
                      <span style={{ fontSize: '12px', color: '#ffc107', fontWeight: '600' }}>손들기</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Participant Detail Modal */}
        {showParticipantModal && selectedParticipant && (() => {
          // Calculate attendance values once for the modal
          const selectedActualDuration = calculateParticipantDuration(selectedParticipant);
          const selectedTotalMeetingDuration = getTotalMeetingDuration();
          const selectedCappedTime = getCappedAttendanceTime(selectedActualDuration, selectedTotalMeetingDuration);
          const selectedAttendancePercentage = Math.min(calculateAttendancePercentage(selectedCappedTime, selectedTotalMeetingDuration), 100);
          
          return (
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
                    <strong>퇴장 시간:</strong> {selectedParticipant.leftAt ? formatTime(selectedParticipant.leftAt) : 
                     (meeting?.status === 'ENDED' || meeting?.status === 'END' ? '정보 없음' : '진행 중')}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>총 참여 시간:</strong> {formatDuration(selectedCappedTime)}
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
                      backgroundColor: selectedAttendancePercentage >= 80 ? '#d4edda' : 
                                     selectedAttendancePercentage >= 50 ? '#fff3cd' : '#f8d7da',
                      color: selectedAttendancePercentage >= 80 ? '#155724' : 
                             selectedAttendancePercentage >= 50 ? '#856404' : '#721c24',
                      fontWeight: '500'
                    }}>
                      {selectedAttendancePercentage}%
                    </span>
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
                        ✋ {selectedParticipant.handRaisedAt ? formatTime(selectedParticipant.handRaisedAt) : 
                           (meeting?.status === 'ENDED' || meeting?.status === 'END' ? '정보 없음' : '진행 중')}
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
                    .map((participant, index) => {
                      const totalMeetingDuration = getTotalMeetingDuration();
                      // ✅ FIX: Calculate actual attendance duration from joinedAt/leftAt times
                      const actualDuration = calculateParticipantDuration(participant);
                      const cappedAttendanceTime = getCappedAttendanceTime(actualDuration, totalMeetingDuration);
                      const attendancePercentage = calculateAttendancePercentage(cappedAttendanceTime, totalMeetingDuration);
                      
                      return (
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
                              {formatDuration(cappedAttendanceTime)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                              {participant.leftAt ? '완료' : 
                               (meeting?.status === 'ENDED' || meeting?.status === 'END' ? '정보 없음' : '진행중')}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '500' }}>
                              {Math.min(attendancePercentage, 100)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
          );
        })()}
      </div>
    </>
  );
};

export default AttendancePage;


