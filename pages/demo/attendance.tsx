import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  BarChart3, 
  Users, 
  Clock, 
  TrendingUp,
  BookOpen,
  Award,
  CheckCircle
} from 'lucide-react';

const AttendanceDemo: React.FC = () => {
  const features = [
    {
      title: 'Animated Dashboard',
      description: 'Smooth counting animations and circular progress indicators',
      icon: BarChart3,
      color: 'blue'
    },
    {
      title: 'Meeting Analytics',
      description: 'Detailed attendance statistics and participant insights',
      icon: Users,
      color: 'green'
    },
    {
      title: 'Real-time Data',
      description: 'Live updates and current participant status tracking',
      icon: Clock,
      color: 'purple'
    },
    {
      title: 'Export Functionality',
      description: 'Download attendance data as Excel/CSV files',
      icon: TrendingUp,
      color: 'orange'
    }
  ];

  const stats = [
    { label: 'Total Meetings', value: '24', icon: BookOpen },
    { label: 'Total Participants', value: '156', icon: Users },
    { label: 'Average Attendance', value: '87.5%', icon: TrendingUp },
    { label: 'Total Teaching Time', value: '30.7h', icon: Clock }
  ];

  return (
    <>
      <Head>
        <title>Attendance Dashboard Demo - HRDe</title>
        <meta name="description" content="Modern instructor attendance dashboard with animations" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 py-12">
          {/* Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl font-bold text-gray-800 mb-6">
              🎨 Modern Attendance Dashboard
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              A beautiful, animated instructor attendance dashboard built with React, 
              Framer Motion, and Tailwind CSS. Track participant engagement with 
              smooth animations and modern UI components.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/instructor/attendance"
                className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 text-lg font-semibold"
              >
                <BarChart3 className="h-6 w-6 mr-2" />
                View Dashboard
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
              <Link
                href="/instructor/dashboard"
                className="inline-flex items-center px-8 py-4 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-colors duration-200 text-lg font-semibold border-2 border-gray-200"
              >
                <Award className="h-6 w-6 mr-2" />
                Instructor Dashboard
              </Link>
            </div>
          </motion.div>

          {/* Stats Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <stat.icon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-800 mb-2">{stat.value}</div>
                <div className="text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Features Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-800 text-center mb-12">
              ✨ Key Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-xl ${
                      feature.color === 'blue' ? 'bg-blue-100' :
                      feature.color === 'green' ? 'bg-green-100' :
                      feature.color === 'purple' ? 'bg-purple-100' : 'bg-orange-100'
                    }`}>
                      <feature.icon className={`h-8 w-8 ${
                        feature.color === 'blue' ? 'text-blue-600' :
                        feature.color === 'green' ? 'text-green-600' :
                        feature.color === 'purple' ? 'text-purple-600' : 'text-orange-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Technology Stack */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="bg-white rounded-2xl shadow-lg p-8 mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">
              🚀 Technology Stack
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { name: 'React 19', color: 'bg-blue-100 text-blue-800' },
                { name: 'Next.js 15', color: 'bg-gray-100 text-gray-800' },
                { name: 'TypeScript', color: 'bg-blue-100 text-blue-800' },
                { name: 'Tailwind CSS', color: 'bg-cyan-100 text-cyan-800' },
                { name: 'Framer Motion', color: 'bg-purple-100 text-purple-800' },
                { name: 'React CountUp', color: 'bg-green-100 text-green-800' },
                { name: 'Lucide Icons', color: 'bg-orange-100 text-orange-800' },
                { name: 'GraphQL', color: 'bg-pink-100 text-pink-800' }
              ].map((tech, index) => (
                <motion.div
                  key={tech.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.7 + index * 0.05 }}
                  className={`px-4 py-2 rounded-lg text-center font-semibold ${tech.color}`}
                >
                  {tech.name}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Call to Action */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white"
          >
            <h2 className="text-3xl font-bold mb-4">
              Ready to Experience the Future?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Explore the modern attendance dashboard with smooth animations and intuitive design.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/instructor/attendance"
                className="inline-flex items-center px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-gray-100 transition-colors duration-200 text-lg font-semibold"
              >
                <CheckCircle className="h-6 w-6 mr-2" />
                Try Dashboard Now
              </Link>
              <Link
                href="/ATTENDANCE_DASHBOARD_README.md"
                className="inline-flex items-center px-8 py-4 bg-transparent border-2 border-white text-white rounded-xl hover:bg-white hover:text-blue-600 transition-colors duration-200 text-lg font-semibold"
              >
                View Documentation
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default AttendanceDemo;
