import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  BarChart3,
  Users,
  Clock
} from 'lucide-react';

const TestAttendancePage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Attendance Dashboard Test - HRDe</title>
        <meta name="description" content="Test the attendance dashboard functionality" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 py-12">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              🔧 Attendance Dashboard Test
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Test the instructor attendance dashboard with different authentication states
            </p>
          </motion.div>

          {/* Problem Explanation */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg p-8 mb-8"
          >
            <div className="flex items-start space-x-4 mb-6">
              <AlertCircle className="h-8 w-8 text-orange-500 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Problem Identified</h2>
                <p className="text-gray-600 mb-4">
                  The "Unable to Load Meetings" error occurs because:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Frontend tries to load meeting data via GraphQL</li>
                  <li>Backend requires authentication (JWT token)</li>
                  <li>No valid token is present in localStorage</li>
                  <li>Backend returns <code className="bg-gray-100 px-2 py-1 rounded">TOKEN_NOT_EXIST</code> error</li>
                  <li>Frontend shows error modal instead of data</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Solution */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="bg-white rounded-2xl shadow-lg p-8 mb-8"
          >
            <div className="flex items-start space-x-4 mb-6">
              <CheckCircle className="h-8 w-8 text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Solution Implemented</h2>
                <p className="text-gray-600 mb-4">
                  Added graceful authentication handling with multiple options:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li><strong>Login Options:</strong> User can choose to login or continue with demo</li>
                  <li><strong>Test Login:</strong> Automatic test login for demonstration</li>
                  <li><strong>Demo Mode:</strong> Mock data when authentication fails</li>
                  <li><strong>Error Recovery:</strong> Graceful fallback to mock data</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Test Scenarios */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
          >
            {/* Scenario 1: No Authentication */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Users className="h-6 w-6 text-blue-500 mr-2" />
                Scenario 1: No Authentication
              </h3>
              <p className="text-gray-600 mb-4">
                Test the dashboard without being logged in. You'll see the authentication dialog.
              </p>
              <Link
                href="/instructor/attendance"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Test Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </div>

            {/* Scenario 2: With Mock Data */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <BarChart3 className="h-6 w-6 text-green-500 mr-2" />
                Scenario 2: Demo Mode
              </h3>
              <p className="text-gray-600 mb-4">
                Choose "데모 모드로 보기" to see the dashboard with mock data.
              </p>
              <Link
                href="/instructor/attendance"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Test Demo Mode
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </div>

            {/* Scenario 3: Meeting Detail */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Clock className="h-6 w-6 text-purple-500 mr-2" />
                Scenario 3: Meeting Detail
              </h3>
              <p className="text-gray-600 mb-4">
                Test the detailed attendance view for a specific meeting.
              </p>
              <Link
                href="/instructor/attendance/demo-meeting-123"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
              >
                Test Meeting Detail
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </div>

            {/* Scenario 4: Demo Showcase */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <CheckCircle className="h-6 w-6 text-orange-500 mr-2" />
                Scenario 4: Full Demo
              </h3>
              <p className="text-gray-600 mb-4">
                View the complete demo showcase with all features.
              </p>
              <Link
                href="/demo/attendance"
                className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200"
              >
                View Full Demo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </div>
          </motion.div>

          {/* Technical Details */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="bg-gray-50 rounded-2xl p-8"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Technical Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Backend Status</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✅ NestJS Server: Running on port 3007</li>
                  <li>✅ GraphQL Endpoint: http://localhost:3007/graphql</li>
                  <li>✅ Health Check: http://localhost:3007/health</li>
                  <li>⚠️ Authentication: Requires valid JWT token</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Frontend Status</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✅ Next.js Server: Running on port 3000</li>
                  <li>✅ Apollo Client: Configured for port 3007</li>
                  <li>✅ Error Handling: Graceful fallback to mock data</li>
                  <li>✅ Authentication: Multiple login options</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default TestAttendancePage;
