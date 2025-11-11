import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { enhancedMakeGraphQLRequest } from '../../../lib/mock-graphql-service';
import { GET_MEETING_BY_ID } from '../../../apollo/meeting/queries';
import { GET_MEETING_ATTENDANCE } from '../../../apollo/livestream/queries';
import Swal from 'sweetalert2';
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  TrendingUp, 
  Download,
  Search,
  Filter,
  User,
  Mail,
  Building,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

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
  totalTime: number;
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
  duration?: number;
  createdAt: string;
  endedAt?: string;
  scheduledFor?: string;
  actualStartAt?: string;
}

const MeetingAttendanceDetail: React.FC = () => {
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
      
      const token = localStorage.getItem('token') || localStorage.getItem('jwt');
      if (!token) {
        // Show login options instead of redirecting
        const result = await Swal.fire({
          title: '로그인이 필요합니다',
          text: '출석 상세 정보를 보려면 로그인하세요.',
          icon: 'info',
          showCancelButton: true,
          confirmButtonText: '로그인하기',
          cancelButtonText: '데모 모드로 보기',
          showDenyButton: true,
          denyButtonText: '테스트 로그인'
        });
        
        if (result.isConfirmed) {
          router.push('/login');
          return;
        } else if (result.isDenied) {
          // Try test login
          try {
            const { forceLogin } = await import('../../../lib/simple-auth-handlers');
            const loginSuccess = await forceLogin();
            if (loginSuccess) {
              // Retry loading data after login
              loadMeetingData();
              return;
            }
          } catch (error) {
          }
        }
        // If user chose "데모 모드로 보기", continue with mock data
      }

      // Load meeting details
      try {
        const meetingResult = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
          meetingId: meetingId
        });
        
        if (meetingResult.getMeetingById) {
          setMeeting(meetingResult.getMeetingById);
        }
      } catch (error) {
        // Use mock data if query fails
        setMeeting({
          _id: meetingId as string,
          title: 'React 기초 강의 (데모)',
          status: 'ENDED',
          inviteCode: 'DEMO123',
          participantCount: 25,
          duration: 7200, // 2 hours in seconds
          createdAt: '2024-01-15T09:00:00Z',
          endedAt: '2024-01-15T11:00:00Z',
          actualStartAt: '2024-01-15T09:00:00Z'
        });
      }

      // Load attendance data
      try {
        const attendanceResult = await enhancedMakeGraphQLRequest(GET_MEETING_ATTENDANCE, {
          meetingId: meetingId
        });
        
        if (!attendanceResult?.getMeetingAttendance) {
          // Use mock attendance data
          const mockAttendance: MeetingAttendance = {
            meetingId: meetingId as string,
            totalParticipants: 25,
            presentParticipants: 23,
            absentParticipants: 2,
            averageAttendanceTime: 5400, // 90 minutes
            attendanceRate: 92,
            participants: [
              {
                _id: '1',
                displayName: '김학생',
                email: 'kim@example.com',
                organization: '한국대학교',
                department: '컴퓨터공학과',
                role: 'PARTICIPANT',
                joinedAt: '2024-01-15T09:00:00Z',
                leftAt: '2024-01-15T10:45:00Z',
                totalTime: 6300,
                sessionCount: 1,
                isCurrentlyOnline: false,
                status: 'LEFT',
                micState: 'ON',
                cameraState: 'ON',
                hasHandRaised: false,
                sessions: [{
                  joinedAt: '2024-01-15T09:00:00Z',
                  leftAt: '2024-01-15T10:45:00Z',
                  durationSec: 6300
                }]
              },
              {
                _id: '2',
                displayName: '이학생',
                email: 'lee@example.com',
                organization: '서울대학교',
                department: '정보통신공학과',
                role: 'PARTICIPANT',
                joinedAt: '2024-01-15T09:05:00Z',
                leftAt: '2024-01-15T11:00:00Z',
                totalTime: 6900,
                sessionCount: 1,
                isCurrentlyOnline: false,
                status: 'LEFT',
                micState: 'OFF',
                cameraState: 'ON',
                hasHandRaised: true,
                handRaisedAt: '2024-01-15T10:30:00Z',
                sessions: [{
                  joinedAt: '2024-01-15T09:05:00Z',
                  leftAt: '2024-01-15T11:00:00Z',
                  durationSec: 6900
                }]
              }
            ]
          };
          setAttendance(mockAttendance);
          return;
        }
        setAttendance(attendanceResult.getMeetingAttendance);
      } catch (err) {
        // Use mock data on error
        const mockAttendance: MeetingAttendance = {
          meetingId: meetingId as string,
          totalParticipants: 25,
          presentParticipants: 23,
          absentParticipants: 2,
          averageAttendanceTime: 5400,
          attendanceRate: 92,
          participants: [
            {
              _id: '1',
              displayName: '김학생',
              email: 'kim@example.com',
              organization: '한국대학교',
              department: '컴퓨터공학과',
              role: 'PARTICIPANT',
              joinedAt: '2024-01-15T09:00:00Z',
              leftAt: '2024-01-15T10:45:00Z',
              totalTime: 6300,
              sessionCount: 1,
              isCurrentlyOnline: false,
              status: 'LEFT',
              micState: 'ON',
              cameraState: 'ON',
              hasHandRaised: false,
              sessions: [{
                joinedAt: '2024-01-15T09:00:00Z',
                leftAt: '2024-01-15T10:45:00Z',
                durationSec: 6300
              }]
            }
          ]
        };
        setAttendance(mockAttendance);
      }
    } catch (error) {
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
  const safeParticipantTime = Math.max(0, participantTime);
  const percentage = Math.round((safeParticipantTime / totalMeetingTime) * 100);
  return Math.min(percentage, 100);
};

  const getTotalMeetingDuration = () => {
    if (!meeting) return 0;
    
    if (meeting.actualStartAt && meeting.endedAt) {
      const startTime = new Date(meeting.actualStartAt).getTime();
      const endTime = new Date(meeting.endedAt).getTime();
      return Math.floor((endTime - startTime) / 1000);
    } else if (meeting.actualStartAt) {
      const startTime = new Date(meeting.actualStartAt).getTime();
      const currentTime = Date.now();
      return Math.floor((currentTime - startTime) / 1000);
    } else if (meeting.duration) {
      return meeting.duration * 60;
    }
    
    return 0;
  };

