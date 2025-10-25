import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import InstructorNavigation from '../../components/InstructorNavigation';
import { 
  BarChart3, 
  Users, 
  BookOpen, 
  Clock,
  TrendingUp,
  Award,
  Calendar,
  Settings
} from 'lucide-react';

const InstructorDashboard: React.FC = () => {
  const quickStats = [
    {
      title: '오늘의 강의',
      value: '3',
      icon: BookOpen,
      color: 'blue',
      description: '오늘 예정된 강의'
    },
    {
      title: '총 참가자',
      value: '156',
      icon: Users,
      color: 'green',
      description: '이번 주 참가자 수'
    },
    {
      title: '평균 출석률',
      value: '87.5%',
      icon: TrendingUp,
      color: 'purple',
      description: '최근 30일 평균'
    },
    {
      title: '총 강의 시간',
      value: '1840분',
      icon: Clock,
      color: 'orange',
      description: '이번 달 강의 시간'
    }
  ];

  const recentActivities = [
    {
      title: 'React 기초 강의',
      time: '2시간 전',
      type: '강의 완료',
      participants: 25,
      status: 'completed'
    },
    {
      title: 'JavaScript 고급 개념',
      time: '1일 전',
      type: '강의 완료',
      participants: 18,
      status: 'completed'
    },
    {
      title: 'Node.js 실습',
      time: '2일 전',
      type: '강의 완료',
      participants: 22,
      status: 'completed'
    },
    {
      title: 'TypeScript 심화',
      time: '지금',
      type: '진행 중',
      participants: 15,
      status: 'live'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'live': return 'text-red-600 bg-red-100';
      case 'scheduled': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '완료';
      case 'live': return '진행중';
      case 'scheduled': return '예정';
      default: return '알 수 없음';
    }
  };

  return (
    <>
      <Head>
        <title>강사 대시보드 - HRDe</title>
        <meta name="description" content="강사 대시보드 - 강의 관리 및 출석 현황" />
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
            <h1 className="text-4xl font-bold text-gray-800 mb-2">강사 대시보드</h1>
            <p className="text-gray-600 text-lg">강의 관리 및 출석 현황을 한눈에 확인하세요</p>
          </motion.div>

          {/* Navigation */}
          <InstructorNavigation />

          {/* Quick Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            {quickStats.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${
                    stat.color === 'blue' ? 'bg-blue-100' :
                    stat.color === 'green' ? 'bg-green-100' :
                    stat.color === 'purple' ? 'bg-purple-100' : 'bg-orange-100'
                  }`}>
                    <stat.icon className={`h-8 w-8 ${
                      stat.color === 'blue' ? 'text-blue-600' :
                      stat.color === 'green' ? 'text-green-600' :
                      stat.color === 'purple' ? 'text-purple-600' : 'text-orange-600'
                    }`} />
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${
                      stat.color === 'blue' ? 'text-blue-600' :
                      stat.color === 'green' ? 'text-green-600' :
                      stat.color === 'purple' ? 'text-purple-600' : 'text-orange-600'
                    }`}>
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-500">{stat.title}</div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{stat.description}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Activities */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="lg:col-span-2 bg-white rounded-2xl shadow-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">최근 활동</h2>
                <p className="text-gray-600">최근 강의 및 참가자 활동</p>
              </div>
              
              <div className="divide-y divide-gray-200">
                {recentActivities.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                    className="p-6 hover:bg-gray-50 transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{activity.title}</h3>
                          <p className="text-sm text-gray-500">{activity.type} • {activity.participants}명 참가</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(activity.status)}`}>
                          {getStatusText(activity.status)}
                        </span>
                        <p className="text-sm text-gray-500 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="space-y-6"
            >
              {/* Quick Actions Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">빠른 작업</h3>
                <div className="space-y-3">
                  <Link
                    href="/instructor/attendance"
                    className="flex items-center p-3 rounded-lg hover:bg-blue-50 transition-colors duration-200 group"
                  >
                    <BarChart3 className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="text-gray-700 group-hover:text-blue-700">출석 현황 보기</span>
                  </Link>
                  <Link
                    href="/instructor/meetings"
                    className="flex items-center p-3 rounded-lg hover:bg-green-50 transition-colors duration-200 group"
                  >
                    <BookOpen className="h-5 w-5 text-green-600 mr-3" />
                    <span className="text-gray-700 group-hover:text-green-700">새 강의 만들기</span>
                  </Link>
                  <Link
                    href="/instructor/participants"
                    className="flex items-center p-3 rounded-lg hover:bg-purple-50 transition-colors duration-200 group"
                  >
                    <Users className="h-5 w-5 text-purple-600 mr-3" />
                    <span className="text-gray-700 group-hover:text-purple-700">참가자 관리</span>
                  </Link>
                  <Link
                    href="/instructor/schedule"
                    className="flex items-center p-3 rounded-lg hover:bg-orange-50 transition-colors duration-200 group"
                  >
                    <Calendar className="h-5 w-5 text-orange-600 mr-3" />
                    <span className="text-gray-700 group-hover:text-orange-700">일정 관리</span>
                  </Link>
                </div>
              </div>

              {/* Performance Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">성과 요약</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">이번 주 강의</span>
                    <span className="font-semibold text-gray-900">12회</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">평균 출석률</span>
                    <span className="font-semibold text-green-600">87.5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">총 참가자</span>
                    <span className="font-semibold text-blue-600">156명</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">강의 시간</span>
                    <span className="font-semibold text-purple-600">30.7시간</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstructorDashboard;
