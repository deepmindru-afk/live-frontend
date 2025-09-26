import React, { useState } from 'react';
import Head from 'next/head';

const TestFixesPage = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setTestResults(prev => [...prev, logEntry]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testPaginationFix = async () => {
    clearResults();
    addResult('🧪 Testing pagination fix (page vs offset)...', 'info');
    
    try {
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      
      const query = `
        query GetMyMeetings($input: MeetingQueryInput!) {
          getMeetings(input: $input) {
            meetings {
              _id
              title
              status
              inviteCode
              participantCount
              createdAt
            }
            total
            limit
            page
            hasMore
          }
        }
      `;
      
      // Test with correct pagination parameters
      const result = await makeGraphQLRequest(query, {
        input: {
          limit: 10,
          page: 1
        }
      });
      
      addResult('✅ Pagination fix successful - using page parameter', 'success');
      addResult(`📋 Response: ${JSON.stringify(result, null, 2)}`, 'info');
      
      if (result.getMeetings && result.getMeetings.meetings) {
        addResult(`📊 Found ${result.getMeetings.meetings.length} meetings`, 'success');
      } else {
        addResult('⚠️ No meetings found in response', 'warning');
      }
      
    } catch (error: any) {
      addResult(`❌ Pagination test failed: ${error.message}`, 'error');
    }
  };

  const testImportFix = async () => {
    clearResults();
    addResult('🧪 Testing import path fix...', 'info');
    
    try {
      // Test the corrected import path
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      
      if (!makeGraphQLRequest) {
        addResult('❌ makeGraphQLRequest function not found', 'error');
        return;
      }
      
      addResult('✅ Import path fix successful - makeGraphQLRequest found', 'success');
      
      // Test a simple query
      const query = `
        query TestQuery {
          me {
            _id
            email
            displayName
            systemRole
          }
        }
      `;
      
      const result = await makeGraphQLRequest(query, {});
      addResult('✅ GraphQL request successful', 'success');
      addResult(`📋 Result: ${JSON.stringify(result, null, 2)}`, 'info');
      
    } catch (error: any) {
      addResult(`❌ Import test failed: ${error.message}`, 'error');
    }
  };

  const testInstructorDashboard = async () => {
    clearResults();
    addResult('🧪 Testing instructor dashboard functionality...', 'info');
    
    try {
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      const { GET_MY_MEETINGS } = await import('../../apollo/meeting/queries');
      
      // Get current user
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      if (!user) {
        addResult('❌ No user found - please log in first', 'error');
        return;
      }
      
      addResult(`✅ User found: ${user.displayName || user.email}`, 'success');
      
      // Test with hostId filter
      const result = await makeGraphQLRequest(GET_MY_MEETINGS, {
        input: {
          hostId: user._id,
          limit: 50,
          page: 1
        }
      });
      
      addResult('✅ Instructor dashboard query successful', 'success');
      addResult(`📋 Response: ${JSON.stringify(result, null, 2)}`, 'info');
      
      if (result.getMeetings && result.getMeetings.meetings) {
        addResult(`📊 Found ${result.getMeetings.meetings.length} meetings for user`, 'success');
        
        result.getMeetings.meetings.forEach((meeting: any, index: number) => {
          addResult(`📋 Meeting ${index + 1}: ${meeting.title} (${meeting.status})`, 'info');
        });
      } else {
        addResult('⚠️ No meetings found for user', 'warning');
      }
      
    } catch (error: any) {
      addResult(`❌ Instructor dashboard test failed: ${error.message}`, 'error');
    }
  };

  const runAllTests = async () => {
    setIsLoading(true);
    clearResults();
    
    addResult('🚀 Running all tests...', 'info');
    
    await testPaginationFix();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testImportFix();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testInstructorDashboard();
    
    addResult('✅ All tests completed!', 'success');
    setIsLoading(false);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <Head>
        <title>Test Fixes</title>
      </Head>
      
      <h1>🔧 Test Fixes</h1>
      <p>This page tests the fixes applied to resolve the instructor dashboard issues.</p>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🧪 Test Scenarios</h3>
        <button 
          onClick={testPaginationFix}
          disabled={isLoading}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test Pagination Fix
        </button>
        <button 
          onClick={testImportFix}
          disabled={isLoading}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test Import Fix
        </button>
        <button 
          onClick={testInstructorDashboard}
          disabled={isLoading}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test Instructor Dashboard
        </button>
        <button 
          onClick={runAllTests}
          disabled={isLoading}
          style={{ background: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Run All Tests
        </button>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>📊 Test Results</h3>
        <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', padding: '10px', borderRadius: '5px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '400px', overflowY: 'auto', margin: '10px 0' }}>
          {testResults.length === 0 ? (
            <div style={{ color: '#17a2b8', fontWeight: 'bold' }}>Ready to run tests. Click any test button above.</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                {result}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🔧 Fixes Applied</h3>
        <ol>
          <li><strong>Pagination Fix:</strong> Changed <code>offset</code> to <code>page</code> in GraphQL queries</li>
          <li><strong>Import Path Fix:</strong> Corrected dynamic import paths from <code>../lib/</code> to <code>../../lib/</code></li>
          <li><strong>Schema Alignment:</strong> Ensured frontend queries match backend schema</li>
        </ol>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🧪 Test Links</h3>
        <ul>
          <li><a href="/instructor" target="_blank">Instructor Dashboard</a></li>
          <li><a href="/debug-instructor" target="_blank">Debug Instructor</a></li>
          <li><a href="/test-backend" target="_blank">Test Backend</a></li>
        </ul>
      </div>
    </div>
  );
};

export default TestFixesPage;