const parseDateTime = (value: string | number | Date | null | undefined): number | null => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) {
      const numeric = parseInt(value, 10);
      return Number.isFinite(numeric) ? numeric : null;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const fallback = Date.parse(value as unknown as string);
  return Number.isNaN(fallback) ? null : fallback;
};

const getParticipantAttendanceSeconds = (participant: ParticipantAttendance, totalMeetingTime: number) => {
  const joinedAtMs = parseDateTime(participant.joinedAt);

  let leftAtMs = parseDateTime(participant.leftAt);

  if (!leftAtMs) {
    if (meeting?.status === 'ENDED' || meeting?.status === 'END') {
      leftAtMs = parseDateTime(meeting?.endedAt);
    } else if (meeting?.status === 'LIVE' || meeting?.status === 'STARTED') {
      leftAtMs = Date.now();
    }
  }

  let durationFromTimeline = 0;
  if (joinedAtMs && leftAtMs && leftAtMs > joinedAtMs) {
    durationFromTimeline = Math.floor((leftAtMs - joinedAtMs) / 1000);
  }

  const sessionsDuration = Array.isArray(participant.sessions)
    ? participant.sessions.reduce((acc, session) => {
        if (!session) return acc;

        if (typeof session.durationSec === 'number' && session.durationSec > 0) {
          return acc + session.durationSec;
        }

        const sessionJoin = parseDateTime(session.joinedAt);
        const sessionLeft = parseDateTime(session.leftAt);

        if (sessionJoin && sessionLeft && sessionLeft > sessionJoin) {
          return acc + Math.floor((sessionLeft - sessionJoin) / 1000);
        }

        return acc;
      }, 0)
    : 0;

  const reportedTotal = typeof participant.totalTime === 'number' && participant.totalTime > 0
    ? participant.totalTime
    : 0;

  let resolved = Math.max(reportedTotal, sessionsDuration, durationFromTimeline);

  if (totalMeetingTime > 0) {
    resolved = Math.min(resolved, totalMeetingTime);
  }

  return Math.max(0, resolved);
};

  const filteredParticipants = attendance?.participants.filter(participant =>
    participant.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (participant.email && participant.email.toLowerCase().includes(searchTerm.toLowerCase()))
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
        const attendanceSeconds = getParticipantAttendanceSeconds(participant, totalMeetingDuration);
        const attendancePercentage = calculateAttendancePercentage(attendanceSeconds, totalMeetingDuration);
        return [
          index + 1,
          participant.displayName,
          participant.email || '',
          participant.organization || '',
          participant.department || '',
          participant.systemRole || '',
          formatTime(participant.joinedAt),
          participant.leftAt ? formatTime(participant.leftAt) : '진행 중',
          formatDuration(attendanceSeconds),
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">출석 데이터를 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">미팅을 찾을 수 없습니다</h1>
          <button
            onClick={() => router.push('/instructor/attendance')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            출석 대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const totalMeetingDuration = getTotalMeetingDuration();

  return (
    <>
      <Head>
        <title>출석 상세 - {meeting.title}</title>
        <meta name="description" content="미팅 출석 현황 및 참가자 정보" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/instructor/attendance')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <ArrowLeft className="h-6 w-6 text-gray-600" />
                </button>
                <div>
                  <h1 className="text-4xl font-bold text-gray-800 mb-2">출석 상세 현황</h1>
                  <p className="text-gray-600 text-lg">{meeting.title}</p>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatTime(meeting.createdAt)}
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {meeting.participantCount}명 참가
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatDurationShort(totalMeetingDuration)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Excel 다운로드
                </button>
              </div>
            </div>
          </motion.div>

          {/* Circular Progress Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            {/* Total Meeting Time */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="text-center">
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-200"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <motion.path
                      className="text-blue-600"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, delay: 0.5 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        <CountUp end={Math.floor(totalMeetingDuration / 60)} duration={2} />
                      </div>
                      <div className="text-xs text-gray-500">분</div>
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">총 강의 시간</h3>
                <p className="text-sm text-gray-600">{formatDurationShort(totalMeetingDuration)}</p>
              </div>
            </motion.div>

            {/* Total Participants */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="text-center">
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-200"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <motion.path
                      className="text-green-600"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, delay: 0.7 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        <CountUp end={attendance?.totalParticipants || 0} duration={2} />
                      </div>
                      <div className="text-xs text-gray-500">명</div>
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">총 참가자</h3>
                <p className="text-sm text-gray-600">
                  참석: {attendance?.presentParticipants || 0}명
                </p>
              </div>
            </motion.div>

            {/* Average Attendance Time */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="text-center">
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-200"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <motion.path
                      className="text-purple-600"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, delay: 0.9 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        <CountUp end={Math.floor((attendance?.averageAttendanceTime || 0) / 60)} duration={2} />
                      </div>
                      <div className="text-xs text-gray-500">분</div>
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">평균 참여 시간</h3>
                <p className="text-sm text-gray-600">
                  {attendance?.averageAttendanceTime ? formatDurationShort(attendance.averageAttendanceTime) : 'N/A'}
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* Search and Filter */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg mb-6"
          >
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="참가자 이름 또는 이메일로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200">
                <Filter className="h-5 w-5" />
              </button>
            </div>
          </motion.div>

          {/* Participants Table */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="bg-white rounded-2xl shadow-lg overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">참가자 목록</h2>
              <p className="text-gray-600">총 {filteredParticipants.length}명의 참가자</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      참가자
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      참석 시간
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      퇴장 시간
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      총 참여 시간
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      출석률
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredParticipants.map((participant, index) => {
                    const attendanceSeconds = getParticipantAttendanceSeconds(participant, totalMeetingDuration);
                    const attendancePercentage = calculateAttendancePercentage(attendanceSeconds, totalMeetingDuration);
                    
                    return (
                      <motion.tr 
                        key={participant._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.05 }}
                        className="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                        onClick={() => handleParticipantClick(participant)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {participant.avatarUrl ? (
                                <img 
                                  src={participant.avatarUrl} 
                                  alt={participant.displayName}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                                  <User className="h-5 w-5 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {participant.displayName}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center">
                                {participant.email && (
                                  <>
                                    <Mail className="h-3 w-3 mr-1" />
                                    {participant.email}
                                  </>
                                )}
                              </div>
                              {participant.organization && (
                                <div className="text-xs text-gray-400 flex items-center">
                                  <Building className="h-3 w-3 mr-1" />
                                  {participant.organization}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatTime(participant.joinedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {participant.leftAt ? formatTime(participant.leftAt) : (
                            <span className="text-green-600 font-medium">진행 중</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDuration(attendanceSeconds)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  attendancePercentage >= 80 ? 'bg-green-500' : 
                                  attendancePercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(attendancePercentage, 100)}%` }}
                              />
                            </div>
                            <span className={`text-sm font-medium ${
                              attendancePercentage >= 80 ? 'text-green-600' : 
                              attendancePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {attendancePercentage}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                              participant.status === 'ONLINE' ? 'bg-green-100 text-green-800' :
                              participant.status === 'PRESENT' ? 'bg-blue-100 text-blue-800' :
                              participant.status === 'LEFT' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {participant.status === 'ONLINE' ? '온라인' :
                               participant.status === 'PRESENT' ? '참석' :
                               participant.status === 'LEFT' ? '퇴장' : '미정'}
                            </span>
                            {participant.hasHandRaised && (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                ✋ 손들기
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleParticipantClick(participant);
                            }}
                            className="text-blue-600 hover:text-blue-900 transition-colors duration-200"
                          >
                            상세보기
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default MeetingAttendanceDetail;
