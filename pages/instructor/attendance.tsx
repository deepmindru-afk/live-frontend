import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { GET_TUTOR_ATTENDANCE_SUMMARY } from '../../apollo/meeting/queries';
import Swal from 'sweetalert2';
import { 
  Calendar, 
  Clock, 
  Users, 
  TrendingUp, 
  Eye,
  ArrowRight,
  BookOpen,
  Award
} from 'lucide-react';

interface Meeting {
  _id: string;
  title: string;
  startTime: string;
  endTime?: string;
  duration: number;
  participantCount: number;
  attendanceRate: number;
  status: string;
}

interface TutorAttendanceSummary {
  totalMeetings: number;
  totalTime: number; // in minutes
  totalParticipants: number;
  averageAttendance: number;
  meetings: Meeting[];
}

const InstructorAttendanceDashboard: React.FC = () => {
  const router = useRouter();
  const [summary, setSummary] = useState<TutorAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttendanceSummary();
  }, []);

  const loadAttendanceSummary = async () => {
    try {
      setLoading(true);
      
      // Check authentication
      const token = localStorage.getItem('token') || localStorage.getItem('jwt');
      if (!token) {
        // Show login options instead of redirecting
        const result = await Swal.fire({
          title: '로그인이 필요합니다',
          text: '출석 현황을 보려면 로그인하세요.',
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
            const { forceLogin } = await import('../../lib/simple-auth-handlers');
            const loginSuccess = await forceLogin();
            if (loginSuccess) {
              // Retry loading data after login
              loadAttendanceSummary();
              return;
            }
          } catch (error) {
          }
        }
        // If user chose "데모 모드로 보기", continue with mock data
      }

      // For now, we'll use mock data since the GraphQL query might not exist yet
      // In production, this would be: await enhancedMakeGraphQLRequest(GET_TUTOR_ATTENDANCE_SUMMARY, {});
      
      // Mock data for demonstration
      const mockSummary: TutorAttendanceSummary = {
        totalMeetings: 24,
        totalTime: 1840, // 30.67 hours
        totalParticipants: 156,
        averageAttendance: 87.5,
        meetings: [
          {
            _id: '1',
            title: 'React 기초 강의',
            startTime: '2024-01-15T09:00:00Z',
            endTime: '2024-01-15T11:00:00Z',
            duration: 120,
            participantCount: 25,
            attendanceRate: 92.3,
            status: 'COMPLETED'
          },
          {
            _id: '2',
            title: 'JavaScript 고급 개념',
            startTime: '2024-01-16T14:00:00Z',
            endTime: '2024-01-16T16:30:00Z',
            duration: 150,
            participantCount: 18,
            attendanceRate: 88.9,
            status: 'COMPLETED'
          },
          {
            _id: '3',
            title: 'Node.js 실습',
            startTime: '2024-01-17T10:00:00Z',
            endTime: '2024-01-17T12:00:00Z',
            duration: 120,
            participantCount: 22,
            attendanceRate: 95.5,
            status: 'COMPLETED'
          },
          {
            _id: '4',
            title: 'TypeScript 심화',
            startTime: '2024-01-18T15:00:00Z',
            duration: 90,
            participantCount: 15,
            attendanceRate: 0,
            status: 'LIVE'
          }
        ]
      };

      setSummary(mockSummary);
    } catch (error) {
      Swal.fire({ 
        icon: 'error', 
        title: '데이터 로딩 실패', 
        text: '출석 데이터를 불러오지 못했습니다.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('ko-KR', {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100';
      case 'LIVE': return 'text-red-600 bg-red-100';
      case 'SCHEDULED': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '완료';
      case 'LIVE': return '진행중';
      case 'SCHEDULED': return '예정';
      default: return '알 수 없음';
    }
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

  return (
    <>
      <Head>
        <title>강사 출석 현황 - HRDe</title>
        <meta name="description" content="강사 출석 현황 및 통계" />
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
            <h1 className="text-4xl font-bold text-gray-800 mb-2">출석 현황 대시보드</h1>
            <p className="text-gray-600 text-lg">강의 출석 통계 및 참가자 현황을 확인하세요</p>
          </motion.div>

          {/* Animated Summary Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            {/* Total Meetings */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <BookOpen className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">
                    <CountUp end={summary?.totalMeetings || 0} duration={2} />
                  </div>
                  <div className="text-sm text-gray-500">총 강의 수</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div 
                  className="bg-blue-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, delay: 0.5 }}
                />
              </div>
            </motion.div>

            {/* Total Teaching Time */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Clock className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-600">
                    <CountUp end={summary?.totalTime || 0} duration={2} suffix="분" />
                  </div>
                  <div className="text-sm text-gray-500">총 강의 시간</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div 
                  className="bg-green-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: '85%' }}
                  transition={{ duration: 2, delay: 0.7 }}
                />
              </div>
            </motion.div>

            {/* Total Participants */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-purple-600">
                    <CountUp end={summary?.totalParticipants || 0} duration={2} />
                  </div>
                  <div className="text-sm text-gray-500">총 참가자</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div 
                  className="bg-purple-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: '92%' }}
                  transition={{ duration: 2, delay: 0.9 }}
                />
              </div>
            </motion.div>

            {/* Average Attendance Rate */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-orange-600">
                    <CountUp end={summary?.averageAttendance || 0} duration={2} decimals={1} suffix="%" />
                  </div>
                  <div className="text-sm text-gray-500">평균 출석률</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div 
                  className="bg-orange-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${summary?.averageAttendance || 0}%` }}
                  transition={{ duration: 2, delay: 1.1 }}
                />
              </div>
            </motion.div>
          </motion.div>

          {/* Meetings Table */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="bg-white rounded-2xl shadow-lg overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">강의 목록</h2>
              <p className="text-gray-600">각 강의의 출석 현황을 확인하세요</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      강의 제목
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      총 시간
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      시작 시간
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      종료 시간
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      참가자
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
                  {summary?.meetings.map((meeting, index) => (
                    <motion.tr 
                      key={meeting._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="hover:bg-gray-50 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                              <BookOpen className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {meeting.title}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {meeting._id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(meeting.duration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(meeting.startTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {meeting.endTime ? formatTime(meeting.endTime) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-gray-400 mr-1" />
                          {meeting.participantCount}명
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
                              style={{ width: `${meeting.attendanceRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {meeting.attendanceRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(meeting.status)}`}>
                          {getStatusText(meeting.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => router.push(`/instructor/attendance/${meeting._id}`)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          상세보기
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default InstructorAttendanceDashboard;
