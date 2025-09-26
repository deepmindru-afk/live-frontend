import React, { useState, useEffect } from 'react';
import Head from 'next/head';

const DebugInstructorPage = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  const runDebug = async () => {
    setIsLoading(true);
    const info: any = {};

    try {
      // 1. Check authentication
      const userStr = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      info.auth = {
        hasUser: !!userStr,
        hasToken: !!token,
        user: userStr ? JSON.parse(userStr) : null
      };

      // 2. Test GraphQL connection
      try {
        const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
        info.graphql = { makeGraphQLRequestAvailable: true };
        
        // Test simple query
        const testQuery = `
          query TestQuery {
            me {
              _id
              email
              displayName
              systemRole
            }
          }
        `;
        
        const testResult = await makeGraphQLRequest(testQuery, {});
        info.graphql.testQuerySuccess = true;
        info.graphql.testResult = testResult;
        
      } catch (error: any) {
        info.graphql = { 
          makeGraphQLRequestAvailable: false, 
          error: error.message 
        };
      }

      // 3. Test meeting query
      if (info.auth.user) {
        try {
          const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
          const { GET_MY_MEETINGS } = await import('../../apollo/meeting/queries');
          
          const meetingResult = await makeGraphQLRequest(GET_MY_MEETINGS, {
            input: {
              hostId: info.auth.user._id,
              limit: 50,
              page: 1
            }
          });
          
          info.meetings = {
            querySuccess: true,
            result: meetingResult,
            meetingCount: meetingResult.getMeetings?.meetings?.length || 0
          };
          
        } catch (error: any) {
          info.meetings = {
            querySuccess: false,
            error: error.message
          };
        }
      }

      // 4. Test meeting query without hostId
      try {
        const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
        const { GET_MY_MEETINGS } = await import('../../apollo/meeting/queries');
        
        const meetingResultNoHostId = await makeGraphQLRequest(GET_MY_MEETINGS, {
          input: {
            limit: 50,
            page: 1
          }
        });
        
        info.meetingsNoHostId = {
          querySuccess: true,
          result: meetingResultNoHostId,
          meetingCount: meetingResultNoHostId.getMeetings?.meetings?.length || 0
        };
        
      } catch (error: any) {
        info.meetingsNoHostId = {
          querySuccess: false,
          error: error.message
        };
      }

    } catch (error: any) {
      info.generalError = error.message;
    }

    setDebugInfo(info);
    setIsLoading(false);
  };

  useEffect(() => {
    runDebug();
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <Head>
        <title>Debug Instructor Dashboard</title>
      </Head>
      
      <h1>🔍 Debug Instructor Dashboard</h1>
      <p>This page helps debug the instructor dashboard issues.</p>

      <div style={{ margin: '20px 0' }}>
        <button 
          onClick={runDebug}
          disabled={isLoading}
          style={{ 
            background: '#007bff', 
            color: 'white', 
            border: 'none', 
            padding: '10px 20px', 
            borderRadius: '5px', 
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {isLoading ? 'Running Debug...' : 'Run Debug Again'}
        </button>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>📊 Debug Results</h3>
        <pre style={{ 
          background: '#f8f9fa', 
          border: '1px solid #e9ecef', 
          padding: '15px', 
          borderRadius: '5px', 
          fontSize: '12px', 
          maxHeight: '600px', 
          overflowY: 'auto',
          whiteSpace: 'pre-wrap'
        }}>
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🔧 Quick Fixes</h3>
        <ol>
          <li><strong>If no user found:</strong> Go to login page and log in again</li>
          <li><strong>If GraphQL fails:</strong> Check if backend server is running on port 3007</li>
          <li><strong>If meetings query fails:</strong> Check backend logs for errors</li>
          <li><strong>If no meetings found:</strong> Create a test meeting first</li>
        </ol>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🧪 Test Links</h3>
        <ul>
          <li><a href="/test-instructor" target="_blank">Test Instructor Page</a></li>
          <li><a href="/instructor" target="_blank">Instructor Dashboard</a></li>
          <li><a href="/login" target="_blank">Login Page</a></li>
        </ul>
      </div>
    </div>
  );
};

export default DebugInstructorPage;
