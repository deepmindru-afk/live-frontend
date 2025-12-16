import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { GET_MEETING_BY_ID } from '../../apollo/meeting/queries';
import { GET_MEETING_ATTENDANCE } from '../../apollo/livestream/queries';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';
import styles from '../../styles/attendance.module.css';

interface ParticipantAttendance {
  _id: string;
  userId?: string;
  displayName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  systemRole?: string;
  avatarUrl?: string;
  organization?: string;
  department?: string;
  ipAddress?: string;
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

type AggregatedParticipantAttendance = ParticipantAttendance & {
  aggregatedDurationSec: number;
  aggregatedRecords: ParticipantAttendance[];
};

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
  // CRITICAL: Always calculate from participant's joinedAt/leftAt ONLY - never use sessions or totalTime
  const calculateParticipantDuration = (participant: ParticipantAttendance): number => {
    const aggregatedDuration = (participant as Partial<AggregatedParticipantAttendance>).aggregatedDurationSec;
    if (typeof aggregatedDuration === 'number' && aggregatedDuration >= 0) {
      return aggregatedDuration;
    }
    // ENFORCE: We ONLY use participant.joinedAt and participant.leftAt - nothing else!
    // Sessions and totalTime are often incorrect, so we completely ignore them
    
    if (!participant.joinedAt) {
      return 0;
    }
    
    try {
      // Parse joinedAt - handle both ISO strings and numeric timestamps (string or number)
      let joinTime: number;
      
      if (typeof participant.joinedAt === 'number') {
        // Already a timestamp in milliseconds
        joinTime = participant.joinedAt;
      } else if (typeof participant.joinedAt === 'string') {
        // Check if it's a numeric string (timestamp)
        if (/^\d+$/.test(participant.joinedAt)) {
          // It's a numeric string timestamp
          joinTime = parseInt(participant.joinedAt, 10);
        } else {
          // It's an ISO date string
          joinTime = new Date(participant.joinedAt).getTime();
        }
      } else {
        // Try to parse as date
        joinTime = new Date(participant.joinedAt).getTime();
      }
      
      // Validate joinTime
      if (isNaN(joinTime) || joinTime <= 0) {
        return 0;
      }
      
      // Determine leftTime - MUST have a valid leftAt or meeting.endedAt
      let leftTime: number | null = null;
      
      // Helper function to parse date/timestamp
      const parseDateTime = (value: string | number | Date | null | undefined): number | null => {
        if (!value) return null;
        
        if (typeof value === 'number') {
          return value; // Already a timestamp
        }
        
        if (typeof value === 'string') {
          // Check if it's a numeric string (timestamp)
          if (/^\d+$/.test(value)) {
            return parseInt(value, 10); // Parse as timestamp
          }
          // Otherwise parse as ISO date string
          const parsed = new Date(value).getTime();
          return !isNaN(parsed) && parsed > 0 ? parsed : null;
        }
        
        // If it's a Date object
        if (value instanceof Date) {
          return value.getTime();
        }
        
        // Try generic Date parsing
        const parsed = new Date(value as any).getTime();
        return !isNaN(parsed) && parsed > 0 ? parsed : null;
      };
      
      // PRIORITY 1: Use participant.leftAt (MOST ACCURATE - always use this if available)
      if (participant.leftAt) {
        const parsedLeftTime = parseDateTime(participant.leftAt);
        if (parsedLeftTime !== null) {
          leftTime = parsedLeftTime;
        }
      }
      
      // PRIORITY 2: If no leftAt and meeting has ended, use meeting.endedAt
      if (!leftTime && meeting && (meeting.status === 'ENDED' || meeting.status === 'END') && meeting.endedAt) {
        const parsedEndTime = parseDateTime(meeting.endedAt);
        if (parsedEndTime !== null) {
          leftTime = parsedEndTime;
        }
      }
      
      // PRIORITY 3: Only use current time if meeting is still ongoing (LIVE/STARTED)
      // NEVER use Date.now() for ended meetings
      if (!leftTime && meeting && meeting.status !== 'ENDED' && meeting.status !== 'END') {
        leftTime = Date.now();
      }
      
      // If we don't have a valid leftTime, return 0
      if (leftTime === null || leftTime <= 0) {
        return 0;
      }
      
      // Validate leftTime is after joinTime
      if (leftTime < joinTime) {
        return 0;
      }
      
      // Calculate duration in seconds
      const duration = Math.floor((leftTime - joinTime) / 1000);
      
      // Validate duration is reasonable (0 to 24 hours)
      if (duration < 0 || duration >= 86400) {
        return 0;
      }
      
      return duration;
      
    } catch (error) {
      // Silently return 0 on error
      return 0;
    }
    
    // NOTE: We completely ignore sessions and totalTime as they are often incorrect
    // The calculation above from joinedAt/leftAt is the ONLY reliable source
    // If we reach here, it means we couldn't calculate (missing data)
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

  const aggregatedParticipants = useMemo(() => {
    if (!attendance?.participants || attendance.participants.length === 0) {
      return [] as AggregatedParticipantAttendance[];
    }

    const parseDateTime = (
      value: ParticipantAttendance['joinedAt'] | ParticipantAttendance['leftAt'] | Date | number | string | null | undefined
    ) => {
      if (value === null || value === undefined) return null;
      const rawValue = value as unknown;
      if (typeof rawValue === 'number') return rawValue;
      if (typeof rawValue === 'string') {
        if (/^\d+$/.test(rawValue)) {
          const parsed = parseInt(rawValue, 10);
          return Number.isFinite(parsed) ? parsed : null;
        }
        const parsed = new Date(rawValue).getTime();
        return Number.isFinite(parsed) ? parsed : null;
      }
      if (rawValue instanceof Date) {
        return rawValue.getTime();
      }
      const parsed = new Date(rawValue as any).getTime();
      return Number.isFinite(parsed) ? parsed : null;
    };

    const getAggregationKey = (participant: ParticipantAttendance) => {
      // Priority 1: Use userId (most reliable for registered users)
      if (participant.userId && String(participant.userId).trim()) {
        return `user:${String(participant.userId)}`;
      }
      
      // Priority 2: Use email (reliable for registered users)
      if (participant.email && participant.email.trim()) {
        return `email:${participant.email.toLowerCase().trim()}`;
      }
      
      // Priority 3: Use firstName + lastName combination
      if (participant.firstName || participant.lastName) {
        const firstName = (participant.firstName || '').toLowerCase().trim();
        const lastName = (participant.lastName || '').toLowerCase().trim();
        if (firstName || lastName) {
          return `name:${firstName}|${lastName}`;
        }
      }
      
      // Priority 4: Use displayName (may not be unique)
      if (participant.displayName && participant.displayName.trim()) {
        return `display:${participant.displayName.toLowerCase().trim()}`;
      }
      
      // Priority 5: Fall back to _id (guaranteed unique, prevents incorrect merging)
      return `id:${participant._id}`;
    };

    const aggregator = new Map<string, AggregatedParticipantAttendance>();

    attendance.participants.forEach((participant, index) => {
      try {
        // Validate participant has minimum required data
        if (!participant || !participant._id) {
          console.warn(`[Attendance] Skipping invalid participant at index ${index}: missing _id`);
          return;
        }

        const key = getAggregationKey(participant);
        const sessionDuration = calculateParticipantDuration(participant);
        const participantSessions = participant.sessions ? [...participant.sessions] : [];

        if (!aggregator.has(key)) {
          const initialEntry: AggregatedParticipantAttendance = {
            ...participant,
            aggregatedDurationSec: Math.max(sessionDuration, 0),
            aggregatedRecords: [participant],
            totalTime: Math.max(sessionDuration, 0),
            sessionCount: 1,
            sessions: participantSessions,
          };
          aggregator.set(key, initialEntry);
          return;
        }

        const existing = aggregator.get(key)!;
        existing.aggregatedDurationSec = Math.max(existing.aggregatedDurationSec + Math.max(sessionDuration, 0), 0);
        existing.totalTime = Math.max((existing.totalTime || 0) + Math.max(sessionDuration, 0), 0);
        existing.aggregatedRecords = [...existing.aggregatedRecords, participant];
        existing.sessions = participantSessions.length
          ? [...(existing.sessions || []), ...participantSessions]
          : existing.sessions;
      } catch (error) {
        console.error(`[Attendance] Error processing participant at index ${index}:`, error);
        console.error('[Attendance] Participant data:', participant);
        // Continue processing other participants instead of failing completely
      }
    });

    const statusPriority: Record<string, number> = {
      ONLINE: 3,
      PRESENT: 2,
      LEFT: 1,
    };
    const meetingEndedTimestamp = parseDateTime(meeting?.endedAt);

    return Array.from(aggregator.values()).map((aggregatedParticipant) => {
      const earliestJoin = aggregatedParticipant.aggregatedRecords.reduce<{
        timestamp: number;
        original: ParticipantAttendance['joinedAt'];
      } | null>((acc, record) => {
        const joinTs = parseDateTime(record.joinedAt);
        if (joinTs === null) return acc;
        if (!acc || joinTs < acc.timestamp) {
          return { timestamp: joinTs, original: record.joinedAt };
        }
        return acc;
      }, null);

      const latestLeft = aggregatedParticipant.aggregatedRecords.reduce<{
        timestamp: number;
        original: ParticipantAttendance['leftAt'];
      } | null>((acc, record) => {
        const leftTs = parseDateTime(record.leftAt);
        if (leftTs === null) return acc;
        if (!acc || leftTs > acc.timestamp) {
          return { timestamp: leftTs, original: record.leftAt };
        }
        return acc;
      }, null);

      const anyOnline = aggregatedParticipant.aggregatedRecords.some(record => record.isCurrentlyOnline);
      const resolvedStatus = aggregatedParticipant.aggregatedRecords.reduce<string | undefined>((current, record) => {
        if (!record.status) return current;
        if (!current) return record.status;
        const currentPriority = statusPriority[current] ?? 0;
        const recordPriority = statusPriority[record.status] ?? 0;
        return recordPriority >= currentPriority ? record.status : current;
      }, aggregatedParticipant.status);

      const resolvedAvatar = aggregatedParticipant.aggregatedRecords.find(record => record.avatarUrl)?.avatarUrl ?? aggregatedParticipant.avatarUrl;
      const resolvedOrganization = aggregatedParticipant.aggregatedRecords.find(record => record.organization)?.organization ?? aggregatedParticipant.organization;
      const resolvedDepartment = aggregatedParticipant.aggregatedRecords.find(record => record.department)?.department ?? aggregatedParticipant.department;
      const resolvedMicState = aggregatedParticipant.aggregatedRecords.find(record => record.micState)?.micState ?? aggregatedParticipant.micState;
      const resolvedCameraState = aggregatedParticipant.aggregatedRecords.find(record => record.cameraState)?.cameraState ?? aggregatedParticipant.cameraState;
      const handRaised = aggregatedParticipant.aggregatedRecords.some(record => record.hasHandRaised);
      const finalStatus = anyOnline ? 'ONLINE' : (resolvedStatus ?? aggregatedParticipant.status ?? 'LEFT');
      const resolvedLeftAt =
        anyOnline
          ? undefined
          : latestLeft?.original ??
            aggregatedParticipant.leftAt ??
            (meetingEndedTimestamp !== null ? meeting?.endedAt : undefined);

      return {
        ...aggregatedParticipant,
        joinedAt: earliestJoin?.original ?? aggregatedParticipant.joinedAt,
        leftAt: resolvedLeftAt,
        isCurrentlyOnline: anyOnline,
        status: finalStatus,
        sessionCount: aggregatedParticipant.aggregatedRecords.length,
        avatarUrl: resolvedAvatar,
        organization: resolvedOrganization,
        department: resolvedDepartment,
        micState: resolvedMicState,
        cameraState: resolvedCameraState,
        hasHandRaised: handRaised,
      } as AggregatedParticipantAttendance;
    });
  }, [attendance, meeting]);

  const filteredParticipants = aggregatedParticipants.filter(participant =>
    participant.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMeetingDurationSeconds = getTotalMeetingDuration();
  const totalMeetingMinutes = totalMeetingDurationSeconds > 0 ? Math.round(totalMeetingDurationSeconds / 60) : 0;
  const rawAttendanceRate = Math.round(attendance?.attendanceRate ?? 0);
  const attendanceRate = Math.min(Math.max(rawAttendanceRate, 0), 100);
  const presentCount = attendance?.presentParticipants ?? 0;
  const absentCount = attendance?.absentParticipants ?? 0;
  const totalParticipants = attendance?.totalParticipants ?? aggregatedParticipants.length ?? 0;
  const scheduleStart = meeting?.actualStartAt || meeting?.scheduledFor || meeting?.createdAt;
  const scheduleEnd = meeting?.endedAt;
  const averageAttendanceLabel = formatDurationShort(attendance?.averageAttendanceTime ?? 0);

  const statusMeta = (() => {
    if (!meeting?.status) {
      return { label: '정보 없음', tone: styles.statusDefault };
    }

    switch (meeting.status) {
      case 'LIVE':
      case 'STARTED':
        return { label: '진행 중', tone: styles.statusLive };
      case 'ENDED':
      case 'END':
        return { label: '종료', tone: styles.statusEnded };
      case 'SCHEDULED':
        return { label: '예약됨', tone: styles.statusScheduled };
      default:
        return { label: meeting.status, tone: styles.statusDefault };
    }
  })();

  const statusClassName = statusMeta.tone;
  const statusLabel = statusMeta.label;

  const safeFormatTime = (value: string | Date | null | undefined) => {
    const formatted = formatTime(value);
    return formatted === 'N/A' ? '정보 없음' : formatted;
  };

  const getAttendanceLevelClass = (value: number) => {
    if (value >= 80) {
      return styles.levelHigh;
    }
    if (value >= 50) {
      return styles.levelMedium;
    }
    return styles.levelLow;
  };

  const handleParticipantClick = (participant: ParticipantAttendance) => {
    setSelectedParticipant(participant);
    setShowParticipantModal(true);
  };

  const exportToExcel = () => {
    if (!meeting || !attendance) return;

    const totalMeetingDuration = getTotalMeetingDuration();
    
    const csvContent = [
      ['No', '참가자', '이메일', '소속', '부서', '역할', 'IP 주소', '참석 시간', '퇴장 시간', '참여 시간', '재접속 횟수', '출석률 (%)', '상태', '손들기'],
      ...aggregatedParticipants.map((participant, index) => {
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
          participant.ipAddress || '정보 없음',
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

      <div className={styles.page}>
        <div className={styles.backgroundGlow} />
        <div className={styles.layout}>
          <motion.aside
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className={styles.sidebar}
          >
            <div className={styles.sidebarHeader}>
              <span className={styles.sidebarBadge}>Attendance</span>
              <h1 className={styles.sidebarTitle}>{meeting.title}</h1>
              <p className={styles.sidebarSubtitle}>
                총 {totalParticipants}명 · {totalMeetingMinutes > 0 ? `${totalMeetingMinutes}분 진행` : '진행 시간 정보 없음'}
              </p>
            </div>

            <div className={styles.sidebarMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>강의명</span>
                <span className={styles.metaValue}>{meeting.title}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>시작 시간</span>
                <span className={styles.metaValue}>{safeFormatTime(scheduleStart)}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>종료 시간</span>
                <span className={styles.metaValue}>{scheduleEnd ? safeFormatTime(scheduleEnd) : '진행 중'}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>참가 코드</span>
                <span className={styles.metaCode}>{meeting.inviteCode}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>상태</span>
                <span className={`${styles.statusBadge} ${statusClassName}`}>{statusLabel}</span>
              </div>
            </div>

            <div className={styles.sidebarDivider} />
          </motion.aside>

          <motion.main
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: 0.08 }}
            className={styles.main}
          >
            <div className={styles.mainHeader}>
              <div className={styles.titleGroup}>
                <span className={styles.mainLabel}>출석 현황</span>
                <h2 className={styles.mainTitle}>참가자 리스트</h2>
                <p className={styles.mainSubtitle}>총 {filteredParticipants.length}명 검색</p>
              </div>

              <div className={styles.actions}>
                <div className={styles.search}>
                  <span className={styles.searchIcon} aria-hidden="true">🔍</span>
                  <input
                    className={styles.searchInput}
                    type="text"
                    placeholder="검색어를 입력하세요."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button className={styles.downloadButton} onClick={exportToExcel}>
                  <img
                    src="/Icons/dashboard/excel.svg"
                    alt=""
                    className={styles.downloadIcon}
                  />
                  다운로드
                </button>
              </div>
            </div>

            <div className={styles.summaryPills}>
              <span className={`${styles.pill} ${styles.pillPrimary}`}>출석률 {attendanceRate}%</span>
              <span className={`${styles.pill} ${styles.pillSecondary}`}>참석 {presentCount}명</span>
              <span className={`${styles.pill} ${styles.pillSoft}`}>미참석 {absentCount}명</span>
            </div>

            <div className={styles.tableCard}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>참가자</th>
                      <th>참석 시간</th>
                      <th>퇴장 시간</th>
                      <th>참여 시간</th>
                      <th>출석률</th>
                      <th>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyState}>
                          검색 결과가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map((participant, index) => {
                        const actualDuration = calculateParticipantDuration(participant);
                        const cappedAttendanceTime = getCappedAttendanceTime(actualDuration, totalMeetingDurationSeconds);
                        const attendancePercentage = Math.min(
                          calculateAttendancePercentage(cappedAttendanceTime, totalMeetingDurationSeconds),
                          100
                        );
                        const attendanceClass = getAttendanceLevelClass(attendancePercentage);

                        return (
                          <tr
                            key={participant._id}
                            className={styles.tableRow}
                            onClick={() => handleParticipantClick(participant)}
                          >
                            <td>{index + 1}</td>
                            <td>
                              <div className={styles.participant}>
                                {participant.avatarUrl ? (
                                  <img
                                    src={participant.avatarUrl}
                                    alt={participant.displayName}
                                    className={styles.avatar}
                                  />
                                ) : (
                                  <div className={styles.avatarFallback}>
                                    {participant.displayName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className={styles.participantName}>{participant.displayName}</div>
                                  {participant.systemRole && (
                                    <div className={styles.participantMeta}>{participant.systemRole}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>{safeFormatTime(participant.joinedAt)}</td>
                            <td>{participant.leftAt ? safeFormatTime(participant.leftAt) : '진행 중'}</td>
                            <td>{formatDuration(cappedAttendanceTime)}</td>
                            <td>
                              <div className={styles.percentage}>
                                <div className={styles.percentageTrack}>
                                  <div
                                    className={`${styles.percentageFill} ${attendanceClass}`}
                                    style={{ width: `${attendancePercentage}%` }}
                                  />
                                </div>
                                <span className={`${styles.percentageValue} ${attendanceClass}`}>
                                  {attendancePercentage}%
                                </span>
                              </div>
                            </td>
                            <td>
                              <button
                                className={styles.ellipsisButton}
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.main>
        </div>
      </div>

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
                    <strong>재접속 횟수:</strong> {Math.max((selectedParticipant.sessionCount ?? 1) - 1, 0)}회
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
    </>
  );
};

export default AttendancePage;


