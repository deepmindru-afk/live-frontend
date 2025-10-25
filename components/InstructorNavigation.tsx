import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  Home, 
  BookOpen, 
  Users, 
  BarChart3, 
  Settings,
  Calendar,
  Award
} from 'lucide-react';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navigationItems: NavigationItem[] = [
  {
    name: '대시보드',
    href: '/instructor/dashboard',
    icon: Home,
    description: '전체 현황 보기'
  },
  {
    name: '출석 현황',
    href: '/instructor/attendance',
    icon: BarChart3,
    description: '강의 출석 통계'
  },
  {
    name: '강의 관리',
    href: '/instructor/meetings',
    icon: BookOpen,
    description: '강의 생성 및 관리'
  },
  {
    name: '참가자 관리',
    href: '/instructor/participants',
    icon: Users,
    description: '참가자 현황 관리'
  },
  {
    name: '일정 관리',
    href: '/instructor/schedule',
    icon: Calendar,
    description: '강의 일정 관리'
  },
  {
    name: '성과 분석',
    href: '/instructor/analytics',
    icon: Award,
    description: '강의 성과 분석'
  }
];

const InstructorNavigation: React.FC = () => {
  const router = useRouter();

  return (
    <nav className="bg-white shadow-lg rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">강사 메뉴</h2>
        <div className="text-sm text-gray-500">
          강의 관리 및 출석 현황을 확인하세요
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {navigationItems.map((item) => {
          const isActive = router.pathname === item.href || 
                          (item.href !== '/instructor/dashboard' && router.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group relative p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                isActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  isActive 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600'
                }`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className={`font-medium ${
                    isActive ? 'text-blue-900' : 'text-gray-900 group-hover:text-blue-900'
                  }`}>
                    {item.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {item.description}
                  </div>
                </div>
              </div>
              
              {isActive && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default InstructorNavigation;
